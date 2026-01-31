// Repay Bottom Sheet Component
// Based on PRD Section 6.6 - Repay Flow
import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  SafeAreaView,
  ScrollView,
  Alert,
} from 'react-native';
import { colors, typography, spacing, borderRadius } from '../constants/theme';
import { Loan } from '../types';
import { ASSETS, LAYER_COLORS } from '../constants/assets';
import { useAppSelector, useAppDispatch } from '../hooks/useStore';
import { updateLoan, removeLoan, unfreezeHolding, subtractCash, logAction, setPortfolioValues } from '../store/slices/portfolioSlice';
import { portfolio as portfolioApi } from '../services/api';
import { TransactionSuccessModal, TransactionSuccessResult } from './TransactionSuccessModal';
import { loans as loansApi } from '../services/api';
import { formatNumber } from '../utils/currency';
import { ALERTS } from '../constants/messages';

interface RepaySheetProps {
  visible: boolean;
  onClose: () => void;
  loan: Loan;
}

type RepayOption = 'MIN' | 'CUSTOM' | 'FULL';

export const RepaySheet: React.FC<RepaySheetProps> = ({
  visible,
  onClose,
  loan,
}) => {
  const dispatch = useAppDispatch();
  const { cashIRR } = useAppSelector((state) => state.portfolio);

  const [repayOption, setRepayOption] = useState<RepayOption>('MIN');
  const [customAmount, setCustomAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successResult, setSuccessResult] = useState<TransactionSuccessResult | null>(null);

  const asset = ASSETS[loan.collateralAssetId];

  // Calculate amounts
  const nextInstallment = loan.installments.find((i) => i.status !== 'PAID');
  const minPayment = nextInstallment?.totalIRR || 0;

  // BACKEND-DERIVED VALUES: Prefer loan.remainingIrr from backend when available
  // This is the authoritative remaining balance calculated by the server
  // Fallback to client-side calculation only if backend didn't provide it
  const totalOutstanding = loan.remainingIrr !== undefined && loan.remainingIrr >= 0
    ? loan.remainingIrr  // Backend-provided value (authoritative)
    : loan.installments.reduce((sum, i) => {
        if (i.status === 'PAID') return sum;
        return sum + (i.totalIRR - i.paidIRR);
      }, 0);

  // Get repay amount based on option
  const repayAmount = useMemo(() => {
    switch (repayOption) {
      case 'MIN':
        return minPayment;
      case 'CUSTOM':
        return parseInt(customAmount.replace(/,/g, ''), 10) || 0;
      case 'FULL':
        return totalOutstanding;
    }
  }, [repayOption, minPayment, customAmount, totalOutstanding]);

  // Validation
  const canAfford = cashIRR >= repayAmount;
  const isValid = repayAmount > 0 && canAfford;

  // Handle custom amount input
  const handleCustomAmountChange = (text: string) => {
    const cleaned = text.replace(/[^0-9]/g, '');
    if (cleaned === '') {
      setCustomAmount('');
      return;
    }
    const num = parseInt(cleaned, 10);
    setCustomAmount(formatNumber(num));
  };

  // Handle confirmation - calls backend API for all repayment logic
  const handleConfirm = async () => {
    if (!isValid) return;

    setIsSubmitting(true);
    try {
      // Call backend API to process repayment (all business logic on server)
      const result = await loansApi.repay(loan.id, repayAmount);

      const isFullSettlement = result.remainingBalance <= 0;

      if (isFullSettlement) {
        // Full settlement - update local state from API response
        dispatch(removeLoan(loan.id));
        dispatch(unfreezeHolding(loan.collateralAssetId));
        dispatch(subtractCash(repayAmount));
        dispatch(
          logAction({
            type: 'REPAY',
            boundary: 'SAFE',
            message: `Fully repaid ${asset.symbol} loan`,
            amountIRR: repayAmount,
            assetId: loan.collateralAssetId,
          })
        );

        // Refresh full portfolio data to update all values (prevents stale data)
        try {
          const portfolioData = await portfolioApi.get();
          dispatch(setPortfolioValues({
            totalValueIrr: portfolioData.totalValueIrr || 0,
            holdingsValueIrr: portfolioData.holdingsValueIrr || 0,
            currentAllocation: portfolioData.allocation || { FOUNDATION: 0, GROWTH: 0, UPSIDE: 0 },
            driftPct: portfolioData.driftPct || 0,
            status: portfolioData.status || 'BALANCED',
          }));
        } catch (e) {
          console.warn('Failed to refresh portfolio after repayment:', e);
        }

        // Show success modal for full settlement
        setSuccessResult({
          title: 'Loan Fully Settled!',
          subtitle: `Your ${asset.name} is now unlocked to trade again`,
          items: [
            { label: 'Amount Paid', value: `${formatNumber(repayAmount)} IRR` },
            { label: 'Collateral Released', value: asset.name, highlight: true },
            { label: 'Status', value: 'Closed', highlight: true },
          ],
        });
        setShowSuccess(true);
      } else {
        // Partial payment - use backend-calculated values
        const paidCount = result.installmentsPaid;
        const remainingBalance = result.remainingBalance;
        const remainingInstallments = loan.installments.length - paidCount;

        // Update local state to reflect payment
        dispatch(subtractCash(repayAmount));
        dispatch(
          logAction({
            type: 'REPAY',
            boundary: 'SAFE',
            message: `Repaid ${formatNumber(repayAmount)} IRR · ${asset.symbol} loan (${paidCount}/${loan.installments.length})`,
            amountIRR: repayAmount,
            assetId: loan.collateralAssetId,
          })
        );

        // Refresh full portfolio data to update all values (prevents stale data)
        try {
          const portfolioData = await portfolioApi.get();
          dispatch(setPortfolioValues({
            totalValueIrr: portfolioData.totalValueIrr || 0,
            holdingsValueIrr: portfolioData.holdingsValueIrr || 0,
            currentAllocation: portfolioData.allocation || { FOUNDATION: 0, GROWTH: 0, UPSIDE: 0 },
            driftPct: portfolioData.driftPct || 0,
            status: portfolioData.status || 'BALANCED',
          }));
        } catch (e) {
          console.warn('Failed to refresh portfolio after repayment:', e);
        }

        // Show success modal for partial payment (using backend-calculated values)
        setSuccessResult({
          title: 'Payment Received!',
          subtitle: `${remainingInstallments} installments remaining`,
          items: [
            { label: 'Amount Paid', value: `${formatNumber(repayAmount)} IRR`, highlight: true },
            { label: 'Progress', value: `${paidCount}/${loan.installments.length} installments` },
            { label: 'Remaining Balance', value: `${formatNumber(remainingBalance)} IRR` },
          ],
        });
        setShowSuccess(true);
      }
    } catch (error: any) {
      Alert.alert(ALERTS.loan.repayError.title, error?.message || ALERTS.loan.repayError.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // BUG FIX: Close inner modal first, then parent with delay
  // React Native's Modal touch handling gets confused when nested modals close simultaneously
  const handleSuccessClose = () => {
    setShowSuccess(false);
    setSuccessResult(null);
    // Delay parent modal close to allow inner modal to properly unmount
    setTimeout(() => {
      onClose();
    }, 150);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.dragIndicator} />
          <Text style={styles.title}>Repay Loan</Text>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {/* Loan Summary */}
          <View style={styles.summaryCard}>
            <View style={styles.summaryHeader}>
              <View
                style={[
                  styles.assetIcon,
                  { backgroundColor: `${LAYER_COLORS[asset.layer]}20` },
                ]}
              >
                <Text style={styles.assetIconText}>{asset.symbol}</Text>
              </View>
              <View>
                <Text style={styles.assetName}>{asset.name} Loan</Text>
                <Text style={styles.loanProgress}>
                  {loan.installmentsPaid}/{loan.installments.length} installments paid
                </Text>
              </View>
            </View>
            <View style={styles.summaryDetails}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Outstanding</Text>
                <Text style={styles.summaryValue}>{formatNumber(totalOutstanding)} IRR</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Next installment</Text>
                <Text style={styles.summaryValue}>{formatNumber(minPayment)} IRR</Text>
              </View>
            </View>
          </View>

          {/* Repay Options */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Repayment Amount</Text>
            <View style={styles.optionsList}>
              <TouchableOpacity
                style={[styles.option, repayOption === 'MIN' && styles.optionSelected]}
                onPress={() => setRepayOption('MIN')}
              >
                <View style={styles.optionRadio}>
                  {repayOption === 'MIN' && <View style={styles.optionRadioInner} />}
                </View>
                <View style={styles.optionInfo}>
                  <Text style={styles.optionTitle}>Minimum Payment</Text>
                  <Text style={styles.optionAmount}>{formatNumber(minPayment)} IRR</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.option, repayOption === 'CUSTOM' && styles.optionSelected]}
                onPress={() => setRepayOption('CUSTOM')}
              >
                <View style={styles.optionRadio}>
                  {repayOption === 'CUSTOM' && <View style={styles.optionRadioInner} />}
                </View>
                <View style={styles.optionInfo}>
                  <Text style={styles.optionTitle}>Custom Amount</Text>
                  {repayOption === 'CUSTOM' && (
                    <TextInput
                      style={styles.customInput}
                      value={customAmount}
                      onChangeText={handleCustomAmountChange}
                      placeholder="Enter amount"
                      placeholderTextColor={colors.textSecondary}
                      keyboardType="numeric"
                    />
                  )}
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.option, repayOption === 'FULL' && styles.optionSelected]}
                onPress={() => setRepayOption('FULL')}
              >
                <View style={styles.optionRadio}>
                  {repayOption === 'FULL' && <View style={styles.optionRadioInner} />}
                </View>
                <View style={styles.optionInfo}>
                  <Text style={styles.optionTitle}>Full Settlement</Text>
                  <Text style={styles.optionAmount}>{formatNumber(totalOutstanding)} IRR</Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>

          {/* Cash Balance */}
          <View style={styles.cashInfo}>
            <Text style={styles.cashLabel}>Available Cash</Text>
            <Text style={[styles.cashValue, !canAfford && styles.cashValueInsufficient]}>
              {formatNumber(cashIRR)} IRR
            </Text>
          </View>

          {!canAfford && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>
                Insufficient cash. Add {formatNumber(repayAmount - cashIRR)} IRR more.
              </Text>
            </View>
          )}

          {repayOption === 'FULL' && (
            <View style={styles.infoCard}>
              <Text style={styles.infoText}>
                Paying off this loan unlocks your {asset.name} to trade again.
              </Text>
            </View>
          )}
        </ScrollView>

        {/* Confirm Button */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[
              styles.confirmButton,
              (!isValid || isSubmitting) && styles.confirmButtonDisabled,
            ]}
            onPress={handleConfirm}
            disabled={!isValid || isSubmitting}
          >
            <Text style={styles.confirmButtonText}>
              {isSubmitting
                ? 'Processing...'
                : `Repay ${formatNumber(repayAmount)} IRR`}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* Success Modal */}
      <TransactionSuccessModal
        visible={showSuccess}
        onClose={handleSuccessClose}
        result={successResult}
        accentColor={colors.success}
      />
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgDark,
  },
  header: {
    alignItems: 'center',
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.borderDark,
  },
  dragIndicator: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderDark,
    marginBottom: spacing[2],
  },
  title: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimaryDark,
  },
  closeButton: {
    position: 'absolute',
    right: spacing[4],
    top: spacing[3],
  },
  closeButtonText: {
    color: colors.primary,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing[4],
    paddingBottom: spacing[8],
  },
  summaryCard: {
    backgroundColor: colors.cardDark,
    borderRadius: borderRadius.lg,
    padding: spacing[4],
    marginBottom: spacing[4],
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing[4],
  },
  assetIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing[3],
  },
  assetIconText: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimaryDark,
  },
  assetName: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimaryDark,
  },
  loanProgress: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  summaryDetails: {
    borderTopWidth: 1,
    borderTopColor: colors.borderDark,
    paddingTop: spacing[3],
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing[1],
  },
  summaryLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
  },
  summaryValue: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.textPrimaryDark,
  },
  section: {
    marginBottom: spacing[4],
  },
  sectionTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textSecondary,
    marginBottom: spacing[3],
    textTransform: 'uppercase',
  },
  optionsList: {
    gap: spacing[2],
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardDark,
    borderRadius: borderRadius.default,
    padding: spacing[4],
    borderWidth: 2,
    borderColor: 'transparent',
  },
  optionSelected: {
    borderColor: colors.primary,
  },
  optionRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.textSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing[3],
  },
  optionRadioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
  optionInfo: {
    flex: 1,
  },
  optionTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.textPrimaryDark,
  },
  optionAmount: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  customInput: {
    backgroundColor: colors.surfaceDark,
    borderRadius: borderRadius.sm,
    padding: spacing[2],
    marginTop: spacing[2],
    fontSize: typography.fontSize.base,
    color: colors.textPrimaryDark,
  },
  cashInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surfaceDark,
    borderRadius: borderRadius.default,
    padding: spacing[4],
    marginBottom: spacing[4],
  },
  cashLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
  },
  cashValue: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimaryDark,
  },
  cashValueInsufficient: {
    color: colors.error,
  },
  errorBanner: {
    backgroundColor: `${colors.error}15`,
    borderRadius: borderRadius.default,
    padding: spacing[3],
    marginBottom: spacing[4],
    borderWidth: 1,
    borderColor: `${colors.error}30`,
  },
  errorText: {
    fontSize: typography.fontSize.sm,
    color: colors.error,
  },
  infoCard: {
    backgroundColor: `${colors.primary}15`,
    borderRadius: borderRadius.default,
    padding: spacing[3],
  },
  infoText: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  footer: {
    padding: spacing[4],
    paddingBottom: spacing[8],
    borderTopWidth: 1,
    borderTopColor: colors.borderDark,
  },
  confirmButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
    padding: spacing[4],
    alignItems: 'center',
  },
  confirmButtonDisabled: {
    opacity: 0.5,
  },
  confirmButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimaryDark,
  },
});

export default RepaySheet;
