// Consent Screen
// Based on PRD Section 14.3 - Consent Sentences in Farsi
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { OnboardingStackParamList } from '../../navigation/types';
import { colors, typography, spacing, borderRadius } from '../../constants/theme';
import { useAppDispatch, useAppSelector } from '../../hooks/useStore';
import { setConsent } from '../../store/slices/onboardingSlice';

type ConsentScreenProps = {
  navigation: NativeStackNavigationProp<OnboardingStackParamList, 'Consent'>;
};

// Consent items with Farsi and English
const CONSENT_ITEMS = [
  {
    key: 'riskAcknowledged' as const,
    farsi: 'متوجه ریسک این سرمایه‌گذاری هستم',
    english: 'I understand the risk of this investment',
  },
  {
    key: 'lossAcknowledged' as const,
    farsi: 'ممکنه بخشی یا تمام سرمایه‌ام رو از دست بدم',
    english: 'I may lose some or all of my investment',
  },
  {
    key: 'noGuaranteeAcknowledged' as const,
    farsi: 'هیچ تضمینی برای سود وجود نداره',
    english: 'There is no guarantee of returns',
  },
];

const ConsentScreen: React.FC<ConsentScreenProps> = ({ navigation }) => {
  const dispatch = useAppDispatch();
  const consents = useAppSelector((state) => state.onboarding.consents);

  const handleToggleConsent = (key: keyof typeof consents) => {
    dispatch(setConsent({ key, value: !consents[key] }));
  };

  const allConsented =
    consents.riskAcknowledged &&
    consents.lossAcknowledged &&
    consents.noGuaranteeAcknowledged;

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
          <Text style={styles.title}>Before you continue</Text>
          <Text style={styles.subtitle}>
            Please read and acknowledge the following
          </Text>
        </View>

        {/* Consent checkboxes */}
        <View style={styles.consentContainer}>
          {CONSENT_ITEMS.map((item) => (
            <TouchableOpacity
              key={item.key}
              style={styles.consentItem}
              onPress={() => handleToggleConsent(item.key)}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.checkbox,
                  consents[item.key] && styles.checkboxChecked,
                ]}
              >
                {consents[item.key] && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <View style={styles.consentTextContainer}>
                <Text style={styles.consentTextFarsi}>{item.farsi}</Text>
                <Text style={styles.consentTextEnglish}>{item.english}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Info box */}
        <View style={styles.infoBox}>
          <Text style={styles.infoIcon}>ℹ️</Text>
          <Text style={styles.infoText}>
            Investment involves risk. Past performance does not guarantee future
            results. Only invest money you can afford to lose.
          </Text>
        </View>
      </View>

      {/* CTA Button */}
      <View style={styles.footer}>
        {/* Final confirmation in Farsi */}
        {allConsented && (
          <Text style={styles.finalConsentFarsi}>
            متوجه ریسک این سبد دارایی شدم و باهاش موافق هستم.
          </Text>
        )}
        <TouchableOpacity
          style={[styles.button, !allConsented && styles.buttonDisabled]}
          onPress={() => navigation.navigate('InitialFunding')}
          activeOpacity={0.8}
          disabled={!allConsented}
        >
          <Text style={styles.buttonText}>I understand</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

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
  consentContainer: {
    gap: spacing[4],
    marginBottom: spacing[6],
  },
  consentItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.cardDark,
    padding: spacing[4],
    borderRadius: borderRadius.default,
  },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.textSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing[3],
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkmark: {
    color: colors.textPrimaryDark,
    fontSize: 16,
    fontWeight: typography.fontWeight.bold,
  },
  consentTextContainer: {
    flex: 1,
  },
  consentTextFarsi: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.textPrimaryDark,
    textAlign: 'right',
    writingDirection: 'rtl',
    marginBottom: spacing[1],
  },
  consentTextEnglish: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: `${colors.info}15`,
    padding: spacing[4],
    borderRadius: borderRadius.default,
    borderWidth: 1,
    borderColor: `${colors.info}30`,
  },
  infoIcon: {
    fontSize: 20,
    marginRight: spacing[3],
  },
  infoText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  footer: {
    paddingHorizontal: spacing[6],
    paddingBottom: spacing[8],
  },
  finalConsentFarsi: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    writingDirection: 'rtl',
    marginBottom: spacing[4],
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

export default ConsentScreen;
