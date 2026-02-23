/**
 * ShortcutHelp — Keyboard Shortcuts Modal
 */
'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { useVaakkuStore } from '@/lib/store';
import { useLocale } from '@/hooks/useLocale';
import { SHORTCUTS } from '@/hooks/useKeyboardShortcuts';

export function ShortcutHelp() {
  const isOpen = useVaakkuStore((s) => s.shortcutHelpOpen);
  const setOpen = useVaakkuStore((s) => s.setShortcutHelpOpen);
  const { locale } = useLocale();
  const isMl = locale === 'ml';

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.4 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-50 bg-black"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2, ease: [0, 0, 0.2, 1] }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div className="w-full max-w-md rounded-2xl border border-[var(--border-primary)] bg-[var(--surface-primary)] p-6 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <h2 className={`text-lg font-bold text-[var(--text-primary)] ${isMl ? 'font-ml' : ''}`}>
                  {isMl ? 'കീബോർഡ് ഷോർട്ട്കട്ടുകൾ' : 'Keyboard Shortcuts'}
                </h2>
                <button
                  onClick={() => setOpen(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-tertiary)] hover:bg-[var(--surface-tertiary)] transition-colors"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-2">
                {SHORTCUTS.map((s, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between py-1.5"
                  >
                    <span className={`text-sm text-[var(--text-secondary)] ${isMl ? 'font-ml' : ''}`}>
                      {isMl ? s.labelMl : s.label}
                    </span>
                    <div className="flex items-center gap-1">
                      {s.keys.map((key) => (
                        <kbd
                          key={key}
                          className="rounded-md border border-[var(--border-primary)] bg-[var(--surface-secondary)] px-2 py-0.5 text-xs font-mono text-[var(--text-secondary)] shadow-sm"
                        >
                          {key}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <p className="mt-4 text-center text-[10px] text-[var(--text-tertiary)]">
                {isMl ? 'Ctrl+/ ഉപയോഗിച്ച് ഈ ഡയലോഗ് ടോഗിൾ ചെയ്യുക' : 'Press Ctrl+/ to toggle this dialog'}
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
