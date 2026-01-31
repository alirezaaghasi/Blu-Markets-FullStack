import { prisma } from '../config/database.js';
import { env } from '../config/env.js';
import { FALLBACK_FX_RATE, type AssetId } from '../types/domain.js';
import { priceBroadcaster } from './price-broadcaster.service.js';
import { logger } from '../utils/logger.js';

// =============================================================================
// SECURITY FIX M-03: Fetch utilities with timeout and retry
// =============================================================================

const DEFAULT_TIMEOUT_MS = 5000; // 5 seconds
const MAX_RETRIES = 3;

/**
 * Fetch with timeout using AbortController
 */
async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs: number = DEFAULT_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Fetch with retry and exponential backoff
 */
async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  maxRetries: number = MAX_RETRIES,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<Response> {
  let lastError: Error = new Error('Unknown error');

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fetchWithTimeout(url, options, timeoutMs);
    } catch (error) {
      lastError = error as Error;
      if ((error as Error).name === 'AbortError') {
        logger.warn('Request timeout', { url, attempt: attempt + 1, maxRetries });
      } else {
        logger.warn('Request failed', { url, attempt: attempt + 1, maxRetries, error: (error as Error).message });
      }

      // Don't wait after the last attempt
      if (attempt < maxRetries - 1) {
        // Exponential backoff: 1s, 2s, 4s
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

/**
 * Check if a price is stale (older than maxAgeMinutes)
 */
export function isPriceStale(fetchedAt: Date, maxAgeMinutes: number = 5): boolean {
  const ageMs = Date.now() - fetchedAt.getTime();
  return ageMs > maxAgeMinutes * 60 * 1000;
}

// =============================================================================

// Price cache configuration
const PRICE_CACHE_TTL_MS = 5000; // 5 seconds cache

// Extended price data for API responses
export interface CachedPriceData {
  assetId: AssetId;
  priceUsd: number;
  priceIrr: number;
  change24hPct?: number;
  source: string;
  fetchedAt: Date;
}

let priceCache: {
  data: Map<AssetId, { priceUsd: number; priceIrr: number; change24hPct?: number }> | null;
  fullData: Map<AssetId, CachedPriceData> | null;
  timestamp: number;
} = {
  data: null,
  fullData: null,
  timestamp: 0,
};

// Asset configuration per PRD
const COINGECKO_ASSETS: Record<string, AssetId> = {
  bitcoin: 'BTC',
  ethereum: 'ETH',
  solana: 'SOL',
  'the-open-network': 'TON',
  tether: 'USDT',
  'pax-gold': 'PAXG',
  binancecoin: 'BNB',
  ripple: 'XRP',
  chainlink: 'LINK',
  'avalanche-2': 'AVAX',
  'matic-network': 'MATIC',
  arbitrum: 'ARB',
  'kinesis-silver': 'KAG', // Kinesis Silver for Growth layer
};

const FINNHUB_ASSETS: Record<string, AssetId> = {
  QQQ: 'QQQ',
};

interface FetchedPrice {
  assetId: AssetId;
  priceUsd: number;
  change24hPct?: number;
  source: string;
}

interface FxRate {
  usdIrr: number;
  source: string;
}

// Fetch USD/IRR rate from Bonbast
export async function fetchFxRate(): Promise<FxRate> {
  try {
    // SECURITY FIX M-03: Use fetch with timeout and retry
    const response = await fetchWithRetry('https://bonbast.amirhn.com/latest', {
      headers: { 'User-Agent': 'BluMarkets/1.0' },
    });

    if (!response.ok) {
      throw new Error(`Bonbast API error: ${response.status}`);
    }

    const data = await response.json();
    const usdRate = data.usd?.sell || data.usd;

    if (typeof usdRate === 'number' && usdRate > 0) {
      return { usdIrr: usdRate * 10, source: 'bonbast' }; // Bonbast returns in Toman, convert to Rial
    }

    throw new Error('Invalid Bonbast response');
  } catch (error) {
    logger.error('Failed to fetch FX rate', error);
    return { usdIrr: FALLBACK_FX_RATE, source: 'fallback' };
  }
}

// Fetch crypto prices from CoinGecko
export async function fetchCryptoPrices(): Promise<FetchedPrice[]> {
  const ids = Object.keys(COINGECKO_ASSETS).join(',');

  try {
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`;
    const headers: Record<string, string> = {
      'User-Agent': 'BluMarkets/1.0',
    };

    if (env.COINGECKO_API_KEY) {
      headers['x-cg-demo-api-key'] = env.COINGECKO_API_KEY;
    }

    // SECURITY FIX M-03: Use fetch with timeout and retry
    const response = await fetchWithRetry(url, { headers });

    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.status}`);
    }

    const data = await response.json();
    const prices: FetchedPrice[] = [];

    for (const [coingeckoId, assetId] of Object.entries(COINGECKO_ASSETS)) {
      const priceData = data[coingeckoId];
      if (priceData?.usd) {
        prices.push({
          assetId,
          priceUsd: priceData.usd,
          change24hPct: priceData.usd_24h_change,
          source: 'coingecko',
        });
      }
    }

    return prices;
  } catch (error) {
    logger.error('Failed to fetch crypto prices', error);
    return [];
  }
}

// Fetch stock/ETF prices from Finnhub
export async function fetchStockPrices(): Promise<FetchedPrice[]> {
  if (!env.FINNHUB_API_KEY) {
    logger.warn('FINNHUB_API_KEY not configured');
    return [];
  }

  const prices: FetchedPrice[] = [];

  for (const [symbol, assetId] of Object.entries(FINNHUB_ASSETS)) {
    try {
      // SECURITY: Use header authentication instead of URL parameter
      // API keys in URLs can be logged in server access logs and browser history
      // SECURITY FIX M-03: Use fetch with timeout and retry
      const response = await fetchWithRetry(
        `https://finnhub.io/api/v1/quote?symbol=${symbol}`,
        {
          headers: {
            'X-Finnhub-Token': env.FINNHUB_API_KEY,
          },
        }
      );

      if (!response.ok) continue;

      const data = await response.json();
      if (data.c > 0) {
        const change24hPct = data.pc > 0 ? ((data.c - data.pc) / data.pc) * 100 : undefined;
        prices.push({
          assetId,
          priceUsd: data.c,
          change24hPct,
          source: 'finnhub',
        });
      }
    } catch (error) {
      logger.error('Failed to fetch stock price', error, { symbol });
    }
  }

  return prices;
}

// Internal assets (Fixed Income)
function getInternalPrices(): FetchedPrice[] {
  return [
    {
      assetId: 'IRR_FIXED_INCOME',
      priceUsd: 0, // Price is in IRR only
      source: 'internal',
    },
  ];
}

// Gold price (use PAXG as proxy or dedicated gold API)
export async function fetchGoldPrice(): Promise<FetchedPrice | null> {
  // PAXG from CoinGecko serves as gold price proxy
  // Already included in crypto prices
  return null;
}

// Main function to update all prices
export async function updateAllPrices(): Promise<void> {
  const startTime = Date.now();

  // Fetch FX rate first
  const fxRate = await fetchFxRate();

  // Fetch prices in parallel
  const [cryptoPrices, stockPrices] = await Promise.all([
    fetchCryptoPrices(),
    fetchStockPrices(),
  ]);

  const allPrices = [...cryptoPrices, ...stockPrices, ...getInternalPrices()];
  const fetchedAt = new Date();
  const timestamp = fetchedAt.toISOString();

  // Collect all price updates for broadcasting
  const priceUpdates = new Map<AssetId, { priceUsd: number; priceIrr: number; change24hPct?: number; source: string; timestamp: string }>();

  // Prepare data for bulk upsert
  const upsertData: Array<{
    assetId: string;
    priceUsd: number;
    priceIrr: number;
    change24hPct: number | null;
    source: string;
  }> = [];

  for (const price of allPrices) {
    const priceIrr =
      price.assetId === 'IRR_FIXED_INCOME'
        ? 500000 // Fixed income unit price
        : price.priceUsd * fxRate.usdIrr;

    // Collect for broadcast
    priceUpdates.set(price.assetId, {
      priceUsd: price.priceUsd,
      priceIrr,
      change24hPct: price.change24hPct,
      source: price.source,
      timestamp,
    });

    upsertData.push({
      assetId: price.assetId,
      priceUsd: price.priceUsd,
      priceIrr,
      change24hPct: price.change24hPct ?? null,
      source: price.source,
    });
  }

  // SECURITY FIX L-01: Replace $executeRawUnsafe with safe Prisma transaction
  // Uses individual upserts within a transaction for safety while maintaining atomicity
  if (upsertData.length > 0) {
    await prisma.$transaction(
      upsertData.map((d) =>
        prisma.price.upsert({
          where: { assetId: d.assetId },
          update: {
            priceUsd: d.priceUsd,
            priceIrr: d.priceIrr,
            change24hPct: d.change24hPct,
            source: d.source,
            fetchedAt: fetchedAt,
            fxRate: fxRate.usdIrr,
            fxSource: fxRate.source,
          },
          create: {
            assetId: d.assetId,
            priceUsd: d.priceUsd,
            priceIrr: d.priceIrr,
            change24hPct: d.change24hPct,
            source: d.source,
            fetchedAt: fetchedAt,
            fxRate: fxRate.usdIrr,
            fxSource: fxRate.source,
          },
        })
      )
    );
  }

  // Invalidate cache after update
  priceCache.data = null;
  priceCache.fullData = null;
  priceCache.timestamp = 0;

  // Broadcast individual price updates
  for (const price of allPrices) {
    const update = priceUpdates.get(price.assetId);
    if (update) {
      priceBroadcaster.broadcastPriceUpdate(price.assetId, update);
    }
  }

  // Broadcast FX rate update
  priceBroadcaster.broadcastFxUpdate({
    usdIrr: fxRate.usdIrr,
    source: fxRate.source,
    timestamp,
  });

  // Broadcast all prices together
  priceBroadcaster.broadcastAllPrices(priceUpdates);

  const duration = Date.now() - startTime;
  logger.info('Updated prices', { count: allPrices.length, durationMs: duration });
}

/**
 * Options for getting current prices
 */
interface GetPricesOptions {
  /**
   * Maximum age in minutes for prices to be considered valid.
   * If prices are older than this, a warning is logged but prices are still returned.
   * Default: 5 minutes
   */
  maxAgeMinutes?: number;

  /**
   * If true, returns stale prices even if they exceed maxAgeMinutes.
   * Useful for onboarding where having some prices is better than none.
   * Default: false
   */
  allowStale?: boolean;
}

// Get current prices from database with 5-second in-memory cache
export async function getCurrentPrices(options: GetPricesOptions = {}): Promise<Map<AssetId, { priceUsd: number; priceIrr: number; change24hPct?: number }>> {
  const { maxAgeMinutes = 5, allowStale = false } = options;
  const now = Date.now();

  // Return cached data if valid
  if (priceCache.data && (now - priceCache.timestamp) < PRICE_CACHE_TTL_MS) {
    return priceCache.data;
  }

  // Fetch from database
  const prices = await prisma.price.findMany();
  const priceMap = new Map<AssetId, { priceUsd: number; priceIrr: number; change24hPct?: number }>();

  // Track staleness for logging
  let oldestFetchedAt: Date | null = null;
  let hasStalePrice = false;

  for (const price of prices) {
    // Track oldest price for staleness warning
    if (!oldestFetchedAt || price.fetchedAt < oldestFetchedAt) {
      oldestFetchedAt = price.fetchedAt;
    }

    // Check if this price is stale
    if (isPriceStale(price.fetchedAt, maxAgeMinutes)) {
      hasStalePrice = true;
    }

    priceMap.set(price.assetId as AssetId, {
      priceUsd: Number(price.priceUsd),
      priceIrr: Number(price.priceIrr),
      change24hPct: price.change24hPct ? Number(price.change24hPct) : undefined,
    });
  }

  // Log warning if prices are stale
  if (hasStalePrice && oldestFetchedAt) {
    const ageMinutes = Math.round((now - oldestFetchedAt.getTime()) / 60000);
    if (allowStale) {
      logger.warn('Using stale prices for operation', {
        oldestPriceAge: `${ageMinutes} minutes`,
        maxAgeMinutes,
        priceCount: priceMap.size,
      });
    } else {
      logger.warn('Prices are stale', {
        oldestPriceAge: `${ageMinutes} minutes`,
        maxAgeMinutes,
        priceCount: priceMap.size,
      });
    }
  }

  // Update cache
  priceCache.data = priceMap;
  priceCache.timestamp = now;

  return priceMap;
}

/**
 * Get prices with fallback for onboarding.
 * Uses a 60-minute staleness threshold and allows stale prices.
 * This ensures onboarding can proceed even during temporary price API outages.
 */
export async function getPricesForOnboarding(): Promise<Map<AssetId, { priceUsd: number; priceIrr: number; change24hPct?: number }>> {
  return getCurrentPrices({
    maxAgeMinutes: 60, // Allow prices up to 1 hour old for onboarding
    allowStale: true,  // Log warning but don't fail
  });
}

/**
 * Get all prices with full data for API responses (includes source and fetchedAt)
 * Uses the same cache as getCurrentPrices to avoid redundant DB queries
 */
export async function getAllPricesForApi(): Promise<{
  prices: CachedPriceData[];
  latestFetchedAt: Date | null;
}> {
  const now = Date.now();

  // Return cached full data if valid
  if (priceCache.fullData && (now - priceCache.timestamp) < PRICE_CACHE_TTL_MS) {
    const prices = Array.from(priceCache.fullData.values());
    const latestFetchedAt = prices.length > 0
      ? new Date(Math.max(...prices.map(p => p.fetchedAt.getTime())))
      : null;
    return { prices, latestFetchedAt };
  }

  // Fetch from database (no asset join needed - we only need price data)
  const dbPrices = await prisma.price.findMany();

  const fullDataMap = new Map<AssetId, CachedPriceData>();
  const priceMap = new Map<AssetId, { priceUsd: number; priceIrr: number; change24hPct?: number }>();

  for (const price of dbPrices) {
    const assetId = price.assetId as AssetId;
    fullDataMap.set(assetId, {
      assetId,
      priceUsd: Number(price.priceUsd),
      priceIrr: Number(price.priceIrr),
      change24hPct: price.change24hPct ? Number(price.change24hPct) : undefined,
      source: price.source || 'unknown',
      fetchedAt: price.fetchedAt,
    });
    priceMap.set(assetId, {
      priceUsd: Number(price.priceUsd),
      priceIrr: Number(price.priceIrr),
      change24hPct: price.change24hPct ? Number(price.change24hPct) : undefined,
    });
  }

  // Update both caches
  priceCache.data = priceMap;
  priceCache.fullData = fullDataMap;
  priceCache.timestamp = now;

  const prices = Array.from(fullDataMap.values());
  const latestFetchedAt = prices.length > 0
    ? new Date(Math.max(...prices.map(p => p.fetchedAt.getTime())))
    : null;

  return { prices, latestFetchedAt };
}

// Get single asset price
export async function getAssetPrice(assetId: AssetId): Promise<{
  priceUsd: number;
  priceIrr: number;
  change24hPct?: number;
  fetchedAt: Date;
} | null> {
  const price = await prisma.price.findUnique({
    where: { assetId },
  });

  if (!price) return null;

  return {
    priceUsd: Number(price.priceUsd),
    priceIrr: Number(price.priceIrr),
    change24hPct: price.change24hPct ? Number(price.change24hPct) : undefined,
    fetchedAt: price.fetchedAt,
  };
}

// Get current FX rate
export async function getCurrentFxRate(): Promise<{ usdIrr: number; source: string; fetchedAt: Date }> {
  const anyPrice = await prisma.price.findFirst({
    orderBy: { updatedAt: 'desc' },
  });

  if (anyPrice) {
    return {
      usdIrr: Number(anyPrice.fxRate),
      source: anyPrice.fxSource || 'unknown',
      fetchedAt: anyPrice.fetchedAt,
    };
  }

  return {
    usdIrr: FALLBACK_FX_RATE,
    source: 'fallback',
    fetchedAt: new Date(),
  };
}
