// Shared domain types (can be exported to frontend)
// Based on Blu Markets PRD v4.1

// ============================================================================
// ASSETS
// ============================================================================

export type AssetId =
  // Foundation
  | 'USDT'
  | 'PAXG'
  | 'IRR_FIXED_INCOME'
  // Growth
  | 'BTC'
  | 'ETH'
  | 'BNB'
  | 'XRP'
  | 'KAG' // Kinesis Silver
  | 'QQQ'
  // Upside
  | 'SOL'
  | 'TON'
  | 'LINK'
  | 'AVAX'
  | 'MATIC'
  | 'ARB';

export type Layer = 'FOUNDATION' | 'GROWTH' | 'UPSIDE';

export type Boundary = 'SAFE' | 'DRIFT' | 'STRUCTURAL' | 'STRESS';

export type PortfolioStatus = 'BALANCED' | 'SLIGHTLY_OFF' | 'ATTENTION_REQUIRED';

export type LoanStatus = 'ACTIVE' | 'REPAID' | 'LIQUIDATED';

export type ProtectionStatus = 'ACTIVE' | 'EXPIRED' | 'CANCELLED';

export type InstallmentStatus = 'PENDING' | 'PARTIAL' | 'PAID';

export type RiskTier = 'LOW' | 'MEDIUM' | 'HIGH';

// ============================================================================
// RISK PROFILE
// ============================================================================

export interface TargetAllocation {
  foundation: number;
  growth: number;
  upside: number;
}

export interface RiskProfile {
  score: number; // 1-10
  tier: RiskTier;
  name: string;
  targetAllocation: TargetAllocation;
}

// Risk profile names per PRD
// Risk profile names per PRD Section 3.2
export const RISK_PROFILE_NAMES: Record<number, string> = {
  1: 'Capital Preservation',
  2: 'Capital Preservation',
  3: 'Conservative',
  4: 'Conservative',
  5: 'Balanced',
  6: 'Balanced',
  7: 'Growth',
  8: 'Growth',
  9: 'Aggressive',
  10: 'Aggressive',
};

// Target allocations per risk score (from PRD Section 3.2)
export const TARGET_ALLOCATIONS: Record<number, TargetAllocation> = {
  1: { foundation: 85, growth: 12, upside: 3 },
  2: { foundation: 80, growth: 15, upside: 5 },
  3: { foundation: 70, growth: 25, upside: 5 },
  4: { foundation: 65, growth: 30, upside: 5 },
  5: { foundation: 55, growth: 35, upside: 10 },
  6: { foundation: 50, growth: 35, upside: 15 },
  7: { foundation: 45, growth: 38, upside: 17 },
  8: { foundation: 40, growth: 40, upside: 20 },
  9: { foundation: 35, growth: 40, upside: 25 },
  10: { foundation: 30, growth: 40, upside: 30 },
};

// ============================================================================
// HOLDINGS
// ============================================================================

export interface Holding {
  assetId: AssetId;
  quantity: number;
  layer: Layer;
  frozen: boolean;
  valueIrr?: number;
  valueUsd?: number;
}

// ============================================================================
// PORTFOLIO
// ============================================================================

export interface PortfolioSnapshot {
  id: string;
  userId: string;
  cashIrr: number;
  holdings: Holding[];
  totalValueIrr: number;
  holdingsValueIrr: number;
  allocation: {
    foundation: number;
    growth: number;
    upside: number;
  };
  targetAllocation: TargetAllocation;
  status: PortfolioStatus;
  driftPct: number;
}

// ============================================================================
// LOANS (per PRD)
// ============================================================================

export interface LoanInstallment {
  number: number;
  dueDate: string;
  principalIrr: number;
  interestIrr: number;
  totalIrr: number;
  paidIrr: number;
  status: InstallmentStatus;
}

export interface Loan {
  id: string;
  collateralAssetId: AssetId;
  collateralQuantity: number;
  collateralValueIrr: number;
  principalIrr: number;
  interestRate: number; // 0.30 = 30%
  totalInterestIrr: number;
  totalDueIrr: number;
  durationMonths: 3 | 6;
  startDate: string;
  dueDate: string;
  installments: LoanInstallment[];
  ltv: number;
  status: LoanStatus;
}

// LTV limits by layer (per PRD)
export const LTV_BY_LAYER: Record<Layer, number> = {
  FOUNDATION: 0.70,
  GROWTH: 0.50,
  UPSIDE: 0.25,
};

// ============================================================================
// PROTECTION (per PRD)
// ============================================================================

export interface Protection {
  id: string;
  assetId: AssetId;
  notionalIrr: number;
  premiumIrr: number;
  durationMonths: number;
  startDate: string;
  endDate: string;
  status: ProtectionStatus;
}

// Monthly premium rates by layer (per PRD)
export const PROTECTION_RATES: Record<Layer, number> = {
  FOUNDATION: 0.004, // 0.4%
  GROWTH: 0.008, // 0.8%
  UPSIDE: 0.012, // 1.2%
};

// Protection eligible assets - assets with liquid derivatives markets for hedging
// Criteria: Must have big, liquid derivatives market (futures/options)
export const PROTECTION_ELIGIBLE_ASSETS: AssetId[] = [
  'BTC',   // CME futures, Deribit/Binance options
  'ETH',   // CME futures, major exchange options
  'PAXG',  // Gold - COMEX futures/options
  'KAG',   // Silver - COMEX futures/options
  'QQQ',   // Nasdaq-100 options (most liquid)
  'SOL',   // CME futures, exchange perps
];

// ============================================================================
// TRADE
// ============================================================================

export type TradeAction = 'BUY' | 'SELL';

export interface TradePreview {
  action: TradeAction;
  assetId: AssetId;
  quantity: number;
  amountIrr: number;
  priceIrr: number;
  spreadPct: number;
  spreadAmountIrr: number;
  allocationBefore: TargetAllocation;
  allocationAfter: TargetAllocation;
  boundary: Boundary;
  frictionCopy?: string;
  movesTowardTarget: boolean;
}

// ============================================================================
// LEDGER
// ============================================================================

export type LedgerEntryType =
  | 'PORTFOLIO_CREATED'
  | 'ADD_FUNDS'
  | 'TRADE_BUY'
  | 'TRADE_SELL'
  | 'REBALANCE'
  | 'PROTECTION_PURCHASE'
  | 'PROTECTION_CANCEL'
  | 'PROTECTION_EXPIRE'
  | 'LOAN_CREATE'
  | 'LOAN_REPAY'
  | 'LOAN_LIQUIDATE';

export interface LedgerEntry {
  id: string;
  entryType: LedgerEntryType;
  assetId?: AssetId;
  quantity?: number;
  amountIrr?: number;
  boundary?: Boundary;
  message: string;
  beforeSnapshot: PortfolioSnapshot;
  afterSnapshot: PortfolioSnapshot;
  createdAt: string;
}

// ============================================================================
// PRICES
// ============================================================================

export interface AssetPrice {
  assetId: AssetId;
  priceUsd: number;
  priceIrr: number;
  change24hPct?: number;
  source: string;
  fetchedAt: string;
}

export interface FxRate {
  usdIrr: number;
  source: string;
  fetchedAt: string;
}

// ============================================================================
// CONSTANTS (per PRD)
// ============================================================================

export const INTEREST_RATE = 0.30; // 30% annual
export const FIXED_INCOME_RATE = 0.30; // 30% annual simple interest
export const FIXED_INCOME_UNIT_PRICE_IRR = 500000; // 500K IRR per unit
export const PORTFOLIO_LOAN_LIMIT = 0.25; // 25% of portfolio max
export const MIN_TRADE_IRR = 1000000; // 1M IRR minimum trade
export const REBALANCE_COOLDOWN_HOURS = 24;
export const FALLBACK_FX_RATE = 1456000; // USD/IRR fallback
