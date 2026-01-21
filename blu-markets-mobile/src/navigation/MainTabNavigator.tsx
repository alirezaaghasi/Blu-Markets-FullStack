// Main Tab Navigator
// Based on PRD Section 7 - Navigation Architecture (4 tabs)
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, StyleSheet } from 'react-native';
import { MainTabParamList } from './types';
import { COLORS } from '../constants/colors';
import { SIZES } from '../constants/spacing';

// Import screens
import DashboardScreen from '../screens/main/DashboardScreen';
import PortfolioScreen from '../screens/main/PortfolioScreen';
import HistoryScreen from '../screens/main/HistoryScreen';
import ProfileScreen from '../screens/main/ProfileScreen';

// Tab configuration per PRD (4 tabs - no Market tab in MVP)
const TABS = [
  { name: 'Home', icon: '🏠', screen: DashboardScreen },
  { name: 'Portfolio', icon: '📊', screen: PortfolioScreen },
  { name: 'History', icon: '🕐', screen: HistoryScreen },
  { name: 'Profile', icon: '👤', screen: ProfileScreen },
] as const;

// Tab icon component
const TabIcon = ({ icon, focused }: { icon: string; focused: boolean }) => (
  <View style={styles.iconContainer}>
    <Text style={[styles.icon, focused && styles.iconFocused]}>{icon}</Text>
  </View>
);

const Tab = createBottomTabNavigator<MainTabParamList>();

export const MainTabNavigator: React.FC = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: COLORS.brand.primary,
        tabBarInactiveTintColor: COLORS.text.muted,
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabLabel,
        headerShown: false,
      }}
    >
      <Tab.Screen
        name="Home"
        component={DashboardScreen}
        options={{
          tabBarIcon: ({ focused }) => <TabIcon icon="🏠" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Portfolio"
        component={PortfolioScreen}
        options={{
          tabBarIcon: ({ focused }) => <TabIcon icon="📊" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="History"
        component={HistoryScreen}
        options={{
          tabBarIcon: ({ focused }) => <TabIcon icon="🕐" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarIcon: ({ focused }) => <TabIcon icon="👤" focused={focused} />,
        }}
      />
    </Tab.Navigator>
  );
};

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: COLORS.background.surface,
    borderTopColor: COLORS.border,
    borderTopWidth: 1,
    height: SIZES.bottomNavHeight,
    paddingBottom: 8,
    paddingTop: 8,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: 22,
    opacity: 0.6,
  },
  iconFocused: {
    opacity: 1,
    transform: [{ scale: 1.1 }],
  },
});

export default MainTabNavigator;
