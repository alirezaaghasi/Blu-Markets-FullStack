// Loans Tab - Part of Services Screen
// Based on UI Restructure Specification Section 3
// Updated to use API hooks for backend integration
// BUG-3 FIX: Opens LoanSheet for confirmation instead of direct loan creation

import React, { useState } from 'react';
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
import { COLORS } from '../../constants/colors';
import { TYPOGRAPHY } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';
import { useLoans } from '../../hooks/useLoans';
import { useAppSelector } from '../../hooks/useStore';
import { Loan, AssetId, Holding } from '../../types';
import { EmptyState } from '../../components/EmptyState';
import { LoanSheet } from '../../components/LoanSheet';
import { RepaySheet } from '../../components/RepaySheet';
import { formatIRR, formatCrypto, getAssetName, formatDate } from '../../utils/currency';
import { LOAN } from '../../constants/messages';

// BUG-012 FIX: Collateral eligibility should come from backend
// This list is a fallback for UI responsiveness; backend API is authoritative
// PRODUCTION: Backend should return eligible assets with their LTV caps
const COLLATERAL_ELIGIBLE_ASSETS: AssetId[] = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'AVAX', 'LINK', 'TON', 'PAXG', 'KAG', 'MATIC', 'ARB'];

interface LoansTabProps {
  loanId?: string;
}

export function LoansTab({ loanId }: LoansTabProps) {
  const {
    loans,
    capacity,
    isLoading,
    isRefreshing,
    error,
    refresh,
    createLoan,
    repayLoan,
  } = useLoans();

  // BUG-3 FIX: State for LoanSheet instead of direct loan creation
  const [loanSheetVisible, setLoanSheetVisible] = useState(false);

  // State for RepaySheet - opens when user taps "Pay Now" on a loan
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
  const [repaySheetVisible, setRepaySheetVisible] = useState(false);

  // Get holdings from portfolio to find eligible collateral
  const holdings = useAppSelector((state) => state.portfolio?.holdings || []);

  // Filter eligible collateral assets from user's holdings (not already frozen)
  const eligibleHoldings = holdings.filter(
    (h) => COLLATERAL_ELIGIBLE_ASSETS.includes(h.assetId as AssetId) && h.quantity > 0 && !h.frozen
  ) as Holding[];

  // BUG-3 FIX: Open LoanSheet for user to configure loan parameters
  const handleExploreBorrowing = () => {
    if (eligibleHoldings.length === 0) {
      // Check if there are holdings but all are frozen
      const hasAnyEligible = holdings.some(
        (h) => COLLATERAL_ELIGIBLE_ASSETS.includes(h.assetId as AssetId) && h.quantity > 0
      );
      Alert.alert(
        'No Eligible Collateral',
        hasAnyEligible
          ? 'All your eligible assets are already being used as collateral for existing loans.'
          : 'You need crypto holdings (BTC, ETH, etc.) to use as collateral for a loan.',
        [{ text: 'OK' }]
      );
      return;
    }

    // Open LoanSheet for user to select collateral, amount, and duration
    setLoanSheetVisible(true);
  };

  const handleLoanSheetClose = () => {
    setLoanSheetVisible(false);
    refresh(); // Refresh the list after any action
  };

  // Open RepaySheet when user wants to make a payment
  const handleOpenRepaySheet = (loan: Loan) => {
    setSelectedLoan(loan);
    setRepaySheetVisible(true);
  };

  const handleRepaySheetClose = () => {
    setRepaySheetVisible(false);
    setSelectedLoan(null);
    refresh(); // Refresh loans after repayment
  };

  // Separate active and repaid loans
  const activeLoans = loans.filter((loan) => loan.status === 'ACTIVE');
  const repaidLoans = loans.filter((loan) => loan.status === 'REPAID');
  const hasLoans = loans.length > 0;

  if (isLoading && loans.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.brand.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={refresh}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!hasLoans) {
    const availableCapacity = capacity?.availableIrr || 0;
    return (
      <>
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.emptyContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={refresh}
              tintColor={COLORS.brand.primary}
            />
          }
        >
          <EmptyState
            icon="cash-outline"
            title={LOAN.empty.title}
            description={availableCapacity > 0
              ? `${LOAN.empty.description} Up to ${formatIRR(availableCapacity)} available.`
              : LOAN.empty.description}
            actionLabel="Explore Borrowing"
            onAction={handleExploreBorrowing}
          />

          {/* How It Works Section */}
          <View style={styles.howItWorksSection}>
            <Text style={styles.howItWorksTitle}>{LOAN.education.title}</Text>

            <View style={styles.stepCard}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>1</Text>
              </View>
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>{LOAN.education.step1.title}</Text>
                <Text style={styles.stepDescription}>
                  {LOAN.education.step1.description}
                </Text>
              </View>
            </View>

            <View style={styles.stepCard}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>2</Text>
              </View>
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>{LOAN.education.step2.title}</Text>
                <Text style={styles.stepDescription}>
                  {LOAN.education.step2.description}
                </Text>
              </View>
            </View>

            <View style={styles.stepCard}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>3</Text>
              </View>
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>{LOAN.education.step3.title}</Text>
                <Text style={styles.stepDescription}>
                  {LOAN.education.step3.description}
                </Text>
              </View>
            </View>

            {/* Benefits - PCD-Compliant: Path presentation, not advice */}
            <View style={styles.benefitsCard}>
              <Text style={styles.benefitsTitle}>{LOAN.benefits.title}</Text>
              <View style={styles.benefitRow}>
                <Text style={styles.benefitIcon}>✓</Text>
                <Text style={styles.benefitText}>{LOAN.benefits.exposure}</Text>
              </View>
              <View style={styles.benefitRow}>
                <Text style={styles.benefitIcon}>✓</Text>
                <Text style={styles.benefitText}>{LOAN.benefits.noCredit}</Text>
              </View>
              <View style={styles.benefitRow}>
                <Text style={styles.benefitIcon}>✓</Text>
                <Text style={styles.benefitText}>{LOAN.benefits.rates}</Text>
              </View>
              <View style={styles.benefitRow}>
                <Text style={styles.benefitIcon}>✓</Text>
                <Text style={styles.benefitText}>{LOAN.benefits.flexible}</Text>
              </View>
            </View>
          </View>
        </ScrollView>

        {/* BUG-3 FIX: LoanSheet for configuration and confirmation */}
        <LoanSheet
          visible={loanSheetVisible}
          onClose={handleLoanSheetClose}
          eligibleHoldings={eligibleHoldings}
        />
      </>
    );
  }

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={refresh}
            tintColor={COLORS.brand.primary}
          />
        }
      >
        {/* Borrow Capacity Card */}
        <View style={styles.capacityCard}>
          <Text style={styles.capacityLabel}>Available to Borrow</Text>
          <Text style={styles.capacityValue}>
            {formatIRR(capacity?.availableIrr || 0)}
          </Text>
          <TouchableOpacity
            style={styles.borrowButton}
            onPress={handleExploreBorrowing}
          >
            <Text style={styles.borrowButtonText}>Borrow</Text>
          </TouchableOpacity>
        </View>

        {/* Active Loans */}
        {activeLoans.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Active Loans</Text>
            {activeLoans.map((loan) => (
              <LoanCard
                key={loan.id}
                loan={loan}
                highlighted={loan.id === loanId}
                onRepay={() => handleOpenRepaySheet(loan)}
              />
            ))}
          </>
        )}

        {/* Repaid Loans */}
        {repaidLoans.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, activeLoans.length > 0 && styles.sectionTitleSpaced]}>
              Repaid Loans
            </Text>
            {repaidLoans.map((loan) => (
              <LoanCard
                key={loan.id}
                loan={loan}
                highlighted={loan.id === loanId}
                onRepay={() => {}}
              />
            ))}
          </>
        )}
      </ScrollView>

      {/* BUG-3 FIX: LoanSheet for configuration and confirmation */}
      <LoanSheet
        visible={loanSheetVisible}
        onClose={handleLoanSheetClose}
        eligibleHoldings={eligibleHoldings}
      />

      {/* RepaySheet for loan repayment confirmation */}
      {selectedLoan && (
        <RepaySheet
          visible={repaySheetVisible}
          onClose={handleRepaySheetClose}
          loan={selectedLoan}
        />
      )}
    </>
  );
}

function LoanCard({
  loan,
  highlighted,
  onRepay,
}: {
  loan: Loan;
  highlighted: boolean;
  onRepay: () => void;
}) {
  // Safety check for installments array
  const installments = loan.installments || [];
  const nextInstallment = installments.find((i) => i.status === 'PENDING');

  // BUG-012/BUG-020 FIX: Prefer backend-provided remainingIrr; calculation is fallback only
  // Backend loans.getAll API should return remainingIrr for each loan
  const remainingIRR = loan.remainingIrr ?? (
    installments.length > 0
      ? installments
          .filter((i) => i.status !== 'PAID')
          .reduce((sum, i) => sum + i.totalIRR - i.paidIRR, 0)
      : (loan.totalDueIRR || loan.amountIRR) - (loan.paidIRR || 0)
  );

  // Task 7 (Round 2): Simplified REPAID loan display - 2 lines only
  if (loan.status === 'REPAID') {
    const originalPrincipal = loan.amountIRR;
    // Use backend-provided settledAt, fallback to startISO if not available
    const settledDate = loan.settledAt || loan.startISO;
    return (
      <View style={[styles.loanCard, highlighted && styles.loanCardHighlighted]}>
        <View style={styles.repaidHeader}>
          <Text style={styles.repaidTitle}>
            {getAssetName(loan.collateralAssetId)} Loan — {formatIRR(originalPrincipal)}
          </Text>
          <View style={[styles.loanStatus, styles.loanStatusRepaid]}>
            <Text style={[styles.loanStatusText, styles.loanStatusTextRepaid]}>REPAID ✓</Text>
          </View>
        </View>
        <Text style={styles.repaidDate}>
          Settled {settledDate ? formatDate(settledDate, true) : 'N/A'}
        </Text>
      </View>
    );
  }

  // Task 6 (Round 2): Active loans show only 3 fields - Asset+qty, Remaining, Next Payment+Pay
  return (
    <View style={[styles.loanCard, highlighted && styles.loanCardHighlighted]}>
      {/* Field 1: Asset name + quantity + status badge */}
      <View style={styles.loanHeader}>
        <Text style={styles.loanAssetName}>
          {getAssetName(loan.collateralAssetId)}
        </Text>
        <View style={styles.loanStatus}>
          <Text style={styles.loanStatusText}>{loan.status}</Text>
        </View>
      </View>

      {/* Field 2: Remaining amount */}
      <View style={styles.loanDetailRow}>
        <Text style={styles.loanDetailLabel}>Remaining</Text>
        <Text style={styles.loanDetailValue}>{formatIRR(remainingIRR ?? 0)}</Text>
      </View>

      {/* Field 3: Next payment date + amount + Pay button */}
      {nextInstallment && loan.status === 'ACTIVE' && (
        <View style={styles.loanPaymentRow}>
          <Text style={styles.paymentInfo}>
            Next Payment {formatDate(nextInstallment.dueISO)} — {formatIRR(nextInstallment.totalIRR ?? 0)}
          </Text>
          <TouchableOpacity style={styles.payButton} onPress={onRepay}>
            <Text style={styles.payButtonText}>Pay Now</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: SPACING[5],
    paddingBottom: SPACING[10],
  },
  emptyContent: {
    flexGrow: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING[5],
  },
  errorText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.semantic.error,
    textAlign: 'center',
    marginBottom: SPACING[4],
  },
  retryButton: {
    backgroundColor: COLORS.brand.primary,
    paddingHorizontal: SPACING[6],
    paddingVertical: SPACING[3],
    borderRadius: RADIUS.full,
  },
  retryButtonText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.inverse,
  },
  capacityCard: {
    backgroundColor: COLORS.background.elevated,
    borderRadius: RADIUS.xl,
    padding: SPACING[5],
    marginBottom: SPACING[6],
    alignItems: 'center',
  },
  capacityLabel: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
    marginBottom: SPACING[2],
  },
  capacityValue: {
    fontSize: 28,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text.primary,
    marginBottom: SPACING[4],
  },
  borrowButton: {
    backgroundColor: COLORS.brand.primary,
    paddingHorizontal: SPACING[8],
    paddingVertical: SPACING[3],
    borderRadius: RADIUS.full,
  },
  borrowButtonText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.inverse,
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.secondary,
    textTransform: 'uppercase',
    marginBottom: SPACING[3],
  },
  sectionTitleSpaced: {
    marginTop: SPACING[6],
  },
  loanCard: {
    backgroundColor: COLORS.background.elevated,
    borderRadius: RADIUS.lg,
    padding: SPACING[4],
    marginBottom: SPACING[3],
  },
  loanCardHighlighted: {
    borderWidth: 2,
    borderColor: COLORS.brand.primary,
  },
  loanHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING[3],
  },
  // Task 6 (Round 2): Simplified loan card styles
  loanAssetName: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.primary,
  },
  // Legacy styles kept for compatibility
  loanCollateral: {},
  loanCollateralText: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.primary,
  },
  loanCollateralLabel: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
  },
  loanStatus: {
    backgroundColor: `${COLORS.semantic.success}20`,
    paddingHorizontal: SPACING[2],
    paddingVertical: SPACING[1],
    borderRadius: RADIUS.sm,
  },
  loanStatusRepaid: {
    backgroundColor: `${COLORS.text.muted}20`,
  },
  loanStatusText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.semantic.success,
  },
  loanStatusTextRepaid: {
    color: COLORS.text.muted,
  },
  // Task 7 (Round 2): Repaid loan styles - 2 lines only
  repaidHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING[2],
  },
  repaidTitle: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.text.primary,
    flex: 1,
  },
  repaidDate: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
  },
  // Task 6 (Round 2): Simplified loan payment row
  loanPaymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING[3],
    paddingTop: SPACING[3],
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  paymentInfo: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
    flex: 1,
  },
  loanDetails: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: SPACING[3],
    marginBottom: SPACING[3],
  },
  loanDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING[2],
  },
  loanDetailLabel: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
  },
  loanDetailValue: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.text.primary,
  },
  nextPayment: {
    backgroundColor: COLORS.background.surface,
    borderRadius: RADIUS.md,
    padding: SPACING[3],
    alignItems: 'center',
  },
  nextPaymentLabel: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
    marginBottom: SPACING[1],
  },
  nextPaymentValue: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.primary,
    marginBottom: SPACING[3],
  },
  payButton: {
    backgroundColor: COLORS.brand.primary,
    paddingHorizontal: SPACING[6],
    paddingVertical: SPACING[2],
    borderRadius: RADIUS.full,
  },
  payButtonText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.inverse,
  },
  // How It Works Section
  howItWorksSection: {
    padding: SPACING[5],
    paddingTop: SPACING[2],
  },
  howItWorksTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text.primary,
    marginBottom: SPACING[4],
    textAlign: 'center',
  },
  stepCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.background.elevated,
    borderRadius: RADIUS.lg,
    padding: SPACING[4],
    marginBottom: SPACING[3],
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.brand.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING[3],
  },
  stepNumberText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text.inverse,
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.primary,
    marginBottom: SPACING[1],
  },
  stepDescription: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
    lineHeight: 20,
  },
  benefitsCard: {
    backgroundColor: COLORS.background.elevated,
    borderRadius: RADIUS.lg,
    padding: SPACING[4],
    marginTop: SPACING[2],
  },
  benefitsTitle: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.primary,
    marginBottom: SPACING[3],
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING[2],
  },
  benefitIcon: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.semantic.success,
    marginRight: SPACING[2],
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },
  benefitText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
  },
});

export default LoansTab;
