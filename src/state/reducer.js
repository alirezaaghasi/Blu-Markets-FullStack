import { computeSnapshot } from "../engine/snapshot.js";
import { classifyActionBoundary, frictionCopyForBoundary } from "../engine/boundary.js";
import {
  validateAddFunds,
  validateTrade,
  validateProtect,
  validateBorrow,
  validateRepay,
  validateRebalance,
} from "../engine/validate.js";
import {
  cloneState,
  previewAddFunds,
  previewTrade,
  previewProtect,
  previewBorrow,
  previewRepay,
  previewRebalance,
} from "../engine/preview.js";
import { calcPremiumIRR } from "../engine/pricing.js";

function uid() {
  return `${Math.random().toString(16).slice(2)}-${Date.now().toString(16)}`;
}

function nowISO() {
  return new Date().toISOString();
}

function buildPending(state, kind, payload, validation, afterState) {
  const before = computeSnapshot(state);
  const after = computeSnapshot(afterState);
  const boundary = classifyActionBoundary({
    kind,
    validation,
    before,
    after,
    stressMode: state.stressMode,
  });

  return {
    kind,
    payload,
    before,
    after,
    validation,
    boundary,
    frictionCopy: frictionCopyForBoundary(boundary),
  };
}

export function reducer(state, action) {
  switch (action.type) {
    // Global toggle (manual only - no auto-trigger until price feeds exist)
    case "SET_STRESS_MODE":
      return { ...state, stressMode: Boolean(action.payload?.on) };

    // --- Onboarding ---
    case "SET_PHONE": {
      const phone = String(action.payload?.phone || "").trim();
      if (!phone.startsWith("+989") || phone.length !== 13) return state;
      return { ...state, phone, stage: "ONBOARDING_QUESTIONNAIRE" };
    }

    case "SUBMIT_QUESTIONNAIRE": {
      const t = action.payload?.targetLayerPct;
      if (!t) return state;
      return { ...state, targetLayerPct: t, stage: "ONBOARDING_RESULT" };
    }

    case "ACCEPT_ALLOCATION":
      return { ...state, stage: "ACTIVE" };

    // --- Preview Actions ---
    case "PREVIEW_ADD_FUNDS": {
      const payload = { amountIRR: Number(action.payload?.amountIRR) };
      const validation = validateAddFunds(payload);
      const afterState = validation.ok ? previewAddFunds(state, payload) : cloneState(state);
      return { ...state, pendingAction: buildPending(state, "ADD_FUNDS", payload, validation, afterState) };
    }

    case "PREVIEW_TRADE": {
      const payload = {
        side: action.payload?.side,
        assetId: action.payload?.assetId,
        amountIRR: Number(action.payload?.amountIRR),
      };
      const validation = validateTrade(payload, state);
      const afterState = validation.ok ? previewTrade(state, payload) : cloneState(state);
      return { ...state, pendingAction: buildPending(state, "TRADE", payload, validation, afterState) };
    }

    case "PREVIEW_PROTECT": {
      const payload = { assetId: action.payload?.assetId, months: Number(action.payload?.months) };
      const validation = validateProtect(payload, state);
      const afterState = validation.ok ? previewProtect(state, payload) : cloneState(state);
      return { ...state, pendingAction: buildPending(state, "PROTECT", payload, validation, afterState) };
    }

    case "PREVIEW_BORROW": {
      const payload = {
        assetId: action.payload?.assetId,
        amountIRR: Number(action.payload?.amountIRR),
        ltv: Number(action.payload?.ltv),
      };
      const validation = validateBorrow(payload, state);
      const afterState = validation.ok ? previewBorrow(state, payload) : cloneState(state);
      return { ...state, pendingAction: buildPending(state, "BORROW", payload, validation, afterState) };
    }

    case "PREVIEW_REPAY": {
      const payload = { amountIRR: Number(action.payload?.amountIRR) };
      const validation = validateRepay(payload, state);
      const afterState = validation.ok ? previewRepay(state, payload) : cloneState(state);
      return { ...state, pendingAction: buildPending(state, "REPAY", payload, validation, afterState) };
    }

    case "PREVIEW_REBALANCE": {
      const payload = { mode: action.payload?.mode };
      const validation = validateRebalance(payload);
      const afterState = validation.ok ? previewRebalance(state, payload) : cloneState(state);
      return { ...state, pendingAction: buildPending(state, "REBALANCE", payload, validation, afterState) };
    }

    case "CANCEL_PENDING":
      return { ...state, pendingAction: null };

    // --- Confirm ---
    case "CONFIRM_PENDING": {
      const p = state.pendingAction;
      if (!p || !p.validation.ok) return state;

      let next = cloneState(state);

      // Commit by replaying deterministic preview
      if (p.kind === "ADD_FUNDS") next = previewAddFunds(next, p.payload);
      if (p.kind === "TRADE") next = previewTrade(next, p.payload);
      if (p.kind === "BORROW") next = previewBorrow(next, p.payload);
      if (p.kind === "REPAY") next = previewRepay(next, p.payload);
      if (p.kind === "REBALANCE") next = previewRebalance(next, p.payload);

      if (p.kind === "PROTECT") {
        const holding = next.holdings.find((h) => h.assetId === p.payload.assetId);
        if (holding) {
          const premium = calcPremiumIRR({
            assetId: holding.assetId,
            notionalIRR: holding.valueIRR,
            months: p.payload.months,
          });
          next.cashIRR -= premium;

          const startISO = new Date().toISOString().slice(0, 10);
          const end = new Date();
          end.setMonth(end.getMonth() + p.payload.months);
          const endISO = end.toISOString().slice(0, 10);

          next.protections = [
            ...next.protections,
            {
              id: uid(),
              assetId: holding.assetId,
              notionalIRR: holding.valueIRR,
              premiumIRR: premium,
              startISO,
              endISO,
            },
          ];
        }
      }

      const entry = {
        id: uid(),
        tsISO: nowISO(),
        type: `${p.kind}_COMMIT`,
        details: {
          kind: p.kind,
          payload: p.payload,
          boundary: p.boundary,
          validation: p.validation,
          before: p.before,
          after: computeSnapshot(next),
        },
      };

      next.pendingAction = null;
      next.ledger = [...next.ledger, entry];
      return next;
    }

    default:
      return state;
  }
}
