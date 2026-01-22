// Root Navigator
// Determines whether to show onboarding or main app based on auth state
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootStackParamList } from './types';
import { useAppSelector } from '../hooks/useStore';
import OnboardingNavigator from './OnboardingNavigator';
import MainTabNavigator from './MainTabNavigator';
import QuestionnaireScreen from '../screens/onboarding/QuestionnaireScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export const RootNavigator: React.FC = () => {
  const { isAuthenticated, onboardingComplete } = useAppSelector((state) => state.auth);

  // Show main app only if both authenticated AND onboarding complete
  const showMainApp = isAuthenticated && onboardingComplete;

  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'none' }}>
      {showMainApp ? (
        <>
          <Stack.Screen name="Main" component={MainTabNavigator} />
          <Stack.Screen
            name="RetakeQuiz"
            component={QuestionnaireScreen}
            options={{
              presentation: 'modal',
              animation: 'slide_from_bottom',
            }}
          />
        </>
      ) : (
        <Stack.Screen name="Onboarding" component={OnboardingNavigator} />
      )}
    </Stack.Navigator>
  );
};

export default RootNavigator;
