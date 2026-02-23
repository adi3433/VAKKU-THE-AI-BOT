/**
 * POST /api/vision — Document extraction endpoint
 * ─────────────────────────────────────────────────
 * Accepts an image (multipart form or base64 JSON),
 * extracts structured fields from voter documents.
 *
 * API Contract:
 *   Request (multipart):  form-data with 'image' file + optional 'locale' field
 *   Request (JSON):       { imageBase64: string, mimeType: string, locale: 'en'|'ml' }
 *   Response:             VisionExtractionResult
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  extractDocumentFields,
  validateImageInput,
  type VisionExtractionResult,
} from '@/lib/vision';
import { hashIdentifier } from '@/lib/privacy';
import type { Locale } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || '';
    let imageBase64: string;
    let mimeType: string;
    let locale: Locale = 'en';

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('image');
      if (!file || !(file instanceof Blob)) {
        return NextResponse.json(
          { error: 'Missing "image" file in form data' },
          { status: 400 }
        );
      }

      // Validate
      const validation = validateImageInput(file.size, file.type || undefined);
      if (!validation.valid) {
        return NextResponse.json({ error: validation.error }, { status: 400 });
      }

      // Convert to base64
      const buffer = await file.arrayBuffer();
      imageBase64 = Buffer.from(buffer).toString('base64');
      mimeType = file.type || 'image/jpeg';
      locale = (formData.get('locale') as Locale) || 'en';
    } else if (contentType.includes('application/json')) {
      const body = await request.json();
      if (!body.imageBase64) {
        return NextResponse.json(
          { error: 'Missing "imageBase64" in request body' },
          { status: 400 }
        );
      }
      imageBase64 = body.imageBase64;
      mimeType = body.mimeType || 'image/jpeg';
      locale = body.locale || 'en';

      // Validate size (base64 is ~33% larger than binary)
      const estimatedSize = Math.ceil(imageBase64.length * 0.75);
      const validation = validateImageInput(estimatedSize, mimeType);
      if (!validation.valid) {
        return NextResponse.json({ error: validation.error }, { status: 400 });
      }
    } else {
      return NextResponse.json(
        { error: 'Expected multipart/form-data or application/json' },
        { status: 400 }
      );
    }

    // Extract document fields
    const result: VisionExtractionResult = await extractDocumentFields(
      imageBase64,
      mimeType,
      locale
    );

    // Audit log
    const sessionId = request.headers.get('x-session-id') || 'anonymous';
    console.log(
      JSON.stringify({
        type: 'vision_api_call',
        sessionHash: hashIdentifier(sessionId),
        documentType: result.detectedDocumentType,
        fieldsExtracted: result.extractedFields.length,
        confidence: result.confidence,
        locale,
        latencyMs: result.latencyMs,
        timestamp: new Date().toISOString(),
      })
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error('Vision API error:', error);
    return NextResponse.json(
      { error: 'Document extraction failed' },
      { status: 500 }
    );
  }
}
