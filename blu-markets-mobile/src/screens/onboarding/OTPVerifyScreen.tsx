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

  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
import { auth, setAuthTokens } from '../../services/api';

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

    // Prevent multiple submissions
    if (isLoading) {
      console.log('[OTP] Already verifying, ignoring');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      console.log('[OTP] Starting verification...');
      const response = await auth.verifyOtp(phone, verifyCode);
      console.log('[OTP] Verification successful, onboardingComplete:', response.onboardingComplete);

      // Store auth token in Redux (for app state) - triggers RootNavigator update
      dispatch(setAuthToken(response.accessToken));

      // Navigate based on onboarding status
      if (!response.onboardingComplete) {
        console.log('[OTP] Navigating to Questionnaire');
        navigation.navigate('Questionnaire');
      } else {
        // Mark onboarding complete to trigger navigation to main app
        console.log('[OTP] User already completed onboarding, marking complete');
        const { completeOnboarding } = await import('../../store/slices/authSlice');
        dispatch(completeOnboarding());
      }
    } catch (err: unknown) {
      console.error('[OTP] Verification error:', err);
      let errorMessage = 'Verification failed. Please try again.';
      if (err instanceof Error) {
        errorMessage = err.message;
      } else if (err && typeof err === 'object' && 'message' in err) {
        errorMessage = String((err as { message: unknown }).message);
      }
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendTimer > 0 || isResending) return;

    setIsResending(true);
    setError('');

    try {
      await auth.sendOtp(phone);
      setResendTimer(60);
      setOtp('');
    } catch (err: unknown) {
      let errorMessage = 'Failed to resend code.';
      if (err instanceof Error) {
        errorMessage = err.message;
      } else if (err && typeof err === 'object' && 'message' in err) {
        errorMessage = String((err as { message: unknown }).message);
      }
      setError(errorMessage);
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
