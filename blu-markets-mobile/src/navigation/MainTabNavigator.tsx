// Main Tab Navigator
// Based on PRD Section 7 - Navigation Architecture
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, StyleSheet } from 'react-native';
import { MainTabParamList } from './types';
import { colors, components } from '../constants/theme';

// Import actual screens
import DashboardScreen from '../screens/portfolio/DashboardScreen';
import HistoryScreen from '../screens/history/HistoryScreen';
import ProfileScreen from '../screens/profile/ProfileScreen';
import ProtectionScreen from '../screens/protection/ProtectionScreen';
import LoansScreen from '../screens/loans/LoansScreen';

// Tab icons (simplified for now, will use actual icons)
const TabIcon = ({ name, focused }: { name: string; focused: boolean }) => {
  const icons: Record<string, string> = {
    Portfolio: '📊',
    Protection: '🛡️',
    Loans: '💰',
    History: '📜',
    Profile: '👤',
  };

  return (
    <Text style={[styles.icon, focused && styles.iconFocused]}>
      {icons[name] || '●'}
    </Text>
  );
};

const Tab = createBottomTabNavigator<MainTabParamList>();

export const MainTabNavigator: React.FC = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused }) => (
          <TabIcon name={route.name} focused={focused} />
        ),
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          backgroundColor: colors.cardDark,
          borderTopColor: colors.borderDark,
          height: components.tabBar.height,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
        },
        headerStyle: {
          backgroundColor: colors.bgDark,
        },
        headerTintColor: colors.textPrimaryDark,
        headerTitleStyle: {
          fontWeight: '600',
        },
      })}
    >
      <Tab.Screen
        name="Portfolio"
        component={DashboardScreen}
        options={{
          title: 'Portfolio',
          headerShown: false,
        }}
      />
      <Tab.Screen
        name="Protection"
        component={ProtectionScreen}
        options={{
          title: 'Protection',
          headerShown: false,
        }}
      />
      <Tab.Screen
        name="Loans"
        component={LoansScreen}
        options={{
          title: 'Loans',
          headerShown: false,
        }}
      />
      <Tab.Screen
        name="History"
        component={HistoryScreen}
        options={{
          title: 'History',
          headerShown: false,
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          title: 'Profile',
          headerShown: false,
        }}
      />
    </Tab.Navigator>
  );
};

const styles = StyleSheet.create({
  icon: {
    fontSize: 24,
  },
  iconFocused: {
    transform: [{ scale: 1.1 }],
  },
});

export default MainTabNavigator;
