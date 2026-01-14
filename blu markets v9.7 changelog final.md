# Blu Markets v9.7 — UI Improvements Changelog

**Base Version:** v9.6  
**Date:** January 2026  
**Focus:** Onboarding polish, portfolio view refinements

---

## ⚠️ Lock-In Declaration

> **This changelog formalizes behavioral invariants.**  
> **Future changes must not violate these invariants.**

This document is not a feature list. It defines what Blu Markets *must not become*.

Any proposed change that contradicts these invariants requires explicit review against the User Agency Contract before implementation.

---

## Boundary Justification Rule

> Every boundary classification must be explainable in one sentence using a single portfolio delta.  
> If it cannot, the boundary is invalid.

**Valid boundary justifications:**

| Boundary | Justification (one observable delta) |
|----------|--------------------------------------|
| SAFE | Action does not increase layer deviation beyond target range |
| DRIFT | Action increases layer deviation by >5% from target |
| STRUCTURAL | Action causes layer to exceed hard limits (Foundation < 30% or Upside > 25%) |
| STRESS | Action occurs while stressMode is enabled, escalating any boundary by one level |

**Invalid justifications:**
- "This seems risky"
- "User might regret this"
- "This is unusual behavior"

Boundaries describe geometry, not judgment.

---

## No Hidden Intelligence Clause

> The system does not infer user intent beyond explicit actions.  
> It does not predict outcomes or optimize silently.

**This means:**
- No "smart" defaults based on user history
- No silent rebalancing or position adjustments
- No forecasts, predictions, or "likely outcome" language
- No behavioral nudges disguised as system requirements

The system is a calculator with friction, not an advisor with opinions.

---

## Summary of Changes

| # | Issue | Fix |
|---|-------|-----|
| 1 | Consent input field hidden | Make input always visible |
| 2 | Allocation bar icons too small | Replace bar with donut chart |
| 3 | Empty investment preview feels cold | Show placeholder preview |
| 4 | Disabled button state unclear | Change button text when disabled |
| 5 | No feedback on amount selection | Highlight selected quick button |
| 6 | Holdings action buttons crowded | Buy/Sell visible, Protect/Borrow in overflow menu |
| 7 | No visual hierarchy in holdings | Add left border colored by layer |
| 8 | Rebalance success message misleading | Show explicit constraint messaging |
| 9 | Ledger is backend-only | Make ledger first-class UI from Portfolio Home |

---

## Issue 1: Consent Input Field Always Visible

**Problem:** Input field for typing consent text is hidden. User must press Tab to discover it.

**Fix:** Render input field visibly below the Farsi consent text at all times.

### Code Changes

**In the consent/result stage rendering:**

```jsx
{/* Consent Input Section */}
<div className="consentInputSection">
  <div className="consentPrompt">Ready to start? Type this to confirm:</div>
  <div className="consentTextFarsi">متوجه ریسک این سبد دارایی شدم و باهاش موافق هستم.</div>
  <div className="consentTextEnglish">I understand the risk of this portfolio and I agree with it.</div>
  
  {/* Input must always be visible - not hidden or off-screen */}
  <input
    type="text"
    className="consentInput"
    placeholder="Type the Farsi sentence above to confirm..."
    value={consentInputValue}
    onChange={(e) => dispatch({ type: 'SET_CONSENT_TEXT', text: e.target.value })}
    dir="rtl"
  />
  
  <button
    className={`btn primary ${isConsentValid ? '' : 'disabled'}`}
    onClick={() => dispatch({ type: 'SUBMIT_CONSENT', text: consentInputValue })}
    disabled={!isConsentValid}
  >
    Continue
  </button>
</div>
```

### CSS

```css
.consentInputSection {
  background: var(--bg-tertiary);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 16px;
}

.consentPrompt {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
  margin-bottom: 12px;
}

.consentTextFarsi {
  font-size: 16px;
  font-weight: 500;
  color: var(--text-primary);
  text-align: right;
  direction: rtl;
  padding: 12px;
  background: var(--bg-primary);
  border-radius: 8px;
  margin-bottom: 4px;
}

.consentTextEnglish {
  font-size: 12px;
  color: var(--text-muted);
  font-style: italic;
  margin-bottom: 16px;
}

.consentInput {
  width: 100%;
  padding: 12px 14px;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text-primary);
  font-size: 14px;
  direction: rtl;
  text-align: right;
  margin-bottom: 16px;
}

.consentInput:focus {
  border-color: var(--accent);
  outline: none;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
}

.consentInput::placeholder {
  color: var(--text-muted);
  direction: ltr;
  text-align: left;
}
```

---

## Issue 2: Replace Allocation Bar with Donut Chart

**Problem:** Horizontal bar with tiny icons is hard to read.

**Fix:** Replace with donut chart. Center shows "Your Allocation". Legend below shows layer details.

### Code Changes

**Create DonutChart component:**

```jsx
function DonutChart({ layers, size = 160 }) {
  // layers = { FOUNDATION: 65, GROWTH: 30, UPSIDE: 5 }
  const total = layers.FOUNDATION + layers.GROWTH + layers.UPSIDE;
  if (total === 0) return null;

  const colors = {
    FOUNDATION: '#34d399', // Green
    GROWTH: '#60a5fa',     // Blue
    UPSIDE: '#fbbf24',     // Orange
  };

  // Calculate stroke-dasharray for each segment
  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  
  let currentOffset = 0;
  const segments = [];

  ['FOUNDATION', 'GROWTH', 'UPSIDE'].forEach((layer) => {
    const pct = layers[layer] / total;
    const length = pct * circumference;
    
    if (pct > 0) {
      segments.push({
        layer,
        color: colors[layer],
        dasharray: `${length} ${circumference - length}`,
        offset: -currentOffset + circumference * 0.25, // Start from top
      });
      currentOffset += length;
    }
  });

  return (
    <div className="donutChartContainer">
      <svg viewBox="0 0 120 120" width={size} height={size} className="donutChart">
        {/* Background circle */}
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke="var(--border)"
          strokeWidth="12"
        />
        
        {/* Segments */}
        {segments.map((seg) => (
          <circle
            key={seg.layer}
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            stroke={seg.color}
            strokeWidth="12"
            strokeDasharray={seg.dasharray}
            strokeDashoffset={seg.offset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dasharray 0.3s ease' }}
          />
        ))}
        
        {/* Center text */}
        <text x="60" y="56" textAnchor="middle" className="donutCenterLabel">
          Your
        </text>
        <text x="60" y="72" textAnchor="middle" className="donutCenterLabel">
          Allocation
        </text>
      </svg>
    </div>
  );
}
```

**Use in allocation preview (right panel):**

```jsx
{/* Replace the horizontal bar with donut chart */}
<div className="allocationPreviewCard">
  <DonutChart layers={targetLayers} size={140} />
  
  <div className="allocationLegend">
    {['FOUNDATION', 'GROWTH', 'UPSIDE'].map((layer) => {
      const info = LAYER_EXPLANATIONS[layer];
      const pct = targetLayers?.[layer] || 0;
      return (
        <div key={layer} className="legendRow">
          <div className="legendLeft">
            <span className={`layerDot ${layer.toLowerCase()}`}></span>
            <span className="legendName">{info.name}</span>
          </div>
          <span className="legendPct">{pct}%</span>
        </div>
      );
    })}
  </div>
  
  <div className="allocationAssets">
    {['FOUNDATION', 'GROWTH', 'UPSIDE'].map((layer) => {
      const info = LAYER_EXPLANATIONS[layer];
      return (
        <div key={layer} className="assetRow">
          <span className={`layerDot ${layer.toLowerCase()}`}></span>
          <span className="assetList">{info.assets.join(' · ')}</span>
        </div>
      );
    })}
  </div>
</div>
```

### CSS

```css
.donutChartContainer {
  display: flex;
  justify-content: center;
  margin-bottom: 20px;
}

.donutChart {
  transform: rotate(-90deg);
}

.donutCenterLabel {
  font-size: 10px;
  fill: var(--text-secondary);
  font-weight: 500;
  transform: rotate(90deg);
  transform-origin: 60px 60px;
}

.allocationLegend {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 16px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--border);
}

.legendRow {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.legendLeft {
  display: flex;
  align-items: center;
  gap: 8px;
}

.legendName {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
}

.legendPct {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.allocationAssets {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.assetRow {
  display: flex;
  align-items: center;
  gap: 8px;
}

.assetList {
  font-size: 12px;
  color: var(--text-muted);
}
```

---

## Issue 3: Placeholder Preview for Investment Amount

**Problem:** Empty preview panel shows only "Enter an amount to see your allocation" — feels cold.

**Fix:** Show a faded placeholder preview with "---" values so user understands what they'll see.

### Code Changes

**In the investment amount stage right panel:**

```jsx
function InvestmentPreview({ amount, targetLayers, isValid }) {
  const hasInput = amount > 0;

  if (!hasInput) {
    // Show placeholder preview
    return (
      <div className="investPreviewCard">
        <h3>INVESTMENT PREVIEW</h3>
        
        <div className="previewPlaceholder">
          <div className="placeholderTotal">
            <div className="placeholderValue">--- IRR</div>
            <div className="placeholderLabel">Your portfolio value</div>
          </div>
          
          <div className="placeholderBreakdown">
            {['FOUNDATION', 'GROWTH', 'UPSIDE'].map((layer) => {
              const info = LAYER_EXPLANATIONS[layer];
              return (
                <div key={layer} className="placeholderRow">
                  <div className="placeholderLeft">
                    <span className={`layerDot ${layer.toLowerCase()} faded`}></span>
                    <span className="placeholderName">{info.name}</span>
                  </div>
                  <span className="placeholderAmount">---</span>
                </div>
              );
            })}
          </div>
          
          <div className="placeholderHint">
            Select an amount to see your allocation
          </div>
        </div>
      </div>
    );
  }

  // Show actual preview when amount is entered
  return (
    <div className="investPreviewCard">
      <h3>INVESTMENT PREVIEW</h3>
      
      <div className="previewTotal">
        <div className="portfolioValue">{formatIRR(amount)}</div>
        {!isValid && (
          <div className="investWarning">Minimum: {formatIRR(THRESHOLDS.MIN_AMOUNT_IRR)}</div>
        )}
      </div>
      
      {isValid && (
        <div className="previewBreakdown">
          {['FOUNDATION', 'GROWTH', 'UPSIDE'].map((layer) => {
            const info = LAYER_EXPLANATIONS[layer];
            const pct = targetLayers?.[layer] || 0;
            const layerAmount = Math.floor(amount * pct / 100);
            return (
              <div key={layer} className="breakdownRow">
                <div className="breakdownLeft">
                  <span className={`layerDot ${layer.toLowerCase()}`}></span>
                  <span>{info.name}</span>
                </div>
                <span className="breakdownAmount">{formatIRR(layerAmount)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

### CSS

```css
.previewPlaceholder {
  opacity: 0.5;
}

.placeholderTotal {
  text-align: center;
  padding: 20px 0;
  border-bottom: 1px solid var(--border);
  margin-bottom: 16px;
}

.placeholderValue {
  font-size: 24px;
  font-weight: 600;
  color: var(--text-muted);
  letter-spacing: 2px;
}

.placeholderLabel {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 4px;
}

.placeholderBreakdown {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 20px;
}

.placeholderRow {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.placeholderLeft {
  display: flex;
  align-items: center;
  gap: 8px;
}

.placeholderName {
  font-size: 13px;
  color: var(--text-muted);
}

.placeholderAmount {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-muted);
  letter-spacing: 1px;
}

.layerDot.faded {
  opacity: 0.4;
}

.placeholderHint {
  text-align: center;
  font-size: 12px;
  color: var(--text-muted);
  padding: 12px;
  background: var(--bg-primary);
  border-radius: 8px;
}
```

---

## Issue 4: Dynamic Button Text Based on State

**Problem:** "Start Investing" button is grayed out but user doesn't know why.

**Fix:** Change button text when disabled to indicate what's needed.

### Code Changes

```jsx
{/* Investment amount CTA button */}
<button
  className={`btn primary ${isValid ? '' : 'disabled'}`}
  onClick={() => dispatch({ type: 'EXECUTE_PORTFOLIO' })}
  disabled={!isValid}
>
  {isValid ? 'Start Investing' : 'Enter amount to start'}
</button>
```

### CSS (no change needed — button already has disabled styling)

---

## Issue 5: Highlight Selected Amount Button

**Problem:** When user clicks a quick amount button (10M, 50M, 100M, 500M), no visual feedback.

**Fix:** Add selected state styling to quick buttons.

### Code Changes

```jsx
function QuickAmountButtons({ selectedAmount, onSelect }) {
  const amounts = [
    { value: 10_000_000, label: '10M' },
    { value: 50_000_000, label: '50M' },
    { value: 100_000_000, label: '100M' },
    { value: 500_000_000, label: '500M' },
  ];

  return (
    <div className="quickAmounts">
      {amounts.map(({ value, label }) => (
        <button
          key={value}
          className={`quickAmountBtn ${selectedAmount === value ? 'selected' : ''}`}
          onClick={() => onSelect(value)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
```

### CSS

```css
.quickAmounts {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.quickAmountBtn {
  padding: 8px 16px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--bg-primary);
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.quickAmountBtn:hover {
  border-color: var(--accent);
  color: var(--text-primary);
}

.quickAmountBtn.selected {
  background: var(--accent);
  border-color: var(--accent);
  color: white;
}
```

---

## Issue 6: Holdings — Buy/Sell Visible, Protect/Borrow in Overflow

**Problem:** 4 action buttons per holding row is too crowded.

**Fix:** Show Buy/Sell by default. Protect/Borrow in overflow menu (⋯).

### Code Changes

```jsx
function HoldingRow({ holding, onAction }) {
  const [showOverflow, setShowOverflow] = useState(false);
  const displayName = getAssetDisplayName(holding.assetId);
  const layerInfo = LAYER_EXPLANATIONS[ASSET_LAYER[holding.assetId]];

  return (
    <div className={`holdingRow layer-${ASSET_LAYER[holding.assetId].toLowerCase()}`}>
      <div className="holdingInfo">
        <div className="holdingName">{displayName}</div>
        <div className="holdingLayer">
          <span className={`layerDot ${ASSET_LAYER[holding.assetId].toLowerCase()}`}></span>
          {layerInfo.name}
        </div>
      </div>
      
      <div className="holdingValue">{formatIRR(holding.valueIRR)}</div>
      
      <div className="holdingActions">
        {/* Primary actions - always visible */}
        <button 
          className="btn small" 
          onClick={() => onAction('BUY', holding.assetId)}
        >
          Buy
        </button>
        <button 
          className="btn small" 
          onClick={() => onAction('SELL', holding.assetId)}
          disabled={holding.valueIRR === 0}
        >
          Sell
        </button>
        
        {/* Overflow menu */}
        <div className="overflowContainer">
          <button 
            className="btn small overflowTrigger" 
            onClick={() => setShowOverflow(!showOverflow)}
          >
            ⋯
          </button>
          
          {showOverflow && (
            <div className="overflowMenu">
              <button 
                className="overflowItem"
                onClick={() => { onAction('PROTECT', holding.assetId); setShowOverflow(false); }}
                disabled={holding.valueIRR === 0}
              >
                <span className="overflowIcon">☂️</span>
                Protect
              </button>
              <button 
                className="overflowItem"
                onClick={() => { onAction('BORROW', holding.assetId); setShowOverflow(false); }}
                disabled={holding.valueIRR === 0 || holding.frozen}
              >
                <span className="overflowIcon">💰</span>
                Borrow
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

### CSS

```css
.holdingActions {
  display: flex;
  gap: 6px;
  align-items: center;
}

.overflowContainer {
  position: relative;
}

.overflowTrigger {
  padding: 6px 10px;
  font-size: 14px;
  letter-spacing: 1px;
}

.overflowMenu {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 4px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: var(--shadow-md);
  min-width: 140px;
  z-index: 100;
  overflow: hidden;
}

.overflowItem {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 10px 14px;
  border: none;
  background: none;
  color: var(--text-primary);
  font-size: 13px;
  cursor: pointer;
  text-align: left;
}

.overflowItem:hover {
  background: var(--bg-tertiary);
}

.overflowItem:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.overflowIcon {
  font-size: 14px;
}

/* Close overflow when clicking outside */
.overflowMenu::before {
  content: '';
  position: fixed;
  inset: 0;
  z-index: -1;
}
```

---

## Issue 7: Holdings Left Border by Layer Color

**Problem:** All holding rows look the same — no visual grouping by layer.

**Fix:** Add colored left border to each holding row based on its layer.

### Code Changes

The `HoldingRow` component already has the class applied:

```jsx
<div className={`holdingRow layer-${ASSET_LAYER[holding.assetId].toLowerCase()}`}>
```

### CSS

```css
.holdingRow {
  display: flex;
  align-items: center;
  padding: 14px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 10px;
  margin-bottom: 8px;
  border-left-width: 3px;
  border-left-style: solid;
}

/* Layer-specific left border colors */
.holdingRow.layer-foundation {
  border-left-color: #34d399; /* Green */
}

.holdingRow.layer-growth {
  border-left-color: #60a5fa; /* Blue */
}

.holdingRow.layer-upside {
  border-left-color: #fbbf24; /* Orange */
}
```

---

## Issue 8: Rebalance Constraint Messaging

**Problem:** When rebalance cannot fully reach target allocation (due to locked collateral, insufficient cash, etc.), users may think rebalance succeeded completely.

**Per User Agency Contract:** System must explicitly show "Target not fully reachable with current constraints" — never imply full success when constrained.

**Rebalance Semantics (Binding):**

> Rebalance applies the chosen allocation to current holdings **to the extent mechanically possible**, **subject to current constraints**, and **may result in residual drift**.

This language must appear in:
- UI copy when rebalance is constrained
- Confirmation modal
- Ledger entry description

**Fix:** Add rebalance-specific friction copy that explains why target wasn't reached.

### Code Changes

**Update `src/engine/boundary.js`:**

```js
import { computePortfolioStatus } from "./portfolioStatus.js";

export function classifyActionBoundary({ kind, validation, before, after, stressMode }) {
  if (!validation.ok) return "SAFE";

  const beforeStatus = computePortfolioStatus(before.layerPct);
  const afterStatus = computePortfolioStatus(after.layerPct);

  const escalate = (b) => {
    if (!stressMode) return b;
    if (b === "SAFE") return "DRIFT";
    if (b === "DRIFT") return "STRUCTURAL";
    if (b === "STRUCTURAL") return "STRESS";
    return "STRESS";
  };

  // Rebalance can be "STRUCTURAL" if it fails to improve (e.g. constraints).
  if (kind === "REBALANCE") {
    const improved = afterStatus.issues.length < beforeStatus.issues.length;
    return escalate(improved ? "SAFE" : "STRUCTURAL");
  }

  if (kind === "ADD_FUNDS") return escalate("SAFE");

  if (kind === "REPAY") {
    if (afterStatus.status === "ATTENTION_REQUIRED") return escalate("STRUCTURAL");
    if (afterStatus.status === "SLIGHTLY_OFF") return escalate("DRIFT");
    return escalate("SAFE");
  }

  if (afterStatus.status === "ATTENTION_REQUIRED") return escalate("STRUCTURAL");
  if (afterStatus.status === "SLIGHTLY_OFF") return escalate("DRIFT");
  return escalate("SAFE");
}

/**
 * Returns friction copy based on boundary and action context.
 * Rebalance gets special messaging when constrained.
 */
export function frictionCopyForBoundary(boundary, kind = null, meta = {}) {
  // Rebalance-specific messaging when constrained
  if (kind === "REBALANCE" && boundary === "STRUCTURAL") {
    const messages = ["Target allocation not fully reachable with current constraints."];
    
    if (meta.hasLockedCollateral) {
      messages.push("Some assets are locked as loan collateral and cannot be sold.");
    }
    if (meta.insufficientCash) {
      messages.push("Insufficient cash to fully rebalance into underweight layers.");
    }
    if (meta.residualDrift) {
      messages.push(`Residual drift remains: ${meta.residualDrift.toFixed(1)}% from target.`);
    }
    
    return messages;
  }

  // Default friction copy
  if (boundary === "SAFE") return [];
  if (boundary === "DRIFT") return ["This moves you away from your target allocation. You can proceed or rebalance later."];
  if (boundary === "STRUCTURAL") return ["This crosses a structural boundary. You can proceed, but you must acknowledge it."];
  return ["Stress mode: you're making a high-pressure decision. Confirm only if you understand the consequences."];
}
```

**Update `src/engine/preview.js` to compute constraint metadata:**

```js
/**
 * Deterministic rebalance for prototype.
 * Returns { nextState, meta } where meta contains constraint info.
 */
export function previewRebalance(state, { mode }) {
  const next = cloneState(state);
  const snap = computeSnapshot(next);
  const holdingsTotal = snap.holdingsIRR || 1;

  // Track constraints for messaging
  const meta = {
    hasLockedCollateral: state.holdings.some(h => h.frozen && h.valueIRR > 0),
    insufficientCash: false,
    residualDrift: 0,
  };

  // ... existing rebalance logic ...

  // After rebalance, compute residual drift
  const afterSnap = computeSnapshot(next);
  const driftFromTarget = ['FOUNDATION', 'GROWTH', 'UPSIDE'].reduce((sum, layer) => {
    const target = state.targetLayerPct[layer];
    const actual = afterSnap.layerPct[layer];
    return sum + Math.abs(target - actual);
  }, 0);
  
  meta.residualDrift = driftFromTarget;
  meta.insufficientCash = mode === "HOLDINGS_PLUS_CASH" && next.cashIRR < state.cashIRR * 0.1;

  // Return both state and meta
  next._rebalanceMeta = meta;
  return next;
}
```

**Update reducer to pass meta to frictionCopy:**

```js
// In buildPending function, extract meta for rebalance
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

  // Extract rebalance meta if present
  const meta = afterState._rebalanceMeta || {};

  return {
    kind,
    payload,
    before,
    after,
    validation,
    boundary,
    frictionCopy: frictionCopyForBoundary(boundary, kind, meta),
  };
}
```

### UI Changes

**In the pending action confirmation modal, show constraint messages clearly:**

```jsx
{pendingAction.kind === 'REBALANCE' && pendingAction.boundary === 'STRUCTURAL' && (
  <div className="rebalanceConstraintWarning">
    <div className="warningIcon">⚠️</div>
    <div className="warningMessages">
      {pendingAction.frictionCopy.map((msg, i) => (
        <div key={i} className="warningMessage">{msg}</div>
      ))}
    </div>
  </div>
)}
```

### CSS

```css
.rebalanceConstraintWarning {
  display: flex;
  gap: 12px;
  padding: 14px;
  background: rgba(251, 191, 36, 0.1);
  border: 1px solid rgba(251, 191, 36, 0.3);
  border-radius: 10px;
  margin-bottom: 16px;
}

.warningIcon {
  font-size: 20px;
  flex-shrink: 0;
}

.warningMessages {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.warningMessage {
  font-size: 13px;
  color: var(--text-primary);
  line-height: 1.4;
}

.warningMessage:first-child {
  font-weight: 500;
}
```

---

## Issue 9: Ledger as First-Class UI

**Problem:** Ledger is treated as a backend artifact, not a user-facing feature. Per User Agency Contract, the "agency loop" is incomplete without visible, accessible action history.

**Per User Agency Contract:**
- Every committed action produces a user-visible ledger entry
- Ledger entries are immutable
- Ledger is accessible from Portfolio Home

**Fix:** Make History tab a first-class destination with clear, informative entries.

### Ledger Entry Requirements

Every ledger entry must show:

| Field | Description |
|-------|-------------|
| Timestamp | When the action was committed |
| Action Type | ADD_FUNDS, TRADE, PROTECT, BORROW, REPAY, REBALANCE |
| Boundary | SAFE, DRIFT, STRUCTURAL, or STRESS at time of commit |
| Key Details | Amount, asset, direction (buy/sell), constraints if any |
| Portfolio Impact | Before/after snapshot summary (optional expand) |

### Code Changes

**Update HistoryPane to show richer ledger entries:**

```jsx
function HistoryPane({ ledger }) {
  const [expanded, setExpanded] = useState({});
  
  if (!ledger || ledger.length === 0) {
    return (
      <div className="card">
        <h3>Action History</h3>
        <div className="emptyLedger">
          <div className="emptyIcon">📋</div>
          <div className="emptyText">No actions yet</div>
          <div className="emptySubtext">Your decisions will be recorded here</div>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <h3>Action History</h3>
      <div className="ledgerIntro">
        Every action you take is recorded immutably.
      </div>
      <div className="ledgerList">
        {[...ledger].reverse().map((entry) => (
          <LedgerEntry 
            key={entry.id} 
            entry={entry} 
            expanded={expanded[entry.id]}
            onToggle={() => setExpanded(prev => ({ ...prev, [entry.id]: !prev[entry.id] }))}
          />
        ))}
      </div>
    </div>
  );
}

function LedgerEntry({ entry, expanded, onToggle }) {
  const type = entry.type.replace('_COMMIT', '');
  const payload = entry.details?.payload;
  const boundary = entry.details?.boundary;
  const before = entry.details?.before;
  const after = entry.details?.after;

  const getActionSummary = () => {
    switch (type) {
      case 'PORTFOLIO_CREATED':
        return `Started portfolio with ${formatIRR(entry.details?.amountIRR)}`;
      case 'ADD_FUNDS':
        return `Added ${formatIRR(payload?.amountIRR)}`;
      case 'TRADE':
        return `${payload?.side === 'BUY' ? 'Bought' : 'Sold'} ${formatIRR(payload?.amountIRR)} of ${getAssetDisplayName(payload?.assetId)}`;
      case 'REBALANCE':
        return `Rebalanced portfolio (${payload?.mode === 'HOLDINGS_PLUS_CASH' ? 'including cash' : 'holdings only'})`;
      case 'PROTECT':
        return `Protected ${getAssetDisplayName(payload?.assetId)} for ${payload?.months} months`;
      case 'BORROW':
        return `Borrowed ${formatIRR(payload?.amountIRR)} against ${getAssetDisplayName(payload?.assetId)}`;
      case 'REPAY':
        return `Repaid ${formatIRR(payload?.amountIRR)}`;
      default:
        return type;
    }
  };

  return (
    <div className={`ledgerEntry ${boundary?.toLowerCase() || ''}`}>
      <div className="ledgerHeader" onClick={onToggle}>
        <div className="ledgerMain">
          <span className="ledgerAction">{getActionSummary()}</span>
          {boundary && (
            <span className={`boundaryPill ${boundary.toLowerCase()}`}>
              {BOUNDARY_LABELS[boundary]}
            </span>
          )}
        </div>
        <div className="ledgerMeta">
          <span className="ledgerTime">{formatTimestamp(new Date(entry.tsISO).getTime())}</span>
          <span className="ledgerExpand">{expanded ? '−' : '+'}</span>
        </div>
      </div>
      
      {expanded && (
        <div className="ledgerDetails">
          {before && after && (
            <div className="ledgerImpact">
              <div className="impactRow">
                <span className="impactLabel">Portfolio Before</span>
                <span className="impactValue">{formatIRR(before.totalIRR)}</span>
              </div>
              <div className="impactRow">
                <span className="impactLabel">Portfolio After</span>
                <span className="impactValue">{formatIRR(after.totalIRR)}</span>
              </div>
              {type === 'REBALANCE' && entry.details?.frictionCopy?.length > 0 && (
                <div className="impactConstraints">
                  {entry.details.frictionCopy.map((msg, i) => (
                    <div key={i} className="constraintNote">{msg}</div>
                  ))}
                </div>
              )}
            </div>
          )}
          <div className="ledgerId">ID: {entry.id}</div>
        </div>
      )}
    </div>
  );
}
```

### CSS

```css
.ledgerIntro {
  font-size: 12px;
  color: var(--text-muted);
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border);
}

.emptyLedger {
  text-align: center;
  padding: 40px 20px;
}

.emptyIcon {
  font-size: 32px;
  margin-bottom: 12px;
  opacity: 0.5;
}

.emptyText {
  font-size: 14px;
  color: var(--text-secondary);
  margin-bottom: 4px;
}

.emptySubtext {
  font-size: 12px;
  color: var(--text-muted);
}

.ledgerEntry {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 10px;
  margin-bottom: 8px;
  overflow: hidden;
}

.ledgerEntry.structural {
  border-left: 3px solid #f59e0b;
}

.ledgerEntry.stress {
  border-left: 3px solid #ef4444;
}

.ledgerHeader {
  padding: 14px;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}

.ledgerHeader:hover {
  background: var(--bg-tertiary);
}

.ledgerMain {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.ledgerAction {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
}

.boundaryPill {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.boundaryPill.safe {
  background: rgba(52, 211, 153, 0.15);
  color: #34d399;
}

.boundaryPill.drift {
  background: rgba(96, 165, 250, 0.15);
  color: #60a5fa;
}

.boundaryPill.structural {
  background: rgba(251, 191, 36, 0.15);
  color: #fbbf24;
}

.boundaryPill.stress {
  background: rgba(248, 113, 113, 0.15);
  color: #f87171;
}

.ledgerMeta {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

.ledgerTime {
  font-size: 12px;
  color: var(--text-muted);
}

.ledgerExpand {
  font-size: 16px;
  color: var(--text-muted);
  width: 20px;
  text-align: center;
}

.ledgerDetails {
  padding: 0 14px 14px;
  border-top: 1px solid var(--border);
  margin-top: 0;
}

.ledgerImpact {
  padding: 12px;
  background: var(--bg-primary);
  border-radius: 8px;
  margin-top: 12px;
}

.impactRow {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  padding: 4px 0;
}

.impactLabel {
  color: var(--text-secondary);
}

.impactValue {
  font-weight: 500;
  color: var(--text-primary);
}

.impactConstraints {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid var(--border);
}

.constraintNote {
  font-size: 12px;
  color: var(--warning);
  padding: 2px 0;
}

.ledgerId {
  font-size: 10px;
  color: var(--text-muted);
  margin-top: 12px;
  font-family: monospace;
}
```

---

## Implementation Checklist

- [ ] **Issue 1:** Make consent input field always visible
- [ ] **Issue 2:** Replace allocation bar with donut chart
- [ ] **Issue 3:** Add placeholder preview for investment amount
- [ ] **Issue 4:** Change button text based on disabled state
- [ ] **Issue 5:** Add selected state to quick amount buttons
- [ ] **Issue 6:** Move Protect/Borrow to overflow menu on holdings
- [ ] **Issue 7:** Add left border color by layer to holdings
- [ ] **Issue 8:** Add rebalance constraint messaging
- [ ] **Issue 9:** Make ledger first-class UI with rich entries

---

## Testing Checklist

- [ ] Consent flow: input field visible without pressing Tab
- [ ] Consent flow: can type Farsi text and submit
- [ ] Allocation preview: donut chart renders correctly with 3 segments
- [ ] Allocation preview: center text shows "Your Allocation"
- [ ] Investment preview: placeholder shows when no amount entered
- [ ] Investment preview: updates live when amount selected/entered
- [ ] Quick amount buttons: selected button has accent styling
- [ ] Quick amount buttons: clicking another deselects previous
- [ ] CTA button: shows "Enter amount to start" when disabled
- [ ] CTA button: shows "Start Investing" when valid amount entered
- [ ] Holdings: Buy/Sell buttons visible
- [ ] Holdings: ⋯ button opens overflow with Protect/Borrow
- [ ] Holdings: overflow closes when clicking outside
- [ ] Holdings: left border shows correct layer color
- [ ] Holdings: Foundation = green, Growth = blue, Upside = orange
- [ ] Rebalance: Shows "Target not fully reachable" when constrained
- [ ] Rebalance: Mentions locked collateral if applicable
- [ ] Rebalance: Shows residual drift percentage
- [ ] Rebalance: Warning styled distinctly (yellow/orange background)
- [ ] Ledger: History tab shows all committed actions
- [ ] Ledger: Each entry shows action summary, boundary, timestamp
- [ ] Ledger: Entries are expandable to show before/after impact
- [ ] Ledger: Empty state shows "No actions yet" message
- [ ] Ledger: STRUCTURAL/STRESS entries have colored left border
- [ ] Ledger: Constraint notes visible in expanded rebalance entries
