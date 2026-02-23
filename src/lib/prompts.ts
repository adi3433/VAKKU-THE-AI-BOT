/**
 * Prompt Templates — Versioned, Auditable Prompts
 * ─────────────────────────────────────────────────
 * Centralized prompt templates for all model interactions:
 *   - Text-only RAG
 *   - Vision JSON extraction
 *   - Reranker input
 *   - ASR post-processing
 *   - Conversation summarization
 *
 * Each template has a version string + computed hash for audit.
 */

import type { Locale, RetrievalTraceEntry } from '@/types';
import type { ExtractedField } from '@/lib/vision';

// ── Version tracking ─────────────────────────────────────────────

const TEMPLATE_VERSIONS: Record<string, string> = {
  'rag-system': 'v2.1-kottayam-2026',
  'rag-user': 'v2.1-kottayam-2026',
  'vision-extraction': 'v2.0-doc-extractor',
  'vision-explanation': 'v2.0-doc-explainer',
  'reranker-input': 'v2.0-passage-rerank',
  'asr-postprocess': 'v2.0-whisper-normalize',
  'conversation-summary': 'v1.0-summarizer',
};

export function getTemplateVersion(templateId: string): string {
  return TEMPLATE_VERSIONS[templateId] || 'unknown';
}

export function computePromptHash(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

// ── RAG System Prompt ────────────────────────────────────────────

export function ragSystemPrompt(): string {
  return `/no_think
You are Vaakku, an impartial voter information assistant for Kottayam district, Kerala (2026 Legislative Assembly elections). Follow these rules strictly:

1. LANGUAGE: Answer in the user's chosen language (Malayalam or English).
2. NEUTRALITY: NEVER provide political endorsements, party comparisons, or persuasion. If asked, politely decline and redirect to official sources.
3. CITATIONS: When using retrieved context, ALWAYS cite using [Source N] format with the source name.
4. UNCERTAINTY: If you cannot verify information, say "I am not fully confident. Please verify using the official source below." and set escalation.
5. IDENTIFIERS: If the question is about personal registration/booth, request minimal identifiers (voter_id or name + DOB + constituency).
6. BREVITY: Keep responses concise (2-4 short paragraphs max). Prefer bullet points for lists.
7. SCOPE: Only answer questions about voter registration, election procedures, booth locations, required documents, SVEEP activities, and violation reporting.
8. SELF-SCORE: At the END of your response, output a line: CONFIDENCE_SCORE: <float 0.0 to 1.0> indicating how confident you are in the accuracy of your answer.
9. OUTPUT: Respond ONLY with the final answer text. Do NOT output any internal reasoning, chain-of-thought, or thinking steps.
10. BOOTH LOCATIONS: When answering about polling booth locations, format each booth clearly as:
    
    **Polling Station [NUMBER]** — [OFFICIAL NAME]
    - **Landmark:** [Nearest landmark]
    - **GPS:** [LAT]°N, [LNG]°E
    - [Get Directions](https://www.google.com/maps/dir/?api=1&destination=LAT,LNG)
    
    If multiple booths match, list each booth separately in the above format with a blank line between them.
    Keep descriptions short. Do NOT add extra commentary around each booth — the data speaks for itself.`;
}

// ── RAG User Prompt (with passages & citations) ──────────────────

export interface RAGUserPromptInput {
  contextBlock: string;
  conversationBlock: string;
  memoryBlock: string;
  query: string;
  locale: Locale;
  retrievalTrace: RetrievalTraceEntry[];
}

export function ragUserPrompt(input: RAGUserPromptInput): string {
  const { contextBlock, conversationBlock, memoryBlock, query, locale, retrievalTrace } = input;
  const lang = locale === 'ml' ? 'Malayalam' : 'English';

  const traceBlock = retrievalTrace.length > 0
    ? `\nRETRIEVAL TRACE (for audit — do not include in response):\n${retrievalTrace.map((t) => `  chunk=${t.chunkId} sim=${t.similarityScore.toFixed(3)} rerank=${t.rerankerScore.toFixed(3)}`).join('\n')}`
    : '';

  return `CONTEXT (official sources, reranked by relevance):
${contextBlock || 'No relevant sources found.'}

CONVERSATION HISTORY:
${conversationBlock || 'None'}
${memoryBlock}${traceBlock}

USER QUESTION (locale: ${locale}):
${query}

INSTRUCTIONS:
- Answer in ${lang}.
- Cite sources using [Source N] references.
- If unsure, state uncertainty and suggest checking an official source.
- Never recommend any political party or candidate.
- Be brief, civic, and empathetic.
- End with CONFIDENCE_SCORE: <float>`;
}

// ── Vision Extraction Prompt (JSON-only) ─────────────────────────

export function visionExtractionPrompt(): string {
  return `You are a document analysis expert for Indian election documents. Analyze this image and extract structured data.

INSTRUCTIONS:
1. Determine the document type: EPIC, Form6, Form6A, Form7, Form8, BoothSlip, ComplaintPhoto, Aadhaar, or Other.
2. Extract ALL visible text fields with their values.
3. Rate your OCR confidence for each field (0.0 to 1.0).
4. Note any fields you expect but cannot find.
5. Identify fields that contain PII and should be redacted in logs.

RESPOND ONLY with valid JSON in this exact format:
{
  "detected_document_type": "EPIC",
  "extracted_fields": [
    {"name": "epic_number", "value": "ABC1234567", "confidence": 0.95}
  ],
  "missing_fields": ["photo_present"],
  "validation_errors": [],
  "redaction_suggestions": ["aadhaar_number", "phone"],
  "overall_confidence": 0.88,
  "notes": ""
}

CRITICAL: Only output JSON. No markdown, no explanation, no code blocks. Do NOT hallucinate field values — if you cannot read a field, set confidence to 0.0 and value to "UNREADABLE".`;
}

// ── Vision Explanation Prompt ────────────────────────────────────

export function visionExplanationPrompt(
  docType: string,
  fields: ExtractedField[],
  missingFields: string[],
  validationErrors: Array<{ field: string; error: string }>,
  locale: Locale
): string {
  const lang = locale === 'ml' ? 'Malayalam' : 'English';
  const fieldSummary = fields
    .map((f) => `- ${f.name}: ${f.value} (confidence: ${(f.confidence * 100).toFixed(0)}%)`)
    .join('\n');

  return `Explain these document extraction results to the user in ${lang}. Be helpful and civic.

Document Type: ${docType}
Extracted Fields:
${fieldSummary}

${missingFields.length > 0 ? `Missing: ${missingFields.join(', ')}` : 'All expected fields found.'}
${validationErrors.length > 0 ? `Issues:\n${validationErrors.map((e) => `- ${e.field}: ${e.error}`).join('\n')}` : 'No issues.'}

Rules:
- Respond in ${lang}. Keep it brief (2-3 sentences).
- Never display full Aadhaar numbers or PII.
- If fields are missing or have errors, suggest what the user should check.`;
}

// ── Reranker Input Template ──────────────────────────────────────

export interface RerankerInput {
  model: string;
  query: string;
  documents: string[];
  topN: number;
}

export function buildRerankerPayload(
  query: string,
  passages: string[],
  model: string,
  topN: number = 3
): RerankerInput {
  return {
    model,
    query,
    documents: passages,
    topN,
  };
}

// ── ASR Post-processing Template ─────────────────────────────────

export function asrPostProcessPrompt(rawTranscript: string, detectedLanguage: string): string {
  return `You are a transcription normalizer for an Indian election assistant.

RAW TRANSCRIPTION: "${rawTranscript}"
DETECTED LANGUAGE: ${detectedLanguage}

TASKS:
1. Fix obvious ASR errors (e.g., "voter eye dee" → "voter ID").
2. Normalize Indian names and election terms.
3. Detect and tag the language: "en" for English, "ml" for Malayalam, "mixed" for code-switched.
4. Remove filler words and disfluencies.
5. If PII is detected (Aadhaar, phone), replace with [REDACTED].

OUTPUT JSON:
{
  "normalized_text": "...",
  "language": "en|ml|mixed",
  "pii_detected": false,
  "corrections_made": ["voter eye dee → voter ID"]
}

CRITICAL: Only output JSON.`;
}

// ── Conversation Summarizer ──────────────────────────────────────

export function conversationSummaryPrompt(
  messages: Array<{ role: string; content: string }>,
  locale: Locale
): string {
  const lang = locale === 'ml' ? 'Malayalam' : 'English';
  const transcript = messages
    .map((m) => `${m.role}: ${m.content.slice(0, 200)}`)
    .join('\n');

  return `Summarize this conversation in 1-2 sentences in ${lang}. Focus on the user's main questions and whether they were resolved.

${transcript}

Summary:`;
}
