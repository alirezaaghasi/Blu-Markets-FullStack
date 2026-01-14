import React, { useState, useMemo } from 'react';
import { STAGES, LAYER_EXPLANATIONS, THRESHOLDS, COLLATERAL_LTV_BY_LAYER, ONBOARDING_STEPS } from '../../constants/index.js';
import { formatIRR, getAssetDisplayName } from '../../helpers.js';
import { calcPremiumIRR } from '../../engine/pricing.js';
import { ASSET_LAYER } from '../../state/domain.js';
import PhoneForm from './PhoneForm.jsx';
import PendingActionModal from '../PendingActionModal.jsx';

/**
 * ActionCard - Simple card wrapper for action forms
 */
function ActionCard({ title, children }) {
  return (
    <div className="actionCard">
      <div className="actionTitle">{title}</div>
      {children}
    </div>
  );
}

/**
 * Issue 11: OnboardingProgress - Shows step progress during onboarding
 */
function OnboardingProgress({ currentStep }) {
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

/**
 * Issue 8: MoreMenu - Dropdown menu for secondary actions
 */
function MoreMenu({ isOpen, onToggle, onProtect, onBorrow }) {
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

/**
 * OnboardingControls - Left panel controls during onboarding and active stage
 * Handles questionnaire, consent flow, investment amount, and action forms
 */
function OnboardingControls({ state, dispatch, questionnaire }) {
  const [consentText, setConsentText] = useState('');
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const isConsentMatch = consentText === questionnaire.consent_exact;

  // Memoize protect draft calculations
  const protectData = useMemo(() => {
    if (!state.protectDraft) return null;
    const h = state.holdings.find(x => x.assetId === state.protectDraft.assetId);
    const premium = h ? calcPremiumIRR({ assetId: h.assetId, notionalIRR: h.valueIRR, months: state.protectDraft.months }) : 0;
    return { holding: h, premium };
  }, [state.protectDraft, state.holdings]);

  // Memoize borrow draft calculations
  const borrowData = useMemo(() => {
    if (!state.borrowDraft) return null;
    const h = state.holdings.find(x => x.assetId === state.borrowDraft.assetId);
    const layer = h ? ASSET_LAYER[h.assetId] : 'UPSIDE';
    const layerLtv = COLLATERAL_LTV_BY_LAYER[layer] || 0.3;
    const maxBorrow = h ? Math.floor(h.valueIRR * layerLtv) : 0;
    const layerInfo = LAYER_EXPLANATIONS[layer];
    return { holding: h, layer, layerLtv, maxBorrow, layerInfo };
  }, [state.borrowDraft, state.holdings]);

  // Memoize select options for protect/borrow
  const protectOptions = useMemo(() => {
    return state.holdings.filter(h => h.valueIRR > 0).map(h => {
      const layer = ASSET_LAYER[h.assetId];
      const info = LAYER_EXPLANATIONS[layer];
      return { assetId: h.assetId, label: `${info.icon} ${getAssetDisplayName(h.assetId)}` };
    });
  }, [state.holdings]);

  const borrowOptions = useMemo(() => {
    return state.holdings.filter(h => !h.frozen && h.valueIRR > 0).map(h => {
      const layer = ASSET_LAYER[h.assetId];
      const info = LAYER_EXPLANATIONS[layer];
      const ltv = COLLATERAL_LTV_BY_LAYER[layer] || 0.3;
      return { assetId: h.assetId, label: `${info.icon} ${getAssetDisplayName(h.assetId)} (${Math.round(ltv * 100)}% LTV)` };
    });
  }, [state.holdings]);

  // Issue 11: Determine current onboarding step
  const getOnboardingStep = () => {
    switch (state.stage) {
      case STAGES.WELCOME: return 1;
      case STAGES.ONBOARDING_PHONE: return 1;
      case STAGES.ONBOARDING_QUESTIONNAIRE: return 2;
      case STAGES.ONBOARDING_RESULT: return 3;
      case STAGES.AMOUNT_REQUIRED: return 4;
      default: return 0;
    }
  };

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
    if (idx >= questionnaire.questions.length) return null;
    const q = questionnaire.questions[idx];

    return (
      <div>
        <OnboardingProgress currentStep={2} />
        <div className="questionnaireHeader" style={{ marginTop: 16 }}>
          <span className="muted">{idx + 1}/{questionnaire.questions.length}</span>
        </div>
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

    const CONSENT_STEPS = [
      {
        id: 'recommendation',
        message: null,
        renderMessage: renderRecommendationMessage,
        button: 'Continue'
      },
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

    const renderStoredMessage = (msg, idx) => {
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
          {state.consentMessages.map((msg, i) => renderStoredMessage(msg, i))}
          {step && !isConsentStep && (
            <div className="chatMessage bot">
              <div className="messageContent">
                {step.renderMessage ? step.renderMessage() : step.message}
              </div>
            </div>
          )}
        </div>
        <div className="chatInputArea">
          {!isConsentStep && step ? (
            <button
              className="btn primary"
              style={{ width: '100%' }}
              onClick={() => dispatch({ type: 'ADVANCE_CONSENT', message: step.renderMessage ? '__RECOMMENDATION__' : step.message })}
            >
              {step.button}
            </button>
          ) : null}

          {isConsentStep && (
            <div className="consentInputSection">
              <div className="consentPrompt">Ready to start? Type this to confirm:</div>
              <div className="consentTextFarsi">{questionnaire.consent_exact}</div>
              <div className="consentTextEnglish">{questionnaire.consent_english}</div>

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

    const formatPreset = (val) => {
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
          onClick={() => dispatch({ type: 'EXECUTE_PORTFOLIO' })}
          disabled={!isValid}
        >
          {isValid ? 'Start Investing' : 'Enter amount to start'}
        </button>
      </div>
    );
  }

  // ACTIVE stage - show drafts or pendingAction
  if (state.pendingAction) {
    return <PendingActionModal pendingAction={state.pendingAction} dispatch={dispatch} />;
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
          <button className="btn primary" onClick={() => dispatch({ type: 'PREVIEW_TRADE' })} disabled={!state.tradeDraft.amountIRR}>Preview</button>
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
          <button className="btn primary" onClick={() => dispatch({ type: 'PREVIEW_PROTECT' })}>Preview</button>
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
          <button className="btn primary" onClick={() => dispatch({ type: 'PREVIEW_BORROW' })} disabled={!state.borrowDraft.amountIRR}>Preview</button>
          <button className="btn" onClick={() => dispatch({ type: 'CANCEL_PENDING' })}>Cancel</button>
        </div>
      </ActionCard>
    );
  }

  if (state.repayDraft) {
    const loan = (state.loans || []).find(l => l.id === state.repayDraft.loanId);
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
    return (
      <ActionCard title="Rebalance">
        <div className="muted">Reallocate assets to target. Cash will be deployed to underweight layers.</div>
        <div className="row" style={{ marginTop: 10 }}>
          <button className="btn primary" onClick={() => dispatch({ type: 'PREVIEW_REBALANCE' })}>Preview</button>
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
          <button className="btn" onClick={() => dispatch({ type: 'START_REBALANCE' })}>Rebalance</button>
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
