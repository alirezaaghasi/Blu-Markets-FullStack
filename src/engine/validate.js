import { calcPremiumIRR } from "./pricing.js";

export function ok(meta = {}) {
  return { ok: true, errors: [], meta };
}

export function fail(errors, meta = {}) {
  return { ok: false, errors: Array.isArray(errors) ? errors : [String(errors)], meta };
}

export function validateAddFunds({ amountIRR }) {
  if (!Number.isFinite(amountIRR) || amountIRR <= 0) return fail("INVALID_AMOUNT");
  return ok();
}

export function validateTrade({ side, assetId, amountIRR }, state) {
  if (!["BUY", "SELL"].includes(side)) return fail("INVALID_SIDE");
  if (!state.holdings.some((h) => h.assetId === assetId)) return fail("INVALID_ASSET");
  if (!Number.isFinite(amountIRR) || amountIRR <= 0) return fail("INVALID_AMOUNT");

  const h = state.holdings.find((x) => x.assetId === assetId);
  if (!h) return fail("INVALID_ASSET");

  if (side === "BUY") {
    if (state.cashIRR < amountIRR) {
      return fail(["INSUFFICIENT_CASH"], { required: amountIRR, available: state.cashIRR });
    }
    return ok();
  }

  // SELL
  if (h.frozen) return fail("ASSET_FROZEN");
  if (h.valueIRR < amountIRR) {
    return fail(["INSUFFICIENT_ASSET_VALUE"], { available: h.valueIRR });
  }
  return ok();
}

export function validateProtect({ assetId, months }, state) {
  // Asset validation
  if (!state.holdings.some((h) => h.assetId === assetId)) {
    return fail("INVALID_ASSET");
  }

  // Duration validation
  if (!Number.isFinite(months) || months < 1 || months > 6) {
    return fail("INVALID_MONTHS");
  }

  // Notional validation
  const h = state.holdings.find((x) => x.assetId === assetId);
  if (!h || h.valueIRR <= 0) {
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
    notionalIRR: h.valueIRR,
    months,
  });

  if (premium > state.cashIRR) {
    return fail(
      ["INSUFFICIENT_CASH_FOR_PREMIUM"],
      { required: premium, available: state.cashIRR }
    );
  }

  return ok();
}

export function validateBorrow({ assetId, amountIRR, ltv }, state) {
  if (!state.holdings.some((h) => h.assetId === assetId)) return fail("INVALID_ASSET");
  if (!Number.isFinite(amountIRR) || amountIRR <= 0) return fail("INVALID_AMOUNT");
  if (!Number.isFinite(ltv) || ltv < 0.2 || ltv > 0.7) return fail("INVALID_LTV");
  if (state.loan) return fail("LOAN_ALREADY_ACTIVE");

  const h = state.holdings.find((x) => x.assetId === assetId);
  if (!h) return fail("INVALID_ASSET");
  if (h.frozen) return fail("ASSET_ALREADY_FROZEN");

  const maxBorrow = Math.floor(h.valueIRR * ltv);
  if (amountIRR > maxBorrow) {
    return fail(["EXCEEDS_MAX_BORROW"], { maxBorrow });
  }
  return ok();
}

export function validateRepay({ amountIRR }, state) {
  if (!state.loan) return fail("NO_ACTIVE_LOAN");
  if (!Number.isFinite(amountIRR) || amountIRR <= 0) return fail("INVALID_AMOUNT");
  if (state.cashIRR <= 0) return fail("NO_CASH");
  return ok();
}

export function validateRebalance({ mode }) {
  if (!["HOLDINGS_ONLY", "HOLDINGS_PLUS_CASH"].includes(mode)) return fail("INVALID_MODE");
  return ok();
}
