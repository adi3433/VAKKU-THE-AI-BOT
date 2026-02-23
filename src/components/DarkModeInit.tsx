'use client';

import { useEffect } from 'react';
import { useVaakkuStore } from '@/lib/store';

/**
 * Syncs the Zustand darkMode state with the <html> class.
 * Runs once on mount and subscribes to store changes.
 */
export function DarkModeInit() {
  const darkMode = useVaakkuStore((s) => s.darkMode);

  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [darkMode]);

  return null;
}
