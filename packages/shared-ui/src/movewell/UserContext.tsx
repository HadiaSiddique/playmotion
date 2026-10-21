// Who is using this TV: the userId is kept on the device (no accounts in the demo), the rest comes from GET /plan.
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ApiError, api } from './api';
import { usePairing } from './PairingContext';
import { store } from './storage';
import { PlanResponse } from './types';

interface UserContextValue {
  loading: boolean;
  userId: string | null;
  data: PlanResponse | null;
  error: string | null;
  /** Reloads profile, plan, today's session and progress. */
  refresh: () => Promise<void>;
  /** Saves a newly onboarded user and loads their dashboard. */
  signIn: (userId: string) => Promise<void>;
  /** Forgets this user on this TV (their data stays in the cloud). */
  signOut: () => Promise<void>;
}

const UserContext = createContext<UserContextValue | undefined>(undefined);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const { client } = usePairing();
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [data, setData] = useState<PlanResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (id: string) => {
      try {
        setError(null);
        const res = await api.plan(id);
        setData(res);
        setUserId(id);
        client.setUserId(id);
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) {
          // Profile gone (e.g. the stack was redeployed fresh): start onboarding again.
          await store.remove('userId');
          setUserId(null);
          setData(null);
        } else {
          setError(err instanceof Error ? err.message : 'Something went wrong.');
          setUserId(id);
        }
      }
    },
    [client],
  );

  useEffect(() => {
    (async () => {
      const saved = await store.get('userId');
      if (saved) await load(saved);
      setLoading(false);
    })();
  }, [load]);

  const value = useMemo<UserContextValue>(
    () => ({
      loading,
      userId,
      data,
      error,
      refresh: async () => {
        if (userId) await load(userId);
      },
      signIn: async (id: string) => {
        await store.set('userId', id);
        await load(id);
      },
      signOut: async () => {
        await store.remove('userId');
        setUserId(null);
        setData(null);
        client.setUserId(null);
      },
    }),
    [loading, userId, data, error, load, client],
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser(): UserContextValue {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error('useUser must be used within a UserProvider');
  return ctx;
}
