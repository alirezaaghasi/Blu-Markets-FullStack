// Rebalance Bottom Sheet
// Based on PRD Section 6.3 - Rebalance Flow
import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Animated,
} from 'react-native';
import { colors, typography, spacing, borderRadius } from '../constants/theme';
import { useAppSelector, useAppDispatch } from '../hooks/useStore';
import { Layer, Holding, AssetId, Boundary, RebalanceTrade } from '../types';
import { ASSETS, LAYER_COLORS, LAYER_NAMES, getAssetsByLayer } from '../constants/assets';
import {
  MIN_REBALANCE_TRADE,
  DRIFT_TOLERANCE,
  SPREAD_BY_LAYER,
  FIXED_INCOME_UNIT_PRICE,
  BOUNDARY_MESSAGES,
} from '../constants/business';
import { executeRebalance } from '../store/slices/portfolioSlice';

interface RebalanceSheetProps {
  visible: boolean;
  onClose: () => void;
}

type RebalanceMode = 'HOLDINGS_ONLY' | 'HOLDINGS_PLUS_CASH' | 'SMART';

// Format number with commas
const formatNumber = (num: number): string => {
  return Math.round(num).toLocaleString('en-US');
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

// Calculate rebalance trades
interface RebalanceResult {
  trades: RebalanceTrade[];
  beforeAllocation: Record<Layer, number>;
  afterAllocation: Record<Layer, number>;
  residualDrift: number;
  hasLockedCollateral: boolean;
  cashDeployed: number;
  boundary: Boundary;
  canExecute: boolean;
  message: string;
}

const calculateRebalance = (
  holdings: Holding[],
  cashIRR: number,
  targetLayerPct: Record<Layer, number>,
  prices: Record<string, number>,
  fxRate: number,
  mode: RebalanceMode
): RebalanceResult => {
  const trades: RebalanceTrade[] = [];

  // Calculate current values by layer
  const layerValues: Record<Layer, number> = { FOUNDATION: 0, GROWTH: 0, UPSIDE: 0 };
  const frozenByLayer: Record<Layer, number> = { FOUNDATION: 0, GROWTH: 0, UPSIDE: 0 };
  const unfrozenByLayer: Record<Layer, number> = { FOUNDATION: 0, GROWTH: 0, UPSIDE: 0 };

  holdings.forEach((h) => {
    const value = calculateHoldingValue(h, prices, fxRate);
    layerValues[h.layer] += value;
    if (h.frozen) {
      frozenByLayer[h.layer] += value;
    } else {
      unfrozenByLayer[h.layer] += value;
    }
  });

  const totalHoldingsValue = Object.values(layerValues).reduce((a, b) => a + b, 0);
  const hasLockedCollateral = Object.values(frozenByLayer).some(v => v > 0);

  // Calculate before allocation
  const beforeAllocation: Record<Layer, number> = {
    FOUNDATION: totalHoldingsValue > 0 ? layerValues.FOUNDATION / totalHoldingsValue : 0,
    GROWTH: totalHoldingsValue > 0 ? layerValues.GROWTH / totalHoldingsValue : 0,
    UPSIDE: totalHoldingsValue > 0 ? layerValues.UPSIDE / totalHoldingsValue : 0,
  };

  // Determine pool to rebalance
  let rebalancePool = totalHoldingsValue;
  let cashToUse = 0;

  if (mode === 'HOLDINGS_PLUS_CASH') {
    rebalancePool = totalHoldingsValue + cashIRR;
    cashToUse = cashIRR;
  } else if (mode === 'SMART' && cashIRR > 0) {
    // SMART mode: Use cash only if it helps achieve balance
    rebalancePool = totalHoldingsValue + cashIRR;
    cashToUse = cashIRR;
  }

  // Target values
  const targetValues: Record<Layer, number> = {
    FOUNDATION: rebalancePool * targetLayerPct.FOUNDATION,
    GROWTH: rebalancePool * targetLayerPct.GROWTH,
    UPSIDE: rebalancePool * targetLayerPct.UPSIDE,
  };

  // Calculate differences (positive = need to buy, negative = need to sell)
  const diffs: Record<Layer, number> = {
    FOUNDATION: targetValues.FOUNDATION - layerValues.FOUNDATION,
    GROWTH: targetValues.GROWTH - layerValues.GROWTH,
    UPSIDE: targetValues.UPSIDE - layerValues.UPSIDE,
  };

  // Determine sells (from layers with surplus)
  const layers: Layer[] = ['FOUNDATION', 'GROWTH', 'UPSIDE'];
  let totalSellAmount = 0;

  layers.forEach((layer) => {
    if (diffs[layer] < -MIN_REBALANCE_TRADE) {
      // Need to sell from this layer
      const sellAmount = Math.min(Math.abs(diffs[layer]), unfrozenByLayer[layer]);
      if (sellAmount >= MIN_REBALANCE_TRADE) {
        // Find best asset to sell (prefer largest holding)
        const layerHoldings = holdings
          .filter(h => h.layer === layer && !h.frozen)
          .sort((a, b) => {
            const valueA = calculateHoldingValue(a, prices, fxRate);
            const valueB = calculateHoldingValue(b, prices, fxRate);
            return valueB - valueA;
          });

        let remainingToSell = sellAmount;
        layerHoldings.forEach((holding) => {
          if (remainingToSell < MIN_REBALANCE_TRADE) return;
          const holdingValue = calculateHoldingValue(holding, prices, fxRate);
          const sellFromHolding = Math.min(remainingToSell, holdingValue);

          if (sellFromHolding >= MIN_REBALANCE_TRADE) {
            trades.push({
              side: 'SELL',
              assetId: holding.assetId,
              amountIRR: sellFromHolding,
              layer,
            });
            totalSellAmount += sellFromHolding;
            remainingToSell -= sellFromHolding;
          }
        });
      }
    }
  });

  // Determine buys (for layers with deficit)
  const totalBuyBudget = totalSellAmount + cashToUse;
  let remainingBudget = totalBuyBudget;

  // Sort layers by deficit (largest deficit first)
  const deficitLayers = layers
    .filter(layer => diffs[layer] > MIN_REBALANCE_TRADE)
    .sort((a, b) => diffs[b] - diffs[a]);

  deficitLayers.forEach((layer) => {
    if (remainingBudget < MIN_REBALANCE_TRADE) return;

    const buyAmount = Math.min(diffs[layer], remainingBudget);
    if (buyAmount >= MIN_REBALANCE_TRADE) {
      // Find best asset to buy (prefer most liquid)
      const layerAssets = getAssetsByLayer(layer)
        .filter(a => a.id !== 'IRR_FIXED_INCOME')
        .sort((a, b) => b.liquidity - a.liquidity);

      if (layerAssets.length > 0) {
        trades.push({
          side: 'BUY',
          assetId: layerAssets[0].id,
          amountIRR: buyAmount,
          layer,
        });
        remainingBudget -= buyAmount;
      }
    }
  });

  // Calculate after allocation
  const afterLayerValues = { ...layerValues };
  trades.forEach((trade) => {
    if (trade.side === 'SELL') {
      afterLayerValues[trade.layer] -= trade.amountIRR;
    } else {
      // Account for spread on buys
      const netAmount = trade.amountIRR * (1 - SPREAD_BY_LAYER[trade.layer]);
      afterLayerValues[trade.layer] += netAmount;
    }
  });

  // Add deployed cash to appropriate layers
  if (cashToUse > 0) {
    // Cash is added via buy trades, already counted above
  }

  const totalAfterValue = Object.values(afterLayerValues).reduce((a, b) => a + b, 0);
  const afterAllocation: Record<Layer, number> = {
    FOUNDATION: totalAfterValue > 0 ? afterLayerValues.FOUNDATION / totalAfterValue : 0,
    GROWTH: totalAfterValue > 0 ? afterLayerValues.GROWTH / totalAfterValue : 0,
    UPSIDE: totalAfterValue > 0 ? afterLayerValues.UPSIDE / totalAfterValue : 0,
  };

  // Calculate residual drift
  const driftCalc = layers.map(layer =>
    Math.abs(afterAllocation[layer] - targetLayerPct[layer])
  );
  const residualDrift = Math.max(...driftCalc);

  // Determine boundary
  let boundary: Boundary = 'SAFE';
  let message = 'Your portfolio is now on target.';

  if (residualDrift > DRIFT_TOLERANCE) {
    boundary = 'STRUCTURAL';
    message = "Your portfolio couldn't be fully rebalanced.";
    if (hasLockedCollateral) {
      message += ' Some assets are locked as collateral for your loans.';
    }
    if (residualDrift >= 0.005) {
      message += ` Remaining drift: ${(residualDrift * 100).toFixed(1)}% from target.`;
    }
  }

  const canExecute = trades.length > 0;

  return {
    trades,
    beforeAllocation,
    afterAllocation,
    residualDrift,
    hasLockedCollateral,
    cashDeployed: mode === 'HOLDINGS_ONLY' ? 0 : cashToUse,
    boundary,
    canExecute,
    message,
  };
};

const RebalanceSheet: React.FC<RebalanceSheetProps> = ({ visible, onClose }) => {
  const dispatch = useAppDispatch();
  const [mode, setMode] = useState<RebalanceMode>('HOLDINGS_ONLY');
  const [showTrades, setShowTrades] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);

  const { holdings, cashIRR, targetLayerPct } = useAppSelector(
    (state) => state.portfolio
  );
  const { prices, fxRate } = useAppSelector((state) => state.prices);

  // Calculate rebalance preview
  const result = useMemo(() => {
    return calculateRebalance(holdings, cashIRR, targetLayerPct, prices, fxRate, mode);
  }, [holdings, cashIRR, targetLayerPct, prices, fxRate, mode]);

  const handleConfirm = async () => {
    if (!result.canExecute) return;

    setIsExecuting(true);

    // Execute rebalance
    dispatch(executeRebalance({
      trades: result.trades,
      mode,
      cashDeployed: result.cashDeployed,
      boundary: result.boundary,
      prices,
      fxRate,
    }));

    setTimeout(() => {
      setIsExecuting(false);
      onClose();
    }, 500);
  };

  const sellTrades = result.trades.filter(t => t.side === 'SELL');
  const buyTrades = result.trades.filter(t => t.side === 'BUY');

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          {/* Drag handle */}
          <View style={styles.dragHandle} />

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Rebalance Portfolio</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Allocation Preview */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Allocation</Text>

              {/* Before / Target / After bars */}
              <View style={styles.allocationRow}>
                <Text style={styles.allocationLabel}>Before</Text>
                <View style={styles.allocationBarContainer}>
                  <View style={styles.allocationBar}>
                    <View style={[styles.barSegment, {
                      flex: result.beforeAllocation.FOUNDATION * 100,
                      backgroundColor: LAYER_COLORS.FOUNDATION
                    }]} />
                    <View style={[styles.barSegment, {
                      flex: result.beforeAllocation.GROWTH * 100,
                      backgroundColor: LAYER_COLORS.GROWTH
                    }]} />
                    <View style={[styles.barSegment, {
                      flex: result.beforeAllocation.UPSIDE * 100,
                      backgroundColor: LAYER_COLORS.UPSIDE
                    }]} />
                  </View>
                </View>
              </View>

              <View style={styles.allocationRow}>
                <Text style={styles.allocationLabel}>Target</Text>
                <View style={styles.allocationBarContainer}>
                  <View style={styles.allocationBar}>
                    <View style={[styles.barSegment, {
                      flex: targetLayerPct.FOUNDATION * 100,
                      backgroundColor: LAYER_COLORS.FOUNDATION,
                      opacity: 0.5
                    }]} />
                    <View style={[styles.barSegment, {
                      flex: targetLayerPct.GROWTH * 100,
                      backgroundColor: LAYER_COLORS.GROWTH,
                      opacity: 0.5
                    }]} />
                    <View style={[styles.barSegment, {
                      flex: targetLayerPct.UPSIDE * 100,
                      backgroundColor: LAYER_COLORS.UPSIDE,
                      opacity: 0.5
                    }]} />
                  </View>
                </View>
              </View>

              <View style={styles.allocationRow}>
                <Text style={styles.allocationLabel}>After</Text>
                <View style={styles.allocationBarContainer}>
                  <View style={styles.allocationBar}>
                    <View style={[styles.barSegment, {
                      flex: result.afterAllocation.FOUNDATION * 100,
                      backgroundColor: LAYER_COLORS.FOUNDATION
                    }]} />
                    <View style={[styles.barSegment, {
                      flex: result.afterAllocation.GROWTH * 100,
                      backgroundColor: LAYER_COLORS.GROWTH
                    }]} />
                    <View style={[styles.barSegment, {
                      flex: result.afterAllocation.UPSIDE * 100,
                      backgroundColor: LAYER_COLORS.UPSIDE
                    }]} />
                  </View>
                </View>
              </View>

              {/* Legend */}
              <View style={styles.legend}>
                {(['FOUNDATION', 'GROWTH', 'UPSIDE'] as Layer[]).map((layer) => (
                  <View key={layer} style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: LAYER_COLORS[layer] }]} />
                    <Text style={styles.legendText}>
                      {LAYER_NAMES[layer]} {Math.round(result.afterAllocation[layer] * 100)}%
                    </Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Mode Selection */}
            {cashIRR > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Rebalance Mode</Text>
                <View style={styles.modeOptions}>
                  <TouchableOpacity
                    style={[styles.modeOption, mode === 'HOLDINGS_ONLY' && styles.modeOptionSelected]}
                    onPress={() => setMode('HOLDINGS_ONLY')}
                  >
                    <Text style={[styles.modeOptionText, mode === 'HOLDINGS_ONLY' && styles.modeOptionTextSelected]}>
                      Holdings Only
                    </Text>
                    <Text style={styles.modeOptionSubtext}>
                      Trade existing assets
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.modeOption, mode === 'HOLDINGS_PLUS_CASH' && styles.modeOptionSelected]}
                    onPress={() => setMode('HOLDINGS_PLUS_CASH')}
                  >
                    <Text style={[styles.modeOptionText, mode === 'HOLDINGS_PLUS_CASH' && styles.modeOptionTextSelected]}>
                      Deploy Cash
                    </Text>
                    <Text style={styles.modeOptionSubtext}>
                      +{formatNumber(cashIRR)} IRR
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Trade Summary */}
            <View style={styles.section}>
              <TouchableOpacity
                style={styles.summaryHeader}
                onPress={() => setShowTrades(!showTrades)}
              >
                <Text style={styles.sectionTitle}>Summary</Text>
                <Text style={styles.expandIcon}>{showTrades ? '▼' : '▶'}</Text>
              </TouchableOpacity>

              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Selling</Text>
                <Text style={styles.summaryValue}>{sellTrades.length} assets</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Buying</Text>
                <Text style={styles.summaryValue}>{buyTrades.length} assets</Text>
              </View>

              {showTrades && result.trades.length > 0 && (
                <View style={styles.tradeList}>
                  {result.trades.map((trade, index) => (
                    <View key={index} style={styles.tradeItem}>
                      <View style={styles.tradeLeft}>
                        <Text style={[
                          styles.tradeSide,
                          { color: trade.side === 'SELL' ? colors.error : colors.success }
                        ]}>
                          {trade.side}
                        </Text>
                        <Text style={styles.tradeAsset}>
                          {ASSETS[trade.assetId]?.symbol || trade.assetId}
                        </Text>
                      </View>
                      <Text style={styles.tradeAmount}>
                        {formatNumber(trade.amountIRR)} IRR
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>

            {/* Warnings */}
            {result.hasLockedCollateral && (
              <View style={styles.warningBox}>
                <Text style={styles.warningIcon}>🔒</Text>
                <Text style={styles.warningText}>
                  Some assets are locked as collateral for your loans and cannot be sold.
                </Text>
              </View>
            )}

            {result.boundary !== 'SAFE' && (
              <View style={[styles.warningBox, { borderColor: colors.warning }]}>
                <Text style={styles.warningIcon}>⚠️</Text>
                <Text style={styles.warningText}>
                  {BOUNDARY_MESSAGES[result.boundary] || result.message}
                </Text>
              </View>
            )}

            {!result.canExecute && (
              <View style={styles.infoBox}>
                <Text style={styles.infoText}>
                  Your portfolio is already balanced or no trades are needed.
                </Text>
              </View>
            )}
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={[
                styles.confirmButton,
                !result.canExecute && styles.confirmButtonDisabled
              ]}
              onPress={handleConfirm}
              disabled={!result.canExecute || isExecuting}
            >
              <Text style={styles.confirmButtonText}>
                {isExecuting ? 'Rebalancing...' : 'Confirm Rebalance'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.bgDark,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    maxHeight: '90%',
  },
  dragHandle: {
    width: 40,
    height: 4,
    backgroundColor: colors.textSecondary,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: spacing[2],
    marginBottom: spacing[2],
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: colors.borderDark,
  },
  title: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimaryDark,
  },
  closeButton: {
    padding: spacing[2],
  },
  closeText: {
    fontSize: 20,
    color: colors.textSecondary,
  },
  content: {
    padding: spacing[4],
  },
  section: {
    marginBottom: spacing[6],
  },
  sectionTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimaryDark,
    marginBottom: spacing[3],
  },
  allocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing[2],
  },
  allocationLabel: {
    width: 60,
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
  },
  allocationBarContainer: {
    flex: 1,
    height: 24,
    backgroundColor: colors.surfaceDark,
    borderRadius: borderRadius.sm,
    overflow: 'hidden',
  },
  allocationBar: {
    flexDirection: 'row',
    height: '100%',
  },
  barSegment: {
    height: '100%',
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: spacing[3],
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: spacing[1],
  },
  legendText: {
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
  },
  modeOptions: {
    flexDirection: 'row',
    gap: spacing[3],
  },
  modeOption: {
    flex: 1,
    backgroundColor: colors.surfaceDark,
    borderRadius: borderRadius.default,
    padding: spacing[4],
    borderWidth: 2,
    borderColor: 'transparent',
  },
  modeOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: `${colors.primary}15`,
  },
  modeOptionText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimaryDark,
    marginBottom: spacing[1],
  },
  modeOptionTextSelected: {
    color: colors.primary,
  },
  modeOptionSubtext: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
  },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  expandIcon: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing[2],
    borderBottomWidth: 1,
    borderBottomColor: colors.borderDark,
  },
  summaryLabel: {
    fontSize: typography.fontSize.base,
    color: colors.textSecondary,
  },
  summaryValue: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.textPrimaryDark,
  },
  tradeList: {
    marginTop: spacing[3],
    backgroundColor: colors.surfaceDark,
    borderRadius: borderRadius.default,
    padding: spacing[3],
  },
  tradeItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing[2],
    borderBottomWidth: 1,
    borderBottomColor: colors.borderDark,
  },
  tradeLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tradeSide: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    width: 40,
  },
  tradeAsset: {
    fontSize: typography.fontSize.base,
    color: colors.textPrimaryDark,
    marginLeft: spacing[2],
  },
  tradeAmount: {
    fontSize: typography.fontSize.base,
    color: colors.textSecondary,
  },
  warningBox: {
    flexDirection: 'row',
    backgroundColor: `${colors.warning}15`,
    borderRadius: borderRadius.default,
    padding: spacing[3],
    marginBottom: spacing[4],
    borderWidth: 1,
    borderColor: `${colors.warning}30`,
  },
  warningIcon: {
    fontSize: 16,
    marginRight: spacing[2],
  },
  warningText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: colors.warning,
    lineHeight: 20,
  },
  infoBox: {
    backgroundColor: colors.surfaceDark,
    borderRadius: borderRadius.default,
    padding: spacing[4],
    alignItems: 'center',
  },
  infoText: {
    fontSize: typography.fontSize.base,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  footer: {
    padding: spacing[4],
    paddingBottom: spacing[8],
    borderTopWidth: 1,
    borderTopColor: colors.borderDark,
  },
  confirmButton: {
    height: 56,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmButtonDisabled: {
    backgroundColor: colors.surfaceDark,
  },
  confirmButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimaryDark,
  },
});

export default RebalanceSheet;
