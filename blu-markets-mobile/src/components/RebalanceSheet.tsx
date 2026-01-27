// Rebalance Bottom Sheet
// Based on PRD Section 6.3 - Rebalance Flow
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { colors, typography, spacing, borderRadius } from '../constants/theme';
import { useAppSelector, useAppDispatch } from '../hooks/useStore';
import { Layer, Boundary, RebalancePreview, RebalanceMode, Holding } from '../types';
import { ASSETS, LAYER_COLORS, LAYER_NAMES } from '../constants/assets';
import { BOUNDARY_MESSAGES } from '../constants/business';
import { setStatus, setHoldings, updateCash, logAction } from '../store/slices/portfolioSlice';
import { rebalance, portfolio } from '../services/api';
import { TransactionSuccessModal, TransactionSuccessResult } from './TransactionSuccessModal';

interface RebalanceSheetProps {
  visible: boolean;
  onClose: () => void;
}

// Format number with commas
const formatNumber = (num: number): string => {
  return Math.round(num).toLocaleString('en-US');
};

const RebalanceSheet: React.FC<RebalanceSheetProps> = ({ visible, onClose }) => {
  const dispatch = useAppDispatch();
  const [mode, setMode] = useState<RebalanceMode>('HOLDINGS_ONLY');
  const [showTrades, setShowTrades] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [preview, setPreview] = useState<RebalancePreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successResult, setSuccessResult] = useState<TransactionSuccessResult | null>(null);

  const { cashIRR, targetLayerPct } = useAppSelector((state) => state.portfolio);

  // BUG-024 FIX: Fetch preview with cleanup to prevent state updates on unmounted component
  const fetchPreviewInternal = useCallback(async (isMountedRef?: { current: boolean }) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await rebalance.preview(mode);
      if (!isMountedRef || isMountedRef.current) {
        setPreview(result);
      }
    } catch (err: any) {
      if (!isMountedRef || isMountedRef.current) {
        setError(err?.message || 'Failed to load rebalance preview');
        setPreview(null);
      }
    } finally {
      if (!isMountedRef || isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [mode]);

  useEffect(() => {
    if (!visible) return;

    const isMountedRef = { current: true };
    fetchPreviewInternal(isMountedRef);
    return () => { isMountedRef.current = false; };
  }, [visible, mode, fetchPreviewInternal]);

  // Manual retry handler (no cleanup needed for user-initiated action)
  const handleRetry = useCallback(() => {
    fetchPreviewInternal();
  }, [fetchPreviewInternal]);

  const handleConfirm = async () => {
    if (!preview || preview.trades.length === 0) return;

    setIsExecuting(true);
    try {
      // Execute rebalance via backend
      const result = await rebalance.execute();

      // Refresh portfolio data from backend
      const portfolioData = await portfolio.get();

      // Update Redux state
      dispatch(updateCash(portfolioData.cashIrr));
      dispatch(setStatus(portfolioData.status));
      dispatch(setHoldings(portfolioData.holdings.map((h: Holding) => ({
        assetId: h.assetId,
        quantity: h.quantity,
        frozen: h.frozen,
        layer: h.layer,
      }))));

      dispatch(logAction({
        type: 'REBALANCE',
        boundary: 'SAFE',
        message: `Rebalanced portfolio (${result.tradesExecuted} trades)`,
      }));

      // Show success modal with new allocation
      const afterAlloc = preview.after || preview.target;
      setSuccessResult({
        title: 'Rebalance Complete!',
        subtitle: `Successfully executed ${result.tradesExecuted} trades`,
        items: [
          { label: 'Foundation', value: `${(afterAlloc.FOUNDATION * 100).toFixed(0)}%` },
          { label: 'Growth', value: `${(afterAlloc.GROWTH * 100).toFixed(0)}%` },
          { label: 'Upside', value: `${(afterAlloc.UPSIDE * 100).toFixed(0)}%` },
          { label: 'Status', value: 'Balanced', highlight: true },
        ],
      });
      setShowSuccess(true);
    } catch (err: any) {
      Alert.alert('Rebalance Failed', err?.message || 'Unable to rebalance. Please try again.');
    } finally {
      setIsExecuting(false);
    }
  };

  // BUG FIX: Close inner modal first, then parent with delay
  // React Native's Modal touch handling gets confused when nested modals close simultaneously
  const handleSuccessClose = () => {
    setShowSuccess(false);
    setSuccessResult(null);
    // Delay parent modal close to allow inner modal to properly unmount
    setTimeout(() => {
      onClose();
    }, 150);
  };

  // Convert API response to component-friendly format (uppercase to lowercase, fractions to percentages)
  const beforeAllocation = preview?.before ? {
    foundation: preview.before.FOUNDATION * 100,
    growth: preview.before.GROWTH * 100,
    upside: preview.before.UPSIDE * 100,
  } : { foundation: 0, growth: 0, upside: 0 };
  const targetAllocationDisplay = preview?.target ? {
    foundation: preview.target.FOUNDATION * 100,
    growth: preview.target.GROWTH * 100,
    upside: preview.target.UPSIDE * 100,
  } : {
    foundation: targetLayerPct.FOUNDATION * 100,
    growth: targetLayerPct.GROWTH * 100,
    upside: targetLayerPct.UPSIDE * 100,
  };
  const afterAllocation = preview?.after ? {
    foundation: preview.after.FOUNDATION * 100,
    growth: preview.after.GROWTH * 100,
    upside: preview.after.UPSIDE * 100,
  } : { foundation: 0, growth: 0, upside: 0 };
  const trades = preview?.trades || [];
  const sellTrades = trades.filter(t => t.side === 'SELL');
  const buyTrades = trades.filter(t => t.side === 'BUY');
  const canExecute = trades.length > 0;
  const hasLockedCollateral = preview?.hasLockedCollateral || false;
  const residualDrift = preview?.residualDrift || 0;

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
            {/* Loading State */}
            {isLoading && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.loadingText}>Calculating rebalance...</Text>
              </View>
            )}

            {/* Error State */}
            {error && !isLoading && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
                <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
                  <Text style={styles.retryButtonText}>Retry</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Allocation Preview */}
            {!isLoading && !error && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Allocation</Text>

              {/* Before / Target / After bars */}
              <View style={styles.allocationRow}>
                <Text style={styles.allocationLabel}>Before</Text>
                <View style={styles.allocationBarContainer}>
                  <View style={styles.allocationBar}>
                    <View style={[styles.barSegment, {
                      flex: beforeAllocation.foundation || 1,
                      backgroundColor: LAYER_COLORS.FOUNDATION
                    }]} />
                    <View style={[styles.barSegment, {
                      flex: beforeAllocation.growth || 1,
                      backgroundColor: LAYER_COLORS.GROWTH
                    }]} />
                    <View style={[styles.barSegment, {
                      flex: beforeAllocation.upside || 1,
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
                      flex: targetAllocationDisplay.foundation || 1,
                      backgroundColor: LAYER_COLORS.FOUNDATION,
                      opacity: 0.5
                    }]} />
                    <View style={[styles.barSegment, {
                      flex: targetAllocationDisplay.growth || 1,
                      backgroundColor: LAYER_COLORS.GROWTH,
                      opacity: 0.5
                    }]} />
                    <View style={[styles.barSegment, {
                      flex: targetAllocationDisplay.upside || 1,
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
                      flex: afterAllocation.foundation || 1,
                      backgroundColor: LAYER_COLORS.FOUNDATION
                    }]} />
                    <View style={[styles.barSegment, {
                      flex: afterAllocation.growth || 1,
                      backgroundColor: LAYER_COLORS.GROWTH
                    }]} />
                    <View style={[styles.barSegment, {
                      flex: afterAllocation.upside || 1,
                      backgroundColor: LAYER_COLORS.UPSIDE
                    }]} />
                  </View>
                </View>
              </View>

              {/* Legend */}
              {/* BUG-A FIX: afterAllocation values are already percentages (0-100), don't multiply again */}
              <View style={styles.legend}>
                {(['FOUNDATION', 'GROWTH', 'UPSIDE'] as const).map((layer) => (
                  <View key={layer} style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: LAYER_COLORS[layer] }]} />
                    <Text style={styles.legendText}>
                      {LAYER_NAMES[layer]} {Math.round(afterAllocation[layer.toLowerCase() as keyof typeof afterAllocation])}%
                    </Text>
                  </View>
                ))}
              </View>
            </View>
            )}

            {/* Mode Selection */}
            {!isLoading && !error && cashIRR > 0 && (
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
            {!isLoading && !error && (
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

              {showTrades && trades.length > 0 && (
                <View style={styles.tradeList}>
                  {trades.map((trade, index) => (
                    <View key={index} style={styles.tradeItem}>
                      <View style={styles.tradeLeft}>
                        <Text style={[
                          styles.tradeSide,
                          { color: trade.side === 'SELL' ? colors.error : colors.success }
                        ]}>
                          {trade.side}
                        </Text>
                        <Text style={styles.tradeAsset}>
                          {ASSETS[trade.assetId as keyof typeof ASSETS]?.symbol || trade.assetId}
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
            )}

            {/* Warnings */}
            {!isLoading && !error && hasLockedCollateral && (
              <View style={styles.warningBox}>
                <Text style={styles.warningIcon}>🔒</Text>
                <Text style={styles.warningText}>
                  Some assets are locked as collateral for your loans and cannot be sold.
                </Text>
              </View>
            )}

            {/* BUG-C FIX: Make drift warning and balanced message mutually exclusive */}
            {!isLoading && !error && residualDrift > 2 && canExecute && (
              <View style={[styles.warningBox, { borderColor: colors.warning }]}>
                <Text style={styles.warningIcon}>⚠️</Text>
                <Text style={styles.warningText}>
                  {`Remaining drift: ${residualDrift.toFixed(1)}% from target after rebalancing.`}
                </Text>
              </View>
            )}

            {/* BUG-C FIX: Show appropriate message based on drift and trade availability */}
            {!isLoading && !error && !canExecute && residualDrift <= 5 && (
              <View style={styles.infoBox}>
                <Text style={styles.infoText}>
                  Your portfolio is balanced. No rebalancing needed.
                </Text>
              </View>
            )}

            {/* BUG-C FIX: Show drift exists but can't rebalance (e.g., all assets locked) */}
            {!isLoading && !error && !canExecute && residualDrift > 5 && (
              <View style={[styles.warningBox, { borderColor: colors.warning }]}>
                <Text style={styles.warningIcon}>⚠️</Text>
                <Text style={styles.warningText}>
                  {hasLockedCollateral
                    ? `${residualDrift.toFixed(1)}% drift from target. Cannot rebalance because assets are locked as collateral.`
                    : `${residualDrift.toFixed(1)}% drift from target. Unable to generate trades.`}
                </Text>
              </View>
            )}
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={[
                styles.confirmButton,
                (!canExecute || isLoading) && styles.confirmButtonDisabled
              ]}
              onPress={handleConfirm}
              disabled={!canExecute || isExecuting || isLoading}
            >
              <Text style={styles.confirmButtonText}>
                {isExecuting ? 'Rebalancing...' : isLoading ? 'Loading...' : 'Confirm Rebalance'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Success Modal */}
      <TransactionSuccessModal
        visible={showSuccess}
        onClose={handleSuccessClose}
        result={successResult}
        accentColor={colors.success}
      />
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
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: spacing[8],
  },
  loadingText: {
    marginTop: spacing[3],
    fontSize: typography.fontSize.base,
    color: colors.textSecondary,
  },
  errorContainer: {
    alignItems: 'center',
    paddingVertical: spacing[6],
  },
  errorText: {
    fontSize: typography.fontSize.base,
    color: colors.error,
    textAlign: 'center',
    marginBottom: spacing[4],
  },
  retryButton: {
    backgroundColor: colors.surfaceDark,
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[3],
    borderRadius: borderRadius.full,
  },
  retryButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary,
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
