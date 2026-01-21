/**
 * ProfileResultScreen
 * Design System: Blu Markets
 * Target: iPhone 16 Pro (393 x 852)
 *
 * Shows calculated risk profile with donut chart visualization
 * Uses Foundation/Growth/Upside layer naming
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Dimensions,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { OnboardingStackParamList } from '../../navigation/types';
import { COLORS } from '../../constants/colors';
import { TYPOGRAPHY } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';
import { LAYOUT, DEVICE } from '../../constants/layout';
import { Button, Card } from '../../components/common';
import { useAppDispatch, useAppSelector } from '../../hooks/useStore';
import { setRiskProfile } from '../../store/slices/onboardingSlice';
import { formatAllocation } from '../../utils/riskProfile';
import { onboardingApi, QuestionnaireAnswer, ApiError } from '../../services/api';
import { QUESTIONS } from '../../constants/questionnaire';

const { width } = Dimensions.get('window');

type ProfileResultScreenProps = {
  navigation: NativeStackNavigationProp<OnboardingStackParamList, 'ProfileResult'>;
};

const ProfileResultScreen: React.FC<ProfileResultScreenProps> = ({ navigation }) => {
  const dispatch = useAppDispatch();
  const answers = useAppSelector((state) => state.onboarding.answers);
  const riskProfile = useAppSelector((state) => state.onboarding.riskProfile);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Submit questionnaire to backend
    const submitQuestionnaire = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Transform answers to backend format
        const apiAnswers: QuestionnaireAnswer[] = QUESTIONS.map((question) => {
          const optionIndex = answers[question.id] ?? 0;
          const option = question.options[optionIndex];
          return {
            questionId: question.id,
            answerId: String(optionIndex),
            value: option?.score ?? 5,
          };
        });

        const response = await onboardingApi.submitQuestionnaire(apiAnswers);

        // Map backend response to local format
        const profile = {
          score: response.riskScore,
          profileName: response.profileName,
          profileNameFarsi: getProfileNameFarsi(response.riskScore),
          targetAllocation: {
            FOUNDATION: response.targetAllocation.foundation,
            GROWTH: response.targetAllocation.growth,
            UPSIDE: response.targetAllocation.upside,
          },
        };

        dispatch(setRiskProfile(profile));
      } catch (err) {
        const apiError = err as ApiError;
        setError(apiError.message || 'Failed to calculate profile');
      } finally {
        setIsLoading(false);
      }
    };

    submitQuestionnaire();
  }, [answers, dispatch]);

  // Helper to get Farsi profile name
  function getProfileNameFarsi(score: number): string {
    if (score <= 2) return 'حفظ سرمایه';
    if (score <= 4) return 'محتاط';
    if (score <= 6) return 'متعادل';
    if (score <= 8) return 'رشدگرا';
    return 'جسور';
  }

  if (isLoading || !riskProfile) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.background.primary} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.brand.primary} />
          <Text style={styles.loadingText}>Calculating your profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.background.primary} />
        <View style={styles.loadingContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <Button
            label="Go Back"
            variant="primary"
            size="md"
            onPress={() => navigation.goBack()}
          />
        </View>
      </SafeAreaView>
    );
  }

  const allocation = formatAllocation(riskProfile.targetAllocation);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background.primary} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        {/* Profile title */}
        <View style={styles.titleContainer}>
          <Text style={styles.profileLabelFarsi}>
            شما یک سرمایه‌گذار {riskProfile.profileNameFarsi} هستید
          </Text>
          <Text style={styles.profileLabelEn}>
            You are a {riskProfile.profileName} investor
          </Text>
        </View>

        {/* Chart and score */}
        <View style={styles.chartContainer}>
          <AllocationBar
            foundation={riskProfile.targetAllocation.FOUNDATION}
            growth={riskProfile.targetAllocation.GROWTH}
            upside={riskProfile.targetAllocation.UPSIDE}
          />
          <View style={styles.scoreContainer}>
            <Text style={styles.scoreValue}>{riskProfile.score}</Text>
            <Text style={styles.scoreLabel}>Risk Score</Text>
          </View>
        </View>

        {/* Allocation breakdown */}
        <View style={styles.allocationContainer}>
          <AllocationItem
            label="Foundation"
            labelFa="پایه"
            percentage={allocation.foundation}
            color={COLORS.layers.foundation}
            description="Stable assets for security"
          />
          <AllocationItem
            label="Growth"
            labelFa="رشد"
            percentage={allocation.growth}
            color={COLORS.layers.growth}
            description="Balanced growth potential"
          />
          <AllocationItem
            label="Upside"
            labelFa="صعود"
            percentage={allocation.upside}
            color={COLORS.layers.upside}
            description="High-risk, high-reward"
          />
        </View>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Button
          label="This looks right"
          variant="primary"
          size="lg"
          fullWidth
          onPress={() => navigation.navigate('Consent')}
          icon={<Text style={styles.arrowIcon}>→</Text>}
          iconPosition="right"
        />
      </View>
    </SafeAreaView>
  );
};

// Allocation Bar Component
interface AllocationBarProps {
  foundation: number;
  growth: number;
  upside: number;
}

const AllocationBar: React.FC<AllocationBarProps> = ({ foundation, growth, upside }) => {
  return (
    <View style={styles.barContainer}>
      <View style={styles.barOuter}>
        <View
          style={[
            styles.barSegment,
            { backgroundColor: COLORS.layers.foundation, flex: foundation },
          ]}
        />
        <View
          style={[
            styles.barSegment,
            { backgroundColor: COLORS.layers.growth, flex: growth },
          ]}
        />
        <View
          style={[
            styles.barSegment,
            { backgroundColor: COLORS.layers.upside, flex: upside },
          ]}
        />
      </View>
      <View style={styles.barLabels}>
        <Text style={[styles.barLabel, { color: COLORS.layers.foundation }]}>
          {Math.round(foundation * 100)}%
        </Text>
        <Text style={[styles.barLabel, { color: COLORS.layers.growth }]}>
          {Math.round(growth * 100)}%
        </Text>
        <Text style={[styles.barLabel, { color: COLORS.layers.upside }]}>
          {Math.round(upside * 100)}%
        </Text>
      </View>
    </View>
  );
};

// Allocation Item Component
interface AllocationItemProps {
  label: string;
  labelFa: string;
  percentage: string;
  color: string;
  description: string;
}

const AllocationItem: React.FC<AllocationItemProps> = ({
  label,
  labelFa,
  percentage,
  color,
  description,
}) => (
  <View style={styles.allocationItem}>
    <View style={[styles.allocationDot, { backgroundColor: color }]} />
    <View style={styles.allocationTextContainer}>
      <View style={styles.allocationHeader}>
        <Text style={styles.allocationLabel}>{label}</Text>
        <Text style={[styles.allocationPercentage, { color }]}>{percentage}</Text>
      </View>
      <Text style={styles.allocationDescription}>{description}</Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background.primary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: LAYOUT.screenPaddingH,
  },
  loadingText: {
    color: COLORS.text.secondary,
    fontSize: TYPOGRAPHY.fontSize.lg,
    marginTop: SPACING[4],
  },
  errorText: {
    color: COLORS.semantic.error,
    fontSize: TYPOGRAPHY.fontSize.base,
    textAlign: 'center',
    marginBottom: SPACING[4],
  },
  header: {
    paddingHorizontal: LAYOUT.screenPaddingH,
    paddingTop: SPACING[2],
    paddingBottom: SPACING[4],
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.background.elevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backIcon: {
    fontSize: 20,
    color: COLORS.text.primary,
  },
  content: {
    flex: 1,
    paddingHorizontal: LAYOUT.screenPaddingH,
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: SPACING[6],
  },
  profileLabelFarsi: {
    fontSize: TYPOGRAPHY.fontSize.xl,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text.primary,
    textAlign: 'center',
    writingDirection: 'rtl',
    marginBottom: SPACING[2],
  },
  profileLabelEn: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text.secondary,
    textAlign: 'center',
  },
  chartContainer: {
    alignItems: 'center',
    marginBottom: SPACING[6],
    padding: SPACING[5],
    backgroundColor: COLORS.background.elevated,
    borderRadius: RADIUS.xl,
  },
  barContainer: {
    width: '100%',
    marginBottom: SPACING[4],
  },
  barOuter: {
    height: 24,
    borderRadius: RADIUS.md,
    flexDirection: 'row',
    overflow: 'hidden',
    marginBottom: SPACING[2],
  },
  barSegment: {
    height: '100%',
  },
  barLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  barLabel: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },
  scoreContainer: {
    alignItems: 'center',
    marginTop: SPACING[2],
  },
  scoreValue: {
    fontSize: 48,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text.primary,
  },
  scoreLabel: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.muted,
  },
  allocationContainer: {
    gap: SPACING[3],
  },
  allocationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.background.elevated,
    padding: SPACING[4],
    borderRadius: RADIUS.lg,
  },
  allocationDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: SPACING[3],
    marginTop: 4,
  },
  allocationTextContainer: {
    flex: 1,
  },
  allocationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING[1],
  },
  allocationLabel: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.primary,
  },
  allocationPercentage: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },
  allocationDescription: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
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

export default ProfileResultScreen;
