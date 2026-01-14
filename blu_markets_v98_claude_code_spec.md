



# Blu Markets v9.8 — Implementation Spec for Claude Code

## Context
- **Codebase:** React app with Vite
- **Source:** `/home/claude/blu-markets-v97/Blu-Markets-main/src/`
- **Key files:**
  - `App.jsx` (1466 lines) — Main component
  - `reducers/appReducer.js` (469 lines) — State management
  - `engine/boundary.js` (64 lines) — Boundary classification
  - `constants/index.js` — Constants and mappings
  - `styles/app.css` (36K) — Styles

---

## TASK 1: Replace Emoji Allocation with Text Labels

### Files to modify
- `App.jsx`

### Find and replace pattern
```
// FIND all instances of this pattern:
🛡️{percent}% 📈{percent}% 🚀{percent}%

// REPLACE with:
Foundation {percent}% · Growth {percent}% · Upside {percent}%
```

### Specific locations in App.jsx
Search for these emoji patterns and replace:
- `🛡️` → `Foundation `
- `📈` → `Growth `
- `🚀` → `Upside `
- Add ` · ` separator between each

### Example transformation
```jsx
// Before
<span>🛡️{before.foundation}% 📈{before.growth}% 🚀{before.upside}%</span>

// After
<span>Foundation {before.foundation}% · Growth {before.growth}% · Upside {before.upside}%</span>
```

---

## TASK 2: Update Boundary Terminology

### Files to modify
- `engine/boundary.js`
- `App.jsx` (badge display)
- `styles/app.css` (badge styles)

### Change boundary display labels

In `boundary.js`, add or update the display mapping:
```javascript
export const boundaryDisplayLabels = {
  SAFE: "✓ Looks good",
  DRIFT: "⚠ Minor drift", 
  STRUCTURAL: "⚠ Needs review",
  STRESS: "⛔ High risk"
};
```

### Update all boundary badge renders in App.jsx
```jsx
// Before
<span className="boundary-badge">{boundary}</span>

// After  
import { boundaryDisplayLabels } from './engine/boundary';
<span className={`boundary-badge boundary-${boundary.toLowerCase()}`}>
  {boundaryDisplayLabels[boundary]}
</span>
```

### Add CSS for boundary badge variants
```css
.boundary-safe { background: #34d399; color: #000; }
.boundary-drift { background: #fbbf24; color: #000; }
.boundary-structural { background: #f97316; color: #fff; }
.boundary-stress { background: #ef4444; color: #fff; }
```

---

## TASK 3: Collapsible Holdings by Layer

### Files to modify
- `App.jsx`
- `styles/app.css`

### Add state for layer expansion
```jsx
const [expandedLayers, setExpandedLayers] = useState({
  foundation: false,
  growth: false,
  upside: false
});

const toggleLayer = (layer) => {
  setExpandedLayers(prev => ({
    ...prev,
    [layer]: !prev[layer]
  }));
};
```

### Create LayerSummary component
```jsx
function LayerSummary({ layer, holdings, expanded, onToggle }) {
  const layerHoldings = holdings.filter(h => h.layer.toLowerCase() === layer);
  const total = layerHoldings.reduce((sum, h) => sum + h.value, 0);
  const assetCount = layerHoldings.length;
  
  return (
    <div className={`layer-summary layer-${layer}`}>
      <div className="layer-header" onClick={onToggle}>
        <span className="layer-name">{layer.toUpperCase()}</span>
        <span className="layer-total">{formatCurrency(total)} IRR</span>
        <span className="layer-meta">{assetCount} assets</span>
        <span className="expand-icon">{expanded ? '▼' : '▶'}</span>
      </div>
      {expanded && (
        <div className="layer-assets">
          {layerHoldings.map(holding => (
            <HoldingRow key={holding.asset} {...holding} />
          ))}
        </div>
      )}
    </div>
  );
}
```

### Replace current holdings list with LayerSummary components
```jsx
// Before: flat list of HoldingRow components

// After:
{['foundation', 'growth', 'upside'].map(layer => (
  <LayerSummary
    key={layer}
    layer={layer}
    holdings={holdings}
    expanded={expandedLayers[layer]}
    onToggle={() => toggleLayer(layer)}
  />
))}
```

### CSS for collapsible layers
```css
.layer-summary {
  border-left: 3px solid;
  margin-bottom: 8px;
}
.layer-summary.layer-foundation { border-color: #34d399; }
.layer-summary.layer-growth { border-color: #60a5fa; }
.layer-summary.layer-upside { border-color: #fbbf24; }

.layer-header {
  display: flex;
  justify-content: space-between;
  padding: 12px 16px;
  cursor: pointer;
  background: rgba(255,255,255,0.05);
}
.layer-header:hover { background: rgba(255,255,255,0.08); }

.layer-assets {
  padding-left: 16px;
}

.expand-icon {
  opacity: 0.6;
  font-size: 12px;
}
```

---

## TASK 4: Full Asset Names

### Files to modify
- `constants/index.js` (create mapping)
- `App.jsx` (use mapping)

### Create asset name mapping in constants/index.js
```javascript
export const ASSET_DISPLAY_NAMES = {
  'USDT': 'Tether (USDT)',
  'Fixed Income (IRR)': 'Iranian Bonds',
  'Gold': 'Gold',
  'BTC': 'Bitcoin (BTC)',
  'Bitcoin': 'Bitcoin (BTC)',
  'QQQ': 'Nasdaq 100 (QQQ)',
  'ETH': 'Ethereum (ETH)',
  'Ethereum': 'Ethereum (ETH)',
  'SOL': 'Solana (SOL)',
  'Solana': 'Solana (SOL)',
  'TON': 'Toncoin (TON)',
  'Toncoin': 'Toncoin (TON)'
};

export const getAssetDisplayName = (asset) => {
  return ASSET_DISPLAY_NAMES[asset] || asset;
};
```

### Update App.jsx to use display names
```jsx
import { getAssetDisplayName } from './constants';

// In HoldingRow and anywhere asset names are displayed:
<span className="asset-name">{getAssetDisplayName(asset)}</span>
```

---

## TASK 5: Loan Card Redesign with Health Bar

### Files to modify
- `App.jsx` (LoanCard component)
- `styles/app.css`

### Create HealthBar component
```jsx
function HealthBar({ percentage }) {
  const getStatus = (pct) => {
    if (pct <= 50) return 'safe';
    if (pct <= 65) return 'caution';
    if (pct <= 75) return 'warning';
    return 'danger';
  };
  
  const status = getStatus(percentage);
  
  return (
    <div className="health-bar-container">
      <div 
        className={`health-bar health-${status}`}
        style={{ width: `${percentage}%` }}
      />
      <span className="health-label">{percentage}% used</span>
    </div>
  );
}
```

### Create warning message generator
```jsx
function getLoanWarning(ltv, collateralAsset) {
  if (ltv <= 50) return null;
  
  const dropPercent = Math.round((1 - (75 / ltv)) * 100);
  
  if (ltv >= 75) {
    return `⛔ Critical: Add collateral now or repay to avoid auto-close.`;
  }
  if (ltv >= 65) {
    return `⚠ Close to limit. If ${collateralAsset} drops ${dropPercent}%, this loan will auto-close.`;
  }
  return `If ${collateralAsset} drops ${dropPercent}%, this loan may be at risk.`;
}
```

### Update LoanCard component
```jsx
function LoanCard({ loan }) {
  const { amount, collateral, collateralAsset, ltv, liquidationValue } = loan;
  const warning = getLoanWarning(ltv, collateralAsset);
  const status = ltv <= 50 ? 'safe' : ltv <= 65 ? 'caution' : ltv <= 75 ? 'warning' : 'danger';
  
  return (
    <div className={`loan-card loan-${status}`}>
      <div className="loan-header">
        LOAN — {getAssetDisplayName(collateralAsset)} Collateral
      </div>
      
      <div className="loan-amount">
        Borrowed: {formatCurrency(amount)} IRR
      </div>
      
      <HealthBar percentage={ltv} />
      
      {warning && (
        <div className={`loan-warning warning-${status}`}>
          {warning}
        </div>
      )}
      
      <div className="loan-actions">
        {ltv > 65 && <button className="btn-secondary">Add Collateral</button>}
        <button className="btn-primary">Repay</button>
      </div>
    </div>
  );
}
```

### CSS for health bar and loan cards
```css
.health-bar-container {
  position: relative;
  height: 24px;
  background: rgba(255,255,255,0.1);
  border-radius: 4px;
  overflow: hidden;
  margin: 12px 0;
}

.health-bar {
  height: 100%;
  transition: width 0.3s ease;
}

.health-safe { background: #34d399; }
.health-caution { background: #fbbf24; }
.health-warning { background: #f97316; }
.health-danger { background: #ef4444; }

.health-label {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 12px;
}

.loan-warning {
  padding: 8px 12px;
  border-radius: 4px;
  font-size: 13px;
  margin: 8px 0;
}

.warning-caution { background: rgba(251, 191, 36, 0.2); }
.warning-warning { background: rgba(249, 115, 22, 0.2); }
.warning-danger { background: rgba(239, 68, 68, 0.2); color: #fca5a5; }
```

---

## TASK 6: Remove Entry IDs from History

### Files to modify
- `App.jsx`

### Find and remove
Search for entry ID display in HistoryPane/history entries and remove:
```jsx
// REMOVE lines like:
<div className="entry-id">ID: {entry.id}</div>
// or
<span>ID: {entry.id.slice(0, 20)}...</span>
```

---

## TASK 7: Verb-based Sidebar Action Log

### Files to modify
- `reducers/appReducer.js` or `App.jsx` (wherever log entries are formatted)

### Create action log formatter
```javascript
export function formatActionLogEntry(action) {
  const { type, asset, amount, collateral, duration } = action;
  const formattedAmount = formatCompactCurrency(amount);
  
  const formats = {
    'BUY': `Bought ${getAssetDisplayName(asset)} (${formattedAmount})`,
    'SELL': `Sold ${getAssetDisplayName(asset)} (${formattedAmount})`,
    'PROTECT': `Protected ${getAssetDisplayName(asset)} (${duration})`,
    'BORROW': `Borrowed ${formattedAmount} (${getAssetDisplayName(collateral)} collateral)`,
    'REPAY': `Repaid loan (${formattedAmount})`,
    'REBALANCE': `Rebalanced portfolio`,
    'START': `Started with ${formattedAmount}`
  };
  
  return formats[type] || `${type} ${asset || ''}`;
}
```

### Update sidebar log rendering
```jsx
{actionLog.map((action, i) => (
  <div key={i} className="log-entry">
    <span className="log-time">{action.time}</span>
    <span className="log-text">{formatActionLogEntry(action)}</span>
  </div>
))}
```

---

## TASK 8: Reduce Action Buttons (Two Primary + Menu)

### Files to modify
- `App.jsx`
- `styles/app.css`

### Replace current button layout
```jsx
// Before: 5 buttons always visible

// After:
<div className="action-buttons">
  <button className="btn-primary" onClick={handleAddFunds}>
    Add Funds
  </button>
  <button className="btn-secondary" onClick={handleRebalance}>
    Rebalance
  </button>
  <div className="more-menu">
    <button className="btn-menu" onClick={() => setShowMoreMenu(!showMoreMenu)}>
      More ▼
    </button>
    {showMoreMenu && (
      <div className="menu-dropdown">
        <button onClick={handleProtect}>☂️ Protect</button>
        <button onClick={handleBorrow}>💰 Borrow</button>
      </div>
    )}
  </div>
</div>

// REMOVE Reset button from here entirely
// Move Reset to a Settings section if one exists, or remove
```

---

## TASK 9: Collapsible Rebalance Preview

### Files to modify
- `App.jsx`

### Update rebalance preview component
```jsx
function RebalancePreview({ trades, onConfirm, onCancel }) {
  const [showTrades, setShowTrades] = useState(false);
  
  const selling = trades.filter(t => t.amount < 0);
  const buying = trades.filter(t => t.amount > 0);
  const totalSelling = selling.reduce((sum, t) => sum + Math.abs(t.amount), 0);
  const totalBuying = buying.reduce((sum, t) => sum + t.amount, 0);
  
  return (
    <div className="rebalance-preview">
      <h3>REBALANCE PREVIEW</h3>
      
      <div className="rebalance-summary">
        <p>Selling {selling.length} assets ({formatCurrency(totalSelling)} IRR)</p>
        <p>Buying {buying.length} assets ({formatCurrency(totalBuying)} IRR)</p>
      </div>
      
      <button 
        className="expand-trades"
        onClick={() => setShowTrades(!showTrades)}
      >
        {showTrades ? 'Hide trades ▲' : 'See all trades ▼'}
      </button>
      
      {showTrades && (
        <div className="trades-list">
          {trades.map((trade, i) => (
            <div key={i} className="trade-row">
              <span>{getAssetDisplayName(trade.asset)}</span>
              <span className={trade.amount > 0 ? 'positive' : 'negative'}>
                {trade.amount > 0 ? '+' : ''}{formatCurrency(trade.amount)} IRR
              </span>
            </div>
          ))}
        </div>
      )}
      
      <div className="preview-actions">
        <button className="btn-primary" onClick={onConfirm}>Confirm</button>
        <button className="btn-secondary" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
```

---

## TASK 10: Remove Stress Toggle

### Files to modify
- `App.jsx`

### Find and remove
Search for "Stress" toggle/switch and remove:
```jsx
// REMOVE:
<Toggle label="Stress" ... />
// or
<button onClick={toggleStress}>Stress</button>
// or any stress mode related UI elements
```

Also remove stress-related state if it's only used for UI:
```jsx
// REMOVE if only for UI toggle:
const [stressMode, setStressMode] = useState(false);
```

---

## TASK 11: Onboarding Progress Steps

### Files to modify
- `App.jsx`
- `styles/app.css`

### Create OnboardingProgress component
```jsx
function OnboardingProgress({ currentStep }) {
  const steps = [
    { num: 1, label: 'Welcome' },
    { num: 2, label: 'Profile' },
    { num: 3, label: 'Amount' },
    { num: 4, label: 'Confirm' }
  ];
  
  return (
    <div className="onboarding-progress">
      <div className="progress-header">Step {currentStep} of {steps.length}</div>
      <div className="progress-steps">
        {steps.map(step => (
          <div 
            key={step.num}
            className={`progress-step ${
              step.num < currentStep ? 'completed' : 
              step.num === currentStep ? 'current' : 'upcoming'
            }`}
          >
            <span className="step-indicator">
              {step.num < currentStep ? '✓' : step.num}
            </span>
            <span className="step-label">{step.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

### Replace "No actions yet" during onboarding
```jsx
// In the left sidebar, conditionally render:
{!hasPortfolio ? (
  <OnboardingProgress currentStep={onboardingStep} />
) : (
  <ActionLog entries={actionLog} />
)}
```

### CSS for progress steps
```css
.onboarding-progress {
  padding: 16px;
}

.progress-header {
  font-size: 14px;
  color: #9ca3af;
  margin-bottom: 16px;
}

.progress-step {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 0;
}

.step-indicator {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
}

.progress-step.completed .step-indicator {
  background: #34d399;
  color: #000;
}

.progress-step.current .step-indicator {
  background: #60a5fa;
  color: #fff;
}

.progress-step.upcoming .step-indicator {
  background: rgba(255,255,255,0.1);
  color: #6b7280;
}

.step-label {
  font-size: 14px;
}

.progress-step.upcoming .step-label {
  color: #6b7280;
}
```

---

## TASK 12: Show Minimum Amount Upfront

### Files to modify
- `App.jsx`

### Add minimum amount text
```jsx
// In the investment amount step, add below the input:
<div className="amount-input-section">
  <input 
    type="text" 
    value={amount} 
    onChange={handleAmountChange}
    placeholder="Enter amount"
  />
  <p className="amount-hint">Minimum: 5,000,000 IRR</p>
</div>
```

### CSS
```css
.amount-hint {
  font-size: 13px;
  color: #9ca3af;
  margin-top: 8px;
}
```

---

## TASK 13: Two-line Layer Descriptions

### Files to modify
- `constants/index.js`
- `App.jsx`

### Add layer descriptions to constants
```javascript
export const LAYER_INFO = {
  foundation: {
    name: 'Foundation',
    tagline: 'Your safety net',
    description: 'Stable assets that protect you during market drops'
  },
  growth: {
    name: 'Growth',
    tagline: 'Steady wealth building', 
    description: 'Balanced assets that grow over time'
  },
  upside: {
    name: 'Upside',
    tagline: 'Higher potential returns',
    description: 'Riskier assets for bigger gains'
  }
};
```

### Update allocation preview display
```jsx
import { LAYER_INFO } from './constants';

{Object.entries(allocation).map(([layer, percent]) => (
  <div key={layer} className="layer-info">
    <div className="layer-title">
      <span className={`layer-dot layer-${layer}`} />
      {LAYER_INFO[layer].name} ({percent}%)
    </div>
    <div className="layer-tagline">{LAYER_INFO[layer].tagline}</div>
    <div className="layer-description">{LAYER_INFO[layer].description}</div>
  </div>
))}
```

---

## TASK 14: Protection Tab Context

### Files to modify
- `App.jsx`

### Add header explanation
```jsx
function ProtectionPane({ protections }) {
  return (
    <div className="protection-pane">
      <div className="pane-header">
        <h2>Your Protections</h2>
        <p className="pane-subtitle">If prices drop sharply, you get paid.</p>
      </div>
      
      {protections.length === 0 ? (
        <EmptyState type="protection" />
      ) : (
        protections.map(p => (
          <ProtectionCard key={p.id} protection={p} />
        ))
      )}
    </div>
  );
}
```

### Update ProtectionCard with explanation
```jsx
function ProtectionCard({ protection }) {
  const { asset, daysRemaining, premium, coverageAmount, triggerDrop } = protection;
  
  return (
    <div className="protection-card">
      <div className="protection-header">
        <span>☂️ {getAssetDisplayName(asset)}</span>
      </div>
      <p className="protection-duration">Protected for {daysRemaining} more days</p>
      <p className="protection-explanation">
        If {getAssetDisplayName(asset)} drops {triggerDrop}%+, you receive 
        compensation up to {formatCurrency(coverageAmount)} IRR
      </p>
      <p className="protection-cost">Cost: {formatCurrency(premium)} IRR (paid)</p>
    </div>
  );
}
```

---

## TASK 15: Plain Language Constraint Messages

### Files to modify
- `engine/boundary.js`

### Update frictionCopyForBoundary function
```javascript
export function frictionCopyForBoundary(boundary, kind, meta = {}) {
  if (kind === 'rebalance' && boundary === 'STRUCTURAL') {
    const messages = [];
    
    messages.push("We couldn't fully rebalance your portfolio.");
    
    if (meta.hasLockedCollateral) {
      messages.push("Some assets are locked for your loans.");
    }
    
    if (meta.insufficientCash) {
      messages.push("Not enough cash available for all trades.");
    }
    
    // Only show drift message if drift > 0
    if (meta.residualDrift && meta.residualDrift > 0) {
      messages.push(`Your portfolio is ${(100 - meta.residualDrift).toFixed(1)}% aligned with your target.`);
    } else if (meta.residualDrift === 0) {
      messages.push("Your portfolio is now on target.");
    }
    
    return messages;
  }
  
  // ... rest of function
}
```

---

## TASK 17: Consolidate Loan Header

### Files to modify
- `App.jsx`

### Update LoansPane
```jsx
function LoansPane({ loans }) {
  const totalBorrowed = loans.reduce((sum, l) => sum + l.amount, 0);
  
  return (
    <div className="loans-pane">
      {/* Badge in top-right corner shows count only */}
      {/* Header shows total */}
      <div className="pane-header">
        <h2>Your Loans</h2>
        {loans.length > 0 && (
          <p className="pane-subtitle">
            Total borrowed: {formatCurrency(totalBorrowed)} IRR
          </p>
        )}
      </div>
      
      {/* REMOVE the duplicate "ACTIVE LOANS (3)" / "Total borrowed" section */}
      
      {loans.length === 0 ? (
        <EmptyState type="loans" />
      ) : (
        loans.map(loan => <LoanCard key={loan.id} loan={loan} />)
      )}
    </div>
  );
}
```

### Update badge to show count only
```jsx
// In tab bar or header:
<Badge>{loans.length} Loans</Badge>
// Instead of: <Badge>{loans.length} Active: {formatCurrency(total)}</Badge>
```

---

## TASK 18: Empty States with CTAs

### Files to modify
- `App.jsx`
- `styles/app.css`

### Create EmptyState component
```jsx
function EmptyState({ type }) {
  const content = {
    protection: {
      icon: '☂️',
      title: 'No protections yet',
      description: 'Protection pays you if an asset\'s price drops significantly — like insurance for your investments.',
      action: 'Protect an Asset',
      onAction: () => handleProtect()
    },
    loans: {
      icon: '💰',
      title: 'No active loans',
      description: 'Borrow against your assets without selling them. Keep your investments while accessing cash.',
      action: 'Borrow Funds',
      onAction: () => handleBorrow()
    },
    history: {
      icon: '📋',
      title: 'No actions yet',
      description: 'Your investment decisions will appear here. Start by adding funds to your portfolio.',
      action: 'Add Funds',
      onAction: () => handleAddFunds()
    }
  };
  
  const c = content[type];
  
  return (
    <div className="empty-state">
      <span className="empty-icon">{c.icon}</span>
      <h3 className="empty-title">{c.title}</h3>
      <p className="empty-description">{c.description}</p>
      <button className="btn-primary" onClick={c.onAction}>
        {c.action}
      </button>
    </div>
  );
}
```

### CSS for empty states
```css
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  text-align: center;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.empty-title {
  font-size: 18px;
  margin-bottom: 8px;
}

.empty-description {
  font-size: 14px;
  color: #9ca3af;
  max-width: 280px;
  margin-bottom: 24px;
  line-height: 1.5;
}
```

---

## TASK 20: Currency Label for Quick Amounts

### Files to modify
- `App.jsx`

### Update quick amount buttons section
```jsx
<div className="quick-amounts">
  <label className="quick-amounts-label">Quick amounts (IRR):</label>
  <div className="quick-buttons">
    {[10_000_000, 50_000_000, 100_000_000, 500_000_000].map(amt => (
      <button
        key={amt}
        className={`quick-btn ${amount === amt ? 'selected' : ''}`}
        onClick={() => setAmount(amt)}
      >
        {formatCompactCurrency(amt)}
      </button>
    ))}
  </div>
</div>
```

### CSS
```css
.quick-amounts-label {
  font-size: 13px;
  color: #9ca3af;
  margin-bottom: 8px;
  display: block;
}
```

---

## Helper Functions Needed

Add to `helpers.js` or relevant file:

```javascript
export function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US').format(amount);
}

export function formatCompactCurrency(amount) {
  if (amount >= 1_000_000_000) return `${amount / 1_000_000_000}B`;
  if (amount >= 1_000_000) return `${amount / 1_000_000}M`;
  if (amount >= 1_000) return `${amount / 1_000}K`;
  return amount.toString();
}
```

---

## Verification Checklist

After implementation, verify:

- [ ] No emoji allocations remain (🛡️📈🚀)
- [ ] Boundary badges show new labels (✓ Looks good, etc.)
- [ ] Holdings collapse by layer
- [ ] All assets show full names
- [ ] Loan cards have health bars
- [ ] No entry IDs visible in history
- [ ] Sidebar shows verb-based log entries
- [ ] Only 2 action buttons visible (Add Funds, Rebalance)
- [ ] Rebalance preview is collapsed by default
- [ ] No Stress toggle in UI
- [ ] Onboarding shows progress steps
- [ ] Minimum amount shown on input screen
- [ ] Layers have two-line descriptions
- [ ] Protection tab has header explanation
- [ ] Constraint messages use plain language
- [ ] Loan badge shows count only
- [ ] Empty states have CTAs
- [ ] Quick amounts have currency label

---

## Implementation Order (Suggested)

1. **Tasks 6, 10** — Removals (quickest)
2. **Tasks 1, 4, 7, 15, 20** — Text/label changes
3. **Tasks 2, 12, 13, 17** — Small component updates
4. **Tasks 8, 9, 11, 18** — New small components
5. **Tasks 3, 5, 14** — Larger component rewrites
