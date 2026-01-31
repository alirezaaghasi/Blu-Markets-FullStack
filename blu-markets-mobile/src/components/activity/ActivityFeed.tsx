// Activity Feed Component (HERO Element)
// Based on CLAUDE_CODE_HANDOFF.md Section 6 & activity_hero_dashboard mockup
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { COLORS } from '../../constants/colors';
import { TYPOGRAPHY } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';
import { ActivityEntry, ActivityEntryData } from './ActivityEntry';
import { ACTIVITY } from '../../constants/messages';

interface ActivityFeedProps {
  entries: ActivityEntryData[];
  maxVisible?: number;
  onSeeAll?: () => void;
  showTimeline?: boolean;
  title?: string;
}

export const ActivityFeed: React.FC<ActivityFeedProps> = ({
  entries,
  maxVisible = 5,
  onSeeAll,
  showTimeline = true,
  title = 'Recent Activity',
}) => {
  const visibleEntries = entries.slice(0, maxVisible);

  if (entries.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <Text style={styles.emoji}>📝</Text>
            <Text style={styles.title}>{title}</Text>
          </View>
        </View>
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>{ACTIVITY.emptyTitle}</Text>
          <Text style={styles.emptySubtext}>{ACTIVITY.emptySubtitle}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Card Header */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.emoji}>📝</Text>
          <Text style={styles.title}>{title}</Text>
        </View>
        {onSeeAll && entries.length > maxVisible && (
          <TouchableOpacity onPress={onSeeAll} style={styles.seeAllButton}>
            <Text style={styles.seeAllText}>See All</Text>
            <Text style={styles.seeAllArrow}>→</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Timeline */}
      <View style={styles.timeline}>
        {visibleEntries.map((entry, index) => (
          <ActivityEntry
            key={entry.id}
            entry={entry}
            isLast={index === visibleEntries.length - 1}
            showTimeline={showTimeline}
          />
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.background.surface,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    overflow: 'hidden',
    // Shadow for elevation
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING[5],
    paddingTop: SPACING[5],
    paddingBottom: SPACING[2],
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING[2],
  },
  emoji: {
    fontSize: 18,
  },
  title: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text.primary,
  },
  seeAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING[1],
  },
  seeAllText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.brand.primary,
  },
  seeAllArrow: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.brand.primary,
  },
  timeline: {
    padding: SPACING[5],
    paddingTop: SPACING[4],
  },
  emptyState: {
    padding: SPACING[6],
    alignItems: 'center',
  },
  emptyText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.text.secondary,
    marginBottom: SPACING[1],
  },
  emptySubtext: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.muted,
  },
});

export default ActivityFeed;
