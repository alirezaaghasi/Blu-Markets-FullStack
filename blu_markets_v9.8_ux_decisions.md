# Blu Markets v9.8 — UX Decisions Summary

**Date:** January 14, 2026  
**Total Issues Reviewed:** 20  
**Decisions Made:** 20

---

## Quick Reference: All Decisions

| # | Issue | Decision |
|---|-------|----------|
| 1 | Emoji allocation display | **Text labels:** `Foundation 52% · Growth 35% · Upside 14%` |
| 2 | Boundary system terminology | **Status style:** ✓ Looks good, ⚠ Minor drift, ⚠ Needs review, ⛔ High risk |
| 3 | Portfolio holdings overload | **Collapse by default** — Layer summaries, tap to expand |
| 4 | Cryptic asset names | **Full name + ticker:** `Nasdaq 100 (QQQ)`, `Bitcoin (BTC)` |
| 5 | Loan risk visibility | **Health bar + plain language warning** |
| 6 | Entry IDs in history | **Remove completely** |
| 7 | Sidebar action log format | **Verb-based:** `Sold Bitcoin (7.5M)`, `Bought Toncoin (17.5M)` |
| 8 | Too many action buttons | **Two primary + menu:** [Add Funds] [Rebalance] visible, rest in menu |
| 9 | Rebalance preview detail | **Summary + expandable:** Summary default, "See all trades ▼" expands |
| 10 | Stress toggle | **Remove completely** |
| 11 | Empty left panel during onboarding | **Show progress steps:** Step 1 of 4 with step names |
| 12 | No minimum amount shown | **Show minimum upfront:** "Minimum: 5,000,000 IRR" |
| 13 | Brief layer descriptions | **Two-line description:** Label + benefit explanation |
| 14 | Protection tab lacks context | **Header + per-card explanation** of what user receives |
| 15 | Jargon in constraint messages | **Plain language + hide zero drift** |
| 16 | "Balanced" badge | **Keep current** |
| 17 | Redundant loan info | **Consolidate:** Badge shows count, header shows total |
| 18 | Empty states lack guidance | **Explanation + CTA:** Explain benefit + action button |
| 19 | Tab names | **Keep current:** Portfolio, Protection, Loans, History |
| 20 | Quick amount buttons currency | **Label above:** "Quick amounts (IRR):" + compact buttons |

---

## Detailed Implementation Guide

### Issue 1: Allocation Display
**Location:** BEFORE/AFTER previews, History entries, Action confirmations

```
Before: 🛡️52% 📈35% 🚀14%
After:  Foundation 52% · Growth 35% · Upside 14%
```

**Implementation:**
- Replace emoji-based format everywhere
- Use layer colors for dots if desired: `● 52% · ● 35% · ● 14%`
- Separator: middle dot (·) or pipe (|)

---

### Issue 2: Boundary Terminology
**Location:** Action previews, History entries, Confirmation modals

| Old | New |
|-----|-----|
| `Boundary: SAFE` | `✓ Looks good` |
| `Boundary: DRIFT` | `⚠ Minor drift` |
| `Boundary: STRUCTURAL` | `⚠ Needs review` |
| `Boundary: STRESS` | `⛔ High risk` |

**Implementation:**
- Update `frictionCopyForBoundary()` in `boundary.js`
- Update badge styles: green (✓), yellow (⚠), red (⛔)

---

### Issue 3: Collapsible Holdings
**Location:** Portfolio tab

```jsx
// Collapsed state (default)
<LayerSummary>
  <LayerHeader>
    FOUNDATION · 250,000,000 IRR
    <span>2 assets · On target</span>
    <ExpandIcon />
  </LayerHeader>
</LayerSummary>

// Expanded state (on tap)
<LayerSummary expanded>
  <LayerHeader>...</LayerHeader>
  <AssetRow>USDT...</AssetRow>
  <AssetRow>Fixed Income...</AssetRow>
</LayerSummary>
```

**Implementation:**
- Add `expanded` state per layer
- Default all layers to collapsed
- Show asset count and status in collapsed view

---

### Issue 4: Asset Names
**Location:** Holdings, Trade confirmations, History

| Ticker | Full Display |
|--------|--------------|
| QQQ | Nasdaq 100 (QQQ) |
| BTC | Bitcoin (BTC) |
| ETH | Ethereum (ETH) |
| SOL | Solana (SOL) |
| TON | Toncoin (TON) |
| USDT | Tether (USDT) |
| Fixed Income (IRR) | Iranian Bonds |
| Gold | Gold |

**Implementation:**
- Create asset name mapping in constants
- Update all asset displays to use full names

---

### Issue 5: Loan Cards
**Location:** Loans tab

```jsx
<LoanCard status="warning">
  <LoanHeader>LOAN — USDT Collateral</LoanHeader>
  <LoanAmount>Borrowed: 50,000,000 IRR</LoanAmount>
  
  <HealthBar percentage={70} status="warning" />
  <HealthLabel>70% used</HealthLabel>
  
  <WarningMessage>
    ⚠ Close to limit. If USDT drops 15%, this loan will auto-close.
  </WarningMessage>
  
  <ButtonGroup>
    <Button>Add Collateral</Button>
    <Button>Repay</Button>
  </ButtonGroup>
</LoanCard>
```

**Health bar colors:**
- 0-50%: Green (#34d399)
- 50-65%: Yellow (#fbbf24)
- 65-75%: Orange (#f97316)
- 75%+: Red (#ef4444)

---

### Issue 6: Remove Entry IDs
**Location:** History tab, expanded entries

```jsx
// Remove this line from HistoryEntry component:
// <EntryId>ID: {entry.id}</EntryId>
```

---

### Issue 7: Sidebar Action Log
**Location:** Left sidebar

| Action | Old Format | New Format |
|--------|------------|------------|
| Sell | `-Bitcoin 7.5M` | `Sold Bitcoin (7.5M)` |
| Buy | `+Toncoin 17.5M` | `Bought Toncoin (17.5M)` |
| Protect | `☂️ Bitcoin protected 3mo` | `Protected Bitcoin (3mo)` |
| Borrow | `💰 Borrowed 10.0M against Gold` | `Borrowed 10M (Gold collateral)` |
| Rebalance | `⚖️ Rebalanced` | `Rebalanced portfolio` |
| Repay | `💰 Repaid 5M` | `Repaid loan (5M)` |

---

### Issue 8: Action Buttons
**Location:** Bottom of left sidebar

```jsx
// Visible buttons
<PrimaryButton>Add Funds</PrimaryButton>
<SecondaryButton>Rebalance</SecondaryButton>
<MenuButton>More ▼</MenuButton>

// In "More" menu
<MenuItem>☂️ Protect</MenuItem>
<MenuItem>💰 Borrow</MenuItem>

// Move to Settings (separate screen)
<DangerButton>Reset Portfolio</DangerButton>
```

---

### Issue 9: Rebalance Preview
**Location:** Rebalance confirmation modal

```jsx
<RebalancePreview>
  <Summary>
    <SummaryLine>Selling 2 assets (8,125,000 IRR)</SummaryLine>
    <SummaryLine>Buying 6 assets (8,125,000 IRR)</SummaryLine>
  </Summary>
  
  <ExpandButton onClick={toggleDetails}>
    {expanded ? 'Hide trades ▲' : 'See all trades ▼'}
  </ExpandButton>
  
  {expanded && (
    <TradesList>
      <Trade asset="USDT" amount={-3656250} />
      <Trade asset="Fixed Income" amount={-4468750} />
      ...
    </TradesList>
  )}
  
  <ButtonGroup>
    <Button primary>Confirm</Button>
    <Button>Cancel</Button>
  </ButtonGroup>
</RebalancePreview>
```

---

### Issue 10: Remove Stress Toggle
**Location:** Top right corner

```jsx
// Remove entirely:
// <Toggle label="Stress" checked={stressMode} onChange={...} />
```

---

### Issue 11: Onboarding Progress
**Location:** Left sidebar during onboarding

```jsx
<OnboardingProgress currentStep={1} totalSteps={4}>
  <Step number={1} label="Welcome" status="current" />
  <Step number={2} label="Profile" status="upcoming" />
  <Step number={3} label="Amount" status="upcoming" />
  <Step number={4} label="Confirm" status="upcoming" />
</OnboardingProgress>
```

---

### Issue 12: Minimum Amount
**Location:** Investment amount screen

```jsx
<AmountInput>
  <Label>How much would you like to start with?</Label>
  <QuickAmounts>
    <QuickButton>10M</QuickButton>
    <QuickButton>50M</QuickButton>
    <QuickButton>100M</QuickButton>
    <QuickButton>500M</QuickButton>
  </QuickAmounts>
  <Input value={amount} onChange={...} />
  <HelpText>Minimum: 5,000,000 IRR</HelpText>
</AmountInput>
```

---

### Issue 13: Layer Descriptions
**Location:** Allocation preview, Portfolio summary

```jsx
const layerDescriptions = {
  foundation: {
    title: "Foundation",
    tagline: "Your safety net",
    description: "Stable assets that protect you during market drops"
  },
  growth: {
    title: "Growth", 
    tagline: "Steady wealth building",
    description: "Balanced assets that grow over time"
  },
  upside: {
    title: "Upside",
    tagline: "Higher potential returns", 
    description: "Riskier assets for bigger gains"
  }
};
```

---

### Issue 14: Protection Tab
**Location:** Protection tab

```jsx
<ProtectionTab>
  <Header>
    <Title>Your Protections</Title>
    <Subtitle>If prices drop sharply, you get paid.</Subtitle>
  </Header>
  
  <ProtectionCard>
    <AssetName>☂️ Bitcoin</AssetName>
    <Duration>Protected for 90 more days</Duration>
    <Explanation>
      If Bitcoin drops 20%+, you receive compensation up to 80,000,000 IRR
    </Explanation>
    <Cost>Cost: 1,920,000 IRR (paid)</Cost>
  </ProtectionCard>
</ProtectionTab>
```

---

### Issue 15: Constraint Messages
**Location:** History tab, rebalance entries

| Old | New |
|-----|-----|
| "Target allocation not fully reachable with current constraints." | "We couldn't fully rebalance your portfolio." |
| "Some assets are locked as loan collateral and cannot be sold." | "Some assets are locked for your loans." |
| "Residual drift remains: 0.0% from target." | *(Remove if 0%)* or "Your portfolio is now on target." |

---

### Issue 16: Balanced Badge
**No change** — Keep `[✓ Balanced]` as is.

---

### Issue 17: Loan Tab Header
**Location:** Loans tab

```jsx
// Badge (top right)
<Badge>3 Loans</Badge>

// Header (in content area)
<Header>
  <Title>Your Loans</Title>
  <Subtitle>Total borrowed: 100,000,000 IRR</Subtitle>
</Header>

// Remove duplicate "ACTIVE LOANS (3)" section
```

---

### Issue 18: Empty States
**Location:** Protection, Loans, History tabs when empty

```jsx
// Protection empty state
<EmptyState>
  <Icon>☂️</Icon>
  <Title>No protections yet</Title>
  <Description>
    Protection pays you if an asset's price drops significantly — 
    like insurance for your investments.
  </Description>
  <Button>Protect an Asset</Button>
</EmptyState>

// Loans empty state
<EmptyState>
  <Icon>💰</Icon>
  <Title>No active loans</Title>
  <Description>
    Borrow against your assets without selling them. 
    Keep your investments while accessing cash.
  </Description>
  <Button>Borrow Funds</Button>
</EmptyState>
```

---

### Issue 19: Tab Names
**No change** — Keep Portfolio, Protection, Loans, History.

---

### Issue 20: Quick Amount Currency
**Location:** Investment amount screen

```jsx
<QuickAmounts>
  <Label>Quick amounts (IRR):</Label>
  <ButtonGroup>
    <QuickButton>10M</QuickButton>
    <QuickButton>50M</QuickButton>
    <QuickButton>100M</QuickButton>
    <QuickButton>500M</QuickButton>
  </ButtonGroup>
</QuickAmounts>
```

---

## Implementation Priority

### Phase 1: Quick Wins (1-2 days)
- [ ] Issue 1: Text labels for allocation
- [ ] Issue 4: Full asset names
- [ ] Issue 6: Remove entry IDs
- [ ] Issue 7: Verb-based sidebar log
- [ ] Issue 10: Remove stress toggle
- [ ] Issue 12: Show minimum amount
- [ ] Issue 15: Plain language constraints
- [ ] Issue 17: Consolidate loan header
- [ ] Issue 20: Currency label above buttons

### Phase 2: Medium Effort (3-5 days)
- [ ] Issue 2: Boundary status style
- [ ] Issue 8: Action button hierarchy
- [ ] Issue 9: Collapsible rebalance preview
- [ ] Issue 11: Onboarding progress steps
- [ ] Issue 13: Two-line layer descriptions
- [ ] Issue 18: Empty states with CTAs

### Phase 3: Larger Changes (1 week+)
- [ ] Issue 3: Collapsible holdings
- [ ] Issue 5: Loan card redesign with health bar
- [ ] Issue 14: Protection tab context

---

## Files to Modify

| File | Issues |
|------|--------|
| `App.jsx` | 1, 3, 6, 7, 8, 9, 10, 11, 12, 13, 14, 17, 18, 20 |
| `reducers/appReducer.js` | 7 (action log formatting) |
| `engine/boundary.js` | 2, 15 |
| `constants/index.js` | 4 (asset names) |
| `styles/app.css` | 2, 3, 5, 11, 18 |

---

*End of UX Decisions Summary*
