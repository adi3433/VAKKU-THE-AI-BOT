/**
 * Chat Persistence — localStorage-based Conversation Storage
 * ───────────────────────────────────────────────────────────
 * Auto-saves conversations to localStorage so the sidebar
 * can display chat history across page reloads.
 */

import type { ChatMessage, ConversationListItem, Locale } from '@/types';

const STORAGE_KEY = 'vaakku_conversations';
const MAX_CONVERSATIONS = 50;

export interface PersistedConversation {
  id: string;          // sessionId used as conversation id
  title: string;
  summary: string;
  locale: Locale;
  messages: ChatMessage[];
  messageCount: number;
  createdAt: string;
  updatedAt: string;
  starred: boolean;
  pinned: boolean;
}

// ── Helpers ──────────────────────────────────────────────────────

function generateTitle(messages: ChatMessage[]): string {
  const firstUser = messages.find((m) => m.role === 'user');
  if (!firstUser) return 'New conversation';
  const text = firstUser.content.replace(/\[📎.*?\]/g, '').trim();
  if (!text) return 'File upload';
  return text.slice(0, 60) + (text.length > 60 ? '…' : '');
}

function generateSummary(messages: ChatMessage[]): string {
  const userMsgs = messages.filter((m) => m.role === 'user');
  if (userMsgs.length === 0) return '';
  if (userMsgs.length === 1) return userMsgs[0].content.slice(0, 120);
  return `${userMsgs.length} messages`;
}

// ── Read / Write localStorage ────────────────────────────────────

function readAll(): PersistedConversation[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as PersistedConversation[];
  } catch {
    return [];
  }
}

function writeAll(conversations: PersistedConversation[]): void {
  if (typeof window === 'undefined') return;
  try {
    // Keep only the most recent MAX_CONVERSATIONS
    const trimmed = conversations
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, MAX_CONVERSATIONS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // localStorage full — silently fail
  }
}

// ── Public API ───────────────────────────────────────────────────

/**
 * Save or update a conversation in localStorage.
 * Uses sessionId as the conversation identifier.
 */
export function saveConversation(
  sessionId: string,
  messages: ChatMessage[],
  locale: Locale
): void {
  if (!messages.length) return;

  const all = readAll();
  const existingIdx = all.findIndex((c) => c.id === sessionId);
  const now = new Date().toISOString();

  if (existingIdx >= 0) {
    // Update existing
    all[existingIdx].messages = messages;
    all[existingIdx].messageCount = messages.length;
    all[existingIdx].updatedAt = now;
    all[existingIdx].title = generateTitle(messages);
    all[existingIdx].summary = generateSummary(messages);
  } else {
    // Create new
    all.push({
      id: sessionId,
      title: generateTitle(messages),
      summary: generateSummary(messages),
      locale,
      messages,
      messageCount: messages.length,
      createdAt: now,
      updatedAt: now,
      starred: false,
      pinned: false,
    });
  }

  writeAll(all);
}

/**
 * Load all conversations as list items (without full messages).
 */
export function loadConversationList(): ConversationListItem[] {
  return readAll().map((c) => ({
    id: c.id,
    title: c.title,
    summary: c.summary,
    locale: c.locale,
    messageCount: c.messageCount,
    updatedAt: c.updatedAt,
    starred: c.starred,
    pinned: c.pinned,
    escalated: false,
  }));
}

/**
 * Load full messages for a specific conversation.
 */
export function loadConversationMessages(conversationId: string): ChatMessage[] | null {
  const all = readAll();
  const conv = all.find((c) => c.id === conversationId);
  return conv ? conv.messages : null;
}

/**
 * Delete a conversation from localStorage.
 */
export function deleteConversation(conversationId: string): void {
  const all = readAll();
  const filtered = all.filter((c) => c.id !== conversationId);
  writeAll(filtered);
}

/**
 * Toggle star on a conversation.
 */
export function toggleConversationStar(conversationId: string): void {
  const all = readAll();
  const conv = all.find((c) => c.id === conversationId);
  if (conv) {
    conv.starred = !conv.starred;
    writeAll(all);
  }
}

/**
 * Toggle pin on a conversation.
 */
export function toggleConversationPin(conversationId: string): void {
  const all = readAll();
  const conv = all.find((c) => c.id === conversationId);
  if (conv) {
    conv.pinned = !conv.pinned;
    writeAll(all);
  }
}
