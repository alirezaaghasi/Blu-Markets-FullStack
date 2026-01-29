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

  // BUG FIX: Handle all three case conventions from backend:
  // - UPPERCASE: FOUNDATION, GROWTH, UPSIDE
  // - lowercase: foundation, growth, upside
  // - TitleCase: Foundation, Growth, Upside (from backend's Allocation field)
  return {
    FOUNDATION: normalizeValue(allocation.FOUNDATION ?? allocation.foundation ?? allocation.Foundation),
    GROWTH: normalizeValue(allocation.GROWTH ?? allocation.growth ?? allocation.Growth),
    UPSIDE: normalizeValue(allocation.UPSIDE ?? allocation.upside ?? allocation.Upside),
  };
}

/**
 * Normalize backend holding to frontend Holding type
 * BACKEND-DERIVED VALUES: Forward valuation fields from backend, do NOT recompute
 */
function normalizeHolding(h: Record<string, unknown>): Holding {
  // Parse fixed income breakdown if present
  const fixedIncomeRaw = h.fixedIncome ?? h.fixed_income;
  const fixedIncome = fixedIncomeRaw && typeof fixedIncomeRaw === 'object'
    ? {
        principal: Number((fixedIncomeRaw as Record<string, unknown>).principal) || 0,
        accruedInterest: Number((fixedIncomeRaw as Record<string, unknown>).accruedInterest ?? (fixedIncomeRaw as Record<string, unknown>).accrued_interest) || 0,
        total: Number((fixedIncomeRaw as Record<string, unknown>).total) || 0,
        daysHeld: Number((fixedIncomeRaw as Record<string, unknown>).daysHeld ?? (fixedIncomeRaw as Record<string, unknown>).days_held) || 0,
        dailyRate: Number((fixedIncomeRaw as Record<string, unknown>).dailyRate ?? (fixedIncomeRaw as Record<string, unknown>).daily_rate) || 0,
      }
    : undefined;

  return {
    id: (h.id) as string | undefined,  // Database ID for API calls (protection, loans)
    assetId: (h.assetId ?? h.asset_id) as AssetId,
    quantity: Number(h.quantity) || 0,
    frozen: Boolean(h.frozen),
    layer: (h.layer as Layer) || 'FOUNDATION',
    purchasedAt: (h.purchasedAt ?? h.purchased_at) as string | undefined,  // For Fixed Income accrual
    // Backend-derived valuation fields (do NOT recompute on frontend)
    valueIrr: h.valueIrr !== undefined ? Number(h.valueIrr) : (h.value_irr !== undefined ? Number(h.value_irr) : undefined),
    valueUsd: h.valueUsd !== undefined ? Number(h.valueUsd) : (h.value_usd !== undefined ? Number(h.value_usd) : undefined),
    priceIrr: h.priceIrr !== undefined ? Number(h.priceIrr) : (h.price_irr !== undefined ? Number(h.price_irr) : undefined),
    priceUsd: h.priceUsd !== undefined ? Number(h.priceUsd) : (h.price_usd !== undefined ? Number(h.price_usd) : undefined),
    fixedIncome,
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
    // BUG FIX: Handle both lowercase and uppercase Allocation keys from backend
    // Backend sends both, but some HTTP clients may transform keys
    allocation: normalizeAllocation(
      (data.allocation as Record<string, number> | undefined) ||
      (data.Allocation as Record<string, number> | undefined)
    ),
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

      // DEBUG: Log API responses
      if (__DEV__) {
        console.log('[Portfolio API] /portfolio holdings count:', Array.isArray(summaryData.holdings) ? (summaryData.holdings as unknown[]).length : 'none');
        console.log('[Portfolio API] /portfolio/holdings count:', holdingsData.length);
        if (holdingsData.length > 0) {
          console.log('[Portfolio API] First holding:', JSON.stringify(holdingsData[0]));
        }
      }
    } catch (error) {
      // If holdings endpoint fails, just return summary
      if (__DEV__) console.log('[Portfolio API] Holdings endpoint failed, using summary only:', error);
      summaryData = await apiClient.get('/portfolio') as unknown as Record<string, unknown>;
    }

    // Normalize holdings from separate endpoint
    const holdings = holdingsData.map((h) => normalizeHolding(h));

    const result = normalizePortfolioResponse(summaryData, holdings);

    // DEBUG: Log final result
    if (__DEV__) {
      console.log('[Portfolio API] Final holdings count:', result.holdings.length);
      console.log('[Portfolio API] Holdings by layer:', {
        FOUNDATION: result.holdings.filter(h => h.layer === 'FOUNDATION').length,
        GROWTH: result.holdings.filter(h => h.layer === 'GROWTH').length,
        UPSIDE: result.holdings.filter(h => h.layer === 'UPSIDE').length,
      });
    }

    return result;
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
