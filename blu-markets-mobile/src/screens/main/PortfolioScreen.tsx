// Portfolio Screen
// Based on CLAUDE_CODE_HANDOFF.md - Holdings by layer view
import React, { useState, useEffect } from 'react';
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
import { useAppSelector, useAppDispatch } from '../../hooks/useStore';
import { setHoldings, updateCash, setStatus, setTargetLayerPct } from '../../store/slices/portfolioSlice';
import { fetchPrices, fetchFxRate } from '../../store/slices/pricesSlice';
import { Layer, Holding } from '../../types';
import AllocationBar from '../../components/AllocationBar';
import HoldingCard from '../../components/HoldingCard';
import { EmptyState } from '../../components/EmptyState';
import { portfolio as portfolioApi } from '../../services/api';

// Layer configuration
const LAYER_CONFIG: Record<Layer, { name: string; color: string }> = {
  FOUNDATION: { name: 'Foundation', color: COLORS.layers.foundation },
  GROWTH: { name: 'Growth', color: COLORS.layers.growth },
  UPSIDE: { name: 'Upside', color: COLORS.layers.upside },
};

const formatNumber = (num: number): string => {
  return num.toLocaleString('en-US');
};

const PortfolioScreen: React.FC = () => {
  const dispatch = useAppDispatch();
  const [refreshing, setRefreshing] = useState(false);
  const [expandedLayers, setExpandedLayers] = useState<Record<Layer, boolean>>({
    FOUNDATION: true,
    GROWTH: true,
    UPSIDE: true,
  });

  const portfolioState = useAppSelector((state) => state.portfolio);
  const holdings = portfolioState?.holdings || [];
  const cashIRR = portfolioState?.cashIRR || 0;
  const targetLayerPct = portfolioState?.targetLayerPct || { FOUNDATION: 0.5, GROWTH: 0.35, UPSIDE: 0.15 };
  const { prices, fxRate, change24h } = useAppSelector((state) => state.prices);

  // Group holdings by layer
  const holdingsByLayer: Record<Layer, Holding[]> = {
    FOUNDATION: holdings.filter((h) => h.layer === 'FOUNDATION'),
    GROWTH: holdings.filter((h) => h.layer === 'GROWTH'),
    UPSIDE: holdings.filter((h) => h.layer === 'UPSIDE'),
  };

  // Calculate values
  const calculateHoldingValue = (holding: Holding): number => {
    if (holding.assetId === 'IRR_FIXED_INCOME') {
      return holding.quantity * 500000;
    }
    const priceUSD = prices[holding.assetId] || 0;
    return holding.quantity * priceUSD * fxRate;
  };

  const layerValues: Record<Layer, number> = {
    FOUNDATION: holdingsByLayer.FOUNDATION.reduce((sum, h) => sum + calculateHoldingValue(h), 0),
    GROWTH: holdingsByLayer.GROWTH.reduce((sum, h) => sum + calculateHoldingValue(h), 0),
    UPSIDE: holdingsByLayer.UPSIDE.reduce((sum, h) => sum + calculateHoldingValue(h), 0),
  };

  const holdingsValueIRR = Object.values(layerValues).reduce((a, b) => a + b, 0);
  const totalValueIRR = holdingsValueIRR + cashIRR;

  const currentAllocation = {
    FOUNDATION: holdingsValueIRR > 0 ? layerValues.FOUNDATION / holdingsValueIRR : 0,
    GROWTH: holdingsValueIRR > 0 ? layerValues.GROWTH / holdingsValueIRR : 0,
    UPSIDE: holdingsValueIRR > 0 ? layerValues.UPSIDE / holdingsValueIRR : 0,
  };

  const toggleLayer = (layer: Layer) => {
    setExpandedLayers((prev) => ({ ...prev, [layer]: !prev[layer] }));
  };

  // Fetch portfolio from backend on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [portfolioResponse] = await Promise.all([
          portfolioApi.get(),
          dispatch(fetchPrices()),
          dispatch(fetchFxRate()),
        ]);

        // Sync backend data to Redux
        dispatch(updateCash(portfolioResponse.cashIrr));
        dispatch(setStatus(portfolioResponse.status));
        dispatch(setTargetLayerPct(portfolioResponse.targetAllocation));
        if (portfolioResponse.holdings) {
          dispatch(setHoldings(portfolioResponse.holdings.map((h: Holding) => ({
            assetId: h.assetId,
            quantity: h.quantity,
            frozen: h.frozen,
            layer: h.layer,
          }))));
        }
      } catch (error) {
        console.error('Failed to fetch portfolio:', error);
      }
    };
    fetchData();
  }, [dispatch]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      // Fetch portfolio, prices, and FX rate in parallel
      const [portfolioResponse] = await Promise.all([
        portfolioApi.get(),
        dispatch(fetchPrices()),
        dispatch(fetchFxRate()),
      ]);

      // Update Redux state with fresh portfolio data
      dispatch(updateCash(portfolioResponse.cashIrr));
      dispatch(setStatus(portfolioResponse.status));
      dispatch(setTargetLayerPct(portfolioResponse.targetAllocation));
      if (portfolioResponse.holdings) {
        dispatch(setHoldings(portfolioResponse.holdings.map((h: Holding) => ({
          assetId: h.assetId,
          quantity: h.quantity,
          frozen: h.frozen,
          layer: h.layer,
        }))));
      }
    } catch (error) {
      console.error('Failed to refresh portfolio:', error);
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
          <Text style={styles.valueLabel}>Total Holdings Value</Text>
          <Text style={styles.valueAmount}>{formatNumber(holdingsValueIRR)} IRR</Text>
          <Text style={styles.cashLabel}>+ {formatNumber(cashIRR)} IRR cash</Text>
        </View>

        {/* Allocation Bar */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Allocation</Text>
          <AllocationBar current={currentAllocation} target={targetLayerPct} />
        </View>

        {/* Holdings by Layer */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Holdings</Text>

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
                  style={styles.layerHeader}
                  onPress={() => toggleLayer(layer)}
                  activeOpacity={0.7}
                >
                  <View style={styles.layerHeaderLeft}>
                    <View style={[styles.layerDot, { backgroundColor: config.color }]} />
                    <Text style={styles.layerName}>{config.name}</Text>
                    <Text style={styles.layerCount}>({layerHoldings.length})</Text>
                  </View>
                  <View style={styles.layerHeaderRight}>
                    <Text style={styles.layerValue}>{formatNumber(layerValues[layer])} IRR</Text>
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
                        fxRate={fxRate}
                        change24h={change24h?.[holding.assetId]}
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
    marginBottom: SPACING[3],
  },
  layerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.background.surface,
    borderRadius: RADIUS.md,
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
  layerValue: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
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
  emptyLayer: {
    padding: SPACING[4],
    alignItems: 'center',
  },
  emptyText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.muted,
  },
});

export default PortfolioScreen;
