# Blu Markets v9.7

Production-ready portfolio management prototype with:
- Phone-number onboarding + Persian questionnaire
- Layer-based portfolio allocation (Foundation/Growth/Upside)
- Trade, Protect, Borrow, Repay, Rebalance actions
- Boundary classification system (Safe/Drift/Structural/Stress)
- Multiple loans with automatic layer-based LTV

## Run

```bash
npm install
npm run dev
```

Open the webview on port **5173** (or next available).

## Architecture

- **Single reducer pattern**: All state transitions via `src/reducers/appReducer.js`
- **Preview-Confirm flow**: Actions go through PREVIEW_* -> pendingAction -> CONFIRM_PENDING -> ledger
- **Deterministic engine**: `src/engine/` contains pure functions for validation, preview, snapshots
- **Centralized constants**: `src/constants/index.js` for all thresholds, labels, config

## Key Features (v9.7)

- Multiple simultaneous loans (one per unfrozen asset)
- Automatic LTV based on asset layer volatility:
  - Foundation: 70% (stable assets)
  - Growth: 50% (moderate volatility)
  - Upside: 30% (high volatility)
- Protection eligibility filter (BTC, ETH, GOLD, QQQ, SOL only)
- Rebalance uses holdings only (cash wallet excluded)
