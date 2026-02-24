/**
 * Report Violation Page — Upload + Geo
 */
'use client';

import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  CameraIcon,
  MapPinIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';
import { Header } from '@/components/layout/Header';
import { ParallaxBackground } from '@/components/layout/ParallaxBackground';
import { useLocale } from '@/hooks/useLocale';
import type { ViolationReport } from '@/types';

const VIOLATION_TYPES: { key: ViolationReport['type']; en: string; ml: string }[] = [
  { key: 'bribery', en: 'Bribery', ml: 'കൈക്കൂലി' },
  { key: 'intimidation', en: 'Voter Intimidation', ml: 'വോട്ടർ ഭീഷണി' },
  { key: 'misinformation', en: 'Misinformation', ml: 'തെറ്റായ വിവരങ്ങൾ' },
  { key: 'polling_irregularity', en: 'Polling Irregularity', ml: 'പോളിംഗ് ക്രമക്കേട്' },
  { key: 'other', en: 'Other', ml: 'മറ്റുള്ളവ' },
];

export default function ReportPage() {
  const { locale, t } = useLocale();
  const isMl = locale === 'ml';
  const fileRef = useRef<HTMLInputElement>(null);

  const [type, setType] = useState<ViolationReport['type']>('other');
  const [description, setDescription] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [useLocation, setUseLocation] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [refNumber, setRefNumber] = useState('');

  const handleSubmit = async () => {
    if (!description.trim()) return;
    setLoading(true);
    // In production: call submitViolationReport API
    await new Promise((r) => setTimeout(r, 2000));
    setRefNumber(`SVEEP-KTM-${Date.now().toString(36).toUpperCase()}`);
    setSubmitted(true);
    setLoading(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files));
    }
  };

  if (submitted) {
    return (
      <>
        <ParallaxBackground />
        <div className="flex min-h-screen flex-col">
          <Header />
          <main className="flex flex-1 items-center justify-center px-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
              className="max-w-md text-center"
            >
              <CheckCircleIcon className="mx-auto h-16 w-16 text-emerald-500" />
              <h2 className={`mt-4 text-xl font-bold text-[var(--color-neutral-900)] ${isMl ? 'font-ml' : ''}`}>
                {isMl ? 'റിപ്പോർട്ട് സമർപ്പിച്ചു!' : 'Report Submitted!'}
              </h2>
              <p className={`mt-2 text-sm text-[var(--color-neutral-500)] ${isMl ? 'font-ml' : ''}`}>
                {isMl
                  ? 'നിങ്ങളുടെ റിപ്പോർട്ട് വിജയകരമായി സമർപ്പിച്ചു. ഞങ്ങൾ ഇത് പരിശോധിക്കും.'
                  : 'Your report has been submitted successfully. We will review it shortly.'}
              </p>
              <div className="mt-4 rounded-xl bg-[var(--color-neutral-50)] p-4 text-center">
                <p className="text-xs text-[var(--color-neutral-400)]">{t.referenceNumber}</p>
                <p className="mt-1 text-lg font-bold text-[var(--color-primary-600)]">{refNumber}</p>
              </div>
            </motion.div>
          </main>
        </div>
      </>
    );
  }

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
                {t.reportViolation}
              </h1>
              <p className={`mt-2 text-sm text-[var(--color-neutral-500)] ${isMl ? 'font-ml' : ''}`}>
                {isMl
                  ? 'തിരഞ്ഞെടുപ്പ് ലംഘനങ്ങൾ രഹസ്യമായി റിപ്പോർട്ട് ചെയ്യുക.'
                  : 'Report election violations confidentially.'}
              </p>
            </motion.div>

            <div className="mt-6 space-y-5">
              {/* Violation type */}
              <div>
                <label className={`block text-sm font-medium text-[var(--color-neutral-700)] ${isMl ? 'font-ml' : ''}`}>
                  {isMl ? 'ലംഘന തരം' : 'Violation Type'}
                </label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {VIOLATION_TYPES.map((vt) => (
                    <button
                      key={vt.key}
                      onClick={() => setType(vt.key)}
                      className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                        type === vt.key
                          ? 'border-[var(--color-primary-300)] bg-[var(--color-primary-50)] text-[var(--color-primary-600)]'
                          : 'border-[var(--color-neutral-200)] bg-[var(--surface-primary)] text-[var(--color-neutral-600)] hover:bg-[var(--color-neutral-50)]'
                      } ${isMl ? 'font-ml' : ''}`}
                    >
                      {isMl ? vt.ml : vt.en}
                    </button>
                  ))}
                </div>
              </div>

              {/* Description */}
              <div>
                <label className={`block text-sm font-medium text-[var(--color-neutral-700)] ${isMl ? 'font-ml' : ''}`}>
                  {isMl ? 'വിവരണം' : 'Description'}
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  className={`mt-1 w-full rounded-xl border border-[var(--color-neutral-200)] bg-[var(--surface-primary)] px-4 py-3 text-sm text-[var(--text-primary)] shadow-sm outline-none focus:border-[var(--color-primary-300)] focus:ring-2 focus:ring-[var(--color-primary-100)] transition resize-none ${isMl ? 'font-ml' : ''}`}
                  placeholder={isMl ? 'എന്താണ് സംഭവിച്ചത് വിവരിക്കുക...' : 'Describe what happened...'}
                />
              </div>

              {/* File upload */}
              <div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  onChange={handleFileChange}
                  className="hidden"
                />
                <button
                  onClick={() => fileRef.current?.click()}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[var(--color-neutral-200)] bg-[var(--surface-primary)] py-4 text-sm text-[var(--color-neutral-500)] hover:border-[var(--color-primary-300)] hover:text-[var(--color-primary-500)] transition-colors"
                >
                  <CameraIcon className="h-5 w-5" />
                  {t.uploadMedia}
                </button>
                {files.length > 0 && (
                  <p className="mt-2 text-xs text-[var(--color-neutral-400)]">
                    {files.length} {isMl ? 'ഫയലുകൾ തിരഞ്ഞെടുത്തു' : 'files selected'}
                  </p>
                )}
              </div>

              {/* Location */}
              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-[var(--color-neutral-200)] bg-[var(--surface-primary)] p-3">
                <input
                  type="checkbox"
                  checked={useLocation}
                  onChange={(e) => setUseLocation(e.target.checked)}
                  className="h-4 w-4 rounded border-[var(--color-neutral-300)] text-[var(--color-primary-500)]"
                />
                <MapPinIcon className="h-5 w-5 text-[var(--color-neutral-400)]" />
                <span className={`text-sm text-[var(--color-neutral-600)] ${isMl ? 'font-ml' : ''}`}>
                  {isMl ? 'എന്റെ നിലവിലെ ലൊക്കേഷൻ ഉൾപ്പെടുത്തുക' : 'Include my current location'}
                </span>
              </label>

              {/* Submit */}
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleSubmit}
                disabled={loading || !description.trim()}
                className="w-full rounded-xl bg-red-600 py-3 text-sm font-semibold text-white shadow-sm hover:bg-red-700 transition-colors disabled:opacity-60"
              >
                {loading
                  ? (isMl ? 'സമർപ്പിക്കുന്നു...' : 'Submitting...')
                  : t.submitReport}
              </motion.button>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
