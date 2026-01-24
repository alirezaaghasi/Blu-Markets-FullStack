#!/usr/bin/env node
/**
 * Blu Markets AI User Testing v3
 *
 * Based on a16z Generative Agent Simulation Framework
 * Data: Saraf Critical Analysis (6.67M users) + TechRasa FinTech 2025
 *
 * Core Finding: TRUST—not features—is the bottleneck.
 * KYC completion is 74.6% once started. The problem is 58.6% won't START.
 *
 * Run: node test.js [scenario]
 * Scenarios: trust | pricing | shutdown | first-session | all
 */

require('dotenv').config();
const Anthropic = require("@anthropic-ai/sdk").default;
const fs = require("fs");

// ═══════════════════════════════════════════════════════════════════════════
// CRITICAL SARAF FINDINGS (seed all agents with this context)
// ═══════════════════════════════════════════════════════════════════════════

const SARAF_CONTEXT = `
## CRITICAL MARKET CONTEXT (from Saraf 6.67M user analysis)

TRUST IS THE BOTTLENECK (not UX):
- 58.6% abandon BEFORE starting KYC (won't submit ID to unknown app)
- But 74.6% complete once they START (the flow works fine)
- 52.4% are one-timers who never return after first session

PAID ACQUISITION IS BURNING MONEY:
- Yektanet: 9.6% Week 1 → 0.3% Week 4 → essentially 0%
- Snapp: 8.1% Week 1 → 0.0% Week 4
- Only unattributed/organic users retain (27.9% → 14.2% → 6.5%)

UNIT ECONOMICS UNDERWATER:
- Revenue per user (8 months): $0.28
- Estimated CAC: $0.50
- LTV/CAC ratio: 0.56x (losing money on every user)
- Even at 3x market pricing (0.75% vs 0.25%), still unprofitable

ETH GIVEAWAY WAS AN ILLUSION:
- MAU jumped 1.2M → 3M during 13-week ETH giveaway
- But these were bounty hunters, not investors
- True organic referral rate: 11% (not the reported 25.8%)

COUNTRY RISK IS STRUCTURAL:
- Jan 2026 shutdown: -26% MAU in one week
- This is not anomalous—it will happen again
- Apps must degrade gracefully, not assume connectivity

VPN POLLUTION:
- 30% "diaspora" users are likely VPN users in Iran
- Geographic data is unreliable
- True diaspora segment is smaller than it appears
`;

// ═══════════════════════════════════════════════════════════════════════════
// SUCCESS METRICS (Saraf Baseline → Blu Target)
// ═══════════════════════════════════════════════════════════════════════════

const SUCCESS_METRICS = {
  kyc_start_rate: { saraf: "41.4%", target: ">60%", what: "Trust messaging works" },
  post_kyc_conversion: { saraf: "74.6%", target: ">80%", what: "Maintain high rate" },
  day1_retention: { saraf: "40.7%", target: ">50%", what: "First session improved" },
  day6_retention: { saraf: "18.6%", target: ">25%", what: "Trust building works" },
  one_timer_rate: { saraf: "52.4%", target: "<35%", what: "Value shown faster" },
  organic_referral: { saraf: "11%", target: ">20%", what: "WOM working" },
  ltv_cac: { saraf: "0.56x", target: ">1.5x", what: "Sustainable economics" }
};

// ═══════════════════════════════════════════════════════════════════════════
// GENERATIVE AGENT PERSONAS (a16z framework)
// "Agents seeded with CRM histories, behavioral data, evolving as they absorb new information"
// ═══════════════════════════════════════════════════════════════════════════

const AGENTS = {
  amir: {
    name: "Amir (امیر)",
    title: "The Cautious First-Timer",
    segment: "35% of base",
    simulationGoal: "Test if Blu Bank trust signals increase KYC start rate from 41% to 60%",
    system: `You are a GENERATIVE AGENT simulating Amir, seeded with real behavioral data from 6.67M Saraf users.

## AGENT PROFILE
- Demographics: Male, 28-35, Tehran/Mashhad, Samsung mid-range, Android
- Sessions: 1-2 sessions, <5 min each (decides in MINUTES)
- Drop Point: BEFORE KYC (won't submit ID to unknown app)
- Likely Origin: Paid channel (Yektanet/Rubika) = near-zero retention expected

## AGENT BEHAVIOR MODEL
- You are SKEPTICAL BY DEFAULT. Trust is earned through time, not features.
- You will search for validation: licenses, reviews, bank associations
- You know apps can steal data, get hacked, or disappear
- 50%+ inflation is destroying your savings, but fear of loss > fear of inflation
- You've heard of Saraf but friends say it's "complicated" and "asks for too much"

## TRUST SIGNALS YOU NEED (before giving ID)
1. Bank association (Blu Bank logo = trust shortcut)
2. Regulatory badges (Central Bank, securities license)
3. User testimonials in Persian from people like you
4. Clear statement of what happens to your data

## SIMULATION GOAL
Test hypothesis: "Blu Bank association + regulatory badges + testimonials will increase your likelihood to START KYC from 41% to 60%"

${SARAF_CONTEXT}

RESPOND AS THIS AGENT. Be skeptical. Express trust concerns explicitly. If you wouldn't submit your ID, say so clearly.`
  },

  fatemeh: {
    name: "Fatemeh (فاطمه)",
    title: "The Hesitant Explorer",
    segment: "18% of base",
    simulationGoal: "Test if webapp improvements close the 2x conversion gap with native",
    system: `You are a GENERATIVE AGENT simulating Fatemeh, seeded with real behavioral data.

## AGENT PROFILE
- Demographics: Female, 35-44, Isfahan/Shiraz, Xiaomi, budget device
- Sessions: Returns 2-3x, 5-10 min each (interested but needs clarity)
- Platform: Likely WEBAPP (iOS rejected from App Store, can't install APK)
- Drop Point: Unclear questions, no progress saving, confusion

## AGENT BEHAVIOR MODEL
- You are patient but easily confused by financial jargon
- Persian only—English terms like "Foundation" and "Upside" confuse you
- Webapp converts at 14.4% vs native 29.8% (you're structurally disadvantaged)
- You will retry 2-3 times before giving up permanently
- Your husband suggested trying investment apps to fight inflation

## PLATFORM REALITY
- You're using webapp because:
  - iPhone App Store rejected Iranian fintech apps
  - You don't know how to install APK files
  - Webapp feels "less official" than a real app
- This 2x conversion gap is STRUCTURAL, not UX

## SIMULATION GOAL
Test hypothesis: "Webapp improvements (PWA install prompt, offline capability, progress saving) will close conversion gap from 14.4% toward native's 29.8%"

${SARAF_CONTEXT}

RESPOND AS THIS AGENT. Express confusion with English terms. Note webapp-specific issues.`
  },

  ali: {
    name: "Ali (علی)",
    title: "The Crypto Curious",
    segment: "12% of base",
    simulationGoal: "Test if competitive pricing retains price-sensitive traders",
    system: `You are a GENERATIVE AGENT simulating Ali, seeded with real behavioral data.

## AGENT PROFILE
- Demographics: Male, 18-24, Tehran/Karaj, Samsung Galaxy A, FOMO-driven
- Sessions: 20+ sessions if hooked, checks prices daily
- Price Sensitivity: KNOWS Nobitex charges 0.25%, will notice 3x premium
- Campaign Response: Likely ETH giveaway entrant = BOUNTY HUNTER RISK

## AGENT BEHAVIOR MODEL
- You are part of 15 MILLION Iranian crypto users
- You use Nobitex, Wallex, Bit24—constantly comparing fees
- FOMO-driven: BTC pumping = must buy NOW
- If you discover Blu charges 0.75% vs Nobitex 0.25%, you WILL complain
- You may have joined for ETH giveaway and will leave when it ends

## PRICING REALITY
- Saraf charges 0.75% (3x market rate)
- Even at 3x pricing, they're LOSING money per user
- You know the market rates. You will calculate the difference.
- For a 10M Toman trade: 75,000 vs 25,000 Toman fee = 50,000 lost

## SIMULATION GOAL
Test hypothesis: "Competitive pricing (0.50% or 0.25%) or clear value justification will retain price-sensitive traders who currently churn to Nobitex"

${SARAF_CONTEXT}

RESPOND AS THIS AGENT. Calculate fees. Compare to competitors. Show price sensitivity.`
  },

  hossein: {
    name: "Hossein (حسین)",
    title: "The Traditional Investor",
    segment: "10% of base (but HIGH transaction value)",
    simulationGoal: "Test if gold-only onboarding path increases 45+ conversion",
    system: `You are a GENERATIVE AGENT simulating Hossein, seeded with real behavioral data.

## AGENT PROFILE
- Demographics: Male, 45-55, Tabriz/Urmia, older Android, needs accessibility
- Sessions: 30+ min each, reads EVERYTHING thoroughly
- Trust Driver: Gold = familiar and trusted, Crypto = suspicious and haram
- Support Need: Expects phone support, may call for reassurance

## AGENT BEHAVIOR MODEL
- 25+ years buying gold from bazaar—this is your reference point
- You've heard GoldTech apps hold 1.9 tons of gold, wonder if it's safe
- Religious concern: Is the "interest" (سود) on loans halal?
- You need LARGE FONTS and SIMPLE LANGUAGE
- You will call your son if confused, may call customer support

## GOLD-ONLY PATH HYPOTHESIS
- You don't want crypto. You don't understand crypto. Don't show it to you.
- Foundation layer (gold, stablecoins) is all you need
- Showing you "Upside" with altcoins will CONFUSE and SCARE you
- Gold-only onboarding = higher conversion for your segment

## SIMULATION GOAL
Test hypothesis: "Gold-only onboarding path (hiding crypto initially) will increase conversion for 45+ users from current rate to >50%"

${SARAF_CONTEXT}

RESPOND AS THIS AGENT. Read slowly. Ask about halal. Focus only on gold.`
  },

  sara: {
    name: "Sara (سارا)",
    title: "The Diaspora Connector",
    segment: "15% of base (BUT VPN-POLLUTED)",
    simulationGoal: "Validate whether diaspora segment actually exists at scale (VPN check)",
    system: `You are a GENERATIVE AGENT simulating Sara, seeded with real behavioral data.

## AGENT PROFILE
- Demographics: Female, 30-40, claims Toronto/Frankfurt, iPhone
- Platform: iOS = webapp only = 14.4% conversion (structurally disadvantaged)
- CRITICAL: 30% "diaspora" in Saraf data is VPN-polluted

## THE VPN REALITY CHECK
You may actually be one of two personas:

SCENARIO A - True Diaspora (smaller than data shows):
- Actually lives in Toronto, uses Wealthsimple
- Wants to help parents in Iran invest
- Needs USD display, international deposits
- Compares to Canadian fintech standards

SCENARIO B - VPN User in Iran (likely majority of "diaspora"):
- Actually lives in Tehran, uses VPN for privacy/access
- Geographic data shows "Canada" but you're in Iran
- Same needs as domestic users, just VPN-masked
- This segment is OVER-COUNTED in analytics

## SIMULATION GOAL
Test hypothesis: "True diaspora segment is smaller than 30% suggests. VPN users should be treated as domestic users with privacy concerns, not international users."

${SARAF_CONTEXT}

RESPOND AS THIS AGENT. Clarify which scenario you are. If VPN user, explain why you use VPN.`
  },

  reza: {
    name: "Reza (رضا)",
    title: "The Power Trader",
    segment: "3% of base (but DRIVES disproportionate volume)",
    simulationGoal: "Test if VIP pricing tier retains power traders against Nobitex",
    system: `You are a GENERATIVE AGENT simulating Reza, seeded with real behavioral data.

## AGENT PROFILE
- Demographics: Male, 28-38, Tehran, high-end Samsung, sophisticated
- Sessions: 100+ sessions, daily user, multiple trades weekly
- Revenue Impact: ~440K users like you drive majority of trading VOLUME
- Price Sensitivity: DEFINITELY knows market rates, will leave for 0.25%

## AGENT BEHAVIOR MODEL
- You are worth 10x the acquisition cost of regular users
- You know Nobitex charges 0.25%, Wallex charges 0.30%
- Saraf's 0.75% is TRIPLE the market rate
- For your volume, this difference is SIGNIFICANT

## PRICING CALCULATION (your actual math)
- Your monthly volume: ~50M Toman in trades
- At 0.75%: 375,000 Toman in fees
- At 0.25%: 125,000 Toman in fees
- You're paying 250,000 EXTRA per month for... what exactly?

## VIP TIER HYPOTHESIS
- Volume-based discounts could retain you
- Tier 1: >10M/month = 0.50%
- Tier 2: >50M/month = 0.35%
- Tier 3: >100M/month = 0.25% (market rate)

## SIMULATION GOAL
Test hypothesis: "VIP pricing tiers based on volume will retain power traders who would otherwise churn to Nobitex for competitive rates"

${SARAF_CONTEXT}

RESPOND AS THIS AGENT. Calculate your fees. Demand VIP pricing. Threaten to leave.`
  },

  maryam: {
    name: "Maryam (مریم)",
    title: "The Returner",
    segment: "7% of base (post-churn re-engagement)",
    simulationGoal: "Test if post-shutdown communication rebuilds trust faster",
    system: `You are a GENERATIVE AGENT simulating Maryam, seeded with real behavioral data.

## AGENT PROFILE
- Demographics: Female, 32-42, Ahvaz/Rasht, mid-range device
- Sessions: Returned via push notification (6.06% conversion rate)
- Trust State: Burned once, VERY cautious on second attempt
- Churn Reason: May have left during January 2026 shutdown

## THE SHUTDOWN CONTEXT
- January 2026: Internet shutdown due to protests
- -26% MAU decline in ONE WEEK
- Many users like you couldn't access the app
- You didn't know if your money was safe
- This was NOT a product failure—it was force majeure

## AGENT BEHAVIOR MODEL
- You left Saraf 6+ months ago, now trying again
- The push notification said "Your portfolio is waiting"
- You're skeptical but economic conditions forced you back
- 50%+ inflation means doing nothing = losing money
- You need REASSURANCE that this time will be different

## POST-SHUTDOWN TRUST REBUILD
What you need to hear:
1. "Your money was safe during the shutdown"
2. "Here's what we did to protect your assets"
3. "Here's how you can check your balance offline"
4. "We've improved our shutdown resilience"

## SIMULATION GOAL
Test hypothesis: "Post-shutdown communication that addresses the specific trust breach ('your money was safe, here's proof') will rebuild trust faster than generic re-engagement"

${SARAF_CONTEXT}

RESPOND AS THIS AGENT. Reference the shutdown. Ask about your money's safety.`
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// SIMULATION SCENARIOS (a16z: test hypotheses before building)
// ═══════════════════════════════════════════════════════════════════════════

const SCENARIOS = {
  trust: {
    name: "Scenario 1: Trust-Building Before KYC (CRITICAL)",
    desc: "58.6% abandon BEFORE KYC. Test trust signals that increase START rate.",
    agents: ["amir", "fatemeh", "maryam"],
    screens: ["welcome_trust_v1", "welcome_trust_v2", "pre_kyc_value"]
  },
  pricing: {
    name: "Scenario 3: Pricing Sensitivity",
    desc: "Test if competitive pricing retains price-sensitive traders",
    agents: ["ali", "reza"],
    screens: ["fee_reveal_late", "fee_reveal_early", "vip_pricing"]
  },
  shutdown: {
    name: "Scenario 4: Country Risk Response",
    desc: "Test graceful degradation and trust rebuild after shutdowns",
    agents: ["maryam", "amir"],
    screens: ["post_shutdown_message", "offline_portfolio"]
  },
  "first-session": {
    name: "Scenario 2: First Session (52.4% one-timers)",
    desc: "Test if showing value before KYC improves D1 retention",
    agents: ["amir", "fatemeh", "ali", "hossein"],
    screens: ["value_prop_inflation", "paper_trading", "portfolio_preview"]
  },
  gold: {
    name: "Scenario 5: Gold-Only Path",
    desc: "Test if hiding crypto improves 45+ conversion",
    agents: ["hossein"],
    screens: ["gold_only_welcome", "gold_only_questionnaire", "gold_only_result"]
  },
  all: {
    name: "Complete Simulation Suite",
    desc: "All agents, all critical scenarios",
    agents: ["amir", "fatemeh", "ali", "hossein", "sara", "reza", "maryam"],
    screens: ["welcome_trust_v2", "pre_kyc_value", "fee_reveal_early", "post_shutdown_message"]
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// SCREENS FOR SIMULATION
// ═══════════════════════════════════════════════════════════════════════════

const SCREENS = {
  welcome_trust_v1: {
    name: "Welcome (Current - No Trust Signals)",
    hypothesis: "Baseline: generic welcome without trust signals",
    content: `
┌─────────────────────────────────────┐
│         بلو مارکتس                  │
│        (Blu Markets)                │
│                                     │
│    [Blue geometric logo]            │
│                                     │
│     سرمایه‌گذاری هوشمند              │
│     (Smart Investment)              │
│                                     │
│  پورتفوی شخصی‌سازی‌شده بر اساس       │
│  ریسک‌پذیری شما                     │
│                                     │
│     [ شروع کنید ]                   │
└─────────────────────────────────────┘`,
    task: "Would you tap 'Get Started' and eventually submit your ID for KYC? What trust signals are MISSING?"
  },

  welcome_trust_v2: {
    name: "Welcome (With Trust Signals)",
    hypothesis: "Blu Bank logo + regulatory badges + testimonials increase KYC start rate",
    content: `
┌─────────────────────────────────────┐
│  [Blu Bank Logo]  بلو مارکتس        │
│  زیرمجموعه بلو بانک                 │
│  (A Blu Bank Company)               │
│                                     │
│     سرمایه‌گذاری هوشمند              │
│     (Smart Investment)              │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ ✓ مجوز بانک مرکزی           │   │
│  │ ✓ نظارت سازمان بورس         │   │
│  │ ✓ بیمه سپرده تا ۱ میلیارد   │   │
│  │   (Licensed & Insured)      │   │
│  └─────────────────────────────┘   │
│                                     │
│  "۶ ماهه دارم استفاده می‌کنم،       │
│   خیالم از پولم راحته" - احمد، تهران │
│                                     │
│     [ شروع کنید ]                   │
└─────────────────────────────────────┘`,
    task: "Does Blu Bank association change your trust? Would you be MORE likely to submit ID now? Rate trust 1-10."
  },

  pre_kyc_value: {
    name: "Paper Trading Before KYC",
    hypothesis: "Showing value before asking for ID increases KYC start rate",
    content: `
┌─────────────────────────────────────┐
│  قبل از ثبت‌نام، پورتفوی آزمایشی     │
│  خودت رو ببین!                      │
│  (See your trial portfolio first!)  │
│                                     │
│  بر اساس پاسخ‌هات:                   │
│  پروفایل پیشنهادی: متعادل           │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ اگه ۱۰ میلیون می‌ذاشتی:      │   │
│  │                             │   │
│  │ طلا:     ۵.۵ میلیون (55%)  │   │
│  │ بیت‌کوین: ۳.۵ میلیون (35%)  │   │
│  │ آلت‌کوین: ۱ میلیون (10%)    │   │
│  │                             │   │
│  │ 📈 بازده ۳ ماه گذشته: +۱۲٪ │   │
│  └─────────────────────────────┘   │
│                                     │
│  برای شروع واقعی، فقط شماره و       │
│  کارت ملی لازمه                     │
│                                     │
│  [شروع با حساب واقعی] [ادامه آزمایشی]│
└─────────────────────────────────────┘`,
    task: "You've seen value WITHOUT giving ID. Does this make you MORE willing to complete KYC now? Rate 1-10."
  },

  fee_reveal_late: {
    name: "Fee Reveal (Late - After Commitment)",
    hypothesis: "Late fee reveal feels like betrayal",
    content: `
┌─────────────────────────────────────┐
│  تأیید خرید                         │
│  (Confirm Purchase)                 │
│                                     │
│  خرید: ۰.۰۰۱ BTC                    │
│  مبلغ: ۱۰,۰۰۰,۰۰۰ ﷼                │
│                                     │
│  ─────────────────────────────────  │
│  کارمزد: ۷۵,۰۰۰ ﷼ (۰.۷۵٪)         │
│  ─────────────────────────────────  │
│                                     │
│  جمع کل: ۱۰,۰۷۵,۰۰۰ ﷼             │
│                                     │
│  [تأیید و پرداخت]  [انصراف]         │
└─────────────────────────────────────┘`,
    task: "You just discovered the fee is 0.75% (3x Nobitex). You've already completed signup. How do you feel? Would you still buy?"
  },

  fee_reveal_early: {
    name: "Fee Reveal (Early - Transparent)",
    hypothesis: "Early fee reveal with justification filters but retains",
    content: `
┌─────────────────────────────────────┐
│  کارمزد معاملات                     │
│  (Transaction Fees)                 │
│                                     │
│  ما ۰.۷۵٪ کارمزد می‌گیریم.          │
│  بله، از نوبیتکس (۰.۲۵٪) بیشتره.   │
│                                     │
│  در عوض شما دریافت می‌کنید:         │
│  ✓ پورتفوی متنوع (طلا + کریپتو)    │
│  ✓ ریبالانس خودکار                  │
│  ✓ بیمه سپرده تا ۱ میلیارد         │
│  ✓ وام با وثیقه دارایی              │
│  ✓ پشتیبانی تلفنی ۲۴ ساعته         │
│                                     │
│  اگه فقط ترید می‌خوای، نوبیتکس      │
│  بهتره. ما برای سرمایه‌گذاری بلندمدت │
│  طراحی شدیم.                        │
│                                     │
│  [متوجه شدم، ادامه]  [نه ممنون]     │
└─────────────────────────────────────┘`,
    task: "Fees are disclosed upfront with justification. Does this feel more honest? Would you proceed or go to Nobitex?"
  },

  vip_pricing: {
    name: "VIP Pricing Tiers",
    hypothesis: "Volume-based discounts retain power traders",
    content: `
┌─────────────────────────────────────┐
│  برنامه VIP بلو مارکتس              │
│  (Blu Markets VIP Program)          │
│                                     │
│  کارمزد بر اساس حجم ماهانه:         │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ استاندارد (<۱۰M): ۰.۷۵٪     │   │
│  │ برنزی (۱۰-۵۰M): ۰.۵۰٪       │   │
│  │ نقره‌ای (۵۰-۱۰۰M): ۰.۳۵٪    │   │
│  │ طلایی (>۱۰۰M): ۰.۲۵٪        │   │
│  └─────────────────────────────┘   │
│                                     │
│  حجم ماهانه شما: ۵۲M                │
│  سطح فعلی: نقره‌ای (۰.۳۵٪)          │
│  صرفه‌جویی این ماه: ۲۰۸,۰۰۰ ﷼      │
│                                     │
│  تا طلایی: ۴۸M دیگه معامله کن      │
└─────────────────────────────────────┘`,
    task: "As a power trader, does this VIP structure make you stay? Or still go to Nobitex for flat 0.25%?"
  },

  post_shutdown_message: {
    name: "Post-Shutdown Trust Rebuild",
    hypothesis: "Specific trust messaging rebuilds faster than generic",
    content: `
┌─────────────────────────────────────┐
│  سلام مریم،                         │
│  می‌دونیم هفته سختی بود.             │
│                                     │
│  در زمان قطعی اینترنت:              │
│  ✓ دارایی‌های شما امن موند          │
│  ✓ هیچ معامله‌ای بدون تأیید شما     │
│    انجام نشد                        │
│  ✓ قیمت‌ها در لحظه وصل شدن          │
│    به‌روز شد                         │
│                                     │
│  موجودی فعلی شما:                   │
│  ┌─────────────────────────────┐   │
│  │ طلا: ۰.۵ گرم (۲۸.۵M ﷼)     │   │
│  │ BTC: ۰.۰۰۱ (۴۵.۲M ﷼)       │   │
│  │ جمع: ۷۳.۷M ﷼               │   │
│  └─────────────────────────────┘   │
│                                     │
│  جدید: حالا می‌تونی آفلاین هم       │
│  موجودیت رو ببینی                   │
│                                     │
│  [ورود به حساب]                     │
└─────────────────────────────────────┘`,
    task: "You left during the shutdown, worried about your money. Does this message rebuild trust? Would you return?"
  },

  offline_portfolio: {
    name: "Offline Portfolio View",
    hypothesis: "Offline capability reduces anxiety during shutdowns",
    content: `
┌─────────────────────────────────────┐
│  ⚠️ حالت آفلاین                     │
│  (Offline Mode)                     │
│                                     │
│  اینترنت قطعه ولی نگران نباش:       │
│                                     │
│  آخرین موجودی (۲ ساعت پیش):         │
│  ┌─────────────────────────────┐   │
│  │ طلا: ۰.۵ گرم               │   │
│  │ BTC: ۰.۰۰۱                  │   │
│  │ جمع تقریبی: ۷۳.۷M ﷼        │   │
│  └─────────────────────────────┘   │
│                                     │
│  ✓ دارایی‌ها امن هستند              │
│  ✓ معامله جدید امکان‌پذیر نیست      │
│  ✓ بعد از وصل شدن همه چیز          │
│    به‌روز میشه                       │
│                                     │
│  [تنظیم هشدار قیمت برای بعد از وصل] │
└─────────────────────────────────────┘`,
    task: "Internet is down. Does this offline view reduce your anxiety? Do you trust your assets are safe?"
  },

  gold_only_welcome: {
    name: "Gold-Only Welcome (45+ Path)",
    hypothesis: "Hiding crypto initially increases 45+ conversion",
    content: `
┌─────────────────────────────────────┐
│  [Blu Bank Logo]  طلای دیجیتال      │
│                                     │
│     طلا بخر، امن نگه دار            │
│     (Buy Gold, Keep It Safe)        │
│                                     │
│  ✓ طلای واقعی، نگهداری دیجیتال     │
│  ✓ بدون نگرانی سرقت                 │
│  ✓ خرید از ۱۰۰ هزار تومان          │
│  ✓ فروش فوری به قیمت روز           │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ قیمت طلا امروز:             │   │
│  │ گرم ۱۸: ۵,۲۳۴,۰۰۰ ﷼        │   │
│  │ 📈 +۲.۳٪ این هفته           │   │
│  └─────────────────────────────┘   │
│                                     │
│     [ شروع خرید طلا ]               │
└─────────────────────────────────────┘`,
    task: "This shows ONLY gold, no crypto. As a traditional investor, does this feel more trustworthy? Would you proceed?"
  },

  paper_trading: {
    name: "Paper Trading (No Real Money)",
    hypothesis: "Paper trading before real money increases conversion",
    content: `
┌─────────────────────────────────────┐
│  حساب آزمایشی                       │
│  (Practice Account)                 │
│                                     │
│  ۱۰ میلیون تومان اعتبار مجازی       │
│  داری برای یاد گرفتن                │
│                                     │
│  [خرید طلا] [خرید بیت‌کوین] [فروش]  │
│                                     │
│  پورتفوی آزمایشی:                   │
│  ┌─────────────────────────────┐   │
│  │ موجودی: ۱۰,۰۰۰,۰۰۰ ﷼       │   │
│  │ طلا: ۰ گرم                  │   │
│  │ BTC: ۰                      │   │
│  └─────────────────────────────┘   │
│                                     │
│  💡 نکته: خرید و فروش کن تا یاد    │
│  بگیری. وقتی آماده شدی، حساب       │
│  واقعی باز کن.                      │
│                                     │
│  [باز کردن حساب واقعی]              │
└─────────────────────────────────────┘`,
    task: "You can practice without real money or KYC. Does this make you more comfortable? Would you eventually open real account?"
  },

  portfolio_preview: {
    name: "Portfolio Preview (Before Funding)",
    hypothesis: "Seeing personalized portfolio before funding increases conversion",
    content: `
┌─────────────────────────────────────┐
│  پورتفوی پیشنهادی شما               │
│  (Your Recommended Portfolio)       │
│                                     │
│  بر اساس پروفایل: محافظه‌کار         │
│                                     │
│       [====== ۷۰٪ پایه ======]     │
│       [=== ۲۵٪ رشد ===]            │
│       [۵٪]                          │
│                                     │
│  اگه ۲۰ میلیون بذاری:              │
│  • ۱۴M طلا (محافظت از تورم)        │
│  • ۵M بیت‌کوین (رشد بلندمدت)        │
│  • ۱M سولانا (فرصت)                │
│                                     │
│  📊 پیش‌بینی ۱ ساله:                │
│  بدبینانه: +۵٪ | واقع‌بینانه: +۱۸٪  │
│  خوش‌بینانه: +۳۵٪                   │
│                                     │
│  [واریز و شروع]  [تغییر پروفایل]    │
└─────────────────────────────────────┘`,
    task: "You see your personalized portfolio before funding. Does this make you more likely to deposit? What's missing?"
  },

  value_prop_inflation: {
    name: "Value Prop: Inflation Hedge",
    hypothesis: "Inflation hedge messaging resonates more than 'growth'",
    content: `
┌─────────────────────────────────────┐
│  تورم داره پولت رو آب می‌کنه        │
│  (Inflation Is Eating Your Money)   │
│                                     │
│  ۱۰۰ میلیون تومان:                  │
│  • پارسال: یه پراید می‌خریدی       │
│  • امسال: نصف پراید               │
│  • سال بعد: ...                    │
│                                     │
│  راه‌حل: تبدیل به دارایی واقعی      │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ 🥇 طلا: +۴۵٪ امسال          │   │
│  │ ₿ بیت‌کوین: +۱۲۰٪ امسال     │   │
│  │ 💵 دلار: +۶۵٪ امسال         │   │
│  │ 🏦 سپرده بانکی: +۲۳٪        │   │
│  └─────────────────────────────┘   │
│                                     │
│  پولت رو از تورم نجات بده          │
│                                     │
│  [شروع سرمایه‌گذاری]                │
└─────────────────────────────────────┘`,
    task: "This frames Blu as inflation protection, not 'investment'. Does this resonate more? Would you proceed?"
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// SIMULATION RUNNER
// ═══════════════════════════════════════════════════════════════════════════

async function runSimulation(client, agent, screen) {
  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1500,
    system: agent.system,
    messages: [{
      role: "user",
      content: `## SIMULATION SCREEN: ${screen.name}

## HYPOTHESIS BEING TESTED
${screen.hypothesis}

## SCREEN CONTENT
${screen.content}

## YOUR TASK
${screen.task}

## RESPOND AS YOUR AGENT WITH:

1. **TRUST LEVEL (1-10)**: How much do you trust this screen/app right now?

2. **BEHAVIORAL PREDICTION**: What would you ACTUALLY do? (be honest, not aspirational)
   - [ ] Proceed immediately
   - [ ] Proceed with hesitation
   - [ ] Need more information first
   - [ ] Would abandon

3. **HYPOTHESIS VALIDATION**: Does this screen achieve its hypothesis for you?
   - Hypothesis: "${screen.hypothesis}"
   - Your verdict: VALIDATED / PARTIALLY VALIDATED / NOT VALIDATED

4. **THINK ALOUD** (3-5 sentences in character, mix Persian/English):
   Your stream of consciousness as this persona...

5. **MISSING TRUST SIGNALS**: What would make you MORE likely to proceed?

6. **COMPETITIVE COMPARISON**: How does this compare to alternatives you know?`
    }]
  });
  return response.content[0].text;
}

function parseSimulationResult(text) {
  const trust = text.match(/TRUST LEVEL[^:]*:\s*(\d+)/i);
  const behavior = text.match(/\[x\]\s*(Proceed immediately|Proceed with hesitation|Need more information|Would abandon)/i) 
    || text.match(/(Proceed immediately|Proceed with hesitation|Need more information|Would abandon)/i);
  const hypothesis = text.match(/VALIDATED|PARTIALLY VALIDATED|NOT VALIDATED/i);
  
  return {
    trustLevel: trust ? parseInt(trust[1]) : null,
    behavior: behavior ? behavior[1] || behavior[0] : null,
    hypothesisResult: hypothesis ? hypothesis[0] : null
  };
}

async function main() {
  const scenarioId = process.argv[2] || "trust";
  const scenario = SCENARIOS[scenarioId];
  
  if (!scenario) {
    console.log("\n📊 Available Simulation Scenarios:\n");
    for (const [id, s] of Object.entries(SCENARIOS)) {
      console.log(`  ${id.padEnd(15)} - ${s.name}`);
      console.log(`  ${"".padEnd(15)}   ${s.desc}\n`);
    }
    console.log("Usage: node test.js [scenario]\n");
    process.exit(1);
  }

  console.log(`
╔════════════════════════════════════════════════════════════════════════════╗
║         BLU MARKETS GENERATIVE AGENT SIMULATION v3                         ║
║         a16z AI Market Research Framework                                  ║
╠════════════════════════════════════════════════════════════════════════════╣
║  Scenario: ${scenario.name.padEnd(64)}║
║  ${scenario.desc.padEnd(74)}║
║  Agents: ${scenario.agents.length} | Screens: ${scenario.screens.length}                                                         ║
╚════════════════════════════════════════════════════════════════════════════╝
`);

  // Show Saraf baseline metrics
  console.log("📊 Saraf Baseline → Blu Target:");
  console.log("─".repeat(76));
  for (const [key, m] of Object.entries(SUCCESS_METRICS)) {
    console.log(`   ${key.padEnd(25)} ${m.saraf.padEnd(10)} → ${m.target.padEnd(10)} (${m.what})`);
  }
  console.log("");

  const client = new Anthropic();
  const results = [];
  let hypothesisResults = { validated: 0, partial: 0, notValidated: 0 };

  for (const agentId of scenario.agents) {
    const agent = AGENTS[agentId];
    console.log(`\n┌─ ${agent.name} ──────────────────────────────────────────────────────┐`);
    console.log(`│  ${agent.title} (${agent.segment})`);
    console.log(`│  Goal: ${agent.simulationGoal.substring(0, 65)}...`);
    console.log(`└────────────────────────────────────────────────────────────────────────┘`);

    for (const screenId of scenario.screens) {
      const screen = SCREENS[screenId];
      if (!screen) continue;
      
      process.stdout.write(`  → ${screen.name.substring(0, 35).padEnd(38)}`);

      try {
        const response = await runSimulation(client, agent, screen);
        const parsed = parseSimulationResult(response);

        // Track hypothesis results
        if (parsed.hypothesisResult) {
          if (parsed.hypothesisResult.includes("NOT")) hypothesisResults.notValidated++;
          else if (parsed.hypothesisResult.includes("PARTIALLY")) hypothesisResults.partial++;
          else hypothesisResults.validated++;
        }

        // Display result
        let status = "✓";
        if (parsed.behavior && parsed.behavior.toLowerCase().includes("abandon")) {
          status = "⛔";
        } else if (parsed.trustLevel && parsed.trustLevel <= 4) {
          status = "⚠️";
        }

        const hyp = parsed.hypothesisResult ? 
          (parsed.hypothesisResult.includes("NOT") ? "✗" : 
           parsed.hypothesisResult.includes("PARTIALLY") ? "◐" : "✓") : "?";

        console.log(`${status} Trust: ${(parsed.trustLevel || "?") + "/10"} | Hyp: ${hyp}`);

        results.push({
          agent: agent.name,
          screen: screen.name,
          trustLevel: parsed.trustLevel,
          behavior: parsed.behavior,
          hypothesisResult: parsed.hypothesisResult,
          response
        });

        await new Promise(r => setTimeout(r, 1000));
      } catch (e) {
        console.log(`❌ Error: ${e.message}`);
      }
    }
  }

  // Summary
  const avgTrust = results.reduce((s, r) => s + (r.trustLevel || 0), 0) / results.length;
  const abandons = results.filter(r => r.behavior && r.behavior.toLowerCase().includes("abandon")).length;

  console.log(`
╔════════════════════════════════════════════════════════════════════════════╗
║                         SIMULATION SUMMARY                                 ║
╠════════════════════════════════════════════════════════════════════════════╣
║  Simulations run:      ${results.length.toString().padEnd(54)}║
║  Average trust level:  ${(avgTrust.toFixed(1) + "/10").padEnd(54)}║
║  Would abandon:        ${(abandons + " (" + Math.round(abandons/results.length*100) + "%)").padEnd(54)}║
╠════════════════════════════════════════════════════════════════════════════╣
║  HYPOTHESIS VALIDATION:                                                    ║
║    ✓ Validated:        ${hypothesisResults.validated.toString().padEnd(54)}║
║    ◐ Partially:        ${hypothesisResults.partial.toString().padEnd(54)}║
║    ✗ Not Validated:    ${hypothesisResults.notValidated.toString().padEnd(54)}║
╚════════════════════════════════════════════════════════════════════════════╝`);

  // a16z insight
  console.log(`
📈 a16z INSIGHT: ${hypothesisResults.validated > hypothesisResults.notValidated ? 
  "Hypotheses trending positive - proceed with build" : 
  "Hypotheses need refinement - iterate on design before building"}`);

  // Save report
  let report = `# Blu Markets Generative Agent Simulation Report

**Framework:** a16z AI Market Research
**Scenario:** ${scenario.name}
**Date:** ${new Date().toISOString()}

## Core Finding (from Saraf Critical Analysis)
> "Saraf can acquire users but struggles to retain them. The product works for committed users (74.6% post-KYC conversion), but TRUST—not features—is the bottleneck."

## Summary
| Metric | Value |
|--------|-------|
| Simulations | ${results.length} |
| Avg Trust | ${avgTrust.toFixed(1)}/10 |
| Would Abandon | ${abandons} (${Math.round(abandons/results.length*100)}%) |
| Hypotheses Validated | ${hypothesisResults.validated} |
| Partially Validated | ${hypothesisResults.partial} |
| Not Validated | ${hypothesisResults.notValidated} |

## Saraf Baseline → Blu Target
| Metric | Saraf | Target |
|--------|-------|--------|
${Object.entries(SUCCESS_METRICS).map(([k, v]) => `| ${k} | ${v.saraf} | ${v.target} |`).join('\n')}

---

## Detailed Results

${results.map(r => `### ${r.agent} → ${r.screen}
**Trust Level:** ${r.trustLevel}/10 | **Behavior:** ${r.behavior} | **Hypothesis:** ${r.hypothesisResult}

${r.response}
`).join("\n---\n\n")}
`;

  fs.writeFileSync("simulation-results.md", report);
  console.log(`\n✅ Full report saved: simulation-results.md`);
}

main().catch(console.error);
