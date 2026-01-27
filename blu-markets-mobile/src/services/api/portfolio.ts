// Portfolio API Module
// src/services/api/portfolio.ts

import { apiClient } from './client';
import type { PortfolioResponse, AssetId, Holding, TargetLayerPct, Layer, PortfolioStatus } from './types';

/**
 * Normalize allocation values from backend format to frontend format
 * Backend: lowercase keys (foundation, growth, upside) with integer percentages (85, 12, 3)
 * Frontend: UPPERCASE keys (FOUNDATION, GROWTH, UPSIDE) with decimals (0.85, 0.12, 0.03)
 */
function normalizeAllocation(allocation: Record<string, number> | undefined): TargetLayerPct {
  if (!allocation) {
    return { FOUNDATION: 0.5, GROWTH: 0.35, UPSIDE: 0.15 }; // Default allocation
  }

  const normalizeValue = (val: number | undefined): number => {
    if (val === undefined || val === null) return 0;
    // Convert integers (>1) to decimals
    return val > 1 ? val / 100 : val;
  };

  return {
    FOUNDATION: normalizeValue(allocation.FOUNDATION ?? allocation.foundation),
    GROWTH: normalizeValue(allocation.GROWTH ?? allocation.growth),
    UPSIDE: normalizeValue(allocation.UPSIDE ?? allocation.upside),
  };
}

/**
 * Normalize backend holding to frontend Holding type
 */
function normalizeHolding(h: Record<string, unknown>): Holding {
  return {
    assetId: (h.assetId ?? h.asset_id) as AssetId,
    quantity: Number(h.quantity) || 0,
    frozen: Boolean(h.frozen),
    layer: (h.layer as Layer) || 'FOUNDATION',
  };
}

/**
 * Normalize backend portfolio response to match mobile PortfolioResponse type
 */
function normalizePortfolioResponse(data: Record<string, unknown>, holdings?: Holding[]): PortfolioResponse {
  // Normalize holdings array if provided in data
  const dataHoldings = Array.isArray(data.holdings)
    ? data.holdings.map((h: Record<string, unknown>) => normalizeHolding(h))
    : holdings || [];

  // Validate status is a valid PortfolioStatus
  const rawStatus = data.status as string | undefined;
  const validStatuses = ['BALANCED', 'SLIGHTLY_OFF', 'ATTENTION_REQUIRED'];
  const status = (rawStatus && validStatuses.includes(rawStatus) ? rawStatus : 'BALANCED') as PortfolioStatus;

  // Parse cash and total value
  const cashIrr = Number(data.cashIrr ?? data.cash_irr ?? data.cashIRR ?? 0);
  const totalValueIrr = Number(data.totalValueIrr ?? data.total_value_irr ?? data.totalValue ?? 0);
  // Backend may return holdingsValueIrr, or we can calculate from total - cash
  const holdingsValueIrr = Number(data.holdingsValueIrr ?? data.holdings_value_irr ?? (totalValueIrr - cashIrr));

  return {
    cashIrr,
    holdings: dataHoldings,
    targetAllocation: normalizeAllocation(data.targetAllocation as Record<string, number> | undefined ?? data.target_allocation as Record<string, number> | undefined),
    status,
    // Backend-calculated values (frontend is presentation layer only)
    totalValueIrr,
    holdingsValueIrr,
    allocation: normalizeAllocation(data.allocation as Record<string, number> | undefined),
    driftPct: Number(data.driftPct ?? data.drift_pct ?? 0),
    dailyChangePercent: Number(data.dailyChangePercent ?? data.daily_change_percent ?? 0),
    // Include risk score if available for profile screen
    riskScore: data.riskScore as number | undefined,
    riskProfileName: data.profileName as string | undefined,
  };
}

export const portfolio = {
  /**
   * Get portfolio summary with holdings
   * Fetches both /portfolio (summary) and /portfolio/holdings (holdings array)
   */
  get: async (): Promise<PortfolioResponse> => {
    // Fetch summary and holdings in parallel for complete portfolio data
    let summaryData: Record<string, unknown>;
    let holdingsData: Record<string, unknown>[] = [];

    try {
      const [summary, holdings] = await Promise.all([
        apiClient.get('/portfolio') as unknown as Record<string, unknown>,
        apiClient.get('/portfolio/holdings') as unknown as Record<string, unknown>[],
      ]);
      summaryData = summary;
      holdingsData = Array.isArray(holdings) ? holdings : [];
    } catch {
      // If holdings endpoint fails, just return summary
      summaryData = await apiClient.get('/portfolio') as unknown as Record<string, unknown>;
    }

    // Normalize holdings from separate endpoint
    const holdings = holdingsData.map((h) => normalizeHolding(h));

    return normalizePortfolioResponse(summaryData, holdings);
  },

  addFunds: async (amountIrr: number): Promise<PortfolioResponse> => {
    const data = await apiClient.post('/portfolio/add-funds', { amountIrr }) as unknown as Record<string, unknown>;
    // Preserve add-funds specific fields from response
    const previousCashIrr = data.previousCashIrr as number | undefined;
    const amountAdded = data.amountAdded as number | undefined;

    // Backend returns partial response, fetch full portfolio
    if (!data.holdings) {
      const fullPortfolio = await portfolio.get();
      // Merge add-funds specific fields into response
      return {
        ...fullPortfolio,
        previousCashIrr,
        amountAdded,
      };
    }
    return normalizePortfolioResponse(data);
  },

  getAsset: (assetId: AssetId): Promise<{
    holding: Holding;
    currentPriceUsd: number;
    valueIrr: number;
    changePercent24h: number;
  }> =>
    apiClient.get(`/portfolio/asset/${assetId}`) as unknown as Promise<{
      holding: Holding;
      currentPriceUsd: number;
      valueIrr: number;
      changePercent24h: number;
    }>,
};
