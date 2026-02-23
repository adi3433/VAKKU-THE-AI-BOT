/**
 * POST /api/rerank — Reranker Wrapper Endpoint
 * ─────────────────────────────────────────────
 * Thin wrapper around Fireworks qwen3-reranker-8b.
 * 
 * Request:  { query: string, documents: string[], topN?: number }
 * Response: { results: Array<{ index, relevanceScore, document }> }
 */
import { NextRequest, NextResponse } from 'next/server';
import { getConfig } from '@/lib/fireworks';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, documents, topN } = body as {
      query: string;
      documents: string[];
      topN?: number;
    };

    if (!query?.trim()) {
      return NextResponse.json(
        { error: 'query is required' },
        { status: 400 }
      );
    }

    if (!documents?.length) {
      return NextResponse.json(
        { error: 'documents[] is required and must not be empty' },
        { status: 400 }
      );
    }

    const cfg = getConfig();
    const response = await fetch(cfg.rerankerUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cfg.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: cfg.rerankerModel,
        query,
        documents,
        top_n: topN ?? documents.length,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Rerank API error:', response.status, errText);
      return NextResponse.json(
        { error: `Reranker returned ${response.status}` },
        { status: 502 }
      );
    }

    const data = await response.json();
    const results = (data.results ?? []).map((r: { index: number; relevance_score: number }) => ({
      index: r.index,
      relevanceScore: r.relevance_score,
      document: documents[r.index],
    }));

    return NextResponse.json({ results });
  } catch (error) {
    console.error('Rerank API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
