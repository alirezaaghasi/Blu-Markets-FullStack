/**
 * QuestionnaireScreen - Fixed state management to avoid infinite loops
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { OnboardingStackParamList } from '../../navigation/types';
import { QUESTIONS } from '../../constants/questionnaire';

type Props = {
  navigation: NativeStackNavigationProp<OnboardingStackParamList, 'Questionnaire'>;
};

// Combined state to ensure atomic updates
interface QuestionnaireState {
  currentIndex: number;
  answers: number[];
  isNavigating: boolean;
}

const QuestionnaireScreen: React.FC<Props> = ({ navigation }) => {
  const [state, setState] = useState<QuestionnaireState>({
    currentIndex: 0,
    answers: [],
    isNavigating: false,
  });

  // Ref to prevent double-processing during rapid taps
  const processingRef = useRef(false);

  // Debug: Log when component mounts/remounts
  useEffect(() => {
    console.log('[Questionnaire] Component MOUNTED');
    return () => console.log('[Questionnaire] Component UNMOUNTED');
  }, []);

  const question = QUESTIONS[state.currentIndex];

  const handleOption = useCallback((optionIdx: number) => {
    // Prevent multiple taps or processing
    if (state.isNavigating || processingRef.current) {
      console.log('[Questionnaire] Ignoring tap - already processing');
      return;
    }

    processingRef.current = true;

    setState(prev => {
      const newAnswers = [...prev.answers, optionIdx];
      const newIndex = prev.currentIndex + 1;

      console.log(`[Questionnaire] Selected option ${optionIdx} for question ${prev.currentIndex + 1}/${QUESTIONS.length}`);

      if (prev.currentIndex >= QUESTIONS.length - 1) {
        // Last question - will navigate after state update
        console.log('[Questionnaire] Last question answered, preparing navigation...');

        // Build answers object
        const answersObj: Record<string, number> = {};
        QUESTIONS.forEach((q, i) => {
          answersObj[q.id] = newAnswers[i] ?? 0;
        });

        // Schedule navigation after state update (outside setState)
        setTimeout(() => {
          console.log('[Questionnaire] Navigating to ProfileResult...');
          navigation.replace('ProfileResult', { answers: answersObj });
        }, 0);

        return {
          ...prev,
          answers: newAnswers,
          isNavigating: true,
        };
      } else {
        // Reset processing flag after a short delay
        setTimeout(() => { processingRef.current = false; }, 100);

        return {
          ...prev,
          currentIndex: newIndex,
          answers: newAnswers,
        };
      }
    });
  }, [state.isNavigating, navigation]);

  const handleBack = useCallback(() => {
    if (processingRef.current) return;

    setState(prev => {
      if (prev.currentIndex > 0) {
        return {
          ...prev,
          currentIndex: prev.currentIndex - 1,
          answers: prev.answers.slice(0, -1),
        };
      }
      return prev;
    });
  }, []);

  if (!question) {
    return null;
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.progress}>{state.currentIndex + 1} / {QUESTIONS.length}</Text>
      <Text style={styles.question}>{question.question}</Text>

      {question.options.map((opt, i) => (
        <Pressable
          key={i}
          style={styles.option}
          onPress={() => handleOption(i)}
          disabled={state.isNavigating}
        >
          <Text style={styles.optionText}>{opt.label}</Text>
        </Pressable>
      ))}

      {state.currentIndex > 0 && (
        <Pressable style={styles.back} onPress={handleBack} disabled={state.isNavigating}>
          <Text style={styles.backText}>بازگشت - Back</Text>
        </Pressable>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0f', padding: 20 },
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
