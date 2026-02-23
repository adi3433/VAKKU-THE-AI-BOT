/**
 * Vaakku Design System — Design Tokens
 * ──────────────────────────────────────
 * Single source of truth for colours, spacing, typography,
 * elevation, motion, and breakpoints.
 *
 * Naming: kebab-case CSS vars + camelCase TS exports.
 * Figma mapping: each token group has a Figma-variable group comment.
 */

// ── Colour Palette ────────────────────────────────────────────────
// Figma group: "Vaakku / Colors"
export const colors = {
  // Primary — deep civic blue
  primary: {
    50: '#EBF2FF',
    100: '#D6E4FF',
    200: '#ADC8FF',
    300: '#84ABFF',
    400: '#5B8EFF',
    500: '#2563EB', // main
    600: '#1D4ED8',
    700: '#1E40AF',
    800: '#1E3A8A',
    900: '#172554',
  },
  // Accent — Kerala gold
  accent: {
    50: '#FFFBEB',
    100: '#FEF3C7',
    200: '#FDE68A',
    300: '#FCD34D',
    400: '#FBBF24',
    500: '#F59E0B', // main
    600: '#D97706',
    700: '#B45309',
    800: '#92400E',
    900: '#78350F',
  },
  // Success / Safe
  success: {
    50: '#ECFDF5',
    100: '#D1FAE5',
    500: '#10B981',
    700: '#047857',
  },
  // Warning
  warning: {
    50: '#FFFBEB',
    100: '#FEF3C7',
    500: '#F59E0B',
    700: '#B45309',
  },
  // Error / Danger
  error: {
    50: '#FEF2F2',
    100: '#FEE2E2',
    500: '#EF4444',
    700: '#B91C1C',
  },
  // Neutrals
  neutral: {
    0: '#FFFFFF',
    50: '#F9FAFB',
    100: '#F3F4F6',
    200: '#E5E7EB',
    300: '#D1D5DB',
    400: '#9CA3AF',
    500: '#6B7280',
    600: '#4B5563',
    700: '#374151',
    800: '#1F2937',
    900: '#111827',
    950: '#030712',
  },
} as const;

// ── Spacing ───────────────────────────────────────────────────────
// Figma group: "Vaakku / Spacing"
// 4px base unit
export const spacing = {
  0: '0px',
  0.5: '2px',
  1: '4px',
  1.5: '6px',
  2: '8px',
  2.5: '10px',
  3: '12px',
  4: '16px',
  5: '20px',
  6: '24px',
  8: '32px',
  10: '40px',
  12: '48px',
  14: '56px',
  16: '64px',
  20: '80px',
  24: '96px',
  32: '128px',
} as const;

// ── Typography ────────────────────────────────────────────────────
// Figma group: "Vaakku / Typography"
export const typography = {
  fontFamily: {
    sans: '"Inter", "Noto Sans Malayalam", system-ui, sans-serif',
    malayalam: '"Noto Sans Malayalam", "Manjari", sans-serif',
    mono: '"JetBrains Mono", "Fira Code", monospace',
  },
  fontSize: {
    xs: ['0.75rem', { lineHeight: '1rem' }],
    sm: ['0.875rem', { lineHeight: '1.25rem' }],
    base: ['1rem', { lineHeight: '1.5rem' }],
    lg: ['1.125rem', { lineHeight: '1.75rem' }],
    xl: ['1.25rem', { lineHeight: '1.75rem' }],
    '2xl': ['1.5rem', { lineHeight: '2rem' }],
    '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
    '4xl': ['2.25rem', { lineHeight: '2.5rem' }],
    '5xl': ['3rem', { lineHeight: '1' }],
  },
  fontWeight: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
    extrabold: '800',
  },
} as const;

// ── Elevation / Shadows ──────────────────────────────────────────
// Figma group: "Vaakku / Elevation"
export const elevation = {
  none: 'none',
  xs: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
  sm: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
  md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
  lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
  xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
  '2xl': '0 25px 50px -12px rgb(0 0 0 / 0.25)',
  inner: 'inset 0 2px 4px 0 rgb(0 0 0 / 0.05)',
  glow: '0 0 20px 0 rgb(37 99 235 / 0.25)',
} as const;

// ── Border Radius ────────────────────────────────────────────────
export const radius = {
  none: '0',
  sm: '4px',
  md: '8px',
  lg: '12px',
  xl: '16px',
  '2xl': '24px',
  full: '9999px',
} as const;

// ── Motion / Animation Specs ─────────────────────────────────────
// Figma group: "Vaakku / Motion"
export const motion = {
  duration: {
    instant: 0.1,
    fast: 0.2,
    normal: 0.3,
    slow: 0.5,
    slower: 0.8,
    slowest: 1.2,
  },
  easing: {
    easeOut: [0.0, 0.0, 0.2, 1.0] as const,
    easeIn: [0.4, 0.0, 1.0, 1.0] as const,
    easeInOut: [0.4, 0.0, 0.2, 1.0] as const,
    spring: { type: 'spring', stiffness: 300, damping: 30 } as const,
    springBouncy: { type: 'spring', stiffness: 400, damping: 20 } as const,
    springGentle: { type: 'spring', stiffness: 200, damping: 25 } as const,
  },
  // Framer Motion variant presets
  variants: {
    fadeIn: {
      hidden: { opacity: 0 },
      visible: { opacity: 1, transition: { duration: 0.3 } },
    },
    slideUp: {
      hidden: { opacity: 0, y: 20 },
      visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.0, 0.0, 0.2, 1.0] } },
    },
    slideInRight: {
      hidden: { opacity: 0, x: 30 },
      visible: { opacity: 1, x: 0, transition: { duration: 0.3, ease: [0.0, 0.0, 0.2, 1.0] } },
    },
    scaleIn: {
      hidden: { opacity: 0, scale: 0.95 },
      visible: { opacity: 1, scale: 1, transition: { duration: 0.2 } },
    },
    staggerContainer: {
      hidden: { opacity: 0 },
      visible: {
        opacity: 1,
        transition: { staggerChildren: 0.08, delayChildren: 0.1 },
      },
    },
    messageBubble: {
      hidden: { opacity: 0, y: 10, scale: 0.97 },
      visible: {
        opacity: 1,
        y: 0,
        scale: 1,
        transition: { type: 'spring' as const, stiffness: 300, damping: 30 },
      },
    },
    parallaxLayer: {
      // Controlled via motion values, not variants
    },
  },
} as const;

// ── Breakpoints ──────────────────────────────────────────────────
export const breakpoints = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
} as const;

// ── Z-Index Layers ───────────────────────────────────────────────
export const zIndex = {
  base: 0,
  dropdown: 10,
  sticky: 20,
  overlay: 30,
  modal: 40,
  toast: 50,
  tooltip: 60,
} as const;
