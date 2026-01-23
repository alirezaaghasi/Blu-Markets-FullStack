import { prisma } from '../config/database.js';
import { env } from '../config/env.js';
import { FALLBACK_FX_RATE, type AssetId } from '../types/domain.js';
import { priceBroadcaster } from './price-broadcaster.service.js';

// Price cache configuration
const PRICE_CACHE_TTL_MS = 5000; // 5 seconds cache
let priceCache: {
  data: Map<AssetId, { priceUsd: number; priceIrr: number; change24hPct?: number }> | null;
  timestamp: number;
} = {
  data: null,
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

  // Collect all price updates for broadcasting and batch upsert
  const priceUpdates = new Map<AssetId, { priceUsd: number; priceIrr: number; change24hPct?: number; source: string; timestamp: string }>();

  // Prepare batch upsert data
  const upsertOperations = allPrices.map((price) => {
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

    return prisma.price.upsert({
      where: { assetId: price.assetId },
      create: {
        assetId: price.assetId,
        priceUsd: price.priceUsd,
        priceIrr,
        fxRate: fxRate.usdIrr,
        fxSource: fxRate.source,
        source: price.source,
        fetchedAt,
        change24hPct: price.change24hPct,
      },
      update: {
        priceUsd: price.priceUsd,
        priceIrr,
        fxRate: fxRate.usdIrr,
        fxSource: fxRate.source,
        source: price.source,
        fetchedAt,
        change24hPct: price.change24hPct,
      },
    });
  });

  // Execute all upserts in a single transaction for better performance
  await prisma.$transaction(upsertOperations);

  // Invalidate cache after update
  priceCache.data = null;
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
