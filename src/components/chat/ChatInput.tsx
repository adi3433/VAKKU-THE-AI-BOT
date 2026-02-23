/**
 * ChatInput — V4 Professional Text & Speech Input
 */
'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PaperAirplaneIcon,
  MicrophoneIcon,
  StopIcon,
} from '@heroicons/react/24/solid';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { useLocale } from '@/hooks/useLocale';

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
}

export function ChatInput({ onSend, disabled = false }: ChatInputProps) {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { locale, t } = useLocale();
  const {
    isListening,
    transcript,
    isSupported: speechSupported,
    startListening,
    stopListening,
    resetTranscript,
  } = useSpeechRecognition(locale);

  useEffect(() => {
    if (transcript) setText(transcript);
  }, [transcript]);

  useEffect(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = 'auto';
      ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`;
    }
  }, [text]);

  const handleSend = () => {
    if (!text.trim() || disabled) return;
    onSend(text.trim());
    setText('');
    resetTranscript();
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const toggleMic = () => {
    if (isListening) stopListening();
    else startListening();
  };

  return (
    <div className="w-full">
      <div
        className={`
          flex items-end gap-2 rounded-2xl border bg-[var(--surface-primary)] p-2 shadow-sm
          transition-all duration-200
          ${disabled ? 'opacity-60' : ''}
          focus-within:shadow-[var(--shadow-glow)]
          border-[var(--border-primary)]
        `}
      >
        {/* Speech button */}
        {speechSupported && (
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={toggleMic}
            disabled={disabled}
            aria-label={isListening ? 'Stop recording' : t.voiceInput}
            className={`
              flex h-9 w-9 shrink-0 items-center justify-center rounded-xl
              transition-colors duration-200
              ${isListening
                ? 'bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400'
                : 'text-[var(--text-tertiary)] hover:bg-[var(--surface-tertiary)] hover:text-[var(--text-secondary)]'
              }
            `}
          >
            <AnimatePresence mode="wait">
              {isListening ? (
                <motion.div
                  key="stop"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                >
                  <StopIcon className="h-4 w-4" />
                </motion.div>
              ) : (
                <motion.div
                  key="mic"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                >
                  <MicrophoneIcon className="h-4 w-4" />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.button>
        )}

        {/* Text area */}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t.chatPlaceholder}
          disabled={disabled}
          rows={1}
          className={`
            min-h-[36px] flex-1 resize-none bg-transparent px-2 py-1.5
            text-sm text-[var(--text-primary)] placeholder-[var(--text-tertiary)]
            outline-none
            ${locale === 'ml' ? 'font-ml' : ''}
          `}
          aria-label="Chat message input"
        />

        {/* Send button */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.9 }}
          transition={{ type: 'spring', stiffness: 400, damping: 20 }}
          onClick={handleSend}
          disabled={disabled || !text.trim()}
          aria-label={t.send}
          className={`
            flex h-9 w-9 shrink-0 items-center justify-center rounded-xl
            transition-colors duration-200
            ${text.trim()
              ? 'bg-[var(--color-primary-500)] text-white shadow-sm hover:bg-[var(--color-primary-600)]'
              : 'bg-[var(--surface-tertiary)] text-[var(--text-tertiary)]'
            }
          `}
        >
          <PaperAirplaneIcon className="h-4 w-4" />
        </motion.button>
      </div>

      {/* Recording indicator */}
      <AnimatePresence>
        {isListening && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-2 flex items-center justify-center gap-2 text-xs text-red-500"
          >
            <motion.span
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 0.8, repeat: Infinity }}
              className="inline-block h-2 w-2 rounded-full bg-red-500"
            />
            {locale === 'ml' ? 'ശബ്ദം രേഖപ്പെടുത്തുന്നു...' : 'Recording...'}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
