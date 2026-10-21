import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { getPlayMotionConfig } from './config';
import { PairingClient, PairingState, PhoneEvent } from './pairingClient';

interface PairingContextValue {
  client: PairingClient;
  state: PairingState;
}

const PairingContext = createContext<PairingContextValue | undefined>(undefined);

/** One WebSocket for the whole app, so pairing survives moving between screens. */
export function PairingProvider({ children }: { children: React.ReactNode }) {
  const clientRef = useRef<PairingClient | null>(null);
  if (!clientRef.current) clientRef.current = new PairingClient(getPlayMotionConfig().wsUrl);
  const client = clientRef.current;
  const [state, setState] = useState<PairingState>(client.state);

  useEffect(() => {
    const unsubscribe = client.onState(setState);
    client.connect();
    return () => {
      unsubscribe();
      client.close();
    };
  }, [client]);

  const value = useMemo(() => ({ client, state }), [client, state]);
  return <PairingContext.Provider value={value}>{children}</PairingContext.Provider>;
}

export function usePairing(): PairingContextValue {
  const ctx = useContext(PairingContext);
  if (!ctx) throw new Error('usePairing must be used within a PairingProvider');
  return ctx;
}

/** Subscribe to events from the phone (pose, rep, form, game, safety, status). */
export function usePhoneEvents(listener: (event: PhoneEvent) => void) {
  const { client } = usePairing();
  const latest = useRef(listener);
  latest.current = listener;
  useEffect(() => client.onEvent((e) => latest.current(e)), [client]);
}
