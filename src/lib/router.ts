/**
 * Intelligent Model Router — V5 Multimodal Input Classification
 * ──────────────────────────────────────────────────────────────
 * Routes user input to the appropriate pipeline based on content type:
 *   - Audio  → Voice pipeline (Whisper V3) → then text RAG
 *   - Image  → Vision pipeline (qwen3-vl multimodal)
 *   - Text with V5 engine match → Deterministic engine response (no LLM)
 *   - Text with structured lookup keywords → Internal API (booth, registration, etc.)
 *   - Text FAQ/general → RAG pipeline (text-only)
 *   - Mixed (image + text) → Multimodal reasoning
 *
 * V5: Query classification runs BEFORE structured lookup for deterministic routing.
 * CRITICAL: Never invoke VL model unless image data is present.
 */

import { processVoiceInput, type VoiceResult } from '@/lib/voice';
import { extractDocumentFields, type VisionExtractionResult } from '@/lib/vision';
import { ragOrchestrate, type RAGOutput } from '@/lib/rag/orchestrator';
import { searchBooths, searchNearestBooths, formatBoothResult, formatNearestBoothResult, type BoothRecord } from '@/lib/booth-data';
import {
  classifyQuery,
  getFormGuidance,
  getVotingRulesResponse,
  getComplaintResponse,
  getTimelineResponse,
  type ClassificationResult,
} from '@/lib/engines';
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
  /** User's GPS latitude (for nearest booth search) */
  latitude?: number;
  /** User's GPS longitude (for nearest booth search) */
  longitude?: number;
}

export type RouterResultType = 'rag' | 'voice_then_rag' | 'vision' | 'structured_lookup' | 'multimodal' | 'engine_direct';

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
  /** V5 engine direct result (deterministic, no LLM needed) */
  engineResult?: EngineDirectResult;
  /** Total routing + processing latency */
  totalLatencyMs: number;
}

/** V5: Deterministic engine response — bypasses LLM */
export interface EngineDirectResult {
  engineName: string;
  classification: ClassificationResult;
  formattedResponse: string;
  confidence: number;
}

export interface StructuredLookupResult {
  type: 'booth_search' | 'registration_check' | 'violation_report';
  suggestedEndpoint: string;
  extractedParams: Record<string, string>;
  message: string;
  /** Booth records found by direct local search (only for booth_search) */
  boothResults?: BoothRecord[];
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
      /^\s*\d{1,3}\s*$/, // bare booth number
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
function detectStructuredLookup(
  query: string,
  latitude?: number,
  longitude?: number
): StructuredLookupResult | null {
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

        // For booth queries: prefer GPS-based nearest search, fallback to text search
        let boothResults: BoothRecord[] | undefined;
        if (type === 'booth_search') {
          if (latitude && longitude) {
            boothResults = searchNearestBooths(latitude, longitude, 5, 10);
          } else {
            boothResults = searchBooths(query, 5);
          }
        }

        return {
          type,
          suggestedEndpoint: endpoint,
          extractedParams,
          message: `Detected ${type.replace('_', ' ')} query. Suggested endpoint: ${endpoint}`,
          boothResults,
        };
      }
    }
  }

  return null;
}

// ── Modality detection ───────────────────────────────────────────

/**
 * Auto-generated upload placeholder messages that should not trigger RAG.
 * The frontend sends these as the `message` when user just uploads an image
 * without typing a real question.
 */
const AUTO_UPLOAD_MESSAGES = new Set([
  'extract information from this document',
  'analyze this file',
  'ഈ ഡോക്യുമെന്റിൽ നിന്ന് വിവരങ്ങൾ എക്\u200Cസ്ട്രാക്ട് ചെയ്യുക',
  'ഈ ഫയൽ വിശകലനം ചെയ്യുക',
]);

function isAutoUploadMessage(text?: string): boolean {
  if (!text) return true;
  return AUTO_UPLOAD_MESSAGES.has(text.trim().toLowerCase());
}

function detectModality(input: RouterInput): InputModality {
  const hasAudio = !!(input.audioData);
  const hasImage = !!(input.imageBase64);
  const hasText = !!(input.text?.trim());

  if (hasAudio) return 'audio'; // Audio takes priority for transcription
  if (hasImage && hasText && !isAutoUploadMessage(input.text)) return 'image_with_text';
  if (hasImage) return 'image'; // Treat image + auto-generated text as image-only
  return 'text';
}

// ── V5 Engine Routing ────────────────────────────────────────────

/**
 * Attempt to resolve query through a V5 deterministic engine.
 * Returns EngineDirectResult if a high-confidence match is found,
 * or null to fall through to RAG.
 */
function tryEngineRoute(
  query: string,
  locale: string,
  latitude?: number,
  longitude?: number
): EngineDirectResult | null {
  const classification = classifyQuery(query);

  // Only route to engine if classification confidence is decent
  if (classification.confidence < 0.4) return null;

  switch (classification.category) {
    case 'voting_rules': {
      const result = getVotingRulesResponse(classification.subIntent, query, locale);
      return {
        engineName: 'voting-rules',
        classification,
        formattedResponse: result.formattedResponse,
        confidence: result.confidence,
      };
    }

    case 'form_guidance': {
      const result = getFormGuidance(classification.subIntent, query, locale);
      if (!result) return null; // Fall through to RAG if no form matched
      return {
        engineName: 'civic-process',
        classification,
        formattedResponse: result.formattedResponse,
        confidence: result.confidence,
      };
    }

    case 'complaint': {
      const result = getComplaintResponse(classification.subIntent, query, locale);
      return {
        engineName: 'complaint',
        classification,
        formattedResponse: result.formattedResponse,
        confidence: result.confidence,
      };
    }

    case 'timeline': {
      const result = getTimelineResponse(classification.subIntent, query, locale);
      return {
        engineName: 'timeline',
        classification,
        formattedResponse: result.formattedResponse,
        confidence: result.confidence,
      };
    }

    case 'out_of_scope': {
      const isMl = locale === 'ml';
      return {
        engineName: 'civic-boundary',
        classification,
        formattedResponse: isMl
          ? 'ഞാൻ ഒരു നിഷ്പക്ഷ വോട്ടർ വിവര സഹായിയാണ്. രാഷ്ട്രീയ അഭിപ്രായങ്ങൾ, പാർട്ടി ശുപാർശകൾ, അല്ലെങ്കിൽ തിരഞ്ഞെടുപ്പ് പ്രവചനങ്ങൾ നൽകാൻ എനിക്ക് കഴിയില്ല. വോട്ടർ രജിസ്ട്രേഷൻ, ബൂത്ത് വിവരങ്ങൾ, വോട്ടിങ് പ്രക്രിയ, പരാതി നൽകൽ എന്നിവയെക്കുറിച്ച് ചോദിക്കാം. 📞 ഹെൽപ്‌ലൈൻ: 1950'
          : 'I am an impartial voter information assistant. I cannot provide political opinions, party recommendations, or election predictions. I can help with voter registration, booth information, voting process, complaint filing, and election schedules. 📞 Helpline: 1950',
        confidence: 0.99,
      };
    }

    case 'booth_query': {
      const isMl = locale === 'ml';

      // Check if query contains / is a booth number → direct lookup
      const numberMatch = query.trim().match(/^(\d{1,3})$/)
        || query.match(/(?:booth|station|polling\s*station)\s*(?:number\s*(?:is\s*)?)?(\d+)/i)
        || query.match(/(?:number|no\.?|#)\s*(?:is\s*)?(\d+)/i);
      if (numberMatch) {
        const boothResults = searchBooths(query.trim(), 3);
        if (boothResults.length > 0) {
          const formatted = boothResults
            .map((b) => formatBoothResult(b, isMl ? 'ml' : 'en'))
            .join('\n\n---\n\n');
          const header = boothResults.length === 1
            ? (isMl
                ? `📍 **പോളിങ് സ്റ്റേഷൻ ${boothResults[0].stationNumber} വിവരങ്ങൾ:**\n\n`
                : `📍 **Polling Station ${boothResults[0].stationNumber} Details:**\n\n`)
            : (isMl
                ? `📍 **${boothResults.length} പോളിങ് സ്റ്റേഷനുകൾ കണ്ടെത്തി:**\n\n`
                : `📍 **${boothResults.length} matching polling stations found:**\n\n`);
          const footer = isMl
            ? '\n\nLAC 97-Kottayam, District 10-Kottayam. സ്ഥിരീകരണത്തിന് [electoralsearch.eci.gov.in](https://electoralsearch.eci.gov.in/) സന്ദർശിക്കുക.'
            : '\n\nLAC 97-Kottayam, District 10-Kottayam. For verification, visit [electoralsearch.eci.gov.in](https://electoralsearch.eci.gov.in/).';
          return {
            engineName: 'booth-locator',
            classification,
            formattedResponse: header + formatted + footer,
            confidence: 0.97,
          };
        }
        // Number not found in our data
        return {
          engineName: 'booth-locator',
          classification,
          formattedResponse: isMl
            ? `😔 ബൂത്ത് നമ്പർ ${numberMatch[1]} ഞങ്ങളുടെ LAC 97-Kottayam ഡാറ്റയിൽ കണ്ടെത്താനായില്ല. ബൂത്ത് നമ്പറുകൾ 1–171 ശ്രേണിയിലാണ്. ദയവായി പരിശോധിച്ച് വീണ്ടും ശ്രമിക്കുക. 📞 ഹെൽപ്‌ലൈൻ: 1950`
            : `😔 Booth number ${numberMatch[1]} was not found in our LAC 97-Kottayam data. Booth numbers range from 1–171. Please verify and try again. 📞 Helpline: 1950`,
          confidence: 0.9,
        };
      }

      // If GPS coordinates are available, return nearest booths directly
      if (latitude && longitude) {
        const nearestBooths = searchNearestBooths(latitude, longitude, 5, 10);
        if (nearestBooths.length === 0) {
          return {
            engineName: 'booth-locator',
            classification,
            formattedResponse: isMl
              ? '😔 നിങ്ങളുടെ സ്ഥാനത്തിന് 10 കിലോമീറ്റർ ചുറ്റളവിൽ പോളിങ് ബൂത്തുകൾ കണ്ടെത്താനായില്ല. ദയവായി നിങ്ങളുടെ ബൂത്ത് നമ്പർ അല്ലെങ്കിൽ സ്ഥലപ്പേര് നൽകുക. 📞 ഹെൽപ്‌ലൈൻ: 1950'
              : '😔 No polling booths found within 10 km of your location. Please try providing your booth number or area name for a more specific search. 📞 Helpline: 1950',
            confidence: 0.9,
          };
        }
        const header = isMl
          ? `📍 **നിങ്ങളുടെ സമീപത്തുള്ള ${nearestBooths.length} പോളിങ് ബൂത്തുകൾ:**\n\n`
          : `📍 **${nearestBooths.length} nearest polling booths to your location:**\n\n`;
        const boothCards = nearestBooths
          .map((b) => formatNearestBoothResult(b, isMl ? 'ml' : 'en'))
          .join('\n\n---\n\n');
        return {
          engineName: 'booth-locator',
          classification,
          formattedResponse: header + boothCards,
          confidence: 0.95,
        };
      }
      // No GPS: ask user to share location or provide specific details
      return {
        engineName: 'booth-locator',
        classification,
        formattedResponse: isMl
          ? '📍 നിങ്ങളുടെ അടുത്തുള്ള പോളിങ് ബൂത്ത് കണ്ടെത്താൻ, ദയവായി **ലൊക്കേഷൻ ഷെയർ ചെയ്യുക** (📍 ബട്ടൺ അമർത്തുക) അല്ലെങ്കിൽ നിങ്ങളുടെ ബൂത്ത് നമ്പർ / സ്ഥലപ്പേര് ടൈപ്പ് ചെയ്യുക.'
          : '📍 To find your nearest polling booth, please **share your location** (tap the 📍 button) or type your booth number / area name.',
        confidence: 0.9,
      };
    }

    // roll_lookup → fall through to existing structured lookup
    // general_faq → fall through to RAG
    default:
      return null;
  }
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
  // V5: Auto-detect Malayalam from Unicode script in query text
  let resolvedLocale = input.locale;
  if (resolvedQuery && /[\u0D00-\u0D7F]/.test(resolvedQuery)) {
    resolvedLocale = 'ml' as Locale;
  }
  let voiceResult: VoiceResult | undefined;
  let visionResult: VisionExtractionResult | undefined;
  let ragResult: RAGOutput | undefined;
  let lookupResult: StructuredLookupResult | null = null;
  let engineResult: EngineDirectResult | null = null;
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
      // V5: Try engine routing first
      engineResult = tryEngineRoute(resolvedQuery, resolvedLocale, input.latitude, input.longitude);
      if (engineResult) {
        resultType = 'engine_direct';
      } else {
        lookupResult = detectStructuredLookup(resolvedQuery, input.latitude, input.longitude);
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
      // Vision extraction is always the primary pipeline for images
      visionResult = await extractDocumentFields(
        input.imageBase64!,
        input.imageMimeType || 'image/jpeg',
        resolvedLocale
      );

      // Run RAG on the user's genuine text question for supplementary context.
      // This only fires when the user typed a real question alongside the image
      // (auto-generated upload labels are filtered out in detectModality).
      try {
        ragResult = await ragOrchestrate({
          query: resolvedQuery,
          locale: resolvedLocale,
          conversationHistory: input.conversationHistory || [],
          userId: input.userId,
        });
      } catch (err) {
        // RAG failure should not block the vision result
        console.warn('[router] RAG failed during multimodal, using vision only:', err);
      }

      resultType = 'multimodal';
      break;
    }

    // ── Text only: V5 Engine → Structured lookup → RAG ────────
    case 'text':
    default: {
      if (!resolvedQuery) {
        resolvedQuery = resolvedLocale === 'ml'
          ? 'ഞാൻ എങ്ങനെ സഹായിക്കാം?'
          : 'How can I help you?';
      }

      // V5: Try deterministic engine routing first
      engineResult = tryEngineRoute(resolvedQuery, resolvedLocale, input.latitude, input.longitude);
      if (engineResult) {
        resultType = 'engine_direct';
      } else {
        lookupResult = detectStructuredLookup(resolvedQuery, input.latitude, input.longitude);
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
      hasEngine: !!engineResult,
      engineName: engineResult?.engineName ?? null,
      classifiedCategory: engineResult?.classification.category ?? null,
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
    engineResult: engineResult ?? undefined,
    totalLatencyMs,
  };
}
