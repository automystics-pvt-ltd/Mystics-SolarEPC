import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import { apiGet, apiPost } from '@/lib/api';
import { useQueryClient } from '@tanstack/react-query';

const QUEUE_KEY = '@mystics/offline_queue';

export type QueueActionType = 'CREATE_GRN' | 'CREATE_DPR' | 'CREATE_MR';

export interface QueuedAction {
  id: string;
  type: QueueActionType;
  payload: unknown;
  createdAt: string;
  retries: number;
  label: string;
}

interface OfflineContextType {
  isOnline: boolean;
  queue: QueuedAction[];
  enqueue: (type: QueueActionType, payload: unknown, label: string) => Promise<void>;
  processQueue: () => Promise<{ synced: number; failed: number }>;
  isSyncing: boolean;
}

const OfflineContext = createContext<OfflineContextType | null>(null);

function genId() {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

const ENDPOINT: Record<QueueActionType, string> = {
  CREATE_GRN: '/api/grns',
  CREATE_DPR: '/api/dprs',
  CREATE_MR: '/api/material-requests',
};

export function OfflineProvider({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = useState(true);
  const [queue, setQueue] = useState<QueuedAction[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const qc = useQueryClient();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevOnlineRef = useRef(true);

  // Load persisted queue on mount
  useEffect(() => {
    AsyncStorage.getItem(QUEUE_KEY).then((raw) => {
      if (raw) {
        try {
          setQueue(JSON.parse(raw));
        } catch {}
      }
    });
  }, []);

  const persistQueue = useCallback(async (q: QueuedAction[]) => {
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(q));
  }, []);

  const checkOnline = useCallback(async () => {
    try {
      await apiGet('/api/healthz');
      setIsOnline(true);
      return true;
    } catch {
      setIsOnline(false);
      return false;
    }
  }, []);

  // Poll connectivity every 10s + on app foreground
  useEffect(() => {
    checkOnline();
    intervalRef.current = setInterval(checkOnline, 10_000);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') checkOnline();
    });
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      sub.remove();
    };
  }, [checkOnline]);

  const processQueue = useCallback(async () => {
    if (isSyncing) return { synced: 0, failed: 0 };
    setIsSyncing(true);
    let synced = 0;
    let failed = 0;
    const remaining: QueuedAction[] = [];

    for (const action of queue) {
      try {
        await apiPost(ENDPOINT[action.type], action.payload);
        synced++;
      } catch {
        failed++;
        remaining.push({ ...action, retries: action.retries + 1 });
      }
    }

    setQueue(remaining);
    await persistQueue(remaining);
    setIsSyncing(false);

    if (synced > 0) {
      qc.invalidateQueries();
    }

    return { synced, failed };
  }, [isSyncing, queue, persistQueue, qc]);

  // Auto-process when coming back online
  useEffect(() => {
    if (isOnline && !prevOnlineRef.current && queue.length > 0) {
      processQueue();
    }
    prevOnlineRef.current = isOnline;
  }, [isOnline, queue.length, processQueue]);

  const enqueue = useCallback(
    async (type: QueueActionType, payload: unknown, label: string) => {
      const action: QueuedAction = {
        id: genId(),
        type,
        payload,
        createdAt: new Date().toISOString(),
        retries: 0,
        label,
      };
      const newQueue = [...queue, action];
      setQueue(newQueue);
      await persistQueue(newQueue);
    },
    [queue, persistQueue],
  );

  return (
    <OfflineContext.Provider value={{ isOnline, queue, enqueue, processQueue, isSyncing }}>
      {children}
    </OfflineContext.Provider>
  );
}

export function useOffline() {
  const ctx = useContext(OfflineContext);
  if (!ctx) throw new Error('useOffline must be used within OfflineProvider');
  return ctx;
}
