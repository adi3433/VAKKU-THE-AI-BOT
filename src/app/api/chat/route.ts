/**
 * POST /api/chat — V2.1 Chat endpoint with Router, Streaming & Memory
 * ─────────────────────────────────────────────────────────────────────
 * Routes input through the intelligent model router, supporting:
 *   - Text queries → RAG pipeline (with memory context)
 *   - Audio → Voice transcription → RAG
 *   - Structured lookups → Internal APIs
 *   - Streaming responses via ?stream=true query param
 *
 * V2.1 additions:
 *   - Retrieval trace per-chunk in response
 *   - Memory context injection (userId)
 *   - Chat history auto-save
 *   - Escalation from orchestrator (replaces manual threshold)
 *   - ChatResponseV2 output shape
 *
 * API Contract:
 *   Request:  { message, locale, sessionId, conversationHistory?, userId? }
 *   Response: ChatResponseV2 { text, confidence, sources, actionable, escalate, locale,
 *             messageId, timestamp, retrievalTrace, promptVersionHash, generatorModel, routerType, modality }
 *   Stream:   Server-Sent Events (text/event-stream) when ?stream=true
 */
import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuid } from 'uuid';
import { routeInput } from '@/lib/router';
import { ragOrchestrate, type RAGOutput } from '@/lib/rag/orchestrator';
import { safetyCheck } from '@/lib/safety';
import { hashIdentifier } from '@/lib/privacy';
import { ResponseCache } from '@/lib/fireworks';
import { recordQueryLog, recordAuditEntry } from '@/lib/admin-audit';
import { saveConversation } from '@/lib/chat-history';
import type { ChatRequest, ChatResponseV2, RetrievalTraceEntry } from '@/types';

// V2: Use ResponseCache with configurable TTL instead of raw Map
const answerCache = new ResponseCache<ChatResponseV2>(86400); // 24h

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      message,
      locale,
      sessionId,
      conversationHistory,
      userId,
    } = body as ChatRequest & { userId?: string };

    if (!message?.trim()) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // Check for streaming request
    const url = new URL(request.url);
    const wantStream = url.searchParams.get('stream') === 'true';

    // Cache key: normalized message + locale
    const cacheKey = `${locale}:${message.trim().toLowerCase()}`;
    const cached = answerCache.get(cacheKey);
    if (cached) {
      return NextResponse.json({
        ...cached,
        messageId: uuid(),
        timestamp: new Date().toISOString(),
      });
    }

    const startTime = Date.now();

    // Route through intelligent model router (passes userId for memory)
    const routerResult = await routeInput({
      text: message.trim(),
      locale,
      sessionId,
      conversationHistory: conversationHistory ?? [],
      userId,
    });

    // Get RAG result from router (most text queries go through RAG)
    let ragResult: RAGOutput | undefined = routerResult.ragResult;

    // For structured lookups, still run RAG to get a helpful text answer
    if (routerResult.type === 'structured_lookup' && !ragResult) {
      ragResult = await ragOrchestrate({
        query: routerResult.resolvedQuery,
        locale: routerResult.resolvedLocale,
        conversationHistory: conversationHistory ?? [],
        userId,
      });
    }

    // Build response text
    let responseText = '';
    let confidence = 0;
    let retrievalTrace: RetrievalTraceEntry[] = [];

    if (ragResult) {
      responseText = ragResult.text;
      confidence = ragResult.confidence;
      retrievalTrace = ragResult.retrievalTrace;
    } else if (routerResult.visionResult) {
      responseText = routerResult.visionResult.explanation;
      confidence = routerResult.visionResult.confidence;
    } else {
      responseText = locale === 'ml'
        ? 'ക്ഷമിക്കണം, എനിക്ക് ഈ അഭ്യർത്ഥന പ്രോസസ്സ് ചെയ്യാൻ കഴിഞ്ഞില്ല.'
        : 'Sorry, I could not process this request.';
      confidence = 0.3;
    }

    // Safety check
    const safetyResult = safetyCheck(responseText, message.trim());

    // V2.1: Escalation comes from orchestrator (confidence + formula)
    const shouldEscalate = (ragResult?.escalate ?? (confidence < 0.55)) || safetyResult.flagged;

    const response: ChatResponseV2 = {
      text: safetyResult.flagged ? safetyResult.safeText : responseText,
      confidence,
      sources: ragResult?.sources ?? [],
      actionable: ragResult?.actionable ?? [],
      escalate: shouldEscalate,
      locale: routerResult.resolvedLocale,
      messageId: uuid(),
      timestamp: new Date().toISOString(),
      retrievalTrace,
      extractedFields: routerResult.visionResult?.extractedFields
        ? Object.fromEntries(routerResult.visionResult.extractedFields.map((f: { name: string; value: string }) => [f.name, f.value]))
        : undefined,
      promptVersionHash: ragResult?.promptVersionHash ?? '',
      generatorModel: ragResult?.generatorModel ?? '',
      routerType: routerResult.type,
      modality: routerResult.modality,
    };

    // Cache answer (only non-escalated, confident answers)
    if (!shouldEscalate && confidence >= 0.6) {
      answerCache.set(cacheKey, response);
    }

    // V2.1: Structured audit log
    const latencyMs = Date.now() - startTime;
    recordQueryLog({
      id: response.messageId,
      sessionId,
      query: message.trim(),
      locale: routerResult.resolvedLocale,
      response: response.text.substring(0, 500),
      confidence,
      sources: response.sources,
      escalated: shouldEscalate,
      timestamp: response.timestamp,
      latencyMs,
      retrievalScore: ragResult?.retrievalScore,
      rerankerScores: ragResult?.rerankerScores,
      generatorModel: ragResult?.generatorModel,
      promptVersionHash: ragResult?.promptVersionHash,
      routerType: routerResult.type,
      modality: routerResult.modality,
      trace: ragResult?.trace as unknown as Record<string, unknown>,
    });

    // Track escalation for admin
    if (shouldEscalate) {
      recordAuditEntry({
        id: uuid(),
        action: 'escalation',
        actorId: hashIdentifier(sessionId),
        targetId: response.messageId,
        details: JSON.stringify({
          query: message.trim().substring(0, 200),
          locale: routerResult.resolvedLocale,
          confidence,
          reason: safetyResult.flagged ? 'safety_flag' : 'low_confidence',
        }),
        timestamp: new Date().toISOString(),
      });
    }

    // Auto-save conversation to history
    try {
      const allMessages = [
        ...(conversationHistory ?? []),
        { id: uuid(), role: 'user' as const, content: message.trim(), locale: routerResult.resolvedLocale, timestamp: new Date().toISOString() },
        { id: response.messageId, role: 'assistant' as const, content: response.text, locale: routerResult.resolvedLocale, timestamp: response.timestamp },
      ];
      saveConversation(
        userId ?? sessionId,
        sessionId,
        allMessages,
        routerResult.resolvedLocale,
        shouldEscalate
      );
    } catch {
      // Non-critical: don't fail the request if history save fails
    }

    // Streaming response (SSE)
    if (wantStream) {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          const data = JSON.stringify(response);
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        },
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      });
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
