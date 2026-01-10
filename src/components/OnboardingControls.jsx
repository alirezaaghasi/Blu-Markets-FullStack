import React, { useState } from 'react'
import questionnaire from '../data/questionnaire.fa.json'
import { STAGES, POST_ACTIONS } from '../stateMachine.js'

export default function OnboardingControls({ state, dispatch, onReset }) {
  const stage = state.user.stage;
  const [consentText, setConsentText] = useState('');

  if (stage === STAGES.PHONE_REQUIRED) return <PhoneForm state={state} dispatch={dispatch} />;

  if (stage === STAGES.QUESTIONNAIRE) {
    const idx = state.questionnaire.index;
    const q = questionnaire.questions[idx];
    if (!q) return null;

    return (
      <div>
        <div className="muted" style={{ marginBottom: 10 }}>
          Questionnaire ({idx + 1}/{questionnaire.questions.length})
        </div>

        <div className="q-card">
          <div className="q-title">{q.text}</div>
          <div className="q-options">
            {q.options.map((opt) => (
              <button
                key={opt.id}
                className="opt"
                onClick={() => dispatch({ type: 'ANSWER_QUESTION', qId: q.id, optionId: opt.id })}
              >
                {opt.text}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (stage === STAGES.ALLOCATION_PROPOSED) {
    return (
      <div>
        <div className="muted" style={{ marginBottom: 10 }}>
          Target allocation proposed
        </div>

        <div className="card" style={{ padding: 12 }}>
          <div className="muted" style={{ marginBottom: 6 }}>Paste this exact sentence to confirm:</div>
          <div className="code">{questionnaire.consent_exact}</div>

          <div style={{ marginTop: 10 }}>
            <input
              className="input"
              type="text"
              placeholder="Paste the exact sentence"
              value={consentText}
              onChange={(e) => setConsentText(e.target.value)}
            />
            <div className="row" style={{ marginTop: 10 }}>
              <button className="btn primary" onClick={() => dispatch({ type: 'SUBMIT_CONSENT', text: consentText })}>
                Confirm
              </button>
            </div>
            <div className="muted" style={{ marginTop: 8 }}>
              (Prototype constraint) Consent must match exactly.
            </div>
          </div>
        </div>
      </div>
    );
  }


  if (stage === STAGES.AMOUNT_REQUIRED) {
    return (
      <div>
        <div className="muted" style={{ marginBottom: 10 }}>
          Investment amount (IRR)
        </div>
        <div className="row">
          <input
            className="input"
            type="number"
            placeholder="Amount in IRR"
            value={state.user.investAmountIRR ?? ''}
            onChange={(e) => dispatch({ type: 'SET_INVEST_AMOUNT', investAmountIRR: e.target.value })}
          />
          <button className="btn primary" onClick={() => dispatch({ type: 'EXECUTE_PORTFOLIO' })}>
            Execute
          </button>
        </div>
      </div>
    );
  }

  if (stage === STAGES.EXECUTED) {
    return (
      <div>
        {state.postAction === POST_ACTIONS.NONE && (
          <div className="chips">
            <button className="chip primary" onClick={() => dispatch({ type: 'START_ADD_FUNDS' })}>Add funds</button>
            <button className="chip" onClick={() => dispatch({ type: 'START_REBALANCE' })}>Rebalance</button>
            <button className="chip" onClick={() => dispatch({ type: 'START_PROTECT' })}>Protect</button>
            <button className="chip" onClick={() => dispatch({ type: 'START_BORROW' })}>Borrow</button>
            <button className="chip ghost" onClick={onReset}>Reset state</button>
          </div>
        )}

        {/* Add funds */}
        {state.postAction === POST_ACTIONS.ADD_FUNDS && (
          <ActionCard title="Add funds (to cash)">
            <div className="muted" style={{ marginBottom: 8 }}>Top-up amount (IRR)</div>
            <input
              className="input"
              type="number"
              placeholder="Amount in IRR"
              value={state.pendingAmountIRR ?? ''}
              onChange={(e) => dispatch({ type: 'SET_PENDING_AMOUNT', amountIRR: e.target.value })}
            />
            <div className="row" style={{ marginTop: 10 }}>
              <button className="btn primary" onClick={() => dispatch({ type: 'PREVIEW_ADD_FUNDS' })} disabled={!state.pendingAmountIRR}>Preview</button>
              <button className="btn" onClick={() => dispatch({ type: 'CANCEL_POST_ACTION' })}>Cancel</button>
            </div>
          </ActionCard>
        )}

        {state.postAction === POST_ACTIONS.ADD_FUNDS_PREVIEW && (
          <PreviewPanel
            title="Preview: Add funds"
            preview={state.preview}
            softWarning={state.softWarning}
            onConfirm={() => dispatch({ type: 'CONFIRM_ADD_FUNDS_FINAL' })}
            onBack={() => dispatch({ type: 'CANCEL_POST_ACTION' })}
          />
        )}

        {/* Trade */}
        {state.postAction === POST_ACTIONS.TRADE && (
          <ActionCard title={`Trade: ${state.tradeDraft?.assetId || ''}`}>
            <div className="row" style={{ gap: 8 }}>
              <select
                className="input"
                value={state.tradeDraft?.side || 'BUY'}
                onChange={(e) => dispatch({ type: 'SET_TRADE_SIDE', side: e.target.value })}
              >
                <option value="BUY">Buy</option>
                <option value="SELL">Sell</option>
              </select>
              <input
                className="input"
                type="number"
                placeholder="Amount in IRR"
                value={state.tradeDraft?.amountIRR ?? ''}
                onChange={(e) => dispatch({ type: 'SET_TRADE_AMOUNT', amountIRR: e.target.value })}
              />
            </div>

            <div className="row" style={{ marginTop: 10 }}>
              <button className="btn primary" onClick={() => dispatch({ type: 'PREVIEW_TRADE' })} disabled={!state.tradeDraft?.amountIRR}>Preview</button>
              <button className="btn" onClick={() => dispatch({ type: 'CANCEL_POST_ACTION' })}>Cancel</button>
            </div>
          </ActionCard>
        )}

        {state.postAction === POST_ACTIONS.TRADE_PREVIEW && (
          <PreviewPanel
            title="Preview: Trade"
            preview={state.preview}
            softWarning={state.softWarning}
            onConfirm={() => dispatch({ type: 'CONFIRM_TRADE_FINAL' })}
            onBack={() => dispatch({ type: 'CANCEL_POST_ACTION' })}
          />
        )}

        {/* Rebalance */}
        {state.postAction === POST_ACTIONS.REBALANCE && (
          <ActionCard title="Rebalance">
            <div className="muted">
              Rebalance restores your portfolio to your target allocation and invests available cash.
            </div>
            <div className="row" style={{ marginTop: 10 }}>
              <button className="btn primary" onClick={() => dispatch({ type: 'PREVIEW_REBALANCE' })}>Preview</button>
              <button className="btn" onClick={() => dispatch({ type: 'CANCEL_POST_ACTION' })}>Cancel</button>
            </div>
          </ActionCard>
        )}

        {state.postAction === POST_ACTIONS.REBALANCE_PREVIEW && (
          <PreviewPanel
            title="Preview: Rebalance"
            preview={state.preview}
            softWarning={state.softWarning}
            onConfirm={() => dispatch({ type: 'CONFIRM_REBALANCE_FINAL' })}
            onBack={() => dispatch({ type: 'CANCEL_POST_ACTION' })}
          />
        )}

        {/* Protect */}
        {state.postAction === POST_ACTIONS.PROTECT && (
          <ActionCard title="Protect (Insurance)">
            <div className="row" style={{ gap: 8 }}>
              <select
                className="input"
                value={state.protectDraft?.assetId || ''}
                onChange={(e) => dispatch({ type: 'SET_PROTECT_ASSET', assetId: e.target.value })}
              >
                {(state.portfolio?.holdings || []).map((h) => (
                  <option key={h.asset} value={h.asset}>{h.asset}</option>
                ))}
              </select>
              <input
                className="input"
                type="number"
                min="1"
                max="6"
                value={state.protectDraft?.months ?? 3}
                onChange={(e) => dispatch({ type: 'SET_PROTECT_MONTHS', months: e.target.value })}
              />
            </div>
            <div className="muted" style={{ marginTop: 6 }}>Months (1–6). Premium will be paid from cash.</div>
            <div className="row" style={{ marginTop: 10 }}>
              <button className="btn primary" onClick={() => dispatch({ type: 'PREVIEW_PROTECT' })}>Preview</button>
              <button className="btn" onClick={() => dispatch({ type: 'CANCEL_POST_ACTION' })}>Cancel</button>
            </div>
          </ActionCard>
        )}

        {state.postAction === POST_ACTIONS.PROTECT_PREVIEW && (
          <PreviewPanel
            title="Preview: Protect"
            preview={state.preview}
            softWarning={state.softWarning}
            onConfirm={() => dispatch({ type: 'CONFIRM_PROTECT_FINAL' })}
            onBack={() => dispatch({ type: 'CANCEL_POST_ACTION' })}
          />
        )}

        {/* Borrow */}
        {state.postAction === POST_ACTIONS.BORROW && (
          <ActionCard title="Borrow (Collateralized)">
            <div className="row" style={{ gap: 8 }}>
              <select
                className="input"
                value={state.borrowDraft?.assetId || ''}
                onChange={(e) => dispatch({ type: 'SET_BORROW_ASSET', assetId: e.target.value })}
              >
                {(state.portfolio?.holdings || []).map((h) => (
                  <option key={h.asset} value={h.asset}>{h.asset}</option>
                ))}
              </select>
              <select
                className="input"
                value={state.borrowDraft?.ltv ?? 0.5}
                onChange={(e) => dispatch({ type: 'SET_BORROW_LTV', ltv: e.target.value })}
              >
                <option value={0.4}>40% LTV</option>
                <option value={0.5}>50% LTV</option>
                <option value={0.6}>60% LTV</option>
              </select>
            </div>

            <input
              className="input"
              style={{ marginTop: 8 }}
              type="number"
              placeholder="Loan amount (IRR)"
              value={state.borrowDraft?.amountIRR ?? ''}
              onChange={(e) => dispatch({ type: 'SET_BORROW_AMOUNT', amountIRR: e.target.value })}
            />

            <div className="row" style={{ marginTop: 10 }}>
              <button className="btn primary" onClick={() => dispatch({ type: 'PREVIEW_BORROW' })} disabled={!state.borrowDraft?.amountIRR}>Preview</button>
              <button className="btn" onClick={() => dispatch({ type: 'CANCEL_POST_ACTION' })}>Cancel</button>
            </div>
          </ActionCard>
        )}

        {state.postAction === POST_ACTIONS.BORROW_PREVIEW && (
          <PreviewPanel
            title="Preview: Borrow"
            preview={state.preview}
            softWarning={state.softWarning}
            onConfirm={() => dispatch({ type: 'CONFIRM_BORROW_FINAL' })}
            onBack={() => dispatch({ type: 'CANCEL_POST_ACTION' })}
          />
        )}
      </div>
    );
  }

  return null;
}

function PhoneForm({ state, dispatch }) {
  return (
    <div>
      <div className="muted" style={{ marginBottom: 10 }}>
        Sign in
      </div>
      <div className="row">
        <input
          className="input"
          type="tel"
          placeholder="+989XXXXXXXXX"
          value={state.user.phone}
          onChange={(e) => dispatch({ type: 'SET_PHONE', phone: e.target.value })}
        />
        <button className="btn primary" onClick={() => dispatch({ type: 'SUBMIT_PHONE' })}>Continue</button>
      </div>
    </div>
  );
}

function ActionCard({ title, children }) {
  return (
    <div className="card" style={{ padding: 12 }}>
      <div className="muted" style={{ marginBottom: 6 }}>{title}</div>
      {children}
    </div>
  );
}

function PreviewPanel({ title, preview, softWarning, onConfirm, onBack }) {
  if (!preview) return null;
  return (
    <div className="card" style={{ padding: 12 }}>
      <div className="muted" style={{ marginBottom: 6 }}>{title}</div>

      {softWarning && (
        <div className="warn">
          {softWarning}
        </div>
      )}

      <div className="preview">
        <div className="previewRow">
          <div className="muted">Before</div>
          <div className="muted">After</div>
        </div>

        <div className="previewRow">
          <div>Foundation {preview.before.layers.foundation}%</div>
          <div>Foundation {preview.after.layers.foundation}%</div>
        </div>
        <div className="previewRow">
          <div>Growth {preview.before.layers.growth}%</div>
          <div>Growth {preview.after.layers.growth}%</div>
        </div>
        <div className="previewRow">
          <div>Upside {preview.before.layers.upside}%</div>
          <div>Upside {preview.after.layers.upside}%</div>
        </div>

        <div className="previewRow" style={{ marginTop: 6 }}>
          <div className="muted">Total {preview.before.totalIRR.toLocaleString('en-US')} IRR</div>
          <div className="muted">Total {preview.after.totalIRR.toLocaleString('en-US')} IRR</div>
        </div>
      </div>

      <div className="row" style={{ marginTop: 10 }}>
        <button className="btn primary" onClick={onConfirm}>
          {softWarning ? 'Continue anyway' : 'Confirm'}
        </button>
        <button className="btn" onClick={onBack}>Back</button>
      </div>
    </div>
  );
}
