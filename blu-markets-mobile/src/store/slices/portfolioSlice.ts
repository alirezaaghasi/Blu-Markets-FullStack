// Portfolio Slice
import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import {
  PortfolioState,
  Holding,
  TargetLayerPct,
  Protection,
  Loan,
  ActionLogEntry,
  LedgerEntry,
  PortfolioStatus,
  ActionType,
  Boundary,
  AssetId,
  RebalanceTrade,
  RebalanceMode,
} from '../../types';
import { MAX_ACTION_LOG_SIZE, SPREAD_BY_LAYER, FIXED_INCOME_UNIT_PRICE } from '../../constants/business';
import { ASSETS } from '../../constants/assets';

const initialState: PortfolioState = {
  cashIRR: 0,
  holdings: [],
  targetLayerPct: {
    FOUNDATION: 0.50,
    GROWTH: 0.35,
    UPSIDE: 0.15,
  },
  protections: [],
  loans: [],
  actionLog: [],
  ledger: [],
  status: 'BALANCED',
  lastSyncTimestamp: 0,
  riskScore: 5,
  riskProfileName: 'Balanced',
  // Backend-calculated values (frontend is presentation layer only)
  totalValueIrr: 0,
  holdingsValueIrr: 0,
  currentAllocation: {
    FOUNDATION: 0,
    GROWTH: 0,
    UPSIDE: 0,
  },
  driftPct: 0,
};

const portfolioSlice = createSlice({
  name: 'portfolio',
  initialState,
  reducers: {
    // Initialize portfolio
    initializePortfolio: (
      state,
      action: PayloadAction<{
        cashIRR: number;
        holdings: Holding[];
        targetLayerPct: TargetLayerPct;
        riskScore?: number;
        riskProfileName?: string;
      }>
    ) => {
      state.cashIRR = action.payload.cashIRR;
      state.holdings = action.payload.holdings;
      state.targetLayerPct = action.payload.targetLayerPct;
      state.status = 'BALANCED';
      state.lastSyncTimestamp = Date.now();
      if (action.payload.riskScore !== undefined) {
        state.riskScore = action.payload.riskScore;
      }
      if (action.payload.riskProfileName) {
        state.riskProfileName = action.payload.riskProfileName;
      }
    },

    // Set risk profile info (from onboarding or API)
    setRiskProfile: (
      state,
      action: PayloadAction<{ riskScore: number; riskProfileName: string }>
    ) => {
      state.riskScore = action.payload.riskScore;
      state.riskProfileName = action.payload.riskProfileName;
    },

    // Cash management
    setCash: (state, action: PayloadAction<number>) => {
      state.cashIRR = action.payload;
    },
    updateCash: (state, action: PayloadAction<number>) => {
      state.cashIRR = action.payload;
    },
    addCash: (state, action: PayloadAction<number>) => {
      state.cashIRR += action.payload;
    },
    subtractCash: (state, action: PayloadAction<number>) => {
      state.cashIRR = Math.max(0, state.cashIRR - action.payload);
    },

    // Holdings management
    setHoldings: (state, action: PayloadAction<Holding[]>) => {
      state.holdings = action.payload;
    },
    addHolding: (state, action: PayloadAction<Holding>) => {
      const existingIndex = state.holdings.findIndex(
        (h) => h.assetId === action.payload.assetId
      );
      if (existingIndex >= 0) {
        state.holdings[existingIndex].quantity += action.payload.quantity;
      } else {
        state.holdings.push(action.payload);
      }
    },
    updateHolding: (
      state,
      action: PayloadAction<{ assetId: AssetId; quantity: number }>
    ) => {
      const holding = state.holdings.find(
        (h) => h.assetId === action.payload.assetId
      );
      if (holding) {
        holding.quantity = action.payload.quantity;
      }
    },
    removeHolding: (state, action: PayloadAction<AssetId>) => {
      state.holdings = state.holdings.filter(
        (h) => h.assetId !== action.payload
      );
    },
    // Update holding from backend trade result
    updateHoldingFromTrade: (
      state,
      action: PayloadAction<{
        assetId: AssetId;
        quantity: number;
        side: 'BUY' | 'SELL';
      }>
    ) => {
      const { assetId, quantity, side } = action.payload;
      const asset = ASSETS[assetId];

      if (quantity <= 0.00000001) {
        // Remove holding if quantity is effectively zero
        state.holdings = state.holdings.filter((h) => h.assetId !== assetId);
      } else {
        const existingIndex = state.holdings.findIndex(
          (h) => h.assetId === assetId
        );
        if (existingIndex >= 0) {
          state.holdings[existingIndex].quantity = quantity;
        } else if (side === 'BUY') {
          // Add new holding on buy
          state.holdings.push({
            assetId,
            quantity,
            frozen: false,
            layer: asset.layer,
          });
        }
      }

      // Log the action
      const entry: ActionLogEntry = {
        id: Date.now(),
        timestamp: new Date().toISOString(),
        type: 'TRADE',
        boundary: 'SAFE',
        message: `${side === 'BUY' ? 'Bought' : 'Sold'} ${asset.symbol}`,
        assetId,
      };
      state.actionLog.unshift(entry);
      if (state.actionLog.length > MAX_ACTION_LOG_SIZE) {
        state.actionLog = state.actionLog.slice(0, MAX_ACTION_LOG_SIZE);
      }
    },
    freezeHolding: (state, action: PayloadAction<AssetId>) => {
      const holding = state.holdings.find(
        (h) => h.assetId === action.payload
      );
      if (holding) {
        holding.frozen = true;
      }
    },
    unfreezeHolding: (state, action: PayloadAction<AssetId>) => {
      const holding = state.holdings.find(
        (h) => h.assetId === action.payload
      );
      if (holding) {
        holding.frozen = false;
      }
    },

    // Target allocation
    setTargetLayerPct: (state, action: PayloadAction<TargetLayerPct>) => {
      state.targetLayerPct = action.payload;
    },

    // Portfolio status
    setStatus: (state, action: PayloadAction<PortfolioStatus>) => {
      state.status = action.payload;
    },

    // Update backend-calculated portfolio values (frontend is presentation layer only)
    setPortfolioValues: (
      state,
      action: PayloadAction<{
        totalValueIrr: number;
        holdingsValueIrr: number;
        currentAllocation: TargetLayerPct;
        driftPct: number;
        status: PortfolioStatus;
      }>
    ) => {
      state.totalValueIrr = action.payload.totalValueIrr;
      state.holdingsValueIrr = action.payload.holdingsValueIrr;
      state.currentAllocation = action.payload.currentAllocation;
      state.driftPct = action.payload.driftPct;
      state.status = action.payload.status;
    },

    // Protections
    addProtection: (state, action: PayloadAction<Protection>) => {
      state.protections.push(action.payload);
    },
    removeProtection: (state, action: PayloadAction<string>) => {
      state.protections = state.protections.filter(
        (p) => p.id !== action.payload
      );
    },

    // Loans
    addLoan: (state, action: PayloadAction<Loan>) => {
      state.loans.push(action.payload);
    },
    updateLoan: (state, action: PayloadAction<Loan>) => {
      const index = state.loans.findIndex((l) => l.id === action.payload.id);
      if (index >= 0) {
        state.loans[index] = action.payload;
      }
    },
    removeLoan: (state, action: PayloadAction<string>) => {
      state.loans = state.loans.filter((l) => l.id !== action.payload);
    },

    // Activity Log (for dashboard mini-feed)
    addActionLogEntry: (state, action: PayloadAction<ActionLogEntry>) => {
      state.actionLog.unshift(action.payload);
      // Keep only the most recent entries
      if (state.actionLog.length > MAX_ACTION_LOG_SIZE) {
        state.actionLog = state.actionLog.slice(0, MAX_ACTION_LOG_SIZE);
      }
    },

    // Ledger (full history)
    addLedgerEntry: (state, action: PayloadAction<LedgerEntry>) => {
      state.ledger.unshift(action.payload);
    },

    // Log action helper
    logAction: (
      state,
      action: PayloadAction<{
        type: ActionType;
        boundary: Boundary;
        message: string;
        amountIRR?: number;
        assetId?: AssetId;
      }>
    ) => {
      const entry: ActionLogEntry = {
        id: Date.now(),
        timestamp: new Date().toISOString(),
        type: action.payload.type,
        boundary: action.payload.boundary,
        message: action.payload.message,
        amountIRR: action.payload.amountIRR,
        assetId: action.payload.assetId,
      };
      state.actionLog.unshift(entry);
      if (state.actionLog.length > MAX_ACTION_LOG_SIZE) {
        state.actionLog = state.actionLog.slice(0, MAX_ACTION_LOG_SIZE);
      }
    },

    // Add funds to portfolio
    addFunds: (state, action: PayloadAction<{ amountIRR: number }>) => {
      const { amountIRR } = action.payload;
      state.cashIRR += amountIRR;

      // Log the action
      const entry: ActionLogEntry = {
        id: Date.now(),
        timestamp: new Date().toISOString(),
        type: 'ADD_FUNDS',
        boundary: 'SAFE',
        message: `Added ${amountIRR.toLocaleString()} IRR cash`,
        amountIRR,
      };
      state.actionLog.unshift(entry);
      if (state.actionLog.length > MAX_ACTION_LOG_SIZE) {
        state.actionLog = state.actionLog.slice(0, MAX_ACTION_LOG_SIZE);
      }
    },

    // Execute trade (buy/sell)
    executeTrade: (
      state,
      action: PayloadAction<{
        side: 'BUY' | 'SELL';
        assetId: AssetId;
        amountIRR: number;
        priceUSD: number;
        fxRate: number;
      }>
    ) => {
      const { side, assetId, amountIRR, priceUSD, fxRate } = action.payload;
      const asset = ASSETS[assetId];
      const spread = SPREAD_BY_LAYER[asset.layer];
      const netAmount = amountIRR * (1 - spread);
      const priceIRR = priceUSD * fxRate;
      const quantity = netAmount / priceIRR;

      if (side === 'BUY') {
        // Deduct cash
        state.cashIRR -= amountIRR;

        // Add or update holding
        const existingIndex = state.holdings.findIndex(
          (h) => h.assetId === assetId
        );
        if (existingIndex >= 0) {
          state.holdings[existingIndex].quantity += quantity;
        } else {
          state.holdings.push({
            assetId,
            quantity,
            frozen: false,
            layer: asset.layer,
          });
        }

        // Log the action
        const entry: ActionLogEntry = {
          id: Date.now(),
          timestamp: new Date().toISOString(),
          type: 'TRADE',
          boundary: 'SAFE', // Should be calculated based on allocation impact
          message: `Bought ${asset.symbol} (${amountIRR.toLocaleString()} IRR)`,
          amountIRR,
          assetId,
        };
        state.actionLog.unshift(entry);
      } else {
        // SELL
        const holdingIndex = state.holdings.findIndex(
          (h) => h.assetId === assetId
        );
        if (holdingIndex >= 0) {
          const quantityToSell = amountIRR / priceIRR;
          state.holdings[holdingIndex].quantity -= quantityToSell;

          // Remove holding if quantity is zero or very small
          if (state.holdings[holdingIndex].quantity < 0.00000001) {
            state.holdings.splice(holdingIndex, 1);
          }

          // Add cash (net of spread)
          state.cashIRR += netAmount;

          // Log the action
          const entry: ActionLogEntry = {
            id: Date.now(),
            timestamp: new Date().toISOString(),
            type: 'TRADE',
            boundary: 'SAFE',
            message: `Sold ${asset.symbol} (${amountIRR.toLocaleString()} IRR)`,
            amountIRR,
            assetId,
          };
          state.actionLog.unshift(entry);
        }
      }

      if (state.actionLog.length > MAX_ACTION_LOG_SIZE) {
        state.actionLog = state.actionLog.slice(0, MAX_ACTION_LOG_SIZE);
      }
    },

    // Execute rebalance (multiple trades)
    executeRebalance: (
      state,
      action: PayloadAction<{
        trades: RebalanceTrade[];
        mode: RebalanceMode;
        cashDeployed: number;
        boundary: Boundary;
        prices: Record<string, number>;
        fxRate: number;
      }>
    ) => {
      const { trades, mode, cashDeployed, boundary, prices, fxRate } = action.payload;

      // Execute each trade
      trades.forEach((trade) => {
        const asset = ASSETS[trade.assetId];
        if (!asset) return;

        const spread = SPREAD_BY_LAYER[asset.layer];
        const priceIRR = trade.assetId === 'IRR_FIXED_INCOME'
          ? FIXED_INCOME_UNIT_PRICE
          : (prices[trade.assetId] || 0) * fxRate;

        if (priceIRR === 0) return;

        if (trade.side === 'SELL') {
          // Find and reduce holding
          const holdingIndex = state.holdings.findIndex(
            (h) => h.assetId === trade.assetId && !h.frozen
          );
          if (holdingIndex >= 0) {
            const quantityToSell = trade.amountIRR / priceIRR;
            state.holdings[holdingIndex].quantity -= quantityToSell;

            // Remove if quantity too small
            if (state.holdings[holdingIndex].quantity < 0.00000001) {
              state.holdings.splice(holdingIndex, 1);
            }

            // Add proceeds to cash (for intermediate tracking)
            const netProceeds = trade.amountIRR * (1 - spread);
            state.cashIRR += netProceeds;
          }
        } else {
          // BUY
          const netAmount = trade.amountIRR * (1 - spread);
          const quantityToBuy = netAmount / priceIRR;

          // Deduct cash
          state.cashIRR -= trade.amountIRR;

          // Add or update holding
          const existingIndex = state.holdings.findIndex(
            (h) => h.assetId === trade.assetId
          );
          if (existingIndex >= 0) {
            state.holdings[existingIndex].quantity += quantityToBuy;
          } else {
            state.holdings.push({
              assetId: trade.assetId,
              quantity: quantityToBuy,
              frozen: false,
              layer: asset.layer,
            });
          }
        }
      });

      // If cash was deployed in HOLDINGS_PLUS_CASH mode, it's already handled via buy trades
      // Update portfolio status to BALANCED after successful rebalance
      if (boundary === 'SAFE') {
        state.status = 'BALANCED';
      }

      // Log the rebalance action
      const sellCount = trades.filter(t => t.side === 'SELL').length;
      const buyCount = trades.filter(t => t.side === 'BUY').length;
      const entry: ActionLogEntry = {
        id: Date.now(),
        timestamp: new Date().toISOString(),
        type: 'REBALANCE',
        boundary,
        message: `Rebalanced portfolio (${sellCount} sells, ${buyCount} buys)`,
      };
      state.actionLog.unshift(entry);

      if (state.actionLog.length > MAX_ACTION_LOG_SIZE) {
        state.actionLog = state.actionLog.slice(0, MAX_ACTION_LOG_SIZE);
      }
    },

    // Sync
    setLastSync: (state, action: PayloadAction<number>) => {
      state.lastSyncTimestamp = action.payload;
    },

    // Reset
    resetPortfolio: () => initialState,

    // Load demo data for testing
    loadDemoData: (state) => {
      // Demo portfolio: balanced allocation matching 50/35/15 target
      // Using default prices: BTC=$97,500, ETH=$3,200, SOL=$185, USDT=$1
      // FX rate: 1,456,000 IRR/USD
      // Total target: ~5B IRR (Foundation 2.5B, Growth 1.75B, Upside 750M)
      state.cashIRR = 5_000_000;
      state.holdings = [
        // Foundation layer (~50% = 2.5B IRR)
        // USDT: 1000 × $1 × 1,456,000 = 1.456B IRR
        // BUG-015 FIX: Fixed Income unit price is 500,000 IRR per PRD Section 25
        // Fixed Income: 1000 × 500,000 = 500M IRR
        { assetId: 'USDT', quantity: 1000, frozen: false, layer: 'FOUNDATION' },
        { assetId: 'IRR_FIXED_INCOME', quantity: 1000, frozen: false, layer: 'FOUNDATION' },
        // Growth layer (~35% = 1.75B IRR) - BTC, ETH are GROWTH assets
        // BTC: 0.007 × $97,500 × 1,456,000 = 994M IRR
        // ETH: 0.15 × $3,200 × 1,456,000 = 699M IRR
        { assetId: 'BTC', quantity: 0.007, frozen: false, layer: 'GROWTH' },
        { assetId: 'ETH', quantity: 0.15, frozen: false, layer: 'GROWTH' },
        // Upside layer (~15% = 750M IRR) - SOL is UPSIDE asset
        // SOL: 2.5 × $185 × 1,456,000 = 674M IRR
        { assetId: 'SOL', quantity: 2.5, frozen: false, layer: 'UPSIDE' },
      ];
      state.targetLayerPct = {
        FOUNDATION: 0.50,
        GROWTH: 0.35,
        UPSIDE: 0.15,
      };
      state.status = 'BALANCED';
      state.lastSyncTimestamp = Date.now();

      // Sample activity feed with different boundaries
      const now = new Date();
      state.actionLog = [
        {
          id: 1,
          timestamp: new Date(now.getTime() - 1000 * 60 * 5).toISOString(), // 5 min ago
          type: 'TRADE',
          boundary: 'SAFE',
          message: 'Bought 0.01 BTC',
          amountIRR: 2_500_000,
          assetId: 'BTC',
        },
        {
          id: 2,
          timestamp: new Date(now.getTime() - 1000 * 60 * 30).toISOString(), // 30 min ago
          type: 'TRADE',
          boundary: 'DRIFT',
          message: 'Sold 0.2 ETH',
          amountIRR: 1_800_000,
          assetId: 'ETH',
        },
        {
          id: 3,
          timestamp: new Date(now.getTime() - 1000 * 60 * 60 * 2).toISOString(), // 2 hours ago
          type: 'REBALANCE',
          boundary: 'SAFE',
          message: 'Rebalanced portfolio (2 sells, 3 buys)',
        },
        {
          id: 4,
          timestamp: new Date(now.getTime() - 1000 * 60 * 60 * 24).toISOString(), // 1 day ago
          type: 'ADD_FUNDS',
          boundary: 'SAFE',
          message: 'Added 10,000,000 IRR cash',
          amountIRR: 10_000_000,
        },
        {
          id: 5,
          timestamp: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 3).toISOString(), // 3 days ago
          type: 'PORTFOLIO_CREATED',
          boundary: 'SAFE',
          message: 'Started with 25,000,000 IRR',
          amountIRR: 25_000_000,
        },
      ];
    },
  },
});

export const {
  initializePortfolio,
  setRiskProfile,
  setCash,
  updateCash,
  addCash,
  subtractCash,
  setHoldings,
  addHolding,
  updateHolding,
  updateHoldingFromTrade,
  removeHolding,
  freezeHolding,
  unfreezeHolding,
  setTargetLayerPct,
  setStatus,
  setPortfolioValues,
  addProtection,
  removeProtection,
  addLoan,
  updateLoan,
  removeLoan,
  addActionLogEntry,
  addLedgerEntry,
  logAction,
  setLastSync,
  resetPortfolio,
  addFunds,
  executeTrade,
  executeRebalance,
  loadDemoData,
} = portfolioSlice.actions;

export default portfolioSlice.reducer;
