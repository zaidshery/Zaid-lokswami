'use client';

import { useEffect, useRef } from 'react';
import { useAppStore } from '@/lib/store/appStore';

const STORAGE_KEY = 'lokswami-storage';

type PersistedStore = {
  state?: {
    theme?: unknown;
  };
};

function readPersistedTheme(): 'dark' | 'light' | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedStore;
    const value = parsed?.state?.theme;
    return value === 'dark' || value === 'light' ? value : null;
  } catch {
    return null;
  }
}

function readSystemTheme(): 'dark' | 'light' {
  if (typeof window === 'undefined') return 'dark';
  if (typeof window.matchMedia !== 'function') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme: 'dark' | 'light') {
  const root = document.documentElement;
  root.classList.toggle('dark', theme === 'dark');
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useAppStore((state) => state.theme);
  const setTheme = useAppStore((state) => state.setTheme);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const persistedTheme = readPersistedTheme();
    const resolvedTheme = persistedTheme || readSystemTheme();
    applyTheme(resolvedTheme);
    if (resolvedTheme !== theme) {
      setTheme(resolvedTheme);
    }

    if (persistedTheme) return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const onSystemThemeChange = (event: MediaQueryListEvent) => {
      const latestPersistedTheme = readPersistedTheme();
      if (latestPersistedTheme) return;
      const nextTheme = event.matches ? 'dark' : 'light';
      setTheme(nextTheme);
      applyTheme(nextTheme);
    };

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', onSystemThemeChange);
      return () => mediaQuery.removeEventListener('change', onSystemThemeChange);
    }

    mediaQuery.addListener(onSystemThemeChange);
    return () => mediaQuery.removeListener(onSystemThemeChange);
  }, [setTheme, theme]);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) return;
      const persistedTheme = readPersistedTheme();
      if (!persistedTheme) return;
      setTheme(persistedTheme);
      applyTheme(persistedTheme);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [setTheme]);

  return <>{children}</>;
}
