/**
 * useDeviceOrientation — Motion Sensor Hook
 * ──────────────────────────────────────────
 * Reads accelerometer / gyroscope via DeviceOrientationEvent.
 * Falls back gracefully when not available (desktop, denied permissions).
 *
 * Motion spec:
 *   Trigger: device tilt
 *   Duration: real-time (60fps)
 *   Easing: none (direct mapping)
 *   Fallback: mouse position on desktop -> scroll parallax on static
 */
'use client';

import { useEffect, useState, useCallback, useRef } from 'react';

interface OrientationData {
  /** Left/right tilt in degrees (-90 to 90) */
  gamma: number;
  /** Front/back tilt in degrees (-180 to 180) */
  beta: number;
  /** Compass heading (0 to 360) */
  alpha: number;
  /** Whether device orientation is supported & active */
  isSupported: boolean;
  /** Whether permission has been granted (iOS 13+ requirement) */
  hasPermission: boolean;
  /** Request permission (needed on iOS 13+) */
  requestPermission: () => Promise<boolean>;
}

export function useDeviceOrientation(): OrientationData {
  const [orientation, setOrientation] = useState({
    gamma: 0,
    beta: 0,
    alpha: 0,
  });
  const [isSupported, setIsSupported] = useState(false);
  const [hasPermission, setHasPermission] = useState(false);
  const rafRef = useRef<number | null>(null);
  const latestRef = useRef({ gamma: 0, beta: 0, alpha: 0 });

  // Throttled update via rAF
  const handleOrientation = useCallback((event: DeviceOrientationEvent) => {
    latestRef.current = {
      gamma: event.gamma ?? 0,
      beta: event.beta ?? 0,
      alpha: event.alpha ?? 0,
    };

    if (rafRef.current === null) {
      rafRef.current = requestAnimationFrame(() => {
        setOrientation({ ...latestRef.current });
        rafRef.current = null;
      });
    }
  }, []);

  // iOS 13+ permission request
  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (
      typeof DeviceOrientationEvent !== 'undefined' &&
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      typeof (DeviceOrientationEvent as any).requestPermission === 'function'
    ) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const permission = await (DeviceOrientationEvent as any).requestPermission();
        const granted = permission === 'granted';
        setHasPermission(granted);
        return granted;
      } catch {
        setHasPermission(false);
        return false;
      }
    }
    // Non-iOS: permission not needed
    setHasPermission(true);
    return true;
  }, []);

  useEffect(() => {
    const supported = typeof window !== 'undefined' && 'DeviceOrientationEvent' in window;
    // Use a ref to avoid calling setState in effect body
    if (supported !== isSupported) {
      // Defer state update to avoid synchronous setState in effect
      queueMicrotask(() => setIsSupported(supported));
    }

    if (!supported) return;

    // Auto-check if permission is already granted (non-iOS)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (typeof (DeviceOrientationEvent as any).requestPermission !== 'function') {
      queueMicrotask(() => setHasPermission(true));
      window.addEventListener('deviceorientation', handleOrientation, { passive: true });
    }

    return () => {
      window.removeEventListener('deviceorientation', handleOrientation);
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [handleOrientation]); // eslint-disable-line react-hooks/exhaustive-deps

  // Add listener after permission is granted on iOS
  useEffect(() => {
    if (hasPermission && isSupported) {
      window.addEventListener('deviceorientation', handleOrientation, { passive: true });
      return () => {
        window.removeEventListener('deviceorientation', handleOrientation);
      };
    }
  }, [hasPermission, isSupported, handleOrientation]);

  return {
    ...orientation,
    isSupported,
    hasPermission,
    requestPermission,
  };
}
