/**
 * QuestionnaireScreen - Risk Assessment Quiz
 * Features: Visual progress bar, RTL support, selection indicators
 * Works both for onboarding and retaking quiz from profile
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, CommonActions } from '@react-navigation/native';
import { COLORS } from '../../constants/colors';
import { TYPOGRAPHY } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';
import { QUESTIONS } from '../../constants/questionnaire';
import { useAppDispatch } from '../../hooks/useStore';
import { setRiskProfile, setTargetLayerPct } from '../../store/slices/portfolioSlice';
import { containsPersian } from '../../components/RTLText';

type Props = {
  navigation?: any;
};

const QuestionnaireScreen: React.FC<Props> = ({ navigation: propNavigation }) => {
  const navigation = useNavigation();
  const route = useRoute();
  const dispatch = useAppDispatch();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Check if this is a retake quiz (accessed from RetakeQuiz route)
  const isRetakeMode = route.name === 'RetakeQuiz';

  const question = QUESTIONS[currentIndex];
  const totalQuestions = QUESTIONS.length;
  const progress = ((currentIndex + 1) / totalQuestions) * 100;

  // Check if text contains Persian characters
  const questionIsPersian = containsPersian(question?.question);

  const handleRetakeComplete = async (answersObj: Record<string, number>) => {
    setIsSubmitting(true);
    try {
      const { onboarding } = await import('../../services/api');

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

      const response = await onboarding.submitQuestionnaire(formattedAnswers);

      // API returns properly typed QuestionnaireResponse with normalized allocation
      const { riskScore, profileName, targetAllocation } = response;

      dispatch(setRiskProfile({ riskScore, riskProfileName: profileName }));
      dispatch(setTargetLayerPct(targetAllocation));

      Alert.alert(
        'Profile Updated',
        `Your risk profile has been updated to ${profileName} (Score: ${riskScore}).`,
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      if (__DEV__) console.error('[Questionnaire] Retake quiz submission failed:', error);
      Alert.alert('Error', 'Failed to update profile. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSelectOption = (optionIdx: number) => {
    if (isNavigating || isSubmitting) return;
    setSelectedOption(optionIdx);
  };

  const handleNext = () => {
    if (selectedOption === null || isNavigating || isSubmitting) return;

    const newAnswers = [...answers, selectedOption];
    setAnswers(newAnswers);

    if (currentIndex >= QUESTIONS.length - 1) {
      setIsNavigating(true);

      const answersObj: Record<string, number> = {};
      QUESTIONS.forEach((q, i) => {
        answersObj[q.id] = newAnswers[i] ?? 0;
      });

      if (isRetakeMode) {
        handleRetakeComplete(answersObj);
      } else {
        (propNavigation || navigation).dispatch(
          CommonActions.navigate('ProfileResult', { answers: answersObj })
        );
      }
    } else {
      setCurrentIndex(currentIndex + 1);
      setSelectedOption(null);
    }
  };

  const handleBack = () => {
    if (isNavigating || isSubmitting) return;

    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setAnswers(answers.slice(0, -1));
      setSelectedOption(answers[currentIndex - 1] ?? null);
    } else if (isRetakeMode) {
      navigation.goBack();
    }
  };

  if (!question) return null;

  // Loading state for retake submission
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
      {/* Header with Progress */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={handleBack}
          style={styles.backButton}
          disabled={currentIndex === 0 && !isRetakeMode}
        >
          <Text style={[
            styles.backIcon,
            (currentIndex === 0 && !isRetakeMode) && styles.backIconDisabled,
          ]}>
            ←
          </Text>
        </TouchableOpacity>

        <View style={styles.progressContainer}>
          <View style={styles.progressBarBackground}>
            <View style={[styles.progressBarFill, { width: `${progress}%` }]} />
          </View>
          <Text style={styles.progressText}>
            {currentIndex + 1} / {totalQuestions}
          </Text>
        </View>

        {isRetakeMode ? (
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeButton}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.headerSpacer} />
        )}
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Question */}
        <View style={styles.questionContainer}>
          <Text
            style={[
              styles.questionText,
              questionIsPersian && styles.rtlText,
            ]}
          >
            {question.question}
          </Text>
          {/* English subtitle */}
          <Text style={styles.questionEnglish}>
            {question.questionEn}
          </Text>
        </View>

        {/* Options */}
        <View style={styles.optionsContainer}>
          {question.options.map((option, idx) => {
            const isSelected = selectedOption === idx;
            const optionIsPersian = containsPersian(option.label);

            return (
              <TouchableOpacity
                key={idx}
                style={[
                  styles.optionCard,
                  isSelected && styles.optionCardSelected,
                  optionIsPersian && styles.optionCardRTL,
                ]}
                onPress={() => handleSelectOption(idx)}
                activeOpacity={0.7}
                disabled={isNavigating || isSubmitting}
              >
                {optionIsPersian ? (
                  // RTL layout: Text first, then radio
                  <>
                    <View style={styles.optionTextContainer}>
                      <Text
                        style={[
                          styles.optionText,
                          isSelected && styles.optionTextSelected,
                          styles.rtlText,
                        ]}
                      >
                        {option.label}
                      </Text>
                      <Text style={[styles.optionTextEnglish, styles.optionTextEnglishRTL]}>
                        {option.labelEn}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.radioOuter,
                        isSelected && styles.radioOuterSelected,
                      ]}
                    >
                      {isSelected && <View style={styles.radioInner} />}
                    </View>
                  </>
                ) : (
                  // LTR layout: Radio first, then text
                  <>
                    <View
                      style={[
                        styles.radioOuter,
                        isSelected && styles.radioOuterSelected,
                      ]}
                    >
                      {isSelected && <View style={styles.radioInner} />}
                    </View>
                    <View style={styles.optionTextContainer}>
                      <Text
                        style={[
                          styles.optionText,
                          isSelected && styles.optionTextSelected,
                        ]}
                      >
                        {option.label}
                      </Text>
                      <Text style={styles.optionTextEnglish}>
                        {option.labelEn}
                      </Text>
                    </View>
                  </>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      {/* Footer with Next Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.nextButton,
            selectedOption === null && styles.nextButtonDisabled,
          ]}
          onPress={handleNext}
          disabled={selectedOption === null || isNavigating || isSubmitting}
          activeOpacity={0.8}
        >
          <Text style={styles.nextButtonText}>
            {currentIndex < totalQuestions - 1 ? 'ادامه - Next' : 'مشاهده نتیجه - See Result'}
          </Text>
          <Text style={styles.nextButtonArrow}>→</Text>
        </TouchableOpacity>

        {(currentIndex > 0 || isRetakeMode) && (
          <TouchableOpacity onPress={handleBack} style={styles.backLink}>
            <Text style={styles.backLinkText}>
              {currentIndex === 0 ? 'انصراف - Cancel' : 'بازگشت - Back'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background.primary,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  backIconDisabled: {
    color: COLORS.text.muted,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.background.elevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeText: {
    fontSize: 18,
    color: COLORS.text.muted,
  },
  headerSpacer: {
    width: 40,
  },
  progressContainer: {
    flex: 1,
    marginHorizontal: SPACING[4],
    alignItems: 'center',
  },
  progressBarBackground: {
    width: '100%',
    height: 6,
    backgroundColor: COLORS.background.elevated,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: COLORS.brand.primary,
    borderRadius: 3,
  },
  progressText: {
    marginTop: SPACING[2],
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
  },

  // Content
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: SPACING[5],
    paddingTop: SPACING[4],
    paddingBottom: SPACING[4],
  },

  // Question
  questionContainer: {
    marginBottom: SPACING[6],
  },
  questionText: {
    fontSize: TYPOGRAPHY.fontSize['xl'],
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.primary,
    lineHeight: 32,
    marginBottom: SPACING[2],
  },
  questionEnglish: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text.secondary,
    lineHeight: 24,
  },

  // Options
  optionsContainer: {
    gap: SPACING[3],
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background.elevated,
    borderWidth: 2,
    borderColor: COLORS.background.elevated,
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING[4],
    paddingHorizontal: SPACING[4],
  },
  optionCardSelected: {
    borderColor: COLORS.brand.primary,
    backgroundColor: `${COLORS.brand.primary}10`,
  },
  optionCardRTL: {
    flexDirection: 'row-reverse',
  },
  radioOuter: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.text.muted,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  radioOuterSelected: {
    borderColor: COLORS.brand.primary,
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.brand.primary,
  },
  optionTextContainer: {
    flex: 1,
    marginHorizontal: SPACING[3],
  },
  optionText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text.primary,
    lineHeight: 24,
  },
  optionTextSelected: {
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
  optionTextEnglish: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.muted,
    marginTop: 2,
  },
  optionTextEnglishRTL: {
    textAlign: 'right',
  },

  // RTL Text
  rtlText: {
    writingDirection: 'rtl',
    textAlign: 'right',
  },

  // Footer
  footer: {
    paddingHorizontal: SPACING[5],
    paddingTop: SPACING[3],
    paddingBottom: SPACING[6],
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.brand.primary,
    paddingVertical: SPACING[4],
    borderRadius: RADIUS.full,
  },
  nextButtonDisabled: {
    backgroundColor: COLORS.text.muted,
    opacity: 0.5,
  },
  nextButtonText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.inverse,
    marginRight: SPACING[2],
  },
  nextButtonArrow: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    color: COLORS.text.inverse,
  },
  backLink: {
    alignItems: 'center',
    paddingVertical: SPACING[4],
  },
  backLinkText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.brand.primary,
  },

  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: COLORS.text.primary,
    fontSize: TYPOGRAPHY.fontSize.lg,
    marginBottom: SPACING[2],
  },
  loadingSubtext: {
    color: COLORS.text.secondary,
    fontSize: TYPOGRAPHY.fontSize.base,
  },
});

export default QuestionnaireScreen;
