// Holding Card Component
// Displays a single asset holding with value and status
//
// BACKEND-DERIVED VALUES: This component now prefers backend-calculated values
// (holding.valueIrr, holding.fixedIncome) over client-side calculations.
// Client-side fallbacks exist only for demo/mock mode.
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors, typography, spacing, borderRadius } from '../constants/theme';
import { Holding, AssetId } from '../types';
import { ASSETS, LAYER_COLORS, LAYER_NAMES } from '../constants/assets';
import { getFixedIncomeBreakdown, FixedIncomeBreakdown } from '../utils/fixedIncome';
import { AssetIcon } from './AssetIcon';
import { formatIRR, formatCrypto } from '../utils/currency';

interface HoldingCardProps {
  holding: Holding;
  priceUSD: number;
  priceIRR?: number;  // Direct IRR price from backend (preferred over priceUSD * fxRate)
  fxRate: number;
  change24h?: number;
  purchasedAt?: string | Date;  // For Fixed Income accrued interest calculation
  onPress?: () => void;
}

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

  // BACKEND-DERIVED VALUES: Get Fixed Income breakdown
  // Prefers holding.fixedIncome (backend) over client-side calculation
  const fixedIncomeBreakdown: FixedIncomeBreakdown | null = isFixedIncome
    ? getFixedIncomeBreakdown({
        quantity: holding.quantity,
        purchasedAt: purchasedAt as string | undefined,
        fixedIncome: holding.fixedIncome,
      })
    : null;

  // BACKEND-DERIVED VALUES: Prefer holding.valueIrr from backend when available
  // This ensures UI displays same values as backend calculations
  // Fallback to client-side calculation only for demo/mock mode
  const valueIRR = holding.valueIrr !== undefined && holding.valueIrr > 0
    ? holding.valueIrr  // Backend-provided value (authoritative)
    : isFixedIncome
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
            {holding.frozen && (
              <View style={styles.frozenBadge}>
                <Text style={styles.frozenText}>🔒</Text>
              </View>
            )}
          </View>
          <Text style={styles.quantity}>
            {formatCrypto(holding.quantity, asset.symbol)}
          </Text>
        </View>
      </View>

      {/* Value - Task 21: Show only IRR value, no USD */}
      <View style={styles.rightSection}>
        <Text style={styles.valueIRR}>{formatIRR(valueIRR)}</Text>
        {isFixedIncome && fixedIncomeBreakdown && (
          <View style={styles.fixedIncomeDetails}>
            <Text style={styles.fixedIncomePrincipal}>
              {formatIRR(fixedIncomeBreakdown.principal, { showUnit: false })} principal
            </Text>
            {fixedIncomeBreakdown.daysHeld > 0 && (
              <Text style={styles.fixedIncomeAccrued}>
                + {formatIRR(fixedIncomeBreakdown.accrued, { showUnit: false })} accrued ({fixedIncomeBreakdown.daysHeld}d)
              </Text>
            )}
          </View>
        )}
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
  // Fixed Income breakdown styles
  fixedIncomeDetails: {
    alignItems: 'flex-end',
    marginTop: 2,
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
