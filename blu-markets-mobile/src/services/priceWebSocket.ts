// Price WebSocket Service
// Connects to backend WebSocket for real-time price updates
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

class PriceWebSocketService {
  private ws: WebSocket | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private messageHandlers: Set<MessageHandler> = new Set();
  private statusHandlers: Set<StatusHandler> = new Set();
  private status: ConnectionStatus = 'disconnected';
  private shouldReconnect = true;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private appState: AppStateStatus = AppState.currentState;
  private appStateSubscription: ReturnType<typeof AppState.addEventListener> | null = null;

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

    this.shouldReconnect = true;
    this.setStatus('connecting');

    try {
      this.ws = new WebSocket(WEBSOCKET_URL);

      this.ws.onopen = () => {
        console.log('WebSocket connected');
        this.setStatus('connected');
        this.reconnectAttempts = 0;
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

  disconnect(permanent = true): void {
    this.shouldReconnect = !permanent;

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.setStatus('disconnected');
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('Max reconnect attempts reached');
      return;
    }

    // Exponential backoff
    const delay = Math.min(
      WEBSOCKET_RECONNECT_INTERVAL_MS * Math.pow(1.5, this.reconnectAttempts),
      30000
    );

    console.log(`Scheduling reconnect in ${delay}ms (attempt ${this.reconnectAttempts + 1})`);

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectAttempts++;
      this.connect();
    }, delay);
  }

  subscribe(assets?: string[]): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'subscribe',
        assets,
      }));
    }
  }

  unsubscribe(assets?: string[]): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'unsubscribe',
        assets,
      }));
    }
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
