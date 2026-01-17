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

import { getCoinGeckoIds } from '../registry/assetRegistry';
import { DEFAULT_FX_RATE } from '../constants/index';

// Default timeout for API requests (8 seconds)
const DEFAULT_TIMEOUT_MS = 8000;

export interface CryptoPricesResult {
  ok: true;
  prices: Record<string, number>;
  updatedAt: string;
}

export interface CryptoPricesError {
  ok: false;
  error: string;
}

export type CryptoPricesResponse = CryptoPricesResult | CryptoPricesError;

export interface StockPriceResult {
  ok: true;
  price: number;
  updatedAt: string;
}

export interface StockPriceError {
  ok: false;
  error: string;
}

export type StockPriceResponse = StockPriceResult | StockPriceError;

export interface FxRateResult {
  ok: true;
  rate: number;
  source: 'bonbast' | 'fallback';
  updatedAt: string;
}

export interface FxRateError {
  ok: false;
  rate: number;
  source: 'fallback';
  error: string;
}

export type FxRateResponse = FxRateResult | FxRateError;

export interface AllPricesResult {
  prices: Record<string, number>;
  fxRate: number;
  fxSource: string;
  updatedAt: string;
  errors: {
    crypto: string | null;
    stock: string | null;
    fx: string | null;
  };
}

/**
 * Fetch with timeout support
 * Creates a race between the fetch and a timeout abort
 * Uses polyfill for AbortSignal.any() for browser compatibility
 */
async function fetchWithTimeout(
  url: string,
  signal?: AbortSignal,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  // Polyfill for AbortSignal.any() - combines multiple abort signals
  // AbortSignal.any() is only available in modern browsers (Chrome 116+, Firefox 124+)
  let cleanup: (() => void) | null = null;
  if (signal) {
    // If external signal is already aborted, abort immediately
    if (signal.aborted) {
      clearTimeout(timeoutId);
      controller.abort();
    } else {
      // Forward external abort to our controller
      const onExternalAbort = () => controller.abort();
      signal.addEventListener('abort', onExternalAbort);
      cleanup = () => signal.removeEventListener('abort', onExternalAbort);
    }
  }

  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    cleanup?.();
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    cleanup?.();
    // Distinguish between external abort and timeout
    if ((error as Error).name === 'AbortError') {
      // If external signal was aborted, re-throw as abort
      if (signal?.aborted) throw error;
      // Otherwise it was our timeout
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
const FALLBACK_RATE = parseInt(import.meta.env.VITE_FALLBACK_USD_IRR as string) || DEFAULT_FX_RATE;

/**
 * Fetch crypto prices from CoinGecko
 * Free API, no key needed, ~30 calls/min limit
 */
export async function fetchCryptoPrices(signal?: AbortSignal): Promise<CryptoPricesResponse> {
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${COINGECKO_IDS_STRING}&vs_currencies=usd`;

  try {
    const response = await fetchWithTimeout(url, signal);
    if (!response.ok) throw new Error(`CoinGecko error: ${response.status}`);

    let data;
    try {
      data = await response.json();
    } catch {
      throw new Error('Invalid JSON response from CoinGecko');
    }

    // Map back to our asset IDs
    const prices: Record<string, number> = {};
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
    if ((error as Error).name === 'AbortError') throw error;

    console.error('CoinGecko fetch error:', error);
    return { ok: false, error: (error as Error).message };
  }
}

/**
 * Fetch QQQ price from Finnhub
 * Free tier: 60 calls/min
 */
export async function fetchStockPrice(
  symbol: string = 'QQQ',
  signal?: AbortSignal
): Promise<StockPriceResponse> {
  if (!FINNHUB_API_KEY) {
    console.warn('Finnhub API key not configured');
    return { ok: false, error: 'API key not configured' };
  }

  const url = `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${FINNHUB_API_KEY}`;

  try {
    const response = await fetchWithTimeout(url, signal);
    if (!response.ok) throw new Error(`Finnhub error: ${response.status}`);

    let data;
    try {
      data = await response.json();
    } catch {
      throw new Error('Invalid JSON response from Finnhub');
    }

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
    if ((error as Error).name === 'AbortError') throw error;

    console.error('Finnhub fetch error:', error);
    return { ok: false, error: (error as Error).message };
  }
}

/**
 * Fetch USD/IRR rate from Bonbast (community API)
 * Falls back to hardcoded rate if unavailable
 */
export async function fetchUsdIrrRate(signal?: AbortSignal): Promise<FxRateResponse> {
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

    let data;
    try {
      data = await response.json();
    } catch {
      console.warn('Invalid JSON from Bonbast, using fallback rate');
      return {
        ok: true,
        rate: FALLBACK_RATE,
        source: 'fallback',
        updatedAt: new Date().toISOString(),
      };
    }

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
    if ((error as Error).name === 'AbortError') throw error;

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
 */
export async function fetchAllPrices(signal?: AbortSignal): Promise<AllPricesResult> {
  // Build array of fetches - skip Finnhub if no API key to avoid repeated warnings
  const fetches: Promise<CryptoPricesResponse | FxRateResponse | StockPriceResponse>[] = [
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
  const cryptoResult: CryptoPricesResponse = settled[0].status === 'fulfilled'
    ? settled[0].value as CryptoPricesResponse
    : { ok: false, error: settled[0].reason?.message || 'Crypto fetch failed' };

  const fxResult: FxRateResponse = settled[1].status === 'fulfilled'
    ? settled[1].value as FxRateResponse
    : { ok: false, rate: FALLBACK_RATE, source: 'fallback', error: settled[1].reason?.message || 'FX fetch failed' };

  const stockResult: StockPriceResponse = hasStockKey
    ? (settled[2].status === 'fulfilled'
        ? settled[2].value as StockPriceResponse
        : { ok: false, error: settled[2].reason?.message || 'Stock fetch failed' })
    : { ok: false, error: 'API key not configured' };

  const prices: Record<string, number> = {
    ...(cryptoResult.ok ? cryptoResult.prices : {}),
    ...(stockResult.ok ? { QQQ: stockResult.price } : {}),
  };

  return {
    prices,
    fxRate: fxResult.rate || FALLBACK_RATE,
    fxSource: fxResult.source || 'fallback',
    updatedAt: new Date().toISOString(),
    errors: {
      crypto: cryptoResult.ok ? null : (cryptoResult as CryptoPricesError).error,
      stock: stockResult.ok ? null : (stockResult as StockPriceError).error,
      fx: fxResult.ok ? null : (fxResult as FxRateError).error || null,
    },
  };
}
