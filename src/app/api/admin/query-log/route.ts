/**
 * GET /api/admin/query-log — Paginated query log for EC review
 *
 * Query Params:
 *   page (number) — Page number (default: 1)
 *   limit (number) — Results per page (default: 50, max: 200)
 *   locale (en|ml) — Filter by locale
 *   minConfidence (float) — Minimum confidence
 *   maxConfidence (float) — Maximum confidence
 *   escalated (true) — Only escalated queries
 *   since (ISO date) — Start date filter
 *   until (ISO date) — End date filter
 *   format (json|csv) — Response format (default: json)
 *
 * Headers: x-admin-token (required)
 */
import { NextRequest } from 'next/server';
import { handleQueryLogGet } from '@/lib/admin-audit';

export async function GET(request: NextRequest) {
  return handleQueryLogGet(request);
}
