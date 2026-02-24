/**
 * useParallax — Multi-layer Parallax Hook
 * ────────────────────────────────────────
 * Combines DeviceOrientation (mobile) with mouse-position (desktop)
 * and scroll-triggered parallax as fallback.
 *
 * Motion spec:
 *   Trigger: device tilt | mouse move | scroll
 *   Duration: real-time interpolated
 *   Easing: spring (stiffness 200, damping 25)
 *   Fallback chain: DeviceOrientation → Mouse → Scroll
 */
'use client';

import { useEffect, useCallback, useRef, useState } from 'react';
import {
  useMotionValue,
  useSpring,
  useTransform,
  type MotionValue,
} from 'framer-motion';
import { useDeviceOrientation } from './useDeviceOrientation';

interface ParallaxConfig {
  /** Multiplier for parallax intensity (default: 1) */
  intensity?: number;
  /** Max displacement in pixels (default: 30) */
  maxDisplacement?: number;
  /** Enable scroll-based fallback (default: true) */
  scrollFallback?: boolean;
}

interface ParallaxResult {
  /** X transform motion value — bind to style.x */
  x: MotionValue<number>;
  /** Y transform motion value — bind to style.y */
  y: MotionValue<number>;
  /** Rotation X motion value (subtle 3D tilt) */
  rotateX: MotionValue<number>;
  /** Rotation Y motion value (subtle 3D tilt) */
  rotateY: MotionValue<number>;
  /** The active input method */
  inputMethod: 'device' | 'mouse' | 'scroll' | 'none';
}

export function useParallax(config: ParallaxConfig = {}): ParallaxResult {
  const {
    intensity = 1,
    maxDisplacement = 30,
    scrollFallback = true,
  } = config;

  const { gamma, beta, isSupported, hasPermission } = useDeviceOrientation();
  const [inputMethod, setInputMethod] = useState<ParallaxResult['inputMethod']>('none');

  // Raw motion values
  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);

  // Smooth springs
  const springConfig = { stiffness: 200, damping: 25, mass: 0.5 };
  const x = useSpring(rawX, springConfig);
  const y = useSpring(rawY, springConfig);

  // 3D tilt (subtle)
  const rotateX = useTransform(y, [-maxDisplacement, maxDisplacement], [2, -2]);
  const rotateY = useTransform(x, [-maxDisplacement, maxDisplacement], [-2, 2]);

  // ── Device orientation input ──
  useEffect(() => {
    if (isSupported && hasPermission) {
      const clampedX = Math.max(-maxDisplacement, Math.min(maxDisplacement, (gamma / 45) * maxDisplacement * intensity));
      const clampedY = Math.max(-maxDisplacement, Math.min(maxDisplacement, ((beta - 45) / 45) * maxDisplacement * intensity));
      rawX.set(clampedX);
      rawY.set(clampedY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setInputMethod('device');
    }
  }, [gamma, beta, isSupported, hasPermission, maxDisplacement, intensity, rawX, rawY]);

  // ── Mouse input (desktop fallback) ──
  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (isSupported && hasPermission) return; // device orientation active
      const centerX = window.innerWidth / 2;
      const centerY = window.innerHeight / 2;
      const normalX = (e.clientX - centerX) / centerX; // -1 to 1
      const normalY = (e.clientY - centerY) / centerY;
      rawX.set(normalX * maxDisplacement * intensity);
      rawY.set(normalY * maxDisplacement * intensity);
      setInputMethod('mouse');
    },
    [isSupported, hasPermission, maxDisplacement, intensity, rawX, rawY]
  );

  // ── Scroll fallback ──
  const handleScroll = useCallback(() => {
    if (!scrollFallback) return;
    if (isSupported && hasPermission) return;
    const scrollY = window.scrollY;
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    const progress = maxScroll > 0 ? scrollY / maxScroll : 0;
    rawY.set((progress - 0.5) * maxDisplacement * 2 * intensity);
    setInputMethod('scroll');
  }, [scrollFallback, isSupported, hasPermission, maxDisplacement, intensity, rawY]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    if (scrollFallback) {
      window.addEventListener('scroll', handleScroll, { passive: true });
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('scroll', handleScroll);
    };
  }, [handleMouseMove, handleScroll, scrollFallback]);

  // Ref to prevent re-renders of inputMethod check
  const methodRef = useRef(inputMethod);
  useEffect(() => {
    methodRef.current = inputMethod;
  }, [inputMethod]);

  return { x, y, rotateX, rotateY, inputMethod };
}
