ck the phase 3 in your memory, # Blu Markets: Native Mobile App PRD

**Version:** 5.0  
**Date:** January 21, 2026  
**Status:** Final — Supersedes v4.1

---

## Document History

| Version | Date | Changes |
|---------|------|---------|
| 5.0 | Jan 21, 2026 | **Major restructure**: 4-tab navigation, Activity Feed as Home tab HERO, Services tab combining Loans+Protection |
| 4.1 | Jan 2026 | Initial comprehensive PRD |

---

## TL;DR

This document defines the UX, UI, and technical requirements for the Blu Markets **native mobile app**. 

### Key Changes in v5.0

| Before (v4.1) | After (v5.0) |
|---------------|--------------|
| 5 bottom tabs | **4 bottom tabs** |
| Portfolio, Protection, Loans, History, Profile | **Home, Portfolio, Services, Profile** |
| Activity Feed on Dashboard | Activity Feed **IS** the Home tab (HERO) |
| Separate History tab | History integrated into Home tab Activity Feed |
| Separate Loans + Protection tabs | Combined into **Services** tab with sub-tabs |

### Core Interaction Model

```
┌─────────────────────────────────────────────────────────────────┐
│                        HOME TAB                                 │
│                   (Command & Control Center)                    │
│                                                                 │
│   User SEES what happened → DECIDES what to do → ACTS          │
│                                                                 │
│   After action: Success modal with deep link to                 │
│   system of record (Portfolio, Services, Profile)               │
└─────────────────────────────────────────────────────────────────┘
```

---

## Problem Statement

### The Core Friction

Iranian users face a **trust/agency paradox** when trying to preserve and grow wealth:

| Option | Problem |
|--------|---------|
| **Bank deposits** | Real returns negative after 40%+ inflation; no agency |
| **Real estate/gold** | Illiquid, high entry barrier, no diversification |
| **Crypto apps** | Extractive design, no risk guardrails, gambling-adjacent UX |
| **Foreign exchange** | Sanction-constrained, volatile, legally gray |

**The gap**: No product exists that offers *exposure without annihilation* — a system that provides growth potential while actively protecting users from catastrophic loss.

### The Promise

> **Blu Markets gives Iranian users a way to grow wealth without gambling it away — through a system that tells the truth, shows consequences early, and never manufactures urgency.**

---

## Table of Contents

**Part I: Strategy & Vision**
1. [Goals & Non-Goals](#1-goals--non-goals)
2. [User Stories](#2-user-stories)
3. [Success Metrics](#3-success-metrics)

**Part II: User Experience**
4. [Navigation Architecture](#4-navigation-architecture)
5. [Home Tab (Activity Feed / Chat UI)](#5-home-tab-activity-feed--chat-ui)
6. [User Flows](#6-user-flows)

**Part III: Screen Specifications**
7. [Screen-by-Screen Specs](#7-screen-by-screen-specs)

**Part IV: Technical Implementation**
8. [Design System](#8-design-system)
9. [Data Models](#9-data-models)
10. [Technical Requirements](#10-technical-requirements)

**Part V: Business Logic Reference**
11. [Risk Profiling Algorithm](#11-risk-profiling-algorithm)
12. [Asset Configuration](#12-asset-configuration)
13. [Boundary Classification](#13-boundary-classification)
14. [Trading Rules](#14-trading-rules)
15. [Loan Rules](#15-loan-rules)
16. [Protection Rules](#16-protection-rules)

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
| Understand portfolio state at a glance | Home tab shows value + allocation + recent activity |
| Take actions with clear outcomes | Preview screens with before/after visualization |
| Avoid forced selling or irreversible damage | Friction copy, boundary warnings, confirmation flows |
| See a narrative of their financial journey | Activity Feed as HERO of Home tab |

### Non-Goals

| Explicitly Out of Scope | Rationale |
|------------------------|-----------|
| Market/asset browsing screen | Users trade from Home, not by browsing a market |
| Deep trading tools (limit orders, charts) | Not aligned with "mindful" philosophy |
| Staking or yield farming | Complexity contradicts simplicity goal |
| Speculative tooling (leverage trading) | Against risk-aware principles |
| Social/community features | Focus on individual portfolio management |

---

## 2. User Stories

### Onboarding
- As a **new user**, I want to create my risk profile so I get a recommended portfolio that matches my tolerance.
- As a **new user**, I want to understand what I'm consenting to before investing.

### Home Tab (Command Center)
- As a **user**, I want to see my recent activity and portfolio status immediately when I open the app.
- As a **user**, I want to act on alerts (rebalance, payments, protection expiry) directly from the Home tab.
- As a **user**, I want completed actions to link me to where that record lives (Portfolio, Services).

### Portfolio Management
- As a **user**, I want to view my total portfolio value and allocation by layer.
- As a **user**, I want to buy or sell assets and see exactly how my portfolio will be affected before confirming.
- As a **user**, I want to rebalance when my portfolio drifts, with clear visibility into what trades will execute.

### Services (Loans & Protection)
- As a **user**, I want to borrow money against my holdings without selling them.
- As a **user**, I want to protect high-risk assets against losses through insurance-like contracts.
- As a **user**, I want to manage both loans and protection in one place.

---

## 3. Success Metrics

### Engagement Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Daily Active Users (DAU) | 40% of registered | Weekly rolling average |
| Session duration | > 3 minutes | Median session length |
| Home tab scroll depth | > 60% | Users who scroll past Activity Feed |
| Actions per session | > 0.5 | Trades + rebalances + protections |

### Trust Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Onboarding completion | > 70% | From welcome to funded |
| Consent screen drop-off | < 20% | Users who abandon at consent |
| Support tickets | < 2% of users | Monthly unique users with tickets |
| Protection adoption | > 30% | Users with at least one active protection |

### Health Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| App crash rate | < 0.5% | Sessions with crash |
| API error rate | < 1% | Failed API calls |
| Cold start time | < 2s | Time to interactive |

---

# Part II: User Experience

## 4. Navigation Architecture

### Bottom Navigation (4 Tabs)

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│                      [MAIN CONTENT]                             │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│      🏠            📊            💼            👤               │
│     Home        Portfolio      Services       Profile           │
└─────────────────────────────────────────────────────────────────┘
```

### Tab Definitions

| Tab | Icon | Purpose | Key Components |
|-----|------|---------|----------------|
| **Home** | 🏠 | Command & Control Center | Activity Feed (HERO), portfolio value, action buttons |
| **Portfolio** | 📊 | System of Record: Holdings | Allocation bar, holdings by layer, asset details |
| **Services** | 💼 | System of Record: Products | Sub-tabs for Loans and Protection |
| **Profile** | 👤 | User Settings | Risk profile, settings, support |

### Services Tab Structure

```
┌─────────────────────────────────────────────────────────────────┐
│  Services                                                       │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────┬─────────────────────┐                  │
│  │       Loans         │     Protection      │   ← Horizontal   │
│  │      ═══════        │                     │     sub-tabs     │
│  └─────────────────────┴─────────────────────┘                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  (Content changes based on selected sub-tab)                    │
│                                                                 │
│  Loans: Active loans, borrow capacity, repayment                │
│  Protection: Active protections, eligible assets, purchase      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Navigation Patterns

| Pattern | When to Use | Example |
|---------|-------------|---------|
| **Bottom Sheet** | All action forms | Trade, Protect, Borrow, Repay, Rebalance, Add Funds |
| **Modal** | Confirmations, success | Trade success, loan created |
| **Push Navigation** | Detail views | Asset detail, loan detail, protection detail |
| **Tab Switch** | Section navigation | Home → Portfolio |
| **Deep Link** | Post-action navigation | "View in Portfolio →" after trade |

### Deep Link Pattern

After every completed action, show a success modal with a deep link to the system of record:

```
┌─────────────────────────────────────────┐
│         ✅ Trade Successful             │
│                                         │
│    Bought 0.01 BTC for 1,500,000 IRR    │
│    Boundary: SAFE                       │
│                                         │
│    ┌─────────────────────────────────┐  │
│    │      View in Portfolio →        │  │ ← Deep link
│    └─────────────────────────────────┘  │
│                                         │
│    ┌─────────────────────────────────┐  │
│    │           Done                  │  │ ← Stay in Home
│    └─────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

| Action | Deep Link Destination |
|--------|----------------------|
| Trade (buy/sell) | Portfolio tab |
| Rebalance | Portfolio tab |
| Add Funds | Portfolio tab |
| Loan created | Services tab → Loans |
| Loan repayment | Services tab → Loans |
| Protection purchased | Services tab → Protection |

---

## 5. Home Tab (Activity Feed / Chat UI)

### Overview

The Home tab is the **Command & Control Center** of the app. The Activity Feed is not just a feature — it's the **primary interaction paradigm**.

### Design Philosophy

```
SEE → DECIDE → ACT → CONFIRM → NAVIGATE

User sees        User makes      User taps      Success modal    Deep link to
activity cards → decision via → action button → confirms result → system of record
                 card buttons
```

### Screen Layout

```
┌─────────────────────────────────────────────────────────────────┐
│ ● Balanced                              🔔  (U)                 │ ← Status bar
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  📋 Recent Activity                                             │ ← Section header
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ ✅ Bought 0.01 BTC                              SAFE    │   │
│  │    5m ago                                               │   │
│  │                              [View in Portfolio →]      │   │ ← Deep link
│  └─────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ ⚠️ Portfolio drifted 8% from target              DRIFT  │   │
│  │    2h ago                                               │   │
│  │    [Rebalance Now]  [Later]                             │   │ ← Action buttons
│  └─────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 💰 Loan payment due in 3 days                           │   │
│  │    383,333 IRR                                          │   │
│  │    [Pay Now]  [View Loan →]                             │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                        ~40% ↑  │ ← Activity Feed HERO
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│         4,478,943,200 IRR                                       │ ← Portfolio Value
│              📈 +1.2% Today                                     │
│                                                                 │
│  ████████████████░░░░░░░░░░░░░░░░░░                            │ ← Allocation Bar
│  Target: ─────────────────────────                              │
│  ● Foundation 55%  ● Growth 35%  ● Upside 10%                  │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                      │
│  │    +     │  │    ↔     │  │    🛡    │                      │
│  │Add Funds │  │  Trade   │  │ Protect  │                      │ ← Action Buttons
│  └──────────┘  └──────────┘  └──────────┘                      │
├─────────────────────────────────────────────────────────────────┤
│  Holdings                                          View All →   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ ₿ Bitcoin              2,236,971,600 IRR       +2.4%    │   │ ← Top holdings
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### Activity Card Types

| Type | When Shown | Actions Available |
|------|------------|-------------------|
| **Completed Action** | After trade, rebalance, payment | Deep link to system of record |
| **Alert** | Drift warning, payment due, protection expiring | Primary action + dismiss/snooze |
| **Recommendation** | AI-driven suggestions | Accept + dismiss |
| **Status Update** | Price alerts, market events | View details |

### Activity Card Structure

```typescript
interface ActivityCard {
  id: string;
  type: 'COMPLETED' | 'ALERT' | 'RECOMMENDATION' | 'STATUS';
  timestamp: Date;
  
  // Content
  icon: string;
  title: string;
  subtitle?: string;
  boundary?: 'SAFE' | 'DRIFT' | 'STRUCTURAL' | 'STRESS';
  
  // Actions (for alerts)
  primaryAction?: {
    label: string;      // "Rebalance Now", "Pay Now"
    onPress: () => void;
  };
  secondaryAction?: {
    label: string;      // "Later", "Dismiss"
    onPress: () => void;
  };
  
  // Deep link (for completed actions)
  deepLink?: {
    label: string;      // "View in Portfolio →"
    tab: 'Portfolio' | 'Services';
    params?: object;
  };
}
```

### Boundary Indicator Colors

| Boundary | Meaning | Color | Badge |
|----------|---------|-------|-------|
| SAFE | Action aligns with target | Green | 🟢 |
| DRIFT | Minor deviation (5-10%) | Amber | 🟡 |
| STRUCTURAL | Major deviation (10-20%) | Orange | 🟠 |
| STRESS | High risk (>20% or breaches limits) | Red | 🔴 |

### Action Message Templates

| Action Type | Message Format |
|-------------|----------------|
| Portfolio Created | "Started with {amount} IRR" |
| Add Funds | "Added {amount} IRR cash" |
| Trade (Buy) | "Bought {asset} ({amount} IRR)" |
| Trade (Sell) | "Sold {asset} ({amount} IRR)" |
| Rebalance | "Rebalanced portfolio ({n} sells, {m} buys)" |
| Protect | "Protected {asset} for {months}mo" |
| Borrow | "Borrowed {amount} IRR against {asset}" |
| Repay | "Repaid {amount} IRR · Installment {n}/{total}" |
| Protection Expiring | "SOL protection expires in {days} days" |
| Payment Due | "Loan payment due in {days} days" |
| Drift Warning | "Portfolio drifted {percent}% from target" |

---

## 6. User Flows

### 6.1 Onboarding Flow

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
│  [FARSI TEXT]   │
└────────┬────────┘
         ▼
┌─────────────────┐
│ Profile Result  │
│ "متعادل"        │
│  Donut chart    │
│  50/35/15 split │
└────────┬────────┘
         ▼
┌─────────────────┐
│  Consent        │
│  [FARSI RTL]    │
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
│ [Go to Home →]  │
└─────────────────┘
```

### 6.2 Trade Flow (From Home Tab)

```
Home Tab
    │
    ▼ (Tap "Trade" button)
┌─────────────────┐
│ Asset Selector  │
│ (Bottom Sheet)  │
│ Search/filter   │
│ Layer badges    │
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
│ Boundary: SAFE  │
│ ⚠ Warning copy  │
│ ─────────────── │
│ [Confirm Trade] │
└────────┬────────┘
         ▼
┌─────────────────┐
│ ✅ Success Modal │
│ Bought 0.01 BTC │
│                 │
│ [View in        │
│  Portfolio →]   │
│                 │
│ [Done]          │
└────────┬────────┘
         ▼
    Home Tab (Activity Feed updated)
```

### 6.3 Rebalance Flow (From Home Tab Alert)

```
Home Tab
    │
    ▼ (Drift card shows "Rebalance Now")
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
│ [Rebalance Now] │
└────────┬────────┘
         ▼
┌─────────────────┐
│ ✅ Success Modal │
│ Rebalanced      │
│ 2 sells, 3 buys │
│                 │
│ [View in        │
│  Portfolio →]   │
│                 │
│ [Done]          │
└────────┬────────┘
         ▼
    Home Tab (Activity Feed updated)
```

### 6.4 Loan Flow (From Services Tab)

```
Services Tab → Loans sub-tab
    │
    ▼ (Tap "Borrow")
┌─────────────────┐
│ Borrow Sheet    │
│ ─────────────── │
│ Collateral:     │
│ [ETH ▼] 10M IRR │
│ ─────────────── │
│ Borrow amount:  │
│ _______ IRR     │
│ Max: 5M (50%)   │
│ ─────────────── │
│ Term: [6mo ▼]   │
│ Monthly: 383K   │
│ ─────────────── │
│ Health: 🟢 Good │
│ Liquidation at  │
│ -40% collateral │
│ ─────────────── │
│ [Confirm Loan]  │
└────────┬────────┘
         ▼
┌─────────────────┐
│ ✅ Success Modal │
│ Borrowed 2M IRR │
│                 │
│ [View Loan →]   │
│                 │
│ [Done]          │
└────────┬────────┘
         ▼
    Services Tab → Loans (loan visible)
```

### 6.5 Protection Flow (From Services Tab)

```
Services Tab → Protection sub-tab
    │
    ▼ (Tap eligible asset "SOL")
┌─────────────────┐
│ Protection Sheet│
│ ─────────────── │
│ Protect SOL     │
│ Value: 750K IRR │
│ ─────────────── │
│ Duration:       │
│ [1mo] [3mo✓]    │
│ [6mo] [12mo]    │
│ ─────────────── │
│ Premium:        │
│ 27,000 IRR      │
│ (1.2% × 3mo)    │
│ ─────────────── │
│ "If SOL drops,  │
│  you're covered"│
│ ─────────────── │
│ [Protect Now]   │
└────────┬────────┘
         ▼
┌─────────────────┐
│ ✅ Success Modal │
│ Protected SOL   │
│ for 3 months    │
│                 │
│ [View           │
│  Protection →]  │
│                 │
│ [Done]          │
└────────┬────────┘
         ▼
    Services Tab → Protection (visible)
```

### 6.6 Loan Payment (From Home Tab Alert)

```
Home Tab
    │
    ▼ (Payment due card shows "Pay Now")
┌─────────────────┐
│ Repayment Sheet │
│ ─────────────── │
│ Loan #1         │
│ ETH collateral  │
│ ─────────────── │
│ Due: 383,333 IRR│
│ Installment 3/6 │
│ ─────────────── │
│ Pay from cash:  │
│ Available: 5M   │
│ ─────────────── │
│ [Pay 383,333]   │
└────────┬────────┘
         ▼
┌─────────────────┐
│ ✅ Success Modal │
│ Paid 383,333    │
│ 3/6 complete    │
│                 │
│ [View Loan →]   │
│                 │
│ [Done]          │
└────────┬────────┘
         ▼
    Home Tab (Activity Feed updated)
```

---

# Part III: Screen Specifications

## 7. Screen-by-Screen Specs

### 7.1 Home Screen

**Purpose**: Command & Control Center — where users see activity, make decisions, and take actions.

| Section | Components |
|---------|------------|
| **Header** | Status badge (Balanced/Drift/Attention), notification bell, profile avatar |
| **Activity Feed** | Scrollable cards (HERO — 40% of screen), boundary badges, action buttons, deep links |
| **Portfolio Summary** | Total value, daily change %, allocation bar with target overlay |
| **Action Buttons** | Add Funds, Trade, Protect (opens respective sheets) |
| **Holdings Preview** | Top 3 holdings with values, "View All →" links to Portfolio tab |

**Interactions**:
- Pull-to-refresh: Reloads activity and portfolio
- Tap activity card: Opens relevant sheet or navigates via deep link
- Tap "Add Funds": Opens AddFundsSheet
- Tap "Trade": Opens AssetSelectorSheet → TradeSheet
- Tap "Protect": Navigates to Services tab → Protection
- Tap "View All": Navigates to Portfolio tab

### 7.2 Portfolio Screen

**Purpose**: System of Record for holdings and allocation.

| Section | Components |
|---------|------------|
| **Header** | "Portfolio" title |
| **Value Card** | Total holdings value, cash balance |
| **Allocation Bar** | Current vs target, layer percentages |
| **Holdings List** | Grouped by layer (Foundation, Growth, Upside), expandable |

**Holdings Item**:
```
┌─────────────────────────────────────────────────────────────────┐
│  [₿]  Bitcoin                      2,236,971,600 IRR           │
│       0.007 BTC                               $624   +2.4%     │
└─────────────────────────────────────────────────────────────────┘
```

**Interactions**:
- Tap layer header: Expand/collapse holdings in that layer
- Tap holding: Navigate to Asset Detail screen
- Pull-to-refresh: Reloads portfolio data

### 7.3 Services Screen

**Purpose**: System of Record for financial products (Loans + Protection).

| Section | Components |
|---------|------------|
| **Header** | "Services" title |
| **Sub-tab Bar** | [Loans] [Protection] — horizontal tabs |
| **Tab Content** | Changes based on selected sub-tab |

**Loans Sub-tab**:
```
┌─────────────────────────────────────────────────────────────────┐
│  Available to Borrow                                            │
│  25,000,000 IRR                              [Borrow]           │
├─────────────────────────────────────────────────────────────────┤
│  Active Loans                                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Loan #1 · ETH collateral                               │   │
│  │  2,000,000 IRR · 4/6 payments                           │   │
│  │  Next due: Jan 25 · 383,333 IRR         [Pay] [Details] │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

**Protection Sub-tab**:
```
┌─────────────────────────────────────────────────────────────────┐
│  Active Protections                                             │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  🛡 SOL Protected                                        │   │
│  │  88 days remaining · Expires Apr 15                     │   │
│  └─────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────┤
│  Protect Your Assets                                            │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                      │
│  │   ETH    │  │   BTC    │  │  AVAX    │  ← Eligible assets   │
│  │  1.2%/mo │  │  0.8%/mo │  │  1.5%/mo │                      │
│  └──────────┘  └──────────┘  └──────────┘                      │
└─────────────────────────────────────────────────────────────────┘
```

### 7.4 Profile Screen

**Purpose**: User settings and account management.

| Section | Components |
|---------|------------|
| **Header** | Avatar, phone number, member since |
| **Risk Profile** | Profile name (EN + FA), score, allocation bar, "Retake Quiz" |
| **Settings** | Notifications toggle, Face ID toggle, Language selector |
| **Support** | Help Center, Contact Us, Terms, Privacy |
| **Footer** | Version number, Logout button |

### 7.5 Asset Detail Screen (Push Navigation)

**Purpose**: Detailed view of a single holding.

| Section | Components |
|---------|------------|
| **Header** | Back button, asset name, layer badge |
| **Value Card** | Current value IRR, USD equivalent, quantity |
| **Performance** | Daily/weekly/monthly change |
| **Actions** | [Buy More] [Sell] [Protect] (if eligible) |
| **Protection Status** | If protected, shows expiry and coverage |
| **Loan Status** | If used as collateral, shows frozen indicator |

### 7.6 Bottom Sheets

All action forms use bottom sheets that slide up from the bottom.

| Sheet | Trigger | Content |
|-------|---------|---------|
| **TradeSheet** | Trade button, asset tap | Asset, BUY/SELL toggle, amount, preview, confirm |
| **AddFundsSheet** | Add Funds button | Amount input, quick chips, confirm |
| **RebalanceSheet** | Drift card "Rebalance Now" | Before/after, trade list, confirm |
| **BorrowSheet** | Loans "Borrow" button | Collateral, amount, term, health, confirm |
| **RepaySheet** | Loan "Pay" button, payment due card | Amount due, pay from cash, confirm |
| **ProtectionSheet** | Asset "Protect", eligible asset tap | Duration, premium, confirm |

### 7.7 Modals

| Modal | Trigger | Content |
|-------|---------|---------|
| **SuccessModal** | After any successful action | Checkmark, summary, deep link button, done button |
| **ErrorModal** | After failed action | Error icon, message, retry button |
| **ConfirmationModal** | Before STRUCTURAL/STRESS actions | Warning text, "I understand" checkbox, confirm |

---

# Part IV: Technical Implementation

## 8. Design System

### Color Tokens

**Core**
```
background.primary = #0A0E17
background.surface = #151C28
background.elevated = #1C2433

text.primary = #FFFFFF
text.secondary = #9AA4B2
text.muted = #6B7280

blue.primary = #6FAAF8
```

**Layer Colors**
```
layer.foundation = #3B82F6 (blue)
layer.growth = #A855F7 (purple)
layer.upside = #10B981 (green)
```

**Semantic**
```
semantic.success = #2ECC71
semantic.warning = #F4B942
semantic.error = #E74C3C
semantic.info = #6FAAF8
```

**Boundary Colors**
```
boundary.safe = #10B981 (green)
boundary.drift = #F4B942 (amber)
boundary.structural = #F97316 (orange)
boundary.stress = #E74C3C (red)
```

### Typography

```
font.family = System default (San Francisco / Roboto)

font.size.xs = 11
font.size.sm = 13
font.size.md = 15
font.size.lg = 18
font.size.xl = 22
font.size.hero = 32
```

### Spacing

```
space.1 = 4
space.2 = 8
space.3 = 12
space.4 = 16
space.5 = 24
space.6 = 32
```

### Component Dimensions

```
bottomNav.height = 64 + 34 (safe area)
bottomSheet.maxHeight = 90%
button.height = 52
card.radius = 16
```

---

## 9. Data Models

### Portfolio State

```typescript
interface PortfolioState {
  cashIrr: number;
  holdings: Holding[];
  targetLayerPct: { foundation: number; growth: number; upside: number };
  status: 'BALANCED' | 'SLIGHTLY_OFF' | 'ATTENTION_REQUIRED';
}

interface Holding {
  assetId: string;
  quantity: number;
  layer: 'FOUNDATION' | 'GROWTH' | 'UPSIDE';
  frozen: boolean;
  protectionId?: string;
}
```

### Activity Entry

```typescript
interface ActivityEntry {
  id: string;
  type: 'TRADE' | 'REBALANCE' | 'ADD_FUNDS' | 'BORROW' | 'REPAY' | 'PROTECT' | 'ALERT';
  timestamp: Date;
  title: string;
  subtitle?: string;
  boundary?: 'SAFE' | 'DRIFT' | 'STRUCTURAL' | 'STRESS';
  deepLink?: {
    tab: 'Portfolio' | 'Services';
    params?: object;
  };
  actions?: {
    primary?: { label: string; action: string };
    secondary?: { label: string; action: string };
  };
}
```

---

## 10. Technical Requirements

### Platform Support

| Platform | Minimum Version |
|----------|-----------------|
| iOS | 14.0 |
| Android | API 24 (Android 7.0) |

### Performance Targets

| Metric | Target |
|--------|--------|
| Cold start | < 2s |
| Screen transition | < 300ms |
| API response | < 500ms (P95) |
| Memory usage | < 150MB |

### Dependencies

```
React Native 0.73+
Expo SDK 50+
@react-navigation/native
@react-navigation/bottom-tabs
@gorhom/bottom-sheet
react-native-reanimated
redux-toolkit
```

---

# Part V: Business Logic Reference

## 11. Risk Profiling Algorithm

### Score Calculation

```
totalScore = sum(questionScores) / numberOfQuestions
riskTier = mapScoreToTier(totalScore)
```

| Score Range | Tier | Profile (EN) | Profile (FA) |
|-------------|------|--------------|--------------|
| 1-3 | LOW | Capital Preservation | محتاط |
| 4-5 | MEDIUM | Balanced | متعادل |
| 6-7 | MEDIUM_HIGH | Growth | رشد |
| 8-10 | HIGH | Aggressive | جسور |

### Target Allocation by Tier

| Tier | Foundation | Growth | Upside |
|------|------------|--------|--------|
| LOW | 70% | 25% | 5% |
| MEDIUM | 50% | 35% | 15% |
| MEDIUM_HIGH | 35% | 40% | 25% |
| HIGH | 20% | 45% | 35% |

---

## 12. Asset Configuration

### Layer Assignment

| Layer | Assets |
|-------|--------|
| **FOUNDATION** | USDT, USDC, DAI, PAXG, IRR_FIXED_INCOME |
| **GROWTH** | BTC, ETH, BNB, XRP |
| **UPSIDE** | SOL, TON, LINK, AVAX, MATIC, ARB |

### Asset Properties

```typescript
interface AssetConfig {
  id: string;
  symbol: string;
  name: string;
  layer: 'FOUNDATION' | 'GROWTH' | 'UPSIDE';
  ltv: number;           // Loan-to-value ratio
  protectionEligible: boolean;
  protectionPremium: number;  // Monthly rate (e.g., 0.012 = 1.2%)
}
```

---

## 13. Boundary Classification

### Calculation

```typescript
function classifyBoundary(
  currentAllocation: LayerPct,
  targetAllocation: LayerPct,
  afterAllocation: LayerPct
): Boundary {
  const driftBefore = calculateMaxDrift(currentAllocation, targetAllocation);
  const driftAfter = calculateMaxDrift(afterAllocation, targetAllocation);
  
  // Moving toward target?
  if (driftAfter < driftBefore) return 'SAFE';
  
  // Check magnitude
  if (driftAfter <= 5) return 'SAFE';
  if (driftAfter <= 10) return 'DRIFT';
  if (driftAfter <= 20) return 'STRUCTURAL';
  return 'STRESS';
}
```

### Friction by Boundary

| Boundary | Friction Level | UI Treatment |
|----------|----------------|--------------|
| SAFE | None | Green badge, one-tap confirm |
| DRIFT | Low | Amber badge, warning text |
| STRUCTURAL | Medium | Orange badge, expand to see impact, require scroll |
| STRESS | High | Red badge, "I understand" checkbox, disabled by default |

---

## 14. Trading Rules

### Minimum Trade

```
MIN_TRADE_IRR = 100,000
```

### Trade Validation

1. Amount ≥ MIN_TRADE_IRR
2. For SELL: quantity available and not frozen
3. For BUY: sufficient cash balance
4. Boundary classification ≠ STRESS (or user explicitly acknowledges)

### Trade Spread

```
TRADE_SPREAD = 0.003 (0.3%)
effectivePrice = side === 'BUY' 
  ? marketPrice * (1 + TRADE_SPREAD)
  : marketPrice * (1 - TRADE_SPREAD)
```

---

## 15. Loan Rules

### LTV by Asset

| Asset | LTV |
|-------|-----|
| USDT, USDC | 70% |
| PAXG | 70% |
| BTC, ETH | 50% |
| SOL, LINK | 30% |

### Loan Constraints

```
MIN_LOAN_IRR = 1,000,000
MAX_PORTFOLIO_LEVERAGE = 25%  // Total loans ≤ 25% of portfolio
INTEREST_RATE = 30% annual (simple interest)
```

### Loan Health

```
health = collateralValue / loanBalance
LIQUIDATION_THRESHOLD = 1.25  // Liquidate if health < 1.25
```

---

## 16. Protection Rules

### Premium Calculation

```
premium = holdingValue × monthlyRate × durationMonths
```

### Duration Options

```
PROTECTION_DURATIONS = [1, 3, 6, 12] // months
```

### Eligible Assets

Only GROWTH and UPSIDE layer assets are eligible for protection.

---

# Appendix: Glossary

| Term | Definition |
|------|------------|
| **Activity Feed** | Real-time log of user actions displayed on Home tab (the "Chat UI") |
| **Boundary** | Risk classification of an action: SAFE, DRIFT, STRUCTURAL, STRESS |
| **Deep Link** | Navigation from success modal to system of record (Portfolio, Services) |
| **Foundation** | Low-risk layer: USDT, PAXG, IRR Fixed Income |
| **Friction Copy** | Plain language warnings shown before risky actions |
| **Frozen** | Asset state when used as loan collateral (cannot be traded) |
| **Growth** | Medium-risk layer: BTC, ETH, BNB, XRP |
| **Home Tab** | Command & Control Center with Activity Feed as HERO |
| **HRAM** | Hybrid Risk-Adjusted Multi-factor balancing algorithm |
| **LTV** | Loan-to-Value ratio for collateralized borrowing |
| **Services Tab** | Combined Loans + Protection with horizontal sub-tabs |
| **System of Record** | Tab where data lives (Portfolio for holdings, Services for products) |
| **Upside** | High-risk layer: SOL, TON, LINK, AVAX, MATIC, ARB |

---

# Appendix: Figma Token System

### Color Tokens

```
color.background.primary = #0A0E17
color.background.surface = #151C28
color.background.elevated = #1C2433

color.text.primary = #FFFFFF
color.text.secondary = #9AA4B2
color.text.muted = #6B7280

color.layer.foundation = #3B82F6
color.layer.growth = #A855F7
color.layer.upside = #10B981

color.boundary.safe = #10B981
color.boundary.drift = #F4B942
color.boundary.structural = #F97316
color.boundary.stress = #E74C3C
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

### Component Tokens

```
bottomNav.height = 64
bottomNav.paddingBottom = 34
card.radius = 16
card.padding = 16
button.height = 52
button.radius = 16
```

---

## Final Notes

This PRD v5.0 reflects the updated navigation architecture with 4 tabs and Activity Feed as the Home tab HERO.

### Core Principles

1. **Home is Command & Control**: Users see, decide, and act from one place
2. **Deep Links Connect Actions to Records**: Every action links to where that data lives
3. **Services Combines Products**: Loans and Protection are financial products, grouped together
4. **No Market Browsing**: Users trade from Home, not by browsing assets
5. **Activity Feed is HERO**: The primary interaction paradigm, not a secondary feature

### Division of Responsibility

| Role | Job |
|------|-----|
| **System** | Show consequences early |
| **User** | Choose |

This is the contract. The app informs; the user decides. No dark patterns, no nudges, no manufactured urgency.

---

**END OF PRD v5.0**
