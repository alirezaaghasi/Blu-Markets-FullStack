// Holding Card Component
// Displays a single asset holding with value and status
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors, typography, spacing, borderRadius } from '../constants/theme';
import { Holding, AssetId } from '../types';
import { ASSETS, LAYER_COLORS, LAYER_NAMES } from '../constants/assets';
import { calculateFixedIncomeValue, FixedIncomeBreakdown } from '../utils/fixedIncome';
import { AssetIcon } from './AssetIcon';

interface HoldingCardProps {
  holding: Holding;
  priceUSD: number;
  priceIRR?: number;  // Direct IRR price from backend (preferred over priceUSD * fxRate)
  fxRate: number;
  change24h?: number;
  purchasedAt?: string | Date;  // For Fixed Income accrued interest calculation
  onPress?: () => void;
}

// Format number with commas
const formatNumber = (num: number): string => {
  if (num === undefined || num === null || isNaN(num)) return '0';
  if (num >= 1_000_000_000) {
    return `${(num / 1_000_000_000).toFixed(1)}B`;
  }
  if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(1)}M`;
  }
  if (num >= 1_000) {
    return `${(num / 1_000).toFixed(1)}K`;
  }
  return num.toLocaleString('en-US');
};

// Format quantity based on asset
const formatQuantity = (quantity: number, assetId: AssetId): string => {
  if (quantity === undefined || quantity === null || isNaN(quantity)) return '0';
  if (assetId === 'BTC') {
    return quantity.toFixed(8);
  }
  if (['ETH', 'PAXG', 'KAG'].includes(assetId)) {
    return quantity.toFixed(6);
  }
  if (assetId === 'IRR_FIXED_INCOME') {
    return quantity.toFixed(0);
  }
  return quantity.toFixed(4);
};

export const HoldingCard: React.FC<HoldingCardProps> = ({
  holding,
  priceUSD,
  priceIRR,
  fxRate,
  change24h,
  purchasedAt,
  onPress,
}) => {
  const asset = ASSETS[holding.assetId];
  const isFixedIncome = holding.assetId === 'IRR_FIXED_INCOME';

  // Calculate Fixed Income breakdown with accrued interest
  const fixedIncomeBreakdown: FixedIncomeBreakdown | null = isFixedIncome
    ? calculateFixedIncomeValue(holding.quantity, purchasedAt)
    : null;

  // Fixed Income uses calculated total (principal + accrued)
  // Other assets: prefer direct IRR price from backend, fallback to USD * fxRate
  const valueIRR = isFixedIncome
    ? (fixedIncomeBreakdown?.total || 0)
    : priceIRR && priceIRR > 0
      ? holding.quantity * priceIRR
      : holding.quantity * priceUSD * fxRate;

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      activeOpacity={0.7}
      disabled={!onPress}
    >
      <View style={styles.leftSection}>
        {/* Asset icon/symbol */}
        <AssetIcon assetId={holding.assetId} size={44} />

        {/* Asset info */}
        <View style={styles.infoContainer}>
          <View style={styles.nameRow}>
            <Text style={styles.assetName}>{asset.name}</Text>
            <Text style={styles.assetSymbol}> | {asset.symbol}</Text>

            {holding.frozen && (
              <View style={styles.frozenBadge}>
                <Text style={styles.frozenText}>🔒</Text>
              </View>
            )}
          </View>
          <Text style={styles.quantity}>
            {formatQuantity(holding.quantity, holding.assetId)} {asset.symbol}
          </Text>
        </View>
      </View>

      {/* Value */}
      <View style={styles.rightSection}>
        <Text style={styles.valueIRR}>{formatNumber(valueIRR)} IRR</Text>
        <View style={styles.valueRow}>
          {isFixedIncome && fixedIncomeBreakdown ? (
            <View style={styles.fixedIncomeDetails}>
              <Text style={styles.fixedIncomePrincipal}>
                {formatNumber(fixedIncomeBreakdown.principal)} principal
              </Text>
              {fixedIncomeBreakdown.daysHeld > 0 && (
                <Text style={styles.fixedIncomeAccrued}>
                  + {formatNumber(fixedIncomeBreakdown.accrued)} accrued ({fixedIncomeBreakdown.daysHeld}d)
                </Text>
              )}
            </View>
          ) : (
            <>
              <Text style={styles.valueUSD}>
                ${formatNumber(holding.quantity * priceUSD)}
              </Text>
              {change24h !== undefined ? (
                <Text style={[
                  styles.changeText,
                  change24h >= 0 ? styles.changePositive : styles.changeNegative,
                ]}>
                  {change24h >= 0 ? '+' : ''}{change24h.toFixed(1)}%
                </Text>
              ) : (
                <Text style={styles.changeNeutral}>--</Text>
              )}
            </>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceDark,
    borderRadius: borderRadius.default,
    padding: spacing[3],
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing[3],
  },
  iconText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimaryDark,
  },
  infoContainer: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  assetName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimaryDark,
  },
  assetSymbol: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.textSecondary,
  },
  frozenBadge: {
    marginLeft: spacing[2],
  },
  frozenText: {
    fontSize: 12,
  },
  quantity: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  rightSection: {
    alignItems: 'flex-end',
  },
  valueIRR: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimaryDark,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    gap: 8,
  },
  valueUSD: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
  },
  changeText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  changePositive: {
    color: colors.success,
  },
  changeNegative: {
    color: colors.error,
  },
  changeNeutral: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
  },
  // Fixed Income breakdown styles
  fixedIncomeDetails: {
    alignItems: 'flex-end',
  },
  fixedIncomePrincipal: {
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
  },
  fixedIncomeAccrued: {
    fontSize: typography.fontSize.xs,
    color: colors.success,
    marginTop: 1,
  },
});

export default HoldingCard;
