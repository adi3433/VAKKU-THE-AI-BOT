/**
 * useChatPersistence — Auto-save & load chat conversations
 * ─────────────────────────────────────────────────────────
 * Dual-write architecture:
 *   1. localStorage — fast, offline-first sidebar rendering
 *   2. Supabase API — permanent server-side storage
 *
 * Loads from localStorage on mount; syncs to server in background.
 */
'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useVaakkuStore } from '@/lib/store';
import {
  saveConversation as saveToLocal,
  loadConversationList,
  loadConversationMessages,
  deleteConversation as deleteConvFromLocal,
  toggleConversationStar,
  toggleConversationPin,
} from '@/lib/chat-persistence';

// ── Server sync helpers (fire-and-forget) ────────────────────

function generateTitle(messages: Array<{ role: string; content: string }>): string {
  const firstUser = messages.find((m) => m.role === 'user');
  if (!firstUser) return 'New conversation';
  const text = firstUser.content.replace(/\[📎.*?\]/g, '').trim();
  if (!text) return 'File upload';
  return text.slice(0, 60) + (text.length > 60 ? '…' : '');
}

function generateSummary(messages: Array<{ role: string; content: string }>): string {
  const userMsgs = messages.filter((m) => m.role === 'user');
  if (userMsgs.length === 0) return '';
  if (userMsgs.length === 1) return userMsgs[0].content.slice(0, 120);
  return `${userMsgs.length} messages`;
}

async function syncToServer(
  userId: string,
  sessionId: string,
  messages: unknown[],
  locale: string,
  title: string,
  summary: string
) {
  try {
    await fetch('/api/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, sessionId, messages, locale, title, summary }),
    });
  } catch {
    // Server sync failure is non-critical; localStorage has the data
  }
}

async function deleteFromServer(conversationId: string) {
  try {
    await fetch(`/api/conversations/${conversationId}`, { method: 'DELETE' });
  } catch {
    // Non-critical
  }
}

async function updateFlagsOnServer(conversationId: string, updates: Record<string, unknown>) {
  try {
    await fetch(`/api/conversations/${conversationId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
  } catch {
    // Non-critical
  }
}

export function useChatPersistence() {
  const messages = useVaakkuStore((s) => s.messages);
  const sessionId = useVaakkuStore((s) => s.sessionId);
  const locale = useVaakkuStore((s) => s.locale);
  const userId = useVaakkuStore((s) => s.userId);
  const incognitoMode = useVaakkuStore((s) => s.incognitoMode);
  const setConversations = useVaakkuStore((s) => s.setConversations);
  const setMessages = useVaakkuStore((s) => s.setMessages);
  const setActiveConversationId = useVaakkuStore((s) => s.setActiveConversationId);

  const prevSessionIdRef = useRef(sessionId);

  // Load conversation list on mount
  useEffect(() => {
    const list = loadConversationList();
    setConversations(list);
  }, [setConversations]);

  // Auto-save current conversation when messages change
  useEffect(() => {
    if (incognitoMode) return;
    if (messages.length === 0) return;

    // Debounce save slightly to avoid excessive writes
    const timer = setTimeout(() => {
      // 1. Save to localStorage (instant)
      saveToLocal(sessionId, messages, locale);
      const list = loadConversationList();
      setConversations(list);

      // 2. Sync to Supabase (background, non-blocking)
      const title = generateTitle(messages);
      const summary = generateSummary(messages);
      syncToServer(userId, sessionId, messages, locale, title, summary);
    }, 300);

    return () => clearTimeout(timer);
  }, [messages, sessionId, locale, userId, incognitoMode, setConversations]);

  // When sessionId changes (new chat), set active conversation
  useEffect(() => {
    if (prevSessionIdRef.current !== sessionId) {
      prevSessionIdRef.current = sessionId;
      if (messages.length === 0) {
        setActiveConversationId(null);
      }
    }
  }, [sessionId, messages.length, setActiveConversationId]);

  // Select a conversation from sidebar
  const selectConversation = useCallback(
    (conversationId: string) => {
      const loaded = loadConversationMessages(conversationId);
      if (loaded) {
        setMessages(loaded);
        setActiveConversationId(conversationId);
        useVaakkuStore.setState({ sessionId: conversationId });
        prevSessionIdRef.current = conversationId;
      }
    },
    [setMessages, setActiveConversationId]
  );

  // Delete a conversation
  const removeConversation = useCallback(
    (conversationId: string) => {
      deleteConvFromLocal(conversationId);
      deleteFromServer(conversationId);
      const list = loadConversationList();
      setConversations(list);
      const state = useVaakkuStore.getState();
      if (state.activeConversationId === conversationId) {
        state.resetSession();
      }
    },
    [setConversations]
  );

  // Toggle star
  const toggleStar = useCallback(
    (conversationId: string) => {
      toggleConversationStar(conversationId);
      const list = loadConversationList();
      setConversations(list);
      // Find current star state from updated list
      const conv = list.find((c) => c.id === conversationId);
      if (conv) updateFlagsOnServer(conversationId, { starred: conv.starred });
    },
    [setConversations]
  );

  // Toggle pin
  const togglePin = useCallback(
    (conversationId: string) => {
      toggleConversationPin(conversationId);
      const list = loadConversationList();
      setConversations(list);
      const conv = list.find((c) => c.id === conversationId);
      if (conv) updateFlagsOnServer(conversationId, { pinned: conv.pinned });
    },
    [setConversations]
  );

  return {
    selectConversation,
    removeConversation,
    toggleStar,
    togglePin,
  };
}
