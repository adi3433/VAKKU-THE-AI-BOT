/**
 * Intelligent Model Router — Multimodal Input Classification
 * ────────────────────────────────────────────────────────────
 * Routes user input to the appropriate pipeline based on content type:
 *   - Audio  → Voice pipeline (Whisper V3) → then text RAG
 *   - Image  → Vision pipeline (qwen3-vl multimodal)
 *   - Text with structured lookup keywords → Internal API (booth, registration, etc.)
 *   - Text FAQ/general → RAG pipeline (text-only)
 *   - Mixed (image + text) → Multimodal reasoning
 *
 * CRITICAL: Never invoke VL model unless image data is present.
 */

import { processVoiceInput, type VoiceResult } from '@/lib/voice';
import { extractDocumentFields, type VisionExtractionResult } from '@/lib/vision';
import { ragOrchestrate, type RAGInput, type RAGOutput } from '@/lib/rag/orchestrator';
import type { Locale, ChatMessage } from '@/types';

// ── Input types ──────────────────────────────────────────────────

export type InputModality = 'text' | 'audio' | 'image' | 'image_with_text';

export interface RouterInput {
  /** Text query (may be empty if audio-only) */
  text?: string;
  /** Base64-encoded audio data */
  audioData?: Buffer | Blob;
  /** Audio filename */
  audioFilename?: string;
  /** Base64-encoded image data (without data: prefix) */
  imageBase64?: string;
  /** Image MIME type */
  imageMimeType?: string;
  /** User's preferred locale */
  locale: Locale;
  /** Session ID for audit */
  sessionId: string;
  /** Conversation history */
  conversationHistory?: ChatMessage[];
  /** User ID for memory context injection (opt-in) */
  userId?: string;
}

export type RouterResultType = 'rag' | 'voice_then_rag' | 'vision' | 'structured_lookup' | 'multimodal';

export interface RouterResult {
  /** Which pipeline was used */
  type: RouterResultType;
  /** Detected input modality */
  modality: InputModality;
  /** The actual text query (original or transcribed) */
  resolvedQuery: string;
  /** Resolved locale (detected from voice or provided) */
  resolvedLocale: Locale;
  /** RAG result (if text pipeline was invoked) */
  ragResult?: RAGOutput;
  /** Voice result (if audio was transcribed) */
  voiceResult?: VoiceResult;
  /** Vision result (if image was processed) */
  visionResult?: VisionExtractionResult;
  /** Structured lookup result (if internal API was called) */
  lookupResult?: StructuredLookupResult;
  /** Total routing + processing latency */
  totalLatencyMs: number;
}

export interface StructuredLookupResult {
  type: 'booth_search' | 'registration_check' | 'violation_report';
  suggestedEndpoint: string;
  extractedParams: Record<string, string>;
  message: string;
}

// ── Structured lookup detection ──────────────────────────────────

const STRUCTURED_PATTERNS: Array<{
  patterns: RegExp[];
  type: StructuredLookupResult['type'];
  endpoint: string;
}> = [
  {
    patterns: [
      /\b(booth|polling\s*station|ബൂത്ത്|പോളിങ്\s*സ്റ്റേഷൻ)\b/i,
      /\b(where\s+(do\s+)?i\s+vote|എവിടെ\s*വോട്ട്)\b/i,
      /\b(find\s+my\s+booth|my\s+booth|എന്റെ\s*ബൂത്ത്)\b/i,
    ],
    type: 'booth_search',
    endpoint: '/api/booth',
  },
  {
    patterns: [
      /\b(registration|register|enrolled|voter\s*list|രജിസ്ട്രേഷൻ|രജിസ്റ്റർ|വോട്ടർ\s*ലിസ്റ്റ്)\b/i,
      /\b(check.*(epic|voter\s*id)|epic\s*check|voter\s*id\s*(check|status)|എപിക്\s*ചെക്ക്)\b/i,
      /\b(am\s+i\s+registered|is\s+my\s+name)\b/i,
    ],
    type: 'registration_check',
    endpoint: '/api/registration',
  },
  {
    patterns: [
      /\b(report|complaint|violation|grievance|റിപ്പോർട്ട്|പരാതി|ലംഘനം)\b/i,
      /\b(bribery|intimidation|malpractice|കൈക്കൂലി|ഭീഷണി)\b/i,
    ],
    type: 'violation_report',
    endpoint: '/api/report',
  },
];

/**
 * Detect if the query maps to a structured internal API
 */
function detectStructuredLookup(query: string): StructuredLookupResult | null {
  const lowerQuery = query.toLowerCase();

  for (const { patterns, type, endpoint } of STRUCTURED_PATTERNS) {
    for (const pattern of patterns) {
      if (pattern.test(lowerQuery) || pattern.test(query)) {
        // Extract potential identifiers from query
        const extractedParams: Record<string, string> = {};

        // Extract EPIC number
        const epicMatch = query.match(/\b([A-Z]{3}\d{7})\b/);
        if (epicMatch) extractedParams.voterId = epicMatch[1];

        // Extract pincode
        const pincodeMatch = query.match(/\b(\d{6})\b/);
        if (pincodeMatch) extractedParams.pincode = pincodeMatch[1];

        return {
          type,
          suggestedEndpoint: endpoint,
          extractedParams,
          message: `Detected ${type.replace('_', ' ')} query. Suggested endpoint: ${endpoint}`,
        };
      }
    }
  }

  return null;
}

// ── Modality detection ───────────────────────────────────────────

function detectModality(input: RouterInput): InputModality {
  const hasAudio = !!(input.audioData);
  const hasImage = !!(input.imageBase64);
  const hasText = !!(input.text?.trim());

  if (hasAudio) return 'audio'; // Audio takes priority for transcription
  if (hasImage && hasText) return 'image_with_text';
  if (hasImage) return 'image';
  return 'text';
}

// ── Main router ──────────────────────────────────────────────────

/**
 * Route input to the appropriate pipeline.
 * 
 * Routing logic:
 *   1. Audio → transcribe first, then route text result
 *   2. Image only → vision extraction (VL model)
 *   3. Image + text → multimodal reasoning (VL model)
 *   4. Text → check for structured lookup → else RAG
 */
export async function routeInput(input: RouterInput): Promise<RouterResult> {
  const startTime = Date.now();
  const modality = detectModality(input);

  let resolvedQuery = input.text?.trim() || '';
  let resolvedLocale = input.locale;
  let voiceResult: VoiceResult | undefined;
  let visionResult: VisionExtractionResult | undefined;
  let ragResult: RAGOutput | undefined;
  let lookupResult: StructuredLookupResult | null = null;
  let resultType: RouterResultType;

  switch (modality) {
    // ── Audio: Transcribe, then route the text ──────────────
    case 'audio': {
      voiceResult = await processVoiceInput(
        input.audioData!,
        input.audioFilename || 'audio.webm'
      );
      resolvedQuery = voiceResult.transcript;
      resolvedLocale = voiceResult.locale;

      // Now route the transcribed text
      lookupResult = detectStructuredLookup(resolvedQuery);
      if (lookupResult) {
        resultType = 'structured_lookup';
      } else {
        // Run RAG on transcribed text
        ragResult = await ragOrchestrate({
          query: resolvedQuery,
          locale: resolvedLocale,
          conversationHistory: input.conversationHistory || [],
          userId: input.userId,
        });
        resultType = 'voice_then_rag';
      }
      break;
    }

    // ── Image only: Vision extraction ───────────────────────
    case 'image': {
      visionResult = await extractDocumentFields(
        input.imageBase64!,
        input.imageMimeType || 'image/jpeg',
        resolvedLocale
      );
      resolvedQuery = `[Document: ${visionResult.detectedDocumentType}]`;
      resultType = 'vision';
      break;
    }

    // ── Image + text: Multimodal ────────────────────────────
    case 'image_with_text': {
      // Use vision extraction with context from text
      visionResult = await extractDocumentFields(
        input.imageBase64!,
        input.imageMimeType || 'image/jpeg',
        resolvedLocale
      );

      // Also run RAG on the text question for additional context
      ragResult = await ragOrchestrate({
        query: resolvedQuery,
        locale: resolvedLocale,
        conversationHistory: input.conversationHistory || [],
        userId: input.userId,
      });

      resultType = 'multimodal';
      break;
    }

    // ── Text only: Structured lookup or RAG ─────────────────
    case 'text':
    default: {
      if (!resolvedQuery) {
        resolvedQuery = resolvedLocale === 'ml'
          ? 'ഞാൻ എങ്ങനെ സഹായിക്കാം?'
          : 'How can I help you?';
      }

      lookupResult = detectStructuredLookup(resolvedQuery);
      if (lookupResult) {
        resultType = 'structured_lookup';
      } else {
        ragResult = await ragOrchestrate({
          query: resolvedQuery,
          locale: resolvedLocale,
          conversationHistory: input.conversationHistory || [],
          userId: input.userId,
        });
        resultType = 'rag';
      }
      break;
    }
  }

  const totalLatencyMs = Date.now() - startTime;

  // Audit log
  console.log(
    JSON.stringify({
      type: 'router_decision',
      modality,
      resultType,
      resolvedLocale,
      queryLength: resolvedQuery.length,
      hasVoice: !!voiceResult,
      hasVision: !!visionResult,
      hasRag: !!ragResult,
      hasLookup: !!lookupResult,
      totalLatencyMs,
      timestamp: new Date().toISOString(),
    })
  );

  return {
    type: resultType,
    modality,
    resolvedQuery,
    resolvedLocale,
    ragResult: ragResult ?? undefined,
    voiceResult,
    visionResult,
    lookupResult: lookupResult ?? undefined,
    totalLatencyMs,
  };
}
