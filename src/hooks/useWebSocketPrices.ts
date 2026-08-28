'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Prices } from '@/app/dashboard/components/types';

interface WebSocketState {
  prices: Prices | null;
  isLoading: boolean;
  error: string | null;
  isConnected: boolean;
}

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:5001';
const RECONNECT_DELAY_MS = 3000;
const MAX_RECONNECT_ATTEMPTS = 3;
const RECONNECT_BACKOFF_MULTIPLIER = 2;

export function useWebSocketPrices() {
  const [state, setState] = useState<WebSocketState>({
    prices: null,
    isLoading: true,
    error: null,
    isConnected: false,
  });

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connect = useCallback(() => {
    // Clean up any existing connection
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    try {
      const ws = new WebSocket(WS_URL);

      ws.onopen = () => {
        console.log('[ws-client] Connected to price server');
        reconnectAttemptsRef.current = 0;
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: null,
          isConnected: true,
        }));
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);

          if (message.type === 'prices' && message.data) {
            setState((prev) => ({
              ...prev,
              prices: message.data,
              isLoading: false,
              error: null,
            }));
          }
        } catch (err) {
          console.error('[ws-client] Failed to parse message:', err);
        }
      };

      ws.onerror = (err) => {
        console.warn('[ws-client] Connection error:', err);
        setState((prev) => ({
          ...prev,
          error: 'WebSocket connection error',
          isConnected: false,
        }));
      };

      ws.onclose = (event) => {
        const shouldRetry = reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS;
        console.log(`[ws-client] Connection closed (code: ${event.code})${shouldRetry ? '' : ' — stopping retries'}`);
        setState((prev) => ({
          ...prev,
          isConnected: false,
        }));

        if (shouldRetry) {
          reconnectAttemptsRef.current += 1;
          const delay = RECONNECT_DELAY_MS * RECONNECT_BACKOFF_MULTIPLIER ** (reconnectAttemptsRef.current - 1);
          console.log(`[ws-client] Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS})...`);

          reconnectTimerRef.current = setTimeout(() => {
            connect();
          }, delay);
        } else {
          setState((prev) => ({
            ...prev,
            error: 'WebSocket connection unavailable; using fallback prices',
            isLoading: false,
          }));
        }
      };

      wsRef.current = ws;
    } catch (err) {
      console.error('[ws-client] Failed to create WebSocket:', err);
      setState((prev) => ({
        ...prev,
        error: 'Failed to create WebSocket connection',
        isLoading: false,
      }));
    }
  }, []);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect]);

  return state;
}