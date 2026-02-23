/**
 * MessageList — Chat Message Bubbles with Language Toggle
 * ────────────────────────────────────────────────────────
 * Motion spec:
 *   - Each bubble: messageBubble variant (spring stiffness 300, damping 30)
 *   - Container: staggerContainer (stagger 0.08s, delay 0.1s)
 *   - Confidence bar: width animation (0.5s ease-out)
 *   - Source cards: scaleIn (0.2s)
 *   - Auto-scroll: smooth scroll to bottom on new message
 */
'use client';

import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  ShieldCheckIcon,
  ExclamationTriangleIcon,
  LinkIcon,
  UserCircleIcon,
} from '@heroicons/react/24/outline';
import type { ChatMessage, ChatSource } from '@/types';
import { useLocale } from '@/hooks/useLocale';

interface MessageListProps {
  messages: ChatMessage[];
  isTyping: boolean;
}

// ── Animation Variants ──
const bubbleVariants = {
  hidden: { opacity: 0, y: 10, scale: 0.97 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: 'spring' as const, stiffness: 300, damping: 30 },
  },
};

export function MessageList({ messages, isTyping }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const { locale, t } = useLocale();

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6">
      <div className="mx-auto max-w-3xl space-y-4">
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} locale={locale} />
        ))}

        {/* Typing indicator */}
        {isTyping && (
          <motion.div
            initial="hidden"
            animate="visible"
            variants={bubbleVariants}
            className="flex items-start gap-3"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-primary-100)]">
              <ShieldCheckIcon className="h-4 w-4 text-[var(--color-primary-600)]" />
            </div>
            <div className="rounded-2xl rounded-tl-sm bg-white px-4 py-3 shadow-sm border border-[var(--color-neutral-100)]">
              <TypingDots />
            </div>
          </motion.div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}

// ── Single Message Bubble ──
function MessageBubble({ message, locale }: { message: ChatMessage; locale: string }) {
  const isUser = message.role === 'user';
  const isMl = locale === 'ml';

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={bubbleVariants}
      className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : ''}`}
    >
      {/* Avatar */}
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
          isUser
            ? 'bg-[var(--color-accent-100)]'
            : 'bg-[var(--color-primary-100)]'
        }`}
      >
        {isUser ? (
          <UserCircleIcon className="h-5 w-5 text-[var(--color-accent-700)]" />
        ) : (
          <ShieldCheckIcon className="h-4 w-4 text-[var(--color-primary-600)]" />
        )}
      </div>

      {/* Bubble content */}
      <div
        className={`max-w-[80%] space-y-2 ${isUser ? 'items-end' : 'items-start'}`}
      >
        {/* Message text */}
        <div
          className={`
            rounded-2xl px-4 py-3 shadow-sm
            ${isUser
              ? 'rounded-tr-sm bg-[var(--color-primary-500)] text-white'
              : 'rounded-tl-sm bg-white border border-[var(--color-neutral-100)] text-[var(--color-neutral-800)]'
            }
            ${isMl ? 'font-ml' : ''}
          `}
        >
          <p className="whitespace-pre-wrap text-sm leading-relaxed">
            {message.content}
          </p>
        </div>

        {/* Confidence + Sources (assistant only) */}
        {!isUser && message.confidence !== undefined && (
          <ConfidenceBar confidence={message.confidence} />
        )}

        {!isUser && message.sources && message.sources.length > 0 && (
          <SourceCards sources={message.sources} />
        )}

        {/* Escalation banner */}
        {!isUser && message.escalate && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2 }}
            className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700"
          >
            <ExclamationTriangleIcon className="h-4 w-4" />
            {locale === 'ml'
              ? 'ഈ ഉത്തരത്തിന് മാനുഷിക പരിശോധന ആവശ്യമായേക്കാം'
              : 'This answer may need human verification'}
          </motion.div>
        )}

        {/* Actionable suggestions */}
        {!isUser && message.actionable && message.actionable.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {message.actionable.map((action) => (
              <motion.button
                key={action.id}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="rounded-lg border border-[var(--color-primary-200)] bg-[var(--color-primary-50)] px-3 py-1.5 text-xs font-medium text-[var(--color-primary-700)] transition-colors hover:bg-[var(--color-primary-100)]"
              >
                {locale === 'ml' && action.labelMl ? action.labelMl : action.label}
              </motion.button>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ── Confidence Bar ──
function ConfidenceBar({ confidence }: { confidence: number }) {
  const percent = Math.round(confidence * 100);
  const color =
    confidence >= 0.8
      ? 'bg-emerald-500'
      : confidence >= 0.6
        ? 'bg-amber-400'
        : 'bg-red-400';

  return (
    <div className="flex items-center gap-2 text-xs text-[var(--color-neutral-400)]">
      <span>Confidence:</span>
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-[var(--color-neutral-100)]">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          transition={{ duration: 0.5, ease: [0, 0, 0.2, 1] }}
          className={`h-full rounded-full ${color}`}
        />
      </div>
      <span>{percent}%</span>
    </div>
  );
}

// ── Source Cards ──
function SourceCards({ sources }: { sources: ChatSource[] }) {
  return (
    <div className="space-y-1">
      {sources.slice(0, 3).map((source, i) => (
        <motion.a
          key={i}
          href={source.url}
          target="_blank"
          rel="noopener noreferrer"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.2, delay: i * 0.05 }}
          className="flex items-center gap-2 rounded-lg border border-[var(--color-neutral-100)] bg-[var(--color-neutral-50)] px-3 py-2 text-xs text-[var(--color-neutral-600)] transition-colors hover:bg-white hover:shadow-sm"
        >
          <LinkIcon className="h-3.5 w-3.5 shrink-0 text-[var(--color-primary-400)]" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{source.title}</p>
            <p className="truncate text-[var(--color-neutral-400)]">
              {source.excerpt}
            </p>
          </div>
        </motion.a>
      ))}
    </div>
  );
}

// ── Typing Dots ──
function TypingDots() {
  return (
    <div className="flex items-center gap-1">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }}
          className="inline-block h-2 w-2 rounded-full bg-[var(--color-neutral-300)]"
        />
      ))}
    </div>
  );
}
