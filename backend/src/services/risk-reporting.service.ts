/**
 * Risk Reporting Service
 * Tracks and reports on protection exposure and risk metrics
 *
 * @module services/risk-reporting.service
 */

import { prisma } from '../config/database.js';
import { getCurrentPrices } from './price-fetcher.service.js';
import { getImpliedVolatility, getVolatilityRegime } from './volatility.service.js';
import { calculatePutGreeks } from './options-math.js';
import type { AssetId } from '../types/domain.js';

// ============================================================================
// TYPES
// ============================================================================

export interface AssetExposure {
  assetId: AssetId;
  activeProtections: number;
  totalNotionalUsd: number;
  totalNotionalIrr: number;
  totalPremiumCollectedIrr: number;
  aggregateDelta: number;
  aggregateGamma: number;
  aggregateVega: number;
  maxLossUsd: number;
  avgDaysToExpiry: number;
}

export interface ExpiryBucket {
  label: string;
  minDays: number;
  maxDays: number;
  count: number;
  notionalUsd: number;
  notionalIrr: number;
}

export interface RiskReport {
  generatedAt: Date;
  summary: {
    totalActiveProtections: number;
    totalNotionalUsd: number;
    totalNotionalIrr: number;
    totalPremiumCollectedIrr: number;
    maxPotentialLossUsd: number;
    maxPotentialLossIrr: number;
    avgDaysToExpiry: number;
    volatilityRegime: string;
  };
  byAsset: AssetExposure[];
  byExpiry: ExpiryBucket[];
  greeks: {
    portfolioDelta: number;
    portfolioGamma: number;
    portfolioVega: number;
    portfolioTheta: number;
  };
  alerts: RiskAlert[];
}

export interface RiskAlert {
  level: 'INFO' | 'WARNING' | 'CRITICAL';
  type: string;
  message: string;
  value?: number;
  threshold?: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const RISK_THRESHOLDS = {
  // Total notional exposure warnings
  NOTIONAL_WARNING_USD: 50_000,
  NOTIONAL_CRITICAL_USD: 100_000,

  // Single asset concentration
  SINGLE_ASSET_CONCENTRATION_PCT: 0.4, // 40% of total

  // Expiry concentration
  EXPIRY_CONCENTRATION_PCT: 0.5, // 50% expiring in same bucket

  // Greeks thresholds
  DELTA_WARNING: -50, // Equivalent short exposure
  VEGA_WARNING: 1000, // Volatility sensitivity
};

const EXPIRY_BUCKETS: Omit<ExpiryBucket, 'count' | 'notionalUsd' | 'notionalIrr'>[] = [
  { label: '0-7 days', minDays: 0, maxDays: 7 },
  { label: '8-14 days', minDays: 8, maxDays: 14 },
  { label: '15-30 days', minDays: 15, maxDays: 30 },
  { label: '31-60 days', minDays: 31, maxDays: 60 },
  { label: '61-90 days', minDays: 61, maxDays: 90 },
  { label: '91-180 days', minDays: 91, maxDays: 180 },
  { label: '180+ days', minDays: 181, maxDays: Infinity },
];

// ============================================================================
// MAIN FUNCTIONS
// ============================================================================

/**
 * Generate comprehensive risk report
 */
export async function generateRiskReport(): Promise<RiskReport> {
  const now = new Date();

  // Get all active protections
  const activeProtections = await prisma.protection.findMany({
    where: { status: 'ACTIVE' },
  });

  // Get current prices
  const prices = await getCurrentPrices();

  // Initialize report
  const report: RiskReport = {
    generatedAt: now,
    summary: {
      totalActiveProtections: activeProtections.length,
      totalNotionalUsd: 0,
      totalNotionalIrr: 0,
      totalPremiumCollectedIrr: 0,
      maxPotentialLossUsd: 0,
      maxPotentialLossIrr: 0,
      avgDaysToExpiry: 0,
      volatilityRegime: getVolatilityRegime('BTC' as AssetId), // Use BTC as market regime indicator
    },
    byAsset: [],
    byExpiry: EXPIRY_BUCKETS.map((b) => ({
      ...b,
      count: 0,
      notionalUsd: 0,
      notionalIrr: 0,
    })),
    greeks: {
      portfolioDelta: 0,
      portfolioGamma: 0,
      portfolioVega: 0,
      portfolioTheta: 0,
    },
    alerts: [],
  };

  if (activeProtections.length === 0) {
    return report;
  }

  // Group by asset
  const byAsset = new Map<string, AssetExposure>();

  // Calculate metrics for each protection
  let totalDaysToExpiry = 0;

  for (const protection of activeProtections) {
    const assetId = protection.assetId as AssetId;
    const notionalUsd = Number(protection.notionalUsd) || 0;
    const notionalIrr = Number(protection.notionalIrr);
    const premiumIrr = Number(protection.premiumIrr);
    const strikeUsd = Number(protection.strikeUsd) || 0;

    // Get price data
    const priceData = prices.get(assetId);
    const currentPriceUsd = priceData?.priceUsd || strikeUsd;
    const fxRate = priceData ? priceData.priceIrr / priceData.priceUsd : 600000;

    // Calculate days to expiry
    const daysToExpiry = Math.max(
      0,
      Math.ceil((protection.expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    );
    totalDaysToExpiry += daysToExpiry;

    // Calculate Greeks for this protection
    const ivData = getImpliedVolatility(assetId, daysToExpiry);
    const iv = ivData.adjustedVolatility;
    const yearsToExpiry = daysToExpiry / 365;
    const riskFreeRate = 0.05;

    let greeks = { delta: 0, gamma: 0, vega: 0, theta: 0, rho: 0 };
    if (yearsToExpiry > 0 && currentPriceUsd > 0 && strikeUsd > 0) {
      greeks = calculatePutGreeks(currentPriceUsd, strikeUsd, yearsToExpiry, riskFreeRate, iv);
    }

    // Scale Greeks by notional (number of "contracts")
    const contracts = notionalUsd / currentPriceUsd;
    const scaledDelta = greeks.delta * contracts;
    const scaledGamma = greeks.gamma * contracts;
    const scaledVega = greeks.vega * contracts;
    const scaledTheta = greeks.theta * contracts;

    // Update summary totals
    report.summary.totalNotionalUsd += notionalUsd;
    report.summary.totalNotionalIrr += notionalIrr;
    report.summary.totalPremiumCollectedIrr += premiumIrr;
    report.summary.maxPotentialLossUsd += notionalUsd; // Max loss is full notional
    report.summary.maxPotentialLossIrr += notionalIrr;

    // Update portfolio Greeks
    report.greeks.portfolioDelta += scaledDelta;
    report.greeks.portfolioGamma += scaledGamma;
    report.greeks.portfolioVega += scaledVega;
    report.greeks.portfolioTheta += scaledTheta;

    // Update asset exposure
    if (!byAsset.has(assetId)) {
      byAsset.set(assetId, {
        assetId,
        activeProtections: 0,
        totalNotionalUsd: 0,
        totalNotionalIrr: 0,
        totalPremiumCollectedIrr: 0,
        aggregateDelta: 0,
        aggregateGamma: 0,
        aggregateVega: 0,
        maxLossUsd: 0,
        avgDaysToExpiry: 0,
      });
    }

    const assetExposure = byAsset.get(assetId)!;
    assetExposure.activeProtections++;
    assetExposure.totalNotionalUsd += notionalUsd;
    assetExposure.totalNotionalIrr += notionalIrr;
    assetExposure.totalPremiumCollectedIrr += premiumIrr;
    assetExposure.aggregateDelta += scaledDelta;
    assetExposure.aggregateGamma += scaledGamma;
    assetExposure.aggregateVega += scaledVega;
    assetExposure.maxLossUsd += notionalUsd;
    assetExposure.avgDaysToExpiry += daysToExpiry;

    // Update expiry bucket
    for (const bucket of report.byExpiry) {
      if (daysToExpiry >= bucket.minDays && daysToExpiry <= bucket.maxDays) {
        bucket.count++;
        bucket.notionalUsd += notionalUsd;
        bucket.notionalIrr += notionalIrr;
        break;
      }
    }
  }

  // Finalize averages
  report.summary.avgDaysToExpiry = totalDaysToExpiry / activeProtections.length;

  // Convert asset map to array and calculate averages
  report.byAsset = Array.from(byAsset.values()).map((asset) => ({
    ...asset,
    avgDaysToExpiry: asset.avgDaysToExpiry / asset.activeProtections,
  }));

  // Generate risk alerts
  report.alerts = generateRiskAlerts(report);

  return report;
}

/**
 * Generate risk alerts based on thresholds
 */
function generateRiskAlerts(report: RiskReport): RiskAlert[] {
  const alerts: RiskAlert[] = [];

  // Check total notional exposure
  if (report.summary.totalNotionalUsd > RISK_THRESHOLDS.NOTIONAL_CRITICAL_USD) {
    alerts.push({
      level: 'CRITICAL',
      type: 'HIGH_EXPOSURE',
      message: `Total notional exposure ($${report.summary.totalNotionalUsd.toFixed(0)}) exceeds critical threshold`,
      value: report.summary.totalNotionalUsd,
      threshold: RISK_THRESHOLDS.NOTIONAL_CRITICAL_USD,
    });
  } else if (report.summary.totalNotionalUsd > RISK_THRESHOLDS.NOTIONAL_WARNING_USD) {
    alerts.push({
      level: 'WARNING',
      type: 'HIGH_EXPOSURE',
      message: `Total notional exposure ($${report.summary.totalNotionalUsd.toFixed(0)}) exceeds warning threshold`,
      value: report.summary.totalNotionalUsd,
      threshold: RISK_THRESHOLDS.NOTIONAL_WARNING_USD,
    });
  }

  // Check single asset concentration
  for (const asset of report.byAsset) {
    const concentration = asset.totalNotionalUsd / report.summary.totalNotionalUsd;
    if (concentration > RISK_THRESHOLDS.SINGLE_ASSET_CONCENTRATION_PCT) {
      alerts.push({
        level: 'WARNING',
        type: 'ASSET_CONCENTRATION',
        message: `${asset.assetId} represents ${(concentration * 100).toFixed(1)}% of total exposure`,
        value: concentration,
        threshold: RISK_THRESHOLDS.SINGLE_ASSET_CONCENTRATION_PCT,
      });
    }
  }

  // Check expiry concentration
  for (const bucket of report.byExpiry) {
    if (bucket.count === 0) continue;
    const concentration = bucket.notionalUsd / report.summary.totalNotionalUsd;
    if (concentration > RISK_THRESHOLDS.EXPIRY_CONCENTRATION_PCT) {
      alerts.push({
        level: 'WARNING',
        type: 'EXPIRY_CONCENTRATION',
        message: `${(concentration * 100).toFixed(1)}% of notional expires in ${bucket.label}`,
        value: concentration,
        threshold: RISK_THRESHOLDS.EXPIRY_CONCENTRATION_PCT,
      });
    }
  }

  // Check portfolio delta
  if (report.greeks.portfolioDelta < RISK_THRESHOLDS.DELTA_WARNING) {
    alerts.push({
      level: 'WARNING',
      type: 'HIGH_DELTA',
      message: `Portfolio delta (${report.greeks.portfolioDelta.toFixed(2)}) indicates significant short exposure`,
      value: report.greeks.portfolioDelta,
      threshold: RISK_THRESHOLDS.DELTA_WARNING,
    });
  }

  // Check volatility regime (use BTC as market indicator)
  const regime = getVolatilityRegime('BTC' as AssetId);
  if (regime === 'EXTREME' || regime === 'HIGH') {
    alerts.push({
      level: regime === 'EXTREME' ? 'CRITICAL' : 'WARNING',
      type: 'VOLATILITY_REGIME',
      message: `Current volatility regime is ${regime}`,
    });
  }

  return alerts;
}

/**
 * Get quick exposure summary (lightweight version for dashboards)
 */
export async function getExposureSummary(): Promise<{
  totalActiveProtections: number;
  totalNotionalUsd: number;
  totalNotionalIrr: number;
  expiringWithin7Days: number;
  hasAlerts: boolean;
}> {
  const now = new Date();
  const next7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [activeCount, totalNotional, expiringCount] = await Promise.all([
    prisma.protection.count({ where: { status: 'ACTIVE' } }),
    prisma.protection.aggregate({
      where: { status: 'ACTIVE' },
      _sum: { notionalUsd: true, notionalIrr: true },
    }),
    prisma.protection.count({
      where: {
        status: 'ACTIVE',
        expiryDate: { lte: next7Days },
      },
    }),
  ]);

  const totalNotionalUsd = Number(totalNotional._sum.notionalUsd) || 0;

  return {
    totalActiveProtections: activeCount,
    totalNotionalUsd,
    totalNotionalIrr: Number(totalNotional._sum.notionalIrr) || 0,
    expiringWithin7Days: expiringCount,
    hasAlerts: totalNotionalUsd > RISK_THRESHOLDS.NOTIONAL_WARNING_USD,
  };
}

/**
 * Get historical protection statistics
 */
export async function getProtectionStats(days: number = 30): Promise<{
  totalProtectionsSold: number;
  totalPremiumCollectedIrr: number;
  totalSettlementsPaidIrr: number;
  exerciseRate: number;
  avgDuration: number;
}> {
  const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [protectionStats, settlementStats] = await Promise.all([
    prisma.protection.aggregate({
      where: {
        createdAt: { gte: cutoffDate },
      },
      _count: true,
      _sum: { premiumIrr: true, durationDays: true },
    }),
    prisma.protection.aggregate({
      where: {
        status: 'EXERCISED',
        settlementDate: { gte: cutoffDate },
      },
      _count: true,
      _sum: { settlementIrr: true },
    }),
  ]);

  const totalProtections = protectionStats._count;
  const exercisedCount = settlementStats._count;

  return {
    totalProtectionsSold: totalProtections,
    totalPremiumCollectedIrr: Number(protectionStats._sum.premiumIrr) || 0,
    totalSettlementsPaidIrr: Number(settlementStats._sum.settlementIrr) || 0,
    exerciseRate: totalProtections > 0 ? exercisedCount / totalProtections : 0,
    avgDuration:
      totalProtections > 0 ? (Number(protectionStats._sum.durationDays) || 0) / totalProtections : 0,
  };
}

/**
 * Get protection P&L summary
 */
export async function getProtectionPnL(): Promise<{
  totalPremiumsIrr: number;
  totalSettlementsIrr: number;
  netPnLIrr: number;
  profitMargin: number;
}> {
  const [premiums, settlements] = await Promise.all([
    prisma.protection.aggregate({
      _sum: { premiumIrr: true },
    }),
    prisma.protection.aggregate({
      where: { status: 'EXERCISED' },
      _sum: { settlementIrr: true },
    }),
  ]);

  const totalPremiumsIrr = Number(premiums._sum.premiumIrr) || 0;
  const totalSettlementsIrr = Number(settlements._sum.settlementIrr) || 0;
  const netPnLIrr = totalPremiumsIrr - totalSettlementsIrr;

  return {
    totalPremiumsIrr,
    totalSettlementsIrr,
    netPnLIrr,
    profitMargin: totalPremiumsIrr > 0 ? netPnLIrr / totalPremiumsIrr : 0,
  };
}
