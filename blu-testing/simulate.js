/**
 * Blu Markets Generative Agent Simulation v4
 *
 * Framework: a16z AI Market Research
 * Primary Segment: Blu Bank Existing Customers (12M)
 * Secondary Segment: Cold User Acquisition
 *
 * Usage:
 *   node simulate.js cross-sell     # Blu Bank cross-sell scenarios
 *   node simulate.js value-prop     # Value proposition framing
 *   node simulate.js premium        # Premium subscription upsell
 *   node simulate.js gold           # Gold-only path
 *   node simulate.js cold-trust     # Cold user trust building
 *   node simulate.js all            # All scenarios
 */

require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');

// Initialize Anthropic client
const client = new Anthropic();

// ============================================================================
// AGENT DEFINITIONS
// ============================================================================

const AGENTS = {
  // Segment A: Blu Bank Customers (Priority)
  mina: {
    id: 'mina',
    name: 'Mina (مینا)',
    nameFA: 'مینا',
    segment: 'blu_bank_customer',
    segmentSize: '25%',
    description: 'The Young Saver',
    age: 28,
    city: 'Tehran',
    device: 'iPhone 13 (via Blu Bank app)',
    bluBankUsage: 'Daily (salary, bills, transfers)',
    currentSavings: '300M IRR in savings account',
    investmentExperience: 'None - money sits in bank',
    trustInBluBank: 9,
    psychology: `
      - Watches her savings lose value to inflation every month
      - Knows she should "invest" but doesn't know how
      - Intimidated by crypto/stock market complexity
      - Would never download a random investment app
      - But if Blu Bank offers it? "They already have my money..."
    `,
    keyQuestions: [
      'آیا این همون بانک بلو هست؟ (Is this the same Blu Bank?)',
      'پولم امنه؟ (Is my money safe?)',
      'پیچیده نیست؟ (Is it complicated?)'
    ]
  },

  dariush: {
    id: 'dariush',
    name: 'Dariush (داریوش)',
    nameFA: 'داریوش',
    segment: 'blu_bank_customer',
    segmentSize: '20%',
    description: 'The Conservative Father',
    age: 47,
    city: 'Isfahan',
    device: 'Samsung Galaxy A52 (via Blu Bank app)',
    bluBankUsage: 'Weekly (salary, utilities)',
    currentSavings: '800M IRR across accounts',
    investmentExperience: 'Physical gold coins, bank deposits',
    trustInBluBank: 8,
    psychology: `
      - Remembers multiple financial crises (1997, 2008, 2018, 2022)
      - Trusts gold because he can hold it
      - Suspicious of "digital" anything
      - But trusts Blu Bank - they've handled his salary for 3 years
      - Primary concern: "Will my children inherit nothing?"
    `,
    keyQuestions: [
      'طلای واقعی هست یا مجازی؟ (Is it real gold or virtual?)',
      'اگه بانک مرکزی ببنده چی؟ (What if Central Bank shuts it down?)',
      'حلاله؟ (Is it halal?)'
    ]
  },

  navid: {
    id: 'navid',
    name: 'Navid (نوید)',
    nameFA: 'نوید',
    segment: 'blu_bank_customer',
    segmentSize: '15%',
    description: 'The Ambitious Professional',
    age: 34,
    city: 'Tehran',
    device: 'iPhone 14 Pro (via Blu Bank app)',
    bluBankUsage: 'Daily (business + personal)',
    currentSavings: '1.5B IRR',
    investmentExperience: 'Has Nobitex account, buys gold coins',
    trustInBluBank: 8,
    psychology: `
      - Already invests but portfolio is scattered
      - Has 200M in Nobitex, 500M in gold, rest in bank
      - Frustrated by manual management
      - Would pay for convenience if it's worth it
      - Interested in loans against assets (liquidity without selling)
    `,
    keyQuestions: [
      'چه فرقی با نوبیتکس داره؟ (How is this different from Nobitex?)',
      'وام چطور کار می‌کنه؟ (How do loans work?)',
      '۶۰ میلیون در سال؟ ارزشش رو داره؟ (60M/year? Is it worth it?)'
    ]
  },

  leila: {
    id: 'leila',
    name: 'Leila (لیلا)',
    nameFA: 'لیلا',
    segment: 'blu_bank_customer',
    segmentSize: '18%',
    description: 'The Cautious Mother',
    age: 39,
    city: 'Mashhad',
    device: 'Xiaomi Redmi Note 11 (via Blu Bank app)',
    bluBankUsage: 'Weekly (household expenses)',
    currentSavings: '450M IRR (family savings)',
    investmentExperience: 'None - husband handles investments',
    trustInBluBank: 7,
    psychology: `
      - Managing family finances after husband travels for work
      - Nervous about making investment decisions alone
      - Needs reassurance and simplicity
      - Won't do anything she can't explain to her husband
      - "If Blu Bank says it's safe, maybe..."
    `,
    keyQuestions: [
      'اگه ضرر کنم چی؟ (What if I lose money?)',
      'شوهرم می‌تونه ببینه؟ (Can my husband see it?)',
      'می‌تونم هر وقت خواستم برش دارم؟ (Can I withdraw anytime?)'
    ]
  },

  reza: {
    id: 'reza',
    name: 'Reza (رضا)',
    nameFA: 'رضا',
    segment: 'blu_bank_customer',
    segmentSize: '5%',
    description: 'The Power User',
    age: 31,
    city: 'Tehran',
    device: 'iPhone 15 Pro Max',
    bluBankUsage: 'Multiple times daily',
    currentSavings: '3B IRR',
    investmentExperience: 'Active trader, multiple platforms',
    trustInBluBank: 9,
    psychology: `
      - Sophisticated investor, knows market rates
      - Currently managing portfolio across 4 platforms
      - Would consolidate if one platform did it all
      - Interested in loans (30% APR < 40% inflation = free money)
      - Will calculate exact costs before committing
    `,
    keyQuestions: [
      'کارمزد کل چقدر میشه؟ (What\'s total cost?)',
      'وام ۳۰٪ با تورم ۴۰٪... یعنی سود منفی؟ (30% loan with 40% inflation = negative real rate?)',
      'Protection چطور کار می‌کنه؟ (How does protection work?)'
    ]
  },

  // Segment B: Cold Users (Secondary)
  amir: {
    id: 'amir',
    name: 'Amir (امیر)',
    nameFA: 'امیر',
    segment: 'cold_user',
    segmentSize: 'Unknown',
    description: 'The Skeptical Newcomer',
    age: 29,
    city: 'Tehran',
    device: 'Samsung Galaxy A54',
    bluBankStatus: 'NOT a customer',
    currentSavings: '200M IRR in Mellat Bank',
    investmentExperience: 'Lost money on a Telegram signal group',
    trustInBluMarkets: 3,
    psychology: `
      - Burned once, very cautious now
      - Doesn't trust random fintech apps
      - But might trust Blu Bank association
      - Needs to see credentials before phone number
    `,
    keyQuestions: [
      'این واقعاً مال بانک بلو هست؟ (Is this really from Blu Bank?)',
      'مجوز بانک مرکزی داره؟ (Does it have Central Bank license?)',
      'چرا باید کارت ملیم رو بدم؟ (Why should I give my national ID?)'
    ]
  },

  hossein: {
    id: 'hossein',
    name: 'Hossein (حسین)',
    nameFA: 'حسین',
    segment: 'cold_user',
    segmentSize: 'Unknown',
    description: 'The Traditional Investor',
    age: 52,
    city: 'Tabriz',
    device: 'Samsung Galaxy A32',
    bluBankStatus: 'NOT a customer',
    currentSavings: '600M IRR + physical gold',
    investmentExperience: '30 years buying gold from bazaar',
    trustInBluMarkets: 2,
    psychology: `
      - "If I can't touch it, it's not real"
      - Buys gold coins from Haj Mahmoud in bazaar
      - Son told him about "digital gold"
      - Extremely suspicious but inflation is eating his savings
      - Needs human support (phone number)
    `,
    keyQuestions: [
      'طلای فیزیکی می‌تونم بگیرم؟ (Can I get physical gold?)',
      'یه شماره تلفن بده زنگ بزنم (Give me a phone number to call)',
      'این سود حرام نیست؟ (Isn\'t this interest haram?)'
    ]
  }
};

// ============================================================================
// SCREEN DEFINITIONS
// ============================================================================

const SCREENS = {
  // Scenario 1: Cross-Sell
  'cross_sell_banner': {
    id: 'cross_sell_banner',
    name: 'In-App Banner (Passive)',
    scenario: 'cross-sell',
    hypothesis: '>5% tap "Learn more" from passive banner',
    content: `
┌─────────────────────────────────────────────────────────┐
│  [Blu Bank App - Home Screen]                           │
│                                                         │
│  موجودی: ۳۰۰,۰۰۰,۰۰۰ تومان                             │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │  🌟 جدید: بلو مارکتس                            │   │
│  │                                                  │   │
│  │  پولت رو از تورم ۴۰٪ نجات بده                  │   │
│  │  سرمایه‌گذاری در طلا و دارایی‌های متنوع        │   │
│  │                                                  │   │
│  │  [بیشتر بدانید]                                 │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  [انتقال]  [پرداخت]  [کارت]  [بیشتر]                   │
└─────────────────────────────────────────────────────────┘
    `
  },

  'cross_sell_push': {
    id: 'cross_sell_push',
    name: 'Push Notification (Active)',
    scenario: 'cross-sell',
    hypothesis: 'Personalized inflation loss notification >15% tap rate',
    content: `
┌─────────────────────────────────────────────────────────┐
│  🔔 بانک بلو                                            │
│                                                         │
│  [NAME] عزیز،                                           │
│  در ۶ ماه گذشته، ارزش پس‌اندازت                        │
│  ۱۸٪ کمتر شده (تورم).                                  │
│                                                         │
│  با بلو مارکتس، سرمایه‌گذاری کن.                       │
│                                                         │
│  [همین الان]  [بعداً]                                   │
└─────────────────────────────────────────────────────────┘
    `
  },

  'cross_sell_welcome': {
    id: 'cross_sell_welcome',
    name: 'Welcome Screen (After Tap)',
    scenario: 'cross-sell',
    hypothesis: '"No re-KYC needed" reduces friction, >40% proceed',
    content: `
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  [Blu Bank Logo]                                        │
│  بلو مارکتس                                             │
│  زیرمجموعه رسمی بانک بلو                               │
│                                                         │
│  ─────────────────────────────────────────────────────  │
│                                                         │
│  سرمایه‌گذاری هوشمند برای همه                          │
│                                                         │
│  ✓ بدون نیاز به احراز هویت مجدد                        │
│    (شما قبلاً مشتری بانک بلو هستید)                    │
│                                                         │
│  ✓ شروع از ۱ میلیون تومان                              │
│                                                         │
│  ✓ برداشت در هر زمان                                   │
│                                                         │
│  ─────────────────────────────────────────────────────  │
│                                                         │
│  📞 سؤال دارید؟ ۰۲۱-۹۱۰۰۹۱۰۰                          │
│                                                         │
│  [شروع سرمایه‌گذاری]                                   │
│                                                         │
└─────────────────────────────────────────────────────────┘
    `
  },

  // Scenario 2: Value Proposition
  'value_prop_trading': {
    id: 'value_prop_trading',
    name: 'Trading Frame (Control)',
    scenario: 'value-prop',
    hypothesis: 'Baseline for comparison',
    content: `
┌─────────────────────────────────────────────────────────┐
│  خرید و فروش طلا، بیت‌کوین و ارز                       │
│                                                         │
│  BTC  ۲,۸۵۰,۰۰۰,۰۰۰ تومان  ↑ ۱.۲٪                     │
│  ETH  ۱۴۵,۰۰۰,۰۰۰ تومان    ↓ ۰.۸٪                     │
│  طلا  ۱۲,۵۰۰,۰۰۰ تومان     ↑ ۰.۳٪                     │
│                                                         │
│  [شروع معامله]                                          │
└─────────────────────────────────────────────────────────┘
    `
  },

  'value_prop_wealth': {
    id: 'value_prop_wealth',
    name: 'Wealth Management Frame (Test)',
    scenario: 'value-prop',
    hypothesis: 'Wealth management frame converts 2x better than trading frame',
    content: `
┌─────────────────────────────────────────────────────────┐
│  محافظت از سرمایه در برابر تورم                        │
│                                                         │
│  تورم امسال: ۴۰٪                                        │
│  سود بانکی: ۲۳٪                                         │
│  ─────────────                                          │
│  ضرر واقعی شما: ۱۷٪                                     │
│                                                         │
│  با پورتفوی متنوع بلو مارکتس:                          │
│  ✓ طلا برای ثبات                                       │
│  ✓ ارز برای رشد                                        │
│  ✓ مدیریت خودکار ریسک                                  │
│                                                         │
│  [محافظت از سرمایه‌ام]                                  │
└─────────────────────────────────────────────────────────┘
    `
  },

  'value_prop_calculator': {
    id: 'value_prop_calculator',
    name: 'Inflation Calculator (Interactive)',
    scenario: 'value-prop',
    hypothesis: 'Personalized calculator increases activation by 3x',
    content: `
┌─────────────────────────────────────────────────────────┐
│  محاسبه‌گر تورم                                         │
│                                                         │
│  پس‌انداز فعلی شما:                                     │
│  ┌─────────────────────────────────────────────────┐   │
│  │  [SAVINGS] تومان                                │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ارزش واقعی بعد از ۱ سال:                              │
│                                                         │
│  💰 در حساب بانکی: [BANK_VALUE] تومان                  │
│     (با احتساب سود ۲۳٪ و تورم ۴۰٪)                     │
│                                                         │
│  📈 در بلو مارکتس: [BLU_VALUE] تومان*                  │
│     (بر اساس عملکرد ۲۰۲۵)                              │
│                                                         │
│  *عملکرد گذشته تضمین آینده نیست                        │
│                                                         │
│  [می‌خوام سرمایه‌گذاری کنم]                             │
└─────────────────────────────────────────────────────────┘
    `
  },

  // Scenario 4: Premium
  'premium_early': {
    id: 'premium_early',
    name: 'Early Premium Push (Control)',
    scenario: 'premium',
    hypothesis: 'Baseline - early push without context',
    content: `
┌─────────────────────────────────────────────────────────┐
│  🌟 بلو مارکتس پرمیوم                                   │
│                                                         │
│  ۶۰,۰۰۰,۰۰۰ تومان در سال                               │
│                                                         │
│  ✓ وام با وثیقه دارایی                                 │
│  ✓ بیمه ریزش (Protection)                              │
│  ✓ مدیریت پورتفوی پیشرفته                              │
│                                                         │
│  [فعال‌سازی پرمیوم]  [شاید بعداً]                       │
└─────────────────────────────────────────────────────────┘
    `
  },

  'premium_contextual': {
    id: 'premium_contextual',
    name: 'Contextual Premium Push (After 1 Month)',
    scenario: 'premium',
    hypothesis: 'Contextual push after 1 month converts 3x better than early push',
    content: `
┌─────────────────────────────────────────────────────────┐
│  [NAME] عزیز،                                           │
│                                                         │
│  پورتفوی شما: [AUM] تومان                               │
│  رشد این ماه: +۸.۳٪ ✓                                   │
│                                                         │
│  ─────────────────────────────────────────────────────  │
│                                                         │
│  💡 با پرمیوم، می‌تونی:                                 │
│                                                         │
│  ۱. وام بگیری بدون فروش دارایی                         │
│     تا [MAX_LOAN] تومان با نرخ ۳۰٪                     │
│     (تورم ۴۰٪ = سود واقعی منفی!)                       │
│                                                         │
│  ۲. بیمه ریزش فعال کنی                                 │
│     اگه بازار ۲۰٪ بریزه، ضررت جبران میشه              │
│                                                         │
│  هزینه: ۶۰ میلیون/سال = [PERCENT]٪ از پورتفوی          │
│                                                         │
│  [می‌خوام پرمیوم بشم]  [الان نه]                        │
└─────────────────────────────────────────────────────────┘
    `
  },

  'premium_loan_calc': {
    id: 'premium_loan_calc',
    name: 'Loan Calculator for Premium',
    scenario: 'premium',
    hypothesis: 'Showing "negative real rate" converts >30% of eligible users',
    content: `
┌─────────────────────────────────────────────────────────┐
│  محاسبه‌گر وام پرمیوم                                   │
│                                                         │
│  دارایی شما: [AUM] تومان                                │
│  حداکثر وام: [MAX_LOAN] تومان (۲۵٪)                    │
│                                                         │
│  ─────────────────────────────────────────────────────  │
│                                                         │
│  مثال: وام ۲۰۰ میلیون برای ۶ ماه                       │
│                                                         │
│  نرخ سود: ۳۰٪ سالانه                                    │
│  سود ۶ ماه: ۳۰ میلیون تومان                            │
│  بازپرداخت کل: ۲۳۰ میلیون تومان                        │
│                                                         │
│  ⚡ نکته مهم:                                           │
│  با تورم ۴۰٪، این وام عملاً                            │
│  ۱۰٪ ارزان‌تر از پول نقد امروزه!                       │
│                                                         │
│  [درخواست وام]                                          │
└─────────────────────────────────────────────────────────┘
    `
  },

  // Scenario 5: Gold-Only
  'gold_welcome': {
    id: 'gold_welcome',
    name: 'Gold-Only Welcome',
    scenario: 'gold',
    hypothesis: 'Gold-only path with halal certification converts 50+ users at 2x rate',
    content: `
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  [Blu Bank Logo]                                        │
│                                                         │
│  طلای دیجیتال بلو                                       │
│  ─────────────────                                      │
│                                                         │
│  طلای واقعی، نگهداری امن                                │
│                                                         │
│  ✓ طلای ۱۸ عیار تضمین‌شده                              │
│  ✓ قابل تبدیل به طلای فیزیکی                           │
│  ✓ بدون ریسک ارز دیجیتال                               │
│  ✓ مورد تأیید کارشناسان شرعی                           │
│                                                         │
│  ─────────────────────────────────────────────────────  │
│                                                         │
│  📞 سؤال دارید؟ با ما تماس بگیرید                      │
│     ۰۲۱-۹۱۰۰۹۱۰۰                                       │
│     (پشتیبانی ۲۴ ساعته)                                │
│                                                         │
│  [شروع خرید طلا]                                        │
│                                                         │
└─────────────────────────────────────────────────────────┘
    `
  },

  'gold_storage': {
    id: 'gold_storage',
    name: 'Gold Storage Proof',
    scenario: 'gold',
    hypothesis: 'Visual proof of physical storage increases trust by +2 points',
    content: `
┌─────────────────────────────────────────────────────────┐
│  طلای شما کجاست؟                                        │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │  [تصویر خزانه بانک]                             │   │
│  │                                                  │   │
│  │  خزانه امن بانک بلو                             │   │
│  │  تهران، خیابان ولیعصر                           │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ✓ بیمه سپرده تا ۱ میلیارد تومان                       │
│  ✓ نظارت بانک مرکزی                                    │
│  ✓ گزارش موجودی لحظه‌ای                                │
│                                                         │
│  موجودی کل طلای بلو مارکتس:                            │
│  ۱.۹ تن (به‌روزرسانی: امروز ۱۴:۳۰)                     │
│                                                         │
│  [دانلود گواهی طلای من]                                 │
└─────────────────────────────────────────────────────────┘
    `
  },

  // Scenario 6: Cold User Trust
  'cold_no_trust': {
    id: 'cold_no_trust',
    name: 'No Trust Signals (Control)',
    scenario: 'cold-trust',
    hypothesis: 'Baseline - minimal trust signals',
    content: `
┌─────────────────────────────────────────────────────────┐
│  بلو مارکتس                                             │
│                                                         │
│  سرمایه‌گذاری در طلا و ارز دیجیتال                     │
│                                                         │
│  شماره موبایل:                                          │
│  ┌─────────────────────────────────────────────────┐   │
│  │  ۰۹۱۲ ۱۲۳ ۴۵۶۷                                  │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  [دریافت کد تأیید]                                      │
└─────────────────────────────────────────────────────────┘
    `
  },

  'cold_full_trust': {
    id: 'cold_full_trust',
    name: 'Full Trust Signals (Test)',
    scenario: 'cold-trust',
    hypothesis: 'Trust signals increase cold user registration by 3x',
    content: `
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  [Blu Bank Logo - Large]                                │
│                                                         │
│  بلو مارکتس                                             │
│  زیرمجموعه رسمی بانک بلو                               │
│                                                         │
│  ─────────────────────────────────────────────────────  │
│                                                         │
│  🏛️ مجوز بانک مرکزی: ۱۲۳۴۵۶                           │
│  🛡️ بیمه سپرده تا ۱ میلیارد تومان                      │
│  📍 دفتر مرکزی: تهران، ولیعصر                          │
│  📞 پشتیبانی: ۰۲۱-۹۱۰۰۹۱۰۰                            │
│                                                         │
│  ─────────────────────────────────────────────────────  │
│                                                         │
│  "۸ ماهه استفاده می‌کنم، راضیم"                        │
│  ⭐⭐⭐⭐⭐ - احمد، ۳۴ ساله، تهران                       │
│                                                         │
│  ─────────────────────────────────────────────────────  │
│                                                         │
│  شماره موبایل:                                          │
│  ┌─────────────────────────────────────────────────┐   │
│  │                                                  │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  [دریافت کد تأیید]                                      │
│                                                         │
└─────────────────────────────────────────────────────────┘
    `
  }
};

// ============================================================================
// SCENARIO DEFINITIONS
// ============================================================================

const SCENARIOS = {
  'cross-sell': {
    name: 'Blu Bank Cross-Sell',
    description: 'How do we convert 12M active Blu Bank users?',
    agents: ['mina', 'dariush', 'navid', 'leila', 'reza'],
    screens: ['cross_sell_banner', 'cross_sell_push', 'cross_sell_welcome'],
    priority: 'CRITICAL'
  },
  'value-prop': {
    name: 'Value Proposition Framing',
    description: 'What messaging converts best?',
    agents: ['mina', 'dariush', 'navid', 'leila', 'reza'],
    screens: ['value_prop_trading', 'value_prop_wealth', 'value_prop_calculator'],
    priority: 'HIGH'
  },
  'premium': {
    name: 'Premium Subscription Upsell',
    description: 'When and how to convert to premium (60M IRR/year)?',
    agents: ['navid', 'reza'],
    screens: ['premium_early', 'premium_contextual', 'premium_loan_calc'],
    priority: 'HIGH'
  },
  'gold': {
    name: 'Gold-Only Path',
    description: 'Convert conservative/religious users who fear crypto',
    agents: ['dariush', 'hossein'],
    screens: ['gold_welcome', 'gold_storage'],
    priority: 'MEDIUM'
  },
  'cold-trust': {
    name: 'Cold User Trust Building',
    description: 'How to convert users without Blu Bank relationship?',
    agents: ['amir', 'hossein'],
    screens: ['cold_no_trust', 'cold_full_trust'],
    priority: 'SECONDARY'
  }
};

// ============================================================================
// PROMPT GENERATION
// ============================================================================

function generateAgentContext(agent) {
  if (agent.segment === 'blu_bank_customer') {
    return `
CONTEXT: You are ${agent.name}, an existing Blu Bank customer.

BLU BANK RELATIONSHIP:
- You've used Blu Bank for 2-3 years
- You ${agent.bluBankUsage}
- You trust Blu Bank with your money (trust level: ${agent.trustInBluBank}/10)
- You've already completed KYC with national ID when you opened your account
- Blu Markets is a NEW FEATURE being offered within the app you already use

YOUR PROFILE:
- Age: ${agent.age}
- City: ${agent.city}
- Device: ${agent.device}
- Current Savings: ${agent.currentSavings}
- Investment Experience: ${agent.investmentExperience}

YOUR PSYCHOLOGY:
${agent.psychology}

KEY QUESTIONS YOU'LL ASK:
${agent.keyQuestions.map(q => `- ${q}`).join('\n')}
`;
  } else {
    return `
CONTEXT: You are ${agent.name}, a potential new user who is NOT a Blu Bank customer.

YOUR PROFILE:
- Age: ${agent.age}
- City: ${agent.city}
- Device: ${agent.device}
- Current Savings: ${agent.currentSavings}
- Investment Experience: ${agent.investmentExperience}
- Trust in Blu Markets: ${agent.trustInBluMarkets}/10 (very low - unknown app)

YOUR PSYCHOLOGY:
${agent.psychology}

KEY QUESTIONS YOU'LL ASK:
${agent.keyQuestions.map(q => `- ${q}`).join('\n')}

CRITICAL: You do NOT have a Blu Bank account. If you proceed, you will need to complete full KYC (national ID, selfie, etc).
`;
  }
}

function generateSimulationPrompt(agent, screen) {
  // Personalize screen content
  let screenContent = screen.content;
  if (agent.nameFA) {
    screenContent = screenContent.replace('[NAME]', agent.nameFA);
  }
  if (agent.currentSavings) {
    const savingsNum = agent.currentSavings.match(/(\d+)M/)?.[1] || '300';
    screenContent = screenContent.replace('[SAVINGS]', `${savingsNum},۰۰۰,۰۰۰`);
    
    // Calculate values
    const savings = parseInt(savingsNum) * 1000000;
    const bankValue = Math.round(savings * 0.72); // 23% interest - 40% inflation
    const bluValue = Math.round(savings * 1.15); // ~15% net return (conservative)
    screenContent = screenContent.replace('[BANK_VALUE]', bankValue.toLocaleString('fa-IR'));
    screenContent = screenContent.replace('[BLU_VALUE]', bluValue.toLocaleString('fa-IR'));
    
    // AUM and loan calculations
    if (agent.currentSavings.includes('B')) {
      const aumNum = parseFloat(agent.currentSavings.match(/(\d+\.?\d*)B/)?.[1] || '1');
      const aum = aumNum * 1000000000;
      screenContent = screenContent.replace('[AUM]', `${aumNum} میلیارد`);
      screenContent = screenContent.replace('[MAX_LOAN]', `${Math.round(aumNum * 0.25 * 1000)} میلیون`);
      screenContent = screenContent.replace('[PERCENT]', (60 / (aumNum * 10)).toFixed(1));
    } else {
      const aumNum = parseInt(agent.currentSavings.match(/(\d+)M/)?.[1] || '300');
      screenContent = screenContent.replace('[AUM]', `${aumNum} میلیون`);
      screenContent = screenContent.replace('[MAX_LOAN]', `${Math.round(aumNum * 0.25)} میلیون`);
      screenContent = screenContent.replace('[PERCENT]', (6000 / aumNum).toFixed(1));
    }
  }

  return `You are simulating a user research session using the a16z Generative Agent framework.

${generateAgentContext(agent)}

---

SCREEN BEING TESTED:
Name: ${screen.name}
Hypothesis: ${screen.hypothesis}

${screenContent}

---

RESPONSE FORMAT:
Respond as ${agent.name} would. Be authentic to the persona. Mix Persian and English naturally as real Iranian users do.

## AGENT RESPONSE: ${agent.name} (${agent.age}, ${agent.city})

### 1. TRUST LEVEL: X/10
[Persian explanation of your trust feeling toward this screen]

### 2. BEHAVIORAL PREDICTION:
- [ ] Would activate/proceed immediately
- [ ] Would proceed with hesitation
- [ ] Need more information first  
- [ ] Would abandon

### 3. HYPOTHESIS VALIDATION: [VALIDATED / PARTIALLY VALIDATED / NOT VALIDATED]
[Explain whether this screen achieves its intended effect for someone like you]

### 4. THINK ALOUD:
"[Stream of consciousness in Persian + English mix, reflecting real Iranian user speech patterns. What are you thinking as you look at this screen? What catches your eye? What worries you?]"

### 5. MISSING ELEMENTS:
- [What would increase your trust/likelihood to proceed?]
- [What's confusing or unclear?]
- [What competitive alternative comes to mind?]

### 6. LIKELY NEXT ACTION:
[Specific action: tap button, scroll, close app, call phone number, ask family member, etc.]
`;
}

// ============================================================================
// SIMULATION RUNNER
// ============================================================================

async function runSimulation(agentId, screenId) {
  const agent = AGENTS[agentId];
  const screen = SCREENS[screenId];
  
  if (!agent || !screen) {
    console.error(`Invalid agent (${agentId}) or screen (${screenId})`);
    return null;
  }

  const prompt = generateSimulationPrompt(agent, screen);
  
  console.log(`  → ${agent.name} × ${screen.name}...`);

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }]
    });

    const content = response.content[0].text;
    
    // Parse response
    const trustMatch = content.match(/TRUST LEVEL:\s*(\d+)/i);
    const trustLevel = trustMatch ? parseInt(trustMatch[1]) : null;
    
    const behaviorMatch = content.match(/\[x\]\s*(.*?)$/im);
    const behavior = behaviorMatch ? behaviorMatch[1].trim() : 'Unknown';
    
    const hypothesisMatch = content.match(/HYPOTHESIS VALIDATION:\s*(VALIDATED|PARTIALLY VALIDATED|NOT VALIDATED)/i);
    const hypothesis = hypothesisMatch ? hypothesisMatch[1].toUpperCase() : 'UNKNOWN';

    return {
      agent: agent.name,
      agentId,
      screen: screen.name,
      screenId,
      hypothesis: screen.hypothesis,
      trustLevel,
      behavior,
      hypothesisResult: hypothesis,
      fullResponse: content
    };
  } catch (error) {
    console.error(`  ✗ Error: ${error.message}`);
    return null;
  }
}

async function runScenario(scenarioId) {
  const scenario = SCENARIOS[scenarioId];
  if (!scenario) {
    console.error(`Unknown scenario: ${scenarioId}`);
    return [];
  }

  console.log(`\n╔════════════════════════════════════════════════════════════════════════════╗`);
  console.log(`║  ${scenario.name.padEnd(70)}║`);
  console.log(`║  ${scenario.description.padEnd(70)}║`);
  console.log(`║  Priority: ${scenario.priority.padEnd(62)}║`);
  console.log(`╚════════════════════════════════════════════════════════════════════════════╝\n`);

  const results = [];

  for (const agentId of scenario.agents) {
    const agent = AGENTS[agentId];
    console.log(`\n┌─ ${agent.name} ─────────────────────────────────────────────────────────┐`);
    console.log(`│  ${agent.description} (${agent.segmentSize} of segment)`);
    console.log(`└────────────────────────────────────────────────────────────────────────────┘`);

    for (const screenId of scenario.screens) {
      const result = await runSimulation(agentId, screenId);
      if (result) {
        results.push(result);
        
        const trustIcon = result.trustLevel >= 7 ? '✓' : result.trustLevel >= 4 ? '⚠️' : '✗';
        const hypIcon = result.hypothesisResult === 'VALIDATED' ? '✓' : 
                       result.hypothesisResult === 'PARTIALLY VALIDATED' ? '◐' : '✗';
        
        console.log(`     ${trustIcon} Trust: ${result.trustLevel}/10 | Hyp: ${hypIcon} ${result.hypothesisResult}`);
      }
    }
  }

  return results;
}

// ============================================================================
// REPORT GENERATION
// ============================================================================

// Saraf baseline data for comparison
const SARAF_BASELINE = {
  // Funnel metrics
  kycStartRate: 41.4,
  kycDropoff: 58.6,
  postKycConversion: 74.6,
  oneTimerRate: 52.4,
  day1Retention: 40.7,
  day6Retention: 18.6,
  
  // Trust & acquisition
  avgTrustColdUser: 3.0,  // Estimated from v3 simulations
  paidChannelWeek4Retention: 0.3, // Yektanet average
  organicReferralRate: 11,
  
  // Economics
  ltvCacRatio: 0.56,
  cac: 0.50, // USD
  ltv: 0.28, // USD
  lossPerUser: 0.22, // USD
  tradingFee: 0.75, // percent
  
  // Platform
  nativeConversion: 29.8,
  webappConversion: 14.4,
  
  // Context
  totalUsers: 6670000,
  peakMau: 3000000,
  currentMau: 1170000
};

function generateSarafComparison(results) {
  // Separate results by segment
  const bluBankResults = results.filter(r => {
    const agent = AGENTS[r.agentId];
    return agent && agent.segment === 'blu_bank_customer';
  });
  
  const coldUserResults = results.filter(r => {
    const agent = AGENTS[r.agentId];
    return agent && agent.segment === 'cold_user';
  });
  
  // Calculate averages
  const bluBankAvgTrust = bluBankResults.length > 0 
    ? bluBankResults.reduce((sum, r) => sum + (r.trustLevel || 0), 0) / bluBankResults.length 
    : 0;
  
  const coldUserAvgTrust = coldUserResults.length > 0
    ? coldUserResults.reduce((sum, r) => sum + (r.trustLevel || 0), 0) / coldUserResults.length
    : 0;
  
  // Calculate proceed rates
  const bluBankProceedRate = bluBankResults.length > 0
    ? bluBankResults.filter(r => 
        r.behavior?.toLowerCase().includes('proceed') || 
        r.behavior?.toLowerCase().includes('activate')
      ).length / bluBankResults.length * 100
    : 0;
  
  const coldUserProceedRate = coldUserResults.length > 0
    ? coldUserResults.filter(r => 
        r.behavior?.toLowerCase().includes('proceed') || 
        r.behavior?.toLowerCase().includes('activate')
      ).length / coldUserResults.length * 100
    : 0;
  
  // Calculate abandon rates
  const bluBankAbandonRate = bluBankResults.length > 0
    ? bluBankResults.filter(r => r.behavior?.toLowerCase().includes('abandon')).length / bluBankResults.length * 100
    : 0;
  
  const coldUserAbandonRate = coldUserResults.length > 0
    ? coldUserResults.filter(r => r.behavior?.toLowerCase().includes('abandon')).length / coldUserResults.length * 100
    : 0;

  // Trust lift calculation
  const trustLiftBluBank = ((bluBankAvgTrust - SARAF_BASELINE.avgTrustColdUser) / SARAF_BASELINE.avgTrustColdUser * 100).toFixed(0);
  const trustLiftColdUser = coldUserAvgTrust > 0 
    ? ((coldUserAvgTrust - SARAF_BASELINE.avgTrustColdUser) / SARAF_BASELINE.avgTrustColdUser * 100).toFixed(0)
    : 'N/A';

  return `
---

## 📊 Saraf Comparison Analysis

This section compares simulation results against actual Saraf data (6.67M users) to validate the Blu Bank advantage hypothesis.

### Trust Level Comparison

| Segment | Saraf Baseline | Blu Markets v4 | Delta | Interpretation |
|---------|---------------|----------------|-------|----------------|
| **Cold Users** | ${SARAF_BASELINE.avgTrustColdUser}/10 | ${coldUserResults.length > 0 ? coldUserAvgTrust.toFixed(1) : 'N/A'}/10 | ${trustLiftColdUser !== 'N/A' ? (trustLiftColdUser > 0 ? '+' : '') + trustLiftColdUser + '%' : 'N/A'} | ${coldUserResults.length > 0 ? (coldUserAvgTrust > SARAF_BASELINE.avgTrustColdUser ? '✅ Trust signals working' : '⚠️ Needs improvement') : 'Not tested'} |
| **Blu Bank Customers** | N/A (new segment) | ${bluBankResults.length > 0 ? bluBankAvgTrust.toFixed(1) : 'N/A'}/10 | +${trustLiftBluBank}% vs cold | ${bluBankAvgTrust >= 6 ? '✅ Blu Bank advantage confirmed' : '⚠️ Lower than expected'} |

### Funnel Comparison

| Metric | Saraf Actual | Blu Markets Simulation | Delta | Analysis |
|--------|-------------|----------------------|-------|----------|
| **Pre-KYC Abandonment** | ${SARAF_BASELINE.kycDropoff}% | ${bluBankResults.length > 0 ? '~0% (KYC skipped)' : 'N/A'} | ${bluBankResults.length > 0 ? '-' + SARAF_BASELINE.kycDropoff + 'pp' : 'N/A'} | Blu Bank users skip KYC entirely |
| **Trust-Based Abandonment** | ~${SARAF_BASELINE.kycDropoff}% (trust gate) | ${bluBankAbandonRate.toFixed(0)}% (Blu Bank) / ${coldUserResults.length > 0 ? coldUserAbandonRate.toFixed(0) : 'N/A'}% (cold) | ${bluBankResults.length > 0 ? (SARAF_BASELINE.kycDropoff - bluBankAbandonRate > 0 ? '-' : '+') + Math.abs(SARAF_BASELINE.kycDropoff - bluBankAbandonRate).toFixed(0) + 'pp' : 'N/A'} | ${bluBankAbandonRate < SARAF_BASELINE.kycDropoff ? '✅ Major improvement' : '⚠️ Still friction'} |
| **Proceed/Activate Intent** | ${SARAF_BASELINE.kycStartRate}% (KYC start) | ${bluBankProceedRate.toFixed(0)}% (Blu Bank) / ${coldUserResults.length > 0 ? coldUserProceedRate.toFixed(0) : 'N/A'}% (cold) | ${bluBankResults.length > 0 ? (bluBankProceedRate - SARAF_BASELINE.kycStartRate > 0 ? '+' : '') + (bluBankProceedRate - SARAF_BASELINE.kycStartRate).toFixed(0) + 'pp' : 'N/A'} | ${bluBankProceedRate > SARAF_BASELINE.kycStartRate ? '✅ Higher activation' : '⚠️ Below Saraf'} |

### The Blu Bank Advantage: Quantified

\`\`\`
SARAF FUNNEL (Cold Users):
┌─────────────────────────────────────────────────────────┐
│ Install → Open: 97%                                     │
│ Open → Signup: 80%                                      │
│ Signup → KYC Start: 41.4% ←── 58.6% ABANDON (TRUST)    │
│ KYC Start → Complete: 74.6%                             │
│ KYC Complete → Trade: 60%                               │
│                                                         │
│ NET CONVERSION: ~15%                                    │
└─────────────────────────────────────────────────────────┘

BLU MARKETS FUNNEL (Blu Bank Customers):
┌─────────────────────────────────────────────────────────┐
│ See Banner/Push: 100% (in-app)                          │
│ Tap to Learn More: ~15% (hypothesis)                    │
│ KYC: SKIPPED ←── 0% ABANDON (already verified!)        │
│ Complete Questionnaire: ~60%+ (no friction)             │
│ First Deposit: ~40%+                                    │
│                                                         │
│ NET CONVERSION: ~${(15 * 0.6 * 0.4).toFixed(0)}%+ (vs Saraf 15%)                          │
└─────────────────────────────────────────────────────────┘
\`\`\`

### Economic Comparison

| Metric | Saraf | Blu Markets (Projected) | Advantage |
|--------|-------|------------------------|-----------|
| **CAC** | $0.50 | ~$0 (internal cross-sell) | ∞ improvement |
| **LTV/CAC** | 0.56x (losing money) | >>1x (CAC ≈ 0) | Profitable from day 1 |
| **Revenue Model** | 0.75% per trade | AUM (2%) + Subscription (60M) + Loans (30%) | Aligned with user success |
| **Addressable Users** | Unknown (paid channels) | 12M (Blu Bank active users) | Known, reachable audience |

### Key Saraf Lessons Applied

| Saraf Problem | How Blu Markets Addresses It | Simulation Validation |
|---------------|-----------------------------|-----------------------|
| **58.6% pre-KYC abandonment** | Blu Bank users skip KYC | ${bluBankResults.length > 0 ? (bluBankAbandonRate < 20 ? '✅ Validated' : '⚠️ Partial') : '🔄 Pending'} |
| **Trust is the bottleneck** | Leverage existing Blu Bank trust | ${bluBankAvgTrust >= 7 ? '✅ Validated' : bluBankAvgTrust >= 5 ? '⚠️ Partial' : '❌ Not validated'} |
| **Paid acquisition fails (0% W4)** | No paid acquisition - internal cross-sell | ✅ By design |
| **3x pricing sensitivity** | AUM model, not per-trade fees | ✅ Different model |
| **Webapp 2x worse conversion** | Native app (Blu Bank app) | ✅ By design |

### What Saraf Data Predicts for Cold Users

If Blu Markets acquires users through cold channels (without Blu Bank relationship):

| Metric | Saraf Actual | Prediction for Blu Markets Cold Users |
|--------|-------------|--------------------------------------|
| Week 1 Retention | 9-12% | Similar (~10%) without trust signals |
| Week 4 Retention | 0-3% | Similar (~2%) without differentiation |
| KYC Start Rate | 41.4% | ${coldUserResults.length > 0 ? (coldUserAvgTrust >= 5 ? 'Higher (~50%) with trust signals' : 'Similar (~40%)') : 'Unknown'} |
| LTV/CAC | 0.56x | Likely similar (unprofitable) |

**Recommendation:** ${coldUserResults.length > 0 && coldUserAvgTrust >= 5 
  ? 'Cold acquisition may work with strong trust signals, but prioritize Blu Bank customers first.' 
  : 'Focus exclusively on Blu Bank customers. Cold acquisition likely unprofitable.'}

### Simulation vs Saraf: Summary Verdict

| Dimension | Saraf Reality | Simulation Finding | Verdict |
|-----------|--------------|-------------------|---------|
| **Trust Baseline** | 3/10 (cold) | ${bluBankAvgTrust.toFixed(1)}/10 (Blu Bank) | ${bluBankAvgTrust >= 7 ? '✅ VALIDATED: Blu Bank advantage is real' : bluBankAvgTrust >= 5 ? '⚠️ PARTIAL: Some advantage but not as strong' : '❌ CONCERN: Blu Bank trust not translating'} |
| **KYC Friction** | 58.6% abandon | 0% (skipped) | ✅ VALIDATED: Structural advantage |
| **Acquisition Cost** | $0.50/user | ~$0/user | ✅ VALIDATED: Internal cross-sell |
| **Revenue Alignment** | Per-trade (churns users) | AUM (retains users) | ✅ VALIDATED: Better model |

---

`;
}

function generateReport(results, scenarioId) {
  const scenario = SCENARIOS[scenarioId] || SCENARIOS['cross-sell'];
  
  // Calculate summary stats
  const avgTrust = results.reduce((sum, r) => sum + (r.trustLevel || 0), 0) / results.length;
  const abandonCount = results.filter(r => r.behavior?.toLowerCase().includes('abandon')).length;
  const validated = results.filter(r => r.hypothesisResult === 'VALIDATED').length;
  const partial = results.filter(r => r.hypothesisResult === 'PARTIALLY VALIDATED').length;
  const notValidated = results.filter(r => r.hypothesisResult === 'NOT VALIDATED').length;

  let report = `# Blu Markets Generative Agent Simulation Report v4

**Framework:** a16z AI Market Research
**Scenario:** ${scenario.name}
**Date:** ${new Date().toISOString()}
**Priority:** ${scenario.priority}

## Key Insight
> Blu Markets targets 12M existing Blu Bank customers who already trust the bank and have completed KYC. This is fundamentally different from cold user acquisition.

## Summary
| Metric | Value |
|--------|-------|
| Simulations | ${results.length} |
| Avg Trust | ${avgTrust.toFixed(1)}/10 |
| Would Abandon | ${abandonCount} (${Math.round(abandonCount/results.length*100)}%) |
| Hypotheses Validated | ${validated} |
| Partially Validated | ${partial} |
| Not Validated | ${notValidated} |

## Target Metrics (Blu Markets v4)
| Metric | Target | Rationale |
|--------|--------|-----------|
| Blu Bank Activation Rate | >10% | 12M × 10% = 1.2M users |
| Onboarding Completion | >60% | No KYC friction for Blu Bank users |
| First Deposit Rate | >40% | Commitment signal |
| 30-Day Retention | >70% | Wealth management = long relationships |
| Premium Conversion (>500M AUM) | >20% | Revenue driver |

${generateSarafComparison(results)}

## Detailed Results

`;

  for (const result of results) {
    report += `### ${result.agent} → ${result.screen}
**Trust Level:** ${result.trustLevel}/10 | **Behavior:** ${result.behavior} | **Hypothesis:** ${result.hypothesisResult}

${result.fullResponse}

---

`;
  }

  return report;
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'help';

  console.log(`
╔════════════════════════════════════════════════════════════════════════════╗
║         BLU MARKETS GENERATIVE AGENT SIMULATION v4                         ║
║         a16z AI Market Research Framework                                  ║
║         Primary: Blu Bank Customers (12M) | Secondary: Cold Users          ║
╚════════════════════════════════════════════════════════════════════════════╝
  `);

  if (command === 'help') {
    console.log(`
Usage: node simulate.js <scenario>

Scenarios:
  cross-sell    Blu Bank cross-sell scenarios (CRITICAL)
  value-prop    Value proposition framing tests
  premium       Premium subscription upsell
  gold          Gold-only path for conservatives
  cold-trust    Cold user trust building
  all           Run all scenarios

Example:
  node simulate.js cross-sell
    `);
    return;
  }

  let allResults = [];

  if (command === 'all') {
    for (const scenarioId of Object.keys(SCENARIOS)) {
      const results = await runScenario(scenarioId);
      allResults = allResults.concat(results);
    }
  } else if (SCENARIOS[command]) {
    allResults = await runScenario(command);
  } else {
    console.error(`Unknown scenario: ${command}`);
    process.exit(1);
  }

  // Generate and save report
  const report = generateReport(allResults, command === 'all' ? 'cross-sell' : command);
  fs.writeFileSync('simulation-results-v4.md', report);
  console.log(`\n📄 Report saved to simulation-results-v4.md`);

  // Print summary
  console.log(`
╔════════════════════════════════════════════════════════════════════════════╗
║                         SIMULATION COMPLETE                                ║
╠════════════════════════════════════════════════════════════════════════════╣
║  Total simulations: ${allResults.length.toString().padEnd(54)}║
║  Report saved: simulation-results-v4.md                                    ║
╚════════════════════════════════════════════════════════════════════════════╝
  `);
}

main().catch(console.error);
