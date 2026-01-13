import { LAYER_RANGES } from "../state/domain.js";

export function computePortfolioStatus(layerPct) {
  const issues = [];

  if (layerPct.FOUNDATION < LAYER_RANGES.FOUNDATION.min) issues.push("FOUNDATION_BELOW_TARGET");
  if (layerPct.FOUNDATION > LAYER_RANGES.FOUNDATION.max) issues.push("FOUNDATION_ABOVE_TARGET");
  if (layerPct.UPSIDE > LAYER_RANGES.UPSIDE.max) issues.push("UPSIDE_ABOVE_TARGET");

  const hardIssues = [];
  if (layerPct.FOUNDATION < LAYER_RANGES.FOUNDATION.hardMin) hardIssues.push("FOUNDATION_BELOW_HARD_FLOOR");
  if (layerPct.UPSIDE > LAYER_RANGES.UPSIDE.hardMax) hardIssues.push("UPSIDE_ABOVE_HARD_CAP");

  if (hardIssues.length) return { status: "ATTENTION_REQUIRED", issues: [...issues, ...hardIssues] };
  if (issues.length) return { status: "SLIGHTLY_OFF", issues };
  return { status: "BALANCED", issues: [] };
}
