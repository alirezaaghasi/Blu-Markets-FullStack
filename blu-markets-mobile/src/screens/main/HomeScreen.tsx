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
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { COLORS } from '../../constants/colors';
import { TYPOGRAPHY } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';
import { useAppSelector, useAppDispatch } from '../../hooks/useStore';
import { useActivityFeed } from '../../hooks/useActivityFeed';
import { usePriceConnection } from '../../hooks/usePriceConnection';
import { setHoldings, updateCash, setStatus, setTargetLayerPct, setPortfolioValues } from '../../store/slices/portfolioSlice';
// Note: Price fetching removed - backend calculates all values
import { portfolio as portfolioApi } from '../../services/api';
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

// =============================================================================
// TYPES
// =============================================================================

type PortfolioStatus = 'BALANCED' | 'SLIGHTLY_OFF' | 'ATTENTION_REQUIRED';

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
  if (__DEV__) {
    console.warn('[Activity] Missing message from backend for entry:', entry.type, entry.id);
  }
  return 'Activity recorded';
}

// =============================================================================
// COMPONENTS
// =============================================================================

/**
 * Portfolio Health Status Badge
 * BUG-F FIX: Made tappable to open rebalance sheet when attention is required
 */
const StatusBadge: React.FC<{ status: PortfolioStatus; onPress?: () => void }> = ({ status, onPress }) => {
  const config = {
    BALANCED: { label: 'Balanced', color: '#4ade80', dotColor: '#22c55e' },
    SLIGHTLY_OFF: { label: 'Slightly Off', color: '#fde047', dotColor: '#eab308' },
    ATTENTION_REQUIRED: { label: 'Attention Required', color: '#f87171', dotColor: '#ef4444' },
  };

  const { label, color, dotColor } = config[status];
  const isTappable = status !== 'BALANCED' && onPress;

  const content = (
    <View style={[styles.statusBadge, { backgroundColor: `${color}20`, borderColor: `${color}40` }]}>
      <View style={[styles.statusDot, { backgroundColor: dotColor }]} />
      <Text style={[styles.statusLabel, { color: dotColor }]}>{label}</Text>
    </View>
  );

  // BUG-F FIX: Make badge tappable when not balanced
  if (isTappable) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
};

/**
 * Main Action Button (Row 1 - 3 equal width)
 * P1: Added disabledReason prop for tooltip when button is disabled
 */
const MainActionButton: React.FC<{
  label: string;
  onPress: () => void;
  disabled?: boolean;
  disabledReason?: string;
}> = ({ label, onPress, disabled, disabledReason }) => (
  <View style={styles.mainActionWrapper}>
    <TouchableOpacity
      style={[styles.mainActionButton, disabled && styles.mainActionButtonDisabled]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
    >
      <Text style={[styles.mainActionLabel, disabled && styles.mainActionLabelDisabled]}>{label}</Text>
    </TouchableOpacity>
    {disabled && disabledReason && (
      <Text style={styles.disabledHint}>{disabledReason}</Text>
    )}
  </View>
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

  // Price connection status (for update time display)
  const { lastUpdate: priceLastUpdate } = usePriceConnection();

  // Safe area insets for notched devices
  const insets = useSafeAreaInsets();
  const FOOTER_BASE_HEIGHT = 140; // Base footer height without safe area

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

  // Redux state
  const portfolioState = useAppSelector((state) => state.portfolio);
  const holdings = portfolioState?.holdings || [];
  const cashIRR = portfolioState?.cashIRR || 0;
  const targetLayerPct = portfolioState?.targetLayerPct || { FOUNDATION: 0.50, GROWTH: 0.35, UPSIDE: 0.15 };
  const loans = portfolioState?.loans || [];
  // Backend-calculated values (frontend is presentation layer only)
  const holdingsValueIrr = portfolioState?.holdingsValueIrr || 0;
  // Total Holdings = Cash + Asset Value (ensure correct sum even if backend value is stale)
  const totalValueIrr = cashIRR + holdingsValueIrr;
  const currentAllocation = portfolioState?.currentAllocation || { FOUNDATION: 0, GROWTH: 0, UPSIDE: 0 };
  const portfolioStatus = portfolioState?.status || 'BALANCED';
  console.log('[HomeScreen] Current portfolioStatus from Redux:', portfolioStatus);
  const { phone, authToken } = useAppSelector((state) => state.auth);

  // Check if we're in demo mode (runtime check)
  const isDemoMode = authToken === DEMO_TOKEN;

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
    navigation.navigate('Market', { initialTab, loanId });
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
      ]);

      // DEBUG: Log portfolio response on refresh
      console.log('[HomeScreen] Refresh - Portfolio status:', portfolioResponse.status);

      // Update cash and target allocation
      dispatch(updateCash(portfolioResponse.cashIrr));
      dispatch(setTargetLayerPct(portfolioResponse.targetAllocation));

      // Update backend-calculated values (frontend is presentation layer only)
      dispatch(setPortfolioValues({
        totalValueIrr: portfolioResponse.totalValueIrr || 0,
        holdingsValueIrr: portfolioResponse.holdingsValueIrr || (portfolioResponse.totalValueIrr - portfolioResponse.cashIrr) || 0,
        currentAllocation: portfolioResponse.allocation || { FOUNDATION: 0, GROWTH: 0, UPSIDE: 0 },
        driftPct: portfolioResponse.driftPct || 0,
        status: portfolioResponse.status || 'BALANCED',
      }));

      if (portfolioResponse.holdings) {
        dispatch(setHoldings(portfolioResponse.holdings.map((h) => ({
          id: h.id,
          assetId: h.assetId,
          quantity: h.quantity,
          frozen: h.frozen,
          layer: h.layer,
        }))));
      }
    } catch (error) {
      if (__DEV__) console.error('Failed to refresh home screen data:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, [dispatch, refreshActivities, isDemoMode]);

  // Fetch portfolio from backend on mount (not in demo mode)
  useEffect(() => {
    if (isDemoMode) return;

    const fetchData = async () => {
      try {
        const portfolioResponse = await portfolioApi.get();

        // DEBUG: Log portfolio response to verify status
        console.log('[HomeScreen] Portfolio API response:', {
          status: portfolioResponse.status,
          driftPct: portfolioResponse.driftPct,
          allocation: portfolioResponse.allocation,
        });

        // Update cash and target allocation
        dispatch(updateCash(portfolioResponse.cashIrr));
        dispatch(setTargetLayerPct(portfolioResponse.targetAllocation));

        // Update backend-calculated values (frontend is presentation layer only)
        dispatch(setPortfolioValues({
          totalValueIrr: portfolioResponse.totalValueIrr || 0,
          holdingsValueIrr: portfolioResponse.holdingsValueIrr || (portfolioResponse.totalValueIrr - portfolioResponse.cashIrr) || 0,
          currentAllocation: portfolioResponse.allocation || { FOUNDATION: 0, GROWTH: 0, UPSIDE: 0 },
          driftPct: portfolioResponse.driftPct || 0,
          status: portfolioResponse.status || 'BALANCED',
        }));

        if (portfolioResponse.holdings) {
          dispatch(setHoldings(portfolioResponse.holdings.map((h) => ({
            id: h.id,
            assetId: h.assetId,
            quantity: h.quantity,
            frozen: h.frozen,
            layer: h.layer,
          }))));
        }
      } catch (error) {
        if (__DEV__) console.error('Failed to fetch portfolio on mount:', error);
      }
    };
    fetchData();
  }, [dispatch, isDemoMode]);

  // ==========================================================================
  // RENDER
  // ==========================================================================

  return (
    <SafeAreaView style={styles.container}>
      {/* ================================================================ */}
      {/* FIXED HEADER: Status Badge + Notification + Avatar */}
      {/* ================================================================ */}
      <View style={styles.header}>
        {/* BUG-F FIX: Tapping status badge opens rebalance sheet when attention is required */}
        <StatusBadge
          status={portfolioStatusResult.status}
          onPress={() => setRebalanceSheetVisible(true)}
        />
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
      {/* COMPACT PORTFOLIO VALUE: Total + Assets/Cash/ViewPortfolio row */}
      {/* ================================================================ */}
      <View style={styles.valueSection}>
        {/* Total Holdings - ONE big number (backend-calculated) */}
        <Text style={styles.totalValueAmount}>
          {formatIRR(totalValueIrr, { showUnit: false })} <Text style={styles.totalValueCurrency}>IRR</Text>
        </Text>

        {/* Compact row: Assets | Cash | View Portfolio */}
        <View style={styles.compactRow}>
          <View style={styles.compactItem}>
            <Text style={styles.compactValue}>{formatIRR(holdingsValueIrr, { showUnit: false })}</Text>
            <Text style={styles.compactLabel}>Assets</Text>
          </View>
          <View style={styles.compactDivider} />
          <View style={styles.compactItem}>
            <Text style={styles.compactValue}>{formatIRR(cashIRR, { showUnit: false })}</Text>
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
      {/* SCROLLABLE ACTIVITY LOG: Last 3-5 entries */}
      {/* ================================================================ */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: FOOTER_BASE_HEIGHT + insets.bottom + SPACING[4] }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing || isRefreshingActivities}
            onRefresh={onRefresh}
            tintColor={COLORS.brand.primary}
          />
        }
      >
        <View style={styles.activitySection}>
          <View style={styles.activityHeader}>
            <Text style={styles.sectionTitle}>Activity Log</Text>
            {/* Update time moved from value section */}
            <Text style={styles.updateTime}>
              {priceLastUpdate
                ? `Updated ${priceLastUpdate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`
                : 'Connecting...'}
            </Text>
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
            /* BUG-1 FIX: Simplified activity log with guaranteed visible text */
            <View>
              {activities.slice(0, 20).map((entry: ActionLogEntry, index: number) => {
                const message = formatActivityMessage(entry) || 'Activity recorded';
                const time = formatRelativeTime(entry?.timestamp) || 'Just now';
                const boundary = entry?.boundary || 'SAFE';
                const dotColor = boundary === 'SAFE' ? '#4ade80' :
                  boundary === 'DRIFT' ? '#fde047' :
                  boundary === 'STRUCTURAL' ? '#fb923c' : '#f87171';

                return (
                  <View
                    key={entry?.id || `activity-${index}`}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'flex-start',
                      backgroundColor: COLORS.background.surface,
                      borderRadius: 10,
                      paddingVertical: 10,
                      paddingHorizontal: 12,
                      marginBottom: 6,
                      borderWidth: 1,
                      borderColor: COLORS.border,
                    }}
                  >
                    {/* Dot */}
                    <View style={{
                      width: 10,
                      height: 10,
                      borderRadius: 5,
                      backgroundColor: dotColor,
                      marginRight: 12,
                      marginTop: 4,
                    }} />
                    {/* Time */}
                    <Text style={{
                      color: COLORS.text.muted,
                      fontSize: 12,
                      marginRight: 12,
                      minWidth: 55,
                      marginTop: 2,
                    }}>
                      {time}
                    </Text>
                    {/* Message - allow 2 lines for long messages */}
                    <Text
                      style={{
                        color: COLORS.text.primary,
                        fontSize: 14,
                        flex: 1,
                        lineHeight: 20,
                      }}
                      numberOfLines={2}
                    >
                      {message}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}

          {/* Loan Payment Due Alert */}
          {nextLoanPayment && nextLoanPayment.daysUntil <= 7 && (
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
          )}
        </View>
      </ScrollView>

      {/* ================================================================ */}
      {/* FIXED MAIN ACTIONS AT BOTTOM */}
      {/* ================================================================ */}
      <View style={[styles.fixedActionsContainer, { paddingBottom: SPACING[6] + insets.bottom }]}>
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
    fontWeight: '500',  // P2: Reduced from 600 for less visual weight
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

  // Value Section - Compact Layout
  valueSection: {
    alignItems: 'center',
    paddingHorizontal: SPACING[4],
    paddingTop: SPACING[4],
    paddingBottom: SPACING[2],
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
  activityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING[2],
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
    paddingTop: SPACING[3],
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
  disabledHint: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.text.muted,
    marginTop: SPACING[1],
    textAlign: 'center',
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
