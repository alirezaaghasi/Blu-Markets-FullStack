/**
 * Onboarding Slice - Handles onboarding flow state transitions
 *
 * Actions handled:
 * - START_ONBOARDING: Begin onboarding flow
 * - SET_PHONE: Set phone number
 * - SUBMIT_PHONE: Validate and submit phone
 * - ANSWER_QUESTION: Process questionnaire answer
 * - ADVANCE_CONSENT: Progress consent step
 * - SUBMIT_CONSENT: Complete consent
 * - SET_INVEST_AMOUNT: Set investment amount
 * - EXECUTE_PORTFOLIO: Create initial portfolio
 */

import { STAGES, THRESHOLDS, LAYERS, WEIGHTS, DEFAULT_PRICES, DEFAULT_FX_RATE } from '../../constants/index';
import { ASSETS } from '../../state/domain';
import { irrToFixedIncomeUnits, FIXED_INCOME_UNIT_PRICE } from '../../engine/fixedIncome';
import { uid, nowISO, computeDateLabel } from '../../helpers';
import { calculateFinalRisk, answersToRichFormat } from '../../engine/riskScoring';
import questionnaire from '../../data/questionnaire.v2.fa.json';
import { addLogEntry } from '../initialState';
import type { AppState, AppAction, Holding, TargetLayerPct, Layer, LedgerEntry, LedgerEntryType, Stage } from '../../types';

export const ONBOARDING_ACTIONS: string[] = [
  'START_ONBOARDING',
  'SET_PHONE',
  'SUBMIT_PHONE',
  'ANSWER_QUESTION',
  'GO_BACK_QUESTION',      // Task 4: Back button
  'ADVANCE_CONSENT',
  'SUBMIT_CONSENT',
  'TOGGLE_CONSENT_CHECKBOX', // Task 2: Checkbox consent
  'SUBMIT_CHECKBOX_CONSENT', // Task 2: Submit checkbox consent
  'SET_INVEST_AMOUNT',
  'EXECUTE_PORTFOLIO',
  'GO_TO_DASHBOARD',        // Task 1: Navigate from summary
];

/**
 * Helper to compute holding value in IRR from quantity
 */
function computeHoldingIRR(assetId: string, quantity: number, prices: Record<string, number>, fxRate: number): number {
  if (assetId === 'IRR_FIXED_INCOME') {
    return quantity * FIXED_INCOME_UNIT_PRICE;
  }
  const priceUSD = prices[assetId] || DEFAULT_PRICES[assetId] || 1;
  return quantity * priceUSD * fxRate;
}

/**
 * Build initial portfolio holdings from investment amount and target allocation
 * v10: Holdings now store quantities instead of valueIRR
 * v10.2.3: Added reconciliation step to ensure exact layer percentages
 */
export function buildInitialHoldings(
  totalIRR: number,
  targetLayerPct: TargetLayerPct,
  prices: Record<string, number> = DEFAULT_PRICES,
  fxRate: number = DEFAULT_FX_RATE,
  createdAt: string | undefined = undefined
): Holding[] {
  const holdings: Holding[] = ASSETS.map(assetId => ({
    assetId,
    quantity: 0,
    purchasedAt: assetId === 'IRR_FIXED_INCOME' ? createdAt : undefined,
    frozen: false,
  } as Holding));

  // Build O(1) lookup map to avoid repeated O(n) find calls
  const holdingsById = Object.fromEntries(holdings.map(h => [h.assetId, h])) as Record<string, Holding>;

  for (const layer of LAYERS as Layer[]) {
    const pct = (targetLayerPct[layer] ?? 0) / 100;
    const targetLayerIRR = Math.round(totalIRR * pct);  // Use round for target, not floor
    const weights = (WEIGHTS as Record<Layer, Record<string, number>>)[layer] || {};
    const layerAssets = Object.keys(weights);

    // Phase 1: Initial allocation (may have rounding gaps)
    for (const assetId of layerAssets) {
      const h = holdingsById[assetId];
      if (!h) continue;

      // Use round instead of floor for better initial distribution
      const assetAmountIRR = Math.round(targetLayerIRR * weights[assetId]);

      // Convert IRR to quantity based on asset type
      if (assetId === 'IRR_FIXED_INCOME') {
        h.quantity = irrToFixedIncomeUnits(assetAmountIRR);
      } else {
        // quantity = IRR / (priceUSD × fxRate)
        const priceUSD = prices[assetId] || DEFAULT_PRICES[assetId] || 1;
        h.quantity = assetAmountIRR / (priceUSD * fxRate);
      }
    }

    // Phase 2: Reconciliation - adjust last asset to hit exact target
    // Calculate actual layer total after initial allocation
    let actualLayerIRR = 0;
    for (const assetId of layerAssets) {
      const h = holdingsById[assetId];
      if (h) {
        actualLayerIRR += computeHoldingIRR(assetId, h.quantity, prices, fxRate);
      }
    }

    // Find the gap and adjust the last non-fixed-income asset
    const gapIRR = targetLayerIRR - actualLayerIRR;
    if (Math.abs(gapIRR) > 1) {  // Only adjust if gap is meaningful (> 1 IRR)
      // Find last adjustable asset (prefer non-fixed-income for precision)
      let adjustAssetId = layerAssets[layerAssets.length - 1];
      for (let i = layerAssets.length - 1; i >= 0; i--) {
        if (layerAssets[i] !== 'IRR_FIXED_INCOME') {
          adjustAssetId = layerAssets[i];
          break;
        }
      }

      const h = holdingsById[adjustAssetId];
      if (h) {
        if (adjustAssetId === 'IRR_FIXED_INCOME') {
          // For fixed income, adjust units
          h.quantity += irrToFixedIncomeUnits(gapIRR);
        } else {
          // For regular assets, adjust quantity
          const priceUSD = prices[adjustAssetId] || DEFAULT_PRICES[adjustAssetId] || 1;
          h.quantity += gapIRR / (priceUSD * fxRate);
        }
      }
    }
  }

  return holdings;
}

/**
 * Onboarding slice reducer
 */
export function onboardingReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'START_ONBOARDING':
      return { ...state, stage: STAGES.ONBOARDING_PHONE as Stage };

    case 'SET_PHONE': {
      const phone = String((action as { type: 'SET_PHONE'; phone: string }).phone || '').trim();
      return { ...state, phone };
    }

    case 'SUBMIT_PHONE': {
      const phone = String(state.phone || '').trim();
      if (!phone.startsWith('+989') || phone.length !== 13) return state;
      return { ...state, stage: STAGES.ONBOARDING_QUESTIONNAIRE as Stage };
    }

    case 'ANSWER_QUESTION': {
      if (state.stage !== STAGES.ONBOARDING_QUESTIONNAIRE) return state;
      // v10: Store option index for new scoring system
      const question = questionnaire.questions[state.questionnaire.index];
      const optionIndex = question.options.findIndex(o => o.id === action.optionId);
      const answers = { ...state.questionnaire.answers, [action.qId]: optionIndex };
      let idx = state.questionnaire.index + 1;
      let s = { ...state, questionnaire: { index: idx, answers } };

      if (idx >= questionnaire.questions.length) {
        // v10: Use new risk scoring engine
        const richAnswers = answersToRichFormat(answers, questionnaire);
        const profileResult = calculateFinalRisk(richAnswers, questionnaire);
        const targetLayerPct = profileResult.allocation;
        s = { ...s, targetLayerPct, profileResult, stage: STAGES.ONBOARDING_RESULT as Stage };
      }
      return s;
    }

    // Task 4: Back button in questionnaire
    case 'GO_BACK_QUESTION': {
      if (state.stage !== STAGES.ONBOARDING_QUESTIONNAIRE) return state;
      if (state.questionnaire.index <= 0) return state;
      return {
        ...state,
        questionnaire: {
          ...state.questionnaire,
          index: state.questionnaire.index - 1,
        },
      };
    }

    case 'ADVANCE_CONSENT': {
      if (state.stage !== STAGES.ONBOARDING_RESULT) return state;
      const nextStep = state.consentStep + 1;
      const newMessages = [...state.consentMessages, action.message];
      return { ...state, consentStep: nextStep, consentMessages: newMessages };
    }

    case 'SUBMIT_CONSENT': {
      if (state.stage !== STAGES.ONBOARDING_RESULT) return state;
      if (String(action.text || '') !== questionnaire.consent_exact) return state;
      return { ...state, stage: STAGES.AMOUNT_REQUIRED as Stage };
    }

    // Task 2: Toggle consent checkbox
    case 'TOGGLE_CONSENT_CHECKBOX': {
      if (state.stage !== STAGES.ONBOARDING_RESULT) return state;
      const checkbox = (action as { type: 'TOGGLE_CONSENT_CHECKBOX'; checkbox: 'risk' | 'loss' | 'noGuarantee' }).checkbox;
      const checkboxMap = {
        risk: 'riskAcknowledged',
        loss: 'lossAcknowledged',
        noGuarantee: 'noGuaranteeAcknowledged',
      } as const;
      const field = checkboxMap[checkbox];
      return {
        ...state,
        consentCheckboxes: {
          ...state.consentCheckboxes,
          [field]: !state.consentCheckboxes[field],
        },
      };
    }

    // Task 2: Submit checkbox consent
    case 'SUBMIT_CHECKBOX_CONSENT': {
      if (state.stage !== STAGES.ONBOARDING_RESULT) return state;
      const { riskAcknowledged, lossAcknowledged, noGuaranteeAcknowledged } = state.consentCheckboxes;
      if (!riskAcknowledged || !lossAcknowledged || !noGuaranteeAcknowledged) return state;
      return { ...state, stage: STAGES.AMOUNT_REQUIRED as Stage };
    }

    case 'SET_INVEST_AMOUNT': {
      if (state.stage !== STAGES.AMOUNT_REQUIRED) return state;
      return { ...state, investAmountIRR: action.amountIRR };
    }

    case 'EXECUTE_PORTFOLIO': {
      if (state.stage !== STAGES.AMOUNT_REQUIRED) return state;
      const n = Math.floor(Number(state.investAmountIRR) || 0);
      if (n < THRESHOLDS.MIN_AMOUNT_IRR) return state;

      // v10: Pass creation timestamp for fixed income accrual
      // Prices can be passed via action if available from usePrices hook
      const prices = action.prices || DEFAULT_PRICES;
      const fxRate = action.fxRate || DEFAULT_FX_RATE;
      const createdAt = nowISO();

      const holdings = buildInitialHoldings(n, state.targetLayerPct, prices, fxRate, createdAt);
      // Task 1: Go to PORTFOLIO_CREATED summary screen instead of ACTIVE
      let s = { ...state, holdings, cashIRR: 0, stage: STAGES.PORTFOLIO_CREATED as Stage };

      // Create ledger entry
      const entry: LedgerEntry = {
        id: uid(),
        tsISO: createdAt,
        tsDateLabel: computeDateLabel(createdAt),  // Pre-computed for O(1) grouping in HistoryPane
        type: 'PORTFOLIO_CREATED_COMMIT' as LedgerEntryType,
        details: { amountIRR: n, targetLayerPct: state.targetLayerPct },
      };
      s = { ...s, ledger: [entry], lastAction: { type: 'PORTFOLIO_CREATED', timestamp: Date.now() } } as AppState;
      s = addLogEntry(s, 'PORTFOLIO_CREATED', { amountIRR: n });
      return s;
    }

    // Task 1: Navigate from summary screen to dashboard
    case 'GO_TO_DASHBOARD': {
      if (state.stage !== STAGES.PORTFOLIO_CREATED) return state;
      return { ...state, stage: STAGES.ACTIVE as Stage };
    }

    default:
      return state;
  }
}
