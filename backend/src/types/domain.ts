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
  | 'GOLD'
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
export const RISK_PROFILE_NAMES: Record<number, string> = {
  1: 'Capital Preservation',
  2: 'Capital Preservation',
  3: 'Conservative',
  4: 'Moderate Conservative',
  5: 'Balanced',
  6: 'Moderate Growth',
  7: 'Growth',
  8: 'Aggressive Growth',
  9: 'High Growth',
  10: 'Maximum Growth',
};

// Target allocations per risk score (from PRD Section 17)
export const TARGET_ALLOCATIONS: Record<number, TargetAllocation> = {
  1: { foundation: 80, growth: 15, upside: 5 },
  2: { foundation: 70, growth: 22, upside: 8 },
  3: { foundation: 60, growth: 28, upside: 12 },
  4: { foundation: 50, growth: 35, upside: 15 },
  5: { foundation: 40, growth: 40, upside: 20 },
  6: { foundation: 30, growth: 45, upside: 25 },
  7: { foundation: 25, growth: 45, upside: 30 },
  8: { foundation: 20, growth: 45, upside: 35 },
  9: { foundation: 15, growth: 40, upside: 45 },
  10: { foundation: 10, growth: 35, upside: 55 },
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
  UPSIDE: 0.30,
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

// Protection eligible assets (per PRD)
export const PROTECTION_ELIGIBLE_ASSETS: AssetId[] = [
  'BTC',
  'ETH',
  'GOLD',
  'QQQ',
  'SOL',
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
