import React, { useState, useMemo, Dispatch, ReactNode } from 'react';
import { STAGES, LAYER_EXPLANATIONS, THRESHOLDS, COLLATERAL_LTV_BY_LAYER, ONBOARDING_STEPS } from '../../constants/index';
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
function OnboardingControls({ state, dispatch, prices, fxRate }: OnboardingControlsProps) {
  const [consentText, setConsentText] = useState('');
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [showingProfile, setShowingProfile] = useState(true); // v10: Show profile before consent
  const isConsentMatch = consentText === questionnaireV2.consent_exact;

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
            {q.options.map((opt) => (
              <button
                key={opt.id}
                className="opt"
                onClick={() => dispatch({ type: 'ANSWER_QUESTION', qId: q.id, optionId: opt.id })}
              >
                {opt.text}
                <div className="opt-english">{opt.english}</div>
              </button>
            ))}
          </div>
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
            result={state.profileResult as unknown as { score: number; profile: string; profile_fa: string; allocation: { FOUNDATION: number; GROWTH: number; UPSIDE: number }; capacity: number; willingness: number; limitingFactor: string; warnings: { severity: string; message: string }[] }}
            onContinue={() => setShowingProfile(false)}
          />
        </div>
      );
    }

    const renderRecommendationMessage = () => (
      <div className="recommendationMessage">
        <p>Based on your answers, here's your recommended allocation:</p>
        <div className="recommendationLayers">
          <div className="recommendationLayer">
            <span className="layerDot foundation"></span>
            <span>Foundation ({state.targetLayerPct.FOUNDATION}%) — Stable assets</span>
          </div>
          <div className="recommendationLayer">
            <span className="layerDot growth"></span>
            <span>Growth ({state.targetLayerPct.GROWTH}%) — Balanced growth</span>
          </div>
          <div className="recommendationLayer">
            <span className="layerDot upside"></span>
            <span>Upside ({state.targetLayerPct.UPSIDE}%) — Higher potential</span>
          </div>
        </div>
        <p>This balances protection with growth.</p>
      </div>
    );

    interface ConsentStep {
      id: string;
      message: string;
      button?: string;
      consentRequired?: boolean;
    }

    const CONSENT_STEPS: ConsentStep[] = [
      {
        id: 'risk',
        message: `With this allocation:\n\n📈 Good year: +15-25%\n📉 Bad quarter: -10-15%\n⏱️ Recovery: typically 3-6 months\n\nMarkets are uncertain. This is not a guarantee.`,
        button: 'I understand'
      },
      {
        id: 'control',
        message: `You're always in control:\n\n✓ Adjust allocation anytime\n✓ Protect assets against drops\n✓ Borrow without selling\n✓ Exit to cash whenever`,
        button: 'Continue'
      },
      {
        id: 'consent',
        message: `Ready to start? Type this to confirm:`,
        consentRequired: true
      }
    ];

    const currentStep = state.consentStep;
    const step = CONSENT_STEPS[currentStep];
    const isConsentStep = currentStep >= CONSENT_STEPS.length - 1;

    const renderStoredMessage = (msg: string, idx: number) => {
      if (msg === '__RECOMMENDATION__') {
        return (
          <div key={idx} className="chatMessage bot">
            <div className="messageContent">{renderRecommendationMessage()}</div>
          </div>
        );
      }
      return (
        <div key={idx} className="chatMessage bot">
          <div className="messageContent">{msg}</div>
        </div>
      );
    };

    return (
      <div>
        <OnboardingProgress currentStep={3} />
        <div className="consentFlow" style={{ marginTop: 16 }}>
          <div className="chatMessages">
          {state.consentMessages.map((msg: string, i: number) => renderStoredMessage(msg, i))}
          {step && !isConsentStep && (
            <div className="chatMessage bot">
              <div className="messageContent">
                {step.message}
              </div>
            </div>
          )}
        </div>
        <div className="chatInputArea">
          {!isConsentStep && step ? (
            <button
              className="btn primary"
              style={{ width: '100%' }}
              onClick={() => dispatch({ type: 'ADVANCE_CONSENT', message: step.message })}
            >
              {step.button}
            </button>
          ) : null}

          {isConsentStep && (
            <div className="consentInputSection">
              <div className="consentPrompt">Ready to start? Type this to confirm:</div>
              <div className="consentTextFarsi">{questionnaireV2.consent_exact}</div>
              <div className="consentTextEnglish">{questionnaireV2.consent_english}</div>

              <input
                type="text"
                className="consentInput"
                placeholder="Type the Farsi sentence above to confirm..."
                value={consentText}
                onChange={(e) => setConsentText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && isConsentMatch) dispatch({ type: 'SUBMIT_CONSENT', text: consentText }); }}
                dir="rtl"
              />

              <button
                className={`btn primary ${isConsentMatch ? '' : 'disabled'}`}
                onClick={() => dispatch({ type: 'SUBMIT_CONSENT', text: consentText })}
                disabled={!isConsentMatch}
                style={{ width: '100%' }}
              >
                Continue
              </button>
            </div>
          )}
        </div>
        </div>
      </div>
    );
  }

  if (state.stage === STAGES.AMOUNT_REQUIRED) {
    const amount = Number(state.investAmountIRR) || 0;
    const isValid = amount >= THRESHOLDS.MIN_AMOUNT_IRR;
    const presetAmounts = [10_000_000, 50_000_000, 100_000_000, 500_000_000];

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
        {/* Issue 20: Currency label above quick amounts */}
        <div className="quickAmountsLabel">Quick amounts (IRR):</div>
        <div className="quickAmounts">
          {presetAmounts.map(preset => (
            <button
              key={preset}
              className={`quickAmountBtn ${amount === preset ? 'selected' : ''}`}
              onClick={() => dispatch({ type: 'SET_INVEST_AMOUNT', amountIRR: preset })}
            >
              {formatPreset(preset)}
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
    return (
      <ActionCard title="💰 Borrow">
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
        <div className="borrowHint">Max: {formatIRR(borrowData.maxBorrow)}</div>
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
