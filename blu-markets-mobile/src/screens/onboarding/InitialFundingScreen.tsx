/**
 * InitialFundingScreen
 * Design System: Blu Markets
 * Target: iPhone 16 Pro (393 x 852)
 *
 * Initial funding with NumericKeypad and allocation preview
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ScrollView,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { OnboardingStackParamList } from '../../navigation/types';
import { COLORS } from '../../constants/colors';
import { TYPOGRAPHY } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';
import { LAYOUT } from '../../constants/layout';
import { Button, NumericKeypad, AmountDisplay, QuickAmountChips } from '../../components/common';
import { useAppDispatch, useAppSelector } from '../../hooks/useStore';
import { setInitialInvestment } from '../../store/slices/onboardingSlice';
import { MIN_INVESTMENT_AMOUNT } from '../../constants/business';
import { onboarding } from '../../services/api';

type InitialFundingScreenProps = {
  navigation: NativeStackNavigationProp<OnboardingStackParamList, 'InitialFunding'>;
};

// Quick amount options (all must be >= MIN_INVESTMENT_AMOUNT of 10M)
const QUICK_AMOUNTS = [10_000_000, 25_000_000, 50_000_000, 100_000_000];

// Format number with commas
const formatNumber = (num: number): string => {
  return num.toLocaleString('en-US');
};

const InitialFundingScreen: React.FC<InitialFundingScreenProps> = ({
  navigation,
}) => {
  const dispatch = useAppDispatch();
  const riskProfile = useAppSelector((state) => state.onboarding.riskProfile);
  const [amount, setAmount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isValid = amount >= MIN_INVESTMENT_AMOUNT;

  // Handle numeric keypad press
  const handleKeyPress = useCallback((key: string) => {
    setAmount((prev) => {
      const newValue = prev * 10 + parseInt(key, 10);
      // Max 15 digits (999 trillion)
      if (newValue > 999_999_999_999_999) return prev;
      return newValue;
    });
    setError(null);
  }, []);

  // Handle backspace
  const handleBackspace = useCallback(() => {
    setAmount((prev) => Math.floor(prev / 10));
    setError(null);
  }, []);

  // Handle quick amount selection
  const handleQuickAmount = useCallback((value: number) => {
    setAmount(value);
    setError(null);
  }, []);

  const handleContinue = async () => {
    if (!isValid) return;

    setIsLoading(true);
    setError(null);

    try {
      await onboarding.createPortfolio(amount);
      dispatch(setInitialInvestment(amount));
      navigation.navigate('Success');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create portfolio';
      setError(errorMessage);
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

  const foundationAmount = Math.floor(amount * allocation.FOUNDATION);
  const growthAmount = Math.floor(amount * allocation.GROWTH);
  const upsideAmount = amount - foundationAmount - growthAmount;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background.primary} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Title */}
        <View style={styles.titleContainer}>
          <Text style={styles.title}>Fund your portfolio</Text>
          <Text style={styles.subtitle}>
            Enter the amount you want to invest
          </Text>
        </View>

        {/* Amount Display */}
        <AmountDisplay value={amount} currency="IRR" placeholder="0" />

        {/* Minimum amount hint */}
        <Text style={styles.hint}>
          Minimum: {formatNumber(MIN_INVESTMENT_AMOUNT)} IRR
        </Text>

        {/* Error message */}
        {error && <Text style={styles.errorText}>{error}</Text>}

        {/* Quick Amount Chips */}
        <QuickAmountChips
          amounts={QUICK_AMOUNTS}
          selectedAmount={amount}
          onSelect={handleQuickAmount}
        />

        {/* Allocation preview */}
        {amount > 0 && (
          <View style={styles.previewContainer}>
            <Text style={styles.previewTitle}>How it will be allocated:</Text>

            {/* Allocation bar */}
            <View style={styles.allocationBar}>
              <View
                style={[
                  styles.allocationSegment,
                  {
                    flex: allocation.FOUNDATION,
                    backgroundColor: COLORS.layers.foundation,
                  },
                ]}
              />
              <View
                style={[
                  styles.allocationSegment,
                  {
                    flex: allocation.GROWTH,
                    backgroundColor: COLORS.layers.growth,
                  },
                ]}
              />
              <View
                style={[
                  styles.allocationSegment,
                  {
                    flex: allocation.UPSIDE,
                    backgroundColor: COLORS.layers.upside,
                  },
                ]}
              />
            </View>

            {/* Allocation breakdown */}
            <View style={styles.previewItems}>
              <PreviewItem
                label="Foundation"
                amount={foundationAmount}
                color={COLORS.layers.foundation}
                percentage={Math.round(allocation.FOUNDATION * 100)}
              />
              <PreviewItem
                label="Growth"
                amount={growthAmount}
                color={COLORS.layers.growth}
                percentage={Math.round(allocation.GROWTH * 100)}
              />
              <PreviewItem
                label="Upside"
                amount={upsideAmount}
                color={COLORS.layers.upside}
                percentage={Math.round(allocation.UPSIDE * 100)}
              />
            </View>
          </View>
        )}
      </ScrollView>

      {/* NumericKeypad */}
      <NumericKeypad
        onPress={handleKeyPress}
        onBackspace={handleBackspace}
      />

      {/* CTA Button */}
      <View style={styles.footer}>
        <Button
          label="Create My Portfolio"
          variant="primary"
          size="lg"
          fullWidth
          onPress={handleContinue}
          loading={isLoading}
          disabled={!isValid}
        />
      </View>
    </SafeAreaView>
  );
};

// Preview Item Component
interface PreviewItemProps {
  label: string;
  amount: number;
  color: string;
  percentage: number;
}

const PreviewItem: React.FC<PreviewItemProps> = ({ label, amount, color, percentage }) => (
  <View style={styles.previewItem}>
    <View style={styles.previewItemLeft}>
      <View style={[styles.previewDot, { backgroundColor: color }]} />
      <Text style={styles.previewLabel}>{label}</Text>
      <Text style={[styles.previewPercentage, { color }]}>({percentage}%)</Text>
    </View>
    <Text style={styles.previewAmount}>{formatNumber(amount)} IRR</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background.primary,
  },
  header: {
    paddingHorizontal: LAYOUT.screenPaddingH,
    paddingTop: SPACING[2],
    paddingBottom: SPACING[2],
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.background.elevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backIcon: {
    fontSize: 20,
    color: COLORS.text.primary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: LAYOUT.screenPaddingH,
  },
  titleContainer: {
    marginBottom: SPACING[4],
  },
  title: {
    fontSize: TYPOGRAPHY.fontSize['2xl'],
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text.primary,
    marginBottom: SPACING[2],
  },
  subtitle: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text.secondary,
  },
  hint: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.muted,
    textAlign: 'center',
    marginBottom: SPACING[2],
  },
  errorText: {
    color: COLORS.semantic.error,
    fontSize: TYPOGRAPHY.fontSize.sm,
    textAlign: 'center',
    marginBottom: SPACING[2],
  },
  previewContainer: {
    backgroundColor: COLORS.background.elevated,
    borderRadius: RADIUS.xl,
    padding: SPACING[4],
    marginTop: SPACING[4],
  },
  previewTitle: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
    marginBottom: SPACING[3],
  },
  allocationBar: {
    height: 12,
    borderRadius: 6,
    flexDirection: 'row',
    overflow: 'hidden',
    marginBottom: SPACING[4],
  },
  allocationSegment: {
    height: '100%',
  },
  previewItems: {
    gap: SPACING[3],
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
    marginRight: SPACING[2],
  },
  previewLabel: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text.primary,
    marginRight: SPACING[1],
  },
  previewPercentage: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
  previewAmount: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.primary,
  },
  footer: {
    paddingHorizontal: LAYOUT.screenPaddingH,
    paddingBottom: LAYOUT.totalBottomSpace,
    paddingTop: SPACING[2],
  },
});

export default InitialFundingScreen;
