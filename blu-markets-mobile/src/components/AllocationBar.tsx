// Allocation Bar Component
// Shows horizontal stacked bar with Foundation/Growth/Upside
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, typography, spacing, borderRadius } from '../constants/theme';
import { TargetLayerPct, Layer } from '../types';
import { LAYER_COLORS, LAYER_NAMES } from '../constants/assets';

interface AllocationBarProps {
  current: TargetLayerPct;
  target?: TargetLayerPct;
  showLabels?: boolean;
  height?: number;
  compact?: boolean;
}

export const AllocationBar: React.FC<AllocationBarProps> = ({
  current,
  target,
  showLabels = true,
  height = 12,
  compact = false,
}) => {
  const layers: Layer[] = ['FOUNDATION', 'GROWTH', 'UPSIDE'];
  const barHeight = compact ? 6 : height;

  return (
    <View style={[styles.container, compact && styles.containerCompact]}>
      {/* Current allocation bar */}
      <View style={[styles.barContainer, { height: barHeight }]}>
        {layers.map((layer) => (
          <View
            key={layer}
            style={[
              styles.barSegment,
              {
                flex: current[layer] || 0.001, // Prevent zero-width segments
                backgroundColor: LAYER_COLORS[layer],
              },
            ]}
          />
        ))}
      </View>

      {/* Target indicator (optional) - hidden in compact mode */}
      {target && !compact && (
        <View style={styles.targetContainer}>
          <Text style={styles.targetLabel}>Target:</Text>
          <View style={[styles.barContainer, styles.targetBar, { height: 4 }]}>
            {layers.map((layer) => (
              <View
                key={layer}
                style={[
                  styles.barSegment,
                  {
                    flex: target[layer] || 0.001,
                    backgroundColor: LAYER_COLORS[layer],
                    opacity: 0.5,
                  },
                ]}
              />
            ))}
          </View>
        </View>
      )}

      {/* Labels - hidden in compact mode */}
      {showLabels && !compact && (
        <View style={styles.labelsContainer}>
          {layers.map((layer) => (
            <View key={layer} style={styles.labelItem}>
              <View
                style={[styles.labelDot, { backgroundColor: LAYER_COLORS[layer] }]}
              />
              <Text style={styles.labelText}>
                {LAYER_NAMES[layer]} {Math.round(current[layer] * 100)}%
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {},
  containerCompact: {
    flex: 1,
  },
  barContainer: {
    flexDirection: 'row',
    borderRadius: 6,
    overflow: 'hidden',
  },
  barSegment: {
    height: '100%',
  },
  targetContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing[2],
  },
  targetLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
    marginRight: spacing[2],
    width: 45,
  },
  targetBar: {
    flex: 1,
  },
  labelsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing[2],
  },
  labelItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  labelDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: spacing[1],
  },
  labelText: {
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
  },
});

export default AllocationBar;
