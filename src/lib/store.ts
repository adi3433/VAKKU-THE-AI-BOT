/**
 * Vaakku — Zustand Store V2.1
 * ────────────────────────────
 * Global client state: locale, session, messages, UI flags,
 * memory preferences, chat history sidebar, uploads.
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
  userId: string; // persistent user ID for memory
  resetSession: () => void;

  // ── Chat ──
  messages: ChatMessage[];
  isTyping: boolean;
  addMessage: (msg: ChatMessage) => void;
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

  // ── Memory ──
  memoryEnabled: boolean;
  setMemoryEnabled: (v: boolean) => void;
  memoryConsentGiven: boolean;
  setMemoryConsentGiven: (v: boolean) => void;

  // ── Upload ──
  pendingUpload: PendingUpload | null;
  setPendingUpload: (u: PendingUpload | null) => void;
  isUploading: boolean;
  setIsUploading: (v: boolean) => void;

  // ── UI ──
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  motionEnabled: boolean;
  setMotionEnabled: (v: boolean) => void;
  accessibilityMode: boolean;
  setAccessibilityMode: (v: boolean) => void;
}

interface PendingUpload {
  type: 'image' | 'document' | 'audio';
  name: string;
  base64: string;
  mimeType: string;
  size: number;
  preview?: string; // data URL for image preview
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

  // Memory
  memoryEnabled: false,
  setMemoryEnabled: (memoryEnabled) => set({ memoryEnabled }),
  memoryConsentGiven: false,
  setMemoryConsentGiven: (memoryConsentGiven) => set({ memoryConsentGiven }),

  // Upload
  pendingUpload: null,
  setPendingUpload: (pendingUpload) => set({ pendingUpload }),
  isUploading: false,
  setIsUploading: (isUploading) => set({ isUploading }),

  // UI
  sidebarOpen: false,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  motionEnabled: true,
  setMotionEnabled: (motionEnabled) => set({ motionEnabled }),
  accessibilityMode: false,
  setAccessibilityMode: (accessibilityMode) => set({ accessibilityMode }),
}));
