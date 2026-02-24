/**
 * Booth Locator Page — Interactive Map + Real Data Search
 * ───────────────────────────────────────────────────────
 * Connects to /api/booth for 171 real Kottayam polling stations.
 * MapLibre GL renders an interactive OpenStreetMap with markers.
 */
'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MagnifyingGlassIcon,
  MapPinIcon,
  ArrowTopRightOnSquareIcon,
} from '@heroicons/react/24/outline';
import { Header } from '@/components/layout/Header';
import { ParallaxBackground } from '@/components/layout/ParallaxBackground';
import { useLocale } from '@/hooks/useLocale';
import type { BoothInfo, BoothSearchResponse } from '@/types';
import type { BoothMapHandle } from '@/components/booth/BoothMap';

// Dynamic import — MapLibre needs browser globals
const BoothMap = dynamic(() => import('@/components/booth/BoothMap'), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full flex items-center justify-center rounded-2xl bg-[var(--color-neutral-100)]">
      <div className="text-center text-[var(--color-neutral-400)]">
        <MapPinIcon className="mx-auto h-10 w-10 mb-2 animate-pulse" />
        <p className="text-sm">Loading map…</p>
      </div>
    </div>
  ),
});

export default function BoothPage() {
  const { locale, t } = useLocale();
  const isMl = locale === 'ml';
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<BoothInfo[]>([]);
  const [allBooths, setAllBooths] = useState<BoothInfo[]>([]);
  const [mapBooths, setMapBooths] = useState<BoothInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const mapRef = useRef<BoothMapHandle>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  // Fetch initial booths on mount (all for the map)
  useEffect(() => {
    async function fetchAll() {
      try {
        const res = await fetch('/api/booth');
        if (!res.ok) return;
        const data: BoothSearchResponse = await res.json();
        setAllBooths(data.booths);
        setMapBooths(data.booths);
        setTotalCount(data.booths.length);
      } catch {
        // Silently fail — map shows empty
      }
    }
    fetchAll();
  }, []);

  const handleSearch = useCallback(async () => {
    const q = searchQuery.trim();
    setSearched(true);
    setLoading(true);

    try {
      const url = q ? `/api/booth?q=${encodeURIComponent(q)}` : '/api/booth';
      const res = await fetch(url);
      if (!res.ok) throw new Error('API error');
      const data: BoothSearchResponse = await res.json();
      setResults(data.booths);
      setMapBooths(data.booths.length > 0 ? data.booths : allBooths);
    } catch {
      setResults([]);
      setMapBooths(allBooths);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, allBooths]);

  const handleViewOnMap = useCallback((booth: BoothInfo) => {
    if (mapRef.current && booth.latitude && booth.longitude) {
      mapRef.current.flyTo(
        booth.latitude,
        booth.longitude,
        isMl ? booth.boothNameMl : booth.boothName
      );
      // Scroll to map
      mapContainerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [isMl]);

  const handleGetDirections = useCallback((booth: BoothInfo) => {
    if (booth.latitude && booth.longitude) {
      const url = `https://www.google.com/maps/dir/?api=1&destination=${booth.latitude},${booth.longitude}`;
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }, []);

  return (
    <>
      <ParallaxBackground />
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-1 px-4 py-8">
          <div className="mx-auto max-w-4xl">
            {/* Title */}
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
                  ? 'നിങ്ങളുടെ ബൂത്ത് പേര്, സ്റ്റേഷൻ നമ്പർ, അല്ലെങ്കിൽ പ്രദേശം ഉപയോഗിച്ച് തിരയുക.'
                  : 'Search by booth name, station number, landmark, or area.'}
              </p>
              {totalCount > 0 && (
                <p className="mt-1 text-xs text-[var(--color-neutral-400)]">
                  {totalCount} {isMl ? 'പോളിംഗ് സ്റ്റേഷനുകൾ ലഭ്യമാണ്' : 'polling stations available'} — LAC 97, Kottayam
                </p>
              )}
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
                    placeholder={
                      isMl
                        ? 'ബൂത്ത് പേര് / സ്റ്റേഷൻ നമ്പർ / പ്രദേശം'
                        : 'Booth name / Station number / Area / Landmark'
                    }
                    className="w-full rounded-xl border border-[var(--color-neutral-200)] bg-[var(--surface-primary)] py-3 pl-10 pr-4 text-sm text-[var(--text-primary)] shadow-sm focus:border-[var(--color-primary-300)] focus:ring-2 focus:ring-[var(--color-primary-100)] outline-none transition"
                  />
                </div>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={handleSearch}
                  disabled={loading}
                  className="rounded-xl bg-[var(--color-primary-500)] px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-[var(--color-primary-600)] transition-colors disabled:opacity-50"
                >
                  {loading
                    ? (isMl ? 'തിരയുന്നു…' : 'Searching…')
                    : (isMl ? 'തിരയുക' : 'Search')}
                </motion.button>
              </div>
            </motion.div>

            {/* Interactive Map */}
            <motion.div
              ref={mapContainerRef}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.3 }}
              className="mt-6 h-[400px] rounded-2xl border border-[var(--color-neutral-200)] overflow-hidden shadow-sm"
            >
              <BoothMap
                ref={mapRef}
                booths={mapBooths}
                locale={locale}
              />
            </motion.div>

            {/* Results */}
            <AnimatePresence>
              {searched && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3 }}
                  className="mt-6 space-y-3"
                >
                  <h2 className={`text-lg font-semibold text-[var(--color-neutral-800)] ${isMl ? 'font-ml' : ''}`}>
                    {isMl ? 'ഫലങ്ങൾ' : 'Results'} ({results.length})
                  </h2>

                  {results.length === 0 && !loading && (
                    <div className="rounded-xl border border-dashed border-[var(--color-neutral-200)] bg-[var(--color-neutral-50)] p-6 text-center">
                      <MapPinIcon className="mx-auto h-8 w-8 text-[var(--color-neutral-300)] mb-2" />
                      <p className={`text-sm text-[var(--color-neutral-500)] ${isMl ? 'font-ml' : ''}`}>
                        {isMl
                          ? 'ഫലങ്ങൾ കണ്ടെത്തിയില്ല. മറ്റൊരു തിരയൽ പദം ശ്രമിക്കുക.'
                          : 'No results found. Try a different search term.'}
                      </p>
                    </div>
                  )}

                  {results.map((booth, idx) => (
                    <motion.div
                      key={booth.boothId}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className="rounded-xl border border-[var(--color-neutral-100)] bg-[var(--surface-primary)] p-4 shadow-sm hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-xs font-medium text-[var(--color-primary-500)]">
                              {booth.ward}
                            </p>
                            <span className="text-[var(--color-neutral-300)]">•</span>
                            <p className="text-xs text-[var(--color-neutral-400)]">
                              {booth.boothId}
                            </p>
                          </div>
                          <h3 className={`mt-1 font-semibold text-[var(--color-neutral-800)] ${isMl ? 'font-ml' : ''} truncate`}>
                            {isMl ? booth.boothNameMl : booth.boothName}
                          </h3>
                          <p className={`mt-1 text-sm text-[var(--color-neutral-500)] ${isMl ? 'font-ml' : ''}`}>
                            {isMl ? booth.addressMl : booth.address}
                          </p>
                          {booth.latitude > 0 && (
                            <p className="mt-1 text-xs text-[var(--color-neutral-400)]">
                              📍 {booth.latitude.toFixed(4)}°N, {booth.longitude.toFixed(4)}°E
                            </p>
                          )}
                        </div>
                        {booth.accessibility && (
                          <span className="ml-2 shrink-0 rounded-full bg-emerald-50 dark:bg-emerald-900/30 px-2 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
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
                        <button
                          onClick={() => handleViewOnMap(booth)}
                          className="rounded-lg bg-[var(--color-primary-50)] px-3 py-1.5 text-xs font-medium text-[var(--color-primary-600)] hover:bg-[var(--color-primary-100)] transition-colors flex items-center gap-1"
                        >
                          <MapPinIcon className="h-3.5 w-3.5" />
                          {t.viewOnMap}
                        </button>
                        <button
                          onClick={() => handleGetDirections(booth)}
                          className="rounded-lg bg-[var(--color-neutral-50)] px-3 py-1.5 text-xs font-medium text-[var(--color-neutral-600)] hover:bg-[var(--color-neutral-100)] transition-colors flex items-center gap-1"
                        >
                          <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" />
                          {t.getDirections}
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </main>
      </div>
    </>
  );
}
