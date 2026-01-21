/**
 * ConsentScreen
 * Design System: Blu Markets
 * Target: iPhone 16 Pro (393 x 852)
 *
 * Risk acknowledgment with Farsi consent text
 * Uses exact consent text: "متوجه ریسک این سبد دارایی شدم و باهاش موافق هستم."
 */

import React, { useState } from 'react';
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
import { useAppDispatch, useAppSelector } from '../../hooks/useStore';
import { setConsent } from '../../store/slices/onboardingSlice';
import { onboarding } from '../../services/api';

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

// Final consent exact text from questionnaire.fa.json
const FINAL_CONSENT_FARSI = 'متوجه ریسک این سبد دارایی شدم و باهاش موافق هستم.';
const FINAL_CONSENT_ENGLISH = 'I understand the risk of this portfolio and I agree with it.';

const ConsentScreen: React.FC<ConsentScreenProps> = ({ navigation }) => {
  const dispatch = useAppDispatch();
  const consents = useAppSelector((state) => state.onboarding.consents);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleToggleConsent = (key: keyof typeof consents) => {
    dispatch(setConsent({ key, value: !consents[key] }));
  };

  const handleContinue = async () => {
    setIsLoading(true);
    setError(null);

    try {
      await onboarding.recordConsent();
      navigation.navigate('InitialFunding');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to record consent';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const allConsented =
    consents.riskAcknowledged &&
    consents.lossAcknowledged &&
    consents.noGuaranteeAcknowledged;

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

      <View style={styles.content}>
        {/* Title */}
        <View style={styles.titleContainer}>
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
              style={[
                styles.consentItem,
                consents[item.key] && styles.consentItemChecked,
              ]}
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

      {/* Footer */}
      <View style={styles.footer}>
        {/* Error message */}
        {error && <Text style={styles.errorText}>{error}</Text>}

        {/* Final confirmation in Farsi - shown when all consented */}
        {allConsented && (
          <View style={styles.finalConsentContainer}>
            <Text style={styles.finalConsentFarsi}>{FINAL_CONSENT_FARSI}</Text>
            <Text style={styles.finalConsentEnglish}>{FINAL_CONSENT_ENGLISH}</Text>
          </View>
        )}

        <Button
          label="I understand"
          variant="primary"
          size="lg"
          fullWidth
          onPress={handleContinue}
          loading={isLoading}
          disabled={!allConsented}
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background.primary,
  },
  header: {
    paddingHorizontal: LAYOUT.screenPaddingH,
    paddingTop: SPACING[2],
    paddingBottom: SPACING[4],
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
  content: {
    flex: 1,
    paddingHorizontal: LAYOUT.screenPaddingH,
  },
  titleContainer: {
    marginBottom: SPACING[6],
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
  consentContainer: {
    gap: SPACING[3],
    marginBottom: SPACING[6],
  },
  consentItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.background.elevated,
    padding: SPACING[4],
    borderRadius: RADIUS.lg,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  consentItemChecked: {
    borderColor: COLORS.brand.primary,
    backgroundColor: COLORS.brand.primaryMuted,
  },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: RADIUS.md,
    borderWidth: 2,
    borderColor: COLORS.text.muted,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING[3],
  },
  checkboxChecked: {
    backgroundColor: COLORS.brand.primary,
    borderColor: COLORS.brand.primary,
  },
  checkmark: {
    color: COLORS.text.inverse,
    fontSize: 16,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },
  consentTextContainer: {
    flex: 1,
  },
  consentTextFarsi: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.text.primary,
    textAlign: 'right',
    writingDirection: 'rtl',
    marginBottom: SPACING[1],
  },
  consentTextEnglish: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: COLORS.semanticBg.info,
    padding: SPACING[4],
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: `${COLORS.semantic.info}30`,
  },
  infoIcon: {
    fontSize: 20,
    marginRight: SPACING[3],
  },
  infoText: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
    lineHeight: TYPOGRAPHY.fontSize.sm * 1.5,
  },
  footer: {
    paddingHorizontal: LAYOUT.screenPaddingH,
    paddingBottom: LAYOUT.totalBottomSpace,
    paddingTop: SPACING[4],
  },
  errorText: {
    color: COLORS.semantic.error,
    fontSize: TYPOGRAPHY.fontSize.sm,
    textAlign: 'center',
    marginBottom: SPACING[3],
  },
  finalConsentContainer: {
    marginBottom: SPACING[4],
    padding: SPACING[3],
    backgroundColor: COLORS.background.elevated,
    borderRadius: RADIUS.md,
  },
  finalConsentFarsi: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.primary,
    textAlign: 'center',
    writingDirection: 'rtl',
    marginBottom: SPACING[1],
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
  finalConsentEnglish: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.text.muted,
    textAlign: 'center',
  },
});

export default ConsentScreen;
