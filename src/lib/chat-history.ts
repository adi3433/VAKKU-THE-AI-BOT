/**
 * Chat History Store — Persistent Conversation Storage
 * ─────────────────────────────────────────────────────
 * Per-session stored conversations with search, pin/star,
 * and privacy controls per user.
 *
 * Production: backed by PostgreSQL / encrypted storage.
 * This implementation uses in-memory Map for PoC.
 */

import { hashIdentifier } from '@/lib/privacy';
import { isMemoryEnabled } from '@/lib/memory';
import type {
  StoredConversation,
  ConversationListItem,
  ConversationSearchParams,
  ChatMessage,
  Locale,
} from '@/types';

// ── In-memory store (production: encrypted DB) ───────────────────

const conversationStore = new Map<string, StoredConversation[]>();

function generateId(): string {
  return `conv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ── Auto-summarize (simple heuristic; production: use LLM) ───────

function autoSummarize(messages: ChatMessage[]): string {
  const userMsgs = messages.filter((m) => m.role === 'user');
  if (userMsgs.length === 0) return 'Empty conversation';
  if (userMsgs.length === 1) return userMsgs[0].content.slice(0, 120);
  return `${userMsgs.length} questions: ${userMsgs[0].content.slice(0, 60)}...`;
}

function autoTitle(messages: ChatMessage[], locale: Locale): string {
  const first = messages.find((m) => m.role === 'user');
  if (!first) return locale === 'ml' ? 'പുതിയ സംഭാഷണം' : 'New conversation';
  return first.content.slice(0, 60) + (first.content.length > 60 ? '…' : '');
}

// ── CRUD Operations ──────────────────────────────────────────────

/**
 * Save or update a conversation.
 * Only stores if user has memory enabled.
 */
export async function saveConversation(
  userId: string,
  sessionId: string,
  messages: ChatMessage[],
  locale: Locale,
  escalated: boolean = false
): Promise<StoredConversation | null> {
  const memEnabled = await isMemoryEnabled(userId);
  if (!memEnabled) return null;

  const hashedUserId = hashIdentifier(userId);
  const convos = conversationStore.get(hashedUserId) || [];

  // Check if conversation for this session exists
  const existing = convos.find((c) => c.sessionId === sessionId);

  if (existing) {
    existing.messages = messages;
    existing.messageCount = messages.length;
    existing.updatedAt = new Date().toISOString();
    existing.summary = autoSummarize(messages);
    existing.escalated = existing.escalated || escalated;
    conversationStore.set(hashedUserId, convos);
    return existing;
  }

  // Create new conversation
  const conv: StoredConversation = {
    id: generateId(),
    sessionId,
    userId: hashedUserId,
    title: autoTitle(messages, locale),
    summary: autoSummarize(messages),
    locale,
    messages,
    messageCount: messages.length,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    starred: false,
    pinned: false,
    escalated,
    tags: [],
  };

  convos.push(conv);
  conversationStore.set(hashedUserId, convos);
  return conv;
}

/**
 * Get a single conversation by ID
 */
export function getConversation(userId: string, conversationId: string): StoredConversation | null {
  const hashedUserId = hashIdentifier(userId);
  const convos = conversationStore.get(hashedUserId) || [];
  return convos.find((c) => c.id === conversationId) || null;
}

/**
 * List conversations with filtering, pagination, and search
 */
export function listConversations(
  userId: string,
  params: ConversationSearchParams = {}
): { data: ConversationListItem[]; total: number } {
  const hashedUserId = hashIdentifier(userId);
  let convos = conversationStore.get(hashedUserId) || [];

  // Apply filters
  if (params.locale) {
    convos = convos.filter((c) => c.locale === params.locale);
  }
  if (params.starred !== undefined) {
    convos = convos.filter((c) => c.starred === params.starred);
  }
  if (params.escalated !== undefined) {
    convos = convos.filter((c) => c.escalated === params.escalated);
  }
  if (params.since) {
    convos = convos.filter((c) => c.updatedAt >= params.since!);
  }
  if (params.until) {
    convos = convos.filter((c) => c.updatedAt <= params.until!);
  }
  if (params.query) {
    const q = params.query.toLowerCase();
    convos = convos.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.summary.toLowerCase().includes(q) ||
        c.messages.some((m) => m.content.toLowerCase().includes(q))
    );
  }

  // Sort: pinned first, then by updatedAt desc
  convos.sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return b.updatedAt.localeCompare(a.updatedAt);
  });

  const total = convos.length;
  const page = params.page || 1;
  const limit = Math.min(params.limit || 20, 100);
  const offset = (page - 1) * limit;

  const items: ConversationListItem[] = convos.slice(offset, offset + limit).map((c) => ({
    id: c.id,
    title: c.title,
    summary: c.summary,
    locale: c.locale,
    messageCount: c.messageCount,
    updatedAt: c.updatedAt,
    starred: c.starred,
    pinned: c.pinned,
    escalated: c.escalated,
  }));

  return { data: items, total };
}

/**
 * Toggle star/pin on a conversation
 */
export function updateConversationFlags(
  userId: string,
  conversationId: string,
  updates: { starred?: boolean; pinned?: boolean; title?: string; tags?: string[] }
): StoredConversation | null {
  const hashedUserId = hashIdentifier(userId);
  const convos = conversationStore.get(hashedUserId) || [];
  const conv = convos.find((c) => c.id === conversationId);
  if (!conv) return null;

  if (updates.starred !== undefined) conv.starred = updates.starred;
  if (updates.pinned !== undefined) conv.pinned = updates.pinned;
  if (updates.title !== undefined) conv.title = updates.title;
  if (updates.tags !== undefined) conv.tags = updates.tags;
  conv.updatedAt = new Date().toISOString();

  conversationStore.set(hashedUserId, convos);
  return conv;
}

/**
 * Delete a single conversation
 */
export function deleteConversation(userId: string, conversationId: string): boolean {
  const hashedUserId = hashIdentifier(userId);
  const convos = conversationStore.get(hashedUserId) || [];
  const idx = convos.findIndex((c) => c.id === conversationId);
  if (idx < 0) return false;
  convos.splice(idx, 1);
  conversationStore.set(hashedUserId, convos);
  return true;
}

/**
 * Delete all conversations for a user
 */
export function deleteAllConversations(userId: string): number {
  const hashedUserId = hashIdentifier(userId);
  const convos = conversationStore.get(hashedUserId) || [];
  const count = convos.length;
  conversationStore.delete(hashedUserId);
  return count;
}

/**
 * Get all conversations for export
 */
export function getAllConversationsForExport(userId: string): StoredConversation[] {
  const hashedUserId = hashIdentifier(userId);
  return conversationStore.get(hashedUserId) || [];
}
