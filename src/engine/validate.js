// @ts-check
/** @typedef {import('../types').ValidationResult} ValidationResult */
/** @typedef {import('../types').ValidationMeta} ValidationMeta */
/** @typedef {import('../types').AppState} AppState */
/** @typedef {import('../types').AssetId} AssetId */
/** @typedef {import('../types').TradeSide} TradeSide */
/** @typedef {import('../types').RebalanceMode} RebalanceMode */

import { calcPremiumIRR } from "./pricing.js";
import { THRESHOLDS, PROTECTION_ELIGIBLE_ASSETS, COLLATERAL_LTV_BY_LAYER } from "../constants/index.js";
import { ASSET_LAYER } from "../state/domain.js";
import { getHoldingValueIRR } from "../helpers.js";

/**
 * Create a successful validation result
 * @param {ValidationMeta} [meta] - Optional metadata
 * @returns {ValidationResult}
 */
export function ok(meta = {}) {
  return { ok: true, errors: [], meta };
}

/**
 * Create a failed validation result
 * @param {string|string[]} errors - Error message(s)
 * @param {ValidationMeta} [meta] - Optional metadata
 * @returns {ValidationResult}
 */
export function fail(errors, meta = {}) {
  return { ok: false, errors: Array.isArray(errors) ? errors : [String(errors)], meta };
}

/**
 * Validate add funds action
 * @param {{ amountIRR: number }} payload
 * @returns {ValidationResult}
 */
export function validateAddFunds({ amountIRR }) {
  if (!Number.isFinite(amountIRR) || amountIRR <= 0) return fail("INVALID_AMOUNT");
  return ok();
}

/**
 * Validate trade action
 * @param {{ side: TradeSide, assetId: AssetId, amountIRR: number, prices?: Record<string, number>, fxRate?: number }} payload
 * @param {AppState} state
 * @returns {ValidationResult}
 */
export function validateTrade({ side, assetId, amountIRR, prices, fxRate }, state) {
  if (!["BUY", "SELL"].includes(side)) return fail("INVALID_SIDE");
  if (!Number.isFinite(amountIRR) || amountIRR <= 0) return fail("INVALID_AMOUNT");

  // Single lookup instead of .some() + .find()
  const h = state.holdings.find((x) => x.assetId === assetId);
  if (!h) return fail("INVALID_ASSET");

  if (side === "BUY") {
    if (state.cashIRR < amountIRR) {
      return fail(["INSUFFICIENT_CASH"], { required: amountIRR, available: state.cashIRR });
    }
    return ok();
  }

  // SELL - v10: compute value from quantity
  if (h.frozen) return fail("ASSET_FROZEN");
  const holdingValueIRR = getHoldingValueIRR(h, prices, fxRate);
  if (holdingValueIRR < amountIRR) {
    return fail(["INSUFFICIENT_ASSET_VALUE"], { available: holdingValueIRR });
  }
  return ok();
}

/**
 * Validate protect action
 * @param {{ assetId: AssetId, months: number, prices?: Record<string, number>, fxRate?: number }} payload
 * @param {AppState} state
 * @returns {ValidationResult}
 */
export function validateProtect({ assetId, months, prices, fxRate }, state) {
  // Single lookup instead of .some() + .find()
  const h = state.holdings.find((x) => x.assetId === assetId);
  if (!h) return fail("INVALID_ASSET");

  // Eligibility validation (must have liquid derivative markets)
  if (!PROTECTION_ELIGIBLE_ASSETS.includes(assetId)) {
    return fail("ASSET_NOT_ELIGIBLE_FOR_PROTECTION");
  }

  // Duration validation
  if (!Number.isFinite(months) || months < THRESHOLDS.PROTECTION_MIN_MONTHS || months > THRESHOLDS.PROTECTION_MAX_MONTHS) {
    return fail("INVALID_MONTHS");
  }

  // Notional validation - v10: compute value from quantity
  const holdingValueIRR = getHoldingValueIRR(h, prices, fxRate);
  if (holdingValueIRR <= 0) {
    return fail("NO_NOTIONAL");
  }

  // P-2: Check for existing active protection on this asset
  const existingProtection = (state.protections || []).find(p => {
    if (p.assetId !== assetId) return false;
    const endDate = new Date(p.endISO);
    return endDate > new Date(); // Still active
  });

  if (existingProtection) {
    return fail("ASSET_ALREADY_PROTECTED");
  }

  // Premium cash sufficiency check (at preview time for immediate feedback)
  const premium = calcPremiumIRR({
    assetId,
    notionalIRR: holdingValueIRR,
    months,
  });

  if (premium > state.cashIRR) {
    return fail(
      ["INSUFFICIENT_CASH_FOR_PREMIUM"],
      { required: premium, available: state.cashIRR }
    );
  }

  return ok({ notionalIRR: holdingValueIRR });
}

/**
 * Validate borrow action
 * @param {{ assetId: AssetId, amountIRR: number, prices?: Record<string, number>, fxRate?: number }} payload
 * @param {AppState} state
 * @returns {ValidationResult}
 */
export function validateBorrow({ assetId, amountIRR, prices, fxRate }, state) {
  if (!Number.isFinite(amountIRR) || amountIRR <= 0) return fail("INVALID_AMOUNT");

  // Single lookup instead of .some() + .find()
  const h = state.holdings.find((x) => x.assetId === assetId);
  if (!h) return fail("INVALID_ASSET");
  if (h.frozen) return fail("ASSET_ALREADY_FROZEN");

  // LTV is determined by asset's layer (volatility-based)
  // v10: compute value from quantity
  const layer = ASSET_LAYER[assetId];
  const maxLtv = COLLATERAL_LTV_BY_LAYER[layer] || 0.3;
  const holdingValueIRR = getHoldingValueIRR(h, prices, fxRate);
  const maxBorrow = Math.floor(holdingValueIRR * maxLtv);

  if (amountIRR > maxBorrow) {
    return fail(["EXCEEDS_MAX_BORROW"], { maxBorrow, maxLtv });
  }
  return ok({ maxLtv, maxBorrow, holdingValueIRR });
}

/**
 * Validate repay action
 * @param {{ loanId: string, amountIRR: number }} payload
 * @param {AppState} state
 * @returns {ValidationResult}
 */
export function validateRepay({ loanId, amountIRR }, state) {
  const loans = state.loans || [];
  if (loans.length === 0) return fail("NO_ACTIVE_LOAN");

  const loan = loans.find((l) => l.id === loanId);
  if (!loan) return fail("NO_ACTIVE_LOAN");

  if (!Number.isFinite(amountIRR) || amountIRR <= 0) return fail("INVALID_AMOUNT");
  if (state.cashIRR <= 0) return fail("NO_CASH");
  return ok({ loan });
}

/**
 * Validate rebalance action
 * @param {{ mode: RebalanceMode | 'SMART' }} payload
 * @returns {ValidationResult}
 */
export function validateRebalance({ mode }) {
  if (!["HOLDINGS_ONLY", "HOLDINGS_PLUS_CASH", "SMART"].includes(mode)) return fail("INVALID_MODE");
  return ok();
}
