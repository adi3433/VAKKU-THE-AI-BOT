/**
 * POST /api/transcribe — Audio Transcription Wrapper Endpoint
 * ────────────────────────────────────────────────────────────
 * Wraps Fireworks Whisper V3 for audio → text transcription.
 * 
 * Request:  multipart/form-data with 'audio' file field, or JSON { audioBase64 }
 * Response: { transcript, locale, duration, latencyMs }
 */
import { NextRequest, NextResponse } from 'next/server';
import { transcribeAudio } from '@/lib/fireworks';

const MAX_AUDIO_SIZE = 25 * 1024 * 1024; // 25MB

export async function POST(request: NextRequest) {
  try {
    let audioBuffer: Uint8Array;
    let filename = 'audio.webm';

    const contentType = request.headers.get('content-type') ?? '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('audio') as File | null;
      if (!file) {
        return NextResponse.json(
          { error: 'audio file field is required' },
          { status: 400 }
        );
      }
      if (file.size > MAX_AUDIO_SIZE) {
        return NextResponse.json(
          { error: 'Audio file exceeds 25MB limit' },
          { status: 413 }
        );
      }
      filename = file.name || filename;
      audioBuffer = new Uint8Array(await file.arrayBuffer());
    } else {
      const body = await request.json();
      const { audioBase64 } = body as { audioBase64: string };
      if (!audioBase64) {
        return NextResponse.json(
          { error: 'audioBase64 is required' },
          { status: 400 }
        );
      }
      const raw = audioBase64.replace(/^data:audio\/[^;]+;base64,/, '');
      audioBuffer = Uint8Array.from(Buffer.from(raw, 'base64'));
      if (audioBuffer.length > MAX_AUDIO_SIZE) {
        return NextResponse.json(
          { error: 'Audio exceeds 25MB limit' },
          { status: 413 }
        );
      }
    }

    const startTime = Date.now();
    const result = await transcribeAudio(Buffer.from(audioBuffer), filename);
    const latencyMs = Date.now() - startTime;

    return NextResponse.json({
      transcript: result.text,
      locale: result.language ?? 'en',
      duration: result.duration,
      latencyMs,
    });
  } catch (error) {
    console.error('Transcribe API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
