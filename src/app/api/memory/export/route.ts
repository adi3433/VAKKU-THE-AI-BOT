/**
 * GET /api/memory/export — Export All User Memory Data
 * ────────────────────────────────────────────────────
 * GDPR-compliant data export. Returns all stored memories + conversations.
 *
 * Query Params: ?userId=xxx
 * Response: MemoryExportResponse { memories, conversations, exportedAt }
 */
import { NextRequest, NextResponse } from 'next/server';
import { exportUserMemory } from '@/lib/memory';
import { getAllConversationsForExport } from '@/lib/chat-history';
import { recordAuditEntry } from '@/lib/admin-audit';
import { hashIdentifier } from '@/lib/privacy';
import { v4 as uuid } from 'uuid';

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

    const conversations = getAllConversationsForExport(userId);
    const response = await exportUserMemory(userId, conversations);

    // Audit the data export
    recordAuditEntry({
      id: uuid(),
      action: 'data_access',
      actorId: hashIdentifier(userId),
      details: JSON.stringify({
        type: 'memory_export',
        memoriesCount: response.entries.length,
        conversationsCount: response.conversations.length,
      }),
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json(response);
  } catch (error) {
    console.error('Memory export error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
