/**
 * useKeyboardShortcuts — V4 Global Keyboard Shortcuts
 * ────────────────────────────────────────────────────
 * Ctrl+Shift+O  → New chat
 * Shift+Esc     → Focus input
 * Ctrl+/        → Toggle shortcut help
 * Ctrl+Shift+L  → Toggle dark mode
 * Ctrl+Shift+S  → Toggle sidebar
 */
'use client';

import { useEffect, useCallback } from 'react';
import { useVaakkuStore } from '@/lib/store';

interface ShortcutHandlers {
  onNewChat?: () => void;
  onFocusInput?: () => void;
}

export function useKeyboardShortcuts(handlers: ShortcutHandlers = {}) {
  const toggleDarkMode = useVaakkuStore((s) => s.toggleDarkMode);
  const toggleSidebar = useVaakkuStore((s) => s.toggleSidebar);
  const setShortcutHelpOpen = useVaakkuStore((s) => s.setShortcutHelpOpen);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;
      const shift = e.shiftKey;

      // Ctrl+Shift+O → New chat
      if (ctrl && shift && e.key === 'O') {
        e.preventDefault();
        handlers.onNewChat?.();
        return;
      }

      // Shift+Esc → Focus input
      if (shift && e.key === 'Escape') {
        e.preventDefault();
        handlers.onFocusInput?.();
        return;
      }

      // Ctrl+/ → Toggle shortcut help
      if (ctrl && e.key === '/') {
        e.preventDefault();
        const current = useVaakkuStore.getState().shortcutHelpOpen;
        setShortcutHelpOpen(!current);
        return;
      }

      // Ctrl+Shift+L → Toggle dark mode
      if (ctrl && shift && e.key === 'L') {
        e.preventDefault();
        toggleDarkMode();
        return;
      }

      // Ctrl+Shift+S → Toggle sidebar
      if (ctrl && shift && e.key === 'S') {
        e.preventDefault();
        toggleSidebar();
        return;
      }

      // Esc → Close shortcut help if open
      if (e.key === 'Escape' && !shift && !ctrl) {
        const isOpen = useVaakkuStore.getState().shortcutHelpOpen;
        if (isOpen) {
          e.preventDefault();
          setShortcutHelpOpen(false);
          return;
        }
      }
    },
    [handlers, toggleDarkMode, toggleSidebar, setShortcutHelpOpen]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}

/** Keyboard shortcut definitions for display */
export const SHORTCUTS = [
  { keys: ['Ctrl', 'Shift', 'O'], label: 'New Chat', labelMl: 'പുതിയ ചാറ്റ്' },
  { keys: ['Shift', 'Esc'], label: 'Focus Input', labelMl: 'ഇൻപുട്ട് ഫോക്കസ്' },
  { keys: ['Ctrl', '/'], label: 'Shortcut Help', labelMl: 'ഷോർട്ട്കട്ട് സഹായം' },
  { keys: ['Ctrl', 'Shift', 'L'], label: 'Toggle Dark Mode', labelMl: 'ഡാർക്ക് മോഡ്' },
  { keys: ['Ctrl', 'Shift', 'S'], label: 'Toggle Sidebar', labelMl: 'സൈഡ്ബാർ' },
  { keys: ['Enter'], label: 'Send Message', labelMl: 'സന്ദേശം അയയ്ക്കുക' },
  { keys: ['Shift', 'Enter'], label: 'New Line', labelMl: 'പുതിയ വരി' },
] as const;
