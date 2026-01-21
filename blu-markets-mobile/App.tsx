// Blu Markets Mobile App
// Main entry point
import React, { useEffect } from 'react';
import { StatusBar } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { Provider } from 'react-redux';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { store } from './src/store';
import RootNavigator from './src/navigation/RootNavigator';
import { colors } from './src/constants/theme';
import { setDefaultPrices } from './src/store/slices/pricesSlice';
// Disabled during debugging
// import { usePricePolling } from './src/hooks/usePricePolling';
// import { usePersistence } from './src/hooks/usePersistence';

// Navigation theme
const navigationTheme = {
  dark: true,
  colors: {
    primary: colors.primary,
    background: colors.bgDark,
    card: colors.cardDark,
    text: colors.textPrimaryDark,
    border: colors.borderDark,
    notification: colors.primary,
  },
  fonts: {
    regular: { fontFamily: 'System', fontWeight: '400' as const },
    medium: { fontFamily: 'System', fontWeight: '500' as const },
    bold: { fontFamily: 'System', fontWeight: '700' as const },
    heavy: { fontFamily: 'System', fontWeight: '900' as const },
  },
};

function AppContent() {
  // Disabled all hooks during debugging to isolate infinite loop issue
  // usePersistence();
  // usePricePolling({ enabled: false });

  useEffect(() => {
    // Initialize default prices on app start
    store.dispatch(setDefaultPrices());
  }, []);

  return (
    <NavigationContainer theme={navigationTheme}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bgDark} />
      <RootNavigator />
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <Provider store={store}>
          <AppContent />
        </Provider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
