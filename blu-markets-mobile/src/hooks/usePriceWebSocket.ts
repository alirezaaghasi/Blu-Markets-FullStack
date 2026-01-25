// Price WebSocket Hook
// Connects to real-time price updates via WebSocket with REST polling fallback
import { useEffect, useRef, useCallback, useLayoutEffect } from 'react';
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
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const appStateListenerRef = useRef<{ remove: () => void } | null>(null);

  // Refs to store latest callback versions - prevents useEffect infinite loops
  // by breaking the dependency chain between callbacks and effects
  const handleMessageRef = useRef<(message: WebSocketMessage) => void>(() => {});
  const handleStatusChangeRef = useRef<(status: ConnectionStatus) => void>(() => {});
  const startPollingFallbackRef = useRef<() => void>(() => {});
  const stopPollingFallbackRef = useRef<() => void>(() => {});

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

  // Keep refs updated with latest callback versions
  // This runs synchronously before effects to ensure refs are always current
  useLayoutEffect(() => {
    handleMessageRef.current = handleMessage;
    handleStatusChangeRef.current = handleStatusChange;
    startPollingFallbackRef.current = startPollingFallback;
    stopPollingFallbackRef.current = stopPollingFallback;
  });

  // Handle app state changes to pause/resume polling when app goes to background
  // This prevents battery drain when the app is not visible
  // Uses refs for callbacks to prevent dependency array issues
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      const wasActive = appStateRef.current === 'active';
      const isActive = nextAppState === 'active';
      appStateRef.current = nextAppState;

      if (wasActive && !isActive) {
        // App going to background - pause polling and disconnect WebSocket
        console.log('App going to background, pausing price updates');
        stopPollingFallbackRef.current();
        if (WEBSOCKET_ENABLED) {
          priceWebSocket.disconnect();
        }
      } else if (!wasActive && isActive && enabled && isAuthenticated) {
        // App coming to foreground - resume
        console.log('App coming to foreground, resuming price updates');
        if (WEBSOCKET_ENABLED) {
          priceWebSocket.connect();
        } else if (fallbackToPolling) {
          startPollingFallbackRef.current();
        }
      }
    };

    // Subscribe to AppState changes
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    appStateListenerRef.current = subscription;

    return () => {
      subscription.remove();
      appStateListenerRef.current = null;
    };
  }, [enabled, isAuthenticated, fallbackToPolling]); // Only primitive dependencies

  // Connect/disconnect based on enabled state and auth
  // Uses refs instead of callbacks in dependency array to prevent infinite loops
  // The refs are updated synchronously via useLayoutEffect above
  useEffect(() => {
    // Don't connect if app is in background
    if (appStateRef.current !== 'active') {
      return;
    }

    if (!enabled || !isAuthenticated) {
      priceWebSocket.disconnect();
      stopPollingFallbackRef.current();
      return;
    }

    if (WEBSOCKET_ENABLED) {
      // Subscribe to WebSocket events using refs to break dependency chain
      // This prevents infinite re-renders when callbacks change
      const unsubMessage = priceWebSocket.onMessage((msg) => handleMessageRef.current(msg));
      const unsubStatus = priceWebSocket.onStatusChange((status) => handleStatusChangeRef.current(status));

      // Connect
      priceWebSocket.connect();

      return () => {
        unsubMessage();
        unsubStatus();
        priceWebSocket.disconnect();
        stopPollingFallbackRef.current();
      };
    } else {
      // WebSocket disabled, use polling only
      startPollingFallbackRef.current();

      return () => {
        stopPollingFallbackRef.current();
      };
    }
  }, [enabled, isAuthenticated]); // Only primitive dependencies - refs handle callback changes

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
