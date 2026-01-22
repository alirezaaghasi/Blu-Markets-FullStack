// Protection API Module
// src/services/api/protection.ts

import { apiClient } from './client';
import type {
  Protection,
  ProtectableHolding,
  ProtectionQuote,
  PremiumCurvePoint,
  AssetVolatility,
  AssetId,
  ProtectionsResponse,
  ProtectableHoldingsResponse,
  ProtectionQuoteResponse,
  PremiumCurveResponse,
  ProtectionPurchaseResponse,
  VolatilityResponse,
  BackendQuoteResponse,
} from './types';

// Type for raw API responses (interceptor unwraps .data)
type ApiResponse<T> = T;

// Protection duration presets in days
export const DURATION_PRESETS = [7, 14, 30, 60, 90, 180] as const;
export type DurationPreset = (typeof DURATION_PRESETS)[number];

// Coverage percentage bounds
export const MIN_COVERAGE_PCT = 0.1; // 10%
export const MAX_COVERAGE_PCT = 1.0; // 100%
export const DEFAULT_COVERAGE_PCT = 1.0; // 100%

// Default duration
export const DEFAULT_DURATION_DAYS = 30;

export const protection = {
  /**
   * Get list of holdings eligible for protection
   * Returns holdings with holdingId, valueIrr, estimatedPremiumPct, etc.
   */
  getHoldings: async (): Promise<ProtectableHoldingsResponse> => {
    const data = (await apiClient.get('/protection/holdings')) as unknown as ApiResponse<
      ProtectableHoldingsResponse | ProtectableHolding[]
    >;
    // Handle both array response and wrapped response
    if (Array.isArray(data)) {
      return { holdings: data, durationPresets: DURATION_PRESETS as unknown as number[], coverageRange: { min: MIN_COVERAGE_PCT, max: MAX_COVERAGE_PCT, step: 0.1 }, minNotionalIrr: 10_000_000 };
    }
    return data as ProtectableHoldingsResponse;
  },

  /**
   * Alias for getHoldings - returns eligible assets for protection
   * Used by legacy code
   */
  getEligible: async (): Promise<{ assets: ProtectableHolding[] }> => {
    const response = await protection.getHoldings();
    return { assets: response.holdings || [] };
  },

  /**
   * Get a protection quote for a holding
   * Uses GET with query params per backend API
   * Transforms backend response to match frontend ProtectionQuote type
   */
  getQuote: async (
    holdingId: string,
    coveragePct: number = DEFAULT_COVERAGE_PCT,
    durationDays: number = DEFAULT_DURATION_DAYS
  ): Promise<ProtectionQuote> => {
    const data = (await apiClient.get('/protection/quote', {
      params: { holdingId, coveragePct, durationDays },
    })) as unknown as ApiResponse<BackendQuoteResponse>;

    // Transform backend response to frontend-expected shape
    const { quote: backendQuote, breakeven, validity } = data;

    // Use backend's validated coveragePct (may differ from requested if clamped/adjusted)
    // Fall back to requested coveragePct only if backend didn't return one
    const safeCoveragePct = backendQuote.coveragePct || coveragePct || 1;

    // Calculate annualized premium percentage (guard against zero duration)
    const safeDurationDays = backendQuote.durationDays || durationDays || 30;
    const annualizedPct = (backendQuote.premiumPct / safeDurationDays) * 365;

    // Determine validity - prefer validity object, then backendQuote.validUntil
    // Only generate synthetic timestamp as last resort
    const expiresAt = validity?.validUntil
      ?? backendQuote.validUntil
      ?? new Date(Date.now() + 5 * 60 * 1000).toISOString();

    // Calculate seconds remaining from expiresAt if not provided
    const validForSeconds = validity?.secondsRemaining
      ?? Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));

    // Transform to frontend ProtectionQuote shape with safe defaults for optional fields
    const frontendQuote: ProtectionQuote = {
      quoteId: backendQuote.quoteId,
      assetId: backendQuote.assetId as AssetId,
      holdingValueIrr: backendQuote.notionalIrr / safeCoveragePct,
      holdingValueUsd: backendQuote.notionalUsd / safeCoveragePct,
      coveragePct: backendQuote.coveragePct,
      notionalIrr: backendQuote.notionalIrr,
      notionalUsd: backendQuote.notionalUsd,
      durationDays: backendQuote.durationDays,
      strikeUsd: backendQuote.strikeUsd,
      strikePct: backendQuote.strikePct,
      premiumIrr: backendQuote.premiumIrr,
      premiumUsd: backendQuote.premiumUsd,
      premiumPct: backendQuote.premiumPct,
      annualizedPct,
      breakeven: {
        priceDrop: breakeven?.priceDropPct ?? 0,
        priceUsd: breakeven?.breakEvenUsd ?? 0,
      },
      greeks: {
        delta: backendQuote.greeks?.delta ?? 0,
        gamma: backendQuote.greeks?.gamma ?? 0,
        vega: backendQuote.greeks?.vega ?? 0,
        theta: backendQuote.greeks?.theta ?? 0,
      },
      volatility: {
        iv: backendQuote.impliedVolatility ?? 0,
        regime: backendQuote.volatilityRegime ?? 'NORMAL',
      },
      expiresAt,
      validForSeconds,
    };

    return frontendQuote;
  },

  /**
   * Get premium curve for all duration presets
   * Uses GET with query params per backend API
   */
  getPremiumCurve: async (
    holdingId: string,
    coveragePct: number = DEFAULT_COVERAGE_PCT
  ): Promise<PremiumCurvePoint[]> => {
    const data = (await apiClient.get('/protection/quote/curve', {
      params: { holdingId, coveragePct },
    })) as unknown as ApiResponse<PremiumCurveResponse | { quotes: PremiumCurvePoint[] }>;

    // Backend returns 'quotes' not 'curve'
    return (data as any)?.quotes || data?.curve || [];
  },

  /**
   * Purchase protection using a quote
   * Requires all fields per backend API
   */
  purchase: async (params: {
    quoteId: string;
    holdingId: string;
    coveragePct: number;
    durationDays: number;
    premiumIrr: number;
    acknowledgedPremium: boolean;
  }): Promise<Protection> => {
    const data = (await apiClient.post('/protection/purchase', params)) as unknown as ApiResponse<
      ProtectionPurchaseResponse | Protection
    >;

    // Handle both wrapped and unwrapped response
    if ('protection' in data) {
      return data.protection;
    }
    return data as Protection;
  },

  /**
   * Get active protections
   */
  getActive: async (): Promise<Protection[]> => {
    const data = (await apiClient.get('/protection/active')) as unknown as ApiResponse<
      ProtectionsResponse | Protection[]
    >;

    if (Array.isArray(data)) {
      return data;
    }
    return data?.protections || [];
  },

  /**
   * Get protection history
   */
  getHistory: async (page: number = 1, limit: number = 20): Promise<Protection[]> => {
    const data = (await apiClient.get('/protection/history', {
      params: { page, limit },
    })) as unknown as ApiResponse<{ protections: Protection[] } | Protection[]>;

    if (Array.isArray(data)) {
      return data;
    }
    return data?.protections || [];
  },

  /**
   * Get volatility info for an asset
   */
  getVolatility: async (assetId: AssetId): Promise<AssetVolatility> => {
    const data = (await apiClient.get(
      `/protection/volatility/${assetId}`
    )) as unknown as ApiResponse<VolatilityResponse | AssetVolatility>;

    if ('volatility' in data) {
      return data.volatility;
    }
    return data as AssetVolatility;
  },

  /**
   * Cancel a protection (if allowed)
   * Note: Cancellation may not always be possible or may have penalties
   */
  cancel: async (protectionId: string): Promise<{ success: boolean }> => {
    return (await apiClient.delete(`/protection/${protectionId}`)) as unknown as Promise<{
      success: boolean;
    }>;
  },
};

// Helper functions for protection calculations

/**
 * Format premium as percentage string
 */
export function formatPremiumPct(pct: number): string {
  return `${(pct * 100).toFixed(2)}%`;
}

/**
 * Format duration in days to human readable
 */
export function formatDuration(days: number): string {
  if (days < 30) {
    return `${days} days`;
  }
  const months = Math.round(days / 30);
  return months === 1 ? '1 month' : `${months} months`;
}

/**
 * Format duration in Farsi
 */
export function formatDurationFa(days: number): string {
  if (days < 30) {
    return `${days} روز`;
  }
  const months = Math.round(days / 30);
  return months === 1 ? '۱ ماه' : `${months} ماه`;
}

/**
 * Get coverage percentage marks for slider
 */
export function getCoverageMarks(): Array<{ value: number; label: string }> {
  return [
    { value: 0.1, label: '10%' },
    { value: 0.25, label: '25%' },
    { value: 0.5, label: '50%' },
    { value: 0.75, label: '75%' },
    { value: 1.0, label: '100%' },
  ];
}

/**
 * Calculate days remaining until expiry
 */
export function getDaysRemaining(expiryDate: string): number {
  const now = new Date();
  const expiry = new Date(expiryDate);
  const diffMs = expiry.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}

/**
 * Check if protection is expiring soon (within 7 days)
 */
export function isExpiringSoon(expiryDate: string): boolean {
  return getDaysRemaining(expiryDate) <= 7;
}

/**
 * Get volatility regime color
 */
export function getRegimeColor(regime: string): string {
  const colors: Record<string, string> = {
    LOW: '#22C55E', // Green
    NORMAL: '#3B82F6', // Blue
    ELEVATED: '#F59E0B', // Amber
    HIGH: '#EF4444', // Red
    EXTREME: '#7C3AED', // Purple
  };
  return colors[regime] || colors.NORMAL;
}
