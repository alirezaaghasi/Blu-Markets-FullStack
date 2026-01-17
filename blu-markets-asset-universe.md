# Blu Markets v10 — Final Asset Universe & Allocation System

## Final 15-Asset Universe

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ FOUNDATION (3 Assets) — "Sleep at Night"                                    │
│ Purpose: Capital preservation, inflation hedge                              │
├─────────────────────────────────────────────────────────────────────────────┤
│ Asset            │ Provider  │ Description                    │ Max LTV    │
│──────────────────┼───────────┼────────────────────────────────┼────────────│
│ USDT             │ Tether    │ USD exposure, instant liquidity│ 90%        │
│ PAXG             │ Paxos     │ 1:1 gold-backed, inflation hedge│ 70%       │
│ IRR Fixed Income │ Charisma  │ 30% Rial yield, Rial-native    │ 0%         │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ GROWTH (6 Assets) — "Balanced Progress"                                     │
│ Purpose: Steady growth, moderate volatility                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│ Asset            │ Provider  │ Description                    │ Max LTV    │
│──────────────────┼───────────┼────────────────────────────────┼────────────│
│ BTC              │ Native    │ Digital gold, macro hedge      │ 50%        │
│ ETH              │ Native    │ Platform asset, ecosystem      │ 50%        │
│ BNB              │ Binance   │ Exchange ecosystem, utility    │ 50%        │
│ XRP              │ Ripple    │ Payments, high liquidity       │ 45%        │
│ KAG              │ Kinesis   │ Silver, commodity diversifier  │ 60%        │
│ QQQ              │ Novion    │ Nasdaq 100, US tech equity     │ 60%        │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ UPSIDE (6 Assets) — "Bounded Conviction"                                    │
│ Purpose: High growth potential, higher volatility                           │
├─────────────────────────────────────────────────────────────────────────────┤
│ Asset            │ Provider  │ Description                    │ Max LTV    │
│──────────────────┼───────────┼────────────────────────────────┼────────────│
│ SOL              │ Native    │ High-performance L1            │ 30%        │
│ TON              │ TON Fdn   │ Telegram ecosystem             │ 30%        │
│ LINK             │ Chainlink │ Oracle infrastructure          │ 35%        │
│ AVAX             │ Ava Labs  │ Fast L1, institutional         │ 30%        │
│ MATIC            │ Polygon   │ Ethereum L2, established       │ 30%        │
│ ARB              │ Offchain  │ Leading L2, growing DeFi       │ 30%        │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Volatility Profiles

| Asset | Base Volatility | Category |
|-------|-----------------|----------|
| USDT | 1% | Stablecoin |
| IRR Fixed Income | 5% | Fixed Income |
| PAXG | 12% | Gold |
| KAG | 18% | Silver |
| QQQ | 20% | Equity ETF |
| BTC | 45% | Crypto Large |
| BNB | 50% | Crypto Large |
| ETH | 55% | Crypto Large |
| XRP | 60% | Crypto Large |
| LINK | 60% | Infrastructure |
| TON | 65% | Alt L1 |
| MATIC | 65% | L2 |
| AVAX | 70% | Alt L1 |
| ARB | 70% | L2 |
| SOL | 75% | Alt L1 |

---

## User Profile Allocations

| Profile | Foundation | Growth | Upside | Intra-Layer Strategy |
|---------|------------|--------|--------|---------------------|
| Anxious Novice | 80% | 18% | 2% | Conservative |
| Steady Builder | 50% | 35% | 15% | Balanced |
| Aggressive Accumulator | 20% | 30% | 50% | Momentum Tilt |
| Wealth Preserver | 60% | 35% | 5% | Max Diversification |
| Speculator | 10% | 20% | 70% | Aggressive |

---

## Intra-Layer Balancing (HRAM)

### Formula

```
Weight[i] = normalize(
    RiskParityWeight × MomentumFactor × CorrelationFactor × LiquidityFactor
)
```

### Factors

| Factor | Formula | Effect |
|--------|---------|--------|
| **Risk Parity** | 1 / volatility | Lower vol → Higher weight |
| **Momentum** | 1 + (momentum × 0.3) | Positive trend → Boost |
| **Correlation** | 1 - (avgCorr × 0.2) | Low correlation → Bonus |
| **Liquidity** | 1 + (score - 0.8) × 0.1 | High liquidity → Slight boost |

### Weight Caps

- **Minimum:** 5% per asset
- **Maximum:** 40% per asset

---

## Example: Growth Layer Weights (Balanced Strategy)

| Asset | Weight | Rationale |
|-------|--------|-----------|
| KAG (Silver) | 30% | Lowest volatility (18%), low correlation to crypto |
| QQQ | 22% | Low volatility (20%), diversification from crypto |
| BTC | 15% | High volatility but positive momentum |
| BNB | 13% | Moderate volatility, Binance ecosystem |
| ETH | 11% | Higher volatility, platform growth |
| XRP | 9% | Highest volatility in Growth layer |

**Result:** Commodities and equities get higher weight due to lower volatility, while crypto gets lower weight but still provides growth exposure.

---

## Strategy Presets

| Strategy | Momentum | Correlation | Min | Max | Best For |
|----------|----------|-------------|-----|-----|----------|
| Equal Weight | 0 | 0 | 5% | 50% | Simple diversification |
| Risk Parity | 0 | 0 | 5% | 40% | Volatility balancing |
| Momentum Tilt | 0.5 | 0.1 | 5% | 35% | Trend following |
| Max Diversification | 0.1 | 0.4 | 10% | 30% | Correlation minimizing |
| **Balanced** | 0.3 | 0.2 | 5% | 40% | General use (default) |
| Conservative | 0.1 | 0.3 | 10% | 35% | Risk-averse users |
| Aggressive | 0.5 | 0.1 | 5% | 50% | Growth-focused users |

---

## Provider Summary

| Provider | Assets | Notes |
|----------|--------|-------|
| **Native** | BTC, ETH, SOL | Direct blockchain custody |
| **Tether** | USDT | Largest stablecoin issuer |
| **Paxos** | PAXG | Regulated gold custody |
| **Charisma** | IRR Fixed Income | Iranian insurance product |
| **Binance** | BNB | Exchange token |
| **Ripple** | XRP | Payments network |
| **Kinesis** | KAG | Silver-backed token |
| **Novion** | QQQ | UK-based ETF access |
| **TON Foundation** | TON | Telegram ecosystem |
| **Chainlink Labs** | LINK | Oracle network |
| **Ava Labs** | AVAX | Avalanche L1 |
| **Polygon Labs** | MATIC | Ethereum L2 |
| **Offchain Labs** | ARB | Arbitrum L2 |

---

## API Interface

```javascript
const { IntraLayerBalancer, MarketDataProvider, STRATEGY_PRESETS } = require('./blu-markets-intra-layer-balancer-v2');

// Initialize
const marketData = new MarketDataProvider(priceHistory);
const balancer = new IntraLayerBalancer(marketData, STRATEGY_PRESETS.BALANCED);

// Calculate weights for a layer
const result = balancer.calculateWeights('GROWTH');
// Returns: { weights: { BTC: 0.15, ETH: 0.11, ... }, factors: {...} }

// Check if rebalance needed
const check = balancer.needsRebalance('GROWTH', currentWeights, result.weights);
// Returns: { needsRebalance: true/false, maxDrift: 0.08, driftByAsset: {...} }

// Generate trades
const trades = balancer.generateRebalanceTrades('GROWTH', holdings, result.weights, layerValue);
// Returns: [{ asset, side, quantity, value, currentWeight, targetWeight }, ...]
```

---

## Files Delivered

1. **blu-markets-intra-layer-balancer-v2.js** — Final implementation with 15 assets
2. **blu-markets-asset-universe.md** — This summary document

---

*Blu Markets v10 — Preserving agency under uncertainty*
