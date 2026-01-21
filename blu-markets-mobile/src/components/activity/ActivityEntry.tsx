// Activity Entry Component
// Based on CLAUDE_CODE_HANDOFF.md Section 6 & activity_hero_dashboard mockup
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../../constants/colors';
import { TYPOGRAPHY } from '../../constants/typography';
import { SPACING } from '../../constants/spacing';
import { BoundaryDot, BoundaryBadge, Boundary } from './BoundaryIndicator';

export type ActivityType =
  | 'PORTFOLIO_CREATED'
  | 'ADD_FUNDS'
  | 'TRADE'
  | 'REBALANCE'
  | 'PROTECT'
  | 'CANCEL_PROTECTION'
  | 'BORROW'
  | 'REPAY';

export interface ActivityEntryData {
  id: string;
  type: ActivityType;
  timestamp: string;
  boundary: Boundary;
  message: string;
  payload?: {
    amountIRR?: number;
    assetId?: string;
    side?: 'BUY' | 'SELL';
    months?: number;
  };
}

interface ActivityEntryProps {
  entry: ActivityEntryData;
  isLast?: boolean;
  showTimeline?: boolean;
}

// Format relative time
const formatRelativeTime = (timestamp: string): string => {
  const now = new Date();
  const then = new Date(timestamp);
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  const diffWeeks = Math.floor(diffDays / 7);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return `${diffWeeks}w ago`;
};

export const ActivityEntry: React.FC<ActivityEntryProps> = ({
  entry,
  isLast = false,
  showTimeline = true,
}) => {
  return (
    <View style={styles.container}>
      {/* Timeline column */}
      {showTimeline && (
        <View style={styles.timelineColumn}>
          <BoundaryDot boundary={entry.boundary} />
          {!isLast && <View style={styles.timelineLine} />}
        </View>
      )}

      {/* Content column */}
      <View style={[styles.contentColumn, isLast && styles.contentColumnLast]}>
        <View style={styles.headerRow}>
          <Text style={styles.message} numberOfLines={1}>
            {entry.message}
          </Text>
          <BoundaryBadge boundary={entry.boundary} />
        </View>
        <Text style={styles.timestamp}>{formatRelativeTime(entry.timestamp)}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
  },
  timelineColumn: {
    width: 24,
    alignItems: 'center',
    marginRight: SPACING[4],
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginTop: SPACING[1],
  },
  contentColumn: {
    flex: 1,
    paddingBottom: SPACING[5],
  },
  contentColumnLast: {
    paddingBottom: SPACING[1],
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  message: {
    flex: 1,
    fontSize: 15,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.primary,
    marginRight: SPACING[2],
  },
  timestamp: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.text.muted,
  },
});

export default ActivityEntry;
