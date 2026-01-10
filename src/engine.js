// Assets allowed by spec (currency IRR only):
// USDT, IRR_FIXED_INCOME, GOLD, BTC, ETH, QQQ, SOL, TON
//
// Portfolio model:
// - portfolio.totalIRR = invested amount across holdings
// - cashIRR (tracked in stateMachine) is separate and is counted as Foundation exposure for layer % calculations.

const WEIGHTS = {
  foundation: { IRR_FIXED_INCOME: 0.55, USDT: 0.45 },
  growth: { GOLD: 0.20, BTC: 0.30, ETH: 0.20, QQQ: 0.30 },
  upside: { SOL: 0.55, TON: 0.45 },
};

export function buildPortfolio(totalIRR, layers) {
  const holdings = [];
  let allocated = 0;

  for (const layer of ['foundation', 'growth', 'upside']) {
    const pct = (layers[layer] ?? 0) / 100;
    const layerAmount = Math.floor(totalIRR * pct);

    const weights = WEIGHTS[layer] || {};
    const assets = Object.keys(weights);
    let layerAllocated = 0;

    for (const asset of assets) {
      const w = weights[asset] ?? 0;
      const amt = Math.floor(layerAmount * w);
      if (amt <= 0) continue;
      holdings.push({ asset, layer, amountIRR: amt, frozen: false });
      layerAllocated += amt;
    }

    // deterministic remainder to last asset
    const remainder = layerAmount - layerAllocated;
    if (remainder > 0 && holdings.length) {
      for (let i = holdings.length - 1; i >= 0; i--) {
        if (holdings[i].layer === layer) {
          holdings[i].amountIRR += remainder;
          break;
        }
      }
    }

    allocated += layerAmount;
  }

  // totalIRR is authoritative as sum of holdings
  const invested = holdings.reduce((s, h) => s + h.amountIRR, 0);
  return { totalIRR: invested, layers, holdings };
}

export function calcLayerPercents(holdings, cashIRR) {
  const sums = { foundation: Math.max(0, cashIRR || 0), growth: 0, upside: 0 };
  for (const h of holdings || []) sums[h.layer] = (sums[h.layer] || 0) + (h.amountIRR || 0);

  const total = sums.foundation + sums.growth + sums.upside;
  const pct = {
    foundation: total ? Math.round((sums.foundation / total) * 100) : 0,
    growth: total ? Math.round((sums.growth / total) * 100) : 0,
    upside: total ? Math.round((sums.upside / total) * 100) : 0,
  };
  return { sums, pct, totalIRR: total };
}

export function tradeAsset(portfolio, cashIRR, assetId, side, amountIRR) {
  const amt = Math.max(0, Math.floor(Number(amountIRR) || 0));
  if (!portfolio || !portfolio.holdings || !assetId || !side || amt <= 0) {
    return { portfolio, cashIRR };
  }

  const holdings = portfolio.holdings.map(h => ({ ...h }));
  const h = holdings.find(x => x.asset === assetId);
  if (!h) return { portfolio, cashIRR };

  // disallow selling frozen collateral
  if (h.frozen && side === 'SELL') return { portfolio, cashIRR };

  let cash = Math.max(0, Math.floor(Number(cashIRR) || 0));

  if (side === 'BUY') {
    const spend = Math.min(cash, amt);
    if (spend <= 0) return { portfolio, cashIRR: cash };
    cash -= spend;
    h.amountIRR += spend;
  } else {
    const sell = Math.min(h.amountIRR, amt);
    if (sell <= 0) return { portfolio, cashIRR: cash };
    h.amountIRR -= sell;
    cash += sell;
  }

  const invested = holdings.reduce((s, x) => s + x.amountIRR, 0);
  return { portfolio: { ...portfolio, holdings, totalIRR: invested }, cashIRR: cash };
}

export function rebalanceToTarget(totalIRR, targetLayers) {
  // Deterministic: rebuild holdings from scratch using target layers and invest all cash.
  const t = Math.max(0, Math.floor(Number(totalIRR) || 0));
  if (!targetLayers) return null;
  return buildPortfolio(t, targetLayers);
}
