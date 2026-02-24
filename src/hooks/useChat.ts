/**
 * useChat — Chat orchestration hook
 * ───────────────────────────────────
 * Handles sending messages, receiving responses,
 * and managing conversation state.
 */
'use client';

import { useCallback } from 'react';
import { v4 as uuid } from 'uuid';
import { useVaakkuStore } from '@/lib/store';
import { sendChatMessage } from '@/lib/api-client';
import type { ChatMessage } from '@/types';

export function useChat() {
  const {
    messages,
    addMessage,
    clearMessages,
    isTyping,
    setTyping,
    sessionId,
    locale,
    setQuickActions,
    userLatitude,
    userLongitude,
  } = useVaakkuStore();

  const send = useCallback(
    async (text: string) => {
      if (!text.trim()) return;

      // Add user message
      const userMsg: ChatMessage = {
        id: uuid(),
        role: 'user',
        content: text.trim(),
        locale,
        timestamp: new Date().toISOString(),
      };
      addMessage(userMsg);
      setTyping(true);

      try {
        const response = await sendChatMessage({
          message: text.trim(),
          locale,
          sessionId,
          conversationHistory: [...messages, userMsg].slice(-10), // last 10 msgs
          ...(userLatitude != null && userLongitude != null
            ? { latitude: userLatitude, longitude: userLongitude }
            : {}),
        });

        const assistantMsg: ChatMessage = {
          id: response.messageId,
          role: 'assistant',
          content: response.text,
          locale: response.locale,
          timestamp: response.timestamp,
          confidence: response.confidence,
          sources: response.sources,
          actionable: response.actionable,
          escalate: response.escalate,
        };

        addMessage(assistantMsg);

        // Update quick actions if the response suggests new ones
        if (response.actionable?.length) {
          setQuickActions(response.actionable);
        }
      } catch (_error) {
        const errorMsg: ChatMessage = {
          id: uuid(),
          role: 'assistant',
          content:
            locale === 'ml'
              ? 'ക്ഷമിക്കണം, ഒരു പിശക് സംഭവിച്ചു. ദയവായി വീണ്ടും ശ്രമിക്കുക.'
              : 'Sorry, an error occurred. Please try again.',
          locale,
          timestamp: new Date().toISOString(),
          confidence: 0,
          escalate: false,
        };
        addMessage(errorMsg);
      } finally {
        setTyping(false);
      }
    },
    [messages, addMessage, setTyping, sessionId, locale, setQuickActions, userLatitude, userLongitude]
  );

  return {
    messages,
    send,
    clearMessages,
    isTyping,
  };
}
