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
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
} from 'react-native';
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

  const validatePhone = (): boolean => {
    if (phoneNumber.length !== 10) {
      setError('Please enter a valid 10-digit phone number');
      return false;
    }
    if (!phoneNumber.startsWith('9')) {
      setError('Phone number must start with 9');
      return false;
    }
    return true;
  };

  const handleContinue = async () => {
    if (!validatePhone()) return;

    const fullPhone = `${IRAN_PHONE_PREFIX}${phoneNumber.slice(1)}`;
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

  const isValid = phoneNumber.length === 10 && phoneNumber.startsWith('9');

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
            <Text style={styles.title}>Enter your phone number</Text>
            <Text style={styles.subtitle}>
              We'll send you a verification code
            </Text>
          </View>

          {/* Phone input using design system */}
          <Input
            variant="phone"
            value={phoneNumber}
            onChangeText={handlePhoneChange}
            placeholder="912 345 6789"
            error={error}
            autoFocus
          />
        </View>

        {/* Footer with CTA */}
        <View style={styles.footer}>
          <Button
            label="Send OTP"
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
