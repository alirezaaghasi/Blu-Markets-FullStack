/**
 * usePriceConnection Hook
 *
 * Provides price WebSocket connection status and last update time
 * for displaying price feed status indicator on Home screen.
 */

import { useState, useEffect } from 'react';
import { priceWebSocket, ConnectionStatus } from '../services/priceWebSocket';
import { useAppSelector } from './useStore';
import { DEMO_TOKEN } from '../constants/business';

interface PriceConnectionState {
  isConnected: boolean;
  status: ConnectionStatus;
  lastUpdate: Date | undefined;
}

/**
 * Hook to track WebSocket price connection status
 */
export function usePriceConnection(): PriceConnectionState {
  const [status, setStatus] = useState<ConnectionStatus>(priceWebSocket.getStatus());
  const [lastUpdate, setLastUpdate] = useState<Date | undefined>(undefined);

  // Check if we're in demo mode (runtime check via Redux)
  // Uses centralized DEMO_TOKEN constant to avoid hardcoded strings
  const authToken = useAppSelector((state) => state.auth.authToken);
  const isDemoMode = authToken === DEMO_TOKEN;

  useEffect(() => {
    // In demo mode, skip WebSocket connection and return static "connected" status
    if (isDemoMode) {
      setStatus('connected');
      setLastUpdate(new Date());
      return;
    }

    // Subscribe to status changes
    const unsubscribeStatus = priceWebSocket.onStatusChange((newStatus) => {
      setStatus(newStatus);
    });

    // Subscribe to messages to track last update time
    const unsubscribeMessage = priceWebSocket.onMessage((message) => {
      if (message.type === 'prices' || message.type === 'price' || message.type === 'fx') {
        setLastUpdate(new Date());
      }
    });

    // Connect if not already connected
    if (!priceWebSocket.isConnected()) {
      priceWebSocket.connect();
    }

    return () => {
      unsubscribeStatus();
      unsubscribeMessage();
    };
  }, [isDemoMode]);

  // In demo mode, always report as connected with demo prices
  if (isDemoMode) {
    return {
      isConnected: true,
      status: 'connected',
      lastUpdate: lastUpdate || new Date(),
    };
  }

  return {
    isConnected: status === 'connected',
    status,
    lastUpdate,
  };
}

export default usePriceConnection;
