/**
 * Price Coordinator - Multi-tab price polling coordination
 *
 * Uses BroadcastChannel to coordinate price polling across browser tabs.
 * Only one tab (the "leader") polls for prices; others receive updates.
 *
 * Benefits:
 * - Reduces API calls (1 tab polls instead of N tabs)
 * - Prevents hitting API rate limits
 * - Ensures consistent prices across all tabs
 */

const CHANNEL_NAME = 'blu_prices_sync';
const LEADER_KEY = 'blu_prices_leader';
const LEADER_HEARTBEAT_KEY = 'blu_prices_heartbeat';
const HEARTBEAT_INTERVAL = 5000; // 5 seconds
const LEADER_TIMEOUT = 10000; // 10 seconds without heartbeat = leader dead

export type PriceUpdateCallback = (
  prices: Record<string, number>,
  fxRate: number,
  updatedAt: string
) => void;

interface PriceUpdateMessage {
  type: 'PRICE_UPDATE';
  prices: Record<string, number>;
  fxRate: number;
  updatedAt: string;
  from: string;
}

export interface TabCoordinator {
  readonly isLeader: boolean;
  readonly tabId: string;
  broadcastPrices: (prices: Record<string, number>, fxRate: number, updatedAt: string) => void;
  onPricesReceived: (callback: PriceUpdateCallback) => void;
  cleanup: () => void;
  tryBecomeLeader: () => boolean;
}

/**
 * Generate a unique tab ID
 */
function generateTabId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Create a tab coordinator instance
 */
export function createTabCoordinator(): TabCoordinator {
  const tabId = generateTabId();
  let isLeader = false;
  let channel: BroadcastChannel | null = null;
  let heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  let priceCallback: PriceUpdateCallback | null = null;

  // Try to use BroadcastChannel (modern browsers)
  const hasBroadcastChannel = typeof BroadcastChannel !== 'undefined';

  if (hasBroadcastChannel) {
    try {
      channel = new BroadcastChannel(CHANNEL_NAME);
    } catch (e) {
      console.warn('BroadcastChannel not available:', e);
    }
  }

  /**
   * Check if current leader is alive (has recent heartbeat)
   */
  function isLeaderAlive(): boolean {
    try {
      const heartbeat = localStorage.getItem(LEADER_HEARTBEAT_KEY);
      if (!heartbeat) return false;
      const lastHeartbeat = parseInt(heartbeat, 10);
      return Date.now() - lastHeartbeat < LEADER_TIMEOUT;
    } catch {
      return false;
    }
  }

  /**
   * Try to become the leader
   */
  function tryBecomeLeader(): boolean {
    try {
      const currentLeader = localStorage.getItem(LEADER_KEY);

      // If no leader or leader is dead, try to claim leadership
      if (!currentLeader || !isLeaderAlive()) {
        localStorage.setItem(LEADER_KEY, tabId);
        localStorage.setItem(LEADER_HEARTBEAT_KEY, String(Date.now()));

        // Verify we won the race (another tab might have claimed it)
        const winner = localStorage.getItem(LEADER_KEY);
        if (winner === tabId) {
          isLeader = true;
          startHeartbeat();
          return true;
        }
      }

      return false;
    } catch {
      // localStorage might be unavailable (private browsing, etc.)
      // Fall back to being a leader (no coordination)
      isLeader = true;
      return true;
    }
  }

  /**
   * Start heartbeat to indicate leader is alive
   */
  function startHeartbeat(): void {
    if (heartbeatInterval) clearInterval(heartbeatInterval);

    heartbeatInterval = setInterval(() => {
      if (isLeader) {
        try {
          localStorage.setItem(LEADER_HEARTBEAT_KEY, String(Date.now()));
        } catch {
          // Ignore storage errors
        }
      }
    }, HEARTBEAT_INTERVAL);
  }

  /**
   * Broadcast price update to other tabs
   */
  function broadcastPrices(prices: Record<string, number>, fxRate: number, updatedAt: string): void {
    if (!isLeader) return;

    const message: PriceUpdateMessage = {
      type: 'PRICE_UPDATE',
      prices,
      fxRate,
      updatedAt,
      from: tabId,
    };

    // Broadcast via BroadcastChannel
    if (channel) {
      try {
        channel.postMessage(message);
      } catch (e) {
        console.warn('Failed to broadcast via channel:', e);
      }
    }

    // Also update localStorage for tabs that don't support BroadcastChannel
    try {
      localStorage.setItem('blu_prices_broadcast', JSON.stringify(message));
    } catch {
      // Ignore storage errors
    }
  }

  /**
   * Set callback for receiving price updates
   */
  function onPricesReceived(callback: PriceUpdateCallback): void {
    priceCallback = callback;
  }

  /**
   * Handle incoming price update
   */
  function handlePriceMessage(data: PriceUpdateMessage): void {
    if (data.type === 'PRICE_UPDATE' && data.from !== tabId && priceCallback) {
      priceCallback(data.prices, data.fxRate, data.updatedAt);
    }
  }

  // Listen for price updates from other tabs
  if (channel) {
    channel.onmessage = (event: MessageEvent<PriceUpdateMessage>): void => {
      handlePriceMessage(event.data);
    };
  }

  // Also listen for localStorage changes (fallback for older browsers)
  function handleStorageChange(event: StorageEvent): void {
    if (event.key === 'blu_prices_broadcast' && event.newValue) {
      try {
        const data = JSON.parse(event.newValue) as PriceUpdateMessage;
        handlePriceMessage(data);
      } catch {
        // Ignore parse errors
      }
    }

    // Check if leader died and try to take over
    if (event.key === LEADER_KEY && !isLeader) {
      setTimeout(() => {
        if (!isLeaderAlive()) {
          tryBecomeLeader();
        }
      }, 1000 + Math.random() * 1000); // Random delay to prevent race
    }
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('storage', handleStorageChange);
  }

  /**
   * Initialize leader election
   */
  function initialize(): boolean {
    return tryBecomeLeader();
  }

  /**
   * Clean up resources
   */
  function cleanup(): void {
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = null;
    }

    if (channel) {
      channel.close();
      channel = null;
    }

    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', handleStorageChange);
    }

    // Release leadership
    if (isLeader) {
      try {
        const currentLeader = localStorage.getItem(LEADER_KEY);
        if (currentLeader === tabId) {
          localStorage.removeItem(LEADER_KEY);
          localStorage.removeItem(LEADER_HEARTBEAT_KEY);
        }
      } catch {
        // Ignore storage errors
      }
    }

    isLeader = false;
  }

  // Initialize on creation
  initialize();

  return {
    get isLeader(): boolean {
      return isLeader;
    },
    tabId,
    broadcastPrices,
    onPricesReceived,
    cleanup,
    tryBecomeLeader,
  };
}
