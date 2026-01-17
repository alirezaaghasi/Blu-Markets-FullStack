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

// ============================================================================
// PAYLOAD VALIDATION
// ============================================================================

/**
 * Validates that a PRICE_UPDATE payload has the correct shape and types.
 * Guards against malformed storage entries or cross-tab contamination.
 *
 * @param data - The parsed payload to validate
 * @returns true if the payload is valid, false otherwise
 */
function isValidPriceUpdatePayload(data: unknown): data is PriceUpdateMessage {
  // Check for null/undefined
  if (data === null || typeof data !== 'object') {
    return false;
  }

  const msg = data as Record<string, unknown>;

  // Validate type field
  if (msg.type !== 'PRICE_UPDATE') {
    return false;
  }

  // Validate prices: must be an object with numeric values
  if (typeof msg.prices !== 'object' || msg.prices === null || Array.isArray(msg.prices)) {
    return false;
  }
  const prices = msg.prices as Record<string, unknown>;
  for (const value of Object.values(prices)) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return false;
    }
  }

  // Validate fxRate: must be a positive finite number
  if (typeof msg.fxRate !== 'number' || !Number.isFinite(msg.fxRate) || msg.fxRate <= 0) {
    return false;
  }

  // Validate updatedAt: must be a non-empty string (ISO date format expected)
  if (typeof msg.updatedAt !== 'string' || msg.updatedAt.length === 0) {
    return false;
  }

  // Validate from: must be a non-empty string (tab ID)
  if (typeof msg.from !== 'string' || msg.from.length === 0) {
    return false;
  }

  return true;
}

// Export for testing
export { isValidPriceUpdatePayload };

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
   * Handle incoming price update with validation
   * Validates payload shape before invoking callback to guard against
   * malformed storage entries or cross-tab contamination.
   */
  function handlePriceMessage(data: unknown): void {
    // Validate payload structure before processing
    if (!isValidPriceUpdatePayload(data)) {
      // Silently ignore invalid payloads - could be from old versions or corruption
      return;
    }

    // Only process messages from other tabs
    if (data.from !== tabId && priceCallback) {
      priceCallback(data.prices, data.fxRate, data.updatedAt);
    }
  }

  // Listen for price updates from other tabs via BroadcastChannel
  if (channel) {
    channel.onmessage = (event: MessageEvent): void => {
      // event.data is validated inside handlePriceMessage
      handlePriceMessage(event.data);
    };
  }

  // Also listen for localStorage changes (fallback for older browsers)
  function handleStorageChange(event: StorageEvent): void {
    if (event.key === 'blu_prices_broadcast' && event.newValue) {
      try {
        // Parse and pass to handlePriceMessage which validates the payload
        const data: unknown = JSON.parse(event.newValue);
        handlePriceMessage(data);
      } catch {
        // Ignore JSON parse errors - malformed data
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
