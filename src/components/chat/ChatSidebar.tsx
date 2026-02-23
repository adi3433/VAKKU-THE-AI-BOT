/**
 * ChatSidebar — V4 Persistent Left Sidebar
 * ─────────────────────────────────────────
 * - Always visible on desktop (collapsible)
 * - Slide-out overlay on mobile
 * - New chat, search, conversation list
 * - Incognito toggle at bottom
 */
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  XMarkIcon,
  MagnifyingGlassIcon,
  StarIcon as StarSolidIcon,
  PlusIcon,
  ChatBubbleLeftRightIcon,
  EyeSlashIcon,
} from '@heroicons/react/24/solid';
import {
  StarIcon as StarOutlineIcon,
  MapPinIcon,
  ChevronDoubleLeftIcon,
  ChevronDoubleRightIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import { useVaakkuStore } from '@/lib/store';
import { useLocale } from '@/hooks/useLocale';
import type { ConversationListItem } from '@/types';

interface ChatSidebarProps {
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  onToggleStar?: (id: string) => void;
  onTogglePin?: (id: string) => void;
  onDeleteConversation?: (id: string) => void;
}

export function ChatSidebar({ onSelectConversation, onNewConversation, onToggleStar, onTogglePin, onDeleteConversation }: ChatSidebarProps) {
  const {
    sidebarOpen,
    toggleSidebar,
    conversations,
    setConversations,
    activeConversationId,
    incognitoMode,
    setIncognitoMode,
  } = useVaakkuStore();
  const { locale } = useLocale();
  const isMl = locale === 'ml';

  const [searchQuery, setSearchQuery] = useState('');
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Filter & sort
  const filtered = conversations.filter((c) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return c.title.toLowerCase().includes(q) || (c.summary?.toLowerCase().includes(q) ?? false);
  });

  const sorted = [...filtered].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });

  // Group by date
  const grouped = groupByDate(sorted, isMl);

  const sidebarContent = (
    <div className="flex h-full flex-col bg-[var(--surface-secondary)] border-r border-[var(--border-primary)]">
      {/* Top: New Chat */}
      <div className="flex items-center gap-2 p-3">
        <button
          onClick={() => {
            onNewConversation();
            if (isMobile) toggleSidebar();
          }}
          className="flex flex-1 items-center gap-2 rounded-lg border border-[var(--border-primary)] bg-[var(--surface-primary)] px-3 py-2 text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-tertiary)]"
        >
          <PlusIcon className="h-4 w-4" />
          <span className={isMl ? 'font-ml' : ''}>{isMl ? 'പുതിയ ചാറ്റ്' : 'New Chat'}</span>
        </button>
        {isMobile && (
          <button
            onClick={toggleSidebar}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--text-tertiary)] hover:bg-[var(--surface-tertiary)]"
            aria-label="Close sidebar"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        )}
        {!isMobile && (
          <button
            onClick={toggleSidebar}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--text-tertiary)] hover:bg-[var(--surface-tertiary)]"
            aria-label="Collapse sidebar"
          >
            <ChevronDoubleLeftIcon className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Search */}
      <div className="px-3 pb-2">
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-tertiary)]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={isMl ? 'ചാറ്റുകൾ തിരയുക...' : 'Search chats...'}
            className="w-full rounded-lg border border-[var(--border-secondary)] bg-[var(--surface-primary)] py-1.5 pl-8 pr-3 text-xs text-[var(--text-primary)] placeholder-[var(--text-tertiary)] outline-none focus:border-[var(--color-primary-400)] transition-colors"
          />
        </div>
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto px-2">
        {sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <ChatBubbleLeftRightIcon className="mb-2 h-8 w-8 text-[var(--text-tertiary)] opacity-40" />
            <p className={`text-xs text-[var(--text-tertiary)] ${isMl ? 'font-ml' : ''}`}>
              {searchQuery
                ? (isMl ? 'ഫലങ്ങളൊന്നും ഇല്ല' : 'No results')
                : (isMl ? 'ചാറ്റുകളൊന്നുമില്ല' : 'No chats yet')}
            </p>
          </div>
        ) : (
          <div className="space-y-3 py-1">
            {grouped.map((group) => (
              <div key={group.label}>
                <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
                  {group.label}
                </p>
                <ul className="space-y-0.5">
                  {group.items.map((conv) => (
                    <ConversationItem
                      key={conv.id}
                      conversation={conv}
                      isActive={conv.id === activeConversationId}
                      locale={locale}
                      onSelect={() => {
                        onSelectConversation(conv.id);
                        if (isMobile) toggleSidebar();
                      }}
                      onToggleStar={() => {
                        if (onToggleStar) {
                          onToggleStar(conv.id);
                        } else {
                          setConversations(
                            conversations.map((c) =>
                              c.id === conv.id ? { ...c, starred: !c.starred } : c
                            )
                          );
                        }
                      }}
                      onTogglePin={() => {
                        if (onTogglePin) {
                          onTogglePin(conv.id);
                        } else {
                          setConversations(
                            conversations.map((c) =>
                              c.id === conv.id ? { ...c, pinned: !c.pinned } : c
                            )
                          );
                        }
                      }}
                    />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom: Incognito toggle */}
      <div className="border-t border-[var(--border-primary)] p-3">
        <button
          onClick={() => setIncognitoMode(!incognitoMode)}
          className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
            incognitoMode
              ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
              : 'text-[var(--text-tertiary)] hover:bg-[var(--surface-tertiary)] hover:text-[var(--text-secondary)]'
          }`}
        >
          <EyeSlashIcon className="h-4 w-4" />
          <span className={isMl ? 'font-ml' : ''}>
            {incognitoMode
              ? (isMl ? 'ഇൻകോഗ്നിറ്റോ ഓൺ' : 'Incognito On')
              : (isMl ? 'ഇൻകോഗ്നിറ്റോ' : 'Incognito')}
          </span>
          {incognitoMode && (
            <span className="ml-auto h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
          )}
        </button>
      </div>
    </div>
  );

  // Mobile: overlay
  if (isMobile) {
    return (
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.4 }}
              exit={{ opacity: 0 }}
              onClick={toggleSidebar}
              className="fixed inset-0 z-40 bg-black"
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="fixed inset-y-0 left-0 z-50 w-[280px]"
            >
              {sidebarContent}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    );
  }

  // Desktop: persistent
  return (
    <AnimatePresence initial={false}>
      {sidebarOpen ? (
        <motion.aside
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 280, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
          className="hidden md:flex flex-shrink-0 overflow-hidden"
        >
          <div className="w-[280px]">{sidebarContent}</div>
        </motion.aside>
      ) : (
        <div className="hidden md:flex flex-shrink-0 items-start pt-3 pl-2">
          <button
            onClick={toggleSidebar}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--text-tertiary)] hover:bg-[var(--surface-tertiary)] transition-colors"
            aria-label="Expand sidebar"
          >
            <ChevronDoubleRightIcon className="h-4 w-4" />
          </button>
        </div>
      )}
    </AnimatePresence>
  );
}

// ── ConversationItem ──
function ConversationItem({
  conversation,
  isActive,
  locale,
  onSelect,
  onToggleStar,
  onTogglePin,
}: {
  conversation: ConversationListItem;
  isActive: boolean;
  locale: string;
  onSelect: () => void;
  onToggleStar: () => void;
  onTogglePin: () => void;
}) {
  const isMl = locale === 'ml';

  return (
    <li
      className={`group rounded-lg transition-colors ${
        isActive
          ? 'bg-[var(--color-primary-500)]/10 text-[var(--text-primary)]'
          : 'text-[var(--text-secondary)] hover:bg-[var(--surface-tertiary)]'
      }`}
    >
      <button
        onClick={onSelect}
        className="flex w-full items-center gap-2 px-2.5 py-2 text-left"
      >
        <ChatBubbleLeftRightIcon className="h-4 w-4 shrink-0 opacity-50" />
        <div className="min-w-0 flex-1">
          <p className={`truncate text-sm ${isActive ? 'font-medium' : ''} ${isMl ? 'font-ml' : ''}`}>
            {conversation.title}
          </p>
        </div>
        {conversation.pinned && (
          <MapPinIcon className="h-3 w-3 shrink-0 text-[var(--color-primary-500)]" />
        )}
        {conversation.starred && (
          <StarSolidIcon className="h-3 w-3 shrink-0 text-amber-500" />
        )}
      </button>
    </li>
  );
}

// ── Group by Date ──
function groupByDate(items: ConversationListItem[], isMl: boolean) {
  const groups: { label: string; items: ConversationListItem[] }[] = [];
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const weekAgo = new Date(today.getTime() - 604800000);

  const buckets = {
    today: [] as ConversationListItem[],
    yesterday: [] as ConversationListItem[],
    thisWeek: [] as ConversationListItem[],
    older: [] as ConversationListItem[],
  };

  for (const item of items) {
    const d = new Date(item.updatedAt);
    if (d >= today) buckets.today.push(item);
    else if (d >= yesterday) buckets.yesterday.push(item);
    else if (d >= weekAgo) buckets.thisWeek.push(item);
    else buckets.older.push(item);
  }

  if (buckets.today.length) groups.push({ label: isMl ? 'ഇന്ന്' : 'Today', items: buckets.today });
  if (buckets.yesterday.length) groups.push({ label: isMl ? 'ഇന്നലെ' : 'Yesterday', items: buckets.yesterday });
  if (buckets.thisWeek.length) groups.push({ label: isMl ? 'ഈ ആഴ്ച' : 'This Week', items: buckets.thisWeek });
  if (buckets.older.length) groups.push({ label: isMl ? 'പഴയവ' : 'Older', items: buckets.older });

  return groups;
}
