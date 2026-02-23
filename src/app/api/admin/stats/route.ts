/**
 * GET /api/admin/stats — Aggregate dashboard statistics
 *
 * Headers: x-admin-token (required)
 *
 * Response:
 *   totalQueries, totalEscalations, escalationRate,
 *   avgConfidence, avgLatencyMs, byLocale, byRouterType,
 *   queriesLast24h, auditEntriesCount
 */
import { NextRequest } from 'next/server';
import { handleStatsGet } from '@/lib/admin-audit';

export async function GET(request: NextRequest) {
  return handleStatsGet(request);
}
