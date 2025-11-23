import { useState, useEffect } from 'react';
import { AppSettings } from '../types';
import { STORAGE_KEYS, DEFAULT_SETTINGS } from '../utils/constants';
import { apiClient, toBackendSettings, toFrontendSettings } from '../utils/api';

type SaveStatus = 'idle' | 'saving' | 'success' | 'error';

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    return saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
  });

  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  }, [settings]);

  const updateSetting = <K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K]
  ) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const loadSettingsFromBackend = async (userId: string) => {
    try {
      const backendSettings = await apiClient.getUserSettings(userId);
      const frontendSettings = toFrontendSettings(backendSettings);
      
      // Update both state and localStorage from backend (backend is source of truth)
      setSettings(frontendSettings);
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(frontendSettings));
      
      console.log('Settings loaded from backend:', frontendSettings);
    } catch (error) {
      console.error('Failed to load settings from backend:', error);
      // Fall back to localStorage if backend unreachable
      // (localStorage might have stale data, but better than nothing)
    }
  };

  const saveSettingsToBackend = async (userId: string) => {
    setSaveStatus('saving');
    setSaveError(null);

    try {
      // Save to localStorage first (immediate update)
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));

      // Then sync to backend
      const backendPayload = toBackendSettings(settings);
      const updatedSettings = await apiClient.updateUserSettings(userId, backendPayload);
      
      // Update local state with confirmed backend values
      const frontendSettings = toFrontendSettings(updatedSettings);
      setSettings(frontendSettings);
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(frontendSettings));

      setSaveStatus('success');
      console.log('Settings saved successfully:', frontendSettings);

      // Auto-hide success message after 3 seconds
      setTimeout(() => {
        setSaveStatus('idle');
      }, 3000);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to save settings';
      setSaveError(errorMessage);
      setSaveStatus('error');
      console.error('Failed to save settings to backend:', error);
    }
  };

  return { 
    settings, 
    setSettings, 
    updateSetting, 
    saveStatus, 
    saveError, 
    loadSettingsFromBackend, 
    saveSettingsToBackend 
  };
}