/**
 * Price Service - Fetches live prices from multiple APIs
 *
 * Sources:
 * - CoinGecko: BTC, ETH, SOL, TON, USDT, GOLD (free, no key)
 * - Finnhub: QQQ (free with API key)
 * - Bonbast: USD/IRR rate
 */

// CoinGecko IDs for our assets
const COINGECKO_IDS = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  SOL: 'solana',
  TON: 'the-open-network',
  USDT: 'tether',
  GOLD: 'pax-gold',  // Using PAXG as gold proxy (1 PAXG = 1 oz gold)
};

// Finnhub API key from environment
const FINNHUB_API_KEY = import.meta.env.VITE_FINNHUB_API_KEY || '';

// Fallback rate from environment or default
const FALLBACK_RATE = parseInt(import.meta.env.VITE_FALLBACK_USD_IRR) || 1456000;

/**
 * Fetch crypto prices from CoinGecko
 * Free API, no key needed, ~30 calls/min limit
 */
export async function fetchCryptoPrices() {
  const ids = Object.values(COINGECKO_IDS).join(',');
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`;

  try {
    const response = await fetch(url);
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
    console.error('CoinGecko fetch error:', error);
    return { ok: false, error: error.message };
  }
}

/**
 * Fetch QQQ price from Finnhub
 * Free tier: 60 calls/min
 */
export async function fetchStockPrice(symbol = 'QQQ') {
  if (!FINNHUB_API_KEY) {
    console.warn('Finnhub API key not configured');
    return { ok: false, error: 'API key not configured' };
  }

  const url = `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${FINNHUB_API_KEY}`;

  try {
    const response = await fetch(url);
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
    console.error('Finnhub fetch error:', error);
    return { ok: false, error: error.message };
  }
}

/**
 * Fetch USD/IRR rate from Bonbast (community API)
 * Falls back to hardcoded rate if unavailable
 */
export async function fetchUsdIrrRate() {
  try {
    // Community scraper API
    const response = await fetch('https://bonbast.amirhn.com/latest');

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
 */
export async function fetchAllPrices() {
  const [cryptoResult, stockResult, fxResult] = await Promise.all([
    fetchCryptoPrices(),
    fetchStockPrice('QQQ'),
    fetchUsdIrrRate(),
  ]);

  const prices = {
    ...(cryptoResult.ok ? cryptoResult.prices : {}),
    ...(stockResult.ok ? { QQQ: stockResult.price } : {}),
  };

  return {
    prices,
    fxRate: fxResult.rate,
    fxSource: fxResult.source,
    updatedAt: new Date().toISOString(),
    errors: {
      crypto: cryptoResult.ok ? null : cryptoResult.error,
      stock: stockResult.ok ? null : stockResult.error,
      fx: fxResult.ok ? null : fxResult.error,
    },
  };
}
