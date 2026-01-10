// Protection System - Downside protection for portfolio
// Allows setting a floor value that triggers alerts/friction

export const PROTECTION_STATUS = {
  INACTIVE: 'INACTIVE',
  ACTIVE: 'ACTIVE',
  WARNING: 'WARNING',   // Portfolio near floor
  BREACHED: 'BREACHED', // Portfolio below floor
};

export function createProtection(portfolio, protectionPct = 80) {
  // Set floor at X% of current portfolio value
  const floorIRR = Math.floor((portfolio.totalIRR * protectionPct) / 100);
  return {
    enabled: true,
    floorIRR,
    protectionPct,
    createdAt: Date.now(),
  };
}

export function getProtectionStatus(portfolio, protection) {
  if (!protection || !protection.enabled) {
    return { status: PROTECTION_STATUS.INACTIVE, message: null };
  }

  const current = portfolio.totalIRR;
  const floor = protection.floorIRR;
  const pctAboveFloor = Math.round(((current - floor) / floor) * 100);

  if (current < floor) {
    return {
      status: PROTECTION_STATUS.BREACHED,
      message: `Portfolio has fallen ${Math.abs(pctAboveFloor)}% below your protected floor.`,
      current,
      floor,
      gap: floor - current,
    };
  }

  if (pctAboveFloor <= 5) {
    return {
      status: PROTECTION_STATUS.WARNING,
      message: `Portfolio is only ${pctAboveFloor}% above your protected floor. Trade carefully.`,
      current,
      floor,
      gap: current - floor,
    };
  }

  return {
    status: PROTECTION_STATUS.ACTIVE,
    message: `Protection active. ${pctAboveFloor}% above floor.`,
    current,
    floor,
    gap: current - floor,
  };
}

export function checkTradeAgainstProtection(portfolio, protection, tradeAmountIRR) {
  // Check if a sell trade would breach protection floor
  if (!protection || !protection.enabled) {
    return { allowed: true };
  }

  const afterTrade = portfolio.totalIRR - tradeAmountIRR;
  if (afterTrade < protection.floorIRR) {
    return {
      allowed: false,
      reason: `This trade would bring your portfolio below your protected floor of ${protection.floorIRR.toLocaleString('en-US')} IRR.`,
      afterTrade,
      floor: protection.floorIRR,
    };
  }

  return { allowed: true };
}
