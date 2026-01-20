// Success Screen
// Based on PRD Section 5 - Portfolio creation success
import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Animated,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { OnboardingStackParamList } from '../../navigation/types';
import { colors, typography, spacing, borderRadius } from '../../constants/theme';
import { useAppDispatch, useAppSelector } from '../../hooks/useStore';
import { setAuthToken } from '../../store/slices/authSlice';
import { initializePortfolio, logAction } from '../../store/slices/portfolioSlice';
import { resetOnboarding } from '../../store/slices/onboardingSlice';

type SuccessScreenProps = {
  navigation: NativeStackNavigationProp<OnboardingStackParamList, 'Success'>;
};

// Format number with commas
const formatNumber = (num: number): string => {
  return num.toLocaleString('en-US');
};

const SuccessScreen: React.FC<SuccessScreenProps> = ({ navigation }) => {
  const dispatch = useAppDispatch();
  const { riskProfile, initialInvestment, phone } = useAppSelector(
    (state) => state.onboarding
  );
  const scaleAnim = React.useRef(new Animated.Value(0)).current;
  const fadeAnim = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Animate success icon
    Animated.sequence([
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 3,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const allocation = riskProfile?.targetAllocation || {
    FOUNDATION: 0.5,
    GROWTH: 0.35,
    UPSIDE: 0.15,
  };

  const handleGoToDashboard = () => {
    // Initialize portfolio with the investment
    dispatch(
      initializePortfolio({
        cashIRR: 0, // All invested
        holdings: [], // Will be populated by portfolio creation logic
        targetLayerPct: allocation,
      })
    );

    // Log the portfolio creation action
    dispatch(
      logAction({
        type: 'PORTFOLIO_CREATED',
        boundary: 'SAFE',
        message: `Started with ${formatNumber(initialInvestment)} IRR`,
        amountIRR: initialInvestment,
      })
    );

    // Set auth token (in real app, this would come from backend)
    dispatch(setAuthToken('demo-token-' + Date.now()));

    // Reset onboarding state
    dispatch(resetOnboarding());
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Success icon */}
        <Animated.View
          style={[
            styles.successIconContainer,
            { transform: [{ scale: scaleAnim }] },
          ]}
        >
          <Text style={styles.successIcon}>🎉</Text>
        </Animated.View>

        {/* Success message */}
        <Animated.View style={[styles.messageContainer, { opacity: fadeAnim }]}>
          <Text style={styles.title}>Your portfolio is ready!</Text>
          <Text style={styles.subtitle}>
            You've successfully created your Blu Markets portfolio
          </Text>
        </Animated.View>

        {/* Portfolio summary */}
        <Animated.View style={[styles.summaryCard, { opacity: fadeAnim }]}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total Investment</Text>
            <Text style={styles.summaryValue}>
              {formatNumber(initialInvestment)} IRR
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.allocationSection}>
            <Text style={styles.allocationTitle}>Allocation</Text>
            <View style={styles.allocationBar}>
              <View
                style={[
                  styles.allocationSegment,
                  {
                    flex: allocation.FOUNDATION,
                    backgroundColor: colors.layerFoundation,
                  },
                ]}
              />
              <View
                style={[
                  styles.allocationSegment,
                  {
                    flex: allocation.GROWTH,
                    backgroundColor: colors.layerGrowth,
                  },
                ]}
              />
              <View
                style={[
                  styles.allocationSegment,
                  {
                    flex: allocation.UPSIDE,
                    backgroundColor: colors.layerUpside,
                  },
                ]}
              />
            </View>
            <View style={styles.allocationLabels}>
              <AllocationLabel
                label="Foundation"
                percentage={Math.round(allocation.FOUNDATION * 100)}
                color={colors.layerFoundation}
              />
              <AllocationLabel
                label="Growth"
                percentage={Math.round(allocation.GROWTH * 100)}
                color={colors.layerGrowth}
              />
              <AllocationLabel
                label="Upside"
                percentage={Math.round(allocation.UPSIDE * 100)}
                color={colors.layerUpside}
              />
            </View>
          </View>
        </Animated.View>

        {/* Activity Feed preview */}
        <Animated.View style={[styles.activityPreview, { opacity: fadeAnim }]}>
          <Text style={styles.activityTitle}>Activity</Text>
          <View style={styles.activityItem}>
            <View style={[styles.activityDot, { backgroundColor: colors.boundarySafe }]} />
            <Text style={styles.activityText}>Just now</Text>
            <Text style={styles.activityMessage}>
              Started with {formatNumber(initialInvestment)} IRR
            </Text>
            <Text style={styles.activityIndicator}>🟢</Text>
          </View>
        </Animated.View>
      </View>

      {/* CTA Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.button}
          onPress={handleGoToDashboard}
          activeOpacity={0.8}
        >
          <Text style={styles.buttonText}>Go to Dashboard</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const AllocationLabel: React.FC<{
  label: string;
  percentage: number;
  color: string;
}> = ({ label, percentage, color }) => (
  <View style={styles.allocationLabelItem}>
    <View style={[styles.labelDot, { backgroundColor: color }]} />
    <Text style={styles.labelText}>
      {label} {percentage}%
    </Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgDark,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing[6],
    justifyContent: 'center',
  },
  successIconContainer: {
    alignItems: 'center',
    marginBottom: spacing[6],
  },
  successIcon: {
    fontSize: 80,
  },
  messageContainer: {
    alignItems: 'center',
    marginBottom: spacing[8],
  },
  title: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimaryDark,
    marginBottom: spacing[2],
    textAlign: 'center',
  },
  subtitle: {
    fontSize: typography.fontSize.base,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  summaryCard: {
    backgroundColor: colors.cardDark,
    borderRadius: borderRadius.lg,
    padding: spacing[5],
    marginBottom: spacing[4],
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: typography.fontSize.base,
    color: colors.textSecondary,
  },
  summaryValue: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimaryDark,
  },
  divider: {
    height: 1,
    backgroundColor: colors.borderDark,
    marginVertical: spacing[4],
  },
  allocationSection: {},
  allocationTitle: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    marginBottom: spacing[3],
  },
  allocationBar: {
    height: 12,
    borderRadius: 6,
    flexDirection: 'row',
    overflow: 'hidden',
    marginBottom: spacing[3],
  },
  allocationSegment: {
    height: '100%',
  },
  allocationLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  allocationLabelItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  labelDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: spacing[1],
  },
  labelText: {
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
  },
  activityPreview: {
    backgroundColor: colors.cardDark,
    borderRadius: borderRadius.lg,
    padding: spacing[4],
  },
  activityTitle: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    marginBottom: spacing[3],
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  activityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: spacing[2],
  },
  activityText: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    marginRight: spacing[2],
  },
  activityMessage: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: colors.textPrimaryDark,
  },
  activityIndicator: {
    fontSize: 12,
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
  buttonText: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimaryDark,
  },
});

export default SuccessScreen;
