/**
 * WelcomeScreen
 * Design System: Blu Markets
 * Target: iPhone 16 Pro (393 x 852)
 *
 * Simplified hero screen with Blu logo, tagline, and CTA buttons
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { OnboardingStackParamList } from '../../navigation/types';
import { COLORS } from '../../constants/colors';
import { TYPOGRAPHY } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';
import { LAYOUT } from '../../constants/layout';
import { BluLogo } from '../../components/BluLogo';
import { useAppDispatch } from '../../hooks/useStore';
import { enableDemoMode } from '../../store/slices/authSlice';
import { loadDemoData, resetPortfolio } from '../../store/slices/portfolioSlice';
import { setDefaultPrices } from '../../store/slices/pricesSlice';
import { clearAllState } from '../../utils/storage';

type WelcomeScreenProps = {
  navigation: NativeStackNavigationProp<OnboardingStackParamList, 'Welcome'>;
};

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ navigation }) => {
  const dispatch = useAppDispatch();

  const handleGetStarted = () => {
    navigation.navigate('PhoneInput');
  };

  const handleDemoMode = async () => {
    // Clear any persisted state first to ensure fresh demo data
    await clearAllState();
    // Reset portfolio state before loading demo data
    dispatch(resetPortfolio());
    // Load demo data into Redux store
    dispatch(setDefaultPrices()); // Set sample prices
    dispatch(loadDemoData()); // Set sample portfolio with correct layer assignments
    dispatch(enableDemoMode()); // Skip auth and mark onboarding complete
    // RootNavigator will automatically show MainTabNavigator
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background.primary} />

      <View style={styles.content}>
        {/* Logo */}
        <View style={styles.logoContainer}>
          <BluLogo size={100} borderRadius={24} />
        </View>

        {/* Title & Tagline */}
        <Text style={styles.title}>Blu Markets</Text>
        <Text style={styles.tagline}>Markets, but mindful</Text>
      </View>

      {/* Buttons */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={handleGetStarted}
          activeOpacity={0.8}
        >
          <Text style={styles.primaryButtonText}>Get Started</Text>
          <Text style={styles.primaryButtonArrow}>→</Text>
        </TouchableOpacity>

        {/* SECURITY: Demo mode button only visible in development builds */}
        {__DEV__ && (
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={handleDemoMode}
            activeOpacity={0.8}
          >
            <Text style={styles.secondaryButtonText}>Try Demo</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background.primary,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING[6],
  },
  logoContainer: {
    marginBottom: SPACING[8],
  },
  title: {
    fontSize: 36,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text.primary,
    marginBottom: SPACING[2],
    textAlign: 'center',
  },
  tagline: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    color: COLORS.text.secondary,
    textAlign: 'center',
  },
  buttonContainer: {
    paddingHorizontal: LAYOUT.screenPaddingH,
    paddingBottom: LAYOUT.totalBottomSpace,
    gap: SPACING[3],
  },
  primaryButton: {
    backgroundColor: COLORS.brand.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING[4],
    borderRadius: RADIUS.full,
  },
  primaryButtonText: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.inverse,
    marginRight: SPACING[2],
  },
  primaryButtonArrow: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    color: COLORS.text.inverse,
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING[4],
    borderRadius: RADIUS.full,
  },
  secondaryButtonText: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.primary,
  },
});

export default WelcomeScreen;
