// Loans Tab - Part of Services Screen
// Based on UI Restructure Specification Section 3

import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { COLORS } from '../../constants/colors';
import { TYPOGRAPHY } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';
import { useAppSelector } from '../../hooks/useStore';
import { Loan } from '../../types';

interface LoansTabProps {
  loanId?: string;
}

export function LoansTab({ loanId }: LoansTabProps) {
  const loans = useAppSelector((state) => state.portfolio.loans);
  const hasLoans = loans.length > 0;

  if (!hasLoans) {
    return <LoansEmptyState />;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Borrow Capacity Card */}
      <View style={styles.capacityCard}>
        <Text style={styles.capacityLabel}>Available to Borrow</Text>
        <Text style={styles.capacityValue}>25,000,000 IRR</Text>
        <TouchableOpacity style={styles.borrowButton}>
          <Text style={styles.borrowButtonText}>Borrow</Text>
        </TouchableOpacity>
      </View>

      {/* Active Loans */}
      <Text style={styles.sectionTitle}>Active Loans</Text>
      {loans.map((loan) => (
        <LoanCard key={loan.id} loan={loan} highlighted={loan.id === loanId} />
      ))}
    </ScrollView>
  );
}

function LoansEmptyState() {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyIcon}>💰</Text>
      <Text style={styles.emptyTitle}>No Active Loans</Text>
      <Text style={styles.emptySubtitle}>
        Borrow against your crypto holdings at competitive rates
      </Text>
      <TouchableOpacity style={styles.emptyButton}>
        <Text style={styles.emptyButtonText}>Explore Borrowing</Text>
      </TouchableOpacity>
    </View>
  );
}

function LoanCard({ loan, highlighted }: { loan: Loan; highlighted: boolean }) {
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
            {loan.collateralQuantity} {loan.collateralAssetId}
          </Text>
          <Text style={styles.loanCollateralLabel}>Collateral</Text>
        </View>
        <View style={styles.loanStatus}>
          <Text style={styles.loanStatusText}>{loan.status}</Text>
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

      {nextInstallment && (
        <View style={styles.nextPayment}>
          <Text style={styles.nextPaymentLabel}>
            Next Payment {daysUntilDue !== null && `in ${daysUntilDue} days`}
          </Text>
          <Text style={styles.nextPaymentValue}>
            {nextInstallment.totalIRR.toLocaleString()} IRR
          </Text>
          <TouchableOpacity style={styles.payButton}>
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
  loanStatusText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.semantic.success,
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
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING[8],
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: SPACING[4],
  },
  emptyTitle: {
    fontSize: TYPOGRAPHY.fontSize.xl,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.primary,
    marginBottom: SPACING[2],
  },
  emptySubtitle: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text.secondary,
    textAlign: 'center',
    marginBottom: SPACING[6],
  },
  emptyButton: {
    backgroundColor: COLORS.brand.primary,
    paddingHorizontal: SPACING[6],
    paddingVertical: SPACING[3],
    borderRadius: RADIUS.full,
  },
  emptyButtonText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.inverse,
  },
});

export default LoansTab;
