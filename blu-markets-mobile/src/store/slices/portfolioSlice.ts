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
      }>
    ) => {
      state.cashIRR = action.payload.cashIRR;
      state.holdings = action.payload.holdings;
      state.targetLayerPct = action.payload.targetLayerPct;
      state.status = 'BALANCED';
      state.lastSyncTimestamp = Date.now();
    },

    // Cash management
    setCash: (state, action: PayloadAction<number>) => {
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
  },
});

export const {
  initializePortfolio,
  setCash,
  addCash,
  subtractCash,
  setHoldings,
  addHolding,
  updateHolding,
  removeHolding,
  freezeHolding,
  unfreezeHolding,
  setTargetLayerPct,
  setStatus,
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
} = portfolioSlice.actions;

export default portfolioSlice.reducer;
