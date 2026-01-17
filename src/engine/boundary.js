import { computePortfolioStatus } from "./portfolioStatus.js";

export function classifyActionBoundary({ kind, validation, before, after, stressMode }) {
  if (!validation.ok) return "SAFE";

  const beforeStatus = computePortfolioStatus(before.layerPct);
  const afterStatus = computePortfolioStatus(after.layerPct);

  const escalate = (b) => {
    if (!stressMode) return b;
    if (b === "SAFE") return "DRIFT";
    if (b === "DRIFT") return "STRUCTURAL";
    if (b === "STRUCTURAL") return "STRESS";
    return "STRESS";
  };

  // Rebalance can be "STRUCTURAL" if it fails to improve (e.g. constraints).
  if (kind === "REBALANCE") {
    const improved = afterStatus.issues.length < beforeStatus.issues.length;
    return escalate(improved ? "SAFE" : "STRUCTURAL");
  }

  if (kind === "ADD_FUNDS") return escalate("SAFE");

  if (kind === "REPAY") {
    if (afterStatus.status === "ATTENTION_REQUIRED") return escalate("STRUCTURAL");
    if (afterStatus.status === "SLIGHTLY_OFF") return escalate("DRIFT");
    return escalate("SAFE");
  }

  if (afterStatus.status === "ATTENTION_REQUIRED") return escalate("STRUCTURAL");
  if (afterStatus.status === "SLIGHTLY_OFF") return escalate("DRIFT");
  return escalate("SAFE");
}

/**
 * Returns friction copy based on boundary and action context.
 * Issue 15: Plain language constraint messages
 * Rebalance gets special messaging when constrained.
 */
export function frictionCopyForBoundary(boundary, kind = null, meta = {}) {
  // Rebalance-specific messaging when constrained
  if (kind === "REBALANCE" && boundary === "STRUCTURAL") {
    const messages = ["Your portfolio couldn't be fully rebalanced."];

    if (meta.hasLockedCollateral) {
      messages.push("Some assets are locked as collateral for your loans.");
    }
    if (meta.insufficientCash) {
      messages.push("Not enough cash to fully balance all layers.");
    }
    // Hide negligible drift (< 0.5% total), show for meaningful residual
    if (meta.residualDrift && meta.residualDrift >= 0.5) {
      // Use appropriate precision: 1 decimal for larger values, whole number for small
      const driftDisplay = meta.residualDrift >= 1
        ? `${Math.round(meta.residualDrift)}%`
        : `${meta.residualDrift.toFixed(1)}%`;
      messages.push(`Remaining drift: ${driftDisplay} from target.`);
    } else if (!meta.hasLockedCollateral && !meta.insufficientCash) {
      return ["Your portfolio is now on target."];
    }

    return messages;
  }

  // Default friction copy - plain language
  if (boundary === "SAFE") return [];
  if (boundary === "DRIFT") return ["This moves you slightly away from your target. You can rebalance later."];
  if (boundary === "STRUCTURAL") return ["This is a bigger move from your target. Please review before confirming."];
  return ["This is a significant change. Please confirm you understand the impact."];
}
