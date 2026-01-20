// Dashboard Screen
// Based on PRD Section 9.1 - Dashboard Screen
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  RefreshControl,
} from 'react-native';
import { colors, typography, spacing, borderRadius } from '../../constants/theme';
import { useAppSelector, useAppDispatch } from '../../hooks/useStore';
import { Layer, Holding, PortfolioStatus, AssetId } from '../../types';
import { ASSETS, getAssetsByLayer, LAYER_COLORS, LAYER_NAMES } from '../../constants/assets';
import { DEFAULT_FX_RATE, FIXED_INCOME_UNIT_PRICE } from '../../constants/business';
import ActivityFeed from '../../components/ActivityFeed';
import AllocationBar from '../../components/AllocationBar';
import HoldingCard from '../../components/HoldingCard';
import TradeBottomSheet from '../../components/TradeBottomSheet';
import AddFundsSheet from '../../components/AddFundsSheet';
import RebalanceSheet from '../../components/RebalanceSheet';

// Format number with commas
const formatNumber = (num: number): string => {
  return num.toLocaleString('en-US');
};

// Calculate holding value
const calculateHoldingValue = (
  holding: Holding,
  prices: Record<string, number>,
  fxRate: number
): number => {
  if (holding.assetId === 'IRR_FIXED_INCOME') {
    return holding.quantity * FIXED_INCOME_UNIT_PRICE;
  }
  const priceUSD = prices[holding.assetId] || 0;
  return holding.quantity * priceUSD * fxRate;
};

// Status badge component
const StatusBadge: React.FC<{ status: PortfolioStatus }> = ({ status }) => {
  const statusConfig = {
    BALANCED: { text: 'Balanced', color: colors.success, icon: '✓' },
    SLIGHTLY_OFF: { text: 'Rebalance needed', color: colors.warning, icon: '⚠' },
    ATTENTION_REQUIRED: { text: 'Attention required', color: colors.error, icon: '!' },
  };

  const config = statusConfig[status];

  return (
    <View style={[styles.statusBadge, { backgroundColor: `${config.color}20` }]}>
      <Text style={styles.statusIcon}>{config.icon}</Text>
      <Text style={[styles.statusText, { color: config.color }]}>{config.text}</Text>
    </View>
  );
};

const DashboardScreen: React.FC = () => {
  const dispatch = useAppDispatch();
  const [refreshing, setRefreshing] = useState(false);
  const [showTradeSheet, setShowTradeSheet] = useState(false);
  const [showAddFundsSheet, setShowAddFundsSheet] = useState(false);
  const [showRebalanceSheet, setShowRebalanceSheet] = useState(false);
  const [selectedAssetId, setSelectedAssetId] = useState<AssetId>('BTC');
  const [tradeSide, setTradeSide] = useState<'BUY' | 'SELL'>('BUY');

  const { holdings, cashIRR, targetLayerPct, actionLog, status } = useAppSelector(
    (state) => state.portfolio
  );
  const { prices, fxRate } = useAppSelector((state) => state.prices);

  // Calculate total portfolio value
  const holdingsValueIRR = holdings.reduce(
    (sum, h) => sum + calculateHoldingValue(h, prices, fxRate),
    0
  );
  const totalValueIRR = holdingsValueIRR + cashIRR;

  // Calculate current layer percentages
  const layerValues: Record<Layer, number> = {
    FOUNDATION: 0,
    GROWTH: 0,
    UPSIDE: 0,
  };

  holdings.forEach((h) => {
    const value = calculateHoldingValue(h, prices, fxRate);
    layerValues[h.layer] += value;
  });

  const currentAllocation = {
    FOUNDATION: holdingsValueIRR > 0 ? layerValues.FOUNDATION / holdingsValueIRR : 0,
    GROWTH: holdingsValueIRR > 0 ? layerValues.GROWTH / holdingsValueIRR : 0,
    UPSIDE: holdingsValueIRR > 0 ? layerValues.UPSIDE / holdingsValueIRR : 0,
  };

  // Group holdings by layer
  const holdingsByLayer: Record<Layer, Holding[]> = {
    FOUNDATION: holdings.filter((h) => h.layer === 'FOUNDATION'),
    GROWTH: holdings.filter((h) => h.layer === 'GROWTH'),
    UPSIDE: holdings.filter((h) => h.layer === 'UPSIDE'),
  };

  const onRefresh = async () => {
    setRefreshing(true);
    // TODO: Fetch latest prices and portfolio state
    setTimeout(() => setRefreshing(false), 1000);
  };

  const showRebalanceButton = status !== 'BALANCED';

  // Handle trade initiation
  const handleTrade = (assetId?: AssetId, side: 'BUY' | 'SELL' = 'BUY') => {
    setSelectedAssetId(assetId || 'BTC');
    setTradeSide(side);
    setShowTradeSheet(true);
  };

  // Handle holding card tap
  const handleHoldingPress = (holding: Holding) => {
    setSelectedAssetId(holding.assetId);
    setTradeSide('SELL');
    setShowTradeSheet(true);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.logoCircle}>
              <Text style={styles.logoText}>B</Text>
            </View>
            <Text style={styles.headerTitle}>Blu Markets</Text>
          </View>
          <StatusBadge status={status} />
        </View>

        {/* Hero - Total Value */}
        <View style={styles.heroContainer}>
          <Text style={styles.heroLabel}>Total Portfolio Value</Text>
          <Text style={styles.heroValue}>{formatNumber(totalValueIRR)} IRR</Text>
          {cashIRR > 0 && (
            <Text style={styles.cashLabel}>
              Including {formatNumber(cashIRR)} IRR cash
            </Text>
          )}
        </View>

        {/* Allocation Bar */}
        {holdingsValueIRR > 0 && (
          <View style={styles.section}>
            <AllocationBar current={currentAllocation} target={targetLayerPct} />
          </View>
        )}

        {/* Alert Banner (if needed) */}
        {status === 'SLIGHTLY_OFF' && (
          <View style={styles.alertBanner}>
            <Text style={styles.alertIcon}>⚠️</Text>
            <Text style={styles.alertText}>
              Your portfolio has drifted from your target allocation
            </Text>
          </View>
        )}

        {/* Activity Feed */}
        <View style={styles.section}>
          <ActivityFeed entries={actionLog} maxEntries={5} />
        </View>

        {/* Holdings by Layer */}
        {(['FOUNDATION', 'GROWTH', 'UPSIDE'] as Layer[]).map((layer) => {
          const layerHoldings = holdingsByLayer[layer];
          if (layerHoldings.length === 0) return null;

          return (
            <LayerAccordion
              key={layer}
              layer={layer}
              holdings={layerHoldings}
              totalValue={layerValues[layer]}
              percentage={currentAllocation[layer]}
              prices={prices}
              fxRate={fxRate}
              onHoldingPress={handleHoldingPress}
            />
          );
        })}

        {/* Empty state */}
        {holdings.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📊</Text>
            <Text style={styles.emptyTitle}>Your portfolio is empty</Text>
            <Text style={styles.emptySubtitle}>
              Add funds to start building your portfolio
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Sticky Footer */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => setShowAddFundsSheet(true)}
        >
          <Text style={styles.secondaryButtonText}>Add Funds</Text>
        </TouchableOpacity>
        {showRebalanceButton ? (
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => setShowRebalanceSheet(true)}
          >
            <Text style={styles.primaryButtonText}>Rebalance</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => handleTrade(undefined, 'BUY')}
          >
            <Text style={styles.primaryButtonText}>Trade</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Trade Bottom Sheet */}
      <TradeBottomSheet
        visible={showTradeSheet}
        onClose={() => setShowTradeSheet(false)}
        initialAssetId={selectedAssetId}
        initialSide={tradeSide}
      />

      {/* Add Funds Sheet */}
      <AddFundsSheet
        visible={showAddFundsSheet}
        onClose={() => setShowAddFundsSheet(false)}
      />

      {/* Rebalance Sheet */}
      <RebalanceSheet
        visible={showRebalanceSheet}
        onClose={() => setShowRebalanceSheet(false)}
      />
    </SafeAreaView>
  );
};

// Layer Accordion Component
const LayerAccordion: React.FC<{
  layer: Layer;
  holdings: Holding[];
  totalValue: number;
  percentage: number;
  prices: Record<string, number>;
  fxRate: number;
  onHoldingPress?: (holding: Holding) => void;
}> = ({ layer, holdings, totalValue, percentage, prices, fxRate, onHoldingPress }) => {
  const [expanded, setExpanded] = React.useState(true);

  return (
    <View style={styles.layerSection}>
      <TouchableOpacity
        style={styles.layerHeader}
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.7}
      >
        <View style={styles.layerHeaderLeft}>
          <View
            style={[
              styles.layerDot,
              { backgroundColor: LAYER_COLORS[layer] },
            ]}
          />
          <Text style={styles.layerName}>{LAYER_NAMES[layer]}</Text>
          <Text style={styles.layerPercentage}>
            {Math.round(percentage * 100)}%
          </Text>
        </View>
        <View style={styles.layerHeaderRight}>
          <Text style={styles.layerValue}>{formatNumber(totalValue)} IRR</Text>
          <Text style={styles.expandIcon}>{expanded ? '▼' : '▶'}</Text>
        </View>
      </TouchableOpacity>

      {expanded && (
        <View style={styles.holdingsList}>
          {holdings.map((holding) => (
            <HoldingCard
              key={holding.assetId}
              holding={holding}
              priceUSD={prices[holding.assetId] || 0}
              fxRate={fxRate}
              onPress={() => onHoldingPress?.(holding)}
            />
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgDark,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing[4],
    paddingBottom: 120,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[6],
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing[2],
  },
  logoText: {
    fontSize: 18,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimaryDark,
  },
  headerTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimaryDark,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    borderRadius: borderRadius.full,
  },
  statusIcon: {
    fontSize: 12,
    marginRight: spacing[1],
  },
  statusText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  heroContainer: {
    alignItems: 'center',
    marginBottom: spacing[6],
  },
  heroLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    marginBottom: spacing[1],
  },
  heroValue: {
    fontSize: typography.fontSize['4xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimaryDark,
  },
  cashLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    marginTop: spacing[1],
  },
  section: {
    marginBottom: spacing[4],
  },
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${colors.warning}15`,
    borderRadius: borderRadius.default,
    padding: spacing[3],
    marginBottom: spacing[4],
    borderWidth: 1,
    borderColor: `${colors.warning}30`,
  },
  alertIcon: {
    fontSize: 16,
    marginRight: spacing[2],
  },
  alertText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: colors.warning,
  },
  layerSection: {
    marginBottom: spacing[4],
  },
  layerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.cardDark,
    borderRadius: borderRadius.default,
    padding: spacing[4],
  },
  layerHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  layerDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: spacing[2],
  },
  layerName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimaryDark,
    marginRight: spacing[2],
  },
  layerPercentage: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
  },
  layerHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  layerValue: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimaryDark,
    marginRight: spacing[2],
  },
  expandIcon: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  holdingsList: {
    marginTop: spacing[2],
    gap: spacing[2],
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing[8],
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: spacing[4],
  },
  emptyTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimaryDark,
    marginBottom: spacing[2],
  },
  emptySubtitle: {
    fontSize: typography.fontSize.base,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    padding: spacing[4],
    paddingBottom: spacing[8],
    backgroundColor: colors.bgDark,
    borderTopWidth: 1,
    borderTopColor: colors.borderDark,
    gap: spacing[3],
  },
  secondaryButton: {
    flex: 1,
    height: 56,
    backgroundColor: colors.surfaceDark,
    borderRadius: borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderDark,
  },
  secondaryButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimaryDark,
  },
  primaryButton: {
    flex: 1,
    height: 56,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimaryDark,
  },
});

export default DashboardScreen;
