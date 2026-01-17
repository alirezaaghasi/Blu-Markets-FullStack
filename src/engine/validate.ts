import type { ValidationResult, ValidationMeta, AppState, AssetId, TradeSide, RebalanceMode, Layer, Loan } from '../types';
import { calcPremiumIRR } from './pricing';
import { THRESHOLDS, PROTECTION_ELIGIBLE_ASSETS, COLLATERAL_LTV_BY_LAYER } from '../constants/index';
import { ASSET_LAYER } from '../state/domain';
import { getHoldingValueIRR } from '../helpers';

interface AddFundsPayload {
  amountIRR: number;
}

interface TradePayload {
  side: TradeSide;
  assetId: AssetId;
  amountIRR: number;
  prices?: Record<string, number>;
  fxRate?: number;
}

interface ProtectPayload {
  assetId: AssetId;
  months: number;
  prices?: Record<string, number>;
  fxRate?: number;
}

interface BorrowPayload {
  assetId: AssetId;
  amountIRR: number;
  prices?: Record<string, number>;
  fxRate?: number;
}

interface RepayPayload {
  loanId: string;
  amountIRR: number;
}

interface RebalancePayload {
  mode: RebalanceMode | 'SMART';
}

// Extended validation meta types
interface ValidationMetaWithLoan extends ValidationMeta {
  loan?: Loan;
  notionalIRR?: number;
  holdingValueIRR?: number;
}

/**
 * Create a successful validation result
 */
export function ok(meta: ValidationMetaWithLoan = {}): ValidationResult {
  return { ok: true, errors: [], meta };
}

/**
 * Create a failed validation result
 */
export function fail(errors: string | string[], meta: ValidationMeta = {}): ValidationResult {
  return { ok: false, errors: Array.isArray(errors) ? errors : [String(errors)], meta };
}

/**
 * Validate add funds action
 */
export function validateAddFunds({ amountIRR }: AddFundsPayload): ValidationResult {
  if (!Number.isFinite(amountIRR) || amountIRR <= 0) return fail('INVALID_AMOUNT');
  return ok();
}

/**
 * Validate trade action
 */
export function validateTrade({ side, assetId, amountIRR, prices, fxRate }: TradePayload, state: AppState): ValidationResult {
  if (!['BUY', 'SELL'].includes(side)) return fail('INVALID_SIDE');
  if (!Number.isFinite(amountIRR) || amountIRR <= 0) return fail('INVALID_AMOUNT');

  // Single lookup instead of .some() + .find()
  const h = state.holdings.find((x) => x.assetId === assetId);
  if (!h) return fail('INVALID_ASSET');

  if (side === 'BUY') {
    if (state.cashIRR < amountIRR) {
      return fail(['INSUFFICIENT_CASH'], { required: amountIRR, available: state.cashIRR });
    }
    return ok();
  }

  // SELL - v10: compute value from quantity
  if (h.frozen) return fail('ASSET_FROZEN');
  const holdingValueIRR = getHoldingValueIRR(h, prices, fxRate);
  if (holdingValueIRR < amountIRR) {
    return fail(['INSUFFICIENT_ASSET_VALUE'], { available: holdingValueIRR });
  }
  return ok();
}

/**
 * Validate protect action
 */
export function validateProtect({ assetId, months, prices, fxRate }: ProtectPayload, state: AppState): ValidationResult {
  // Single lookup instead of .some() + .find()
  const h = state.holdings.find((x) => x.assetId === assetId);
  if (!h) return fail('INVALID_ASSET');

  // Eligibility validation (must have liquid derivative markets)
  if (!PROTECTION_ELIGIBLE_ASSETS.includes(assetId)) {
    return fail('ASSET_NOT_ELIGIBLE_FOR_PROTECTION');
  }

  // Duration validation
  if (!Number.isFinite(months) || months < THRESHOLDS.PROTECTION_MIN_MONTHS || months > THRESHOLDS.PROTECTION_MAX_MONTHS) {
    return fail('INVALID_MONTHS');
  }

  // Notional validation - v10: compute value from quantity
  const holdingValueIRR = getHoldingValueIRR(h, prices, fxRate);
  if (holdingValueIRR <= 0) {
    return fail('NO_NOTIONAL');
  }

  // P-2: Check for existing active protection on this asset
  const nowMs = Date.now();
  const existingProtection = (state.protections || []).find(p => {
    if (p.assetId !== assetId) return false;
    // Use pre-computed endTimeMs if available, fallback to Date parsing for legacy data
    const endTimeMs = (p as typeof p & { endTimeMs?: number }).endTimeMs ?? new Date(p.endISO).getTime();
    return endTimeMs > nowMs; // Still active
  });

  if (existingProtection) {
    return fail('ASSET_ALREADY_PROTECTED');
  }

  // Premium cash sufficiency check (at preview time for immediate feedback)
  const premium = calcPremiumIRR({
    assetId,
    notionalIRR: holdingValueIRR,
    months,
  });

  if (premium > state.cashIRR) {
    return fail(
      ['INSUFFICIENT_CASH_FOR_PREMIUM'],
      { required: premium, available: state.cashIRR }
    );
  }

  return ok({ notionalIRR: holdingValueIRR });
}

/**
 * Validate borrow action
 */
export function validateBorrow({ assetId, amountIRR, prices, fxRate }: BorrowPayload, state: AppState): ValidationResult {
  if (!Number.isFinite(amountIRR) || amountIRR <= 0) return fail('INVALID_AMOUNT');

  // Single lookup instead of .some() + .find()
  const h = state.holdings.find((x) => x.assetId === assetId);
  if (!h) return fail('INVALID_ASSET');
  if (h.frozen) return fail('ASSET_ALREADY_FROZEN');

  // LTV is determined by asset's layer (volatility-based)
  // v10: compute value from quantity
  const layer = ASSET_LAYER[assetId] as Layer;
  const maxLtv = COLLATERAL_LTV_BY_LAYER[layer] || 0.3;
  const holdingValueIRR = getHoldingValueIRR(h, prices, fxRate);
  const maxBorrow = Math.floor(holdingValueIRR * maxLtv);

  if (amountIRR > maxBorrow) {
    return fail(['EXCEEDS_MAX_BORROW'], { maxBorrow, maxLtv });
  }
  return ok({ maxLtv, maxBorrow, holdingValueIRR });
}

/**
 * Validate repay action
 */
export function validateRepay({ loanId, amountIRR }: RepayPayload, state: AppState): ValidationResult {
  const loans = state.loans || [];
  if (loans.length === 0) return fail('NO_ACTIVE_LOAN');

  const loan = loans.find((l) => l.id === loanId);
  if (!loan) return fail('NO_ACTIVE_LOAN');

  if (!Number.isFinite(amountIRR) || amountIRR <= 0) return fail('INVALID_AMOUNT');
  if (state.cashIRR <= 0) return fail('NO_CASH');
  return ok({ loan });
}

/**
 * Validate rebalance action
 */
export function validateRebalance({ mode }: RebalancePayload): ValidationResult {
  if (!['HOLDINGS_ONLY', 'HOLDINGS_PLUS_CASH', 'SMART'].includes(mode)) return fail('INVALID_MODE');
  return ok();
}
