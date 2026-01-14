# Blu Markets v10 — Color Simplification Implementation Guide

## Overview

**Problem:** The current UI has visual chaos from too many colors competing for attention. Layer colors (green/blue/orange) conflict with semantic colors (green=success, orange=warning), creating confusion.

**Solution:** Adopt a **Monochrome + Blue Accent** design:
- **Blue** (#3B82F6) for interactive elements only (buttons, active tabs, links)
- **Gray scale** for everything else (text, backgrounds, borders)
- **Remove all layer-specific colors** — differentiate layers by position and labels only
- **Keep semantic colors** (green success, orange warning, red danger) only for true alerts

---

## File Changes Summary

| File | Changes |
|------|---------|
| `src/styles/app.css` | CSS variable updates, remove layer colors, simplify health bars |
| `src/components/LayerMini.jsx` | Remove layerDot element |
| `src/components/PortfolioHome.jsx` | Remove layerDot from layer section headers |
| `src/components/HoldingRow.jsx` | Remove layerDot from holding rows, simplify border colors |
| `src/components/HistoryPane.jsx` | Remove layerDots from before/after allocation display |
| `src/components/Loans.jsx` | Change health bar to single blue color |
| `src/components/ActionLogPane.jsx` | Remove colored border-left indicators |

---

## PART 1: CSS Changes (src/styles/app.css)

### 1.1 Remove Layer Color Variables (Lines 44-47)

**FIND:**
```css
  /* === LAYER DOTS (blue opacity scale) === */
  --layer-foundation: var(--color-primary);
  --layer-growth: var(--color-primary-muted);
  --layer-upside: var(--color-primary-faint);
```

**REPLACE WITH:**
```css
  /* === LAYER COLORS REMOVED === */
  /* Layers are now differentiated by position and labels only */
```

---

### 1.2 Remove Layer Dot Styles (Lines 153-159)

**FIND:**
```css
/* Layer dots */
.layerHeader { display: flex; align-items: center; gap: 6px; margin-bottom: 4px; }
.layerDot { width: 6px; height: 6px; border-radius: 50%; display: inline-block; }
.layerDot.foundation { background: var(--layer-foundation); }
.layerDot.growth { background: var(--layer-growth); }
.layerDot.upside { background: var(--layer-upside); }
.layerDot.faded { opacity: 0.4; }
```

**REPLACE WITH:**
```css
/* Layer headers - no colored dots */
.layerHeader { display: flex; align-items: center; gap: 6px; margin-bottom: 4px; }
```

---

### 1.3 Simplify Log Entry Borders (Lines 170-176)

**FIND:**
```css
.logEntry { padding: 6px 0; color: var(--text-secondary); border-bottom: 1px solid var(--border); }
.logEntry:last-child { border-bottom: none; }
.logEntry.drift { border-left: 2px solid var(--warning); padding-left: 8px; margin-left: -2px; }
.logEntry.structural { border-left: 2px solid var(--danger); padding-left: 8px; margin-left: -2px; }
.logBoundaryDot { display: inline-block; width: 6px; height: 6px; border-radius: 50%; margin-right: 6px; }
.logBoundaryDot.drift { background: var(--warning); }
.logBoundaryDot.structural { background: var(--danger); }
```

**REPLACE WITH:**
```css
.logEntry { padding: 6px 0; color: var(--text-secondary); border-bottom: 1px solid var(--border); }
.logEntry:last-child { border-bottom: none; }
/* Removed colored border indicators - all entries look the same */
.logEntry.drift { }
.logEntry.structural { }
```

---

### 1.4 Simplify Price Indicator (Lines 191-201)

**FIND:**
```css
/* v10: Price indicator */
.priceIndicator { display: flex; align-items: center; gap: 6px; margin-bottom: 16px; padding: 6px 0; }
.priceIndicatorDot { width: 6px; height: 6px; border-radius: 50%; animation: pulse 2s infinite; }
.priceIndicator.live .priceIndicatorDot { background: var(--success); }
.priceIndicator.loading .priceIndicatorDot { background: var(--warning); animation: blink 1s infinite; }
.priceIndicator.error .priceIndicatorDot { background: var(--text-muted); animation: none; }
.priceIndicatorText { font-size: 11px; color: var(--text-secondary); font-weight: 500; }
.priceIndicator.live .priceIndicatorText { color: var(--success); }
.priceIndicator.error .priceIndicatorText { color: var(--text-muted); }
.priceIndicatorTime { font-size: 10px; color: var(--text-muted); margin-left: 4px; }
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
@keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
```

**REPLACE WITH:**
```css
/* v10: Price indicator - monochrome */
.priceIndicator { display: flex; align-items: center; gap: 6px; margin-bottom: 16px; padding: 6px 0; }
.priceIndicatorDot { width: 6px; height: 6px; border-radius: 50%; background: var(--text-muted); }
.priceIndicator.live .priceIndicatorDot { background: var(--text-secondary); animation: pulse 2s infinite; }
.priceIndicator.loading .priceIndicatorDot { animation: blink 1s infinite; }
.priceIndicator.error .priceIndicatorDot { opacity: 0.5; }
.priceIndicatorText { font-size: 11px; color: var(--text-secondary); font-weight: 500; }
.priceIndicatorTime { font-size: 10px; color: var(--text-muted); margin-left: 4px; }
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
@keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
```

---

### 1.5 Simplify Loan Health Bar Colors (Lines 408-417)

**FIND:**
```css
.loanHealthIndicator { display: flex; align-items: center; gap: 8px; margin-top: 4px; }
.loanHealthBar { flex: 1; height: 6px; background: var(--bg-primary); border-radius: 3px; overflow: hidden; }
.loanHealthFill { height: 100%; border-radius: 3px; transition: width 0.3s, background 0.3s; }
.loanHealthFill.healthy { background: var(--success); }
.loanHealthFill.warning { background: var(--warning); }
.loanHealthFill.critical { background: var(--danger); }
.loanHealthText { font-size: 11px; font-weight: 500; min-width: 40px; text-align: right; }
.loanHealthText.healthy { color: var(--success); }
.loanHealthText.warning { color: var(--warning); }
.loanHealthText.critical { color: var(--danger); }
```

**REPLACE WITH:**
```css
.loanHealthIndicator { display: flex; align-items: center; gap: 8px; margin-top: 4px; }
.loanHealthBar { flex: 1; height: 6px; background: var(--bg-primary); border-radius: 3px; overflow: hidden; }
.loanHealthFill { height: 100%; border-radius: 3px; transition: width 0.3s; background: var(--color-primary); }
/* All health states use same blue bar - percentage tells the story */
.loanHealthFill.healthy { background: var(--color-primary); }
.loanHealthFill.warning { background: var(--color-primary); }
.loanHealthFill.critical { background: var(--color-primary); }
.loanHealthText { font-size: 11px; font-weight: 500; min-width: 40px; text-align: right; color: var(--text-secondary); }
.loanHealthText.healthy { color: var(--text-secondary); }
.loanHealthText.warning { color: var(--text-secondary); }
.loanHealthText.critical { color: var(--text-secondary); }
```

---

### 1.6 Simplify Holding Row Layer Borders (Lines 578-584)

**FIND:**
```css
.holdingsList { display: flex; flex-direction: column; gap: 8px; }
.holdingRow { display: flex; align-items: center; padding: 14px; background: var(--bg-secondary); border: 1px solid var(--border); border-radius: 10px; margin-bottom: 0; border-left-width: 3px; border-left-style: solid; gap: 12px; }
.holdingRow.layer-foundation { border-left-color: #34d399; }
.holdingRow.layer-growth { border-left-color: #60a5fa; }
.holdingRow.layer-upside { border-left-color: #fbbf24; }
.holdingRow.assetEmpty { opacity: 0.5; background: repeating-linear-gradient(45deg, var(--bg-secondary), var(--bg-secondary) 10px, rgba(255, 255, 255, 0.02) 10px, rgba(255, 255, 255, 0.02) 20px); }
.holdingRow.assetEmpty .holdingName { color: var(--text-muted); }
.holdingRow.assetEmpty .holdingValue { color: var(--text-muted); }
```

**REPLACE WITH:**
```css
.holdingsList { display: flex; flex-direction: column; gap: 8px; }
.holdingRow { display: flex; align-items: center; padding: 14px; background: var(--bg-secondary); border: 1px solid var(--border); border-radius: 10px; margin-bottom: 0; gap: 12px; }
/* Removed colored left borders - layers distinguished by grouping only */
.holdingRow.layer-foundation { }
.holdingRow.layer-growth { }
.holdingRow.layer-upside { }
.holdingRow.assetEmpty { opacity: 0.5; background: repeating-linear-gradient(45deg, var(--bg-secondary), var(--bg-secondary) 10px, rgba(255, 255, 255, 0.02) 10px, rgba(255, 255, 255, 0.02) 20px); }
.holdingRow.assetEmpty .holdingName { color: var(--text-muted); }
.holdingRow.assetEmpty .holdingValue { color: var(--text-muted); }
```

---

### 1.7 Simplify Allocation Bar Colors (Lines 524-528)

**FIND:**
```css
.allocationViz { display: flex; gap: 2px; height: 40px; margin-bottom: 16px; border-radius: 6px; overflow: hidden; }
.allocationBar { display: flex; flex-direction: column; align-items: center; justify-content: center; }
.allocationBar.foundation { background: var(--layer-foundation); }
.allocationBar.growth { background: var(--layer-growth); }
.allocationBar.upside { background: var(--layer-upside); }
```

**REPLACE WITH:**
```css
.allocationViz { display: flex; gap: 2px; height: 40px; margin-bottom: 16px; border-radius: 6px; overflow: hidden; }
.allocationBar { display: flex; flex-direction: column; align-items: center; justify-content: center; }
/* All allocation bars use blue with varying opacity */
.allocationBar.foundation { background: var(--color-primary); }
.allocationBar.growth { background: var(--color-primary-muted); }
.allocationBar.upside { background: var(--color-primary-faint); }
```

---

### 1.8 Simplify Ledger Entry Borders (Lines 331-332)

**FIND:**
```css
.ledgerEntry.structural { border-left: 3px solid var(--warning); }
.ledgerEntry.stress { border-left: 3px solid var(--danger); }
```

**REPLACE WITH:**
```css
/* Removed colored borders for ledger entries */
.ledgerEntry.structural { }
.ledgerEntry.stress { }
```

---

### 1.9 Remove Layer Fill Colors (Lines 870-872)

**FIND:**
```css
.layer-fill.foundation { background: var(--layer-foundation); }
.layer-fill.growth { background: var(--layer-growth); }
.layer-fill.upside { background: var(--layer-upside); }
```

**REPLACE WITH:**
```css
/* All layer fills use blue scale */
.layer-fill.foundation { background: var(--color-primary); }
.layer-fill.growth { background: var(--color-primary-muted); }
.layer-fill.upside { background: var(--color-primary-faint); }
```

---

### 1.10 Remove Layer Dot Colors in Profile Result (Lines 841-843)

**FIND:**
```css
.layer-dot.foundation { background: var(--layer-foundation); }
.layer-dot.growth { background: var(--layer-growth); }
```

**REPLACE WITH:**
```css
/* Layer dots use blue opacity scale */
.layer-dot.foundation { background: var(--color-primary); }
.layer-dot.growth { background: var(--color-primary-muted); }
.layer-dot.upside { background: var(--color-primary-faint); }
```

---

### 1.11 Simplify Onboarding Progress Colors (Lines 487-488)

**FIND:**
```css
.progressStep.completed .stepNumber { background: var(--success); border-color: var(--success); color: white; }
.progressStep.completed .stepLabel { color: var(--text-secondary); }
```

**REPLACE WITH:**
```css
.progressStep.completed .stepNumber { background: var(--color-primary-muted); border-color: var(--color-primary-muted); color: white; }
.progressStep.completed .stepLabel { color: var(--text-secondary); }
```

---

### 1.12 Simplify Questionnaire Progress Bar (Lines 957-958)

**FIND:**
```css
.progress-bar-fill {
  height: 100%;
  background: #4ade80;
  border-radius: 2px;
  transition: width 0.3s ease;
}
```

**REPLACE WITH:**
```css
.progress-bar-fill {
  height: 100%;
  background: var(--color-primary);
  border-radius: 2px;
  transition: width 0.3s ease;
}
```

---

### 1.13 Simplify Continue Button in Profile Result (Lines 918-920)

**FIND:**
```css
.profile-result .continue-btn {
  width: 100%;
  padding: 16px;
  background: #4ade80;
  color: #000;
  font-size: 16px;
  font-weight: 600;
  border: none;
  border-radius: 12px;
  cursor: pointer;
  transition: background 0.2s;
}

.profile-result .continue-btn:hover {
  background: #22c55e;
}
```

**REPLACE WITH:**
```css
.profile-result .continue-btn {
  width: 100%;
  padding: 16px;
  background: var(--color-primary);
  color: white;
  font-size: 16px;
  font-weight: 600;
  border: none;
  border-radius: 12px;
  cursor: pointer;
  transition: background 0.2s;
}

.profile-result .continue-btn:hover {
  background: var(--color-primary-hover);
}
```

---

### 1.14 Simplify Limiting Factor Box (Lines 874-887)

**FIND:**
```css
/* Limiting Factor */
.limiting-factor {
  text-align: center;
  padding: 12px;
  background: rgba(74, 222, 128, 0.1);
  border-radius: 8px;
  border: 1px solid rgba(74, 222, 128, 0.2);
}

.limiting-factor .factor-label {
  font-size: 13px;
  color: rgba(74, 222, 128, 0.9);
  margin: 0;
}
```

**REPLACE WITH:**
```css
/* Limiting Factor */
.limiting-factor {
  text-align: center;
  padding: 12px;
  background: var(--bg-tertiary);
  border-radius: 8px;
  border: 1px solid var(--border);
}

.limiting-factor .factor-label {
  font-size: 13px;
  color: var(--text-secondary);
  margin: 0;
}
```

---

### 1.15 Remove Fixed Income Accrued Green Color (Line 206)

**FIND:**
```css
.fixedIncomeBreakdown .accrued { color: var(--success); font-weight: 500; }
```

**REPLACE WITH:**
```css
.fixedIncomeBreakdown .accrued { color: var(--text-primary); font-weight: 500; }
```

---

### 1.16 Simplify Layer Status Colors (Lines 617-618)

**FIND:**
```css
.layerStatus.on-target { color: var(--success); }
.layerStatus.off-target { color: var(--text-muted); }
```

**REPLACE WITH:**
```css
.layerStatus.on-target { color: var(--text-secondary); }
.layerStatus.off-target { color: var(--text-muted); }
```

---

## PART 2: Component Changes

### 2.1 LayerMini.jsx — Remove Layer Dot

**FILE:** `src/components/LayerMini.jsx`

**FIND (Lines 11-19):**
```jsx
  return (
    <div className="mini">
      <div className="layerHeader">
        <span className={`layerDot ${layer.toLowerCase()}`}></span>
        <span className="tag">{info.name}</span>
      </div>
      <div className="big" style={{ fontSize: 20 }}>{Math.round(pct)}%</div>
      <div className="muted">Target {target}%</div>
    </div>
  );
```

**REPLACE WITH:**
```jsx
  return (
    <div className="mini">
      <div className="layerHeader">
        <span className="tag">{info.name}</span>
      </div>
      <div className="big" style={{ fontSize: 20 }}>{Math.round(pct)}%</div>
      <div className="muted">Target {target}%</div>
    </div>
  );
```

---

### 2.2 PortfolioHome.jsx — Remove Layer Dot from Section Headers

**FILE:** `src/components/PortfolioHome.jsx`

**FIND (Lines 209-211):**
```jsx
              <div
                className="layerSectionHeader collapsible"
                onClick={() => toggleLayer(layer)}
              >
                <span className={`layerDot ${layer.toLowerCase()}`}></span>
                <div className="layerHeaderContent">
```

**REPLACE WITH:**
```jsx
              <div
                className="layerSectionHeader collapsible"
                onClick={() => toggleLayer(layer)}
              >
                <div className="layerHeaderContent">
```

---

### 2.3 HoldingRow.jsx — Remove Layer Dot from Holdings

**FILE:** `src/components/HoldingRow.jsx`

**FIND (Lines 33-38):**
```jsx
        <div className="holdingLayer">
          <span className={`layerDot ${layer.toLowerCase()}`}></span>
          {layerInfo.name}
          {protDays !== null ? ` · ☂️ Protected (${protDays}d)` : ''}
          {holding.frozen ? ` · 🔒 Locked` : ''}
        </div>
```

**REPLACE WITH:**
```jsx
        <div className="holdingLayer">
          {layerInfo.name}
          {protDays !== null ? ' · ☂️ Protected (' + protDays + 'd)' : ''}
          {holding.frozen ? ' · 🔒 Locked' : ''}
        </div>
```

---

### 2.4 HistoryPane.jsx — Remove Layer Dots from Before/After Display

**FILE:** `src/components/HistoryPane.jsx`

**FIND (Lines 186-193):**
```jsx
                          <div className="layerChange">
                            <div className="changeRow">
                              <span className="changeLabel">Before:</span>
                              <span><span className="layerDot foundation"></span> Foundation {Math.round(entry.details.before.layerPct.FOUNDATION)}% · <span className="layerDot growth"></span> Growth {Math.round(entry.details.before.layerPct.GROWTH)}% · <span className="layerDot upside"></span> Upside {Math.round(entry.details.before.layerPct.UPSIDE)}%</span>
                            </div>
                            <div className="changeRow">
                              <span className="changeLabel">After:</span>
                              <span><span className="layerDot foundation"></span> Foundation {Math.round(entry.details.after.layerPct.FOUNDATION)}% · <span className="layerDot growth"></span> Growth {Math.round(entry.details.after.layerPct.GROWTH)}% · <span className="layerDot upside"></span> Upside {Math.round(entry.details.after.layerPct.UPSIDE)}%</span>
                            </div>
                          </div>
```

**REPLACE WITH:**
```jsx
                          <div className="layerChange">
                            <div className="changeRow">
                              <span className="changeLabel">Before:</span>
                              <span>Foundation {Math.round(entry.details.before.layerPct.FOUNDATION)}% · Growth {Math.round(entry.details.before.layerPct.GROWTH)}% · Upside {Math.round(entry.details.before.layerPct.UPSIDE)}%</span>
                            </div>
                            <div className="changeRow">
                              <span className="changeLabel">After:</span>
                              <span>Foundation {Math.round(entry.details.after.layerPct.FOUNDATION)}% · Growth {Math.round(entry.details.after.layerPct.GROWTH)}% · Upside {Math.round(entry.details.after.layerPct.UPSIDE)}%</span>
                            </div>
                          </div>
```

---

### 2.5 Loans.jsx — Simplify Health Bar to Single Blue Color

**FILE:** `src/components/Loans.jsx`

**FIND (Lines 31-37):**
```jsx
  // Issue 5: Enhanced loan status with health bar colors
  const getLoanHealth = (loan) => {
    const usedPercent = (loan.amountIRR / loan.liquidationIRR) * 100;
    if (usedPercent >= 75) return { level: 'critical', color: '#ef4444', message: `If ${getAssetDisplayName(loan.collateralAssetId)} drops ${Math.round(100 - usedPercent)}%, this loan will auto-close.` };
    if (usedPercent >= 65) return { level: 'warning', color: '#f97316', message: 'Close to limit. Consider repaying soon.' };
    if (usedPercent >= 50) return { level: 'caution', color: '#fbbf24', message: null };
    return { level: 'healthy', color: '#34d399', message: null };
  };
```

**REPLACE WITH:**
```jsx
  // Issue 5: Enhanced loan status - monochrome health bar
  const getLoanHealth = (loan) => {
    const usedPercent = (loan.amountIRR / loan.liquidationIRR) * 100;
    // All bars use blue - percentage tells the story
    const color = '#3B82F6';
    if (usedPercent >= 75) return { level: 'critical', color, message: `If ${getAssetDisplayName(loan.collateralAssetId)} drops ${Math.round(100 - usedPercent)}%, this loan will auto-close.` };
    if (usedPercent >= 65) return { level: 'warning', color, message: 'Close to limit. Consider repaying soon.' };
    if (usedPercent >= 50) return { level: 'caution', color, message: null };
    return { level: 'healthy', color, message: null };
  };
```

**ALSO FIND (Lines 87-89):**
```jsx
                <div className="healthLabelRow">
                  <span className="healthPercent" style={{ color: health.color }}>{Math.round(usedPercent)}% used</span>
                  <span className="healthLimit">Limit: {formatIRR(loan.liquidationIRR)}</span>
                </div>
```

**REPLACE WITH:**
```jsx
                <div className="healthLabelRow">
                  <span className="healthPercent">{Math.round(usedPercent)}% used</span>
                  <span className="healthLimit">Limit: {formatIRR(loan.liquidationIRR)}</span>
                </div>
```

---

## PART 3: Verification Checklist

After making all changes, verify the following:

1. **Portfolio Home**
   - [ ] Layer cards show NO colored dots (just text: "FOUNDATION", "GROWTH", "UPSIDE")
   - [ ] Layer section headers have NO colored dots
   - [ ] Holding rows have NO colored left borders
   - [ ] Loan summary bar is blue (not green/yellow/red gradient)
   - [ ] Price indicator dot is gray (not green)

2. **History Tab**
   - [ ] Before/After allocation shows text only, NO colored dots
   - [ ] Ledger entries have NO colored left borders

3. **Loans Tab**
   - [ ] Health bars are ALL blue regardless of percentage
   - [ ] Health percentage text is gray, NOT colored

4. **Onboarding**
   - [ ] Progress bar is blue (not green)
   - [ ] Completed steps use blue (not green)
   - [ ] Continue button is blue (not green)

5. **Action Log (Left Panel)**
   - [ ] Log entries have NO colored border indicators
   - [ ] All dots are gray

---

## Summary of Color Philosophy

**BEFORE (Problematic):**
- Green = Foundation layer = Success = Price feed live = Healthy loan
- Blue = Growth layer = Active tab = Primary button
- Orange = Upside layer = Warning = Loan caution

**AFTER (Clean):**
- Blue = Interactive elements (buttons, tabs, links)
- Gray = All informational elements (text, labels, bars)
- Green/Orange/Red = ONLY for genuine alerts (kept in warning messages, danger buttons)

The user's eye now knows: "If it's blue, I can click it. If it's colored, something needs attention."
