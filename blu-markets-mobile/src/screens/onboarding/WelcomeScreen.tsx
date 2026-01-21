/**
 * WelcomeScreen
 * Design System: Blu Markets
 * Target: iPhone 16 Pro (393 x 852)
 *
 * Hero screen with shield logo, tagline, features, and CTA
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { OnboardingStackParamList } from '../../navigation/types';
import { COLORS } from '../../constants/colors';
import { TYPOGRAPHY } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';
import { LAYOUT } from '../../constants/layout';
import { Button } from '../../components/common';
import { useAppDispatch } from '../../hooks/useStore';
import { enableDemoMode } from '../../store/slices/authSlice';
import { loadDemoData } from '../../store/slices/portfolioSlice';
import { setDefaultPrices } from '../../store/slices/pricesSlice';

type WelcomeScreenProps = {
  navigation: NativeStackNavigationProp<OnboardingStackParamList, 'Welcome'>;
};

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ navigation }) => {
  const dispatch = useAppDispatch();

  const handleDemoMode = () => {
    // Load demo data into Redux store
    dispatch(setDefaultPrices()); // Set sample prices
    dispatch(loadDemoData()); // Set sample portfolio
    dispatch(enableDemoMode()); // Skip auth and mark onboarding complete
    // RootNavigator will automatically show MainTabNavigator
  };
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background.primary} />

      <View style={styles.content}>
        {/* Logo with glow effect */}
        <View style={styles.logoContainer}>
          <View style={styles.logoGlow}>
            <View style={styles.logoCircle}>
              <Text style={styles.shieldIcon}>🛡️</Text>
            </View>
          </View>
          <Text style={styles.brandName}>Blu Markets</Text>
          <Text style={styles.tagline}>Markets, but mindful</Text>
        </View>

        {/* Features */}
        <View style={styles.featuresContainer}>
          <FeatureItem
            icon="🎯"
            title="Risk-first design"
            description="Every feature protects your future options"
          />
          <FeatureItem
            icon="📊"
            title="Layer-based portfolio"
            description="Foundation, Growth, and Upside - balanced for you"
          />
          <FeatureItem
            icon="💬"
            title="Full transparency"
            description="See exactly what happens with every action"
          />
        </View>
      </View>

      {/* Footer with CTA */}
      <View style={styles.footer}>
        <Button
          label="Get Started"
          variant="primary"
          size="lg"
          fullWidth
          onPress={() => navigation.navigate('PhoneInput')}
          icon={<Text style={styles.arrowIcon}>→</Text>}
          iconPosition="right"
        />

        {/* Demo Mode Button - for testing */}
        <TouchableOpacity
          style={styles.demoButton}
          onPress={handleDemoMode}
        >
          <Text style={styles.demoButtonText}>Try Demo</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.signInLink}
          onPress={() => navigation.navigate('PhoneInput')}
        >
          <Text style={styles.signInText}>
            Already have an account?{' '}
            <Text style={styles.signInHighlight}>Sign in</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

interface FeatureItemProps {
  icon: string;
  title: string;
  description: string;
}

const FeatureItem: React.FC<FeatureItemProps> = ({ icon, title, description }) => (
  <View style={styles.featureItem}>
    <View style={styles.featureIconContainer}>
      <Text style={styles.featureIcon}>{icon}</Text>
    </View>
    <View style={styles.featureTextContainer}>
      <Text style={styles.featureTitle}>{title}</Text>
      <Text style={styles.featureDescription}>{description}</Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background.primary,
  },
  content: {
    flex: 1,
    paddingHorizontal: LAYOUT.screenPaddingH,
    justifyContent: 'center',
  },

  // Logo Section
  logoContainer: {
    alignItems: 'center',
    marginBottom: SPACING[10],
  },
  logoGlow: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: `${COLORS.brand.primary}15`,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING[5],
    // Outer glow ring
    shadowColor: COLORS.brand.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.brand.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  shieldIcon: {
    fontSize: 40,
  },
  brandName: {
    fontSize: 32,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text.primary,
    marginBottom: SPACING[2],
  },
  tagline: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    color: COLORS.text.secondary,
  },

  // Features Section
  featuresContainer: {
    gap: SPACING[3],
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.background.elevated,
    padding: SPACING[4],
    borderRadius: RADIUS.lg,
  },
  featureIconContainer: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.background.input,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING[3],
  },
  featureIcon: {
    fontSize: 24,
  },
  featureTextContainer: {
    flex: 1,
  },
  featureTitle: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.primary,
    marginBottom: SPACING[1],
  },
  featureDescription: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
    lineHeight: TYPOGRAPHY.fontSize.sm * 1.4,
  },

  // Footer Section
  footer: {
    paddingHorizontal: LAYOUT.screenPaddingH,
    paddingBottom: LAYOUT.totalBottomSpace,
    paddingTop: SPACING[4],
  },
  arrowIcon: {
    fontSize: 18,
    color: COLORS.text.inverse,
  },
  demoButton: {
    marginTop: SPACING[3],
    paddingVertical: SPACING[3],
    paddingHorizontal: SPACING[6],
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  demoButtonText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.text.secondary,
  },
  signInLink: {
    alignItems: 'center',
    paddingVertical: SPACING[4],
  },
  signInText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.muted,
  },
  signInHighlight: {
    color: COLORS.brand.primary,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
});

export default WelcomeScreen;
