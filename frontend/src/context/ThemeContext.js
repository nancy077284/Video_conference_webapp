import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { getTheme } from '../theme';

const ThemeContext = createContext(null);
const STORAGE_KEY = 'vc_theme';

function getInitialMode() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'dark' || stored === 'light') return stored;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export const ThemeProvider = ({ children }) => {
  const [mode, setMode] = useState(getInitialMode);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', mode);
    document.documentElement.style.colorScheme = mode;
    localStorage.setItem(STORAGE_KEY, mode);
  }, [mode]);

  const value = useMemo(
    () => ({
      mode,
      theme: getTheme(mode),
      toggleMode: () => setMode((m) => (m === 'dark' ? 'light' : 'dark')),
      setMode,
    }),
    [mode]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useThemeMode = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useThemeMode must be used inside ThemeProvider');
  return ctx;
};
