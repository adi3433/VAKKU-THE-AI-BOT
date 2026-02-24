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
import { safetyCheck, isAdversarial } from '@/lib/safety';
import { hashIdentifier } from '@/lib/privacy';
import { ResponseCache } from '@/lib/fireworks';
import { recordQueryLog, recordAuditEntry } from '@/lib/admin-audit';
import { saveConversation } from '@/lib/chat-history';
import { formatBoothResult, getGoogleMapsDirectionsUrl } from '@/lib/booth-data';
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
      latitude,
      longitude,
    } = body as ChatRequest & { userId?: string };

    if (!message?.trim()) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // V5: Pre-routing safety check — block adversarial/abusive inputs immediately
    const inputSafetyResult = safetyCheck('', message.trim());
    if (inputSafetyResult.flagged) {
      const blockedResponse: ChatResponseV2 = {
        text: inputSafetyResult.safeText,
        confidence: 0.99,
        sources: [],
        actionable: [],
        escalate: false,
        locale: locale || 'en',
        messageId: uuid(),
        timestamp: new Date().toISOString(),
        retrievalTrace: [],
        promptVersionHash: 'safety-block-v5',
        generatorModel: 'safety-filter',
        routerType: 'safety',
        modality: 'text',
      };

      // Log blocked query for audit
      try {
        await recordQueryLog({
          id: uuid(),
          sessionId: sessionId ?? 'unknown',
          query: '***BLOCKED***',
          locale: (locale || 'en') as 'en' | 'ml',
          response: inputSafetyResult.safeText,
          confidence: 0.99,
          sources: [],
          escalated: false,
          timestamp: new Date().toISOString(),
          latencyMs: 0,
          routerType: 'safety',
        });
      } catch { /* non-critical */ }

      return NextResponse.json(blockedResponse);
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
      latitude: typeof latitude === 'number' ? latitude : undefined,
      longitude: typeof longitude === 'number' ? longitude : undefined,
    });

    // Get RAG result from router (most text queries go through RAG)
    let ragResult: RAGOutput | undefined = routerResult.ragResult;

    // Build response text
    let responseText = '';
    let confidence = 0;
    let retrievalTrace: RetrievalTraceEntry[] = [];

    // ── V5: Engine direct answer (deterministic, no LLM) ──────
    if (routerResult.type === 'engine_direct' && routerResult.engineResult) {
      const engine = routerResult.engineResult;
      responseText = engine.formattedResponse;
      confidence = engine.confidence;

      // Build a synthetic RAGOutput for consistent response shape
      ragResult = {
        text: responseText,
        confidence,
        sources: [{
          title: `ECI — ${engine.engineName} engine`,
          url: 'https://eci.gov.in/',
          lastUpdated: new Date().toISOString().split('T')[0],
          excerpt: `Data-grounded response from ${engine.engineName} engine (category: ${engine.classification.category}, sub-intent: ${engine.classification.subIntent ?? 'auto'})`,
        }],
        actionable: [],
        retrievalScore: 1.0,
        rerankerScores: [1.0],
        retrievalTrace: [],
        generatorModel: `v5-engine-${engine.engineName}`,
        promptVersionHash: 'engine-direct-v5',
        trace: {
          retrievalLatencyMs: 0,
          rerankLatencyMs: 0,
          generationLatencyMs: 0,
          totalLatencyMs: Date.now() - startTime,
          retrievedCount: 0,
          rerankedCount: 0,
          contextTokens: 0,
          promptTokens: 0,
          completionTokens: 0,
          promptVersion: 'engine-direct-v5',
        },
        escalate: false,
      };
    }

    // ── Direct booth answer from local data ───────────────────
    const boothResults = routerResult.lookupResult?.boothResults;
    if (routerResult.type === 'structured_lookup' && boothResults && boothResults.length > 0) {
      // Format booth results directly — no LLM needed
      const boothLocale = (routerResult.resolvedLocale === 'ml' ? 'ml' : 'en') as 'en' | 'ml';
      const formatted = boothResults.map((b) => formatBoothResult(b, boothLocale));

      if (boothResults.length === 1) {
        responseText = boothLocale === 'ml'
          ? `നിങ്ങളുടെ പോളിംഗ് സ്റ്റേഷൻ വിവരങ്ങൾ:\n\n${formatted[0]}\n\nLAC 97-Kottayam, District 10-Kottayam. സ്ഥിരീകരണത്തിന് [electoralsearch.eci.gov.in](https://electoralsearch.eci.gov.in/) സന്ദർശിക്കുക.`
          : `Here are your polling station details:\n\n${formatted[0]}\n\nThis booth serves LAC 97-Kottayam, District 10-Kottayam. For verification, visit [electoralsearch.eci.gov.in](https://electoralsearch.eci.gov.in/).`;
      } else {
        responseText = boothLocale === 'ml'
          ? `${boothResults.length} പോളിംഗ് സ്റ്റേഷനുകൾ കണ്ടെത്തി:\n\n${formatted.join('\n\n')}\n\nLAC 97-Kottayam, District 10-Kottayam. സ്ഥിരീകരണത്തിന് [electoralsearch.eci.gov.in](https://electoralsearch.eci.gov.in/) സന്ദർശിക്കുക.`
          : `Found ${boothResults.length} matching polling stations:\n\n${formatted.join('\n\n')}\n\nAll booths are in LAC 97-Kottayam, District 10-Kottayam. For verification, visit [electoralsearch.eci.gov.in](https://electoralsearch.eci.gov.in/).`;
      }

      confidence = 0.95; // High confidence — data is from official records

      // Build sources from booth data
      ragResult = {
        text: responseText,
        confidence,
        sources: boothResults.slice(0, 3).map((b) => ({
          title: `Election Commission of India - Official Booth List LAC 97`,
          url: b.sourceUrl || 'https://electoralsearch.eci.gov.in/',
          lastUpdated: '2026-01-15',
          excerpt: `Polling Station ${b.stationNumber} is officially designated as ${b.title}. ${b.landmark ? `Near ${b.landmark}.` : ''}`,
        })),
        actionable: [],
        retrievalScore: 1.0,
        rerankerScores: [1.0],
        retrievalTrace: [],
        generatorModel: 'local-booth-data',
        promptVersionHash: 'booth-direct',
        trace: {
          retrievalLatencyMs: 0,
          rerankLatencyMs: 0,
          generationLatencyMs: 0,
          totalLatencyMs: Date.now() - startTime,
          retrievedCount: boothResults.length,
          rerankedCount: boothResults.length,
          contextTokens: 0,
          promptTokens: 0,
          completionTokens: 0,
          promptVersion: 'booth-direct-v1',
        },
        escalate: false,
      };
    } else if (routerResult.type === 'structured_lookup' && !ragResult) {
      // Structured lookup detected but no booth results — fall back to RAG
      ragResult = await ragOrchestrate({
        query: routerResult.resolvedQuery,
        locale: routerResult.resolvedLocale,
        conversationHistory: conversationHistory ?? [],
        userId,
      });
    }

    if (ragResult && !responseText) {
      responseText = ragResult.text;
      confidence = ragResult.confidence;
      retrievalTrace = ragResult.retrievalTrace;
    } else if (!responseText && routerResult.visionResult) {
      responseText = routerResult.visionResult.explanation;
      confidence = routerResult.visionResult.confidence;
    } else if (!responseText) {
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
      await saveConversation(
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
