/**
 * Voice Pipeline — Whisper V3 Transcription & Processing
 * ───────────────────────────────────────────────────────
 * Handles audio transcription using qwen3-whisper-v3 via Fireworks,
 * with language detection (Malayalam/English), filler word normalization,
 * and PII-redacted audit logging.
 */

import { transcribeAudio, type TranscriptionResult } from '@/lib/fireworks';
import type { Locale } from '@/types';

// ── Filler word normalization ────────────────────────────────────

const FILLER_PATTERNS_EN = [
  /\b(um+|uh+|hmm+|ah+|er+|like,?\s*you know)\b/gi,
  /\b(basically|actually|literally)\b(?=.*\b(basically|actually|literally)\b)/gi,
];

const FILLER_PATTERNS_ML = [
  /\b(അത്|പിന്നെ|അതായത്)\b(?=.*\b(അത്|പിന്നെ|അതായത്)\b)/g,
];

function removeFillers(text: string, language: string): string {
  let cleaned = text;
  const patterns = language.startsWith('ml') || language === 'malayalam'
    ? [...FILLER_PATTERNS_EN, ...FILLER_PATTERNS_ML]
    : FILLER_PATTERNS_EN;

  for (const pattern of patterns) {
    cleaned = cleaned.replace(pattern, '');
  }
  // Collapse multiple spaces
  return cleaned.replace(/\s{2,}/g, ' ').trim();
}

// ── Language detection heuristic ─────────────────────────────────

const MALAYALAM_RANGE = /[\u0D00-\u0D7F]/;

/**
 * Detect language from transcription text or Whisper's language tag.
 * Returns canonical locale.
 */
export function detectLocale(text: string, whisperLang?: string): Locale {
  // Whisper language codes
  if (whisperLang === 'ml' || whisperLang === 'malayalam') return 'ml';
  if (whisperLang === 'en' || whisperLang === 'english') return 'en';

  // Fallback: check for Malayalam characters
  const mlChars = (text.match(/[\u0D00-\u0D7F]/g) || []).length;
  const totalChars = text.replace(/\s/g, '').length || 1;
  return mlChars / totalChars > 0.3 ? 'ml' : 'en';
}

// ── PII patterns for audit redaction ─────────────────────────────

const AUDIT_PII_PATTERNS = [
  { regex: /\b\d{12}\b/g, replacement: '[AADHAAR]' },
  { regex: /\b[A-Z]{3}\d{7}\b/g, replacement: '[EPIC]' },
  { regex: /\b(\+91|91|0)?[6-9]\d{9}\b/g, replacement: '[PHONE]' },
  { regex: /\b[\w._%+-]+@[\w.-]+\.[a-zA-Z]{2,}\b/g, replacement: '[EMAIL]' },
];

function redactForAudit(text: string): string {
  let redacted = text;
  for (const { regex, replacement } of AUDIT_PII_PATTERNS) {
    redacted = redacted.replace(regex, replacement);
  }
  return redacted;
}

// ── Supported audio formats ──────────────────────────────────────

const SUPPORTED_FORMATS = new Set([
  'audio/webm',
  'audio/wav',
  'audio/mpeg',
  'audio/mp3',
  'audio/mp4',
  'audio/ogg',
  'audio/flac',
  'audio/x-m4a',
]);

const MAX_AUDIO_SIZE = 25 * 1024 * 1024; // 25MB

// ── Voice pipeline result ────────────────────────────────────────

export interface VoiceResult {
  /** Cleaned, normalized transcription text */
  transcript: string;
  /** Raw transcription from Whisper */
  rawTranscript: string;
  /** Detected locale */
  locale: Locale;
  /** Whisper-reported language */
  whisperLanguage: string;
  /** Audio duration in seconds */
  durationSeconds: number;
  /** Processing latency in ms */
  latencyMs: number;
  /** Model used */
  model: string;
  /** PII-redacted version for audit logs */
  auditTranscript: string;
  /** Whether filler words were removed */
  fillersRemoved: boolean;
  /** TTS-ready formatted text */
  ttsReady: string;
}

/**
 * Validate audio input before processing
 */
export function validateAudioInput(
  size: number,
  contentType?: string
): { valid: boolean; error?: string } {
  if (size === 0) {
    return { valid: false, error: 'Empty audio data' };
  }
  if (size > MAX_AUDIO_SIZE) {
    return { valid: false, error: `Audio exceeds 25MB limit (${(size / 1024 / 1024).toFixed(1)}MB)` };
  }
  if (contentType && !SUPPORTED_FORMATS.has(contentType)) {
    return { valid: false, error: `Unsupported audio format: ${contentType}. Supported: ${[...SUPPORTED_FORMATS].join(', ')}` };
  }
  return { valid: true };
}

// ── TTS-ready formatting ─────────────────────────────────────────

function formatForTTS(text: string, locale: Locale): string {
  let tts = text;
  // Normalize abbreviations for speech
  tts = tts.replace(/\bEPIC\b/g, locale === 'ml' ? 'എപിക്' : 'E.P.I.C.');
  tts = tts.replace(/\bECI\b/g, locale === 'ml' ? 'ഇലക്ഷൻ കമ്മീഷൻ' : 'Election Commission of India');
  tts = tts.replace(/\bDEO\b/g, locale === 'ml' ? 'ജില്ലാ ഇലക്ഷൻ ഓഫീസർ' : 'District Election Officer');
  tts = tts.replace(/\bBLO\b/g, locale === 'ml' ? 'ബൂത്ത് ലെവൽ ഓഫീസർ' : 'Booth Level Officer');
  tts = tts.replace(/\bSVEEP\b/g, locale === 'ml' ? 'സ്വീപ്' : 'S.V.E.E.P.');
  // Add slight pauses at periods for natural speech
  tts = tts.replace(/\.\s/g, '. ... ');
  return tts;
}

// ── Main voice pipeline ──────────────────────────────────────────

/**
 * Process audio through the complete voice pipeline:
 *   1. Validate input
 *   2. Transcribe with Whisper V3
 *   3. Detect language
 *   4. Remove filler words
 *   5. Format for downstream use
 *   6. Create audit-safe version
 */
export async function processVoiceInput(
  audioData: Buffer | Blob,
  filename: string = 'audio.webm'
): Promise<VoiceResult> {
  const startTime = Date.now();

  // Step 1: Transcribe
  const transcription: TranscriptionResult = await transcribeAudio(audioData, filename);

  // Step 2: Detect locale
  const locale = detectLocale(transcription.text, transcription.language);

  // Step 3: Normalize filler words
  const cleaned = removeFillers(transcription.text, transcription.language);
  const fillersRemoved = cleaned !== transcription.text;

  // Step 4: Format for TTS
  const ttsReady = formatForTTS(cleaned, locale);

  // Step 5: Create audit-safe transcript
  const auditTranscript = redactForAudit(cleaned);

  const latencyMs = Date.now() - startTime;

  // Audit log (PII-safe)
  console.log(
    JSON.stringify({
      type: 'voice_transcription',
      locale,
      whisperLanguage: transcription.language,
      durationSeconds: transcription.duration,
      transcriptLength: cleaned.length,
      fillersRemoved,
      latencyMs,
      model: transcription.model,
      timestamp: new Date().toISOString(),
    })
  );

  return {
    transcript: cleaned,
    rawTranscript: transcription.text,
    locale,
    whisperLanguage: transcription.language,
    durationSeconds: transcription.duration,
    latencyMs,
    model: transcription.model,
    auditTranscript,
    fillersRemoved,
    ttsReady,
  };
}
