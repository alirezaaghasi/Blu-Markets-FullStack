# Blu Markets v11

Production-ready portfolio management prototype with live price feeds and advanced risk profiling.

## Features

- **Live Price Feeds**: Real-time prices from CoinGecko, Finnhub, and Bonbast APIs
- **Quantity-Based Holdings**: Portfolio values computed dynamically (quantity × price × fxRate)
- **Fixed Income with Accrual**: 30% annual yield with principal + accrued interest display
- **Layer-Based Allocation**: Foundation/Growth/Upside portfolio structure
- **Trade, Protect, Borrow, Repay, Rebalance**: Full action suite
- **Boundary Classification**: Safe/Drift/Structural/Stress status system

## Run

```bash
npm install
npm run dev
```

Open the webview on port **5173** (or next available).

## Architecture

- **Single reducer pattern**: All state transitions via `src/reducers/appReducer.js`
- **Preview-Confirm flow**: Actions go through PREVIEW_* → pendingAction → CONFIRM_PENDING → ledger
- **Deterministic engine**: `src/engine/` contains pure functions for validation, preview, snapshots
- **Live prices**: `src/hooks/usePrices.js` polls APIs every 30 seconds
- **Centralized constants**: `src/constants/index.js` for thresholds, labels, config

## Key Features

- **Live Prices**: BTC, ETH, SOL, TON, USDT, GOLD from CoinGecko; QQQ from Finnhub
- **USD/IRR Rate**: Live rate from Bonbast with fallback
- **Fixed Income**: 500K IRR/unit, 30% annual simple interest
- **Price Indicator**: Shows live/loading/offline status
- **Quantity Display**: Shows units held and current USD price per asset
- **Multiple Loans**: One per unfrozen asset with layer-based LTV (70%/50%/30%)
- **Protection**: For BTC, ETH, GOLD, QQQ, SOL only
