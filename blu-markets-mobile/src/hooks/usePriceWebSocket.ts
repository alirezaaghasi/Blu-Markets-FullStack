// Price WebSocket Hook
// Connects to real-time price updates via WebSocket with REST polling fallback
import { useEffect, useRef, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useAppDispatch, useAppSelector } from './useStore';
import {
  setConnectionStatus,
  updatePriceFromWebSocket,
  updateAllPricesFromWebSocket,
  updateFxFromWebSocket,
  fetchPrices,
  fetchFxRate,
} from '../store/slices/pricesSlice';
import {
  priceWebSocket,
  WebSocketMessage,
  ConnectionStatus,
} from '../services/priceWebSocket';
import {
  WEBSOCKET_ENABLED,
  PRICE_POLLING_INTERVAL_MS,
} from '../constants/business';
import { AssetId } from '../types';

interface UsePriceWebSocketOptions {
  enabled?: boolean;
  fallbackToPolling?: boolean;
}

export const usePriceWebSocket = (options: UsePriceWebSocketOptions = {}) => {
  const { enabled = true, fallbackToPolling = true } = options;
  const dispatch = useAppDispatch();
  const isAuthenticated = useAppSelector((state) => state.auth.isAuthenticated);
  const connectionStatus = useAppSelector((state) => state.prices.connectionStatus);
  const { updatedAt, isLoading, error } = useAppSelector((state) => state.prices);

  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isWebSocketActive = useRef(false);

  // Handle WebSocket messages
  const handleMessage = useCallback(
    (message: WebSocketMessage) => {
      switch (message.type) {
        case 'connected':
          console.log('Price stream connected:', message.message);
          break;

        case 'prices':
          // Bulk price update (initial or periodic)
          if (message.data) {
            dispatch(
              updateAllPricesFromWebSocket({
                prices: message.data,
                timestamp: message.timestamp || new Date().toISOString(),
              })
            );
          }
          break;

        case 'price':
          // Single asset price update
          if (message.assetId && message.priceUsd !== undefined && message.priceIrr !== undefined) {
            dispatch(
              updatePriceFromWebSocket({
                assetId: message.assetId as AssetId,
                priceUsd: message.priceUsd,
                priceIrr: message.priceIrr,
                change24hPct: message.change24hPct,
                timestamp: message.timestamp || new Date().toISOString(),
              })
            );
          }
          break;

        case 'fx':
          // FX rate update
          if (message.usdIrr !== undefined) {
            dispatch(
              updateFxFromWebSocket({
                usdIrr: message.usdIrr,
                source: message.source || 'websocket',
                timestamp: message.timestamp || new Date().toISOString(),
              })
            );
          }
          break;

        case 'error':
          console.error('WebSocket error:', message.message);
          break;

        default:
          break;
      }
    },
    [dispatch]
  );

  // Handle connection status changes
  const handleStatusChange = useCallback(
    (status: ConnectionStatus) => {
      dispatch(setConnectionStatus(status));
      isWebSocketActive.current = status === 'connected';

      // Start/stop fallback polling based on connection status
      if (fallbackToPolling) {
        if (status === 'disconnected' || status === 'error') {
          startPollingFallback();
        } else if (status === 'connected') {
          stopPollingFallback();
        }
      }
    },
    [dispatch, fallbackToPolling]
  );

  // Fallback polling functions
  const startPollingFallback = useCallback(() => {
    if (pollingIntervalRef.current) return;

    console.log('Starting REST polling fallback');

    // Fetch immediately
    dispatch(fetchPrices());
    dispatch(fetchFxRate());

    // Then poll at intervals
    pollingIntervalRef.current = setInterval(() => {
      if (!isWebSocketActive.current) {
        dispatch(fetchPrices());
        dispatch(fetchFxRate());
      }
    }, PRICE_POLLING_INTERVAL_MS);
  }, [dispatch]);

  const stopPollingFallback = useCallback(() => {
    if (pollingIntervalRef.current) {
      console.log('Stopping REST polling fallback');
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  }, []);

  // Connect/disconnect based on enabled state and auth
  useEffect(() => {
    if (!enabled || !isAuthenticated) {
      priceWebSocket.disconnect();
      stopPollingFallback();
      return;
    }

    if (WEBSOCKET_ENABLED) {
      // Subscribe to WebSocket events
      const unsubMessage = priceWebSocket.onMessage(handleMessage);
      const unsubStatus = priceWebSocket.onStatusChange(handleStatusChange);

      // Connect
      priceWebSocket.connect();

      return () => {
        unsubMessage();
        unsubStatus();
        priceWebSocket.disconnect();
        stopPollingFallback();
      };
    } else {
      // WebSocket disabled, use polling only
      startPollingFallback();

      return () => {
        stopPollingFallback();
      };
    }
  }, [
    enabled,
    isAuthenticated,
    handleMessage,
    handleStatusChange,
    startPollingFallback,
    stopPollingFallback,
  ]);

  // Manual refresh - force fetch via REST regardless of WebSocket status
  const refresh = useCallback(async () => {
    await Promise.all([
      dispatch(fetchPrices()).unwrap(),
      dispatch(fetchFxRate()).unwrap(),
    ]);
  }, [dispatch]);

  // Manual reconnect
  const reconnect = useCallback(() => {
    if (WEBSOCKET_ENABLED) {
      priceWebSocket.disconnect();
      priceWebSocket.connect();
    }
  }, []);

  return {
    connectionStatus,
    isConnected: connectionStatus === 'connected',
    isLoading,
    error,
    updatedAt,
    refresh,
    reconnect,
  };
};

export default usePriceWebSocket;
