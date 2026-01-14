and comit
# Blu Markets v9.10 → v9.11 — UX Improvements Implementation
## Claude Code Specification (Decisions 7-20)

---

## Overview

This spec implements 14 UX improvements decided collaboratively. These are separate from the color palette fixes (Decisions 1-6) documented in the previous spec.

| Decision | Summary |
|----------|---------|
| 7 | Before/After allocation → Text labels |
| 8 | Holdings → Default expanded |
| 9 | Empty holdings → Keep showing 0 IRR |
| 10 | "Iranian Bonds" → "Fixed Income Fund (IRR)" |
| 11 | Loan card → Show liquidation price |
| 12 | "DRIFT" badge → Plain language warning |
| 13 | "SAFE" badge → Plain language confirmation |
| 14 | Rebalance trades → Show +/- with Buying/Selling |
| 15 | Activity log → Verb-first plain language |
| 16 | Bottom action bar → Primary buttons + secondary links |
| 17 | Stress test → Move to separate card |
| 18 | Protection tab → Add educational content |
| 19 | Donut chart → Match blue opacity system |
| 20 | Dangerous actions → Add confirmation modal |

**Estimated Total Time:** 4-5 hours

---

## Files to Modify

```
src/
├── components/
│   ├── PortfolioHome.jsx        # Decisions 8, 16, 17
│   ├── HoldingRow.jsx           # Decision 10
│   ├── ExecutionSummary.jsx     # Decisions 7, 12, 13, 14
│   ├── ActionLogPane.jsx        # Decision 15
│   ├── Loans.jsx                # Decision 11
│   ├── Protection.jsx           # Decision 18
│   ├── DonutChart.jsx           # Decision 19
│   ├── ResetConfirmModal.jsx    # Decision 20 (expand)
│   ├── StressTestCard.jsx       # Decision 17 (new file)
│   └── PendingActionModal.jsx   # Decisions 12, 13
├── constants/index.js           # Decision 10
├── helpers.js                   # Decision 10
└── styles/app.css               # All styling updates
```

---

## Decision 7: Before/After Allocation Text Labels

### Current
```jsx
// Uses emojis: 🏠36% 📊55% 🚀9%
<span>🏠{f}% 📊{g}% 🚀{u}%</span>
```

### Updated

**File: `/src/components/ExecutionSummary.jsx`**

```jsx
// Helper function for allocation display
function formatAllocation(foundation, growth, upside) {
  return `Foundation ${foundation}% · Growth ${growth}% · Upside ${upside}%`;
}

// In render
<div className="allocationComparison">
  <div className="allocationRow">
    <span className="allocationLabel">Before:</span>
    <span className="allocationValue">
      {formatAllocation(
        Math.round(before.foundation),
        Math.round(before.growth),
        Math.round(before.upside)
      )}
    </span>
  </div>
  <div className="allocationRow">
    <span className="allocationLabel">After:</span>
    <span className="allocationValue">
      {formatAllocation(
        Math.round(after.foundation),
        Math.round(after.growth),
        Math.round(after.upside)
      )}
    </span>
  </div>
</div>
```

**File: `/src/styles/app.css`**

```css
/* Decision 7: Allocation comparison text */
.allocationComparison {
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 14px;
}

.allocationRow {
  display: flex;
  gap: 12px;
}

.allocationLabel {
  color: var(--color-text-muted);
  min-width: 50px;
}

.allocationValue {
  color: var(--color-text-secondary);
}
```

**Also update in:** `HistoryPane.jsx` where Before/After is shown in history items.

---

## Decision 8: Holdings Default Expanded

### Current
```jsx
// In PortfolioHome.jsx
const [expandedLayers, setExpandedLayers] = useState({});
// All layers start collapsed (empty object = all false)
```

### Updated

**File: `/src/components/PortfolioHome.jsx`**

```jsx
// Decision 8: Default all layers to expanded
const [expandedLayers, setExpandedLayers] = useState({
  FOUNDATION: true,
  GROWTH: true,
  UPSIDE: true,
});
```

That's it — one line change.

---

## Decision 9: Keep Showing 0 IRR

**No code change required.** Current behavior is correct. This decision confirms we keep it as-is.

---

## Decision 10: Rename "Iranian Bonds" → "Fixed Income Fund (IRR)"

### Files to Update

**File: `/src/constants/index.js`**

```js
// Update LAYER_EXPLANATIONS
export const LAYER_EXPLANATIONS = {
  FOUNDATION: {
    name: 'Foundation',
    nameFa: 'پایه',
    icon: '🛡️',
    assets: ['USDT', 'Fixed Income Fund'],  // Changed from 'Fixed Income'
    tagline: 'Your safety net',
    description: 'Stable assets that protect you during market drops',
    descriptionFa: 'دارایی‌های پایدار. پشتوانه‌ی امنت.',
  },
  // ... rest unchanged
};
```

**File: `/src/helpers.js`**

Find the `getAssetDisplayName` function and update:

```js
export function getAssetDisplayName(assetId) {
  const names = {
    BTC: 'Bitcoin',
    ETH: 'Ethereum',
    SOL: 'Solana',
    TON: 'Toncoin',
    USDT: 'USDT',
    GOLD: 'Gold',
    QQQ: 'QQQ',
    IRR_FIXED_INCOME: 'Fixed Income Fund (IRR)',  // Changed from 'Iranian Bonds' or 'Fixed Income (IRR)'
  };
  return names[assetId] || assetId;
}
```

**Search and replace** any other occurrences:
```bash
grep -r "Iranian Bonds\|Fixed Income (IRR)" src/
```

---

## Decision 11: Loan Card Shows Liquidation Price

### Current
```jsx
// Shows: Collateral, LTV %, Liquidation value in IRR
```

### Updated

**File: `/src/components/Loans.jsx`**

```jsx
import { formatUSD, formatIRR } from '../helpers.js';

function LoanCard({ loan, collateralAsset, currentPriceUSD, onRepay }) {
  // Calculate liquidation price
  // Liquidation happens when: collateralValue <= loanAmount / maxLTV
  // So liquidation price = (loanAmount / maxLTV) / quantity
  // Simplified: liquidationPriceUSD = loan.liquidationIRR / fxRate / collateralQuantity
  
  const liquidationPriceUSD = useMemo(() => {
    if (!loan || !collateralAsset) return null;
    // loan.liquidationIRR is the collateral value at which liquidation occurs
    // We need to convert back to USD price
    const fxRate = snapshot?.fxRate || 1456000;
    const quantity = collateralAsset.quantity;
    if (quantity <= 0) return null;
    return loan.liquidationIRR / fxRate / quantity;
  }, [loan, collateralAsset, snapshot]);

  return (
    <div className="loanCard">
      <div className="loanHeader">ACTIVE LOAN</div>
      
      <div className="loanDetails">
        <div className="loanRow">
          <span className="loanLabel">Borrowed:</span>
          <span className="loanValue">{formatIRR(loan.amountIRR)}</span>
        </div>
        
        <div className="loanRow">
          <span className="loanLabel">Collateral:</span>
          <span className="loanValue">{getAssetDisplayName(loan.collateralAssetId)}</span>
        </div>
        
        {/* Decision 11: Liquidation price with explanation */}
        <div className="loanLiquidation">
          <div className="loanRow">
            <span className="loanLabel">Liquidation price:</span>
            <span className="loanValue liquidationPrice">
              {liquidationPriceUSD ? formatUSD(liquidationPriceUSD) : '—'}
            </span>
          </div>
          <p className="loanLiquidationExplain">
            If {getAssetDisplayName(loan.collateralAssetId)} drops below this price, your collateral will be sold.
          </p>
        </div>
      </div>
      
      <button className="btn primary full" onClick={() => onRepay(loan)}>
        Repay Loan
      </button>
    </div>
  );
}
```

**File: `/src/styles/app.css`**

```css
/* Decision 11: Loan liquidation display */
.loanLiquidation {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--color-border);
}

.liquidationPrice {
  color: var(--color-warning);
  font-weight: 600;
}

.loanLiquidationExplain {
  margin-top: 8px;
  font-size: 13px;
  color: var(--color-text-muted);
  line-height: 1.4;
}
```

---

## Decision 12 & 13: Plain Language Boundary Labels

### Current
```jsx
// Shows badges: [DRIFT], [SAFE], [STRUCTURAL], [STRESS]
```

### Updated

**File: `/src/constants/index.js`**

```js
// Decision 12 & 13: Plain language boundary messages
export const BOUNDARY_MESSAGES = {
  SAFE: {
    type: 'success',
    icon: '✓',
    message: 'This keeps your portfolio balanced.',
  },
  DRIFT: {
    type: 'warning', 
    icon: '⚠',
    message: 'This moves you away from your target allocation.',
  },
  STRUCTURAL: {
    type: 'warning',
    icon: '⚠',
    message: 'This significantly changes your portfolio structure. Review carefully.',
  },
  STRESS: {
    type: 'danger',
    icon: '⛔',
    message: 'This puts your portfolio at high risk. Not recommended.',
  },
};
```

**File: `/src/components/ExecutionSummary.jsx`** (or `PendingActionModal.jsx`)

```jsx
import { BOUNDARY_MESSAGES } from '../constants/index.js';

function BoundaryMessage({ boundary }) {
  const info = BOUNDARY_MESSAGES[boundary];
  if (!info) return null;
  
  return (
    <div className={`boundaryMessage ${info.type}`}>
      <span className="boundaryIcon">{info.icon}</span>
      <span className="boundaryText">{info.message}</span>
    </div>
  );
}

// In render, replace:
// <span className="badge">{boundary}</span>
// With:
<BoundaryMessage boundary={boundary} />
```

**File: `/src/styles/app.css`**

```css
/* Decision 12 & 13: Boundary messages */
.boundaryMessage {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 12px;
  border-radius: 8px;
  font-size: 14px;
  line-height: 1.4;
}

.boundaryMessage.success {
  background: var(--color-success-bg);
  color: var(--color-success);
}

.boundaryMessage.warning {
  background: var(--color-warning-bg);
  color: var(--color-warning);
}

.boundaryMessage.danger {
  background: var(--color-danger-bg);
  color: var(--color-danger);
}

.boundaryIcon {
  flex-shrink: 0;
}

.boundaryText {
  flex: 1;
}
```

**Also update in:** `HistoryPane.jsx` where boundary is shown in history items.

---

## Decision 14: Rebalance Trades Show Direction

### Current
```jsx
// Shows all trades with + prefix regardless of direction
<span className="tradeAmount">+{formatIRR(amount)}</span>
```

### Updated

**File: `/src/components/ExecutionSummary.jsx`**

```jsx
function TradeRow({ assetId, amount, direction }) {
  const isBuying = direction === 'BUY' || amount > 0;
  
  return (
    <div className={`tradeRow ${isBuying ? 'buying' : 'selling'}`}>
      <span className="tradeAsset">
        <span className="tradeDot">●</span>
        {getAssetDisplayName(assetId)}
      </span>
      <span className="tradeAmount">
        {isBuying ? '+' : '−'}{formatIRR(Math.abs(amount))}
      </span>
      <span className="tradeDirection">
        {isBuying ? '← Buying' : '← Selling'}
      </span>
    </div>
  );
}

// In the trades list render:
<div className="tradesList">
  <div className="tradesHeader">REBALANCE TRADES</div>
  {trades.map(trade => (
    <TradeRow 
      key={trade.assetId}
      assetId={trade.assetId}
      amount={trade.deltaIRR}
      direction={trade.deltaIRR >= 0 ? 'BUY' : 'SELL'}
    />
  ))}
</div>
```

**File: `/src/styles/app.css`**

```css
/* Decision 14: Trade direction display */
.tradeRow {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 0;
}

.tradeRow.buying .tradeAmount {
  color: var(--color-success);
}

.tradeRow.selling .tradeAmount {
  color: var(--color-danger);
}

.tradeAsset {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
}

.tradeDot {
  font-size: 8px;
  color: var(--color-text-muted);
}

.tradeAmount {
  font-weight: 500;
  min-width: 120px;
  text-align: right;
}

.tradeDirection {
  font-size: 12px;
  color: var(--color-text-muted);
  min-width: 70px;
}
```

---

## Decision 15: Activity Log Verb-First Plain Language

### Current
```jsx
// Shows: "+1.0B cash", "-USDT 46.3M", "🛡 Gold protected 3mo"
```

### Updated

**File: `/src/components/ActionLogPane.jsx`**

```jsx
// Decision 15: Format activity log entries with verb-first plain language
function formatActivityMessage(action) {
  switch (action.type) {
    case 'INIT':
      return `Started with ${formatIRRShort(action.amount)}`;
    
    case 'ADD_CASH':
      return `Added ${formatIRRShort(action.amount)} cash`;
    
    case 'TRADE':
      if (action.side === 'BUY') {
        return `Bought ${getAssetDisplayName(action.assetId)} (${formatIRRShort(action.amount)})`;
      } else {
        return `Sold ${getAssetDisplayName(action.assetId)} (${formatIRRShort(action.amount)})`;
      }
    
    case 'PROTECT':
      return `Protected ${getAssetDisplayName(action.assetId)} for ${action.months}mo`;
    
    case 'BORROW':
      return `Borrowed ${formatIRRShort(action.amount)} against ${getAssetDisplayName(action.collateralAssetId)}`;
    
    case 'REPAY':
      return `Repaid ${formatIRRShort(action.amount)} loan`;
    
    case 'REBALANCE':
      return `Rebalanced portfolio`;
    
    default:
      return action.description || 'Unknown action';
  }
}

function ActivityItem({ action, timestamp }) {
  return (
    <div className="activityItem">
      <span className="activityDot">●</span>
      <span className="activityTime">{formatTime(timestamp)}</span>
      <span className="activityMessage">{formatActivityMessage(action)}</span>
    </div>
  );
}
```

**File: `/src/styles/app.css`**

```css
/* Decision 15: Activity log styling */
.activityItem {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 6px 0;
  font-size: 13px;
}

.activityDot {
  color: var(--color-text-muted);  /* Decision 5: Gray dots */
  font-size: 8px;
  line-height: 1.8;
  flex-shrink: 0;
}

.activityTime {
  color: var(--color-text-faint);
  font-size: 12px;
  min-width: 45px;
  flex-shrink: 0;
}

.activityMessage {
  color: var(--color-text-secondary);
  flex: 1;
}
```

---

## Decision 16: Bottom Action Bar Reorganization

### Current
```jsx
// 5 buttons in two rows
<div className="actionBar">
  <button>Add Funds</button>
  <button>Rebalance</button>
  <button>🛡 Protect</button>
  <button>💰 Borrow</button>
  <button>↻ Reset</button>
</div>
```

### Updated

**File: `/src/components/PortfolioHome.jsx`** (or wherever action bar is rendered)

```jsx
function ActionBar({ onAddFunds, onRebalance, onProtect, onBorrow, onReset }) {
  return (
    <div className="actionBar">
      {/* Primary actions as buttons */}
      <div className="actionBarPrimary">
        <button className="btn primary" onClick={onAddFunds}>
          Add Funds
        </button>
        <button className="btn secondary" onClick={onRebalance}>
          Rebalance
        </button>
      </div>
      
      {/* Secondary actions as text links */}
      <div className="actionBarSecondary">
        <button className="linkBtn" onClick={onProtect}>Protect</button>
        <span className="linkSeparator">·</span>
        <button className="linkBtn" onClick={onBorrow}>Borrow</button>
        <span className="linkSeparator">·</span>
        <button className="linkBtn danger" onClick={onReset}>Reset</button>
      </div>
    </div>
  );
}
```

**File: `/src/styles/app.css`**

```css
/* Decision 16: Action bar reorganization */
.actionBar {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px;
  border-top: 1px solid var(--color-border);
}

.actionBarPrimary {
  display: flex;
  gap: 12px;
}

.actionBarPrimary .btn {
  flex: 1;
}

.actionBarSecondary {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 8px;
}

.linkBtn {
  background: none;
  border: none;
  color: var(--color-text-muted);
  font-size: 13px;
  cursor: pointer;
  padding: 4px 8px;
  transition: color 0.2s;
}

.linkBtn:hover {
  color: var(--color-text);
}

.linkBtn.danger:hover {
  color: var(--color-danger);
}

.linkSeparator {
  color: var(--color-text-faint);
}
```

---

## Decision 17: Stress Test as Separate Card

### Current
```jsx
// Toggle in header: [✓ Balanced] [○ Stress]
```

### Updated

**Create new file: `/src/components/StressTestCard.jsx`**

```jsx
import React, { useState } from 'react';
import { formatIRR } from '../helpers.js';

/**
 * StressTestCard - Simulate market crash scenarios
 * Decision 17: Moved from header toggle to dedicated card
 */
function StressTestCard({ portfolio, onRunStressTest }) {
  const [selectedDrop, setSelectedDrop] = useState(null);
  const [result, setResult] = useState(null);

  const scenarios = [
    { id: '20', label: '20% drop', description: 'Moderate correction' },
    { id: '30', label: '30% drop', description: 'Significant crash' },
    { id: '50', label: '50% drop', description: 'Severe bear market' },
  ];

  const handleRunTest = (dropPercent) => {
    setSelectedDrop(dropPercent);
    const testResult = onRunStressTest(dropPercent);
    setResult(testResult);
  };

  return (
    <div className="card stressTestCard">
      <div className="stressTestHeader">
        <h3>🔬 Stress Test</h3>
        <p className="stressTestSubtitle">
          See how your portfolio handles a market crash
        </p>
      </div>

      <div className="stressTestScenarios">
        {scenarios.map(scenario => (
          <button
            key={scenario.id}
            className={`stressTestBtn ${selectedDrop === scenario.id ? 'active' : ''}`}
            onClick={() => handleRunTest(scenario.id)}
          >
            <span className="stressTestBtnLabel">{scenario.label}</span>
            <span className="stressTestBtnDesc">{scenario.description}</span>
          </button>
        ))}
      </div>

      {result && (
        <div className="stressTestResult">
          <div className="stressTestResultRow">
            <span>Current value:</span>
            <span>{formatIRR(result.currentValue)}</span>
          </div>
          <div className="stressTestResultRow">
            <span>After {selectedDrop}% drop:</span>
            <span className="stressTestLoss">{formatIRR(result.afterValue)}</span>
          </div>
          <div className="stressTestResultRow">
            <span>Potential loss:</span>
            <span className="stressTestLoss">−{formatIRR(result.loss)}</span>
          </div>
          
          {result.loansAtRisk && (
            <div className="stressTestWarning">
              ⚠ {result.loansAtRisk} loan(s) may face liquidation in this scenario
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default StressTestCard;
```

**File: `/src/styles/app.css`**

```css
/* Decision 17: Stress test card */
.stressTestCard {
  background: var(--color-surface);
}

.stressTestHeader h3 {
  margin: 0 0 4px 0;
}

.stressTestSubtitle {
  color: var(--color-text-muted);
  font-size: 14px;
  margin: 0 0 16px 0;
}

.stressTestScenarios {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

.stressTestBtn {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 12px;
  background: var(--color-surface-hover);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.stressTestBtn:hover {
  border-color: var(--color-primary);
}

.stressTestBtn.active {
  background: var(--color-primary);
  border-color: var(--color-primary);
}

.stressTestBtnLabel {
  font-weight: 600;
  color: var(--color-text);
}

.stressTestBtnDesc {
  font-size: 11px;
  color: var(--color-text-muted);
}

.stressTestBtn.active .stressTestBtnDesc {
  color: var(--color-text-secondary);
}

.stressTestResult {
  padding: 16px;
  background: var(--color-surface-hover);
  border-radius: 8px;
}

.stressTestResultRow {
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px solid var(--color-border-light);
}

.stressTestResultRow:last-child {
  border-bottom: none;
}

.stressTestLoss {
  color: var(--color-danger);
  font-weight: 500;
}

.stressTestWarning {
  margin-top: 12px;
  padding: 12px;
  background: var(--color-warning-bg);
  border-radius: 6px;
  color: var(--color-warning);
  font-size: 13px;
}
```

**Update `/src/components/PortfolioHome.jsx`:**

```jsx
import StressTestCard from './StressTestCard.jsx';

// In render, add after HOLDINGS section:
<StressTestCard 
  portfolio={snapshot}
  onRunStressTest={handleStressTest}
/>
```

**Remove** the toggle from the header area.

---

## Decision 18: Protection Tab Educational Content

### Current
```jsx
// Just shows list of protections, empty state is blank
```

### Updated

**File: `/src/components/Protection.jsx`**

```jsx
import React from 'react';
import { formatIRR, getAssetDisplayName } from '../helpers.js';

function Protection({ protections, onStartProtect, eligibleAssets }) {
  const hasProtections = protections && protections.length > 0;
  const showEducation = !hasProtections || protections.length < 3;

  return (
    <div className="stack">
      <div className="card">
        <div className="sectionTitle">YOUR PROTECTIONS</div>
        <p className="sectionSubtitle">If prices drop sharply, you get paid.</p>

        {hasProtections ? (
          <div className="protectionsList">
            {protections.map(p => (
              <ProtectionRow key={p.id} protection={p} />
            ))}
          </div>
        ) : (
          <div className="emptyState">
            <p>You don't have any active protections yet.</p>
          </div>
        )}

        {/* Decision 18: Educational content when few protections */}
        {showEducation && (
          <div className="protectionEducation">
            <div className="educationDivider" />
            <h4>How Protection Works</h4>
            <p>
              Protection acts like insurance for your assets. If the price drops 
              below your protected value, you receive the difference.
            </p>
            <ul className="educationList">
              <li>Choose an asset and protection duration (1-6 months)</li>
              <li>Pay a one-time premium upfront</li>
              <li>If price crashes, you're covered for the loss</li>
              <li>If price stays up, your premium is the only cost</li>
            </ul>
            
            {eligibleAssets && eligibleAssets.length > 0 && (
              <button 
                className="btn primary"
                onClick={() => onStartProtect(eligibleAssets[0])}
              >
                + Protect an Asset
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ProtectionRow({ protection }) {
  const daysLeft = Math.max(0, Math.ceil(
    (new Date(protection.endISO).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  ));

  return (
    <div className="protectionRow">
      <div className="protectionAsset">
        <span className="protectionIcon">🛡</span>
        <div className="protectionAssetInfo">
          <span className="protectionAssetName">
            {getAssetDisplayName(protection.assetId)}
          </span>
          <span className="protectionMeta">
            {protection.layer} · {daysLeft} days left
          </span>
        </div>
      </div>
      <div className="protectionValue">
        <span className="protectionAmount">{formatIRR(protection.premiumPaid)}</span>
        <span className="protectionLabel">Premium paid</span>
      </div>
    </div>
  );
}

export default Protection;
```

**File: `/src/styles/app.css`**

```css
/* Decision 18: Protection education */
.protectionEducation {
  margin-top: 24px;
}

.educationDivider {
  height: 1px;
  background: var(--color-border);
  margin-bottom: 24px;
}

.protectionEducation h4 {
  margin: 0 0 12px 0;
  color: var(--color-text);
}

.protectionEducation p {
  color: var(--color-text-secondary);
  font-size: 14px;
  line-height: 1.5;
  margin: 0 0 16px 0;
}

.educationList {
  list-style: none;
  padding: 0;
  margin: 0 0 20px 0;
}

.educationList li {
  position: relative;
  padding-left: 20px;
  margin-bottom: 8px;
  color: var(--color-text-muted);
  font-size: 13px;
}

.educationList li::before {
  content: '✓';
  position: absolute;
  left: 0;
  color: var(--color-success);
}

.emptyState {
  padding: 32px;
  text-align: center;
  color: var(--color-text-muted);
}
```

---

## Decision 19: Donut Chart Blue Opacity System

### Current
```jsx
// Uses green, blue, yellow segments
const COLORS = ['#22c55e', '#3b82f6', '#eab308'];
```

### Updated

**File: `/src/components/DonutChart.jsx`**

```jsx
import React from 'react';

/**
 * DonutChart - Allocation visualization
 * Decision 19: Uses blue opacity system matching layer dots
 */
function DonutChart({ foundation, growth, upside, size = 160 }) {
  // Decision 19: Blue with varying opacity (100%, 60%, 30%)
  const COLORS = {
    foundation: '#3B82F6',              // Blue 100%
    growth: 'rgba(59, 130, 246, 0.6)',  // Blue 60%
    upside: 'rgba(59, 130, 246, 0.3)',  // Blue 30%
  };

  const total = foundation + growth + upside;
  if (total === 0) return null;

  const radius = size / 2;
  const strokeWidth = 20;
  const innerRadius = radius - strokeWidth;
  const circumference = 2 * Math.PI * innerRadius;

  // Calculate stroke dash arrays for each segment
  const foundationDash = (foundation / total) * circumference;
  const growthDash = (growth / total) * circumference;
  const upsideDash = (upside / total) * circumference;

  // Calculate rotation offsets
  const foundationOffset = 0;
  const growthOffset = foundationDash;
  const upsideOffset = foundationDash + growthDash;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {/* Foundation segment */}
      <circle
        cx={radius}
        cy={radius}
        r={innerRadius}
        fill="none"
        stroke={COLORS.foundation}
        strokeWidth={strokeWidth}
        strokeDasharray={`${foundationDash} ${circumference}`}
        strokeDashoffset={0}
        transform={`rotate(-90 ${radius} ${radius})`}
      />
      
      {/* Growth segment */}
      <circle
        cx={radius}
        cy={radius}
        r={innerRadius}
        fill="none"
        stroke={COLORS.growth}
        strokeWidth={strokeWidth}
        strokeDasharray={`${growthDash} ${circumference}`}
        strokeDashoffset={-foundationDash}
        transform={`rotate(-90 ${radius} ${radius})`}
      />
      
      {/* Upside segment */}
      <circle
        cx={radius}
        cy={radius}
        r={innerRadius}
        fill="none"
        stroke={COLORS.upside}
        strokeWidth={strokeWidth}
        strokeDasharray={`${upsideDash} ${circumference}`}
        strokeDashoffset={-(foundationDash + growthDash)}
        transform={`rotate(-90 ${radius} ${radius})`}
      />
      
      {/* Center text */}
      <text
        x={radius}
        y={radius - 8}
        textAnchor="middle"
        fill="var(--color-text-muted)"
        fontSize="12"
      >
        Your
      </text>
      <text
        x={radius}
        y={radius + 8}
        textAnchor="middle"
        fill="var(--color-text)"
        fontSize="14"
        fontWeight="500"
      >
        Allocation
      </text>
    </svg>
  );
}

export default DonutChart;
```

---

## Decision 20: Confirmation Modal for Dangerous Actions

### Current
```jsx
// ResetConfirmModal.jsx exists but may need enhancement
```

### Updated

**File: `/src/components/ConfirmModal.jsx`** (rename from ResetConfirmModal or create new)

```jsx
import React from 'react';

/**
 * ConfirmModal - Generic confirmation dialog for dangerous actions
 * Decision 20: Used for Reset, large sells, etc.
 */
function ConfirmModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  message, 
  confirmText = 'Confirm',
  confirmStyle = 'danger',  // 'danger' | 'warning' | 'primary'
  cancelText = 'Cancel'
}) {
  if (!isOpen) return null;

  return (
    <div className="modalOverlay" onClick={onClose}>
      <div className="confirmModal" onClick={e => e.stopPropagation()}>
        <div className="confirmModalHeader">
          <span className="confirmModalIcon">
            {confirmStyle === 'danger' ? '⚠' : 'ℹ'}
          </span>
          <h3>{title}</h3>
        </div>
        
        <div className="confirmModalBody">
          <p>{message}</p>
        </div>
        
        <div className="confirmModalActions">
          <button className="btn secondary" onClick={onClose}>
            {cancelText}
          </button>
          <button 
            className={`btn ${confirmStyle}`} 
            onClick={() => { onConfirm(); onClose(); }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmModal;

// Pre-configured variants for common use cases:

export function ResetConfirmModal({ isOpen, onClose, onConfirm }) {
  return (
    <ConfirmModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      title="Reset Portfolio?"
      message="This will clear all your holdings, loans, and protections. This cannot be undone."
      confirmText="Yes, Reset"
      confirmStyle="danger"
    />
  );
}

export function LargeSellConfirmModal({ isOpen, onClose, onConfirm, assetName, amount }) {
  return (
    <ConfirmModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      title="Confirm Large Sale"
      message={`You're about to sell ${amount} of ${assetName}. This is a significant portion of your holdings.`}
      confirmText="Yes, Sell"
      confirmStyle="warning"
    />
  );
}
```

**File: `/src/styles/app.css`**

```css
/* Decision 20: Confirmation modal */
.modalOverlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.confirmModal {
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  width: 100%;
  max-width: 400px;
  padding: 24px;
}

.confirmModalHeader {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.confirmModalIcon {
  font-size: 24px;
}

.confirmModalHeader h3 {
  margin: 0;
  font-size: 18px;
}

.confirmModalBody p {
  color: var(--color-text-secondary);
  font-size: 14px;
  line-height: 1.5;
  margin: 0 0 24px 0;
}

.confirmModalActions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}

.btn.danger {
  background: var(--color-danger);
  color: white;
}

.btn.danger:hover {
  background: #dc2626;
}

.btn.warning {
  background: var(--color-warning);
  color: black;
}
```

**Usage in App.jsx or relevant component:**

```jsx
import { ResetConfirmModal } from './components/ConfirmModal.jsx';

// State
const [showResetConfirm, setShowResetConfirm] = useState(false);

// Handler
const handleResetClick = () => {
  setShowResetConfirm(true);
};

const handleResetConfirm = () => {
  dispatch({ type: 'RESET' });
};

// Render
<ResetConfirmModal
  isOpen={showResetConfirm}
  onClose={() => setShowResetConfirm(false)}
  onConfirm={handleResetConfirm}
/>
```

---

## Implementation Checklist

### Decision 7: Before/After Text Labels
- [ ] Update `ExecutionSummary.jsx` — replace emoji display
- [ ] Update `HistoryPane.jsx` — same change for history items
- [ ] Add CSS for `.allocationComparison`

### Decision 8: Holdings Default Expanded
- [ ] Update `PortfolioHome.jsx` — change initial state

### Decision 9: Keep 0 IRR Display
- [ ] No changes needed

### Decision 10: Rename Fixed Income
- [ ] Update `constants/index.js` — LAYER_EXPLANATIONS
- [ ] Update `helpers.js` — getAssetDisplayName
- [ ] Search/replace any hardcoded strings

### Decision 11: Loan Liquidation Price
- [ ] Update `Loans.jsx` — add liquidation price calculation
- [ ] Add explanation text
- [ ] Add CSS for `.loanLiquidation`

### Decision 12 & 13: Plain Language Boundaries
- [ ] Add `BOUNDARY_MESSAGES` to constants
- [ ] Create `BoundaryMessage` component
- [ ] Update `ExecutionSummary.jsx`
- [ ] Update `PendingActionModal.jsx`
- [ ] Update `HistoryPane.jsx`
- [ ] Add CSS for `.boundaryMessage`

### Decision 14: Rebalance Trade Direction
- [ ] Update `ExecutionSummary.jsx` — show +/- with labels
- [ ] Add CSS for `.tradeRow.buying/.selling`

### Decision 15: Activity Log Verb-First
- [ ] Update `ActionLogPane.jsx` — formatActivityMessage function
- [ ] Test all action types

### Decision 16: Action Bar Reorganization
- [ ] Update action bar component
- [ ] Add CSS for `.actionBarPrimary/.actionBarSecondary`
- [ ] Add `.linkBtn` styles

### Decision 17: Stress Test Card
- [ ] Create `StressTestCard.jsx`
- [ ] Add to `PortfolioHome.jsx`
- [ ] Remove header toggle
- [ ] Add CSS for stress test card

### Decision 18: Protection Education
- [ ] Update `Protection.jsx` — add education section
- [ ] Add "Protect an Asset" button
- [ ] Add CSS for `.protectionEducation`

### Decision 19: Donut Chart Colors
- [ ] Update `DonutChart.jsx` — blue opacity colors

### Decision 20: Confirmation Modals
- [ ] Create/update `ConfirmModal.jsx`
- [ ] Add `ResetConfirmModal` variant
- [ ] Integrate with Reset button
- [ ] Add CSS for modal styles

---

## Time Estimates

| Decision | Component(s) | Time |
|----------|--------------|------|
| 7 | ExecutionSummary, HistoryPane | 20 min |
| 8 | PortfolioHome | 5 min |
| 9 | — | 0 min |
| 10 | constants, helpers | 15 min |
| 11 | Loans | 30 min |
| 12-13 | constants, ExecutionSummary, PendingActionModal, HistoryPane | 30 min |
| 14 | ExecutionSummary | 20 min |
| 15 | ActionLogPane | 25 min |
| 16 | ActionBar component | 20 min |
| 17 | StressTestCard (new), PortfolioHome | 45 min |
| 18 | Protection | 30 min |
| 19 | DonutChart | 15 min |
| 20 | ConfirmModal | 25 min |
| Testing | All | 30 min |
| **Total** | | **~4.5 hours** |

---

## Summary

This spec covers 14 UX decisions that improve clarity, reduce jargon, and make the interface more intuitive for ordinary users. Combined with the color palette fixes (Decisions 1-6), these changes will significantly improve the Blu Markets experience.

**Key themes:**
1. **Plain language over jargon** — DRIFT → "moves away from target", LTV → liquidation price
2. **Show, don't hide** — Holdings expanded, educational content visible
3. **Clear feedback** — Buying/Selling labels, verb-first activity log
4. **Safety nets** — Confirmation modals for dangerous actions
5. **Visual consistency** — Blue opacity system across all components

---

**Document Version:** 1.0  
**Target Version:** Blu Markets v9.11  
**Created:** January 2026
