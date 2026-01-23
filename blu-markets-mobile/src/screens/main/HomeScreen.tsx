// Home Screen (Command Center / Activity Hero)
// Based on UI Restructure Specification Section 2
// Updated to use API hooks for backend integration

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { COLORS } from '../../constants/colors';
import { TYPOGRAPHY } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';
import { useAppSelector, useAppDispatch } from '../../hooks/useStore';
import { useActivityFeed } from '../../hooks/useActivityFeed';
import { setHoldings, updateCash, setStatus, setTargetLayerPct } from '../../store/slices/portfolioSlice';
import { fetchPrices, fetchFxRate } from '../../store/slices/pricesSlice';
import { portfolio as portfolioApi } from '../../services/api';
import type { Holding } from '../../types';
import { ASSETS } from '../../constants/assets';
import { FIXED_INCOME_UNIT_PRICE } from '../../constants/business';
import { ActivityCard } from '../../components/ActivityCard';
import AllocationBar from '../../components/AllocationBar';
import { TradeBottomSheet } from '../../components/TradeBottomSheet';
import { AddFundsSheet } from '../../components/AddFundsSheet';
import RebalanceSheet from '../../components/RebalanceSheet';
import { EmptyState } from '../../components/EmptyState';
import { ActionLogEntry } from '../../types';

// Format number with commas
const formatNumber = (num: number): string => {
  if (num >= 1_000_000_000) {
    return `${(num / 1_000_000_000).toFixed(1)}B`;
  }
  if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(1)}M`;
  }
  return num.toLocaleString('en-US');
};

// Format relative time
const formatRelativeTime = (timestamp: string): string => {
  const now = Date.now();
  const time = new Date(timestamp).getTime();
  const diff = now - time;

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return 'Yesterday';
  return `${days}d ago`;
};

// Status Chip Component
const StatusChip: React.FC<{ status: 'BALANCED' | 'SLIGHTLY_OFF' | 'ATTENTION_REQUIRED' }> = ({ status }) => {
  const config = {
    BALANCED: { label: 'Balanced', color: COLORS.semantic.success },
    SLIGHTLY_OFF: { label: 'Rebalance', color: COLORS.semantic.warning },
    ATTENTION_REQUIRED: { label: 'Attention', color: COLORS.semantic.error },
  };

  const { label, color } = config[status];

  return (
    <View style={[styles.statusChip, { backgroundColor: `${color}15`, borderColor: `${color}30` }]}>
      <View style={[styles.statusDot, { backgroundColor: color }]} />
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

const HomeScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const dispatch = useAppDispatch();

  // Use activity feed hook for API data
  const {
    activities,
    isLoading: isLoadingActivities,
    isRefreshing: isRefreshingActivities,
    refresh: refreshActivities,
  } = useActivityFeed(5);

  // Bottom sheet visibility state
  const [tradeSheetVisible, setTradeSheetVisible] = useState(false);
  const [addFundsSheetVisible, setAddFundsSheetVisible] = useState(false);
  const [rebalanceSheetVisible, setRebalanceSheetVisible] = useState(false);
  const [driftAlertDismissed, setDriftAlertDismissed] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Keep using Redux for portfolio data (will be updated with usePortfolio in future)
  const portfolioState = useAppSelector((state) => state.portfolio);
  const holdings = portfolioState?.holdings || [];
  const cashIRR = portfolioState?.cashIRR || 0;
  const targetLayerPct = portfolioState?.targetLayerPct || { FOUNDATION: 0.5, GROWTH: 0.35, UPSIDE: 0.15 };
  const loans = portfolioState?.loans || [];
  const { prices, fxRate, change24h } = useAppSelector((state) => state.prices);
  const { phone } = useAppSelector((state) => state.auth);

  // Calculate totals
  const holdingsValueIRR = holdings.reduce((sum, h) => {
    if (h.assetId === 'IRR_FIXED_INCOME') return sum + h.quantity * FIXED_INCOME_UNIT_PRICE;
    const priceUSD = prices[h.assetId] || 0;
    return sum + h.quantity * priceUSD * fxRate;
  }, 0);
  const totalValueIRR = holdingsValueIRR + cashIRR;

  // Current allocation using ASSET CONFIG layer
  const layerValues = { FOUNDATION: cashIRR, GROWTH: 0, UPSIDE: 0 };
  holdings.forEach((h) => {
    const asset = ASSETS[h.assetId];
    const layer = asset?.layer || h.layer;
    const value = h.assetId === 'IRR_FIXED_INCOME'
      ? h.quantity * FIXED_INCOME_UNIT_PRICE
      : h.quantity * (prices[h.assetId] || 0) * fxRate;
    layerValues[layer] += value;
  });

  const totalForAllocation = layerValues.FOUNDATION + layerValues.GROWTH + layerValues.UPSIDE;
  const currentAllocation = {
    FOUNDATION: totalForAllocation > 0 ? layerValues.FOUNDATION / totalForAllocation : 0,
    GROWTH: totalForAllocation > 0 ? layerValues.GROWTH / totalForAllocation : 0,
    UPSIDE: totalForAllocation > 0 ? layerValues.UPSIDE / totalForAllocation : 0,
  };

  // Calculate weighted average 24h change for portfolio
  const portfolioDailyChange = (() => {
    let weightedSum = 0;
    let totalWeight = 0;
    holdings.forEach((h) => {
      const assetChange = change24h?.[h.assetId];
      if (assetChange !== undefined) {
        const value = h.assetId === 'IRR_FIXED_INCOME'
          ? h.quantity * FIXED_INCOME_UNIT_PRICE
          : h.quantity * (prices[h.assetId] || 0) * fxRate;
        weightedSum += assetChange * value;
        totalWeight += value;
      }
    });
    return totalWeight > 0 ? weightedSum / totalWeight : null;
  })();

  // Get top holdings
  const topHoldings = holdings
    .map((h) => {
      const asset = ASSETS[h.assetId];
      const value = h.assetId === 'IRR_FIXED_INCOME'
        ? h.quantity * FIXED_INCOME_UNIT_PRICE
        : h.quantity * (prices[h.assetId] || 0) * fxRate;
      return { ...h, asset, value };
    })
    .sort((a, b) => b.value - a.value)
    .slice(0, 3);

  // Check for pending loan payments
  const nextLoanPayment = loans.length > 0 ? (() => {
    const loan = loans[0];
    const nextInstallment = loan.installments.find((i) => i.status === 'PENDING');
    if (nextInstallment) {
      const daysUntil = Math.ceil(
        (new Date(nextInstallment.dueISO).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );
      return { loan, installment: nextInstallment, daysUntil };
    }
    return null;
  })() : null;

  // Deep link navigation handlers
  const handleDeepLinkPortfolio = () => {
    navigation.navigate('Portfolio');
  };

  const handleDeepLinkServices = (initialTab?: 'loans' | 'protection', loanId?: string) => {
    navigation.navigate('Services', { initialTab, loanId });
  };

  // Calculate portfolio status
  const getPortfolioStatus = () => {
    if (currentAllocation.FOUNDATION < 0.30 || currentAllocation.UPSIDE > 0.25) {
      return 'ATTENTION_REQUIRED';
    }
    const drifts = [
      Math.abs(currentAllocation.FOUNDATION - targetLayerPct.FOUNDATION),
      Math.abs(currentAllocation.GROWTH - targetLayerPct.GROWTH),
      Math.abs(currentAllocation.UPSIDE - targetLayerPct.UPSIDE),
    ];
    const maxDrift = Math.max(...drifts);
    if (maxDrift > 0.05) return 'SLIGHTLY_OFF';
    return 'BALANCED';
  };

  const calculatedStatus = holdingsValueIRR === 0 ? 'BALANCED' : getPortfolioStatus();
  const showDriftAlert = calculatedStatus === 'SLIGHTLY_OFF' || calculatedStatus === 'ATTENTION_REQUIRED';

  // Comprehensive refresh that fetches all data
  const onRefresh = async () => {
    setIsRefreshing(true);
    try {
      // Fetch activities, portfolio, prices, and FX rate in parallel
      const [portfolioResponse] = await Promise.all([
        portfolioApi.get(),
        refreshActivities(),
        dispatch(fetchPrices()),
        dispatch(fetchFxRate()),
      ]);

      // Update Redux state with fresh portfolio data
      dispatch(updateCash(portfolioResponse.cashIrr));
      dispatch(setStatus(portfolioResponse.status));
      dispatch(setTargetLayerPct(portfolioResponse.targetAllocation));
      if (portfolioResponse.holdings) {
        dispatch(setHoldings(portfolioResponse.holdings.map((h: Holding) => ({
          assetId: h.assetId,
          quantity: h.quantity,
          frozen: h.frozen,
          layer: h.layer,
        }))));
      }
    } catch (error) {
      console.error('Failed to refresh home screen data:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing || isRefreshingActivities}
            onRefresh={onRefresh}
            tintColor={COLORS.brand.primary}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <StatusChip status={calculatedStatus} />
          <View style={styles.headerRight}>
            <TouchableOpacity style={styles.notificationButton}>
              <Text style={styles.notificationIcon}>🔔</Text>
              {nextLoanPayment && nextLoanPayment.daysUntil <= 7 && (
                <View style={styles.notificationBadge} />
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.avatarContainer}
              onPress={() => navigation.navigate('Profile')}
            >
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {phone ? phone.slice(-2) : 'U'}
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Hero: Activity Feed */}
        <View style={styles.activitySection}>
          <Text style={styles.sectionTitle}>📋 Recent Activity</Text>

          {isLoadingActivities ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={COLORS.brand.primary} />
            </View>
          ) : activities.length === 0 ? (
            <EmptyState
              icon="time-outline"
              title="No Recent Activity"
              description="Your transactions will appear here"
              compact
            />
          ) : (
            activities.map((entry: ActionLogEntry) => (
              <ActivityCard
                key={entry.id}
                id={entry.id}
                type={entry.type}
                title={entry.message}
                timestamp={formatRelativeTime(entry.timestamp)}
                boundary={entry.boundary}
                deepLink={
                  entry.type === 'TRADE'
                    ? { label: 'View in Portfolio →', onPress: handleDeepLinkPortfolio }
                    : entry.type === 'BORROW' || entry.type === 'REPAY'
                    ? { label: 'View Loan →', onPress: () => handleDeepLinkServices('loans') }
                    : entry.type === 'PROTECT' || entry.type === 'CANCEL_PROTECTION'
                    ? { label: 'View Protection →', onPress: () => handleDeepLinkServices('protection') }
                    : undefined
                }
              />
            ))
          )}

          {/* Loan Payment Due Alert */}
          {nextLoanPayment && nextLoanPayment.daysUntil <= 7 && (
            <ActivityCard
              id="loan-payment-alert"
              type="LOAN_PAYMENT"
              title={`Loan payment due in ${nextLoanPayment.daysUntil} days`}
              subtitle={`${nextLoanPayment.installment.totalIRR.toLocaleString()} IRR`}
              timestamp=""
              primaryAction={{
                label: 'Pay Now',
                onPress: () => handleDeepLinkServices('loans', nextLoanPayment.loan.id),
              }}
              deepLink={{
                label: 'View Loan →',
                onPress: () => handleDeepLinkServices('loans', nextLoanPayment.loan.id),
              }}
            />
          )}

          {/* Drift Alert */}
          {showDriftAlert && !driftAlertDismissed && (
            <ActivityCard
              id="drift-alert"
              type="ALERT"
              title={`Portfolio drifted from target`}
              timestamp=""
              boundary={calculatedStatus === 'ATTENTION_REQUIRED' ? 'STRUCTURAL' : 'DRIFT'}
              primaryAction={{
                label: 'Rebalance Now',
                onPress: () => setRebalanceSheetVisible(true),
              }}
              secondaryAction={{
                label: 'Later',
                onPress: () => setDriftAlertDismissed(true),
              }}
            />
          )}
        </View>

        {/* Portfolio Value */}
        <View style={styles.valueSection}>
          <Text style={styles.valueAmount}>
            {formatNumber(totalValueIRR)} <Text style={styles.valueCurrency}>IRR</Text>
          </Text>
          <View style={[
            styles.changeChip,
            portfolioDailyChange !== null && portfolioDailyChange < 0 && styles.changeChipNegative,
          ]}>
            <Text style={styles.changeIcon}>
              {portfolioDailyChange === null ? '📊' : portfolioDailyChange >= 0 ? '📈' : '📉'}
            </Text>
            <Text style={[
              styles.changeText,
              portfolioDailyChange !== null && portfolioDailyChange < 0 && styles.changeTextNegative,
            ]}>
              {portfolioDailyChange !== null
                ? `${portfolioDailyChange >= 0 ? '+' : ''}${portfolioDailyChange.toFixed(1)}% Today`
                : '-- Today'}
            </Text>
          </View>
        </View>

        {/* Allocation Bar */}
        <View style={styles.allocationSection}>
          <AllocationBar current={currentAllocation} target={targetLayerPct} />
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActionsSection}>
          <QuickActionButton icon="➕" label="Add Funds" onPress={() => setAddFundsSheetVisible(true)} />
          <QuickActionButton icon="↔️" label="Trade" onPress={() => setTradeSheetVisible(true)} />
          <QuickActionButton icon="🛡️" label="Protect" onPress={() => handleDeepLinkServices('protection')} />
        </View>

        {/* Holdings Preview */}
        <View style={styles.holdingsSection}>
          <View style={styles.holdingsHeader}>
            <Text style={styles.holdingsTitle}>Holdings</Text>
            {topHoldings.length > 0 && (
              <TouchableOpacity onPress={handleDeepLinkPortfolio}>
                <Text style={styles.viewAllLink}>View All →</Text>
              </TouchableOpacity>
            )}
          </View>

          {topHoldings.length === 0 ? (
            <EmptyState
              icon="wallet-outline"
              title="Start Your Journey"
              description="Add funds to begin investing in crypto assets"
              actionLabel="Add Funds"
              onAction={() => setAddFundsSheetVisible(true)}
              compact
            />
          ) : topHoldings.map((holding) => (
            <TouchableOpacity
              key={holding.assetId}
              style={styles.holdingRow}
              onPress={handleDeepLinkPortfolio}
            >
              <View style={styles.holdingLeft}>
                <View style={[styles.holdingIcon, { backgroundColor: `${COLORS.layers[holding.asset?.layer?.toLowerCase() as keyof typeof COLORS.layers]}40` }]}>
                  <Text style={styles.holdingIconText}>
                    {holding.asset?.symbol?.slice(0, 2) || '?'}
                  </Text>
                </View>
                <View>
                  <Text style={styles.holdingName}>{holding.asset?.name || holding.assetId}</Text>
                  <Text style={styles.holdingSymbol}>{holding.asset?.symbol || holding.assetId}</Text>
                </View>
              </View>
              <View style={styles.holdingRight}>
                <Text style={styles.holdingValue}>{formatNumber(holding.value)} IRR</Text>
                <Text style={[
                  styles.holdingChange,
                  change24h?.[holding.assetId] !== undefined
                    ? change24h[holding.assetId]! >= 0
                      ? styles.changePositive
                      : styles.changeNegative
                    : styles.changeNeutral,
                ]}>
                  {change24h?.[holding.assetId] !== undefined
                    ? `${change24h[holding.assetId]! >= 0 ? '+' : ''}${change24h[holding.assetId]!.toFixed(1)}%`
                    : '--'}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* Bottom Sheets */}
      <TradeBottomSheet
        visible={tradeSheetVisible}
        onClose={() => setTradeSheetVisible(false)}
      />
      <AddFundsSheet
        visible={addFundsSheetVisible}
        onClose={() => setAddFundsSheetVisible(false)}
      />
      <RebalanceSheet
        visible={rebalanceSheetVisible}
        onClose={() => setRebalanceSheetVisible(false)}
      />
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
  sectionTitle: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.secondary,
    marginBottom: SPACING[3],
  },
  loadingContainer: {
    padding: SPACING[6],
    alignItems: 'center',
  },
  emptyActivity: {
    backgroundColor: COLORS.background.elevated,
    borderRadius: RADIUS.lg,
    padding: SPACING[6],
    alignItems: 'center',
  },
  emptyActivityText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.muted,
  },
  // Value Section
  valueSection: {
    alignItems: 'center',
    paddingHorizontal: SPACING[4],
    marginTop: SPACING[6],
  },
  valueAmount: {
    fontSize: 32,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
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
    backgroundColor: COLORS.background.elevated,
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
  holdingsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING[3],
  },
  holdingsTitle: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text.primary,
  },
  viewAllLink: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.brand.primary,
  },
  holdingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.background.elevated,
    padding: SPACING[4],
    borderRadius: RADIUS.lg,
    marginBottom: SPACING[2],
  },
  holdingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  holdingIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING[3],
  },
  holdingIconText: {
    fontSize: 16,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text.primary,
  },
  holdingName: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.primary,
  },
  holdingSymbol: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.muted,
  },
  holdingRight: {
    alignItems: 'flex-end',
  },
  holdingValue: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.primary,
  },
  holdingChange: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
  changePositive: {
    color: COLORS.semantic.success,
  },
  changeNegative: {
    color: COLORS.semantic.error,
  },
  changeNeutral: {
    color: COLORS.text.muted,
  },
  changeChipNegative: {
    backgroundColor: `${COLORS.semantic.error}15`,
  },
  changeTextNegative: {
    color: COLORS.semantic.error,
  },
});

export default HomeScreen;
