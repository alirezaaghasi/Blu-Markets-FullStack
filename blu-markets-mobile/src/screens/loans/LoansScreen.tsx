// Loans Screen
// Based on PRD Section 9.4 - Loans Tab
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { colors, typography, spacing, borderRadius } from '../../constants/theme';
import { useAppSelector, useAppDispatch } from '../../hooks/useStore';
import { setHoldings, updateCash, setStatus } from '../../store/slices/portfolioSlice';
import { fetchPrices, fetchFxRate } from '../../store/slices/pricesSlice';
import { portfolio as portfolioApi } from '../../services/api';
import { Loan, Holding } from '../../types';
import { ASSETS, LAYER_COLORS } from '../../constants/assets';
import {
  LOAN_HEALTH_THRESHOLDS,
} from '../../constants/business';
import { useLoans } from '../../hooks/useLoans';
import LoanSheet from '../../components/LoanSheet';
import RepaySheet from '../../components/RepaySheet';
import { EmptyState } from '../../components/EmptyState';

const LoansScreen: React.FC = () => {
  const dispatch = useAppDispatch();
  const { loans: reduxLoans, holdings } = useAppSelector((state) => state.portfolio);
  const { prices, fxRate } = useAppSelector((state) => state.prices);

  // Use backend-derived loan capacity values
  const { capacity, refresh: refreshLoans } = useLoans();

  const [showLoanSheet, setShowLoanSheet] = useState(false);
  const [showRepaySheet, setShowRepaySheet] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Pull-to-refresh handler - refreshes prices and loan capacity from backend
  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        portfolioApi.get().then((portfolioResponse) => {
          dispatch(updateCash(portfolioResponse.cashIrr));
          dispatch(setStatus(portfolioResponse.status));
          if (portfolioResponse.holdings) {
            dispatch(setHoldings(portfolioResponse.holdings.map((h: Holding) => ({
              assetId: h.assetId,
              quantity: h.quantity,
              frozen: h.frozen,
              layer: h.layer,
            }))));
          }
        }),
        dispatch(fetchPrices()),
        dispatch(fetchFxRate()),
        refreshLoans(), // Refresh loan capacity from backend
      ]);
    } catch (error) {
      if (__DEV__) console.error('Failed to refresh loans data:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, [dispatch, refreshLoans]);

  // Use loans from Redux (kept in sync by useLoans hook)
  const loans = reduxLoans;

  // BUG-011 FIX: Use backend-derived loan capacity values
  // Backend capacity API is AUTHORITATIVE - client fallbacks are for loading state only
  const maxLoanCapacity = capacity?.maxCapacityIrr ?? 0;
  // Prefer backend usedIrr; fallback for loading state only (not for display)
  const usedLoanCapacity = capacity?.usedIrr ?? (capacity === null ? 0 : loans.reduce((sum, l) => sum + l.amountIRR, 0));
  const remainingCapacity = capacity?.availableIrr ?? Math.max(0, maxLoanCapacity - usedLoanCapacity);
  const capacityPercentage = maxLoanCapacity > 0 ? (usedLoanCapacity / maxLoanCapacity) * 100 : 0;

  // Get eligible holdings for collateral (not frozen, has value)
  const eligibleHoldings = holdings.filter((h) => {
    if (h.frozen) return false;
    if (h.assetId === 'IRR_FIXED_INCOME') return false; // IRR fixed income can't be collateral
    const asset = ASSETS[h.assetId];
    return asset.ltv > 0 && h.quantity > 0;
  });

  // BUG-011 FIX: Client-side loan health calculation is for UI display ONLY
  // Backend loans.getAll API should return health status and LTV for each loan
  // This function provides a UI fallback when backend doesn't include health info
  // PRODUCTION: Backend should include { ltv, healthStatus } in loan response
  const getLoanHealth = (loan: Loan): { level: string; color: string } => {
    // BUG-020 FIX: Prefer backend-provided health status if available (properly typed)
    if (loan.healthStatus) {
      const healthColors: Record<string, string> = {
        HEALTHY: colors.success,
        CAUTION: colors.warning,
        WARNING: colors.boundaryStructural,
        CRITICAL: colors.error,
      };
      return { level: loan.healthStatus, color: healthColors[loan.healthStatus] || colors.textSecondary };
    }

    // UI FALLBACK ONLY - calculate health from local prices
    // Backend should provide authoritative LTV and health status
    const holding = holdings.find((h) => h.assetId === loan.collateralAssetId);
    if (!holding) return { level: 'Unknown', color: colors.textSecondary };

    const priceUSD = prices[loan.collateralAssetId] || 0;
    // UI ESTIMATE ONLY - backend should provide authoritative LTV
    const collateralValueIRR = holding.quantity * priceUSD * fxRate;
    const currentLTV = loan.amountIRR / collateralValueIRR;

    if (currentLTV >= LOAN_HEALTH_THRESHOLDS.CRITICAL) {
      return { level: 'Critical', color: colors.error };
    }
    if (currentLTV >= LOAN_HEALTH_THRESHOLDS.WARNING) {
      return { level: 'Warning', color: colors.boundaryStructural };
    }
    if (currentLTV >= LOAN_HEALTH_THRESHOLDS.CAUTION) {
      return { level: 'Caution', color: colors.warning };
    }
    return { level: 'Healthy', color: colors.success };
  };

  // Handle new loan
  const handleNewLoan = () => {
    setShowLoanSheet(true);
  };

  // Handle repay
  const handleRepay = (loan: Loan) => {
    setSelectedLoan(loan);
    setShowRepaySheet(true);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Loans</Text>
        <Text style={styles.subtitle}>
          Borrow against your holdings without selling
        </Text>
      </View>

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
        {/* Capacity Bar */}
        <View style={styles.capacityCard}>
          <Text style={styles.capacityTitle}>Loan Capacity</Text>
          <View style={styles.capacityBar}>
            <View
              style={[
                styles.capacityFill,
                {
                  width: `${Math.min(100, capacityPercentage)}%`,
                  backgroundColor:
                    capacityPercentage >= 90
                      ? colors.error
                      : capacityPercentage >= 75
                      ? colors.warning
                      : colors.primary,
                },
              ]}
            />
          </View>
          <View style={styles.capacityDetails}>
            <View style={styles.capacityItem}>
              <Text style={styles.capacityLabel}>Used</Text>
              <Text style={styles.capacityValue}>
                {usedLoanCapacity.toLocaleString()} IRR
              </Text>
            </View>
            <View style={styles.capacityItem}>
              <Text style={styles.capacityLabel}>Maximum</Text>
              <Text style={styles.capacityValue}>
                {maxLoanCapacity.toLocaleString()} IRR
              </Text>
            </View>
            <View style={styles.capacityItem}>
              <Text style={styles.capacityLabel}>Remaining</Text>
              <Text style={[styles.capacityValue, styles.capacityRemaining]}>
                {remainingCapacity.toLocaleString()} IRR
              </Text>
            </View>
          </View>
        </View>

        {/* Active Loans */}
        {loans.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Active Loans</Text>
            {loans.map((loan) => {
              const asset = ASSETS[loan.collateralAssetId];
              const health = getLoanHealth(loan);
              const paidInstallments = loan.installmentsPaid;
              // Guard against empty installments array to prevent NaN/Infinity
              const totalInstallments = Math.max(1, loan.installments?.length || 0);
              const progressPercentage = totalInstallments > 0
                ? (paidInstallments / totalInstallments) * 100
                : 0;

              return (
                <View key={loan.id} style={styles.loanCard}>
                  {/* Loan Header */}
                  <View style={styles.loanHeader}>
                    <View style={styles.loanAsset}>
                      <View
                        style={[
                          styles.assetIcon,
                          { backgroundColor: `${LAYER_COLORS[asset.layer]}20` },
                        ]}
                      >
                        <Text style={styles.assetIconText}>
                          {asset.symbol}
                        </Text>
                      </View>
                      <View>
                        <View style={styles.assetNameRow}>
                          <Text style={styles.assetName}>
                            {asset.name}
                            <Text style={styles.assetSymbol}> | {asset.symbol}</Text>
                          </Text>
                          <View style={styles.frozenBadge}>
                            <Text style={styles.frozenBadgeText}>FROZEN</Text>
                          </View>
                        </View>
                        <Text style={styles.collateralAmount}>
                          {loan.collateralQuantity.toFixed(4)} {asset.symbol}
                        </Text>
                      </View>
                    </View>
                    <View style={[styles.healthBadge, { backgroundColor: `${health.color}20` }]}>
                      <View style={[styles.healthDot, { backgroundColor: health.color }]} />
                      <Text style={[styles.healthText, { color: health.color }]}>
                        {health.level}
                      </Text>
                    </View>
                  </View>

                  {/* Loan Details */}
                  <View style={styles.loanDetails}>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Principal</Text>
                      <Text style={styles.detailValue}>
                        {(loan.amountIRR ?? 0).toLocaleString()} IRR
                      </Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Interest Rate</Text>
                      <Text style={styles.detailValue}>
                        {((loan.interestRate ?? loan.dailyInterestRate * 365) * 100).toFixed(0)}% annual
                      </Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Due Date</Text>
                      <Text style={styles.detailValue}>
                        {new Date(loan.dueISO).toLocaleDateString()}
                      </Text>
                    </View>
                  </View>

                  {/* Installment Progress */}
                  <View style={styles.progressSection}>
                    <View style={styles.progressHeader}>
                      <Text style={styles.progressLabel}>Installment Progress</Text>
                      <Text style={styles.progressCount}>
                        {paidInstallments}/{totalInstallments}
                      </Text>
                    </View>
                    <View style={styles.progressBar}>
                      <View
                        style={[styles.progressFill, { width: `${progressPercentage}%` }]}
                      />
                    </View>
                  </View>

                  {/* Repay Button */}
                  <TouchableOpacity
                    style={styles.repayButton}
                    onPress={() => handleRepay(loan)}
                  >
                    <Text style={styles.repayButtonText}>Repay</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        )}

        {/* Empty State */}
        {loans.length === 0 && (
          <EmptyState
            icon="cash-outline"
            title="No Active Loans"
            description="Borrow against your crypto holdings without selling them"
            actionLabel={eligibleHoldings.length > 0 ? "New Loan" : undefined}
            onAction={eligibleHoldings.length > 0 ? handleNewLoan : undefined}
          />
        )}

        {/* Eligible Collateral */}
        {/* BUG-011 FIX: Client-side max borrow estimates are for UI preview ONLY */}
        {/* Backend loan.preview API provides authoritative max borrow amounts */}
        {eligibleHoldings.length > 0 && loans.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Available Collateral</Text>
            <Text style={styles.sectionSubtitle}>
              Tap an asset to borrow against it
            </Text>
            {eligibleHoldings.slice(0, 3).map((holding) => {
              const asset = ASSETS[holding.assetId];
              const priceUSD = prices[holding.assetId] || 0;
              // UI ESTIMATE ONLY - backend loan.preview is authoritative
              const valueIRR = holding.quantity * priceUSD * fxRate;
              const maxBorrowIRR = valueIRR * asset.ltv;

              return (
                <TouchableOpacity
                  key={holding.assetId}
                  style={styles.collateralCard}
                  onPress={handleNewLoan}
                >
                  <View style={styles.collateralInfo}>
                    <Text style={styles.collateralName}>
                      {asset.name}
                      <Text style={styles.assetSymbol}> | {asset.symbol}</Text>
                    </Text>
                    <Text style={styles.collateralValue}>
                      Up to {(maxBorrowIRR || 0).toLocaleString()} IRR ({((asset.ltv || 0) * 100).toFixed(0)}% LTV)
                    </Text>
                  </View>
                  <Text style={styles.collateralArrow}>›</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* New Loan FAB */}
      {eligibleHoldings.length > 0 && loans.length > 0 && (
        <TouchableOpacity style={styles.fab} onPress={handleNewLoan}>
          <Text style={styles.fabText}>+</Text>
        </TouchableOpacity>
      )}

      {/* Loan Sheet */}
      <LoanSheet
        visible={showLoanSheet}
        onClose={() => setShowLoanSheet(false)}
        eligibleHoldings={eligibleHoldings}
      />

      {/* Repay Sheet */}
      {selectedLoan && (
        <RepaySheet
          visible={showRepaySheet}
          onClose={() => {
            setShowRepaySheet(false);
            setSelectedLoan(null);
          }}
          loan={selectedLoan}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgDark,
  },
  header: {
    padding: spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: colors.borderDark,
  },
  title: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimaryDark,
    marginBottom: spacing[1],
  },
  subtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing[4],
    paddingBottom: 80,
  },
  capacityCard: {
    backgroundColor: colors.cardDark,
    borderRadius: borderRadius.lg,
    padding: spacing[4],
    marginBottom: spacing[6],
  },
  capacityTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textSecondary,
    marginBottom: spacing[3],
    textTransform: 'uppercase',
  },
  capacityBar: {
    height: 12,
    backgroundColor: colors.surfaceDark,
    borderRadius: 6,
    marginBottom: spacing[4],
  },
  capacityFill: {
    height: '100%',
    borderRadius: 6,
  },
  capacityDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  capacityItem: {
    alignItems: 'center',
  },
  capacityLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
    marginBottom: spacing[1],
  },
  capacityValue: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimaryDark,
  },
  capacityRemaining: {
    color: colors.success,
  },
  section: {
    marginBottom: spacing[6],
  },
  sectionTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textSecondary,
    marginBottom: spacing[3],
    textTransform: 'uppercase',
  },
  sectionSubtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    marginBottom: spacing[3],
    marginTop: -spacing[2],
  },
  loanCard: {
    backgroundColor: colors.cardDark,
    borderRadius: borderRadius.lg,
    padding: spacing[4],
    marginBottom: spacing[3],
  },
  loanHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing[4],
  },
  loanAsset: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  assetIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing[3],
  },
  assetIconText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimaryDark,
  },
  assetNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  assetName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimaryDark,
    marginRight: spacing[2],
  },
  assetSymbol: {
    fontWeight: typography.fontWeight.medium,
    color: colors.textSecondary,
  },
  frozenBadge: {
    backgroundColor: `${colors.primary}20`,
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  frozenBadgeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary,
  },
  collateralAmount: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
  },
  healthBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: borderRadius.full,
  },
  healthDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: spacing[1],
  },
  healthText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
  },
  loanDetails: {
    backgroundColor: colors.surfaceDark,
    borderRadius: borderRadius.default,
    padding: spacing[3],
    marginBottom: spacing[4],
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing[1],
  },
  detailLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
  },
  detailValue: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.textPrimaryDark,
  },
  progressSection: {
    marginBottom: spacing[4],
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[2],
  },
  progressLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
  },
  progressCount: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.textPrimaryDark,
  },
  progressBar: {
    height: 6,
    backgroundColor: colors.surfaceDark,
    borderRadius: 3,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.success,
    borderRadius: 3,
  },
  repayButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
    padding: spacing[3],
    alignItems: 'center',
  },
  repayButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimaryDark,
  },
  collateralCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.cardDark,
    borderRadius: borderRadius.default,
    padding: spacing[4],
    marginBottom: spacing[2],
  },
  collateralInfo: {},
  collateralName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimaryDark,
    marginBottom: 2,
  },
  collateralValue: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
  },
  collateralArrow: {
    fontSize: 24,
    color: colors.primary,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing[8],
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
    marginBottom: spacing[4],
  },
  emptyButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[3],
  },
  emptyButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimaryDark,
  },
  fab: {
    position: 'absolute',
    right: spacing[4],
    bottom: spacing[4],
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  fabText: {
    fontSize: 28,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimaryDark,
  },
});

export default LoansScreen;
