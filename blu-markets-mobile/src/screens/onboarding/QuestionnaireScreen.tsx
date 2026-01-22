/**
 * QuestionnaireScreen - Simplified for performance
 * Works both for onboarding and retaking quiz from profile
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, CommonActions } from '@react-navigation/native';
import { QUESTIONS } from '../../constants/questionnaire';
import { calculateRiskScore } from '../../utils/riskCalculation';
import { useAppDispatch } from '../../hooks/useStore';
import { setRiskProfile, setTargetLayerPct } from '../../store/slices/portfolioSlice';
import { riskScoreToTargetAllocation } from '../../constants/business';

type Props = {
  navigation?: any;
};

const QuestionnaireScreen: React.FC<Props> = ({ navigation: propNavigation }) => {
  const navigation = useNavigation();
  const route = useRoute();
  const dispatch = useAppDispatch();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [isNavigating, setIsNavigating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Check if this is a retake quiz (accessed from RetakeQuiz route)
  const isRetakeMode = route.name === 'RetakeQuiz';

  useEffect(() => {
    console.log('[Questionnaire] Component MOUNTED, isRetakeMode:', isRetakeMode);
    return () => console.log('[Questionnaire] Component UNMOUNTED');
  }, [isRetakeMode]);

  const question = QUESTIONS[currentIndex];

  const handleRetakeComplete = async (answersObj: Record<string, number>) => {
    setIsSubmitting(true);
    try {
      // Import onboarding API
      const { onboarding } = await import('../../services/api');

      // Format answers for backend API
      const formattedAnswers = QUESTIONS.map((q) => {
        const optionIndex = answersObj[q.id] ?? 0;
        const option = q.options[optionIndex];
        return {
          questionId: q.id,
          answerId: `option_${optionIndex}`,
          value: option?.score ?? 1,
          flag: option?.flag,
        };
      });

      console.log('[Questionnaire] Submitting retake quiz to API...');
      const response = await onboarding.submitQuestionnaire(formattedAnswers);

      // Normalize allocation values
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

      // Update portfolio slice with new risk profile
      dispatch(setRiskProfile({ riskScore, riskProfileName: profileName }));
      dispatch(setTargetLayerPct(normalizedAllocation));

      // Show success message
      Alert.alert(
        'Profile Updated',
        `Your risk profile has been updated to ${profileName} (Score: ${riskScore}).`,
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      console.error('[Questionnaire] Retake quiz submission failed:', error);
      Alert.alert('Error', 'Failed to update profile. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOption = (optionIdx: number) => {
    if (isNavigating || isSubmitting) return;

    console.log(`[Questionnaire] Selected option ${optionIdx} for question ${currentIndex + 1}/${QUESTIONS.length}`);

    const newAnswers = [...answers, optionIdx];
    setAnswers(newAnswers);

    if (currentIndex >= QUESTIONS.length - 1) {
      // Last question
      setIsNavigating(true);
      console.log('[Questionnaire] Last question answered, navigating...');

      const answersObj: Record<string, number> = {};
      QUESTIONS.forEach((q, i) => {
        answersObj[q.id] = newAnswers[i] ?? 0;
      });

      if (isRetakeMode) {
        // Handle retake mode - update profile and go back
        handleRetakeComplete(answersObj);
      } else {
        // Normal onboarding flow - go to ProfileResult
        (propNavigation || navigation).dispatch(
          CommonActions.navigate('ProfileResult', { answers: answersObj })
        );
      }
    } else {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handleBack = () => {
    if (currentIndex > 0 && !isNavigating && !isSubmitting) {
      setCurrentIndex(currentIndex - 1);
      setAnswers(answers.slice(0, -1));
    } else if (currentIndex === 0 && isRetakeMode) {
      // Allow going back to profile from first question in retake mode
      navigation.goBack();
    }
  };

  if (!question) return null;

  // Show loading state when submitting retake quiz
  if (isSubmitting) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Updating your profile...</Text>
          <Text style={styles.loadingSubtext}>در حال به‌روزرسانی پروفایل...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header for retake mode */}
      {isRetakeMode && (
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeButton}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Retake Risk Quiz</Text>
          <View style={styles.headerSpacer} />
        </View>
      )}

      <Text style={styles.progress}>{currentIndex + 1} / {QUESTIONS.length}</Text>
      <Text style={styles.question}>{question.question}</Text>

      {question.options.map((opt, i) => (
        <TouchableOpacity
          key={i}
          style={styles.option}
          onPress={() => handleOption(i)}
          activeOpacity={0.7}
          disabled={isNavigating || isSubmitting}
        >
          <Text style={styles.optionText}>{opt.label}</Text>
        </TouchableOpacity>
      ))}

      {(currentIndex > 0 || isRetakeMode) && (
        <TouchableOpacity style={styles.back} onPress={handleBack} disabled={isNavigating || isSubmitting}>
          <Text style={styles.backText}>
            {currentIndex === 0 ? 'انصراف - Cancel' : 'بازگشت - Back'}
          </Text>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0f', padding: 20 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    marginTop: -10,
  },
  closeButton: { padding: 8 },
  closeText: { fontSize: 20, color: '#888' },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#fff' },
  headerSpacer: { width: 36 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#fff', fontSize: 18, marginBottom: 8 },
  loadingSubtext: { color: '#888', fontSize: 14 },
  progress: { color: '#888', fontSize: 14, marginBottom: 20 },
  question: { color: '#fff', fontSize: 18, marginBottom: 30, lineHeight: 28 },
  option: {
    backgroundColor: '#1a1a2e',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
  },
  optionText: { color: '#fff', fontSize: 16 },
  back: { marginTop: 20, padding: 12 },
  backText: { color: '#3b82f6', fontSize: 16, textAlign: 'center' },
});

export default QuestionnaireScreen;
