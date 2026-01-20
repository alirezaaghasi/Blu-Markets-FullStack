// Activity Feed Component
// Based on PRD Section 8 - Activity Feed (Chat UI)
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors, typography, spacing, borderRadius } from '../constants/theme';
import { ActionLogEntry, Boundary } from '../types';

interface ActivityFeedProps {
  entries: ActionLogEntry[];
  maxEntries?: number;
  onViewAll?: () => void;
}

// Boundary indicator colors
const BOUNDARY_COLORS: Record<Boundary, string> = {
  SAFE: colors.boundarySafe,
  DRIFT: colors.boundaryDrift,
  STRUCTURAL: colors.boundaryStructural,
  STRESS: colors.boundaryStress,
};

// Boundary indicator emojis
const BOUNDARY_INDICATORS: Record<Boundary, string> = {
  SAFE: '🟢',
  DRIFT: '🟡',
  STRUCTURAL: '🟠',
  STRESS: '🔴',
};

// Format time for display
const formatTime = (timestamp: string): string => {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;

  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
};

export const ActivityFeed: React.FC<ActivityFeedProps> = ({
  entries,
  maxEntries = 5,
  onViewAll,
}) => {
  const displayEntries = entries.slice(0, maxEntries);

  if (displayEntries.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>📝 Recent Activity</Text>
        </View>
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No activity yet</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>📝 Recent Activity</Text>
        {onViewAll && entries.length > maxEntries && (
          <TouchableOpacity onPress={onViewAll}>
            <Text style={styles.viewAllText}>View all</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.entriesList}>
        {displayEntries.map((entry) => (
          <ActivityEntry key={entry.id} entry={entry} />
        ))}
      </View>
    </View>
  );
};

const ActivityEntry: React.FC<{ entry: ActionLogEntry }> = ({ entry }) => {
  return (
    <View style={styles.entryContainer}>
      <View
        style={[
          styles.entryDot,
          { backgroundColor: BOUNDARY_COLORS[entry.boundary] },
        ]}
      />
      <Text style={styles.entryTime}>{formatTime(entry.timestamp)}</Text>
      <Text style={styles.entryMessage} numberOfLines={1}>
        {entry.message}
      </Text>
      <Text style={styles.entryIndicator}>
        {BOUNDARY_INDICATORS[entry.boundary]}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.cardDark,
    borderRadius: borderRadius.default,
    padding: spacing[4],
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[3],
  },
  title: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimaryDark,
  },
  viewAllText: {
    fontSize: typography.fontSize.sm,
    color: colors.primary,
    fontWeight: typography.fontWeight.medium,
  },
  entriesList: {
    gap: spacing[2],
  },
  entryContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing[2],
  },
  entryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: spacing[2],
  },
  entryTime: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    width: 70,
  },
  entryMessage: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: colors.textPrimaryDark,
    marginRight: spacing[2],
  },
  entryIndicator: {
    fontSize: 12,
  },
  emptyState: {
    paddingVertical: spacing[4],
    alignItems: 'center',
  },
  emptyText: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
  },
});

export default ActivityFeed;
