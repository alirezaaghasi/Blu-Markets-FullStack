// Activity Card Component
// Based on UI Restructure Specification Section 2

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { COLORS } from '../constants/colors';
import { TYPOGRAPHY } from '../constants/typography';
import { SPACING, RADIUS } from '../constants/spacing';
import { Boundary, ActionType } from '../types';

// Boundary badge colors
const BOUNDARY_COLORS: Record<Boundary, { bg: string; text: string }> = {
  SAFE: { bg: `${COLORS.boundary.safe}20`, text: COLORS.boundary.safe },
  DRIFT: { bg: `${COLORS.boundary.drift}20`, text: COLORS.boundary.drift },
  STRUCTURAL: { bg: `${COLORS.boundary.structural}20`, text: COLORS.boundary.structural },
  STRESS: { bg: `${COLORS.boundary.stress}20`, text: COLORS.boundary.stress },
};

// P2: Action type icons - Unicode symbols (cleaner than emojis)
const ACTION_ICONS: Record<ActionType | string, string> = {
  PORTFOLIO_CREATED: '✦',  // Star
  ADD_FUNDS: '+',          // Plus
  TRADE: '⇄',              // Exchange arrows
  REBALANCE: '⚖',          // Balance scale
  PROTECT: '◈',            // Shield-like diamond
  PROTECTION: '◈',         // Shield-like diamond
  CANCEL_PROTECTION: '✕',  // X mark
  BORROW: '↓',             // Down arrow (receive)
  REPAY: '↑',              // Up arrow (send)
  LOAN_PAYMENT: '↑',       // Up arrow (payment)
  ALERT: '!',              // Exclamation
};

interface ActivityCardProps {
  id: string | number;
  type: ActionType | 'LOAN_PAYMENT' | 'ALERT';
  title: string;
  subtitle?: string;
  timestamp: string;
  boundary?: Boundary;

  // Action buttons (for alerts)
  primaryAction?: {
    label: string;
    onPress: () => void;
  };
  secondaryAction?: {
    label: string;
    onPress: () => void;
  };

  // Deep link (for completed actions)
  deepLink?: {
    label: string;  // "View in Portfolio →"
    onPress: () => void;
  };
}

export function ActivityCard({
  type,
  title,
  subtitle,
  timestamp,
  boundary,
  primaryAction,
  secondaryAction,
  deepLink
}: ActivityCardProps) {
  const icon = ACTION_ICONS[type] || '●';
  const boundaryColor = boundary ? BOUNDARY_COLORS[boundary] : null;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.iconContainer}>
          <Text style={styles.icon}>{icon}</Text>
        </View>
        <View style={styles.content}>
          <View style={styles.titleRow}>
            <Text style={styles.title} numberOfLines={1}>{title}</Text>
            {boundary && boundaryColor && (
              <View style={[styles.boundaryBadge, { backgroundColor: boundaryColor.bg }]}>
                <Text style={[styles.boundaryText, { color: boundaryColor.text }]}>
                  {boundary}
                </Text>
              </View>
            )}
          </View>
          <Text style={styles.timestamp}>{timestamp}</Text>
          {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        </View>
      </View>

      {(primaryAction || secondaryAction || deepLink) && (
        <View style={styles.actions}>
          {primaryAction && (
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={primaryAction.onPress}
            >
              <Text style={styles.primaryButtonText}>{primaryAction.label}</Text>
            </TouchableOpacity>
          )}
          {secondaryAction && (
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={secondaryAction.onPress}
            >
              <Text style={styles.secondaryButtonText}>{secondaryAction.label}</Text>
            </TouchableOpacity>
          )}
          {deepLink && (
            <TouchableOpacity
              style={styles.deepLink}
              onPress={deepLink.onPress}
            >
              <Text style={styles.deepLinkText}>{deepLink.label}</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

// Boundary Badge standalone component
export function BoundaryBadge({ boundary }: { boundary: Boundary }) {
  const colors = BOUNDARY_COLORS[boundary];
  return (
    <View style={[styles.boundaryBadge, { backgroundColor: colors.bg }]}>
      <Text style={[styles.boundaryText, { color: colors.text }]}>
        {boundary}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.background.elevated,
    borderRadius: RADIUS.lg,
    padding: SPACING[4],
    marginBottom: SPACING[3],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.background.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING[3],
  },
  icon: {
    fontSize: 18,
  },
  content: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING[1],
  },
  title: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.text.primary,
    flex: 1,
    marginRight: SPACING[2],
  },
  timestamp: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.muted,
    marginBottom: SPACING[1],
  },
  subtitle: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
    marginTop: SPACING[1],
  },
  boundaryBadge: {
    paddingHorizontal: SPACING[2],
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
  },
  boundaryText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING[3],
    paddingTop: SPACING[3],
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: SPACING[3],
  },
  primaryButton: {
    backgroundColor: COLORS.brand.primary,
    paddingHorizontal: SPACING[4],
    paddingVertical: SPACING[2],
    borderRadius: RADIUS.full,
  },
  primaryButtonText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.inverse,
  },
  secondaryButton: {
    paddingHorizontal: SPACING[4],
    paddingVertical: SPACING[2],
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  secondaryButtonText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.text.secondary,
  },
  deepLink: {
    marginLeft: 'auto',
  },
  deepLinkText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.brand.primary,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
});

export default ActivityCard;
