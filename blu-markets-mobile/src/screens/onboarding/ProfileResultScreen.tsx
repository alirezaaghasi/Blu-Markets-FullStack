/**
 * ProfileResultScreen - Risk Profile Result
 * Redesigned per Blu Markets Guidelines for Communicating Risk Profile
 *
 * Key Changes:
 * - System attribution language ("Based on your answers...")
 * - No identity labels ("You are a Balanced investor" removed)
 * - Explicit tradeoffs shown
 * - Flexibility disclaimer
 * - "Let's go!" CTA instead of "This looks right"
 */

import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { OnboardingStackParamList } from '../../navigation/types';
import { COLORS } from '../../constants/colors';
import { TYPOGRAPHY } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';
import { LAYOUT } from '../../constants/layout';
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
  targetAllocation: {
    FOUNDATION: number;
    GROWTH: number;
    UPSIDE: number;
  };
}

interface Tradeoffs {
  prioritizes: string[];
  sacrifices: string[];
}

// Get tradeoffs based on allocation (per Blu Markets Guidelines §3.3)
function getTradeoffs(foundationPct: number): Tradeoffs {
  if (foundationPct >= 0.60) {
    // Conservative
    return {
      prioritizes: [
        'Lower short-term volatility',
        'Capital preservation during downturns',
        'Steady, predictable behavior',
      ],
      sacrifices: [
        'Upside during strong bull markets',
        'Faster recovery after market rallies',
        'Higher long-term growth potential',
      ],
    };
  } else if (foundationPct >= 0.40) {
    // Balanced
    return {
      prioritizes: [
        'Balance between stability and growth',
        'Moderate protection during downturns',
        'Participation in market upside',
      ],
      sacrifices: [
        'Maximum upside in strong bull markets',
        'Full capital preservation in crashes',
      ],
    };
  } else {
    // Growth-oriented
    return {
      prioritizes: [
        'Higher long-term growth potential',
        'Full participation in bull markets',
        'Faster recovery and compounding',
      ],
      sacrifices: [
        'Short-term stability',
        'Capital preservation during volatility',
        'Predictable portfolio behavior',
      ],
    };
  }
}

const ProfileResultScreen: React.FC<ProfileResultScreenProps> = ({ navigation, route }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<RiskProfileData | null>(null);
  const hasSubmittedRef = useRef(false);

  const answersFromParams = route.params?.answers;

  useEffect(() => {
    if (hasSubmittedRef.current) return;

    if (!answersFromParams) {
      setError('No questionnaire answers found');
      setIsLoading(false);
      return;
    }

    hasSubmittedRef.current = true;

    const submitQuestionnaire = async () => {
      try {
        const formattedAnswers = QUESTIONS.map((q) => {
          const optionIndex = answersFromParams[q.id] ?? 0;
          const option = q.options[optionIndex];
          return {
            questionId: q.id,
            answerId: `option_${optionIndex}`,
            value: option?.score ?? 1,
            flag: option?.flag,
          };
        });

        const response = await onboarding.submitQuestionnaire(formattedAnswers);

        const allocation = (response as any).targetAllocation || {};
        const normalizeValue = (val: number | undefined): number => {
          if (val === undefined) return 0;
          return val > 1 ? val / 100 : val;
        };

        const normalizedAllocation = {
          FOUNDATION: normalizeValue(allocation.FOUNDATION ?? allocation.foundation),
          GROWTH: normalizeValue(allocation.GROWTH ?? allocation.growth),
          UPSIDE: normalizeValue(allocation.UPSIDE ?? allocation.upside),
        };

        const riskScore = (response as any).riskScore ?? (response as any).score ?? 5;
        const profileName = (response as any).profileName ?? 'Balanced';

        const profileData: RiskProfileData = {
          score: riskScore,
          profileName: profileName,
          targetAllocation: normalizedAllocation,
        };

        store.dispatch(setRiskProfile({
          ...profileData,
          profileNameFarsi: '', // Not used in new design
        }));

        setProfile(profileData);
        setIsLoading(false);
      } catch (err) {
        console.error('[ProfileResult] API error:', err);
        setError('Failed to calculate profile. Please try again.');
        setIsLoading(false);
      }
    };

    submitQuestionnaire();
  }, [answersFromParams]);

  const handleContinue = () => {
    navigation.navigate('Consent');
  };

  const handleBack = () => {
    navigation.goBack();
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.background.primary} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.brand.primary} />
          <Text style={styles.loadingText}>Analyzing your answers...</Text>
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
          <TouchableOpacity style={styles.retryButton} onPress={() => navigation.goBack()}>
            <Text style={styles.retryButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!profile) return null;

  const allocation = profile.targetAllocation;
  const tradeoffs = getTradeoffs(allocation.FOUNDATION);
  const foundationPct = Math.round(allocation.FOUNDATION * 100);
  const growthPct = Math.round(allocation.GROWTH * 100);
  const upsidePct = Math.round(allocation.UPSIDE * 100);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background.primary} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* System Attribution Header (per §2.1) */}
        <View style={styles.introSection}>
          <Text style={styles.introText}>
            Based on your answers, here's how the system would allocate your portfolio:
          </Text>
        </View>

        {/* Understanding the Layers */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>UNDERSTANDING THE LAYERS</Text>
          <Text style={styles.cardDescription}>
            We classify assets into three layers based on their risk characteristics and price fluctuations:
          </Text>

          <View style={styles.layerExplanation}>
            <View style={styles.layerRow}>
              <View style={[styles.layerDot, { backgroundColor: COLORS.layers.foundation }]} />
              <View style={styles.layerInfo}>
                <Text style={styles.layerName}>Foundation</Text>
                <Text style={styles.layerDesc}>Stable assets with lower volatility</Text>
              </View>
            </View>

            <View style={styles.layerRow}>
              <View style={[styles.layerDot, { backgroundColor: COLORS.layers.growth }]} />
              <View style={styles.layerInfo}>
                <Text style={styles.layerName}>Growth</Text>
                <Text style={styles.layerDesc}>Moderate risk with growth potential</Text>
              </View>
            </View>

            <View style={styles.layerRow}>
              <View style={[styles.layerDot, { backgroundColor: COLORS.layers.upside }]} />
              <View style={styles.layerInfo}>
                <Text style={styles.layerName}>Upside</Text>
                <Text style={styles.layerDesc}>Higher risk, higher potential reward</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Suggested Allocation */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>YOUR SUGGESTED ALLOCATION</Text>

          {/* Allocation Bar */}
          <View style={styles.allocationBar}>
            <View
              style={[
                styles.barSegment,
                {
                  flex: allocation.FOUNDATION,
                  backgroundColor: COLORS.layers.foundation,
                  borderTopLeftRadius: 6,
                  borderBottomLeftRadius: 6,
                },
              ]}
            />
            <View
              style={[
                styles.barSegment,
                { flex: allocation.GROWTH, backgroundColor: COLORS.layers.growth },
              ]}
            />
            <View
              style={[
                styles.barSegment,
                {
                  flex: allocation.UPSIDE,
                  backgroundColor: COLORS.layers.upside,
                  borderTopRightRadius: 6,
                  borderBottomRightRadius: 6,
                },
              ]}
            />
          </View>

          {/* Allocation Details */}
          <View style={styles.allocationDetails}>
            <View style={styles.allocationRow}>
              <View style={styles.allocationLeft}>
                <View style={[styles.allocationDot, { backgroundColor: COLORS.layers.foundation }]} />
                <Text style={styles.allocationLabel}>Foundation</Text>
              </View>
              <Text style={[styles.allocationPercent, { color: COLORS.layers.foundation }]}>
                {foundationPct}%
              </Text>
            </View>

            <View style={styles.allocationRow}>
              <View style={styles.allocationLeft}>
                <View style={[styles.allocationDot, { backgroundColor: COLORS.layers.growth }]} />
                <Text style={styles.allocationLabel}>Growth</Text>
              </View>
              <Text style={[styles.allocationPercent, { color: COLORS.layers.growth }]}>
                {growthPct}%
              </Text>
            </View>

            <View style={styles.allocationRow}>
              <View style={styles.allocationLeft}>
                <View style={[styles.allocationDot, { backgroundColor: COLORS.layers.upside }]} />
                <Text style={styles.allocationLabel}>Upside</Text>
              </View>
              <Text style={[styles.allocationPercent, { color: COLORS.layers.upside }]}>
                {upsidePct}%
              </Text>
            </View>
          </View>
        </View>

        {/* Tradeoffs (per §3.3 - CRITICAL) */}
        <View style={styles.card}>
          <View style={styles.tradeoffSection}>
            <Text style={styles.tradeoffTitle}>WHAT THIS PRIORITIZES</Text>
            {tradeoffs.prioritizes.map((item, index) => (
              <View key={index} style={styles.tradeoffRow}>
                <Text style={styles.tradeoffIconPositive}>✓</Text>
                <Text style={styles.tradeoffText}>{item}</Text>
              </View>
            ))}
          </View>

          <View style={styles.tradeoffDivider} />

          <View style={styles.tradeoffSection}>
            <Text style={styles.tradeoffTitle}>WHAT THIS TRADES OFF</Text>
            {tradeoffs.sacrifices.map((item, index) => (
              <View key={index} style={styles.tradeoffRow}>
                <Text style={styles.tradeoffIconNegative}>○</Text>
                <Text style={styles.tradeoffText}>{item}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Disclaimer / Flexibility Statement (per §4) */}
        <View style={styles.disclaimerCard}>
          <Text style={styles.disclaimerIcon}>ⓘ</Text>
          <Text style={styles.disclaimerText}>
            This is the system's current interpretation — not a fixed profile. You can change this allocation at any time.
          </Text>
        </View>
      </ScrollView>

      {/* Footer Buttons */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={handleContinue}
          activeOpacity={0.8}
        >
          <Text style={styles.primaryButtonText}>Let's go!</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background.primary,
  },

  // Loading & Error
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
  errorText: {
    color: COLORS.semantic.error,
    fontSize: TYPOGRAPHY.fontSize.base,
    textAlign: 'center',
    marginBottom: SPACING[4],
  },
  retryButton: {
    backgroundColor: COLORS.brand.primary,
    paddingHorizontal: SPACING[6],
    paddingVertical: SPACING[3],
    borderRadius: RADIUS.full,
  },
  retryButtonText: {
    color: COLORS.text.inverse,
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: '600',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING[4],
    paddingVertical: SPACING[3],
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.background.elevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backIcon: {
    fontSize: 20,
    color: COLORS.text.primary,
  },

  // ScrollView
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: SPACING[5],
    paddingBottom: SPACING[4],
  },

  // Intro Section
  introSection: {
    marginBottom: SPACING[5],
  },
  introText: {
    fontSize: TYPOGRAPHY.fontSize.xl,
    fontWeight: '600',
    color: COLORS.text.primary,
    lineHeight: 28,
  },

  // Card
  card: {
    backgroundColor: COLORS.background.elevated,
    borderRadius: RADIUS.lg,
    padding: SPACING[4],
    marginBottom: SPACING[4],
  },
  cardTitle: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: '600',
    color: COLORS.text.secondary,
    letterSpacing: 1,
    marginBottom: SPACING[3],
  },
  cardDescription: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
    lineHeight: 20,
    marginBottom: SPACING[4],
  },

  // Layer Explanation
  layerExplanation: {
    gap: SPACING[3],
  },
  layerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  layerDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 4,
    marginRight: SPACING[3],
  },
  layerInfo: {
    flex: 1,
  },
  layerName: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: '600',
    color: COLORS.text.primary,
    marginBottom: 2,
  },
  layerDesc: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
  },

  // Allocation Bar
  allocationBar: {
    flexDirection: 'row',
    height: 12,
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: SPACING[4],
  },
  barSegment: {
    height: '100%',
  },

  // Allocation Details
  allocationDetails: {
    gap: SPACING[3],
  },
  allocationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  allocationLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  allocationDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: SPACING[2],
  },
  allocationLabel: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text.primary,
  },
  allocationPercent: {
    fontSize: TYPOGRAPHY.fontSize.xl,
    fontWeight: '700',
  },

  // Tradeoffs
  tradeoffSection: {
    paddingVertical: SPACING[2],
  },
  tradeoffTitle: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: '600',
    color: COLORS.text.secondary,
    letterSpacing: 0.5,
    marginBottom: SPACING[3],
  },
  tradeoffRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: SPACING[2],
  },
  tradeoffIconPositive: {
    fontSize: 14,
    color: COLORS.semantic.success,
    marginRight: SPACING[2],
    marginTop: 2,
  },
  tradeoffIconNegative: {
    fontSize: 14,
    color: COLORS.text.muted,
    marginRight: SPACING[2],
    marginTop: 2,
  },
  tradeoffText: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
    lineHeight: 20,
  },
  tradeoffDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: SPACING[3],
  },

  // Disclaimer
  disclaimerCard: {
    flexDirection: 'row',
    backgroundColor: `${COLORS.brand.primary}10`,
    borderRadius: RADIUS.lg,
    padding: SPACING[4],
    marginBottom: SPACING[2],
  },
  disclaimerIcon: {
    fontSize: 16,
    color: COLORS.brand.primary,
    marginRight: SPACING[3],
    marginTop: 2,
  },
  disclaimerText: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
    lineHeight: 20,
  },

  // Footer
  footer: {
    paddingHorizontal: SPACING[5],
    paddingTop: SPACING[3],
    paddingBottom: SPACING[6],
  },
  primaryButton: {
    backgroundColor: COLORS.brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING[4],
    borderRadius: RADIUS.full,
  },
  primaryButtonText: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: '600',
    color: COLORS.text.inverse,
  },
});

export default ProfileResultScreen;
