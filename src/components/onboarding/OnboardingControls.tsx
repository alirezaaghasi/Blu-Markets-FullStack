import React, { useState, useMemo, Dispatch, ReactNode } from 'react';
import { STAGES, LAYER_EXPLANATIONS, THRESHOLDS, COLLATERAL_LTV_BY_LAYER, ONBOARDING_STEPS, MAX_TOTAL_LOAN_PCT } from '../../constants/index';
import { formatIRR, getAssetDisplayName, getHoldingValueIRR } from '../../helpers';
import { calcPremiumIRR } from '../../engine/pricing';
import { ASSET_LAYER } from '../../state/domain';
import PhoneForm from './PhoneForm';
import PendingActionModal from '../PendingActionModal';
import ProfileResult from '../ProfileResult';
import questionnaireV2 from '../../data/questionnaire.v2.fa.json';
import type { AppState, AppAction } from '../../types';

interface ActionCardProps {
  title: string;
  children: ReactNode;
}

/**
 * ActionCard - Simple card wrapper for action forms
 */
function ActionCard({ title, children }: ActionCardProps) {
  return (
    <div className="actionCard">
      <div className="actionTitle">{title}</div>
      {children}
    </div>
  );
}

interface OnboardingProgressProps {
  currentStep: number;
}

/**
 * Issue 11: OnboardingProgress - Shows step progress during onboarding
 */
function OnboardingProgress({ currentStep }: OnboardingProgressProps) {
  return (
    <div className="onboardingProgress">
      <div className="progressSteps">
        {ONBOARDING_STEPS.map((step, idx) => {
          const stepNum = idx + 1;
          let status = 'upcoming';
          if (stepNum < currentStep) status = 'completed';
          if (stepNum === currentStep) status = 'current';

          return (
            <div key={step.id} className={`progressStep ${status}`}>
              <div className="stepNumber">{stepNum}</div>
              <div className="stepLabel">{step.label}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface MoreMenuProps {
  isOpen: boolean;
  onToggle: () => void;
  onProtect: () => void;
  onBorrow: () => void;
}

/**
 * Issue 8: MoreMenu - Dropdown menu for secondary actions
 */
function MoreMenu({ isOpen, onToggle, onProtect, onBorrow }: MoreMenuProps) {
  if (!isOpen) {
    return (
      <button className="btn" onClick={onToggle}>
        More ▼
      </button>
    );
  }

  return (
    <div className="moreMenuContainer">
      <button className="btn" onClick={onToggle}>
        More ▲
      </button>
      <div className="moreMenuDropdown">
        <button className="moreMenuItem" onClick={() => { onProtect(); onToggle(); }}>
          ☂️ Protect Asset
        </button>
        <button className="moreMenuItem" onClick={() => { onBorrow(); onToggle(); }}>
          💰 Borrow Funds
        </button>
      </div>
    </div>
  );
}

interface QuestionnaireProgressProps {
  currentQuestion: number;
  totalQuestions: number;
}

/**
 * v10: QuestionnaireProgress - Shows progress with block title
 */
function QuestionnaireProgress({ currentQuestion, totalQuestions }: QuestionnaireProgressProps) {
  const progress = ((currentQuestion + 1) / totalQuestions) * 100;

  // Get current block title based on question index
  const getCurrentBlockTitle = () => {
    let count = 0;
    for (const block of questionnaireV2.blocks) {
      count += block.questions.length;
      if (currentQuestion < count) {
        return block.title;
      }
    }
    return '';
  };

  return (
    <div className="questionnaire-progress">
      <div className="block-title">{getCurrentBlockTitle()}</div>
      <div className="progress-bar-container">
        <div
          className="progress-bar-fill"
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="progress-label">
        <span>Question {currentQuestion + 1} of {totalQuestions}</span>
        <span>{Math.round(progress)}%</span>
      </div>
    </div>
  );
}

interface OnboardingControlsProps {
  state: AppState;
  dispatch: Dispatch<AppAction>;
  prices: Record<string, number>;
  fxRate: number;
}

/**
 * OnboardingControls - Left panel controls during onboarding and active stage
 * Handles questionnaire, consent flow, investment amount, and action forms
 * v10: Updated for new 12-question questionnaire with ProfileResult screen
 */
// Task 5: Calculate personalized quick amounts based on questionnaire answers
function calculateSuggestedAmounts(answers: Record<string, string | number>): { amounts: number[]; recommendedIndex: number } {
  // Map question indices to answer values (coerce to number, fallback to default)
  // q_buffer (index 1): 0=12+mo, 1=6-12mo, 2=3-6mo, 3=<3mo
  // q_income (index 0): 0=fixed, 1=mostly, 2=variable, 3=uncertain
  // q_past_behavior (index 7): 0=panic, 1=worried, 2=calm, 3=no experience

  const toNumber = (val: string | number | undefined, defaultVal: number): number =>
    typeof val === 'number' ? val : defaultVal;

  const buffer = toNumber(answers['q_buffer'], 2);  // Default: 3-6 months
  const income = toNumber(answers['q_income'], 1);  // Default: mostly stable
  const experience = toNumber(answers['q_past_behavior'], 3); // Default: no experience

  // Determine tier based on signals
  const lowCapacity = buffer >= 3 || income >= 3 || experience === 0;
  const highCapacity = buffer <= 1 && income <= 1 && experience >= 2;

  let tier: 'conservative' | 'moderate' | 'aggressive';
  if (lowCapacity) {
    tier = 'conservative';
  } else if (highCapacity) {
    tier = 'aggressive';
  } else {
    tier = 'moderate';
  }

  // Amount tiers (in IRR)
  const amountTiers = {
    conservative: [10_000_000, 25_000_000, 50_000_000, 100_000_000],
    moderate: [50_000_000, 100_000_000, 250_000_000, 500_000_000],
    aggressive: [100_000_000, 250_000_000, 500_000_000, 1_000_000_000],
  };

  return {
    amounts: amountTiers[tier],
    recommendedIndex: 1, // Second option is recommended
  };
}

function OnboardingControls({ state, dispatch, prices, fxRate }: OnboardingControlsProps) {
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [showingProfile, setShowingProfile] = useState(true); // v10: Show profile before consent

  // Task 2: Check if all consent checkboxes are checked
  const allConsentsChecked = state.consentCheckboxes.riskAcknowledged &&
    state.consentCheckboxes.lossAcknowledged &&
    state.consentCheckboxes.noGuaranteeAcknowledged;

  // Optimization: Memoized holdingsById map for O(1) lookups instead of O(n) find()
  const holdingsById = useMemo(() => {
    const map = new Map();
    for (const h of state.holdings) {
      map.set(h.assetId, h);
    }
    return map;
  }, [state.holdings]);

  // Optimization: Pre-filter holdings lists once
  const { activeHoldings, borrowableHoldings } = useMemo(() => {
    const active = [];
    const borrowable = [];
    for (const h of state.holdings) {
      if (h.quantity > 0) {
        active.push(h);
        if (!h.frozen) borrowable.push(h);
      }
    }
    return { activeHoldings: active, borrowableHoldings: borrowable };
  }, [state.holdings]);

  // Memoize protect draft calculations using holdingsById for O(1) lookup
  const protectData = useMemo(() => {
    if (!state.protectDraft) return null;
    const h = holdingsById.get(state.protectDraft.assetId);
    const notionalIRR = getHoldingValueIRR(h, prices, fxRate);
    const premium = h ? calcPremiumIRR({ assetId: h.assetId, notionalIRR, months: state.protectDraft.months }) : 0;
    return { holding: h, notionalIRR, premium };
  }, [state.protectDraft, holdingsById, prices, fxRate]);

  // Memoize borrow draft calculations using holdingsById for O(1) lookup
  const borrowData = useMemo(() => {
    if (!state.borrowDraft) return null;
    const h = holdingsById.get(state.borrowDraft.assetId);
    const layer = h ? ASSET_LAYER[h.assetId] : 'UPSIDE';
    const layerLtv = COLLATERAL_LTV_BY_LAYER[layer] || 0.3;
    const holdingValueIRR = getHoldingValueIRR(h, prices, fxRate);
    const maxBorrow = h ? Math.floor(holdingValueIRR * layerLtv) : 0;
    const layerInfo = LAYER_EXPLANATIONS[layer];
    return { holding: h, layer, layerLtv, maxBorrow, layerInfo, holdingValueIRR };
  }, [state.borrowDraft, holdingsById, prices, fxRate]);

  // Calculate global loan capacity (25% of total portfolio)
  const loanCapacity = useMemo(() => {
    // Calculate total portfolio value
    const totalHoldingsIRR = state.holdings.reduce((sum, h) => {
      return sum + getHoldingValueIRR(h, prices, fxRate);
    }, 0);
    const totalPortfolioIRR = (state.cashIRR || 0) + totalHoldingsIRR;

    // Calculate existing loans total
    const existingLoansIRR = (state.loans || []).reduce((sum, loan) => sum + loan.amountIRR, 0);

    // Calculate capacity
    const maxTotalLoans = Math.floor(totalPortfolioIRR * MAX_TOTAL_LOAN_PCT);
    const remainingCapacity = Math.max(0, maxTotalLoans - existingLoansIRR);
    const usedPct = maxTotalLoans > 0 ? (existingLoansIRR / maxTotalLoans * 100) : 0;

    return {
      totalPortfolioIRR,
      maxTotalLoans,
      existingLoansIRR,
      remainingCapacity,
      usedPct
    };
  }, [state.holdings, state.cashIRR, state.loans, prices, fxRate]);

  // Memoize select options using pre-filtered lists
  const protectOptions = useMemo(() => {
    return activeHoldings.map(h => {
      const layer = ASSET_LAYER[h.assetId];
      const info = LAYER_EXPLANATIONS[layer];
      return { assetId: h.assetId, label: `${info.icon} ${getAssetDisplayName(h.assetId)}` };
    });
  }, [activeHoldings]);

  const borrowOptions = useMemo(() => {
    return borrowableHoldings.map(h => {
      const layer = ASSET_LAYER[h.assetId];
      const info = LAYER_EXPLANATIONS[layer];
      const ltv = COLLATERAL_LTV_BY_LAYER[layer] || 0.3;
      return { assetId: h.assetId, label: `${info.icon} ${getAssetDisplayName(h.assetId)} (${Math.round(ltv * 100)}% LTV)` };
    });
  }, [borrowableHoldings]);

  if (state.stage === STAGES.WELCOME) {
    return (
      <div>
        <OnboardingProgress currentStep={1} />
        <div className="muted" style={{ textAlign: 'center', padding: 8, marginTop: 16 }}>
          Begin your mindful journey
        </div>
      </div>
    );
  }

  if (state.stage === STAGES.ONBOARDING_PHONE) {
    return (
      <div>
        <OnboardingProgress currentStep={1} />
        <PhoneForm state={state} dispatch={dispatch} />
      </div>
    );
  }

  if (state.stage === STAGES.ONBOARDING_QUESTIONNAIRE) {
    const idx = state.questionnaire.index;
    // v10: Use v2 questionnaire
    const q = questionnaireV2.questions[idx];
    if (!q) return null;

    // Task 4: Check if there's a previous answer for highlighting
    const previousAnswer = state.questionnaire.answers[q.id];

    return (
      <div>
        <OnboardingProgress currentStep={2} />
        {/* v10: New progress indicator with block title */}
        <QuestionnaireProgress
          currentQuestion={idx}
          totalQuestions={questionnaireV2.questions.length}
        />
        <div className="q-card">
          <div className="q-title">{q.text}</div>
          <div className="q-english">{q.english}</div>
          <div className="q-options">
            {q.options.map((opt, optIdx) => (
              <button
                key={opt.id}
                className={`opt ${previousAnswer === optIdx ? 'selected' : ''}`}
                onClick={() => dispatch({ type: 'ANSWER_QUESTION', qId: q.id, optionId: opt.id })}
              >
                {opt.text}
                <div className="opt-english">{opt.english}</div>
              </button>
            ))}
          </div>
          {/* Task 4: Back button - only show on questions 2+ */}
          {idx > 0 && (
            <button
              className="backBtn"
              onClick={() => dispatch({ type: 'GO_BACK_QUESTION' })}
            >
              ← Back
            </button>
          )}
        </div>
      </div>
    );
  }

  if (state.stage === STAGES.ONBOARDING_RESULT) {
    // v10: Show ProfileResult first, then consent flow
    if (showingProfile && state.profileResult) {
      return (
        <div>
          <OnboardingProgress currentStep={3} />
          <ProfileResult
            result={state.profileResult as unknown as { score: number; profile: string; profile_fa: string; allocation: { FOUNDATION: number; GROWTH: number; UPSIDE: number }; capacity: number; willingness: number; limitingFactor: 'capacity' | 'willingness'; warnings: { severity: 'high' | 'medium' | 'low'; message: string }[] }}
            onContinue={() => setShowingProfile(false)}
          />
        </div>
      );
    }

    // Task 2: Checkbox consent data
    const consentItems = [
      {
        id: 'risk' as const,
        persian: 'این سبد دارایی ریسک دارد',
        english: 'This portfolio carries risk',
        checked: state.consentCheckboxes.riskAcknowledged,
      },
      {
        id: 'loss' as const,
        persian: 'ممکن است بخشی از سرمایه‌ام را از دست بدهم',
        english: 'I may lose some of my investment',
        checked: state.consentCheckboxes.lossAcknowledged,
      },
      {
        id: 'noGuarantee' as const,
        persian: 'این تضمین سود نیست',
        english: 'This is not a guarantee of returns',
        checked: state.consentCheckboxes.noGuaranteeAcknowledged,
      },
    ];

    return (
      <div>
        <OnboardingProgress currentStep={3} />
        <div className="consentFlow" style={{ marginTop: 16 }}>
          {/* Task 2: Checkbox consent */}
          <div className="consentHeader">
            <h3>Before you start, confirm you understand:</h3>
          </div>

          <div className="consentCheckboxes">
            {consentItems.map((item) => (
              <label key={item.id} className="consentCheckboxRow">
                <input
                  type="checkbox"
                  checked={item.checked}
                  onChange={() => dispatch({ type: 'TOGGLE_CONSENT_CHECKBOX', checkbox: item.id })}
                />
                <div className="consentCheckboxText">
                  <div className="consentPersian" dir="rtl">{item.persian}</div>
                  <div className="consentEnglish">{item.english}</div>
                </div>
              </label>
            ))}
          </div>

          <button
            className={`btn primary consentSubmitBtn ${allConsentsChecked ? '' : 'disabled'}`}
            onClick={() => dispatch({ type: 'SUBMIT_CHECKBOX_CONSENT' })}
            disabled={!allConsentsChecked}
          >
            I Understand
          </button>
        </div>
      </div>
    );
  }

  if (state.stage === STAGES.AMOUNT_REQUIRED) {
    const amount = Number(state.investAmountIRR) || 0;
    const isValid = amount >= THRESHOLDS.MIN_AMOUNT_IRR;

    // Task 5: Personalized quick amounts based on questionnaire
    const { amounts: suggestedAmounts, recommendedIndex } = calculateSuggestedAmounts(state.questionnaire.answers);

    const formatPreset = (val: number) => {
      if (val >= 1_000_000_000) return `${val / 1_000_000_000}B`;
      if (val >= 1_000_000) return `${val / 1_000_000}M`;
      return val.toLocaleString();
    };

    return (
      <div>
        <OnboardingProgress currentStep={4} />
        <div className="investHeader" style={{ marginTop: 16 }}>
          <h3>Let's bring your portfolio to life.</h3>
          <p className="muted">How much would you like to start with?</p>
        </div>
        {/* Task 5: Personalized quick amounts */}
        <div className="quickAmountsLabel">Suggested for you (IRR):</div>
        <div className="quickAmounts">
          {suggestedAmounts.map((preset, idx) => (
            <button
              key={preset}
              className={`quickAmountBtn ${amount === preset ? 'selected' : ''} ${idx === recommendedIndex ? 'recommended' : ''}`}
              onClick={() => dispatch({ type: 'SET_INVEST_AMOUNT', amountIRR: preset })}
            >
              {formatPreset(preset)}
              {idx === recommendedIndex && <span className="recommendedStar">★</span>}
            </button>
          ))}
        </div>
        <div className="customAmount">
          <input
            className="input"
            type="text"
            placeholder="Or enter custom amount"
            value={amount ? amount.toLocaleString() : ''}
            onChange={(e) => {
              const val = parseInt(e.target.value.replace(/,/g, ''), 10);
              if (!isNaN(val)) dispatch({ type: 'SET_INVEST_AMOUNT', amountIRR: val });
              else if (e.target.value === '') dispatch({ type: 'SET_INVEST_AMOUNT', amountIRR: null });
            }}
          />
        </div>
        {/* Issue 12: Show minimum amount upfront */}
        <div className="investMinimum">Minimum: {formatIRR(THRESHOLDS.MIN_AMOUNT_IRR)}</div>
        <p className="investReassurance">You can add more anytime. No lock-in.</p>
        <button
          className={`btn primary ${isValid ? '' : 'disabled'}`}
          style={{ width: '100%' }}
          onClick={() => dispatch({ type: 'EXECUTE_PORTFOLIO', prices, fxRate })}
          disabled={!isValid}
        >
          {isValid ? 'Start Investing' : 'Enter amount to start'}
        </button>
      </div>
    );
  }

  // Task 1: Portfolio Created stage - show in left panel
  if (state.stage === STAGES.PORTFOLIO_CREATED) {
    return (
      <div>
        <OnboardingProgress currentStep={4} />
        <div className="portfolioCreatedLeft">
          <div className="createdMessage">
            Your portfolio has been created successfully. Review the summary on the right.
          </div>
        </div>
      </div>
    );
  }

  // ACTIVE stage - show drafts or pendingAction
  if (state.pendingAction) {
    return <PendingActionModal pendingAction={state.pendingAction} targetLayerPct={state.targetLayerPct} dispatch={dispatch} />;
  }

  // Draft forms
  if (state.addFundsDraft) {
    return (
      <ActionCard title="Add Funds">
        <input
          className="input"
          type="number"
          placeholder="Amount (IRR)"
          value={state.addFundsDraft.amountIRR || ''}
          onChange={(e) => dispatch({ type: 'SET_ADD_FUNDS_AMOUNT', amountIRR: e.target.value })}
        />
        <div className="row" style={{ marginTop: 10 }}>
          <button className="btn primary" onClick={() => dispatch({ type: 'PREVIEW_ADD_FUNDS' })} disabled={!state.addFundsDraft.amountIRR}>Preview</button>
          <button className="btn" onClick={() => dispatch({ type: 'CANCEL_PENDING' })}>Cancel</button>
        </div>
      </ActionCard>
    );
  }

  if (state.tradeDraft) {
    return (
      <ActionCard title={`${state.tradeDraft.side === 'BUY' ? 'Buy' : 'Sell'} ${getAssetDisplayName(state.tradeDraft.assetId)}`}>
        <div className="row" style={{ gap: 8 }}>
          <button className={`chip ${state.tradeDraft.side === 'BUY' ? 'primary' : ''}`} onClick={() => dispatch({ type: 'SET_TRADE_SIDE', side: 'BUY' })}>Buy</button>
          <button className={`chip ${state.tradeDraft.side === 'SELL' ? 'primary' : ''}`} onClick={() => dispatch({ type: 'SET_TRADE_SIDE', side: 'SELL' })}>Sell</button>
        </div>
        <input
          className="input"
          style={{ marginTop: 8 }}
          type="number"
          placeholder="Amount (IRR)"
          value={state.tradeDraft.amountIRR ?? ''}
          onChange={(e) => dispatch({ type: 'SET_TRADE_AMOUNT', amountIRR: e.target.value })}
        />
        <div className="row" style={{ marginTop: 10 }}>
          <button className="btn primary" onClick={() => dispatch({ type: 'PREVIEW_TRADE', prices, fxRate })} disabled={!state.tradeDraft.amountIRR}>Preview</button>
          <button className="btn" onClick={() => dispatch({ type: 'CANCEL_PENDING' })}>Cancel</button>
        </div>
      </ActionCard>
    );
  }

  if (state.protectDraft && protectData) {
    return (
      <ActionCard title="☂️ Protect Asset">
        <div className="row" style={{ gap: 8 }}>
          <select
            className="input"
            value={state.protectDraft.assetId || ''}
            onChange={(e) => dispatch({ type: 'SET_PROTECT_ASSET', assetId: e.target.value })}
          >
            {protectOptions.map((opt) => (
              <option key={opt.assetId} value={opt.assetId}>{opt.label}</option>
            ))}
          </select>
          <select
            className="input"
            value={state.protectDraft.months ?? 3}
            onChange={(e) => dispatch({ type: 'SET_PROTECT_MONTHS', months: Number(e.target.value) })}
            style={{ width: 100 }}
          >
            {[1, 2, 3, 4, 5, 6].map((m) => <option key={m} value={m}>{m} mo</option>)}
          </select>
        </div>
        <div className="premiumHint">Premium: {formatIRR(protectData.premium)}</div>
        <div className="row" style={{ marginTop: 10 }}>
          <button className="btn primary" onClick={() => dispatch({ type: 'PREVIEW_PROTECT', prices, fxRate })}>Preview</button>
          <button className="btn" onClick={() => dispatch({ type: 'CANCEL_PENDING' })}>Cancel</button>
        </div>
      </ActionCard>
    );
  }

  if (state.borrowDraft && borrowData) {
    // Effective max is the minimum of asset LTV limit and remaining global capacity
    const effectiveMax = Math.min(borrowData.maxBorrow, loanCapacity.remainingCapacity);

    return (
      <ActionCard title="💰 Borrow">
        {/* Global Loan Capacity Display */}
        <div className="loanCapacitySection">
          <div className="loanCapacityHeader">
            <span className="loanCapacityLabel">Portfolio Loan Capacity</span>
            <span className="loanCapacityValue">
              {formatIRR(loanCapacity.existingLoansIRR)} / {formatIRR(loanCapacity.maxTotalLoans)}
            </span>
          </div>
          <div className="loanCapacityBarContainer">
            <div
              className={`loanCapacityBar ${loanCapacity.usedPct >= 80 ? 'warning' : loanCapacity.usedPct >= 60 ? 'caution' : ''}`}
              style={{ width: `${Math.min(100, loanCapacity.usedPct)}%` }}
            />
          </div>
          <div className="loanCapacityHint">
            {loanCapacity.remainingCapacity > 0
              ? `${formatIRR(loanCapacity.remainingCapacity)} available (25% of portfolio)`
              : 'Portfolio loan limit reached'}
          </div>
        </div>

        <select
          className="input"
          value={state.borrowDraft.assetId || ''}
          onChange={(e) => dispatch({ type: 'SET_BORROW_ASSET', assetId: e.target.value })}
        >
          {borrowOptions.map((opt) => (
            <option key={opt.assetId} value={opt.assetId}>{opt.label}</option>
          ))}
        </select>
        <div className="borrowLtvInfo" style={{ marginTop: 8, padding: '8px 12px', background: 'var(--bg-tertiary)', borderRadius: 8, fontSize: 12 }}>
          <span style={{ color: 'var(--text-secondary)' }}>{borrowData.layerInfo?.icon} {borrowData.layerInfo?.name} assets: </span>
          <span style={{ fontWeight: 600 }}>{Math.round(borrowData.layerLtv * 100)}% max LTV</span>
        </div>
        <input
          className="input"
          style={{ marginTop: 8 }}
          type="number"
          placeholder="Loan amount (IRR)"
          value={state.borrowDraft.amountIRR ?? ''}
          onChange={(e) => dispatch({ type: 'SET_BORROW_AMOUNT', amountIRR: e.target.value })}
        />
        <div className="borrowHint">
          Max: {formatIRR(effectiveMax)}
          {effectiveMax < borrowData.maxBorrow && (
            <span className="borrowHintNote"> (limited by portfolio cap)</span>
          )}
        </div>
        <div className="row" style={{ marginTop: 10 }}>
          <button className="btn primary" onClick={() => dispatch({ type: 'PREVIEW_BORROW', prices, fxRate })} disabled={!state.borrowDraft.amountIRR}>Preview</button>
          <button className="btn" onClick={() => dispatch({ type: 'CANCEL_PENDING' })}>Cancel</button>
        </div>
      </ActionCard>
    );
  }

  if (state.repayDraft) {
    const loan = (state.loans || []).find((l: { id: string }) => l.id === state.repayDraft?.loanId);
    const loanAmount = loan?.amountIRR || state.repayDraft.amountIRR || 0;

    return (
      <ActionCard title="Repay Loan">
        <div className="repayDetails">
          <div className="repayRow"><span>Loan:</span><span>{formatIRR(loanAmount)}</span></div>
          {loan && <div className="repayRow"><span>Collateral:</span><span>{getAssetDisplayName(loan.collateralAssetId)}</span></div>}
          <div className="repayRow"><span>Cash:</span><span>{formatIRR(state.cashIRR || 0)}</span></div>
        </div>
        <div className="row" style={{ marginTop: 10 }}>
          <button className="btn primary" onClick={() => dispatch({ type: 'PREVIEW_REPAY' })} disabled={(state.cashIRR || 0) < loanAmount}>Preview</button>
          <button className="btn" onClick={() => dispatch({ type: 'CANCEL_PENDING' })}>Cancel</button>
        </div>
      </ActionCard>
    );
  }

  if (state.rebalanceDraft) {
    const gap = state.rebalanceDraft.gapAnalysis;
    const showCashOption = gap && gap.hasFrozenAssets && gap.remainingGapPct > 0 && gap.currentCash > 0;
    const showAddFundsSuggestion = gap && gap.hasFrozenAssets && gap.remainingGapPct > 0 && !gap.cashSufficient && gap.cashShortfall > 0;

    return (
      <ActionCard title="Rebalance">
        <div className="muted">Reallocate assets to match your target allocation.</div>

        {/* Show constraint warning if locked assets prevent full rebalance */}
        {gap && gap.hasFrozenAssets && gap.remainingGapPct > 0 && (
          <div className="rebalanceGapWarning">
            <div className="gapWarningIcon">🔒</div>
            <div className="gapWarningText">
              Locked collateral limits this rebalance. Best achievable: {gap.remainingGapPct}% from target.
            </div>
          </div>
        )}

        {/* Cash option checkbox */}
        {showCashOption && (
          <div className="rebalanceCashOption">
            <label className="cashOptionLabel">
              <input
                type="checkbox"
                checked={state.rebalanceDraft.useCash || false}
                onChange={(e) => dispatch({ type: 'SET_REBALANCE_USE_CASH', useCash: e.target.checked })}
              />
              <span className="cashOptionText">
                {gap.cashSufficient
                  ? `Use ${formatIRR(gap.cashNeededForPerfectBalance)} cash for perfect balance`
                  : `Use ${formatIRR(gap.currentCash)} cash to get closer`
                }
              </span>
            </label>
          </div>
        )}

        {/* Add funds suggestion - only show AFTER user opts to use cash */}
        {showAddFundsSuggestion && state.rebalanceDraft.useCash && (
          <div className="rebalanceAddFundsSuggestion">
            <div className="suggestionIcon">💡</div>
            <div className="suggestionText">
              {gap.cashWouldHelp && gap.partialCashBenefit > 0
                ? `Using cash reduces gap by ${gap.partialCashBenefit}%. Still ${formatIRR(gap.cashShortfall)} short of perfect balance.`
                : `Still ${formatIRR(gap.cashShortfall)} short of perfect balance.`
              }
            </div>
            <div className="suggestionTip">
              Tip: Repay loans to unfreeze collateral for more flexibility.
            </div>
            <button
              className="btn small"
              onClick={() => dispatch({ type: 'START_ADD_FUNDS' })}
            >
              Add Funds
            </button>
          </div>
        )}

        <div className="row" style={{ marginTop: 10 }}>
          <button className="btn primary" onClick={() => dispatch({ type: 'PREVIEW_REBALANCE', prices, fxRate })}>Preview</button>
          <button className="btn" onClick={() => dispatch({ type: 'CANCEL_PENDING' })}>Cancel</button>
        </div>
      </ActionCard>
    );
  }

  // Issue 8: Main action buttons - Two primary + menu
  return (
    <div>
      <div className="footerActions">
        <div className="footerRowPrimary">
          <button className="btn primary" onClick={() => dispatch({ type: 'START_ADD_FUNDS' })}>Add Funds</button>
          <button className="btn" onClick={() => dispatch({ type: 'START_REBALANCE', prices, fxRate })}>Rebalance</button>
          <MoreMenu
            isOpen={moreMenuOpen}
            onToggle={() => setMoreMenuOpen(!moreMenuOpen)}
            onProtect={() => dispatch({ type: 'START_PROTECT' })}
            onBorrow={() => dispatch({ type: 'START_BORROW' })}
          />
        </div>
      </div>
    </div>
  );
}

export default React.memo(OnboardingControls);
