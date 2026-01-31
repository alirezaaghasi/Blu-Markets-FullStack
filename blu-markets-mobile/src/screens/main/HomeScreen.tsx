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
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  ListRenderItemInfo,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { COLORS } from '../../constants/colors';
import { TYPOGRAPHY } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';
import { useAppSelector } from '../../hooks/useStore';
import { useActivityFeed } from '../../hooks/useActivityFeed';
import { usePriceConnection } from '../../hooks/usePriceConnection';
import { usePortfolioSync } from '../../hooks/usePortfolioSync';
import { devLog, devError, devWarn } from '../../utils/devLogger';
import type { Holding, ActionLogEntry } from '../../types';
import { ASSETS } from '../../constants/assets';
import { DEMO_TOKEN } from '../../constants/business';
import { ActivityCard } from '../../components/ActivityCard';
import { TradeBottomSheet } from '../../components/TradeBottomSheet';
import { AddFundsSheet } from '../../components/AddFundsSheet';
import RebalanceSheet from '../../components/RebalanceSheet';
import { LoanSheet } from '../../components/LoanSheet';
import { ProtectionSheet } from '../../components/ProtectionSheet';
import { EmptyState } from '../../components/EmptyState';
import { formatRelativeTime } from '../../utils/dateUtils';
import { formatIRR } from '../../utils/currency';
import { PORTFOLIO_STATUS_MESSAGES, type PortfolioStatus } from '../../constants/messages';

// =============================================================================
// TYPES
// =============================================================================

interface PortfolioStatusResult {
  status: PortfolioStatus;
  issues: string[];
}

/**
 * Display activity message from backend.
 * UI is purely representational - all messages come from the backend.
 * Frontend does NOT generate, calculate, or decide what to show.
 */
function formatActivityMessage(entry: ActionLogEntry): string {
  // Safety check for null/undefined entry
  if (!entry) return 'Activity';

  // Backend is the single source of truth for activity messages
  // Frontend only provides fallback for edge cases (should never happen in production)
  if (entry.message && entry.message.length > 0) {
    return entry.message;
  }

  // Fallback only for legacy/missing data - log warning in dev
  devWarn('[Activity] Missing message from backend for entry:', entry.type, entry.id);
  return 'Activity recorded';
}

// =============================================================================
// COMPONENTS
// =============================================================================

/**
 * Portfolio Health Status
 * PCD-Compliant: Describes portfolio STATE, not actions.
 * Uses canonical messages from constants/messages.ts
 */
const PORTFOLIO_STATUS_CONFIG = PORTFOLIO_STATUS_MESSAGES;

/**
 * Main Action Button (Row 1 - 3 equal width)
 * Shows alert with disabledReason when tapped while disabled
 */
const MainActionButton: React.FC<{
  label: string;
  onPress: () => void;
  disabled?: boolean;
  disabledReason?: string;
}> = ({ label, onPress, disabled, disabledReason }) => {
  const handlePress = () => {
    if (disabled && disabledReason) {
      Alert.alert('', disabledReason);
    } else if (!disabled) {
      onPress();
    }
  };

  return (
    <View style={styles.mainActionWrapper}>
      <TouchableOpacity
        style={[styles.mainActionButton, disabled && styles.mainActionButtonDisabled]}
        onPress={handlePress}
        activeOpacity={0.7}
      >
        <Text style={[styles.mainActionLabel, disabled && styles.mainActionLabelDisabled]}>{label}</Text>
      </TouchableOpacity>
    </View>
  );
};

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

  // Price connection status (for update time display)
  const { lastUpdate: priceLastUpdate } = usePriceConnection();

  // Safe area insets for notched devices
  const insets = useSafeAreaInsets();
  const FOOTER_BASE_HEIGHT = 110; // Minimal footer height for maximum activity log space

  // Activity feed from API
  const {
    activities,
    isLoading: isLoadingActivities,
    isRefreshing: isRefreshingActivities,
    refresh: refreshActivities,
  } = useActivityFeed(20);

  // Bottom sheet visibility state
  const [tradeSheetVisible, setTradeSheetVisible] = useState(false);
  const [addFundsSheetVisible, setAddFundsSheetVisible] = useState(false);
  const [rebalanceSheetVisible, setRebalanceSheetVisible] = useState(false);
  const [loanSheetVisible, setLoanSheetVisible] = useState(false);
  const [protectionSheetVisible, setProtectionSheetVisible] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Redux state - using granular selectors to prevent unnecessary re-renders
  const holdings = useAppSelector((state) => state.portfolio.holdings) || [];
  const cashIRR = useAppSelector((state) => state.portfolio.cashIRR) || 0;
  const targetLayerPct = useAppSelector((state) => state.portfolio.targetLayerPct) || { FOUNDATION: 0.50, GROWTH: 0.35, UPSIDE: 0.15 };
  const loans = useAppSelector((state) => state.portfolio.loans) || [];
  // Backend-calculated values (frontend is presentation layer only)
  const holdingsValueIrr = useAppSelector((state) => state.portfolio.holdingsValueIrr) || 0;
  const portfolioStatus = useAppSelector((state) => state.portfolio.status) || 'BALANCED';
  // Total Holdings = Cash + Asset Value (ensure correct sum even if backend value is stale)
  const totalValueIrr = cashIRR + holdingsValueIrr;
  devLog('[HomeScreen] Current portfolioStatus from Redux:', portfolioStatus);
  const authToken = useAppSelector((state) => state.auth.authToken);

  // Check if we're in demo mode (runtime check)
  const isDemoMode = authToken === DEMO_TOKEN;

  // Use centralized portfolio sync from MainTabNavigator
  // This hook handles RTK Query fetching and Redux sync - no duplicate calls needed
  const { refetchPortfolio, isLoading: isLoadingPortfolio } = usePortfolioSync({
    skip: isDemoMode, // Skip API call in demo mode
  });

  // ==========================================================================
  // COMPUTED VALUES (using backend-calculated values from Redux)
  // ==========================================================================

  // Portfolio status result for UI (using backend status directly)
  const portfolioStatusResult = useMemo(() => {
    // Use backend status directly - no client-side calculation
    return { status: portfolioStatus as PortfolioStatus, issues: [] };
  }, [portfolioStatus]);

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

  // Note: No dedicated activity history screen exists
  // Full activity log is available in the Activity section on Home screen

  const handleDeepLinkServices = useCallback((initialTab?: 'loans' | 'protection', loanId?: string) => {
    navigation.navigate('Market', { initialTab, loanId });
  }, [navigation]);

  // Comprehensive refresh using RTK Query refetch
  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      // In demo mode, skip API calls - just refresh activities (which uses Redux)
      if (isDemoMode) {
        await refreshActivities();
        setIsRefreshing(false);
        return;
      }

      // Use RTK Query refetch - data sync handled by useEffect above
      await Promise.all([
        refetchPortfolio(),
        refreshActivities(),
      ]);
    } catch (error) {
      devError('[HomeScreen] Failed to refresh:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, [refetchPortfolio, refreshActivities, isDemoMode]);

  // Portfolio data is now fetched automatically by RTK Query's useGetPortfolioQuery
  // and synced to Redux via the useEffect above. No manual fetch needed.

  // ==========================================================================
  // RENDER
  // ==========================================================================

  return (
    <SafeAreaView style={styles.container}>
      {/* ================================================================ */}
      {/* PORTFOLIO VALUE + STATUS */}
      {/* ================================================================ */}
      <View style={styles.valueSection}>
        {/* Total Holdings label + big number */}
        <Text style={styles.totalValueLabel}>Total Holdings</Text>
        <Text style={styles.totalValueAmount}>
          {formatIRR(totalValueIrr, { showUnit: false })} <Text style={styles.totalValueCurrency}>IRR</Text>
        </Text>

        {/* Portfolio Status - Subtle sentence with colored dot only */}
        {(() => {
          const { message, dotColor } = PORTFOLIO_STATUS_CONFIG[portfolioStatusResult.status];
          const isTappable = portfolioStatusResult.status !== 'BALANCED';

          const statusContent = (
            <View style={styles.statusContainer}>
              <View style={[styles.statusDot, { backgroundColor: dotColor }]} />
              <Text style={[styles.statusText, { color: dotColor }]}>{message}</Text>
            </View>
          );

          return isTappable ? (
            <TouchableOpacity onPress={() => setRebalanceSheetVisible(true)} activeOpacity={0.7}>
              {statusContent}
            </TouchableOpacity>
          ) : statusContent;
        })()}

        {/* Compact row: Assets Value | Cash | View Portfolio */}
        <View style={styles.compactRow}>
          <View style={styles.compactItem}>
            <Text style={styles.compactValue}>{formatIRR(holdingsValueIrr, { showUnit: false })} <Text style={styles.compactUnit}>IRR</Text></Text>
            <Text style={styles.compactLabel}>Assets Value</Text>
          </View>
          <View style={styles.compactDivider} />
          <View style={styles.compactItem}>
            <Text style={styles.compactValue}>{formatIRR(cashIRR, { showUnit: false })} <Text style={styles.compactUnit}>IRR</Text></Text>
            <Text style={styles.compactLabel}>Cash</Text>
          </View>
          <View style={styles.compactDivider} />
          <TouchableOpacity
            style={styles.compactItem}
            onPress={handleViewPortfolio}
          >
            <Text style={styles.viewPortfolioCompact}>View Portfolio →</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ================================================================ */}
      {/* ACTIVITY LOG HEADER (FIXED) */}
      {/* ================================================================ */}
      <View style={styles.activityHeaderFixed}>
        <Text style={styles.sectionTitle}>Recent Changes</Text>
        <Text style={styles.updateTime}>
          {priceLastUpdate
            ? `Prices as of ${priceLastUpdate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`
            : 'Loading prices...'}
        </Text>
      </View>

      {/* ================================================================ */}
      {/* ACTIVITY LOG - Using FlatList for virtualization */}
      {/* ================================================================ */}
      <FlatList
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: FOOTER_BASE_HEIGHT + insets.bottom + SPACING[4] }]}
        showsVerticalScrollIndicator={false}
        data={isLoadingActivities ? [] : activities.slice(0, 50)}
        keyExtractor={(item, index) => String(item?.id ?? `activity-${index}`)}
        renderItem={({ item: entry }: ListRenderItemInfo<ActionLogEntry>) => {
          const message = formatActivityMessage(entry) || 'Activity recorded';
          const time = formatRelativeTime(entry?.timestamp) || 'Just now';

          return (
            <View style={styles.activityItem}>
              <Text style={styles.activityTime}>{time}</Text>
              <Text style={styles.activityMessage} numberOfLines={2}>{message}</Text>
            </View>
          );
        }}
        ListEmptyComponent={
          isLoadingActivities ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={COLORS.brand.primary} />
            </View>
          ) : (
            <View style={styles.emptyActivity}>
              <Text style={styles.emptyActivityText}>No activity yet</Text>
            </View>
          )
        }
        ListFooterComponent={
          nextLoanPayment && nextLoanPayment.daysUntil <= 7 ? (
            <ActivityCard
              id="loan-payment-alert"
              type="LOAN_PAYMENT"
              title={`Loan payment due in ${nextLoanPayment.daysUntil} days`}
              subtitle={formatIRR(nextLoanPayment.installment.totalIRR ?? 0)}
              timestamp=""
              primaryAction={{
                label: 'Pay Now',
                onPress: () => handleDeepLinkServices('loans', nextLoanPayment.loan.id),
              }}
            />
          ) : null
        }
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing || isRefreshingActivities}
            onRefresh={onRefresh}
            tintColor={COLORS.brand.primary}
          />
        }
        // Performance optimizations
        windowSize={5}
        maxToRenderPerBatch={10}
        removeClippedSubviews={true}
        initialNumToRender={10}
        getItemLayout={(_, index) => ({
          length: 52, // Approximate item height (padding + text)
          offset: 52 * index,
          index,
        })}
      />

      {/* ================================================================ */}
      {/* FIXED MAIN ACTIONS AT BOTTOM */}
      {/* ================================================================ */}
      <View style={[styles.fixedActionsContainer, { paddingBottom: SPACING[2] }]}>
        {/* Row 1: Rebalance, Add Funds, Trade */}
        <View style={styles.actionsRow}>
          <MainActionButton
            label="Rebalance"
            onPress={() => setRebalanceSheetVisible(true)}
            disabled={portfolioStatusResult.status === 'BALANCED'}
            disabledReason={portfolioStatusResult.status === 'BALANCED' ? 'Already balanced' : undefined}
          />
          <MainActionButton
            label="Add Funds"
            onPress={() => setAddFundsSheetVisible(true)}
          />
          <MainActionButton
            label="Trade"
            onPress={() => setTradeSheetVisible(true)}
          />
        </View>

        {/* Row 2: Borrow, Insure Assets */}
        {/* UX-001: "Protect" → "Insure Assets" per UX spec */}
        {/* ⚠️ LEGAL REVIEW NEEDED: "Insure" may have regulatory implications */}
        <View style={styles.actionsRowWide}>
          <WideActionButton
            label="Borrow"
            onPress={() => setLoanSheetVisible(true)}
            disabled={holdingsValueIrr === 0}
          />
          <WideActionButton
            label="Insure Assets"
            onPress={() => setProtectionSheetVisible(true)}
            disabled={holdingsValueIrr === 0}
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
    // paddingBottom is applied dynamically with safe area insets
  },

  // Portfolio Status - Subtle metadata sentence with colored dot only
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING[2],
    marginBottom: SPACING[3],
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '500',
    // Color applied dynamically to match dot
  },

  // Value Section - Compact Layout
  valueSection: {
    alignItems: 'center',
    paddingHorizontal: SPACING[4],
    paddingTop: SPACING[4],
    paddingBottom: SPACING[2],
  },
  totalValueLabel: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: '500',
    color: COLORS.text.muted,
    marginBottom: SPACING[1],
  },
  totalValueAmount: {
    fontSize: 44,
    fontWeight: '700',
    color: COLORS.text.primary,
    letterSpacing: -1,
  },
  totalValueCurrency: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: '600',
    color: COLORS.text.muted,
  },
  // Compact row: Assets | Cash | View Portfolio
  compactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING[3],
    paddingVertical: SPACING[2],
  },
  compactItem: {
    alignItems: 'center',
    paddingHorizontal: SPACING[3],
  },
  compactDivider: {
    width: 1,
    height: 28,
    backgroundColor: COLORS.background.elevated,
  },
  compactValue: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: '600',
    color: COLORS.text.primary,
  },
  compactUnit: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: '500',
    color: COLORS.text.muted,
  },
  compactLabel: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.text.muted,
    marginTop: 2,
  },
  viewPortfolioCompact: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: '600',
    color: COLORS.brand.primary,
  },

  // Activity Section
  activitySection: {
    paddingHorizontal: SPACING[4],
    marginTop: SPACING[2],
  },
  activityHeaderFixed: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING[4],
    paddingVertical: SPACING[2],
    backgroundColor: COLORS.background.primary,
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: '600',
    color: COLORS.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  updateTime: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.text.muted,
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
  // Activity item styles (for FlatList)
  activityItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.background.surface,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 6,
    marginHorizontal: SPACING[4],
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  activityTime: {
    color: COLORS.text.muted,
    fontSize: 12,
    marginRight: 12,
    minWidth: 55,
    marginTop: 2,
  },
  activityMessage: {
    color: COLORS.text.primary,
    fontSize: 14,
    flex: 1,
    lineHeight: 20,
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
    borderColor: COLORS.border,
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
    paddingTop: SPACING[2],
    // paddingBottom is applied dynamically with safe area insets
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
  mainActionWrapper: {
    flex: 1,
    alignItems: 'center',
  },
  mainActionButton: {
    width: '100%',
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
