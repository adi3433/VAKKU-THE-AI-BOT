/**
 * Admin Dashboard V2.1 — Query Logs, Retrieval Traces, Escalation Queue
 */
'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChartBarIcon,
  ArrowPathIcon,
  MagnifyingGlassIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  EyeIcon,
  ShieldCheckIcon,
  DocumentMagnifyingGlassIcon,
} from '@heroicons/react/24/outline';
import { Header } from '@/components/layout/Header';
import { useLocale } from '@/hooks/useLocale';

type Tab = 'overview' | 'queries' | 'traces' | 'escalations' | 'sync' | 'audit';

// Sample data for demo
const SAMPLE_LOGS = [
  { id: '1', query: 'How to register as a voter?', locale: 'en', confidence: 0.92, latencyMs: 340, escalated: false, routerType: 'rag', modality: 'text', promptVersionHash: 'abc123', timestamp: '2026-02-23T10:15:00Z' },
  { id: '2', query: 'എന്റെ ബൂത്ത് എവിടെ?', locale: 'ml', confidence: 0.88, latencyMs: 420, escalated: false, routerType: 'structured_lookup', modality: 'text', promptVersionHash: 'abc123', timestamp: '2026-02-23T10:22:00Z' },
  { id: '3', query: 'ഏത് പാർട്ടിക്ക് വോട്ട്?', locale: 'ml', confidence: 0.1, latencyMs: 120, escalated: true, routerType: 'rag', modality: 'text', promptVersionHash: 'abc123', timestamp: '2026-02-23T10:30:00Z' },
  { id: '4', query: 'What documents do I need?', locale: 'en', confidence: 0.95, latencyMs: 280, escalated: false, routerType: 'rag', modality: 'text', promptVersionHash: 'def456', timestamp: '2026-02-23T10:45:00Z' },
  { id: '5', query: 'Report booth problem', locale: 'en', confidence: 0.78, latencyMs: 510, escalated: false, routerType: 'rag', modality: 'text', promptVersionHash: 'def456', timestamp: '2026-02-23T11:02:00Z' },
  { id: '6', query: '[image] EPIC card scan', locale: 'en', confidence: 0.91, latencyMs: 1450, escalated: false, routerType: 'vision', modality: 'image', promptVersionHash: 'ghi789', timestamp: '2026-02-23T11:10:00Z' },
  { id: '7', query: '[audio] Voice query', locale: 'ml', confidence: 0.85, latencyMs: 2100, escalated: false, routerType: 'voice_then_rag', modality: 'audio', promptVersionHash: 'abc123', timestamp: '2026-02-23T11:15:00Z' },
];

const SAMPLE_TRACES = [
  {
    queryId: '1',
    query: 'How to register as a voter?',
    chunks: [
      { docId: 'faq-001', chunkId: 'c1', similarityScore: 0.92, rerankerScore: 0.95 },
      { docId: 'circular-023', chunkId: 'c3', similarityScore: 0.87, rerankerScore: 0.82 },
      { docId: 'faq-003', chunkId: 'c2', similarityScore: 0.81, rerankerScore: 0.78 },
    ],
    confidence: 0.92,
    promptVersion: 'rag-system-v1',
    generatorModel: 'qwen3-vl-30b-a3b-thinking',
    latencyMs: 340,
  },
  {
    queryId: '4',
    query: 'What documents do I need?',
    chunks: [
      { docId: 'faq-005', chunkId: 'c1', similarityScore: 0.95, rerankerScore: 0.97 },
      { docId: 'circular-045', chunkId: 'c2', similarityScore: 0.88, rerankerScore: 0.85 },
    ],
    confidence: 0.95,
    promptVersion: 'rag-system-v1',
    generatorModel: 'qwen3-vl-30b-a3b-thinking',
    latencyMs: 280,
  },
];

const SAMPLE_ESCALATIONS = [
  {
    id: 'e1',
    query: 'ഏത് പാർട്ടിക്ക് വോട്ട്?',
    locale: 'ml',
    confidence: 0.1,
    reason: 'safety_flag',
    status: 'pending',
    timestamp: '2026-02-23T10:30:00Z',
    sessionHash: 'sha256:a1b2c3...',
  },
  {
    id: 'e2',
    query: 'Who is the best candidate?',
    locale: 'en',
    confidence: 0.15,
    reason: 'safety_flag',
    status: 'reviewed',
    timestamp: '2026-02-23T08:15:00Z',
    sessionHash: 'sha256:d4e5f6...',
  },
];

const STATS = {
  totalQueries: 1247,
  avgConfidence: 0.86,
  avgLatency: 380,
  escalationRate: 3.2,
  activeUsers: 89,
  topLocale: 'ml (58%)',
  textQueries: 1085,
  audioQueries: 112,
  imageQueries: 50,
  promptVersions: 2,
};

export default function AdminPage() {
  const { t } = useLocale();
  const [tab, setTab] = useState<Tab>('overview');
  const [searchFilter, setSearchFilter] = useState('');

  const tabs: { key: Tab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'queries', label: 'Query Logs' },
    { key: 'traces', label: 'Retrieval Traces' },
    { key: 'escalations', label: 'Escalations' },
    { key: 'sync', label: 'Content Sync' },
    { key: 'audit', label: 'Audit Log' },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-[var(--color-neutral-50)]">
      <Header />
      <main className="flex-1 px-4 py-6">
        <div className="mx-auto max-w-6xl">
          {/* Title */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="text-2xl font-bold text-[var(--color-neutral-900)]">{t.admin}</h1>
            <p className="mt-1 text-sm text-[var(--color-neutral-500)]">
              Monitor queries, retrieval traces, escalations, and manage content.
            </p>
          </motion.div>

          {/* Tabs */}
          <div className="mt-6 flex gap-1 overflow-x-auto border-b border-[var(--color-neutral-200)]">
            {tabs.map((item) => (
              <button
                key={item.key}
                onClick={() => setTab(item.key)}
                className={`whitespace-nowrap px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                  tab === item.key
                    ? 'border-[var(--color-primary-500)] text-[var(--color-primary-600)]'
                    : 'border-transparent text-[var(--color-neutral-500)] hover:text-[var(--color-neutral-700)]'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="mt-6">
            {tab === 'overview' && <OverviewTab />}
            {tab === 'queries' && (
              <QueriesTab searchFilter={searchFilter} setSearchFilter={setSearchFilter} />
            )}
            {tab === 'traces' && <TracesTab />}
            {tab === 'escalations' && <EscalationsTab />}
            {tab === 'sync' && <SyncTab />}
            {tab === 'audit' && <AuditTab />}
          </div>
        </div>
      </main>
    </div>
  );
}

function OverviewTab() {
  const stats = [
    { label: 'Total Queries (24h)', value: STATS.totalQueries.toLocaleString(), icon: ChartBarIcon, color: 'primary' },
    { label: 'Avg Confidence', value: `${(STATS.avgConfidence * 100).toFixed(0)}%`, icon: CheckCircleIcon, color: 'success' },
    { label: 'Avg Latency', value: `${STATS.avgLatency}ms`, icon: ClockIcon, color: 'accent' },
    { label: 'Escalation Rate', value: `${STATS.escalationRate}%`, icon: ExclamationTriangleIcon, color: 'warning' },
  ];

  const modalityStats = [
    { label: 'Text', value: STATS.textQueries, color: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' },
    { label: 'Audio', value: STATS.audioQueries, color: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400' },
    { label: 'Image', value: STATS.imageQueries, color: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' },
  ];

  const colorClasses: Record<string, string> = {
    primary: 'bg-[var(--color-primary-50)] text-[var(--color-primary-600)]',
    success: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
    accent: 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
    warning: 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400',
  };

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className="rounded-xl border border-[var(--color-neutral-100)] bg-[var(--surface-primary)] p-5"
            >
              <div className={`inline-flex rounded-lg p-2 ${colorClasses[stat.color]}`}>
                <Icon className="h-5 w-5" />
              </div>
              <p className="mt-3 text-2xl font-bold text-[var(--color-neutral-900)]">
                {stat.value}
              </p>
              <p className="mt-0.5 text-xs text-[var(--color-neutral-400)]">{stat.label}</p>
            </div>
          );
        })}
      </motion.div>

      {/* Modality breakdown */}
      <div className="rounded-xl border border-[var(--color-neutral-100)] bg-[var(--surface-primary)] p-5">
        <h3 className="text-sm font-semibold text-[var(--color-neutral-700)]">Queries by Modality</h3>
        <div className="mt-3 flex gap-4">
          {modalityStats.map((m) => (
            <div key={m.label} className="flex items-center gap-2">
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${m.color}`}>
                {m.label}
              </span>
              <span className="text-sm font-bold text-[var(--color-neutral-800)]">{m.value}</span>
            </div>
          ))}
        </div>
        {/* Simple bar */}
        <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-[var(--color-neutral-100)]">
          <div
            className="bg-blue-400 transition-all"
            style={{ width: `${(STATS.textQueries / STATS.totalQueries) * 100}%` }}
          />
          <div
            className="bg-purple-400 transition-all"
            style={{ width: `${(STATS.audioQueries / STATS.totalQueries) * 100}%` }}
          />
          <div
            className="bg-amber-400 transition-all"
            style={{ width: `${(STATS.imageQueries / STATS.totalQueries) * 100}%` }}
          />
        </div>
      </div>

      {/* Prompt versions */}
      <div className="rounded-xl border border-[var(--color-neutral-100)] bg-[var(--surface-primary)] p-5">
        <h3 className="text-sm font-semibold text-[var(--color-neutral-700)]">Active Prompt Versions</h3>
        <div className="mt-2 flex items-center gap-2">
          <ShieldCheckIcon className="h-4 w-4 text-emerald-500" />
          <span className="text-sm text-[var(--color-neutral-600)]">
            {STATS.promptVersions} versions in use · Latest: <code className="text-xs bg-[var(--color-neutral-100)] px-1 rounded">rag-system-v1</code>
          </span>
        </div>
      </div>
    </div>
  );
}

function QueriesTab({
  searchFilter,
  setSearchFilter,
}: {
  searchFilter: string;
  setSearchFilter: (v: string) => void;
}) {
  const filtered = SAMPLE_LOGS.filter(
    (log) =>
      log.query.toLowerCase().includes(searchFilter.toLowerCase()) ||
      log.locale.includes(searchFilter.toLowerCase()) ||
      log.modality.includes(searchFilter.toLowerCase())
  );

  return (
    <div>
      <div className="relative mb-4">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-neutral-400)]" />
        <input
          type="text"
          value={searchFilter}
          onChange={(e) => setSearchFilter(e.target.value)}
          placeholder="Filter queries by text, locale, or modality..."
          className="w-full rounded-lg border border-[var(--color-neutral-200)] bg-[var(--surface-primary)] py-2 pl-9 pr-4 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--color-primary-300)]"
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-[var(--color-neutral-100)] bg-[var(--surface-primary)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--color-neutral-100)] bg-[var(--color-neutral-50)]">
              <th className="px-4 py-3 text-left font-medium text-[var(--color-neutral-500)]">Query</th>
              <th className="px-4 py-3 text-left font-medium text-[var(--color-neutral-500)]">Lang</th>
              <th className="px-4 py-3 text-left font-medium text-[var(--color-neutral-500)]">Mode</th>
              <th className="px-4 py-3 text-left font-medium text-[var(--color-neutral-500)]">Confidence</th>
              <th className="px-4 py-3 text-left font-medium text-[var(--color-neutral-500)]">Latency</th>
              <th className="px-4 py-3 text-left font-medium text-[var(--color-neutral-500)]">Router</th>
              <th className="px-4 py-3 text-left font-medium text-[var(--color-neutral-500)]">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((log) => (
              <tr
                key={log.id}
                className="border-b border-[var(--color-neutral-50)] hover:bg-[var(--color-neutral-50)] transition-colors"
              >
                <td className="px-4 py-3 max-w-xs truncate text-[var(--color-neutral-700)]">
                  {log.query}
                </td>
                <td className="px-4 py-3">
                  <span className="rounded bg-[var(--color-neutral-100)] px-1.5 py-0.5 text-xs font-medium">
                    {log.locale.toUpperCase()}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                    log.modality === 'audio' ? 'bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400' :
                    log.modality === 'image' ? 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' :
                    'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
                  }`}>
                    {log.modality}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`text-xs font-medium ${
                      log.confidence >= 0.8
                        ? 'text-emerald-600'
                        : log.confidence >= 0.6
                          ? 'text-amber-600'
                          : 'text-red-600'
                    }`}
                  >
                    {(log.confidence * 100).toFixed(0)}%
                  </span>
                </td>
                <td className="px-4 py-3 text-[var(--color-neutral-500)]">
                  {log.latencyMs}ms
                </td>
                <td className="px-4 py-3">
                  <span className="rounded bg-[var(--color-neutral-100)] px-1.5 py-0.5 text-xs">
                    {log.routerType}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {log.escalated ? (
                    <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-600 dark:bg-red-900/30 dark:text-red-400">
                      Escalated
                    </span>
                  ) : (
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
                      OK
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TracesTab() {
  const [expandedTrace, setExpandedTrace] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-[var(--color-neutral-500)]">
        <DocumentMagnifyingGlassIcon className="h-4 w-4" />
        <span>Per-chunk retrieval trace for RAG pipeline audit</span>
      </div>

      {SAMPLE_TRACES.map((trace) => (
        <div
          key={trace.queryId}
          className="rounded-xl border border-[var(--color-neutral-100)] bg-[var(--surface-primary)] overflow-hidden"
        >
          <button
            onClick={() => setExpandedTrace(expandedTrace === trace.queryId ? null : trace.queryId)}
            className="flex w-full items-center justify-between px-5 py-4 text-left hover:bg-[var(--color-neutral-50)] transition-colors"
          >
            <div className="flex-1 min-w-0">
              <p className="truncate text-sm font-medium text-[var(--color-neutral-700)]">
                {trace.query}
              </p>
              <div className="mt-1 flex items-center gap-3 text-xs text-[var(--color-neutral-400)]">
                <span>{trace.chunks.length} chunks</span>
                <span>Confidence: {(trace.confidence * 100).toFixed(0)}%</span>
                <span>{trace.latencyMs}ms</span>
                <span className="font-mono text-[10px] bg-[var(--color-neutral-100)] px-1 rounded">
                  {trace.promptVersion}
                </span>
              </div>
            </div>
            <EyeIcon className="h-4 w-4 shrink-0 text-[var(--color-neutral-400)]" />
          </button>

          <AnimatePresence>
            {expandedTrace === trace.queryId && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden border-t border-[var(--color-neutral-100)]"
              >
                <div className="px-5 py-4">
                  <div className="mb-3 flex items-center gap-4 text-xs text-[var(--color-neutral-500)]">
                    <span>Model: <strong>{trace.generatorModel}</strong></span>
                    <span>Prompt: <code className="bg-[var(--color-neutral-100)] px-1 rounded">{trace.promptVersion}</code></span>
                  </div>

                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-[var(--color-neutral-100)]">
                        <th className="py-2 text-left font-medium text-[var(--color-neutral-500)]">Doc ID</th>
                        <th className="py-2 text-left font-medium text-[var(--color-neutral-500)]">Chunk</th>
                        <th className="py-2 text-left font-medium text-[var(--color-neutral-500)]">Similarity</th>
                        <th className="py-2 text-left font-medium text-[var(--color-neutral-500)]">Reranker</th>
                        <th className="py-2 text-left font-medium text-[var(--color-neutral-500)]">Visual</th>
                      </tr>
                    </thead>
                    <tbody>
                      {trace.chunks.map((chunk, i) => (
                        <tr key={i} className="border-b border-[var(--color-neutral-50)]">
                          <td className="py-2 font-mono text-[var(--color-neutral-600)]">{chunk.docId}</td>
                          <td className="py-2 font-mono text-[var(--color-neutral-600)]">{chunk.chunkId}</td>
                          <td className="py-2">
                            <span className={`font-medium ${chunk.similarityScore >= 0.9 ? 'text-emerald-600' : chunk.similarityScore >= 0.8 ? 'text-amber-600' : 'text-red-600'}`}>
                              {(chunk.similarityScore * 100).toFixed(1)}%
                            </span>
                          </td>
                          <td className="py-2">
                            <span className={`font-medium ${chunk.rerankerScore >= 0.9 ? 'text-emerald-600' : chunk.rerankerScore >= 0.8 ? 'text-amber-600' : 'text-red-600'}`}>
                              {(chunk.rerankerScore * 100).toFixed(1)}%
                            </span>
                          </td>
                          <td className="py-2">
                            <div className="flex items-center gap-1">
                              <div className="h-2 w-16 rounded-full bg-[var(--color-neutral-100)] overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-[var(--color-primary-400)]"
                                  style={{ width: `${chunk.rerankerScore * 100}%` }}
                                />
                              </div>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}
    </div>
  );
}

function EscalationsTab() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-[var(--color-neutral-500)]">
        <ExclamationTriangleIcon className="h-4 w-4 text-red-500" />
        <span>Queries requiring human review (confidence &lt; 0.55 or safety flagged)</span>
      </div>

      {SAMPLE_ESCALATIONS.map((esc) => (
        <div
          key={esc.id}
          className={`rounded-xl border bg-[var(--surface-primary)] p-5 ${
            esc.status === 'pending'
              ? 'border-red-200'
              : 'border-[var(--color-neutral-100)]'
          }`}
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-[var(--color-neutral-700)]">{esc.query}</p>
              <div className="mt-1 flex items-center gap-3 text-xs text-[var(--color-neutral-400)]">
                <span className="rounded bg-[var(--color-neutral-100)] px-1.5 py-0.5 font-medium">
                  {esc.locale.toUpperCase()}
                </span>
                <span className="text-red-500">
                  Confidence: {(esc.confidence * 100).toFixed(0)}%
                </span>
                <span>Reason: {esc.reason.replace('_', ' ')}</span>
                <span>{new Date(esc.timestamp).toLocaleString()}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {esc.status === 'pending' ? (
                <>
                  <button className="rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-600 hover:bg-emerald-100 transition-colors dark:bg-emerald-900/30 dark:text-emerald-400 dark:hover:bg-emerald-900/50">
                    <CheckCircleIcon className="mr-1 inline h-3.5 w-3.5" />
                    Verify
                  </button>
                  <button className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100 transition-colors dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50">
                    Flag
                  </button>
                </>
              ) : (
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
                  Reviewed
                </span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function SyncTab() {
  const [syncing, setSyncing] = useState(false);

  const sources = [
    { type: 'voter_roll', label: 'Voter Roll Data', lastSync: '2026-02-22T18:00:00Z', records: 245320 },
    { type: 'booth_data', label: 'Booth Locations', lastSync: '2026-02-22T18:00:00Z', records: 487 },
    { type: 'faq', label: 'FAQ Content', lastSync: '2026-02-21T12:00:00Z', records: 24 },
    { type: 'circular', label: 'ECI Circulars', lastSync: '2026-02-20T09:00:00Z', records: 156 },
  ];

  return (
    <div className="space-y-3">
      {sources.map((source) => (
        <div
          key={source.type}
          className="flex items-center justify-between rounded-xl border border-[var(--color-neutral-100)] bg-[var(--surface-primary)] p-4"
        >
          <div>
            <p className="font-medium text-[var(--color-neutral-800)]">{source.label}</p>
            <p className="mt-0.5 text-xs text-[var(--color-neutral-400)]">
              Last synced: {new Date(source.lastSync).toLocaleString()} · {source.records.toLocaleString()} records
            </p>
          </div>
          <button
            onClick={() => setSyncing(true)}
            disabled={syncing}
            className="flex items-center gap-1.5 rounded-lg bg-[var(--color-primary-50)] px-3 py-1.5 text-xs font-medium text-[var(--color-primary-600)] hover:bg-[var(--color-primary-100)] transition-colors disabled:opacity-50"
          >
            <ArrowPathIcon className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
            Sync
          </button>
        </div>
      ))}
    </div>
  );
}

function AuditTab() {
  const auditEntries = [
    { action: 'data_access', actor: 'admin_01', details: 'Exported query logs for Feb 2026', timestamp: '2026-02-23T09:00:00Z' },
    { action: 'admin_sync', actor: 'system', details: 'Synced voter roll data (245320 records)', timestamp: '2026-02-22T18:00:00Z' },
    { action: 'pii_redaction', actor: 'system', details: 'Redacted PII from 12 query responses', timestamp: '2026-02-22T17:30:00Z' },
    { action: 'escalation', actor: 'system', details: 'Escalated query #3 to human review', timestamp: '2026-02-23T10:30:00Z' },
    { action: 'data_deletion', actor: 'user_abc123', details: 'User deleted all memory data (GDPR)', timestamp: '2026-02-23T11:00:00Z' },
  ];

  return (
    <div className="space-y-2">
      {auditEntries.map((entry, i) => (
        <div
          key={i}
          className="flex items-start gap-3 rounded-xl border border-[var(--color-neutral-100)] bg-[var(--surface-primary)] p-4"
        >
          <div className="mt-0.5 rounded-lg bg-[var(--color-neutral-100)] p-1.5">
            <ClockIcon className="h-4 w-4 text-[var(--color-neutral-500)]" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                entry.action === 'escalation' ? 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400' :
                entry.action === 'data_deletion' ? 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' :
                'bg-[var(--color-neutral-100)] text-[var(--color-neutral-600)]'
              }`}>
                {entry.action}
              </span>
              <span className="text-xs text-[var(--color-neutral-400)]">
                by {entry.actor}
              </span>
            </div>
            <p className="mt-1 text-sm text-[var(--color-neutral-700)]">{entry.details}</p>
            <p className="mt-0.5 text-xs text-[var(--color-neutral-400)]">
              {new Date(entry.timestamp).toLocaleString()}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
