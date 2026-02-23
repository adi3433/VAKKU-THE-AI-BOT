/**
 * BM25 Retriever unit tests
 */
import { describe, it, expect } from 'vitest';
import { retrievePassages } from '@/lib/rag/retriever';

describe('BM25 Retriever', () => {
  it('retrieves relevant passages for registration query', async () => {
    const result = await retrievePassages('How do I register as a voter?', 'en', 1000);
    expect(result.passages.length).toBeGreaterThan(0);
    expect(result.totalTokens).toBeGreaterThan(0);
    const texts = result.passages.map((p) => p.content).join(' ');
    expect(texts.toLowerCase()).toContain('register');
  });

  it('retrieves booth info for booth query', async () => {
    const result = await retrievePassages('Where is my polling booth?', 'en', 1000);
    expect(result.passages.length).toBeGreaterThan(0);
    const texts = result.passages.map((p) => p.content).join(' ');
    expect(texts.toLowerCase()).toMatch(/booth|polling/);
  });

  it('retrieves document info', async () => {
    const result = await retrievePassages('What documents do I need to vote?', 'en', 1000);
    expect(result.passages.length).toBeGreaterThan(0);
    const texts = result.passages.map((p) => p.content).join(' ');
    expect(texts.toLowerCase()).toMatch(/document|voter id|identity/);
  });

  it('ranks relevant passages higher', async () => {
    const result = await retrievePassages('How to register voter', 'en', 1000);
    expect(result.passages[0].content.toLowerCase()).toMatch(/register/);
  });

  it('respects token budget', async () => {
    const result = await retrievePassages('register voter booth', 'en', 50);
    expect(result.totalTokens).toBeLessThanOrEqual(100);
  });
});
