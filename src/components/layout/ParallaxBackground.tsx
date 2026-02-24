/**
 * ParallaxBackground — Animated background layers
 * ─────────────────────────────────────────────────
 * Motion spec:
 *   - 3 layers at different parallax depths
 *   - Layer 1 (far): intensity 0.3, blurred circles
 *   - Layer 2 (mid): intensity 0.6, geometric shapes
 *   - Layer 3 (near): intensity 1.0, accent elements
 *   - Fallback: CSS gradient with reduced-motion support
 */
'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { useParallax } from '@/hooks/useParallax';
import { useVaakkuStore } from '@/lib/store';

export function ParallaxBackground() {
  const motionEnabled = useVaakkuStore((s) => s.motionEnabled);

  const layer1 = useParallax({ intensity: 0.3, maxDisplacement: 15 });
  const layer2 = useParallax({ intensity: 0.6, maxDisplacement: 25 });
  const layer3 = useParallax({ intensity: 1.0, maxDisplacement: 35 });

  if (!motionEnabled) {
    return (
      <div
        className="fixed inset-0 -z-10"
        style={{
          background:
            'linear-gradient(135deg, var(--color-primary-50) 0%, var(--color-neutral-50) 50%, var(--color-neutral-100) 100%)',
        }}
      />
    );
  }

  return (
    <div className="parallax-container fixed inset-0 -z-10 overflow-hidden">
      {/* Base gradient */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(135deg, var(--color-primary-50) 0%, var(--color-neutral-50) 50%, var(--color-neutral-100) 100%)',
        }}
      />

      {/* Layer 1 — Far (subtle blurred circles) */}
      <motion.div
        className="parallax-layer absolute inset-0"
        style={{ x: layer1.x, y: layer1.y, rotateX: layer1.rotateX, rotateY: layer1.rotateY }}
      >
        <div className="absolute -left-20 top-1/4 h-72 w-72 rounded-full bg-[var(--color-primary-200)] opacity-20 blur-3xl" />
        <div className="absolute -right-10 top-2/3 h-56 w-56 rounded-full bg-slate-300 opacity-10 blur-3xl" />
      </motion.div>

      {/* Layer 2 — Mid (geometric shapes) */}
      <motion.div
        className="parallax-layer absolute inset-0"
        style={{ x: layer2.x, y: layer2.y }}
      >
        <div className="absolute left-1/4 top-20 h-32 w-32 rotate-45 rounded-2xl border border-[var(--color-primary-200)] opacity-10" />
      </motion.div>

      {/* Layer 3 — Near (accent dots) */}
      <motion.div
        className="parallax-layer absolute inset-0"
        style={{ x: layer3.x, y: layer3.y }}
      >
        <div className="absolute left-[15%] top-[30%] h-3 w-3 rounded-full bg-[var(--color-primary-400)] opacity-20" />
        <div className="absolute right-[20%] top-[20%] h-2 w-2 rounded-full bg-slate-400 opacity-20" />
        <div className="absolute left-[60%] bottom-[25%] h-4 w-4 rounded-full bg-[var(--color-primary-300)] opacity-15" />
      </motion.div>
    </div>
  );
}
