# Blu Markets v9.8 — Gap Fixes for Claude Code

## Context
- **Codebase:** React app with Vite
- **Source:** `src/`
- **Task:** Fix 6 remaining UX gaps before release

---

## GAP 1: Remove Stress Toggle

### Files to modify
- `src/App.jsx`

### Find and remove
Search for "Stress" or "stressMode" in the header/rightMeta section and remove:

```jsx
// REMOVE any stress toggle UI like:
<span>Stress</span>
// or
<Toggle label="Stress" ... />
// or  
○ Stress
```

The `stressMode` state can remain in the reducer (used internally for boundary escalation), but remove all UI elements that display or toggle it.

### Verification
- No "Stress" text or toggle visible in header area on any screen

---

## GAP 2: Text Labels + Colored Dots for Allocation

### Files to modify
- `src/components/PendingActionModal.jsx`

### Current code (lines ~184-195)
```jsx
<div className="previewLayers">
  <span className="layerDot foundation"></span> {Math.round(before.layerPct.FOUNDATION)}% · 
  <span className="layerDot growth"></span> {Math.round(before.layerPct.GROWTH)}% · 
  <span className="layerDot upside"></span> {Math.round(before.layerPct.UPSIDE)}%
</div>
```

### Replace with
```jsx
<div className="previewLayers">
  <span className="layerDot foundation"></span> Foundation {Math.round(before.layerPct.FOUNDATION)}% · 
  <span className="layerDot growth"></span> Growth {Math.round(before.layerPct.GROWTH)}% · 
  <span className="layerDot upside"></span> Upside {Math.round(before.layerPct.UPSIDE)}%
</div>
```

### Apply same change to AFTER section (~line 191)
```jsx
<div className="previewLayers">
  <span className="layerDot foundation"></span> Foundation {Math.round(after.layerPct.FOUNDATION)}% · 
  <span className="layerDot growth"></span> Growth {Math.round(after.layerPct.GROWTH)}% · 
  <span className="layerDot upside"></span> Upside {Math.round(after.layerPct.UPSIDE)}%
</div>
```

### Also update in HistoryPane.jsx (lines ~195-200)
Same pattern — add "Foundation", "Growth", "Upside" text after each layerDot.

### Verification
- BEFORE/AFTER preview shows: `● Foundation 36% · ● Growth 55% · ● Upside 9%`
- History expanded details show same format

---

## GAP 3: Collapse Holdings by Layer

### Files to modify
- `src/components/PortfolioHome.jsx`
- `src/styles/app.css`

### Step 1: Add state for expanded layers

In `PortfolioHome.jsx`, add state:
```jsx
const [expandedLayers, setExpandedLayers] = useState({
  FOUNDATION: false,
  GROWTH: false,
  UPSIDE: false
});

const toggleLayer = (layer) => {
  setExpandedLayers(prev => ({
    ...prev,
    [layer]: !prev[layer]
  }));
};
```

### Step 2: Create LayerGroup component

Add this component inside PortfolioHome.jsx or as separate file:

```jsx
function LayerGroup({ layer, holdings, protections, loans, expanded, onToggle, onStartTrade, onStartProtect, onStartBorrow }) {
  const layerInfo = LAYER_EXPLANATIONS[layer];
  const layerHoldings = holdings.filter(h => ASSET_LAYER[h.assetId] === layer);
  const totalValue = layerHoldings.reduce((sum, h) => sum + h.valueIRR, 0);
  const assetCount = layerHoldings.length;
  
  // Get protection days for each asset
  const getProtDays = (assetId) => {
    const p = protections?.find(pr => pr.assetId === assetId);
    if (!p) return null;
    const days = Math.ceil((new Date(p.endISO) - Date.now()) / (1000 * 60 * 60 * 24));
    return days > 0 ? days : null;
  };

  return (
    <div className={`layerGroup layer-${layer.toLowerCase()}`}>
      <div className="layerGroupHeader" onClick={onToggle}>
        <div className="layerGroupLeft">
          <span className={`layerDot ${layer.toLowerCase()}`}></span>
          <span className="layerGroupName">{layerInfo.name}</span>
        </div>
        <div className="layerGroupRight">
          <span className="layerGroupValue">{formatIRR(totalValue)}</span>
          <span className="layerGroupCount">{assetCount} asset{assetCount !== 1 ? 's' : ''}</span>
          <span className="layerGroupExpand">{expanded ? '▼' : '▶'}</span>
        </div>
      </div>
      
      {expanded && (
        <div className="layerGroupAssets">
          {layerHoldings.map(holding => (
            <HoldingRow
              key={holding.assetId}
              holding={holding}
              layerInfo={layerInfo}
              layer={layer}
              protDays={getProtDays(holding.assetId)}
              onStartTrade={onStartTrade}
              onStartProtect={onStartProtect}
              onStartBorrow={onStartBorrow}
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

### Step 3: Replace holdings list rendering

Find where holdings are currently mapped and replace with:

```jsx
<div className="holdingsSection">
  <div className="sectionHeader">HOLDINGS</div>
  {['FOUNDATION', 'GROWTH', 'UPSIDE'].map(layer => (
    <LayerGroup
      key={layer}
      layer={layer}
      holdings={holdings}
      protections={state.protections}
      loans={state.loans}
      expanded={expandedLayers[layer]}
      onToggle={() => toggleLayer(layer)}
      onStartTrade={onStartTrade}
      onStartProtect={onStartProtect}
      onStartBorrow={onStartBorrow}
    />
  ))}
</div>
```

### Step 4: Add CSS for layer groups

Add to `src/styles/app.css`:

```css
/* Layer Group - Collapsed Holdings */
.layerGroup {
  border-left: 3px solid;
  margin-bottom: 8px;
  background: rgba(255, 255, 255, 0.02);
  border-radius: 0 8px 8px 0;
}

.layerGroup.layer-foundation { border-color: #34d399; }
.layerGroup.layer-growth { border-color: #60a5fa; }
.layerGroup.layer-upside { border-color: #fbbf24; }

.layerGroupHeader {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 16px;
  cursor: pointer;
  transition: background 0.15s;
}

.layerGroupHeader:hover {
  background: rgba(255, 255, 255, 0.05);
}

.layerGroupLeft {
  display: flex;
  align-items: center;
  gap: 10px;
}

.layerGroupName {
  font-weight: 500;
  font-size: 15px;
}

.layerGroupRight {
  display: flex;
  align-items: center;
  gap: 16px;
}

.layerGroupValue {
  font-weight: 600;
  font-size: 15px;
}

.layerGroupCount {
  color: #9ca3af;
  font-size: 13px;
}

.layerGroupExpand {
  color: #6b7280;
  font-size: 12px;
  width: 16px;
  text-align: center;
}

.layerGroupAssets {
  border-top: 1px solid rgba(255, 255, 255, 0.05);
  padding: 8px 0;
}

.layerGroupAssets .holdingRow {
  margin-left: 12px;
  border-left: none;
}
```

### Verification
- Portfolio tab shows 3 collapsed layer groups by default
- Each shows: `● Foundation   325,000,000 IRR   2 assets   ▶`
- Clicking expands to show individual assets
- Clicking again collapses

---

## GAP 4: Two Primary Buttons + More Menu

### Files to modify
- `src/components/onboarding/OnboardingControls.jsx`

### Find the active stage buttons section

Look for the section that renders buttons in ACTIVE stage (around line 400+):

```jsx
// CURRENT - likely something like:
<button className="btn primary" onClick={...}>Add Funds</button>
<button className="btn" onClick={...}>Rebalance</button>
<button className="btn" onClick={...}>☂️ Protect</button>
<button className="btn" onClick={...}>💰 Borrow</button>
```

### Replace with
```jsx
<div className="actionButtonsRow">
  <button className="btn primary" onClick={() => dispatch({ type: 'START_ADD_FUNDS' })}>
    Add Funds
  </button>
  <button className="btn" onClick={() => dispatch({ type: 'START_REBALANCE' })}>
    Rebalance
  </button>
  <MoreMenu
    isOpen={moreMenuOpen}
    onToggle={() => setMoreMenuOpen(!moreMenuOpen)}
    onProtect={() => dispatch({ type: 'START_PROTECT' })}
    onBorrow={() => dispatch({ type: 'START_BORROW' })}
  />
</div>
```

### Ensure MoreMenu component is used

The `MoreMenu` component already exists (lines 49-73). Make sure it's being rendered in the active stage footer.

### Verify Reset button is separate and de-emphasized

Reset should remain but visually separate:
```jsx
<div className="resetRow">
  <button className="btn text" onClick={() => dispatch({ type: 'SHOW_RESET_CONFIRM' })}>
    ↺ Reset
  </button>
</div>
```

### Add CSS if needed

```css
.actionButtonsRow {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.resetRow {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.btn.text {
  background: transparent;
  color: #6b7280;
  padding: 8px 12px;
}

.btn.text:hover {
  color: #9ca3af;
}
```

### Verification
- Only [Add Funds] [Rebalance] [More ▼] visible in main row
- Clicking "More ▼" shows dropdown with "☂️ Protect" and "💰 Borrow"
- Reset button below, visually de-emphasized

---

## GAP 5: Fix OnboardingProgress Rendering

### Files to modify
- `src/components/onboarding/OnboardingControls.jsx`

### Current issue
`OnboardingProgress` component exists but may not render in all onboarding stages.

### Verify rendering in each stage

Check that `OnboardingProgress` is rendered for:
- `STAGES.WELCOME` — Step 1
- `STAGES.ONBOARDING_PHONE` — Step 1
- `STAGES.ONBOARDING_QUESTIONNAIRE` — Step 2
- `STAGES.ONBOARDING_RESULT` — Step 3
- `STAGES.AMOUNT_REQUIRED` — Step 4

### Pattern to follow

For each stage's return block, ensure OnboardingProgress is at the top:

```jsx
if (state.stage === STAGES.WELCOME) {
  return (
    <div>
      <OnboardingProgress currentStep={1} />
      {/* rest of welcome content */}
    </div>
  );
}

if (state.stage === STAGES.ONBOARDING_PHONE) {
  return (
    <div>
      <OnboardingProgress currentStep={1} />
      {/* rest of phone form */}
    </div>
  );
}

if (state.stage === STAGES.ONBOARDING_QUESTIONNAIRE) {
  return (
    <div>
      <OnboardingProgress currentStep={2} />
      {/* rest of questionnaire */}
    </div>
  );
}

if (state.stage === STAGES.ONBOARDING_RESULT) {
  return (
    <div>
      <OnboardingProgress currentStep={3} />
      {/* rest of result/consent */}
    </div>
  );
}

if (state.stage === STAGES.AMOUNT_REQUIRED) {
  return (
    <div>
      <OnboardingProgress currentStep={4} />
      {/* rest of amount input */}
    </div>
  );
}
```

### Verify OnboardingProgress component styling

Check that CSS exists for progress steps:

```css
.onboardingProgress {
  padding: 16px;
  margin-bottom: 16px;
}

.progressSteps {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.progressStep {
  display: flex;
  align-items: center;
  gap: 12px;
}

.stepNumber {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 600;
}

.progressStep.completed .stepNumber {
  background: #34d399;
  color: #000;
}

.progressStep.current .stepNumber {
  background: #6366f1;
  color: #fff;
}

.progressStep.upcoming .stepNumber {
  background: rgba(255, 255, 255, 0.1);
  color: #6b7280;
}

.stepLabel {
  font-size: 14px;
}

.progressStep.upcoming .stepLabel {
  color: #6b7280;
}
```

### Verification
- Left panel shows "Step X of 4" during all onboarding stages
- Current step highlighted, completed steps show checkmark or filled dot
- No "No actions yet" during onboarding

---

## GAP 6: Add Minimum Amount Hint

### Files to modify
- `src/components/onboarding/OnboardingControls.jsx` or `OnboardingRightPanel.jsx`

### Find the amount input section

Look for the AMOUNT_REQUIRED stage rendering, specifically where the input field is:

```jsx
<input
  type="text"
  value={amount}
  onChange={handleAmountChange}
  placeholder="Enter amount"
/>
```

### Add hint below input

```jsx
<div className="amountInputSection">
  <input
    type="text"
    value={amount}
    onChange={handleAmountChange}
    placeholder="Enter amount"
  />
  <p className="amountHint">Minimum: 1,000,000 IRR</p>
</div>
```

### Use constant for minimum value

Import and use the threshold constant:

```jsx
import { THRESHOLDS } from '../../constants/index.js';
import { formatIRR } from '../../helpers.js';

// In render:
<p className="amountHint">Minimum: {formatIRR(THRESHOLDS.MIN_AMOUNT_IRR)}</p>
```

### Add CSS

```css
.amountHint {
  font-size: 13px;
  color: #9ca3af;
  margin-top: 8px;
}
```

### Verification
- Amount input screen shows "Minimum: 1,000,000 IRR" below the input field

---

## Implementation Order

1. **Gap 1** (5 min) — Remove Stress toggle
2. **Gap 6** (5 min) — Add minimum hint
3. **Gap 2** (10 min) — Add text labels to allocation display
4. **Gap 5** (15 min) — Fix OnboardingProgress rendering
5. **Gap 4** (20 min) — Wire up MoreMenu for action buttons
6. **Gap 3** (45 min) — Implement collapsed holdings by layer

**Total estimated time: ~2 hours**

---

## Verification Checklist

After implementation, verify each screen:

- [ ] **Screen 1-2 (Onboarding):** Progress steps visible, no Stress toggle
- [ ] **Screen 2 (Amount):** Minimum amount hint shown below input
- [ ] **Screen 3 (Portfolio):** Holdings collapsed by layer, only 2+More buttons, no Stress toggle
- [ ] **Screen 5,7 (Preview):** Allocation shows `● Foundation X% · ● Growth Y% · ● Upside Z%`
- [ ] **All screens:** No Stress toggle anywhere

---

## Files Modified Summary

| File | Changes |
|------|---------|
| `App.jsx` | Remove Stress toggle from header |
| `components/PendingActionModal.jsx` | Add text labels to allocation |
| `components/HistoryPane.jsx` | Add text labels to allocation in details |
| `components/PortfolioHome.jsx` | Add LayerGroup, expandedLayers state |
| `components/onboarding/OnboardingControls.jsx` | Fix progress rendering, wire MoreMenu, add amount hint |
| `styles/app.css` | Add layerGroup styles, amountHint style |
