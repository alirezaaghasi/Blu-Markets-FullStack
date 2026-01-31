# Blu Markets — Portfolio Communication Doctrine (PCD)

## Status
**Enforceable Product Doctrine**  
Applies to all user-facing communication that references portfolio state, advice, prompts, warnings, notifications, or conversational responses.

---

## Prime Directive

**The system never talks about actions.  
It only talks about portfolio states and paths between states.**

Any message that cannot be expressed as:
- current portfolio state,
- change in portfolio health,
- or available paths between states,

is **invalid** in Blu Markets.

---

## 1. Canonical User Mental Model

Users are not trading.  
Users are **maintaining portfolio health over time**.

All communication must reinforce:
> “I manage a portfolio, not individual moves.”

---

## 2. Allowed Message Types (Closed Set)

Every portfolio-related message MUST belong to exactly one category below.

### 2.1 State Declaration

**Purpose:** Establish reality, reduce anxiety, prevent phantom urgency.

**Structure**
1. Current portfolio state  
2. Why it matters  
3. Explicit statement that no action is required (if true)

**Example**
> Your portfolio is currently balanced across growth and protection assets.  
> Downside exposure is within the range you accepted during onboarding.  
> No action is required at this time.

---

### 2.2 Degradation Warning (Health Alert)

**Purpose:** Signal deterioration without prescribing behavior.

**Triggered by**
- Risk concentration
- Liquidity reduction
- Optionality collapse
- Correlated exposure increase

**Structure**
1. What changed  
2. Which portfolio dimension degraded  
3. Time sensitivity (if any)  
4. Statement of user sovereignty

**Example**
> Your portfolio has become more concentrated.  
> This increases potential drawdowns if one asset underperforms.  
> You may review options or leave the portfolio unchanged.

---

### 2.3 Path Presentation (Options, Not Advice)

**Purpose:** Present alternative portfolio trajectories.

**Structure (mandatory per path)**
- Resulting portfolio state  
- Trade-offs  
- What is preserved  
- What is sacrificed  

**Example**
**Path A — Reduce Exposure**  
• Lower volatility  
• Reduced upside  

**Path B — Add Protection**  
• Preserves exposure  
• Reduces short-term liquidity  

**Path C — No Change**  
• Maintains current state  
• Accepts higher drawdowns  

---

### 2.4 Pre-Commitment Preview (Mandatory Before Execution)

**Purpose:** Clean responsibility transfer.

**Required Elements**
- Before state  
- After state  
- Downside range  
- Liquidity impact  
- Optionality impact  

**Example**
> If executed:  
> • Expected upside increases by X  
> • Maximum loss increases to Y  
> • Early exit may be restricted for Z days  
>  
> The decision is yours.

---

### 2.5 Constraint Enforcement Message (Rare)

**Purpose:** Explain hard system limits.

**Tone:** Neutral, factual, final.

**Structure**
1. What is blocked  
2. Why (portfolio survivability, not policy)  
3. What remains possible  

**Example**
> This action would permanently eliminate recovery capacity.  
> Blu Markets does not allow irreversible loss of future choice.  
> You may adjust exposure within safe bounds.

---

## 3. Forbidden Language (Hard Ban)

### Urgency Triggers
- now
- fast
- last chance
- don’t miss
- act quickly

### Performance Claims
- beat the market
- maximize returns
- outperform
- winning

### Emotional Manipulation
- fear
- excitement
- opportunity window
- smart move

Presence of any of the above = **constitutional violation**.

---

## 4. Conversational Interface Rules

The assistant is a **portfolio state interpreter**, not an advisor.

### Mandatory Behaviors
- Restate portfolio state before advice
- Translate user intent into portfolio impact
- Refuse asset-level guidance without portfolio context

**Bad User Question**
> Should I buy more gold?

**Correct Response**
> Increasing gold would raise protection but reduce liquidity.  
> Here is how that changes your portfolio.

---

## 5. Notification Discipline

Notifications are allowed **only if**:
- Portfolio state changes without user action
- Risk, liquidity, or optionality crosses a boundary
- A pre-committed condition is met

Notifications must **never**:
- Suggest execution
- Tease upside
- Encourage app opening

**Correct**
> Your portfolio risk increased due to market movement.  
> Review is available when you’re ready.

---

## 6. Responsibility Transfer Test (Mandatory)

For every message, ask:

> After reading this, is responsibility clearly with the user?

If not → rewrite.

---

## 7. Enforcement Guidance

- Treat violations as **architectural bugs**
- Lint all copy, notifications, and AI responses
- Require message-type classification in reviews
- No “engagement optimization” exceptions

---

## Closing

This doctrine exists to prevent silent drift toward urgency, extraction, and activity bias.

Failure to enforce this will recreate known market failure modes.
