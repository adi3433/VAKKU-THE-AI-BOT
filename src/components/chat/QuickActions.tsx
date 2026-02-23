/**
 * QuickActions — Shortcut Action Pills
 * ──────────────────────────────────────
 * ID Check, Booth Map, Report Violation, FAQ.
 *
 * Motion spec:
 *   - Stagger in from left: 0.06s stagger, slideInRight variant
 *   - Hover: scale 1.03, shadow-md (spring stiffness 300, damping 30)
 *   - Tap: scale 0.97 (spring stiffness 400, damping 20)
 */
'use client';

import React from 'react';
import { motion } from 'framer-motion';
import {
  IdentificationIcon,
  MapPinIcon,
  ExclamationTriangleIcon,
  QuestionMarkCircleIcon,
} from '@heroicons/react/24/outline';
import type { ActionItem } from '@/types';
import { useLocale } from '@/hooks/useLocale';

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  IdentificationIcon,
  MapPinIcon,
  ExclamationTriangleIcon,
  QuestionMarkCircleIcon,
};

interface QuickActionsProps {
  actions: ActionItem[];
  onAction: (action: ActionItem) => void;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { type: 'spring' as const, stiffness: 300, damping: 30 },
  },
};

export function QuickActions({ actions, onAction }: QuickActionsProps) {
  const { locale } = useLocale();

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="flex flex-wrap gap-2 px-4 py-3"
    >
      {actions.map((action) => {
        const Icon = ICON_MAP[action.icon];
        const label = locale === 'ml' && action.labelMl ? action.labelMl : action.label;

        return (
          <motion.button
            key={action.id}
            variants={itemVariants}
            whileHover={{ scale: 1.03, boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
            whileTap={{ scale: 0.97 }}
            onClick={() => onAction(action)}
            className={`
              flex items-center gap-2 rounded-xl border border-[var(--color-neutral-200)]
              bg-white px-4 py-2.5 text-sm font-medium text-[var(--color-neutral-700)]
              shadow-sm transition-colors
              hover:border-[var(--color-primary-300)] hover:text-[var(--color-primary-600)]
              ${locale === 'ml' ? 'font-ml' : ''}
            `}
          >
            {Icon && <Icon className="h-4 w-4" />}
            {label}
          </motion.button>
        );
      })}
    </motion.div>
  );
}
