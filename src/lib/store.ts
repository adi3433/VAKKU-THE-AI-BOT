/**
 * Vaakku — Zustand Store V4
 * ──────────────────────────
 * Global client state: locale, session, messages, UI flags,
 * memory preferences, chat history sidebar, uploads, dark mode,
 * incognito, custom instructions, keyboard shortcuts.
 */
import { create } from 'zustand';
import { v4 as uuid } from 'uuid';
import type { ChatMessage, Locale, ActionItem, ConversationListItem } from '@/types';

interface VaakkuState {
  // ── Locale ──
  locale: Locale;
  setLocale: (l: Locale) => void;

  // ── Session ──
  sessionId: string;
  userId: string;
  resetSession: () => void;

  // ── Chat ──
  messages: ChatMessage[];
  isTyping: boolean;
  addMessage: (msg: ChatMessage) => void;
  updateMessage: (id: string, content: string) => void;
  removeMessage: (id: string) => void;
  setMessages: (msgs: ChatMessage[]) => void;
  clearMessages: () => void;
  setTyping: (v: boolean) => void;

  // ── Quick Actions ──
  quickActions: ActionItem[];
  setQuickActions: (actions: ActionItem[]) => void;

  // ── Chat History Sidebar ──
  conversations: ConversationListItem[];
  setConversations: (c: ConversationListItem[]) => void;
  activeConversationId: string | null;
  setActiveConversationId: (id: string | null) => void;
  historySidebarOpen: boolean;
  toggleHistorySidebar: () => void;
  setHistorySidebarOpen: (v: boolean) => void;

  // ── Memory ──
  memoryEnabled: boolean;
  setMemoryEnabled: (v: boolean) => void;
  memoryConsentGiven: boolean;
  setMemoryConsentGiven: (v: boolean) => void;

  // ── Incognito ──
  incognitoMode: boolean;
  setIncognitoMode: (v: boolean) => void;

  // ── Upload ──
  pendingUpload: PendingUpload | null;
  setPendingUpload: (u: PendingUpload | null) => void;
  isUploading: boolean;
  setIsUploading: (v: boolean) => void;

  // ── UI ──
  sidebarOpen: boolean;
  setSidebarOpen: (v: boolean) => void;
  toggleSidebar: () => void;
  darkMode: boolean;
  setDarkMode: (v: boolean) => void;
  toggleDarkMode: () => void;
  motionEnabled: boolean;
  setMotionEnabled: (v: boolean) => void;
  accessibilityMode: boolean;
  setAccessibilityMode: (v: boolean) => void;
  shortcutHelpOpen: boolean;
  setShortcutHelpOpen: (v: boolean) => void;
}

interface PendingUpload {
  type: 'image' | 'document' | 'audio';
  name: string;
  base64: string;
  mimeType: string;
  size: number;
  preview?: string;
}

// Generate or retrieve persistent userId from localStorage
function getPersistentUserId(): string {
  if (typeof window === 'undefined') return uuid();
  const stored = localStorage.getItem('vaakku_userId');
  if (stored) return stored;
  const newId = uuid();
  localStorage.setItem('vaakku_userId', newId);
  return newId;
}

// Retrieve persisted dark mode preference
function getPersistedDarkMode(): boolean {
  if (typeof window === 'undefined') return false;
  const stored = localStorage.getItem('vaakku_darkMode');
  if (stored !== null) return stored === 'true';
  return window.matchMedia?.('(prefers-color-scheme: dark)')?.matches ?? false;
}

// Retrieve persisted sidebar state
function getPersistedSidebar(): boolean {
  if (typeof window === 'undefined') return true;
  const stored = localStorage.getItem('vaakku_sidebarOpen');
  return stored !== null ? stored === 'true' : true;
}

export const useVaakkuStore = create<VaakkuState>((set) => ({
  // Locale
  locale: 'en',
  setLocale: (locale) => set({ locale }),

  // Session
  sessionId: uuid(),
  userId: typeof window !== 'undefined' ? getPersistentUserId() : uuid(),
  resetSession: () => set({ sessionId: uuid(), messages: [], activeConversationId: null }),

  // Chat
  messages: [],
  isTyping: false,
  addMessage: (msg) =>
    set((state) => ({ messages: [...state.messages, msg] })),
  updateMessage: (id, content) =>
    set((state) => ({
      messages: state.messages.map((m) => (m.id === id ? { ...m, content } : m)),
    })),
  removeMessage: (id) =>
    set((state) => ({
      messages: state.messages.filter((m) => m.id !== id),
    })),
  setMessages: (messages) => set({ messages }),
  clearMessages: () => set({ messages: [] }),
  setTyping: (isTyping) => set({ isTyping }),

  // Quick Actions
  quickActions: [
    {
      id: 'check_epic',
      label: 'Check Registration',
      labelMl: 'രജിസ്ട്രേഷൻ പരിശോധിക്കുക',
      icon: 'IdentificationIcon',
      action: 'check_epic',
    },
    {
      id: 'locate_booth',
      label: 'Find Polling Booth',
      labelMl: 'പോളിംഗ് ബൂത്ത് കണ്ടെത്തുക',
      icon: 'MapPinIcon',
      action: 'locate_booth',
    },
    {
      id: 'report_violation',
      label: 'Report Violation',
      labelMl: 'ലംഘനം റിപ്പോർട്ട് ചെയ്യുക',
      icon: 'ExclamationTriangleIcon',
      action: 'report_violation',
    },
    {
      id: 'faq',
      label: 'FAQ',
      labelMl: 'പൊതു ചോദ്യങ്ങൾ',
      icon: 'QuestionMarkCircleIcon',
      action: 'faq',
    },
  ],
  setQuickActions: (quickActions) => set({ quickActions }),

  // Chat History Sidebar
  conversations: [],
  setConversations: (conversations) => set({ conversations }),
  activeConversationId: null,
  setActiveConversationId: (id) => set({ activeConversationId: id }),
  historySidebarOpen: false,
  toggleHistorySidebar: () => set((s) => ({ historySidebarOpen: !s.historySidebarOpen })),
  setHistorySidebarOpen: (v) => set({ historySidebarOpen: v }),

  // Memory
  memoryEnabled: false,
  setMemoryEnabled: (memoryEnabled) => set({ memoryEnabled }),
  memoryConsentGiven: false,
  setMemoryConsentGiven: (memoryConsentGiven) => set({ memoryConsentGiven }),

  // Incognito
  incognitoMode: false,
  setIncognitoMode: (incognitoMode) => set({ incognitoMode }),

  // Upload
  pendingUpload: null,
  setPendingUpload: (pendingUpload) => set({ pendingUpload }),
  isUploading: false,
  setIsUploading: (isUploading) => set({ isUploading }),

  // UI
  sidebarOpen: typeof window !== 'undefined' ? getPersistedSidebar() : true,
  setSidebarOpen: (sidebarOpen) => {
    if (typeof window !== 'undefined') localStorage.setItem('vaakku_sidebarOpen', String(sidebarOpen));
    set({ sidebarOpen });
  },
  toggleSidebar: () => set((s) => {
    const next = !s.sidebarOpen;
    if (typeof window !== 'undefined') localStorage.setItem('vaakku_sidebarOpen', String(next));
    return { sidebarOpen: next };
  }),
  darkMode: typeof window !== 'undefined' ? getPersistedDarkMode() : false,
  setDarkMode: (darkMode) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('vaakku_darkMode', String(darkMode));
      document.documentElement.classList.toggle('dark', darkMode);
    }
    set({ darkMode });
  },
  toggleDarkMode: () => set((s) => {
    const next = !s.darkMode;
    if (typeof window !== 'undefined') {
      localStorage.setItem('vaakku_darkMode', String(next));
      document.documentElement.classList.toggle('dark', next);
    }
    return { darkMode: next };
  }),
  motionEnabled: true,
  setMotionEnabled: (motionEnabled) => set({ motionEnabled }),
  accessibilityMode: false,
  setAccessibilityMode: (accessibilityMode) => set({ accessibilityMode }),
  shortcutHelpOpen: false,
  setShortcutHelpOpen: (shortcutHelpOpen) => set({ shortcutHelpOpen }),
}));
