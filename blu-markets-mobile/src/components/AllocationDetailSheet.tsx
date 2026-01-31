// Allocation Detail Sheet Component
// Shows detailed breakdown of portfolio allocation when allocation bar is tapped
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
} from 'react-native';
import { COLORS } from '../constants/colors';
import { TYPOGRAPHY } from '../constants/typography';
import { SPACING, RADIUS } from '../constants/spacing';
import { LAYER_COLORS, LAYER_NAMES, LAYER_DESCRIPTIONS } from '../constants/assets';
import { TargetLayerPct, Layer } from '../types';
import { formatIRR } from '../utils/currency';

interface AllocationDetailSheetProps {
  visible: boolean;
  onClose: () => void;
  current: TargetLayerPct;
  target: TargetLayerPct;
  layerValues?: {
    FOUNDATION: number;
    GROWTH: number;
    UPSIDE: number;
  };
  totalValue?: number;
}

const LAYER_ICONS: Record<Layer, string> = {
  FOUNDATION: '🏛️',
  GROWTH: '📈',
  UPSIDE: '🚀',
};

const formatNumber = (num: number): string => {
  if (num === undefined || num === null || isNaN(num)) return '0';
  if (num >= 1_000_000_000) {
    return `${(num / 1_000_000_000).toFixed(1)}B`;
  }
  if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(1)}M`;
  }
  return num.toLocaleString('en-US');
};

export const AllocationDetailSheet: React.FC<AllocationDetailSheetProps> = ({
  visible,
  onClose,
  current,
  target,
  layerValues,
  totalValue,
}) => {
  const layers: Layer[] = ['FOUNDATION', 'GROWTH', 'UPSIDE'];

  const getDriftStatus = (currentPct: number, targetPct: number): { status: string; color: string } => {
    const drift = Math.abs(currentPct - targetPct);
    if (drift < 0.03) {
      return { status: 'On target', color: COLORS.semantic.success };
    }
    if (drift < 0.08) {
      return { status: 'Slight drift', color: COLORS.semantic.warning };
    }
    return { status: 'Needs rebalance', color: COLORS.semantic.error };
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.sheet}>
              {/* Header */}
              <View style={styles.header}>
                <View style={styles.handle} />
                <Text style={styles.title}>Allocation Breakdown</Text>
                <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                  <Text style={styles.closeButtonText}>✕</Text>
                </TouchableOpacity>
              </View>

              {/* Allocation Bar */}
              <View style={styles.barSection}>
                <Text style={styles.sectionLabel}>Current Allocation</Text>
                <View style={styles.allocationBar}>
                  {layers.map((layer) => (
                    <View
                      key={layer}
                      style={[
                        styles.barSegment,
                        {
                          flex: current[layer] || 0.001,
                          backgroundColor: LAYER_COLORS[layer],
                        },
                      ]}
                    />
                  ))}
                </View>
              </View>

              {/* Layer Details */}
              {layers.map((layer) => {
                const currentPct = current[layer] || 0;
                const targetPct = target[layer] || 0;
                const { status, color } = getDriftStatus(currentPct, targetPct);
                const value = layerValues?.[layer] || 0;

                return (
                  <View key={layer} style={styles.layerCard}>
                    <View style={styles.layerHeader}>
                      <View style={styles.layerTitleRow}>
                        <View
                          style={[
                            styles.layerIcon,
                            { backgroundColor: `${LAYER_COLORS[layer]}20` },
                          ]}
                        >
                          <Text style={styles.layerIconText}>{LAYER_ICONS[layer]}</Text>
                        </View>
                        <View>
                          <Text style={styles.layerName}>{LAYER_NAMES[layer]}</Text>
                          <Text style={styles.layerDescription}>
                            {LAYER_DESCRIPTIONS[layer]}
                          </Text>
                        </View>
                      </View>
                      <View style={[styles.statusBadge, { backgroundColor: `${color}15` }]}>
                        <Text style={[styles.statusText, { color }]}>{status}</Text>
                      </View>
                    </View>

                    <View style={styles.layerStats}>
                      <View style={styles.statItem}>
                        <Text style={styles.statLabel}>Current</Text>
                        <Text style={[styles.statValue, { color: LAYER_COLORS[layer] }]}>
                          {Math.round(currentPct * 100)}%
                        </Text>
                      </View>
                      <View style={styles.statItem}>
                        <Text style={styles.statLabel}>Target</Text>
                        <Text style={styles.statValue}>
                          {Math.round(targetPct * 100)}%
                        </Text>
                      </View>
                      {layerValues && (
                        <View style={styles.statItem}>
                          <Text style={styles.statLabel}>Value</Text>
                          <Text style={styles.statValue}>
                            {formatIRR(value)}
                          </Text>
                        </View>
                      )}
                    </View>

                    {/* Mini progress bar */}
                    <View style={styles.progressContainer}>
                      <View style={styles.progressBackground}>
                        <View
                          style={[
                            styles.progressFill,
                            {
                              width: `${Math.min(currentPct * 100, 100)}%`,
                              backgroundColor: LAYER_COLORS[layer],
                            },
                          ]}
                        />
                        <View
                          style={[
                            styles.targetMarker,
                            { left: `${Math.min(targetPct * 100, 100)}%` },
                          ]}
                        />
                      </View>
                    </View>
                  </View>
                );
              })}

              {/* Total Value */}
              {totalValue !== undefined && (
                <View style={styles.totalSection}>
                  <Text style={styles.totalLabel}>Total Portfolio Value</Text>
                  <Text style={styles.totalValue}>{formatIRR(totalValue)}</Text>
                </View>
              )}
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
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
    backgroundColor: COLORS.background.elevated,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    paddingHorizontal: SPACING[5],
    paddingBottom: SPACING[8],
    maxHeight: '85%',
  },
  header: {
    alignItems: 'center',
    paddingVertical: SPACING[4],
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    marginBottom: SPACING[4],
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: COLORS.text.muted,
    borderRadius: 2,
    marginBottom: SPACING[3],
  },
  title: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text.primary,
  },
  closeButton: {
    position: 'absolute',
    right: 0,
    top: SPACING[4],
    padding: SPACING[2],
  },
  closeButtonText: {
    fontSize: 18,
    color: COLORS.text.muted,
  },
  barSection: {
    marginBottom: SPACING[5],
  },
  sectionLabel: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
    marginBottom: SPACING[2],
  },
  allocationBar: {
    height: 16,
    borderRadius: 8,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  barSegment: {
    height: '100%',
  },
  layerCard: {
    backgroundColor: COLORS.background.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING[4],
    marginBottom: SPACING[3],
  },
  layerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING[3],
  },
  layerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  layerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING[3],
  },
  layerIconText: {
    fontSize: 18,
  },
  layerName: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.primary,
  },
  layerDescription: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.text.muted,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: SPACING[2],
    paddingVertical: SPACING[1],
    borderRadius: RADIUS.sm,
  },
  statusText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
  layerStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING[3],
  },
  statItem: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.text.muted,
    marginBottom: 2,
  },
  statValue: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.primary,
  },
  progressContainer: {
    marginTop: SPACING[2],
  },
  progressBackground: {
    height: 6,
    backgroundColor: COLORS.background.elevated,
    borderRadius: 3,
    position: 'relative',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  targetMarker: {
    position: 'absolute',
    top: -2,
    width: 2,
    height: 10,
    backgroundColor: COLORS.text.primary,
    borderRadius: 1,
    marginLeft: -1,
  },
  totalSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: SPACING[4],
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    marginTop: SPACING[2],
  },
  totalLabel: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text.secondary,
  },
  totalValue: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text.primary,
  },
});

export default AllocationDetailSheet;
