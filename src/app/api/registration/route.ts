/**
 * POST /api/registration — Registration Check
 */
import { NextRequest, NextResponse } from 'next/server';
import type { RegistrationCheckRequest, RegistrationCheckResponse } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const body: RegistrationCheckRequest = await request.json();
    const { voterId, name, dob, constituency } = body;

    // In production: query official voter roll API
    // This is a stub that returns demo data
    const found = !!(voterId || (name && dob));

    const response: RegistrationCheckResponse = {
      voter: found
        ? {
            epicNumber: voterId || 'KTM1234567',
            name: name || 'Demo Voter',
            nameMl: 'ഡെമോ വോട്ടർ',
            constituency: constituency || 'Kottayam',
            boothId: 'KTM-001',
            status: 'active',
          }
        : null,
      confidence: found ? 0.95 : 0.1,
      sources: [
        {
          title: 'CEO Kerala — Electoral Search',
          url: 'https://electoralsearch.eci.gov.in/',
          lastUpdated: '2026-01-15',
          excerpt: 'Official electoral search portal of Election Commission of India.',
        },
      ],
      message: found
        ? 'Voter registration found. Your details are verified.'
        : 'No matching voter registration found. Please verify your details.',
      messageMl: found
        ? 'വോട്ടർ രജിസ്ട്രേഷൻ കണ്ടെത്തി. നിങ്ങളുടെ വിശദാംശങ്ങൾ സ്ഥിരീകരിച്ചു.'
        : 'പൊരുത്തപ്പെടുന്ന വോട്ടർ രജിസ്ട്രേഷൻ കണ്ടെത്തിയില്ല. ദയവായി വിശദാംശങ്ങൾ പരിശോധിക്കുക.',
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Registration API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
