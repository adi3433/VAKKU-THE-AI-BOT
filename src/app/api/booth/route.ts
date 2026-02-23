/**
 * GET /api/booth — Polling Booth Locator (Kottayam LAC 97)
 * ──────────────────────────────────────────────────────────
 * API Contract:
 *   Query params: q? (search text), station_number?, voter_id?, constituency?
 *   Response: { booths[], matchedVoter?, confidence, source }
 *
 * Uses real data from kottayam_booth_data.json (171 polling stations).
 */
import { NextRequest, NextResponse } from 'next/server';
import type { BoothSearchResponse, BoothInfo, ChatSource } from '@/types';
import { searchBooths, getAllBooths, getGoogleMapsDirectionsUrl, type BoothRecord } from '@/lib/booth-data';

function boothRecordToBoothInfo(record: BoothRecord): BoothInfo {
  return {
    boothId: record.id,
    boothName: record.title,
    boothNameMl: record.title, // title is same; ML details in content_ml
    address: `${record.landmark}, LAC 97-Kottayam`,
    addressMl: record.areaMl ? `${record.areaMl}, LAC 97-കോട്ടയം` : `LAC 97-കോട്ടയം`,
    latitude: record.lat,
    longitude: record.lng,
    constituency: 'Kottayam',
    ward: `Station ${record.stationNumber}`,
    facilities: ['Ramp', 'Drinking Water', 'Queue Management'],
    accessibility: true,
  };
}

const SOURCE: ChatSource = {
  title: 'Election Commission of India — Official Booth List LAC 97-Kottayam',
  url: 'https://kottayam.nic.in/en/election/',
  lastUpdated: '2026-02-01',
  excerpt: 'Official polling station data from District 10-Kottayam, LAC 97.',
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');
  const stationNumber = searchParams.get('station_number');
  const voterId = searchParams.get('voter_id');
  const constituency = searchParams.get('constituency');

  let results: BoothRecord[] = [];

  // Search by station number
  if (stationNumber) {
    const num = parseInt(stationNumber, 10);
    results = getAllBooths().filter((b) => b.stationNumber === num);
  }
  // Search by text query
  else if (query) {
    results = searchBooths(query, 5);
  }
  // Search by constituency (filters)
  else if (constituency) {
    results = searchBooths(constituency, 10);
  }
  // No search params — return all
  else {
    results = getAllBooths().slice(0, 10); // first 10 for browsing
  }

  const boothInfos: BoothInfo[] = results.map(boothRecordToBoothInfo);

  const response: BoothSearchResponse = {
    booths: boothInfos,
    matchedVoter: voterId
      ? {
          epicNumber: voterId,
          name: 'Voter',
          nameMl: 'വോട്ടർ',
          constituency: 'Kottayam',
          boothId: results[0]?.id ?? 'unknown',
          status: 'active',
        }
      : undefined,
    confidence: results.length > 0 ? 0.95 : 0.3,
    source: SOURCE,
  };

  return NextResponse.json(response);
}
