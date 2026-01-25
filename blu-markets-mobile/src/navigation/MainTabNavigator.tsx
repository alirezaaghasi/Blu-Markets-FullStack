// Main Tab Navigator
// Based on UI Restructure Specification - 4 Tabs Only
// Home, Portfolio, Market, Profile

import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Home, PieChart, TrendingUp, User } from 'lucide-react-native';
import { MainTabParamList } from './types';

// Import screens
import HomeScreen from '../screens/main/HomeScreen';
import PortfolioScreen from '../screens/main/PortfolioScreen';
import MarketScreen from '../screens/services/ServicesScreen';
import ProfileScreen from '../screens/main/ProfileScreen';

const Tab = createBottomTabNavigator<MainTabParamList>();

export function MainTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#0E1420',
          borderTopColor: '#1C2433',
          borderTopWidth: 1,
          height: 64 + 34, // 64pt nav + 34pt safe area
          paddingBottom: 34,
          paddingTop: 8,
        },
        tabBarActiveTintColor: '#6FAAF8',
        tabBarInactiveTintColor: '#6B7280',
        tabBarLabelStyle: {
          fontSize: 11,
          marginTop: 4,
        },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarIcon: ({ color }) => <Home color={color} size={24} />,
        }}
      />
      <Tab.Screen
        name="Portfolio"
        component={PortfolioScreen}
        options={{
          tabBarIcon: ({ color }) => <PieChart color={color} size={24} />,
        }}
      />
      <Tab.Screen
        name="Market"
        component={MarketScreen}
        options={{
          tabBarIcon: ({ color }) => <TrendingUp color={color} size={24} />,
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarIcon: ({ color }) => <User color={color} size={24} />,
        }}
      />
    </Tab.Navigator>
  );
}

export default MainTabNavigator;
