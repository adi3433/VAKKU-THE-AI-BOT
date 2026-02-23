/**
 * POST /api/embeddings — Embedding Wrapper Endpoint
 * ──────────────────────────────────────────────────
 * Thin wrapper around Fireworks qwen3-embedding-8b.
 * 
 * Request:  { texts: string[] }
 * Response: { embeddings: number[][], model: string, usage: { totalTokens } }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createEmbeddings } from '@/lib/fireworks';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { texts } = body as { texts: string[] };

    if (!texts?.length) {
      return NextResponse.json(
        { error: 'texts[] is required and must not be empty' },
        { status: 400 }
      );
    }

    if (texts.length > 100) {
      return NextResponse.json(
        { error: 'Maximum 100 texts per request' },
        { status: 400 }
      );
    }

    const result = await createEmbeddings(texts);

    return NextResponse.json({
      embeddings: result.embeddings,
      model: result.model,
      usage: { totalTokens: result.tokensUsed },
    });
  } catch (error) {
    console.error('Embeddings API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
