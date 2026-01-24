/**
 * Home Screen (Chat UI) - Complete Implementation
 *
 * Design Philosophy (Screenless Positioning):
 * "Conversation captures intent. State is always explicit. Agency always wins."
 *
 * This is NOT a dashboard. It's a STATE SNAPSHOT that answers:
 * - What do I own right now?
 * - What is liquid vs. locked?
 * - What did the system do on my behalf?
 * - What requires my attention?
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { COLORS } from '../../constants/colors';
import { TYPOGRAPHY } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';
import { useAppSelector, useAppDispatch } from '../../hooks/useStore';
import { useActivityFeed } from '../../hooks/useActivityFeed';
import { usePriceConnection } from '../../hooks/usePriceConnection';
import { setHoldings, updateCash, setStatus, setTargetLayerPct } from '../../store/slices/portfolioSlice';
import { fetchPrices, fetchFxRate } from '../../store/slices/pricesSlice';
import { portfolio as portfolioApi } from '../../services/api';
import type { Holding, ActionLogEntry } from '../../types';
import { ASSETS } from '../../constants/assets';
import { FIXED_INCOME_UNIT_PRICE, DRIFT_TOLERANCE, LAYER_CONSTRAINTS } from '../../constants/business';
import { ActivityCard } from '../../components/ActivityCard';
import { TradeBottomSheet } from '../../components/TradeBottomSheet';
import { AddFundsSheet } from '../../components/AddFundsSheet';
import RebalanceSheet from '../../components/RebalanceSheet';
import { LoanSheet } from '../../components/LoanSheet';
import { ProtectionSheet } from '../../components/ProtectionSheet';
import { EmptyState } from '../../components/EmptyState';
import { formatRelativeTime } from '../../utils/dateUtils';

// =============================================================================
// TYPES
// =============================================================================

type PortfolioStatus = 'BALANCED' | 'SLIGHTLY_OFF' | 'ATTENTION_REQUIRED';

interface PortfolioStatusResult {
  status: PortfolioStatus;
  issues: string[];
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Format IRR with appropriate suffix
 */
function formatIRR(value: number): string {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  return value.toLocaleString('en-US');
}

/**
 * Format IRR with short suffix for activity log
 */
function formatIRRShort(value: number | undefined): string {
  if (value === undefined) return '0';
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B IRR`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(0)}M IRR`;
  return `${value.toLocaleString('en-US')} IRR`;
}

/**
 * Compute portfolio status based on drift from target
 */
function computePortfolioStatus(
  layerPct: { FOUNDATION: number; GROWTH: number; UPSIDE: number },
  targetLayerPct: { FOUNDATION: number; GROWTH: number; UPSIDE: number }
): PortfolioStatusResult {
  const issues: string[] = [];

  // Check drift from target for each layer
  for (const layer of ['FOUNDATION', 'GROWTH', 'UPSIDE'] as const) {
    const drift = Math.abs(layerPct[layer] - targetLayerPct[layer]);
    if (drift > DRIFT_TOLERANCE) {
      issues.push(`${layer}_${layerPct[layer] < targetLayerPct[layer] ? 'BELOW' : 'ABOVE'}_TARGET`);
    }
  }

  // Hard safety limits (absolute bounds from PRD)
  const hardMinFoundation = LAYER_CONSTRAINTS.FOUNDATION.hardMin || 0.30;
  const hardMaxUpside = LAYER_CONSTRAINTS.UPSIDE.hardMax || 0.25;

  if (layerPct.FOUNDATION < hardMinFoundation) {
    return { status: 'ATTENTION_REQUIRED', issues: [...issues, 'FOUNDATION_BELOW_HARD_FLOOR'] };
  }
  if (layerPct.UPSIDE > hardMaxUpside) {
    return { status: 'ATTENTION_REQUIRED', issues: [...issues, 'UPSIDE_ABOVE_HARD_CAP'] };
  }

  if (issues.length > 0) return { status: 'SLIGHTLY_OFF', issues };
  return { status: 'BALANCED', issues: [] };
}

/**
 * Format activity log message
 */
function formatActivityMessage(entry: ActionLogEntry): string {
  const assetName = entry.assetId ? (ASSETS[entry.assetId]?.name || entry.assetId) : '';

  switch (entry.type) {
    case 'PORTFOLIO_CREATED':
      return `Started with ${formatIRRShort(entry.amountIRR)}`;
    case 'ADD_FUNDS':
      return `Added ${formatIRRShort(entry.amountIRR)} cash`;
    case 'TRADE':
      return entry.message || `Traded ${assetName}`;
    case 'BORROW':
      return `Borrowed ${formatIRRShort(entry.amountIRR)} against ${assetName}`;
    case 'REPAY':
      return `Repaid ${formatIRRShort(entry.amountIRR)}`;
    case 'PROTECT':
      return `Protected ${assetName}`;
    case 'REBALANCE':
      return 'Rebalanced portfolio';
    case 'CANCEL_PROTECTION':
      return `Cancelled ${assetName} protection`;
    default:
      return entry.message || entry.type;
  }
}

// =============================================================================
// COMPONENTS
// =============================================================================

/**
 * Portfolio Health Status Badge
 */
const StatusBadge: React.FC<{ status: PortfolioStatus }> = ({ status }) => {
  const config = {
    BALANCED: { label: 'Balanced', color: '#4ade80', dotColor: '#22c55e' },
    SLIGHTLY_OFF: { label: 'Slightly Off', color: '#fde047', dotColor: '#eab308' },
    ATTENTION_REQUIRED: { label: 'Attention Required', color: '#f87171', dotColor: '#ef4444' },
  };

  const { label, color, dotColor } = config[status];

  return (
    <View style={[styles.statusBadge, { backgroundColor: `${color}20`, borderColor: `${color}40` }]}>
      <View style={[styles.statusDot, { backgroundColor: dotColor }]} />
      <Text style={[styles.statusLabel, { color: dotColor }]}>{label}</Text>
    </View>
  );
};

/**
 * Price Feed Status Indicator
 * Shows "Last updated: HH:MM" with yellow dot if stale (>5min), "Connecting..." if never fetched
 */
const PriceFeedStatus: React.FC<{ lastUpdate?: Date }> = ({ lastUpdate }) => {
  const now = new Date();
  const isStale = lastUpdate ? (now.getTime() - lastUpdate.getTime()) > 5 * 60 * 1000 : true;
  const neverFetched = !lastUpdate;

  const timeString = lastUpdate
    ? lastUpdate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    : null;

  const dotColor = neverFetched ? '#fde047' : isStale ? '#fde047' : '#4ade80';
  const statusText = neverFetched
    ? 'Connecting...'
    : `Last updated: ${timeString}`;

  return (
    <View style={styles.priceFeedContainer}>
      <View style={[styles.priceFeedDot, { backgroundColor: dotColor }]} />
      <Text style={styles.priceFeedText}>{statusText}</Text>
    </View>
  );
};

/**
 * Main Action Button (Row 1 - 3 equal width)
 */
const MainActionButton: React.FC<{
  label: string;
  onPress: () => void;
  disabled?: boolean;
}> = ({ label, onPress, disabled }) => (
  <TouchableOpacity
    style={[styles.mainActionButton, disabled && styles.mainActionButtonDisabled]}
    onPress={onPress}
    disabled={disabled}
    activeOpacity={0.7}
  >
    <Text style={[styles.mainActionLabel, disabled && styles.mainActionLabelDisabled]}>{label}</Text>
  </TouchableOpacity>
);

/**
 * Wide Action Button (Row 2 - 2 half-width)
 */
const WideActionButton: React.FC<{
  label: string;
  onPress: () => void;
  disabled?: boolean;
}> = ({ label, onPress, disabled }) => (
  <TouchableOpacity
    style={[styles.wideActionButton, disabled && styles.wideActionButtonDisabled]}
    onPress={onPress}
    disabled={disabled}
    activeOpacity={0.7}
  >
    <Text style={[styles.wideActionLabel, disabled && styles.wideActionLabelDisabled]}>{label}</Text>
  </TouchableOpacity>
);

// =============================================================================
// MAIN COMPONENT
// =============================================================================

const HomeScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const dispatch = useAppDispatch();

  // Price connection status
  const { isConnected: priceConnected, lastUpdate: priceLastUpdate } = usePriceConnection();

  // Activity feed from API
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
  const [loanSheetVisible, setLoanSheetVisible] = useState(false);
  const [protectionSheetVisible, setProtectionSheetVisible] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Redux state
  const portfolioState = useAppSelector((state) => state.portfolio);
  const holdings = portfolioState?.holdings || [];
  const cashIRR = portfolioState?.cashIRR || 0;
  const targetLayerPct = portfolioState?.targetLayerPct || { FOUNDATION: 0.50, GROWTH: 0.35, UPSIDE: 0.15 };
  const loans = portfolioState?.loans || [];
  const { prices, fxRate } = useAppSelector((state) => state.prices);
  const { phone, authToken } = useAppSelector((state) => state.auth);

  // Check if we're in demo mode (runtime check)
  const isDemoMode = authToken === 'demo-token';

  // ==========================================================================
  // COMPUTED VALUES
  // ==========================================================================

  // Calculate portfolio snapshot
  const snapshot = useMemo(() => {
    let holdingsIRR = 0;
    const layerIRR = { FOUNDATION: 0, GROWTH: 0, UPSIDE: 0 };

    for (const h of holdings) {
      let valueIRR: number;

      if (h.assetId === 'IRR_FIXED_INCOME') {
        // Fixed income: quantity × unit price + accrued interest
        const principal = h.quantity * FIXED_INCOME_UNIT_PRICE;
        // Note: Full accrued interest calculation would need purchaseDate
        valueIRR = principal;
      } else {
        // Crypto/ETF: quantity × priceUSD × fxRate
        const priceUSD = prices[h.assetId] || 0;
        valueIRR = h.quantity * priceUSD * fxRate;
      }

      holdingsIRR += valueIRR;
      const asset = ASSETS[h.assetId];
      const layer = asset?.layer || h.layer;
      if (layer) layerIRR[layer] += valueIRR;
    }

    // Cash is part of Foundation for allocation purposes, but tracked separately for display
    const totalIRR = holdingsIRR + cashIRR;
    const totalForAllocation = layerIRR.FOUNDATION + layerIRR.GROWTH + layerIRR.UPSIDE + cashIRR;

    // Add cash to Foundation for allocation calculation
    const layerPct = {
      FOUNDATION: totalForAllocation > 0 ? (layerIRR.FOUNDATION + cashIRR) / totalForAllocation : 0,
      GROWTH: totalForAllocation > 0 ? layerIRR.GROWTH / totalForAllocation : 0,
      UPSIDE: totalForAllocation > 0 ? layerIRR.UPSIDE / totalForAllocation : 0,
    };

    return { totalIRR, holdingsIRR, cashIRR, layerPct, layerIRR };
  }, [holdings, cashIRR, prices, fxRate]);

  // Calculate USD equivalent
  const totalUSD = useMemo(() => {
    return fxRate > 0 ? snapshot.totalIRR / fxRate : 0;
  }, [snapshot.totalIRR, fxRate]);

  // Calculate portfolio status
  const portfolioStatusResult = useMemo(() => {
    if (snapshot.holdingsIRR === 0 && cashIRR === 0) {
      return { status: 'BALANCED' as PortfolioStatus, issues: [] };
    }
    return computePortfolioStatus(snapshot.layerPct, targetLayerPct);
  }, [snapshot, targetLayerPct, cashIRR]);

  // Check for pending loan payments
  const nextLoanPayment = useMemo(() => {
    if (loans.length === 0) return null;

    for (const loan of loans) {
      if (loan.status !== 'ACTIVE') continue;
      const nextInstallment = loan.installments?.find((i) => i.status === 'PENDING');
      if (nextInstallment) {
        const daysUntil = Math.ceil(
          (new Date(nextInstallment.dueISO).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        );
        return { loan, installment: nextInstallment, daysUntil };
      }
    }
    return null;
  }, [loans]);

  // ==========================================================================
  // HANDLERS
  // ==========================================================================

  const handleViewPortfolio = useCallback(() => {
    navigation.navigate('Portfolio');
  }, [navigation]);

  const handleViewActivity = useCallback(() => {
    navigation.navigate('Activity');
  }, [navigation]);

  const handleNotificationPress = useCallback(() => {
    Alert.alert(
      'Notifications',
      nextLoanPayment && nextLoanPayment.daysUntil <= 7
        ? `You have a loan payment due in ${nextLoanPayment.daysUntil} days`
        : 'No new notifications',
      [{ text: 'OK' }]
    );
  }, [nextLoanPayment]);

  const handleProfilePress = useCallback(() => {
    navigation.navigate('Profile');
  }, [navigation]);

  const handleDeepLinkServices = useCallback((initialTab?: 'loans' | 'protection', loanId?: string) => {
    navigation.navigate('Services', { initialTab, loanId });
  }, [navigation]);

  // Comprehensive refresh
  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      // In demo mode, skip API calls - just refresh activities (which uses Redux)
      if (isDemoMode) {
        await refreshActivities();
        setIsRefreshing(false);
        return;
      }

      const [portfolioResponse] = await Promise.all([
        portfolioApi.get(),
        refreshActivities(),
        dispatch(fetchPrices()),
        dispatch(fetchFxRate()),
      ]);

      dispatch(updateCash(portfolioResponse.cashIrr));
      dispatch(setStatus(portfolioResponse.status));
      dispatch(setTargetLayerPct(portfolioResponse.targetAllocation));
      if (portfolioResponse.holdings) {
        dispatch(setHoldings(portfolioResponse.holdings.map((h: any) => ({
          id: h.id,
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
  }, [dispatch, refreshActivities, isDemoMode]);

  // Fetch portfolio from backend on mount (not in demo mode)
  useEffect(() => {
    if (isDemoMode) return;

    const fetchData = async () => {
      try {
        const [portfolioResponse] = await Promise.all([
          portfolioApi.get(),
          dispatch(fetchPrices()),
          dispatch(fetchFxRate()),
        ]);

        dispatch(updateCash(portfolioResponse.cashIrr));
        dispatch(setStatus(portfolioResponse.status));
        dispatch(setTargetLayerPct(portfolioResponse.targetAllocation));
        if (portfolioResponse.holdings) {
          dispatch(setHoldings(portfolioResponse.holdings.map((h: any) => ({
            id: h.id,
            assetId: h.assetId,
            quantity: h.quantity,
            frozen: h.frozen,
            layer: h.layer,
          }))));
        }
      } catch (error) {
        console.error('Failed to fetch portfolio on mount:', error);
      }
    };
    fetchData();
  }, [dispatch, isDemoMode]);

  // ==========================================================================
  // RENDER
  // ==========================================================================

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
        {/* ================================================================ */}
        {/* HEADER: Status Badge + Notification + Avatar */}
        {/* ================================================================ */}
        <View style={styles.header}>
          <StatusBadge status={portfolioStatusResult.status} />
          <View style={styles.headerRight}>
            <TouchableOpacity
              style={styles.notificationButton}
              onPress={handleNotificationPress}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.notificationIcon}>🔔</Text>
              {nextLoanPayment && nextLoanPayment.daysUntil <= 7 && (
                <View style={styles.notificationBadge} />
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.avatarContainer}
              onPress={handleProfilePress}
            >
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {phone ? phone.slice(-2) : 'U'}
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* ================================================================ */}
        {/* PORTFOLIO VALUE: One Big Number + Asset/Cash Breakdown */}
        {/* ================================================================ */}
        <View style={styles.valueSection}>
          {/* Total Holdings - ONE number */}
          <Text style={styles.totalValueAmount}>
            {formatIRR(snapshot.totalIRR)} <Text style={styles.totalValueCurrency}>IRR</Text>
          </Text>
          <Text style={styles.totalValueLabel}>Total Holdings</Text>

          {/* Asset Value vs Cash breakdown */}
          <View style={styles.valueBreakdown}>
            <View style={styles.valueBreakdownItem}>
              <Text style={styles.breakdownValue}>{formatIRR(snapshot.holdingsIRR)}</Text>
              <Text style={styles.breakdownLabel}>Asset Value</Text>
            </View>
            <View style={styles.valueBreakdownDivider} />
            <View style={styles.valueBreakdownItem}>
              <Text style={styles.breakdownValue}>{formatIRR(cashIRR)}</Text>
              <Text style={styles.breakdownLabel}>Cash</Text>
            </View>
          </View>

          {/* View Portfolio Link */}
          <TouchableOpacity
            style={styles.viewPortfolioLink}
            onPress={handleViewPortfolio}
          >
            <Text style={styles.viewPortfolioText}>View Portfolio →</Text>
          </TouchableOpacity>

          {/* Price Feed Status */}
          <PriceFeedStatus lastUpdate={priceLastUpdate} />
        </View>

        {/* ================================================================ */}
        {/* ACTIVITY LOG: Last 3-5 entries */}
        {/* ================================================================ */}
        <View style={styles.activitySection}>
          <View style={styles.activityHeader}>
            <Text style={styles.sectionTitle}>Activity Log</Text>
            {activities.length > 0 && (
              <TouchableOpacity onPress={handleViewActivity}>
                <Text style={styles.viewAllLink}>View all →</Text>
              </TouchableOpacity>
            )}
          </View>

          {isLoadingActivities ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={COLORS.brand.primary} />
            </View>
          ) : activities.length === 0 ? (
            <View style={styles.emptyActivity}>
              <Text style={styles.emptyActivityText}>No activity yet</Text>
            </View>
          ) : (
            <View style={styles.chatContainer}>
              {activities.slice(0, 5).map((entry: ActionLogEntry) => (
                <View key={entry.id} style={styles.chatBubble}>
                  <View style={styles.chatBubbleContent}>
                    <View style={[
                      styles.activityDot,
                      { backgroundColor: entry.boundary === 'SAFE' ? '#4ade80' :
                        entry.boundary === 'DRIFT' ? '#fde047' : '#f87171' }
                    ]} />
                    <View style={styles.chatTextContainer}>
                      <Text style={styles.chatMessage}>
                        {formatActivityMessage(entry)}
                      </Text>
                      <Text style={styles.chatTime}>
                        {formatRelativeTime(entry.timestamp)}
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Loan Payment Due Alert */}
          {nextLoanPayment && nextLoanPayment.daysUntil <= 7 && (
            <ActivityCard
              id="loan-payment-alert"
              type="LOAN_PAYMENT"
              title={`Loan payment due in ${nextLoanPayment.daysUntil} days`}
              subtitle={`${nextLoanPayment.installment.totalIRR?.toLocaleString()} IRR`}
              timestamp=""
              primaryAction={{
                label: 'Pay Now',
                onPress: () => handleDeepLinkServices('loans', nextLoanPayment.loan.id),
              }}
            />
          )}
        </View>
      </ScrollView>

      {/* ================================================================ */}
      {/* FIXED MAIN ACTIONS AT BOTTOM */}
      {/* ================================================================ */}
      <View style={styles.fixedActionsContainer}>
        {/* Row 1: Rebalance, Add Funds, Buy/Sell */}
        <View style={styles.actionsRow}>
          <MainActionButton
            label="Rebalance"
            onPress={() => setRebalanceSheetVisible(true)}
            disabled={portfolioStatusResult.status === 'BALANCED'}
          />
          <MainActionButton
            label="Add Funds"
            onPress={() => setAddFundsSheetVisible(true)}
          />
          <MainActionButton
            label="Buy/Sell"
            onPress={() => setTradeSheetVisible(true)}
          />
        </View>

        {/* Row 2: Borrow IRR, Insure Assets */}
        <View style={styles.actionsRowWide}>
          <WideActionButton
            label="Borrow IRR"
            onPress={() => setLoanSheetVisible(true)}
            disabled={snapshot.holdingsIRR === 0}
          />
          <WideActionButton
            label="Insure Assets"
            onPress={() => setProtectionSheetVisible(true)}
            disabled={snapshot.holdingsIRR === 0}
          />
        </View>
      </View>

      {/* ================================================================ */}
      {/* BOTTOM SHEETS */}
      {/* ================================================================ */}
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
      <LoanSheet
        visible={loanSheetVisible}
        onClose={() => setLoanSheetVisible(false)}
      />
      <ProtectionSheet
        visible={protectionSheetVisible}
        onClose={() => setProtectionSheetVisible(false)}
      />
    </SafeAreaView>
  );
};

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background.primary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 160, // Account for fixed action buttons at bottom
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING[4],
    paddingVertical: SPACING[3],
  },
  statusBadge: {
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
  statusLabel: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: '600',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING[3],
  },
  notificationButton: {
    position: 'relative',
    padding: SPACING[1],
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
    fontWeight: '700',
    color: COLORS.text.primary,
  },

  // Value Section
  valueSection: {
    alignItems: 'center',
    paddingHorizontal: SPACING[4],
    paddingTop: SPACING[6],
    paddingBottom: SPACING[4],
  },
  totalValueAmount: {
    fontSize: 40,
    fontWeight: '700',
    color: COLORS.text.primary,
    letterSpacing: -1,
  },
  totalValueCurrency: {
    fontSize: TYPOGRAPHY.fontSize.xl,
    fontWeight: '600',
    color: COLORS.text.muted,
  },
  totalValueLabel: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text.secondary,
    marginTop: SPACING[1],
  },
  valueBreakdown: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING[5],
    backgroundColor: COLORS.background.elevated,
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING[4],
    paddingHorizontal: SPACING[5],
  },
  valueBreakdownItem: {
    flex: 1,
    alignItems: 'center',
  },
  valueBreakdownDivider: {
    width: 1,
    height: 40,
    backgroundColor: COLORS.background.surface,
    marginHorizontal: SPACING[4],
  },
  breakdownValue: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: '700',
    color: COLORS.text.primary,
  },
  breakdownLabel: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.muted,
    marginTop: SPACING[1],
  },
  viewPortfolioLink: {
    marginTop: SPACING[4],
    paddingVertical: SPACING[2],
  },
  viewPortfolioText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: '600',
    color: COLORS.brand.primary,
  },
  priceFeedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING[3],
    opacity: 0.7,
  },
  priceFeedDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: SPACING[2],
  },
  priceFeedText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.text.muted,
  },

  // Activity Section
  activitySection: {
    paddingHorizontal: SPACING[4],
    marginTop: SPACING[4],
  },
  activityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING[3],
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: '600',
    color: COLORS.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  viewAllLink: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: '500',
    color: COLORS.brand.primary,
  },
  loadingContainer: {
    padding: SPACING[6],
    alignItems: 'center',
  },
  emptyActivity: {
    backgroundColor: COLORS.background.elevated,
    borderRadius: RADIUS.lg,
    padding: SPACING[4],
    alignItems: 'center',
  },
  emptyActivityText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.muted,
  },
  // Chat UI Styles for Activity Log
  chatContainer: {
    gap: SPACING[3],
    paddingVertical: SPACING[2],
  },
  chatBubble: {
    alignSelf: 'flex-start',
    maxWidth: '90%',
    marginLeft: SPACING[2],
  },
  chatBubbleContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.background.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border.default,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    borderTopLeftRadius: RADIUS.sm,
    paddingVertical: SPACING[3],
    paddingHorizontal: SPACING[4],
  },
  chatTextContainer: {
    flex: 1,
  },
  activityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: SPACING[3],
    marginTop: 4,
  },
  chatMessage: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.primary,
    lineHeight: 20,
  },
  chatTime: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.text.muted,
    marginTop: SPACING[1],
  },

  // Fixed Actions Container
  fixedActionsContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.background.primary,
    paddingHorizontal: SPACING[4],
    paddingTop: SPACING[3],
    paddingBottom: SPACING[6],
    borderTopWidth: 1,
    borderTopColor: COLORS.background.elevated,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: SPACING[2],
  },
  actionsRowWide: {
    flexDirection: 'row',
    gap: SPACING[2],
    marginTop: SPACING[2],
  },
  mainActionButton: {
    flex: 1,
    backgroundColor: COLORS.background.elevated,
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING[4],
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainActionButtonDisabled: {
    opacity: 0.5,
  },
  mainActionLabel: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: '600',
    color: COLORS.text.primary,
  },
  mainActionLabelDisabled: {
    color: COLORS.text.muted,
  },
  wideActionButton: {
    flex: 1,
    backgroundColor: COLORS.background.elevated,
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING[4],
    alignItems: 'center',
    justifyContent: 'center',
  },
  wideActionButtonDisabled: {
    opacity: 0.5,
  },
  wideActionLabel: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: '600',
    color: COLORS.text.primary,
  },
  wideActionLabelDisabled: {
    color: COLORS.text.muted,
  },
});

export default HomeScreen;
