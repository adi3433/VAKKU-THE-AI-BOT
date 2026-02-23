/**
 * GET    /api/conversations/[id]  — Get full conversation with messages
 * DELETE /api/conversations/[id]  — Delete a conversation
 * PATCH  /api/conversations/[id]  — Update flags (star/pin/title)
 */
import { NextRequest, NextResponse } from 'next/server';
import { isSupabaseConfigured } from '@/lib/supabase';
import {
  dbGetConversation,
  dbDeleteConversation,
  dbUpdateConversationFlags,
} from '@/lib/db';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(
  _request: NextRequest,
  context: RouteContext
) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 503 }
      );
    }

    const { id } = await context.params;
    const conversation = await dbGetConversation(id);

    if (!conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(conversation);
  } catch (error) {
    console.error('Get conversation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  context: RouteContext
) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 503 }
      );
    }

    const { id } = await context.params;
    const deleted = await dbDeleteConversation(id);

    return NextResponse.json({ success: deleted });
  } catch (error) {
    console.error('Delete conversation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 503 }
      );
    }

    const { id } = await context.params;
    const body = await request.json();
    const { starred, pinned, title } = body as {
      starred?: boolean;
      pinned?: boolean;
      title?: string;
    };

    const updated = await dbUpdateConversationFlags(id, { starred, pinned, title });

    return NextResponse.json({ success: updated });
  } catch (error) {
    console.error('Update conversation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
