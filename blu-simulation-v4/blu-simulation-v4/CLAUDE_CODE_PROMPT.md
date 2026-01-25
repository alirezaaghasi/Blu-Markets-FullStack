# Blu Markets Simulation v4 - Claude Code Instructions

## Overview

This prompt instructs Claude Code to run the Blu Markets Generative Agent Simulation v4, which tests user research hypotheses using the a16z AI Market Research framework.

## Context

Blu Markets is a wealth management feature for Blu Bank (Iranian neobank with 20M installs, 12M active users). Unlike Saraf (competitor with 6.67M users, 72% churn), Blu Markets can leverage existing Blu Bank customer relationships - meaning users skip KYC entirely and have pre-established trust.

### Key Differences from Saraf

| Dimension | Saraf | Blu Markets |
|-----------|-------|-------------|
| User Source | Cold (paid ads) | Blu Bank customers (12M) |
| Trust Baseline | 3/10 | 8-9/10 |
| KYC Required | Yes (58.6% abandon) | No (already verified) |
| CAC | $0.50 | ~$0 (cross-sell) |
| Revenue Model | 0.75% per trade | AUM + Subscription + Loans |

---

## Setup Instructions

### Step 1: Extract and Install

```bash
# Extract the simulation files
unzip blu-simulation-v4.zip -d blu-simulation-v4
cd blu-simulation-v4

# Install dependencies
npm install
```

### Step 2: Configure API Key

Create a `.env` file with your Anthropic API key:

```bash
echo "ANTHROPIC_API_KEY=your-api-key-here" > .env
```

Or set it as an environment variable:

```bash
export ANTHROPIC_API_KEY=your-api-key-here
```

---

## Running Simulations

### Priority Order (Recommended)

Run these scenarios in order of business priority:

```bash
# 1. CRITICAL: Blu Bank Cross-Sell
# Tests: Will existing Blu Bank customers activate Blu Markets?
# Hypothesis: >10% activation rate
npm run cross-sell

# 2. HIGH: Value Proposition Framing
# Tests: "Wealth management" vs "Trading" messaging
# Hypothesis: Wealth framing converts 2x better
npm run value-prop

# 3. HIGH: Premium Subscription
# Tests: When/how to upsell 60M IRR/year premium
# Hypothesis: >20% conversion for >500M AUM users
npm run premium

# 4. MEDIUM: Gold-Only Path
# Tests: Conservative/religious user conversion
# Hypothesis: 2x conversion for 45+ segment
npm run gold

# 5. SECONDARY: Cold User Trust
# Tests: Can we acquire users without Blu Bank relationship?
# Hypothesis: Trust signals = 3x registration
npm run cold-trust
```

### Run All Scenarios

```bash
npm run all
```

### Estimated Costs

| Scenario | API Calls | Est. Cost |
|----------|-----------|-----------|
| cross-sell | 15 | ~$0.25 |
| value-prop | 15 | ~$0.25 |
| premium | 6 | ~$0.10 |
| gold | 4 | ~$0.07 |
| cold-trust | 4 | ~$0.07 |
| **Total (all)** | **52** | **~$0.87** |

---

## Understanding the Output

### Console Output

Each simulation shows:
- Agent name and segment
- Screen being tested
- Trust level (X/10)
- Hypothesis validation (✓ / ◐ / ✗)

### Generated Report

After each run, a detailed report is saved to `simulation-results-v4.md` containing:

1. **Summary Statistics**
   - Average trust level
   - Abandon rate
   - Hypothesis validation counts

2. **📊 Saraf Comparison Analysis** (NEW in v4)
   - Trust level comparison (Blu Bank vs Saraf baseline)
   - Funnel comparison (KYC skip advantage)
   - Economic comparison (CAC, LTV/CAC)
   - Verdict on Blu Bank advantage

3. **Detailed Agent Responses**
   - Full think-aloud in Persian/English
   - Missing elements identified
   - Competitive comparisons
   - Likely next actions

---

## Key Hypotheses Being Tested

### P0 (Critical)
- [ ] Blu Bank customers activate at >10% when offered via in-app
- [ ] Wealth management framing outperforms trading framing

### P1 (High)
- [ ] Users with >500M AUM convert to premium at >20%
- [ ] Inflation calculator increases activation by 3x

### P2 (Medium)
- [ ] Gold-only path converts conservative users at 2x rate
- [ ] Trust signals increase cold user registration by 3x

---

## Agents (Personas)

### Segment A: Blu Bank Customers (Primary)

| Agent | Age | Profile | Key Question |
|-------|-----|---------|--------------|
| Mina (مینا) | 28 | Young saver, Tehran | "Is this really Blu Bank?" |
| Dariush (داریوش) | 47 | Conservative father, Isfahan | "Is the gold real? Is it halal?" |
| Navid (نوید) | 34 | Ambitious professional, Tehran | "How do loans work?" |
| Leila (لیلا) | 39 | Cautious mother, Mashhad | "What if I lose money?" |
| Reza (رضا) | 31 | Power user, Tehran | "What's the total cost?" |

### Segment B: Cold Users (Secondary)

| Agent | Age | Profile | Key Question |
|-------|-----|---------|--------------|
| Amir (امیر) | 29 | Skeptical newcomer | "Is this really from Blu Bank?" |
| Hossein (حسین) | 52 | Traditional investor | "Give me a phone number to call" |

---

## Interpreting Results

### Trust Levels

| Score | Meaning | Expected Action |
|-------|---------|-----------------|
| 8-10 | High trust | Will proceed/activate |
| 5-7 | Moderate | Needs more signals |
| 3-4 | Low | Likely to abandon |
| 1-2 | No trust | Will definitely abandon |

### Hypothesis Validation

| Result | Meaning | Next Step |
|--------|---------|-----------|
| ✓ VALIDATED | Screen achieves goal | Proceed with design |
| ◐ PARTIALLY | Works for some | Iterate and re-test |
| ✗ NOT VALIDATED | Doesn't work | Fundamental rethink |

### Saraf Comparison Verdicts

| Verdict | Meaning |
|---------|---------|
| ✅ VALIDATED | Significantly better than Saraf |
| ⚠️ PARTIAL | Some improvement |
| ❌ CONCERN | Similar or worse than Saraf |

---

## Files Included

```
blu-simulation-v4/
├── simulate.js              # Main simulation runner
├── package.json             # Dependencies
├── BLU_MARKETS_SIMULATION_V4.md  # Full documentation
├── V3_TO_V4_MIGRATION.md    # Why we rebuilt the framework
└── .env.example             # API key template
```

---

## Troubleshooting

### "Module not found" Error
```bash
npm install @anthropic-ai/sdk
```

### "API key not found" Error
```bash
export ANTHROPIC_API_KEY=your-key-here
# or create .env file
```

### Rate Limiting
The simulation uses Claude Sonnet. If you hit rate limits, wait 60 seconds between scenarios.

---

## After Running: What to Look For

1. **Blu Bank customer trust levels**
   - Expected: 7-9/10
   - If lower: Trust signals not transferring from Blu Bank

2. **Cross-sell activation intent**
   - Expected: >50% "would proceed"
   - If lower: Messaging needs work

3. **Premium conversion (Navid, Reza)**
   - Expected: >20% for high-AUM
   - If lower: Value prop not clear

4. **Saraf comparison delta**
   - Expected: +150% trust lift vs Saraf baseline
   - If lower: Blu Bank advantage not materializing

---

## Contact

For questions about the simulation framework or Blu Markets product:
- Framework: a16z AI Market Research
- Adapted for: Blu Markets (Blu Bank wealth management)
- Version: 4.0
- Date: January 2026
