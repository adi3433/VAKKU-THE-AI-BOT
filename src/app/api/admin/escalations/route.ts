/**
 * GET /api/admin/escalations — Escalation queue for review
 *
 * Query Params:
 *   page (number) — Page number (default: 1)
 *   limit (number) — Results per page (default: 50, max: 200)
 *   since (ISO date) — Start date filter
 *
 * Headers: x-admin-token (required)
 */
import { NextRequest } from 'next/server';
import { handleEscalationsGet } from '@/lib/admin-audit';

export async function GET(request: NextRequest) {
  return handleEscalationsGet(request);
}
