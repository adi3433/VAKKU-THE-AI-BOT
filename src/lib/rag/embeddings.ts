/**
 * Embeddings Module — qwen3-embedding-8b via Fireworks
 * ─────────────────────────────────────────────────────
 * Generates dense vector embeddings for queries and documents.
 * Used in RAG Stage 1 for vector search.
 */

import { createEmbeddings, ResponseCache } from '@/lib/fireworks';

// Cache embeddings to avoid redundant API calls
const embeddingCache = new ResponseCache<number[]>(86400); // 24h

/**
 * Embed a single query string
 */
export async function embedQuery(query: string): Promise<number[]> {
  const cacheKey = `q:${query.trim().toLowerCase()}`;
  const cached = embeddingCache.get(cacheKey);
  if (cached) return cached;

  const result = await createEmbeddings([query]);
  const embedding = result.embeddings[0];
  embeddingCache.set(cacheKey, embedding);
  return embedding;
}

/**
 * Embed multiple documents in batch
 */
export async function embedDocuments(
  documents: string[]
): Promise<{ embeddings: number[][]; tokensUsed: number }> {
  // Batch in groups of 64 to stay within API limits
  const BATCH_SIZE = 64;
  const allEmbeddings: number[][] = [];
  let totalTokens = 0;

  for (let i = 0; i < documents.length; i += BATCH_SIZE) {
    const batch = documents.slice(i, i + BATCH_SIZE);
    const result = await createEmbeddings(batch);
    allEmbeddings.push(...result.embeddings);
    totalTokens += result.tokensUsed;
  }

  return { embeddings: allEmbeddings, tokensUsed: totalTokens };
}

/**
 * Cosine similarity between two vectors
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dotProduct / denom;
}
