import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';

export type SyncMode = 'auto' | 'manual';

interface SyncContextType {
  isSyncing: boolean;
  lastSyncTime: number | null;
  unsyncedCount: number;
  syncError: string | null;
  syncMode: SyncMode;
  username: string | null;
  
  setIsSyncing: (syncing: boolean) => void;
  setLastSyncTime: (time: number) => void;
  setUnsyncedCount: (count: number) => void;
  setSyncError: (error: string | null) => void;
  setSyncMode: (mode: SyncMode) => void;
  setUsername: (username: string) => void;
  triggerSync: () => void;
}

const SyncContext = createContext<SyncContextType | undefined>(undefined);

const STORAGE_KEYS = {
  SYNC_MODE: 'sync_mode',
  USERNAME: 'app_username',
  LAST_SYNC: 'last_sync_time',
};

interface SyncProviderProps {
  children: ReactNode;
  onSyncTrigger?: () => Promise<void>;
}

export const SyncProvider: React.FC<SyncProviderProps> = ({ children, onSyncTrigger }) => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTimeState] = useState<number | null>(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.LAST_SYNC);
    return stored ? parseInt(stored, 10) : null;
  });
  const [unsyncedCount, setUnsyncedCount] = useState(0);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncMode, setSyncModeState] = useState<SyncMode>(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.SYNC_MODE);
    return (stored as SyncMode) || 'auto';
  });
  const [username, setUsernameState] = useState<string | null>(() => {
    return localStorage.getItem(STORAGE_KEYS.USERNAME);
  });

  // Persist sync mode to localStorage
  const setSyncMode = useCallback((mode: SyncMode) => {
    setSyncModeState(mode);
    localStorage.setItem(STORAGE_KEYS.SYNC_MODE, mode);
  }, []);

  // Persist username to localStorage
  const setUsername = useCallback((user: string) => {
    setUsernameState(user);
    localStorage.setItem(STORAGE_KEYS.USERNAME, user);
  }, []);

  // Persist last sync time to localStorage
  const setLastSyncTime = useCallback((time: number) => {
    setLastSyncTimeState(time);
    localStorage.setItem(STORAGE_KEYS.LAST_SYNC, time.toString());
  }, []);

  // Trigger manual sync
  const triggerSync = useCallback(async () => {
    if (isSyncing || !onSyncTrigger) return;
    
    setIsSyncing(true);
    setSyncError(null);
    
    try {
      await onSyncTrigger();
      setLastSyncTime(Date.now());
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : 'Sync failed');
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, onSyncTrigger, setLastSyncTime]);

  // Auto-sync every 5 minutes when mode is 'auto'
  useEffect(() => {
    if (syncMode !== 'auto' || !username) return;

    const interval = setInterval(() => {
      triggerSync();
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(interval);
  }, [syncMode, username, triggerSync]);

  const value: SyncContextType = {
    isSyncing,
    lastSyncTime,
    unsyncedCount,
    syncError,
    syncMode,
    username,
    setIsSyncing,
    setLastSyncTime,
    setUnsyncedCount,
    setSyncError,
    setSyncMode,
    setUsername,
    triggerSync,
  };

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
};

export const useSyncContext = () => {
  const context = useContext(SyncContext);
  if (context === undefined) {
    throw new Error('useSyncContext must be used within a SyncProvider');
  }
  return context;
};
