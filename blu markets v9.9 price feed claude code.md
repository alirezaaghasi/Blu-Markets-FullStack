# Blu Markets v9.9 — Price Feed System

## Overview

Implement live price feeds to make portfolio values dynamic. Holdings will store **quantities** instead of fixed IRR values. Portfolio value = Σ(quantity × price × USD_IRR rate).

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        PRICE SERVICE                            │
├─────────────────────────────────────────────────────────────────┤
│  CoinGecko API ──► BTC, ETH, SOL, TON, USDT, GOLD (30s)        │
│  Finnhub API ────► QQQ (60s)                                    │
│  Bonbast API ────► USD/IRR rate (60s)                           │
│  Internal ───────► IRR_FIXED_INCOME (computed)                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         STATE                                   │
├─────────────────────────────────────────────────────────────────┤
│  prices: { BTC: 97500, ETH: 3200, ... }  (USD)                 │
│  fxRate: { USD_IRR: 1456000 }                                   │
│  holdings: [{ assetId, quantity, purchasedAt?, frozen }]       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    COMPUTED VALUES                              │
├─────────────────────────────────────────────────────────────────┤
│  valueIRR = quantity × priceUSD × USD_IRR                      │
│  (except IRR_FIXED_INCOME which is principal + accrued)        │
└─────────────────────────────────────────────────────────────────┘
```

---

## Files to Create/Modify

### New Files
- `src/services/priceService.js` — API calls and polling
- `src/services/bonbastService.js` — USD/IRR rate fetching
- `src/hooks/usePrices.js` — React hook for price state

### Modified Files
- `src/state/domain.js` — Add asset metadata (decimals, CoinGecko IDs)
- `src/reducers/appReducer.js` — Store quantities instead of valueIRR
- `src/engine/snapshot.js` — Compute values from quantities × prices
- `src/helpers.js` — Add price formatting helpers
- `src/constants/index.js` — Add fixed income constants
- `src/App.jsx` — Initialize price polling
- `src/components/HoldingRow.jsx` — Display price + special handling for bonds

---

## Step 1: Asset Metadata

### File: `src/state/domain.js`

```javascript
// Domain definitions - Enhanced for price feeds

export const ASSETS = [
  "USDT",
  "IRR_FIXED_INCOME",
  "GOLD",
  "BTC",
  "ETH",
  "QQQ",
  "SOL",
  "TON",
];

export const ASSET_LAYER = {
  USDT: "FOUNDATION",
  IRR_FIXED_INCOME: "FOUNDATION",
  GOLD: "GROWTH",
  BTC: "GROWTH",
  QQQ: "GROWTH",
  ETH: "UPSIDE",
  SOL: "UPSIDE",
  TON: "UPSIDE",
};

// Asset metadata for price feeds
export const ASSET_META = {
  USDT: {
    coingeckoId: 'tether',
    source: 'coingecko',
    decimals: 2,
    currency: 'USD',
  },
  BTC: {
    coingeckoId: 'bitcoin',
    source: 'coingecko',
    decimals: 8,
    currency: 'USD',
  },
  ETH: {
    coingeckoId: 'ethereum',
    source: 'coingecko',
    decimals: 6,
    currency: 'USD',
  },
  SOL: {
    coingeckoId: 'solana',
    source: 'coingecko',
    decimals: 4,
    currency: 'USD',
  },
  TON: {
    coingeckoId: 'the-open-network',
    source: 'coingecko',
    decimals: 4,
    currency: 'USD',
  },
  GOLD: {
    coingeckoId: 'gold',  // CoinGecko has XAU
    source: 'coingecko',
    decimals: 4,
    currency: 'USD',
    unit: 'oz',  // per troy ounce
  },
  QQQ: {
    symbol: 'QQQ',
    source: 'finnhub',
    decimals: 2,
    currency: 'USD',
  },
  IRR_FIXED_INCOME: {
    source: 'internal',
    currency: 'IRR',
    unitPrice: 500000,      // 500,000 IRR per unit
    annualRate: 0.30,       // 30% annual return
  },
};

export const LAYER_RANGES = {
  FOUNDATION: { min: 40, max: 70, hardMin: 30 },
  GROWTH: { min: 20, max: 45 },
  UPSIDE: { min: 0, max: 20, hardMax: 25 },
};
```

---

## Step 2: Price Service

### File: `src/services/priceService.js`

```javascript
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

// Finnhub API key (free tier)
const FINNHUB_API_KEY = 'YOUR_FINNHUB_API_KEY';  // Get free key at finnhub.io

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
  const FALLBACK_RATE = 1456000;  // 1 USD = 1,456,000 IRR (update periodically)
  
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
```

---

## Step 3: React Hook for Prices

### File: `src/hooks/usePrices.js`

```javascript
import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchAllPrices } from '../services/priceService.js';

// Default prices (fallback if APIs fail)
const DEFAULT_PRICES = {
  BTC: 97500,
  ETH: 3200,
  SOL: 185,
  TON: 5.20,
  USDT: 1.0,
  GOLD: 2650,  // per oz
  QQQ: 520,
};

const DEFAULT_FX_RATE = 1456000;  // 1 USD = 1,456,000 IRR

/**
 * usePrices - Hook for live price feeds
 * 
 * @param {number} interval - Polling interval in ms (default 30000)
 * @returns {Object} { prices, fxRate, loading, error, lastUpdated, refresh }
 */
export function usePrices(interval = 30000) {
  const [prices, setPrices] = useState(DEFAULT_PRICES);
  const [fxRate, setFxRate] = useState(DEFAULT_FX_RATE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  
  const intervalRef = useRef(null);
  
  const refresh = useCallback(async () => {
    try {
      const result = await fetchAllPrices();
      
      // Merge with existing prices (don't lose data if one API fails)
      setPrices(prev => ({
        ...prev,
        ...result.prices,
      }));
      
      if (result.fxRate) {
        setFxRate(result.fxRate);
      }
      
      setLastUpdated(result.updatedAt);
      setError(null);
    } catch (err) {
      console.error('Price refresh error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);
  
  // Initial fetch
  useEffect(() => {
    refresh();
  }, [refresh]);
  
  // Polling
  useEffect(() => {
    intervalRef.current = setInterval(refresh, interval);
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [refresh, interval]);
  
  return {
    prices,
    fxRate,
    loading,
    error,
    lastUpdated,
    refresh,
  };
}

export default usePrices;
```

---

## Step 4: Fixed Income Calculations

### File: `src/engine/fixedIncome.js`

```javascript
/**
 * IRR Fixed Income Calculations
 * 
 * Model: Fixed unit price + accrued interest
 * - Unit price: 500,000 IRR
 * - Annual rate: 30%
 * - Interest type: Simple interest (matches Iranian bank practice)
 */

export const FIXED_INCOME_UNIT_PRICE = 500_000;  // IRR per unit
export const FIXED_INCOME_ANNUAL_RATE = 0.30;    // 30% annual

/**
 * Calculate fixed income value breakdown
 * 
 * @param {number} quantity - Number of units held
 * @param {string} purchasedAt - ISO timestamp of purchase
 * @returns {Object} { principal, accrued, total, daysHeld, dailyRate }
 */
export function calculateFixedIncomeValue(quantity, purchasedAt) {
  const principal = quantity * FIXED_INCOME_UNIT_PRICE;
  
  if (!purchasedAt) {
    return {
      principal,
      accrued: 0,
      total: principal,
      daysHeld: 0,
      dailyRate: 0,
    };
  }
  
  const now = Date.now();
  const purchased = new Date(purchasedAt).getTime();
  const daysHeld = Math.max(0, (now - purchased) / (1000 * 60 * 60 * 24));
  
  // Simple interest: P × r × (days/365)
  const accrued = Math.round(principal * FIXED_INCOME_ANNUAL_RATE * (daysHeld / 365));
  
  // Daily rate for display
  const dailyRate = principal * FIXED_INCOME_ANNUAL_RATE / 365;
  
  return {
    principal,
    accrued,
    total: principal + accrued,
    daysHeld: Math.floor(daysHeld),
    dailyRate: Math.round(dailyRate),
  };
}

/**
 * Convert IRR amount to fixed income units
 * Used when buying fixed income
 * 
 * @param {number} amountIRR - Amount in IRR to invest
 * @returns {number} Number of units (can be fractional)
 */
export function irrToFixedIncomeUnits(amountIRR) {
  return amountIRR / FIXED_INCOME_UNIT_PRICE;
}

/**
 * Convert fixed income units to IRR (principal only)
 * Used for display and calculations
 * 
 * @param {number} units - Number of units
 * @returns {number} Principal value in IRR
 */
export function fixedIncomeUnitsToIRR(units) {
  return units * FIXED_INCOME_UNIT_PRICE;
}
```

---

## Step 5: Update Holdings Structure

### File: `src/reducers/appReducer.js`

Update the holdings structure and initial state:

```javascript
// In initialState():
holdings: ASSETS.map(assetId => ({
  assetId,
  quantity: 0,
  purchasedAt: null,  // Only used for IRR_FIXED_INCOME
  frozen: false,
})),

// In buildInitialHoldings():
export function buildInitialHoldings(totalIRR, targetLayerPct, prices, fxRate, createdAt) {
  const holdings = ASSETS.map(assetId => ({
    assetId,
    quantity: 0,
    purchasedAt: assetId === 'IRR_FIXED_INCOME' ? createdAt : null,
    frozen: false,
  }));
  
  const holdingsById = Object.fromEntries(holdings.map(h => [h.assetId, h]));
  
  for (const layer of ['FOUNDATION', 'GROWTH', 'UPSIDE']) {
    const pct = (targetLayerPct[layer] ?? 0) / 100;
    const layerAmountIRR = Math.floor(totalIRR * pct);
    const weights = WEIGHTS[layer] || {};
    
    for (const assetId of Object.keys(weights)) {
      const h = holdingsById[assetId];
      if (!h) continue;
      
      const assetAmountIRR = Math.floor(layerAmountIRR * weights[assetId]);
      
      // Convert IRR to quantity based on asset type
      if (assetId === 'IRR_FIXED_INCOME') {
        h.quantity = irrToFixedIncomeUnits(assetAmountIRR);
      } else {
        // quantity = IRR / (priceUSD × fxRate)
        const priceUSD = prices[assetId] || 1;
        h.quantity = assetAmountIRR / (priceUSD * fxRate);
      }
    }
  }
  
  return holdings;
}
```

---

## Step 6: Update Snapshot Computation

### File: `src/engine/snapshot.js`

```javascript
import { ASSET_LAYER } from '../state/domain.js';
import { calculateFixedIncomeValue } from './fixedIncome.js';

/**
 * Compute portfolio snapshot from holdings + prices
 * 
 * @param {Object} state - App state with holdings
 * @param {Object} prices - Current prices in USD
 * @param {number} fxRate - USD/IRR exchange rate
 * @returns {Object} Snapshot with values and percentages
 */
export function computeSnapshot(state, prices = {}, fxRate = 1456000) {
  const { holdings, cashIRR, targetLayerPct } = state;
  
  // Calculate value for each holding
  const holdingValues = holdings.map(h => {
    let valueIRR;
    let breakdown = null;
    
    if (h.assetId === 'IRR_FIXED_INCOME') {
      // Special handling for fixed income
      breakdown = calculateFixedIncomeValue(h.quantity, h.purchasedAt);
      valueIRR = breakdown.total;
    } else {
      // Standard: quantity × priceUSD × fxRate
      const priceUSD = prices[h.assetId] || 0;
      valueIRR = Math.round(h.quantity * priceUSD * fxRate);
    }
    
    return {
      assetId: h.assetId,
      quantity: h.quantity,
      valueIRR,
      breakdown,  // Only for fixed income
      layer: ASSET_LAYER[h.assetId],
      frozen: h.frozen,
    };
  });
  
  // Sum by layer
  const layerTotals = { FOUNDATION: 0, GROWTH: 0, UPSIDE: 0 };
  for (const hv of holdingValues) {
    layerTotals[hv.layer] += hv.valueIRR;
  }
  
  // Total portfolio value
  const totalInvested = Object.values(layerTotals).reduce((a, b) => a + b, 0);
  const totalIRR = totalInvested + cashIRR;
  
  // Layer percentages
  const layerPct = {
    FOUNDATION: totalInvested > 0 ? (layerTotals.FOUNDATION / totalInvested) * 100 : 0,
    GROWTH: totalInvested > 0 ? (layerTotals.GROWTH / totalInvested) * 100 : 0,
    UPSIDE: totalInvested > 0 ? (layerTotals.UPSIDE / totalInvested) * 100 : 0,
  };
  
  // Drift from target
  const drift = {
    FOUNDATION: Math.abs(layerPct.FOUNDATION - (targetLayerPct.FOUNDATION || 0)),
    GROWTH: Math.abs(layerPct.GROWTH - (targetLayerPct.GROWTH || 0)),
    UPSIDE: Math.abs(layerPct.UPSIDE - (targetLayerPct.UPSIDE || 0)),
  };
  const totalDrift = drift.FOUNDATION + drift.GROWTH + drift.UPSIDE;
  
  return {
    holdingValues,
    layerTotals,
    layerPct,
    totalInvested,
    cashIRR,
    totalIRR,
    drift,
    totalDrift,
    targetLayerPct,
  };
}
```

---

## Step 7: Update HoldingRow for Fixed Income Display

### File: `src/components/HoldingRow.jsx`

Add special display for IRR_FIXED_INCOME:

```jsx
import React, { useState, useEffect } from 'react';
import { formatIRR, getAssetDisplayName } from '../helpers.js';

function HoldingRow({ holding, holdingValue, layerInfo, layer, protDays, onStartTrade, onStartProtect, onStartBorrow }) {
  const [showOverflow, setShowOverflow] = useState(false);
  const isEmpty = holdingValue.valueIRR === 0;
  const isFixedIncome = holding.assetId === 'IRR_FIXED_INCOME';
  
  // Close overflow when clicking outside
  useEffect(() => {
    if (showOverflow) {
      const handleClick = () => setShowOverflow(false);
      setTimeout(() => document.addEventListener('click', handleClick), 0);
      return () => document.removeEventListener('click', handleClick);
    }
  }, [showOverflow]);

  return (
    <div className={`holdingRow layer-${layer.toLowerCase()} ${isEmpty ? 'assetEmpty' : ''}`}>
      <div className="holdingInfo">
        <div className="holdingName">{getAssetDisplayName(holding.assetId)}</div>
        <div className="holdingLayer">
          <span className={`layerDot ${layer.toLowerCase()}`}></span>
          {layerInfo.name}
          {protDays !== null ? ` · ☂️ Protected (${protDays}d)` : ''}
          {holding.frozen ? ` · 🔒 Locked` : ''}
        </div>
        
        {/* Special display for Fixed Income: Principal + Accrued */}
        {isFixedIncome && holdingValue.breakdown && !isEmpty && (
          <div className="fixedIncomeBreakdown">
            <span className="principal">
              {formatIRR(holdingValue.breakdown.principal)} Principal
            </span>
            <span className="accrued">
              + {formatIRR(holdingValue.breakdown.accrued)} Accrued
            </span>
            <span className="daysHeld">
              ({holdingValue.breakdown.daysHeld} days)
            </span>
          </div>
        )}
      </div>

      <div className="holdingValue">
        {formatIRR(holdingValue.valueIRR)}
      </div>

      <div className="holdingActions">
        <button className="btn small" onClick={() => onStartTrade(holding.assetId, 'BUY')}>Buy</button>
        <div className="sellButtonWrapper">
          <button
            className="btn small"
            disabled={holding.frozen || isEmpty}
            onClick={() => onStartTrade(holding.assetId, 'SELL')}
            title={holding.frozen ? 'Locked as loan collateral — repay loan to unlock' : ''}
          >
            Sell
          </button>
        </div>

        <div className="overflowContainer">
          <button className="btn small overflowTrigger" onClick={(e) => { e.stopPropagation(); setShowOverflow(!showOverflow); }}>⋯</button>

          {showOverflow && (
            <div className="overflowMenu" onClick={(e) => e.stopPropagation()}>
              <button
                className="overflowItem"
                onClick={() => { onStartProtect?.(holding.assetId); setShowOverflow(false); }}
                disabled={isEmpty || isFixedIncome}  // Can't protect fixed income
              >
                <span className="overflowIcon">☂️</span>
                Protect
              </button>
              <button
                className="overflowItem"
                onClick={() => { onStartBorrow?.(holding.assetId); setShowOverflow(false); }}
                disabled={isEmpty || holding.frozen}
              >
                <span className="overflowIcon">💰</span>
                Borrow
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default React.memo(HoldingRow);
```

---

## Step 8: CSS for Fixed Income Display

### Add to `src/styles/app.css`

```css
/* Fixed Income Breakdown Display */
.fixedIncomeBreakdown {
  display: flex;
  gap: 8px;
  font-size: 12px;
  margin-top: 4px;
  color: #9ca3af;
}

.fixedIncomeBreakdown .principal {
  color: #d1d5db;
}

.fixedIncomeBreakdown .accrued {
  color: #34d399;  /* Green for profit */
}

.fixedIncomeBreakdown .daysHeld {
  color: #6b7280;
  font-size: 11px;
}

/* Price update indicator */
.priceIndicator {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: #6b7280;
}

.priceIndicator .dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #34d399;
  animation: pulse 2s infinite;
}

.priceIndicator.stale .dot {
  background: #fbbf24;
}

.priceIndicator.error .dot {
  background: #ef4444;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
```

---

## Step 9: Integrate in App.jsx

### File: `src/App.jsx`

```jsx
import React, { useMemo, useReducer } from 'react';
import { usePrices } from './hooks/usePrices.js';
import { computeSnapshot } from './engine/snapshot.js';
// ... other imports

export default function App() {
  const [state, dispatch] = useReducer(reducer, null, initialState);
  
  // Live price feed (30s polling)
  const { prices, fxRate, loading: pricesLoading, lastUpdated } = usePrices(30000);
  
  // Memoize snapshot with live prices
  const snapshot = useMemo(
    () => computeSnapshot(state, prices, fxRate),
    [state, prices, fxRate]
  );
  
  // ... rest of component
  
  return (
    <>
      {/* Price status indicator in header */}
      <div className="priceIndicator">
        <span className="dot"></span>
        <span>Live prices</span>
        {lastUpdated && (
          <span className="lastUpdated">
            Updated {new Date(lastUpdated).toLocaleTimeString()}
          </span>
        )}
      </div>
      
      {/* ... rest of UI */}
    </>
  );
}
```

---

## Step 10: Environment Configuration

### File: `.env` (create in root)

```
# Finnhub API Key (get free at finnhub.io)
VITE_FINNHUB_API_KEY=your_api_key_here

# Fallback USD/IRR rate (update periodically)
VITE_FALLBACK_USD_IRR=1456000
```

### Update `priceService.js` to use env:

```javascript
const FINNHUB_API_KEY = import.meta.env.VITE_FINNHUB_API_KEY || '';
const FALLBACK_RATE = parseInt(import.meta.env.VITE_FALLBACK_USD_IRR) || 1456000;
```

---

## Implementation Order

1. **Create `domain.js` updates** (5 min) — Add ASSET_META
2. **Create `fixedIncome.js`** (10 min) — Fixed income calculations
3. **Create `priceService.js`** (20 min) — API fetching
4. **Create `usePrices.js`** (10 min) — React hook
5. **Update `snapshot.js`** (15 min) — Compute from quantities
6. **Update `appReducer.js`** (30 min) — Quantities instead of valueIRR
7. **Update `HoldingRow.jsx`** (15 min) — Fixed income display
8. **Update `App.jsx`** (10 min) — Integrate price hook
9. **Add CSS** (5 min) — Styling
10. **Test & Debug** (30 min)

**Total estimated time: ~2.5 hours**

---

## Verification Checklist

- [ ] Crypto prices update every 30 seconds
- [ ] QQQ price updates every 60 seconds
- [ ] USD/IRR rate fetches from Bonbast (or fallback)
- [ ] IRR_FIXED_INCOME shows "Principal + Accrued"
- [ ] Portfolio total reflects live prices
- [ ] Drift calculation works with live values
- [ ] Price indicator shows "Live" status
- [ ] Graceful fallback when APIs fail

---

## API Rate Limits Summary

| API | Limit | Our Usage | Buffer |
|-----|-------|-----------|--------|
| CoinGecko | 30/min | 2/min | ✅ Safe |
| Finnhub | 60/min | 1/min | ✅ Safe |
| Bonbast | Unknown | 1/min | ⚠️ Monitor |

---

## Future Enhancements (v10+)

- WebSocket connections for real-time crypto
- Price history charts
- Price alerts
- Currency toggle (IRR / USD view)
- Manual FX rate override in settings
