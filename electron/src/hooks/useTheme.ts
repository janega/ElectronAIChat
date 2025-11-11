import { useState, useEffect } from 'react';
import { STORAGE_KEYS } from '../utils/constants';

export function useTheme() {
  const [isDark, setIsDark] = useState<boolean>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.THEME);
    return saved ? JSON.parse(saved) : false; // Default to light theme
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.THEME, JSON.stringify(isDark));

    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    // Tell Electron to change the native theme
    try {
      // @ts-ignore - electron is available when nodeIntegration is true
      const { ipcRenderer } = window.require('electron');
      ipcRenderer.send('set-theme', isDark ? 'dark' : 'light');
    } catch (err) {
      console.log('Running outside Electron, theme change ignored');
    }
  }, [isDark]);

  return { isDark, setIsDark };
}