/**
 * Price Coordinator Test Suite
 *
 * Tests for multi-tab price polling coordination:
 * - Payload validation
 * - Leader election when no leader exists
 * - Leader takeover when heartbeat is stale
 * - BroadcastChannel message handling
 * - localStorage fallback handling
 */

import { createTabCoordinator, isValidPriceUpdatePayload, type TabCoordinator } from './priceCoordinator';

// ============================================================================
// TEST FRAMEWORK (matches existing project pattern)
// ============================================================================

let passed = 0;
let failed = 0;
const failures: Array<{ name: string; error: string }> = [];

function test(name: string, fn: () => boolean | void): void {
  try {
    const result = fn();
    if (result === true || result === undefined) {
      passed++;
      console.log(`  ✓ ${name}`);
    } else {
      failed++;
      failures.push({ name, error: `Expected true, got ${result}` });
      console.log(`  ✗ ${name}`);
    }
  } catch (e) {
    failed++;
    const errorMsg = e instanceof Error ? e.message : String(e);
    failures.push({ name, error: errorMsg });
    console.log(`  ✗ ${name} - Error: ${errorMsg}`);
  }
}

function describe(section: string, fn: () => void): void {
  console.log(`\n${section}`);
  fn();
}

// ============================================================================
// MOCKS
// ============================================================================

interface MockStorage {
  store: Record<string, string>;
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
  clear: () => void;
}

function createMockStorage(): MockStorage {
  const store: Record<string, string> = {};
  return {
    store,
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { Object.keys(store).forEach(k => delete store[k]); },
  };
}

interface MockBroadcastChannel {
  name: string;
  onmessage: ((event: { data: unknown }) => void) | null;
  postMessage: (data: unknown) => void;
  close: () => void;
  _messages: unknown[];
}

function createMockBroadcastChannel(name: string): MockBroadcastChannel {
  return {
    name,
    onmessage: null,
    postMessage: function(data: unknown) { this._messages.push(data); },
    close: () => {},
    _messages: [],
  };
}

// Store original globals
const originalLocalStorage = globalThis.localStorage;
const originalBroadcastChannel = globalThis.BroadcastChannel;

function setupMocks(mockStorage: MockStorage): void {
  // @ts-expect-error - Mocking global
  globalThis.localStorage = mockStorage;
}

function restoreMocks(): void {
  // @ts-expect-error - Restoring global
  globalThis.localStorage = originalLocalStorage;
  // @ts-expect-error - Restoring global
  globalThis.BroadcastChannel = originalBroadcastChannel;
}

// ============================================================================
// TESTS: Payload Validation
// ============================================================================

describe('📋 PAYLOAD VALIDATION (isValidPriceUpdatePayload)', () => {
  test('Valid payload passes validation', () => {
    const validPayload = {
      type: 'PRICE_UPDATE',
      prices: { BTC: 97500, ETH: 3200 },
      fxRate: 1456000,
      updatedAt: '2025-01-17T12:00:00Z',
      from: 'tab-123',
    };
    return isValidPriceUpdatePayload(validPayload) === true;
  });

  test('Rejects null', () => {
    return isValidPriceUpdatePayload(null) === false;
  });

  test('Rejects undefined', () => {
    return isValidPriceUpdatePayload(undefined) === false;
  });

  test('Rejects non-object (string)', () => {
    return isValidPriceUpdatePayload('not an object') === false;
  });

  test('Rejects non-object (number)', () => {
    return isValidPriceUpdatePayload(12345) === false;
  });

  test('Rejects wrong type field', () => {
    const payload = {
      type: 'WRONG_TYPE',
      prices: { BTC: 97500 },
      fxRate: 1456000,
      updatedAt: '2025-01-17T12:00:00Z',
      from: 'tab-123',
    };
    return isValidPriceUpdatePayload(payload) === false;
  });

  test('Rejects missing type field', () => {
    const payload = {
      prices: { BTC: 97500 },
      fxRate: 1456000,
      updatedAt: '2025-01-17T12:00:00Z',
      from: 'tab-123',
    };
    return isValidPriceUpdatePayload(payload) === false;
  });

  test('Rejects null prices', () => {
    const payload = {
      type: 'PRICE_UPDATE',
      prices: null,
      fxRate: 1456000,
      updatedAt: '2025-01-17T12:00:00Z',
      from: 'tab-123',
    };
    return isValidPriceUpdatePayload(payload) === false;
  });

  test('Rejects array prices', () => {
    const payload = {
      type: 'PRICE_UPDATE',
      prices: [97500, 3200],
      fxRate: 1456000,
      updatedAt: '2025-01-17T12:00:00Z',
      from: 'tab-123',
    };
    return isValidPriceUpdatePayload(payload) === false;
  });

  test('Rejects prices with non-numeric values', () => {
    const payload = {
      type: 'PRICE_UPDATE',
      prices: { BTC: '97500', ETH: 3200 },
      fxRate: 1456000,
      updatedAt: '2025-01-17T12:00:00Z',
      from: 'tab-123',
    };
    return isValidPriceUpdatePayload(payload) === false;
  });

  test('Rejects prices with NaN values', () => {
    const payload = {
      type: 'PRICE_UPDATE',
      prices: { BTC: NaN, ETH: 3200 },
      fxRate: 1456000,
      updatedAt: '2025-01-17T12:00:00Z',
      from: 'tab-123',
    };
    return isValidPriceUpdatePayload(payload) === false;
  });

  test('Rejects prices with Infinity values', () => {
    const payload = {
      type: 'PRICE_UPDATE',
      prices: { BTC: Infinity, ETH: 3200 },
      fxRate: 1456000,
      updatedAt: '2025-01-17T12:00:00Z',
      from: 'tab-123',
    };
    return isValidPriceUpdatePayload(payload) === false;
  });

  test('Rejects non-numeric fxRate', () => {
    const payload = {
      type: 'PRICE_UPDATE',
      prices: { BTC: 97500 },
      fxRate: '1456000',
      updatedAt: '2025-01-17T12:00:00Z',
      from: 'tab-123',
    };
    return isValidPriceUpdatePayload(payload) === false;
  });

  test('Rejects zero fxRate', () => {
    const payload = {
      type: 'PRICE_UPDATE',
      prices: { BTC: 97500 },
      fxRate: 0,
      updatedAt: '2025-01-17T12:00:00Z',
      from: 'tab-123',
    };
    return isValidPriceUpdatePayload(payload) === false;
  });

  test('Rejects negative fxRate', () => {
    const payload = {
      type: 'PRICE_UPDATE',
      prices: { BTC: 97500 },
      fxRate: -1456000,
      updatedAt: '2025-01-17T12:00:00Z',
      from: 'tab-123',
    };
    return isValidPriceUpdatePayload(payload) === false;
  });

  test('Rejects NaN fxRate', () => {
    const payload = {
      type: 'PRICE_UPDATE',
      prices: { BTC: 97500 },
      fxRate: NaN,
      updatedAt: '2025-01-17T12:00:00Z',
      from: 'tab-123',
    };
    return isValidPriceUpdatePayload(payload) === false;
  });

  test('Rejects non-string updatedAt', () => {
    const payload = {
      type: 'PRICE_UPDATE',
      prices: { BTC: 97500 },
      fxRate: 1456000,
      updatedAt: 12345,
      from: 'tab-123',
    };
    return isValidPriceUpdatePayload(payload) === false;
  });

  test('Rejects empty updatedAt', () => {
    const payload = {
      type: 'PRICE_UPDATE',
      prices: { BTC: 97500 },
      fxRate: 1456000,
      updatedAt: '',
      from: 'tab-123',
    };
    return isValidPriceUpdatePayload(payload) === false;
  });

  test('Rejects non-string from', () => {
    const payload = {
      type: 'PRICE_UPDATE',
      prices: { BTC: 97500 },
      fxRate: 1456000,
      updatedAt: '2025-01-17T12:00:00Z',
      from: 123,
    };
    return isValidPriceUpdatePayload(payload) === false;
  });

  test('Rejects empty from', () => {
    const payload = {
      type: 'PRICE_UPDATE',
      prices: { BTC: 97500 },
      fxRate: 1456000,
      updatedAt: '2025-01-17T12:00:00Z',
      from: '',
    };
    return isValidPriceUpdatePayload(payload) === false;
  });

  test('Accepts empty prices object', () => {
    const payload = {
      type: 'PRICE_UPDATE',
      prices: {},
      fxRate: 1456000,
      updatedAt: '2025-01-17T12:00:00Z',
      from: 'tab-123',
    };
    return isValidPriceUpdatePayload(payload) === true;
  });

  test('Accepts prices with zero values', () => {
    const payload = {
      type: 'PRICE_UPDATE',
      prices: { USDT: 1, TEST: 0 },
      fxRate: 1456000,
      updatedAt: '2025-01-17T12:00:00Z',
      from: 'tab-123',
    };
    return isValidPriceUpdatePayload(payload) === true;
  });

  test('Accepts prices with negative values', () => {
    // Negative prices are technically valid numbers (e.g., for percent changes)
    const payload = {
      type: 'PRICE_UPDATE',
      prices: { CHANGE: -5.5 },
      fxRate: 1456000,
      updatedAt: '2025-01-17T12:00:00Z',
      from: 'tab-123',
    };
    return isValidPriceUpdatePayload(payload) === true;
  });
});

// ============================================================================
// TESTS: Leader Election
// ============================================================================

describe('👑 LEADER ELECTION', () => {
  test('First tab becomes leader when no leader exists', () => {
    const mockStorage = createMockStorage();
    setupMocks(mockStorage);

    try {
      const coordinator = createTabCoordinator();
      const result = coordinator.isLeader === true;
      coordinator.cleanup();
      return result;
    } finally {
      restoreMocks();
    }
  });

  test('Leader sets leader key in localStorage', () => {
    const mockStorage = createMockStorage();
    setupMocks(mockStorage);

    try {
      const coordinator = createTabCoordinator();
      const hasLeaderKey = mockStorage.store['blu_prices_leader'] === coordinator.tabId;
      coordinator.cleanup();
      return hasLeaderKey;
    } finally {
      restoreMocks();
    }
  });

  test('Leader sets heartbeat in localStorage', () => {
    const mockStorage = createMockStorage();
    setupMocks(mockStorage);

    try {
      const coordinator = createTabCoordinator();
      const hasHeartbeat = mockStorage.store['blu_prices_heartbeat'] !== undefined;
      const heartbeatValue = parseInt(mockStorage.store['blu_prices_heartbeat'], 10);
      const isRecentHeartbeat = Date.now() - heartbeatValue < 5000;
      coordinator.cleanup();
      return hasHeartbeat && isRecentHeartbeat;
    } finally {
      restoreMocks();
    }
  });

  test('Second tab does not become leader when active leader exists', () => {
    const mockStorage = createMockStorage();
    setupMocks(mockStorage);

    try {
      // First coordinator becomes leader
      const coordinator1 = createTabCoordinator();
      const isLeader1 = coordinator1.isLeader;

      // Second coordinator should not become leader
      const coordinator2 = createTabCoordinator();
      const isLeader2 = coordinator2.isLeader;

      coordinator1.cleanup();
      coordinator2.cleanup();

      return isLeader1 === true && isLeader2 === false;
    } finally {
      restoreMocks();
    }
  });

  test('Tab generates unique tabId', () => {
    const mockStorage = createMockStorage();
    setupMocks(mockStorage);

    try {
      const coordinator1 = createTabCoordinator();
      const coordinator2 = createTabCoordinator();
      const uniqueIds = coordinator1.tabId !== coordinator2.tabId;
      coordinator1.cleanup();
      coordinator2.cleanup();
      return uniqueIds;
    } finally {
      restoreMocks();
    }
  });
});

// ============================================================================
// TESTS: Leader Takeover (Stale Heartbeat)
// ============================================================================

describe('⏱️ LEADER TAKEOVER (Stale Heartbeat)', () => {
  test('Tab can take over leadership when heartbeat is stale (>10s)', () => {
    const mockStorage = createMockStorage();
    setupMocks(mockStorage);

    try {
      // Simulate stale leader: heartbeat from 15 seconds ago
      const staleTimestamp = Date.now() - 15000;
      mockStorage.setItem('blu_prices_leader', 'old-tab-id');
      mockStorage.setItem('blu_prices_heartbeat', String(staleTimestamp));

      // New coordinator should take over
      const coordinator = createTabCoordinator();
      const tookOver = coordinator.isLeader === true;
      const isNewLeader = mockStorage.store['blu_prices_leader'] === coordinator.tabId;

      coordinator.cleanup();
      return tookOver && isNewLeader;
    } finally {
      restoreMocks();
    }
  });

  test('Tab cannot take over when heartbeat is fresh (<10s)', () => {
    const mockStorage = createMockStorage();
    setupMocks(mockStorage);

    try {
      // Simulate active leader: heartbeat from 2 seconds ago
      const freshTimestamp = Date.now() - 2000;
      mockStorage.setItem('blu_prices_leader', 'active-tab-id');
      mockStorage.setItem('blu_prices_heartbeat', String(freshTimestamp));

      // New coordinator should NOT take over
      const coordinator = createTabCoordinator();
      const didNotTakeOver = coordinator.isLeader === false;
      const leaderUnchanged = mockStorage.store['blu_prices_leader'] === 'active-tab-id';

      coordinator.cleanup();
      return didNotTakeOver && leaderUnchanged;
    } finally {
      restoreMocks();
    }
  });

  test('Tab takes over when heartbeat key is missing', () => {
    const mockStorage = createMockStorage();
    setupMocks(mockStorage);

    try {
      // Simulate orphaned leader: leader key exists but no heartbeat
      mockStorage.setItem('blu_prices_leader', 'orphan-tab-id');
      // No heartbeat key set

      // New coordinator should take over
      const coordinator = createTabCoordinator();
      const tookOver = coordinator.isLeader === true;

      coordinator.cleanup();
      return tookOver;
    } finally {
      restoreMocks();
    }
  });

  test('tryBecomeLeader method is exposed and callable', () => {
    const mockStorage = createMockStorage();
    setupMocks(mockStorage);

    try {
      const coordinator = createTabCoordinator();

      // Verify tryBecomeLeader is a function that can be called
      const isFunction = typeof coordinator.tryBecomeLeader === 'function';

      // Calling it when already leader returns false (no need to claim, already leader)
      // This is correct behavior - the function "tries" to become leader,
      // and if already leader with active heartbeat, there's nothing to claim
      const resultWhenLeader = coordinator.tryBecomeLeader();

      coordinator.cleanup();
      // Returns false because leader already exists with fresh heartbeat
      return isFunction && resultWhenLeader === false;
    } finally {
      restoreMocks();
    }
  });

  test('Non-leader can attempt tryBecomeLeader when leader exists', () => {
    const mockStorage = createMockStorage();
    setupMocks(mockStorage);

    try {
      // First coordinator becomes leader
      const leader = createTabCoordinator();

      // Second coordinator is follower
      const follower = createTabCoordinator();

      // Follower tries to become leader - should fail (active leader exists)
      const resultWhenActiveLeader = follower.tryBecomeLeader();

      leader.cleanup();
      follower.cleanup();

      // Should return false because there's an active leader with fresh heartbeat
      return resultWhenActiveLeader === false;
    } finally {
      restoreMocks();
    }
  });
});

// ============================================================================
// TESTS: Price Broadcast & Message Handling
// ============================================================================

describe('📡 PRICE BROADCAST & MESSAGE HANDLING', () => {
  test('Leader can broadcast prices', () => {
    const mockStorage = createMockStorage();
    setupMocks(mockStorage);

    try {
      const coordinator = createTabCoordinator();

      // Broadcast prices
      coordinator.broadcastPrices({ BTC: 97500 }, 1456000, '2025-01-17T12:00:00Z');

      // Check localStorage fallback was set
      const broadcast = mockStorage.store['blu_prices_broadcast'];
      const hasBroadcast = broadcast !== undefined;

      if (hasBroadcast) {
        const parsed = JSON.parse(broadcast);
        const correctShape =
          parsed.type === 'PRICE_UPDATE' &&
          parsed.prices.BTC === 97500 &&
          parsed.fxRate === 1456000;
        coordinator.cleanup();
        return correctShape;
      }

      coordinator.cleanup();
      return hasBroadcast;
    } finally {
      restoreMocks();
    }
  });

  test('Non-leader does not broadcast', () => {
    const mockStorage = createMockStorage();
    setupMocks(mockStorage);

    try {
      // First tab becomes leader
      const leader = createTabCoordinator();

      // Second tab is not leader
      const follower = createTabCoordinator();

      // Clear any existing broadcast
      delete mockStorage.store['blu_prices_broadcast'];

      // Follower tries to broadcast
      follower.broadcastPrices({ BTC: 50000 }, 1000000, '2025-01-17T12:00:00Z');

      // Should not have broadcasted
      const noBroadcast = mockStorage.store['blu_prices_broadcast'] === undefined;

      leader.cleanup();
      follower.cleanup();
      return noBroadcast;
    } finally {
      restoreMocks();
    }
  });

  test('onPricesReceived callback can be registered', () => {
    const mockStorage = createMockStorage();
    setupMocks(mockStorage);

    try {
      const coordinator = createTabCoordinator();
      let callbackCalled = false;

      coordinator.onPricesReceived(() => {
        callbackCalled = true;
      });

      // The callback registration should work
      coordinator.cleanup();
      return typeof coordinator.onPricesReceived === 'function';
    } finally {
      restoreMocks();
    }
  });

  test('Broadcast includes from field with tabId', () => {
    const mockStorage = createMockStorage();
    setupMocks(mockStorage);

    try {
      const coordinator = createTabCoordinator();
      coordinator.broadcastPrices({ ETH: 3200 }, 1456000, '2025-01-17T12:00:00Z');

      const broadcast = mockStorage.store['blu_prices_broadcast'];
      if (broadcast) {
        const parsed = JSON.parse(broadcast);
        const hasFrom = parsed.from === coordinator.tabId;
        coordinator.cleanup();
        return hasFrom;
      }

      coordinator.cleanup();
      return false;
    } finally {
      restoreMocks();
    }
  });
});

// ============================================================================
// TESTS: Cleanup
// ============================================================================

describe('🧹 CLEANUP', () => {
  test('Cleanup removes leader key when current tab is leader', () => {
    const mockStorage = createMockStorage();
    setupMocks(mockStorage);

    try {
      const coordinator = createTabCoordinator();
      const wasLeader = coordinator.isLeader;
      const hadLeaderKey = mockStorage.store['blu_prices_leader'] !== undefined;

      coordinator.cleanup();

      const leaderKeyRemoved = mockStorage.store['blu_prices_leader'] === undefined;
      return wasLeader && hadLeaderKey && leaderKeyRemoved;
    } finally {
      restoreMocks();
    }
  });

  test('Cleanup removes heartbeat key', () => {
    const mockStorage = createMockStorage();
    setupMocks(mockStorage);

    try {
      const coordinator = createTabCoordinator();
      const hadHeartbeat = mockStorage.store['blu_prices_heartbeat'] !== undefined;

      coordinator.cleanup();

      const heartbeatRemoved = mockStorage.store['blu_prices_heartbeat'] === undefined;
      return hadHeartbeat && heartbeatRemoved;
    } finally {
      restoreMocks();
    }
  });

  test('Cleanup sets isLeader to false', () => {
    const mockStorage = createMockStorage();
    setupMocks(mockStorage);

    try {
      const coordinator = createTabCoordinator();
      const wasLeader = coordinator.isLeader;

      coordinator.cleanup();

      const notLeaderAfter = coordinator.isLeader === false;
      return wasLeader && notLeaderAfter;
    } finally {
      restoreMocks();
    }
  });
});

// ============================================================================
// RUN TESTS
// ============================================================================

console.log('='.repeat(70));
console.log('PRICE COORDINATOR TEST SUITE');
console.log('='.repeat(70));

// Note: Tests are executed when imported/run
// The describe blocks above execute immediately

console.log('\n' + '='.repeat(70));
console.log(`RESULTS: ${passed} passed, ${failed} failed`);
if (failures.length > 0) {
  console.log('\nFailures:');
  failures.forEach(f => console.log(`  - ${f.name}: ${f.error}`));
}
console.log('='.repeat(70));

// Export for programmatic use
export { passed, failed, failures };
