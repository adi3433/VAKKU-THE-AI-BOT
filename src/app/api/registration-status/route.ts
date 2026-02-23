/**
 * POST /api/registration-status — Voter Registration Status Check
 * ────────────────────────────────────────────────────────────────
 * Validates voter registration by EPIC number or name + DOB + constituency.
 * Returns registration status, polling details, and actionable steps.
 *
 * Request:  { epicNumber?, name?, dateOfBirth?, constituencyCode? }
 * Response: RegistrationStatusResponse
 */
import { NextRequest, NextResponse } from 'next/server';
import { hashIdentifier } from '@/lib/privacy';
import type { RegistrationStatusRequest, RegistrationStatusResponse } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const body: RegistrationStatusRequest = await request.json();
    const { epicNumber, name, dob: dateOfBirth, constituency: constituencyCode } = body;

    if (!epicNumber && !name) {
      return NextResponse.json(
        { error: 'Either epicNumber or name is required' },
        { status: 400 }
      );
    }

    // Validate EPIC format (3 letters + 7 digits)
    if (epicNumber && !/^[A-Z]{3}\d{7}$/.test(epicNumber)) {
      return NextResponse.json(
        { error: 'Invalid EPIC number format. Expected: 3 uppercase letters + 7 digits (e.g., ABC1234567)' },
        { status: 400 }
      );
    }

    // Audit log (PII-safe)
    console.log(
      JSON.stringify({
        type: 'registration_status_check',
        hasEpic: !!epicNumber,
        hasName: !!name,
        epicHash: epicNumber ? hashIdentifier(epicNumber) : undefined,
        constituencyCode,
        timestamp: new Date().toISOString(),
      })
    );

    // ── In production, this would query the CEO Kerala voter database ──
    // For now, return a structured mock based on input
    const response: RegistrationStatusResponse = {
      found: !!epicNumber,
      status: epicNumber ? 'active' : 'not_found',
      voterDetails: epicNumber
        ? {
            epicNumber,
            constituencyName: 'Kottayam',
            constituencyCode: constituencyCode ?? 'KTM',
            assemblyConstituency: 'Kottayam',
            pollingStation: 'Government Higher Secondary School',
            boothNumber: 42,
            partNumber: 7,
            serialNumber: 315,
          }
        : undefined,
      actionItems: epicNumber
        ? [
            {
              id: 'verify_details',
              label: 'Verify your details before election day',
              labelMl: 'തിരഞ്ഞെടുപ്പ് ദിനത്തിന് മുമ്പ് നിങ്ങളുടെ വിവരങ്ങൾ പരിശോധിക്കുക',
              icon: 'CheckCircleIcon',
              action: 'verify_details',
            },
            {
              id: 'locate_booth',
              label: 'Find directions to your polling booth',
              labelMl: 'നിങ്ങളുടെ പോളിംഗ് ബൂത്തിലേക്കുള്ള ദിശ കണ്ടെത്തുക',
              icon: 'MapPinIcon',
              action: 'locate_booth',
            },
          ]
        : [
            {
              id: 'register_new',
              label: 'Apply for new voter registration (Form 6)',
              labelMl: 'പുതിയ വോട്ടർ രജിസ്ട്രേഷനായി അപേക്ഷിക്കുക (ഫോം 6)',
              icon: 'DocumentPlusIcon',
              action: 'register_new',
            },
          ],
      message: epicNumber
        ? 'Your voter registration is active. Please verify your details.'
        : 'No registration found. You can apply for new voter registration using Form 6.',
      messageMl: epicNumber
        ? 'നിങ്ങളുടെ വോട്ടർ രജിസ്ട്രേഷൻ സജീവമാണ്. ദയവായി നിങ്ങളുടെ വിവരങ്ങൾ പരിശോധിക്കുക.'
        : 'രജിസ്ട്രേഷൻ കണ്ടെത്തിയില്ല. ഫോം 6 ഉപയോഗിച്ച് പുതിയ വോട്ടർ രജിസ്ട്രേഷനായി അപേക്ഷിക്കാം.',
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Registration status error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
