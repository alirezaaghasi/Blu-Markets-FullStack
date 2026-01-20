// Risk Scoring Service Tests
import { describe, it, expect } from 'vitest';
import { calculateRiskScore, getTargetAllocation } from '../src/services/risk-scoring.service.js';

describe('Risk Scoring Service', () => {
  describe('calculateRiskScore', () => {
    it('should return LOW tier for very conservative answers', () => {
      const answers = [
        { questionId: 'q1', answerId: 'a1', value: 1 },
        { questionId: 'q2', answerId: 'a1', value: 1 },
        { questionId: 'q3', answerId: 'a1', value: 2 },
        { questionId: 'q4', answerId: 'a1', value: 1 },
        { questionId: 'q5', answerId: 'a1', value: 1 },
        { questionId: 'q6', answerId: 'a1', value: 2 },
        { questionId: 'q7', answerId: 'a1', value: 1 },
        { questionId: 'q8', answerId: 'a1', value: 2 },
        { questionId: 'q9', answerId: 'a1', value: 1 },
        { questionId: 'q10', answerId: 'a1', value: 2 },
      ];

      const result = calculateRiskScore(answers);

      expect(result.tier).toBe('LOW');
      expect(result.score).toBeLessThanOrEqual(3);
      expect(result.targetAllocation).toBeDefined();
    });

    it('should return HIGH tier for aggressive answers', () => {
      const answers = [
        { questionId: 'q1', answerId: 'a5', value: 5 },
        { questionId: 'q2', answerId: 'a5', value: 5 },
        { questionId: 'q3', answerId: 'a5', value: 5 },
        { questionId: 'q4', answerId: 'a5', value: 5 },
        { questionId: 'q5', answerId: 'a5', value: 5 },
        { questionId: 'q6', answerId: 'a5', value: 5 },
        { questionId: 'q7', answerId: 'a5', value: 5 },
        { questionId: 'q8', answerId: 'a5', value: 5 },
        { questionId: 'q9', answerId: 'a5', value: 5 },
        { questionId: 'q10', answerId: 'a5', value: 5 },
      ];

      const result = calculateRiskScore(answers);

      // All 5s is pathological - should be capped at 7
      expect(result.score).toBe(7);
      expect(result.tier).toBe('HIGH');
    });

    it('should return MEDIUM tier for balanced answers', () => {
      const answers = [
        { questionId: 'q1', answerId: 'a3', value: 3 },
        { questionId: 'q2', answerId: 'a3', value: 3 },
        { questionId: 'q3', answerId: 'a3', value: 3 },
        { questionId: 'q4', answerId: 'a3', value: 4 },
        { questionId: 'q5', answerId: 'a3', value: 3 },
        { questionId: 'q6', answerId: 'a3', value: 3 },
        { questionId: 'q7', answerId: 'a3', value: 4 },
        { questionId: 'q8', answerId: 'a3', value: 3 },
        { questionId: 'q9', answerId: 'a3', value: 3 },
        { questionId: 'q10', answerId: 'a3', value: 3 },
      ];

      const result = calculateRiskScore(answers);

      expect(result.tier).toBe('MEDIUM');
      expect(result.score).toBeGreaterThanOrEqual(4);
      expect(result.score).toBeLessThanOrEqual(6);
    });

    it('should cap score when loss comfort is very low', () => {
      // High in other areas but very low loss comfort
      const answers = [
        { questionId: 'q1', answerId: 'a1', value: 1 }, // lossComfort
        { questionId: 'q2', answerId: 'a1', value: 1 }, // lossComfort
        { questionId: 'q3', answerId: 'a5', value: 5 }, // timeHorizon
        { questionId: 'q4', answerId: 'a5', value: 5 }, // timeHorizon
        { questionId: 'q5', answerId: 'a5', value: 5 }, // experience
        { questionId: 'q6', answerId: 'a5', value: 5 }, // experience
        { questionId: 'q7', answerId: 'a5', value: 5 }, // financialStability
        { questionId: 'q8', answerId: 'a5', value: 5 }, // financialStability
        { questionId: 'q9', answerId: 'a5', value: 5 }, // goalClarity
        { questionId: 'q10', answerId: 'a5', value: 5 }, // goalClarity
      ];

      const result = calculateRiskScore(answers);

      // Score should be capped at 5 due to conservative dominance rule
      expect(result.score).toBeLessThanOrEqual(5);
    });

    it('should cap score when time horizon is very short', () => {
      // High in other areas but very short time horizon
      const answers = [
        { questionId: 'q1', answerId: 'a5', value: 5 }, // lossComfort
        { questionId: 'q2', answerId: 'a5', value: 5 }, // lossComfort
        { questionId: 'q3', answerId: 'a1', value: 1 }, // timeHorizon - short
        { questionId: 'q4', answerId: 'a1', value: 1 }, // timeHorizon - short
        { questionId: 'q5', answerId: 'a5', value: 5 }, // experience
        { questionId: 'q6', answerId: 'a5', value: 5 }, // experience
        { questionId: 'q7', answerId: 'a5', value: 5 }, // financialStability
        { questionId: 'q8', answerId: 'a5', value: 5 }, // financialStability
        { questionId: 'q9', answerId: 'a5', value: 5 }, // goalClarity
        { questionId: 'q10', answerId: 'a5', value: 5 }, // goalClarity
      ];

      const result = calculateRiskScore(answers);

      // Score should be capped at 6 due to time horizon hard cap
      expect(result.score).toBeLessThanOrEqual(6);
    });

    it('should reduce score for low experience', () => {
      const answers = [
        { questionId: 'q1', answerId: 'a4', value: 4 },
        { questionId: 'q2', answerId: 'a4', value: 4 },
        { questionId: 'q3', answerId: 'a4', value: 4 },
        { questionId: 'q4', answerId: 'a4', value: 4 },
        { questionId: 'q5', answerId: 'a1', value: 1 }, // experience - low
        { questionId: 'q6', answerId: 'a1', value: 1 }, // experience - low
        { questionId: 'q7', answerId: 'a4', value: 4 },
        { questionId: 'q8', answerId: 'a4', value: 4 },
        { questionId: 'q9', answerId: 'a4', value: 4 },
        { questionId: 'q10', answerId: 'a4', value: 4 },
      ];

      const resultWithLowExp = calculateRiskScore(answers);

      // Compare to same answers but with higher experience
      const answersWithHighExp = answers.map((a) =>
        a.questionId === 'q5' || a.questionId === 'q6' ? { ...a, value: 5 } : a
      );
      const resultWithHighExp = calculateRiskScore(answersWithHighExp);

      // Low experience should result in lower or equal score
      expect(resultWithLowExp.score).toBeLessThanOrEqual(resultWithHighExp.score);
    });

    it('should handle pathological all-1s answers', () => {
      const answers = Array.from({ length: 10 }, (_, i) => ({
        questionId: `q${i + 1}`,
        answerId: 'a1',
        value: 1,
      }));

      const result = calculateRiskScore(answers);

      // All 1s should result in score 2 per pathological rule
      expect(result.score).toBe(2);
      expect(result.tier).toBe('LOW');
    });

    it('should apply consistency penalty for high variance', () => {
      // Answers with high variance (alternating 1s and 5s)
      const answers = [
        { questionId: 'q1', answerId: 'a1', value: 1 },
        { questionId: 'q2', answerId: 'a5', value: 5 },
        { questionId: 'q3', answerId: 'a1', value: 1 },
        { questionId: 'q4', answerId: 'a5', value: 5 },
        { questionId: 'q5', answerId: 'a1', value: 1 },
        { questionId: 'q6', answerId: 'a5', value: 5 },
        { questionId: 'q7', answerId: 'a1', value: 1 },
        { questionId: 'q8', answerId: 'a5', value: 5 },
        { questionId: 'q9', answerId: 'a1', value: 1 },
        { questionId: 'q10', answerId: 'a5', value: 5 },
      ];

      const result = calculateRiskScore(answers);

      // High variance should apply penalty, pushing score toward conservative
      expect(result.score).toBeLessThanOrEqual(5);
    });

    it('should include target allocation in result', () => {
      const answers = [
        { questionId: 'q1', answerId: 'a3', value: 3 },
        { questionId: 'q2', answerId: 'a3', value: 3 },
        { questionId: 'q3', answerId: 'a3', value: 3 },
        { questionId: 'q4', answerId: 'a3', value: 3 },
        { questionId: 'q5', answerId: 'a3', value: 3 },
        { questionId: 'q6', answerId: 'a3', value: 3 },
        { questionId: 'q7', answerId: 'a3', value: 3 },
        { questionId: 'q8', answerId: 'a3', value: 3 },
        { questionId: 'q9', answerId: 'a3', value: 3 },
        { questionId: 'q10', answerId: 'a3', value: 3 },
      ];

      const result = calculateRiskScore(answers);

      expect(result.targetAllocation).toBeDefined();
      expect(result.targetAllocation.foundation).toBeDefined();
      expect(result.targetAllocation.growth).toBeDefined();
      expect(result.targetAllocation.upside).toBeDefined();

      // Sum should be close to 100
      const sum =
        result.targetAllocation.foundation +
        result.targetAllocation.growth +
        result.targetAllocation.upside;
      expect(sum).toBeCloseTo(100, 0);
    });
  });

  describe('getTargetAllocation', () => {
    it('should return valid allocation for score 1', () => {
      const allocation = getTargetAllocation(1);

      expect(allocation.foundation).toBeGreaterThan(allocation.upside);
      const sum = allocation.foundation + allocation.growth + allocation.upside;
      expect(sum).toBeCloseTo(100, 0);
    });

    it('should return valid allocation for score 10', () => {
      const allocation = getTargetAllocation(10);

      expect(allocation.upside).toBeGreaterThan(0);
      const sum = allocation.foundation + allocation.growth + allocation.upside;
      expect(sum).toBeCloseTo(100, 0);
    });

    it('should clamp score to valid range', () => {
      const allocationLow = getTargetAllocation(-5);
      const allocationHigh = getTargetAllocation(100);

      expect(allocationLow).toBeDefined();
      expect(allocationHigh).toBeDefined();
    });

    it('should have decreasing foundation as score increases', () => {
      const lowScore = getTargetAllocation(2);
      const highScore = getTargetAllocation(9);

      expect(lowScore.foundation).toBeGreaterThan(highScore.foundation);
    });

    it('should have increasing upside as score increases', () => {
      const lowScore = getTargetAllocation(2);
      const highScore = getTargetAllocation(9);

      expect(highScore.upside).toBeGreaterThan(lowScore.upside);
    });
  });
});
