// Prices Slice
import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';
import { PriceState, AssetId } from '../../types';
import { DEFAULT_FX_RATE } from '../../constants/business';
import { ConnectionStatus } from '../../services/priceWebSocket';

interface ExtendedPriceState extends PriceState {
  connectionStatus: ConnectionStatus;
  pricesIrr: Record<AssetId, number>;
  change24h: Record<AssetId, number | undefined>;
}

const initialState: ExtendedPriceState = {
  prices: {} as Record<AssetId, number>,
  pricesIrr: {} as Record<AssetId, number>,
  change24h: {} as Record<AssetId, number | undefined>,
  fxRate: DEFAULT_FX_RATE,
  fxSource: 'fallback',
  updatedAt: '',
  isLoading: false,
  error: null,
  connectionStatus: 'disconnected',
};

// Default prices (fallback)
const DEFAULT_PRICES: Partial<Record<AssetId, number>> = {
  USDT: 1.0,
  PAXG: 2650,
  BTC: 97500,
  ETH: 3200,
  BNB: 680,
  XRP: 2.2,
  KAG: 30,
  QQQ: 521,
  SOL: 185,
  TON: 5.2,
  LINK: 22,
  AVAX: 35,
  MATIC: 0.45,
  ARB: 0.8,
};

// Async thunk for fetching prices
export const fetchPrices = createAsyncThunk(
  'prices/fetchPrices',
  async (_, { rejectWithValue }) => {
    try {
      // CoinGecko API for crypto prices
      const coinIds = [
        'tether',
        'pax-gold',
        'bitcoin',
        'ethereum',
        'binancecoin',
        'ripple',
        'kinesis-gold',
        'solana',
        'the-open-network',
        'chainlink',
        'avalanche-2',
        'matic-network',
        'arbitrum',
      ].join(',');

      const cryptoResponse = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${coinIds}&vs_currencies=usd`
      );

      if (!cryptoResponse.ok) {
        throw new Error('Failed to fetch crypto prices');
      }

      const cryptoData = await cryptoResponse.json();

      // Map CoinGecko IDs to our AssetIds
      const priceMap: Partial<Record<AssetId, number>> = {
        USDT: cryptoData.tether?.usd ?? DEFAULT_PRICES.USDT,
        PAXG: cryptoData['pax-gold']?.usd ?? DEFAULT_PRICES.PAXG,
        BTC: cryptoData.bitcoin?.usd ?? DEFAULT_PRICES.BTC,
        ETH: cryptoData.ethereum?.usd ?? DEFAULT_PRICES.ETH,
        BNB: cryptoData.binancecoin?.usd ?? DEFAULT_PRICES.BNB,
        XRP: cryptoData.ripple?.usd ?? DEFAULT_PRICES.XRP,
        KAG: cryptoData['kinesis-gold']?.usd ?? DEFAULT_PRICES.KAG,
        SOL: cryptoData.solana?.usd ?? DEFAULT_PRICES.SOL,
        TON: cryptoData['the-open-network']?.usd ?? DEFAULT_PRICES.TON,
        LINK: cryptoData.chainlink?.usd ?? DEFAULT_PRICES.LINK,
        AVAX: cryptoData['avalanche-2']?.usd ?? DEFAULT_PRICES.AVAX,
        MATIC: cryptoData['matic-network']?.usd ?? DEFAULT_PRICES.MATIC,
        ARB: cryptoData.arbitrum?.usd ?? DEFAULT_PRICES.ARB,
        QQQ: DEFAULT_PRICES.QQQ, // Fetched from Finnhub separately
      };

      return {
        prices: priceMap as Record<AssetId, number>,
        updatedAt: new Date().toISOString(),
      };
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

// Async thunk for fetching FX rate
export const fetchFxRate = createAsyncThunk(
  'prices/fetchFxRate',
  async (_, { rejectWithValue }) => {
    try {
      const response = await fetch('https://bonbast.amirhn.com/latest');

      if (!response.ok) {
        return {
          rate: DEFAULT_FX_RATE,
          source: 'fallback' as const,
        };
      }

      const data = await response.json();
      // Bonbast returns values in Toman, multiply by 10 for Rial
      const rate = (data.usd?.sell ?? 145600) * 10;

      return {
        rate,
        source: 'bonbast' as const,
      };
    } catch (error) {
      return {
        rate: DEFAULT_FX_RATE,
        source: 'fallback' as const,
      };
    }
  }
);

const pricesSlice = createSlice({
  name: 'prices',
  initialState,
  reducers: {
    setPrice: (
      state,
      action: PayloadAction<{ assetId: AssetId; price: number }>
    ) => {
      state.prices[action.payload.assetId] = action.payload.price;
    },
    setPrices: (state, action: PayloadAction<Record<AssetId, number>>) => {
      state.prices = action.payload;
    },
    setFxRate: (
      state,
      action: PayloadAction<{ rate: number; source: 'bonbast' | 'fallback' }>
    ) => {
      state.fxRate = action.payload.rate;
      state.fxSource = action.payload.source;
    },
    setDefaultPrices: (state) => {
      state.prices = DEFAULT_PRICES as Record<AssetId, number>;
      state.updatedAt = new Date().toISOString();
    },
    clearError: (state) => {
      state.error = null;
    },
    // WebSocket-specific reducers
    setConnectionStatus: (state, action: PayloadAction<ConnectionStatus>) => {
      state.connectionStatus = action.payload;
    },
    updatePriceFromWebSocket: (
      state,
      action: PayloadAction<{
        assetId: AssetId;
        priceUsd: number;
        priceIrr: number;
        change24hPct?: number;
        timestamp: string;
      }>
    ) => {
      const { assetId, priceUsd, priceIrr, change24hPct, timestamp } = action.payload;
      state.prices[assetId] = priceUsd;
      state.pricesIrr[assetId] = priceIrr;
      if (change24hPct !== undefined) {
        state.change24h[assetId] = change24hPct;
      }
      state.updatedAt = timestamp;
    },
    updateAllPricesFromWebSocket: (
      state,
      action: PayloadAction<{
        prices: Array<{
          assetId: string;
          priceUsd: number;
          priceIrr: number;
          change24hPct?: number;
        }>;
        timestamp: string;
      }>
    ) => {
      const { prices, timestamp } = action.payload;
      prices.forEach((p) => {
        const assetId = p.assetId as AssetId;
        state.prices[assetId] = p.priceUsd;
        state.pricesIrr[assetId] = p.priceIrr;
        if (p.change24hPct !== undefined) {
          state.change24h[assetId] = p.change24hPct;
        }
      });
      state.updatedAt = timestamp;
    },
    updateFxFromWebSocket: (
      state,
      action: PayloadAction<{
        usdIrr: number;
        source: string;
        timestamp: string;
      }>
    ) => {
      state.fxRate = action.payload.usdIrr;
      state.fxSource = action.payload.source as 'bonbast' | 'fallback';
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchPrices.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchPrices.fulfilled, (state, action) => {
        state.isLoading = false;
        state.prices = action.payload.prices;
        state.updatedAt = action.payload.updatedAt;
      })
      .addCase(fetchPrices.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
        // Use default prices on error
        state.prices = DEFAULT_PRICES as Record<AssetId, number>;
      })
      .addCase(fetchFxRate.fulfilled, (state, action) => {
        state.fxRate = action.payload.rate;
        state.fxSource = action.payload.source;
      });
  },
});

export const {
  setPrice,
  setPrices,
  setFxRate,
  setDefaultPrices,
  clearError,
  setConnectionStatus,
  updatePriceFromWebSocket,
  updateAllPricesFromWebSocket,
  updateFxFromWebSocket,
} = pricesSlice.actions;

export default pricesSlice.reducer;
