/**
 * Registration Check Page — Form + Result
 */
'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Header } from '@/components/layout/Header';
import { ParallaxBackground } from '@/components/layout/ParallaxBackground';
import { useLocale } from '@/hooks/useLocale';

type TabType = 'voterId' | 'details';

export default function RegistrationPage() {
  const { locale, t } = useLocale();
  const isMl = locale === 'ml';
  const [tab, setTab] = useState<TabType>('voterId');
  const [voterId, setVoterId] = useState('');
  const [name, setName] = useState('');
  const [dob, setDob] = useState('');
  const [constituency, setConstituency] = useState('');
  const [result, setResult] = useState<null | 'found' | 'not_found'>(null);
  const [loading, setLoading] = useState(false);

  const handleCheck = async () => {
    setLoading(true);
    // In production: call checkRegistration API
    await new Promise((r) => setTimeout(r, 1500));
    setResult(voterId.length > 3 || name.length > 2 ? 'found' : 'not_found');
    setLoading(false);
  };

  return (
    <>
      <ParallaxBackground />
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-1 px-4 py-8">
          <div className="mx-auto max-w-lg">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              <h1 className={`text-2xl font-bold text-[var(--color-neutral-900)] ${isMl ? 'font-ml' : ''}`}>
                {t.checkRegistration}
              </h1>
              <p className={`mt-2 text-sm text-[var(--color-neutral-500)] ${isMl ? 'font-ml' : ''}`}>
                {isMl
                  ? 'നിങ്ങളുടെ വോട്ടർ രജിസ്ട്രേഷൻ സ്ഥിതി ഉടൻ പരിശോധിക്കുക.'
                  : 'Verify your voter registration status instantly.'}
              </p>
            </motion.div>

            {/* Tabs */}
            <div className="mt-6 flex rounded-xl border border-[var(--color-neutral-200)] bg-[var(--color-neutral-50)] p-1">
              {[
                { key: 'voterId' as TabType, label: isMl ? 'വോട്ടർ ഐഡി' : 'Voter ID' },
                { key: 'details' as TabType, label: isMl ? 'വിശദാംശങ്ങൾ' : 'By Details' },
              ].map((item) => (
                <button
                  key={item.key}
                  onClick={() => { setTab(item.key); setResult(null); }}
                  className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
                    tab === item.key
                      ? 'bg-[var(--surface-primary)] text-[var(--color-primary-600)] shadow-sm'
                      : 'text-[var(--color-neutral-500)] hover:text-[var(--color-neutral-700)]'
                  } ${isMl ? 'font-ml' : ''}`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {/* Form */}
            <motion.div
              key={tab}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2 }}
              className="mt-6 space-y-4"
            >
              {tab === 'voterId' ? (
                <div>
                  <label className={`block text-sm font-medium text-[var(--color-neutral-700)] ${isMl ? 'font-ml' : ''}`}>
                    {t.voterIdLabel}
                  </label>
                  <input
                    type="text"
                    value={voterId}
                    onChange={(e) => setVoterId(e.target.value.toUpperCase())}
                    placeholder="e.g., ABC1234567"
                    className="mt-1 w-full rounded-xl border border-[var(--color-neutral-200)] bg-[var(--surface-primary)] px-4 py-3 text-sm text-[var(--text-primary)] shadow-sm outline-none focus:border-[var(--color-primary-300)] focus:ring-2 focus:ring-[var(--color-primary-100)] transition"
                  />
                </div>
              ) : (
                <>
                  <div>
                    <label className={`block text-sm font-medium text-[var(--color-neutral-700)] ${isMl ? 'font-ml' : ''}`}>
                      {t.nameLabel}
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-[var(--color-neutral-200)] bg-[var(--surface-primary)] px-4 py-3 text-sm text-[var(--text-primary)] shadow-sm outline-none focus:border-[var(--color-primary-300)] focus:ring-2 focus:ring-[var(--color-primary-100)] transition"
                    />
                  </div>
                  <div>
                    <label className={`block text-sm font-medium text-[var(--color-neutral-700)] ${isMl ? 'font-ml' : ''}`}>
                      {t.dobLabel}
                    </label>
                    <input
                      type="date"
                      value={dob}
                      onChange={(e) => setDob(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-[var(--color-neutral-200)] bg-[var(--surface-primary)] px-4 py-3 text-sm text-[var(--text-primary)] shadow-sm outline-none focus:border-[var(--color-primary-300)] focus:ring-2 focus:ring-[var(--color-primary-100)] transition"
                    />
                  </div>
                  <div>
                    <label className={`block text-sm font-medium text-[var(--color-neutral-700)] ${isMl ? 'font-ml' : ''}`}>
                      {t.constituencyLabel}
                    </label>
                    <input
                      type="text"
                      value={constituency}
                      onChange={(e) => setConstituency(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-[var(--color-neutral-200)] bg-[var(--surface-primary)] px-4 py-3 text-sm text-[var(--text-primary)] shadow-sm outline-none focus:border-[var(--color-primary-300)] focus:ring-2 focus:ring-[var(--color-primary-100)] transition"
                    />
                  </div>
                </>
              )}

              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleCheck}
                disabled={loading}
                className="w-full rounded-xl bg-[var(--color-primary-500)] py-3 text-sm font-semibold text-white shadow-sm hover:bg-[var(--color-primary-600)] transition-colors disabled:opacity-60"
              >
                {loading
                  ? (isMl ? 'പരിശോധിക്കുന്നു...' : 'Checking...')
                  : (isMl ? 'പരിശോധിക്കുക' : 'Check Status')}
              </motion.button>
            </motion.div>

            {/* Result */}
            <AnimatePresence>
              {result && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3 }}
                  className={`mt-6 rounded-2xl border p-5 ${
                    result === 'found'
                      ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/30'
                      : 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/30'
                  }`}
                >
                  {result === 'found' ? (
                    <div>
                      <p className={`font-semibold text-emerald-700 dark:text-emerald-400 ${isMl ? 'font-ml' : ''}`}>
                        ✅ {isMl ? 'രജിസ്ട്രേഷൻ കണ്ടെത്തി!' : 'Registration Found!'}
                      </p>
                      <div className="mt-3 space-y-1.5 text-sm text-emerald-600 dark:text-emerald-400">
                        <p><strong>{isMl ? 'പേര്' : 'Name'}:</strong> Demo Voter</p>
                        <p><strong>{isMl ? 'നിയോജകമണ്ഡലം' : 'Constituency'}:</strong> Kottayam</p>
                        <p><strong>{isMl ? 'ബൂത്ത്' : 'Booth'}:</strong> KTM-001</p>
                        <p><strong>{isMl ? 'സ്ഥിതി' : 'Status'}:</strong> {isMl ? 'സജീവം' : 'Active'}</p>
                      </div>
                      <p className="mt-3 text-xs text-emerald-500 dark:text-emerald-500">
                        {isMl ? 'ഉറവിടം: CEO Kerala electoralsearch.in' : 'Source: CEO Kerala electoralsearch.in'}
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p className={`font-semibold text-red-700 dark:text-red-400 ${isMl ? 'font-ml' : ''}`}>
                        ❌ {isMl ? 'രജിസ്ട്രേഷൻ കണ്ടെത്തിയില്ല' : 'Registration Not Found'}
                      </p>
                      <p className={`mt-2 text-sm text-red-600 dark:text-red-400 ${isMl ? 'font-ml' : ''}`}>
                        {isMl
                          ? 'ദയവായി വിശദാംശങ്ങൾ പരിശോധിച്ച് വീണ്ടും ശ്രമിക്കുക, അല്ലെങ്കിൽ electoralsearch.in സന്ദർശിക്കുക.'
                          : 'Please verify your details and try again, or visit electoralsearch.in.'}
                      </p>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </main>
      </div>
    </>
  );
}
