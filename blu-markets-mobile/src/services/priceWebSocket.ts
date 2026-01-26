// Price WebSocket Service
// Connects to backend WebSocket for real-time price updates
//
// ⚠️ BUG-012 TODO: WEBSOCKET AUTHENTICATION REQUIRED
// Current implementation creates unauthenticated WebSocket connections.
// SECURITY REQUIREMENTS:
// 1. Include auth token in WebSocket handshake (query param or header)
// 2. Validate message schema before processing (prevent spoofed data)
// 3. Backend must verify token and reject unauthorized connections
//
// IMPLEMENTATION:
// - connect() should retrieve token from tokenStorage
// - Pass token as: new WebSocket(`${WEBSOCKET_URL}?token=${token}`)
// - Add message schema validation in onmessage handler

import { AppState, AppStateStatus } from 'react-native';
import { WEBSOCKET_URL, WEBSOCKET_RECONNECT_INTERVAL_MS } from '../constants/business';

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export interface PriceUpdate {
  assetId: string;
  priceUsd: number;
  priceIrr: number;
  change24hPct?: number;
  source: string;
  timestamp: string;
}

export interface FxUpdate {
  usdIrr: number;
  source: string;
  timestamp: string;
}

export interface WebSocketMessage {
  type: 'connected' | 'prices' | 'price' | 'fx' | 'subscribed' | 'unsubscribed' | 'error';
  data?: PriceUpdate[];
  assetId?: string;
  priceUsd?: number;
  priceIrr?: number;
  change24hPct?: number;
  usdIrr?: number;
  source?: string;
  timestamp?: string;
  message?: string;
  assets?: string[] | 'all';
}

type MessageHandler = (message: WebSocketMessage) => void;
type StatusHandler = (status: ConnectionStatus) => void;

// Connection timeout to prevent hanging on slow/broken connections
const CONNECTION_TIMEOUT_MS = 10000; // 10 seconds

class PriceWebSocketService {
  private ws: WebSocket | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private connectionTimeout: NodeJS.Timeout | null = null;
  private messageHandlers: Set<MessageHandler> = new Set();
  private statusHandlers: Set<StatusHandler> = new Set();
  private status: ConnectionStatus = 'disconnected';
  private shouldReconnect = true;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private isReconnecting = false; // Guard against race conditions
  private appState: AppStateStatus = AppState.currentState;
  private appStateSubscription: ReturnType<typeof AppState.addEventListener> | null = null;

  // Subscription persistence - remember subscriptions across reconnects
  private subscribedAssets: Set<string> = new Set();
  private subscribeAll: boolean = true; // Default to subscribing to all

  constructor() {
    // Listen to app state changes and store subscription for cleanup
    this.appStateSubscription = AppState.addEventListener('change', this.handleAppStateChange);
  }

  /**
   * Cleanup resources - call when service is no longer needed
   */
  cleanup(): void {
    this.disconnect(true);
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }
  }

  private handleAppStateChange = (nextAppState: AppStateStatus) => {
    if (this.appState.match(/inactive|background/) && nextAppState === 'active') {
      // App came to foreground - reconnect if needed
      if (this.status === 'disconnected' && this.shouldReconnect) {
        this.connect();
      }
    } else if (nextAppState.match(/inactive|background/)) {
      // App going to background - disconnect to save resources
      this.disconnect(false);
    }
    this.appState = nextAppState;
  };

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN || this.ws?.readyState === WebSocket.CONNECTING) {
      return;
    }

    // Clear any existing connection timeout
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = null;
    }

    this.shouldReconnect = true;
    this.setStatus('connecting');

    try {
      this.ws = new WebSocket(WEBSOCKET_URL);

      // ST-2: Set connection timeout to prevent hanging on slow/broken connections
      this.connectionTimeout = setTimeout(() => {
        if (this.status === 'connecting') {
          console.log('WebSocket connection timeout');
          this.ws?.close();
          this.setStatus('error');
          this.scheduleReconnect();
        }
      }, CONNECTION_TIMEOUT_MS);

      this.ws.onopen = () => {
        // Clear connection timeout on successful connect
        if (this.connectionTimeout) {
          clearTimeout(this.connectionTimeout);
          this.connectionTimeout = null;
        }

        console.log('WebSocket connected');
        this.setStatus('connected');
        this.reconnectAttempts = 0;
        this.isReconnecting = false;

        // ST-1: Resubscribe to previously subscribed assets
        this.resubscribe();
      };

      this.ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          this.notifyMessageHandlers(message);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.setStatus('error');
      };

      this.ws.onclose = () => {
        // Clear connection timeout if still pending
        if (this.connectionTimeout) {
          clearTimeout(this.connectionTimeout);
          this.connectionTimeout = null;
        }

        console.log('WebSocket disconnected');
        this.setStatus('disconnected');
        this.ws = null;

        if (this.shouldReconnect && this.appState === 'active') {
          this.scheduleReconnect();
        }
      };
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
      this.setStatus('error');
      this.scheduleReconnect();
    }
  }

  /**
   * ST-1: Resubscribe to previously subscribed assets after reconnect
   */
  private resubscribe(): void {
    if (this.subscribeAll) {
      this.send({ type: 'subscribe' });
    } else if (this.subscribedAssets.size > 0) {
      this.send({ type: 'subscribe', assets: Array.from(this.subscribedAssets) });
    }
  }

  /**
   * Send a message to the WebSocket
   */
  private send(data: Record<string, unknown>): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  disconnect(permanent = true): void {
    this.shouldReconnect = !permanent;

    // Clear all pending timeouts
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = null;
    }

    // Reset reconnection state
    this.isReconnecting = false;

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.setStatus('disconnected');
  }

  /**
   * ST-3: Schedule reconnect with race condition guards
   */
  private scheduleReconnect(): void {
    // Guard against concurrent reconnection attempts
    if (this.isReconnecting) {
      console.log('Reconnect already scheduled, skipping');
      return;
    }
    this.isReconnecting = true;

    // Clear any existing timeout
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('Max reconnect attempts reached');
      this.isReconnecting = false;
      return;
    }

    // Exponential backoff with max cap
    const delay = Math.min(
      WEBSOCKET_RECONNECT_INTERVAL_MS * Math.pow(1.5, this.reconnectAttempts),
      30000
    );

    console.log(`Scheduling reconnect in ${delay}ms (attempt ${this.reconnectAttempts + 1})`);

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectAttempts++;
      // isReconnecting will be reset in connect() on success or failure
      this.connect();
    }, delay);
  }

  /**
   * Subscribe to price updates
   * ST-1: Tracks subscriptions for persistence across reconnects
   */
  subscribe(assets?: string[]): void {
    // Track subscription for resubscription after reconnect
    if (!assets || assets.length === 0) {
      this.subscribeAll = true;
      this.subscribedAssets.clear();
    } else {
      assets.forEach((asset) => this.subscribedAssets.add(asset));
    }

    this.send({ type: 'subscribe', assets });
  }

  /**
   * Unsubscribe from price updates
   * ST-1: Updates tracked subscriptions
   */
  unsubscribe(assets?: string[]): void {
    // Update tracked subscriptions
    if (!assets || assets.length === 0) {
      this.subscribeAll = false;
      this.subscribedAssets.clear();
    } else {
      assets.forEach((asset) => this.subscribedAssets.delete(asset));
    }

    this.send({ type: 'unsubscribe', assets });
  }

  onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }

  onStatusChange(handler: StatusHandler): () => void {
    this.statusHandlers.add(handler);
    // Immediately notify of current status
    handler(this.status);
    return () => this.statusHandlers.delete(handler);
  }

  private setStatus(status: ConnectionStatus): void {
    this.status = status;
    this.statusHandlers.forEach((handler) => handler(status));
  }

  private notifyMessageHandlers(message: WebSocketMessage): void {
    this.messageHandlers.forEach((handler) => handler(message));
  }

  getStatus(): ConnectionStatus {
    return this.status;
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

// Singleton instance
export const priceWebSocket = new PriceWebSocketService();
