// Risk Scoring Service Tests
import { describe, it, expect } from 'vitest';
import { calculateRiskScore, getTargetAllocation } from '../src/services/risk-scoring.service.js';

describe('Risk Scoring Service', () => {
  describe('calculateRiskScore', () => {
    it('should return LOW tier for very conservative answers', () => {
      const answers = [
        { questionId: 'q_income', answerId: 'a1', value: 1 },
        { questionId: 'q_buffer', answerId: 'a1', value: 1 },
        { questionId: 'q_proportion', answerId: 'a1', value: 2 },
        { questionId: 'q_goal', answerId: 'a1', value: 1 },
        { questionId: 'q_horizon', answerId: 'a1', value: 1 },
        { questionId: 'q_crash_20', answerId: 'a1', value: 2 },
        { questionId: 'q_tradeoff', answerId: 'a1', value: 1 },
        { questionId: 'q_past_behavior', answerId: 'a1', value: 2 },
        { questionId: 'q_max_loss', answerId: 'a1', value: 1 },
      ];

      const result = calculateRiskScore(answers);

      expect(result.tier).toBe('LOW');
      expect(result.score).toBeLessThanOrEqual(3);
      expect(result.targetAllocation).toBeDefined();
    });

    it('should return HIGH tier for aggressive answers', () => {
      const answers = [
        { questionId: 'q_income', answerId: 'a5', value: 8 },
        { questionId: 'q_buffer', answerId: 'a5', value: 8 },
        { questionId: 'q_proportion', answerId: 'a5', value: 8 },
        { questionId: 'q_goal', answerId: 'a5', value: 8 },
        { questionId: 'q_horizon', answerId: 'a5', value: 10 }, // Long horizon
        { questionId: 'q_crash_20', answerId: 'a5', value: 8 },
        { questionId: 'q_tradeoff', answerId: 'a5', value: 8 },
        { questionId: 'q_past_behavior', answerId: 'a5', value: 8 },
        { questionId: 'q_max_loss', answerId: 'a5', value: 8 },
      ];

      const result = calculateRiskScore(answers);

      expect(result.score).toBeGreaterThanOrEqual(7);
      expect(result.tier).toBe('HIGH');
    });

    it('should return MEDIUM tier for balanced answers', () => {
      const answers = [
        { questionId: 'q_income', answerId: 'a3', value: 5 },
        { questionId: 'q_buffer', answerId: 'a3', value: 5 },
        { questionId: 'q_proportion', answerId: 'a3', value: 5 },
        { questionId: 'q_goal', answerId: 'a3', value: 5 },
        { questionId: 'q_horizon', answerId: 'a3', value: 7 }, // Mid-range horizon
        { questionId: 'q_crash_20', answerId: 'a3', value: 5 },
        { questionId: 'q_tradeoff', answerId: 'a3', value: 5 },
        { questionId: 'q_past_behavior', answerId: 'a3', value: 5 },
        { questionId: 'q_max_loss', answerId: 'a3', value: 5 },
      ];

      const result = calculateRiskScore(answers);

      expect(result.tier).toBe('MEDIUM');
      expect(result.score).toBeGreaterThanOrEqual(4);
      expect(result.score).toBeLessThanOrEqual(6);
    });

    it('should cap score when loss comfort is very low', () => {
      // High capacity but very low willingness (crash_20 and max_loss)
      const answers = [
        { questionId: 'q_income', answerId: 'a5', value: 8 },
        { questionId: 'q_buffer', answerId: 'a5', value: 8 },
        { questionId: 'q_proportion', answerId: 'a5', value: 8 },
        { questionId: 'q_goal', answerId: 'a5', value: 8 },
        { questionId: 'q_horizon', answerId: 'a5', value: 10 },
        { questionId: 'q_crash_20', answerId: 'a1', value: 1 }, // Very low loss comfort
        { questionId: 'q_tradeoff', answerId: 'a1', value: 1 },
        { questionId: 'q_past_behavior', answerId: 'a1', value: 1 },
        { questionId: 'q_max_loss', answerId: 'a1', value: 1 },
      ];

      const result = calculateRiskScore(answers);

      // Score should be capped due to conservative dominance rule (min of capacity, willingness)
      expect(result.score).toBeLessThanOrEqual(5);
    });

    it('should cap score when time horizon is very short', () => {
      // High in other areas but very short time horizon
      const answers = [
        { questionId: 'q_income', answerId: 'a5', value: 8 },
        { questionId: 'q_buffer', answerId: 'a5', value: 8 },
        { questionId: 'q_proportion', answerId: 'a5', value: 8 },
        { questionId: 'q_goal', answerId: 'a5', value: 8 },
        { questionId: 'q_horizon', answerId: 'a1', value: 1 }, // Very short horizon
        { questionId: 'q_crash_20', answerId: 'a5', value: 8 },
        { questionId: 'q_tradeoff', answerId: 'a5', value: 8 },
        { questionId: 'q_past_behavior', answerId: 'a5', value: 8 },
        { questionId: 'q_max_loss', answerId: 'a5', value: 8 },
      ];

      const result = calculateRiskScore(answers);

      // Score should be capped at 3 due to time horizon hard cap (value=1 caps at 3)
      expect(result.score).toBeLessThanOrEqual(3);
    });

    it('should reduce score for low willingness', () => {
      const answers = [
        { questionId: 'q_income', answerId: 'a4', value: 6 },
        { questionId: 'q_buffer', answerId: 'a4', value: 6 },
        { questionId: 'q_proportion', answerId: 'a4', value: 6 },
        { questionId: 'q_goal', answerId: 'a4', value: 6 },
        { questionId: 'q_horizon', answerId: 'a4', value: 7 },
        { questionId: 'q_crash_20', answerId: 'a1', value: 2 }, // Low willingness
        { questionId: 'q_tradeoff', answerId: 'a1', value: 2 },
        { questionId: 'q_past_behavior', answerId: 'a1', value: 2 },
        { questionId: 'q_max_loss', answerId: 'a1', value: 2 },
      ];

      const resultWithLowWillingness = calculateRiskScore(answers);

      // Compare to same answers but with higher willingness
      const answersWithHighWillingness = answers.map((a) =>
        ['q_crash_20', 'q_tradeoff', 'q_past_behavior', 'q_max_loss'].includes(a.questionId)
          ? { ...a, value: 7 }
          : a
      );
      const resultWithHighWillingness = calculateRiskScore(answersWithHighWillingness);

      // Low willingness should result in lower or equal score
      expect(resultWithLowWillingness.score).toBeLessThanOrEqual(resultWithHighWillingness.score);
    });

    it('should handle pathological all-1s answers', () => {
      const answers = [
        { questionId: 'q_income', answerId: 'a1', value: 1 },
        { questionId: 'q_buffer', answerId: 'a1', value: 1 },
        { questionId: 'q_proportion', answerId: 'a1', value: 1 },
        { questionId: 'q_goal', answerId: 'a1', value: 1 },
        { questionId: 'q_horizon', answerId: 'a1', value: 1 }, // Short horizon caps at 3
        { questionId: 'q_crash_20', answerId: 'a1', value: 1 },
        { questionId: 'q_tradeoff', answerId: 'a1', value: 1 },
        { questionId: 'q_past_behavior', answerId: 'a1', value: 1 },
        { questionId: 'q_max_loss', answerId: 'a1', value: 1 },
      ];

      const result = calculateRiskScore(answers);

      // All 1s should result in low score
      expect(result.score).toBeLessThanOrEqual(3);
      expect(result.tier).toBe('LOW');
    });

    it('should apply consistency penalty for inconsistent answers', () => {
      // q_crash_20 <= 2 AND q_max_loss >= 7 triggers consistency penalty
      const answers = [
        { questionId: 'q_income', answerId: 'a4', value: 6 },
        { questionId: 'q_buffer', answerId: 'a4', value: 6 },
        { questionId: 'q_proportion', answerId: 'a4', value: 6 },
        { questionId: 'q_goal', answerId: 'a4', value: 6 },
        { questionId: 'q_horizon', answerId: 'a4', value: 7 },
        { questionId: 'q_crash_20', answerId: 'a1', value: 2 }, // Low crash comfort
        { questionId: 'q_tradeoff', answerId: 'a4', value: 6 },
        { questionId: 'q_past_behavior', answerId: 'a4', value: 6 },
        { questionId: 'q_max_loss', answerId: 'a5', value: 8 }, // High max loss tolerance (inconsistent)
      ];

      const result = calculateRiskScore(answers);

      // Consistency penalty should be applied
      expect(result.score).toBeLessThanOrEqual(5);
    });

    it('should include target allocation in result', () => {
      const answers = [
        { questionId: 'q_income', answerId: 'a3', value: 5 },
        { questionId: 'q_buffer', answerId: 'a3', value: 5 },
        { questionId: 'q_proportion', answerId: 'a3', value: 5 },
        { questionId: 'q_goal', answerId: 'a3', value: 5 },
        { questionId: 'q_horizon', answerId: 'a3', value: 7 },
        { questionId: 'q_crash_20', answerId: 'a3', value: 5 },
        { questionId: 'q_tradeoff', answerId: 'a3', value: 5 },
        { questionId: 'q_past_behavior', answerId: 'a3', value: 5 },
        { questionId: 'q_max_loss', answerId: 'a3', value: 5 },
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
