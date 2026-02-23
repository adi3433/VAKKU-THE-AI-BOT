/**
 * Chat Page — Main conversational interface with sidebar & uploads
 */
'use client';

import React, { useState, useCallback } from 'react';
import { Header } from '@/components/layout/Header';
import { ParallaxBackground } from '@/components/layout/ParallaxBackground';
import { ChatInput, MessageList, SystemBanner, QuickActions, ChatSidebar, FileUpload } from '@/components/chat';
import { useChat } from '@/hooks/useChat';
import { useVaakkuStore } from '@/lib/store';
import { sendMultimodalChat } from '@/lib/api-client';
import type { ActionItem } from '@/types';
import { Bars3Icon } from '@heroicons/react/24/outline';
import { motion } from 'framer-motion';

export default function ChatPage() {
  const { messages, send, isTyping } = useChat();
  const quickActions = useVaakkuStore((s) => s.quickActions);
  const locale = useVaakkuStore((s) => s.locale);
  const sessionId = useVaakkuStore((s) => s.sessionId);
  const userId = useVaakkuStore((s) => s.userId);
  const toggleHistorySidebar = useVaakkuStore((s) => s.toggleHistorySidebar);
  const resetSession = useVaakkuStore((s) => s.resetSession);
  const addMessage = useVaakkuStore((s) => s.addMessage);
  const setTyping = useVaakkuStore((s) => s.setTyping);
  const [bannerVisible, setBannerVisible] = useState(true);

  const handleQuickAction = (action: ActionItem) => {
    const prompts: Record<string, Record<string, string>> = {
      check_epic: {
        en: 'I want to check my voter registration status',
        ml: 'എന്റെ വോട്ടർ രജിസ്ട്രേഷൻ സ്ഥിതി പരിശോധിക്കണം',
      },
      locate_booth: {
        en: 'Help me find my polling booth',
        ml: 'എന്റെ പോളിംഗ് ബൂത്ത് കണ്ടെത്താൻ സഹായിക്കൂ',
      },
      report_violation: {
        en: 'I want to report an election violation',
        ml: 'ഒരു തിരഞ്ഞെടുപ്പ് ലംഘനം റിപ്പോർട്ട് ചെയ്യണം',
      },
      faq: {
        en: 'Show me frequently asked questions',
        ml: 'പൊതു ചോദ്യങ്ങൾ കാണിക്കുക',
      },
    };
    const prompt = prompts[action.action]?.[locale] || action.label;
    send(prompt);
  };

  const handleFileUpload = useCallback(
    async (base64: string, type: 'image' | 'document' | 'audio', mimeType: string) => {
      // Add user message with attachment indicator
      const userMessage = locale === 'ml'
        ? `[📎 ${type === 'image' ? 'ചിത്രം' : 'ഡോക്യുമെന്റ്'} അപ്‌ലോഡ് ചെയ്തു]`
        : `[📎 ${type === 'image' ? 'Image' : 'Document'} uploaded]`;

      addMessage({
        id: crypto.randomUUID(),
        role: 'user',
        content: userMessage,
        locale,
        timestamp: new Date().toISOString(),
      });
      setTyping(true);

      try {
        const response = await sendMultimodalChat({
          message: type === 'image'
            ? (locale === 'ml' ? 'ഈ ഡോക്യുമെന്റിൽ നിന്ന് വിവരങ്ങൾ എക്‌സ്ട്രാക്ട് ചെയ്യുക' : 'Extract information from this document')
            : (locale === 'ml' ? 'ഈ ഫയൽ വിശകലനം ചെയ്യുക' : 'Analyze this file'),
          locale,
          sessionId,
          imageBase64: type === 'image' ? base64 : undefined,
          userId,
        });

        addMessage({
          id: response.messageId,
          role: 'assistant',
          content: response.text,
          locale,
          timestamp: response.timestamp,
        });
      } catch {
        addMessage({
          id: crypto.randomUUID(),
          role: 'assistant',
          content: locale === 'ml'
            ? 'ക്ഷമിക്കണം, ഫയൽ പ്രോസസ്സ് ചെയ്യാൻ കഴിഞ്ഞില്ല.'
            : 'Sorry, I could not process the file.',
          locale,
          timestamp: new Date().toISOString(),
        });
      } finally {
        setTyping(false);
      }
    },
    [locale, sessionId, userId, addMessage, setTyping]
  );

  const handleSelectConversation = useCallback(
    (conversationId: string) => {
      // Load conversation messages
      useVaakkuStore.getState().setActiveConversationId(conversationId);
    },
    []
  );

  const handleNewConversation = useCallback(() => {
    resetSession();
  }, [resetSession]);

  return (
    <>
      <ParallaxBackground />
      <ChatSidebar
        onSelectConversation={handleSelectConversation}
        onNewConversation={handleNewConversation}
      />
      <div className="flex min-h-screen flex-col">
        <Header />
        <SystemBanner visible={bannerVisible} onDismiss={() => setBannerVisible(false)} />

        {/* Chat area */}
        <div className="flex flex-1 flex-col">
          {messages.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center px-4 py-12">
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--color-primary-500)] shadow-lg">
                  <span className="text-2xl font-bold text-white">V</span>
                </div>
                <h2 className={`text-xl font-bold text-[var(--color-neutral-800)] ${locale === 'ml' ? 'font-ml' : ''}`}>
                  {locale === 'ml' ? 'വാക്കിലേക്ക് സ്വാഗതം!' : 'Welcome to Vaakku!'}
                </h2>
                <p className={`mt-2 max-w-md text-sm text-[var(--color-neutral-500)] ${locale === 'ml' ? 'font-ml' : ''}`}>
                  {locale === 'ml'
                    ? 'ചുവടെയുള്ള ക്വിക്ക് ആക്ഷനുകൾ ഉപയോഗിക്കുക അല്ലെങ്കിൽ നിങ്ങളുടെ ചോദ്യം ടൈപ്പ് ചെയ്യുക.'
                    : 'Use the quick actions below or type your question.'}
                </p>
              </div>
              <div className="mt-6 w-full max-w-2xl">
                <QuickActions actions={quickActions} onAction={handleQuickAction} />
              </div>
            </div>
          ) : (
            <MessageList messages={messages} isTyping={isTyping} />
          )}

          {/* Input row with upload and history buttons */}
          <div className="flex items-end gap-2 px-4 pb-4 pt-2">
            {/* History sidebar toggle */}
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={toggleHistorySidebar}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[var(--color-neutral-400)] hover:bg-[var(--color-neutral-100)] hover:text-[var(--color-neutral-600)] transition-colors"
              aria-label="Chat history"
            >
              <Bars3Icon className="h-5 w-5" />
            </motion.button>

            {/* File upload */}
            <FileUpload onUpload={handleFileUpload} disabled={isTyping} />

            {/* Chat input (flex-1) */}
            <div className="flex-1">
              <ChatInput onSend={send} disabled={isTyping} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
