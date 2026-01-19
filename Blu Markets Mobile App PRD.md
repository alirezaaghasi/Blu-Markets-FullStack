# Blu Markets Mobile App
## Product Requirements Document (PRD)

**Version:** 1.0
**Date:** January 2026
**Status:** Draft

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Product Vision](#2-product-vision)
3. [Target Users](#3-target-users)
4. [Core Features](#4-core-features)
5. [User Flows](#5-user-flows)
6. [Navigation Architecture](#6-navigation-architecture)
7. [Activity Feed (Chat UI)](#7-activity-feed-chat-ui)
8. [Screen Specifications](#8-screen-specifications)
9. [Design System](#9-design-system)
10. [Technical Requirements](#10-technical-requirements)
11. [Data Models](#11-data-models)
12. [Security & Compliance](#12-security--compliance)
13. [Analytics & Tracking](#13-analytics--tracking)
14. [Localization](#14-localization)
15. [Success Metrics](#15-success-metrics)

---

## 1. Executive Summary

Blu Markets Mobile is a native iOS/Android application that brings mindful portfolio management to mobile devices. The app enables users to manage multi-layer investment portfolios (Foundation, Growth, Upside), protect assets through derivatives, borrow against holdings, and maintain complete visibility into their financial journey through an immutable activity feed.

### Key Differentiators
- **Three-Layer Allocation Model**: Foundation (stable), Growth (balanced), Upside (high-potential)
- **Activity Feed (Chat UI)**: Real-time, conversational narrative of all portfolio actions
- **Risk-Aware Trading**: Visual friction and warnings for actions that deviate from targets
- **Collateralized Lending**: Borrow against holdings with transparent LTV limits
- **Asset Protection**: Insurance-like contracts to hedge downside risk

---

## 2. Product Vision

### Mission Statement
"Markets, but mindful" — Help users build wealth through disciplined, risk-aware portfolio management while maintaining complete transparency and control.

### Design Principles

| Principle | Description |
|-----------|-------------|
| **Portfolio Gravity** | Every action returns user to portfolio dashboard |
| **Preview Before Commit** | All actions show impact before execution |
| **Friction for Protection** | Visual warnings scale with risk level |
| **Immutable History** | Every action recorded and visible |
| **Mobile-First Interactions** | Bottom sheets, swipe gestures, haptic feedback |

---

## 3. Target Users

### Primary Persona: Iranian Retail Investor
- Age: 25-45
- Tech-savvy, mobile-first
- Seeks wealth preservation and growth
- Values transparency and control
- Comfortable with crypto and traditional assets

### User Needs
- Quick portfolio health check (< 5 seconds)
- Execute trades on-the-go
- Monitor loan obligations
- Review activity history
- Receive timely alerts

---

## 4. Core Features

### Feature Matrix

| Feature | Priority | Description |
|---------|----------|-------------|
| **Onboarding** | P0 | Phone auth, risk questionnaire, initial funding |
| **Portfolio Dashboard** | P0 | Total value, layer breakdown, holdings list |
| **Activity Feed** | P0 | Real-time action log with conversational narrative |
| **Trading (Buy/Sell)** | P0 | Bottom sheet trade execution with preview |
| **Rebalancing** | P0 | One-tap rebalance with constraint handling |
| **Asset Protection** | P1 | Purchase derivative protection contracts |
| **Borrowing** | P1 | Collateralized loans with installment tracking |
| **Loan Repayment** | P1 | Partial/full repayment with progress tracking |
| **History Tab** | P1 | Full ledger with date grouping and export |
| **Push Notifications** | P1 | Alerts for drift, loan due dates, price moves |
| **Biometric Auth** | P2 | Face ID / Touch ID / Fingerprint |
| **Widgets** | P2 | Home screen portfolio value widget |

---

## 5. User Flows

### 5.1 Onboarding Flow

```
┌─────────────────┐
│  Welcome Screen │
│  "Markets, but  │
│   mindful"      │
│   [Continue]    │
└────────┬────────┘
         ▼
┌─────────────────┐
│  Phone Input    │
│  +98 9XX XXX XX │
│  [Send OTP]     │
└────────┬────────┘
         ▼
┌─────────────────┐
│  OTP Verify     │
│  [6-digit code] │
└────────┬────────┘
         ▼
┌─────────────────┐
│ Risk Questions  │
│  (9 questions)  │
│  Progress bar   │
│  Layer preview  │
└────────┬────────┘
         ▼
┌─────────────────┐
│ Profile Result  │
│ "Steady Builder"│
│  Donut chart    │
│  50/35/15 split │
└────────┬────────┘
         ▼
┌─────────────────┐
│  Consent        │
│  ☐ Risk ack     │
│  ☐ Loss ack     │
│  ☐ No guarantee │
└────────┬────────┘
         ▼
┌─────────────────┐
│ Initial Funding │
│ Amount: _______ │
│ Min: 1,000,000  │
│  [Create]       │
└────────┬────────┘
         ▼
┌─────────────────┐
│ Success Screen  │
│ Portfolio ready │
│ [Go to Dashboard│
└─────────────────┘
```

### 5.2 Trade Flow (Buy/Sell)

```
Dashboard
    │
    ▼ (Tap asset or FAB)
┌─────────────────┐
│ Asset Selector  │
│ (Bottom Sheet)  │
│ Search/filter   │
│ Asset cards     │
└────────┬────────┘
         ▼
┌─────────────────┐
│ Trade Sheet     │
│ [BUY] [SELL]    │
│ Amount input    │
│ IRR keypad      │
│ Available: XXX  │
└────────┬────────┘
         ▼
┌─────────────────┐
│ Trade Preview   │
│ ─────────────── │
│ Asset: BTC      │
│ Amount: 5M IRR  │
│ Spread: 0.30%   │
│ ─────────────── │
│ ALLOCATION      │
│ Before ████░░   │
│ Target █████░   │
│ After  ███░░░   │
│ ─────────────── │
│ ⚠ Drift warning │
│ ─────────────── │
│ [Confirm Trade] │
└────────┬────────┘
         ▼
┌─────────────────┐
│ Success Toast   │
│ ✓ Bought BTC    │
│ Activity logged │
└─────────────────┘
         │
         ▼
    Dashboard
```

### 5.3 Rebalance Flow

```
Dashboard (Drift detected)
    │
    ▼ (Badge: "⚠ Rebalance")
┌─────────────────┐
│ Rebalance Sheet │
│ ─────────────── │
│ Mode Selection: │
│ ○ Holdings only │
│ ● Holdings+Cash │
│ ○ Smart (auto)  │
│ ─────────────── │
│ PROPOSED TRADES │
│ ▼ Expand list   │
│ • Sell 5M ETH   │
│ • Buy 8M USDT   │
│ ─────────────── │
│ Cash deployed:  │
│ 2,000,000 IRR   │
│ ─────────────── │
│ Residual drift: │
│ 2.3% (locked    │
│ collateral)     │
│ ─────────────── │
│ [Confirm]       │
└────────┬────────┘
         ▼
┌─────────────────┐
│ Success Screen  │
│ ✓ Rebalanced    │
│ 4 trades done   │
└─────────────────┘
```

### 5.4 Protection Flow

```
Portfolio Tab
    │
    ▼ (Tap asset → "Protect")
┌─────────────────┐
│ Protection Sheet│
│ ─────────────── │
│ Asset: BTC      │
│ Value: 50M IRR  │
│ ─────────────── │
│ Duration:       │
│ [1m][3m][6m]    │
│ ─────────────── │
│ Premium:        │
│ 1,200,000 IRR   │
│ (2.4% for 3mo)  │
│ ─────────────── │
│ Coverage period │
│ Jan 19 - Apr 19 │
│ ─────────────── │
│ [Buy Protection]│
└────────┬────────┘
         ▼
┌─────────────────┐
│ Success Screen  │
│ ☂ BTC Protected │
│ 90 days coverage│
└─────────────────┘
```

### 5.5 Borrow Flow

```
Loans Tab → [New Loan]
    │
    ▼
┌─────────────────┐
│ Select Collat.  │
│ (Bottom Sheet)  │
│ ─────────────── │
│ BTC  100M  50%  │
│ ETH   80M  50%  │
│ SOL   20M  30%  │
│ (value) (LTV)   │
└────────┬────────┘
         ▼
┌─────────────────┐
│ Configure Loan  │
│ ─────────────── │
│ Collateral: BTC │
│ Max: 50,000,000 │
│ ─────────────── │
│ Borrow amount:  │
│ [    30,000,000]│
│ ─────────────── │
│ Duration:       │
│ [3 mo] [6 mo]   │
│ ─────────────── │
│ Interest: 30%/yr│
│ Total: 34.5M    │
│ Liquidation: $X │
│ ─────────────── │
│ [Review Loan]   │
└────────┬────────┘
         ▼
┌─────────────────┐
│ Loan Review     │
│ ─────────────── │
│ Summary card    │
│ 6 installments  │
│ First due: Feb  │
│ ─────────────── │
│ ⚠ Asset frozen  │
│ ─────────────── │
│ [Confirm Borrow]│
└────────┬────────┘
         ▼
┌─────────────────┐
│ Success Screen  │
│ ✓ 30M borrowed  │
│ BTC locked      │
└─────────────────┘
```

### 5.6 Repay Flow

```
Loans Tab
    │
    ▼ (Tap active loan)
┌─────────────────┐
│ Loan Detail     │
│ ─────────────── │
│ Collateral: BTC │
│ Principal: 30M  │
│ Paid: 10M (2/6) │
│ Remaining: 20M  │
│ ─────────────── │
│ Progress bar    │
│ ████░░░░░░ 33%  │
│ ─────────────── │
│ [Repay]         │
└────────┬────────┘
         ▼
┌─────────────────┐
│ Repayment Sheet │
│ ─────────────── │
│ Options:        │
│ ○ Min payment   │
│ ○ Custom amount │
│ ● Full settle   │
│ ─────────────── │
│ Amount: 24.5M   │
│ (incl. interest)│
│ ─────────────── │
│ Cash avail: 50M │
│ ─────────────── │
│ [Confirm Repay] │
└────────┬────────┘
         ▼
┌─────────────────┐
│ Success Screen  │
│ ✓ Loan settled  │
│ BTC unfrozen    │
└─────────────────┘
```

---

## 6. Navigation Architecture

### Tab Bar Navigation (Bottom)

```
┌─────────────────────────────────────────────┐
│                                             │
│              [MAIN CONTENT]                 │
│                                             │
├─────────────────────────────────────────────┤
│  📊        🛡        💰        📜        👤  │
│Portfolio Protection Loans   History  Profile│
└─────────────────────────────────────────────┘
```

### Tab Definitions

| Tab | Icon | Primary Function |
|-----|------|------------------|
| **Portfolio** | 📊 | Dashboard, holdings, trade, rebalance |
| **Protection** | 🛡 | Active protections, buy new |
| **Loans** | 💰 | Active loans, borrow, repay |
| **History** | 📜 | Full activity ledger |
| **Profile** | 👤 | Settings, risk profile, logout |

### Navigation Patterns

| Pattern | Usage |
|---------|-------|
| **Bottom Sheet** | All action forms (trade, protect, borrow, repay) |
| **Modal** | Confirmations, success screens |
| **Push** | Asset detail, loan detail |
| **Tab** | Main navigation between sections |
| **Swipe** | Dismiss bottom sheets, navigate history |

---

## 7. Activity Feed (Chat UI)

### Overview

The Activity Feed is a **critical differentiating feature** that provides real-time, conversational feedback on all user actions. It creates a narrative of the user's financial journey and must be preserved in the mobile experience.

### Implementation Options

#### Option A: Floating Activity Feed (Recommended)
- Persistent mini-feed overlay on dashboard
- Shows last 3-5 actions
- Tap to expand full history
- Swipe to dismiss temporarily

```
┌─────────────────────────────────────────────┐
│ Header: Total Value                         │
├─────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────┐ │
│ │ 📝 Activity                          ▼  │ │
│ │ ● 10:42  Rebalanced portfolio           │ │
│ │ ● 10:35  Bought BTC (2.5M IRR)          │ │
│ │ ● 10:30  Added 5M cash                  │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ [Holdings list...]                          │
│                                             │
└─────────────────────────────────────────────┘
```

#### Option B: Dedicated History Tab
- Full-screen activity log in History tab
- Pull-to-refresh
- Date grouping (Today, Yesterday, etc.)
- Expandable entries with before/after

#### Option C: Combined Approach (Recommended)
- **Dashboard**: Mini activity feed (last 5 actions)
- **History Tab**: Full immutable ledger with details
- **Toast Notifications**: Immediate feedback after actions

### Activity Entry Format

```
┌──────────────────────────────────────┐
│ ● 10:42    Rebalanced portfolio      │
│            4 trades • SAFE           │
├──────────────────────────────────────┤
│ ● 10:35    Bought BTC                │
│            2,500,000 IRR • DRIFT     │
├──────────────────────────────────────┤
│ ● 10:30    Added funds               │
│            5,000,000 IRR • SAFE      │
└──────────────────────────────────────┘
```

### Entry Components

| Component | Description |
|-----------|-------------|
| **Timestamp** | HH:MM format, muted color |
| **Action Verb** | Present tense, verb-first ("Bought", "Sold", "Protected") |
| **Asset/Amount** | Context-specific details |
| **Boundary Indicator** | Color-coded risk level (green/yellow/orange/red) |

### Boundary Colors

| Boundary | Color | Dot/Badge |
|----------|-------|-----------|
| SAFE | Green | ● |
| DRIFT | Yellow/Amber | ⚠ |
| STRUCTURAL | Orange | ⚠ |
| STRESS | Red | ⛔ |

### Action Types to Log

| Action | Log Message Format |
|--------|-------------------|
| Portfolio Created | "Started with {amount} IRR" |
| Add Funds | "Added {amount} IRR cash" |
| Trade (Buy) | "Bought {asset} ({amount} IRR)" |
| Trade (Sell) | "Sold {asset} ({amount} IRR)" |
| Rebalance | "Rebalanced portfolio" |
| Protect | "Protected {asset} for {months}mo" |
| Cancel Protection | "Cancelled {asset} protection" |
| Borrow | "Borrowed {amount} IRR against {asset}" |
| Repay | "Repaid {amount} IRR · {asset} loan ({n}/{total})" |

---

## 8. Screen Specifications

### 8.1 Dashboard Screen

**Purpose**: Primary hub for portfolio overview and quick actions

**Components**:
1. **Header**
   - Blu Markets logo
   - Status chips (Balanced/Rebalance needed, Active Loans count)
   - Notifications bell
   - Profile avatar

2. **Hero Section**
   - Total portfolio value (large, prominent)
   - Daily change percentage with trend indicator
   - Currency: IRR

3. **Activity Feed Mini** (Chat UI)
   - Last 5 actions
   - Expandable to full history
   - Real-time updates

4. **Alert Banner** (conditional)
   - Portfolio drift warning (amber)
   - Loan due date warning (amber)
   - Protection expiring (blue)

5. **Allocation Bar**
   - Horizontal stacked bar
   - Foundation (blue), Growth (purple), Upside (green/amber)

6. **Holdings Accordion**
   - Grouped by layer
   - Expandable/collapsible
   - Each holding shows: name, value, status icons

7. **Sticky Footer**
   - [Add Funds] secondary button
   - [Rebalance] primary button (if drift detected)

### 8.2 Trade Bottom Sheet

**Trigger**: Tap asset or FAB button

**Components**:
1. Asset selector (if not pre-selected)
2. Buy/Sell toggle
3. Amount input with IRR keypad
4. Available balance display
5. Preview section:
   - Trade details (price, spread)
   - Allocation impact visualization
   - Friction copy (warnings)
6. Confirm button

### 8.3 Protection Tab

**Components**:
1. **Active Protections List**
   - Asset name and layer badge
   - Premium paid
   - Days remaining with countdown
   - Progress bar
   - Cancel button

2. **Empty State**
   - Illustration
   - "Protect your holdings" message
   - [Browse Assets] CTA

3. **Education Card** (if < 2 protections)
   - Brief explanation of protection
   - Premium rates by layer

### 8.4 Loans Tab

**Components**:
1. **Loan Capacity Bar**
   - Used / Maximum / Remaining
   - 25% portfolio limit indicator

2. **Active Loans List**
   - Collateral asset (with FROZEN badge)
   - Principal and interest
   - Installment progress (e.g., 2/6 paid)
   - Days remaining
   - [Repay] button

3. **Empty State**
   - Illustration
   - "Borrow against your holdings"
   - [New Loan] CTA

4. **New Loan FAB**
   - Opens collateral selector

### 8.5 History Tab

**Purpose**: Full immutable activity ledger

**Components**:
1. **Header**
   - "Your History" title
   - Export CSV button

2. **Date-Grouped List**
   - Section headers: Today, Yesterday, Jan 17, etc.
   - Expandable entries
   - Pull-to-refresh

3. **Entry Card (Collapsed)**
   - Icon (action type)
   - Action description
   - Amount
   - Timestamp
   - Boundary indicator

4. **Entry Card (Expanded)**
   - Before/after allocation comparison
   - Transaction ID
   - Full details
   - Block number (immutability indicator)

5. **Pagination**
   - Load more on scroll
   - 20 entries per page

---

## 9. Design System

### Colors

```css
/* Primary */
--primary: #0f49bd;
--primary-light: #135bec;

/* Background */
--bg-light: #f6f6f8;
--bg-dark: #111722;

/* Surface */
--surface-dark: #232f48;
--card-dark: #1a2230;

/* Text */
--text-primary-light: #0f172a;
--text-primary-dark: #ffffff;
--text-secondary: #92a4c9;

/* Semantic */
--success: #22c55e;
--warning: #f59e0b;
--error: #ef4444;
--info: #3b82f6;

/* Layers */
--layer-foundation: #3b82f6;  /* Blue */
--layer-growth: #a855f7;       /* Purple */
--layer-upside: #10b981;       /* Emerald */
```

### Typography

```css
/* Font Family */
--font-display: 'Manrope', sans-serif;

/* Scale */
--text-xs: 12px;
--text-sm: 14px;
--text-base: 16px;
--text-lg: 18px;
--text-xl: 20px;
--text-2xl: 24px;
--text-4xl: 36px;
--text-5xl: 48px;

/* Weights */
--font-normal: 400;
--font-medium: 500;
--font-semibold: 600;
--font-bold: 700;
--font-extrabold: 800;
```

### Spacing

```css
--space-1: 4px;
--space-2: 8px;
--space-3: 12px;
--space-4: 16px;
--space-5: 20px;
--space-6: 24px;
--space-8: 32px;
--space-10: 40px;
```

### Border Radius

```css
--radius-sm: 8px;
--radius-default: 16px;
--radius-lg: 24px;
--radius-xl: 32px;
--radius-full: 9999px;
```

### Components

| Component | Specs |
|-----------|-------|
| **Button (Primary)** | h-56px, radius-full, bg-primary, font-bold |
| **Button (Secondary)** | h-56px, radius-full, bg-surface, border, font-bold |
| **Card** | radius-default, bg-surface, border-subtle, p-20 |
| **Bottom Sheet** | radius-top-xl, drag indicator, backdrop blur |
| **Input** | h-48px, radius-default, border, focus:ring-primary |
| **Badge/Chip** | h-32px, radius-full, px-16, font-bold |

### Icons

- **Library**: Material Symbols Outlined
- **Size**: 20px (small), 24px (default), 32px (large)
- **Style**: Outlined, weight 400

---

## 10. Technical Requirements

### Platform Support

| Platform | Minimum Version |
|----------|-----------------|
| iOS | 15.0+ |
| Android | API 26 (Android 8.0)+ |

### Framework Options

| Option | Pros | Cons |
|--------|------|------|
| **React Native** | Shared codebase with web, faster dev | Bridge overhead |
| **Flutter** | High performance, single codebase | Different language (Dart) |
| **Native (Swift/Kotlin)** | Best performance, platform APIs | Two codebases |

**Recommendation**: React Native with shared business logic from web app

### State Management

- Reuse existing reducer pattern from web app
- Deterministic engine for calculations
- AsyncStorage for persistence
- Real-time price updates via WebSocket

### Offline Support

| Feature | Offline Behavior |
|---------|------------------|
| View Portfolio | Cached values, "Last updated" timestamp |
| View History | Full offline access |
| Execute Trades | Queue for later (with warning) |
| Biometric Auth | Works offline |

### Push Notifications

| Trigger | Notification |
|---------|--------------|
| Portfolio drift > 5% | "Your portfolio has drifted. Tap to rebalance." |
| Loan installment due | "Loan payment due in 3 days" |
| Protection expiring | "BTC protection expires in 7 days" |
| Price alert | "BTC moved +10% today" |

### API Requirements

```
POST   /auth/phone         # Send OTP
POST   /auth/verify        # Verify OTP
GET    /portfolio          # Get portfolio state
POST   /portfolio/trade    # Execute trade
POST   /portfolio/rebalance # Execute rebalance
POST   /protection         # Create protection
DELETE /protection/:id     # Cancel protection
POST   /loan               # Create loan
POST   /loan/:id/repay     # Repay loan
GET    /history            # Get ledger entries
GET    /prices             # Get current prices
WS     /prices/stream      # Real-time price updates
```

---

## 11. Data Models

### Portfolio State (matches web app)

```typescript
interface MobileAppState {
  // Auth
  phone: string | null;
  authToken: string | null;

  // Portfolio
  cashIRR: number;
  holdings: Holding[];
  targetLayerPct: TargetLayerPct;
  protections: Protection[];
  loans: Loan[];

  // Activity
  actionLog: ActionLogEntry[];  // Chat UI data
  ledger: LedgerEntry[];

  // UI
  currentTab: TabId;
  pendingAction: PendingAction | null;
  isLoading: boolean;
  lastSyncTimestamp: number;
}

interface Holding {
  assetId: AssetId;
  quantity: number;
  frozen: boolean;
  layer: Layer;
}

interface ActionLogEntry {
  id: number;           // Timestamp ms
  timestamp: string;    // ISO string
  type: ActionType;
  boundary: Boundary;
  amountIRR?: number;
  assetId?: AssetId;
  message: string;      // Pre-formatted for display
}

type ActionType =
  | 'PORTFOLIO_CREATED'
  | 'ADD_FUNDS'
  | 'TRADE'
  | 'REBALANCE'
  | 'PROTECT'
  | 'CANCEL_PROTECTION'
  | 'BORROW'
  | 'REPAY';

type Boundary = 'SAFE' | 'DRIFT' | 'STRUCTURAL' | 'STRESS';
```

---

## 12. Security & Compliance

### Authentication

| Method | Implementation |
|--------|----------------|
| Phone OTP | Primary auth, Iranian mobile format |
| Biometric | Face ID / Touch ID / Fingerprint (optional) |
| Session Token | JWT with 24hr expiry, refresh token |
| Pin Code | 6-digit backup for biometric failure |

### Data Security

- All API calls over HTTPS (TLS 1.3)
- Sensitive data encrypted at rest (Keychain/Keystore)
- No sensitive data in logs
- Certificate pinning for API endpoints

### Compliance

- KYC flow integration point (future)
- Transaction limits (IRR-based)
- Risk disclaimers and consent tracking
- GDPR-style data export capability

---

## 13. Analytics & Tracking

### Events to Track

| Category | Event | Properties |
|----------|-------|------------|
| Onboarding | questionnaire_completed | risk_profile, time_spent |
| Onboarding | portfolio_created | initial_amount, allocation |
| Trading | trade_executed | asset, side, amount, boundary |
| Trading | rebalance_executed | trades_count, residual_drift |
| Protection | protection_purchased | asset, duration, premium |
| Lending | loan_created | collateral, amount, duration |
| Lending | loan_repaid | amount, is_settlement |
| Engagement | tab_viewed | tab_name |
| Engagement | activity_feed_expanded | entries_count |

### Retention Metrics

- D1, D7, D30 retention
- Portfolio check frequency
- Trade frequency
- Time to first trade
- Rebalance adoption rate

---

## 14. Localization

### Supported Languages (Phase 1)

| Language | Code | Direction |
|----------|------|-----------|
| Farsi (Persian) | fa | RTL |
| English | en | LTR |

### RTL Considerations

- Mirror layout for Farsi
- Number formatting (Persian digits optional)
- Currency formatting (IRR)
- Date formatting (Jalali calendar option)

### Localized Strings

```json
{
  "dashboard.total_value": "ارزش کل پرتفوی",
  "dashboard.balanced": "متعادل",
  "dashboard.rebalance_needed": "نیاز به تعادل",
  "activity.started_with": "شروع با {amount} ریال",
  "activity.bought": "خرید {asset} ({amount} ریال)",
  "activity.sold": "فروش {asset} ({amount} ریال)"
}
```

---

## 15. Success Metrics

### North Star Metric
**Monthly Active Portfolios with Balanced Allocation**

### Key Performance Indicators

| Metric | Target | Measurement |
|--------|--------|-------------|
| Onboarding completion | > 70% | Funnel analytics |
| D7 retention | > 40% | Cohort analysis |
| Rebalance adoption | > 50% | % users who rebalance when prompted |
| Activity feed engagement | > 60% | % users who expand/view |
| Trade execution time | < 30s | From tap to confirmation |
| App crash rate | < 0.1% | Crashlytics |
| App store rating | > 4.5 | iOS/Android stores |

### Quality Metrics

| Metric | Target |
|--------|--------|
| App launch time | < 2s |
| Trade preview load | < 1s |
| Bottom sheet animation | 60fps |
| Offline capability | View portfolio + history |

---

## Appendix A: Existing Design Assets

Reference the 71 design screens in `/stitch_designs/stitch_portfolio_asset_detail/`:

- Welcome & Onboarding: `1._mobile_welcome_entry`, `2._mobile_risk_questionnaire`, etc.
- Dashboard: `4._mobile_dashboard_hub`, `mobile_dashboard_(iphone_16_pro)`
- Trading: `buy_asset_bottom_sheet`, `sell_asset_sheet_(iphone_16_pro)`
- History: `immutable_action_history`, `history_tab_(iphone_16_pro)_*`
- Loans: `loans_tab_(iphone_16_pro)_*`, `mobile_loans_interface`
- Protection: `protections_tab_(iphone_16_pro)_*`
- Rebalance: `rebalance_sheet_(iphone_16_pro)`, `rebalance_preview_sheet`

---

## Appendix B: Web App Feature Parity Checklist

| Web Feature | Mobile Status | Notes |
|-------------|---------------|-------|
| Phone onboarding | ✅ Required | Add OTP verification |
| Risk questionnaire | ✅ Required | 9 questions with layer preview |
| Profile result | ✅ Required | Donut chart + allocation |
| Consent flow | ✅ Required | 3 checkboxes |
| Initial funding | ✅ Required | IRR keypad |
| Portfolio dashboard | ✅ Required | Accordion for layers |
| Activity feed (Chat UI) | ✅ **Critical** | Mini + full history |
| Buy/Sell trades | ✅ Required | Bottom sheet |
| Add funds | ✅ Required | Bottom sheet |
| Rebalance | ✅ Required | Mode selection + preview |
| Protection purchase | ✅ Required | Duration selector |
| Protection cancel | ✅ Required | Confirmation prompt |
| Borrow | ✅ Required | Collateral + amount + duration |
| Repay | ✅ Required | Partial/full options |
| History/Ledger | ✅ Required | Date grouping + expand |
| Boundary indicators | ✅ Required | Color coding |
| Friction copy | ✅ Required | Plain language warnings |
| Reset portfolio | ⏸ Deferred | Settings only, with confirmation |

---

## Appendix C: Glossary

| Term | Definition |
|------|------------|
| **Activity Feed** | Real-time log of user actions (the "Chat UI") |
| **Boundary** | Risk classification of an action (SAFE/DRIFT/STRUCTURAL/STRESS) |
| **Foundation** | Low-risk layer (USDT, PAXG, IRR Fixed Income) |
| **Friction Copy** | Plain language warnings shown before risky actions |
| **Frozen** | Asset state when used as loan collateral |
| **Growth** | Medium-risk layer (BTC, ETH, BNB, XRP, KAG, QQQ) |
| **HRAM** | Hybrid Risk-Adjusted Multi-factor balancing algorithm |
| **LTV** | Loan-to-Value ratio for collateralized borrowing |
| **Portfolio Gravity** | Design principle: return to dashboard after actions |
| **Protection** | Insurance-like derivative contract |
| **Upside** | High-risk layer (SOL, TON, LINK, AVAX, MATIC, ARB) |
