// Profile Screen
// Based on PRD Section 9.6 - Profile Tab
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../../constants/colors';
import { TYPOGRAPHY } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';
import { useAppSelector, useAppDispatch } from '../../hooks/useStore';
import { logout } from '../../store/slices/authSlice';
import { resetPortfolio } from '../../store/slices/portfolioSlice';
import { RISK_PROFILE_NAMES } from '../../constants/business';
import { useBiometricAuth } from '../../hooks/useBiometricAuth';
import { clearAllState } from '../../utils/storage';

const ProfileScreen: React.FC = () => {
  const dispatch = useAppDispatch();
  const { phone } = useAppSelector((state) => state.auth);
  const portfolioState = useAppSelector((state) => state.portfolio);
  const onboardingState = useAppSelector((state) => state.onboarding);

  // Use stored risk score from portfolio state or onboarding state
  const targetLayerPct = portfolioState?.targetLayerPct || { FOUNDATION: 0.5, GROWTH: 0.35, UPSIDE: 0.15 };
  const storedRiskScore = portfolioState?.riskScore || onboardingState?.riskProfile?.score;

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

  // Use stored risk score (prefer portfolio, fallback to onboarding, then default)
  const riskScore = storedRiskScore || 5;

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
      'Retake Risk Quiz',
      'This will update your risk profile and target allocation. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          onPress: () => {
            // TODO: Navigate to questionnaire
            console.log('Retake quiz');
          },
        },
      ],
      { cancelable: true }
    );
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
              onPress={() => {}}
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
              onPress={() => {}}
            />
            <SettingItem
              icon="📧"
              title="Contact Us"
              onPress={() => {}}
            />
            <SettingItem
              icon="📄"
              title="Terms of Service"
              onPress={() => {}}
            />
            <SettingItem
              icon="🔒"
              title="Privacy Policy"
              onPress={() => {}}
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
      trackColor={{ false: COLORS.background.surface, true: `${COLORS.brand.primary}60` }}
      thumbColor={value ? COLORS.brand.primary : COLORS.text.secondary}
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
    backgroundColor: COLORS.background.primary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING[4],
    paddingBottom: SPACING[8],
  },
  header: {
    alignItems: 'center',
    paddingVertical: SPACING[6],
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    marginBottom: SPACING[6],
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.brand.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING[4],
  },
  avatarText: {
    fontSize: 32,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text.inverse,
  },
  phoneNumber: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.primary,
    marginBottom: SPACING[1],
  },
  memberSince: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
  },
  section: {
    marginBottom: SPACING[6],
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.secondary,
    marginBottom: SPACING[3],
    textTransform: 'uppercase',
  },
  profileCard: {
    backgroundColor: COLORS.background.elevated,
    borderRadius: RADIUS.xl,
    padding: SPACING[4],
  },
  profileInfo: {
    marginBottom: SPACING[4],
  },
  profileName: {
    fontSize: TYPOGRAPHY.fontSize.xl,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text.primary,
    marginBottom: SPACING[1],
  },
  profileNameFarsi: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text.secondary,
    marginBottom: SPACING[2],
  },
  riskScore: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.brand.primary,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
  allocationPreview: {
    marginBottom: SPACING[4],
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
    backgroundColor: COLORS.layers.foundation,
  },
  growthSegment: {
    backgroundColor: COLORS.layers.growth,
  },
  upsideSegment: {
    backgroundColor: COLORS.layers.upside,
  },
  retakeButton: {
    backgroundColor: COLORS.background.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING[3],
    alignItems: 'center',
  },
  retakeButtonText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.brand.primary,
  },
  settingsList: {
    backgroundColor: COLORS.background.elevated,
    borderRadius: RADIUS.xl,
    overflow: 'hidden',
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING[4],
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingIcon: {
    fontSize: 20,
    marginRight: SPACING[3],
  },
  settingTitle: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text.primary,
  },
  settingRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingValue: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text.secondary,
    marginRight: SPACING[2],
  },
  settingArrow: {
    fontSize: 20,
    color: COLORS.text.secondary,
  },
  appInfo: {
    alignItems: 'center',
    marginBottom: SPACING[6],
  },
  appVersion: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
  },
  logoutButton: {
    backgroundColor: COLORS.semanticBg.error,
    borderRadius: RADIUS.lg,
    padding: SPACING[4],
    alignItems: 'center',
    borderWidth: 1,
    borderColor: `${COLORS.semantic.error}30`,
  },
  logoutButtonText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.semantic.error,
  },
});

export default ProfileScreen;
