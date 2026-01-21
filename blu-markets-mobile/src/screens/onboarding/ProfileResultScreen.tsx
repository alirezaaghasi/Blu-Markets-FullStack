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
  SafeAreaView,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
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
    if (hasSubmittedRef.current) return;
    hasSubmittedRef.current = true;

    const submitQuestionnaire = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Use answers from route params (avoids Redux entirely)
        const answers = answersFromParams || {};

        // Transform answers to backend format (array of { questionId, answerId, value })
        const apiAnswers = QUESTIONS.map((question) => {
          const optionIndex = answers[question.id] ?? 0;
          const option = question.options[optionIndex];
          return {
            questionId: question.id,
            answerId: `option_${optionIndex}`,
            value: option?.score ?? 5,
          };
        });

        const response = await onboarding.submitQuestionnaire(apiAnswers);

        // Build profile data (handle both mock and real API response formats)
        // Backend returns lowercase keys, mock returns UPPERCASE - handle both
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const allocation = response.targetAllocation as any;
        const profileData: RiskProfileData = {
          score: response.riskScore,
          profileName: response.profileName || response.riskProfile?.name || 'Balanced',
          profileNameFarsi: response.riskProfile?.nameFa || getProfileNameFarsi(response.riskScore),
          targetAllocation: {
            FOUNDATION: allocation.FOUNDATION ?? allocation.foundation ?? 0.5,
            GROWTH: allocation.GROWTH ?? allocation.growth ?? 0.35,
            UPSIDE: allocation.UPSIDE ?? allocation.upside ?? 0.15,
          },
        };

        // Update local state
        setProfile(profileData);

        // Also save to Redux for later use
        store.dispatch(setRiskProfile(profileData));
      } catch (err: unknown) {
        let errorMessage = 'Failed to calculate profile';
        if (err instanceof Error) {
          errorMessage = err.message;
        } else if (err && typeof err === 'object' && 'message' in err) {
          errorMessage = String((err as { message: unknown }).message);
        }
        setError(errorMessage);
      } finally {
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
