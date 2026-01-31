// Portfolio Screen
// Based on CLAUDE_CODE_HANDOFF.md - Holdings by layer view
import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../../constants/colors';
import { TYPOGRAPHY } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';
import { useAppSelector } from '../../hooks/useStore';
import { usePortfolioSync } from '../../hooks/usePortfolioSync';
import { Layer, Holding, PortfolioStatus } from '../../types';
import HoldingCard from '../../components/HoldingCard';
import { EmptyState } from '../../components/EmptyState';
import { formatIRR } from '../../utils/currency';
import { PORTFOLIO_EXPLAINERS, getLayerPosition } from '../../constants/messages';
import { hasSeenPortfolioTooltip, markPortfolioTooltipSeen } from '../../utils/storage';

// Layer configuration
const LAYER_CONFIG: Record<Layer, { name: string; color: string }> = {
  FOUNDATION: { name: 'Foundation', color: COLORS.layers.foundation },
  GROWTH: { name: 'Growth', color: COLORS.layers.growth },
  UPSIDE: { name: 'Upside', color: COLORS.layers.upside },
};

const PortfolioScreen: React.FC = () => {
  const [refreshing, setRefreshing] = useState(false);
  const [expandedLayers, setExpandedLayers] = useState<Record<Layer, boolean>>({
    FOUNDATION: true,
    GROWTH: true,
    UPSIDE: true,
  });
  // REC-1: First-time portfolio health tooltip
  const [showHealthTooltip, setShowHealthTooltip] = useState(false);

  // REC-1: Check if user has seen portfolio tooltip on first mount
  useEffect(() => {
    const checkTooltip = async () => {
      const seen = await hasSeenPortfolioTooltip();
      if (!seen) {
        setShowHealthTooltip(true);
      }
    };
    checkTooltip();
  }, []);

  const dismissHealthTooltip = async () => {
    setShowHealthTooltip(false);
    await markPortfolioTooltipSeen();
  };

  // Use centralized portfolio sync - handles RTK Query and Redux sync
  const { refetchPortfolio } = usePortfolioSync();

  // Granular selectors - only re-render when specific fields change
  const holdings = useAppSelector((state) => state.portfolio.holdings) || [];
  const cashIRR = useAppSelector((state) => state.portfolio.cashIRR) || 0;
  const targetLayerPct = useAppSelector((state) => state.portfolio.targetLayerPct) || { FOUNDATION: 0.5, GROWTH: 0.35, UPSIDE: 0.15 };
  // Backend-calculated values (frontend is presentation layer only)
  const holdingsValueIRR = useAppSelector((state) => state.portfolio.holdingsValueIrr) || 0;
  const currentAllocation = useAppSelector((state) => state.portfolio.currentAllocation) || { FOUNDATION: 0, GROWTH: 0, UPSIDE: 0 };
  const portfolioStatus = useAppSelector((state) => state.portfolio.status) as PortfolioStatus || 'BALANCED';
  const { prices, pricesIrr, fxRate, change24h } = useAppSelector((state) => state.prices);

  // Calculate total value for display (holdings + cash)
  const totalValue = holdingsValueIRR + cashIRR;

  // Use holdings value for allocation percentages (matches backend calculation)
  // This makes layer percentages add up to 100% and matches status determination

  // Group holdings by layer
  const holdingsByLayer: Record<Layer, Holding[]> = {
    FOUNDATION: holdings.filter((h) => h.layer === 'FOUNDATION'),
    GROWTH: holdings.filter((h) => h.layer === 'GROWTH'),
    UPSIDE: holdings.filter((h) => h.layer === 'UPSIDE'),
  };

  // BUG FIX: Calculate layer values by summing actual holding values in each layer
  // This matches the React web app's snapshot.ts approach
  const layerValues = useMemo(() => {
    const values: Record<Layer, number> = { FOUNDATION: 0, GROWTH: 0, UPSIDE: 0 };

    for (const holding of holdings) {
      const layer = holding.layer as Layer;
      if (!values.hasOwnProperty(layer)) continue;

      // Calculate holding value using direct IRR price (preferred) or USD * fxRate
      let valueIrr = 0;
      if (holding.assetId === 'IRR_FIXED_INCOME') {
        // Fixed Income: quantity represents units at 500,000 IRR each
        valueIrr = holding.quantity * 500_000;
      } else {
        const pIrr = pricesIrr?.[holding.assetId];
        if (pIrr && pIrr > 0) {
          valueIrr = holding.quantity * pIrr;
        } else {
          const priceUsd = prices[holding.assetId] || 0;
          valueIrr = holding.quantity * priceUsd * fxRate;
        }
      }

      values[layer] += valueIrr;
    }

    return values;
  }, [holdings, prices, pricesIrr, fxRate]);

  const toggleLayer = (layer: Layer) => {
    setExpandedLayers((prev) => ({ ...prev, [layer]: !prev[layer] }));
  };

  // Portfolio data is fetched by usePortfolioSync in MainTabNavigator
  // No need to fetch on mount - data is already in Redux from centralized sync

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      // Use centralized refetch - handles API call and Redux sync
      await refetchPortfolio();
    } catch (error) {
      if (__DEV__) console.error('Failed to refresh portfolio:', error);
    } finally {
      setRefreshing(false);
    }
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
            tintColor={COLORS.brand.primary}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Portfolio</Text>
        </View>

        {/* Total Value Card */}
        <View style={styles.valueCard}>
          <Text style={styles.valueLabel}>Total Value</Text>
          <Text style={styles.valueAmount}>{formatIRR(holdingsValueIRR)}</Text>
          <Text style={styles.cashLabel}>+ {formatIRR(cashIRR)} cash</Text>
        </View>

        {/* Target Allocation Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Target Allocation</Text>

          {/* Single Allocation Bar (Target) */}
          <View style={styles.allocationBar}>
            <View style={[styles.barSegment, { flex: targetLayerPct.FOUNDATION, backgroundColor: LAYER_CONFIG.FOUNDATION.color }]} />
            <View style={[styles.barSegment, { flex: targetLayerPct.GROWTH, backgroundColor: LAYER_CONFIG.GROWTH.color }]} />
            <View style={[styles.barSegment, { flex: targetLayerPct.UPSIDE, backgroundColor: LAYER_CONFIG.UPSIDE.color }]} />
          </View>

          {/* Legend */}
          <View style={styles.allocationLegend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: LAYER_CONFIG.FOUNDATION.color }]} />
              <Text style={styles.legendText}>Foundation {Math.round(targetLayerPct.FOUNDATION * 100)}%</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: LAYER_CONFIG.GROWTH.color }]} />
              <Text style={styles.legendText}>Growth {Math.round(targetLayerPct.GROWTH * 100)}%</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: LAYER_CONFIG.UPSIDE.color }]} />
              <Text style={styles.legendText}>Upside {Math.round(targetLayerPct.UPSIDE * 100)}%</Text>
            </View>
          </View>

          {/* PCD-Compliant Explainer */}
          <View style={styles.explainerContainer}>
            <Text style={styles.explainerMain}>
              {PORTFOLIO_EXPLAINERS[portfolioStatus].main}
            </Text>

            {/* Per-layer breakdown for SLIGHTLY_OFF and ATTENTION_REQUIRED */}
            {portfolioStatus !== 'BALANCED' && (
              <View style={styles.explainerLayers}>
                {(['FOUNDATION', 'GROWTH', 'UPSIDE'] as const).map((layer) => {
                  const currentPct = Math.round(currentAllocation[layer] * 100);
                  const targetPct = Math.round(targetLayerPct[layer] * 100);
                  const position = getLayerPosition(currentPct, targetPct);

                  // For SLIGHTLY_OFF, only show layers that drifted
                  if (portfolioStatus === 'SLIGHTLY_OFF' && position === 'close') {
                    return null;
                  }

                  const explainer = PORTFOLIO_EXPLAINERS[portfolioStatus];
                  if (!('layers' in explainer)) return null;

                  return (
                    <Text key={layer} style={styles.explainerLayerText}>
                      {explainer.layers[layer][position]}
                    </Text>
                  );
                })}
              </View>
            )}
          </View>

          {/* REC-1: First-time Portfolio Health Tooltip */}
          {showHealthTooltip && (
            <TouchableOpacity
              style={styles.healthTooltipOverlay}
              onPress={dismissHealthTooltip}
              activeOpacity={1}
            >
              <View style={styles.healthTooltipBox}>
                <Text style={styles.healthTooltipTitle}>Understanding Your Portfolio</Text>
                <Text style={styles.healthTooltipText}>
                  Your portfolio is organized into three layers:{'\n\n'}
                  • <Text style={styles.healthTooltipBold}>Foundation</Text> — Stable assets for long-term security{'\n'}
                  • <Text style={styles.healthTooltipBold}>Growth</Text> — Balanced assets for steady returns{'\n'}
                  • <Text style={styles.healthTooltipBold}>Upside</Text> — Higher risk assets for potential growth{'\n\n'}
                  The allocation bar shows how your holdings compare to your target profile.
                </Text>
                <Text style={styles.healthTooltipDismiss}>Tap anywhere to dismiss</Text>
              </View>
            </TouchableOpacity>
          )}
        </View>

        {/* Your Holdings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Holdings</Text>
          {holdings.length === 0 ? (
            <EmptyState
              icon="pie-chart"
              title="No Holdings Yet"
              description="Start building your portfolio by adding funds and trading"
            />
          ) : (['FOUNDATION', 'GROWTH', 'UPSIDE'] as Layer[]).map((layer) => {
            const config = LAYER_CONFIG[layer];
            const layerHoldings = holdingsByLayer[layer];
            const isExpanded = expandedLayers[layer];

            return (
              <View key={layer} style={styles.layerSection}>
                <TouchableOpacity
                  style={[styles.layerHeader, { borderLeftColor: config.color }]}
                  onPress={() => toggleLayer(layer)}
                  activeOpacity={0.7}
                >
                  <View style={styles.layerHeaderLeft}>
                    <View style={[styles.layerDot, { backgroundColor: config.color }]} />
                    <Text style={styles.layerName}>{config.name}</Text>
                    <Text style={styles.layerCount}>({layerHoldings.length})</Text>
                  </View>
                  <View style={styles.layerHeaderRight}>
                    <View style={styles.layerValueContainer}>
                      <Text style={styles.layerValue}>
                        {formatIRR(layerValues[layer], { showUnit: false })} IRR
                      </Text>
                      <Text style={styles.layerPercent}>
                        {holdingsValueIRR > 0 ? Math.round((layerValues[layer] / holdingsValueIRR) * 100) : 0}%
                      </Text>
                    </View>
                    <Text style={styles.expandIcon}>{isExpanded ? '▼' : '▶'}</Text>
                  </View>
                </TouchableOpacity>

                {isExpanded && layerHoldings.length > 0 && (
                  <View style={styles.holdingsList}>
                    {layerHoldings.map((holding) => (
                      <HoldingCard
                        key={holding.assetId}
                        holding={holding}
                        priceUSD={prices[holding.assetId] || 0}
                        priceIRR={pricesIrr?.[holding.assetId]}
                        fxRate={fxRate}
                        change24h={change24h?.[holding.assetId]}
                        purchasedAt={holding.purchasedAt}
                      />
                    ))}
                  </View>
                )}

                {isExpanded && layerHoldings.length === 0 && (
                  <View style={styles.emptyLayer}>
                    <Text style={styles.emptyText}>No holdings in this layer</Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
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
    padding: SPACING[4],
    paddingBottom: 100,
  },
  header: {
    marginBottom: SPACING[6],
  },
  title: {
    fontSize: TYPOGRAPHY.fontSize['2xl'],
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text.primary,
  },
  valueCard: {
    backgroundColor: COLORS.background.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING[5],
    marginBottom: SPACING[6],
    alignItems: 'center',
  },
  valueLabel: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
    marginBottom: SPACING[1],
  },
  valueAmount: {
    fontSize: TYPOGRAPHY.fontSize['3xl'],
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text.primary,
  },
  cashLabel: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.muted,
    marginTop: SPACING[1],
  },
  section: {
    marginBottom: SPACING[6],
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.primary,
    marginBottom: SPACING[3],
  },
  layerSection: {
    marginBottom: SPACING[5],
  },
  layerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.background.elevated,
    borderRadius: RADIUS.md,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: SPACING[2],
    borderLeftWidth: 3,
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
  },
  layerCount: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.muted,
    marginLeft: SPACING[2],
  },
  layerHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  layerValueContainer: {
    alignItems: 'flex-end',
    marginRight: SPACING[3],
  },
  layerValue: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text.primary,
  },
  layerPercent: {
    fontSize: 14,
    color: COLORS.text.secondary,
    marginTop: 2,
  },
  expandIcon: {
    fontSize: 12,
    color: COLORS.text.muted,
  },
  holdingsList: {
    gap: SPACING[2],
    paddingLeft: SPACING[1],
  },
  emptyLayer: {
    padding: SPACING[4],
    alignItems: 'center',
  },
  emptyText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.muted,
  },
  // Allocation Bar styles
  allocationBar: {
    flexDirection: 'row',
    height: 12,
    borderRadius: 6,
    overflow: 'hidden',
  },
  barSegment: {
    height: '100%',
  },
  // Legend styles
  allocationLegend: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: SPACING[2],
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: SPACING[1],
  },
  legendText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.text.secondary,
  },
  // Explainer styles
  explainerContainer: {
    marginTop: SPACING[4],
    paddingHorizontal: SPACING[1],
  },
  explainerMain: {
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.text.secondary,
  },
  explainerLayers: {
    marginTop: SPACING[3],
    gap: SPACING[2],
  },
  explainerLayerText: {
    fontSize: 13,
    lineHeight: 18,
    color: COLORS.text.muted,
  },
  // REC-1: Health Tooltip styles
  healthTooltipOverlay: {
    marginTop: SPACING[4],
    backgroundColor: COLORS.brand.primary + '10',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.brand.primary + '30',
  },
  healthTooltipBox: {
    padding: SPACING[4],
  },
  healthTooltipTitle: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.brand.primary,
    marginBottom: SPACING[3],
  },
  healthTooltipText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    lineHeight: 22,
    color: COLORS.text.secondary,
  },
  healthTooltipBold: {
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.primary,
  },
  healthTooltipDismiss: {
    marginTop: SPACING[3],
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.text.muted,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

export default PortfolioScreen;
