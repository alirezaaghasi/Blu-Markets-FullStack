/**
 * usePriceConnection Hook
 *
 * Provides price WebSocket connection status and last update time
 * for displaying price feed status indicator on Home screen.
 */

import { useState, useEffect, useCallback } from 'react';
import { priceWebSocket, ConnectionStatus } from '../services/priceWebSocket';

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

  useEffect(() => {
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
  }, []);

  return {
    isConnected: status === 'connected',
    status,
    lastUpdate,
  };
}

export default usePriceConnection;
