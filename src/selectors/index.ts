/**
 * Selectors - Reusable pure functions for deriving data from state
 *
 * These selectors extract duplicated useMemo patterns from components
 * into reusable, testable functions.
 *
 * Usage in components:
 * ```typescript
 * const holdingsById = useMemo(
 *   () => selectHoldingsById(holdings),
 *   [holdings]
 * );
 * ```
 */

// Holding selectors
export {
  selectHoldingsById,
  selectHoldingsByLayer,
  selectAvailableCollateral,
  selectNonEmptyHoldings,
} from './holdingSelectors';
export type { HoldingWithValue, HoldingsByLayerResult } from './holdingSelectors';

// Loan selectors
export {
  selectLoanSummary,
  selectLoanById,
  selectLoanHealth,
} from './loanSelectors';
export type { LoanSummary, LoanHealth, LoanHealthLevel } from './loanSelectors';

// Portfolio selectors
export {
  selectDrift,
  selectIsLayerOnTarget,
  selectPortfolioMetrics,
} from './portfolioSelectors';
export type { DriftResult, PortfolioMetrics } from './portfolioSelectors';

// Protection selectors
export {
  selectActiveProtections,
  selectProtectionDaysMap,
  selectHasActiveProtection,
  selectAssetProtection,
} from './protectionSelectors';
export type { ActiveProtection, ProtectionPartition } from './protectionSelectors';
