# Blu Markets v7.7 — Improvement Scenarios

> **Based on:** IMPROVEMENT_PLAN.md analysis and v7.7 code review
> **Date:** January 2026

---

## ✅ Already Implemented in v7.7

### Phase 2: Decision Boundary Layer ✓ (Mostly Complete)
- **Boundary Classification** — SAFE/DRIFT/STRUCTURAL/STRESS states with color-coded badges
- **Drift Detection** — Calculates and displays drift per layer with color warnings
- **Allocation Visualization** — Grid showing current vs target percentages

### Phase 3: Preview Flow ✓ (Mostly Complete)
- **Preview Cards** — Before/after comparison with deltas
- **Validation System** — Blockers (hard stops) vs Warnings (soft friction)
- **Projected Boundary** — Shows what state the portfolio will be in after action

### Phase 4: Event Ledger ✓ (Mostly Complete)
- **Ledger Structure** — Timestamped entries with boundary before/after
- **Collapsible History** — Expandable entries with full snapshots
- **Drift Tracking** — Records drift changes per action

### Phase 5: Protection & Borrow ✓ (Partially Complete)
- **Tiered Premium Rates** — Foundation 1%, Growth 2%, Upside 3%
- **Layer-based LTV Limits** — Foundation 70%, Growth 60%, Upside 50%
- **Borrow Capacity Display** — Shows max borrow per asset
- **Funding Options Panel** — When cash insufficient for protection

---

## 🔴 Remaining Improvement Scenarios

### P0 — High Impact, Should Do Next

| Feature | Phase | Description | Files to Modify |
|---------|-------|-------------|-----------------|
| **Persian/RTL Support** | 1.2 | Critical for target users — add `dir="rtl"`, Vazirmatn font, detect Persian content | `index.html`, `src/styles.css`, `src/App.jsx` |
| **Stress Mode Toggle** | 2.4 | UI toggle to simulate crisis conditions (escalates all boundaries by one level) | `src/App.jsx` (add toggle + state) |
| **Loan Repayment Flow** | 5.4 | Complete the borrow cycle with repayment from cash | `src/App.jsx` (add REPAY actions) |

### P1 — Medium Impact

| Feature | Phase | Description | Files to Modify |
|---------|-------|-------------|-----------------|
| **Visual Allocation Bar** | 2.2 | Stacked bar chart showing Foundation/Growth/Upside with target markers | New: `src/components/AllocationBar.jsx` |
| **Friction Modal** | 3.2 | Modal dialog for STRUCTURAL actions, full-screen for STRESS | New: `src/components/FrictionModal.jsx` |
| **Ledger Export (CSV)** | 4.4 | Download action history as CSV file | `src/App.jsx` (add export function) |
| **LTV Gauge** | 5.3 | Visual meter showing loan health (green/yellow/red) | `src/App.jsx` (Loans component) |
| **Toast Notifications** | 1.5 | Non-blocking feedback for actions | New: `src/components/Toast.jsx` |

### P2 — Nice to Have

| Feature | Phase | Description | Files to Modify |
|---------|-------|-------------|-----------------|
| **Visual Stepper** | 6.1 | Horizontal progress indicator with icons for onboarding | New: `src/components/Stepper.jsx` |
| **Protection Renewal** | 5.1 | Renew protection before expiry | `src/App.jsx` (add RENEW_PROTECT action) |
| **Ledger Filters** | 4.3 | Filter by action type, date range, asset | `src/App.jsx` (HistoryPane) |
| **Animated Transitions** | 3.4 | Smooth CSS transitions between states | `src/styles.css` |
| **Questionnaire Back Button** | 6.2 | Navigate to previous questions | `src/App.jsx` (OnboardingControls) |

### P3 — Future / Backend Dependent

| Feature | Phase | Description |
|---------|-------|-------------|
| **Real Price Feeds** | 7.1 | API integration for live prices (CoinGecko, etc.) |
| **Notification System** | 7.2 | In-app alerts for price changes, protection expiry, margin warnings |
| **Settings Panel** | 7.3 | Language toggle, theme, preferences |
| **PWA/Offline Support** | 7.4 | Service worker, manifest, offline queue |

---

## 🎯 Recommended Implementation Order

### Sprint 1: Core UX
1. **Persian/RTL Support** — Highest impact for target market
2. **Stress Mode Toggle** — Core to "crisis simulation" product vision

### Sprint 2: Complete Features
3. **Loan Repayment Flow** — Completes borrow feature (currently one-way)
4. **Visual Allocation Bar** — Better visualization of portfolio state

### Sprint 3: Polish
5. **Friction Modal** — Proper friction for high-risk actions
6. **LTV Gauge** — Visual loan health indicator
7. **Ledger Export** — User data ownership

### Sprint 4: Refinement
8. **Visual Stepper** — Better onboarding experience
9. **Toast Notifications** — Non-blocking feedback
10. **Animated Transitions** — Professional feel

---

## Implementation Notes

1. **State Machine First** — All business logic changes go through the reducer in `App.jsx`. Components only dispatch actions.

2. **No External Libraries** — Continue using `useReducer` pattern. No Redux/Zustand.

3. **CSS Approach** — Stay with plain CSS and CSS custom properties. No CSS-in-JS.

4. **Persian Support** — RTL is critical. Test with actual Persian text. Use `dir="rtl"` attribute.

5. **Mobile Priority** — Many target users access via mobile. Test on small screens.

6. **Deterministic First** — Keep mock pricing until backend is ready.

---

## Definition of Done (per Feature)

- [ ] Feature implemented and working
- [ ] No console errors or warnings
- [ ] Works on Chrome, Firefox, Safari
- [ ] Mobile responsive
- [ ] State persists across refresh
- [ ] Code follows existing patterns
