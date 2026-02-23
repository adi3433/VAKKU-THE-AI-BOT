/**
 * POST /api/conversations   — Save/update a conversation
 * GET  /api/conversations   — List conversations for a user
 * ──────────────────────────────────────────────────────────
 * Server-side persistence to Supabase. The client calls these
 * endpoints to sync conversations to the permanent database.
 */
import { NextRequest, NextResponse } from 'next/server';
import { isSupabaseConfigured } from '@/lib/supabase';
import { hashIdentifier } from '@/lib/privacy';
import {
  dbSaveConversation,
  dbListConversations,
} from '@/lib/db';
import type { ChatMessage, Locale } from '@/types';

export async function POST(request: NextRequest) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 503 }
      );
    }

    const body = await request.json();
    const {
      userId,
      sessionId,
      messages,
      locale,
      title,
      summary,
    } = body as {
      userId: string;
      sessionId: string;
      messages: ChatMessage[];
      locale: Locale;
      title: string;
      summary: string;
    };

    if (!userId || !sessionId || !messages?.length) {
      return NextResponse.json(
        { error: 'userId, sessionId, and messages are required' },
        { status: 400 }
      );
    }

    const hashedUserId = hashIdentifier(userId);
    const saved = await dbSaveConversation(
      hashedUserId,
      sessionId,
      messages,
      locale || 'en',
      title || 'New conversation',
      summary || ''
    );

    return NextResponse.json({ success: saved });
  } catch (error) {
    console.error('Save conversation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ conversations: [] });
    }

    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'userId query param is required' },
        { status: 400 }
      );
    }

    const hashedUserId = hashIdentifier(userId);
    const conversations = await dbListConversations(hashedUserId);

    return NextResponse.json({ conversations });
  } catch (error) {
    console.error('List conversations error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
