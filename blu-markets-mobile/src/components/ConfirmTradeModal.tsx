/**
 * ConfirmTradeModal
 * Design System: Blu Markets
 * Target: iPhone 16 Pro (393 x 852)
 *
 * Two-step confirmation modal for trades
 * Shows: Action summary, Before/After allocation, Boundary badge, Friction copy
 */
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal as RNModal,
  TouchableWithoutFeedback,
  ScrollView,
} from 'react-native';
import { COLORS } from '../constants/colors';
import { TYPOGRAPHY } from '../constants/typography';
import { SPACING, RADIUS } from '../constants/spacing';
import { LAYOUT } from '../constants/layout';
import { Button, Badge } from './common';
import { TradePreview, Boundary, AssetId } from '../types';
import { ASSETS } from '../constants/assets';
import AllocationBar from './AllocationBar';

interface ConfirmTradeModalProps {
  /** Visibility state */
  visible: boolean;
  /** Close handler */
  onClose: () => void;
  /** Confirm handler */
  onConfirm: () => void;
  /** Trade preview data */
  preview: TradePreview | null;
  /** Loading state */
  loading?: boolean;
}

// Boundary colors and labels
const BOUNDARY_CONFIG: Record<Boundary, { color: string; bgColor: string; label: string }> = {
  SAFE: {
    color: COLORS.boundary.safe,
    bgColor: `${COLORS.boundary.safe}15`,
    label: 'Safe Trade',
  },
  DRIFT: {
    color: COLORS.boundary.drift,
    bgColor: `${COLORS.boundary.drift}15`,
    label: 'Minor Drift',
  },
  STRUCTURAL: {
    color: COLORS.boundary.structural,
    bgColor: `${COLORS.boundary.structural}15`,
    label: 'Structural Change',
  },
  STRESS: {
    color: COLORS.boundary.stress,
    bgColor: `${COLORS.boundary.stress}15`,
    label: 'High Risk',
  },
};

// Format number with commas
const formatNumber = (num: number): string => {
  return num.toLocaleString('en-US');
};

// Format percentage
const formatPercent = (num: number): string => {
  return `${Math.round(num * 100)}%`;
};

export const ConfirmTradeModal: React.FC<ConfirmTradeModalProps> = ({
  visible,
  onClose,
  onConfirm,
  preview,
  loading = false,
}) => {
  if (!preview) return null;

  const asset = ASSETS[preview.assetId];
  const isBuy = preview.side === 'BUY';
  const boundaryConfig = BOUNDARY_CONFIG[preview.boundary];
  const isHighRisk = preview.boundary === 'STRESS' || preview.boundary === 'STRUCTURAL';

  return (
    <RNModal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={loading ? undefined : onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.container}>
              <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
              >
                {/* Header */}
                <View style={styles.header}>
                  <Text style={styles.title}>Confirm Trade</Text>
                  <Text style={styles.subtitle}>
                    Review the details before confirming
                  </Text>
                </View>

                {/* Trade Summary Card */}
                <View style={styles.summaryCard}>
                  {/* Action Badge */}
                  <View style={[
                    styles.actionBadge,
                    { backgroundColor: isBuy ? COLORS.semantic.success : COLORS.semantic.error }
                  ]}>
                    <Text style={styles.actionBadgeText}>
                      {isBuy ? 'BUY' : 'SELL'}
                    </Text>
                  </View>

                  {/* Asset Info */}
                  <View style={styles.assetRow}>
                    <View style={[styles.assetIcon, { backgroundColor: `${COLORS.layers[asset.layer.toLowerCase() as 'foundation' | 'growth' | 'upside']}20` }]}>
                      <Text style={styles.assetIconText}>{asset.symbol.slice(0, 2)}</Text>
                    </View>
                    <View style={styles.assetInfo}>
                      <Text style={styles.assetName}>{asset.name}</Text>
                      <Text style={styles.assetSymbol}>{asset.symbol}</Text>
                    </View>
                  </View>

                  {/* Amount Details */}
                  <View style={styles.detailsGrid}>
                    <DetailRow
                      label="Amount"
                      value={`${formatNumber(preview.amountIRR)} IRR`}
                    />
                    <DetailRow
                      label={isBuy ? 'You receive' : 'You sell'}
                      value={`${preview.quantity.toFixed(6)} ${asset.symbol}`}
                    />
                    <DetailRow
                      label="Price"
                      value={`$${preview.priceUSD.toLocaleString()}`}
                    />
                    <DetailRow
                      label={`Spread (${formatPercent(preview.spread)})`}
                      value={`${formatNumber(Math.round(preview.amountIRR * preview.spread))} IRR`}
                      muted
                    />
                  </View>
                </View>

                {/* Allocation Impact */}
                <View style={styles.allocationSection}>
                  <Text style={styles.sectionTitle}>Allocation Impact</Text>

                  <View style={styles.allocationRow}>
                    <Text style={styles.allocationLabel}>Before</Text>
                    <View style={styles.allocationBarWrapper}>
                      <AllocationBar current={preview.before} target={preview.target} compact />
                    </View>
                  </View>

                  <View style={styles.allocationRow}>
                    <Text style={styles.allocationLabel}>After</Text>
                    <View style={styles.allocationBarWrapper}>
                      <AllocationBar current={preview.after} target={preview.target} compact />
                    </View>
                  </View>

                  <View style={styles.allocationRow}>
                    <Text style={styles.allocationLabel}>Target</Text>
                    <View style={styles.allocationBarWrapper}>
                      <AllocationBar current={preview.target} target={preview.target} compact />
                    </View>
                  </View>

                  {/* Layer percentages */}
                  <View style={styles.layerPercentages}>
                    <LayerPercent
                      label="Foundation"
                      before={preview.before.FOUNDATION}
                      after={preview.after.FOUNDATION}
                      target={preview.target.FOUNDATION}
                      color={COLORS.layers.foundation}
                    />
                    <LayerPercent
                      label="Growth"
                      before={preview.before.GROWTH}
                      after={preview.after.GROWTH}
                      target={preview.target.GROWTH}
                      color={COLORS.layers.growth}
                    />
                    <LayerPercent
                      label="Upside"
                      before={preview.before.UPSIDE}
                      after={preview.after.UPSIDE}
                      target={preview.target.UPSIDE}
                      color={COLORS.layers.upside}
                    />
                  </View>
                </View>

                {/* Boundary Indicator */}
                <View style={[styles.boundarySection, { backgroundColor: boundaryConfig.bgColor }]}>
                  <View style={styles.boundaryHeader}>
                    <View style={[styles.boundaryDot, { backgroundColor: boundaryConfig.color }]} />
                    <Text style={[styles.boundaryLabel, { color: boundaryConfig.color }]}>
                      {boundaryConfig.label}
                    </Text>
                    {preview.movesTowardTarget && (
                      <Text style={styles.towardTarget}>↗ Moves toward target</Text>
                    )}
                  </View>

                  {/* Friction Copy */}
                  {preview.frictionCopy.length > 0 && (
                    <View style={styles.frictionCopy}>
                      {preview.frictionCopy.map((copy, index) => (
                        <Text key={index} style={[styles.frictionText, { color: boundaryConfig.color }]}>
                          • {copy}
                        </Text>
                      ))}
                    </View>
                  )}
                </View>
              </ScrollView>

              {/* Actions */}
              <View style={styles.actions}>
                <Button
                  label={loading ? 'Processing...' : `Confirm ${isBuy ? 'Buy' : 'Sell'}`}
                  variant={isHighRisk ? 'danger' : 'primary'}
                  size="lg"
                  fullWidth
                  onPress={onConfirm}
                  loading={loading}
                  disabled={loading}
                />
                <Button
                  label="Cancel"
                  variant="secondary"
                  size="lg"
                  fullWidth
                  onPress={onClose}
                  disabled={loading}
                />
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </RNModal>
  );
};

// Detail Row Component
const DetailRow: React.FC<{
  label: string;
  value: string;
  muted?: boolean;
}> = ({ label, value, muted }) => (
  <View style={styles.detailRow}>
    <Text style={[styles.detailLabel, muted && styles.detailMuted]}>{label}</Text>
    <Text style={[styles.detailValue, muted && styles.detailMuted]}>{value}</Text>
  </View>
);

// Layer Percent Component
const LayerPercent: React.FC<{
  label: string;
  before: number;
  after: number;
  target: number;
  color: string;
}> = ({ label, before, after, target, color }) => {
  const change = after - before;
  const changeColor = change > 0 ? COLORS.semantic.success : change < 0 ? COLORS.semantic.error : COLORS.text.muted;

  return (
    <View style={styles.layerPercentRow}>
      <View style={styles.layerPercentLeft}>
        <View style={[styles.layerDot, { backgroundColor: color }]} />
        <Text style={styles.layerPercentLabel}>{label}</Text>
      </View>
      <View style={styles.layerPercentValues}>
        <Text style={styles.layerPercentBefore}>{formatPercent(before)}</Text>
        <Text style={styles.layerPercentArrow}>→</Text>
        <Text style={[styles.layerPercentAfter, { color: changeColor }]}>
          {formatPercent(after)}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING[4],
  },
  container: {
    width: '100%',
    maxWidth: LAYOUT.modalMaxWidth,
    maxHeight: '90%',
    backgroundColor: COLORS.background.elevated,
    borderRadius: LAYOUT.modalRadius,
    overflow: 'hidden',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: LAYOUT.modalPadding,
    paddingBottom: 0,
  },
  header: {
    alignItems: 'center',
    marginBottom: SPACING[5],
  },
  title: {
    fontSize: TYPOGRAPHY.fontSize.xl,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text.primary,
    marginBottom: SPACING[1],
  },
  subtitle: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
  },
  summaryCard: {
    backgroundColor: COLORS.background.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING[4],
    marginBottom: SPACING[4],
  },
  actionBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: SPACING[3],
    paddingVertical: SPACING[1],
    borderRadius: RADIUS.full,
    marginBottom: SPACING[3],
  },
  actionBadgeText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text.inverse,
    letterSpacing: 0.5,
  },
  assetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING[4],
    paddingBottom: SPACING[4],
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  assetIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING[3],
  },
  assetIconText: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text.primary,
  },
  assetInfo: {
    flex: 1,
  },
  assetName: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.primary,
  },
  assetSymbol: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
  },
  detailsGrid: {
    gap: SPACING[2],
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
  },
  detailValue: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.text.primary,
  },
  detailMuted: {
    color: COLORS.text.muted,
  },
  allocationSection: {
    backgroundColor: COLORS.background.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING[4],
    marginBottom: SPACING[4],
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.secondary,
    marginBottom: SPACING[3],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  allocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING[2],
  },
  allocationLabel: {
    width: 50,
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.text.muted,
  },
  allocationBarWrapper: {
    flex: 1,
  },
  layerPercentages: {
    marginTop: SPACING[3],
    paddingTop: SPACING[3],
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: SPACING[2],
  },
  layerPercentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  layerPercentLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  layerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: SPACING[2],
  },
  layerPercentLabel: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.text.secondary,
  },
  layerPercentValues: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING[1],
  },
  layerPercentBefore: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.text.muted,
  },
  layerPercentArrow: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.text.muted,
  },
  layerPercentAfter: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },
  boundarySection: {
    borderRadius: RADIUS.xl,
    padding: SPACING[4],
    marginBottom: SPACING[4],
  },
  boundaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: SPACING[2],
  },
  boundaryDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  boundaryLabel: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },
  towardTarget: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.semantic.success,
    marginLeft: 'auto',
  },
  frictionCopy: {
    marginTop: SPACING[3],
    gap: SPACING[2],
  },
  frictionText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    lineHeight: TYPOGRAPHY.fontSize.sm * 1.4,
  },
  actions: {
    padding: LAYOUT.modalPadding,
    paddingTop: SPACING[4],
    gap: SPACING[3],
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
});

export default ConfirmTradeModal;
