// Services Screen - Loans + Protection with horizontal sub-tabs
// Based on UI Restructure Specification Section 3

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import { LoansTab } from './LoansTab';
import { ProtectionTab } from './ProtectionTab';
import { COLORS } from '../../constants/colors';
import { TYPOGRAPHY } from '../../constants/typography';
import { SPACING } from '../../constants/spacing';

type ServiceTab = 'loans' | 'protection';

interface Props {
  route?: {
    params?: {
      initialTab?: ServiceTab;
      loanId?: string;
      protectionId?: string;
    };
  };
}

export function ServicesScreen({ route }: Props) {
  const initialTab = route?.params?.initialTab || 'loans';
  const [activeTab, setActiveTab] = useState<ServiceTab>(initialTab);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Services</Text>
      </View>

      {/* Tab Bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'loans' && styles.tabActive]}
          onPress={() => setActiveTab('loans')}
        >
          <Text style={[styles.tabText, activeTab === 'loans' && styles.tabTextActive]}>
            Loans
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'protection' && styles.tabActive]}
          onPress={() => setActiveTab('protection')}
        >
          <Text style={[styles.tabText, activeTab === 'protection' && styles.tabTextActive]}>
            Protection
          </Text>
        </TouchableOpacity>
      </View>

      {/* Tab Content */}
      {activeTab === 'loans' ? (
        <LoansTab loanId={route?.params?.loanId} />
      ) : (
        <ProtectionTab protectionId={route?.params?.protectionId} />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background.primary,
  },
  header: {
    paddingHorizontal: SPACING[5],
    paddingTop: SPACING[4],
    paddingBottom: SPACING[4],
  },
  title: {
    fontSize: 28,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text.primary,
  },
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: SPACING[5],
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tab: {
    paddingVertical: SPACING[3],
    paddingHorizontal: SPACING[4],
    marginRight: SPACING[2],
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: COLORS.brand.primary,
  },
  tabText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text.muted,
  },
  tabTextActive: {
    color: COLORS.text.primary,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },
});

export default ServicesScreen;
