/**
 * Landing Page — Vaakku
 * ──────────────────────
 * Hero with parallax background, quick action entry points,
 * and animated feature cards.
 */
'use client';

import React from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  ChatBubbleLeftRightIcon,
  MapPinIcon,
  IdentificationIcon,
  ExclamationTriangleIcon,
  QuestionMarkCircleIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline';
import { Header } from '@/components/layout/Header';
import { ParallaxBackground } from '@/components/layout/ParallaxBackground';
import { useLocale } from '@/hooks/useLocale';

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.3 },
  },
};

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0, 0, 0.2, 1] as const },
  },
};

const features = [
  {
    icon: ChatBubbleLeftRightIcon,
    href: '/chat',
    labelEn: 'AI Chat Assistant',
    labelMl: 'AI ചാറ്റ് സഹായി',
    descEn: 'Ask questions about voter registration, elections, and more.',
    descMl: 'വോട്ടർ രജിസ്ട്രേഷൻ, തിരഞ്ഞെടുപ്പ് എന്നിവയെക്കുറിച്ച് ചോദ്യങ്ങൾ ചോദിക്കുക.',
    color: 'primary',
  },
  {
    icon: MapPinIcon,
    href: '/booth',
    labelEn: 'Polling Booth Locator',
    labelMl: 'പോളിംഗ് ബൂത്ത് ലൊക്കേറ്റർ',
    descEn: 'Find your polling booth on a map with directions.',
    descMl: 'മാപ്പിൽ നിങ്ങളുടെ പോളിംഗ് ബൂത്ത് കണ്ടെത്തുക.',
    color: 'primary',
  },
  {
    icon: IdentificationIcon,
    href: '/registration',
    labelEn: 'Check Registration',
    labelMl: 'രജിസ്ട്രേഷൻ പരിശോധിക്കുക',
    descEn: 'Verify your voter registration status instantly.',
    descMl: 'നിങ്ങളുടെ വോട്ടർ രജിസ്ട്രേഷൻ സ്ഥിതി ഉടൻ പരിശോധിക്കുക.',
    color: 'primary',
  },
  {
    icon: ExclamationTriangleIcon,
    href: '/report',
    labelEn: 'Report Violation',
    labelMl: 'ലംഘനം റിപ്പോർട്ട് ചെയ്യുക',
    descEn: 'Report election violations with photo/video evidence.',
    descMl: 'ഫോട്ടോ/വീഡിയോ തെളിവുകൾ ഉപയോഗിച്ച് തിരഞ്ഞെടുപ്പ് ലംഘനങ്ങൾ റിപ്പോർട്ട് ചെയ്യുക.',
    color: 'primary',
  },
  {
    icon: QuestionMarkCircleIcon,
    href: '/faq',
    labelEn: 'FAQ Hub',
    labelMl: 'പൊതു ചോദ്യങ്ങൾ',
    descEn: 'Browse frequently asked questions about elections.',
    descMl: 'തിരഞ്ഞെടുപ്പിനെക്കുറിച്ചുള്ള പൊതു ചോദ്യങ്ങൾ ബ്രൗസ് ചെയ്യുക.',
    color: 'primary',
  },
  {
    icon: ShieldCheckIcon,
    href: '/settings',
    labelEn: 'Privacy & Settings',
    labelMl: 'സ്വകാര്യതയും ക്രമീകരണങ്ങളും',
    descEn: 'Manage language, accessibility, and data preferences.',
    descMl: 'ഭാഷ, പ്രവേശനക്ഷമത, ഡാറ്റ മുൻഗണനകൾ നിയന്ത്രിക്കുക.',
    color: 'primary',
  },
];

const colorMap: Record<string, string> = {
  primary: 'bg-[var(--color-primary-500)] text-white border-[var(--color-primary-600)]',
  accent: 'bg-[var(--color-accent-50)] text-[var(--color-accent-700)] border-[var(--color-accent-100)]',
  success: 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800',
  warning: 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-800',
};

export default function Home() {
  const { locale, t } = useLocale();
  const isMl = locale === 'ml';

  return (
    <>
      <ParallaxBackground />
      <Header />
      <main className="relative min-h-screen">
        {/* Hero Section */}
        <section className="mx-auto max-w-5xl px-4 pt-20 pb-16 text-center">
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
          >
            <motion.div variants={fadeUp}>
              <span className="inline-block rounded-full bg-[var(--color-primary-500)]/15 px-4 py-1.5 text-xs font-semibold text-[var(--badge-text)] border border-[var(--color-primary-500)]/20">
                SVEEP Kottayam District
              </span>
            </motion.div>

            <motion.h1
              variants={fadeUp}
              className={`mt-6 text-4xl font-extrabold tracking-tight text-[var(--color-neutral-900)] sm:text-5xl lg:text-6xl ${isMl ? 'font-ml' : ''}`}
            >
              {t.appName}
            </motion.h1>

            <motion.p
              variants={fadeUp}
              className={`mx-auto mt-4 max-w-2xl text-lg text-[var(--color-neutral-500)] ${isMl ? 'font-ml' : ''}`}
            >
              {t.tagline}
            </motion.p>

            <motion.div
              variants={fadeUp}
              className="mt-8 flex flex-wrap items-center justify-center gap-4"
            >
              <Link
                href="/chat"
                className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-primary-500)] px-6 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[var(--color-primary-600)] hover:shadow-md"
              >
                <ChatBubbleLeftRightIcon className="h-5 w-5" />
                {isMl ? 'ചാറ്റ് ആരംഭിക്കുക' : 'Start Chat'}
              </Link>
              <Link
                href="/booth"
                className="inline-flex items-center gap-2 rounded-xl border border-[var(--color-neutral-200)] bg-[var(--surface-primary)] px-6 py-3 text-sm font-semibold text-[var(--color-neutral-700)] shadow-sm transition-all hover:bg-[var(--color-neutral-50)] hover:shadow-md"
              >
                <MapPinIcon className="h-5 w-5" />
                {isMl ? 'ബൂത്ത് കണ്ടെത്തുക' : 'Find Booth'}
              </Link>
            </motion.div>
          </motion.div>
        </section>

        {/* Feature Cards */}
        <section className="mx-auto max-w-5xl px-4 pb-24">
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-100px' }}
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          >
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <motion.div key={feature.href} variants={fadeUp}>
                  <motion.div
                    whileHover={{ scale: 1.04, y: -4 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                  >
                    <Link
                      href={feature.href}
                      className="group block rounded-2xl border border-[var(--color-neutral-100)] bg-[var(--surface-primary)] p-6 shadow-sm transition-all duration-300 hover:shadow-lg hover:shadow-[var(--color-primary-500)]/10 hover:border-[var(--color-primary-300)]"
                    >
                      <div
                        className={`inline-flex rounded-xl p-3 transition-transform duration-300 group-hover:scale-110 ${colorMap[feature.color]}`}
                      >
                        <Icon className="h-6 w-6" />
                      </div>
                      <h3 className={`mt-4 text-base font-semibold text-[var(--color-neutral-800)] ${isMl ? 'font-ml' : ''}`}>
                        {isMl ? feature.labelMl : feature.labelEn}
                      </h3>
                      <p className={`mt-1.5 text-sm text-[var(--color-neutral-500)] leading-relaxed ${isMl ? 'font-ml' : ''}`}>
                        {isMl ? feature.descMl : feature.descEn}
                      </p>
                    </Link>
                  </motion.div>
                </motion.div>
              );
            })}
          </motion.div>
        </section>

        {/* Footer */}
        <footer className="border-t border-[var(--color-neutral-100)] bg-[var(--surface-primary)]/80 backdrop-blur">
          <div className="mx-auto max-w-5xl px-4 py-6 text-center text-xs text-[var(--color-neutral-400)]">
            <p>{t.poweredBy} &middot; {t.privacyNotice}</p>
          </div>
        </footer>
      </main>
    </>
  );
}