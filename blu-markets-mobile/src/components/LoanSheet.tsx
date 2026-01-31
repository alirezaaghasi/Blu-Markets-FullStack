// Loan Bottom Sheet Component
// Based on PRD Section 6.5 - Borrow Flow
// REDESIGNED: Compact single-screen layout with dropdown asset picker
import React, { useState, useMemo, useEffect } from 'react';
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
  LOAN_ANNUAL_INTEREST_RATE,
  LOAN_DURATION_OPTIONS,
  LOAN_DURATION_LABELS,
  LOAN_MIN_AMOUNT,
} from '../constants/business';
import { useAppSelector, useAppDispatch } from '../hooks/useStore';
import { addLoan, freezeHolding, addCash, logAction, setPortfolioValues } from '../store/slices/portfolioSlice';
import { portfolio as portfolioApi } from '../services/api';
import { TransactionSuccessModal, TransactionSuccessResult } from './TransactionSuccessModal';
import { loans as loansApi } from '../services/api';
import { formatIRR, formatNumber } from '../utils/currency';
import type { LoanCapacityResponse, LoanPreviewResponse } from '../services/api';
import { LOAN, BUTTONS, ALERTS } from '../constants/messages';

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
  const eligibleHoldings = useMemo(() => {
    if (propHoldings) return propHoldings;
    return holdings.filter((h) => {
      const asset = ASSETS[h.assetId];
      return asset && asset.ltv > 0 && !h.frozen && h.quantity > 0;
    });
  }, [propHoldings, holdings]);

  const [selectedAssetId, setSelectedAssetId] = useState<AssetId | null>(null);
  const [showAssetPicker, setShowAssetPicker] = useState(false);
  const [amountInput, setAmountInput] = useState('');
  const [durationDays, setDurationDays] = useState<90 | 180>(90);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successResult, setSuccessResult] = useState<TransactionSuccessResult | null>(null);
  const [capacity, setCapacity] = useState<LoanCapacityResponse | null>(null);
  const [loanPreview, setLoanPreview] = useState<LoanPreviewResponse | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  // Reset state when sheet opens/closes
  useEffect(() => {
    if (visible) {
      setSelectedAssetId(null);
      setAmountInput('');
      setDurationDays(90);
      setLoanPreview(null);
      setShowAssetPicker(false);
    }
  }, [visible]);

  // Fetch loan capacity
  useEffect(() => {
    if (!visible) return;

    let isMounted = true;
    const fetchCapacity = async () => {
      try {
        const capacityResponse = await loansApi.getCapacity();
        if (isMounted) setCapacity(capacityResponse);
      } catch (error) {
        if (__DEV__) console.error('Failed to fetch loan capacity:', error);
      }
    };

    fetchCapacity();
    return () => { isMounted = false; };
  }, [visible]);

  // Fetch loan preview from backend when amount changes (debounced)
  const amountIRR = parseInt(amountInput.replace(/,/g, ''), 10) || 0;

  useEffect(() => {
    if (!selectedAssetId || amountIRR < LOAN_MIN_AMOUNT) {
      setLoanPreview(null);
      return;
    }

    let isMounted = true;
    const timeoutId = setTimeout(async () => {
      if (!isMounted) return;
      setIsLoadingPreview(true);
      try {
        const preview = await loansApi.preview(selectedAssetId, amountIRR, durationDays);
        if (isMounted) setLoanPreview(preview);
      } catch (error) {
        if (__DEV__) console.error('Failed to fetch loan preview:', error);
        if (isMounted) setLoanPreview(null);
      } finally {
        if (isMounted) setIsLoadingPreview(false);
      }
    }, 300);

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
    };
  }, [selectedAssetId, amountIRR, durationDays]);

  // Selected holding and asset
  const selectedHolding = eligibleHoldings.find((h) => h.assetId === selectedAssetId);
  const selectedAsset = selectedAssetId ? ASSETS[selectedAssetId] : null;

  // Collateral value calculation (UI preview only)
  const collateralValueIRR = useMemo(() => {
    if (!selectedHolding || !selectedAssetId) return 0;
    const priceUSD = prices[selectedAssetId] || 0;
    return selectedHolding.quantity * priceUSD * fxRate;
  }, [selectedHolding, selectedAssetId, prices, fxRate]);

  // Max borrow estimate
  const localMaxBorrowEstimate = useMemo(() => {
    if (!selectedAsset) return 0;
    return collateralValueIRR * selectedAsset.ltv;
  }, [collateralValueIRR, selectedAsset]);

  const maxBorrowIRR = loanPreview?.maxLoanIrr ?? localMaxBorrowEstimate;
  const remainingPortfolioCapacity = capacity?.availableIrr ?? Infinity;
  const effectiveMaxBorrow = capacity
    ? Math.min(maxBorrowIRR, remainingPortfolioCapacity)
    : maxBorrowIRR;

  // Backend-derived values
  const totalInterest = loanPreview?.totalInterestIrr ?? 0;
  const installmentAmount = loanPreview?.installmentAmountIrr ?? 0;

  // Validation
  const validationErrors: string[] = [];
  if (amountIRR <= 0) {
    validationErrors.push('Enter an amount to borrow');
  } else if (amountIRR < LOAN_MIN_AMOUNT) {
    validationErrors.push(`Minimum loan amount is ${LOAN_MIN_AMOUNT.toLocaleString()} IRR`);
  }
  if (amountIRR > effectiveMaxBorrow) {
    if (amountIRR > maxBorrowIRR) {
      validationErrors.push(`Maximum borrow with this asset is ${(maxBorrowIRR || 0).toLocaleString()} IRR`);
    } else {
      validationErrors.push(`Exceeds portfolio loan limit. Remaining: ${(remainingPortfolioCapacity || 0).toLocaleString()} IRR`);
    }
  }
  const isValid = validationErrors.length === 0 && amountIRR > 0;

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
      const loan = await loansApi.create(selectedAssetId, amountIRR, durationDays);

      dispatch(addLoan({
        id: loan.id,
        collateralAssetId: loan.collateralAssetId,
        collateralQuantity: loan.collateralQuantity || selectedHolding.quantity,
        amountIRR: loan.amountIRR || amountIRR,
        dailyInterestRate: loan.dailyInterestRate || 0,
        durationDays: loan.durationDays || durationDays,
        startISO: loan.startISO || new Date().toISOString(),
        dueISO: loan.dueISO || '',
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

      // Refresh portfolio data
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
        console.warn('Failed to refresh portfolio after loan:', e);
      }

      setSuccessResult({
        title: 'Loan Created!',
        subtitle: `Funds added to your cash balance`,
        items: [
          { label: 'Amount Borrowed', value: `${formatNumber(amountIRR)} IRR`, highlight: true },
          { label: 'Locked for this loan', value: `${selectedAsset.name}` },
          { label: 'Duration', value: LOAN_DURATION_LABELS[durationDays] || `${durationDays} days` },
          { label: 'Interest Rate', value: `${(LOAN_ANNUAL_INTEREST_RATE * 100).toFixed(0)}% yearly` },
          { label: 'Total to Repay', value: `${formatNumber(Math.round(amountIRR + totalInterest))} IRR` },
        ],
      });
      setShowSuccess(true);
      setAmountInput('');
    } catch (error) {
      Alert.alert(ALERTS.loan.createError.title, ALERTS.loan.createError.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSuccessClose = () => {
    setShowSuccess(false);
    setSuccessResult(null);
    setTimeout(() => {
      onClose();
    }, 150);
  };

  // Empty state
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
              You need assets to use as security for a loan.
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

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* STEP 1: Collateral Selection - Dropdown Style */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{LOAN.steps.collateral}</Text>

            <TouchableOpacity
              style={styles.dropdownTrigger}
              onPress={() => setShowAssetPicker(true)}
              activeOpacity={0.7}
            >
              {selectedAssetId && selectedAsset ? (
                <View style={styles.selectedAssetRow}>
                  <View style={[styles.assetIconSmall, { backgroundColor: `${LAYER_COLORS[selectedAsset.layer]}20` }]}>
                    <Text style={styles.assetIconTextSmall}>{selectedAsset.symbol}</Text>
                  </View>
                  <View style={styles.selectedAssetInfo}>
                    <Text style={styles.selectedAssetName}>{selectedAsset.name}</Text>
                    <Text style={styles.selectedAssetBorrow}>
                      Borrow up to {formatIRR(maxBorrowIRR)}
                    </Text>
                  </View>
                  <Text style={styles.dropdownArrow}>▼</Text>
                </View>
              ) : (
                <View style={styles.placeholderRow}>
                  <Text style={styles.placeholderText}>{LOAN.steps.collateralHelper}</Text>
                  <Text style={styles.dropdownArrow}>▼</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Steps 2-3 and Summary - Always visible when asset selected */}
          {selectedAssetId && (
            <View style={styles.compactForm}>
              {/* STEP 2: Amount Input */}
              <View style={styles.formSection}>
                <Text style={styles.sectionTitle}>{LOAN.steps.amount}</Text>
                <TextInput
                  style={styles.compactAmountInput}
                  value={amountInput}
                  onChangeText={handleAmountChange}
                  placeholder="0"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="numeric"
                  returnKeyType="done"
                />
                <Text style={styles.maxText}>
                  Max: {formatIRR(effectiveMaxBorrow)}
                </Text>

                {/* Quick Amount Chips */}
                <View style={styles.quickChipsCompact}>
                  {[0.25, 0.50, 0.75, 1.0].map((pct) => (
                    <TouchableOpacity
                      key={pct}
                      style={styles.quickChipSmall}
                      onPress={() => setAmountInput(formatNumber(Math.floor(effectiveMaxBorrow * pct)))}
                    >
                      <Text style={styles.quickChipTextSmall}>{pct * 100}%</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* STEP 3: Duration */}
              <View style={styles.formSection}>
                <Text style={styles.sectionTitle}>{LOAN.steps.duration}</Text>
                <View style={styles.durationCompact}>
                  {LOAN_DURATION_OPTIONS.map((days) => (
                    <TouchableOpacity
                      key={days}
                      style={[styles.durationPill, durationDays === days && styles.durationPillActive]}
                      onPress={() => setDurationDays(days as 90 | 180)}
                    >
                      <Text style={[styles.durationPillText, durationDays === days && styles.durationPillTextActive]}>
                        {LOAN_DURATION_LABELS[days] || `${days} days`}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Loan Summary - Only when amount > 0 */}
              {amountIRR > 0 && (
                <View style={styles.summaryCompact}>
                  <View style={styles.summaryRowCompact}>
                    <Text style={styles.summaryLabelCompact}>{LOAN.summary.totalRepay}</Text>
                    <Text style={styles.summaryValueCompact}>
                      {isLoadingPreview ? '...' : formatIRR(Math.round(amountIRR + totalInterest))}
                    </Text>
                  </View>
                  <View style={[styles.summaryRowCompact, styles.summaryRowLast]}>
                    <Text style={styles.summaryLabelCompact}>{LOAN.summary.payments(6)}</Text>
                    <Text style={styles.summaryValueCompact}>
                      {isLoadingPreview ? '...' : `~${formatIRR(installmentAmount)}`}
                    </Text>
                  </View>
                </View>
              )}

              {/* Validation Errors */}
              {validationErrors.length > 0 && amountIRR > 0 && (
                <View style={styles.errorCard}>
                  {validationErrors.map((error, index) => (
                    <Text key={index} style={styles.errorText}>{error}</Text>
                  ))}
                </View>
              )}
            </View>
          )}
        </ScrollView>

        {/* Footer */}
        <View style={styles.footer}>
          {selectedAssetId && isValid && (
            <View style={styles.footerWarning}>
              <Text style={styles.footerWarningText}>
                {LOAN.warning.collateral(selectedAsset?.name || 'This asset')}
              </Text>
            </View>
          )}
          {!selectedAssetId ? (
            <View style={[styles.confirmButton, styles.confirmButtonDisabled]}>
              <Text style={styles.confirmButtonText}>{LOAN.buttonStates.selectAsset}</Text>
            </View>
          ) : amountIRR <= 0 ? (
            <View style={[styles.confirmButton, styles.confirmButtonDisabled]}>
              <Text style={styles.confirmButtonText}>{LOAN.buttonStates.enterAmount}</Text>
            </View>
          ) : !isValid ? (
            <View style={[styles.confirmButton, styles.confirmButtonDisabled]}>
              <Text style={styles.confirmButtonText}>{LOAN.buttonStates.fixErrors}</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.confirmButton, isSubmitting && styles.confirmButtonDisabled]}
              onPress={handleConfirm}
              disabled={isSubmitting}
            >
              <Text style={styles.confirmButtonText}>
                {isSubmitting ? LOAN.buttonStates.processing : LOAN.buttonStates.confirm}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>

      {/* Asset Picker Modal */}
      <Modal
        visible={showAssetPicker}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowAssetPicker(false)}
      >
        <SafeAreaView style={styles.pickerContainer}>
          <View style={styles.pickerHeader}>
            <Text style={styles.pickerTitle}>Select Collateral</Text>
            <TouchableOpacity onPress={() => setShowAssetPicker(false)}>
              <Text style={styles.pickerClose}>Done</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.pickerList}>
            {eligibleHoldings.map((holding) => {
              const asset = ASSETS[holding.assetId];
              const priceUSD = prices[holding.assetId] || 0;
              const valueIRR = holding.quantity * priceUSD * fxRate;
              const maxBorrow = valueIRR * asset.ltv;
              const isSelected = selectedAssetId === holding.assetId;

              return (
                <TouchableOpacity
                  key={holding.assetId}
                  style={[styles.pickerOption, isSelected && styles.pickerOptionSelected]}
                  onPress={() => {
                    setSelectedAssetId(holding.assetId);
                    setAmountInput('');
                    setShowAssetPicker(false);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={[styles.assetIconSmall, { backgroundColor: `${LAYER_COLORS[asset.layer]}20` }]}>
                    <Text style={styles.assetIconTextSmall}>{asset.symbol}</Text>
                  </View>
                  <View style={styles.pickerOptionInfo}>
                    <Text style={styles.pickerOptionName}>{asset.name}</Text>
                    <Text style={styles.pickerOptionValue}>
                      Borrow up to {formatIRR(maxBorrow)}
                    </Text>
                  </View>
                  {isSelected && <Text style={styles.pickerCheckmark}>✓</Text>}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </SafeAreaView>
      </Modal>

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
    padding: 24,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimaryDark,
    textAlign: 'center',
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  header: {
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderDark,
  },
  dragIndicator: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderDark,
    marginBottom: 8,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.textPrimaryDark,
  },
  closeButton: {
    position: 'absolute',
    right: 16,
    top: 12,
  },
  closeButtonText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '500',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 24,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },

  // Dropdown Trigger
  dropdownTrigger: {
    backgroundColor: colors.cardDark,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.borderDark,
  },
  selectedAssetRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  assetIconSmall: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  assetIconTextSmall: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textPrimaryDark,
  },
  selectedAssetInfo: {
    flex: 1,
  },
  selectedAssetName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimaryDark,
  },
  selectedAssetBorrow: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  dropdownArrow: {
    fontSize: 12,
    color: colors.textSecondary,
    marginLeft: 8,
  },
  placeholderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  placeholderText: {
    fontSize: 15,
    color: colors.textSecondary,
  },

  // Compact Form
  compactForm: {
    gap: 20,
  },
  formSection: {
    // No extra margin needed, gap handles it
  },
  compactAmountInput: {
    backgroundColor: colors.cardDark,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
    fontSize: 28,
    fontWeight: '700',
    color: colors.textPrimaryDark,
    textAlign: 'center',
  },
  maxText: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
  },
  quickChipsCompact: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  quickChipSmall: {
    flex: 1,
    backgroundColor: colors.surfaceDark,
    borderRadius: 20,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderDark,
  },
  quickChipTextSmall: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimaryDark,
  },

  // Duration
  durationCompact: {
    flexDirection: 'row',
    gap: 12,
  },
  durationPill: {
    flex: 1,
    backgroundColor: colors.surfaceDark,
    borderRadius: 24,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderDark,
  },
  durationPillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  durationPillText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimaryDark,
  },
  durationPillTextActive: {
    color: colors.textPrimaryDark,
  },

  // Summary
  summaryCompact: {
    backgroundColor: colors.cardDark,
    borderRadius: 12,
    padding: 16,
  },
  summaryRowCompact: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderDark,
  },
  summaryRowLast: {
    borderBottomWidth: 0,
  },
  summaryLabelCompact: {
    fontSize: 15,
    color: colors.textSecondary,
  },
  summaryValueCompact: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimaryDark,
  },

  // Error Card
  errorCard: {
    backgroundColor: `${colors.error}15`,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: `${colors.error}30`,
  },
  errorText: {
    fontSize: 13,
    color: colors.error,
    lineHeight: 18,
  },

  // Footer
  footer: {
    padding: 16,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: colors.borderDark,
  },
  footerWarning: {
    backgroundColor: `${colors.warning}15`,
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: `${colors.warning}30`,
  },
  footerWarningText: {
    fontSize: 13,
    color: colors.warning,
    textAlign: 'center',
    lineHeight: 18,
  },
  confirmButton: {
    backgroundColor: colors.primary,
    borderRadius: 24,
    paddingVertical: 16,
    alignItems: 'center',
  },
  confirmButtonDisabled: {
    opacity: 0.5,
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimaryDark,
  },

  // Asset Picker Modal
  pickerContainer: {
    flex: 1,
    backgroundColor: colors.bgDark,
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderDark,
  },
  pickerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.textPrimaryDark,
  },
  pickerClose: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.primary,
  },
  pickerList: {
    flex: 1,
    padding: 16,
  },
  pickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardDark,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  pickerOptionSelected: {
    borderColor: colors.primary,
  },
  pickerOptionInfo: {
    flex: 1,
    marginLeft: 12,
  },
  pickerOptionName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimaryDark,
  },
  pickerOptionValue: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  pickerCheckmark: {
    fontSize: 18,
    color: colors.primary,
    fontWeight: '700',
  },
});

export default LoanSheet;
