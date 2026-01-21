/**
 * QuestionnaireScreen
 * Design System: Blu Markets
 * Target: iPhone 16 Pro (393 x 852)
 *
 * Risk profiling questionnaire with Farsi questions and RTL support
 * Shows block headers and progress indicator
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Animated,
  StatusBar,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { OnboardingStackParamList } from '../../navigation/types';
import { COLORS } from '../../constants/colors';
import { TYPOGRAPHY } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';
import { LAYOUT } from '../../constants/layout';
import { useAppDispatch, useAppSelector } from '../../hooks/useStore';
import { setAnswer } from '../../store/slices/onboardingSlice';
import { QUESTIONS, Question, QuestionOption, BLOCK_HEADERS } from '../../constants/questionnaire';

type QuestionnaireScreenProps = {
  navigation: NativeStackNavigationProp<OnboardingStackParamList, 'Questionnaire'>;
};

const QuestionnaireScreen: React.FC<QuestionnaireScreenProps> = ({ navigation }) => {
  const dispatch = useAppDispatch();
  const answers = useAppSelector((state) => state.onboarding.answers);
  const [currentIndex, setCurrentIndex] = useState(0);
  const progressAnim = useRef(new Animated.Value(1 / QUESTIONS.length)).current;

  const currentQuestion = QUESTIONS[currentIndex];
  const totalQuestions = QUESTIONS.length;
  const progress = (currentIndex + 1) / totalQuestions;

  // Get block header for current question
  const blockHeader = BLOCK_HEADERS[currentQuestion.dimension];

  // Animate progress bar on mount and index change
  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: progress,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [currentIndex, progress]);

  const handleSelectOption = (optionIndex: number) => {
    dispatch(setAnswer({ questionId: currentQuestion.id, optionIndex }));

    // Capture current index at selection time
    const selectedIndex = currentIndex;
    const isLastQuestion = selectedIndex >= totalQuestions - 1;

    // Quick advance after selection (just enough to show selection feedback)
    setTimeout(() => {
      if (isLastQuestion) {
        navigation.navigate('ProfileResult');
      } else {
        setCurrentIndex(selectedIndex + 1);
      }
    }, 150);
  };

  const goToNext = () => {
    setCurrentIndex(prevIndex =>
      prevIndex < totalQuestions - 1 ? prevIndex + 1 : prevIndex
    );
  };

  const goBack = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prevIndex => prevIndex - 1);
    } else {
      navigation.goBack();
    }
  };

  const selectedOption = answers[currentQuestion.id];

  // Check if entering a new block
  const isNewBlock = currentIndex === 0 ||
    QUESTIONS[currentIndex - 1].dimension !== currentQuestion.dimension;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background.primary} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={goBack}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.progressText}>
          {currentIndex + 1} / {totalQuestions}
        </Text>
      </View>

      {/* Progress bar */}
      <View style={styles.progressBarContainer}>
        <Animated.View
          style={[
            styles.progressBar,
            {
              width: progressAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%'],
              }),
            },
          ]}
        />
      </View>

      {/* Content */}
      <View style={styles.content}>
        {/* Block header (shown when entering new block) */}
        {isNewBlock && (
          <View style={styles.blockHeader}>
            <Text style={styles.blockTitleFarsi}>{blockHeader.farsi}</Text>
            <Text style={styles.blockTitleEnglish}>{blockHeader.english}</Text>
          </View>
        )}

        {/* Question card */}
        <QuestionCard
          question={currentQuestion}
          selectedOption={selectedOption}
          onSelectOption={handleSelectOption}
        />
      </View>

      {/* Layer preview for specific questions (questions about goals and behavior) */}
      {(currentIndex === 4 || currentIndex === 7) && (
        <View style={styles.layerPreview}>
          <Text style={styles.layerPreviewTitle}>Your portfolio layers</Text>
          <View style={styles.layerBars}>
            <View style={[styles.layerBar, styles.foundationBar]} />
            <View style={[styles.layerBar, styles.growthBar]} />
            <View style={[styles.layerBar, styles.upsideBar]} />
          </View>
          <View style={styles.layerLabels}>
            <Text style={[styles.layerLabel, { color: COLORS.layers.foundation }]}>Foundation</Text>
            <Text style={[styles.layerLabel, { color: COLORS.layers.growth }]}>Growth</Text>
            <Text style={[styles.layerLabel, { color: COLORS.layers.upside }]}>Upside</Text>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
};

// Question Card Component
interface QuestionCardProps {
  question: Question;
  selectedOption: number | undefined;
  onSelectOption: (index: number) => void;
}

const QuestionCard: React.FC<QuestionCardProps> = ({
  question,
  selectedOption,
  onSelectOption
}) => {
  return (
    <View style={styles.card}>
      {/* Question text in Farsi (RTL) */}
      <Text style={styles.questionText}>{question.question}</Text>

      {/* English subtitle */}
      <Text style={styles.questionSubtext}>{question.questionEn}</Text>

      {/* Options */}
      <View style={styles.optionsContainer}>
        {question.options.map((option, index) => (
          <TouchableOpacity
            key={index}
            style={[
              styles.optionButton,
              selectedOption === index && styles.optionButtonSelected,
            ]}
            onPress={() => onSelectOption(index)}
            activeOpacity={0.7}
          >
            <View style={styles.optionContent}>
              <View
                style={[
                  styles.radioOuter,
                  selectedOption === index && styles.radioOuterSelected,
                ]}
              >
                {selectedOption === index && <View style={styles.radioInner} />}
              </View>
              <View style={styles.optionTextContainer}>
                <Text
                  style={[
                    styles.optionText,
                    selectedOption === index && styles.optionTextSelected,
                  ]}
                >
                  {option.label}
                </Text>
                <Text style={styles.optionSubtext}>{option.labelEn}</Text>
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background.primary,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  progressText: {
    color: COLORS.text.secondary,
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
  progressBarContainer: {
    height: 4,
    backgroundColor: COLORS.background.elevated,
    marginHorizontal: LAYOUT.screenPaddingH,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: COLORS.brand.primary,
    borderRadius: 2,
  },
  content: {
    flex: 1,
    paddingHorizontal: LAYOUT.screenPaddingH,
    paddingTop: SPACING[6],
  },
  blockHeader: {
    marginBottom: SPACING[4],
    paddingBottom: SPACING[3],
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  blockTitleFarsi: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.primary,
    textAlign: 'right',
    writingDirection: 'rtl',
    marginBottom: SPACING[1],
  },
  blockTitleEnglish: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.muted,
  },
  card: {
    backgroundColor: COLORS.background.elevated,
    borderRadius: RADIUS.xl,
    padding: SPACING[5],
  },
  questionText: {
    fontSize: TYPOGRAPHY.fontSize.xl,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text.primary,
    textAlign: 'right',
    writingDirection: 'rtl',
    marginBottom: SPACING[2],
    lineHeight: 32,
  },
  questionSubtext: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
    marginBottom: SPACING[5],
  },
  optionsContainer: {
    gap: SPACING[3],
  },
  optionButton: {
    backgroundColor: COLORS.background.input,
    borderRadius: RADIUS.lg,
    padding: SPACING[4],
    borderWidth: 2,
    borderColor: 'transparent',
  },
  optionButtonSelected: {
    borderColor: COLORS.brand.primary,
    backgroundColor: COLORS.brand.primaryMuted,
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  radioOuter: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.text.muted,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING[3],
    marginTop: 2,
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
  },
  optionText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text.primary,
    textAlign: 'right',
    writingDirection: 'rtl',
    marginBottom: SPACING[1],
  },
  optionTextSelected: {
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },
  optionSubtext: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.text.secondary,
  },
  layerPreview: {
    paddingHorizontal: LAYOUT.screenPaddingH,
    paddingBottom: LAYOUT.totalBottomSpace,
  },
  layerPreviewTitle: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
    marginBottom: SPACING[3],
    textAlign: 'center',
  },
  layerBars: {
    flexDirection: 'row',
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: SPACING[2],
  },
  layerBar: {
    height: '100%',
  },
  foundationBar: {
    flex: 50,
    backgroundColor: COLORS.layers.foundation,
  },
  growthBar: {
    flex: 35,
    backgroundColor: COLORS.layers.growth,
  },
  upsideBar: {
    flex: 15,
    backgroundColor: COLORS.layers.upside,
  },
  layerLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  layerLabel: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
});

export default QuestionnaireScreen;
