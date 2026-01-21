// Onboarding Navigator
// Based on PRD Section 6.1 - Onboarding Flow
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { OnboardingStackParamList } from './types';
import { COLORS } from '../constants/colors';

// Import screens
import WelcomeScreen from '../screens/onboarding/WelcomeScreen';
import PhoneInputScreen from '../screens/onboarding/PhoneInputScreen';
import OTPVerifyScreen from '../screens/onboarding/OTPVerifyScreen';
import QuestionnaireScreen from '../screens/onboarding/QuestionnaireScreen';
import ProfileResultScreen from '../screens/onboarding/ProfileResultScreen';
import ConsentScreen from '../screens/onboarding/ConsentScreen';
import InitialFundingScreen from '../screens/onboarding/InitialFundingScreen';
import SuccessScreen from '../screens/onboarding/SuccessScreen';

const Stack = createNativeStackNavigator<OnboardingStackParamList>();

export const OnboardingNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: {
          backgroundColor: COLORS.background.primary,
        },
        animation: 'none',
      }}
    >
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="PhoneInput" component={PhoneInputScreen} />
      <Stack.Screen name="OTPVerify" component={OTPVerifyScreen} />
      <Stack.Screen name="Questionnaire" component={QuestionnaireScreen} />
      <Stack.Screen name="ProfileResult" component={ProfileResultScreen} />
      <Stack.Screen name="Consent" component={ConsentScreen} />
      <Stack.Screen name="InitialFunding" component={InitialFundingScreen} />
      <Stack.Screen name="Success" component={SuccessScreen} />
    </Stack.Navigator>
  );
};

export default OnboardingNavigator;
