// Boundary Indicator Component
// Based on CLAUDE_CODE_HANDOFF.md Section 6
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, BOUNDARY_BG } from '../../constants/colors';
import { TYPOGRAPHY } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';

export type Boundary = 'SAFE' | 'DRIFT' | 'STRUCTURAL' | 'STRESS';

// Boundary configuration per handoff
const BOUNDARY_CONFIG: Record<Boundary, { color: string; bg: string; label: string }> = {
  SAFE: {
    color: COLORS.boundary.safe,
    bg: BOUNDARY_BG.safe,
    label: 'SAFE',
  },
  DRIFT: {
    color: COLORS.boundary.drift,
    bg: BOUNDARY_BG.drift,
    label: 'DRIFT',
  },
  STRUCTURAL: {
    color: COLORS.boundary.structural,
    bg: BOUNDARY_BG.structural,
    label: 'DRIFT', // Show as DRIFT to user per handoff
  },
  STRESS: {
    color: COLORS.boundary.stress,
    bg: BOUNDARY_BG.stress,
    label: 'RISK',
  },
};

interface BoundaryDotProps {
  boundary: Boundary;
  size?: 'sm' | 'md';
  showRing?: boolean;
}

export const BoundaryDot: React.FC<BoundaryDotProps> = ({
  boundary,
  size = 'md',
  showRing = false, // UX-005: Disabled ring by default
}) => {
  const config = BOUNDARY_CONFIG[boundary];
  const dotSize = size === 'sm' ? 8 : 10;

  // UX-005: Use white/muted color for activity dots instead of boundary colors
  // This reduces visual noise in the activity log
  return (
    <View
      style={[
        styles.dot,
        {
          width: dotSize,
          height: dotSize,
          backgroundColor: COLORS.text.muted, // White/muted instead of colored
        },
        showRing && {
          shadowColor: config.color,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.5,
          shadowRadius: 4,
        },
      ]}
    />
  );
};

interface BoundaryBadgeProps {
  boundary: Boundary;
  size?: 'sm' | 'md';
}

export const BoundaryBadge: React.FC<BoundaryBadgeProps> = ({
  boundary,
  size = 'sm',
}) => {
  const config = BOUNDARY_CONFIG[boundary];

  return (
    <View style={[styles.badge, { backgroundColor: config.bg }]}>
      <Text
        style={[
          styles.badgeText,
          { color: config.color },
          size === 'sm' && styles.badgeTextSm,
        ]}
      >
        {config.label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  dot: {
    borderRadius: 999,
  },
  badge: {
    paddingHorizontal: SPACING[2],
    paddingVertical: 2,
    borderRadius: RADIUS.full,
  },
  badgeText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  badgeTextSm: {
    fontSize: 10,
  },
});

export default { BoundaryDot, BoundaryBadge };
