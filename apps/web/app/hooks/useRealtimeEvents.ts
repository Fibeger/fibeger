'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import type { EventType, RealtimeEvent } from '@fibeger/api-client';
import { realtimeClient } from '../lib/realtimeClient';

interface UseRealtimeEventsOptions {
  onConnect?: () => void;
  onDisconnect?: () => void;
}

export function useRealtimeEvents(options: UseRealtimeEventsOptions = {}) {
  const { onConnect, onDisconnect } = options;
  const [isConnected, setIsConnected] = useState(realtimeClient.isConnected);
  const onConnectRef = useRef(onConnect);
  const onDisconnectRef = useRef(onDisconnect);

  useEffect(() => {
    onConnectRef.current = onConnect;
    onDisconnectRef.current = onDisconnect;
  }, [onConnect, onDisconnect]);

  useEffect(() => {
    const unsubscribe = realtimeClient.onConnectionStateChange((connected) => {
      setIsConnected(connected);
      if (connected) {
        onConnectRef.current?.();
      } else {
        onDisconnectRef.current?.();
      }
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    realtimeClient.connect();
  }, []);

  const on = useCallback((type: EventType, listener: (event: RealtimeEvent) => void) => {
    return realtimeClient.on(type, listener);
  }, []);

  const off = useCallback((type: EventType, listener: (event: RealtimeEvent) => void) => {
    realtimeClient.off(type, listener);
  }, []);

  return { on, off, isConnected };
}

export type { RealtimeEvent };
