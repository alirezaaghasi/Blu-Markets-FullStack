/**
 * QuestionnaireScreen - Simplified for performance
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { OnboardingStackParamList } from '../../navigation/types';
import { QUESTIONS } from '../../constants/questionnaire';

type Props = {
  navigation: NativeStackNavigationProp<OnboardingStackParamList, 'Questionnaire'>;
};

const QuestionnaireScreen: React.FC<Props> = ({ navigation }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [isNavigating, setIsNavigating] = useState(false);

  useEffect(() => {
    console.log('[Questionnaire] Component MOUNTED');
    return () => console.log('[Questionnaire] Component UNMOUNTED');
  }, []);

  const question = QUESTIONS[currentIndex];

  const handleOption = (optionIdx: number) => {
    if (isNavigating) return;

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

      navigation.replace('ProfileResult', { answers: answersObj });
    } else {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handleBack = () => {
    if (currentIndex > 0 && !isNavigating) {
      setCurrentIndex(currentIndex - 1);
      setAnswers(answers.slice(0, -1));
    }
  };

  if (!question) return null;

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.progress}>{currentIndex + 1} / {QUESTIONS.length}</Text>
      <Text style={styles.question}>{question.question}</Text>

      {question.options.map((opt, i) => (
        <TouchableOpacity
          key={i}
          style={styles.option}
          onPress={() => handleOption(i)}
          activeOpacity={0.7}
          disabled={isNavigating}
        >
          <Text style={styles.optionText}>{opt.label}</Text>
        </TouchableOpacity>
      ))}

      {currentIndex > 0 && (
        <TouchableOpacity style={styles.back} onPress={handleBack} disabled={isNavigating}>
          <Text style={styles.backText}>بازگشت - Back</Text>
        </TouchableOpacity>
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
