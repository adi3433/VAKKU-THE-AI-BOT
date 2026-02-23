/**
 * POST /api/data-access — GDPR-style data access/deletion
 */
import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuid } from 'uuid';
import type { DataAccessRequest, DataAccessResponse } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const body: DataAccessRequest = await request.json();
    const { userId, type } = body;

    if (!userId || !type) {
      return NextResponse.json(
        { error: 'userId and type are required' },
        { status: 400 }
      );
    }

    const requestId = uuid();

    // Log audit entry
    console.log(
      JSON.stringify({
        type: 'data_access_request',
        requestId,
        action: type,
        timestamp: new Date().toISOString(),
      })
    );

    const response: DataAccessResponse = {
      requestId,
      status: 'processing',
      message:
        type === 'export'
          ? 'Your data export is being prepared. You will receive a download link within 24 hours.'
          : 'Your data deletion request has been received. All personal data will be removed within 72 hours.',
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Data access API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
