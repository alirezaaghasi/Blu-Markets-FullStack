// @ts-check
/** @typedef {import('../types').Loan} Loan */

/**
 * @typedef {Object} LoanSummary
 * @property {Loan[]} loanList - List of loans
 * @property {number} totalLoanAmount - Total borrowed amount
 * @property {number} criticalRatio - Highest ratio of amount to liquidation threshold
 */

/**
 * Compute loan summary in a single pass
 * @param {Loan[]} loans
 * @returns {LoanSummary}
 */
export function selectLoanSummary(loans) {
  const list = loans || [];
  let total = 0;
  let maxRatio = 0;

  for (const loan of list) {
    total += loan.amountIRR;
    const ratio = loan.amountIRR / loan.liquidationIRR;
    if (ratio > maxRatio) maxRatio = ratio;
  }

  return {
    loanList: list,
    totalLoanAmount: total,
    criticalRatio: maxRatio,
  };
}

/**
 * Get loan by ID
 * @param {Loan[]} loans
 * @param {string} loanId
 * @returns {Loan | undefined}
 */
export function selectLoanById(loans, loanId) {
  return (loans || []).find(l => l.id === loanId);
}

/**
 * Get loan health level based on usage percentage
 * @param {number} usedPercent - Percentage of limit used (0-100+)
 * @returns {{ level: 'critical' | 'warning' | 'caution' | 'healthy', color: string }}
 */
export function selectLoanHealth(usedPercent) {
  const color = '#3B82F6';
  if (usedPercent >= 75) return { level: 'critical', color };
  if (usedPercent >= 65) return { level: 'warning', color };
  if (usedPercent >= 50) return { level: 'caution', color };
  return { level: 'healthy', color };
}
