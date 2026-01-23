/**
 * InitialFundingScreen
 * Design System: Blu Markets
 * Target: iPhone 16 Pro (393 x 852)
 *
 * Layout Fix: Quick amount buttons now visible immediately (no scroll needed)
 * All elements fit on screen without scrolling
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { OnboardingStackParamList } from '../../navigation/types';
import { COLORS } from '../../constants/colors';
import { TYPOGRAPHY } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';
import { useAppDispatch, useAppSelector } from '../../hooks/useStore';
import { setInitialInvestment } from '../../store/slices/onboardingSlice';
import { MIN_INVESTMENT_AMOUNT } from '../../constants/business';
import { onboarding } from '../../services/api';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const IS_SMALL_DEVICE = SCREEN_HEIGHT < 700;

type InitialFundingScreenProps = {
  navigation: NativeStackNavigationProp<OnboardingStackParamList, 'InitialFunding'>;
};

// Quick amount options with 50M added
const QUICK_AMOUNTS = [
  { label: '1M', value: 1_000_000 },
  { label: '5M', value: 5_000_000 },
  { label: '10M', value: 10_000_000 },
  { label: '25M', value: 25_000_000 },
  { label: '50M', value: 50_000_000 },
];

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

      {/* Title Section - Compact */}
      <View style={styles.titleSection}>
        <Text style={styles.title}>Fund your portfolio</Text>
        <Text style={styles.subtitle}>Enter the amount you want to invest</Text>
      </View>

      {/* Amount Display - Compact */}
      <View style={styles.amountSection}>
        <Text style={styles.amountText}>{formatNumber(amount)}</Text>
        <Text style={styles.currencyLabel}>IRR</Text>
        <Text style={styles.minimumText}>Minimum: {formatNumber(MIN_INVESTMENT_AMOUNT)} IRR</Text>
        {error && <Text style={styles.errorText}>{error}</Text>}
      </View>

      {/* Quick Amount Buttons - NOW VISIBLE IMMEDIATELY */}
      <View style={styles.quickAmountsContainer}>
        {QUICK_AMOUNTS.map((item) => (
          <TouchableOpacity
            key={item.label}
            style={[
              styles.quickAmountButton,
              amount === item.value && styles.quickAmountButtonActive,
            ]}
            onPress={() => handleQuickAmount(item.value)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.quickAmountText,
                amount === item.value && styles.quickAmountTextActive,
              ]}
            >
              {item.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Number Pad - Compact sizing */}
      <View style={styles.numpadContainer}>
        <View style={styles.numpadRow}>
          {['1', '2', '3'].map((num) => (
            <TouchableOpacity
              key={num}
              style={styles.numpadButton}
              onPress={() => handleKeyPress(num)}
              activeOpacity={0.7}
            >
              <Text style={styles.numpadText}>{num}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.numpadRow}>
          {['4', '5', '6'].map((num) => (
            <TouchableOpacity
              key={num}
              style={styles.numpadButton}
              onPress={() => handleKeyPress(num)}
              activeOpacity={0.7}
            >
              <Text style={styles.numpadText}>{num}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.numpadRow}>
          {['7', '8', '9'].map((num) => (
            <TouchableOpacity
              key={num}
              style={styles.numpadButton}
              onPress={() => handleKeyPress(num)}
              activeOpacity={0.7}
            >
              <Text style={styles.numpadText}>{num}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.numpadRow}>
          <View style={styles.numpadButton} />
          <TouchableOpacity
            style={styles.numpadButton}
            onPress={() => handleKeyPress('0')}
            activeOpacity={0.7}
          >
            <Text style={styles.numpadText}>0</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.numpadButton}
            onPress={handleBackspace}
            activeOpacity={0.7}
          >
            <Text style={styles.numpadText}>⌫</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Create Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.createButton,
            (!isValid || isLoading) && styles.createButtonDisabled,
          ]}
          onPress={handleContinue}
          disabled={!isValid || isLoading}
          activeOpacity={0.8}
        >
          <Text style={styles.createButtonText}>
            {isLoading ? 'Creating...' : 'Create My Portfolio'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background.primary,
  },

  // Header
  header: {
    paddingHorizontal: SPACING[4],
    paddingTop: SPACING[2],
    paddingBottom: SPACING[2],
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.background.elevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backIcon: {
    fontSize: 20,
    color: COLORS.text.primary,
  },

  // Title Section - Compact
  titleSection: {
    paddingHorizontal: SPACING[5],
    paddingBottom: SPACING[3],
  },
  title: {
    fontSize: IS_SMALL_DEVICE ? 24 : 28,
    fontWeight: '700',
    color: COLORS.text.primary,
    marginBottom: SPACING[1],
  },
  subtitle: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
  },

  // Amount Section - Compact
  amountSection: {
    alignItems: 'center',
    paddingVertical: SPACING[3],
  },
  amountText: {
    fontSize: IS_SMALL_DEVICE ? 40 : 48,
    fontWeight: '700',
    color: COLORS.text.primary,
  },
  currencyLabel: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text.muted,
    marginTop: SPACING[1],
  },
  minimumText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
    marginTop: SPACING[2],
  },
  errorText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.semantic.error,
    marginTop: SPACING[2],
  },

  // Quick Amounts - KEY FIX: Positioned prominently
  quickAmountsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingHorizontal: SPACING[4],
    paddingVertical: SPACING[3],
    gap: SPACING[2],
  },
  quickAmountButton: {
    paddingHorizontal: SPACING[3],
    paddingVertical: SPACING[2],
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.background.elevated,
    minWidth: 50,
    alignItems: 'center',
  },
  quickAmountButtonActive: {
    backgroundColor: COLORS.brand.primary,
  },
  quickAmountText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: '600',
    color: COLORS.text.secondary,
  },
  quickAmountTextActive: {
    color: COLORS.text.inverse,
  },

  // Numpad - Compact sizing
  numpadContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: SPACING[6],
  },
  numpadRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: IS_SMALL_DEVICE ? SPACING[2] : SPACING[3],
  },
  numpadButton: {
    width: IS_SMALL_DEVICE ? 70 : 80,
    height: IS_SMALL_DEVICE ? 55 : 65,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.background.elevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  numpadText: {
    fontSize: IS_SMALL_DEVICE ? 24 : 28,
    fontWeight: '500',
    color: COLORS.text.primary,
  },

  // Footer
  footer: {
    paddingHorizontal: SPACING[5],
    paddingBottom: SPACING[6],
    paddingTop: SPACING[2],
  },
  createButton: {
    backgroundColor: COLORS.brand.primary,
    paddingVertical: SPACING[4],
    borderRadius: RADIUS.full,
    alignItems: 'center',
  },
  createButtonDisabled: {
    backgroundColor: COLORS.text.muted,
    opacity: 0.5,
  },
  createButtonText: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: '600',
    color: COLORS.text.inverse,
  },
});

export default InitialFundingScreen;
