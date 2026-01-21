// History Screen
// Based on PRD Section 9.5 - History Tab
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { colors, typography, spacing, borderRadius } from '../../constants/theme';
import { Boundary, ActionType, AssetId, ActionLogEntry } from '../../types';
import { exportToCSV } from '../../utils/csvExport';
import { historyApi, ActivityLogEntry as ApiActivityLogEntry } from '../../services/api';

// Boundary indicator colors and icons
const BOUNDARY_CONFIG: Record<Boundary, { color: string; icon: string }> = {
  SAFE: { color: colors.boundarySafe, icon: '🟢' },
  DRIFT: { color: colors.boundaryDrift, icon: '🟡' },
  STRUCTURAL: { color: colors.boundaryStructural, icon: '🟠' },
  STRESS: { color: colors.boundaryStress, icon: '🔴' },
};

// Action type icons
const ACTION_ICONS: Record<ActionType, string> = {
  PORTFOLIO_CREATED: '🎉',
  ADD_FUNDS: '💵',
  TRADE: '↔️',
  REBALANCE: '⚖️',
  PROTECT: '🛡️',
  CANCEL_PROTECTION: '❌',
  BORROW: '💰',
  REPAY: '✓',
};

// Format date for section headers
const formatDateHeader = (date: Date): string => {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const yesterdayOnly = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());

  if (dateOnly.getTime() === todayOnly.getTime()) return 'Today';
  if (dateOnly.getTime() === yesterdayOnly.getTime()) return 'Yesterday';

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
  });
};

// Format time
const formatTime = (timestamp: string): string => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
};

// Group entries by date
const groupByDate = (entries: ActionLogEntry[]): Map<string, ActionLogEntry[]> => {
  const groups = new Map<string, ActionLogEntry[]>();

  entries.forEach((entry) => {
    const date = new Date(entry.timestamp);
    const dateKey = formatDateHeader(date);

    if (!groups.has(dateKey)) {
      groups.set(dateKey, []);
    }
    groups.get(dateKey)!.push(entry);
  });

  return groups;
};

const HistoryScreen: React.FC = () => {
  const [actionLog, setActionLog] = useState<ActionLogEntry[]>([]);
  const [expandedEntries, setExpandedEntries] = useState<Set<number>>(new Set());
  const [isExporting, setIsExporting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch activity from backend
  const fetchActivity = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setIsRefreshing(true);
    else setIsLoading(true);
    setError(null);

    try {
      const response = await historyApi.getActivity();
      // Convert API response to local format
      const entries: ActionLogEntry[] = response.map((item) => ({
        id: parseInt(item.id, 10) || Date.now(),
        timestamp: item.createdAt,
        type: item.actionType as ActionType,
        boundary: (item.boundary || 'SAFE') as Boundary,
        message: item.message,
        amountIRR: item.amountIrr,
        assetId: item.assetId as AssetId | undefined,
      }));
      setActionLog(entries);
    } catch (err: any) {
      setError(err?.message || 'Failed to load activity');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchActivity();
  }, [fetchActivity]);

  const onRefresh = () => fetchActivity(true);

  const toggleExpand = (entryId: number) => {
    setExpandedEntries((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(entryId)) {
        newSet.delete(entryId);
      } else {
        newSet.add(entryId);
      }
      return newSet;
    });
  };

  const groupedEntries = groupByDate(actionLog);

  const handleExportCSV = async () => {
    if (actionLog.length === 0) {
      Alert.alert('No Data', 'There is no transaction history to export.');
      return;
    }

    setIsExporting(true);
    try {
      const result = await exportToCSV(actionLog);
      if (!result.success) {
        Alert.alert('Export Failed', result.error || 'Unable to export history.');
      }
    } catch (error) {
      Alert.alert('Export Failed', 'An error occurred while exporting.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Your History</Text>
        <TouchableOpacity
          style={[styles.exportButton, isExporting && styles.exportButtonDisabled]}
          onPress={handleExportCSV}
          disabled={isExporting}
        >
          {isExporting ? (
            <ActivityIndicator size="small" color={colors.textPrimaryDark} />
          ) : (
            <Text style={styles.exportButtonText}>Export CSV</Text>
          )}
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.loadingState}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading history...</Text>
        </View>
      ) : error ? (
        <View style={styles.errorState}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => fetchActivity()}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : actionLog.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>📜</Text>
          <Text style={styles.emptyTitle}>No activity yet</Text>
          <Text style={styles.emptySubtitle}>
            Your transaction history will appear here
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
        >
          {Array.from(groupedEntries.entries()).map(([dateKey, entries]) => (
            <View key={dateKey} style={styles.dateSection}>
              <Text style={styles.dateSectionHeader}>{dateKey}</Text>
              <View style={styles.entriesList}>
                {entries.map((entry) => (
                  <HistoryEntry
                    key={entry.id}
                    entry={entry}
                    expanded={expandedEntries.has(entry.id)}
                    onToggle={() => toggleExpand(entry.id)}
                  />
                ))}
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

// History Entry Component
const HistoryEntry: React.FC<{
  entry: ActionLogEntry;
  expanded: boolean;
  onToggle: () => void;
}> = ({ entry, expanded, onToggle }) => {
  const config = BOUNDARY_CONFIG[entry.boundary];
  const icon = ACTION_ICONS[entry.type] || '●';

  return (
    <TouchableOpacity
      style={styles.entryCard}
      onPress={onToggle}
      activeOpacity={0.7}
    >
      <View style={styles.entryHeader}>
        <View style={styles.entryLeft}>
          <Text style={styles.entryIcon}>{icon}</Text>
          <View style={styles.entryInfo}>
            <Text style={styles.entryMessage}>{entry.message}</Text>
            <Text style={styles.entryTime}>{formatTime(entry.timestamp)}</Text>
          </View>
        </View>
        <View style={styles.entryRight}>
          <Text style={styles.boundaryIndicator}>{config.icon}</Text>
          <Text style={styles.expandIcon}>{expanded ? '▼' : '▶'}</Text>
        </View>
      </View>

      {expanded && (
        <View style={styles.entryDetails}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Type</Text>
            <Text style={styles.detailValue}>{entry.type.replace(/_/g, ' ')}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Boundary</Text>
            <View style={[styles.boundaryBadge, { backgroundColor: `${config.color}20` }]}>
              <Text style={[styles.boundaryText, { color: config.color }]}>
                {entry.boundary}
              </Text>
            </View>
          </View>
          {entry.amountIRR && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Amount</Text>
              <Text style={styles.detailValue}>
                {entry.amountIRR.toLocaleString('en-US')} IRR
              </Text>
            </View>
          )}
          {entry.assetId && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Asset</Text>
              <Text style={styles.detailValue}>{entry.assetId}</Text>
            </View>
          )}
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Transaction ID</Text>
            <Text style={styles.detailValue}>#{entry.id.toString(36).toUpperCase()}</Text>
          </View>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgDark,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: colors.borderDark,
  },
  title: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimaryDark,
  },
  exportButton: {
    backgroundColor: colors.surfaceDark,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.borderDark,
  },
  exportButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.textPrimaryDark,
  },
  exportButtonDisabled: {
    opacity: 0.6,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing[4],
  },
  loadingState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing[8],
  },
  loadingText: {
    marginTop: spacing[3],
    fontSize: typography.fontSize.base,
    color: colors.textSecondary,
  },
  errorState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing[8],
  },
  errorText: {
    fontSize: typography.fontSize.base,
    color: colors.error,
    textAlign: 'center',
    marginBottom: spacing[4],
  },
  retryButton: {
    backgroundColor: colors.surfaceDark,
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[3],
    borderRadius: borderRadius.full,
  },
  retryButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing[8],
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: spacing[4],
  },
  emptyTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimaryDark,
    marginBottom: spacing[2],
  },
  emptySubtitle: {
    fontSize: typography.fontSize.base,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  dateSection: {
    marginBottom: spacing[6],
  },
  dateSectionHeader: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textSecondary,
    marginBottom: spacing[3],
    textTransform: 'uppercase',
  },
  entriesList: {
    gap: spacing[2],
  },
  entryCard: {
    backgroundColor: colors.cardDark,
    borderRadius: borderRadius.default,
    padding: spacing[4],
  },
  entryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  entryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  entryIcon: {
    fontSize: 20,
    marginRight: spacing[3],
  },
  entryInfo: {
    flex: 1,
  },
  entryMessage: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.textPrimaryDark,
    marginBottom: 2,
  },
  entryTime: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
  },
  entryRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  boundaryIndicator: {
    fontSize: 14,
    marginRight: spacing[2],
  },
  expandIcon: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  entryDetails: {
    marginTop: spacing[4],
    paddingTop: spacing[4],
    borderTopWidth: 1,
    borderTopColor: colors.borderDark,
    gap: spacing[3],
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
  },
  detailValue: {
    fontSize: typography.fontSize.sm,
    color: colors.textPrimaryDark,
    fontWeight: typography.fontWeight.medium,
  },
  boundaryBadge: {
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: borderRadius.sm,
  },
  boundaryText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
  },
});

export default HistoryScreen;
