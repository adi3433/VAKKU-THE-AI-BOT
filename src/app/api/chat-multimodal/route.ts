/**
 * POST /api/chat-multimodal — V2.1 Multimodal Chat Endpoint
 * ──────────────────────────────────────────────────────────
 * Accepts text + optional image/audio + sessionId + locale.
 * Routes through the intelligent model router for:
 *   - Text → RAG pipeline
 *   - Audio → Whisper V3 → RAG
 *   - Image → Vision extraction (VL model)
 *   - Image + text → Multimodal reasoning
 *
 * API Contract:
 *   Request (multipart/form-data or JSON):
 *     { message, locale, sessionId, imageBase64?, audioBase64?, contextMode?, userId? }
 *   Response: ChatResponseV2
 */
import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuid } from 'uuid';
import { routeInput } from '@/lib/router';
import { ragOrchestrate, type RAGOutput } from '@/lib/rag/orchestrator';
import { safetyCheck } from '@/lib/safety';
import { hashIdentifier } from '@/lib/privacy';
import { recordQueryLog, recordAuditEntry } from '@/lib/admin-audit';
import { saveConversation } from '@/lib/chat-history';
import type { ChatResponseV2, MultimodalChatRequest, RetrievalTraceEntry } from '@/types';

// Max image size: 10MB
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
// Max audio size: 25MB
const MAX_AUDIO_SIZE = 25 * 1024 * 1024;

export async function POST(request: NextRequest) {
  try {
    let body: MultimodalChatRequest;

    const contentType = request.headers.get('content-type') ?? '';
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      body = {
        message: (formData.get('message') as string) ?? '',
        locale: (formData.get('locale') as 'en' | 'ml') ?? 'en',
        sessionId: (formData.get('sessionId') as string) ?? uuid(),
        imageBase64: (formData.get('imageBase64') as string) ?? undefined,
        audioBase64: (formData.get('audioBase64') as string) ?? undefined,
        contextMode: (formData.get('contextMode') as 'full' | 'ephemeral') ?? 'full',
        userId: (formData.get('userId') as string) ?? undefined,
      };
    } else {
      body = await request.json();
    }

    const {
      message,
      locale = 'en',
      sessionId = uuid(),
      imageBase64,
      audioBase64,
      contextMode: _contextMode = 'full',
      userId,
    } = body;

    // Validate: at least one input modality
    if (!message?.trim() && !imageBase64 && !audioBase64) {
      return NextResponse.json(
        { error: 'At least one input (message, image, or audio) is required' },
        { status: 400 }
      );
    }

    // Size checks
    if (imageBase64 && imageBase64.length > MAX_IMAGE_SIZE) {
      return NextResponse.json(
        { error: 'Image exceeds 10MB limit' },
        { status: 413 }
      );
    }
    if (audioBase64 && audioBase64.length > MAX_AUDIO_SIZE) {
      return NextResponse.json(
        { error: 'Audio exceeds 25MB limit' },
        { status: 413 }
      );
    }

    const startTime = Date.now();

    // Convert audio base64 to Buffer for router
    let audioData: Buffer | undefined;
    if (audioBase64) {
      // Strip data URL prefix if present
      const raw = audioBase64.replace(/^data:audio\/[^;]+;base64,/, '');
      audioData = Buffer.from(raw, 'base64');
    }

    // Route through intelligent model router
    const routerResult = await routeInput({
      text: message?.trim() || undefined,
      audioData,
      audioFilename: audioBase64 ? 'upload.webm' : undefined,
      imageBase64: imageBase64?.replace(/^data:image\/[^;]+;base64,/, ''),
      imageMimeType: imageBase64 ? detectImageMime(imageBase64) : undefined,
      locale,
      sessionId,
      conversationHistory: [],
      userId,
    });

    // Build response
    let ragResult: RAGOutput | undefined = routerResult.ragResult;

    if (routerResult.type === 'structured_lookup' && !ragResult) {
      ragResult = await ragOrchestrate({
        query: routerResult.resolvedQuery,
        locale: routerResult.resolvedLocale,
        conversationHistory: [],
        userId,
      });
    }

    let responseText = '';
    let confidence = 0;
    let retrievalTrace: RetrievalTraceEntry[] = [];

    // Priority: vision result first (for image modalities), then RAG, then fallback
    if (routerResult.visionResult && (routerResult.modality === 'image' || routerResult.modality === 'image_with_text')) {
      // Vision is the primary answer for image uploads
      responseText = routerResult.visionResult.explanation;
      confidence = routerResult.visionResult.confidence;

      // If RAG also ran (multimodal), append supplementary context if high quality
      if (ragResult && ragResult.confidence > 0.6) {
        responseText += '\n\n---\n\n' + ragResult.text;
        retrievalTrace = ragResult.retrievalTrace;
      }
    } else if (ragResult) {
      responseText = ragResult.text;
      confidence = ragResult.confidence;
      retrievalTrace = ragResult.retrievalTrace;
    } else {
      responseText = locale === 'ml'
        ? 'ക്ഷമിക്കണം, എനിക്ക് ഈ അഭ്യർത്ഥന പ്രോസസ്സ് ചെയ്യാൻ കഴിഞ്ഞില്ല.'
        : 'Sorry, I could not process this request.';
      confidence = 0.3;
    }

    const safetyResult = safetyCheck(responseText, message?.trim() ?? '');
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

    // Audit
    const latencyMs = Date.now() - startTime;
    recordQueryLog({
      id: response.messageId,
      sessionId,
      query: `[${routerResult.modality}] ${message?.trim() ?? ''}`.trim(),
      locale: routerResult.resolvedLocale,
      response: response.text.substring(0, 500),
      confidence,
      sources: response.sources,
      escalated: shouldEscalate,
      timestamp: response.timestamp,
      latencyMs,
      retrievalScore: ragResult?.retrievalScore,
      routerType: routerResult.type,
      modality: routerResult.modality,
    });

    if (shouldEscalate) {
      recordAuditEntry({
        id: uuid(),
        action: 'escalation',
        actorId: hashIdentifier(sessionId),
        targetId: response.messageId,
        details: JSON.stringify({
          modality: routerResult.modality,
          confidence,
          reason: safetyResult.flagged ? 'safety_flag' : 'low_confidence',
        }),
        timestamp: new Date().toISOString(),
      });
    }

    // Save to chat history
    try {
      await saveConversation(
        userId ?? sessionId,
        sessionId,
        [
          { id: uuid(), role: 'user', content: message?.trim() ?? `[${routerResult.modality}]`, locale: routerResult.resolvedLocale, timestamp: new Date().toISOString() },
          { id: response.messageId, role: 'assistant', content: response.text, locale: routerResult.resolvedLocale, timestamp: response.timestamp },
        ],
        routerResult.resolvedLocale,
        shouldEscalate
      );
    } catch {
      // Non-critical
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('Multimodal chat error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * Detect image MIME type from base64 data URL or raw base64
 */
function detectImageMime(base64: string): string {
  if (base64.startsWith('data:image/png')) return 'image/png';
  if (base64.startsWith('data:image/gif')) return 'image/gif';
  if (base64.startsWith('data:image/webp')) return 'image/webp';
  if (base64.startsWith('data:image/svg')) return 'image/svg+xml';
  return 'image/jpeg'; // default
}
