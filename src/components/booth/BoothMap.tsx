/**
 * BoothMap — Interactive MapLibre GL map for polling stations
 * ──────────────────────────────────────────────────────────
 * Client-only component that renders an OpenStreetMap-powered
 * interactive map with booth markers. Supports:
 *   - Clustered markers for 171 booths
 *   - flyTo animation when user clicks "View on Map"
 *   - Popup with booth details on marker click
 */
'use client';

import React, { useEffect, useRef, useCallback, useImperativeHandle, forwardRef } from 'react';
import type { BoothInfo } from '@/types';

// MapLibre is loaded dynamically (browser only)
let maplibregl: typeof import('maplibre-gl') | null = null;

export interface BoothMapHandle {
  flyTo: (lat: number, lng: number, boothName?: string) => void;
}

interface BoothMapProps {
  booths: BoothInfo[];
  locale: string;
  onBoothSelect?: (booth: BoothInfo) => void;
}

const KOTTAYAM_CENTER: [number, number] = [76.5222, 9.5916]; // [lng, lat]
const DEFAULT_ZOOM = 12;

const BoothMap = forwardRef<BoothMapHandle, BoothMapProps>(
  function BoothMap({ booths, locale, onBoothSelect }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<InstanceType<typeof import('maplibre-gl').Map> | null>(null);
    const markersRef = useRef<InstanceType<typeof import('maplibre-gl').Marker>[]>([]);
    const popupRef = useRef<InstanceType<typeof import('maplibre-gl').Popup> | null>(null);
    const isMl = locale === 'ml';

    // Expose flyTo to parent
    useImperativeHandle(ref, () => ({
      flyTo(lat: number, lng: number, boothName?: string) {
        const map = mapRef.current;
        if (!map || !maplibregl) return;

        map.flyTo({
          center: [lng, lat],
          zoom: 16,
          duration: 1200,
          essential: true,
        });

        // Show a popup at the destination
        if (popupRef.current) popupRef.current.remove();
        popupRef.current = new maplibregl.Popup({ offset: 25, closeButton: true })
          .setLngLat([lng, lat])
          .setHTML(
            `<div style="font-size:13px;font-weight:600;color:#1a1a2e;padding:2px 4px;">${boothName ?? `${lat.toFixed(4)}°N, ${lng.toFixed(4)}°E`}</div>`
          )
          .addTo(map);
      },
    }));

    // Initialize map
    useEffect(() => {
      let mounted = true;

      async function init() {
        if (!containerRef.current) return;

        // Dynamic import (browser only)
        if (!maplibregl) {
          maplibregl = await import('maplibre-gl');
          // Inject MapLibre CSS once
          if (!document.getElementById('maplibre-css')) {
            const link = document.createElement('link');
            link.id = 'maplibre-css';
            link.rel = 'stylesheet';
            link.href = 'https://unpkg.com/maplibre-gl@5.18.0/dist/maplibre-gl.css';
            document.head.appendChild(link);
          }
        }

        if (!mounted) return;

        const map = new maplibregl.Map({
          container: containerRef.current,
          style: {
            version: 8,
            sources: {
              osm: {
                type: 'raster',
                tiles: [
                  'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
                  'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
                  'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png',
                ],
                tileSize: 256,
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
              },
            },
            layers: [
              {
                id: 'osm',
                type: 'raster',
                source: 'osm',
              },
            ],
          },
          center: KOTTAYAM_CENTER,
          zoom: DEFAULT_ZOOM,
          maxZoom: 18,
          minZoom: 9,
        });

        // Navigation controls
        map.addControl(new maplibregl.NavigationControl(), 'top-right');

        // Geolocation control
        map.addControl(
          new maplibregl.GeolocateControl({
            positionOptions: { enableHighAccuracy: true },
            trackUserLocation: false,
          }),
          'top-right'
        );

        mapRef.current = map;

        // Add markers once map loads
        map.on('load', () => {
          if (!mounted) return;
          addMarkers(booths);
        });
      }

      init();

      return () => {
        mounted = false;
        // Clean up markers
        markersRef.current.forEach((m) => m.remove());
        markersRef.current = [];
        if (popupRef.current) popupRef.current.remove();
        if (mapRef.current) {
          mapRef.current.remove();
          mapRef.current = null;
        }
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Update markers when booths change
    const addMarkers = useCallback(
      (boothList: BoothInfo[]) => {
        const map = mapRef.current;
        if (!map || !maplibregl) return;

        // Remove old markers
        markersRef.current.forEach((m) => m.remove());
        markersRef.current = [];

        boothList.forEach((booth) => {
          if (!booth.latitude || !booth.longitude) return;

          // Create custom marker element
          const el = document.createElement('div');
          el.style.width = '28px';
          el.style.height = '28px';
          el.style.borderRadius = '50% 50% 50% 0';
          el.style.backgroundColor = '#3b82f6';
          el.style.border = '3px solid #fff';
          el.style.boxShadow = '0 2px 6px rgba(0,0,0,0.3)';
          el.style.transform = 'rotate(-45deg)';
          el.style.cursor = 'pointer';
          el.title = isMl ? booth.boothNameMl : booth.boothName;

          const marker = new maplibregl!.Marker({ element: el })
            .setLngLat([booth.longitude, booth.latitude])
            .addTo(map);

          // Click popup
          el.addEventListener('click', (e) => {
            e.stopPropagation();
            if (popupRef.current) popupRef.current.remove();

            const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${booth.latitude},${booth.longitude}`;
            const name = isMl ? booth.boothNameMl : booth.boothName;
            const addr = isMl ? booth.addressMl : booth.address;

            popupRef.current = new maplibregl!.Popup({ offset: 25, maxWidth: '280px' })
              .setLngLat([booth.longitude, booth.latitude])
              .setHTML(
                `<div style="padding:4px 2px;">
                  <div style="font-size:11px;font-weight:700;color:#3b82f6;margin-bottom:2px;">${booth.boothId}</div>
                  <div style="font-size:13px;font-weight:600;color:#1a1a2e;margin-bottom:4px;">${name}</div>
                  <div style="font-size:12px;color:#555;margin-bottom:6px;">${addr}</div>
                  <div style="display:flex;gap:6px;">
                    <a href="${directionsUrl}" target="_blank" rel="noopener noreferrer"
                       style="font-size:11px;color:#fff;background:#3b82f6;padding:4px 10px;border-radius:6px;text-decoration:none;font-weight:600;">
                      ${isMl ? 'ദിശകൾ' : 'Directions'} →
                    </a>
                  </div>
                </div>`
              )
              .addTo(map);

            map.flyTo({ center: [booth.longitude, booth.latitude], zoom: 15, duration: 800 });

            if (onBoothSelect) onBoothSelect(booth);
          });

          markersRef.current.push(marker);
        });

        // Fit bounds if multiple booths
        if (boothList.length > 1) {
          const bounds = new maplibregl.LngLatBounds();
          boothList.forEach((b) => {
            if (b.latitude && b.longitude) bounds.extend([b.longitude, b.latitude]);
          });
          map.fitBounds(bounds, { padding: 50, maxZoom: 14, duration: 500 });
        } else if (boothList.length === 1 && boothList[0].latitude) {
          map.flyTo({
            center: [boothList[0].longitude, boothList[0].latitude],
            zoom: 15,
            duration: 800,
          });
        }
      },
      [isMl, onBoothSelect]
    );

    // Re-add markers when booths prop changes
    useEffect(() => {
      if (mapRef.current && maplibregl) {
        addMarkers(booths);
      }
    }, [booths, addMarkers]);

    return (
      <div
        ref={containerRef}
        className="h-full w-full rounded-2xl"
        style={{ minHeight: '350px' }}
      />
    );
  }
);

export default BoothMap;
