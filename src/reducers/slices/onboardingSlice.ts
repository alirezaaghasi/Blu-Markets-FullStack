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
import { irrToFixedIncomeUnits } from '../../engine/fixedIncome';
import { uid, nowISO } from '../../helpers';
import { calculateFinalRisk, answersToRichFormat } from '../../engine/riskScoring';
import questionnaire from '../../data/questionnaire.v2.fa.json';
import { addLogEntry } from '../initialState';
import type { AppState, AppAction, Holding, TargetLayerPct, Layer, LedgerEntry, LedgerEntryType, Stage } from '../../types';

export const ONBOARDING_ACTIONS: string[] = [
  'START_ONBOARDING',
  'SET_PHONE',
  'SUBMIT_PHONE',
  'ANSWER_QUESTION',
  'ADVANCE_CONSENT',
  'SUBMIT_CONSENT',
  'SET_INVEST_AMOUNT',
  'EXECUTE_PORTFOLIO',
];

/**
 * Build initial portfolio holdings from investment amount and target allocation
 * v10: Holdings now store quantities instead of valueIRR
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
    const layerAmountIRR = Math.floor(totalIRR * pct);
    const weights = (WEIGHTS as Record<Layer, Record<string, number>>)[layer] || {};
    let layerAllocated = 0;

    for (const assetId of Object.keys(weights)) {
      const h = holdingsById[assetId];
      if (!h) continue;

      const assetAmountIRR = Math.floor(layerAmountIRR * weights[assetId]);
      layerAllocated += assetAmountIRR;

      // Convert IRR to quantity based on asset type
      if (assetId === 'IRR_FIXED_INCOME') {
        h.quantity = irrToFixedIncomeUnits(assetAmountIRR);
      } else {
        // quantity = IRR / (priceUSD × fxRate)
        const priceUSD = prices[assetId] || DEFAULT_PRICES[assetId] || 1;
        h.quantity = assetAmountIRR / (priceUSD * fxRate);
      }
    }

    // Remainder to last asset in layer
    const remainderIRR = layerAmountIRR - layerAllocated;
    if (remainderIRR > 0) {
      const layerAssets = Object.keys(weights);
      const lastAsset = layerAssets[layerAssets.length - 1];
      const h = holdingsById[lastAsset];
      if (h) {
        if (lastAsset === 'IRR_FIXED_INCOME') {
          h.quantity += irrToFixedIncomeUnits(remainderIRR);
        } else {
          const priceUSD = prices[lastAsset] || DEFAULT_PRICES[lastAsset] || 1;
          h.quantity += remainderIRR / (priceUSD * fxRate);
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
      let s = { ...state, holdings, cashIRR: 0, stage: STAGES.ACTIVE as Stage };

      // Create ledger entry
      const entry: LedgerEntry = {
        id: uid(),
        tsISO: createdAt,
        type: 'PORTFOLIO_CREATED_COMMIT' as LedgerEntryType,
        details: { amountIRR: n, targetLayerPct: state.targetLayerPct },
      };
      s = { ...s, ledger: [entry], lastAction: { type: 'PORTFOLIO_CREATED', timestamp: Date.now() } } as AppState;
      s = addLogEntry(s, 'PORTFOLIO_CREATED', { amountIRR: n });
      return s;
    }

    default:
      return state;
  }
}
