/**
 * EmptyState Component
 * Reusable empty state for list views
 * Shows icon, title, description, and optional action button
 */
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { colors, typography, spacing, borderRadius } from '../constants/theme';

// Icon mappings using emoji (can be replaced with icon library)
const ICONS: Record<string, string> = {
  'wallet-outline': '💰',
  'shield-outline': '🛡️',
  'cash-outline': '💵',
  'time-outline': '🕐',
  'trending-up': '📈',
  'pie-chart': '📊',
  'alert-circle': '⚠️',
  'search': '🔍',
  'inbox': '📥',
  'document': '📄',
};

interface EmptyStateProps {
  /** Icon name from the ICONS mapping */
  icon?: string;
  /** Custom emoji to use instead of icon name */
  emoji?: string;
  /** Main title text */
  title: string;
  /** Description text */
  description?: string;
  /** Action button label */
  actionLabel?: string;
  /** Action button callback */
  onAction?: () => void;
  /** Secondary action label */
  secondaryActionLabel?: string;
  /** Secondary action callback */
  onSecondaryAction?: () => void;
  /** Compact mode for smaller spaces */
  compact?: boolean;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  emoji,
  title,
  description,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  compact = false,
}) => {
  const displayIcon = emoji || (icon ? ICONS[icon] : '📋');

  return (
    <View style={[styles.container, compact && styles.containerCompact]}>
      <Text style={[styles.icon, compact && styles.iconCompact]}>
        {displayIcon}
      </Text>
      <Text style={[styles.title, compact && styles.titleCompact]}>
        {title}
      </Text>
      {description && (
        <Text style={[styles.description, compact && styles.descriptionCompact]}>
          {description}
        </Text>
      )}
      {actionLabel && onAction && (
        <TouchableOpacity style={styles.actionButton} onPress={onAction}>
          <Text style={styles.actionButtonText}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
      {secondaryActionLabel && onSecondaryAction && (
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={onSecondaryAction}
        >
          <Text style={styles.secondaryButtonText}>{secondaryActionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing[8],
    paddingHorizontal: spacing[6],
  },
  containerCompact: {
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[4],
  },
  icon: {
    fontSize: 48,
    marginBottom: spacing[4],
  },
  iconCompact: {
    fontSize: 32,
    marginBottom: spacing[2],
  },
  title: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimaryDark,
    textAlign: 'center',
    marginBottom: spacing[2],
  },
  titleCompact: {
    fontSize: typography.fontSize.base,
    marginBottom: spacing[1],
  },
  description: {
    fontSize: typography.fontSize.base,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 280,
    marginBottom: spacing[4],
  },
  descriptionCompact: {
    fontSize: typography.fontSize.sm,
    lineHeight: 18,
    marginBottom: spacing[2],
  },
  actionButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[6],
    marginTop: spacing[2],
  },
  actionButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimaryDark,
  },
  secondaryButton: {
    marginTop: spacing[2],
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[4],
  },
  secondaryButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.primary,
  },
});

export default EmptyState;
