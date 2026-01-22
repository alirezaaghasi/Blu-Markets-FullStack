// Trade Hook
// src/hooks/useTrade.ts

import { useState, useCallback } from 'react';
import { trade as tradeApi } from '../services/api/index';
import type { AssetId, TradePreview } from '../types';
import type { TradeExecuteResponse } from '../services/api/index';
import { getErrorMessage } from '../utils/errorUtils';

interface UseTradeResult {
  preview: TradePreview | null;
  isLoadingPreview: boolean;
  isExecuting: boolean;
  error: string | null;
  getPreview: (assetId: AssetId, side: 'BUY' | 'SELL', amountIrr: number) => Promise<TradePreview | null>;
  executeTrade: (assetId: AssetId, side: 'BUY' | 'SELL', amountIrr: number) => Promise<TradeExecuteResponse | null>;
  clearPreview: () => void;
  clearError: () => void;
}

export function useTrade(): UseTradeResult {
  const [preview, setPreview] = useState<TradePreview | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getPreview = useCallback(async (
    assetId: AssetId,
    side: 'BUY' | 'SELL',
    amountIrr: number
  ): Promise<TradePreview | null> => {
    try {
      setIsLoadingPreview(true);
      setError(null);

      const response = await tradeApi.preview(assetId, side, amountIrr);
      setPreview(response);
      return response;
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to get trade preview'));
      return null;
    } finally {
      setIsLoadingPreview(false);
    }
  }, []);

  const executeTrade = useCallback(async (
    assetId: AssetId,
    side: 'BUY' | 'SELL',
    amountIrr: number
  ): Promise<TradeExecuteResponse | null> => {
    try {
      setIsExecuting(true);
      setError(null);

      const response = await tradeApi.execute(assetId, side, amountIrr);
      // Clear preview after successful execution
      setPreview(null);
      return response;
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to execute trade'));
      return null;
    } finally {
      setIsExecuting(false);
    }
  }, []);

  const clearPreview = useCallback(() => {
    setPreview(null);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    preview,
    isLoadingPreview,
    isExecuting,
    error,
    getPreview,
    executeTrade,
    clearPreview,
    clearError,
  };
}

export default useTrade;
