/**
 * Badge Component
 * Design System: Blu Markets
 * Target: iPhone 16 Pro (393 x 852)
 *
 * Used for: Boundary indicators, Layer badges, Status badges
 * Sizes: sm (20pt), md (24pt)
 */

import React from 'react';
import { View, Text, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { COLORS, BOUNDARY_CONFIG, LAYER_CONFIG, Boundary, Layer } from '../../constants/colors';
import { TYPOGRAPHY } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';

type BadgeSize = 'sm' | 'md';

// Badge variants
type BoundaryBadgeVariant = `boundary-${Lowercase<Boundary>}`;
type LayerBadgeVariant = `layer-${Lowercase<Layer>}`;
type StatusBadgeVariant = 'status-active' | 'status-pending' | 'status-frozen';
type BadgeVariant = BoundaryBadgeVariant | LayerBadgeVariant | StatusBadgeVariant;

interface BadgeProps {
  /** Badge variant determines colors */
  variant: BadgeVariant;
  /** Badge size */
  size?: BadgeSize;
  /** Optional label text. If not provided, shows dot only */
  label?: string;
  /** Show colored dot before label */
  showDot?: boolean;
  /** Additional styles */
  style?: StyleProp<ViewStyle>;
  /** Test ID */
  testID?: string;
}

const BADGE_SIZES = {
  sm: {
    height: 20,
    paddingHorizontal: 8,
    fontSize: 11,
    dotSize: 6,
    borderRadius: 10,
    gap: 4,
  },
  md: {
    height: 24,
    paddingHorizontal: 10,
    fontSize: 12,
    dotSize: 8,
    borderRadius: 12,
    gap: 6,
  },
} as const;

// Color configurations for each badge variant
const BADGE_COLORS: Record<BadgeVariant, { bg: string; text: string; dot: string }> = {
  // Boundary badges
  'boundary-safe': {
    bg: 'rgba(34, 197, 94, 0.15)',
    text: COLORS.boundary.safe,
    dot: COLORS.boundary.safe,
  },
  'boundary-drift': {
    bg: 'rgba(245, 158, 11, 0.15)',
    text: COLORS.boundary.drift,
    dot: COLORS.boundary.drift,
  },
  'boundary-structural': {
    bg: 'rgba(249, 115, 22, 0.15)',
    text: COLORS.boundary.structural,
    dot: COLORS.boundary.structural,
  },
  'boundary-stress': {
    bg: 'rgba(239, 68, 68, 0.15)',
    text: COLORS.boundary.stress,
    dot: COLORS.boundary.stress,
  },
  // Layer badges
  'layer-foundation': {
    bg: COLORS.layersBg.foundation,
    text: COLORS.layers.foundation,
    dot: COLORS.layers.foundation,
  },
  'layer-growth': {
    bg: COLORS.layersBg.growth,
    text: COLORS.layers.growth,
    dot: COLORS.layers.growth,
  },
  'layer-upside': {
    bg: COLORS.layersBg.upside,
    text: COLORS.layers.upside,
    dot: COLORS.layers.upside,
  },
  // Status badges
  'status-active': {
    bg: 'rgba(34, 197, 94, 0.15)',
    text: COLORS.semantic.success,
    dot: COLORS.semantic.success,
  },
  'status-pending': {
    bg: 'rgba(245, 158, 11, 0.15)',
    text: COLORS.semantic.warning,
    dot: COLORS.semantic.warning,
  },
  'status-frozen': {
    bg: 'rgba(59, 130, 246, 0.15)',
    text: COLORS.semantic.info,
    dot: COLORS.semantic.info,
  },
};

export const Badge: React.FC<BadgeProps> = ({
  variant,
  size = 'md',
  label,
  showDot = true,
  style,
  testID,
}) => {
  const sizeConfig = BADGE_SIZES[size];
  const colors = BADGE_COLORS[variant];

  // Dot only mode (no label)
  if (!label) {
    return (
      <View
        testID={testID}
        style={[
          styles.dotOnly,
          {
            width: sizeConfig.dotSize,
            height: sizeConfig.dotSize,
            borderRadius: sizeConfig.dotSize / 2,
            backgroundColor: colors.dot,
          },
          style,
        ]}
      />
    );
  }

  return (
    <View
      testID={testID}
      style={[
        styles.container,
        {
          height: sizeConfig.height,
          paddingHorizontal: sizeConfig.paddingHorizontal,
          borderRadius: sizeConfig.borderRadius,
          backgroundColor: colors.bg,
          gap: sizeConfig.gap,
        },
        style,
      ]}
    >
      {showDot && (
        <View
          style={[
            styles.dot,
            {
              width: sizeConfig.dotSize,
              height: sizeConfig.dotSize,
              borderRadius: sizeConfig.dotSize / 2,
              backgroundColor: colors.dot,
            },
          ]}
        />
      )}
      <Text
        style={[
          styles.label,
          {
            fontSize: sizeConfig.fontSize,
            color: colors.text,
          },
        ]}
      >
        {label}
      </Text>
    </View>
  );
};

// Convenience components
export const BoundaryBadge: React.FC<{
  boundary: Boundary;
  size?: BadgeSize;
  style?: StyleProp<ViewStyle>;
}> = ({ boundary, size = 'sm', style }) => {
  const config = BOUNDARY_CONFIG[boundary];
  return (
    <Badge
      variant={`boundary-${boundary.toLowerCase()}` as BoundaryBadgeVariant}
      size={size}
      label={config.label}
      showDot={true}
      style={style}
    />
  );
};

export const LayerBadge: React.FC<{
  layer: Layer;
  size?: BadgeSize;
  style?: StyleProp<ViewStyle>;
}> = ({ layer, size = 'sm', style }) => {
  const config = LAYER_CONFIG[layer];
  return (
    <Badge
      variant={`layer-${layer.toLowerCase()}` as LayerBadgeVariant}
      size={size}
      label={config.label}
      showDot={false}
      style={style}
    />
  );
};

export const BoundaryDot: React.FC<{
  boundary: Boundary;
  size?: BadgeSize;
  style?: StyleProp<ViewStyle>;
}> = ({ boundary, size = 'md', style }) => (
  <Badge
    variant={`boundary-${boundary.toLowerCase()}` as BoundaryBadgeVariant}
    size={size}
    style={style}
  />
);

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    // Size set dynamically
  },
  dotOnly: {
    // Size set dynamically
  },
  label: {
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});

export default Badge;
