/**
 * Booth Locator Page — Map + Search
 */
'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  MagnifyingGlassIcon,
  MapPinIcon,
} from '@heroicons/react/24/outline';
import { Header } from '@/components/layout/Header';
import { ParallaxBackground } from '@/components/layout/ParallaxBackground';
import { useLocale } from '@/hooks/useLocale';
import type { BoothInfo } from '@/types';

// Sample data for demo
const SAMPLE_BOOTHS: BoothInfo[] = [
  {
    boothId: 'KTM-001',
    boothName: 'Government LP School, Kottayam',
    boothNameMl: 'ഗവ. എൽ.പി സ്കൂൾ, കോട്ടയം',
    address: 'Near Civil Station, Kottayam, Kerala 686001',
    addressMl: 'സിവിൽ സ്റ്റേഷന് സമീപം, കോട്ടയം, കേരള 686001',
    latitude: 9.5916,
    longitude: 76.5222,
    constituency: 'Kottayam',
    ward: 'Ward 15',
    facilities: ['Ramp', 'Drinking Water', 'Toilet'],
    accessibility: true,
  },
  {
    boothId: 'KTM-002',
    boothName: 'Town Hall, Changanassery',
    boothNameMl: 'ടൗൺ ഹാൾ, ചങ്ങനാശ്ശേരി',
    address: 'MC Road, Changanassery, Kerala 686101',
    addressMl: 'എം.സി റോഡ്, ചങ്ങനാശ്ശേരി, കേരള 686101',
    latitude: 9.4427,
    longitude: 76.5391,
    constituency: 'Changanassery',
    ward: 'Ward 8',
    facilities: ['Ramp', 'Parking', 'First Aid'],
    accessibility: true,
  },
];

export default function BoothPage() {
  const { locale, t } = useLocale();
  const isMl = locale === 'ml';
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<BoothInfo[]>([]);
  const [searched, setSearched] = useState(false);

  const handleSearch = () => {
    setSearched(true);
    // In production this calls searchBooth API
    const filtered = SAMPLE_BOOTHS.filter(
      (b) =>
        b.boothName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.boothId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.constituency.toLowerCase().includes(searchQuery.toLowerCase())
    );
    setResults(filtered.length > 0 ? filtered : SAMPLE_BOOTHS);
  };

  return (
    <>
      <ParallaxBackground />
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-1 px-4 py-8">
          <div className="mx-auto max-w-4xl">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              <h1 className={`text-2xl font-bold text-[var(--color-neutral-900)] ${isMl ? 'font-ml' : ''}`}>
                {isMl ? 'പോളിംഗ് ബൂത്ത് ലൊക്കേറ്റർ' : 'Polling Booth Locator'}
              </h1>
              <p className={`mt-2 text-sm text-[var(--color-neutral-500)] ${isMl ? 'font-ml' : ''}`}>
                {isMl
                  ? 'നിങ്ങളുടെ വോട്ടർ ഐഡി, പിൻ കോഡ്, അല്ലെങ്കിൽ നിയോജകമണ്ഡലം ഉപയോഗിച്ച് തിരയുക.'
                  : 'Search by Voter ID, PIN code, or constituency name.'}
              </p>
            </motion.div>

            {/* Search bar */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.15 }}
              className="mt-6"
            >
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--color-neutral-400)]" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    placeholder={isMl ? 'വോട്ടർ ഐഡി / പിൻ കോഡ് / നിയോജകമണ്ഡലം' : 'Voter ID / PIN code / Constituency'}
                    className="w-full rounded-xl border border-[var(--color-neutral-200)] bg-white py-3 pl-10 pr-4 text-sm shadow-sm focus:border-[var(--color-primary-300)] focus:ring-2 focus:ring-[var(--color-primary-100)] outline-none transition"
                  />
                </div>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={handleSearch}
                  className="rounded-xl bg-[var(--color-primary-500)] px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-[var(--color-primary-600)] transition-colors"
                >
                  {isMl ? 'തിരയുക' : 'Search'}
                </motion.button>
              </div>
            </motion.div>

            {/* Map placeholder */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.3 }}
              className="mt-6 h-64 rounded-2xl border border-[var(--color-neutral-200)] bg-[var(--color-neutral-100)] flex items-center justify-center"
            >
              <div className="text-center text-[var(--color-neutral-400)]">
                <MapPinIcon className="mx-auto h-10 w-10 mb-2" />
                <p className="text-sm">
                  {isMl ? 'മാപ്പ് ഇവിടെ ലോഡ് ചെയ്യും' : 'Map will load here'}
                </p>
                <p className="text-xs mt-1">MapLibre GL / OpenStreetMap</p>
              </div>
            </motion.div>

            {/* Results */}
            {searched && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="mt-6 space-y-3"
              >
                <h2 className={`text-lg font-semibold text-[var(--color-neutral-800)] ${isMl ? 'font-ml' : ''}`}>
                  {isMl ? 'ഫലങ്ങൾ' : 'Results'} ({results.length})
                </h2>
                {results.map((booth) => (
                  <motion.div
                    key={booth.boothId}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="rounded-xl border border-[var(--color-neutral-100)] bg-white p-4 shadow-sm"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-xs font-medium text-[var(--color-primary-500)]">
                          {booth.boothId}
                        </p>
                        <h3 className={`mt-1 font-semibold text-[var(--color-neutral-800)] ${isMl ? 'font-ml' : ''}`}>
                          {isMl ? booth.boothNameMl : booth.boothName}
                        </h3>
                        <p className={`mt-1 text-sm text-[var(--color-neutral-500)] ${isMl ? 'font-ml' : ''}`}>
                          {isMl ? booth.addressMl : booth.address}
                        </p>
                      </div>
                      {booth.accessibility && (
                        <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-600">
                          ♿ {isMl ? 'പ്രവേശനക്ഷമം' : 'Accessible'}
                        </span>
                      )}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {booth.facilities.map((f) => (
                        <span
                          key={f}
                          className="rounded-md bg-[var(--color-neutral-50)] px-2 py-0.5 text-xs text-[var(--color-neutral-500)]"
                        >
                          {f}
                        </span>
                      ))}
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button className="rounded-lg bg-[var(--color-primary-50)] px-3 py-1.5 text-xs font-medium text-[var(--color-primary-600)] hover:bg-[var(--color-primary-100)] transition-colors">
                        {t.viewOnMap}
                      </button>
                      <button className="rounded-lg bg-[var(--color-neutral-50)] px-3 py-1.5 text-xs font-medium text-[var(--color-neutral-600)] hover:bg-[var(--color-neutral-100)] transition-colors">
                        {t.getDirections}
                      </button>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </div>
        </main>
      </div>
    </>
  );
}
