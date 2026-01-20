// Questionnaire Screen
// Based on PRD Section 6.1 - Swipeable cards with Farsi questions
import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Dimensions,
  ScrollView,
  Animated,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { OnboardingStackParamList } from '../../navigation/types';
import { colors, typography, spacing, borderRadius } from '../../constants/theme';
import { useAppDispatch, useAppSelector } from '../../hooks/useStore';
import { setAnswer } from '../../store/slices/onboardingSlice';
import { QUESTIONS, Question, QuestionOption } from '../../constants/questionnaire';

const { width } = Dimensions.get('window');

type QuestionnaireScreenProps = {
  navigation: NativeStackNavigationProp<OnboardingStackParamList, 'Questionnaire'>;
};

const QuestionnaireScreen: React.FC<QuestionnaireScreenProps> = ({ navigation }) => {
  const dispatch = useAppDispatch();
  const answers = useAppSelector((state) => state.onboarding.answers);
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);
  const progressAnim = useRef(new Animated.Value(0)).current;

  const currentQuestion = QUESTIONS[currentIndex];
  const totalQuestions = QUESTIONS.length;
  const progress = (currentIndex + 1) / totalQuestions;

  const handleSelectOption = (optionIndex: number) => {
    dispatch(setAnswer({ questionId: currentQuestion.id, optionIndex }));

    // Auto-advance after selection with small delay
    setTimeout(() => {
      if (currentIndex < totalQuestions - 1) {
        goToNext();
      } else {
        navigation.navigate('ProfileResult');
      }
    }, 300);
  };

  const goToNext = () => {
    if (currentIndex < totalQuestions - 1) {
      setCurrentIndex(currentIndex + 1);
      Animated.timing(progressAnim, {
        toValue: (currentIndex + 2) / totalQuestions,
        duration: 300,
        useNativeDriver: false,
      }).start();
    }
  };

  const goBack = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      Animated.timing(progressAnim, {
        toValue: currentIndex / totalQuestions,
        duration: 300,
        useNativeDriver: false,
      }).start();
    } else {
      navigation.goBack();
    }
  };

  const selectedOption = answers[currentQuestion.id];

  return (
    <SafeAreaView style={styles.container}>
      {/* Header with back and progress */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={goBack}>
          <Text style={styles.backButtonText}>← Back</Text>
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

      {/* Question card */}
      <View style={styles.content}>
        <QuestionCard
          question={currentQuestion}
          selectedOption={selectedOption}
          onSelectOption={handleSelectOption}
        />
      </View>

      {/* Layer preview for specific questions */}
      {(currentIndex === 4 || currentIndex === 7) && (
        <View style={styles.layerPreview}>
          <Text style={styles.layerPreviewTitle}>Your portfolio layers</Text>
          <View style={styles.layerBars}>
            <View style={[styles.layerBar, styles.foundationBar]} />
            <View style={[styles.layerBar, styles.growthBar]} />
            <View style={[styles.layerBar, styles.upsideBar]} />
          </View>
          <View style={styles.layerLabels}>
            <Text style={styles.layerLabel}>Foundation</Text>
            <Text style={styles.layerLabel}>Growth</Text>
            <Text style={styles.layerLabel}>Upside</Text>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
};

// Question Card Component
const QuestionCard: React.FC<{
  question: Question;
  selectedOption: number | undefined;
  onSelectOption: (index: number) => void;
}> = ({ question, selectedOption, onSelectOption }) => {
  return (
    <View style={styles.card}>
      {/* Question text in Farsi */}
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
    backgroundColor: colors.bgDark,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[4],
  },
  backButton: {
    padding: spacing[2],
  },
  backButtonText: {
    color: colors.textSecondary,
    fontSize: typography.fontSize.base,
  },
  progressText: {
    color: colors.textSecondary,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  progressBarContainer: {
    height: 4,
    backgroundColor: colors.surfaceDark,
    marginHorizontal: spacing[6],
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 2,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing[6],
    paddingTop: spacing[6],
  },
  card: {
    backgroundColor: colors.cardDark,
    borderRadius: borderRadius.lg,
    padding: spacing[6],
  },
  questionText: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimaryDark,
    textAlign: 'right',
    writingDirection: 'rtl',
    marginBottom: spacing[2],
    lineHeight: 32,
  },
  questionSubtext: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    marginBottom: spacing[6],
  },
  optionsContainer: {
    gap: spacing[3],
  },
  optionButton: {
    backgroundColor: colors.surfaceDark,
    borderRadius: borderRadius.default,
    padding: spacing[4],
    borderWidth: 2,
    borderColor: 'transparent',
  },
  optionButtonSelected: {
    borderColor: colors.primary,
    backgroundColor: `${colors.primary}15`,
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
    borderColor: colors.textSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing[3],
    marginTop: 2,
  },
  radioOuterSelected: {
    borderColor: colors.primary,
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.primary,
  },
  optionTextContainer: {
    flex: 1,
  },
  optionText: {
    fontSize: typography.fontSize.base,
    color: colors.textPrimaryDark,
    textAlign: 'right',
    writingDirection: 'rtl',
    marginBottom: spacing[1],
  },
  optionTextSelected: {
    fontWeight: typography.fontWeight.semibold,
  },
  optionSubtext: {
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
  },
  layerPreview: {
    paddingHorizontal: spacing[6],
    paddingBottom: spacing[8],
  },
  layerPreviewTitle: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    marginBottom: spacing[3],
    textAlign: 'center',
  },
  layerBars: {
    flexDirection: 'row',
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: spacing[2],
  },
  layerBar: {
    height: '100%',
  },
  foundationBar: {
    flex: 50,
    backgroundColor: colors.layerFoundation,
  },
  growthBar: {
    flex: 35,
    backgroundColor: colors.layerGrowth,
  },
  upsideBar: {
    flex: 15,
    backgroundColor: colors.layerUpside,
  },
  layerLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  layerLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
  },
});

export default QuestionnaireScreen;
