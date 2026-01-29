// Rebalance Bottom Sheet
// Based on PRD Section 6.3 - Rebalance Flow
import React, { useState } from 'react';
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
import { RebalanceMode } from '../types';
import { ASSETS, LAYER_COLORS, LAYER_NAMES } from '../constants/assets';
import { logAction } from '../store/slices/portfolioSlice';
import { TransactionSuccessModal, TransactionSuccessResult } from './TransactionSuccessModal';
// RTK Query - auto-invalidates portfolio cache after rebalance
import { useGetRebalancePreviewQuery, useExecuteRebalanceMutation } from '../store/api/apiSlice';
import { formatIRR, formatPercent } from '../utils/currency';

interface RebalanceSheetProps {
  visible: boolean;
  onClose: () => void;
}

// Format number with commas
const formatNumber = (num: number): string => {
  if (num === undefined || num === null || isNaN(num)) return '0';
  return Math.round(num).toLocaleString('en-US');
};

const RebalanceSheet: React.FC<RebalanceSheetProps> = ({ visible, onClose }) => {
  const dispatch = useAppDispatch();
  const [mode, setMode] = useState<RebalanceMode>('HOLDINGS_ONLY');
  const [showTrades, setShowTrades] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successResult, setSuccessResult] = useState<TransactionSuccessResult | null>(null);

  const { cashIRR, targetLayerPct } = useAppSelector((state) => state.portfolio);

  // RTK Query: Fetch rebalance preview (auto-refetches when mode changes)
  const {
    data: preview,
    isLoading,
    error: previewError,
    refetch: handleRetry,
  } = useGetRebalancePreviewQuery(
    { mode },
    { skip: !visible } // Don't fetch when sheet is closed
  );

  // RTK Query: Execute rebalance mutation
  const [executeRebalance, { isLoading: isExecuting }] = useExecuteRebalanceMutation();

  // Error message from query
  const error = previewError ? 'Failed to load rebalance preview' : null;

  const handleConfirm = async () => {
    if (!preview || preview.trades.length === 0) return;

    try {
      // Execute rebalance via RTK Query mutation
      // This automatically invalidates 'Portfolio', 'Holdings', and 'Activity' tags
      // The usePortfolioSync hook will refetch and sync to Redux
      const result = await executeRebalance({ mode }).unwrap();

      if (__DEV__) {
        console.log('[RebalanceSheet] Rebalance executed via RTK Query:', {
          tradesExecuted: result.tradesExecuted,
          newStatus: result.newStatus,
        });
      }

      // Log action to local activity feed
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
      Alert.alert('Rebalance Failed', err?.message || err?.data?.message || 'Unable to rebalance. Please try again.');
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

            {/* Task 8 (Round 2): Simplified allocation - single bar with layer arrows */}
            {!isLoading && !error && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Allocation</Text>

              {/* Single Current allocation bar */}
              <View style={styles.currentBarContainer}>
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

              {/* P2: Per-layer progress bars showing current vs target */}
              <View style={styles.layerChanges}>
                {(['FOUNDATION', 'GROWTH', 'UPSIDE'] as const).map((layer) => {
                  const current = beforeAllocation[layer.toLowerCase() as keyof typeof beforeAllocation];
                  const target = targetAllocationDisplay[layer.toLowerCase() as keyof typeof targetAllocationDisplay];
                  const maxPct = Math.max(current, target, 1);
                  return (
                    <View key={layer} style={styles.layerChangeRow}>
                      <View style={styles.layerHeader}>
                        <View style={[styles.layerDot, { backgroundColor: LAYER_COLORS[layer] }]} />
                        <Text style={styles.layerName}>{LAYER_NAMES[layer]}</Text>
                        <Text style={styles.layerChangeText}>
                          {formatPercent(current)} → {formatPercent(target)}
                        </Text>
                      </View>
                      {/* Individual layer progress bar */}
                      <View style={styles.layerProgressContainer}>
                        <View style={styles.layerProgressBg}>
                          {/* Current value bar */}
                          <View style={[
                            styles.layerProgressCurrent,
                            {
                              width: `${(current / maxPct) * 100}%`,
                              backgroundColor: LAYER_COLORS[layer],
                            }
                          ]} />
                          {/* Target marker */}
                          <View style={[
                            styles.layerTargetMarker,
                            { left: `${(target / maxPct) * 100}%` }
                          ]} />
                        </View>
                      </View>
                    </View>
                  );
                })}
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
                      +{formatIRR(cashIRR)}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Task 8 (Round 2): Removed Summary section - no Selling/Buying counts */}

            {/* Task 8 (Round 2): Combined warning box */}
            {!isLoading && !error && (hasLockedCollateral || residualDrift > 2) && canExecute && (
              <View style={styles.warningBox}>
                <Text style={styles.warningIcon}>⚠️</Text>
                <Text style={styles.warningText}>
                  {hasLockedCollateral && residualDrift > 2
                    ? `Some assets locked — ${formatPercent(residualDrift)} drift will remain`
                    : hasLockedCollateral
                    ? 'Some assets locked as collateral'
                    : `${formatPercent(residualDrift)} drift will remain`}
                </Text>
              </View>
            )}

            {/* Show appropriate message when no rebalancing needed or possible */}
            {!isLoading && !error && !canExecute && residualDrift <= 5 && (
              <View style={styles.infoBox}>
                <Text style={styles.infoText}>
                  Your portfolio is balanced. No rebalancing needed.
                </Text>
              </View>
            )}

            {!isLoading && !error && !canExecute && residualDrift > 5 && (
              <View style={styles.warningBox}>
                <Text style={styles.warningIcon}>⚠️</Text>
                <Text style={styles.warningText}>
                  {hasLockedCollateral
                    ? `${formatPercent(residualDrift)} drift — assets locked as collateral`
                    : `${formatPercent(residualDrift)} drift from target`}
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
  // Task 8 (Round 2): Simplified allocation styles - single bar with arrows
  currentBarContainer: {
    height: 28,
    backgroundColor: colors.surfaceDark,
    borderRadius: borderRadius.sm,
    overflow: 'hidden',
    marginBottom: spacing[4],
  },
  allocationBar: {
    flexDirection: 'row',
    height: '100%',
  },
  barSegment: {
    height: '100%',
  },
  layerChanges: {
    gap: spacing[3],
  },
  layerChangeRow: {
    gap: spacing[2],
  },
  layerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  layerDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: spacing[2],
  },
  layerName: {
    flex: 1,
    fontSize: typography.fontSize.base,
    color: colors.textPrimaryDark,
  },
  layerChangeText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.textSecondary,
  },
  // P2: Per-layer progress bar styles
  layerProgressContainer: {
    marginLeft: 18, // Align with layer name (after dot)
  },
  layerProgressBg: {
    height: 6,
    backgroundColor: colors.surfaceDark,
    borderRadius: 3,
    position: 'relative',
    overflow: 'visible',
  },
  layerProgressCurrent: {
    height: '100%',
    borderRadius: 3,
    opacity: 0.8,
  },
  layerTargetMarker: {
    position: 'absolute',
    top: -2,
    width: 2,
    height: 10,
    backgroundColor: colors.textPrimaryDark,
    borderRadius: 1,
    marginLeft: -1, // Center the marker
  },
  // Legacy allocation styles (kept for compatibility)
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
