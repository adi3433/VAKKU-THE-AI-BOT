/**
 * POST /api/voice — Voice transcription endpoint
 * ────────────────────────────────────────────────
 * Accepts audio as multipart form data or raw body,
 * transcribes via Whisper V3, returns structured result.
 *
 * API Contract:
 *   Request:  multipart/form-data with 'audio' file field
 *   Response: { transcript, locale, durationSeconds, latencyMs, ... }
 */
import { NextRequest, NextResponse } from 'next/server';
import { processVoiceInput, validateAudioInput, type VoiceResult } from '@/lib/voice';
import { hashIdentifier } from '@/lib/privacy';

export interface VoiceAPIResponse {
  transcript: string;
  locale: 'en' | 'ml';
  durationSeconds: number;
  latencyMs: number;
  model: string;
  fillersRemoved: boolean;
}

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || '';
    let audioData: Blob;
    let filename = 'audio.webm';

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('audio');
      if (!file || !(file instanceof Blob)) {
        return NextResponse.json(
          { error: 'Missing "audio" file in form data' },
          { status: 400 }
        );
      }
      audioData = file;
      if (file instanceof File && file.name) {
        filename = file.name;
      }
    } else if (
      contentType.includes('audio/') ||
      contentType.includes('application/octet-stream')
    ) {
      const buffer = await request.arrayBuffer();
      audioData = new Blob([buffer], { type: contentType });
    } else {
      return NextResponse.json(
        { error: 'Expected multipart/form-data with "audio" field, or raw audio body' },
        { status: 400 }
      );
    }

    // Validate
    const validation = validateAudioInput(audioData.size, audioData.type || undefined);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // Process through voice pipeline
    const result: VoiceResult = await processVoiceInput(audioData, filename);

    // Audit log
    const sessionId = request.headers.get('x-session-id') || 'anonymous';
    console.log(
      JSON.stringify({
        type: 'voice_api_call',
        sessionHash: hashIdentifier(sessionId),
        locale: result.locale,
        durationSeconds: result.durationSeconds,
        latencyMs: result.latencyMs,
        timestamp: new Date().toISOString(),
      })
    );

    const response: VoiceAPIResponse = {
      transcript: result.transcript,
      locale: result.locale,
      durationSeconds: result.durationSeconds,
      latencyMs: result.latencyMs,
      model: result.model,
      fillersRemoved: result.fillersRemoved,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Voice API error:', error);
    return NextResponse.json(
      { error: 'Voice transcription failed' },
      { status: 500 }
    );
  }
}
