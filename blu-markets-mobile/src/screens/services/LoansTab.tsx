// Loans Tab - Part of Services Screen
// Based on UI Restructure Specification Section 3
// Updated to use API hooks for backend integration

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { COLORS } from '../../constants/colors';
import { TYPOGRAPHY } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';
import { useLoans } from '../../hooks/useLoans';
import { Loan } from '../../types';
import { EmptyState } from '../../components/EmptyState';

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
          title="No Active Loans"
          description={availableCapacity > 0
            ? `Borrow against your crypto holdings. Up to ${availableCapacity.toLocaleString()} IRR available.`
            : "Borrow against your crypto holdings at competitive rates"}
          actionLabel="Explore Borrowing"
          onAction={() => createLoan(5000000, 3)}
        />

        {/* How It Works Section */}
        <View style={styles.howItWorksSection}>
          <Text style={styles.howItWorksTitle}>How Crypto-Backed Loans Work</Text>

          <View style={styles.stepCard}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>1</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Choose Collateral</Text>
              <Text style={styles.stepDescription}>
                Select crypto assets from your portfolio to use as collateral
              </Text>
            </View>
          </View>

          <View style={styles.stepCard}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>2</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Get Instant IRR</Text>
              <Text style={styles.stepDescription}>
                Receive up to 50% of your collateral value as an IRR loan
              </Text>
            </View>
          </View>

          <View style={styles.stepCard}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>3</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Repay & Unlock</Text>
              <Text style={styles.stepDescription}>
                Pay back in installments to unlock your crypto collateral
              </Text>
            </View>
          </View>

          {/* Benefits */}
          <View style={styles.benefitsCard}>
            <Text style={styles.benefitsTitle}>Benefits</Text>
            <View style={styles.benefitRow}>
              <Text style={styles.benefitIcon}>✓</Text>
              <Text style={styles.benefitText}>Keep your crypto exposure</Text>
            </View>
            <View style={styles.benefitRow}>
              <Text style={styles.benefitIcon}>✓</Text>
              <Text style={styles.benefitText}>No credit check required</Text>
            </View>
            <View style={styles.benefitRow}>
              <Text style={styles.benefitIcon}>✓</Text>
              <Text style={styles.benefitText}>Competitive interest rates</Text>
            </View>
            <View style={styles.benefitRow}>
              <Text style={styles.benefitIcon}>✓</Text>
              <Text style={styles.benefitText}>Flexible repayment options</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    );
  }

  return (
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
          {(capacity?.availableIrr || 0).toLocaleString()} IRR
        </Text>
        <TouchableOpacity
          style={styles.borrowButton}
          onPress={() => createLoan(5000000, 3)}
        >
          <Text style={styles.borrowButtonText}>Borrow</Text>
        </TouchableOpacity>
      </View>

      {/* Active Loans */}
      <Text style={styles.sectionTitle}>Active Loans</Text>
      {loans.map((loan) => (
        <LoanCard
          key={loan.id}
          loan={loan}
          highlighted={loan.id === loanId}
          onRepay={(amount) => repayLoan(loan.id, amount)}
        />
      ))}
    </ScrollView>
  );
}

function LoanCard({
  loan,
  highlighted,
  onRepay,
}: {
  loan: Loan;
  highlighted: boolean;
  onRepay: (amount: number) => void;
}) {
  const nextInstallment = loan.installments.find((i) => i.status === 'PENDING');
  const daysUntilDue = nextInstallment
    ? Math.ceil((new Date(nextInstallment.dueISO).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  // Calculate remaining from installments
  const remainingIRR = loan.installments
    .filter((i) => i.status !== 'PAID')
    .reduce((sum, i) => sum + i.totalIRR - i.paidIRR, 0);

  return (
    <View style={[styles.loanCard, highlighted && styles.loanCardHighlighted]}>
      <View style={styles.loanHeader}>
        <View style={styles.loanCollateral}>
          <Text style={styles.loanCollateralText}>
            {loan.collateralQuantity.toFixed(4)} {loan.collateralAssetId}
          </Text>
          <Text style={styles.loanCollateralLabel}>Collateral</Text>
        </View>
        <View style={[
          styles.loanStatus,
          loan.status === 'REPAID' && styles.loanStatusRepaid,
        ]}>
          <Text style={[
            styles.loanStatusText,
            loan.status === 'REPAID' && styles.loanStatusTextRepaid,
          ]}>
            {loan.status}
          </Text>
        </View>
      </View>

      <View style={styles.loanDetails}>
        <View style={styles.loanDetailRow}>
          <Text style={styles.loanDetailLabel}>Principal</Text>
          <Text style={styles.loanDetailValue}>
            {loan.amountIRR.toLocaleString()} IRR
          </Text>
        </View>
        <View style={styles.loanDetailRow}>
          <Text style={styles.loanDetailLabel}>Remaining</Text>
          <Text style={styles.loanDetailValue}>
            {remainingIRR.toLocaleString()} IRR
          </Text>
        </View>
        <View style={styles.loanDetailRow}>
          <Text style={styles.loanDetailLabel}>Interest Rate</Text>
          <Text style={styles.loanDetailValue}>{(loan.interestRate * 100).toFixed(0)}% APR</Text>
        </View>
      </View>

      {nextInstallment && loan.status === 'ACTIVE' && (
        <View style={styles.nextPayment}>
          <Text style={styles.nextPaymentLabel}>
            Next Payment {daysUntilDue !== null && `in ${daysUntilDue} days`}
          </Text>
          <Text style={styles.nextPaymentValue}>
            {nextInstallment.totalIRR.toLocaleString()} IRR
          </Text>
          <TouchableOpacity
            style={styles.payButton}
            onPress={() => onRepay(nextInstallment.totalIRR)}
          >
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
    alignItems: 'flex-start',
    marginBottom: SPACING[4],
  },
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
