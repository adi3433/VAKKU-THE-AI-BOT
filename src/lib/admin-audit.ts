/**
 * Admin Audit API — Query Log & Escalation Endpoints
 * ────────────────────────────────────────────────────
 * GET /api/admin/query-log     — Paginated query logs for EC review
 * GET /api/admin/escalations   — Filtered escalation queue
 * GET /api/admin/stats         — Aggregate statistics dashboard
 *
 * All endpoints require x-admin-token header for access.
 * PII is hashed in all responses.
 */
import { NextRequest, NextResponse } from 'next/server';
import { hashIdentifier } from '@/lib/privacy';
import type { QueryLog, AuditLogEntry, Locale } from '@/types';

// ── In-memory audit store (production: use PostgreSQL/ClickHouse) ─

interface InternalQueryLog extends QueryLog {
  rerankerScores?: number[];
  generatorModel?: string;
  promptVersionHash?: string;
  routerType?: string;
  modality?: string;
  trace?: Record<string, unknown>;
}

// Singleton audit store
const queryLogs: InternalQueryLog[] = [];
const auditEntries: AuditLogEntry[] = [];
const MAX_LOGS = 10_000; // Memory cap

/**
 * Record a query for audit purposes.
 * Called from API routes after processing.
 */
export function recordQueryLog(log: InternalQueryLog): void {
  queryLogs.push(log);
  if (queryLogs.length > MAX_LOGS) {
    queryLogs.splice(0, queryLogs.length - MAX_LOGS);
  }
}

/**
 * Record an audit event.
 */
export function recordAuditEntry(entry: AuditLogEntry): void {
  auditEntries.push(entry);
  if (auditEntries.length > MAX_LOGS) {
    auditEntries.splice(0, auditEntries.length - MAX_LOGS);
  }
}

/**
 * Get all query logs (for direct access from admin pages)
 */
export function getQueryLogs(): InternalQueryLog[] {
  return queryLogs;
}

/**
 * Get all audit entries
 */
export function getAuditEntries(): AuditLogEntry[] {
  return auditEntries;
}

// ── Auth check ───────────────────────────────────────────────────

function validateAdminToken(request: NextRequest): boolean {
  const token = request.headers.get('x-admin-token');
  const expectedToken = process.env.ADMIN_API_TOKEN;
  if (!expectedToken) {
    console.warn('ADMIN_API_TOKEN not configured — admin endpoints disabled');
    return false;
  }
  return token === expectedToken;
}

function unauthorizedResponse(): NextResponse {
  return NextResponse.json(
    { error: 'Unauthorized. Provide valid x-admin-token header.' },
    { status: 401 }
  );
}

// ── Query log endpoint ───────────────────────────────────────────

export function handleQueryLogGet(request: NextRequest): NextResponse {
  if (!validateAdminToken(request)) return unauthorizedResponse();

  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get('page') || '1', 10);
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 200);
  const locale = url.searchParams.get('locale') as Locale | null;
  const minConfidence = parseFloat(url.searchParams.get('minConfidence') || '0');
  const maxConfidence = parseFloat(url.searchParams.get('maxConfidence') || '1');
  const escalatedOnly = url.searchParams.get('escalated') === 'true';
  const since = url.searchParams.get('since'); // ISO date
  const until = url.searchParams.get('until'); // ISO date
  const format = url.searchParams.get('format') || 'json'; // json or csv

  // Filter
  let filtered = queryLogs.filter((log) => {
    if (locale && log.locale !== locale) return false;
    if (log.confidence < minConfidence || log.confidence > maxConfidence) return false;
    if (escalatedOnly && !log.escalated) return false;
    if (since && log.timestamp < since) return false;
    if (until && log.timestamp > until) return false;
    return true;
  });

  // Sort newest first
  filtered.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  const total = filtered.length;
  const offset = (page - 1) * limit;
  const paginated = filtered.slice(offset, offset + limit);

  // CSV export
  if (format === 'csv') {
    const headers = ['id', 'timestamp', 'locale', 'confidence', 'escalated', 'latencyMs', 'routerType', 'modality', 'sourcesCount'];
    const rows = paginated.map((log) =>
      [log.id, log.timestamp, log.locale, log.confidence, log.escalated, log.latencyMs, log.routerType || '', log.modality || '', log.sources.length].join(',')
    );
    const csv = [headers.join(','), ...rows].join('\n');

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="query-log-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  }

  return NextResponse.json({
    data: paginated,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
    filters: { locale, minConfidence, maxConfidence, escalatedOnly, since, until },
  });
}

// ── Escalations endpoint ─────────────────────────────────────────

export function handleEscalationsGet(request: NextRequest): NextResponse {
  if (!validateAdminToken(request)) return unauthorizedResponse();

  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get('page') || '1', 10);
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 200);
  const since = url.searchParams.get('since');

  let escalated = queryLogs.filter((log) => {
    if (!log.escalated) return false;
    if (since && log.timestamp < since) return false;
    return true;
  });

  escalated.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  const total = escalated.length;
  const offset = (page - 1) * limit;
  const paginated = escalated.slice(offset, offset + limit);

  return NextResponse.json({
    data: paginated,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    summary: {
      totalEscalations: total,
      avgConfidence: total > 0
        ? Math.round((escalated.reduce((s, l) => s + l.confidence, 0) / total) * 100) / 100
        : 0,
      byLocale: {
        en: escalated.filter((l) => l.locale === 'en').length,
        ml: escalated.filter((l) => l.locale === 'ml').length,
      },
    },
  });
}

// ── Stats endpoint ───────────────────────────────────────────────

export function handleStatsGet(request: NextRequest): NextResponse {
  if (!validateAdminToken(request)) return unauthorizedResponse();

  const total = queryLogs.length;
  const escalatedCount = queryLogs.filter((l) => l.escalated).length;
  const avgConfidence = total > 0
    ? Math.round((queryLogs.reduce((s, l) => s + l.confidence, 0) / total) * 100) / 100
    : 0;
  const avgLatency = total > 0
    ? Math.round(queryLogs.reduce((s, l) => s + l.latencyMs, 0) / total)
    : 0;

  const byLocale = {
    en: queryLogs.filter((l) => l.locale === 'en').length,
    ml: queryLogs.filter((l) => l.locale === 'ml').length,
  };

  const byRouterType: Record<string, number> = {};
  for (const log of queryLogs) {
    const rt = log.routerType || 'unknown';
    byRouterType[rt] = (byRouterType[rt] || 0) + 1;
  }

  const last24h = queryLogs.filter(
    (l) => new Date(l.timestamp).getTime() > Date.now() - 86400000
  ).length;

  return NextResponse.json({
    totalQueries: total,
    totalEscalations: escalatedCount,
    escalationRate: total > 0 ? Math.round((escalatedCount / total) * 10000) / 100 : 0,
    avgConfidence,
    avgLatencyMs: avgLatency,
    byLocale,
    byRouterType,
    queriesLast24h: last24h,
    auditEntriesCount: auditEntries.length,
  });
}
