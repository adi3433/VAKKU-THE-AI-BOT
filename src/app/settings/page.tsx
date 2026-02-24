/**
 * Settings Page — Language, Accessibility, Privacy, Memory
 */
'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Header } from '@/components/layout/Header';
import { ParallaxBackground } from '@/components/layout/ParallaxBackground';
import { useLocale } from '@/hooks/useLocale';
import { useVaakkuStore } from '@/lib/store';
import {
  setMemoryConsent as apiSetMemoryConsent,
  exportMemory,
  deleteMemory,
} from '@/lib/api-client';

export default function SettingsPage() {
  const { locale, t, toggle, isMalayalam } = useLocale();
  const {
    motionEnabled,
    setMotionEnabled,
    accessibilityMode,
    setAccessibilityMode,
    memoryEnabled,
    setMemoryEnabled,
    setMemoryConsentGiven,
    userId,
  } = useVaakkuStore();

  const isMl = locale === 'ml';
  const [exportLoading, setExportLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const handleMemoryToggle = async (enabled: boolean) => {
    try {
      setMemoryEnabled(enabled);
      setMemoryConsentGiven(enabled);
      await apiSetMemoryConsent({
        userId,
        enabled,
        allowedTypes: ['profile', 'preferences', 'saved_docs'],
      });
    } catch {
      setMemoryEnabled(!enabled); // revert on failure
    }
  };

  const handleExport = async () => {
    try {
      setExportLoading(true);
      const data = await exportMemory(userId);
      // Download as JSON
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `vaakku-data-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setStatusMessage(isMl ? 'ഡാറ്റ എക്‌സ്‌പോർട്ട് ചെയ്തു' : 'Data exported successfully');
    } catch {
      setStatusMessage(isMl ? 'എക്‌സ്‌പോർട്ട് പരാജയപ്പെട്ടു' : 'Export failed');
    } finally {
      setExportLoading(false);
      setTimeout(() => setStatusMessage(null), 3000);
    }
  };

  const handleDelete = async () => {
    const confirmed = window.confirm(
      isMl
        ? 'നിങ്ങളുടെ എല്ലാ ഡാറ്റയും ഇല്ലാതാക്കണോ? ഈ പ്രവർത്തനം പഴയപടിയാക്കാൻ കഴിയില്ല.'
        : 'Delete all your data? This action cannot be undone.'
    );
    if (!confirmed) return;

    try {
      setDeleteLoading(true);
      const result = await deleteMemory(userId);
      setStatusMessage(result.message);
    } catch {
      setStatusMessage(isMl ? 'ഇല്ലാതാക്കൽ പരാജയപ്പെട്ടു' : 'Deletion failed');
    } finally {
      setDeleteLoading(false);
      setTimeout(() => setStatusMessage(null), 3000);
    }
  };

  return (
    <>
      <ParallaxBackground />
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-1 px-4 py-8">
          <div className="mx-auto max-w-lg">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <h1 className={`text-2xl font-bold text-[var(--color-neutral-900)] ${isMl ? 'font-ml' : ''}`}>
                {t.settings}
              </h1>
            </motion.div>

            <div className="mt-6 space-y-4">
              {/* Language */}
              <div className="rounded-xl border border-[var(--color-neutral-100)] bg-[var(--surface-primary)] p-5">
                <h2 className={`text-sm font-semibold text-[var(--color-neutral-700)] ${isMl ? 'font-ml' : ''}`}>
                  {t.language}
                </h2>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => !isMalayalam || toggle()}
                    className={`flex-1 rounded-lg py-2.5 text-sm font-medium transition-colors ${
                      !isMalayalam
                        ? 'bg-[var(--color-primary-500)] text-white'
                        : 'border border-[var(--color-neutral-200)] bg-[var(--surface-primary)] text-[var(--color-neutral-600)]'
                    }`}
                  >
                    English
                  </button>
                  <button
                    onClick={() => isMalayalam || toggle()}
                    className={`flex-1 rounded-lg py-2.5 text-sm font-medium font-ml transition-colors ${
                      isMalayalam
                        ? 'bg-[var(--color-primary-500)] text-white'
                        : 'border border-[var(--color-neutral-200)] bg-[var(--surface-primary)] text-[var(--color-neutral-600)]'
                    }`}
                  >
                    മലയാളം
                  </button>
                </div>
              </div>

              {/* Memory */}
              <div className="rounded-xl border border-[var(--color-neutral-100)] bg-[var(--surface-primary)] p-5">
                <h2 className={`text-sm font-semibold text-[var(--color-neutral-700)] ${isMl ? 'font-ml' : ''}`}>
                  {isMl ? 'മെമ്മറി' : 'Memory'}
                </h2>
                <p className={`mt-1 text-xs text-[var(--color-neutral-400)] ${isMl ? 'font-ml' : ''}`}>
                  {isMl
                    ? 'നിങ്ങളുടെ മുൻഗണനകളും പ്രൊഫൈൽ വിവരങ്ങളും ഓർമ്മിക്കാൻ Vaakku-നെ അനുവദിക്കുക'
                    : 'Allow Vaakku to remember your preferences and profile across sessions'}
                </p>
                <div className="mt-3">
                  <ToggleRow
                    label={isMl ? 'മെമ്മറി പ്രവർത്തനക്ഷമമാക്കുക' : 'Enable Memory'}
                    description={
                      isMl
                        ? 'ഓപ്ട്-ഇൻ: നിങ്ങളുടെ ഡാറ്റ എൻക്രിപ്റ്റ് ചെയ്തു സൂക്ഷിക്കും'
                        : 'Opt-in: Your data is stored with encryption'
                    }
                    checked={memoryEnabled}
                    onChange={handleMemoryToggle}
                  />
                </div>
              </div>

              {/* Accessibility */}
              <div className="rounded-xl border border-[var(--color-neutral-100)] bg-[var(--surface-primary)] p-5">
                <h2 className={`text-sm font-semibold text-[var(--color-neutral-700)] ${isMl ? 'font-ml' : ''}`}>
                  {t.accessibility}
                </h2>
                <div className="mt-3 space-y-3">
                  <ToggleRow
                    label={isMl ? 'ആനിമേഷനുകൾ' : 'Animations'}
                    description={isMl ? 'ചലന ഇഫക്റ്റുകൾ പ്രവർത്തനക്ഷമമാക്കുക' : 'Enable motion effects and parallax'}
                    checked={motionEnabled}
                    onChange={setMotionEnabled}
                  />
                  <ToggleRow
                    label={isMl ? 'പ്രവേശനക്ഷമത മോഡ്' : 'Accessibility Mode'}
                    description={isMl ? 'ഉയർന്ന കോൺട്രാസ്റ്റും വലിയ ടെക്സ്റ്റും' : 'High contrast and larger text'}
                    checked={accessibilityMode}
                    onChange={setAccessibilityMode}
                  />
                </div>
              </div>

              {/* Privacy */}
              <div className="rounded-xl border border-[var(--color-neutral-100)] bg-[var(--surface-primary)] p-5">
                <h2 className={`text-sm font-semibold text-[var(--color-neutral-700)] ${isMl ? 'font-ml' : ''}`}>
                  {isMl ? 'സ്വകാര്യത' : 'Privacy'}
                </h2>
                <p className={`mt-2 text-sm text-[var(--color-neutral-500)] ${isMl ? 'font-ml' : ''}`}>
                  {t.privacyNotice}
                </p>
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={handleExport}
                    disabled={exportLoading}
                    className="rounded-lg border border-[var(--color-neutral-200)] bg-[var(--surface-primary)] px-4 py-2 text-sm font-medium text-[var(--color-neutral-600)] hover:bg-[var(--color-neutral-50)] transition-colors disabled:opacity-50"
                  >
                    {exportLoading
                      ? (isMl ? 'എക്‌സ്‌പോർട്ട്...' : 'Exporting...')
                      : t.dataExport}
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={deleteLoading}
                    className="rounded-lg border border-red-200 dark:border-red-800 bg-[var(--surface-primary)] px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors disabled:opacity-50"
                  >
                    {deleteLoading
                      ? (isMl ? 'ഇല്ലാതാക്കുന്നു...' : 'Deleting...')
                      : t.dataDelete}
                  </button>
                </div>

                {/* Status message */}
                {statusMessage && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="mt-2 text-xs text-[var(--color-primary-600)]"
                  >
                    {statusMessage}
                  </motion.p>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between">
      <div>
        <p className="text-sm font-medium text-[var(--color-neutral-700)]">{label}</p>
        <p className="text-xs text-[var(--color-neutral-400)]">{description}</p>
      </div>
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 rounded-full transition-colors ${
          checked ? 'bg-[var(--color-primary-500)]' : 'bg-[var(--color-neutral-200)]'
        }`}
      >
        <motion.div
          animate={{ x: checked ? 20 : 2 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm"
        />
      </button>
    </label>
  );
}
