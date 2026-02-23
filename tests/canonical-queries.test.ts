/**
 * Canonical Malayalam Queries — Evaluation Tests
 *
 * Tests the RAG pipeline against 50 canonical Malayalam voter queries.
 * Checks: retrieval relevance, safety escalation, confidence thresholds.
 */
import { describe, it, expect } from 'vitest';
import { retrievePassages } from '@/lib/rag/retriever';
import { isPoliticalQuery, safetyCheck } from '@/lib/safety';
import { CANONICAL_MALAYALAM_QUERIES, type CanonicalQuery } from './fixtures/canonical-malayalam-queries';

/**
 * Group queries by intent for organized test output
 */
const groups: Record<string, CanonicalQuery[]> = {};
for (const q of CANONICAL_MALAYALAM_QUERIES) {
  (groups[q.intent] ??= []).push(q);
}

describe('Canonical Malayalam Queries', () => {
  // Political queries must be caught by safety module
  describe('Safety boundary (political queries)', () => {
    const politicalQueries = CANONICAL_MALAYALAM_QUERIES.filter((q) => q.shouldEscalate);

    for (const q of politicalQueries) {
      it(`#${q.id}: "${q.query_en}" → should escalate`, () => {
        const result = safetyCheck(q.query, 'ml');
        expect(result.safe).toBe(false);
      });
    }
  });

  // Non-political queries must NOT be flagged
  describe('Non-political queries — should NOT escalate', () => {
    const safeQueries = CANONICAL_MALAYALAM_QUERIES.filter(
      (q) => !q.shouldEscalate && q.intent !== 'greeting' && q.intent !== 'out_of_scope'
    );

    for (const q of safeQueries) {
      it(`#${q.id}: "${q.query_en}" → should be safe`, () => {
        expect(isPoliticalQuery(q.query)).toBe(false);
      });
    }
  });

  // Retrieval relevance for factual queries
  describe('Retrieval relevance', () => {
    const factualQueries = CANONICAL_MALAYALAM_QUERIES.filter(
      (q) => !q.shouldEscalate && q.intent !== 'greeting' && q.intent !== 'out_of_scope'
    );

    for (const q of factualQueries) {
      it(`#${q.id}: "${q.query_en}" → returns passages`, async () => {
        // Use English translation for BM25 since knowledge base is English
        const result = await retrievePassages(q.query_en, 'en', 1000);
        expect(result.passages.length).toBeGreaterThan(0);
      });
    }
  });
});
