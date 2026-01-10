// Decision Boundary Layer
// Classifies actions into: SAFE, DRIFT, STRUCTURAL, STRESS

import { getCurrentAllocation, getCashBalance, ASSET_LAYERS } from './engine.js';

export const BOUNDARY_LEVELS = {
  SAFE: 'SAFE',           // No impact on portfolio structure
  DRIFT: 'DRIFT',         // Minor deviation (within tolerance)
  STRUCTURAL: 'STRUCTURAL', // Significant deviation (requires friction)
  STRESS: 'STRESS',       // Crisis-level action (maximum friction)
};

const DRIFT_THRESHOLD = 3;       // % deviation before DRIFT
const STRUCTURAL_THRESHOLD = 8;  // % deviation before STRUCTURAL
const STRESS_THRESHOLD = 15;     // % deviation before STRESS

export function classifyAction(portfolio, action, stressMode = false) {
  // Returns { level, reason, preview }
  // In stress mode, all non-SAFE actions are escalated one level
  if (!portfolio) return { level: BOUNDARY_LEVELS.SAFE, reason: 'No portfolio', preview: null };

  let result;
  switch (action.type) {
    case 'BUY':
      result = classifyBuy(portfolio, action.asset, action.amountIRR);
      break;
    case 'SELL':
      result = classifySell(portfolio, action.asset, action.amountIRR);
      break;
    case 'ADD_FUNDS':
      result = classifyAddFunds(portfolio, action.amountIRR);
      break;
    case 'REBALANCE':
      result = classifyRebalance(portfolio);
      break;
    default:
      return { level: BOUNDARY_LEVELS.SAFE, reason: 'Unknown action', preview: null };
  }

  // Stress mode escalation
  if (stressMode && result.level !== BOUNDARY_LEVELS.SAFE) {
    const escalation = {
      [BOUNDARY_LEVELS.DRIFT]: BOUNDARY_LEVELS.STRUCTURAL,
      [BOUNDARY_LEVELS.STRUCTURAL]: BOUNDARY_LEVELS.STRESS,
      [BOUNDARY_LEVELS.STRESS]: BOUNDARY_LEVELS.STRESS,
    };
    result = {
      ...result,
      level: escalation[result.level] || result.level,
      reason: `[STRESS MODE] ${result.reason}`,
    };
  } else if (stressMode && result.level === BOUNDARY_LEVELS.SAFE) {
    // In stress mode, even SAFE actions get a warning
    result = {
      ...result,
      level: BOUNDARY_LEVELS.DRIFT,
      reason: `[STRESS MODE] Under normal conditions this would be safe. Review carefully.`,
    };
  }

  return result;
}

function classifyBuy(portfolio, asset, amountIRR) {
  const amt = Math.floor(amountIRR);
  const cash = getCashBalance(portfolio);
  const total = portfolio.totalIRR;

  // Can't buy without cash
  if (amt > cash) {
    return {
      level: BOUNDARY_LEVELS.STRUCTURAL,
      reason: `Insufficient cash. Available: ${cash.toLocaleString('en-US')} IRR`,
      preview: null,
    };
  }

  // Calculate projected allocation after buy
  const layer = ASSET_LAYERS[asset];
  const currentAlloc = getCurrentAllocation(portfolio);
  const targetAlloc = portfolio.layers;

  // Simulate the buy
  const newLayerAmount = getLayerAmount(portfolio, layer) + amt;
  const newLayerPct = Math.round((newLayerAmount / total) * 100);
  const targetPct = targetAlloc[layer];
  const deviation = Math.abs(newLayerPct - targetPct);

  const preview = {
    asset,
    amountIRR: amt,
    layer,
    currentPct: currentAlloc[layer],
    projectedPct: newLayerPct,
    targetPct,
    deviation,
  };

  if (deviation >= STRESS_THRESHOLD) {
    return {
      level: BOUNDARY_LEVELS.STRESS,
      reason: `This buy would push ${layer} to ${newLayerPct}% (${deviation}% off target). Consider rebalancing.`,
      preview,
    };
  }

  if (deviation >= STRUCTURAL_THRESHOLD) {
    return {
      level: BOUNDARY_LEVELS.STRUCTURAL,
      reason: `This buy creates significant drift in ${layer} (${deviation}% off target).`,
      preview,
    };
  }

  if (deviation >= DRIFT_THRESHOLD) {
    return {
      level: BOUNDARY_LEVELS.DRIFT,
      reason: `Minor drift in ${layer} allocation (${deviation}% off target).`,
      preview,
    };
  }

  return {
    level: BOUNDARY_LEVELS.SAFE,
    reason: 'Within target allocation.',
    preview,
  };
}

function classifySell(portfolio, asset, amountIRR) {
  const amt = Math.floor(amountIRR);
  const holding = portfolio.holdings.find(h => h.asset === asset);
  const total = portfolio.totalIRR;

  if (!holding || holding.amountIRR < amt) {
    return {
      level: BOUNDARY_LEVELS.STRUCTURAL,
      reason: `Insufficient holdings. You own: ${(holding?.amountIRR || 0).toLocaleString('en-US')} IRR`,
      preview: null,
    };
  }

  const layer = ASSET_LAYERS[asset];
  const currentAlloc = getCurrentAllocation(portfolio);
  const targetAlloc = portfolio.layers;

  // Simulate the sell (asset decreases, cash increases - both in foundation)
  const newLayerAmount = getLayerAmount(portfolio, layer) - amt;
  // Cash is in foundation, so if selling from foundation, net change is 0
  // If selling from growth/upside, foundation increases
  let newFoundationAmount = getLayerAmount(portfolio, 'foundation');
  if (layer !== 'foundation') {
    newFoundationAmount += amt; // Proceeds go to cash (foundation)
  }

  const newLayerPct = Math.round((newLayerAmount / total) * 100);
  const newFoundationPct = Math.round((newFoundationAmount / total) * 100);
  const targetPct = targetAlloc[layer];
  const targetFoundationPct = targetAlloc.foundation;

  const layerDeviation = Math.abs(newLayerPct - targetPct);
  const foundationDeviation = Math.abs(newFoundationPct - targetFoundationPct);
  const maxDeviation = Math.max(layerDeviation, foundationDeviation);

  const preview = {
    asset,
    amountIRR: amt,
    layer,
    currentPct: currentAlloc[layer],
    projectedPct: newLayerPct,
    targetPct,
    deviation: layerDeviation,
    foundationDeviation,
  };

  if (maxDeviation >= STRESS_THRESHOLD) {
    return {
      level: BOUNDARY_LEVELS.STRESS,
      reason: `This sell would significantly disrupt your allocation (${maxDeviation}% drift). Consider if this is necessary.`,
      preview,
    };
  }

  if (maxDeviation >= STRUCTURAL_THRESHOLD) {
    return {
      level: BOUNDARY_LEVELS.STRUCTURAL,
      reason: `This sell creates significant drift (${maxDeviation}% off target).`,
      preview,
    };
  }

  if (maxDeviation >= DRIFT_THRESHOLD) {
    return {
      level: BOUNDARY_LEVELS.DRIFT,
      reason: `Minor drift from target allocation.`,
      preview,
    };
  }

  return {
    level: BOUNDARY_LEVELS.SAFE,
    reason: 'Within target allocation.',
    preview,
  };
}

function classifyAddFunds(portfolio, amountIRR) {
  const amt = Math.floor(amountIRR);
  const total = portfolio.totalIRR;
  const pctIncrease = Math.round((amt / total) * 100);

  // Adding funds to cash is generally safe, but large deposits might warrant attention
  if (pctIncrease > 50) {
    return {
      level: BOUNDARY_LEVELS.DRIFT,
      reason: `Large deposit (${pctIncrease}% of current portfolio). Consider deploying to maintain allocation.`,
      preview: { amountIRR: amt, pctIncrease },
    };
  }

  return {
    level: BOUNDARY_LEVELS.SAFE,
    reason: 'Funds will be added to cash wallet.',
    preview: { amountIRR: amt, pctIncrease },
  };
}

function classifyRebalance(portfolio) {
  const currentAlloc = getCurrentAllocation(portfolio);
  const targetAlloc = portfolio.layers;

  const foundationDrift = Math.abs(currentAlloc.foundation - targetAlloc.foundation);
  const growthDrift = Math.abs(currentAlloc.growth - targetAlloc.growth);
  const upsideDrift = Math.abs(currentAlloc.upside - targetAlloc.upside);
  const maxDrift = Math.max(foundationDrift, growthDrift, upsideDrift);

  const preview = {
    currentAlloc,
    targetAlloc,
    drifts: {
      foundation: foundationDrift,
      growth: growthDrift,
      upside: upsideDrift,
    },
  };

  if (maxDrift < DRIFT_THRESHOLD) {
    return {
      level: BOUNDARY_LEVELS.SAFE,
      reason: 'Portfolio is already near target allocation.',
      preview,
    };
  }

  if (maxDrift >= STRESS_THRESHOLD) {
    return {
      level: BOUNDARY_LEVELS.DRIFT,
      reason: `Rebalance recommended. Current drift: ${maxDrift}%.`,
      preview,
    };
  }

  return {
    level: BOUNDARY_LEVELS.SAFE,
    reason: `Rebalance will restore target allocation.`,
    preview,
  };
}

function getLayerAmount(portfolio, layer) {
  return portfolio.holdings
    .filter(h => h.layer === layer)
    .reduce((sum, h) => sum + h.amountIRR, 0);
}

// Friction messages by level
export function getFrictionMessage(level) {
  switch (level) {
    case BOUNDARY_LEVELS.STRESS:
      return {
        title: 'High Impact Action',
        message: 'This action significantly affects your portfolio structure. Please confirm you understand the impact.',
        confirmText: 'I understand, proceed',
        color: '#ff6b6b',
      };
    case BOUNDARY_LEVELS.STRUCTURAL:
      return {
        title: 'Structural Change',
        message: 'This action will move your portfolio away from its target allocation.',
        confirmText: 'Proceed anyway',
        color: '#ffd93d',
      };
    case BOUNDARY_LEVELS.DRIFT:
      return {
        title: 'Minor Drift',
        message: 'This action creates minor drift from your target. You can rebalance later.',
        confirmText: 'Continue',
        color: '#4f7cff',
      };
    default:
      return null;
  }
}
