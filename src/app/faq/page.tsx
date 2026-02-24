/**
 * FAQ Hub Page
 */
'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDownIcon } from '@heroicons/react/24/outline';
import { Header } from '@/components/layout/Header';
import { ParallaxBackground } from '@/components/layout/ParallaxBackground';
import { useLocale } from '@/hooks/useLocale';

interface FAQItem {
  questionEn: string;
  questionMl: string;
  answerEn: string;
  answerMl: string;
  category: string;
}

const FAQ_DATA: FAQItem[] = [
  {
    category: 'Registration',
    questionEn: 'How do I register as a voter in Kottayam?',
    questionMl: 'കോട്ടയത്ത് വോട്ടറായി എങ്ങനെ രജിസ്റ്റർ ചെയ്യാം?',
    answerEn: 'You can register online at voters.eci.gov.in by filling Form 6. You need proof of age, address proof, and a passport-size photo. You can also visit your nearest ERO office.',
    answerMl: 'voters.eci.gov.in-ൽ ഫോം 6 പൂരിപ്പിച്ച് ഓൺലൈനായി രജിസ്റ്റർ ചെയ്യാം. പ്രായ തെളിവ്, വിലാസ തെളിവ്, പാസ്‌പോർട്ട് സൈസ് ഫോട്ടോ എന്നിവ ആവശ്യമാണ്. നിങ്ങളുടെ അടുത്തുള്ള ERO ഓഫീസും സന്ദർശിക്കാം.',
  },
  {
    category: 'Registration',
    questionEn: 'What documents are needed for voter registration?',
    questionMl: 'വോട്ടർ രജിസ്ട്രേഷനായി ഏതൊക്കെ രേഖകൾ ആവശ്യമാണ്?',
    answerEn: 'You need: (1) Proof of age (birth certificate, school certificate, or passport), (2) Proof of address (utility bill, Aadhaar, or rent agreement), (3) Recent passport-size photograph.',
    answerMl: 'ആവശ്യമുള്ളവ: (1) പ്രായ തെളിവ് (ജനന സർട്ടിഫിക്കറ്റ്, സ്കൂൾ സർട്ടിഫിക്കറ്റ്, പാസ്‌പോർട്ട്), (2) വിലാസ തെളിവ് (യൂട്ടിലിറ്റി ബിൽ, ആധാർ, വാടക കരാർ), (3) പാസ്‌പോർട്ട് സൈസ് ഫോട്ടോ.',
  },
  {
    category: 'Polling',
    questionEn: 'How do I find my polling booth?',
    questionMl: 'എന്റെ പോളിംഗ് ബൂത്ത് എങ്ങനെ കണ്ടെത്താം?',
    answerEn: 'Use the Booth Locator feature on this app, or SMS your EPIC number to 1950. You can also check at electoralsearch.in.',
    answerMl: 'ഈ ആപ്പിലെ ബൂത്ത് ലൊക്കേറ്റർ ഉപയോഗിക്കുക, അല്ലെങ്കിൽ നിങ്ങളുടെ EPIC നമ്പർ 1950-ലേക്ക് SMS ചെയ്യുക. electoralsearch.in-ലും പരിശോധിക്കാം.',
  },
  {
    category: 'Polling',
    questionEn: 'What should I bring to the polling booth?',
    questionMl: 'പോളിംഗ് ബൂത്തിലേക്ക് എന്ത് കൊണ്ടുപോകണം?',
    answerEn: 'Bring your EPIC (Voter ID card) or any of the 12 approved photo ID documents: Aadhaar, Passport, Driving License, PAN Card, etc.',
    answerMl: 'നിങ്ങളുടെ EPIC (വോട്ടർ ഐഡി കാർഡ്) അല്ലെങ്കിൽ 12 അംഗീകൃത ഫോട്ടോ ഐഡി രേഖകളിൽ ഒന്ന് കൊണ്ടുവരിക: ആധാർ, പാസ്‌പോർട്ട്, ഡ്രൈവിംഗ് ലൈസൻസ്, PAN കാർഡ് മുതലായവ.',
  },
  {
    category: 'Violations',
    questionEn: 'How do I report an election violation?',
    questionMl: 'ഒരു തിരഞ്ഞെടുപ്പ് ലംഘനം എങ്ങനെ റിപ്പോർട്ട് ചെയ്യാം?',
    answerEn: 'Use the Report Violation feature in this app, call the Election Commission helpline at 1950, or use the cVIGIL app.',
    answerMl: 'ഈ ആപ്പിലെ ലംഘന റിപ്പോർട്ട് ഫീച്ചർ ഉപയോഗിക്കുക, 1950 ഹെൽപ്‌ലൈനിൽ വിളിക്കുക, അല്ലെങ്കിൽ cVIGIL ആപ്പ് ഉപയോഗിക്കുക.',
  },
  {
    category: 'General',
    questionEn: 'What is SVEEP?',
    questionMl: 'SVEEP എന്താണ്?',
    answerEn: 'SVEEP (Systematic Voters\' Education and Electoral Participation) is a flagship program of the Election Commission of India to increase voter awareness and participation.',
    answerMl: 'SVEEP (സിസ്റ്റമാറ്റിക് വോട്ടേഴ്‌സ് എഡ്യൂക്കേഷൻ ആൻഡ് ഇലക്ടറൽ പാർട്ടിസിപ്പേഷൻ) വോട്ടർ അവബോധവും പങ്കാളിത്തവും വർദ്ധിപ്പിക്കുന്നതിനുള്ള ഇന്ത്യൻ തിരഞ്ഞെടുപ്പ് കമ്മീഷന്റെ ഫ്ലാഗ്ഷിപ്പ് പ്രോഗ്രാമാണ്.',
  },
];

export default function FAQPage() {
  const { locale } = useLocale();
  const isMl = locale === 'ml';
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [filter, setFilter] = useState<string>('All');

  const categories = ['All', ...Array.from(new Set(FAQ_DATA.map((f) => f.category)))];
  const filtered = filter === 'All' ? FAQ_DATA : FAQ_DATA.filter((f) => f.category === filter);

  return (
    <>
      <ParallaxBackground />
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-1 px-4 py-8">
          <div className="mx-auto max-w-2xl">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <h1 className={`text-2xl font-bold text-[var(--color-neutral-900)] ${isMl ? 'font-ml' : ''}`}>
                {isMl ? 'പൊതു ചോദ്യങ്ങൾ' : 'Frequently Asked Questions'}
              </h1>
            </motion.div>

            {/* Category filter */}
            <div className="mt-4 flex flex-wrap gap-2">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setFilter(cat)}
                  className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
                    filter === cat
                      ? 'bg-[var(--color-primary-500)] text-white'
                      : 'bg-[var(--surface-primary)] border border-[var(--color-neutral-200)] text-[var(--color-neutral-600)] hover:bg-[var(--color-neutral-50)]'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Accordion */}
            <div className="mt-6 space-y-2">
              {filtered.map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="rounded-xl border border-[var(--color-neutral-100)] bg-[var(--surface-primary)] overflow-hidden"
                >
                  <button
                    onClick={() => setOpenIndex(openIndex === i ? null : i)}
                    className={`flex w-full items-center justify-between px-5 py-4 text-left text-sm font-medium text-[var(--color-neutral-800)] hover:bg-[var(--color-neutral-50)] transition-colors ${isMl ? 'font-ml' : ''}`}
                  >
                    <span>{isMl ? item.questionMl : item.questionEn}</span>
                    <motion.div
                      animate={{ rotate: openIndex === i ? 180 : 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <ChevronDownIcon className="h-4 w-4 text-[var(--color-neutral-400)]" />
                    </motion.div>
                  </button>
                  <AnimatePresence>
                    {openIndex === i && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className={`border-t border-[var(--color-neutral-50)] px-5 py-4 text-sm text-[var(--color-neutral-600)] leading-relaxed ${isMl ? 'font-ml' : ''}`}>
                          {isMl ? item.answerMl : item.answerEn}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
