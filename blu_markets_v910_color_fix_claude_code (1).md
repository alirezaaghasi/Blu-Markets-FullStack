# Blu Markets v9.9 → v9.10 — Color Palette Fix Implementation
## Claude Code Specification

---

## Overview

This spec implements the 6 color decisions to reduce visual noise from 12+ colors to a clean 5-color system.

| Decision | Change |
|----------|--------|
| 1 | All tabs → Blue when active |
| 2 | Layer dots → Blue with varying opacity |
| 3 | Prices → Neutral gray (not green) |
| 4 | Warnings → Two levels (Amber / Gray) |
| 5 | Activity log → Monochrome gray dots |
| 6 | Lock/Shield icons → Gray |

**Estimated Time:** 2-2.5 hours

---

## Files to Modify

```
src/
├── index.css                    # Main stylesheet (color variables + component styles)
├── components/
│   ├── TabBar.jsx              # Tab active states
│   ├── HoldingRow.jsx          # Layer dots, price colors, icons
│   ├── AllocationCard.jsx      # Layer dots in allocation display
│   ├── ActivityLog.jsx         # Activity item colors
│   ├── WarningBanner.jsx       # Warning styles (if separate component)
│   └── LoanCard.jsx            # Warning styles in loans
└── App.jsx                      # Inline styles (if any)
```

---

## Step 1: Define Color Variables

Add/update CSS variables in `/src/index.css`:

```css
/* =============================================
   COLOR SYSTEM v9.10
   ============================================= */

:root {
  /* === PRIMARY PALETTE === */
  --color-primary: #3B82F6;           /* Blue - actions, tabs, links */
  --color-primary-hover: #2563EB;     /* Blue darker - hover states */
  --color-primary-muted: rgba(59, 130, 246, 0.6);  /* Blue 60% */
  --color-primary-faint: rgba(59, 130, 246, 0.3);  /* Blue 30% */
  
  /* === SEMANTIC COLORS === */
  --color-success: #22C55E;           /* Green - gains, confirmations */
  --color-success-bg: rgba(34, 197, 94, 0.15);
  
  --color-warning: #F59E0B;           /* Amber - action required */
  --color-warning-bg: rgba(245, 158, 11, 0.15);
  --color-warning-border: rgba(245, 158, 11, 0.4);
  
  --color-danger: #EF4444;            /* Red - errors, losses, destructive */
  --color-danger-bg: rgba(239, 68, 68, 0.15);
  
  /* === NEUTRAL PALETTE === */
  --color-text: #FFFFFF;
  --color-text-secondary: rgba(255, 255, 255, 0.7);
  --color-text-muted: rgba(255, 255, 255, 0.5);
  --color-text-faint: rgba(255, 255, 255, 0.35);
  
  --color-border: rgba(255, 255, 255, 0.1);
  --color-border-light: rgba(255, 255, 255, 0.05);
  
  --color-surface: rgba(255, 255, 255, 0.03);
  --color-surface-hover: rgba(255, 255, 255, 0.06);
  
  /* === INFO (gray for non-urgent) === */
  --color-info: rgba(255, 255, 255, 0.5);
  --color-info-bg: rgba(255, 255, 255, 0.05);
  --color-info-border: rgba(255, 255, 255, 0.1);
  
  /* === LAYER DOTS (blue opacity scale) === */
  --layer-foundation: var(--color-primary);           /* 100% */
  --layer-growth: var(--color-primary-muted);         /* 60% */
  --layer-upside: var(--color-primary-faint);         /* 30% */
  
  /* === LEGACY (remove these gradually) === */
  /* --color-foundation: #22c55e;  DEPRECATED - use --layer-foundation */
  /* --color-growth: #3b82f6;      DEPRECATED - use --layer-growth */
  /* --color-upside: #8b5cf6;      DEPRECATED - use --layer-upside */
}
```

---

## Step 2: Fix Tab Colors (Decision 1)

### Current (Multiple Colors)
```css
.tab.portfolio.active { background: #8b5cf6; }  /* purple */
.tab.protection.active { background: #8b5cf6; } /* purple */
.tab.loans.active { background: #f59e0b; }      /* orange */
.tab.history.active { background: #f59e0b; }    /* orange */
```

### Updated (All Blue)

Find and replace tab styles in `/src/index.css`:

```css
/* =============================================
   TABS - Unified Blue Active State
   ============================================= */

.tabs {
  display: flex;
  gap: 0;
  background: var(--color-surface);
  border-radius: 12px;
  padding: 4px;
}

.tab {
  flex: 1;
  padding: 12px 16px;
  border: none;
  background: transparent;
  color: var(--color-text-muted);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  border-radius: 8px;
  transition: all 0.2s ease;
}

.tab:hover:not(.active) {
  color: var(--color-text-secondary);
  background: var(--color-surface-hover);
}

/* ALL tabs use blue when active - no exceptions */
.tab.active {
  background: var(--color-primary);
  color: var(--color-text);
}

/* Remove any tab-specific color overrides */
/* DELETE these if they exist:
.tab.loans.active { background: orange; }
.tab.history.active { background: orange; }
*/
```

### Component Update (if using inline styles)

In `TabBar.jsx` or wherever tabs are rendered:

```jsx
// BEFORE (if using inline styles)
const tabColors = {
  portfolio: '#8b5cf6',
  protection: '#8b5cf6',
  loans: '#f59e0b',
  history: '#f59e0b'
};

// AFTER - Remove this object entirely, use CSS classes only
<button 
  className={`tab ${activeTab === 'portfolio' ? 'active' : ''}`}
  onClick={() => setActiveTab('portfolio')}
>
  Portfolio
</button>
```

---

## Step 3: Fix Layer Dots (Decision 2)

### Current (Three Different Colors)
```css
.layer-dot.foundation { color: #22c55e; }  /* green */
.layer-dot.growth { color: #3b82f6; }      /* blue */
.layer-dot.upside { color: #8b5cf6; }      /* purple */
```

### Updated (Blue with Opacity)

```css
/* =============================================
   LAYER INDICATORS - Blue Opacity Scale
   ============================================= */

.layer-dot {
  font-size: 10px;
  line-height: 1;
}

/* Foundation = 100% blue (most stable) */
.layer-dot.foundation,
.layer-dot[data-layer="FOUNDATION"] {
  color: var(--layer-foundation);  /* #3B82F6 at 100% */
}

/* Growth = 60% blue (middle tier) */
.layer-dot.growth,
.layer-dot[data-layer="GROWTH"] {
  color: var(--layer-growth);  /* #3B82F6 at 60% */
}

/* Upside = 30% blue (speculative) */
.layer-dot.upside,
.layer-dot[data-layer="UPSIDE"] {
  color: var(--layer-upside);  /* #3B82F6 at 30% */
}

/* Alternative: Use CSS directly without variables */
/*
.layer-dot.foundation { color: #3B82F6; }
.layer-dot.growth { color: rgba(59, 130, 246, 0.6); }
.layer-dot.upside { color: rgba(59, 130, 246, 0.3); }
*/
```

### Component Update

In `HoldingRow.jsx` or `AllocationCard.jsx`:

```jsx
// BEFORE
const layerColors = {
  FOUNDATION: '#22c55e',
  GROWTH: '#3b82f6', 
  UPSIDE: '#8b5cf6'
};

// AFTER - Remove color mapping, use CSS classes
function LayerDot({ layer }) {
  return (
    <span className={`layer-dot ${layer.toLowerCase()}`}>●</span>
  );
}

// Or if using inline styles, update the colors:
const layerColors = {
  FOUNDATION: '#3B82F6',           // blue 100%
  GROWTH: 'rgba(59, 130, 246, 0.6)',  // blue 60%
  UPSIDE: 'rgba(59, 130, 246, 0.3)'   // blue 30%
};
```

### Allocation Card Update

```jsx
// In AllocationCard.jsx or wherever allocation is displayed

// BEFORE
<div className="allocation-layer">
  <span style={{ color: '#22c55e' }}>●</span> FOUNDATION
</div>

// AFTER
<div className="allocation-layer">
  <span className="layer-dot foundation">●</span> FOUNDATION
</div>
```

---

## Step 4: Fix Price Colors (Decision 3)

### Current (All Green)
```css
.price-value { color: #22c55e; }  /* green */
```

### Updated (Neutral Gray)

```css
/* =============================================
   PRICE DISPLAY - Neutral Color
   ============================================= */

/* Current price - neutral, no implied gain/loss */
.price-current,
.price-value,
.asset-price {
  color: var(--color-text-muted);  /* rgba(255,255,255,0.5) */
  font-size: 13px;
}

/* If you add gain/loss indicators later: */
.price-change.positive {
  color: var(--color-success);  /* green - actual gain */
}

.price-change.negative {
  color: var(--color-danger);   /* red - actual loss */
}

.price-change.neutral {
  color: var(--color-text-muted);  /* gray - no change */
}
```

### Component Update

In `HoldingRow.jsx`:

```jsx
// BEFORE
<span className="asset-price" style={{ color: '#22c55e' }}>
  @ ${formatPrice(price)}
</span>

// AFTER - Remove inline color, use CSS class
<span className="price-current">
  @ ${formatPrice(price)}
</span>
```

```css
/* CSS */
.price-current {
  color: var(--color-text-muted);
}
```

---

## Step 5: Fix Warning Styles (Decision 4)

### Current (Multiple Styles)
```css
/* Orange badges, yellow backgrounds, yellow text - inconsistent */
```

### Updated (Two Levels: Amber and Gray)

```css
/* =============================================
   ALERTS - Two Severity Levels
   ============================================= */

/* === LEVEL 1: ACTION REQUIRED (Amber) === */
.alert-warning,
.warning-banner,
.needs-action {
  background: var(--color-warning-bg);
  border: 1px solid var(--color-warning-border);
  border-left: 3px solid var(--color-warning);
  border-radius: 8px;
  padding: 12px 16px;
  color: var(--color-warning);
}

.alert-warning .alert-icon {
  color: var(--color-warning);
}

/* Warning badge (e.g., "NEEDS REVIEW") */
.badge-warning {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background: var(--color-warning-bg);
  border: 1px solid var(--color-warning-border);
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  color: var(--color-warning);
  text-transform: uppercase;
}

/* === LEVEL 2: INFORMATIONAL (Gray) === */
.alert-info,
.info-banner,
.notice {
  background: var(--color-info-bg);
  border: 1px solid var(--color-info-border);
  border-left: 3px solid var(--color-text-muted);
  border-radius: 8px;
  padding: 12px 16px;
  color: var(--color-text-secondary);
}

.alert-info .alert-icon {
  color: var(--color-text-muted);
}

/* Info badge */
.badge-info {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background: var(--color-info-bg);
  border: 1px solid var(--color-info-border);
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
  color: var(--color-text-muted);
}
```

### Component Update

Create or update alert components:

```jsx
// AlertBanner.jsx
function AlertBanner({ type, icon, children }) {
  const className = type === 'warning' ? 'alert-warning' : 'alert-info';
  
  return (
    <div className={className}>
      {icon && <span className="alert-icon">{icon}</span>}
      <span className="alert-text">{children}</span>
    </div>
  );
}

// Usage examples:
// Action required (amber)
<AlertBanner type="warning" icon="⚠">
  Attention required — 58% from target allocation. Consider rebalancing.
</AlertBanner>

// Informational (gray)
<AlertBanner type="info" icon="ℹ">
  Some assets are locked for your loans.
</AlertBanner>
```

### Badge Update

```jsx
// BEFORE
<span className="badge" style={{ background: '#f59e0b' }}>
  ⚠ NEEDS REVIEW
</span>

// AFTER
<span className="badge-warning">
  ⚠ NEEDS REVIEW
</span>
```

---

## Step 6: Fix Activity Log (Decision 5)

### Current (Rainbow Colors)
```css
.activity-dot.sell { color: #f97316; }     /* orange */
.activity-dot.buy { color: #22c55e; }      /* green */
.activity-dot.rebalance { color: #3b82f6; } /* blue */
.activity-dot.protect { color: #8b5cf6; }  /* purple */
.activity-dot.borrow { color: #eab308; }   /* yellow */
```

### Updated (Monochrome Gray)

```css
/* =============================================
   ACTIVITY LOG - Monochrome
   ============================================= */

.activity-log {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.activity-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 6px 0;
  font-size: 13px;
  color: var(--color-text-secondary);
}

/* ALL activity dots are gray - no color differentiation */
.activity-dot {
  color: var(--color-text-muted);
  font-size: 8px;
  line-height: 1.8;
  flex-shrink: 0;
}

/* Remove all action-specific colors */
/* DELETE these:
.activity-dot.sell { color: #f97316; }
.activity-dot.buy { color: #22c55e; }
.activity-dot.rebalance { color: #3b82f6; }
.activity-dot.protect { color: #8b5cf6; }
.activity-dot.borrow { color: #eab308; }
*/

.activity-time {
  color: var(--color-text-faint);
  font-size: 12px;
  min-width: 45px;
}

.activity-description {
  color: var(--color-text-secondary);
  flex: 1;
}

/* Subtle hover for interactivity */
.activity-item:hover {
  background: var(--color-surface-hover);
  border-radius: 4px;
  margin: 0 -8px;
  padding: 6px 8px;
}
```

### Component Update

```jsx
// BEFORE
const activityColors = {
  sell: '#f97316',
  buy: '#22c55e',
  rebalance: '#3b82f6',
  protect: '#8b5cf6',
  borrow: '#eab308'
};

function ActivityItem({ action, time, description }) {
  return (
    <div className="activity-item">
      <span style={{ color: activityColors[action.type] }}>●</span>
      <span>{time}</span>
      <span>{description}</span>
    </div>
  );
}

// AFTER - Remove color mapping entirely
function ActivityItem({ time, description }) {
  return (
    <div className="activity-item">
      <span className="activity-dot">●</span>
      <span className="activity-time">{time}</span>
      <span className="activity-description">{description}</span>
    </div>
  );
}
```

---

## Step 7: Fix Icons (Decision 6)

### Current (Multiple Colors)
```css
.icon-lock { color: #eab308; }     /* yellow */
.icon-shield { color: #ec4899; }   /* pink */
```

### Updated (Gray)

```css
/* =============================================
   STATUS ICONS - Monochrome Gray
   ============================================= */

/* All status icons use muted gray */
.status-icon {
  color: var(--color-text-muted);
  font-size: 14px;
}

.icon-lock,
.icon-locked,
.locked-indicator {
  color: var(--color-text-muted);
}

.icon-shield,
.icon-protected,
.protected-indicator {
  color: var(--color-text-muted);
}

/* If using emoji icons, wrap them */
.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 6px;
  background: var(--color-surface);
  border-radius: 4px;
  font-size: 12px;
  color: var(--color-text-muted);
}
```

### Component Update

```jsx
// BEFORE
<span style={{ color: '#eab308' }}>🔒</span>
<span style={{ color: '#ec4899' }}>🛡</span>

// AFTER
<span className="status-icon">🔒</span>
<span className="status-icon">🛡</span>

// Or with text labels
<span className="status-badge">🔒 Locked</span>
<span className="status-badge">🛡 Protected (181d)</span>
```

---

## Step 8: Clean Up Legacy Colors

Search and replace any remaining hardcoded colors:

```bash
# Find all color references in codebase
grep -r "#22c55e\|#8b5cf6\|#f59e0b\|#f97316\|#eab308\|#ec4899" src/
```

### Common replacements:

| Old Color | Old Usage | New Variable |
|-----------|-----------|--------------|
| `#22c55e` | Foundation, prices | `var(--layer-foundation)` or `var(--color-text-muted)` |
| `#8b5cf6` | Upside, tabs | `var(--layer-upside)` or `var(--color-primary)` |
| `#f59e0b` | Loans tab, warnings | `var(--color-primary)` or `var(--color-warning)` |
| `#f97316` | Sell activity | `var(--color-text-muted)` |
| `#eab308` | Lock icon, borrow | `var(--color-text-muted)` |
| `#ec4899` | Shield icon | `var(--color-text-muted)` |

---

## Verification Checklist

### Tabs
- [ ] Portfolio tab → Blue when active
- [ ] Protection tab → Blue when active
- [ ] Loans tab → Blue when active
- [ ] History tab → Blue when active
- [ ] Inactive tabs → Gray text, no background

### Layer Dots
- [ ] Foundation → Blue 100% (`#3B82F6`)
- [ ] Growth → Blue 60% (`rgba(59,130,246,0.6)`)
- [ ] Upside → Blue 30% (`rgba(59,130,246,0.3)`)
- [ ] Allocation card uses same colors
- [ ] Holdings list uses same colors

### Prices
- [ ] All `@ $X.XX` prices → Gray (`var(--color-text-muted)`)
- [ ] No green prices (unless showing actual gain)

### Warnings
- [ ] "Attention required" banner → Amber
- [ ] "NEEDS REVIEW" badge → Amber
- [ ] "We couldn't fully rebalance" → Gray (info)
- [ ] "Some assets are locked" → Gray (info)

### Activity Log
- [ ] All dots → Gray
- [ ] No colored dots for different action types
- [ ] Sidebar is visually receded

### Icons
- [ ] 🔒 Lock → Gray
- [ ] 🛡 Shield → Gray
- [ ] No yellow or pink icons

### Overall
- [ ] Only 5 colors in use: Blue, Green, Amber, Red, Gray
- [ ] No purple anywhere
- [ ] No orange tabs
- [ ] No pink icons
- [ ] No yellow icons

---

## Summary

| Change | Location | Time |
|--------|----------|------|
| Color variables | `index.css` | 15 min |
| Tab colors | `index.css` + `TabBar.jsx` | 15 min |
| Layer dots | `index.css` + `HoldingRow.jsx` + `AllocationCard.jsx` | 20 min |
| Price colors | `index.css` + `HoldingRow.jsx` | 15 min |
| Warning styles | `index.css` + alert components | 25 min |
| Activity log | `index.css` + `ActivityLog.jsx` | 15 min |
| Icons | `index.css` + inline styles | 10 min |
| Cleanup & testing | All files | 25 min |
| **Total** | | **~2.5 hours** |

---

## Visual Reference

### Final Color Palette

```
┌─────────────────────────────────────────────────────┐
│  BLUE #3B82F6     Primary, tabs, layer dots         │
│  ████████████                                       │
├─────────────────────────────────────────────────────┤
│  GREEN #22C55E    Success, gains (future)           │
│  ████████████                                       │
├─────────────────────────────────────────────────────┤
│  AMBER #F59E0B    Warnings requiring action         │
│  ████████████                                       │
├─────────────────────────────────────────────────────┤
│  RED #EF4444      Errors, losses, danger            │
│  ████████████                                       │
├─────────────────────────────────────────────────────┤
│  GRAY #6B7280     Info, muted, secondary            │
│  ████████████                                       │
└─────────────────────────────────────────────────────┘
```

### Layer Dot Opacity Scale

```
Foundation  ●  #3B82F6 (100%)  ████████████
Growth      ●  #3B82F6 (60%)   ████████░░░░
Upside      ●  #3B82F6 (30%)   ████░░░░░░░░
```

---

**Document Version:** 1.0  
**Target Version:** Blu Markets v9.10  
**Created:** January 2026
