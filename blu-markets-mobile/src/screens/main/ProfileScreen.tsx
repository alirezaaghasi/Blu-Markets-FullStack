/**
 * Profile Screen
 *
 * Redesigned to comply with the Blu Markets Constitution
 * (Guidelines for Communicating Risk Profile)
 *
 * Key principles:
 * - Show PREFERENCES, not PERSONALITY
 * - Use DIMENSIONAL language, not LABELS
 * - Attribute to THE SYSTEM, not TRUTH
 * - Enable CHANGE, not LOCK-IN
 *
 * "The profile explains the portfolio. The portfolio defines the experience.
 *  The user defines the future."
 */

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Switch,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { COLORS } from '../../constants/colors';
import { TYPOGRAPHY } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';
import { useAppSelector, useAppDispatch } from '../../hooks/useStore';
import { logout } from '../../store/slices/authSlice';
import { resetPortfolio } from '../../store/slices/portfolioSlice';
import { useBiometricAuth } from '../../hooks/useBiometricAuth';
import { clearAllState } from '../../utils/storage';
import type { RootStackParamList } from '../../navigation/types';
import { ALERTS } from '../../constants/messages';

// =============================================================================
// TYPES
// =============================================================================

interface RiskDimensions {
  stabilityPreference: string;
  volatilityTolerance: string;
  drawdownTolerance: string;
  timeHorizon: string;
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Mask phone number for privacy
 * "+989123456789" → "+98 912 •••• ••89"
 */
function maskPhoneNumber(phone: string): string {
  if (!phone) return '';

  const digits = phone.replace(/\D/g, '');
  if (digits.length < 10) return phone;

  const countryCode = '+98';
  const firstPart = digits.slice(2, 5);
  const lastTwo = digits.slice(-2);
  return `${countryCode} ${firstPart} •••• ••${lastTwo}`;
}

/**
 * Map risk score (1-10) to dimensional preferences
 * Constitution §3.1: "Show as range, not label"
 */
function mapRiskScoreToDimensions(riskScore: number): RiskDimensions {
  if (riskScore <= 2) {
    return {
      stabilityPreference: 'Very High',
      volatilityTolerance: 'Very Low',
      drawdownTolerance: 'Very Limited',
      timeHorizon: 'Short',
    };
  }
  if (riskScore <= 4) {
    return {
      stabilityPreference: 'High',
      volatilityTolerance: 'Low',
      drawdownTolerance: 'Limited',
      timeHorizon: 'Short-Medium',
    };
  }
  if (riskScore <= 6) {
    return {
      stabilityPreference: 'Medium',
      volatilityTolerance: 'Medium',
      drawdownTolerance: 'Moderate',
      timeHorizon: 'Medium',
    };
  }
  if (riskScore <= 8) {
    return {
      stabilityPreference: 'Low',
      volatilityTolerance: 'High',
      drawdownTolerance: 'Extended',
      timeHorizon: 'Medium-Long',
    };
  }
  // riskScore 9-10
  return {
    stabilityPreference: 'Very Low',
    volatilityTolerance: 'Very High',
    drawdownTolerance: 'High',
    timeHorizon: 'Long',
  };
}

/**
 * Format member since date
 */
function formatMemberSince(): string {
  const now = new Date();
  const month = now.toLocaleString('en-US', { month: 'long' });
  const year = now.getFullYear();
  return `${month} ${year}`;
}

// =============================================================================
// COMPONENTS
// =============================================================================

/**
 * Dimension Row - displays a single preference dimension
 */
const DimensionRow: React.FC<{
  label: string;
  value: string;
  isLast?: boolean;
}> = ({ label, value, isLast = false }) => (
  <View style={[styles.dimensionRow, isLast && styles.dimensionRowLast]}>
    <Text style={styles.dimensionLabel}>{label}</Text>
    <Text style={styles.dimensionValue}>{value}</Text>
  </View>
);

/**
 * Setting Item Component
 */
const SettingItem: React.FC<{
  icon: string;
  title: string;
  value?: string;
  onPress: () => void;
}> = ({ icon, title, value, onPress }) => (
  <TouchableOpacity style={styles.settingItem} onPress={onPress} activeOpacity={0.7}>
    <View style={styles.settingLeft}>
      <Text style={styles.settingIcon}>{icon}</Text>
      <Text style={styles.settingTitle}>{title}</Text>
    </View>
    <View style={styles.settingRight}>
      {value && <Text style={styles.settingValue}>{value}</Text>}
      <Text style={styles.settingArrow}>›</Text>
    </View>
  </TouchableOpacity>
);

/**
 * Setting Item with Switch Component
 */
const SettingItemWithSwitch: React.FC<{
  icon: string;
  title: string;
  value: boolean;
  onToggle: (value: boolean) => void;
}> = ({ icon, title, value, onToggle }) => (
  <View style={styles.settingItem}>
    <View style={styles.settingLeft}>
      <Text style={styles.settingIcon}>{icon}</Text>
      <Text style={styles.settingTitle}>{title}</Text>
    </View>
    <Switch
      value={value}
      onValueChange={onToggle}
      trackColor={{ false: COLORS.background.surface, true: `${COLORS.brand.primary}60` }}
      thumbColor={value ? COLORS.brand.primary : COLORS.text.secondary}
    />
  </View>
);

// =============================================================================
// MAIN COMPONENT
// =============================================================================

const ProfileScreen: React.FC = () => {
  const dispatch = useAppDispatch();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { phone } = useAppSelector((state) => state.auth);
  // Granular selector - only re-render when riskScore changes, not entire portfolio
  const portfolioRiskScore = useAppSelector((state) => state.portfolio.riskScore);
  const onboardingRiskScore = useAppSelector((state) => state.onboarding?.riskProfile?.score);

  // Use stored risk score from portfolio state or onboarding state
  const storedRiskScore = portfolioRiskScore || onboardingRiskScore;
  const riskScore = storedRiskScore || 5;

  // Biometric authentication
  const {
    isAvailable: biometricAvailable,
    isEnabled: biometricEnabled,
    biometricType,
    enableBiometric,
    disableBiometric,
    clearAuthToken,
  } = useBiometricAuth();

  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  // Map risk score to dimensional preferences (Constitution compliance)
  const dimensions = useMemo(() => mapRiskScoreToDimensions(riskScore), [riskScore]);

  // ==========================================================================
  // HANDLERS
  // ==========================================================================

  const handleBiometricToggle = async (value: boolean) => {
    if (value) {
      const success = await enableBiometric();
      if (!success) {
        Alert.alert(ALERTS.profile.biometricEnableError.title, ALERTS.profile.biometricEnableError.message);
      }
    } else {
      const success = await disableBiometric();
      if (!success) {
        Alert.alert(ALERTS.profile.biometricDisableError.title, ALERTS.profile.biometricDisableError.message);
      }
    }
  };

  const handleLogout = async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            await clearAuthToken();
            await clearAllState();
            dispatch(logout());
            dispatch(resetPortfolio());
          },
        },
      ],
      { cancelable: true }
    );
  };

  /**
   * Handle updating risk preferences
   * Constitution: "Update" implies change is normal, not "Retake" which implies test/verdict
   */
  const handleUpdateRiskPreferences = () => {
    Alert.alert(
      'Update Risk Preferences',
      'You can update your preferences anytime. This will adjust your target allocation.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          onPress: () => {
            navigation.navigate('RetakeQuiz');
          },
        },
      ],
      { cancelable: true }
    );
  };

  const handleLanguagePress = () => {
    Alert.alert('Coming Soon', 'Language settings will be available in a future update.');
  };

  const handleHelpCenterPress = () => {
    Linking.openURL('https://blumarkets.com/help').catch(() => {
      Linking.openURL('mailto:support@blumarkets.com?subject=Help Request');
    });
  };

  const handleContactUsPress = () => {
    Alert.alert(
      'Contact Us',
      'Email: support@blumarkets.com\nPhone: +98 21 1234 5678\nTelegram: @BluMarketsSupport',
      [
        { text: 'Email', onPress: () => Linking.openURL('mailto:support@blumarkets.com') },
        { text: 'Close', style: 'cancel' },
      ]
    );
  };

  const handleTermsPress = () => {
    Linking.openURL('https://blumarkets.com/terms');
  };

  const handlePrivacyPress = () => {
    Linking.openURL('https://blumarkets.com/privacy');
  };

  // ==========================================================================
  // RENDER
  // ==========================================================================

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ================================================================ */}
        {/* USER INFO SECTION */}
        {/* ================================================================ */}
        <View style={styles.userSection}>
          <View style={styles.avatarContainer}>
            <Text style={styles.avatarIcon}>👤</Text>
          </View>
          <Text style={styles.phoneNumber}>
            {phone ? maskPhoneNumber(phone) : 'No phone'}
          </Text>
          <Text style={styles.memberSince}>Member since {formatMemberSince()}</Text>
        </View>

        <View style={styles.divider} />

        {/* ================================================================ */}
        {/* RISK PREFERENCES SECTION */}
        {/* Constitution: Use "PREFERENCES" not "PROFILE" */}
        {/* ================================================================ */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>RISK PREFERENCES</Text>

          {/* Attribution line - Constitution §2.1: "Always Attribute to the System" */}
          <Text style={styles.attributionText}>
            Based on your answers, the system interprets your preferences as:
          </Text>

          {/* Dimensions Card - Constitution §3.1: Show dimensions, not labels */}
          <View style={styles.dimensionsCard}>
            <DimensionRow
              label="Stability preference"
              value={dimensions.stabilityPreference}
            />
            <DimensionRow
              label="Volatility tolerance"
              value={dimensions.volatilityTolerance}
            />
            <DimensionRow
              label="Drawdown tolerance"
              value={dimensions.drawdownTolerance}
            />
            <DimensionRow
              label="Time horizon"
              value={dimensions.timeHorizon}
              isLast
            />
          </View>

          {/* Update Button - Constitution: "Update" not "Retake Quiz" */}
          <TouchableOpacity
            style={styles.updateButton}
            onPress={handleUpdateRiskPreferences}
            activeOpacity={0.8}
          >
            <Text style={styles.updateButtonText}>Update Risk Preferences</Text>
          </TouchableOpacity>

          {/* Disclaimer - Constitution §4: Required statements */}
          <Text style={styles.disclaimerText}>
            You can change this anytime.{'\n'}
            Your portfolio is the source of truth.
          </Text>
        </View>

        <View style={styles.divider} />

        {/* ================================================================ */}
        {/* SETTINGS SECTION */}
        {/* ================================================================ */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>SETTINGS</Text>
          <View style={styles.settingsList}>
            <SettingItemWithSwitch
              icon="🔔"
              title="Notifications"
              value={notificationsEnabled}
              onToggle={setNotificationsEnabled}
            />
            {biometricAvailable && (
              <SettingItemWithSwitch
                icon="🔐"
                title={biometricType || 'Face ID'}
                value={biometricEnabled}
                onToggle={handleBiometricToggle}
              />
            )}
            <SettingItem
              icon="🌐"
              title="Language"
              value="English"
              onPress={handleLanguagePress}
            />
          </View>
        </View>

        <View style={styles.divider} />

        {/* ================================================================ */}
        {/* SUPPORT SECTION */}
        {/* ================================================================ */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>SUPPORT</Text>
          <View style={styles.settingsList}>
            <SettingItem
              icon="❓"
              title="Help Center"
              onPress={handleHelpCenterPress}
            />
            <SettingItem
              icon="📧"
              title="Contact Us"
              onPress={handleContactUsPress}
            />
            <SettingItem
              icon="📄"
              title="Terms of Service"
              onPress={handleTermsPress}
            />
            <SettingItem
              icon="🔒"
              title="Privacy Policy"
              onPress={handlePrivacyPress}
            />
          </View>
        </View>

        {/* App Info */}
        <View style={styles.appInfo}>
          <Text style={styles.appVersion}>Blu Markets v1.0.0</Text>
        </View>

        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutButtonText}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background.primary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: SPACING[8],
  },

  // User Section
  userSection: {
    alignItems: 'center',
    paddingVertical: SPACING[6],
    paddingHorizontal: SPACING[4],
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.brand.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING[3],
  },
  avatarIcon: {
    fontSize: 36,
  },
  phoneNumber: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: '600',
    color: COLORS.text.primary,
    marginBottom: SPACING[1],
  },
  memberSince: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
  },

  // Divider
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginHorizontal: SPACING[4],
  },

  // Section
  section: {
    paddingVertical: SPACING[5],
    paddingHorizontal: SPACING[4],
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: '600',
    color: COLORS.text.muted,
    letterSpacing: 1,
    marginBottom: SPACING[3],
  },

  // Attribution Text (Constitution §2.1)
  attributionText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
    marginBottom: SPACING[4],
    lineHeight: 20,
  },

  // Dimensions Card
  dimensionsCard: {
    backgroundColor: COLORS.background.elevated,
    borderRadius: RADIUS.lg,
    padding: SPACING[4],
    marginBottom: SPACING[4],
  },
  dimensionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING[3],
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  dimensionRowLast: {
    borderBottomWidth: 0,
    paddingBottom: 0,
  },
  dimensionLabel: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
  },
  dimensionValue: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: '600',
    color: COLORS.text.primary,
  },

  // Update Button
  updateButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: COLORS.brand.primary,
    paddingVertical: SPACING[3],
    paddingHorizontal: SPACING[4],
    borderRadius: RADIUS.full,
    alignItems: 'center',
    marginBottom: SPACING[4],
  },
  updateButtonText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: '600',
    color: COLORS.brand.primary,
  },

  // Disclaimer (Constitution §4)
  disclaimerText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.text.muted,
    textAlign: 'center',
    lineHeight: 18,
  },

  // Settings List
  settingsList: {
    backgroundColor: COLORS.background.elevated,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING[4],
    paddingHorizontal: SPACING[4],
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING[3],
  },
  settingIcon: {
    fontSize: 20,
  },
  settingTitle: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text.primary,
  },
  settingRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING[2],
  },
  settingValue: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text.secondary,
  },
  settingArrow: {
    fontSize: 20,
    color: COLORS.text.muted,
  },

  // App Info
  appInfo: {
    alignItems: 'center',
    paddingVertical: SPACING[4],
  },
  appVersion: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.text.muted,
  },

  // Logout Button
  logoutButton: {
    marginHorizontal: SPACING[4],
    backgroundColor: COLORS.semanticBg?.error || `${COLORS.semantic.error}10`,
    borderRadius: RADIUS.lg,
    padding: SPACING[4],
    alignItems: 'center',
    borderWidth: 1,
    borderColor: `${COLORS.semantic.error}30`,
  },
  logoutButtonText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: '600',
    color: COLORS.semantic.error,
  },
});

export default ProfileScreen;
