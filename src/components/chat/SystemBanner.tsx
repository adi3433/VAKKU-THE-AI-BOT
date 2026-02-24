/**
 * SystemBanner — Citations & Source Attribution Banner
 * ─────────────────────────────────────────────────────
 * Displayed at the top of chat to show active context sources.
 *
 * Motion spec:
 *   - Slide down on mount (0.3s ease-out)
 *   - Fade + collapse on dismiss (0.2s)
 */
'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  XMarkIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline';
import { useLocale } from '@/hooks/useLocale';

interface SystemBannerProps {
  visible: boolean;
  onDismiss: () => void;
}

export function SystemBanner({ visible, onDismiss }: SystemBannerProps) {
  const { locale } = useLocale();

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, height: 0, y: -10 }}
          animate={{ opacity: 1, height: 'auto', y: 0 }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.3, ease: [0, 0, 0.2, 1] }}
          className="overflow-hidden border-b border-[var(--color-primary-100)] bg-[var(--color-primary-50)]"
        >
          <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
            <ShieldCheckIcon className="h-5 w-5 shrink-0 text-[var(--color-primary-500)]" />
            <div className="flex-1 text-sm text-[var(--color-primary-700)]">
              {locale === 'ml' ? (
                <span className="font-ml">
                  ഞാൻ വാക്ക്, കോട്ടയം ജില്ലയിലെ നിഷ്പക്ഷ വോട്ടർ വിവര സഹായിയാണ്.
                  ഉത്തരങ്ങൾ ഔദ്യോഗിക ഉറവിടങ്ങളിൽ നിന്നാണ്, രാഷ്ട്രീയ ഉപദേശങ്ങൾ നൽകില്ല.
                </span>
              ) : (
                <span>
                  I&apos;m Vaakku, an impartial voter information assistant for Kottayam district.
                  Answers are sourced from official data — no political endorsements.
                </span>
              )}
            </div>
            <button
              onClick={onDismiss}
              aria-label="Dismiss banner"
              className="shrink-0 rounded-lg p-1 text-[var(--color-primary-400)] transition-colors hover:bg-[var(--color-primary-100)] hover:text-[var(--color-primary-600)]"
            >
              <XMarkIcon className="h-4 w-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
