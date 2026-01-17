// @ts-check
/**
 * Price Polling - Interval and backoff logic for price fetching
 *
 * Provides intelligent polling with:
 * - Exponential backoff on errors
 * - Per-service error tracking
 * - Jitter to prevent thundering herd
 */

/**
 * @typedef {Object} PollingConfig
 * @property {number} interval - Base polling interval in ms
 * @property {number} maxBackoff - Maximum backoff delay in ms
 */

/**
 * @typedef {Object} ServiceErrors
 * @property {number} crypto - Crypto service error count
 * @property {number} stock - Stock service error count
 * @property {number} fx - FX service error count
 */

/**
 * Create initial service errors state
 * @returns {ServiceErrors}
 */
export function createServiceErrors() {
  return { crypto: 0, stock: 0, fx: 0 };
}

/**
 * Update service errors based on result
 * @param {ServiceErrors} errors - Current errors
 * @param {{ crypto: string|null, stock: string|null, fx: string|null }} resultErrors
 * @returns {ServiceErrors}
 */
export function updateServiceErrors(errors, resultErrors) {
  return {
    crypto: resultErrors.crypto ? errors.crypto + 1 : 0,
    stock: resultErrors.stock ? errors.stock + 1 : 0,
    fx: resultErrors.fx ? errors.fx + 1 : 0,
  };
}

/**
 * Increment all service errors (used on total failure)
 * @param {ServiceErrors} errors
 * @returns {ServiceErrors}
 */
export function incrementAllErrors(errors) {
  return {
    crypto: errors.crypto + 1,
    stock: errors.stock + 1,
    fx: errors.fx + 1,
  };
}

/**
 * Calculate backoff delay based on service errors
 * @param {ServiceErrors} errors
 * @param {PollingConfig} config
 * @returns {number} - Delay in ms
 */
export function calculateBackoffDelay(errors, config) {
  const maxErrors = Math.max(errors.crypto, errors.stock, errors.fx);
  if (maxErrors === 0) return config.interval;

  // Exponential backoff: interval * 2^errors, capped at max
  const backoff = Math.min(
    config.interval * Math.pow(2, maxErrors),
    config.maxBackoff
  );

  // Add jitter (±20%) to prevent thundering herd
  const jitter = backoff * 0.2 * (Math.random() - 0.5);
  return Math.round(backoff + jitter);
}

/**
 * Shallow compare two price objects
 * @param {Record<string, number>} a
 * @param {Record<string, number>} b
 * @returns {boolean} - True if equal
 */
export function shallowEqualPrices(a, b) {
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  for (const key of keysA) {
    if (a[key] !== b[key]) return false;
  }
  return true;
}

/**
 * @typedef {Object} PricePoller
 * @property {() => void} start - Start polling
 * @property {() => void} stop - Stop polling
 * @property {() => void} reset - Reset backoff
 * @property {() => Promise<void>} fetchNow - Fetch immediately
 */

/**
 * @typedef {Object} PricePollerCallbacks
 * @property {() => Promise<any>} onFetch - Fetch prices callback
 * @property {(result: any) => void} onSuccess - Success callback
 * @property {(error: Error) => void} onError - Error callback
 * @property {() => boolean} canPoll - Check if polling is allowed
 */

/**
 * Create a price poller instance
 * @param {PollingConfig} config
 * @param {PricePollerCallbacks} callbacks
 * @returns {PricePoller}
 */
export function createPricePoller(config, callbacks) {
  let timeoutId = null;
  let serviceErrors = createServiceErrors();
  let isRunning = false;

  const poll = async () => {
    if (!isRunning || !callbacks.canPoll()) {
      return;
    }

    try {
      const result = await callbacks.onFetch();
      serviceErrors = updateServiceErrors(serviceErrors, result.errors || {});
      callbacks.onSuccess(result);
    } catch (error) {
      serviceErrors = incrementAllErrors(serviceErrors);
      callbacks.onError(error);
    }

    scheduleNext();
  };

  const scheduleNext = () => {
    if (!isRunning) return;

    const delay = calculateBackoffDelay(serviceErrors, config);
    timeoutId = setTimeout(poll, delay);
  };

  return {
    start() {
      if (isRunning) return;
      isRunning = true;
      poll(); // Immediate first poll
    },

    stop() {
      isRunning = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    },

    reset() {
      serviceErrors = createServiceErrors();
    },

    async fetchNow() {
      await poll();
    },
  };
}
