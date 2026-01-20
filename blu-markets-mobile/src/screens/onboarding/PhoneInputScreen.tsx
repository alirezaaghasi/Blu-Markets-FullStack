// Phone Input Screen
// Based on PRD Section 30 - Onboarding Rules
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { OnboardingStackParamList } from '../../navigation/types';
import { colors, typography, spacing, borderRadius } from '../../constants/theme';
import { useAppDispatch } from '../../hooks/useStore';
import { setPhone } from '../../store/slices/onboardingSlice';
import { IRAN_PHONE_PREFIX, IRAN_PHONE_LENGTH } from '../../constants/business';

type PhoneInputScreenProps = {
  navigation: NativeStackNavigationProp<OnboardingStackParamList, 'PhoneInput'>;
};

const PhoneInputScreen: React.FC<PhoneInputScreenProps> = ({ navigation }) => {
  const dispatch = useAppDispatch();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [error, setError] = useState('');

  const formatPhoneDisplay = (value: string) => {
    // Format: 9XX XXX XXXX
    const cleaned = value.replace(/\D/g, '');
    if (cleaned.length <= 3) return cleaned;
    if (cleaned.length <= 6) return `${cleaned.slice(0, 3)} ${cleaned.slice(3)}`;
    return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6, 10)}`;
  };

  const handlePhoneChange = (value: string) => {
    const cleaned = value.replace(/\D/g, '').slice(0, 10);
    setPhoneNumber(cleaned);
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

  const handleContinue = () => {
    if (!validatePhone()) return;

    const fullPhone = `${IRAN_PHONE_PREFIX}${phoneNumber.slice(1)}`;
    dispatch(setPhone(fullPhone));
    navigation.navigate('OTPVerify', { phone: fullPhone });
  };

  const isValid = phoneNumber.length === 10 && phoneNumber.startsWith('9');

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
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
            <Text style={styles.title}>Enter your phone number</Text>
            <Text style={styles.subtitle}>
              We'll send you a verification code
            </Text>
          </View>

          {/* Phone input */}
          <View style={styles.inputContainer}>
            <View style={styles.prefixContainer}>
              <Text style={styles.flag}>🇮🇷</Text>
              <Text style={styles.prefix}>+98</Text>
            </View>
            <TextInput
              style={styles.input}
              value={formatPhoneDisplay(phoneNumber)}
              onChangeText={handlePhoneChange}
              placeholder="9XX XXX XXXX"
              placeholderTextColor={colors.textMuted}
              keyboardType="phone-pad"
              maxLength={12}
              autoFocus
            />
          </View>

          {/* Error message */}
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </View>

        {/* CTA Button */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.button, !isValid && styles.buttonDisabled]}
            onPress={handleContinue}
            activeOpacity={0.8}
            disabled={!isValid}
          >
            <Text style={styles.buttonText}>Send OTP</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgDark,
  },
  keyboardView: {
    flex: 1,
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
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardDark,
    borderRadius: borderRadius.default,
    paddingHorizontal: spacing[4],
    borderWidth: 1,
    borderColor: colors.borderDark,
  },
  prefixContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: spacing[3],
    borderRightWidth: 1,
    borderRightColor: colors.borderDark,
    marginRight: spacing[3],
  },
  flag: {
    fontSize: 20,
    marginRight: spacing[2],
  },
  prefix: {
    fontSize: typography.fontSize.lg,
    color: colors.textPrimaryDark,
    fontWeight: typography.fontWeight.medium,
  },
  input: {
    flex: 1,
    height: 56,
    fontSize: typography.fontSize.lg,
    color: colors.textPrimaryDark,
    fontWeight: typography.fontWeight.medium,
  },
  errorText: {
    color: colors.error,
    fontSize: typography.fontSize.sm,
    marginTop: spacing[2],
  },
  footer: {
    paddingHorizontal: spacing[6],
    paddingBottom: spacing[8],
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

export default PhoneInputScreen;
