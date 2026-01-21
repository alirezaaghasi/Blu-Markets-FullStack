/**
 * SuccessScreen
 * Design System: Blu Markets
 * Target: iPhone 16 Pro (393 x 852)
 *
 * Portfolio creation success with celebration animation
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,

  Animated,
  Easing,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { OnboardingStackParamList } from '../../navigation/types';
import { COLORS } from '../../constants/colors';
import { TYPOGRAPHY } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';
import { LAYOUT } from '../../constants/layout';
import { Button } from '../../components/common';
import { useAppDispatch, useAppSelector } from '../../hooks/useStore';
import { initializePortfolio, logAction } from '../../store/slices/portfolioSlice';
import { resetOnboarding } from '../../store/slices/onboardingSlice';
import { completeOnboarding } from '../../store/slices/authSlice';

type SuccessScreenProps = {
  navigation: NativeStackNavigationProp<OnboardingStackParamList, 'Success'>;
};

// Format number with commas
const formatNumber = (num: number): string => {
  return num.toLocaleString('en-US');
};

// Confetti particle component
const ConfettiParticle: React.FC<{
  delay: number;
  color: string;
  startX: number;
}> = ({ delay, color, startX }) => {
  const translateY = useRef(new Animated.Value(-50)).current;
  const translateX = useRef(new Animated.Value(startX)).current;
  const rotate = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const animation = Animated.sequence([
      Animated.delay(delay),
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 500,
          duration: 2000,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(translateX, {
          toValue: startX + (Math.random() - 0.5) * 100,
          duration: 2000,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(rotate, {
          toValue: 360 * (Math.random() > 0.5 ? 1 : -1),
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.delay(1500),
          Animated.timing(opacity, {
            toValue: 0,
            duration: 500,
            useNativeDriver: true,
          }),
        ]),
      ]),
    ]);

    animation.start();
  }, []);

  return (
    <Animated.View
      style={[
        styles.confettiParticle,
        {
          backgroundColor: color,
          opacity,
          transform: [
            { translateY },
            { translateX },
            {
              rotate: rotate.interpolate({
                inputRange: [0, 360],
                outputRange: ['0deg', '360deg'],
              }),
            },
          ],
        },
      ]}
    />
  );
};

const SuccessScreen: React.FC<SuccessScreenProps> = ({ navigation }) => {
  const dispatch = useAppDispatch();
  const { riskProfile, initialInvestment, phone } = useAppSelector(
    (state) => state.onboarding
  );

  const scaleAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const checkScale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Animate success icon with bounce
    Animated.sequence([
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 3,
        useNativeDriver: true,
      }),
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.spring(checkScale, {
          toValue: 1,
          tension: 100,
          friction: 5,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, []);

  const allocation = riskProfile?.targetAllocation || {
    FOUNDATION: 0.5,
    GROWTH: 0.35,
    UPSIDE: 0.15,
  };

  const handleGoToDashboard = () => {
    // Initialize local portfolio state (portfolio already created on backend)
    // Include risk profile info for profile screen to use
    dispatch(
      initializePortfolio({
        cashIRR: initialInvestment, // Cash from initial funding
        holdings: [], // Will be fetched from backend
        targetLayerPct: allocation,
        riskScore: riskProfile?.score,
        riskProfileName: riskProfile?.profileName,
      })
    );

    // Log the portfolio creation action locally
    dispatch(
      logAction({
        type: 'PORTFOLIO_CREATED',
        boundary: 'SAFE',
        message: `Started with ${formatNumber(initialInvestment)} IRR`,
        amountIRR: initialInvestment,
      })
    );

    // Mark onboarding as complete - this triggers navigation to main app
    dispatch(completeOnboarding());

    // Reset onboarding state for fresh start if user logs out
    dispatch(resetOnboarding());
  };

  // Generate confetti particles
  const confettiColors = [
    COLORS.layers.foundation,
    COLORS.layers.growth,
    COLORS.layers.upside,
    COLORS.brand.primary,
    COLORS.semantic.success,
  ];

  const confettiParticles = Array.from({ length: 30 }).map((_, i) => ({
    id: i,
    color: confettiColors[i % confettiColors.length],
    startX: (i / 30) * 393 - 50,
    delay: Math.random() * 500,
  }));

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background.primary} />

      {/* Confetti */}
      <View style={styles.confettiContainer} pointerEvents="none">
        {confettiParticles.map((particle) => (
          <ConfettiParticle
            key={particle.id}
            color={particle.color}
            startX={particle.startX}
            delay={particle.delay}
          />
        ))}
      </View>

      <View style={styles.content}>
        {/* Success icon with checkmark */}
        <Animated.View
          style={[
            styles.successIconContainer,
            { transform: [{ scale: scaleAnim }] },
          ]}
        >
          <View style={styles.successCircle}>
            <Animated.Text
              style={[
                styles.checkmark,
                { transform: [{ scale: checkScale }] },
              ]}
            >
              ✓
            </Animated.Text>
          </View>
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
            <Text style={styles.allocationTitle}>Your allocation</Text>
            <View style={styles.allocationBar}>
              <View
                style={[
                  styles.allocationSegment,
                  {
                    flex: allocation.FOUNDATION,
                    backgroundColor: COLORS.layers.foundation,
                  },
                ]}
              />
              <View
                style={[
                  styles.allocationSegment,
                  {
                    flex: allocation.GROWTH,
                    backgroundColor: COLORS.layers.growth,
                  },
                ]}
              />
              <View
                style={[
                  styles.allocationSegment,
                  {
                    flex: allocation.UPSIDE,
                    backgroundColor: COLORS.layers.upside,
                  },
                ]}
              />
            </View>
            <View style={styles.allocationLabels}>
              <AllocationLabel
                label="Foundation"
                percentage={Math.round(allocation.FOUNDATION * 100)}
                color={COLORS.layers.foundation}
              />
              <AllocationLabel
                label="Growth"
                percentage={Math.round(allocation.GROWTH * 100)}
                color={COLORS.layers.growth}
              />
              <AllocationLabel
                label="Upside"
                percentage={Math.round(allocation.UPSIDE * 100)}
                color={COLORS.layers.upside}
              />
            </View>
          </View>
        </Animated.View>

        {/* First activity preview */}
        <Animated.View style={[styles.activityPreview, { opacity: fadeAnim }]}>
          <Text style={styles.activityTitle}>First activity</Text>
          <View style={styles.activityItem}>
            <View style={[styles.activityDot, { backgroundColor: COLORS.boundary.safe }]} />
            <View style={styles.activityContent}>
              <Text style={styles.activityMessage}>
                Portfolio created with {formatNumber(initialInvestment)} IRR
              </Text>
              <Text style={styles.activityTime}>Just now</Text>
            </View>
            <Text style={styles.activityBadge}>SAFE</Text>
          </View>
        </Animated.View>
      </View>

      {/* CTA Button */}
      <View style={styles.footer}>
        <Button
          label="Go to Dashboard"
          variant="primary"
          size="lg"
          fullWidth
          onPress={handleGoToDashboard}
          icon={<Text style={styles.arrowIcon}>→</Text>}
          iconPosition="right"
        />
      </View>
    </SafeAreaView>
  );
};

// Allocation Label Component
const AllocationLabel: React.FC<{
  label: string;
  percentage: number;
  color: string;
}> = ({ label, percentage, color }) => (
  <View style={styles.allocationLabelItem}>
    <View style={[styles.labelDot, { backgroundColor: color }]} />
    <Text style={styles.labelText}>
      {label} <Text style={[styles.labelPercentage, { color }]}>{percentage}%</Text>
    </Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background.primary,
  },
  confettiContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
  },
  confettiParticle: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 2,
  },
  content: {
    flex: 1,
    paddingHorizontal: LAYOUT.screenPaddingH,
    justifyContent: 'center',
  },
  successIconContainer: {
    alignItems: 'center',
    marginBottom: SPACING[6],
  },
  successCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.semantic.success,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.semantic.success,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 10,
  },
  checkmark: {
    fontSize: 48,
    color: COLORS.text.inverse,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },
  messageContainer: {
    alignItems: 'center',
    marginBottom: SPACING[6],
  },
  title: {
    fontSize: TYPOGRAPHY.fontSize['2xl'],
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text.primary,
    marginBottom: SPACING[2],
    textAlign: 'center',
  },
  subtitle: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text.secondary,
    textAlign: 'center',
  },
  summaryCard: {
    backgroundColor: COLORS.background.elevated,
    borderRadius: RADIUS.xl,
    padding: SPACING[5],
    marginBottom: SPACING[4],
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text.secondary,
  },
  summaryValue: {
    fontSize: TYPOGRAPHY.fontSize.xl,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text.primary,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: SPACING[4],
  },
  allocationSection: {},
  allocationTitle: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
    marginBottom: SPACING[3],
  },
  allocationBar: {
    height: 12,
    borderRadius: 6,
    flexDirection: 'row',
    overflow: 'hidden',
    marginBottom: SPACING[3],
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
    marginRight: SPACING[1],
  },
  labelText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.text.secondary,
  },
  labelPercentage: {
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },
  activityPreview: {
    backgroundColor: COLORS.background.elevated,
    borderRadius: RADIUS.xl,
    padding: SPACING[4],
  },
  activityTitle: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
    marginBottom: SPACING[3],
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  activityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: SPACING[3],
  },
  activityContent: {
    flex: 1,
  },
  activityMessage: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.primary,
    marginBottom: 2,
  },
  activityTime: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.text.muted,
  },
  activityBadge: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.boundary.safe,
    backgroundColor: `${COLORS.boundary.safe}15`,
    paddingHorizontal: SPACING[2],
    paddingVertical: SPACING[1],
    borderRadius: RADIUS.sm,
  },
  footer: {
    paddingHorizontal: LAYOUT.screenPaddingH,
    paddingBottom: LAYOUT.totalBottomSpace,
    paddingTop: SPACING[4],
  },
  arrowIcon: {
    fontSize: 18,
    color: COLORS.text.inverse,
  },
});

export default SuccessScreen;
