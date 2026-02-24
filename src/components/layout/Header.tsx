/**
 * Header — V4 Top bar with logo, locale toggle, dark mode, nav
 */
'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import {
  LanguageIcon,
  Cog6ToothIcon,
  SunIcon,
  MoonIcon,
} from '@heroicons/react/24/outline';
import { useLocale } from '@/hooks/useLocale';
import { useVaakkuStore } from '@/lib/store';

export function Header() {
  const { locale, toggle, t } = useLocale();
  const toggleDarkMode = useVaakkuStore((s) => s.toggleDarkMode);
  const setDarkMode = useVaakkuStore((s) => s.setDarkMode);
  const darkMode = useVaakkuStore((s) => s.darkMode);
  const [mounted, setMounted] = useState(false);

  // Sync persisted dark mode preference after hydration
  useEffect(() => {
    const stored = localStorage.getItem('vaakku_darkMode');
    if (stored !== null) {
      setDarkMode(stored === 'true');
    } else if (window.matchMedia?.('(prefers-color-scheme: dark)')?.matches) {
      setDarkMode(true);
    }
    setMounted(true);
  }, [setDarkMode]);

  const isDark = mounted && darkMode;

  return (
    <motion.header
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0, 0, 0.2, 1] }}
      className="sticky top-0 z-20 border-b border-[var(--border-primary)] bg-[var(--surface-primary)]/80 backdrop-blur-xl"
    >
      <div className="mx-auto flex h-14 items-center justify-between px-4">
        {/* Left: Logo */}
        <Link href="/" className="flex items-center gap-2 group">
          <motion.div
            animate={{ y: [0, -2, 0] }}
            transition={{ duration: 2.5, ease: 'easeInOut', repeat: Infinity }}
            className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--color-primary-500)] shadow-sm transition-shadow duration-300 group-hover:shadow-md group-hover:shadow-[var(--color-primary-500)]/30"
          >
            <span className="text-base font-bold text-white">V</span>
          </motion.div>
          <div className="hidden sm:block">
            <h1 className="text-base font-bold text-[var(--text-primary)] leading-tight">
              {t.appName}
            </h1>
          </div>
        </Link>

        {/* Center: Nav (desktop) */}
        <nav className="hidden items-center gap-0.5 md:flex">
          {[
            { href: '/chat', label: locale === 'ml' ? 'ചാറ്റ്' : 'Chat' },
            { href: '/booth', label: locale === 'ml' ? 'ബൂത്ത്' : 'Booth' },
            { href: '/report', label: locale === 'ml' ? 'റിപ്പോർട്ട്' : 'Report' },
            { href: '/faq', label: locale === 'ml' ? 'FAQ' : 'FAQ' },
          ].map((item) => (
            <motion.div key={item.href} whileHover="hover" className="relative">
              <Link
                href={item.href}
                className="relative block rounded-lg px-3.5 py-1.5 text-sm font-medium text-[var(--text-secondary)] transition-colors duration-200 hover:text-[var(--color-primary-500)] hover:bg-[var(--color-primary-500)]/5"
              >
                {item.label}
              </Link>
              <motion.div
                className="absolute bottom-0 left-1/2 h-0.5 rounded-full bg-[var(--color-primary-500)]"
                initial={{ width: 0, x: '-50%' }}
                variants={{
                  hover: { width: '60%', x: '-50%' },
                }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              />
            </motion.div>
          ))}
        </nav>

        {/* Right: Dark mode + Locale + Settings */}
        <div className="flex items-center gap-2">
          {/* Dark mode toggle — pill switch */}
          <motion.button
            onClick={toggleDarkMode}
            className={`relative flex h-8 w-14 items-center rounded-full p-1 transition-colors duration-300 ${isDark
                ? 'bg-[var(--color-primary-500)] border border-[var(--color-primary-400)]'
                : 'bg-[var(--color-primary-100)] border border-[var(--color-primary-200)]'
              }`}
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            whileTap={{ scale: 0.95 }}
          >
            <motion.div
              className={`flex h-6 w-6 items-center justify-center rounded-full shadow-sm ${isDark
                  ? 'bg-white text-[var(--color-primary-500)]'
                  : 'bg-white text-[var(--color-primary-500)]'
                }`}
              animate={{ x: isDark ? 22 : 0 }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            >
              <AnimatePresence mode="wait">
                <motion.div
                  key={isDark ? 'moon' : 'sun'}
                  initial={{ rotate: -90, opacity: 0 }}
                  animate={{ rotate: 0, opacity: 1 }}
                  exit={{ rotate: 90, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  {isDark ? (
                    <MoonIcon className="h-3.5 w-3.5" />
                  ) : (
                    <SunIcon className="h-3.5 w-3.5" />
                  )}
                </motion.div>
              </AnimatePresence>
            </motion.div>
          </motion.button>

          {/* Locale toggle */}
          <motion.button
            whileTap={{ scale: 0.95 }}
            whileHover={{ scale: 1.02 }}
            onClick={toggle}
            className="flex items-center gap-1.5 rounded-lg border border-[var(--border-primary)] px-2.5 py-1.5 text-sm font-medium text-[var(--text-secondary)] transition-all duration-200 hover:bg-[var(--color-primary-500)]/5 hover:border-[var(--color-primary-500)]/30 hover:text-[var(--color-primary-600)]"
            aria-label={`Switch to ${locale === 'en' ? 'Malayalam' : 'English'}`}
          >
            <LanguageIcon className="h-3.5 w-3.5" />
            <motion.span
              key={locale}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="text-xs"
            >
              {locale === 'en' ? 'മല' : 'EN'}
            </motion.span>
          </motion.button>

          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Link
              href="/settings"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-tertiary)] transition-all duration-200 hover:bg-[var(--color-primary-500)]/5 hover:text-[var(--color-primary-500)]"
              aria-label={t.settings}
            >
              <Cog6ToothIcon className="h-4.5 w-4.5" />
            </Link>
          </motion.div>
        </div>
      </div>
    </motion.header>
  );
}
