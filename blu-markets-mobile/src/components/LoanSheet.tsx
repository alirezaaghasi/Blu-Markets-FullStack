// Loan Bottom Sheet Component
// Based on PRD Section 6.5 - Borrow Flow
import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
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
  Animated,
} from 'react-native';
import { colors, typography, spacing, borderRadius } from '../constants/theme';
import { Holding, AssetId } from '../types';
import { ASSETS, LAYER_COLORS } from '../constants/assets';
import {
  LOAN_DAILY_INTEREST_RATE,
  LOAN_ANNUAL_INTEREST_RATE,
  LOAN_INSTALLMENT_COUNT,
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
  const [durationDays, setDurationDays] = useState<90 | 180>(90);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successResult, setSuccessResult] = useState<TransactionSuccessResult | null>(null);
  const [capacity, setCapacity] = useState<LoanCapacityResponse | null>(null);
  const [loanPreview, setLoanPreview] = useState<LoanPreviewResponse | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  // Ref for ScrollView to scroll to amount input when asset is selected
  const scrollViewRef = useRef<ScrollView>(null);
  const amountSectionY = useRef(0);

  // Reset state when sheet opens/closes
  useEffect(() => {
    if (visible) {
      // Reset state when sheet opens for fresh start
      setSelectedAssetId(null);
      setAmountInput('');
      setDurationDays(90);
      setLoanPreview(null);
    }
  }, [visible]);

  // BUG-024 FIX: Fetch loan capacity with cleanup to prevent state updates on unmounted component
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
    }, 300); // Debounce 300ms

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
    };
  }, [selectedAssetId, amountIRR, durationDays]);

  // REMOVED: Auto-selection was causing UX issues where tapping the first asset
  // appeared to do nothing because it was already selected.
  // Users must now explicitly tap an asset to proceed to the amount input step.

  // Selected holding and asset
  const selectedHolding = eligibleHoldings.find((h) => h.assetId === selectedAssetId);
  const selectedAsset = selectedAssetId ? ASSETS[selectedAssetId] : null;

  // BUG-005 FIX: Client-side collateral value calculation is for UI preview ONLY
  // Backend loan.preview API is AUTHORITATIVE for all loan eligibility decisions.
  // This estimate enables responsive UI while backend calculates actual values.
  const collateralValueIRR = useMemo(() => {
    if (!selectedHolding || !selectedAssetId) return 0;
    const priceUSD = prices[selectedAssetId] || 0;
    // UI ESTIMATE ONLY - backend preview is authoritative
    return selectedHolding.quantity * priceUSD * fxRate;
  }, [selectedHolding, selectedAssetId, prices, fxRate]);

  // BUG-005/BUG-023 FIX: UI estimate for slider max, but prefer backend when available
  // The backend's maxLoanIrr in LoanPreviewResponse is AUTHORITATIVE.
  const localMaxBorrowEstimate = useMemo(() => {
    if (!selectedAsset) return 0;
    // UI ESTIMATE ONLY - used before backend preview loads
    return collateralValueIRR * selectedAsset.ltv;
  }, [collateralValueIRR, selectedAsset]);

  // BUG-023 FIX: Prefer backend maxLoanIrr when available
  const maxBorrowIRR = loanPreview?.maxLoanIrr ?? localMaxBorrowEstimate;

  // Use backend-derived remaining portfolio capacity
  // BUG-3 FIX: If capacity not loaded yet, use maxBorrowIRR as fallback (no portfolio limit)
  const remainingPortfolioCapacity = capacity?.availableIrr ?? Infinity;

  // Effective max borrow (minimum of LTV limit and portfolio capacity from backend)
  // If capacity not fetched yet, use maxBorrowIRR (optimistic, server will validate)
  const effectiveMaxBorrow = capacity
    ? Math.min(maxBorrowIRR, remainingPortfolioCapacity)
    : maxBorrowIRR;

  // NOTE: amountIRR is now parsed in the useEffect above for preview fetching

  // BUG-004 FIX: Use backend-derived interest and installment amounts ONLY
  // Frontend must NOT compute LTV, interest, installments, or due dates
  // Display 0 until backend preview is available (loading state handles UX)
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
      validationErrors.push(`Maximum borrow with this asset is ${(maxBorrowIRR || 0).toLocaleString()} IRR (${(selectedAsset?.ltv || 0) * 100}% of value)`);
    } else {
      validationErrors.push(`Exceeds portfolio loan limit. Remaining capacity: ${(remainingPortfolioCapacity || 0).toLocaleString()} IRR`);
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
      // Call backend API to create loan (API expects durationDays)
      const loan = await loansApi.create(selectedAssetId, amountIRR, durationDays);

      // Update local Redux state with response
      // BUG-004 FIX: Use ONLY backend-provided values, no client-side fallback calculations
      dispatch(addLoan({
        id: loan.id,
        collateralAssetId: loan.collateralAssetId,
        collateralQuantity: loan.collateralQuantity || selectedHolding.quantity,
        amountIRR: loan.amountIRR || amountIRR,
        dailyInterestRate: loan.dailyInterestRate || 0, // Backend must provide
        durationDays: loan.durationDays || durationDays,
        startISO: loan.startISO || new Date().toISOString(),
        dueISO: loan.dueISO || '', // Backend must provide due date
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
        // Non-fatal - status will update on next refresh
        console.warn('Failed to refresh portfolio after loan:', e);
      }

      // BUG-005 FIX: Show success modal with backend-provided values
      // totalInterest comes from loanPreview API (backend-calculated)
      setSuccessResult({
        title: 'Loan Created!',
        subtitle: `Funds added to your cash balance`,
        items: [
          { label: 'Amount Borrowed', value: `${formatNumber(amountIRR)} IRR`, highlight: true },
          { label: 'Locked for this loan', value: `${selectedAsset.name}` },
          { label: 'Duration', value: LOAN_DURATION_LABELS[durationDays] || `${durationDays} days` },
          { label: 'Interest Rate', value: `${(LOAN_ANNUAL_INTEREST_RATE * 100).toFixed(0)}% yearly` },
          // Use backend-provided totalInterest from loanPreview
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
          ref={scrollViewRef}
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Asset Selection - asset will be locked for this loan */}
          <View style={styles.section}>
            <View style={styles.sectionTitleRow}>
              <Text style={styles.sectionTitle}>Step 1: Choose Collateral</Text>
              <Text style={styles.infoIcon} onPress={() => Alert.alert(
                'Borrowing Limits',
                'Riskier assets let you borrow a smaller percentage of their value. Stablecoins and gold allow up to 50%, while volatile assets may only allow 30-40%.'
              )}>ⓘ</Text>
            </View>
            {!selectedAssetId && (
              <Text style={styles.sectionHelper}>Tap an asset to use as security for your loan</Text>
            )}
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
                      // Scroll to amount input section after selection
                      setTimeout(() => {
                        scrollViewRef.current?.scrollTo({ y: 200, animated: true });
                      }, 100);
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={styles.collateralInfo}>
                      <View
                        style={[
                          styles.assetIcon,
                          { backgroundColor: `${LAYER_COLORS[asset.layer]}20` },
                          isSelected && { backgroundColor: `${LAYER_COLORS[asset.layer]}40` },
                        ]}
                      >
                        <Text style={styles.assetIconText}>
                          {asset.symbol}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.collateralName}>{asset.name}</Text>
                        <Text style={styles.collateralValue}>
                          You can borrow up to {formatIRR(maxBorrow)}
                        </Text>
                      </View>
                    </View>
                    {isSelected && (
                      <View style={styles.selectedBadge}>
                        <Text style={styles.checkmark}>✓</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {selectedAssetId && (
            <>
              {/* Amount Input */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Step 2: Borrow Amount (IRR)</Text>
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
                <Text style={styles.sectionTitle}>Step 3: Loan Duration</Text>
                <View style={styles.durationOptions}>
                  {LOAN_DURATION_OPTIONS.map((days) => (
                    <TouchableOpacity
                      key={days}
                      style={[
                        styles.durationChip,
                        durationDays === days && styles.durationChipActive,
                      ]}
                      onPress={() => setDurationDays(days as 90 | 180)}
                    >
                      <Text
                        style={[
                          styles.durationChipText,
                          durationDays === days && styles.durationChipTextActive,
                        ]}
                      >
                        {LOAN_DURATION_LABELS[days] || `${days} days`}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Task 5 (Round 2): Simplified loan summary - 2 rows only */}
              {amountIRR > 0 && (
                <View style={styles.previewCard}>
                  <Text style={styles.previewTitle}>Loan Summary</Text>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Total to Repay</Text>
                    <Text style={styles.summaryValue}>{formatIRR(Math.round(amountIRR + totalInterest))}</Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>6 Monthly Payments</Text>
                    <Text style={styles.summaryValue}>~{formatIRR(installmentAmount)}</Text>
                  </View>
                </View>
              )}

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

        {/* Action Button - shows contextual text based on current step */}
        <View style={styles.footer}>
          {/* UX-002: Loan warning moved above Confirm button for visibility */}
          {selectedAssetId && isValid && (
            <View style={styles.footerWarning}>
              <Text style={styles.footerWarningText}>
                ⚠️ Your {selectedAsset?.name} will be locked and may be sold if value drops below loan amount
              </Text>
            </View>
          )}
          {!selectedAssetId ? (
            // Step 1: No asset selected yet
            <View style={[styles.confirmButton, styles.confirmButtonDisabled]}>
              <Text style={styles.confirmButtonText}>Select an asset above</Text>
            </View>
          ) : amountIRR <= 0 ? (
            // Step 2: Asset selected but no amount
            <View style={[styles.confirmButton, styles.confirmButtonDisabled]}>
              <Text style={styles.confirmButtonText}>Enter borrow amount</Text>
            </View>
          ) : !isValid ? (
            // Validation errors
            <View style={[styles.confirmButton, styles.confirmButtonDisabled]}>
              <Text style={styles.confirmButtonText}>Fix errors above</Text>
            </View>
          ) : (
            // Ready to confirm
            <TouchableOpacity
              style={[styles.confirmButton, isSubmitting && styles.confirmButtonDisabled]}
              onPress={handleConfirm}
              disabled={isSubmitting}
            >
              <Text style={styles.confirmButtonText}>
                {isSubmitting ? 'Processing...' : 'Confirm Loan'}
              </Text>
            </TouchableOpacity>
          )}
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
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing[3],
  },
  sectionTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textSecondary,
    textTransform: 'uppercase',
  },
  infoIcon: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    marginLeft: spacing[2],
    paddingHorizontal: spacing[1],
  },
  sectionHelper: {
    fontSize: typography.fontSize.sm,
    color: colors.primary,
    marginBottom: spacing[3],
    marginTop: -spacing[2],
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
  selectedBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmark: {
    fontSize: 16,
    color: colors.textPrimaryDark,
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
  // Task 5 (Round 2): New summary row styles
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing[3],
  },
  summaryLabel: {
    fontSize: typography.fontSize.base,
    color: colors.textSecondary,
  },
  summaryValue: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimaryDark,
  },
  // Legacy preview styles (kept for compatibility)
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
  // UX-002: Footer warning styles
  footerWarning: {
    backgroundColor: `${colors.warning}15`,
    borderRadius: borderRadius.default,
    padding: spacing[3],
    marginBottom: spacing[3],
    borderWidth: 1,
    borderColor: `${colors.warning}30`,
  },
  footerWarningText: {
    fontSize: typography.fontSize.sm,
    color: colors.warning,
    textAlign: 'center',
    lineHeight: 18,
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
