/**
 * Header — V4 Top bar with logo, locale toggle, dark mode, nav
 */
'use client';

import React from 'react';
import { motion } from 'framer-motion';
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
  const darkMode = useVaakkuStore((s) => s.darkMode);

  return (
    <motion.header
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0, 0, 0.2, 1] }}
      className="sticky top-0 z-20 border-b border-[var(--border-primary)] bg-[var(--surface-primary)]/80 backdrop-blur-xl"
    >
      <div className="mx-auto flex h-14 items-center justify-between px-4">
        {/* Left: Logo */}
        <Link href="/" className="flex items-center gap-2">
          <motion.div
            animate={{ y: [0, -2, 0] }}
            transition={{ duration: 2.5, ease: 'easeInOut', repeat: Infinity }}
            className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--color-primary-500)] shadow-sm"
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
        <nav className="hidden items-center gap-1 md:flex">
          {[
            { href: '/chat', label: locale === 'ml' ? 'ചാറ്റ്' : 'Chat' },
            { href: '/booth', label: locale === 'ml' ? 'ബൂത്ത്' : 'Booth' },
            { href: '/report', label: locale === 'ml' ? 'റിപ്പോർട്ട്' : 'Report' },
            { href: '/faq', label: locale === 'ml' ? 'FAQ' : 'FAQ' },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-tertiary)] hover:text-[var(--text-primary)]"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Right: Dark mode + Locale + Settings */}
        <div className="flex items-center gap-1.5">
          {/* Dark mode toggle */}
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={toggleDarkMode}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-tertiary)] transition-colors hover:bg-[var(--surface-tertiary)] hover:text-[var(--text-secondary)]"
            aria-label={darkMode ? 'Light mode' : 'Dark mode'}
          >
            {darkMode ? <SunIcon className="h-4.5 w-4.5" /> : <MoonIcon className="h-4.5 w-4.5" />}
          </motion.button>

          {/* Locale toggle */}
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={toggle}
            className="flex items-center gap-1 rounded-lg border border-[var(--border-primary)] px-2.5 py-1 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-tertiary)]"
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

          <Link
            href="/settings"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-tertiary)] transition-colors hover:bg-[var(--surface-tertiary)] hover:text-[var(--text-secondary)]"
            aria-label={t.settings}
          >
            <Cog6ToothIcon className="h-4.5 w-4.5" />
          </Link>
        </div>
      </div>
    </motion.header>
  );
}
