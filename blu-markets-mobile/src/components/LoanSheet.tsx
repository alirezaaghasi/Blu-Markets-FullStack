// Loan Bottom Sheet Component
// Based on PRD Section 6.5 - Borrow Flow
import React, { useState, useMemo, useEffect, useCallback } from 'react';
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
import { Holding, AssetId } from '../types';
import { ASSETS, LAYER_COLORS } from '../constants/assets';
import {
  LOAN_DAILY_INTEREST_RATE,
  LOAN_ANNUAL_INTEREST_RATE,
  LOAN_INSTALLMENT_COUNT,
  LOAN_DURATION_OPTIONS,
} from '../constants/business';
import { useAppSelector, useAppDispatch } from '../hooks/useStore';
import { addLoan, freezeHolding, addCash, logAction } from '../store/slices/portfolioSlice';
import { TransactionSuccessModal, TransactionSuccessResult } from './TransactionSuccessModal';
import { loans as loansApi } from '../services/api';
import type { LoanCapacityResponse } from '../services/api';

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
  const { holdings } = useAppSelector((state) => state.portfolio);
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
  const [durationDays, setDurationDays] = useState<30 | 60 | 90>(30);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successResult, setSuccessResult] = useState<TransactionSuccessResult | null>(null);
  const [capacity, setCapacity] = useState<LoanCapacityResponse | null>(null);

  // Fetch loan capacity from backend when sheet opens
  const fetchCapacity = useCallback(async () => {
    try {
      const capacityResponse = await loansApi.getCapacity();
      setCapacity(capacityResponse);
    } catch (error) {
      console.error('Failed to fetch loan capacity:', error);
    }
  }, []);

  useEffect(() => {
    if (visible) {
      fetchCapacity();
    }
  }, [visible, fetchCapacity]);

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

  // Use backend-derived remaining portfolio capacity (with fallback)
  const remainingPortfolioCapacity = capacity?.availableIrr ?? 0;

  // Effective max borrow (minimum of LTV limit and portfolio capacity from backend)
  const effectiveMaxBorrow = Math.min(maxBorrowIRR, remainingPortfolioCapacity);

  // Parse amount
  const amountIRR = parseInt(amountInput.replace(/,/g, ''), 10) || 0;

  // Calculate interest using daily rate
  const totalInterest = useMemo(() => {
    return amountIRR * LOAN_DAILY_INTEREST_RATE * durationDays;
  }, [amountIRR, durationDays]);

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
      // Call backend API to create loan (API expects durationDays)
      const loan = await loansApi.create(selectedAssetId, amountIRR, durationDays);

      // Update local Redux state with response
      dispatch(addLoan({
        id: loan.id,
        collateralAssetId: loan.collateralAssetId,
        collateralQuantity: loan.collateralQuantity || selectedHolding.quantity,
        amountIRR: loan.amountIRR || amountIRR,
        dailyInterestRate: loan.dailyInterestRate || LOAN_DAILY_INTEREST_RATE,
        durationDays: loan.durationDays || durationDays,
        startISO: loan.startISO || new Date().toISOString(),
        dueISO: loan.dueISO || new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString(),
        status: 'ACTIVE',
        installments: loan.installments || [],
        installmentsPaid: 0,
      }));
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
          { label: 'Duration', value: `${durationDays} days` },
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
                          {asset.symbol}
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
                  {LOAN_DURATION_OPTIONS.map((days) => (
                    <TouchableOpacity
                      key={days}
                      style={[
                        styles.durationChip,
                        durationDays === days && styles.durationChipActive,
                      ]}
                      onPress={() => setDurationDays(days)}
                    >
                      <Text
                        style={[
                          styles.durationChipText,
                          durationDays === days && styles.durationChipTextActive,
                        ]}
                      >
                        {days} days
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
