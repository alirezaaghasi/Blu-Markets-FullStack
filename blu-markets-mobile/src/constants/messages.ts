/**
 * Blu Markets — Canonical Messages (PCD v2)
 *
 * SINGLE SOURCE OF TRUTH for ALL user-facing text in the app.
 * Based on Portfolio Communication Doctrine.
 *
 * Status: ENFORCEABLE
 *
 * Core Principle: "The system never talks about actions. It only talks about
 * portfolio states and paths between states."
 *
 * Rules:
 * - No urgency language (now, fast, act quickly)
 * - No performance claims (maximize, outperform)
 * - No emotional manipulation (fear, excitement, opportunity)
 * - No imperatives in warnings (you should, you must)
 * - User sovereignty: "You may..." not "You need to..."
 */

// =============================================================================
// TYPES
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

export type PortfolioStatus = 'BALANCED' | 'SLIGHTLY_OFF' | 'ATTENTION_REQUIRED';
export type Boundary = 'SAFE' | 'DRIFT' | 'STRUCTURAL' | 'STRESS';
export type Layer = 'FOUNDATION' | 'GROWTH' | 'UPSIDE';

// =============================================================================
// PORTFOLIO STATE MESSAGES (PCD v1)
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
  rules: ['Allowed during idle periods', 'Must not trigger notifications'],
};

export const PORTFOLIO_EDUCATION_CONTEXT: PortfolioMessage = {
  id: 'portfolio.education.context',
  type: 'StateDeclaration',
  text: `Portfolio risk, liquidity, and flexibility change over time.
Blu Markets evaluates these continuously to preserve future choice.`,
  variables: [],
  rules: ['Educational only', 'Must not precede decisions directly'],
};

// =============================================================================
// HOME SCREEN STATUS MESSAGES
// =============================================================================

export const STATUS_MESSAGES: Record<PortfolioStatus, { message: string; color: string }> = {
  BALANCED: {
    message: 'Your portfolio is within target allocation ranges. No action is required.',
    color: '#4ade80',
  },
  SLIGHTLY_OFF: {
    message: 'Your portfolio has drifted from target allocation. You may review when ready.',
    color: '#fde047',
  },
  ATTENTION_REQUIRED: {
    message: 'Your portfolio allocation has shifted significantly. Review is available.',
    color: '#f87171',
  },
};

// Alias for backwards compatibility
export const PORTFOLIO_STATUS_MESSAGES = STATUS_MESSAGES;

// =============================================================================
// TRADE FLOW MESSAGES
// =============================================================================

export const TRADE = {
  // Preview section
  preview: {
    title: 'Trade Preview',
    receiveLabel: 'You will receive',
    feeLabel: 'Transaction Fee',
    allocationImpact: 'Portfolio Impact',
  },

  // Fee explanation (shown on info icon tap)
  getFeeExplanation: (percentage: number, assetName: string): string =>
    `This ${percentage.toFixed(2)}% fee covers the bid-ask spread for ${assetName}.\n\n` +
    `• Foundation assets: 0.15% (lowest)\n` +
    `• Growth assets: 0.30%\n` +
    `• Upside assets: 0.60% (higher volatility)`,

  // Allocation impact sentence generator
  getAllocationSentence: (
    direction: 'increase' | 'decrease',
    layerName: string,
    beforePct: number,
    afterPct: number,
    targetPct: number,
    towardTarget: boolean
  ): string => {
    const base = `Your ${layerName} allocation will ${direction} from ${beforePct}% to ${afterPct}%`;
    if (towardTarget) {
      return `${base} (closer to ${targetPct}% target).`;
    }
    return `${base} (further from ${targetPct}% target).`;
  },

  // Boundary explanations (state-focused, not quality judgments)
  boundary: {
    SAFE: 'Portfolio remains within healthy allocation ranges.',
    DRIFT: 'Portfolio will drift slightly from target allocation.',
    STRUCTURAL: 'Portfolio will move significantly from target allocation.',
    STRESS: 'Portfolio will move far from target. Downside exposure increases.',
    towardTarget: 'This trade improves portfolio alignment with your target.',
  } as Record<string, string>,

  // Friction copy (warnings without urgency)
  friction: {
    SAFE: [] as string[],
    DRIFT: [
      'This trade creates minor drift from your target allocation.',
      'Portfolio balance can be restored through future adjustments.',
    ],
    STRUCTURAL: [
      'This trade creates significant drift from your target allocation.',
      'Your portfolio risk profile will change.',
    ],
    STRESS: [
      'This trade creates major drift from your target allocation.',
      'Downside exposure will increase beyond your stated boundaries.',
      'Recovery to target may require substantial future changes.',
    ],
  } as Record<Boundary, string[]>,

  // Confirm modal
  confirm: {
    title: 'Confirm Trade',
    towardTarget: 'Moves toward target',
    buttonBuy: 'Confirm Buy',
    buttonSell: 'Confirm Sell',
  },

  // Boundary labels for confirm modal (state-focused)
  boundaryLabels: {
    SAFE: 'Within Target Range',
    DRIFT: 'Portfolio Drift',
    STRUCTURAL: 'Allocation Shift',
    STRESS: 'High Exposure Change',
  } as Record<Boundary, string>,

  // Success
  success: {
    title: 'Trade Complete',
    newBalances: 'New Balances',
    cash: 'Cash',
    holding: 'Holding',
  },

  // Error
  error: {
    title: 'Trade Not Completed',
    message: 'The trade could not be executed. Your balances remain unchanged.',
    steps: 'You may try:\n• Check your internet connection\n• Verify sufficient balance\n• Wait a moment and retry',
  },

  // Empty states
  empty: {
    noAssets: 'No assets available to sell.',
  },

  // Buttons
  buttons: {
    review: 'Review Trade',
    cancel: 'Cancel',
    done: 'Done',
    tryAgain: 'Try Again',
    close: 'Close',
  },
};

// =============================================================================
// LOAN FLOW MESSAGES
// =============================================================================

export const LOAN = {
  // Sheet titles
  sheet: {
    title: 'New Loan',
    titleBorrow: 'Borrow IRR',
  },

  // Steps
  steps: {
    collateral: 'Step 1: Choose Collateral',
    collateralHelper: 'Select an asset to use as security for your loan.',
    amount: 'Step 2: Borrow Amount (IRR)',
    duration: 'Step 3: Loan Duration',
  },

  // Summary
  summary: {
    title: 'Loan Summary',
    totalRepay: 'Total to Repay',
    payments: (count: number) => `${count} Monthly Payments`,
    interestRate: 'Interest Rate',
    monthlyPayment: 'Monthly Payment',
  },

  // Pre-commitment warning
  warning: {
    collateral: (assetName: string) =>
      `Your ${assetName} will be locked as collateral. If its value drops significantly, it may be liquidated to cover the loan.`,
  },

  // Button states (explains why button is disabled)
  buttonStates: {
    selectAsset: 'Select an asset above',
    enterAmount: 'Enter borrow amount',
    fixErrors: 'Review details above',
    confirm: 'Confirm Loan',
    processing: 'Processing...',
  },

  // Capacity labels
  capacity: {
    available: 'Available to Borrow',
    maximum: 'Maximum',
    remaining: 'Remaining',
  },

  // Active loans screen
  active: {
    title: 'Active Loans',
    principal: 'Principal',
    interestRate: 'Interest Rate',
    dueDate: 'Due Date',
    remaining: 'Remaining',
    frozenBadge: 'LOCKED',
    repaidBadge: 'REPAID',
    installmentProgress: 'Installment Progress',
    nextPayment: 'Next Payment',
  },

  // Repayment
  repay: {
    title: 'Repay Loan',
    outstanding: 'Outstanding',
    minimum: 'Minimum Payment',
    custom: 'Custom Amount',
    full: 'Full Settlement',
    availableCash: 'Available Cash',
    nextInstallment: 'Next installment',
  },

  // Empty state
  empty: {
    title: 'No Active Loans',
    description:
      'You can borrow against your crypto holdings without selling them. Collateral remains yours and unlocks after repayment.',
  },

  // Education section
  education: {
    title: 'How Crypto-Backed Loans Work',
    step1: {
      title: 'Choose Collateral',
      description: 'Select an asset to lock as security. It remains yours but cannot be traded until repaid.',
    },
    step2: {
      title: 'Receive IRR',
      description: 'Funds are added to your cash balance instantly.',
    },
    step3: {
      title: 'Repay & Unlock',
      description: 'Pay back over time. Your collateral unlocks when fully repaid.',
    },
  },

  // Benefits (path presentation, not advice)
  benefits: {
    title: 'Benefits',
    exposure: 'Maintain your crypto exposure',
    noCredit: 'No credit check required',
    rates: 'Fixed interest rates', // Changed from "Competitive" - no comparative claims
    flexible: 'Flexible repayment schedule',
  },

  // Success
  success: {
    title: 'Loan Created',
    subtitle: 'Funds added to your cash balance',
  },

  // Error
  error: {
    title: 'Loan Not Created',
    message: 'The loan could not be created. No funds have been transferred.',
  },

  // Collateral locked message
  collateralLocked: 'This asset is locked as loan collateral. It cannot be traded until the loan is repaid.',
  healthWarning: 'Loan health has decreased. Collateral value has moved closer to liquidation threshold.',
};

// =============================================================================
// PROTECTION FLOW MESSAGES
// =============================================================================

export const PROTECTION = {
  // Sheet titles
  sheet: {
    title: 'Protect Assets', // Changed from "Insure Assets"
    selectTitle: 'Select Asset to Protect',
  },

  // Configuration labels
  config: {
    value: 'Value to Protect',
    duration: 'Coverage Duration',
    coverage: 'Coverage Amount',
    strikePrice: 'Protected Price',
  },

  // Quote section
  quote: {
    loading: 'Calculating protection cost...',
    totalCost: 'Total Protection Cost',
    availableCash: 'Available Cash',
    premium: 'Premium',
  },

  // Active protections
  active: {
    title: 'Active Protections',
    protectedValue: 'Protected Value',
    expires: 'Expires',
    premiumPaid: 'Premium Paid',
    coverage: 'Coverage',
  },

  // Education
  education: {
    title: 'How Protection Works',
    description:
      'Protection locks in a minimum value for your asset. If the market price falls below this level, you receive the difference. Your upside remains unlimited.',
    pricingTitle: 'Premium Pricing',
    pricingDetail:
      'Protection cost depends on duration, coverage level, and current market volatility. Higher coverage and longer duration increase the premium.',
  },

  // Empty states
  empty: {
    noProtections: 'No Active Protections',
    noAssets: 'No Assets to Protect',
    noAssetsDescription: 'Add crypto holdings to your portfolio to enable protection.',
    description:
      'Protection can limit downside risk while preserving upside potential. A premium is paid upfront for this coverage.',
  },

  // Buttons
  buttons: {
    protect: 'Protect',
    cancel: 'Cancel Protection',
    back: 'Back',
    confirm: 'Confirm Protection',
  },

  // Success
  success: {
    title: 'Protection Active',
    message: 'Your asset is now protected.',
  },

  // Error
  error: {
    title: 'Protection Not Activated',
    message: 'Protection could not be activated. No premium has been charged.',
    selectAsset: 'Select an asset to protect.',
    quoteRequired: 'Unable to get protection quote.',
    insufficientFunds: 'Insufficient funds for premium.',
  },

  // Explanation text
  explanation: 'Protection reduces downside exposure for the selected asset. Premium cost affects portfolio liquidity.',
  activeExplanation: 'This asset has active downside protection. Coverage continues until the expiry date.',
};

// =============================================================================
// REBALANCE MESSAGES
// =============================================================================

export const REBALANCE = {
  title: 'Rebalance Portfolio',
  calculating: 'Calculating rebalance...',
  notNeeded: 'Your portfolio is within target allocation ranges. No rebalancing is required.',
  allocation: 'Allocation',
  mode: 'Rebalance Mode',
  disabledReason: 'Portfolio is within target ranges.',
  available: 'Portfolio rebalancing is available. This will adjust your allocation toward target.',

  // Mode options
  modes: {
    holdingsOnly: 'Holdings Only',
    holdingsOnlyDesc: 'Rebalance by trading between existing assets',
    deployCash: 'Deploy Cash',
    deployCashDesc: 'Use available cash to balance portfolio',
  },

  // Pre-commitment
  preCommit: 'If you proceed, your portfolio balance will change. Risk and exposure levels will adjust accordingly.',

  // Results
  results: {
    tradesExecuted: 'Trades Executed',
    residualDrift: 'Residual Drift',
  },

  // Success
  success: {
    title: 'Rebalance Complete',
    message: 'Your portfolio has been rebalanced.',
  },

  // Error
  error: {
    title: 'Rebalance Not Completed',
    message: 'Unable to rebalance. Your portfolio remains unchanged.',
  },
};

// Backwards compatibility exports
export const REBALANCE_NOT_NEEDED = REBALANCE.notNeeded;
export const REBALANCE_DISABLED_REASON = REBALANCE.disabledReason;
export const REBALANCE_AVAILABLE = REBALANCE.available;

// =============================================================================
// HOME & NAVIGATION MESSAGES
// =============================================================================

export const HOME = {
  value: {
    irr: 'IRR',
    assets: 'Assets',
    cash: 'Cash',
    totalValue: 'Total Value',
  },
  activity: {
    title: 'Activity Log',
    empty: 'No activity recorded yet.',
    emptySub: 'Your portfolio changes will appear here.',
    seeAll: 'See All',
  },
  buttons: {
    rebalance: 'Rebalance',
    addFunds: 'Add Funds',
    trade: 'Trade',
    borrow: 'Borrow',
    protect: 'Protect',
  },
  portfolioLink: 'View Portfolio',
};

export const NAV = {
  home: 'Home',
  portfolio: 'Portfolio',
  services: 'Services',
  profile: 'Profile',
};

export const PORTFOLIO = {
  title: 'Portfolio',
  totalValue: 'Total Value',
  allocation: 'Allocation',
  holdings: 'Holdings',
  empty: {
    title: 'No Holdings',
    description: 'You can add funds and trade to build your portfolio.',
  },
  layerEmpty: 'No holdings in this layer',
};

// =============================================================================
// ONBOARDING MESSAGES
// =============================================================================

export const ONBOARDING = {
  welcome: {
    title: 'Blu Markets',
    subtitle: 'Markets, but mindful',
    cta: 'Get Started',
    demo: 'Try Demo',
  },
  phone: {
    title: 'Enter your phone number',
    placeholder: '09123456789',
    error: 'Please enter a valid Iranian phone number (e.g., 09123456789)',
    cta: 'Send OTP',
  },
  otp: {
    title: 'Enter verification code',
    subtitle: 'We sent a code to your phone',
    resend: 'Resend code',
    verify: 'Verify',
    error: 'Verification was not successful. You may try again.',
  },
  consent: {
    title: 'Before you continue',
    acknowledge: 'I understand',
  },
  funding: {
    title: 'Fund your portfolio',
    subtitle: 'Enter the amount you wish to invest',
  },
  questionnaire: {
    processing: 'Analyzing your answers...',
    title: 'Risk Assessment',
  },
  result: {
    layersTitle: 'Understanding the Layers',
    foundation: 'Foundation — Stable assets with lower volatility',
    growth: 'Growth — Moderate risk with growth potential',
    upside: 'Upside — Higher risk, higher potential reward',
    allocationTitle: 'Your Suggested Allocation',
    prioritizes: 'What This Prioritizes',
    tradeoffs: 'What This Trades Off',
    cta: 'Continue', // Changed from "Let's go!"
  },
  success: {
    title: 'Setup Complete', // Changed from "You're all set!"
    invested: 'Total Invested',
    cta: 'View Portfolio',
  },
};

// =============================================================================
// ERROR & SUCCESS MESSAGES (Generic)
// =============================================================================

export const ERRORS = {
  generic: {
    title: 'Something went wrong', // Changed from "Error"
    message: 'The request could not be completed. You may try again.',
  },
  network: {
    title: 'Connection Issue',
    message: 'Unable to connect. Check your internet connection and try again when ready.',
  },
  auth: {
    title: 'Authentication Issue',
    message: 'Unable to verify your identity. You may try again.',
    sessionExpired: 'Your session has expired. Please log in again.',
  },
  validation: {
    required: 'This field is required.',
    invalidAmount: 'Please enter a valid amount.',
    insufficientFunds: 'Insufficient funds.',
    minimumAmount: (min: string) => `Minimum amount is ${min}.`,
    maximumAmount: (max: string) => `Maximum amount is ${max}.`,
  },
};

export const SUCCESS = {
  generic: {
    title: 'Complete',
  },
  funds: {
    title: 'Funds Added',
    message: 'Your cash balance has been updated.',
  },
  repayment: {
    title: 'Payment Complete',
    message: 'Your loan balance has been updated.',
  },
};

// =============================================================================
// ALERTS (All Alert.alert messages - PCD compliant)
// =============================================================================

export const ALERTS = {
  // Trade alerts
  trade: {
    previewLoading: {
      title: 'Please Wait',
      message: 'Loading trade preview...',
    },
    previewError: {
      title: 'Preview Not Ready',
      message: 'Unable to get trade preview. You may try again.',
    },
    invalidAmount: {
      title: 'Invalid Amount',
      message: 'Trade quantity is below minimum. A larger amount is required.',
    },
    executionError: {
      title: 'Trade Not Completed',
      message: 'The trade could not be executed. Your balances remain unchanged.',
    },
  },

  // Funds alerts
  funds: {
    addError: {
      title: 'Something went wrong',
      message: 'Funds could not be added. You may try again.',
    },
  },

  // Loan alerts
  loan: {
    createError: {
      title: 'Loan Not Created',
      message: 'Loan could not be created. You may try again.',
    },
    repayError: {
      title: 'Repayment Issue',
      message: 'Repayment could not be processed. You may try again.',
    },
  },

  // Rebalance alerts
  rebalance: {
    error: {
      title: 'Rebalance Not Completed',
      message: 'Rebalance could not be completed. You may try again.',
    },
  },

  // Profile alerts
  profile: {
    biometricEnableError: {
      title: 'Something went wrong',
      message: 'Biometric authentication could not be enabled.',
    },
    biometricDisableError: {
      title: 'Something went wrong',
      message: 'Biometric authentication could not be disabled.',
    },
    updateError: {
      title: 'Something went wrong',
      message: 'Profile could not be updated. You may try again.',
    },
    calculateError: {
      title: 'Something went wrong',
      message: 'Profile could not be calculated. You may try again.',
    },
  },

  // OTP/Auth alerts
  auth: {
    otpSendError: {
      title: 'Something went wrong',
      message: 'Code could not be sent. You may try again.',
    },
    verifyError: {
      title: 'Verification Issue',
      message: 'Verification was not successful. You may try again.',
    },
  },
};

// =============================================================================
// TRADE ERROR MODAL (PCD compliant - no imperatives)
// =============================================================================

export const TRADE_ERROR = {
  title: 'Trade Not Completed',
  tipsTitle: 'You may try:',
  tips: [
    'Checking your internet connection',
    'Verifying sufficient balance',
    'Waiting a moment and retrying',
  ],
};

// =============================================================================
// ACTIVITY FEED
// =============================================================================

export const ACTIVITY = {
  emptyTitle: 'No activity yet',
  emptySubtitle: 'Your portfolio changes will appear here.',
  seeAll: 'See All',
};

// =============================================================================
// HOLDING CARD
// =============================================================================

export const HOLDING = {
  frozenBadge: 'Locked', // Changed from "FROZEN"
};

// =============================================================================
// COMMON UI LABELS
// =============================================================================

export const LABELS = {
  amount: 'Amount',
  price: 'Price',
  fee: 'Fee',
  total: 'Total',
  current: 'Current',
  target: 'Target',
  before: 'Before',
  after: 'After',
  foundation: 'Foundation',
  growth: 'Growth',
  upside: 'Upside',
  buy: 'Buy',
  sell: 'Sell',
  loading: 'Loading...',
  available: 'Available',
  maximum: 'Maximum',
  minimum: 'Minimum',
  balance: 'Balance',
  quantity: 'Quantity',
  value: 'Value',
  date: 'Date',
  status: 'Status',
};

export const BUTTONS = {
  cancel: 'Cancel',
  confirm: 'Confirm',
  done: 'Done',
  continue: 'Continue',
  retry: 'Retry',
  close: 'Close',
  back: 'Back',
  tryAgain: 'Try Again',
  submit: 'Submit',
  save: 'Save',
  edit: 'Edit',
  delete: 'Delete',
  viewDetails: 'View Details',
  seeAll: 'See All',
};

// =============================================================================
// LAYER NAMES
// =============================================================================

export const LAYER_NAMES: Record<Layer, string> = {
  FOUNDATION: 'Foundation',
  GROWTH: 'Growth',
  UPSIDE: 'Upside',
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get friction copy for trade based on boundary.
 * Returns PCD-compliant warning messages.
 */
export const getTradeFrictionCopy = (boundary: Boundary, movesTowardTarget: boolean): string[] => {
  if (movesTowardTarget) {
    return ['This trade moves your portfolio closer to target allocation.'];
  }
  return TRADE.friction[boundary] || [];
};

/**
 * Get boundary explanation text.
 */
export const getBoundaryExplanation = (boundary: Boundary, movesTowardTarget?: boolean): string => {
  if (movesTowardTarget) {
    return TRADE.boundary.towardTarget;
  }
  return TRADE.boundary[boundary] || '';
};

/**
 * Generate allocation impact sentence.
 */
export const getTradeAllocationImpact = (
  layerName: string,
  beforePct: number,
  afterPct: number,
  targetPct: number,
  movesTowardTarget: boolean
): string => {
  const direction = afterPct > beforePct ? 'increase' : 'decrease';
  return TRADE.getAllocationSentence(direction, layerName, beforePct, afterPct, targetPct, movesTowardTarget);
};

/**
 * Get transaction fee explanation.
 */
export const getTransactionFeeExplanation = (spreadPct: number, assetName: string): string => {
  return TRADE.getFeeExplanation(spreadPct, assetName);
};

// =============================================================================
// PCD COMPLIANCE CHECKER (Development Aid)
// =============================================================================

const FORBIDDEN_WORDS = [
  // Urgency triggers
  'now',
  'fast',
  'last chance',
  "don't miss",
  'act quickly',
  'hurry',
  'immediately',
  'urgent',
  'limited time',
  // Performance claims
  'beat the market',
  'maximize returns',
  'outperform',
  'winning',
  'guaranteed',
  'profit',
  'gains',
  // Emotional manipulation
  'fear',
  'excitement',
  'opportunity window',
  'smart move',
  "don't lose",
  'missing out',
  // Action imperatives (when not in user control)
  'you should',
  'you must',
  'you need to',
];

/**
 * Development helper: Check if text contains forbidden PCD language.
 * Use this when adding new messages.
 */
export const checkPCDCompliance = (text: string): { compliant: boolean; violations: string[] } => {
  const lowerText = text.toLowerCase();
  const violations = FORBIDDEN_WORDS.filter((word) => lowerText.includes(word.toLowerCase()));
  return {
    compliant: violations.length === 0,
    violations,
  };
};

// =============================================================================
// LEGACY EXPORTS (for backwards compatibility with v1)
// =============================================================================

export const PORTFOLIO_RISK_INCREASE_MARKET: PortfolioMessage = {
  id: 'portfolio.risk.increase.market',
  type: 'DegradationWarning',
  text: `Market movement has increased your portfolio risk.
This raises potential drawdowns without changing expected upside.
You may review options or keep the portfolio unchanged.`,
  variables: ['risk_delta_percent'],
  rules: ['Must be triggered only by portfolio-level evaluation', 'No urgency language', 'No action verbs'],
};

export const PORTFOLIO_PRECOMMIT_REBALANCE: PortfolioMessage = {
  id: 'portfolio.precommit.rebalance',
  type: 'PreCommitmentPreview',
  text: `If you proceed, your portfolio balance will change.
Risk and exposure levels will adjust accordingly.
Some positions may not be immediately reversible.`,
  variables: ['max_drawdown', 'lockup_days'],
  rules: ['Mandatory before execution', 'Must show before/after comparison in UI'],
};

export const ALL_PORTFOLIO_MESSAGES: PortfolioMessage[] = [
  PORTFOLIO_STATE_HEALTHY,
  PORTFOLIO_STATE_INACTIVE,
  PORTFOLIO_EDUCATION_CONTEXT,
  PORTFOLIO_RISK_INCREASE_MARKET,
  PORTFOLIO_PRECOMMIT_REBALANCE,
];

// Protection legacy exports
export const PROTECTION_EXPLANATION = PROTECTION.explanation;
export const PROTECTION_ACTIVE = PROTECTION.activeExplanation;

// Loan legacy exports
export const LOAN_COLLATERAL_LOCKED = LOAN.collateralLocked;
export const LOAN_HEALTH_WARNING = LOAN.healthWarning;
