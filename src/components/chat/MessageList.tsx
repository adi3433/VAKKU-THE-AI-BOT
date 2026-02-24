/**
 * MessageList — V4 Chat Messages with Actions
 * Copy, markdown rendering, map buttons, dark mode
 */
'use client';

import React, { useEffect, useRef, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import {
  ShieldCheckIcon,
  ExclamationTriangleIcon,
  LinkIcon,
  UserCircleIcon,
  MapPinIcon,
  ArrowTopRightOnSquareIcon,
  ClipboardIcon,
  CheckIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import type { ChatMessage, ChatSource } from '@/types';
import { useLocale } from '@/hooks/useLocale';

interface MessageListProps {
  messages: ChatMessage[];
  isTyping: boolean;
  onRegenerate?: (messageId: string) => void;
  onAction?: (message: string) => void;
}

const bubbleVariants = {
  hidden: { opacity: 0, y: 10, scale: 0.97 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: 'spring' as const, stiffness: 300, damping: 30 },
  },
};

export function MessageList({ messages, isTyping, onRegenerate, onAction }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const { locale } = useLocale();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6">
      <div className="mx-auto max-w-3xl space-y-4">
        {messages.map((msg, idx) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            locale={locale}
            isLast={idx === messages.length - 1 && msg.role === 'assistant'}
            onRegenerate={onRegenerate}
            onAction={onAction}
          />
        ))}

        {isTyping && (
          <motion.div
            initial="hidden"
            animate="visible"
            variants={bubbleVariants}
            className="flex items-start gap-3"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-primary-500)]/10">
              <ShieldCheckIcon className="h-4 w-4 text-[var(--color-primary-500)]" />
            </div>
            <div className="rounded-2xl rounded-tl-sm bg-[var(--surface-primary)] px-4 py-3 shadow-sm border border-[var(--border-primary)]">
              <TypingDots />
            </div>
          </motion.div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}

// ── Helpers ──
function extractMapLinks(text: string): { label: string; url: string }[] {
  const links: { label: string; url: string }[] = [];
  const mdLinkRe = /\[([^\]]+)\]\((https:\/\/(?:www\.)?google\.com\/maps\/[^)]+)\)/gi;
  let m;
  while ((m = mdLinkRe.exec(text)) !== null) {
    links.push({ label: m[1], url: m[2] });
  }
  const bareRe = /(?<!\()https:\/\/(?:www\.)?google\.com\/maps\/dir\/[^\s)]+/gi;
  while ((m = bareRe.exec(text)) !== null) {
    if (!links.some((l) => l.url === m![0])) {
      links.push({ label: 'Get Directions', url: m[0] });
    }
  }
  return links;
}

function stripMapLinks(text: string): string {
  let cleaned = text.replace(/\[([^\]]+)\]\((https:\/\/(?:www\.)?google\.com\/maps\/[^)]+)\)/gi, '');
  cleaned = cleaned.replace(/https:\/\/(?:www\.)?google\.com\/maps\/dir\/[^\s)]+/gi, '');
  cleaned = cleaned.replace(/^[\s🔗📍]*$/gm, '');
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
  return cleaned.trim();
}

// ── Message Bubble ──
function MessageBubble({
  message,
  locale,
  isLast,
  onRegenerate,
  onAction,
}: {
  message: ChatMessage;
  locale: string;
  isLast: boolean;
  onRegenerate?: (messageId: string) => void;
  onAction?: (message: string) => void;
}) {
  const isUser = message.role === 'user';
  const isMl = locale === 'ml';
  const [copied, setCopied] = useState(false);

  const mapLinks = useMemo(
    () => (!isUser ? extractMapLinks(message.content) : []),
    [isUser, message.content]
  );

  const displayContent = useMemo(
    () => (!isUser && mapLinks.length > 0 ? stripMapLinks(message.content) : message.content),
    [isUser, mapLinks, message.content]
  );

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  };

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={bubbleVariants}
      className={`group flex items-start gap-3 ${isUser ? 'flex-row-reverse' : ''}`}
    >
      {/* Avatar */}
      <div
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${isUser
            ? 'bg-[var(--color-accent-500)]/10'
            : 'bg-[var(--color-primary-500)]/10'
          }`}
      >
        {isUser ? (
          <UserCircleIcon className="h-4 w-4 text-[var(--color-accent-600)]" />
        ) : (
          <ShieldCheckIcon className="h-3.5 w-3.5 text-[var(--color-primary-500)]" />
        )}
      </div>

      {/* Content */}
      <div className={`max-w-[80%] space-y-1.5 ${isUser ? 'items-end' : 'items-start'}`}>
        {/* Bubble */}
        <div
          className={`
            rounded-2xl px-4 py-3 text-sm leading-relaxed
            ${isUser
              ? 'rounded-tr-sm bg-[var(--color-primary-500)] text-white'
              : 'rounded-tl-sm bg-[var(--surface-primary)] border border-[var(--border-primary)] text-[var(--text-primary)] shadow-sm'
            }
            ${isMl ? 'font-ml' : ''}
          `}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap">{displayContent}</p>
          ) : (
            <div className="prose prose-sm max-w-none text-[var(--text-primary)] prose-strong:text-[var(--text-primary)] prose-a:text-[var(--color-primary-500)] prose-a:underline">
              <ReactMarkdown
                components={{
                  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                  a: ({ href, children }) => (
                    <a href={href} target="_blank" rel="noopener noreferrer" className="text-[var(--color-primary-500)] underline hover:text-[var(--color-primary-600)]">
                      {children}
                    </a>
                  ),
                  ul: ({ children }) => <ul className="list-disc pl-4 mb-2 space-y-1">{children}</ul>,
                  ol: ({ children }) => <ol className="list-decimal pl-4 mb-2 space-y-1">{children}</ol>,
                  li: ({ children }) => <li className="text-sm">{children}</li>,
                }}
              >
                {displayContent}
              </ReactMarkdown>
            </div>
          )}
        </div>

        {/* Message Actions (assistant only) */}
        {!isUser && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={handleCopy}
              className="flex h-7 items-center gap-1 rounded-md px-2 text-[10px] font-medium text-[var(--text-tertiary)] hover:bg-[var(--surface-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
              aria-label="Copy message"
            >
              {copied ? (
                <>
                  <CheckIcon className="h-3 w-3 text-emerald-500" />
                  <span className="text-emerald-500">Copied</span>
                </>
              ) : (
                <>
                  <ClipboardIcon className="h-3 w-3" />
                  <span>Copy</span>
                </>
              )}
            </button>
            {isLast && onRegenerate && (
              <button
                onClick={() => onRegenerate(message.id)}
                className="flex h-7 items-center gap-1 rounded-md px-2 text-[10px] font-medium text-[var(--text-tertiary)] hover:bg-[var(--surface-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
                aria-label="Regenerate"
              >
                <ArrowPathIcon className="h-3 w-3" />
                <span>Regenerate</span>
              </button>
            )}
          </div>
        )}

        {/* Map Buttons */}
        {!isUser && mapLinks.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-0.5">
            {mapLinks.map((link, i) => (
              <motion.a
                key={i}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: i * 0.05 }}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-100 hover:shadow-sm dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400"
              >
                <MapPinIcon className="h-3.5 w-3.5" />
                <span>{mapLinks.length > 1 ? `Directions (Booth ${i + 1})` : 'Get Directions'}</span>
                <ArrowTopRightOnSquareIcon className="h-3 w-3 opacity-60" />
              </motion.a>
            ))}
          </div>
        )}

        {/* Confidence */}
        {!isUser && message.confidence !== undefined && (
          <ConfidenceBar confidence={message.confidence} />
        )}

        {/* Sources */}
        {!isUser && message.sources && message.sources.length > 0 && (
          <SourceCards sources={message.sources} />
        )}

        {/* Escalation */}
        {!isUser && message.escalate && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2 }}
            className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-400"
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
                onClick={() => onAction?.(locale === 'ml' && action.labelMl ? action.labelMl : action.label)}
                className="rounded-lg border border-[var(--color-primary-500)]/20 bg-[var(--color-primary-500)]/5 px-3 py-1.5 text-xs font-medium text-[var(--color-primary-600)] transition-colors hover:bg-[var(--color-primary-500)]/10 cursor-pointer"
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
    <div className="flex items-center gap-2 text-[10px] text-[var(--text-tertiary)]">
      <span>Confidence:</span>
      <div className="h-1 w-16 overflow-hidden rounded-full bg-[var(--surface-tertiary)]">
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
          className="flex items-center gap-2 rounded-lg border border-[var(--border-primary)] bg-[var(--surface-secondary)] px-3 py-2 text-xs text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-tertiary)] hover:shadow-sm"
        >
          <LinkIcon className="h-3.5 w-3.5 shrink-0 text-[var(--color-primary-400)]" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{source.title}</p>
            <p className="truncate text-[var(--text-tertiary)]">{source.excerpt}</p>
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
          className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--text-tertiary)]"
        />
      ))}
    </div>
  );
}
