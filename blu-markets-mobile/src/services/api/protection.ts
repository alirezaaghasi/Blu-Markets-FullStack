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
   */
  getHoldings: async (): Promise<ProtectableHolding[]> => {
    const data = (await apiClient.get('/protection/holdings')) as unknown as ApiResponse<
      ProtectableHoldingsResponse | ProtectableHolding[]
    >;
    // Handle both array response and wrapped response
    if (Array.isArray(data)) {
      return data;
    }
    return data?.holdings || [];
  },

  /**
   * Get a protection quote for an asset
   */
  getQuote: async (
    assetId: AssetId,
    coveragePct: number = DEFAULT_COVERAGE_PCT,
    durationDays: number = DEFAULT_DURATION_DAYS
  ): Promise<ProtectionQuote> => {
    const data = (await apiClient.post('/protection/quote', {
      assetId,
      coveragePct,
      durationDays,
    })) as unknown as ApiResponse<ProtectionQuoteResponse | ProtectionQuote>;

    // Handle both wrapped and unwrapped response
    if ('quote' in data) {
      return data.quote;
    }
    return data as ProtectionQuote;
  },

  /**
   * Get premium curve for all duration presets
   */
  getPremiumCurve: async (
    assetId: AssetId,
    coveragePct: number = DEFAULT_COVERAGE_PCT
  ): Promise<PremiumCurvePoint[]> => {
    const data = (await apiClient.post('/protection/quote/curve', {
      assetId,
      coveragePct,
    })) as unknown as ApiResponse<PremiumCurveResponse | { curve: PremiumCurvePoint[] }>;

    return data?.curve || [];
  },

  /**
   * Purchase protection using a quote
   */
  purchase: async (quoteId: string, maxPremiumIrr?: number): Promise<Protection> => {
    const data = (await apiClient.post('/protection/purchase', {
      quoteId,
      maxPremiumIrr,
    })) as unknown as ApiResponse<ProtectionPurchaseResponse | Protection>;

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
