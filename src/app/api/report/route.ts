/**
 * POST /api/report — Violation Report Submission
 * ────────────────────────────────────────────────
 * API Contract:
 *   Request:  { type, description, location?, mediaIds?, locale }
 *   Response: { referenceNumber, status: 'submitted', message, messageMl }
 */
import { NextRequest, NextResponse } from 'next/server';
import { hashIdentifier } from '@/lib/privacy';
import { getSupabaseClient, isSupabaseConfigured } from '@/lib/supabase';
import type { ViolationReportRequest, ViolationReportResponse } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const body: ViolationReportRequest = await request.json();
    const { type, description, location, mediaIds, locale } = body;

    if (!description?.trim()) {
      return NextResponse.json(
        { error: 'Description is required' },
        { status: 400 }
      );
    }

    // Generate reference number and ID
    const referenceNumber = `SVEEP-KTM-${Date.now().toString(36).toUpperCase()}`;
    const id = `report_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    // Persist to Supabase
    let dbError: { message: string } | null = null;
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseClient();
      const result = await supabase
        .from('violation_reports')
        .insert({
          id,
          reference_number: referenceNumber,
          type: type || 'other',
          description: description.trim(),
          location: location ? JSON.parse(JSON.stringify(location)) : null,
          media_ids: mediaIds ?? [],
          locale: locale || 'en',
          status: 'submitted',
        });
      dbError = result.error;
    }

    if (dbError) {
      console.error('Failed to persist report to Supabase:', dbError.message);
      // Still return success — report was received even if DB write fails
    }

    console.log(
      JSON.stringify({
        type: 'violation_report',
        referenceNumber,
        violationType: type,
        hasLocation: !!location,
        mediaCount: mediaIds?.length ?? 0,
        persisted: !dbError,
        timestamp: new Date().toISOString(),
      })
    );

    const response: ViolationReportResponse = {
      referenceNumber,
      status: 'submitted',
      message: `Your report has been submitted with reference number ${referenceNumber}. We will review it shortly.`,
      messageMl: `നിങ്ങളുടെ റിപ്പോർട്ട് ${referenceNumber} റഫറൻസ് നമ്പറിൽ സമർപ്പിച്ചു. ഞങ്ങൾ ഉടൻ പരിശോധിക്കും.`,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Report API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
