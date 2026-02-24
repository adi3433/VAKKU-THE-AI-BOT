/**
 * RAG Orchestrator V2.1 — Hybrid Retrieval-Augmented Generation
 * ──────────────────────────────────────────────────────────────
 * 4-Stage Pipeline:
 *   1. Embed query (qwen3-embedding-8b)
 *   2. Vector + BM25 hybrid search → top 15 candidates
 *   3. Rerank with qwen3-reranker-8b → top 3 passages
 *   4. Generate with qwen3-vl-30b-a3b-thinking (text-only mode)
 *
 * V2.1 additions:
 *   - Per-chunk retrieval trace for audit
 *   - Prompt versioning via prompts.ts
 *   - Configurable confidence: 20% similarity + 40% reranker + 20% self-score + 20% validation
 *   - Memory context injection (opt-in)
 */

import type { ChatMessage, ChatSource, ActionItem, RetrievalTraceEntry } from '@/types';
import { retrievePassages } from './retriever';
import { rerankPassages, type RerankResult } from './reranker';
import { generateAnswer } from './generator';
import { extractActions } from './actions';
import { getConfig, estimateTokens, trimToTokenBudget } from '@/lib/fireworks';
import {
  ragSystemPrompt,
  ragUserPrompt,
  computePromptHash,
  getTemplateVersion,
} from '@/lib/prompts';
import { buildMemoryContext } from '@/lib/memory';

export interface RAGInput {
  query: string;
  locale: 'en' | 'ml';
  conversationHistory: ChatMessage[];
  userId?: string; // for memory context
}

export interface RAGOutput {
  text: string;
  confidence: number;
  sources: ChatSource[];
  actionable: ActionItem[];
  retrievalScore: number;
  rerankerScores: number[];
  retrievalTrace: RetrievalTraceEntry[];
  generatorModel: string;
  promptVersionHash: string;
  trace: RAGTrace;
  escalate: boolean;
}

export interface RAGTrace {
  retrievalLatencyMs: number;
  rerankLatencyMs: number;
  generationLatencyMs: number;
  totalLatencyMs: number;
  retrievedCount: number;
  rerankedCount: number;
  contextTokens: number;
  promptTokens: number;
  completionTokens: number;
  promptVersion: string;
}

const PROMPT_VERSION = getTemplateVersion('rag-system');

// Max token budgets
const MAX_CONTEXT_TOKENS = 3000;
const MAX_PROMPT_TOKENS = 1500;
const ESCALATION_THRESHOLD = 0.55;

export async function ragOrchestrate(input: RAGInput): Promise<RAGOutput> {
  const { query, locale, conversationHistory, userId } = input;
  const cfg = getConfig();
  const totalStart = Date.now();

  // ── Stage 1 & 2: Hybrid retrieval (embed + vector + BM25) ──
  const retrieval = await retrievePassages(query, locale, MAX_CONTEXT_TOKENS);
  const retrievalLatencyMs = retrieval.retrievalLatencyMs;

  // ── Stage 3: Rerank with qwen3-reranker-8b ─────────────────
  const rerankStart = Date.now();
  const reranked: RerankResult[] = await rerankPassages(query, retrieval.passages, 3);
  const rerankLatencyMs = Date.now() - rerankStart;

  // Use reranked passages for context (top 3)
  const topPassages = reranked.map((r) => r.passage);
  const rerankerScores = reranked.map((r) => r.rerankerScore);

  // ── Build retrieval trace (per-chunk audit) ────────────────
  const retrievalTrace: RetrievalTraceEntry[] = reranked.map((r) => ({
    docId: r.passage.id,
    chunkId: r.passage.id,
    similarityScore: r.passage.score,
    rerankerScore: r.rerankerScore,
  }));

  // ── Stage 4: Build prompt & generate ────────────────────────
  const contextBlock = topPassages
    .map(
      (p, i) =>
        `[Source ${i + 1}: ${p.metadata.source}]\n${p.content}\n(URL: ${p.metadata.url}, Updated: ${p.metadata.lastUpdated})`
    )
    .join('\n\n');

  const conversationBlock = conversationHistory
    .slice(-6)
    .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
    .join('\n');

  // Memory context (empty if user hasn't opted in)
  const memoryBlock = userId ? await buildMemoryContext(userId) : '';

  const systemPrompt = ragSystemPrompt();
  let userPrompt = ragUserPrompt({
    contextBlock,
    conversationBlock,
    memoryBlock,
    query,
    locale,
    retrievalTrace,
  });

  // Trim prompt to budget
  userPrompt = trimToTokenBudget(userPrompt, MAX_PROMPT_TOKENS);

  const genStart = Date.now();
  const generated = await generateAnswer(systemPrompt, userPrompt, locale);
  const generationLatencyMs = Date.now() - genStart;

  // ── Extract model self-score if present ──────────────────────
  let modelSelfScore = generated.confidence;
  const scoreMatch = generated.text.match(/CONFIDENCE_SCORE:\s*([\d.]+)/);
  if (scoreMatch) {
    modelSelfScore = Math.min(1, Math.max(0, parseFloat(scoreMatch[1])));
  }
  // Remove the CONFIDENCE_SCORE line and any trailing disclaimers from user-facing text
  let cleanText = generated.text
    .replace(/\n?CONFIDENCE_SCORE:\s*[\d.]+[^\n]*/g, '')
    .trim();

  // Safety net: if generator returned empty (all reasoning, no answer) — use topic-contextual fallback
  if (!cleanText && topPassages.length > 0) {
    const fallbackLocale = locale === 'ml' ? 'ml' : 'en';
    const bestSource = topPassages[0];
    cleanText = fallbackLocale === 'ml'
      ? `ഈ വിഷയത്തിൽ ലഭ്യമായ വിവരങ്ങൾ:\n\n${bestSource.content.substring(0, 500)}\n\n[Source 1: ${bestSource.metadata.source}]\n\nകൂടുതൽ വിവരങ്ങൾക്ക് ${bestSource.metadata.url} സന്ദർശിക്കുക. 📞 ഹെൽപ്‌ലൈൻ: 1950`
      : `Here is the relevant information:\n\n${bestSource.content.substring(0, 500)}\n\n[Source 1: ${bestSource.metadata.source}]\n\nFor more details, visit ${bestSource.metadata.url}. 📞 Helpline: 1950`;
    modelSelfScore = 0.6; // Lower confidence for fallback
  }

  // ── Build sources with citation ──────────────────────────────
  const sources: ChatSource[] = topPassages.map((p) => ({
    title: p.metadata.source,
    url: p.metadata.url,
    lastUpdated: p.metadata.lastUpdated,
    excerpt: p.content.substring(0, 150) + '...',
  }));

  // ── Confidence scoring (new formula) ─────────────────────────
  // confidence = clamp(0.2*max_similarity + 0.4*avg_reranker + 0.2*model_selfscore + 0.2*validation_score, 0, 1)
  const maxSimilarity = topPassages.length > 0
    ? Math.max(...topPassages.map((p) => p.score))
    : 0;
  const avgRerankerScore =
    rerankerScores.length > 0
      ? rerankerScores.reduce((sum, s) => sum + s, 0) / rerankerScores.length
      : 0;

  // validation_score: 1.0 if response has sources cited + is non-empty, lower if not
  let validationScore = 1.0;
  if (cleanText.length < 50) validationScore -= 0.3;
  if (!cleanText.includes('[Source')) validationScore -= 0.2;
  if (generated.completionTokens === 0) validationScore -= 0.2;
  validationScore = Math.max(0, validationScore);

  const confidence = Math.min(
    1,
    Math.round(
      (maxSimilarity * 0.20 +
        avgRerankerScore * 0.40 +
        modelSelfScore * 0.20 +
        validationScore * 0.20) * 100
    ) / 100
  );

  const escalate = confidence < ESCALATION_THRESHOLD;

  // ── Extract actions ──────────────────────────────────────────
  const actionable = extractActions(query, cleanText, locale);

  // ── Compute prompt hash for audit ────────────────────────────
  const fullPromptText = systemPrompt + userPrompt;
  const pHash = computePromptHash(fullPromptText);

  // ── Trace for audit ──────────────────────────────────────────
  const trace: RAGTrace = {
    retrievalLatencyMs,
    rerankLatencyMs,
    generationLatencyMs,
    totalLatencyMs: Date.now() - totalStart,
    retrievedCount: retrieval.passages.length,
    rerankedCount: reranked.length,
    contextTokens: estimateTokens(contextBlock),
    promptTokens: generated.promptTokens || estimateTokens(userPrompt),
    completionTokens: generated.completionTokens || estimateTokens(cleanText),
    promptVersion: PROMPT_VERSION,
  };

  return {
    text: cleanText,
    confidence,
    sources,
    actionable,
    retrievalScore: Math.round(maxSimilarity * 100) / 100,
    rerankerScores,
    retrievalTrace,
    generatorModel: generated.model || cfg.generatorModel,
    promptVersionHash: pHash,
    trace,
    escalate,
  };
}
