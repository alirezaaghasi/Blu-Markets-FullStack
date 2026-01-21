/**
 * QuestionnaireScreen - Minimal test version
 */

import React, { useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { OnboardingStackParamList } from '../../navigation/types';
import { store } from '../../store';
import { setAnswer } from '../../store/slices/onboardingSlice';
import { QUESTIONS } from '../../constants/questionnaire';

type Props = {
  navigation: NativeStackNavigationProp<OnboardingStackParamList, 'Questionnaire'>;
};

const QuestionnaireScreen: React.FC<Props> = ({ navigation }) => {
  // Use refs to avoid any React re-renders
  const indexRef = useRef(0);
  const answersRef = useRef<number[]>([]);
  const [, forceUpdate] = React.useReducer(x => x + 1, 0);

  const handleOption = useCallback((optionIdx: number) => {
    answersRef.current = [...answersRef.current, optionIdx];

    if (indexRef.current >= QUESTIONS.length - 1) {
      // Save all answers to Redux at once
      QUESTIONS.forEach((q, i) => {
        if (answersRef.current[i] !== undefined) {
          store.dispatch(setAnswer({ questionId: q.id, optionIndex: answersRef.current[i] }));
        }
      });
      navigation.navigate('ProfileResult');
    } else {
      indexRef.current += 1;
      forceUpdate();
    }
  }, [navigation]);

  const handleBack = useCallback(() => {
    if (indexRef.current > 0) {
      indexRef.current -= 1;
      answersRef.current = answersRef.current.slice(0, -1);
      forceUpdate();
    }
  }, []);

  const question = QUESTIONS[indexRef.current];

  if (!question) {
    return null;
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.progress}>{indexRef.current + 1} / {QUESTIONS.length}</Text>
      <Text style={styles.question}>{question.questionEn}</Text>

      {question.options.map((opt, i) => (
        <Pressable
          key={i}
          style={styles.option}
          onPress={() => handleOption(i)}
        >
          <Text style={styles.optionText}>{opt.labelEn}</Text>
        </Pressable>
      ))}

      {indexRef.current > 0 && (
        <Pressable style={styles.back} onPress={handleBack}>
          <Text style={styles.backText}>Back</Text>
        </Pressable>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0f', padding: 20 },
  progress: { color: '#888', fontSize: 14, marginBottom: 20 },
  question: { color: '#fff', fontSize: 18, marginBottom: 30 },
  option: {
    backgroundColor: '#1a1a2e',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
  },
  optionText: { color: '#fff', fontSize: 16 },
  back: { marginTop: 20, padding: 12 },
  backText: { color: '#3b82f6', fontSize: 16 },
});

export default QuestionnaireScreen;
