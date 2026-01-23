// Profile Screen
// Based on PRD Section 9.6 - Profile Tab
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  Switch,
  Linking,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { colors, typography, spacing, borderRadius } from '../../constants/theme';
import { useAppSelector, useAppDispatch } from '../../hooks/useStore';
import { logout } from '../../store/slices/authSlice';
import { resetPortfolio } from '../../store/slices/portfolioSlice';
import { resetOnboarding } from '../../store/slices/onboardingSlice';
import { RISK_PROFILE_NAMES } from '../../constants/business';
import { useBiometricAuth } from '../../hooks/useBiometricAuth';
import { clearAllState } from '../../utils/storage';

const ProfileScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const dispatch = useAppDispatch();
  const { phone } = useAppSelector((state) => state.auth);
  const { targetLayerPct } = useAppSelector((state) => state.portfolio);

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

  // Calculate risk score from target allocation (rough reverse calculation)
  const foundationPct = targetLayerPct.FOUNDATION;
  let riskScore = 5; // Default
  if (foundationPct >= 0.8) riskScore = 1;
  else if (foundationPct >= 0.65) riskScore = 3;
  else if (foundationPct >= 0.5) riskScore = 5;
  else if (foundationPct >= 0.4) riskScore = 7;
  else riskScore = 9;

  const profileNames = RISK_PROFILE_NAMES[riskScore];

  // Handle biometric toggle
  const handleBiometricToggle = async (value: boolean) => {
    if (value) {
      const success = await enableBiometric();
      if (!success) {
        Alert.alert('Error', 'Failed to enable biometric authentication');
      }
    } else {
      const success = await disableBiometric();
      if (!success) {
        Alert.alert('Error', 'Failed to disable biometric authentication');
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
            // Clear secure storage
            await clearAuthToken();
            // Clear AsyncStorage
            await clearAllState();
            // Clear Redux state
            dispatch(logout());
            dispatch(resetPortfolio());
          },
        },
      ],
      { cancelable: true }
    );
  };

  const handleRetakeQuiz = () => {
    Alert.alert(
      'Retake Risk Assessment',
      'This will update your investment profile based on new answers. Your current portfolio will be adjusted to match your new risk profile.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          onPress: () => {
            // Reset questionnaire state before retaking
            dispatch(resetOnboarding());
            navigation.navigate('RetakeQuiz');
          },
        },
      ],
      { cancelable: true }
    );
  };

  const handleLanguage = () => {
    Alert.alert(
      'Language / زبان',
      'Language settings coming soon.\n\nتنظیمات زبان به زودی.',
      [{ text: 'OK' }]
    );
  };

  const handleHelpCenter = () => {
    Alert.alert(
      'Help Center',
      'How can we help you?',
      [
        { text: 'Email Support', onPress: () => Linking.openURL('mailto:support@blumarkets.com?subject=Help Request') },
        { text: 'Telegram', onPress: () => Linking.openURL('https://t.me/BluMarketsSupport') },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const handleContactUs = () => {
    Alert.alert(
      'Contact Us',
      'Email: support@blumarkets.com\nTelegram: @BluMarketsSupport\nPhone: +98 21 1234 5678',
      [
        { text: 'Send Email', onPress: () => Linking.openURL('mailto:support@blumarkets.com') },
        { text: 'Close', style: 'cancel' },
      ]
    );
  };

  const handleTermsOfService = () => {
    Linking.openURL('https://blumarkets.com/terms');
  };

  const handlePrivacyPolicy = () => {
    Linking.openURL('https://blumarkets.com/privacy');
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.avatarContainer}>
            <Text style={styles.avatarText}>
              {phone ? phone.slice(-2) : '👤'}
            </Text>
          </View>
          <Text style={styles.phoneNumber}>{phone || 'No phone'}</Text>
          <Text style={styles.memberSince}>Member since January 2026</Text>
        </View>

        {/* Risk Profile Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Risk Profile</Text>
          <View style={styles.profileCard}>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{profileNames.en}</Text>
              <Text style={styles.profileNameFarsi}>{profileNames.fa}</Text>
              <Text style={styles.riskScore}>Risk Score: {riskScore}/10</Text>
            </View>
            <View style={styles.allocationPreview}>
              <AllocationPreviewBar
                foundation={targetLayerPct.FOUNDATION}
                growth={targetLayerPct.GROWTH}
                upside={targetLayerPct.UPSIDE}
              />
            </View>
            <TouchableOpacity
              style={styles.retakeButton}
              onPress={handleRetakeQuiz}
            >
              <Text style={styles.retakeButtonText}>Retake Quiz</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Settings Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Settings</Text>
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
                title={biometricType || 'Biometric Auth'}
                value={biometricEnabled}
                onToggle={handleBiometricToggle}
              />
            )}
            <SettingItem
              icon="🌐"
              title="Language"
              value="English"
              onPress={handleLanguage}
            />
          </View>
        </View>

        {/* Support Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Support</Text>
          <View style={styles.settingsList}>
            <SettingItem
              icon="❓"
              title="Help Center"
              onPress={handleHelpCenter}
            />
            <SettingItem
              icon="📧"
              title="Contact Us"
              onPress={handleContactUs}
            />
            <SettingItem
              icon="📄"
              title="Terms of Service"
              onPress={handleTermsOfService}
            />
            <SettingItem
              icon="🔒"
              title="Privacy Policy"
              onPress={handlePrivacyPolicy}
            />
          </View>
        </View>

        {/* App Info */}
        <View style={styles.appInfo}>
          <Text style={styles.appVersion}>Blu Markets v1.0.0</Text>
        </View>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutButtonText}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

// Setting Item Component
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

// Setting Item with Switch Component
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
      trackColor={{ false: colors.surfaceDark, true: `${colors.primary}60` }}
      thumbColor={value ? colors.primary : colors.textSecondary}
    />
  </View>
);

// Allocation Preview Bar
const AllocationPreviewBar: React.FC<{
  foundation: number;
  growth: number;
  upside: number;
}> = ({ foundation, growth, upside }) => (
  <View style={styles.allocationBar}>
    <View style={[styles.allocationSegment, styles.foundationSegment, { flex: foundation }]} />
    <View style={[styles.allocationSegment, styles.growthSegment, { flex: growth }]} />
    <View style={[styles.allocationSegment, styles.upsideSegment, { flex: upside }]} />
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgDark,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing[4],
    paddingBottom: spacing[8],
  },
  header: {
    alignItems: 'center',
    paddingVertical: spacing[6],
    borderBottomWidth: 1,
    borderBottomColor: colors.borderDark,
    marginBottom: spacing[6],
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing[4],
  },
  avatarText: {
    fontSize: 32,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimaryDark,
  },
  phoneNumber: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimaryDark,
    marginBottom: spacing[1],
  },
  memberSince: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
  },
  section: {
    marginBottom: spacing[6],
  },
  sectionTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textSecondary,
    marginBottom: spacing[3],
    textTransform: 'uppercase',
  },
  profileCard: {
    backgroundColor: colors.cardDark,
    borderRadius: borderRadius.lg,
    padding: spacing[4],
  },
  profileInfo: {
    marginBottom: spacing[4],
  },
  profileName: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimaryDark,
    marginBottom: spacing[1],
  },
  profileNameFarsi: {
    fontSize: typography.fontSize.base,
    color: colors.textSecondary,
    marginBottom: spacing[2],
  },
  riskScore: {
    fontSize: typography.fontSize.sm,
    color: colors.primary,
    fontWeight: typography.fontWeight.medium,
  },
  allocationPreview: {
    marginBottom: spacing[4],
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
  foundationSegment: {
    backgroundColor: colors.layerFoundation,
  },
  growthSegment: {
    backgroundColor: colors.layerGrowth,
  },
  upsideSegment: {
    backgroundColor: colors.layerUpside,
  },
  retakeButton: {
    backgroundColor: colors.surfaceDark,
    borderRadius: borderRadius.default,
    padding: spacing[3],
    alignItems: 'center',
  },
  retakeButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.primary,
  },
  settingsList: {
    backgroundColor: colors.cardDark,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: colors.borderDark,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingIcon: {
    fontSize: 20,
    marginRight: spacing[3],
  },
  settingTitle: {
    fontSize: typography.fontSize.base,
    color: colors.textPrimaryDark,
  },
  settingRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingValue: {
    fontSize: typography.fontSize.base,
    color: colors.textSecondary,
    marginRight: spacing[2],
  },
  settingArrow: {
    fontSize: 20,
    color: colors.textSecondary,
  },
  appInfo: {
    alignItems: 'center',
    marginBottom: spacing[6],
  },
  appVersion: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
  },
  logoutButton: {
    backgroundColor: `${colors.error}15`,
    borderRadius: borderRadius.default,
    padding: spacing[4],
    alignItems: 'center',
    borderWidth: 1,
    borderColor: `${colors.error}30`,
  },
  logoutButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.error,
  },
});

export default ProfileScreen;
