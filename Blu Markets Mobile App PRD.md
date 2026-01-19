# Blu Markets: Native Mobile App PRD

**Version:** 3.4
**Date:** January 2026
**Status:** Final Draft

---

## TL;DR

This document defines the UX, UI, and technical requirements for the Blu Markets **native mobile app**, based on the existing web prototype. It translates 7 core user flows into mobile-native designs while preserving the **Activity Feed (Chat UI)** as a critical differentiator and staying compliant with the product philosophy and design system.

---

## Table of Contents

**Part I: Strategy & Vision**
1. [Goals & Non-Goals](#1-goals--non-goals)
2. [User Stories](#2-user-stories)
3. [Narrative](#3-narrative)
4. [Success Metrics](#4-success-metrics)

**Part II: User Experience**
5. [User Flows](#5-user-flows)
6. [Navigation Architecture](#6-navigation-architecture)
7. [Activity Feed (Chat UI)](#7-activity-feed-chat-ui)

**Part III: Screen Specifications**
8. [Screen-by-Screen Specs](#8-screen-by-screen-specs)

**Part IV: Technical Implementation**
9. [Design System](#9-design-system)
10. [Data Models](#10-data-models)
11. [Technical Requirements](#11-technical-requirements)
12. [Security & Compliance](#12-security--compliance)

**Part V: Launch Planning**
13. [Localization](#13-localization)
14. [Milestones & Sequencing](#14-milestones--sequencing)
15. [Feature Parity Checklist](#15-feature-parity-checklist)

**Part VI: Business Logic Reference**
16. [Risk Profiling Algorithm](#16-risk-profiling-algorithm)
17. [Asset Configuration](#17-asset-configuration)
18. [HRAM Rebalancing Algorithm](#18-hram-rebalancing-algorithm)
19. [Boundary Classification](#19-boundary-classification)
20. [Trading Rules](#20-trading-rules)
21. [Loan Rules](#21-loan-rules)
22. [Protection Rules](#22-protection-rules)
23. [Currency & Pricing](#23-currency--pricing)
24. [Configuration Constants](#24-configuration-constants)
25. [Portfolio Creation Algorithm](#25-portfolio-creation-algorithm)
26. [Validation & Error Codes](#26-validation--error-codes)
27. [Ledger Entry Types](#27-ledger-entry-types)
28. [Performance Optimizations](#28-performance-optimizations)
29. [Onboarding Rules](#29-onboarding-rules)
30. [Per-Asset LTV Details](#30-per-asset-ltv-details)
31. [Key Business Invariants](#31-key-business-invariants)

**Appendix**
- [Glossary](#appendix-glossary)
- [Figma Token System](#appendix-figma-token-system)

---

# Part I: Strategy & Vision

## 1. Goals & Non-Goals

### Business Goals

| Goal | Rationale |
|------|-----------|
| Expand reach via mobile-native experience | Meet users where they are (mobile-first market) |
| Improve engagement for Android-dominant user base | 80%+ Android market share in Iran |
| Reduce risk of user error in critical financial actions | Build trust through guided, friction-aware UX |
| Preserve Activity Feed as core differentiator | Real-time narrative creates engagement and transparency |

### User Goals

| Goal | How We Deliver |
|------|----------------|
| Understand portfolio state at a glance | Hero value + allocation bar + layer accordions |
| Take actions with clear outcomes | Preview screens with before/after visualization |
| Avoid forced selling or irreversible damage | Friction copy, boundary warnings, confirmation flows |
| See a narrative of their financial journey | Activity Feed on dashboard + full History tab |

### Non-Goals

| Explicitly Out of Scope | Rationale |
|------------------------|-----------|
| New features beyond web MVP | Mobile parity first, innovation later |
| Deep trading tools (limit orders, charts) | Not aligned with "mindful" philosophy |
| Staking or yield farming | Complexity contradicts simplicity goal |
| Speculative tooling (leverage trading) | Against risk-aware principles |
| Social/community features | Focus on individual portfolio management |

---

## 2. User Stories

### Onboarding
- As a **new user**, I want to create my risk profile so I get a recommended portfolio that matches my tolerance.
- As a **new user**, I want to understand what I'm consenting to before investing.

### Portfolio Management
- As a **user**, I want to view my total portfolio value and allocation by layer at a glance.
- As a **user**, I want to see a real-time feed of my recent actions so I understand my journey.
- As a **user**, I want to buy or sell assets and see exactly how my portfolio will be affected before confirming.
- As a **user**, I want to rebalance when my portfolio drifts, with clear visibility into what trades will execute.

### Advanced Features
- As a **user**, I want to borrow money against my holdings without selling them.
- As a **user**, I want to protect high-risk assets against losses through insurance-like contracts.
- As a **user**, I want to review a complete, immutable history of everything I've done.

---

## 3. Narrative

In a country where inflation, sanctions, and economic uncertainty collide, Blu Markets offers a platform where every user decision still matters. The mobile app is the bridge that brings these powerful ideas into the palm of the user's hand.

From the moment they onboard, users are shown that risk is not hidden — it's managed. That every action has an impact — but is never irreversible without warning. The mobile UI reinforces this at every step:

- **Buying an asset** shows how your portfolio shifts toward or away from your target
- **Borrowing** is deliberate, with clear consequences and installment tracking
- **Protection** feels calm, not anxious — a rational hedge, not a panic button
- **Rebalancing** feels like discipline, not panic — guided by your own chosen allocation
- **The Activity Feed** tells the story of your financial journey in plain language

The mobile experience turns Blu's philosophical foundations into tactile, day-to-day empowerment.

Every feature answers one question:

> **Does this preserve or expand the user's future ability to choose?**

If yes, it ships. If not, it doesn't. There are no nudges. No "fear of missing out." Just a quiet interface for powerful actions — risk-managed, always legible.

---

## 4. Success Metrics

### North Star Metric
**Monthly Active Portfolios with Balanced Allocation**

### Activation & Engagement

| Metric | Target | Measurement |
|--------|--------|-------------|
| Onboarding completion rate | > 70% | Funnel: welcome → portfolio created |
| Time from onboarding start to first investment | < 4 mins | Analytics timestamp delta |
| Activation-to-investment conversion | > 50% | % of signups who fund portfolio |
| D1 / D7 / D30 retention | 60% / 40% / 25% | Cohort analysis |

### Feature Adoption

| Metric | Target | Measurement |
|--------|--------|-------------|
| Rebalance within 3 days of drift warning | > 60% | Event: drift_detected → rebalance_executed |
| Activity Feed engagement | > 50% | % sessions where feed is expanded/viewed |
| Protection contracts on Upside assets | > 30% | % of Upside holdings with active protection |

### Quality & Trust

| Metric | Target | Measurement |
|--------|--------|-------------|
| Actions rolled back due to user confusion | < 2% | Support tickets + in-app cancellations |
| App crash rate | < 0.1% | Crashlytics |
| App store rating | > 4.5 | iOS/Android stores |
| Trade execution time (tap to confirm) | < 30s | Analytics |

---

# Part II: User Experience

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
│  Swipeable cards│
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
│  (Farsi RTL +   │
│   English sub)  │
│  ☐ Risk ack     │
│  ☐ Loss ack     │
│  ☐ No guarantee │
└────────┬────────┘
         ▼
┌─────────────────┐
│ Initial Funding │
│ Amount: _______ │
│ Preview alloc.  │
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
└────────┬────────┘
         ▼
┌─────────────────┐
│ Trade Sheet     │
│ [BUY] [SELL]    │
│ Amount + chips  │
│ IRR keypad      │
└────────┬────────┘
         ▼
┌─────────────────┐
│ Trade Preview   │
│ ─────────────── │
│ ALLOCATION      │
│ Before ████░░   │
│ Target █████░   │
│ After  ███░░░   │
│ ─────────────── │
│ Moves toward/   │
│ away badge      │
│ ─────────────── │
│ Spread: 0.30%   │
│ ⚠ Warning copy  │
│ ─────────────── │
│ [Confirm Trade] │
└────────┬────────┘
         ▼
┌─────────────────┐
│ Success + Toast │
│ Activity logged │
└─────────────────┘
         │
         ▼
    Dashboard
```

### 5.3 Rebalance Flow

```
Dashboard (Drift banner visible)
    │
    ▼ (Tap "Rebalance")
┌─────────────────┐
│ Rebalance Sheet │
│ ─────────────── │
│ Allocation bars │
│ Before → After  │
│ ─────────────── │
│ Summary:        │
│ Selling 2 assets│
│ Buying 3 assets │
│ ─────────────── │
│ ▼ Expand trades │
│ • Sell 5M ETH   │
│ • Buy 8M USDT   │
│ ─────────────── │
│ ⚠ Locked assets │
│   warning       │
│ ─────────────── │
│ [Confirm]       │
└────────┬────────┘
         ▼
    Success → Dashboard
```

### 5.4 Protection Flow

```
Asset → More → "Protect"
    │
    ▼
┌─────────────────┐
│ Protection Sheet│
│ ─────────────── │
│ Asset: BTC      │
│ Value: 50M IRR  │
│ ─────────────── │
│ Coverage & dur. │
│ [1m][3m][6m]    │
│ ─────────────── │
│ Premium calc:   │
│ 1,200,000 IRR   │
│ ─────────────── │
│ How it works    │
│ (disclosure)    │
│ ─────────────── │
│ [Buy Protection]│
└────────┬────────┘
         ▼
    Success → Dashboard
```

### 5.5 Borrow Flow

```
Asset → More → "Borrow"
    │
    ▼
┌─────────────────┐
│ Loan Config     │
│ ─────────────── │
│ Collateral: BTC │
│ Amount input    │
│ Duration toggle │
│ ─────────────── │
│ Preview panel:  │
│ • LTV: 50%      │
│ • Interest: 30% │
│ • Maturity date │
│ ─────────────── │
│ Info box:       │
│ Liquidation     │
│ threshold,      │
│ repayment terms │
│ ─────────────── │
│ [Confirm Loan]  │
└────────┬────────┘
         ▼
    Success → Loans Tab
```

### 5.6 Repay Flow

```
Loans Tab → Active Loan
    │
    ▼
┌─────────────────┐
│ Loan Detail     │
│ ─────────────── │
│ Progress bar    │
│ ████░░░░ 2/6    │
│ ─────────────── │
│ Installments    │
│ list            │
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
│ [Confirm Repay] │
└────────┬────────┘
         ▼
    Success → Loans Tab
```

### 5.7 Add Funds Flow

```
Dashboard
    │
    ▼ (Tap "Add Funds")
┌─────────────────┐
│ Add Funds Sheet │
│ ─────────────── │
│ Amount: _______ │
│ IRR keypad      │
│ ─────────────── │
│ Quick chips:    │
│ [5M][10M][25M]  │
│ ─────────────── │
│ Available cash: │
│ X IRR           │
│ ─────────────── │
│ [Add Funds]     │
└────────┬────────┘
         ▼
┌─────────────────┐
│ Success + Toast │
│ Activity logged │
│ "Added X IRR"   │
└─────────────────┘
         │
         ▼
    Dashboard
```

### 5.8 History Flow

```
History Tab
    │
    ▼
┌─────────────────┐
│ Your History    │
│ [Export CSV]    │
│ ─────────────── │
│ TODAY           │
│ ┌─────────────┐ │
│ │⚖ Rebalanced │ │
│ │  10:42 AM   │ │
│ │  [Expand ▼] │ │
│ └─────────────┘ │
│ ┌─────────────┐ │
│ │+ Bought BTC │ │
│ │  09:15 AM   │ │
│ └─────────────┘ │
│ ─────────────── │
│ YESTERDAY       │
│ ...             │
└─────────────────┘
    │
    ▼ (Tap to expand)
┌─────────────────┐
│ Before/After    │
│ portfolio state │
│ Transaction ID  │
│ Block number    │
└─────────────────┘
```

---

## 6. Navigation Architecture

### Tab Bar (Bottom Navigation)

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

| Tab | Icon | Primary Actions |
|-----|------|-----------------|
| **Portfolio** | 📊 | View holdings, trade, rebalance, add funds |
| **Protection** | 🛡 | View active protections, buy new |
| **Loans** | 💰 | View loans, borrow, repay |
| **History** | 📜 | Full activity ledger, export |
| **Profile** | 👤 | Settings, risk profile, logout |

### Navigation Patterns

| Pattern | When to Use | Example |
|---------|-------------|---------|
| **Bottom Sheet** | All action forms | Trade, Protect, Borrow, Repay, Rebalance |
| **Modal** | Confirmations, success | Trade success, loan created |
| **Push Navigation** | Detail views | Asset detail, loan detail |
| **Tab Switch** | Section navigation | Portfolio → Loans |
| **Swipe Gesture** | Dismiss sheets | Close bottom sheet |

---

## 7. Activity Feed (Chat UI)

### Overview

The Activity Feed is a **critical differentiating feature** that provides real-time, conversational feedback on all user actions. It creates a narrative of the user's financial journey and **must be preserved** in the mobile experience.

### Implementation: Combined Approach

| Location | Component | Content |
|----------|-----------|---------|
| **Dashboard** | Mini Activity Feed | Last 5 actions, always visible |
| **History Tab** | Full Ledger | Complete history with expand/collapse |
| **Post-Action** | Toast Notification | Immediate confirmation |

### Dashboard Mini-Feed Layout

```
┌─────────────────────────────────────────────┐
│ Header: Total Value                         │
├─────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────┐ │
│ │ 📝 Recent Activity                   ▼  │ │
│ │ ─────────────────────────────────────── │ │
│ │ ● 10:42  Rebalanced portfolio      🟢  │ │
│ │ ● 10:35  Bought BTC (2.5M IRR)     🟡  │ │
│ │ ● 10:30  Added 5M cash             🟢  │ │
│ │ ● 10:15  Protected ETH for 3mo     🟢  │ │
│ │ ● 09:45  Started with 10M IRR      🟢  │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ [Holdings list continues below...]          │
└─────────────────────────────────────────────┘
```

### Entry Format

```
┌──────────────────────────────────────────────┐
│ ● [TIME]    [ACTION VERB + DETAILS]    [DOT]│
├──────────────────────────────────────────────┤
│ ● 10:42    Rebalanced portfolio         🟢  │
│ ● 10:35    Bought BTC (2,500,000 IRR)   🟡  │
│ ● 10:30    Added 5,000,000 IRR cash     🟢  │
│ ● 10:15    Borrowed 30M against ETH     🟢  │
│ ● 09:45    Protected BTC for 3mo        🟢  │
└──────────────────────────────────────────────┘
```

### Action Message Templates

| Action Type | Message Format |
|-------------|----------------|
| Portfolio Created | "Started with {amount} IRR" |
| Add Funds | "Added {amount} IRR cash" |
| Trade (Buy) | "Bought {asset} ({amount} IRR)" |
| Trade (Sell) | "Sold {asset} ({amount} IRR)" |
| Rebalance | "Rebalanced portfolio" |
| Protect | "Protected {asset} for {months}mo" |
| Cancel Protection | "Cancelled {asset} protection" |
| Borrow | "Borrowed {amount} IRR against {asset}" |
| Repay | "Repaid {amount} IRR · {asset} loan ({n}/{total})" |

### Boundary Indicator Colors

| Boundary | Meaning | Color | Indicator |
|----------|---------|-------|-----------|
| SAFE | Action aligns with target | Green | 🟢 |
| DRIFT | Minor deviation from target | Yellow/Amber | 🟡 |
| STRUCTURAL | Major deviation from target | Orange | 🟠 |
| STRESS | High risk action | Red | 🔴 |

### History Tab: Expanded Entry

```
┌──────────────────────────────────────────────┐
│ ⚖ Rebalanced Portfolio                       │
│ 10:42 AM · Transaction #8X92...F29A          │
├──────────────────────────────────────────────┤
│ BEFORE                    AFTER              │
│ Foundation  40% ████░░    35% ███░░  ↓5%    │
│ Growth      40% ████░░    45% ████░  ↑5%    │
│ Upside      20% ██░░░░    20% ██░░░  —      │
├──────────────────────────────────────────────┤
│ 🔒 Immutable · Block 1928492                 │
└──────────────────────────────────────────────┘
```

---

# Part III: Screen Specifications

## 8. Screen-by-Screen Specs

### 8.1 Dashboard Screen

**Purpose**: Primary hub for portfolio overview and quick actions

| Section | Components |
|---------|------------|
| **Header** | Logo, status chips (Balanced/Rebalance), notifications, profile avatar |
| **Hero** | Total portfolio value (large), daily change % with trend icon |
| **Activity Feed** | Last 5 actions with timestamps and boundary indicators |
| **Alert Banner** | Drift warning (amber), loan due (amber), protection expiring (blue) |
| **Allocation Bar** | Horizontal stacked bar: Foundation (blue), Growth (purple), Upside (green) |
| **Holdings** | Accordion grouped by layer, each showing assets with value and status |
| **Sticky Footer** | [Add Funds] secondary, [Rebalance] primary (if drift detected) |

### 8.2 Trade Bottom Sheet

| Section | Components |
|---------|------------|
| **Header** | Asset name, current price, drag indicator |
| **Toggle** | [BUY] / [SELL] segmented control |
| **Amount** | Input field + quick amount chips (25%, 50%, 75%, Max) |
| **Keypad** | Custom IRR numeric keypad |
| **Available** | "Available: X IRR" or "Holding: X units" |
| **Preview** | Allocation bars (before/target/after), spread disclosure |
| **Warnings** | Friction copy if DRIFT or STRUCTURAL |
| **Actions** | [Confirm Trade] primary button |

### 8.3 Protection Tab

| Section | Components |
|---------|------------|
| **Active List** | Cards with: asset, layer badge, premium, days remaining, progress bar, [Cancel] |
| **Empty State** | Illustration, "Protect your holdings" message, [Browse Assets] CTA |
| **Education** | Collapsible card explaining protection and premium rates |

### 8.4 Loans Tab

| Section | Components |
|---------|------------|
| **Capacity Bar** | Used / Maximum / Remaining (25% portfolio limit) |
| **Active Loans** | Cards with: collateral (FROZEN badge), principal, interest, installment progress, [Repay] |
| **Empty State** | Illustration, "Borrow against holdings" message, [New Loan] CTA |
| **FAB** | Floating action button for new loan |

### 8.5 History Tab

| Section | Components |
|---------|------------|
| **Header** | "Your History" title, [Export CSV] button |
| **Date Groups** | Section headers: Today, Yesterday, Jan 17, etc. |
| **Entry Cards** | Icon, action description, amount, timestamp, boundary dot |
| **Expanded View** | Before/after allocation, transaction ID, block number |
| **Pagination** | Infinite scroll, 20 entries per page |

### 8.6 Profile Tab

| Section | Components |
|---------|------------|
| **User Info** | Phone number, member since date |
| **Risk Profile** | Current profile name, [Retake Quiz] option |
| **Settings** | Notifications, biometric auth, language |
| **Support** | Help center, contact |
| **Logout** | Logout button with confirmation |

### 8.7 UI State Patterns

**Loading States**

| Context | Pattern | Duration Expectation |
|---------|---------|---------------------|
| Initial load | Full-screen skeleton | < 2s |
| Action execution | Button spinner + disabled | < 3s |
| Price refresh | Subtle pulse on values | < 1s |
| Pull-to-refresh | Standard iOS/Android pull | < 2s |

**Empty States**

| Screen | Illustration | Message | CTA |
|--------|--------------|---------|-----|
| Protection Tab | Shield icon | "No active protections" | [Protect an Asset] |
| Loans Tab | Wallet icon | "No active loans" | [Borrow Funds] |
| History Tab | Clock icon | "No activity yet" | (none) |
| Holdings (new user) | Portfolio icon | "Your portfolio is empty" | [Add Funds] |

**Error States**

| Error Type | Display Pattern | Recovery Action |
|------------|-----------------|-----------------|
| Network error | Banner at top | [Retry] button + auto-retry |
| Validation error | Inline below input | Highlight field, show message |
| Action failed | Modal with explanation | [Try Again] or [Cancel] |
| Session expired | Full-screen | [Log In Again] |

**Success States**

| Context | Pattern | Duration |
|---------|---------|----------|
| Trade complete | Toast + Activity Feed update | 3s auto-dismiss |
| Funds added | Toast + balance animation | 3s auto-dismiss |
| Loan created | Success modal + redirect | Tap to dismiss |
| Rebalance done | Success modal + allocation update | Tap to dismiss |

---

# Part IV: Technical Implementation

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
--border-dark: #232f48;

/* Text */
--text-primary-light: #0f172a;
--text-primary-dark: #ffffff;
--text-secondary: #92a4c9;

/* Semantic */
--success: #22c55e;
--warning: #f59e0b;
--error: #ef4444;
--info: #3b82f6;

/* Layer Identity */
--layer-foundation: #3b82f6;  /* Blue */
--layer-growth: #a855f7;       /* Purple */
--layer-upside: #10b981;       /* Emerald */

/* Boundary Indicators */
--boundary-safe: #22c55e;
--boundary-drift: #f59e0b;
--boundary-structural: #f97316;
--boundary-stress: #ef4444;
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

### Spacing & Radius

```css
/* Spacing */
--space-1: 4px;
--space-2: 8px;
--space-3: 12px;
--space-4: 16px;
--space-5: 20px;
--space-6: 24px;
--space-8: 32px;

/* Border Radius */
--radius-sm: 8px;
--radius-default: 16px;
--radius-lg: 24px;
--radius-xl: 32px;
--radius-full: 9999px;
```

### Component Specs

| Component | Specs |
|-----------|-------|
| **Button (Primary)** | h-56px, radius-full, bg-primary, font-bold, shadow-lg |
| **Button (Secondary)** | h-56px, radius-full, bg-surface, border, font-bold |
| **Card** | radius-default, bg-surface, border-subtle, p-20 |
| **Bottom Sheet** | radius-top-xl, drag indicator, backdrop blur |
| **Input** | h-48px, radius-default, border, focus:ring-primary |
| **Badge/Chip** | h-32px, radius-full, px-16, font-bold |
| **Tab Bar** | h-64px, bg-surface, 5 items evenly spaced |

---

## 10. Data Models

### Core State (TypeScript)

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

  // Activity Feed (Chat UI)
  actionLog: ActionLogEntry[];
  ledger: LedgerEntry[];

  // UI State
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
  id: number;              // Timestamp ms
  timestamp: string;       // ISO string
  type: ActionType;
  boundary: Boundary;
  amountIRR?: number;
  assetId?: AssetId;
  message: string;         // Pre-formatted display text
}

interface Protection {
  id: string;
  assetId: AssetId;
  notionalIRR: number;
  premiumIRR: number;
  startISO: string;
  endISO: string;
  durationMonths: number;
}

interface Loan {
  id: string;
  collateralAssetId: AssetId;
  collateralQuantity: number;
  amountIRR: number;
  interestRate: number;
  durationMonths: 3 | 6;
  startISO: string;
  dueISO: string;
  status: 'ACTIVE' | 'REPAID' | 'LIQUIDATED';
  installments: LoanInstallment[];
  installmentsPaid: number;
}

interface LoanInstallment {
  number: number;           // 1-6
  dueISO: string;           // Due date
  principalIRR: number;     // Principal portion
  interestIRR: number;      // Interest portion
  totalIRR: number;         // principalIRR + interestIRR
  paidIRR: number;          // Amount paid so far
  status: 'PENDING' | 'PARTIAL' | 'PAID';
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
type Layer = 'FOUNDATION' | 'GROWTH' | 'UPSIDE';
type TabId = 'PORTFOLIO' | 'PROTECTION' | 'LOANS' | 'HISTORY' | 'PROFILE';
```

### ActionLog vs Ledger (Critical Distinction)

| Data Store | Purpose | Max Size | Contains |
|------------|---------|----------|----------|
| **actionLog** | Dashboard mini-feed | 50 entries | Last 50 actions, pre-formatted messages |
| **ledger** | Complete audit trail | Unlimited | Full history with before/after snapshots |

```
ActionLog (for Activity Feed):
  - Lightweight, pre-formatted messages
  - Used for dashboard "Recent Activity" display
  - Capped at 50 entries (FIFO eviction)
  - Fast render, no computation needed

Ledger (for History Tab):
  - Full audit trail with complete snapshots
  - Before/after portfolio state for each action
  - Transaction IDs, block numbers
  - Used for expand/collapse detail views
  - Persisted indefinitely
```

### Asset Universe

| Layer | Assets | LTV | Protection Premium |
|-------|--------|-----|-------------------|
| **Foundation** | USDT, PAXG, IRR_FIXED_INCOME | 70% | 0.4%/mo |
| **Growth** | BTC, ETH, BNB, XRP, KAG, QQQ | 50% | 0.8%/mo |
| **Upside** | SOL, TON, LINK, AVAX, MATIC, ARB | 30% | 1.2%/mo |

---

## 11. Technical Requirements

### Platform Support

| Platform | Minimum Version |
|----------|-----------------|
| iOS | 15.0+ |
| Android | API 26 (Android 8.0)+ |

### Recommended Stack

| Layer | Technology | Rationale |
|-------|------------|-----------|
| **Framework** | React Native | Shared logic with web, large ecosystem |
| **State** | Redux + existing reducer | Reuse web app's deterministic engine |
| **Styling** | Tailwind-style (NativeWind) | Matches web, design system tokens |
| **Navigation** | React Navigation | Industry standard, bottom tabs + stacks |
| **Storage** | AsyncStorage + Keychain | Persist state, secure auth tokens |

### API Endpoints

```
POST   /auth/phone           # Send OTP
POST   /auth/verify          # Verify OTP, get tokens
GET    /portfolio            # Get full portfolio state
POST   /portfolio/trade      # Execute trade
POST   /portfolio/rebalance  # Execute rebalance
POST   /portfolio/add-funds  # Add cash
POST   /protection           # Create protection
DELETE /protection/:id       # Cancel protection
POST   /loan                 # Create loan
POST   /loan/:id/repay       # Repay loan
GET    /history              # Get ledger (paginated)
GET    /prices               # Get current prices
WS     /prices/stream        # Real-time price updates
```

### Offline Support

| Feature | Offline Behavior |
|---------|------------------|
| View Portfolio | Cached values with "Last updated" timestamp |
| View Activity Feed | Full offline access |
| View History | Full offline access |
| Execute Actions | Queue with warning, sync when online |
| Biometric Auth | Works offline |

### Push Notifications

| Trigger | Message |
|---------|---------|
| Portfolio drift > 5% | "Your portfolio has drifted. Tap to rebalance." |
| Loan installment due in 3 days | "Loan payment due in 3 days" |
| Protection expiring in 7 days | "BTC protection expires in 7 days" |
| Significant price movement | "BTC moved +10% today" |

---

## 12. Security & Compliance

### Authentication

| Method | Implementation |
|--------|----------------|
| **Phone OTP** | Primary auth, Iranian mobile format (+98) |
| **Biometric** | Face ID / Touch ID / Fingerprint (optional) |
| **PIN Code** | 6-digit backup for biometric failure |
| **Session** | JWT (24hr) + refresh token |

### Data Security

- All API calls over HTTPS (TLS 1.3)
- Sensitive data encrypted at rest (Keychain/Keystore)
- Certificate pinning for API endpoints
- No sensitive data in logs or analytics
- Secure enclave for biometric data

### Compliance Considerations

- KYC integration point (future)
- Transaction limits based on verification level
- Risk disclaimers with explicit consent tracking
- Data export capability (GDPR-style)
- Audit trail (immutable ledger)

---

# Part V: Launch Planning

## 13. Localization

### Supported Languages (Phase 1)

| Language | Code | Direction | Calendar |
|----------|------|-----------|----------|
| Farsi (Persian) | fa | RTL | Jalali option |
| English | en | LTR | Gregorian |

### RTL Considerations

- Mirror entire layout for Farsi
- Swap navigation directions
- Number formatting (Persian digits optional)
- Currency: Always IRR with proper formatting
- Questionnaire and consent in Farsi with English subtitles

### Sample Localized Strings

```json
{
  "dashboard.total_value": "ارزش کل پرتفوی",
  "dashboard.balanced": "متعادل",
  "dashboard.rebalance_needed": "نیاز به تعادل‌سازی",
  "activity.started_with": "شروع با {amount} ریال",
  "activity.bought": "خرید {asset} ({amount} ریال)",
  "activity.rebalanced": "تعادل‌سازی پرتفوی"
}
```

---

## 14. Milestones & Sequencing

| Phase | Scope | Dependencies |
|-------|-------|--------------|
| **1. Foundation** | Auth, state management, navigation shell | API endpoints |
| **2. Onboarding** | Phone → Questionnaire → Funding → Success | Phase 1 |
| **3. Dashboard** | Portfolio view, Activity Feed, allocation | Phase 2 |
| **4. Trading** | Buy/Sell bottom sheet, preview, confirm | Phase 3 |
| **5. Rebalance** | Drift detection, rebalance preview, confirm | Phase 4 |
| **6. Loans** | Borrow flow, repayment, installment tracking | Phase 3 |
| **7. Protection** | Protection purchase, management, cancellation | Phase 3 |
| **8. History** | Full ledger, date grouping, expand/collapse | Phase 3 |
| **9. Polish** | Animations, haptics, edge cases | All phases |
| **10. QA & Launch** | Testing, beta, app store submission | Phase 9 |

---

## 15. Feature Parity Checklist

| Web Feature | Mobile Status | Notes |
|-------------|---------------|-------|
| Phone onboarding | ✅ Required | Add OTP verification |
| Risk questionnaire (9 questions) | ✅ Required | Swipeable cards with layer preview |
| Profile result + donut chart | ✅ Required | Full visualization |
| Consent flow (3 checkboxes) | ✅ Required | Farsi RTL + English |
| Initial funding | ✅ Required | IRR keypad |
| Portfolio dashboard | ✅ Required | Layer accordions |
| **Activity Feed (Chat UI)** | ✅ **Critical** | Mini (dashboard) + full (History) |
| Buy/Sell trades | ✅ Required | Bottom sheet |
| Add funds | ✅ Required | Bottom sheet |
| Rebalance with preview | ✅ Required | Mode selection + trade list |
| Protection purchase | ✅ Required | Duration selector |
| Protection cancel | ✅ Required | Confirmation prompt |
| Borrow against holdings | ✅ Required | Collateral + amount + duration |
| Loan repayment | ✅ Required | Partial/full + installment tracking |
| History/Ledger | ✅ Required | Date grouping + expand |
| Boundary indicators | ✅ Required | Color-coded (green/yellow/orange/red) |
| Friction copy (warnings) | ✅ Required | Plain language, contextual |
| Allocation visualization | ✅ Required | Before/target/after bars |
| Reset portfolio | ⏸ Deferred | Profile settings only |

---

# Part VI: Business Logic Reference

This section documents all algorithms, formulas, thresholds, and business rules from the web app that must be replicated in the mobile app.

## 16. Risk Profiling Algorithm

### 16.1 Questionnaire Structure

**9 Questions across 4 Dimensions:**

| Dimension | Weight | Questions | Question Weights |
|-----------|--------|-----------|------------------|
| **Capacity** | 40% | q_income, q_buffer, q_proportion | 1.0, 1.2, 1.3 |
| **Willingness** | 35% | q_crash_20, q_tradeoff, q_past_behavior, q_max_loss | 2.0, 1.5, 1.0, 1.5 |
| **Horizon** | 15% | q_horizon | 1.0 |
| **Goal** | 10% | q_goal | 1.0 |

### 16.2 Scoring Algorithm

```
Step 1: Calculate Sub-Scores
─────────────────────────────
C (Capacity)   = weighted_avg(q_income, q_buffer, q_proportion)
W (Willingness) = weighted_avg(q_crash_20, q_tradeoff, q_past_behavior, q_max_loss)
H (Horizon)    = q_horizon score
G (Goal)       = q_goal score

Step 2: Apply Conservative Dominance Rule
─────────────────────────────────────────
Base Score = min(C, W)

Step 3: Apply Horizon Hard Caps
───────────────────────────────
If q_horizon < 1 year  → cap score at 3
If q_horizon 1-3 years → cap score at 5

Step 4: Check Consistency Penalties
───────────────────────────────────
If q_crash_20 ≤ 2 AND q_max_loss ≥ 7 → penalty of -1

Step 5: Detect Pathological Users
─────────────────────────────────
PANIC_SELLER:     If detected → hard cap at 3
GAMBLER:          If detected alone → cap willingness at 7
GAMBLER + HIGH_PROPORTION: → hard cap at 5
INEXPERIENCED + GAMBLER:   → hard cap at 5

Step 6: Final Score
───────────────────
Clamp to range [1, 10]
Round to nearest integer
```

### 16.3 Risk Profiles & Target Allocations

| Score | Profile Name | Foundation | Growth | Upside |
|-------|--------------|------------|--------|--------|
| 1-2 | Capital Preservation | 80-85% | 12-15% | 3-5% |
| 3-4 | Conservative | 65-70% | 25-30% | 5% |
| 5-6 | Balanced | 50-55% | 35% | 10-15% |
| 7-8 | Growth | 40-45% | 38-40% | 17-20% |
| 9-10 | Aggressive | 30-35% | 40% | 25-30% |

### 16.4 Profile → Strategy Mapping (for HRAM)

| User Profile | HRAM Strategy |
|--------------|---------------|
| ANXIOUS_NOVICE | CONSERVATIVE |
| STEADY_BUILDER | BALANCED |
| AGGRESSIVE_ACCUMULATOR | MOMENTUM_TILT |
| WEALTH_PRESERVER | MAX_DIVERSIFICATION |
| SPECULATOR | AGGRESSIVE |

### 16.5 Pathological User Detection Rules

| Archetype | Detection Criteria | Cap Applied |
|-----------|-------------------|-------------|
| **PANIC_SELLER** | q_crash_20 answer = "sell everything" | Hard cap at 3 |
| **GAMBLER** | High risk tolerance + low experience | Cap willingness at 7 |
| **GAMBLER + HIGH_PROPORTION** | Gambler + invests large % of wealth | Hard cap at 5 |
| **INEXPERIENCED + GAMBLER** | No investment history + gambler traits | Hard cap at 5 |

### 16.6 Consistency Penalty Details

```
Penalty Condition:
  q_crash_20.score <= 2 (would panic sell at -20%)
  AND
  q_max_loss.score >= 7 (claims 30%+ loss tolerance)

Interpretation: User claims high loss tolerance but would actually panic sell

Penalty Applied: -1 to final score
```

### 16.7 Weighted Average Calculation

```
For each dimension:
  numerator = Σ(answer.score × question.weight)
  denominator = Σ(question.weight)
  dimensionScore = numerator / denominator

If question.weight not specified → default weight = 1.0

Example (Willingness):
  q_crash_20:      score=4, weight=2.0 → 8.0
  q_tradeoff:      score=5, weight=1.5 → 7.5
  q_past_behavior: score=3, weight=1.0 → 3.0
  q_max_loss:      score=6, weight=1.5 → 9.0

  Willingness = (8.0 + 7.5 + 3.0 + 9.0) / (2.0 + 1.5 + 1.0 + 1.5) = 27.5 / 6.0 = 4.58
```

### 16.8 Complete Questionnaire Reference

**Block 1: Financial Situation (Capacity)**

| Q# | Question | Options (Score) |
|----|----------|-----------------|
| q_income | "How predictable is your income?" | Fixed/reliable (8), Mostly stable (6), Variable (4), Uncertain (1) |
| q_buffer | "Without this money, how many months can you cover expenses?" | 12+ months (10), 6-12 months (7), 3-6 months (4), <3 months (1) |
| q_proportion | "What percentage of your total wealth is this?" | <25% (10), 25-50% (6), 50-75% (3), >75% (1) ⚑high_proportion |

**Block 2: Goals (Horizon + Goal)**

| Q# | Question | Options (Score) |
|----|----------|-----------------|
| q_goal | "What's your main goal for this investment?" | Preserve value (2), Steady income (4), Long-term growth (7), Maximum returns (10) |
| q_horizon | "When might you need to withdraw this money?" | <1 year (1) ⚑cap:3, 1-3 years (4) ⚑cap:5, 3-7 years (7), 7+ years (10) |

**Block 3: Risk Behavior (Willingness)**

| Q# | Question | Options (Score) |
|----|----------|-----------------|
| q_crash_20 | "Portfolio down 20% after 3 months. What do you do?" | Sell everything (1) ⚑panic_seller, Sell some (3), Wait (6), Buy more (9) |
| q_tradeoff | "Which do you prefer?" | Guaranteed 20% (2), 50% chance +40%/-10% (5), 50% chance +80%/-25% (8), 50% chance +150%/-50% (10) ⚑gambler |
| q_past_behavior | "Last time an investment dropped, how did you feel?" | Very stressed (1), Worried but managed (4), Relatively calm (7), No experience (5) ⚑inexperienced |
| q_max_loss | "Maximum drop you can tolerate without selling?" | 5% (1), 15% (4), 30% (7), 50%+ (10) |

### 16.9 Exact Allocation by Score

| Score | Profile | Foundation | Growth | Upside |
|-------|---------|------------|--------|--------|
| 1 | Capital Preservation | 85% | 12% | 3% |
| 2 | Capital Preservation | 80% | 15% | 5% |
| 3 | Conservative | 70% | 25% | 5% |
| 4 | Conservative | 65% | 30% | 5% |
| 5 | Balanced | 55% | 35% | 10% |
| 6 | Balanced | 50% | 35% | 15% |
| 7 | Growth | 45% | 38% | 17% |
| 8 | Growth | 40% | 40% | 20% |
| 9 | Aggressive | 35% | 40% | 25% |
| 10 | Aggressive | 30% | 40% | 30% |

---

## 17. Asset Configuration

### 17.1 Complete Asset Table

| Asset | Layer | Volatility | Layer Weight | Liquidity | Protection Eligible |
|-------|-------|------------|--------------|-----------|---------------------|
| USDT | FOUNDATION | 0.01 | 0.40 | 1.00 | ✓ |
| PAXG | FOUNDATION | 0.12 | 0.30 | 0.85 | ✓ |
| IRR_FIXED_INCOME | FOUNDATION | 0.05 | 0.30 | 0.70 | ✗ |
| BTC | GROWTH | 0.45 | 0.25 | 1.00 | ✓ |
| ETH | GROWTH | 0.55 | 0.20 | 0.98 | ✓ |
| BNB | GROWTH | 0.50 | 0.15 | 0.90 | ✓ |
| XRP | GROWTH | 0.60 | 0.10 | 0.88 | ✓ |
| KAG | GROWTH | 0.18 | 0.15 | 0.75 | ✓ |
| QQQ | GROWTH | 0.20 | 0.15 | 0.95 | ✓ |
| SOL | UPSIDE | 0.75 | 0.20 | 0.92 | ✓ |
| TON | UPSIDE | 0.65 | 0.18 | 0.70 | ✗ |
| LINK | UPSIDE | 0.60 | 0.18 | 0.85 | ✓ |
| AVAX | UPSIDE | 0.70 | 0.16 | 0.82 | ✓ |
| MATIC | UPSIDE | 0.65 | 0.14 | 0.80 | ✗ |
| ARB | UPSIDE | 0.70 | 0.14 | 0.75 | ✗ |

### 17.2 Layer Constraints

| Layer | Min Target | Max Target | Hard Min | Hard Max | Drift Tolerance |
|-------|------------|------------|----------|----------|-----------------|
| FOUNDATION | 40% | 70% | 30% | - | 5% |
| GROWTH | 20% | 45% | - | - | 5% |
| UPSIDE | 0% | 20% | - | 25% | 5% |

### 17.3 Default Asset Prices

| Asset | Price (USD) | Price (IRR) | Notes |
|-------|-------------|-------------|-------|
| USDT | $1.00 | 1,456,000 | Stablecoin |
| PAXG | $2,650 | 3,858,400,000 | Gold-backed |
| IRR_FIXED_INCOME | N/A | 500,000/unit | Fixed IRR price |
| BTC | $97,500 | 141,960,000,000 | Bitcoin |
| ETH | $3,200 | 4,659,200,000 | Ethereum |
| BNB | $680 | 990,080,000 | Binance Coin |
| XRP | $2.20 | 3,203,200 | Ripple |
| KAG | $30 | 43,680,000 | Kinesis Gold |
| QQQ | $521 | 758,576,000 | Nasdaq ETF |
| SOL | $185 | 269,360,000 | Solana |
| TON | $5.20 | 7,571,200 | Toncoin |
| LINK | $22 | 32,032,000 | Chainlink |
| AVAX | $35 | 50,960,000 | Avalanche |
| MATIC | $0.45 | 655,200 | Polygon |
| ARB | $0.80 | 1,164,800 | Arbitrum |

```
IRR Conversion: priceIRR = priceUSD × 1,456,000
```

### 17.4 Fixed Income Asset Model

```
Unit Price:     500,000 IRR
Annual Rate:    30%
Interest Type:  Simple interest

Value Calculation:
  principal = quantity × 500,000
  accrued   = principal × 0.30 × (daysHeld / 365)
  total     = principal + accrued
```

---

## 18. HRAM Rebalancing Algorithm

### 18.1 Four-Factor Model

**Factor 1: Risk Parity Weight**
```
volatilityRatio    = 0.30 / assetVolatility
volatilityAdjust   = 0.85 + (volatilityRatio - 1) × 0.15
                     // Clamped to [0.85, 1.15]
riskParityWeight   = baseLayerWeight × volatilityAdjust
```

**Factor 2: Momentum**
```
momentum          = (currentPrice - SMA_50) / SMA_50
                    // Clamped to [-1, 1]
momentumFactor    = 1 + (momentum × MOMENTUM_STRENGTH)
```

**Factor 3: Correlation**
```
avgCorrelation    = average absolute correlation with other layer assets
                    // Window: 60 days
correlationFactor = 1 - (avgCorrelation × CORRELATION_PENALTY)
```

**Factor 4: Liquidity**
```
liquidityFactor   = 1 + (liquidityScore - 0.80) × LIQUIDITY_BONUS
```

**Final Weight Calculation:**
```
rawWeight[asset]  = riskParityWeight × momentumFactor × correlationFactor × liquidityFactor
normalized[asset] = rawWeight[asset] / sum(allRawWeights)

// Apply caps (iterative, max 10 iterations)
MIN_WEIGHT = 5%
MAX_WEIGHT = 40%
```

### 18.2 Strategy Presets

| Strategy | Momentum Strength | Correlation Penalty | Min Weight | Max Weight |
|----------|-------------------|---------------------|------------|------------|
| EQUAL_WEIGHT | 0 | 0 | 5% | 50% |
| RISK_PARITY | 0 | 0 | 5% | 40% |
| MOMENTUM_TILT | 0.5 | 0.1 | 5% | 35% |
| MAX_DIVERSIFICATION | 0.1 | 0.4 | 10% | 30% |
| BALANCED | 0.3 | 0.2 | 5% | 40% |
| CONSERVATIVE | 0.1 | 0.3 | 10% | 35% |
| AGGRESSIVE | 0.5 | 0.1 | 5% | 50% |

### 18.3 Rebalance Modes

| Mode | Behavior |
|------|----------|
| **HOLDINGS_ONLY** | Trade existing holdings only (no cash deployment) |
| **HOLDINGS_PLUS_CASH** | Deploy all available cash to reach target |
| **SMART** | HOLDINGS_ONLY first, then optionally deploy cash |

### 18.4 Gap Analysis for Frozen Collateral

```
1. Calculate frozenByLayer and unfrozenByLayer
2. For each overweight layer:
   movableAmount = min(surplus, unfrozenValue)
3. Simulate HOLDINGS_ONLY result
4. Calculate cashNeededForPerfectBalance
5. Determine if cash would help (and by how much)
6. Calculate residualDrift after rebalance
```

### 18.5 Residual Drift Display Rules

```
If residualDrift < 0.5%  → Hide (negligible)
If residualDrift < 1.0%  → Show 1 decimal (e.g., "0.7%")
If residualDrift ≥ 1.0%  → Show whole number (e.g., "2%")
```

### 18.6 Intra-Layer Weight Capping Algorithm

```
Iterative Cap-and-Renormalize (max 10 iterations):

For each iteration:
  1. Identify assets exceeding MAX_WEIGHT (40%)
  2. Cap those assets at MAX_WEIGHT
  3. Calculate surplus = Σ(actualWeight - MAX_WEIGHT)
  4. Identify under-weight assets (below cap)
  5. Redistribute surplus proportionally to under-weight assets
  6. Identify assets below MIN_WEIGHT (5%)
  7. Floor those assets at MIN_WEIGHT
  8. Recalculate deficit from floored assets
  9. Reduce over-weight assets to compensate

Exit when: no changes OR iteration limit reached
```

### 18.7 Volatility Adjustment Rationale

```
Uses MILD adjustment (±15% max) NOT pure inverse volatility

Why: Pure inverse volatility would dominate and override
     intended layer weights from risk profiling

Formula:
  volatilityRatio = targetVolatility(0.30) / assetVolatility
  adjustment = 0.85 + (volatilityRatio - 1) × 0.15
  adjustment = clamp(adjustment, 0.85, 1.15)

Effect: Low-volatility assets get up to +15% weight boost
        High-volatility assets get up to -15% weight reduction
```

### 18.8 Rebalance Mode Detailed Behavior

**HOLDINGS_ONLY:**
```
1. Calculate target layer allocations
2. Identify overweight layers (current > target)
3. For each overweight layer:
   sellableAmount = min(surplus, unfrozenHoldingsValue)
4. Execute sells from overweight layers
5. Execute buys in underweight layers using sale proceeds
6. Cash balance unchanged
```

**HOLDINGS_PLUS_CASH:**
```
1. Calculate target layer allocations
2. Add all available cash to investment pool
3. Distribute total (holdings + cash) per target
4. Execute sells/buys to reach target
5. Cash balance = 0 after completion
```

**SMART:**
```
1. Execute HOLDINGS_ONLY first
2. Calculate remaining deficits per layer
3. If deficits exist AND useCash specified:
   deployAmount = min(useCash, totalDeficit)
   Distribute deployAmount proportionally to deficient layers
4. Execute additional buys with deployed cash
```

### 18.9 Frozen Collateral Handling

```
On rebalance preview:
  1. Partition holdings into frozen vs unfrozen by layer
  2. Only unfrozen holdings are "sellable"
  3. Set flag: hasLockedCollateral = (frozenTotal > 0)

During rebalance:
  1. Never include frozen holdings in sell trades
  2. Calculate achievable balance with sellable assets only
  3. Report residualDrift if target unachievable

Post-rebalance messaging:
  If hasLockedCollateral:
    "Some assets are locked as collateral for your loans."
```

---

## 19. Boundary Classification

### 19.1 Portfolio Status Determination

| Status | Condition |
|--------|-----------|
| **BALANCED** | All layers within 5% of target |
| **SLIGHTLY_OFF** | Any layer > 5% drift, no hard limits breached |
| **ATTENTION_REQUIRED** | Foundation < 30% OR Upside > 25% |

### 19.2 Boundary Classification Matrix

| Before Status | After Status | Boundary | With Stress Mode |
|---------------|--------------|----------|------------------|
| BALANCED | BALANCED | SAFE | DRIFT |
| BALANCED | SLIGHTLY_OFF | DRIFT | STRUCTURAL |
| BALANCED | ATTENTION_REQUIRED | STRUCTURAL | STRESS |
| SLIGHTLY_OFF | BALANCED | SAFE | DRIFT |
| SLIGHTLY_OFF | SLIGHTLY_OFF | DRIFT | STRUCTURAL |
| SLIGHTLY_OFF | ATTENTION_REQUIRED | STRUCTURAL | STRESS |
| ATTENTION_REQUIRED | Any | STRUCTURAL | STRESS |

### 19.3 Special Cases

| Action | Boundary Rule |
|--------|---------------|
| ADD_FUNDS | Always SAFE |
| REBALANCE (improved) | SAFE |
| REBALANCE (failed/constrained) | STRUCTURAL |
| REPAY | Based on final status |

### 19.4 Friction Copy Templates

| Boundary | Message |
|----------|---------|
| **SAFE** | (none) |
| **DRIFT** | "This moves you slightly away from your target. You can rebalance later." |
| **STRUCTURAL** | "This is a bigger move from your target. Please review before confirming." |
| **STRESS** | "This is a significant change. Please confirm you understand the impact." |

**Rebalance-Specific Messages:**
- Base: "Your portfolio couldn't be fully rebalanced."
- If hasLockedCollateral: "+ Some assets are locked as collateral for your loans."
- If insufficientCash: "+ Not enough cash to fully balance all layers."
- If residualDrift ≥ 0.5%: "+ Remaining drift: X.X% from target."
- If perfect: "Your portfolio is now on target."

---

## 20. Trading Rules

### 20.1 Spread by Layer

| Layer | Spread | Range |
|-------|--------|-------|
| FOUNDATION | 0.15% | 0.1% - 0.2% |
| GROWTH | 0.30% | 0.2% - 0.4% |
| UPSIDE | 0.60% | 0.4% - 0.8% |

### 20.2 Validation Rules

**BUY Validation:**
```
✓ amount > 0
✓ cashIRR ≥ amountIRR
✓ asset exists in universe
```

**SELL Validation:**
```
✓ amount > 0
✓ asset not frozen (not collateral)
✓ holdingValue ≥ amountIRR
```

### 20.3 Minimum Trade Amount

```
MIN_TRADE_AMOUNT = 1,000,000 IRR
```

---

## 21. Loan Rules

### 21.1 LTV (Loan-to-Value) by Layer

| Layer | Max LTV | Formula |
|-------|---------|---------|
| FOUNDATION | 70% | maxBorrow = holdingValue × 0.70 |
| GROWTH | 50% | maxBorrow = holdingValue × 0.50 |
| UPSIDE | 30% | maxBorrow = holdingValue × 0.30 |

### 21.2 Interest Calculation

```
ANNUAL_RATE = 30% (0.30)

totalInterest = principal × 0.30 × (durationMonths / 12)

Example (3-month, 30M IRR):
  interest = 30,000,000 × 0.30 × (3/12) = 2,250,000 IRR
  totalDue = 32,250,000 IRR
```

### 21.3 Installment Calculation

```
INSTALLMENT_COUNT = 6 (always, regardless of duration)

daysPerInstallment = (durationMonths × 30) / 6
principalPerInst   = floor(principal / 6)
interestPerInst    = floor(totalInterest / 6)
lastInstallment    = gets rounding remainder

Due dates: Every (daysPerInstallment) days from loan creation
Status: PENDING → PAID or PARTIAL
```

### 21.4 Global Loan Cap

```
MAX_PORTFOLIO_LOAN_PCT = 25%

maxTotalLoans = (cashIRR + holdingsValue) × 0.25
remainingCapacity = maxTotalLoans - existingLoansTotal

Validation: existingLoans + newLoan ≤ maxTotalLoans
Error: EXCEEDS_PORTFOLIO_LOAN_LIMIT
```

### 21.5 Liquidation Threshold

```
liquidationIRR = principal (loan amount at creation)

Trigger: collateralValue < liquidationIRR
Note: Accrued interest NOT included in liquidation check
```

### 21.6 Accrued Interest (Daily)

```
dailyRate = 0.30 / 365 = 0.000822
accruedInterest = principal × dailyRate × daysElapsed
```

### 21.7 Collateral Rules

```
On loan creation:  holding.frozen = true
On full repayment: holding.frozen = false
While frozen:      Cannot sell, cannot use as collateral again
```

### 21.8 Repayment Application Logic

```
Payments applied sequentially in installment order:

For each installment (in order):
  If remaining >= inst.totalIRR:
    Mark installment as PAID
    remaining -= inst.totalIRR
    installmentsPaid++
  Else if remaining > 0:
    Mark installment as PARTIAL
    inst.paidIRR += remaining
    remaining = 0
  Else:
    Keep as PENDING

Note: installmentsPaid counts fully completed installments only
```

### 21.9 Loan Settlement Rule

```
Settlement Condition:
  repayAmount >= (amountIRR + accruedInterestIRR)

On Settlement:
  1. Loan removed from active loans
  2. Collateral automatically unfrozen (holding.frozen = false)
  3. Ledger records: installmentsPaid = 6, isSettlement = true
```

### 21.10 Installment Status States

| Status | Condition |
|--------|-----------|
| **PENDING** | No payment received yet |
| **PARTIAL** | 0 < paidIRR < totalIRR |
| **PAID** | paidIRR >= totalIRR |

### 21.11 Loan Health Level Thresholds

| LTV % | Health Level | UI Indicator |
|-------|--------------|--------------|
| >= 90% | Critical | Red |
| >= 80% | Warning | Orange |
| >= 75% | Caution | Yellow |
| < 75% | Healthy | Green |

```
currentLTV = outstandingPrincipal / collateralValue × 100
```

---

## 22. Protection Rules

### 22.1 Premium Rates (Monthly)

| Layer | Rate | Annual Equivalent |
|-------|------|-------------------|
| FOUNDATION | 0.4% (0.004) | 4.8% |
| GROWTH | 0.8% (0.008) | 9.6% |
| UPSIDE | 1.2% (0.012) | 14.4% |

### 22.2 Premium Calculation

```
premiumIRR = notionalIRR × monthlyRate × durationMonths

Example (BTC in GROWTH, 50M IRR, 3 months):
  premium = 50,000,000 × 0.008 × 3 = 1,200,000 IRR
```

### 22.3 Duration Options

```
MIN_DURATION = 1 month
MAX_DURATION = 6 months
STEP = 1 month
Options: [1, 2, 3, 4, 5, 6]
```

### 22.4 Eligibility

**Eligible (11 assets):**
USDT, PAXG, BTC, ETH, BNB, XRP, KAG, QQQ, SOL, LINK, AVAX

**Not Eligible (4 assets):**
- TON, MATIC, ARB (no liquid derivatives market)
- IRR_FIXED_INCOME (internal asset)

### 22.5 Validation Rules

```
✓ Asset exists in holdings
✓ Asset is protection-eligible
✓ Duration in [1, 6]
✓ notionalIRR > 0
✓ No existing active protection on asset
✓ cashIRR ≥ premiumIRR
```

---

## 23. Currency & Pricing

### 23.1 FX Rate

```
DEFAULT_FX_RATE = 1,456,000 IRR per USD
```

### 23.2 Value Calculation

```
For crypto/ETF assets:
  valueIRR = quantity × priceUSD × FX_RATE

For IRR_FIXED_INCOME:
  valueIRR = quantity × 500,000 + accruedInterest
```

### 23.3 Holdings Model (v10)

```
Holdings stored as QUANTITY (not value)

Decimal precision:
  BTC:           8 decimals
  ETH:           6 decimals
  Stables/Gold:  2-4 decimals
  Altcoins:      2-4 decimals
  Fixed Income:  0 decimals (whole units only)
```

### 23.4 Portfolio Value Composition

```
Total Portfolio Value (for display):
  totalIRR = holdingsIRR + cashIRR

Holdings Value (for calculations):
  holdingsIRR = Σ(holding.valueIRR)

Layer Percentages (CRITICAL):
  layerPct = layerValueIRR / holdingsIRR × 100

  NOTE: Cash is EXCLUDED from layer percentage calculations
        This ensures allocation percentages always sum to 100%
```

### 23.5 Spread Application

| Layer | Spread | Applied On |
|-------|--------|------------|
| FOUNDATION | 0.15% | Buy AND Sell |
| GROWTH | 0.30% | Buy AND Sell |
| UPSIDE | 0.60% | Buy AND Sell |

```
Spread is disclosed in trade preview:
  "Spread: 0.30%"

Calculation:
  effectivePrice = basePrice × (1 + spread)  // on buy
  effectivePrice = basePrice × (1 - spread)  // on sell
```

### 23.6 Fixed Income Accrual Details

```
Unit Price:      500,000 IRR
Annual Rate:     30% (simple interest)
Accrual Method:  Daily simple interest

Daily Accrual:
  principal = quantity × 500,000
  dailyRate = 0.30 / 365 = 0.000822
  dailyAccrual = principal × dailyRate

Total Value:
  daysHeld = (now - purchaseDate) / 86400000
  accruedInterest = principal × 0.30 × (daysHeld / 365)
  totalValue = principal + accruedInterest
```

### 23.7 Price Data Sources & APIs

**Three External Data Sources:**

| Source | Data Provided | Rate Limits | Auth Required |
|--------|---------------|-------------|---------------|
| **CoinGecko** | Crypto prices (BTC, ETH, SOL, etc.) | ~30 calls/min | No |
| **Finnhub** | Stock/ETF prices (QQQ) | 60 calls/min | API key |
| **Bonbast** | USD/IRR exchange rate | No limit | No |

**CoinGecko API:**
```
Endpoint: https://api.coingecko.com/api/v3/simple/price
Params:   ?ids={coinIds}&vs_currencies=usd
Response: { "bitcoin": { "usd": 97500 }, ... }
```

**Finnhub API:**
```
Endpoint: https://finnhub.io/api/v1/quote
Params:   ?symbol={symbol}&token={apiKey}
Response: { "c": 521.00, ... }  // "c" = current price
```

**Bonbast API (USD/IRR):**
```
Endpoint: https://bonbast.amirhn.com/latest
Response: { "usd": { "sell": 145600, "buy": 145400 }, ... }

NOTE: Values are in Toman (÷10 of Rial)
      Multiply by 10 to get Rial: 145600 × 10 = 1,456,000 IRR
```

### 23.8 CoinGecko ID Mappings

| Asset ID | CoinGecko ID | Layer |
|----------|--------------|-------|
| USDT | `tether` | FOUNDATION |
| PAXG | `pax-gold` | FOUNDATION |
| BTC | `bitcoin` | GROWTH |
| ETH | `ethereum` | GROWTH |
| BNB | `binancecoin` | GROWTH |
| XRP | `ripple` | GROWTH |
| KAG | `kinesis-gold` | GROWTH |
| SOL | `solana` | UPSIDE |
| TON | `the-open-network` | UPSIDE |
| LINK | `chainlink` | UPSIDE |
| AVAX | `avalanche-2` | UPSIDE |
| MATIC | `matic-network` | UPSIDE |
| ARB | `arbitrum` | UPSIDE |

**Assets NOT from CoinGecko:**
- **QQQ**: Fetched from Finnhub (stock/ETF)
- **IRR_FIXED_INCOME**: Internal asset (fixed price: 500,000 IRR/unit)

### 23.9 Price Calculation Formulas

**For Crypto Assets (from CoinGecko):**
```
priceIRR = priceUSD × fxRate

Example (BTC):
  priceUSD = 97,500 (from CoinGecko)
  fxRate = 1,456,000 (from Bonbast or fallback)
  priceIRR = 97,500 × 1,456,000 = 141,960,000,000 IRR
```

**For ETF Assets (from Finnhub):**
```
priceIRR = priceUSD × fxRate

Example (QQQ):
  priceUSD = 521.00 (from Finnhub)
  fxRate = 1,456,000
  priceIRR = 521 × 1,456,000 = 758,576,000 IRR
```

**For Fixed Income (Internal):**
```
unitPriceIRR = 500,000 (constant)
valueIRR = quantity × 500,000 + accruedInterest
```

**Holding Value Calculation:**
```
holdingValueIRR = quantity × priceUSD × fxRate

Example (0.5 BTC):
  valueIRR = 0.5 × 97,500 × 1,456,000 = 70,980,000,000 IRR
```

### 23.10 FX Rate Fallback Strategy

```
Primary Source:   Bonbast API (live rate)
Fallback:         Environment variable VITE_FALLBACK_USD_IRR
Default:          1,456,000 IRR per USD

Fallback Triggers:
  1. Bonbast API returns non-200 status
  2. Bonbast returns invalid JSON
  3. Response missing 'usd.sell' field
  4. Network timeout (8 seconds)

Response Format:
  { ok: true, rate: 1456000, source: 'bonbast' }  // live
  { ok: true, rate: 1456000, source: 'fallback' } // fallback
```

### 23.11 Price Fetch Error Handling

```
On Fetch Error:
  1. Log error to console
  2. Return partial data (other sources may succeed)
  3. UI shows "Last updated: X ago" indicator
  4. Retry with exponential backoff

Response Structure:
  {
    prices: { BTC: 97500, ETH: 3200, ... },
    fxRate: 1456000,
    fxSource: 'bonbast' | 'fallback',
    updatedAt: '2026-01-19T12:00:00Z',
    errors: {
      crypto: null | 'CoinGecko error: 429',
      stock: null | 'API key not configured',
      fx: null | 'Network timeout'
    }
  }

Partial Success:
  If CoinGecko fails but Finnhub works → QQQ price still available
  If Bonbast fails → fallback rate used automatically
```

### 23.12 Price Refresh Strategy

| Context | Refresh Interval | Notes |
|---------|------------------|-------|
| App foreground | 30 seconds | Base interval |
| Action preview | On-demand | Fresh price before confirm |
| Background | Paused | No polling when backgrounded |
| Error backoff | 30s → 45s → 67s → 100s → ... | 1.5x multiplier, max 5 min |

```
Retry Logic:
  interval = min(BASE_INTERVAL × (1.5 ^ retryCount), MAX_BACKOFF)

Health Check:
  Every 5 seconds, verify price polling is active
  Restart if stuck or failed
```

---

## 24. Configuration Constants

### 24.1 Thresholds

| Constant | Value | Purpose |
|----------|-------|---------|
| MIN_TRADE_AMOUNT | 1,000,000 IRR | Minimum for any trade |
| MIN_REBALANCE_TRADE | 100,000 IRR | Minimum per-asset rebalance trade |
| DRIFT_TOLERANCE | 5% | Threshold for SLIGHTLY_OFF status |
| EMERGENCY_DRIFT | 10% | Bypasses time requirement for rebalance |
| MIN_REBALANCE_INTERVAL | 1 day | Between normal rebalances |
| MAX_ACTION_LOG_SIZE | 50 | Maximum entries in action log |
| FX_RATE | 1,456,000 | IRR per USD |
| LOAN_INTEREST_RATE | 0.30 | 30% annual |
| MAX_LOAN_PCT | 0.25 | 25% of portfolio |
| FIXED_INCOME_UNIT | 500,000 | IRR per unit |
| FIXED_INCOME_RATE | 0.30 | 30% annual |

### 24.2 Time Windows (for HRAM)

| Window | Duration | Used For |
|--------|----------|----------|
| Volatility | 30 days | Risk parity calculation |
| Momentum | 50 days | SMA for momentum factor |
| Correlation | 60 days | Cross-asset correlation |

---

## 25. Portfolio Creation Algorithm

### 25.1 Two-Phase Construction

**Phase 1: Initial Allocation**
```
For each layer:
  targetLayerIRR = round(investmentIRR × targetPct)

  For each asset in layer:
    assetAmountIRR = round(targetLayerIRR × layerWeight[asset])

    If asset == IRR_FIXED_INCOME:
      quantity = assetAmountIRR / 500,000
    Else:
      quantity = assetAmountIRR / (priceUSD × fxRate)
```

**Phase 2: Reconciliation**
```
For each layer:
  actualLayerIRR = sum of asset values after phase 1
  gap = targetLayerIRR - actualLayerIRR

  If |gap| > 1 IRR:
    Adjust last non-fixed-income asset by gap amount
```

### 25.2 Risk Tier Mapping

| Risk Score | Tier | Foundation | Growth | Upside |
|------------|------|------------|--------|--------|
| < 5 | LOW | 65% | 30% | 5% |
| 5-10 | MEDIUM | 50% | 35% | 15% |
| > 10 | HIGH | 40% | 40% | 20% |

### 25.3 Reconciliation Strategy Details

```
Why Reconciliation:
  Rounding in Phase 1 creates gaps between target and actual

Reconciliation Rules:
  1. Only reconcile if |gap| > 1 IRR (ignore dust)
  2. Prefer non-fixed-income assets (better price precision)
  3. Adjust quantity of last eligible asset in layer
  4. Never create negative quantities

Example:
  Target: 5,000,000 IRR in FOUNDATION
  After Phase 1: 4,999,850 IRR (due to rounding)
  Gap: 150 IRR → reconcile by adding more USDT
```

### 25.4 Default Target Allocation

```
If no target allocation provided (edge case):
  Use midpoint of acceptable range for each layer

  Foundation: (40% + 70%) / 2 = 55%
  Growth:     (20% + 45%) / 2 = 32.5%
  Upside:     (0%  + 20%) / 2 = 10%

  Note: Total = 97.5%, remainder goes to Foundation
```

### 25.5 Gap Analysis Algorithm

```
Purpose: Determine best rebalance mode recommendation

Step 1: Calculate current allocation
  currentPct[layer] = layerValue / totalHoldingsValue

Step 2: Calculate drift from target
  drift[layer] = |currentPct[layer] - targetPct[layer]|

Step 3: Partition holdings
  frozenByLayer = sum of frozen (collateral) holdings per layer
  unfrozenByLayer = sum of tradeable holdings per layer

Step 4: Simulate HOLDINGS_ONLY
  For overweight layers:
    sellable = min(surplus, unfrozenByLayer)
  Calculate achievable allocation

Step 5: Calculate cash needed
  cashNeeded = deficit in underweight layers after HOLDINGS_ONLY

Step 6: Recommend mode
  If cashNeeded = 0: HOLDINGS_ONLY sufficient
  If cashAvailable >= cashNeeded: HOLDINGS_PLUS_CASH optimal
  Else: SMART with partial cash deployment
```

---

## 26. Validation & Error Codes

### 26.1 Error Code Reference

| Code | Condition | User Message |
|------|-----------|--------------|
| INVALID_AMOUNT | Non-finite or ≤ 0 | "Please enter a valid amount." |
| INVALID_ASSET | Asset not found | "Invalid asset selected." |
| INSUFFICIENT_CASH | Buy amount > cash | "Not enough cash available." |
| INSUFFICIENT_ASSET_VALUE | Sell amount > holding | "Not enough of this asset." |
| ASSET_FROZEN | Selling frozen collateral | "Asset locked as collateral." |
| ASSET_ALREADY_PROTECTED | Duplicate protection | "Already protected." |
| INSUFFICIENT_CASH_FOR_PREMIUM | Premium > cash | "Not enough cash for premium." |
| EXCEEDS_MAX_BORROW | Loan > LTV limit | "Exceeds borrowing limit." |
| EXCEEDS_PORTFOLIO_LOAN_LIMIT | Total loans > 25% | "Loan cap exceeded." |
| NO_ACTIVE_LOAN | Repaying non-existent loan | "No active loan." |
| NO_CASH | Cash = 0 | "No cash available." |

### 26.2 Validation Meta Fields

```typescript
ValidationResult {
  ok: boolean
  errors: string[]
  meta: {
    required?: number        // Amount needed
    available?: number       // Amount available
    maxBorrow?: number       // Max borrowable for asset
    maxLtv?: number          // LTV percentage
    maxTotalLoans?: number   // Global cap (25%)
    existingLoans?: number   // Current total loans
    remainingCapacity?: number
    notionalIRR?: number     // Protection value
    holdingValueIRR?: number // Current holding value
  }
}
```

---

## 27. Ledger Entry Types

### 27.1 Entry Type Reference

| Type | Trigger | Key Payload Fields |
|------|---------|-------------------|
| PORTFOLIO_CREATED_COMMIT | Initial creation | amountIRR, targetLayerPct |
| ADD_FUNDS_COMMIT | Add funds confirmed | amountIRR |
| TRADE_COMMIT | Trade confirmed | side, assetId, amountIRR |
| PROTECT_COMMIT | Protection confirmed | assetId, months, notionalIRR, premiumIRR |
| BORROW_COMMIT | Loan confirmed | assetId, amountIRR, durationMonths |
| REPAY_COMMIT | Repayment confirmed | loanId, amountIRR, installmentsPaid, isSettlement |
| REBALANCE_COMMIT | Rebalance confirmed | mode, trades[], cashDeployed, residualDrift |
| PROTECTION_CANCELLED_COMMIT | Protection cancelled | protectionId, assetId |

### 27.2 Ledger Entry Structure

```typescript
LedgerEntry {
  id: string                    // UUID
  tsISO: string                 // ISO timestamp
  tsDateLabel: string           // Pre-computed: "Jan 15, 2024"
  type: LedgerEntryType
  details: {
    kind: ActionKind
    payload: ActionPayload
    before: PortfolioSnapshot   // State before action
    after: PortfolioSnapshot    // State after action
    boundary: Boundary          // SAFE/DRIFT/STRUCTURAL/STRESS
    validation: ValidationResult
    frictionCopy: string[]      // User-facing warnings
    rebalanceMeta?: {           // Only for rebalance
      hasLockedCollateral: boolean
      insufficientCash: boolean
      residualDrift: number
      trades: RebalanceTrade[]
      cashDeployed: number
      intraLayerWeights: Record<Layer, IntraLayerWeightResult>
      strategy: string
    }
  }
}
```

---

## 28. Performance Optimizations

### 28.1 Caching Strategy

| Cache | Key Format | Max Size | Eviction |
|-------|------------|----------|----------|
| Holding Values | `assetId:quantity:priceUSD` | 100 | LRU |
| Date Labels | `tsISO` | Inline | N/A |
| Protection Status | `endTimeMs` | Inline | N/A |

### 28.2 Pre-computation Rules

| Field | Pre-computed When | Purpose |
|-------|-------------------|---------|
| tsDateLabel | Ledger entry creation | O(1) date grouping |
| startTimeMs | Protection creation | O(1) active check |
| endTimeMs | Protection creation | O(1) expiry check |

### 28.3 Limits

| Limit | Value | Purpose |
|-------|-------|---------|
| MAX_ACTION_LOG_SIZE | 50 | Prevent memory growth |
| MIN_TRADE_VALUE_IRR | 100,000 | Skip dust trades in rebalance |
| LRU_CACHE_SIZE | 100 | Bound holding value cache |

### 28.4 Price Polling Parameters

| Parameter | Value | Description |
|-----------|-------|-------------|
| BASE_INTERVAL_MS | 30,000 | Normal polling interval |
| MAX_BACKOFF_MS | 300,000 | Max retry delay (5 min) |
| HEARTBEAT_MS | 5,000 | Health check interval |
| BACKOFF_MULTIPLIER | 1.5 | Exponential backoff factor |

### 28.5 LRU Cache Implementation

```
Holding Value Cache:
  Key:   ${assetId}:${quantity}:${priceUSD}:${purchasedAt}
  Value: Computed IRR value

  purchasedAt: Only included for fixed income (accrual depends on date)

Eviction Policy:
  1. Track entries in insertion order
  2. On cache hit: move entry to end (most recent)
  3. On cache miss: compute value, add to cache
  4. If size > MAX_SIZE (100): delete first entry (oldest)

Hit Rate Optimization:
  Same holding with same price → instant lookup
  Price change → cache miss, recompute
```

### 28.6 Date Label Pre-computation

```
On ledger entry creation:
  tsDateLabel = computeDateLabel(tsISO)

computeDateLabel(iso):
  today = new Date().setHours(0,0,0,0)
  entryDate = new Date(iso).setHours(0,0,0,0)

  If entryDate == today: return "Today"
  If entryDate == today - 86400000: return "Yesterday"
  Else: return formatted date (e.g., "Jan 17")

Staleness Note:
  Labels become stale after midnight
  Acceptable for historical entries
  Dashboard feed uses relative time (e.g., "2 hours ago")
```

---

## 29. Onboarding Rules

### 29.1 Phone Validation

```
Format: +989XXXXXXXXX
Length: 13 characters total
Prefix: +989
Remaining: 9 digits

Validation Code:
  isValid = phone.startsWith('+989') && phone.length === 13

Example Valid:   +989123456789
Example Invalid: +98912345678  (12 chars)
Example Invalid: +971234567890 (wrong prefix)
```

### 29.2 Questionnaire Flow

```
9 questions total
Progress: index / 9 (0-based index)
Layer highlighting: Questions 5 & 8 show gradient
Back navigation: GO_BACK_QUESTION (index - 1)
Completion: index reaches 9 → proceed to result
```

### 29.3 Answer Storage Format

```
Answers stored as option INDEX (0-based), not option ID

State Shape:
  questionnaireAnswers: {
    [questionId]: optionIndex  // e.g., "q_income": 2
  }

Conversion for Risk Scoring:
  richAnswer = {
    questionId: questionId,
    optionIndex: storedIndex,
    score: questions[questionId].options[storedIndex].score,
    weight: questions[questionId].weight
  }
```

### 29.4 Consent Requirements

Three mandatory checkboxes (all required):
1. **riskAcknowledged**: "I understand this involves risk"
2. **lossAcknowledged**: "I may lose some or all of my investment"
3. **noGuaranteeAcknowledged**: "Returns are not guaranteed"

### 29.4 Investment Constraints

| Constraint | Value |
|------------|-------|
| Minimum | 1,000,000 IRR |
| Maximum | None |
| Input | Numeric keypad, no decimals |

---

## 30. Per-Asset LTV Details

### 30.1 Granular LTV by Asset

| Asset | Layer | Base LTV | Notes |
|-------|-------|----------|-------|
| USDT | FOUNDATION | 90% | Highest (stablecoin) |
| PAXG | FOUNDATION | 70% | Gold-backed |
| IRR_FIXED_INCOME | FOUNDATION | 0% | Cannot borrow against |
| BTC | GROWTH | 50% | Standard |
| ETH | GROWTH | 50% | Standard |
| BNB | GROWTH | 50% | Standard |
| XRP | GROWTH | 45% | Slightly lower (volatility) |
| KAG | GROWTH | 60% | Precious metal (stable) |
| QQQ | GROWTH | 60% | ETF (regulated) |
| SOL | UPSIDE | 30% | High volatility |
| TON | UPSIDE | 30% | High volatility |
| LINK | UPSIDE | 35% | Slightly higher (utility) |
| AVAX | UPSIDE | 30% | High volatility |
| MATIC | UPSIDE | 30% | High volatility |
| ARB | UPSIDE | 30% | High volatility |

### 30.2 LTV Calculation

```
maxBorrowAsset = floor(holdingValueIRR × assetLTV)
maxBorrowGlobal = floor(totalPortfolioIRR × 0.25)
maxBorrow = min(maxBorrowAsset, maxBorrowGlobal - existingLoansIRR)
```

---

## 31. Key Business Invariants

### 31.1 Core Rules

| # | Invariant | Enforcement |
|---|-----------|-------------|
| 1 | Holdings stored as quantity (not value) | v10 data model |
| 2 | Layer % calculated from holdings only | Cash excluded |
| 3 | Protection premium non-refundable | No cancel refund |
| 4 | Collateral frozen until full repayment | Cannot sell |
| 5 | Fixed income accrues daily (simple) | No compounding |
| 6 | Loan interest is 30% annual fixed | Not variable |
| 7 | Rebalancing is deterministic | Same input = same output |
| 8 | All IRR calculations use floor() | Round down |

### 31.2 Edge Case Handling

| Edge Case | Handling |
|-----------|----------|
| Zero holdings | Return early with defaults |
| Frozen collateral | Exclude from rebalance sells |
| Negative quantities | Floor to 0 |
| Dust trades | Skip if < 100,000 IRR |
| Rounding gaps | Phase 2 reconciliation |
| Division by zero | Guard checks on liquidationIRR |

---

## Appendix: Glossary

| Term | Definition |
|------|------------|
| **Activity Feed** | Real-time log of user actions displayed on dashboard (the "Chat UI") |
| **Boundary** | Risk classification of an action: SAFE, DRIFT, STRUCTURAL, STRESS |
| **Foundation** | Low-risk layer: USDT, PAXG, IRR Fixed Income |
| **Friction Copy** | Plain language warnings shown before risky actions |
| **Frozen** | Asset state when used as loan collateral (cannot be traded) |
| **Growth** | Medium-risk layer: BTC, ETH, BNB, XRP, KAG, QQQ |
| **HRAM** | Hybrid Risk-Adjusted Multi-factor balancing algorithm |
| **LTV** | Loan-to-Value ratio for collateralized borrowing |
| **Portfolio Gravity** | Design principle: return to dashboard after every action |
| **Protection** | Insurance-like derivative contract hedging downside |
| **Upside** | High-risk layer: SOL, TON, LINK, AVAX, MATIC, ARB |

---

## Appendix: Figma Token System

This token system is **derivative**, not original. It mirrors Blu Bank's visual primitives and extends them with **semantic and decision-layer tokens** required for Blu Markets.

### Color Tokens

**Core (Inherited)**
```
color.background.primary = #0E1420
color.background.surface = #151C28
color.background.elevated = #1C2433

color.text.primary = #FFFFFF
color.text.secondary = #9AA4B2
color.text.muted = #6B7482

color.blue.primary = #6FAAF8
color.blue.secondary = #4F7EDB
```

**Semantic (Extended)**
```
color.semantic.success.realized = #2ECC71
color.semantic.warning.uncertainty = #F4B942
color.semantic.loss.realized = #E74C3C
color.semantic.neutral.information = color.blue.primary
```

Rule: *No semantic color may be reused for a different meaning.*

### Typography Tokens

```
font.family.primary = BluSans

font.size.xs = 11
font.size.sm = 13
font.size.md = 15
font.size.lg = 18
font.size.xl = 22
font.size.hero = 32

font.weight.regular = 400
font.weight.medium = 500
font.weight.bold = 700
```

**Semantic Text Styles**
```
text.heading.decision = font.size.lg / font.weight.bold
text.number.primary = font.size.hero / font.weight.bold
text.label.supporting = font.size.sm / font.weight.regular
text.annotation = font.size.xs / font.weight.regular
```

### Spacing Tokens

```
space.1 = 4
space.2 = 8
space.3 = 12
space.4 = 16
space.5 = 24
space.6 = 32
space.7 = 40
```

Rule: No arbitrary spacing allowed.

### Radius Tokens

```
radius.sm = 8
radius.md = 12
radius.lg = 16
radius.xl = 24
```

### Elevation Tokens

```
elevation.none = 0

elevation.card = 0px 4px 16px rgba(0,0,0,0.25)
elevation.modal = 0px 12px 32px rgba(0,0,0,0.4)
```

### Component Tokens

**Button**
```
button.primary.background = color.blue.primary
button.primary.text = color.text.primary
button.primary.radius = radius.lg
button.primary.height = 52

button.disabled.background = #2A3446
button.disabled.text = color.text.muted
```

**Card**
```
card.background = color.background.surface
card.radius = radius.lg
card.padding = space.5
```

### Decision Tokens (Blu Markets–Only)

These do not exist in Blu Bank and must not be back-ported.

```
decision.confidence.high = color.semantic.success.realized
decision.confidence.medium = color.semantic.warning.uncertainty
decision.confidence.low = color.semantic.loss.realized
```

Usage is restricted to **explanatory UI**, never CTAs.

### Token Governance Rules

- Tokens are append-only
- No renaming
- No overloading semantics
- Any new token must map to a real user decision

If a token does not change a user decision, it does not belong in the system.

---

## Final Notes

This PRD reflects Blu Markets' product and ethical principles. It translates a best-in-class web experience into a deliberate, mobile-first product while preserving the Activity Feed as a core differentiator.

Every feature was derived from real user flows and existing web app implementation, ensuring complete business logic parity.

### Core Principle

> **If a feature reduces user risk-awareness or limits future options without consent, it's out.**

### Division of Responsibility

| Role | Job |
|------|-----|
| **System** | Show consequences early |
| **User** | Choose |

This is the contract. The app informs; the user decides. No dark patterns, no nudges, no manufactured urgency.
