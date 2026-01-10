# Blu Markets — Prototype Improvement Plan

> **Version:** 1.0
> **Based on:** Product Description v7.6, Canonical Design & Decision Log, Hybrid Product & Rationale
> **Current State:** Logic mature, UX minimal, direction clear

---

## Overview

This document outlines a phase-by-phase plan to improve the Blu Markets prototype from its current minimal UX state to a production-ready portfolio integrity system.

### Product Identity (Reference)

Blu Markets is a **portfolio integrity system** for non-professional users under economic stress. It provides:

- **Agency with guardrails** — Freedom to act, friction only when actions threaten structural integrity
- **Portfolio-first thinking** — Not asset-first, not trading-first
- **Three-layer allocation** — Foundation / Growth / Upside
- **Execution pattern** — Preview → Friction → Confirm → Commit

### Current Tech Stack

- **Framework:** React 18 + Vite 5
- **State Management:** useReducer with localStorage persistence
- **Architecture:** Deterministic state machine (`src/stateMachine.js`)
- **Styling:** Plain CSS (`src/styles.css`)

### Key Files Reference

| File | Purpose |
|------|---------|
| `src/App.jsx` | Main app shell, two-panel layout |
| `src/stateMachine.js` | All state transitions, business logic |
| `src/engine.js` | Portfolio calculations, trading logic |
| `src/boundaries.js` | Decision boundary layer logic |
| `src/components/PortfolioHome.jsx` | Main portfolio view |
| `src/components/OnboardingControls.jsx` | Onboarding flow UI |
| `src/components/MessagesPane.jsx` | Chat-style message log |
| `src/data/questionnaire.fa.json` | Persian questionnaire data |

---

## Phase 1: Core UX Polish

**Goal:** Make the prototype feel usable, professional, and complete.

### 1.1 Typography & Visual Hierarchy

**Current state:** Basic styling with minimal hierarchy.

**Requirements:**
- [ ] Define type scale (headings, body, captions, labels)
- [ ] Add consistent spacing system (8px grid recommended)
- [ ] Improve color contrast for accessibility (WCAG AA minimum)
- [ ] Add visual weight to primary actions vs secondary

**Implementation notes:**
```css
/* Example type scale */
--font-size-xs: 0.75rem;   /* 12px - captions */
--font-size-sm: 0.875rem;  /* 14px - labels */
--font-size-base: 1rem;    /* 16px - body */
--font-size-lg: 1.25rem;   /* 20px - subheadings */
--font-size-xl: 1.5rem;    /* 24px - headings */
--font-size-2xl: 2rem;     /* 32px - titles */
```

**Files to modify:**
- `src/styles.css` — Add CSS custom properties for design tokens
- All components — Apply consistent class naming

### 1.2 Persian/RTL Support

**Current state:** Persian text in questionnaire, but no RTL layout support.

**Requirements:**
- [ ] Add `dir="rtl"` support for Persian content
- [ ] Ensure questionnaire renders correctly in RTL
- [ ] Add Vazirmatn or similar Persian font
- [ ] Handle mixed LTR/RTL content (numbers, English terms)

**Implementation notes:**
```jsx
// Detect Persian content and apply RTL
const isPersian = (text) => /[\u0600-\u06FF]/.test(text);

// In component:
<div dir={isPersian(content) ? 'rtl' : 'ltr'}>
  {content}
</div>
```

**Files to modify:**
- `index.html` — Add Persian font import
- `src/styles.css` — Add RTL-specific styles
- `src/components/MessagesPane.jsx` — Detect and apply RTL per message
- `src/components/OnboardingControls.jsx` — RTL for questionnaire options

### 1.3 Mobile Responsiveness

**Current state:** Fixed two-panel desktop layout.

**Requirements:**
- [ ] Single-column layout on mobile (< 768px)
- [ ] Collapsible/tabbed panels on mobile
- [ ] Touch-friendly button sizes (min 44px tap targets)
- [ ] Horizontal scroll prevention

**Implementation notes:**
```css
/* Breakpoints */
--breakpoint-sm: 640px;
--breakpoint-md: 768px;
--breakpoint-lg: 1024px;

@media (max-width: 768px) {
  .container {
    flex-direction: column;
  }
  .panel {
    width: 100%;
    height: auto;
  }
}
```

**Files to modify:**
- `src/styles.css` — Add media queries
- `src/App.jsx` — Consider mobile navigation pattern

### 1.4 Loading & Transition States

**Current state:** No loading indicators, instant state changes.

**Requirements:**
- [ ] Add loading spinner component
- [ ] Skeleton states for portfolio data
- [ ] Smooth transitions between onboarding steps
- [ ] Button loading states during async actions

**New files to create:**
- `src/components/Spinner.jsx`
- `src/components/Skeleton.jsx`

**Implementation notes:**
```jsx
// Spinner component
export function Spinner({ size = 20 }) {
  return <div className="spinner" style={{ width: size, height: size }} />;
}

// CSS animation
.spinner {
  border: 2px solid #e5e7eb;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}
```

### 1.5 Error States

**Current state:** Errors shown only in chat log.

**Requirements:**
- [ ] Inline validation errors on inputs
- [ ] Toast notifications for action errors
- [ ] Visual error state for form fields (red border, icon)
- [ ] Retry affordance for failed actions

**New files to create:**
- `src/components/Toast.jsx`
- `src/components/FormField.jsx` (with error state)

---

## Phase 2: Decision Boundary Layer Visualization

**Goal:** Make SAFE/DRIFT/STRUCTURAL/STRESS boundaries visible and intuitive.

### 2.1 Boundary Classification

**Reference:** The Decision Boundary Layer classifies every action:

| Level | Meaning | UI Treatment |
|-------|---------|--------------|
| SAFE | Within target, no risk | Green, immediate execution |
| DRIFT | Minor deviation from target | Yellow, soft warning |
| STRUCTURAL | Threatens portfolio integrity | Orange, friction required |
| STRESS | Crisis-level action | Red, high friction + confirmation |

**Current state:** `src/boundaries.js` exists but UI doesn't visualize boundaries.

**Requirements:**
- [ ] Color-code actions based on boundary classification
- [ ] Show boundary level before Preview step
- [ ] Visual indicator in action buttons (Buy/Sell/Rebalance)

**Files to modify:**
- `src/boundaries.js` — Ensure all boundary logic is exported
- `src/components/PortfolioHome.jsx` — Add boundary indicators to actions

### 2.2 Allocation Visualization

**Current state:** Text-only display of Foundation/Growth/Upside percentages.

**Requirements:**
- [ ] Stacked bar chart showing current allocation
- [ ] Target allocation overlay/comparison
- [ ] Drift indicator (delta from target)
- [ ] Color coding: Foundation (blue), Growth (green), Upside (orange)

**New files to create:**
- `src/components/AllocationBar.jsx`

**Implementation notes:**
```jsx
// AllocationBar component
export function AllocationBar({ current, target }) {
  return (
    <div className="allocation-bar">
      <div className="bar-segment foundation" style={{ width: `${current.foundation}%` }} />
      <div className="bar-segment growth" style={{ width: `${current.growth}%` }} />
      <div className="bar-segment upside" style={{ width: `${current.upside}%` }} />
      {/* Target markers */}
      <div className="target-marker" style={{ left: `${target.foundation}%` }} />
      <div className="target-marker" style={{ left: `${target.foundation + target.growth}%` }} />
    </div>
  );
}
```

### 2.3 Drift Detection UI

**Current state:** No visual drift warning.

**Requirements:**
- [ ] Calculate drift from target allocation
- [ ] Show drift percentage per layer
- [ ] Trigger visual warning when drift exceeds threshold (e.g., 5%)
- [ ] Suggest rebalance when drift is significant

**Implementation notes:**
```javascript
// Drift calculation
function calculateDrift(current, target) {
  return {
    foundation: current.foundation - target.foundation,
    growth: current.growth - target.growth,
    upside: current.upside - target.upside,
  };
}

function isDriftSignificant(drift, threshold = 5) {
  return Math.abs(drift.foundation) > threshold ||
         Math.abs(drift.growth) > threshold ||
         Math.abs(drift.upside) > threshold;
}
```

### 2.4 Stress Mode Toggle

**Reference:** "Visible UI toggle to simulate crisis conditions" (Product Description v7.6)

**Current state:** Not implemented.

**Requirements:**
- [ ] Add toggle switch in header or settings
- [ ] When active: escalate all boundary checks by one level
- [ ] Visual indicator that Stress Mode is active (red banner/badge)
- [ ] Persist Stress Mode state in localStorage

**Implementation notes:**
```javascript
// In stateMachine.js
case 'TOGGLE_STRESS_MODE': {
  return { ...state, stressMode: !state.stressMode };
}

// In boundary checks
function classifyAction(action, state) {
  let level = computeBoundaryLevel(action, state);
  if (state.stressMode) {
    level = escalateBoundary(level); // SAFE→DRIFT, DRIFT→STRUCTURAL, etc.
  }
  return level;
}
```

**Files to modify:**
- `src/stateMachine.js` — Add stressMode state and toggle
- `src/App.jsx` — Add Stress Mode toggle UI
- `src/boundaries.js` — Add escalation logic

---

## Phase 3: Preview → Friction → Confirm Flow

**Goal:** Make the execution pattern tangible and trustworthy.

### 3.1 Preview Cards

**Current state:** Preview shown as numbers in chat log.

**Requirements:**
- [ ] Visual before/after comparison card
- [ ] Show total portfolio value change
- [ ] Show layer allocation change (with arrows/deltas)
- [ ] Highlight what's changing

**New files to create:**
- `src/components/PreviewCard.jsx`

**Implementation notes:**
```jsx
export function PreviewCard({ preview }) {
  const { before, after, deltas } = preview;
  return (
    <div className="preview-card">
      <div className="preview-section">
        <h4>Before</h4>
        <div className="value">{formatIRR(before.totalIRR)}</div>
        <AllocationBar current={before.layers} />
      </div>
      <div className="preview-arrow">→</div>
      <div className="preview-section">
        <h4>After</h4>
        <div className="value">{formatIRR(after.totalIRR)}</div>
        <AllocationBar current={after.layers} />
      </div>
      <div className="preview-delta">
        <DeltaIndicator value={deltas.totalIRR} label="Total" />
      </div>
    </div>
  );
}
```

### 3.2 Friction UI

**Current state:** Soft warnings shown in chat only.

**Requirements:**
- [ ] Warning banner for DRIFT actions
- [ ] Modal dialog for STRUCTURAL actions
- [ ] Full-screen confirmation for STRESS actions
- [ ] Clear explanation of why friction is applied

**New files to create:**
- `src/components/FrictionModal.jsx`
- `src/components/WarningBanner.jsx`

**Implementation notes:**
```jsx
// Friction levels determine UI
function getFrictionUI(boundaryLevel) {
  switch (boundaryLevel) {
    case 'SAFE': return null;
    case 'DRIFT': return <WarningBanner />;
    case 'STRUCTURAL': return <FrictionModal confirmText="I understand the risk" />;
    case 'STRESS': return <FrictionModal fullScreen confirmText="Type 'CONFIRM' to proceed" />;
  }
}
```

### 3.3 Confirmation Dialogs

**Current state:** Simple button click to confirm.

**Requirements:**
- [ ] Modal-based confirmation for all post-preview actions
- [ ] Show summary of what will happen
- [ ] Cancel and Confirm buttons with clear hierarchy
- [ ] For STRESS: require typing confirmation phrase

**Files to modify:**
- `src/components/OnboardingControls.jsx` — Replace inline confirms with modal triggers

### 3.4 Animated Transitions

**Current state:** Instant state changes.

**Requirements:**
- [ ] Fade/slide transitions between states
- [ ] Progress animation during execution
- [ ] Success/failure animation after commit
- [ ] Smooth number animations for value changes

**Implementation notes:**
```css
/* Transition classes */
.fade-enter { opacity: 0; }
.fade-enter-active { opacity: 1; transition: opacity 200ms; }
.fade-exit { opacity: 1; }
.fade-exit-active { opacity: 0; transition: opacity 200ms; }

/* Or use CSS transitions on state change */
.preview-card {
  transition: transform 200ms ease-out, opacity 200ms ease-out;
}
```

---

## Phase 4: Event Ledger & History

**Goal:** Immutable action logging with full visibility.

### 4.1 Ledger Data Structure

**Current state:** `src/ledger.js` exists, `Ledger.jsx` component exists but minimal.

**Requirements:**
- [ ] Log all state-changing actions with timestamp
- [ ] Include: action type, amount, before/after state snapshot
- [ ] Assign unique ID to each entry
- [ ] Persist ledger in localStorage (separate from main state)

**Implementation notes:**
```javascript
// Ledger entry structure
const ledgerEntry = {
  id: crypto.randomUUID(),
  timestamp: new Date().toISOString(),
  action: 'CONFIRM_TRADE_FINAL',
  details: {
    assetId: 'BTC',
    side: 'BUY',
    amountIRR: 5000000,
  },
  before: { totalIRR: 100000000, layers: { ... } },
  after: { totalIRR: 105000000, layers: { ... } },
};
```

**Files to modify:**
- `src/ledger.js` — Implement full ledger logic
- `src/stateMachine.js` — Add ledger entries on commits

### 4.2 Ledger UI

**Current state:** Basic Ledger.jsx component exists.

**Requirements:**
- [ ] Timeline view of all actions
- [ ] Expandable entries to show details
- [ ] Visual icons per action type
- [ ] Relative timestamps ("2 hours ago")

**Files to modify:**
- `src/components/Ledger.jsx` — Full implementation

**Implementation notes:**
```jsx
export function Ledger({ entries }) {
  return (
    <div className="ledger">
      {entries.map(entry => (
        <LedgerEntry key={entry.id} entry={entry} />
      ))}
    </div>
  );
}

function LedgerEntry({ entry }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="ledger-entry" onClick={() => setExpanded(!expanded)}>
      <div className="entry-icon">{getActionIcon(entry.action)}</div>
      <div className="entry-summary">
        <div className="entry-title">{formatAction(entry.action)}</div>
        <div className="entry-time">{formatRelativeTime(entry.timestamp)}</div>
      </div>
      {expanded && <LedgerDetails entry={entry} />}
    </div>
  );
}
```

### 4.3 Filter & Search

**Requirements:**
- [ ] Filter by action type (Trade, Add Funds, Protect, Borrow, Rebalance)
- [ ] Filter by date range
- [ ] Filter by asset
- [ ] Search by amount or description

**New files to create:**
- `src/components/LedgerFilters.jsx`

### 4.4 Export Functionality

**Requirements:**
- [ ] Export ledger as CSV
- [ ] Export ledger as PDF (optional, lower priority)
- [ ] Include all entry details in export
- [ ] Filename with date range

**Implementation notes:**
```javascript
function exportToCSV(entries) {
  const headers = ['Date', 'Action', 'Asset', 'Amount (IRR)', 'Before Total', 'After Total'];
  const rows = entries.map(e => [
    e.timestamp,
    e.action,
    e.details?.assetId || '-',
    e.details?.amountIRR || '-',
    e.before.totalIRR,
    e.after.totalIRR,
  ]);
  const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
  downloadFile(csv, `blu-markets-ledger-${Date.now()}.csv`, 'text/csv');
}
```

---

## Phase 5: Protection & Borrow Enhancement

**Goal:** Complete and polish the Protect and Borrow flows.

### 5.1 Protection Dashboard

**Current state:** Basic list in Protection.jsx.

**Requirements:**
- [ ] Card-based view of active protections
- [ ] Show: asset, expiry date, premium paid, days remaining
- [ ] Visual countdown/progress bar to expiry
- [ ] Renewal option before expiry

**Files to modify:**
- `src/components/Protection.jsx` — Enhanced UI

**Implementation notes:**
```jsx
function ProtectionCard({ protection }) {
  const daysRemaining = getDaysUntil(protection.protectedUntil);
  const isExpiringSoon = daysRemaining <= 7;

  return (
    <div className={`protection-card ${isExpiringSoon ? 'expiring' : ''}`}>
      <div className="asset-name">{protection.assetId}</div>
      <div className="expiry">
        Protected until {formatDate(protection.protectedUntil)}
        <span className="days-badge">{daysRemaining} days</span>
      </div>
      <div className="premium">Premium: {formatIRR(protection.premiumIRR)}</div>
      {isExpiringSoon && <button>Renew Protection</button>}
    </div>
  );
}
```

### 5.2 Premium Calculator

**Current state:** Deterministic pricing (2% per 3 months).

**Requirements:**
- [ ] Interactive slider for duration (1-6 months)
- [ ] Real-time premium calculation display
- [ ] Show premium as percentage of asset value
- [ ] Comparison with/without protection value

**New files to create:**
- `src/components/ProtectionCalculator.jsx`

### 5.3 Loan Health Indicator

**Current state:** Basic loan info in Loans.jsx.

**Requirements:**
- [ ] LTV gauge (visual meter)
- [ ] Color coding: green (<50%), yellow (50-55%), red (>55%)
- [ ] Liquidation price warning
- [ ] Current price vs liquidation price comparison

**Files to modify:**
- `src/components/Loans.jsx` — Add LTV gauge

**Implementation notes:**
```jsx
function LTVGauge({ currentLTV, maxLTV = 0.6 }) {
  const percentage = (currentLTV / maxLTV) * 100;
  const color = currentLTV < 0.5 ? 'green' : currentLTV < 0.55 ? 'yellow' : 'red';

  return (
    <div className="ltv-gauge">
      <div className="gauge-fill" style={{ width: `${percentage}%`, background: color }} />
      <div className="gauge-label">{(currentLTV * 100).toFixed(1)}% LTV</div>
    </div>
  );
}
```

### 5.4 Repayment Flow

**Current state:** Not implemented.

**Requirements:**
- [ ] Add REPAY_LOAN action to state machine
- [ ] Repay from cash wallet
- [ ] Partial repayment support
- [ ] Unfreeze collateral on full repayment
- [ ] Preview showing debt reduction

**Files to modify:**
- `src/stateMachine.js` — Add repayment actions:
  - `START_REPAY`
  - `SET_REPAY_AMOUNT`
  - `PREVIEW_REPAY`
  - `CONFIRM_REPAY_FINAL`
- `src/components/Loans.jsx` — Add repay UI

---

## Phase 6: Onboarding Refinement

**Goal:** Smooth, confidence-building first-time experience.

### 6.1 Visual Progress Stepper

**Current state:** Text-only "Step X of 5".

**Requirements:**
- [ ] Horizontal stepper with icons
- [ ] Steps: Phone → Questions → Allocation → Amount → Done
- [ ] Current step highlighted, completed steps checked
- [ ] Clickable to go back (where allowed)

**New files to create:**
- `src/components/Stepper.jsx`

**Implementation notes:**
```jsx
const STEPS = [
  { id: 'PHONE', label: 'Phone', icon: '📱' },
  { id: 'QUESTIONNAIRE', label: 'Profile', icon: '📋' },
  { id: 'ALLOCATION', label: 'Allocation', icon: '📊' },
  { id: 'AMOUNT', label: 'Invest', icon: '💰' },
  { id: 'DONE', label: 'Done', icon: '✓' },
];

function Stepper({ currentStep, onStepClick }) {
  return (
    <div className="stepper">
      {STEPS.map((step, i) => (
        <StepItem
          key={step.id}
          step={step}
          status={getStepStatus(step.id, currentStep)}
          onClick={() => onStepClick?.(step.id)}
        />
      ))}
    </div>
  );
}
```

### 6.2 Questionnaire Improvements

**Current state:** Basic question/answer display.

**Requirements:**
- [ ] Card-based question layout
- [ ] Smooth transition animation between questions
- [ ] Progress bar within questionnaire
- [ ] Back button to review previous answers
- [ ] Answer preview before final submission

**Files to modify:**
- `src/components/OnboardingControls.jsx` — Questionnaire section

### 6.3 Allocation Explanation

**Current state:** Just shows percentages.

**Requirements:**
- [ ] Visual breakdown of allocation
- [ ] Explanation of each layer (Foundation/Growth/Upside)
- [ ] How answers influenced the allocation
- [ ] "Learn more" expandable sections

**New files to create:**
- `src/components/AllocationExplainer.jsx`

**Content to include:**
```
Foundation (X%): Stable assets that preserve value — USDT, IRR Fixed Income
Growth (Y%): Moderate growth potential — Gold, ETH, QQQ
Upside (Z%): Higher risk, higher potential — BTC, SOL, TON
```

### 6.4 Consent UX Improvement

**Current state:** User must type exact Persian consent phrase.

**Requirements:**
- [ ] Display consent phrase prominently
- [ ] One-click copy button
- [ ] Visual confirmation when paste matches
- [ ] Clear error if mismatch
- [ ] Explain why exact match is required

**Files to modify:**
- `src/components/OnboardingControls.jsx` — Consent section

---

## Phase 7: Advanced Features

**Goal:** Production-ready capabilities.

### 7.1 Real Price Feeds

**Current state:** Deterministic mock pricing.

**Requirements:**
- [ ] Integration with price API (e.g., CoinGecko, custom backend)
- [ ] Periodic price refresh (configurable interval)
- [ ] Cache prices locally
- [ ] Fallback to cached prices if API fails
- [ ] Show last update timestamp

**New files to create:**
- `src/services/prices.js`

**Implementation notes:**
```javascript
// Price service
const PRICE_REFRESH_MS = 60000; // 1 minute

export async function fetchPrices() {
  const cached = getCachedPrices();
  const cacheAge = Date.now() - cached?.timestamp;

  if (cached && cacheAge < PRICE_REFRESH_MS) {
    return cached.prices;
  }

  try {
    const response = await fetch(PRICE_API_URL);
    const prices = await response.json();
    setCachedPrices(prices);
    return prices;
  } catch (error) {
    console.warn('Price fetch failed, using cache');
    return cached?.prices || DEFAULT_PRICES;
  }
}
```

### 7.2 Notification System

**Requirements:**
- [ ] In-app notification center
- [ ] Notification types: price alerts, protection expiry, margin warnings
- [ ] Unread count badge
- [ ] Mark as read functionality
- [ ] Optional: push notifications (requires service worker)

**New files to create:**
- `src/components/NotificationCenter.jsx`
- `src/services/notifications.js`

### 7.3 Settings Panel

**Requirements:**
- [ ] Language toggle (Persian/English)
- [ ] Theme toggle (Light/Dark)
- [ ] Notification preferences
- [ ] Price refresh interval
- [ ] Reset/clear data option

**New files to create:**
- `src/components/Settings.jsx`

### 7.4 Offline Support (PWA)

**Requirements:**
- [ ] Service worker for offline caching
- [ ] Manifest.json for installability
- [ ] Offline indicator in UI
- [ ] Queue actions when offline, sync when online
- [ ] Cache critical assets

**New files to create:**
- `public/manifest.json`
- `src/sw.js` (service worker)

---

## Implementation Priority Matrix

| Phase | Impact | Effort | Priority |
|-------|--------|--------|----------|
| Phase 1: Core UX Polish | High | Medium | **P0** |
| Phase 2: Decision Boundary Viz | High | Medium | **P0** |
| Phase 3: Preview Flow | High | Low | **P1** |
| Phase 4: Event Ledger | Medium | Medium | **P1** |
| Phase 5: Protection/Borrow | Medium | Medium | **P2** |
| Phase 6: Onboarding | Medium | Low | **P2** |
| Phase 7: Advanced | Low | High | **P3** |

---

## Definition of Done (per Phase)

- [ ] All requirements implemented
- [ ] No console errors or warnings
- [ ] Works on Chrome, Firefox, Safari
- [ ] Mobile responsive (where applicable)
- [ ] State persists across refresh
- [ ] Code follows existing patterns in codebase

---

## Notes for Implementation

1. **State Machine First:** All business logic changes go through `stateMachine.js`. Components only dispatch actions.

2. **No External State Libraries:** Continue using useReducer pattern. Don't add Redux/Zustand.

3. **CSS Approach:** Stay with plain CSS. Add CSS custom properties for theming. No CSS-in-JS.

4. **Persian Support:** RTL is critical for target users. Test with actual Persian text.

5. **Deterministic First:** Keep mock/deterministic pricing until Phase 7. Real prices are a backend dependency.

6. **Mobile Priority:** Many target users will access via mobile. Test on small screens.
