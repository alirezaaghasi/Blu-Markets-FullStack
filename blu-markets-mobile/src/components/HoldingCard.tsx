// Holding Card Component
// Displays a single asset holding with value and status
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors, typography, spacing, borderRadius } from '../constants/theme';
import { Holding, AssetId } from '../types';
import { ASSETS, LAYER_COLORS } from '../constants/assets';

interface HoldingCardProps {
  holding: Holding;
  priceUSD: number;
  fxRate: number;
  onPress?: () => void;
}

// Format number with commas
const formatNumber = (num: number): string => {
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
  fxRate,
  onPress,
}) => {
  const asset = ASSETS[holding.assetId];
  const valueIRR = holding.quantity * priceUSD * fxRate;

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      activeOpacity={0.7}
      disabled={!onPress}
    >
      <View style={styles.leftSection}>
        {/* Asset icon/symbol */}
        <View
          style={[
            styles.iconContainer,
            { backgroundColor: `${LAYER_COLORS[asset.layer]}20` },
          ]}
        >
          <Text style={styles.iconText}>{asset.symbol.slice(0, 2)}</Text>
        </View>

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
            {formatQuantity(holding.quantity, holding.assetId)} {asset.symbol}
          </Text>
        </View>
      </View>

      {/* Value */}
      <View style={styles.rightSection}>
        <Text style={styles.valueIRR}>{formatNumber(valueIRR)} IRR</Text>
        <Text style={styles.valueUSD}>
          ${formatNumber(holding.quantity * priceUSD)}
        </Text>
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
  valueUSD: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
});

export default HoldingCard;
