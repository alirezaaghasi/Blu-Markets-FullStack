// @ts-check
/**
 * Selectors - Reusable pure functions for deriving data from state
 *
 * These selectors extract duplicated useMemo patterns from components
 * into reusable, testable functions.
 *
 * Usage in components:
 * ```javascript
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

// Loan selectors
export {
  selectLoanSummary,
  selectLoanById,
  selectLoanHealth,
} from './loanSelectors';

// Portfolio selectors
export {
  selectDrift,
  selectIsLayerOnTarget,
  selectPortfolioMetrics,
} from './portfolioSelectors';

// Protection selectors
export {
  selectActiveProtections,
  selectProtectionDaysMap,
  selectHasActiveProtection,
  selectAssetProtection,
} from './protectionSelectors';
