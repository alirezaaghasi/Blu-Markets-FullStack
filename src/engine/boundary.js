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

export function frictionCopyForBoundary(boundary) {
  if (boundary === "SAFE") return [];
  if (boundary === "DRIFT") return ["This moves you away from your target allocation. You can proceed or rebalance later."];
  if (boundary === "STRUCTURAL") return ["This crosses a structural boundary. You can proceed, but you must acknowledge it."];
  return ["Stress mode: you're making a high-pressure decision. Confirm only if you understand the consequences."];
}
