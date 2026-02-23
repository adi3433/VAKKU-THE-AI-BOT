/**
 * Header — App top bar with logo, locale toggle, nav
 * ───────────────────────────────────────────────────
 * Motion spec:
 *   - Mount: slideDown 0.3s ease-out
 *   - Logo: subtle float animation (2s, ease-in-out, infinite)
 *   - Locale toggle: spring switch (stiffness 300, damping 30)
 */
'use client';

import React from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  Bars3Icon,
  LanguageIcon,
  Cog6ToothIcon,
} from '@heroicons/react/24/outline';
import { useLocale } from '@/hooks/useLocale';
import { useVaakkuStore } from '@/lib/store';

export function Header() {
  const { locale, toggle, t } = useLocale();
  const toggleSidebar = useVaakkuStore((s) => s.toggleSidebar);

  return (
    <motion.header
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0, 0, 0.2, 1] }}
      className="sticky top-0 z-20 border-b border-[var(--color-neutral-100)] bg-white/80 backdrop-blur-xl"
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        {/* Left: Menu + Logo */}
        <div className="flex items-center gap-3">
          <button
            onClick={toggleSidebar}
            aria-label="Toggle menu"
            className="rounded-lg p-2 text-[var(--color-neutral-500)] transition-colors hover:bg-[var(--color-neutral-100)] lg:hidden"
          >
            <Bars3Icon className="h-5 w-5" />
          </button>

          <Link href="/" className="flex items-center gap-2">
            <motion.div
              animate={{ y: [0, -3, 0] }}
              transition={{ duration: 2, ease: 'easeInOut', repeat: Infinity }}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--color-primary-500)] shadow-sm"
            >
              <span className="text-lg font-bold text-white">V</span>
            </motion.div>
            <div>
              <h1 className="text-lg font-bold text-[var(--color-neutral-900)] leading-tight">
                {t.appName}
              </h1>
              <p className="text-[10px] text-[var(--color-neutral-400)] leading-tight">
                SVEEP Kottayam
              </p>
            </div>
          </Link>
        </div>

        {/* Center: Nav (desktop) */}
        <nav className="hidden items-center gap-1 lg:flex">
          {[
            { href: '/chat', label: locale === 'ml' ? 'ചാറ്റ്' : 'Chat' },
            { href: '/booth', label: locale === 'ml' ? 'ബൂത്ത്' : 'Booth' },
            { href: '/report', label: locale === 'ml' ? 'റിപ്പോർട്ട്' : 'Report' },
            { href: '/faq', label: locale === 'ml' ? 'FAQ' : 'FAQ' },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-[var(--color-neutral-600)] transition-colors hover:bg-[var(--color-neutral-50)] hover:text-[var(--color-neutral-900)]"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Right: Locale toggle + Settings */}
        <div className="flex items-center gap-2">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={toggle}
            className="flex items-center gap-1.5 rounded-lg border border-[var(--color-neutral-200)] px-3 py-1.5 text-sm font-medium text-[var(--color-neutral-600)] transition-colors hover:bg-[var(--color-neutral-50)]"
            aria-label={`Switch to ${locale === 'en' ? 'Malayalam' : 'English'}`}
          >
            <LanguageIcon className="h-4 w-4" />
            <motion.span
              key={locale}
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            >
              {locale === 'en' ? 'മല' : 'EN'}
            </motion.span>
          </motion.button>

          <Link
            href="/settings"
            className="rounded-lg p-2 text-[var(--color-neutral-400)] transition-colors hover:bg-[var(--color-neutral-50)] hover:text-[var(--color-neutral-600)]"
            aria-label={t.settings}
          >
            <Cog6ToothIcon className="h-5 w-5" />
          </Link>
        </div>
      </div>
    </motion.header>
  );
}
