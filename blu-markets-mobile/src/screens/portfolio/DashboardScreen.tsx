/**
 * DashboardScreen
 * Design System: Blu Markets
 * Target: iPhone 16 Pro (393 x 852)
 *
 * Main portfolio dashboard with Activity Feed as HERO element
 * Uses Foundation/Growth/Upside layer naming
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  RefreshControl,
  StatusBar,
} from 'react-native';
import { COLORS, BOUNDARY_BG } from '../../constants/colors';
import { TYPOGRAPHY } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';
import { LAYOUT, DEVICE } from '../../constants/layout';
import { Button, Badge, Card } from '../../components/common';
import { useAppSelector, useAppDispatch } from '../../hooks/useStore';
import usePriceWebSocket from '../../hooks/usePriceWebSocket';
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

// Status badge component using design system
const StatusBadge: React.FC<{ status: PortfolioStatus }> = ({ status }) => {
  const badgeVariant = {
    BALANCED: 'boundary-safe' as const,
    SLIGHTLY_OFF: 'boundary-drift' as const,
    ATTENTION_REQUIRED: 'boundary-stress' as const,
  };

  const statusText = {
    BALANCED: 'Balanced',
    SLIGHTLY_OFF: 'Rebalance needed',
    ATTENTION_REQUIRED: 'Attention required',
  };

  return (
    <Badge variant={badgeVariant[status]} size="md" label={statusText[status]} />
  );
};

// Connection indicator component
const ConnectionIndicator: React.FC<{ isConnected: boolean; updatedAt: string }> = ({
  isConnected,
  updatedAt,
}) => {
  const lastUpdate = updatedAt
    ? new Date(updatedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    : '--:--';

  return (
    <View style={styles.connectionIndicator}>
      <View
        style={[
          styles.connectionDot,
          { backgroundColor: isConnected ? COLORS.semantic.success : COLORS.text.muted },
        ]}
      />
      <Text style={styles.connectionText}>
        {isConnected ? 'Live' : 'Offline'} · {lastUpdate}
      </Text>
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

  // Use WebSocket for real-time price updates
  const { isConnected, updatedAt, refresh: refreshPrices } = usePriceWebSocket();

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

  // Calculate current layer percentages using ASSET CONFIG layer (not holding.layer)
  const layerValues: Record<Layer, number> = {
    FOUNDATION: 0,
    GROWTH: 0,
    UPSIDE: 0,
  };

  holdings.forEach((h) => {
    const value = calculateHoldingValue(h, prices, fxRate);
    // Use asset config layer, not the stored holding layer
    const assetLayer = ASSETS[h.assetId]?.layer || h.layer;
    layerValues[assetLayer] += value;
  });

  const currentAllocation = {
    FOUNDATION: holdingsValueIRR > 0 ? layerValues.FOUNDATION / holdingsValueIRR : 0,
    GROWTH: holdingsValueIRR > 0 ? layerValues.GROWTH / holdingsValueIRR : 0,
    UPSIDE: holdingsValueIRR > 0 ? layerValues.UPSIDE / holdingsValueIRR : 0,
  };

  // Calculate portfolio status based on allocation drift
  const getPortfolioStatus = (): PortfolioStatus => {
    if (holdingsValueIRR === 0) return 'BALANCED';

    const drifts = [
      Math.abs(currentAllocation.FOUNDATION - targetLayerPct.FOUNDATION),
      Math.abs(currentAllocation.GROWTH - targetLayerPct.GROWTH),
      Math.abs(currentAllocation.UPSIDE - targetLayerPct.UPSIDE),
    ];
    const maxDrift = Math.max(...drifts);

    if (maxDrift > 0.10) return 'ATTENTION_REQUIRED'; // >10% drift
    if (maxDrift > 0.05) return 'SLIGHTLY_OFF'; // >5% drift
    return 'BALANCED';
  };

  const calculatedStatus = getPortfolioStatus();

  // Group holdings by layer using ASSET CONFIG layer
  const holdingsByLayer: Record<Layer, Holding[]> = {
    FOUNDATION: holdings.filter((h) => (ASSETS[h.assetId]?.layer || h.layer) === 'FOUNDATION'),
    GROWTH: holdings.filter((h) => (ASSETS[h.assetId]?.layer || h.layer) === 'GROWTH'),
    UPSIDE: holdings.filter((h) => (ASSETS[h.assetId]?.layer || h.layer) === 'UPSIDE'),
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshPrices();
    } catch (error) {
      console.error('Failed to refresh prices:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const showRebalanceButton = calculatedStatus !== 'BALANCED';

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
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background.primary} />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.brand.primary}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.logoCircle}>
              <Text style={styles.logoText}>B</Text>
            </View>
            <View>
              <Text style={styles.headerTitle}>Blu Markets</Text>
              <ConnectionIndicator isConnected={isConnected} updatedAt={updatedAt} />
            </View>
          </View>
          <StatusBadge status={calculatedStatus} />
        </View>

        {/* Activity Feed - HERO element (40% above fold, first visible content) */}
        <View style={styles.activitySection}>
          <ActivityFeed entries={actionLog} maxEntries={5} />
        </View>

        {/* Portfolio Value */}
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
        {(calculatedStatus === 'SLIGHTLY_OFF' || calculatedStatus === 'ATTENTION_REQUIRED') && (
          <View style={styles.alertBanner}>
            <Text style={styles.alertIcon}>⚠️</Text>
            <Text style={styles.alertText}>
              Your portfolio has drifted from your target allocation
            </Text>
          </View>
        )}

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
        <Button
          label="Add Funds"
          variant="secondary"
          size="lg"
          onPress={() => setShowAddFundsSheet(true)}
          style={styles.footerButton}
        />
        <Button
          label={showRebalanceButton ? 'Rebalance' : 'Trade'}
          variant="primary"
          size="lg"
          onPress={() => showRebalanceButton ? setShowRebalanceSheet(true) : handleTrade(undefined, 'BUY')}
          style={styles.footerButton}
        />
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
interface LayerAccordionProps {
  layer: Layer;
  holdings: Holding[];
  totalValue: number;
  percentage: number;
  prices: Record<string, number>;
  fxRate: number;
  onHoldingPress?: (holding: Holding) => void;
}

const LayerAccordion: React.FC<LayerAccordionProps> = ({
  layer,
  holdings,
  totalValue,
  percentage,
  prices,
  fxRate,
  onHoldingPress,
}) => {
  const [expanded, setExpanded] = React.useState(true);

  // Get layer color from design system
  const layerColorMap: Record<Layer, string> = {
    FOUNDATION: COLORS.layers.foundation,
    GROWTH: COLORS.layers.growth,
    UPSIDE: COLORS.layers.upside,
  };

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
              { backgroundColor: layerColorMap[layer] },
            ]}
          />
          <Text style={styles.layerName}>{LAYER_NAMES[layer]}</Text>
          <Text style={[styles.layerPercentage, { color: layerColorMap[layer] }]}>
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
    backgroundColor: COLORS.background.primary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: LAYOUT.screenPaddingH,
    paddingTop: SPACING[4],
    paddingBottom: LAYOUT.totalBottomSpace + 80, // Extra space for footer
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING[6],
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.brand.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING[3],
  },
  logoText: {
    fontSize: 20,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text.inverse,
  },
  headerTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text.primary,
  },
  heroContainer: {
    alignItems: 'center',
    marginBottom: SPACING[6],
    padding: SPACING[5],
    backgroundColor: COLORS.background.elevated,
    borderRadius: RADIUS.xl,
  },
  heroLabel: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
    marginBottom: SPACING[1],
  },
  heroValue: {
    fontSize: 36,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text.primary,
  },
  cashLabel: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.muted,
    marginTop: SPACING[1],
  },
  section: {
    marginBottom: SPACING[4],
  },
  activitySection: {
    marginBottom: SPACING[4],
    // Activity Feed is HERO - prominent placement
  },
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BOUNDARY_BG.drift,
    borderRadius: RADIUS.lg,
    padding: SPACING[4],
    marginBottom: SPACING[4],
    borderWidth: 1,
    borderColor: `${COLORS.boundary.drift}30`,
  },
  alertIcon: {
    fontSize: 16,
    marginRight: SPACING[2],
  },
  alertText: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.boundary.drift,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
  layerSection: {
    marginBottom: SPACING[4],
  },
  layerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.background.elevated,
    borderRadius: RADIUS.lg,
    padding: SPACING[4],
  },
  layerHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  layerDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: SPACING[2],
  },
  layerName: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.primary,
    marginRight: SPACING[2],
  },
  layerPercentage: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },
  layerHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  layerValue: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.primary,
    marginRight: SPACING[2],
  },
  expandIcon: {
    fontSize: 12,
    color: COLORS.text.muted,
  },
  holdingsList: {
    marginTop: SPACING[2],
    gap: SPACING[2],
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: SPACING[10],
    paddingHorizontal: SPACING[6],
    backgroundColor: COLORS.background.elevated,
    borderRadius: RADIUS.xl,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: SPACING[4],
  },
  emptyTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.primary,
    marginBottom: SPACING[2],
  },
  emptySubtitle: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text.secondary,
    textAlign: 'center',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    paddingHorizontal: LAYOUT.screenPaddingH,
    paddingTop: SPACING[3],
    paddingBottom: LAYOUT.totalBottomSpace,
    backgroundColor: COLORS.background.primary,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: SPACING[3],
  },
  footerButton: {
    flex: 1,
  },
  connectionIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  connectionDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  connectionText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.text.muted,
  },
});

export default DashboardScreen;
