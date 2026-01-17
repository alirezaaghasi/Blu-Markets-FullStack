/**
 * Price Service - Fetches live prices from multiple APIs
 *
 * Sources:
 * - CoinGecko: BTC, ETH, SOL, TON, USDT, GOLD (free, no key)
 * - Finnhub: QQQ (free with API key)
 * - Bonbast: USD/IRR rate
 *
 * Optimizations:
 * - AbortController support for cancellable requests
 * - Request timeouts to prevent long-hanging requests
 */

import { getCoinGeckoIds } from '../registry/assetRegistry.js';
import { DEFAULT_FX_RATE } from '../constants/index.js';

// Default timeout for API requests (8 seconds)
const DEFAULT_TIMEOUT_MS = 8000;

/**
 * Fetch with timeout support
 * Creates a race between the fetch and a timeout abort
 * @param {string} url - URL to fetch
 * @param {AbortSignal} signal - External abort signal (optional)
 * @param {number} timeoutMs - Timeout in milliseconds
 * @returns {Promise<Response>}
 */
async function fetchWithTimeout(url, signal, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  // Create combined signal if external signal provided
  const combinedSignal = signal
    ? AbortSignal.any
      ? AbortSignal.any([signal, controller.signal])
      : controller.signal // Fallback for older browsers
    : controller.signal;

  try {
    const response = await fetch(url, { signal: combinedSignal });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    // Distinguish between external abort and timeout
    if (error.name === 'AbortError' && !signal?.aborted) {
      throw new Error(`Request timeout after ${timeoutMs}ms`);
    }
    throw error;
  }
}

// Build CoinGecko IDs map from asset registry (single source of truth)
const COINGECKO_IDS = getCoinGeckoIds();

// Precompute CoinGecko IDs string once at module load (optimization)
const COINGECKO_IDS_STRING = Object.values(COINGECKO_IDS).join(',');

// Finnhub API key from environment
const FINNHUB_API_KEY = import.meta.env.VITE_FINNHUB_API_KEY || '';

// Fallback rate from environment or centralized default
const FALLBACK_RATE = parseInt(import.meta.env.VITE_FALLBACK_USD_IRR) || DEFAULT_FX_RATE;

/**
 * Fetch crypto prices from CoinGecko
 * Free API, no key needed, ~30 calls/min limit
 * @param {AbortSignal} signal - Optional AbortController signal
 */
export async function fetchCryptoPrices(signal) {
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${COINGECKO_IDS_STRING}&vs_currencies=usd`;

  try {
    const response = await fetchWithTimeout(url, signal);
    if (!response.ok) throw new Error(`CoinGecko error: ${response.status}`);

    const data = await response.json();

    // Map back to our asset IDs
    const prices = {};
    for (const [assetId, geckoId] of Object.entries(COINGECKO_IDS)) {
      if (data[geckoId]?.usd) {
        prices[assetId] = data[geckoId].usd;
      }
    }

    return {
      ok: true,
      prices,
      updatedAt: new Date().toISOString(),
    };
  } catch (error) {
    // Re-throw abort errors for proper handling upstream
    if (error.name === 'AbortError') throw error;

    console.error('CoinGecko fetch error:', error);
    return { ok: false, error: error.message };
  }
}

/**
 * Fetch QQQ price from Finnhub
 * Free tier: 60 calls/min
 * @param {string} symbol - Stock symbol (default 'QQQ')
 * @param {AbortSignal} signal - Optional AbortController signal
 */
export async function fetchStockPrice(symbol = 'QQQ', signal) {
  if (!FINNHUB_API_KEY) {
    console.warn('Finnhub API key not configured');
    return { ok: false, error: 'API key not configured' };
  }

  const url = `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${FINNHUB_API_KEY}`;

  try {
    const response = await fetchWithTimeout(url, signal);
    if (!response.ok) throw new Error(`Finnhub error: ${response.status}`);

    const data = await response.json();

    if (data.c) {  // 'c' is current price
      return {
        ok: true,
        price: data.c,
        updatedAt: new Date().toISOString(),
      };
    }

    throw new Error('No price data returned');
  } catch (error) {
    // Re-throw abort errors for proper handling upstream
    if (error.name === 'AbortError') throw error;

    console.error('Finnhub fetch error:', error);
    return { ok: false, error: error.message };
  }
}

/**
 * Fetch USD/IRR rate from Bonbast (community API)
 * Falls back to hardcoded rate if unavailable
 * @param {AbortSignal} signal - Optional AbortController signal
 */
export async function fetchUsdIrrRate(signal) {
  try {
    // Community scraper API
    const response = await fetchWithTimeout('https://bonbast.amirhn.com/latest', signal);

    if (!response.ok) {
      console.warn('Bonbast API unavailable, using fallback rate');
      return {
        ok: true,
        rate: FALLBACK_RATE,
        source: 'fallback',
        updatedAt: new Date().toISOString(),
      };
    }

    const data = await response.json();

    // API returns: { usd: { sell: 145600, buy: 145400 }, ... }
    // Values are in Toman, multiply by 10 for Rial
    const sellRate = data.usd?.sell || data.USD?.sell;

    if (sellRate) {
      return {
        ok: true,
        rate: sellRate * 10,  // Convert Toman to Rial
        source: 'bonbast',
        updatedAt: new Date().toISOString(),
      };
    }

    throw new Error('Invalid response format');
  } catch (error) {
    // Re-throw abort errors for proper handling upstream
    if (error.name === 'AbortError') throw error;

    console.error('Bonbast fetch error:', error);
    return {
      ok: true,
      rate: FALLBACK_RATE,
      source: 'fallback',
      updatedAt: new Date().toISOString(),
    };
  }
}

/**
 * Fetch all prices in one call
 * Uses Promise.allSettled for resilience - partial failures don't block updates
 * @param {AbortSignal} signal - Optional AbortController signal
 */
export async function fetchAllPrices(signal) {
  // Build array of fetches - skip Finnhub if no API key to avoid repeated warnings
  const fetches = [
    fetchCryptoPrices(signal),
    fetchUsdIrrRate(signal),
  ];

  // Only fetch stock price if API key is configured
  const hasStockKey = Boolean(FINNHUB_API_KEY);
  if (hasStockKey) {
    fetches.push(fetchStockPrice('QQQ', signal));
  }

  // Use Promise.allSettled for graceful degradation on partial failures
  const settled = await Promise.allSettled(fetches);

  // Extract results, handling both fulfilled and rejected states
  const cryptoResult = settled[0].status === 'fulfilled'
    ? settled[0].value
    : { ok: false, error: settled[0].reason?.message || 'Crypto fetch failed' };

  const fxResult = settled[1].status === 'fulfilled'
    ? settled[1].value
    : { ok: false, rate: FALLBACK_RATE, source: 'fallback', error: settled[1].reason?.message || 'FX fetch failed' };

  const stockResult = hasStockKey
    ? (settled[2].status === 'fulfilled'
        ? settled[2].value
        : { ok: false, error: settled[2].reason?.message || 'Stock fetch failed' })
    : { ok: false, error: 'API key not configured' };

  const prices = {
    ...(cryptoResult.ok ? cryptoResult.prices : {}),
    ...(stockResult.ok ? { QQQ: stockResult.price } : {}),
  };

  return {
    prices,
    fxRate: fxResult.rate || FALLBACK_RATE,
    fxSource: fxResult.source || 'fallback',
    updatedAt: new Date().toISOString(),
    errors: {
      crypto: cryptoResult.ok ? null : cryptoResult.error,
      stock: stockResult.ok ? null : stockResult.error,
      fx: fxResult.ok ? null : fxResult.error,
    },
  };
}
