/**
 * DELETE /api/memory/delete — Delete All User Memory & History
 * ─────────────────────────────────────────────────────────────
 * GDPR right-to-erasure. Removes all memories and conversations for a user.
 *
 * Request:  { userId }
 * Response: { success, deletedMemories, deletedConversations, message }
 */
import { NextRequest, NextResponse } from 'next/server';
import { deleteUserMemory } from '@/lib/memory';
import { deleteAllConversations } from '@/lib/chat-history';
import { recordAuditEntry } from '@/lib/admin-audit';
import { hashIdentifier } from '@/lib/privacy';
import { v4 as uuid } from 'uuid';

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId } = body as { userId: string };

    if (!userId?.trim()) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    const deletedMemories = deleteUserMemory(userId);
    const deletedConversations = deleteAllConversations(userId);

    // Audit the deletion
    recordAuditEntry({
      id: uuid(),
      action: 'data_deletion',
      actorId: hashIdentifier(userId),
      details: JSON.stringify({
        type: 'full_user_delete',
        deletedMemories,
        deletedConversations,
      }),
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      deletedMemories,
      deletedConversations,
      message: `Deleted ${deletedMemories} memories and ${deletedConversations} conversations.`,
    });
  } catch (error) {
    console.error('Memory delete error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
