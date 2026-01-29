// Add Funds Bottom Sheet Component
// Based on PRD Section 6.7 - Add Funds Flow
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { colors, typography, spacing, borderRadius } from '../constants/theme';
import { useAppDispatch, useAppSelector } from '../hooks/useStore';
import { updateCash, logAction, setPortfolioValues } from '../store/slices/portfolioSlice';
import { portfolio } from '../services/api';
import { TransactionSuccessModal, TransactionSuccessResult } from './TransactionSuccessModal';

// Minimum deposit amount (100,000 IRR)
const MIN_DEPOSIT = 100_000;

interface AddFundsSheetProps {
  visible: boolean;
  onClose: () => void;
}

// Quick amount chips
const QUICK_AMOUNTS = [
  { label: '1M', value: 1_000_000 },
  { label: '5M', value: 5_000_000 },
  { label: '10M', value: 10_000_000 },
  { label: '25M', value: 25_000_000 },
];

export const AddFundsSheet: React.FC<AddFundsSheetProps> = ({
  visible,
  onClose,
}) => {
  const dispatch = useAppDispatch();
  const { cashIRR } = useAppSelector((state) => state.portfolio);

  const [amountInput, setAmountInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successResult, setSuccessResult] = useState<TransactionSuccessResult | null>(null);

  // Parse amount
  const amountIRR = parseInt(amountInput.replace(/,/g, ''), 10) || 0;

  // Validation
  const isValid = amountIRR >= MIN_DEPOSIT;
  const validationError = amountIRR > 0 && amountIRR < MIN_DEPOSIT
    ? `Minimum deposit is ${MIN_DEPOSIT.toLocaleString()} IRR`
    : null;

  // Format number with commas
  const formatNumber = (num: number): string => {
    if (num === undefined || num === null || isNaN(num)) return '0';
    return num.toLocaleString('en-US');
  };

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

  // Handle quick amount selection
  const handleQuickAmount = (amount: number) => {
    setAmountInput(formatNumber(amount));
  };

  // Handle confirmation
  const handleConfirm = async () => {
    if (!isValid) return;

    setIsSubmitting(true);
    try {
      // Call backend API
      const result = await portfolio.addFunds(amountIRR);
      // Use values from API response for accurate display
      const newBalance = result.cashIrr;
      const previousBalance = result.previousCashIrr ?? cashIRR;
      const actualAmountAdded = result.amountAdded ?? amountIRR;

      // Fetch full portfolio data to update all values (fixes stale data issue)
      const portfolioData = await portfolio.get();

      // Update Redux with ALL portfolio values
      dispatch(updateCash(newBalance));
      dispatch(setPortfolioValues({
        totalValueIrr: portfolioData.totalValueIrr || 0,
        holdingsValueIrr: portfolioData.holdingsValueIrr || 0,
        currentAllocation: portfolioData.allocation || { FOUNDATION: 0, GROWTH: 0, UPSIDE: 0 },
        driftPct: portfolioData.driftPct || 0,
        status: portfolioData.status || 'BALANCED',
      }));
      dispatch(logAction({
        type: 'ADD_FUNDS',
        boundary: 'SAFE',
        message: `Added ${formatNumber(actualAmountAdded)} IRR to portfolio`,
        amountIRR: actualAmountAdded,
      }));

      // Show success modal with agency-focused messaging
      // "You decide how to invest it" reinforces user control
      setSuccessResult({
        title: 'Added to Cash Wallet',
        subtitle: 'This amount is available as cash.\nYou decide how to invest it.',
        items: [
          { label: 'Amount Added', value: `${formatNumber(actualAmountAdded)} IRR` },
          { label: 'Previous Cash', value: `${formatNumber(previousBalance)} IRR` },
          { label: 'New Cash Balance', value: `${formatNumber(newBalance)} IRR`, highlight: true },
        ],
      });
      setShowSuccess(true);
      setAmountInput('');
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to add funds. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle success modal close
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
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.dragIndicator} />
            <Text style={styles.title}>Add Funds</Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.content}>
            {/* Current Balance */}
            <View style={styles.balanceSection}>
              <Text style={styles.balanceLabel}>Current Cash Balance</Text>
              <Text style={styles.balanceValue}>{formatNumber(cashIRR)} IRR</Text>
            </View>

            {/* Amount Input */}
            <View style={styles.amountSection}>
              <Text style={styles.amountLabel}>Amount to Add (IRR)</Text>
              <TextInput
                style={styles.amountInput}
                value={amountInput}
                onChangeText={handleAmountChange}
                placeholder="0"
                placeholderTextColor={colors.textSecondary}
                keyboardType="numeric"
                returnKeyType="done"
              />
              {validationError && (
                <Text style={styles.errorText}>{validationError}</Text>
              )}
            </View>

            {/* Quick Amount Chips */}
            <View style={styles.quickAmounts}>
              {QUICK_AMOUNTS.map((chip) => (
                <TouchableOpacity
                  key={chip.label}
                  style={[
                    styles.quickChip,
                    amountIRR === chip.value && styles.quickChipActive,
                  ]}
                  onPress={() => handleQuickAmount(chip.value)}
                >
                  <Text
                    style={[
                      styles.quickChipText,
                      amountIRR === chip.value && styles.quickChipTextActive,
                    ]}
                  >
                    {chip.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Info Card */}
            <View style={styles.infoCard}>
              <Text style={styles.infoIcon}>ℹ️</Text>
              <Text style={styles.infoText}>
                Funds added go to your Cash Wallet first. From there, you can buy assets or run a rebalance to invest them automatically.
              </Text>
            </View>

            {/* New Balance Preview */}
            {amountIRR > 0 && (
              <View style={styles.previewSection}>
                <Text style={styles.previewLabel}>New Cash Balance</Text>
                <Text style={styles.previewValue}>
                  {formatNumber(cashIRR + amountIRR)} IRR
                </Text>
              </View>
            )}
          </View>

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
                {isSubmitting ? 'Adding...' : 'Add Funds'}
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
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
  keyboardView: {
    flex: 1,
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
  content: {
    flex: 1,
    padding: spacing[4],
  },
  balanceSection: {
    backgroundColor: colors.cardDark,
    borderRadius: borderRadius.default,
    padding: spacing[4],
    marginBottom: spacing[4],
    alignItems: 'center',
  },
  balanceLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    marginBottom: spacing[1],
  },
  balanceValue: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimaryDark,
  },
  amountSection: {
    marginBottom: spacing[4],
  },
  amountLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    marginBottom: spacing[2],
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
  errorText: {
    fontSize: typography.fontSize.sm,
    color: colors.error,
    textAlign: 'center',
    marginTop: spacing[2],
  },
  quickAmounts: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing[4],
    gap: spacing[2],
  },
  quickChip: {
    flex: 1,
    backgroundColor: colors.surfaceDark,
    borderRadius: borderRadius.full,
    paddingVertical: spacing[3],
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderDark,
  },
  quickChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  quickChipText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimaryDark,
  },
  quickChipTextActive: {
    color: colors.textPrimaryDark,
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: `${colors.primary}15`,
    borderRadius: borderRadius.default,
    padding: spacing[4],
    marginBottom: spacing[4],
  },
  infoIcon: {
    fontSize: 16,
    marginRight: spacing[3],
  },
  infoText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  previewSection: {
    backgroundColor: colors.cardDark,
    borderRadius: borderRadius.default,
    padding: spacing[4],
    alignItems: 'center',
  },
  previewLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    marginBottom: spacing[1],
  },
  previewValue: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.success,
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
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimaryDark,
  },
});

export default AddFundsSheet;
