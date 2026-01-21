/**
 * OTPVerifyScreen
 * Design System: Blu Markets
 * Target: iPhone 16 Pro (393 x 852)
 *
 * 6-digit OTP verification with auto-submit
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { OnboardingStackParamList } from '../../navigation/types';
import { COLORS } from '../../constants/colors';
import { TYPOGRAPHY } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';
import { LAYOUT } from '../../constants/layout';
import { Button, OTPInput } from '../../components/common';
import { useAppDispatch } from '../../hooks/useStore';
import { setAuthToken } from '../../store/slices/authSlice';
import { authApi, ApiError } from '../../services/api';

type OTPVerifyScreenProps = {
  navigation: NativeStackNavigationProp<OnboardingStackParamList, 'OTPVerify'>;
  route: RouteProp<OnboardingStackParamList, 'OTPVerify'>;
};

const OTP_LENGTH = 6;

const OTPVerifyScreen: React.FC<OTPVerifyScreenProps> = ({
  navigation,
  route,
}) => {
  const dispatch = useAppDispatch();
  const { phone } = route.params;
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [resendTimer, setResendTimer] = useState(60);
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setResendTimer((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleVerify = async (code?: string) => {
    const verifyCode = code || otp;
    if (verifyCode.length !== OTP_LENGTH) {
      setError('Please enter the complete code');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await authApi.verifyOtp(phone, verifyCode);

      // Store auth token in Redux
      dispatch(setAuthToken(response.tokens.accessToken));

      // Navigate based on onboarding status
      if (!response.onboardingComplete) {
        // New user or incomplete onboarding - continue to questionnaire
        navigation.navigate('Questionnaire');
      }
      // If onboarding complete, RootNavigator handles navigation
    } catch (err) {
      const apiError = err as ApiError;
      if (apiError.code === 'OTP_INVALID') {
        setError('Invalid code. Please try again.');
      } else if (apiError.code === 'OTP_EXPIRED') {
        setError('Code expired. Please request a new one.');
      } else if (apiError.code === 'OTP_MAX_ATTEMPTS') {
        setError('Too many attempts. Please request a new code.');
      } else {
        setError(apiError.message || 'Verification failed. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendTimer > 0 || isResending) return;

    setIsResending(true);
    setError('');

    try {
      await authApi.sendOtp(phone);
      setResendTimer(60);
      setOtp('');
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError.message || 'Failed to resend code.');
    } finally {
      setIsResending(false);
    }
  };

  const handleOtpChange = (value: string) => {
    setOtp(value);
    setError('');
  };

  const handleOtpComplete = (value: string) => {
    // Auto-submit on complete
    handleVerify(value);
  };

  // Format phone for display
  const formatPhoneDisplay = (phoneNumber: string) => {
    // +989123456789 -> +98 912 345 6789
    if (phoneNumber.startsWith('+98')) {
      const digits = phoneNumber.slice(3);
      return `+98 ${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
    }
    return phoneNumber;
  };

  const isComplete = otp.length === OTP_LENGTH;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background.primary} />

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
          <Text style={styles.title}>Enter verification code</Text>
          <Text style={styles.subtitle}>
            We sent a 6-digit code to{'\n'}
            <Text style={styles.phoneHighlight}>{formatPhoneDisplay(phone)}</Text>
          </Text>
        </View>

        {/* OTP Input using design system */}
        <OTPInput
          length={OTP_LENGTH}
          value={otp}
          onChangeText={handleOtpChange}
          onComplete={handleOtpComplete}
          error={error}
          autoFocus
        />

        {/* Resend */}
        <View style={styles.resendContainer}>
          {resendTimer > 0 ? (
            <Text style={styles.resendTimer}>
              Resend code in {resendTimer}s
            </Text>
          ) : isResending ? (
            <ActivityIndicator size="small" color={COLORS.brand.primary} />
          ) : (
            <TouchableOpacity onPress={handleResend}>
              <Text style={styles.resendButton}>Resend code</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Dev mode hint */}
        {__DEV__ && (
          <Text style={styles.devHint}>
            Dev mode: Use 999999 as OTP
          </Text>
        )}
      </View>

      {/* Footer with CTA */}
      <View style={styles.footer}>
        <Button
          label="Verify"
          variant="primary"
          size="lg"
          fullWidth
          onPress={() => handleVerify()}
          loading={isLoading}
          disabled={!isComplete}
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
    lineHeight: TYPOGRAPHY.fontSize.base * 1.5,
  },
  phoneHighlight: {
    color: COLORS.text.primary,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
  resendContainer: {
    alignItems: 'center',
    marginTop: SPACING[8],
  },
  resendTimer: {
    color: COLORS.text.secondary,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  resendButton: {
    color: COLORS.brand.primary,
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },
  devHint: {
    color: COLORS.text.muted,
    fontSize: TYPOGRAPHY.fontSize.xs,
    textAlign: 'center',
    marginTop: SPACING[4],
    fontStyle: 'italic',
  },
  footer: {
    paddingHorizontal: LAYOUT.screenPaddingH,
    paddingBottom: LAYOUT.totalBottomSpace,
    paddingTop: SPACING[4],
  },
});

export default OTPVerifyScreen;
