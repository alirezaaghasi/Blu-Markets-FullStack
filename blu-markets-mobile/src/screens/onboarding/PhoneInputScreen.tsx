/**
 * PhoneInputScreen
 * Design System: Blu Markets
 * Target: iPhone 16 Pro (393 x 852)
 *
 * Phone number entry with +98 prefix
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,

  KeyboardAvoidingView,
  Platform,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { OnboardingStackParamList } from '../../navigation/types';
import { COLORS } from '../../constants/colors';
import { TYPOGRAPHY } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';
import { LAYOUT, DEVICE } from '../../constants/layout';
import { Button, Input } from '../../components/common';
import { useAppDispatch } from '../../hooks/useStore';
import { setPhone } from '../../store/slices/onboardingSlice';
import { IRAN_PHONE_PREFIX } from '../../constants/business';
import { auth } from '../../services/api';
import { ONBOARDING } from '../../constants/messages';

type PhoneInputScreenProps = {
  navigation: NativeStackNavigationProp<OnboardingStackParamList, 'PhoneInput'>;
};

const PhoneInputScreen: React.FC<PhoneInputScreenProps> = ({ navigation }) => {
  const dispatch = useAppDispatch();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handlePhoneChange = (value: string) => {
    setPhoneNumber(value);
    setError('');
  };

  // Normalize phone number to 10-digit format (without leading 0)
  const normalizePhone = (input: string): string => {
    const cleaned = input.replace(/\D/g, '');
    // Handle various Iranian phone formats:
    // 09123456789 (11 digits) -> 9123456789
    // 9123456789 (10 digits) -> 9123456789
    // 989123456789 (12 digits with 98 prefix) -> 9123456789
    // +989123456789 (already handled by replace above)
    if (cleaned.length === 11 && cleaned.startsWith('0')) {
      return cleaned.slice(1); // Remove leading 0
    }
    if (cleaned.length === 12 && cleaned.startsWith('98')) {
      return cleaned.slice(2); // Remove 98 prefix
    }
    return cleaned;
  };

  const validatePhone = (): boolean => {
    const normalized = normalizePhone(phoneNumber);
    if (normalized.length !== 10) {
      setError(ONBOARDING.phone.error);
      return false;
    }
    if (!normalized.startsWith('9')) {
      setError('Phone number must start with 9 (e.g., 09123456789)');
      return false;
    }
    return true;
  };

  const handleContinue = async () => {
    if (!validatePhone()) return;

    // Normalize the phone number before sending
    const normalized = normalizePhone(phoneNumber);
    const fullPhone = `${IRAN_PHONE_PREFIX}${normalized.slice(1)}`; // +989XXXXXXXXX
    setIsLoading(true);
    setError('');

    try {
      await auth.sendOtp(fullPhone);
      dispatch(setPhone(fullPhone));
      navigation.navigate('OTPVerify', { phone: fullPhone });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to send OTP. Please try again.';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Check if phone is valid (after normalization)
  const normalizedForCheck = normalizePhone(phoneNumber);
  const isValid = normalizedForCheck.length === 10 && normalizedForCheck.startsWith('9');

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background.primary} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        {/* Header with back button */}
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
            <Text style={styles.title}>{ONBOARDING.phone.title}</Text>
            <Text style={styles.subtitle}>
              We'll send you a verification code
            </Text>
          </View>

          {/* Phone input using design system */}
          <Input
            variant="phone"
            value={phoneNumber}
            onChangeText={handlePhoneChange}
            placeholder={ONBOARDING.phone.placeholder}
            error={error}
            autoFocus
          />
        </View>

        {/* Footer with CTA */}
        <View style={styles.footer}>
          <Button
            label={ONBOARDING.phone.cta}
            variant="primary"
            size="lg"
            fullWidth
            onPress={handleContinue}
            loading={isLoading}
            disabled={!isValid}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background.primary,
  },
  keyboardView: {
    flex: 1,
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
    marginBottom: SPACING[8],
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
  footer: {
    paddingHorizontal: LAYOUT.screenPaddingH,
    paddingBottom: LAYOUT.totalBottomSpace,
    paddingTop: SPACING[4],
  },
});

export default PhoneInputScreen;
