/**
 * Vision Pipeline — Multimodal Document Extraction
 * ──────────────────────────────────────────────────
 * Uses qwen3-vl-30b-a3b-thinking in multimodal mode to extract
 * structured data from voter documents (EPIC cards, Form 6, etc.).
 *
 * Two-pass architecture:
 *   Pass 1: Extract structured fields as JSON
 *   Pass 2: Explain results in user's language
 */

import { chatCompletion, getConfig, type ChatMessage, type MultimodalContent } from '@/lib/fireworks';
import type { Locale } from '@/types';

// ── Document types ───────────────────────────────────────────────

export type DocumentType = 'epic_card' | 'form_6' | 'form_6a' | 'form_7' | 'form_8' | 'aadhaar' | 'unknown';

export interface ExtractedField {
  name: string;
  value: string;
  confidence: number;
}

export interface ValidationError {
  field: string;
  error: string;
  errorMl?: string;
}

export interface VisionExtractionResult {
  /** Detected document type */
  detectedDocumentType: DocumentType;
  /** All extracted fields */
  extractedFields: ExtractedField[];
  /** Overall extraction confidence (0–1) */
  confidence: number;
  /** Fields that should be present but weren't found */
  missingFields: string[];
  /** Validation issues with extracted data */
  validationErrors: ValidationError[];
  /** Human-readable explanation in user's language */
  explanation: string;
  /** Processing latency ms */
  latencyMs: number;
  /** Model used */
  model: string;
}

// ── Expected fields per document type ────────────────────────────

const DOCUMENT_FIELDS: Record<DocumentType, string[]> = {
  epic_card: [
    'epic_number', 'name', 'name_local', 'relative_name', 'relative_relation',
    'dob_or_age', 'gender', 'address', 'constituency', 'part_number',
    'serial_number', 'photo_present',
  ],
  form_6: [
    'name', 'surname', 'relative_name', 'relative_relation', 'dob',
    'gender', 'address', 'constituency', 'state', 'phone', 'email',
    'declaration_signed', 'date',
  ],
  form_6a: [
    'name', 'passport_number', 'address_abroad', 'address_india',
    'constituency', 'date',
  ],
  form_7: [
    'objective', 'name_to_delete', 'epic_number', 'reason',
    'objector_name', 'objector_epic', 'date',
  ],
  form_8: [
    'type_of_correction', 'current_entry', 'corrected_entry',
    'epic_number', 'name', 'date',
  ],
  aadhaar: [
    'aadhaar_number', 'name', 'dob', 'gender', 'address',
  ],
  unknown: [],
};

// ── Field validation rules ───────────────────────────────────────

const FIELD_VALIDATORS: Record<string, (value: string) => string | null> = {
  epic_number: (v) => /^[A-Z]{3}\d{7}$/.test(v) ? null : 'EPIC format should be 3 letters + 7 digits (e.g., ABC1234567)',
  aadhaar_number: (v) => /^\d{12}$/.test(v) ? null : 'Aadhaar should be 12 digits',
  dob: (v) => /\d{2}[\/\-]\d{2}[\/\-]\d{4}|\d{4}[\/\-]\d{2}[\/\-]\d{2}/.test(v) ? null : 'Date format unclear',
  gender: (v) => /^(male|female|other|transgender|M|F|O|T|പുരുഷൻ|സ്ത്രീ)$/i.test(v) ? null : 'Gender value unclear',
  phone: (v) => /^(\+91|91|0)?[6-9]\d{9}$/.test(v.replace(/[\s-]/g, '')) ? null : 'Phone number format invalid',
  email: (v) => /^[\w._%+-]+@[\w.-]+\.[a-zA-Z]{2,}$/.test(v) ? null : 'Email format invalid',
};

// ── Image validation ─────────────────────────────────────────────

const SUPPORTED_IMAGE_TYPES = new Set([
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif',
]);
const MAX_IMAGE_SIZE = 20 * 1024 * 1024; // 20MB

export function validateImageInput(
  size: number,
  contentType?: string
): { valid: boolean; error?: string } {
  if (size === 0) {
    return { valid: false, error: 'Empty image data' };
  }
  if (size > MAX_IMAGE_SIZE) {
    return { valid: false, error: `Image exceeds 20MB limit (${(size / 1024 / 1024).toFixed(1)}MB)` };
  }
  if (contentType && !SUPPORTED_IMAGE_TYPES.has(contentType)) {
    return { valid: false, error: `Unsupported image format: ${contentType}` };
  }
  return { valid: true };
}

// ── Pass 1: Structured extraction prompt ─────────────────────────

function buildExtractionPrompt(): string {
  return `You are a document analysis expert for Indian election documents. Analyze this image and extract structured data.

INSTRUCTIONS:
1. First determine the document type: epic_card, form_6, form_6a, form_7, form_8, aadhaar, or unknown.
2. Extract ALL visible text fields with their values.
3. Rate your confidence for each field (0.0 to 1.0).
4. Note any fields you expect but cannot find.

RESPOND ONLY with valid JSON in this exact format:
{
  "document_type": "epic_card",
  "fields": [
    {"name": "epic_number", "value": "ABC1234567", "confidence": 0.95},
    {"name": "name", "value": "John Doe", "confidence": 0.90}
  ],
  "missing_fields": ["photo_present"],
  "overall_confidence": 0.88,
  "notes": "Image slightly blurred in address area"
}

CRITICAL: Only output JSON. No markdown, no explanation, no code blocks.`;
}

// ── Pass 2: User-facing explanation prompt ───────────────────────

function buildExplanationPrompt(
  docType: DocumentType,
  fields: ExtractedField[],
  missingFields: string[],
  validationErrors: ValidationError[],
  locale: Locale
): string {
  const lang = locale === 'ml' ? 'Malayalam' : 'English';
  const fieldSummary = fields
    .map((f) => `- ${f.name}: ${f.value} (confidence: ${(f.confidence * 100).toFixed(0)}%)`)
    .join('\n');
  const missingStr = missingFields.length > 0
    ? `Missing fields: ${missingFields.join(', ')}`
    : 'All expected fields found.';
  const errorsStr = validationErrors.length > 0
    ? `Validation issues:\n${validationErrors.map((e) => `- ${e.field}: ${e.error}`).join('\n')}`
    : 'No validation issues.';

  return `Explain the following document extraction results to the user in ${lang}. Be helpful and civic.

Document Type: ${docType}
Extracted Fields:
${fieldSummary}

${missingStr}
${errorsStr}

INSTRUCTIONS:
- Respond in ${lang}.
- Keep it brief (2-3 sentences).
- If fields are missing, suggest what the user should check.
- If there are validation errors, explain what might be wrong.
- Never display full Aadhaar numbers or other PII in the explanation.
- Be encouraging and helpful.`;
}

// ── Main extraction pipeline ─────────────────────────────────────

/**
 * Extract structured data from a document image.
 *
 * @param imageBase64 Base64-encoded image data (without data: prefix)
 * @param mimeType    Image MIME type (e.g., 'image/jpeg')
 * @param locale      User's preferred language for explanation
 */
export async function extractDocumentFields(
  imageBase64: string,
  mimeType: string,
  locale: Locale
): Promise<VisionExtractionResult> {
  const startTime = Date.now();
  const cfg = getConfig();

  // ── Pass 1: Extract fields ──────────────────────────────────
  const imageUrl = `data:${mimeType};base64,${imageBase64}`;

  const extractionContent: MultimodalContent[] = [
    { type: 'text', text: buildExtractionPrompt() },
    { type: 'image_url', image_url: { url: imageUrl } },
  ];

  const extractionMessages: ChatMessage[] = [
    { role: 'system', content: 'You are a document analysis AI. Respond only with valid JSON.' },
    { role: 'user', content: extractionContent },
  ];

  const extractionResult = await chatCompletion({
    messages: extractionMessages,
    maxTokens: 800,
    temperature: 0.1,
    topP: 0.95,
  });

  // Parse JSON from response
  let parsed: {
    document_type: string;
    fields: Array<{ name: string; value: string; confidence: number }>;
    missing_fields: string[];
    overall_confidence: number;
    notes?: string;
  };

  try {
    // Try to extract JSON even if wrapped in markdown code blocks
    let jsonText = extractionResult.text.trim();
    const jsonMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonText = jsonMatch[1].trim();
    }
    parsed = JSON.parse(jsonText);
  } catch {
    // Fallback: return minimal result
    return {
      detectedDocumentType: 'unknown',
      extractedFields: [],
      confidence: 0,
      missingFields: [],
      validationErrors: [{ field: 'parse', error: 'Failed to parse extraction result' }],
      explanation: locale === 'ml'
        ? 'ക്ഷമിക്കണം, ഡോക്യുമെന്റ് വ്യക്തമായി വായിക്കാൻ കഴിഞ്ഞില്ല. ദയവായി വ്യക്തമായ ഒരു ചിത്രം നൽകുക.'
        : 'Sorry, the document could not be read clearly. Please provide a clearer image.',
      latencyMs: Date.now() - startTime,
      model: cfg.generatorModel,
    };
  }

  const docType = (DOCUMENT_FIELDS[parsed.document_type as DocumentType]
    ? parsed.document_type
    : 'unknown') as DocumentType;

  const extractedFields: ExtractedField[] = (parsed.fields || []).map((f) => ({
    name: f.name,
    value: f.value,
    confidence: Math.min(1, Math.max(0, f.confidence || 0)),
  }));

  // Determine missing fields
  const expectedFields = DOCUMENT_FIELDS[docType] || [];
  const foundFieldNames = new Set(extractedFields.map((f) => f.name));
  const missingFields = expectedFields.filter((f) => !foundFieldNames.has(f));

  // Validate fields
  const validationErrors: ValidationError[] = [];
  for (const field of extractedFields) {
    const validator = FIELD_VALIDATORS[field.name];
    if (validator) {
      const error = validator(field.value);
      if (error) {
        validationErrors.push({ field: field.name, error });
      }
    }
  }

  // Overall confidence
  const confidence = Math.min(
    1,
    Math.max(0, parsed.overall_confidence || 0) *
      (1 - missingFields.length * 0.05) *
      (1 - validationErrors.length * 0.1)
  );

  // ── Pass 2: Generate explanation in user's language ─────────
  const explanationPrompt = buildExplanationPrompt(
    docType,
    extractedFields,
    missingFields,
    validationErrors,
    locale
  );

  let explanation: string;
  try {
    const explResult = await chatCompletion({
      messages: [
        { role: 'system', content: `You are Vaakku, a civic assistant. Respond in ${locale === 'ml' ? 'Malayalam' : 'English'}.` },
        { role: 'user', content: explanationPrompt },
      ],
      maxTokens: 300,
      temperature: 0.4,
    });
    explanation = explResult.text;
  } catch {
    explanation = locale === 'ml'
      ? `${docType === 'unknown' ? 'ഒരു' : docType.replace('_', ' ')} ഡോക്യുമെന്റ് കണ്ടെത്തി. ${extractedFields.length} ഫീൽഡുകൾ എക്സ്ട്രാക്ട് ചെയ്തു.`
      : `Detected a ${docType === 'unknown' ? '' : docType.replace('_', ' ')} document. Extracted ${extractedFields.length} fields.`;
  }

  const latencyMs = Date.now() - startTime;

  // Audit log (no PII)
  console.log(
    JSON.stringify({
      type: 'vision_extraction',
      documentType: docType,
      fieldsExtracted: extractedFields.length,
      missingFields: missingFields.length,
      validationErrors: validationErrors.length,
      confidence,
      locale,
      latencyMs,
      model: cfg.generatorModel,
      timestamp: new Date().toISOString(),
    })
  );

  return {
    detectedDocumentType: docType,
    extractedFields,
    confidence: Math.round(confidence * 100) / 100,
    missingFields,
    validationErrors,
    explanation,
    latencyMs,
    model: cfg.generatorModel,
  };
}
