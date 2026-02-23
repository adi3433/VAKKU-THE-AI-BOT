/**
 * Reranker Module — qwen3-reranker-8b via Fireworks
 * ──────────────────────────────────────────────────
 * Stage 3 of the hybrid RAG pipeline.
 * Takes top-K candidates from vector search and reranks
 * using cross-encoder scoring for superior relevance.
 */

import { getConfig, ResponseCache } from '@/lib/fireworks';
import type { RetrievedPassage } from '@/types';

export interface RerankResult {
  passage: RetrievedPassage;
  rerankerScore: number;
  originalRank: number;
}

// Cache rerank results for identical query+passages combos
const rerankCache = new ResponseCache<RerankResult[]>(3600); // 1h

/**
 * Rerank retrieved passages using qwen3-reranker-8b.
 * Returns top-K passages sorted by reranker score.
 */
export async function rerankPassages(
  query: string,
  passages: RetrievedPassage[],
  topK: number = 3
): Promise<RerankResult[]> {
  if (passages.length === 0) return [];

  // Cache key based on query + passage IDs
  const cacheKey = `rr:${query.trim().toLowerCase()}:${passages.map((p) => p.id).join(',')}`;
  const cached = rerankCache.get(cacheKey);
  if (cached) return cached;

  const cfg = getConfig();

  if (!cfg.apiKey) {
    // Fallback: return passages in original order with synthetic scores
    return passages.slice(0, topK).map((p, i) => ({
      passage: p,
      rerankerScore: p.score,
      originalRank: i,
    }));
  }

  try {
    // Build reranker request — Fireworks reranker endpoint
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12_000); // 12s timeout

    const response = await fetch(cfg.rerankerUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cfg.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: cfg.rerankerModel,
        query,
        documents: passages.map((p) => p.content),
        top_n: topK,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      console.error(`Reranker API error: ${response.status}`);
      // Graceful degradation: return top passages by retrieval score
      return passages.slice(0, topK).map((p, i) => ({
        passage: p,
        rerankerScore: p.score,
        originalRank: i,
      }));
    }

    const data = await response.json();

    // Fireworks rerank response: { data: [{ index, relevance_score }] }
    const rawResults = data.data || data.results || [];
    if (rawResults.length === 0) {
      // API returned no results — fallback to original retrieval order
      console.warn('Reranker returned no results, using retrieval scores');
      return passages.slice(0, topK).map((p, i) => ({
        passage: p,
        rerankerScore: p.score,
        originalRank: i,
      }));
    }

    const results: RerankResult[] = rawResults
      .slice(0, topK)
      .map((r: { index: number; relevance_score: number }) => ({
        passage: passages[r.index],
        rerankerScore: r.relevance_score,
        originalRank: r.index,
      }))
      .sort((a: RerankResult, b: RerankResult) => b.rerankerScore - a.rerankerScore);

    rerankCache.set(cacheKey, results);
    return results;
  } catch (err) {
    console.error('Reranker error:', err);
    // Graceful degradation
    return passages.slice(0, topK).map((p, i) => ({
      passage: p,
      rerankerScore: p.score,
      originalRank: i,
    }));
  }
}
