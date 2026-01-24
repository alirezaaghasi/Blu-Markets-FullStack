# Blu Markets Generative Agent Simulation v4
## Complete Framework for AI-Powered User Research

**Framework:** a16z AI Market Research (Adapted for Wealth Management)
**Primary Segment:** Blu Bank Existing Customers (12M active users)
**Secondary Segment:** Cold User Acquisition
**Date:** January 2026

---

## Executive Summary

### Why v4 is Different

| Aspect | v3 (Saraf-Based) | v4 (Blu Markets Native) |
|--------|------------------|------------------------|
| **Primary Segment** | Cold users from paid channels | Blu Bank customers (12M) |
| **KYC Assumption** | 58.6% abandon before KYC | Blu Bank users skip KYC entirely |
| **Trust Baseline** | 3/10 (unknown app) | 8/10 (existing bank relationship) |
| **Business Model** | Trading exchange (per-trade fees) | Wealth management (AUM + subscription) |
| **Competition** | Nobitex, Wallex (0.25% fees) | Bank deposits, gold shops, doing nothing |
| **Core Question** | "Will they trust us?" | "Will they activate this feature?" |

### The Blu Bank Advantage

```
Blu Bank Universe:
├── Total Installs: 20,000,000
├── Active Users (60%): 12,000,000
├── Already KYC'd: 12,000,000
└── Trust Level: HIGH (existing banking relationship)

For Blu Bank customers:
• KYC abandonment = 0% (already verified)
• Trust = Pre-established
• Acquisition cost = ~$0 (internal cross-sell)
• Value prop = "New feature in your banking app"
```

### Key Hypotheses to Validate

| Priority | Hypothesis | Target Metric |
|----------|------------|---------------|
| **P0** | Blu Bank customers activate at >10% when offered | Activation rate |
| **P0** | Wealth management framing outperforms trading framing | Click-through rate |
| **P1** | Users with >500M AUM convert to premium at >20% | Premium conversion |
| **P1** | Inflation protection messaging resonates with 35+ | Engagement by age |
| **P2** | Gold-only path converts conservative users | Segment conversion |
| **P2** | Cold users need trust signals before proceeding | Trust score |

---

## Part 1: The 8 Generative Agents

### Segment A: Blu Bank Customers (Priority)

#### Agent 1: Mina (مینا) - The Young Saver
**Segment:** 25% of Blu Bank active users

| Attribute | Value |
|-----------|-------|
| Age | 28 |
| Location | Tehran |
| Device | iPhone 13 (via Blu Bank app) |
| Blu Bank Usage | Daily (salary, bills, transfers) |
| Current Savings | 300M IRR in savings account |
| Investment Experience | None - money sits in bank |
| Trust in Blu Bank | 9/10 |

**Psychology:**
- Watches her savings lose value to inflation every month
- Knows she should "invest" but doesn't know how
- Intimidated by crypto/stock market complexity
- Would never download a random investment app
- But if Blu Bank offers it? "They already have my money..."

**Simulation Goal:** Test if in-app cross-sell converts passive savers

**Key Questions She'll Ask:**
- "آیا این همون بانک بلو هست؟" (Is this the same Blu Bank?)
- "پولم امنه؟" (Is my money safe?)
- "پیچیده نیست؟" (Is it complicated?)

---

#### Agent 2: Dariush (داریوش) - The Conservative Father
**Segment:** 20% of Blu Bank active users

| Attribute | Value |
|-----------|-------|
| Age | 47 |
| Location | Isfahan |
| Device | Samsung Galaxy A52 (via Blu Bank app) |
| Blu Bank Usage | Weekly (salary, utilities) |
| Current Savings | 800M IRR across accounts |
| Investment Experience | Physical gold coins, bank deposits |
| Trust in Blu Bank | 8/10 |

**Psychology:**
- Remembers multiple financial crises (1997, 2008, 2018, 2022)
- Trusts gold because he can hold it
- Suspicious of "digital" anything
- But trusts Blu Bank - they've handled his salary for 3 years
- Primary concern: "Will my children inherit nothing?"

**Simulation Goal:** Test if gold-focused wealth management converts 45+ segment

**Key Questions He'll Ask:**
- "طلای واقعی هست یا مجازی؟" (Is it real gold or virtual?)
- "اگه بانک مرکزی ببنده چی؟" (What if Central Bank shuts it down?)
- "حلاله؟" (Is it halal?)

---

#### Agent 3: Navid (نوید) - The Ambitious Professional
**Segment:** 15% of Blu Bank active users

| Attribute | Value |
|-----------|-------|
| Age | 34 |
| Location | Tehran |
| Device | iPhone 14 Pro (via Blu Bank app) |
| Blu Bank Usage | Daily (business + personal) |
| Current Savings | 1.5B IRR |
| Investment Experience | Has Nobitex account, buys gold coins |
| Trust in Blu Bank | 8/10 |

**Psychology:**
- Already invests but portfolio is scattered
- Has 200M in Nobitex, 500M in gold, rest in bank
- Frustrated by manual management
- Would pay for convenience if it's worth it
- Interested in loans against assets (liquidity without selling)

**Simulation Goal:** Test premium subscription conversion for high-AUM users

**Key Questions He'll Ask:**
- "چه فرقی با نوبیتکس داره؟" (How is this different from Nobitex?)
- "وام چطور کار می‌کنه؟" (How do loans work?)
- "۶۰ میلیون در سال؟ ارزشش رو داره؟" (60M/year? Is it worth it?)

---

#### Agent 4: Leila (لیلا) - The Cautious Mother
**Segment:** 18% of Blu Bank active users

| Attribute | Value |
|-----------|-------|
| Age | 39 |
| Location | Mashhad |
| Device | Xiaomi Redmi Note 11 (via Blu Bank app) |
| Blu Bank Usage | Weekly (household expenses) |
| Current Savings | 450M IRR (family savings) |
| Investment Experience | None - husband handles investments |
| Trust in Blu Bank | 7/10 |

**Psychology:**
- Managing family finances after husband travels for work
- Nervous about making investment decisions alone
- Needs reassurance and simplicity
- Won't do anything she can't explain to her husband
- "If Blu Bank says it's safe, maybe..."

**Simulation Goal:** Test if simplified UX converts hesitant first-time investors

**Key Questions She'll Ask:**
- "اگه ضرر کنم چی؟" (What if I lose money?)
- "شوهرم می‌تونه ببینه؟" (Can my husband see it?)
- "می‌تونم هر وقت خواستم برش دارم؟" (Can I withdraw anytime?)

---

#### Agent 5: Reza (رضا) - The Power User
**Segment:** 5% of Blu Bank active users (but HIGH value)

| Attribute | Value |
|-----------|-------|
| Age | 31 |
| Location | Tehran |
| Device | iPhone 15 Pro Max |
| Blu Bank Usage | Multiple times daily |
| Current Savings | 3B IRR |
| Investment Experience | Active trader, multiple platforms |
| Trust in Blu Bank | 9/10 |

**Psychology:**
- Sophisticated investor, knows market rates
- Currently managing portfolio across 4 platforms
- Would consolidate if one platform did it all
- Interested in loans (30% APR < 40% inflation = free money)
- Will calculate exact costs before committing

**Simulation Goal:** Test if premium features (loans, protection) convert power users

**Key Questions He'll Ask:**
- "کارمزد کل چقدر میشه؟" (What's total cost?)
- "وام ۳۰٪ با تورم ۴۰٪... یعنی سود منفی؟" (30% loan with 40% inflation = negative real rate?)
- "Protection چطور کار می‌کنه؟" (How does protection work?)

---

### Segment B: Cold Users (Secondary)

#### Agent 6: Amir (امیر) - The Skeptical Newcomer
**Segment:** Cold user, heard about Blu Markets

| Attribute | Value |
|-----------|-------|
| Age | 29 |
| Location | Tehran |
| Device | Samsung Galaxy A54 |
| Blu Bank Status | NOT a customer |
| Current Savings | 200M IRR in Mellat Bank |
| Investment Experience | Lost money on a Telegram "signal group" |
| Trust in Blu Markets | 3/10 |

**Psychology:**
- Burned once, very cautious now
- Doesn't trust random fintech apps
- But might trust Blu Bank association
- Needs to see credentials before phone number

**Simulation Goal:** Test if Blu Bank association builds trust for cold users

**Key Questions He'll Ask:**
- "این واقعاً مال بانک بلو هست؟" (Is this really from Blu Bank?)
- "مجوز بانک مرکزی داره؟" (Does it have Central Bank license?)
- "چرا باید کارت ملیم رو بدم؟" (Why should I give my national ID?)

---

#### Agent 7: Hossein (حسین) - The Traditional Investor
**Segment:** Cold user, wants gold only

| Attribute | Value |
|-----------|-------|
| Age | 52 |
| Location | Tabriz |
| Device | Samsung Galaxy A32 |
| Blu Bank Status | NOT a customer |
| Current Savings | 600M IRR + physical gold |
| Investment Experience | 30 years buying gold from bazaar |
| Trust in Blu Markets | 2/10 |

**Psychology:**
- "If I can't touch it, it's not real"
- Buys gold coins from Haj Mahmoud in bazaar
- Son told him about "digital gold"
- Extremely suspicious but inflation is eating his savings
- Needs human support (phone number)

**Simulation Goal:** Test if gold-only path with human support converts 50+ segment

**Key Questions He'll Ask:**
- "طلای فیزیکی می‌تونم بگیرم؟" (Can I get physical gold?)
- "یه شماره تلفن بده زنگ بزنم" (Give me a phone number to call)
- "این سود حرام نیست؟" (Isn't this interest haram?)

---

#### Agent 8: Maryam (مریم) - The Diaspora Helper
**Segment:** Lives abroad, helps family in Iran

| Attribute | Value |
|-----------|-------|
| Age | 36 |
| Location | Toronto (but parents in Tehran) |
| Device | iPhone 14 |
| Blu Bank Status | NOT a customer (lives abroad) |
| Connection | Parents are Blu Bank customers |
| Investment Experience | Uses Wealthsimple in Canada |
| Trust in Blu Markets | 5/10 |

**Psychology:**
- Sends money to parents monthly
- Wants to help them invest (they just keep IRR in bank)
- Familiar with robo-advisors (Wealthsimple)
- Would set up parents' accounts if onboarding is simple enough
- Needs English + Persian support

**Simulation Goal:** Test if diaspora can onboard family members remotely

**Key Questions She'll Ask:**
- "Can I set this up for my parents?"
- "Do they need to do anything complicated?"
- "Is there English support if I have questions?"

---

## Part 2: Simulation Scenarios

### Scenario 1: Blu Bank Cross-Sell (CRITICAL)
**Problem:** How do we convert 12M active Blu Bank users?
**Agents:** Mina, Dariush, Navid, Leila, Reza

#### Screen 1A: In-App Banner (Passive)
```
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
```

**Hypothesis:** >5% tap "Learn more" from passive banner

---

#### Screen 1B: Push Notification (Active)
```
┌─────────────────────────────────────────────────────────┐
│  🔔 بانک بلو                                            │
│                                                         │
│  مینا عزیز،                                             │
│  در ۶ ماه گذشته، ارزش پس‌اندازت                        │
│  ۱۸٪ کمتر شده (تورم).                                  │
│                                                         │
│  با بلو مارکتس، سرمایه‌گذاری کن.                       │
│                                                         │
│  [همین الان]  [بعداً]                                   │
└─────────────────────────────────────────────────────────┘
```

**Hypothesis:** Personalized inflation loss notification >15% tap rate

---

#### Screen 1C: Welcome Screen (After Tap)
```
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
```

**Hypothesis:** "No re-KYC needed" reduces friction, >40% proceed

---

### Scenario 2: Value Proposition Framing
**Problem:** What messaging converts best?
**Agents:** All Blu Bank customers

#### Screen 2A: Trading Frame (Control)
```
┌─────────────────────────────────────────────────────────┐
│  خرید و فروش طلا، بیت‌کوین و ارز                       │
│                                                         │
│  BTC  ۲,۸۵۰,۰۰۰,۰۰۰ تومان  ↑ ۱.۲٪                     │
│  ETH  ۱۴۵,۰۰۰,۰۰۰ تومان    ↓ ۰.۸٪                     │
│  طلا  ۱۲,۵۰۰,۰۰۰ تومان     ↑ ۰.۳٪                     │
│                                                         │
│  [شروع معامله]                                          │
└─────────────────────────────────────────────────────────┘
```

#### Screen 2B: Wealth Management Frame (Test)
```
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
```

**Hypothesis:** Wealth management frame converts 2x better than trading frame

---

#### Screen 2C: Inflation Calculator (Interactive)
```
┌─────────────────────────────────────────────────────────┐
│  محاسبه‌گر تورم                                         │
│                                                         │
│  پس‌انداز فعلی شما:                                     │
│  ┌─────────────────────────────────────────────────┐   │
│  │  ۳۰۰,۰۰۰,۰۰۰ تومان                              │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ارزش واقعی بعد از ۱ سال:                              │
│                                                         │
│  💰 در حساب بانکی: ۲۱۶,۰۰۰,۰۰۰ تومان                  │
│     (با احتساب سود ۲۳٪ و تورم ۴۰٪)                     │
│                                                         │
│  📈 در بلو مارکتس: ۳۴۵,۰۰۰,۰۰۰ تومان*                 │
│     (بر اساس عملکرد ۲۰۲۵)                              │
│                                                         │
│  *عملکرد گذشته تضمین آینده نیست                        │
│                                                         │
│  [می‌خوام سرمایه‌گذاری کنم]                             │
└─────────────────────────────────────────────────────────┘
```

**Hypothesis:** Personalized calculator increases activation by 3x

---

### Scenario 3: Risk Assessment UX
**Problem:** Does the questionnaire scare users or build confidence?
**Agents:** Mina, Leila, Dariush

#### Screen 3A: Standard Questionnaire (Control)
```
┌─────────────────────────────────────────────────────────┐
│  پرسشنامه ریسک (۱ از ۹)                                │
│  ━━━━━░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░       │
│                                                         │
│  درآمدت چقدر قابل پیش‌بینیه؟                           │
│                                                         │
│  ○ ثابت و مطمئن                                        │
│  ○ تقریباً ثابت                                        │
│  ○ متغیر                                               │
│  ○ نامشخص یا بیکار                                     │
│                                                         │
│  [بعدی]                                                 │
└─────────────────────────────────────────────────────────┘
```

#### Screen 3B: Simplified Questionnaire (Test)
```
┌─────────────────────────────────────────────────────────┐
│  بیا بفهمیم چه نوع سرمایه‌گذاری بهت می‌خوره            │
│                                                         │
│  فقط ۳ سؤال ساده 🎯                                    │
│                                                         │
│  ─────────────────────────────────────────────────────  │
│                                                         │
│  این پول رو کِی ممکنه لازم داشته باشی؟                 │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │  🗓️  کمتر از ۱ سال                              │   │
│  └─────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────┐   │
│  │  📅  ۱ تا ۳ سال                                 │   │
│  └─────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────┐   │
│  │  🎯  بیشتر از ۳ سال                             │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Hypothesis:** 3-question version has 2x completion rate vs 9-question

---

### Scenario 4: Premium Subscription Upsell
**Problem:** When and how to convert to premium (60M IRR/year)?
**Agents:** Navid, Reza (high AUM)

#### Screen 4A: Early Premium Push (Control)
```
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
```

#### Screen 4B: Contextual Premium Push (Test) - After 1 Month
```
┌─────────────────────────────────────────────────────────┐
│  نوید عزیز،                                             │
│                                                         │
│  پورتفوی شما: ۱,۵۰۰,۰۰۰,۰۰۰ تومان                      │
│  رشد این ماه: +۸.۳٪ ✓                                   │
│                                                         │
│  ─────────────────────────────────────────────────────  │
│                                                         │
│  💡 با پرمیوم، می‌تونی:                                 │
│                                                         │
│  ۱. وام بگیری بدون فروش دارایی                         │
│     تا ۳۷۵ میلیون تومان با نرخ ۳۰٪                     │
│     (تورم ۴۰٪ = سود واقعی منفی!)                       │
│                                                         │
│  ۲. بیمه ریزش فعال کنی                                 │
│     اگه بازار ۲۰٪ بریزه، ضررت جبران میشه              │
│                                                         │
│  هزینه: ۶۰ میلیون/سال = ۴٪ از پورتفوی                  │
│                                                         │
│  [می‌خوام پرمیوم بشم]  [الان نه]                        │
└─────────────────────────────────────────────────────────┘
```

**Hypothesis:** Contextual push after 1 month converts 3x better than early push

---

#### Screen 4C: Loan Calculator for Premium
```
┌─────────────────────────────────────────────────────────┐
│  محاسبه‌گر وام پرمیوم                                   │
│                                                         │
│  دارایی شما: ۱.۵ میلیارد تومان                         │
│  حداکثر وام: ۳۷۵ میلیون تومان (۲۵٪)                    │
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
```

**Hypothesis:** Showing "negative real rate" converts >30% of eligible users

---

### Scenario 5: Gold-Only Path
**Problem:** Convert conservative/religious users who fear crypto
**Agents:** Dariush, Hossein

#### Screen 5A: Gold-Only Welcome
```
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
```

**Hypothesis:** Gold-only path with halal certification converts 50+ users at 2x rate

---

#### Screen 5B: Gold Storage Proof
```
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
```

**Hypothesis:** Visual proof of physical storage increases trust by +2 points

---

### Scenario 6: Cold User Trust Building
**Problem:** How to convert users without Blu Bank relationship?
**Agents:** Amir, Hossein

#### Screen 6A: No Trust Signals (Control)
```
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
```

#### Screen 6B: Full Trust Signals (Test)
```
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
```

**Hypothesis:** Trust signals increase cold user registration by 3x

---

### Scenario 7: Post-Activation Retention
**Problem:** Keep users engaged after first deposit
**Agents:** Mina, Leila (new investors)

#### Screen 7A: Weekly Summary Push
```
┌─────────────────────────────────────────────────────────┐
│  🔔 گزارش هفتگی بلو مارکتس                              │
│                                                         │
│  مینا عزیز،                                             │
│                                                         │
│  پورتفوی شما این هفته:                                  │
│  📈 +۲.۳٪ رشد (۶.۹ میلیون تومان)                       │
│                                                         │
│  در همین مدت، حساب بانکی معمولی:                        │
│  📉 -۰.۸٪ (تورم هفتگی)                                  │
│                                                         │
│  [مشاهده جزئیات]                                        │
└─────────────────────────────────────────────────────────┘
```

**Hypothesis:** Weekly comparison with bank deposit increases retention by 40%

---

## Part 3: Success Metrics

### Blu Markets Native Metrics (NOT Saraf)

| Metric | Definition | Target | Rationale |
|--------|------------|--------|-----------|
| **Blu Bank Activation Rate** | % of Blu Bank users who activate Blu Markets | >10% | 12M × 10% = 1.2M users |
| **Cross-Sell Tap Rate** | % who tap "Learn more" from banner/push | >15% | Top of funnel |
| **Onboarding Completion** | % who complete questionnaire after tapping | >60% | No KYC friction |
| **First Deposit Rate** | % who deposit within 7 days of activation | >40% | Commitment signal |
| **30-Day Retention** | % still active after 30 days | >70% | Wealth mgmt = long relationships |
| **Premium Conversion (>500M AUM)** | % converting to premium | >20% | Revenue driver |
| **Loan Adoption (Premium)** | % of premium using loans | >50% | 32.8% of revenue |
| **NPS** | Net Promoter Score | >40 | Organic referral driver |

### Cold User Metrics (Secondary)

| Metric | Definition | Target | Notes |
|--------|------------|--------|-------|
| **Registration Rate** | % who enter phone number | >30% (with trust signals) | Baseline ~10% without |
| **KYC Completion** | % who complete full KYC | >60% | Still required for non-Blu Bank |
| **Trust Score** | Agent-reported trust (1-10) | >6/10 | Minimum to proceed |

---

## Part 4: Agent Response Template

Each agent responds with:

```markdown
## AGENT RESPONSE: [Name] ([Age], [City])

### 1. TRUST LEVEL: X/10
[Persian explanation of trust feeling]

### 2. BEHAVIORAL PREDICTION:
- [ ] Would activate/proceed immediately
- [ ] Would proceed with hesitation
- [ ] Need more information first
- [ ] Would abandon

### 3. HYPOTHESIS VALIDATION: [VALIDATED / PARTIALLY / NOT VALIDATED]
[Explanation of whether screen achieves intended effect]

### 4. THINK ALOUD:
"[Stream of consciousness in Persian + English mix, reflecting real Iranian user speech patterns]"

### 5. MISSING ELEMENTS:
- [What would increase trust/conversion?]
- [What's confusing?]
- [What competitive alternative comes to mind?]

### 6. LIKELY NEXT ACTION:
[Specific action: tap button, scroll, close app, call phone number, ask family member, etc.]
```

---

## Part 5: Implementation Guide

### Running Simulations

```bash
# Scenario 1: Blu Bank Cross-Sell (Priority)
node simulate.js cross-sell

# Scenario 2: Value Proposition Framing
node simulate.js value-prop

# Scenario 3: Risk Assessment UX
node simulate.js questionnaire

# Scenario 4: Premium Upsell
node simulate.js premium

# Scenario 5: Gold-Only Path
node simulate.js gold

# Scenario 6: Cold User Trust
node simulate.js cold-trust

# Scenario 7: Retention
node simulate.js retention

# All scenarios
node simulate.js all
```

### Estimated Costs

| Scenario | Agents | Screens | API Calls | Est. Cost |
|----------|--------|---------|-----------|-----------|
| cross-sell | 5 | 3 | 15 | ~$0.25 |
| value-prop | 5 | 3 | 15 | ~$0.25 |
| questionnaire | 3 | 2 | 6 | ~$0.10 |
| premium | 2 | 3 | 6 | ~$0.10 |
| gold | 2 | 2 | 4 | ~$0.07 |
| cold-trust | 2 | 2 | 4 | ~$0.07 |
| retention | 2 | 1 | 2 | ~$0.03 |
| **Total** | - | - | **52** | **~$0.87** |

---

## Part 6: Key Differences from v3

| Aspect | v3 | v4 |
|--------|----|----|
| Primary segment | Cold users (Saraf model) | Blu Bank customers |
| Trust baseline | 3/10 (skeptical) | 8/10 (existing relationship) |
| KYC assumption | 58.6% abandon | 0% abandon (skip KYC) |
| Core friction | Trust | Activation awareness |
| Revenue model | Per-trade fees | AUM + Subscription |
| Premium target | N/A | >500M AUM users |
| Competition | Nobitex (0.25% fees) | Bank deposits, gold shops |
| Key hypothesis | "Will they trust us?" | "Will they activate?" |

---

## Appendix A: Blu Bank Context for Agents

All Blu Bank customer agents should be seeded with:

```
CONTEXT: You are an existing Blu Bank customer.

BLU BANK FACTS:
- You've used Blu Bank for [1-3] years
- You receive salary / make transfers / pay bills through Blu Bank
- You trust Blu Bank with your money (they haven't failed you)
- You've already completed KYC with national ID when you opened your account
- Blu Markets is a NEW FEATURE being offered within the app you already use

YOUR BASELINE:
- Trust in Blu Bank: HIGH (8-9/10)
- Trust in "Blu Markets" specifically: UNKNOWN (needs to be established that it's really from Blu Bank)
- Technical comfort: MEDIUM (you use the app but aren't tech-savvy)
- Investment knowledge: [varies by persona]
```

---

## Appendix B: Revenue Model Context for Premium Scenarios

For premium upsell simulations, agents should understand:

```
BLU MARKETS PREMIUM FACTS:
- Cost: 60,000,000 IRR / year (~$40 at free market rate)
- Features unlocked:
  * Loans against assets (up to 25% of AUM)
  * Downside protection (insurance against drops)
  * Advanced portfolio management

LOAN ECONOMICS:
- Interest rate: 30% APR
- Iran inflation: 40%+
- Real cost of loan: NEGATIVE (borrowing is cheaper than holding cash)
- This is a genuine value proposition for users who need liquidity

PREMIUM MAKES SENSE FOR:
- AUM > 500M IRR (so 60M fee < 12% of capital)
- Users who need liquidity without selling
- Users worried about market crashes (protection)

PREMIUM DOES NOT MAKE SENSE FOR:
- AUM < 200M IRR (60M fee = 30% of capital!)
- Users who just want simple gold exposure
- Users who never need to borrow
```

---

## Appendix C: Saraf Comparison Analysis (Auto-Generated)

Every simulation report includes an automated comparison against Saraf's actual data. This section helps validate the Blu Bank advantage hypothesis.

### Saraf Baseline Data Used

| Metric | Saraf Value | Source |
|--------|-------------|--------|
| KYC Start Rate | 41.4% | WebEngage Analytics |
| Pre-KYC Abandonment | 58.6% | WebEngage Analytics |
| Post-KYC Conversion | 74.6% | WebEngage Analytics |
| One-Timer Rate | 52.4% | Cohort Analysis |
| Day 1 Retention | 40.7% | WebEngage Analytics |
| Day 6 Retention | 18.6% | WebEngage Analytics |
| Cold User Trust (estimated) | 3.0/10 | v3 Simulation Results |
| Paid Channel Week 4 Retention | 0.3% | Yektanet Data |
| Organic Referral Rate | 11% | Critical Analysis |
| LTV/CAC Ratio | 0.56x | Financial Analysis |
| CAC | $0.50 | Financial Analysis |
| LTV | $0.28 | Financial Analysis |

### What the Comparison Measures

1. **Trust Level Comparison**
   - Compares Blu Bank customer trust (expected: 8-9/10) vs Saraf cold user baseline (3/10)
   - Validates that existing bank relationship provides trust advantage

2. **Funnel Comparison**
   - Compares abandonment rates at each stage
   - Highlights KYC skip advantage (58.6% → 0% friction)

3. **Economic Comparison**
   - Projects CAC advantage ($0.50 → ~$0)
   - Validates revenue model alignment

4. **Lesson Application**
   - Checks if Saraf's failures have been addressed
   - Validates structural improvements

### Interpreting the Comparison

| Verdict | Meaning |
|---------|---------|
| ✅ VALIDATED | Blu Markets significantly outperforms Saraf baseline |
| ⚠️ PARTIAL | Some improvement but not as strong as expected |
| ❌ CONCERN | Performance similar to or worse than Saraf |

### Sample Output

```
📊 Saraf Comparison Analysis

Trust Level Comparison:
| Segment           | Saraf | Blu v4 | Delta  |
|-------------------|-------|--------|--------|
| Cold Users        | 3.0   | 4.5    | +50%   |
| Blu Bank Users    | N/A   | 7.8    | +160%  |

Summary Verdict:
✅ VALIDATED: Blu Bank advantage is real
   - Trust: 7.8/10 vs 3.0/10 baseline
   - KYC: 0% friction vs 58.6% abandonment
   - CAC: ~$0 vs $0.50
```

---

**Document Version:** 4.0
**Framework:** a16z AI Market Research (Adapted)
**Primary Focus:** Blu Bank Customer Conversion
**Date:** January 2026
