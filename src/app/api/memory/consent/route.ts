/**
 * POST /api/memory/consent — Set Memory Consent Preferences
 * ──────────────────────────────────────────────────────────
 * Opt-in/out of persistent memory per type (profile, preferences, saved_docs).
 *
 * Request:  MemoryConsentRequest { userId, enabled, allowedTypes }
 * Response: MemoryConsentResponse
 */
import { NextRequest, NextResponse } from 'next/server';
import { setMemoryConsent, getMemoryConsent } from '@/lib/memory';
import type { MemoryConsentRequest } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const body: MemoryConsentRequest = await request.json();
    const { userId } = body;

    if (!userId?.trim()) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    const response = setMemoryConsent(body);
    return NextResponse.json(response);
  } catch (error) {
    console.error('Memory consent error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'userId query param is required' },
        { status: 400 }
      );
    }

    const consent = getMemoryConsent(userId);

    return NextResponse.json({
      userId,
      memoryEnabled: consent?.memoryEnabled ?? false,
      allowedTypes: consent?.allowedTypes ?? [],
    });
  } catch (error) {
    console.error('Memory consent GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
