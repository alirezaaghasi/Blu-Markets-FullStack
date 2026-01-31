/**
 * Blu Markets — Canonical Portfolio Messages
 *
 * THIS FILE IS THE SINGLE SOURCE OF TRUTH for all portfolio-related user communication.
 * No other copy is allowed to describe portfolio state, risk, decisions, or constraints.
 *
 * Based on Portfolio Communication Doctrine (PCD) v1
 * Status: ENFORCEABLE
 *
 * Core Principle: "The system never talks about actions. It only talks about
 * portfolio states and paths between states."
 */

// =============================================================================
// MESSAGE TYPES
// =============================================================================

export type MessageType =
  | 'StateDeclaration'
  | 'DegradationWarning'
  | 'PathPresentation'
  | 'PreCommitmentPreview'
  | 'ConstraintEnforcement';

export interface PortfolioMessage {
  id: string;
  type: MessageType;
  text: string;
  variables?: string[];
  rules: string[];
}

// =============================================================================
// STATE DECLARATION MESSAGES
// =============================================================================

export const PORTFOLIO_STATE_HEALTHY: PortfolioMessage = {
  id: 'portfolio.state.healthy',
  type: 'StateDeclaration',
  text: `Your portfolio is currently within healthy risk and liquidity ranges.
Downside exposure remains within the boundaries you accepted.
No action is required at this time.`,
  variables: [],
  rules: [
    'May appear on dashboard or after evaluations',
    'Must not be paired with CTA buttons',
    'Must not imply opportunity or upside',
  ],
};

export const PORTFOLIO_STATE_INACTIVE: PortfolioMessage = {
  id: 'portfolio.state.inactive',
  type: 'StateDeclaration',
  text: `Your portfolio is active and being monitored.
No changes have occurred since your last review.`,
  variables: [],
  rules: [
    'Allowed during idle periods',
    'Must not trigger notifications',
  ],
};

export const PORTFOLIO_EDUCATION_CONTEXT: PortfolioMessage = {
  id: 'portfolio.education.context',
  type: 'StateDeclaration',
  text: `Portfolio risk, liquidity, and flexibility change over time.
Blu Markets evaluates these continuously to preserve future choice.`,
  variables: [],
  rules: [
    'Educational only',
    'Must not precede decisions directly',
  ],
};

// =============================================================================
// DEGRADATION WARNING MESSAGES
// =============================================================================

export const PORTFOLIO_RISK_INCREASE_MARKET: PortfolioMessage = {
  id: 'portfolio.risk.increase.market',
  type: 'DegradationWarning',
  text: `Market movement has increased your portfolio risk.
This raises potential drawdowns without changing expected upside.
You may review options or keep the portfolio unchanged.`,
  variables: ['risk_delta_percent'],
  rules: [
    'Must be triggered only by portfolio-level evaluation',
    'No urgency language',
    'No action verbs',
  ],
};

export const PORTFOLIO_RISK_CONCENTRATION: PortfolioMessage = {
  id: 'portfolio.risk.concentration',
  type: 'DegradationWarning',
  text: `Your portfolio has become more concentrated.
This increases sensitivity to the performance of a small number of assets.
You may review options or maintain the current structure.`,
  variables: ['concentration_ratio'],
  rules: [
    'Cannot recommend diversification',
    'No advice framing',
  ],
};

export const PORTFOLIO_LIQUIDITY_REDUCTION: PortfolioMessage = {
  id: 'portfolio.liquidity.reduction',
  type: 'DegradationWarning',
  text: `Your portfolio liquidity has decreased.
Exiting positions may take longer under current conditions.
You may review options or accept reduced flexibility.`,
  variables: ['liquidity_delta'],
  rules: [
    'Must be shown before any lock-in actions',
    'No CTA buttons',
  ],
};

export const PORTFOLIO_OPTIONALITY_DECREASE: PortfolioMessage = {
  id: 'portfolio.optionality.decrease',
  type: 'DegradationWarning',
  text: `Recent changes have reduced your future flexibility.
Some recovery paths may no longer be available under stress scenarios.
You may review options or continue unchanged.`,
  variables: [],
  rules: [
    'Must not be phrased as loss or mistake',
    'Must not assign blame',
  ],
};

export const PORTFOLIO_NOTIFICATION_MARKET_SHIFT: PortfolioMessage = {
  id: 'portfolio.notification.market_shift',
  type: 'DegradationWarning',
  text: `Market conditions have altered your portfolio risk profile.
No immediate action is required.
Review is available when you're ready.`,
  variables: [],
  rules: [
    'Notification-safe',
    'Must not deep-link to execution',
  ],
};

// =============================================================================
// PATH PRESENTATION MESSAGES
// =============================================================================

export const PORTFOLIO_PATH_REDUCE_EXPOSURE: PortfolioMessage = {
  id: 'portfolio.path.reduce_exposure',
  type: 'PathPresentation',
  text: `Reducing exposure would lower volatility and potential drawdowns.
This also limits upside if markets recover.
Portfolio liquidity would increase.`,
  variables: ['exposure_delta'],
  rules: [
    'Must be shown alongside alternative paths',
    'Cannot be default-selected',
  ],
};

export const PORTFOLIO_PATH_ADD_PROTECTION: PortfolioMessage = {
  id: 'portfolio.path.add_protection',
  type: 'PathPresentation',
  text: `Adding protective assets would reduce downside risk.
Short-term liquidity would decrease.
Expected upside remains broadly unchanged.`,
  variables: ['protection_cost'],
  rules: [
    'Must disclose liquidity impact',
    'No performance claims',
  ],
};

export const PORTFOLIO_PATH_INCREASE_EXPOSURE: PortfolioMessage = {
  id: 'portfolio.path.increase_exposure',
  type: 'PathPresentation',
  text: `Increasing exposure raises potential upside.
It also increases volatility and potential drawdowns.
Liquidity may be reduced under stress.`,
  variables: ['exposure_delta'],
  rules: [
    'Must be accompanied by downside disclosure',
    'Cannot be shown alone',
  ],
};

export const PORTFOLIO_PATH_NO_CHANGE: PortfolioMessage = {
  id: 'portfolio.path.no_change',
  type: 'PathPresentation',
  text: `Keeping the portfolio unchanged preserves current exposure.
Risk and liquidity remain as they are today.`,
  variables: [],
  rules: [
    'Always allowed',
    'Must always be presented as a valid option',
  ],
};

export const PORTFOLIO_EXIT_TO_CASH: PortfolioMessage = {
  id: 'portfolio.exit.to_cash',
  type: 'PathPresentation',
  text: `Converting to cash reduces market exposure.
It also increases exposure to inflation over time.
Liquidity would be fully restored.`,
  variables: [],
  rules: [
    'Must disclose inflation trade-off',
    'No fear-based language',
  ],
};

// =============================================================================
// PRE-COMMITMENT PREVIEW MESSAGES
// =============================================================================

export const PORTFOLIO_PRECOMMIT_REBALANCE: PortfolioMessage = {
  id: 'portfolio.precommit.rebalance',
  type: 'PreCommitmentPreview',
  text: `If you proceed, your portfolio balance will change.
Risk and exposure levels will adjust accordingly.
Some positions may not be immediately reversible.`,
  variables: ['max_drawdown', 'lockup_days'],
  rules: [
    'Mandatory before execution',
    'Must show before/after comparison in UI',
  ],
};

export const PORTFOLIO_PRECOMMIT_ADD_ASSET: PortfolioMessage = {
  id: 'portfolio.precommit.add_asset',
  type: 'PreCommitmentPreview',
  text: `Adding this asset will change your portfolio composition.
Downside risk and liquidity will be affected.
Exit timing may be limited under certain conditions.`,
  variables: ['asset_weight', 'liquidity_impact'],
  rules: [
    'Cannot execute without explicit confirmation',
    'No encouragement language',
  ],
};

// =============================================================================
// CONSTRAINT ENFORCEMENT MESSAGES
// =============================================================================

export const PORTFOLIO_CONSTRAINT_BLOCK_IRREVERSIBLE: PortfolioMessage = {
  id: 'portfolio.constraint.block_irreversible',
  type: 'ConstraintEnforcement',
  text: `This action would permanently eliminate recovery capacity.
Blu Markets does not allow actions that destroy future choice.
You may adjust exposure within safe bounds.`,
  variables: [],
  rules: [
    'Final and non-overridable',
    'Must not reference policy or regulation',
    'Must not suggest workaround',
  ],
};

export const PORTFOLIO_CONSTRAINT_LIQUIDITY_GUARD: PortfolioMessage = {
  id: 'portfolio.constraint.liquidity_guard',
  type: 'ConstraintEnforcement',
  text: `This action would compromise portfolio liquidity beyond safe limits.
Execution is not permitted under current conditions.
Other portfolio adjustments remain available.`,
  variables: [],
  rules: [
    'Must follow evaluation failure',
    'Calm, factual tone only',
  ],
};

// =============================================================================
// HOME SCREEN STATUS MESSAGES (PCD-Compliant)
// =============================================================================

export type PortfolioStatus = 'BALANCED' | 'SLIGHTLY_OFF' | 'ATTENTION_REQUIRED';

export const PORTFOLIO_STATUS_MESSAGES: Record<PortfolioStatus, {
  message: string;
  color: string;
}> = {
  BALANCED: {
    message: 'Your portfolio is within target allocation ranges. No action is required.',
    color: '#4ade80', // green
  },
  SLIGHTLY_OFF: {
    message: 'Your portfolio has drifted from target allocation. You may review when ready.',
    color: '#fde047', // yellow
  },
  ATTENTION_REQUIRED: {
    message: 'Your portfolio allocation has shifted significantly. Review is available.',
    color: '#f87171', // red
  },
};

// =============================================================================
// TRADE FRICTION MESSAGES (PCD-Compliant)
// =============================================================================

export type Boundary = 'SAFE' | 'DRIFT' | 'STRUCTURAL' | 'STRESS';

/**
 * Get friction copy for trade preview based on boundary level.
 * These messages describe portfolio state changes, NOT actions.
 */
export const getTradeFrictionCopy = (boundary: Boundary, movesTowardTarget: boolean): string[] => {
  // If moving toward target, always positive framing
  if (movesTowardTarget) {
    return ['This trade moves your portfolio closer to target allocation.'];
  }

  const copy: string[] = [];

  switch (boundary) {
    case 'SAFE':
      // No friction needed for safe trades
      break;

    case 'DRIFT':
      copy.push('This trade creates minor drift from your target allocation.');
      copy.push('Portfolio balance can be restored through future adjustments.');
      break;

    case 'STRUCTURAL':
      copy.push('This trade creates significant drift from your target allocation.');
      copy.push('Your portfolio risk profile will change.');
      break;

    case 'STRESS':
      copy.push('This trade creates major drift from your target allocation.');
      copy.push('Downside exposure will increase beyond your stated boundaries.');
      copy.push('Recovery to target may require substantial future changes.');
      break;
  }

  return copy;
};

/**
 * Get boundary explanation for trade preview.
 * Describes portfolio state impact, not user actions.
 */
export const getBoundaryExplanation = (boundary: Boundary, movesTowardTarget?: boolean): string => {
  if (movesTowardTarget) {
    return 'This trade improves portfolio alignment with your target.';
  }

  switch (boundary) {
    case 'SAFE':
      return 'Portfolio remains within healthy allocation ranges.';
    case 'DRIFT':
      return 'Portfolio will drift slightly from target allocation.';
    case 'STRUCTURAL':
      return 'Portfolio will move significantly from target allocation.';
    case 'STRESS':
      return 'Portfolio will move far from target. Downside exposure increases.';
    default:
      return '';
  }
};

/**
 * Get allocation impact sentence for trade preview.
 * Describes state change in clear, factual language.
 */
export const getTradeAllocationImpact = (
  layerName: string,
  beforePct: number,
  afterPct: number,
  targetPct: number,
  movesTowardTarget: boolean
): string => {
  const direction = afterPct > beforePct ? 'increase' : 'decrease';
  let sentence = `Your ${layerName} allocation will ${direction} from ${beforePct}% to ${afterPct}%`;

  if (movesTowardTarget) {
    sentence += ` (closer to ${targetPct}% target).`;
  } else if (Math.abs(afterPct - targetPct) > Math.abs(beforePct - targetPct)) {
    sentence += ` (further from ${targetPct}% target).`;
  } else {
    sentence += `.`;
  }

  return sentence;
};

// =============================================================================
// REBALANCE MESSAGES (PCD-Compliant)
// =============================================================================

export const REBALANCE_NOT_NEEDED = 'Your portfolio is within target allocation ranges. No rebalancing is required.';

export const REBALANCE_DISABLED_REASON = 'Portfolio is within target ranges.';

export const REBALANCE_AVAILABLE = 'Portfolio rebalancing is available. This will adjust your allocation toward target.';

// =============================================================================
// PROTECTION MESSAGES (PCD-Compliant)
// =============================================================================

export const PROTECTION_EXPLANATION = 'Protection reduces downside exposure for the selected asset. Premium cost affects portfolio liquidity.';

export const PROTECTION_ACTIVE = 'This asset has active downside protection. Coverage continues until the expiry date.';

// =============================================================================
// LOAN MESSAGES (PCD-Compliant)
// =============================================================================

export const LOAN_COLLATERAL_LOCKED = 'This asset is locked as loan collateral. It cannot be traded until the loan is repaid.';

export const LOAN_HEALTH_WARNING = 'Loan health has decreased. Collateral value has moved closer to liquidation threshold.';

// =============================================================================
// TRANSACTION FEE EXPLANATION (PCD-Compliant)
// =============================================================================

export const getTransactionFeeExplanation = (spreadPct: number, assetName: string): string => {
  return `This ${spreadPct.toFixed(2)}% fee covers the bid-ask spread for ${assetName}.\n\n` +
    `• Foundation assets: 0.15% (lowest)\n` +
    `• Growth assets: 0.30%\n` +
    `• Upside assets: 0.60% (higher volatility)`;
};

// =============================================================================
// FORBIDDEN LANGUAGE CHECK (Development Aid)
// =============================================================================

const FORBIDDEN_WORDS = [
  // Urgency triggers
  'now', 'fast', 'last chance', "don't miss", 'act quickly', 'hurry',
  'immediately', 'urgent', 'limited time',
  // Performance claims
  'beat the market', 'maximize returns', 'outperform', 'winning',
  'guaranteed', 'profit', 'gains',
  // Emotional manipulation
  'fear', 'excitement', 'opportunity window', 'smart move',
  "don't lose", 'missing out',
  // Action imperatives (when not in user control)
  'you should', 'you must', 'you need to',
];

/**
 * Development helper: Check if text contains forbidden PCD language.
 * Use this when adding new messages.
 */
export const checkPCDCompliance = (text: string): { compliant: boolean; violations: string[] } => {
  const lowerText = text.toLowerCase();
  const violations = FORBIDDEN_WORDS.filter(word => lowerText.includes(word.toLowerCase()));
  return {
    compliant: violations.length === 0,
    violations,
  };
};

// =============================================================================
// EXPORTS
// =============================================================================

export const ALL_PORTFOLIO_MESSAGES: PortfolioMessage[] = [
  PORTFOLIO_STATE_HEALTHY,
  PORTFOLIO_STATE_INACTIVE,
  PORTFOLIO_EDUCATION_CONTEXT,
  PORTFOLIO_RISK_INCREASE_MARKET,
  PORTFOLIO_RISK_CONCENTRATION,
  PORTFOLIO_LIQUIDITY_REDUCTION,
  PORTFOLIO_OPTIONALITY_DECREASE,
  PORTFOLIO_NOTIFICATION_MARKET_SHIFT,
  PORTFOLIO_PATH_REDUCE_EXPOSURE,
  PORTFOLIO_PATH_ADD_PROTECTION,
  PORTFOLIO_PATH_INCREASE_EXPOSURE,
  PORTFOLIO_PATH_NO_CHANGE,
  PORTFOLIO_EXIT_TO_CASH,
  PORTFOLIO_PRECOMMIT_REBALANCE,
  PORTFOLIO_PRECOMMIT_ADD_ASSET,
  PORTFOLIO_CONSTRAINT_BLOCK_IRREVERSIBLE,
  PORTFOLIO_CONSTRAINT_LIQUIDITY_GUARD,
];
