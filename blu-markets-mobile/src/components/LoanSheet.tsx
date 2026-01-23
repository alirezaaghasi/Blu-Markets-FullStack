// Loan Bottom Sheet Component
// Based on PRD Section 6.5 - Borrow Flow
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
import { Holding, Loan, LoanInstallment, AssetId } from '../types';
import { ASSETS, LAYER_COLORS } from '../constants/assets';
import {
  LOAN_ANNUAL_INTEREST_RATE,
  LOAN_INSTALLMENT_COUNT,
  LOAN_DURATION_OPTIONS,
  MAX_PORTFOLIO_LOAN_PCT,
} from '../constants/business';
import { useAppSelector, useAppDispatch } from '../hooks/useStore';
import { addLoan, freezeHolding, addCash, logAction } from '../store/slices/portfolioSlice';
import { TransactionSuccessModal, TransactionSuccessResult } from './TransactionSuccessModal';

interface LoanSheetProps {
  visible: boolean;
  onClose: () => void;
  eligibleHoldings?: Holding[];
}

export const LoanSheet: React.FC<LoanSheetProps> = ({
  visible,
  onClose,
  eligibleHoldings: propHoldings,
}) => {
  const dispatch = useAppDispatch();
  const { loans, cashIRR, holdings } = useAppSelector((state) => state.portfolio);
  const { prices, fxRate } = useAppSelector((state) => state.prices);

  // Use provided holdings or derive eligible holdings from portfolio
  // Eligible for loans: unfrozen holdings with LTV > 0
  const eligibleHoldings = useMemo(() => {
    if (propHoldings) return propHoldings;
    return holdings.filter((h) => {
      const asset = ASSETS[h.assetId];
      return asset && asset.ltv > 0 && !h.frozen && h.quantity > 0;
    });
  }, [propHoldings, holdings]);

  const [selectedAssetId, setSelectedAssetId] = useState<AssetId | null>(null);
  const [amountInput, setAmountInput] = useState('');
  const [durationMonths, setDurationMonths] = useState<3 | 6>(3);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successResult, setSuccessResult] = useState<TransactionSuccessResult | null>(null);

  // Set initial selected asset when eligibleHoldings loads
  React.useEffect(() => {
    if (!selectedAssetId && eligibleHoldings.length > 0) {
      setSelectedAssetId(eligibleHoldings[0].assetId);
    }
  }, [eligibleHoldings, selectedAssetId]);

  // Selected holding and asset
  const selectedHolding = eligibleHoldings.find((h) => h.assetId === selectedAssetId);
  const selectedAsset = selectedAssetId ? ASSETS[selectedAssetId] : null;

  // Calculate collateral value and max borrow
  const collateralValueIRR = useMemo(() => {
    if (!selectedHolding || !selectedAssetId) return 0;
    const priceUSD = prices[selectedAssetId] || 0;
    return selectedHolding.quantity * priceUSD * fxRate;
  }, [selectedHolding, selectedAssetId, prices, fxRate]);

  const maxBorrowIRR = useMemo(() => {
    if (!selectedAsset) return 0;
    return collateralValueIRR * selectedAsset.ltv;
  }, [collateralValueIRR, selectedAsset]);

  // Calculate existing loans total
  const existingLoansTotal = loans.reduce((sum, l) => sum + l.amountIRR, 0);

  // Calculate portfolio loan capacity
  const portfolioValueIRR = useMemo(() => {
    const holdingsValue = holdings.reduce((sum, h) => {
      const priceUSD = prices[h.assetId] || 0;
      return sum + h.quantity * priceUSD * fxRate;
    }, 0);
    return holdingsValue + cashIRR;
  }, [holdings, prices, fxRate, cashIRR]);

  const maxPortfolioLoanCapacity = portfolioValueIRR * MAX_PORTFOLIO_LOAN_PCT;
  const remainingPortfolioCapacity = Math.max(0, maxPortfolioLoanCapacity - existingLoansTotal);

  // Effective max borrow (minimum of LTV limit and portfolio capacity)
  const effectiveMaxBorrow = Math.min(maxBorrowIRR, remainingPortfolioCapacity);

  // Parse amount
  const amountIRR = parseInt(amountInput.replace(/,/g, ''), 10) || 0;

  // Calculate interest
  const totalInterest = useMemo(() => {
    return amountIRR * LOAN_ANNUAL_INTEREST_RATE * (durationMonths / 12);
  }, [amountIRR, durationMonths]);

  // Calculate installments
  const installmentAmount = useMemo(() => {
    const total = amountIRR + totalInterest;
    return Math.ceil(total / LOAN_INSTALLMENT_COUNT);
  }, [amountIRR, totalInterest]);

  // Validation
  const validationErrors: string[] = [];
  if (amountIRR <= 0) {
    validationErrors.push('Enter an amount to borrow');
  }
  if (amountIRR > effectiveMaxBorrow) {
    if (amountIRR > maxBorrowIRR) {
      validationErrors.push(`Maximum borrow with this collateral is ${maxBorrowIRR.toLocaleString()} IRR (${(selectedAsset?.ltv || 0) * 100}% LTV)`);
    } else {
      validationErrors.push(`Exceeds portfolio loan limit. Remaining capacity: ${remainingPortfolioCapacity.toLocaleString()} IRR`);
    }
  }
  const isValid = validationErrors.length === 0 && amountIRR > 0;

  // Format number
  const formatNumber = (num: number): string => num.toLocaleString('en-US');

  // Handle amount input
  const handleAmountChange = (text: string) => {
    const cleaned = text.replace(/[^0-9]/g, '');
    if (cleaned === '') {
      setAmountInput('');
      return;
    }
    const num = parseInt(cleaned, 10);
    setAmountInput(formatNumber(num));
  };

  // Handle confirmation
  const handleConfirm = async () => {
    if (!isValid || !selectedAssetId || !selectedHolding || !selectedAsset) return;

    setIsSubmitting(true);
    try {
      const now = new Date();
      const dueDate = new Date(now);
      dueDate.setMonth(dueDate.getMonth() + durationMonths);

      // Generate installments
      const daysPerInstallment = (durationMonths * 30) / LOAN_INSTALLMENT_COUNT;
      const principalPerInst = Math.floor(amountIRR / LOAN_INSTALLMENT_COUNT);
      const interestPerInst = Math.floor(totalInterest / LOAN_INSTALLMENT_COUNT);

      const installments: LoanInstallment[] = [];
      for (let i = 0; i < LOAN_INSTALLMENT_COUNT; i++) {
        const installmentDate = new Date(now);
        installmentDate.setDate(installmentDate.getDate() + Math.round(daysPerInstallment * (i + 1)));

        const isLast = i === LOAN_INSTALLMENT_COUNT - 1;
        const principal = isLast
          ? amountIRR - principalPerInst * (LOAN_INSTALLMENT_COUNT - 1)
          : principalPerInst;
        const interest = isLast
          ? totalInterest - interestPerInst * (LOAN_INSTALLMENT_COUNT - 1)
          : interestPerInst;

        installments.push({
          number: i + 1,
          dueISO: installmentDate.toISOString(),
          principalIRR: principal,
          interestIRR: interest,
          totalIRR: principal + interest,
          paidIRR: 0,
          status: 'PENDING',
        });
      }

      const loan: Loan = {
        id: `loan-${Date.now()}`,
        collateralAssetId: selectedAssetId,
        collateralQuantity: selectedHolding.quantity,
        amountIRR,
        interestRate: LOAN_ANNUAL_INTEREST_RATE,
        durationMonths,
        startISO: now.toISOString(),
        dueISO: dueDate.toISOString(),
        status: 'ACTIVE',
        installments,
        installmentsPaid: 0,
      };

      dispatch(addLoan(loan));
      dispatch(freezeHolding(selectedAssetId));
      dispatch(addCash(amountIRR));
      dispatch(
        logAction({
          type: 'BORROW',
          boundary: 'SAFE',
          message: `Borrowed ${formatNumber(amountIRR)} IRR against ${selectedAsset.symbol}`,
          amountIRR,
          assetId: selectedAssetId,
        })
      );

      // Show success modal
      setSuccessResult({
        title: 'Loan Created!',
        subtitle: `Funds added to your cash balance`,
        items: [
          { label: 'Amount Borrowed', value: `${formatNumber(amountIRR)} IRR`, highlight: true },
          { label: 'Collateral', value: `${selectedAsset.name} (Frozen)` },
          { label: 'Duration', value: `${durationMonths} months` },
          { label: 'Interest Rate', value: `${(LOAN_ANNUAL_INTEREST_RATE * 100).toFixed(0)}% annual` },
          { label: 'Total to Repay', value: `${formatNumber(Math.round(amountIRR + totalInterest))} IRR` },
        ],
      });
      setShowSuccess(true);
      setAmountInput('');
    } catch (error) {
      Alert.alert('Error', 'Failed to create loan. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSuccessClose = () => {
    setShowSuccess(false);
    setSuccessResult(null);
    onClose();
  };

  // Show empty state if no eligible holdings for collateral
  if (eligibleHoldings.length === 0) {
    return (
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={onClose}
      >
        <SafeAreaView style={styles.container}>
          <View style={styles.header}>
            <View style={styles.dragIndicator} />
            <Text style={styles.title}>Borrow IRR</Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>
              No assets available as collateral.
            </Text>
            <Text style={styles.emptyStateSubtext}>
              You need assets with LTV value to borrow against.
            </Text>
          </View>
        </SafeAreaView>
      </Modal>
    );
  }

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
          <Text style={styles.title}>New Loan</Text>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {/* Collateral Selection */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Select Collateral</Text>
            <View style={styles.collateralList}>
              {eligibleHoldings.map((holding) => {
                const asset = ASSETS[holding.assetId];
                const priceUSD = prices[holding.assetId] || 0;
                const valueIRR = holding.quantity * priceUSD * fxRate;
                const maxBorrow = valueIRR * asset.ltv;
                const isSelected = selectedAssetId === holding.assetId;

                return (
                  <TouchableOpacity
                    key={holding.assetId}
                    style={[
                      styles.collateralOption,
                      isSelected && styles.collateralOptionSelected,
                    ]}
                    onPress={() => {
                      setSelectedAssetId(holding.assetId);
                      setAmountInput('');
                    }}
                  >
                    <View style={styles.collateralInfo}>
                      <View
                        style={[
                          styles.assetIcon,
                          { backgroundColor: `${LAYER_COLORS[asset.layer]}20` },
                        ]}
                      >
                        <Text style={styles.assetIconText}>
                          {asset.symbol.slice(0, 2)}
                        </Text>
                      </View>
                      <View>
                        <Text style={styles.collateralName}>{asset.name}</Text>
                        <Text style={styles.collateralValue}>
                          Max: {formatNumber(maxBorrow)} IRR ({(asset.ltv * 100).toFixed(0)}% LTV)
                        </Text>
                      </View>
                    </View>
                    {isSelected && <Text style={styles.checkmark}>✓</Text>}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {selectedAssetId && (
            <>
              {/* Amount Input */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Borrow Amount (IRR)</Text>
                <TextInput
                  style={styles.amountInput}
                  value={amountInput}
                  onChangeText={handleAmountChange}
                  placeholder="0"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="numeric"
                  returnKeyType="done"
                />
                <Text style={styles.maxBorrowText}>
                  Maximum: {formatNumber(effectiveMaxBorrow)} IRR
                </Text>

                {/* Quick amount chips */}
                <View style={styles.quickAmounts}>
                  {[0.25, 0.50, 0.75, 1.0].map((pct) => (
                    <TouchableOpacity
                      key={pct}
                      style={styles.quickChip}
                      onPress={() =>
                        setAmountInput(formatNumber(Math.floor(effectiveMaxBorrow * pct)))
                      }
                    >
                      <Text style={styles.quickChipText}>{pct * 100}%</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Duration Selection */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Loan Duration</Text>
                <View style={styles.durationOptions}>
                  {LOAN_DURATION_OPTIONS.map((months) => (
                    <TouchableOpacity
                      key={months}
                      style={[
                        styles.durationChip,
                        durationMonths === months && styles.durationChipActive,
                      ]}
                      onPress={() => setDurationMonths(months)}
                    >
                      <Text
                        style={[
                          styles.durationChipText,
                          durationMonths === months && styles.durationChipTextActive,
                        ]}
                      >
                        {months} months
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Loan Preview */}
              {amountIRR > 0 && (
                <View style={styles.previewCard}>
                  <Text style={styles.previewTitle}>Loan Summary</Text>
                  <View style={styles.previewRow}>
                    <Text style={styles.previewLabel}>Principal</Text>
                    <Text style={styles.previewValue}>{formatNumber(amountIRR)} IRR</Text>
                  </View>
                  <View style={styles.previewRow}>
                    <Text style={styles.previewLabel}>Interest ({(LOAN_ANNUAL_INTEREST_RATE * 100)}% annual)</Text>
                    <Text style={styles.previewValue}>{formatNumber(Math.round(totalInterest))} IRR</Text>
                  </View>
                  <View style={[styles.previewRow, styles.previewRowTotal]}>
                    <Text style={styles.previewTotalLabel}>Total to Repay</Text>
                    <Text style={styles.previewTotalValue}>
                      {formatNumber(Math.round(amountIRR + totalInterest))} IRR
                    </Text>
                  </View>
                  <View style={styles.previewRow}>
                    <Text style={styles.previewLabel}>Installments ({LOAN_INSTALLMENT_COUNT}x)</Text>
                    <Text style={styles.previewValue}>~{formatNumber(installmentAmount)} IRR/each</Text>
                  </View>
                </View>
              )}

              {/* Warnings */}
              <View style={styles.warningCard}>
                <Text style={styles.warningTitle}>Important Information</Text>
                <Text style={styles.warningText}>
                  • Your {selectedAsset?.name} will be frozen as collateral and cannot be sold
                </Text>
                <Text style={styles.warningText}>
                  • If the collateral value drops below the loan amount, it may be liquidated
                </Text>
                <Text style={styles.warningText}>
                  • Repay early with no penalties
                </Text>
              </View>

              {/* Validation Errors */}
              {validationErrors.length > 0 && amountIRR > 0 && (
                <View style={styles.errorCard}>
                  {validationErrors.map((error, index) => (
                    <Text key={index} style={styles.errorText}>
                      {error}
                    </Text>
                  ))}
                </View>
              )}
            </>
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
              {isSubmitting ? 'Processing...' : 'Confirm Loan'}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* Success Modal */}
      <TransactionSuccessModal
        visible={showSuccess}
        onClose={handleSuccessClose}
        result={successResult}
        accentColor={colors.primary}
      />
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgDark,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing[6],
  },
  emptyStateText: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimaryDark,
    textAlign: 'center',
    marginBottom: spacing[2],
  },
  emptyStateSubtext: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    textAlign: 'center',
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
  collateralList: {
    gap: spacing[2],
  },
  collateralOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.cardDark,
    borderRadius: borderRadius.default,
    padding: spacing[4],
    borderWidth: 2,
    borderColor: 'transparent',
  },
  collateralOptionSelected: {
    borderColor: colors.primary,
  },
  collateralInfo: {
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
  checkmark: {
    fontSize: 20,
    color: colors.primary,
    fontWeight: typography.fontWeight.bold,
  },
  amountInput: {
    backgroundColor: colors.cardDark,
    borderRadius: borderRadius.default,
    padding: spacing[4],
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimaryDark,
    textAlign: 'center',
  },
  maxBorrowText: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing[2],
  },
  quickAmounts: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing[3],
    gap: spacing[2],
  },
  quickChip: {
    flex: 1,
    backgroundColor: colors.surfaceDark,
    borderRadius: borderRadius.full,
    paddingVertical: spacing[2],
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderDark,
  },
  quickChipText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.textPrimaryDark,
  },
  durationOptions: {
    flexDirection: 'row',
    gap: spacing[3],
  },
  durationChip: {
    flex: 1,
    backgroundColor: colors.surfaceDark,
    borderRadius: borderRadius.full,
    paddingVertical: spacing[3],
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderDark,
  },
  durationChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  durationChipText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimaryDark,
  },
  durationChipTextActive: {
    color: colors.textPrimaryDark,
  },
  previewCard: {
    backgroundColor: colors.cardDark,
    borderRadius: borderRadius.lg,
    padding: spacing[4],
    marginBottom: spacing[4],
  },
  previewTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textSecondary,
    marginBottom: spacing[3],
    textTransform: 'uppercase',
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing[2],
  },
  previewRowTotal: {
    paddingTop: spacing[3],
    marginTop: spacing[2],
    borderTopWidth: 1,
    borderTopColor: colors.borderDark,
  },
  previewLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
  },
  previewValue: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.textPrimaryDark,
  },
  previewTotalLabel: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimaryDark,
  },
  previewTotalValue: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary,
  },
  warningCard: {
    backgroundColor: `${colors.warning}15`,
    borderRadius: borderRadius.default,
    padding: spacing[4],
    marginBottom: spacing[4],
    borderWidth: 1,
    borderColor: `${colors.warning}30`,
  },
  warningTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.warning,
    marginBottom: spacing[2],
  },
  warningText: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    marginBottom: spacing[1],
    lineHeight: 20,
  },
  errorCard: {
    backgroundColor: `${colors.error}15`,
    borderRadius: borderRadius.default,
    padding: spacing[3],
    borderWidth: 1,
    borderColor: `${colors.error}30`,
  },
  errorText: {
    fontSize: typography.fontSize.sm,
    color: colors.error,
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

export default LoanSheet;
