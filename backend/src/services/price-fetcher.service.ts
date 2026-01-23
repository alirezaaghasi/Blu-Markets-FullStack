import { prisma } from '../config/database.js';
import { env } from '../config/env.js';
import { FALLBACK_FX_RATE, type AssetId } from '../types/domain.js';
import { priceBroadcaster } from './price-broadcaster.service.js';

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
    const response = await fetch('https://bonbast.amirhn.com/latest', {
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
    console.error('Failed to fetch FX rate:', error);
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

    const response = await fetch(url, { headers });

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
    console.error('Failed to fetch crypto prices:', error);
    return [];
  }
}

// Fetch stock/ETF prices from Finnhub
export async function fetchStockPrices(): Promise<FetchedPrice[]> {
  if (!env.FINNHUB_API_KEY) {
    console.warn('FINNHUB_API_KEY not configured');
    return [];
  }

  const prices: FetchedPrice[] = [];

  for (const [symbol, assetId] of Object.entries(FINNHUB_ASSETS)) {
    try {
      // SECURITY: Use header authentication instead of URL parameter
      // API keys in URLs can be logged in server access logs and browser history
      const response = await fetch(
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
      console.error(`Failed to fetch ${symbol} price:`, error);
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

  // PERFORMANCE: Single bulk upsert instead of N individual upserts
  // Uses PostgreSQL INSERT ... ON CONFLICT DO UPDATE (UPSERT) for efficiency
  if (upsertData.length > 0) {
    const values = upsertData.map((d, i) => {
      const offset = i * 5;
      return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${upsertData.length * 5 + 1}, $${upsertData.length * 5 + 2}, $${upsertData.length * 5 + 3})`;
    }).join(', ');

    const params: (string | number | null | Date)[] = [];
    for (const d of upsertData) {
      params.push(d.assetId, d.priceUsd, d.priceIrr, d.change24hPct, d.source);
    }
    // Add shared params for all rows
    params.push(fetchedAt, fxRate.usdIrr, fxRate.source);

    await prisma.$executeRawUnsafe(`
      INSERT INTO prices (asset_id, price_usd, price_irr, change_24h_pct, source, fetched_at, fx_rate, fx_source)
      VALUES ${values}
      ON CONFLICT (asset_id) DO UPDATE SET
        price_usd = EXCLUDED.price_usd,
        price_irr = EXCLUDED.price_irr,
        change_24h_pct = EXCLUDED.change_24h_pct,
        source = EXCLUDED.source,
        fetched_at = EXCLUDED.fetched_at,
        fx_rate = EXCLUDED.fx_rate,
        fx_source = EXCLUDED.fx_source
    `, ...params);
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
  console.log(`✅ Updated ${allPrices.length} prices in ${duration}ms (broadcast sent)`);
}

// Get current prices from database with 5-second in-memory cache
export async function getCurrentPrices(): Promise<Map<AssetId, { priceUsd: number; priceIrr: number; change24hPct?: number }>> {
  const now = Date.now();

  // Return cached data if valid
  if (priceCache.data && (now - priceCache.timestamp) < PRICE_CACHE_TTL_MS) {
    return priceCache.data;
  }

  // Fetch from database
  const prices = await prisma.price.findMany();
  const priceMap = new Map<AssetId, { priceUsd: number; priceIrr: number; change24hPct?: number }>();

  for (const price of prices) {
    priceMap.set(price.assetId as AssetId, {
      priceUsd: Number(price.priceUsd),
      priceIrr: Number(price.priceIrr),
      change24hPct: price.change24hPct ? Number(price.change24hPct) : undefined,
    });
  }

  // Update cache
  priceCache.data = priceMap;
  priceCache.timestamp = now;

  return priceMap;
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
