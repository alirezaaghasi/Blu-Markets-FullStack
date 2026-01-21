// Dashboard Screen (Chat-First / Activity Hero)
// Based on CLAUDE_CODE_HANDOFF.md Section 4 & activity_hero_dashboard mockup
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  RefreshControl,
  Image,
} from 'react-native';
import { COLORS } from '../../constants/colors';
import { TYPOGRAPHY } from '../../constants/typography';
import { SPACING, RADIUS, SIZES } from '../../constants/spacing';
import { useAppSelector } from '../../hooks/useStore';
import { ActivityFeed, ActivityEntryData, Boundary } from '../../components/activity';
import AllocationBar from '../../components/AllocationBar';

// Format number with commas
const formatNumber = (num: number): string => {
  return num.toLocaleString('en-US');
};

// Status Chip Component
const StatusChip: React.FC<{ status: 'BALANCED' | 'SLIGHTLY_OFF' | 'ATTENTION_REQUIRED' }> = ({ status }) => {
  const config = {
    BALANCED: { label: 'Balanced', color: COLORS.semantic.success, dotColor: COLORS.semantic.success },
    SLIGHTLY_OFF: { label: 'Rebalance', color: COLORS.semantic.warning, dotColor: COLORS.semantic.warning },
    ATTENTION_REQUIRED: { label: 'Attention', color: COLORS.semantic.error, dotColor: COLORS.semantic.error },
  };

  const { label, color, dotColor } = config[status];

  return (
    <View style={[styles.statusChip, { backgroundColor: `${color}15`, borderColor: `${color}30` }]}>
      <View style={[styles.statusDot, { backgroundColor: dotColor }]} />
      <Text style={[styles.statusText, { color }]}>{label}</Text>
    </View>
  );
};

// Quick Action Button
const QuickActionButton: React.FC<{
  icon: string;
  label: string;
  onPress: () => void;
}> = ({ icon, label, onPress }) => (
  <TouchableOpacity style={styles.quickAction} onPress={onPress} activeOpacity={0.7}>
    <Text style={styles.quickActionIcon}>{icon}</Text>
    <Text style={styles.quickActionLabel}>{label}</Text>
  </TouchableOpacity>
);

// Holdings Preview Card
const HoldingsPreview: React.FC<{
  holdingsCount: number;
  totalInvested: number;
  topHolding?: { name: string; symbol: string; valueIRR: number; change: number };
  onViewAll: () => void;
}> = ({ holdingsCount, totalInvested, topHolding, onViewAll }) => (
  <View style={styles.holdingsCard}>
    <View style={styles.holdingsHeader}>
      <View>
        <Text style={styles.holdingsTitle}>Holdings</Text>
        <Text style={styles.holdingsSubtitle}>
          {holdingsCount} assets · {formatNumber(totalInvested)} IRR invested
        </Text>
      </View>
      <TouchableOpacity onPress={onViewAll}>
        <Text style={styles.viewAllLink}>View All</Text>
      </TouchableOpacity>
    </View>

    {topHolding && (
      <TouchableOpacity style={styles.holdingRow} activeOpacity={0.7}>
        <View style={styles.holdingLeft}>
          <View style={styles.holdingIcon}>
            <Text style={styles.holdingIconText}>₿</Text>
          </View>
          <View>
            <Text style={styles.holdingName}>{topHolding.name}</Text>
            <Text style={styles.holdingSymbol}>{topHolding.symbol}</Text>
          </View>
        </View>
        <View style={styles.holdingRight}>
          <Text style={styles.holdingValue}>{formatNumber(topHolding.valueIRR)} IRR</Text>
          <Text style={[styles.holdingChange, topHolding.change >= 0 ? styles.changePositive : styles.changeNegative]}>
            {topHolding.change >= 0 ? '+' : ''}{topHolding.change.toFixed(1)}%
          </Text>
        </View>
      </TouchableOpacity>
    )}
  </View>
);

const DashboardScreen: React.FC = () => {
  const [refreshing, setRefreshing] = useState(false);

  const { holdings, cashIRR, targetLayerPct, actionLog, status } = useAppSelector(
    (state) => state.portfolio
  );
  const { prices, fxRate } = useAppSelector((state) => state.prices);

  // Calculate totals
  const holdingsValueIRR = holdings.reduce((sum, h) => {
    if (h.assetId === 'IRR_FIXED_INCOME') return sum + h.quantity * 500000;
    const priceUSD = prices[h.assetId] || 0;
    return sum + h.quantity * priceUSD * fxRate;
  }, 0);
  const totalValueIRR = holdingsValueIRR + cashIRR;

  // Current allocation
  const layerValues = { FOUNDATION: 0, GROWTH: 0, UPSIDE: 0 };
  holdings.forEach((h) => {
    const value = h.assetId === 'IRR_FIXED_INCOME'
      ? h.quantity * 500000
      : h.quantity * (prices[h.assetId] || 0) * fxRate;
    layerValues[h.layer] += value;
  });

  const currentAllocation = {
    FOUNDATION: holdingsValueIRR > 0 ? layerValues.FOUNDATION / holdingsValueIRR : 0,
    GROWTH: holdingsValueIRR > 0 ? layerValues.GROWTH / holdingsValueIRR : 0,
    UPSIDE: holdingsValueIRR > 0 ? layerValues.UPSIDE / holdingsValueIRR : 0,
  };

  // Convert action log to ActivityEntryData
  const activityEntries: ActivityEntryData[] = actionLog.map((log, index) => ({
    id: String(log.id ?? `activity-${index}`),
    type: log.type,
    timestamp: log.timestamp || new Date().toISOString(),
    boundary: log.boundary || 'SAFE',
    message: log.message,
  }));

  // Get top holding
  const topHolding = holdings.length > 0 ? {
    name: 'Bitcoin',
    symbol: 'BTC',
    valueIRR: holdingsValueIRR * 0.5,
    change: 2.4,
  } : undefined;

  const onRefresh = async () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  };

  const showDriftAlert = status === 'SLIGHTLY_OFF' || status === 'ATTENTION_REQUIRED';

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.brand.primary}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <StatusChip status={status} />
          <View style={styles.headerRight}>
            <TouchableOpacity style={styles.notificationButton}>
              <Text style={styles.notificationIcon}>🔔</Text>
              <View style={styles.notificationBadge} />
            </TouchableOpacity>
            <View style={styles.avatarContainer}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>U</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Hero: Activity Feed */}
        <View style={styles.activitySection}>
          <ActivityFeed
            entries={activityEntries}
            maxVisible={5}
            onSeeAll={() => {/* Navigate to History */}}
            showTimeline={true}
          />
        </View>

        {/* Portfolio Value */}
        <View style={styles.valueSection}>
          <Text style={styles.valueAmount}>
            {formatNumber(totalValueIRR)} <Text style={styles.valueCurrency}>IRR</Text>
          </Text>
          <View style={styles.changeChip}>
            <Text style={styles.changeIcon}>📈</Text>
            <Text style={styles.changeText}>+1.2% Today</Text>
          </View>
        </View>

        {/* Allocation Bar */}
        <View style={styles.allocationSection}>
          <AllocationBar current={currentAllocation} target={targetLayerPct} />
        </View>

        {/* Alert Banner (conditional) */}
        {showDriftAlert && (
          <View style={styles.alertBanner}>
            <View style={styles.alertLeft}>
              <Text style={styles.alertIcon}>⚠️</Text>
              <Text style={styles.alertText}>Portfolio drifted 7% from target</Text>
            </View>
            <TouchableOpacity style={styles.rebalanceButton}>
              <Text style={styles.rebalanceButtonText}>Rebalance</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Quick Actions */}
        <View style={styles.quickActionsSection}>
          <QuickActionButton icon="➕" label="Add Funds" onPress={() => {}} />
          <QuickActionButton icon="↔️" label="Trade" onPress={() => {}} />
          <QuickActionButton icon="🛡️" label="Protect" onPress={() => {}} />
        </View>

        {/* Holdings Preview */}
        <View style={styles.holdingsSection}>
          <HoldingsPreview
            holdingsCount={holdings.length}
            totalInvested={holdingsValueIRR}
            topHolding={topHolding}
            onViewAll={() => {}}
          />
        </View>
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity style={styles.fab} activeOpacity={0.8}>
        <Text style={styles.fabIcon}>⚡</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background.primary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 120,
  },
  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING[4],
    paddingVertical: SPACING[4],
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING[3],
    paddingVertical: SPACING[2],
    borderRadius: RADIUS.full,
    borderWidth: 1,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: SPACING[2],
  },
  statusText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING[4],
  },
  notificationButton: {
    position: 'relative',
  },
  notificationIcon: {
    fontSize: 24,
  },
  notificationBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.semantic.error,
    borderWidth: 2,
    borderColor: COLORS.background.primary,
  },
  avatarContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    padding: 2,
    backgroundColor: COLORS.brand.primary,
  },
  avatar: {
    flex: 1,
    borderRadius: 18,
    backgroundColor: COLORS.background.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text.primary,
  },
  // Activity Section
  activitySection: {
    paddingHorizontal: SPACING[4],
    marginTop: SPACING[2],
  },
  // Value Section
  valueSection: {
    alignItems: 'center',
    paddingHorizontal: SPACING[4],
    marginTop: SPACING[6],
  },
  valueAmount: {
    fontSize: TYPOGRAPHY.fontSize['4xl'],
    fontWeight: TYPOGRAPHY.fontWeight.extrabold,
    color: COLORS.text.primary,
    letterSpacing: -1,
  },
  valueCurrency: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.muted,
  },
  changeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${COLORS.semantic.success}15`,
    paddingHorizontal: SPACING[3],
    paddingVertical: SPACING[1],
    borderRadius: RADIUS.full,
    marginTop: SPACING[2],
  },
  changeIcon: {
    fontSize: 14,
    marginRight: SPACING[1],
  },
  changeText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.semantic.success,
  },
  // Allocation Section
  allocationSection: {
    paddingHorizontal: SPACING[4],
    marginTop: SPACING[6],
  },
  // Alert Banner
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: SPACING[4],
    marginTop: SPACING[6],
    padding: SPACING[4],
    backgroundColor: `${COLORS.semantic.warning}15`,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: `${COLORS.semantic.warning}30`,
  },
  alertLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  alertIcon: {
    fontSize: 18,
    marginRight: SPACING[3],
  },
  alertText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.text.primary,
    flex: 1,
  },
  rebalanceButton: {
    backgroundColor: COLORS.semantic.warning,
    paddingHorizontal: SPACING[3],
    paddingVertical: SPACING[2],
    borderRadius: RADIUS.md,
  },
  rebalanceButtonText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: '#000',
  },
  // Quick Actions
  quickActionsSection: {
    flexDirection: 'row',
    paddingHorizontal: SPACING[4],
    marginTop: SPACING[6],
    gap: SPACING[3],
  },
  quickAction: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING[3],
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  quickActionIcon: {
    fontSize: 20,
    marginBottom: SPACING[2],
  },
  quickActionLabel: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text.primary,
  },
  // Holdings Section
  holdingsSection: {
    paddingHorizontal: SPACING[4],
    marginTop: SPACING[6],
  },
  holdingsCard: {
    backgroundColor: COLORS.background.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING[4],
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  holdingsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING[4],
  },
  holdingsTitle: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text.primary,
  },
  holdingsSubtitle: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.text.muted,
    marginTop: 2,
  },
  viewAllLink: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.brand.primary,
  },
  holdingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING[3],
    borderRadius: RADIUS.md,
  },
  holdingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  holdingIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F7931A',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING[3],
  },
  holdingIconText: {
    fontSize: 20,
    color: '#fff',
  },
  holdingName: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text.primary,
  },
  holdingSymbol: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.text.muted,
  },
  holdingRight: {
    alignItems: 'flex-end',
  },
  holdingValue: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text.primary,
  },
  holdingChange: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
  changePositive: {
    color: COLORS.semantic.success,
  },
  changeNegative: {
    color: COLORS.semantic.error,
  },
  // FAB
  fab: {
    position: 'absolute',
    bottom: SIZES.bottomNavHeight + SPACING[4],
    right: SPACING[4],
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.brand.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.brand.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  fabIcon: {
    fontSize: 24,
  },
});

export default DashboardScreen;
