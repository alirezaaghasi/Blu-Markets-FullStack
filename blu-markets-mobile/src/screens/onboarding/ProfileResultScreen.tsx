/**
 * ProfileResultScreen
 * Simplified version to avoid infinite render loops
 */

import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { OnboardingStackParamList } from '../../navigation/types';
import { COLORS } from '../../constants/colors';
import { TYPOGRAPHY } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';
import { LAYOUT } from '../../constants/layout';
import { Button } from '../../components/common';
import { store } from '../../store';
import { setRiskProfile } from '../../store/slices/onboardingSlice';
import { onboarding } from '../../services/api';
import { QUESTIONS } from '../../constants/questionnaire';

type ProfileResultScreenProps = {
  navigation: NativeStackNavigationProp<OnboardingStackParamList, 'ProfileResult'>;
  route: RouteProp<OnboardingStackParamList, 'ProfileResult'>;
};

interface RiskProfileData {
  score: number;
  profileName: string;
  profileNameFarsi: string;
  targetAllocation: {
    FOUNDATION: number;
    GROWTH: number;
    UPSIDE: number;
  };
}

const ProfileResultScreen: React.FC<ProfileResultScreenProps> = ({ navigation, route }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<RiskProfileData | null>(null);
  const hasSubmittedRef = useRef(false);

  // Get answers from route params (passed from QuestionnaireScreen)
  const answersFromParams = route.params?.answers;

  // Helper to get Farsi profile name
  function getProfileNameFarsi(score: number): string {
    if (score <= 2) return 'حفظ سرمایه';
    if (score <= 4) return 'محتاط';
    if (score <= 6) return 'متعادل';
    if (score <= 8) return 'رشدگرا';
    return 'جسور';
  }

  useEffect(() => {
    // Prevent double submission
    if (hasSubmittedRef.current) {
      console.log('[ProfileResult] Already submitted, skipping');
      return;
    }

    if (!answersFromParams) {
      console.log('[ProfileResult] No answers from params');
      setError('No questionnaire answers found');
      setIsLoading(false);
      return;
    }

    hasSubmittedRef.current = true;

    const submitQuestionnaire = async () => {
      try {
        console.log('[ProfileResult] Starting questionnaire submission...');

        // Format answers for backend API
        // Use score from options (scores are 1-10 range, satisfies backend's value >= 1 requirement)
        const formattedAnswers = QUESTIONS.map((q) => {
          const optionIndex = answersFromParams[q.id] ?? 0;
          const option = q.options[optionIndex];
          return {
            questionId: q.id,
            answerId: `option_${optionIndex}`,
            value: option?.score ?? 1, // Use score, fallback to 1 if undefined
          };
        });

        console.log('[ProfileResult] Calling API with', formattedAnswers.length, 'answers');
        console.log('[ProfileResult] Answers:', JSON.stringify(formattedAnswers));
        const response = await onboarding.submitQuestionnaire(formattedAnswers);
        console.log('[ProfileResult] API response received:', JSON.stringify(response).substring(0, 100));

        // Normalize backend response:
        // - Backend uses lowercase keys (foundation, growth, upside)
        // - Backend uses integer percentages (85, 12, 3)
        // - Frontend expects UPPERCASE keys and decimal fractions (0.85, 0.12, 0.03)
        const allocation = (response as any).targetAllocation || {};
        const normalizeValue = (val: number | undefined): number => {
          if (val === undefined) return 0;
          return val > 1 ? val / 100 : val; // Convert integers to decimals
        };

        const normalizedAllocation = {
          FOUNDATION: normalizeValue(allocation.FOUNDATION ?? allocation.foundation),
          GROWTH: normalizeValue(allocation.GROWTH ?? allocation.growth),
          UPSIDE: normalizeValue(allocation.UPSIDE ?? allocation.upside),
        };

        const riskScore = (response as any).riskScore ?? response.score ?? 5;
        const profileName = (response as any).profileName ?? 'Balanced';

        const profileData: RiskProfileData = {
          score: riskScore,
          profileName: profileName,
          profileNameFarsi: getProfileNameFarsi(riskScore),
          targetAllocation: normalizedAllocation,
        };

        console.log('[ProfileResult] Normalized profile:', profileData);

        // Store in Redux
        store.dispatch(setRiskProfile(profileData));

        // Update local state
        setProfile(profileData);
        setIsLoading(false);
      } catch (err) {
        console.error('[ProfileResult] API error:', err);
        setError('Failed to calculate profile. Please try again.');
        setIsLoading(false);
      }
    };

    submitQuestionnaire();
  }, [answersFromParams]); // Only depends on answers from params

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.background.primary} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.brand.primary} />
          <Text style={styles.loadingText}>محاسبه پروفایل شما...</Text>
          <Text style={styles.loadingSubtext}>Calculating your profile...</Text>
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
            label="بازگشت - Go Back"
            variant="primary"
            size="md"
            onPress={() => navigation.goBack()}
          />
        </View>
      </SafeAreaView>
    );
  }

  if (!profile) {
    return null;
  }

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
            شما یک سرمایه‌گذار {profile.profileNameFarsi} هستید
          </Text>
          <Text style={styles.profileLabelEn}>
            You are a {profile.profileName} investor
          </Text>
        </View>

        {/* Allocation Bar */}
        <View style={styles.chartContainer}>
          <View style={styles.barOuter}>
            <View
              style={[
                styles.barSegment,
                { backgroundColor: COLORS.layers.foundation, flex: profile.targetAllocation.FOUNDATION },
              ]}
            />
            <View
              style={[
                styles.barSegment,
                { backgroundColor: COLORS.layers.growth, flex: profile.targetAllocation.GROWTH },
              ]}
            />
            <View
              style={[
                styles.barSegment,
                { backgroundColor: COLORS.layers.upside, flex: profile.targetAllocation.UPSIDE },
              ]}
            />
          </View>
          <View style={styles.barLabels}>
            <Text style={[styles.barLabel, { color: COLORS.layers.foundation }]}>
              {Math.round(profile.targetAllocation.FOUNDATION * 100)}%
            </Text>
            <Text style={[styles.barLabel, { color: COLORS.layers.growth }]}>
              {Math.round(profile.targetAllocation.GROWTH * 100)}%
            </Text>
            <Text style={[styles.barLabel, { color: COLORS.layers.upside }]}>
              {Math.round(profile.targetAllocation.UPSIDE * 100)}%
            </Text>
          </View>

          <View style={styles.scoreContainer}>
            <Text style={styles.scoreValue}>{profile.score}</Text>
            <Text style={styles.scoreLabel}>Risk Score</Text>
          </View>
        </View>

        {/* Allocation breakdown */}
        <View style={styles.allocationContainer}>
          <View style={styles.allocationItem}>
            <View style={[styles.allocationDot, { backgroundColor: COLORS.layers.foundation }]} />
            <View style={styles.allocationTextContainer}>
              <Text style={styles.allocationLabel}>Foundation (پایه)</Text>
              <Text style={styles.allocationDescription}>Stable assets for security</Text>
            </View>
            <Text style={[styles.allocationPercentage, { color: COLORS.layers.foundation }]}>
              {Math.round(profile.targetAllocation.FOUNDATION * 100)}%
            </Text>
          </View>

          <View style={styles.allocationItem}>
            <View style={[styles.allocationDot, { backgroundColor: COLORS.layers.growth }]} />
            <View style={styles.allocationTextContainer}>
              <Text style={styles.allocationLabel}>Growth (رشد)</Text>
              <Text style={styles.allocationDescription}>Balanced growth potential</Text>
            </View>
            <Text style={[styles.allocationPercentage, { color: COLORS.layers.growth }]}>
              {Math.round(profile.targetAllocation.GROWTH * 100)}%
            </Text>
          </View>

          <View style={styles.allocationItem}>
            <View style={[styles.allocationDot, { backgroundColor: COLORS.layers.upside }]} />
            <View style={styles.allocationTextContainer}>
              <Text style={styles.allocationLabel}>Upside (صعود)</Text>
              <Text style={styles.allocationDescription}>High-risk, high-reward</Text>
            </View>
            <Text style={[styles.allocationPercentage, { color: COLORS.layers.upside }]}>
              {Math.round(profile.targetAllocation.UPSIDE * 100)}%
            </Text>
          </View>
        </View>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Button
          label="این درسته - This looks right →"
          variant="primary"
          size="lg"
          fullWidth
          onPress={() => navigation.navigate('Consent')}
        />
      </View>
    </SafeAreaView>
  );
};

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
    color: COLORS.text.primary,
    fontSize: TYPOGRAPHY.fontSize.lg,
    marginTop: SPACING[4],
    textAlign: 'center',
  },
  loadingSubtext: {
    color: COLORS.text.secondary,
    fontSize: TYPOGRAPHY.fontSize.base,
    marginTop: SPACING[2],
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
  barOuter: {
    width: '100%',
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
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING[4],
  },
  barLabel: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },
  scoreContainer: {
    alignItems: 'center',
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
    alignItems: 'center',
    backgroundColor: COLORS.background.elevated,
    padding: SPACING[4],
    borderRadius: RADIUS.lg,
  },
  allocationDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: SPACING[3],
  },
  allocationTextContainer: {
    flex: 1,
  },
  allocationLabel: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.primary,
    marginBottom: SPACING[1],
  },
  allocationDescription: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
  },
  allocationPercentage: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },
  footer: {
    paddingHorizontal: LAYOUT.screenPaddingH,
    paddingBottom: LAYOUT.totalBottomSpace,
    paddingTop: SPACING[4],
  },
});

export default ProfileResultScreen;
