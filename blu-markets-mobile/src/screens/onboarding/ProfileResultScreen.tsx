// Profile Result Screen
// Based on PRD Section 5 - Shows risk profile with donut chart visualization
import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Dimensions,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { OnboardingStackParamList } from '../../navigation/types';
import { colors, typography, spacing, borderRadius } from '../../constants/theme';
import { useAppDispatch, useAppSelector } from '../../hooks/useStore';
import { setRiskProfile } from '../../store/slices/onboardingSlice';
import { calculateRiskProfile, formatAllocation } from '../../utils/riskProfile';

const { width } = Dimensions.get('window');

type ProfileResultScreenProps = {
  navigation: NativeStackNavigationProp<OnboardingStackParamList, 'ProfileResult'>;
};

const ProfileResultScreen: React.FC<ProfileResultScreenProps> = ({ navigation }) => {
  const dispatch = useAppDispatch();
  const answers = useAppSelector((state) => state.onboarding.answers);
  const riskProfile = useAppSelector((state) => state.onboarding.riskProfile);

  useEffect(() => {
    // Calculate risk profile from answers
    const profile = calculateRiskProfile(answers);
    dispatch(setRiskProfile(profile));
  }, [answers, dispatch]);

  if (!riskProfile) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Calculating your profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const allocation = formatAllocation(riskProfile.targetAllocation);

  return (
    <SafeAreaView style={styles.container}>
      {/* Back button */}
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => navigation.goBack()}
      >
        <Text style={styles.backButtonText}>← Back</Text>
      </TouchableOpacity>

      <View style={styles.content}>
        {/* Profile title in Farsi */}
        <View style={styles.header}>
          <Text style={styles.profileLabelFarsi}>
            شما یک سرمایه‌گذار {riskProfile.profileNameFarsi} هستید
          </Text>
          <Text style={styles.profileLabelEn}>
            You are a {riskProfile.profileName} investor
          </Text>
        </View>

        {/* Donut chart visualization */}
        <View style={styles.chartContainer}>
          <DonutChart
            foundation={riskProfile.targetAllocation.FOUNDATION}
            growth={riskProfile.targetAllocation.GROWTH}
            upside={riskProfile.targetAllocation.UPSIDE}
          />
          <View style={styles.chartCenter}>
            <Text style={styles.chartCenterScore}>{riskProfile.score}</Text>
            <Text style={styles.chartCenterLabel}>Risk Score</Text>
          </View>
        </View>

        {/* Allocation breakdown */}
        <View style={styles.allocationContainer}>
          <AllocationItem
            label="Foundation"
            labelFa="پایه"
            percentage={allocation.foundation}
            color={colors.layerFoundation}
            description="Stable assets for security"
          />
          <AllocationItem
            label="Growth"
            labelFa="رشد"
            percentage={allocation.growth}
            color={colors.layerGrowth}
            description="Balanced growth potential"
          />
          <AllocationItem
            label="Upside"
            labelFa="صعود"
            percentage={allocation.upside}
            color={colors.layerUpside}
            description="High-risk, high-reward"
          />
        </View>
      </View>

      {/* CTA Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.button}
          onPress={() => navigation.navigate('Consent')}
          activeOpacity={0.8}
        >
          <Text style={styles.buttonText}>This looks right</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

// Simple Donut Chart using Views
const DonutChart: React.FC<{
  foundation: number;
  growth: number;
  upside: number;
}> = ({ foundation, growth, upside }) => {
  const size = width * 0.6;
  const strokeWidth = 24;

  // Calculate angles
  const foundationAngle = foundation * 360;
  const growthAngle = growth * 360;
  const upsideAngle = upside * 360;

  return (
    <View style={[styles.donutContainer, { width: size, height: size }]}>
      {/* Foundation segment */}
      <View
        style={[
          styles.donutSegment,
          {
            width: size,
            height: size,
            borderWidth: strokeWidth,
            borderColor: colors.layerFoundation,
            borderRightColor: 'transparent',
            borderBottomColor: foundation > 0.25 ? colors.layerFoundation : 'transparent',
            transform: [{ rotate: '-45deg' }],
          },
        ]}
      />
      {/* Simplified visualization with stacked bar */}
      <View style={styles.donutOverlay}>
        <View style={[styles.donutBar, { backgroundColor: colors.layerFoundation, flex: foundation }]} />
        <View style={[styles.donutBar, { backgroundColor: colors.layerGrowth, flex: growth }]} />
        <View style={[styles.donutBar, { backgroundColor: colors.layerUpside, flex: upside }]} />
      </View>
    </View>
  );
};

const AllocationItem: React.FC<{
  label: string;
  labelFa: string;
  percentage: string;
  color: string;
  description: string;
}> = ({ label, labelFa, percentage, color, description }) => (
  <View style={styles.allocationItem}>
    <View style={[styles.allocationDot, { backgroundColor: color }]} />
    <View style={styles.allocationTextContainer}>
      <View style={styles.allocationHeader}>
        <Text style={styles.allocationLabel}>{label}</Text>
        <Text style={styles.allocationPercentage}>{percentage}</Text>
      </View>
      <Text style={styles.allocationDescription}>{description}</Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgDark,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: colors.textSecondary,
    fontSize: typography.fontSize.lg,
  },
  backButton: {
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[4],
  },
  backButtonText: {
    color: colors.textSecondary,
    fontSize: typography.fontSize.base,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing[6],
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing[8],
  },
  profileLabelFarsi: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimaryDark,
    textAlign: 'center',
    writingDirection: 'rtl',
    marginBottom: spacing[2],
  },
  profileLabelEn: {
    fontSize: typography.fontSize.base,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  chartContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[8],
    position: 'relative',
  },
  donutContainer: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  donutSegment: {
    position: 'absolute',
    borderRadius: 9999,
  },
  donutOverlay: {
    width: '80%',
    height: 16,
    borderRadius: 8,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  donutBar: {
    height: '100%',
  },
  chartCenter: {
    position: 'absolute',
    alignItems: 'center',
  },
  chartCenterScore: {
    fontSize: typography.fontSize['4xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimaryDark,
  },
  chartCenterLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
  },
  allocationContainer: {
    gap: spacing[4],
  },
  allocationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.cardDark,
    padding: spacing[4],
    borderRadius: borderRadius.default,
  },
  allocationDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: spacing[3],
    marginTop: 4,
  },
  allocationTextContainer: {
    flex: 1,
  },
  allocationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[1],
  },
  allocationLabel: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimaryDark,
  },
  allocationPercentage: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimaryDark,
  },
  allocationDescription: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
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

export default ProfileResultScreen;
