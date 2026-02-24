/**
 * Booth Data Service — Kottayam District LAC 97
 * ───────────────────────────────────────────────
 * Loads 171 official polling station records from kottayam_booth_data.json.
 * Provides:
 *   - Full-text fuzzy search by area, name, landmark, station number
 *   - GPS coordinate extraction for Google Maps links
 *   - Malayalam + English content
 *   - BM25-style search for direct queries
 */

import boothDataRaw from '@/../kottayam_booth_data.json';

// ── Types ────────────────────────────────────────────────────────

export interface BoothRecord {
  id: string;
  stationNumber: number;
  title: string;
  content: string;
  contentMl: string;
  source: string;
  sourceUrl: string;
  tags: string[];
  /** Latitude (decimal degrees) */
  lat: number;
  /** Longitude (decimal degrees) */
  lng: number;
  /** Landmark near the polling station */
  landmark: string;
  /** Area/sector name in Malayalam */
  areaMl: string;
}

// ── Parse raw JSON into typed records ────────────────────────────

function parseCoordinates(content: string): { lat: number; lng: number } {
  // Pattern: "located at 9.6384 N, 76.5367 E"
  const match = content.match(/([\d.]+)\s*N,?\s*([\d.]+)\s*E/);
  if (match) {
    return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };
  }
  return { lat: 0, lng: 0 };
}

function parseLandmark(content: string): string {
  // Pattern: "identified by the landmark: Near Hotel Excalibur, Thellakom"
  const match = content.match(/landmark:\s*([^.]+)/i);
  return match ? match[1].trim() : '';
}

let _booths: BoothRecord[] | null = null;

export function getAllBooths(): BoothRecord[] {
  if (_booths) return _booths;

  _booths = (boothDataRaw as Array<{
    id: string;
    title: string;
    content: string;
    content_ml: string;
    source: string;
    source_url: string;
    tags: (string | number)[];
  }>).map((raw) => {
    const coords = parseCoordinates(raw.content);
    const stationNumber = typeof raw.tags[0] === 'number' ? raw.tags[0] : parseInt(String(raw.tags[0]), 10);

    return {
      id: raw.id,
      stationNumber,
      title: raw.title,
      content: raw.content,
      contentMl: raw.content_ml,
      source: raw.source,
      sourceUrl: raw.source_url,
      tags: raw.tags.map(String),
      lat: coords.lat,
      lng: coords.lng,
      landmark: parseLandmark(raw.content),
      areaMl: typeof raw.tags[3] === 'string' ? raw.tags[3] : '',
    };
  });

  return _booths;
}

// ── Google Maps URL ──────────────────────────────────────────────

export function getGoogleMapsUrl(lat: number, lng: number, label?: string): string {
  const q = label ? encodeURIComponent(label) : `${lat},${lng}`;
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}&query_place_id=${q}`;
}

export function getGoogleMapsDirectionsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

// ── Search booths ────────────────────────────────────────────────

/**
 * Search booths by query string. Uses multi-signal scoring:
 *   - Exact station number match (highest priority)
 *   - Title / area name match
 *   - Landmark match
 *   - Tag match (includes Malayalam area names)
 *   - BM25-style content match
 */
export function searchBooths(query: string, maxResults = 5): BoothRecord[] {
  const booths = getAllBooths();
  const lowerQuery = query.toLowerCase().trim();

  // Check for station number query (e.g., "booth 5", "station 42", "booth number is 133", "ബൂത്ത് 133")
  const numberMatch = lowerQuery.match(/(?:booth|station|polling\s*station)\s*(?:number\s*(?:is\s*)?)?(\ d+)/i)
    || lowerQuery.match(/(?:number|no\.?|#)\s*(?:is\s*)?(\d+)/i)
    || lowerQuery.match(/^(\d{1,3})$/)
    || query.match(/(?:ബൂത്ത്|നമ്പർ|പോളിംഗ്|പോളിങ്|സ്റ്റേഷൻ)\s*(?:നമ്പർ\s*)?(?:ആണ്\s*)?(\d+)/i)
    || query.match(/(\d+)\s*(?:ആണ്|ആണ)\s*$/i);
  if (numberMatch) {
    const num = parseInt(numberMatch[1], 10);
    const exact = booths.filter((b) => b.stationNumber === num);
    if (exact.length > 0) return exact.slice(0, maxResults);
  }

  // Score each booth
  const scored = booths.map((booth) => {
    let score = 0;
    const titleLower = booth.title.toLowerCase();
    const landmarkLower = booth.landmark.toLowerCase();
    const tagsLower = booth.tags.map((t) => t.toLowerCase());
    const contentLower = booth.content.toLowerCase();

    // Query terms
    const queryTerms = lowerQuery.split(/\s+/).filter((t) => t.length > 2);

    // Title match (high weight)
    if (titleLower.includes(lowerQuery)) score += 10;
    for (const term of queryTerms) {
      if (titleLower.includes(term)) score += 3;
    }

    // Landmark match
    if (landmarkLower.includes(lowerQuery)) score += 8;
    for (const term of queryTerms) {
      if (landmarkLower.includes(term)) score += 2;
    }

    // Tag match (includes Malayalam area names like "മുടിയൂർക്കര")
    for (const tag of tagsLower) {
      if (tag.includes(lowerQuery)) score += 7;
      for (const term of queryTerms) {
        if (tag.includes(term)) score += 2;
      }
    }

    // Malayalam area match
    if (booth.areaMl && query.includes(booth.areaMl)) score += 9;

    // Content BM25-style
    for (const term of queryTerms) {
      const count = (contentLower.match(new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
      score += count * 0.5;
    }

    return { booth, score };
  });

  // Sort by score descending and return top results
  scored.sort((a, b) => b.score - a.score);
  return scored
    .filter((s) => s.score > 0)
    .slice(0, maxResults)
    .map((s) => s.booth);
}

/**
 * Format a booth result as a human-readable string with map link.
 */
export function formatBoothResult(booth: BoothRecord, locale: 'en' | 'ml'): string {
  const mapsUrl = getGoogleMapsDirectionsUrl(booth.lat, booth.lng);

  if (locale === 'ml') {
    return `**പോളിംഗ് സ്റ്റേഷൻ ${booth.stationNumber}** — ${booth.title}
- **ലാൻഡ്‌മാർക്ക്:** ${booth.landmark}
- **GPS:** ${booth.lat}°N, ${booth.lng}°E
- [Google Maps-ൽ വഴി കാണുക](${mapsUrl})`;
  }

  return `**Polling Station ${booth.stationNumber}** — ${booth.title}
- **Landmark:** ${booth.landmark}
- **GPS:** ${booth.lat}°N, ${booth.lng}°E
- [Get Directions](${mapsUrl})`;
}

// ── GPS-based nearest booth search (Haversine) ────────────────────

/**
 * Haversine distance in kilometers between two GPS coordinates.
 */
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Find nearest polling booths by GPS coordinates.
 * Only considers booths that have valid GPS data (lat/lng > 0).
 * Returns booths sorted by distance, with distance in km attached.
 */
export function searchNearestBooths(
  lat: number,
  lng: number,
  maxResults = 5,
  maxDistanceKm = 10
): Array<BoothRecord & { distanceKm: number }> {
  const booths = getAllBooths();

  const withDistance = booths
    .filter((b) => b.lat > 0 && b.lng > 0) // Only booths with valid GPS
    .map((booth) => ({
      ...booth,
      distanceKm: haversineDistance(lat, lng, booth.lat, booth.lng),
    }))
    .filter((b) => b.distanceKm <= maxDistanceKm) // Within max radius
    .sort((a, b) => a.distanceKm - b.distanceKm); // Closest first

  return withDistance.slice(0, maxResults);
}

/**
 * Format a nearest booth result with distance info.
 */
export function formatNearestBoothResult(
  booth: BoothRecord & { distanceKm: number },
  locale: 'en' | 'ml'
): string {
  const mapsUrl = getGoogleMapsDirectionsUrl(booth.lat, booth.lng);
  const distStr = booth.distanceKm < 1
    ? `${Math.round(booth.distanceKm * 1000)}m`
    : `${booth.distanceKm.toFixed(1)}km`;

  if (locale === 'ml') {
    return `**പോളിംഗ് സ്റ്റേഷൻ ${booth.stationNumber}** — ${booth.title}
- **ദൂരം:** 📍 ${distStr}
- **ലാൻഡ്‌മാർക്ക്:** ${booth.landmark}
- **GPS:** ${booth.lat}°N, ${booth.lng}°E
- [Google Maps-ൽ വഴി കാണുക](${mapsUrl})`;
  }

  return `**Polling Station ${booth.stationNumber}** — ${booth.title}
- **Distance:** 📍 ${distStr}
- **Landmark:** ${booth.landmark}
- **GPS:** ${booth.lat}°N, ${booth.lng}°E
- [Get Directions](${mapsUrl})`;
}
