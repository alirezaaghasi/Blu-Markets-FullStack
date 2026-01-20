// Initial Funding Screen
// Based on PRD Section 5 - Initial funding with allocation preview
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { OnboardingStackParamList } from '../../navigation/types';
import { colors, typography, spacing, borderRadius } from '../../constants/theme';
import { useAppDispatch, useAppSelector } from '../../hooks/useStore';
import { setInitialInvestment } from '../../store/slices/onboardingSlice';
import { MIN_INVESTMENT_AMOUNT } from '../../constants/business';
import { onboardingApi, ApiError } from '../../services/api';

type InitialFundingScreenProps = {
  navigation: NativeStackNavigationProp<OnboardingStackParamList, 'InitialFunding'>;
};

// Quick amount options
const QUICK_AMOUNTS = [
  { label: '5M', value: 5_000_000 },
  { label: '10M', value: 10_000_000 },
  { label: '25M', value: 25_000_000 },
  { label: '50M', value: 50_000_000 },
];

// Format number with commas
const formatNumber = (num: number): string => {
  return num.toLocaleString('en-US');
};

// Parse formatted number
const parseNumber = (str: string): number => {
  return parseInt(str.replace(/,/g, ''), 10) || 0;
};

const InitialFundingScreen: React.FC<InitialFundingScreenProps> = ({
  navigation,
}) => {
  const dispatch = useAppDispatch();
  const riskProfile = useAppSelector((state) => state.onboarding.riskProfile);
  const [amount, setAmount] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const numericAmount = parseNumber(amount);
  const isValid = numericAmount >= MIN_INVESTMENT_AMOUNT;

  const handleAmountChange = (value: string) => {
    // Only allow numbers
    const cleaned = value.replace(/[^0-9]/g, '');
    const num = parseInt(cleaned, 10) || 0;
    setAmount(num > 0 ? formatNumber(num) : '');
    setError(null);
  };

  const handleQuickAmount = (value: number) => {
    setAmount(formatNumber(value));
    setError(null);
  };

  const handleContinue = async () => {
    if (!isValid) return;

    setIsLoading(true);
    setError(null);

    try {
      await onboardingApi.createPortfolio(numericAmount);
      dispatch(setInitialInvestment(numericAmount));
      navigation.navigate('Success');
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError.message || 'Failed to create portfolio');
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate allocation preview
  const allocation = riskProfile?.targetAllocation || {
    FOUNDATION: 0.5,
    GROWTH: 0.35,
    UPSIDE: 0.15,
  };

  const foundationAmount = Math.floor(numericAmount * allocation.FOUNDATION);
  const growthAmount = Math.floor(numericAmount * allocation.GROWTH);
  const upsideAmount = numericAmount - foundationAmount - growthAmount;

  return (
    <SafeAreaView style={styles.container}>
      {/* Back button */}
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => navigation.goBack()}
      >
        <Text style={styles.backButtonText}>← Back</Text>
      </TouchableOpacity>

      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Fund your portfolio</Text>
          <Text style={styles.subtitle}>
            Enter the amount you want to invest
          </Text>
        </View>

        {/* Amount input */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            value={amount}
            onChangeText={handleAmountChange}
            placeholder="0"
            placeholderTextColor={colors.textMuted}
            keyboardType="number-pad"
            autoFocus
          />
          <Text style={styles.currency}>IRR</Text>
        </View>

        {/* Minimum amount hint */}
        <Text style={styles.hint}>
          Minimum: {formatNumber(MIN_INVESTMENT_AMOUNT)} IRR
        </Text>

        {/* Error message */}
        {error && <Text style={styles.errorText}>{error}</Text>}

        {/* Quick amount chips */}
        <View style={styles.quickAmounts}>
          {QUICK_AMOUNTS.map((item) => (
            <TouchableOpacity
              key={item.value}
              style={[
                styles.quickAmountChip,
                numericAmount === item.value && styles.quickAmountChipSelected,
              ]}
              onPress={() => handleQuickAmount(item.value)}
            >
              <Text
                style={[
                  styles.quickAmountText,
                  numericAmount === item.value && styles.quickAmountTextSelected,
                ]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Allocation preview */}
        {numericAmount > 0 && (
          <View style={styles.previewContainer}>
            <Text style={styles.previewTitle}>How it will be allocated:</Text>
            <View style={styles.previewItems}>
              <PreviewItem
                label="Foundation"
                amount={foundationAmount}
                color={colors.layerFoundation}
                percentage={Math.round(allocation.FOUNDATION * 100)}
              />
              <PreviewItem
                label="Growth"
                amount={growthAmount}
                color={colors.layerGrowth}
                percentage={Math.round(allocation.GROWTH * 100)}
              />
              <PreviewItem
                label="Upside"
                amount={upsideAmount}
                color={colors.layerUpside}
                percentage={Math.round(allocation.UPSIDE * 100)}
              />
            </View>

            {/* Allocation bar */}
            <View style={styles.allocationBar}>
              <View
                style={[
                  styles.allocationSegment,
                  {
                    flex: allocation.FOUNDATION,
                    backgroundColor: colors.layerFoundation,
                  },
                ]}
              />
              <View
                style={[
                  styles.allocationSegment,
                  {
                    flex: allocation.GROWTH,
                    backgroundColor: colors.layerGrowth,
                  },
                ]}
              />
              <View
                style={[
                  styles.allocationSegment,
                  {
                    flex: allocation.UPSIDE,
                    backgroundColor: colors.layerUpside,
                  },
                ]}
              />
            </View>
          </View>
        )}
      </View>

      {/* CTA Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.button, (!isValid || isLoading) && styles.buttonDisabled]}
          onPress={handleContinue}
          activeOpacity={0.8}
          disabled={!isValid || isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color={colors.textPrimaryDark} />
          ) : (
            <Text style={styles.buttonText}>Create My Portfolio</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const PreviewItem: React.FC<{
  label: string;
  amount: number;
  color: string;
  percentage: number;
}> = ({ label, amount, color, percentage }) => (
  <View style={styles.previewItem}>
    <View style={styles.previewItemLeft}>
      <View style={[styles.previewDot, { backgroundColor: color }]} />
      <Text style={styles.previewLabel}>{label}</Text>
      <Text style={styles.previewPercentage}>({percentage}%)</Text>
    </View>
    <Text style={styles.previewAmount}>{formatNumber(amount)} IRR</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgDark,
  },
  backButton: {
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[4],
  },
  backButtonText: {
    color: colors.textSecondary,
    fontSize: typography.fontSize.base,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing[6],
  },
  header: {
    marginBottom: spacing[8],
  },
  title: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimaryDark,
    marginBottom: spacing[2],
  },
  subtitle: {
    fontSize: typography.fontSize.base,
    color: colors.textSecondary,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardDark,
    borderRadius: borderRadius.default,
    paddingHorizontal: spacing[4],
    marginBottom: spacing[2],
  },
  input: {
    flex: 1,
    height: 64,
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimaryDark,
  },
  currency: {
    fontSize: typography.fontSize.lg,
    color: colors.textSecondary,
    fontWeight: typography.fontWeight.medium,
  },
  hint: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    marginBottom: spacing[2],
  },
  errorText: {
    color: colors.error,
    fontSize: typography.fontSize.sm,
    marginBottom: spacing[4],
  },
  quickAmounts: {
    flexDirection: 'row',
    gap: spacing[3],
    marginBottom: spacing[6],
  },
  quickAmountChip: {
    flex: 1,
    height: 44,
    backgroundColor: colors.surfaceDark,
    borderRadius: borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickAmountChipSelected: {
    backgroundColor: colors.primary,
  },
  quickAmountText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textSecondary,
  },
  quickAmountTextSelected: {
    color: colors.textPrimaryDark,
  },
  previewContainer: {
    backgroundColor: colors.cardDark,
    borderRadius: borderRadius.default,
    padding: spacing[4],
  },
  previewTitle: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    marginBottom: spacing[4],
  },
  previewItems: {
    gap: spacing[3],
    marginBottom: spacing[4],
  },
  previewItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  previewItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  previewDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: spacing[2],
  },
  previewLabel: {
    fontSize: typography.fontSize.base,
    color: colors.textPrimaryDark,
    marginRight: spacing[1],
  },
  previewPercentage: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
  },
  previewAmount: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimaryDark,
  },
  allocationBar: {
    height: 8,
    borderRadius: 4,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  allocationSegment: {
    height: '100%',
  },
  footer: {
    paddingHorizontal: spacing[6],
    paddingBottom: spacing[8],
  },
  button: {
    backgroundColor: colors.primary,
    height: 56,
    borderRadius: borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: colors.surfaceDark,
  },
  buttonText: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimaryDark,
  },
});

export default InitialFundingScreen;
