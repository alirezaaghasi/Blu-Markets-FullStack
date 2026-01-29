// Activity Feed Hook
// src/hooks/useActivityFeed.ts

import { useState, useCallback, useMemo, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { activity } from '../services/api/index';
import { useAppSelector } from './useStore';
import type { ActionLogEntry } from '../types';
import { getErrorMessage } from '../utils/errorUtils';
import { DEMO_TOKEN } from '../constants/business';

// AUDIT FIX #8: Type guard for activity validation
// Validates that raw API response has expected shape
function isValidActivity(obj: unknown): obj is Partial<ActionLogEntry> {
  if (typeof obj !== 'object' || obj === null) return false;
  const a = obj as Record<string, unknown>;
  // Must have at least an id or actionType
  return typeof a.id === 'string' || typeof a.actionType === 'string' || typeof a.type === 'string';
}

// Maps raw API response to ActionLogEntry with safe defaults
function mapActivity(raw: unknown): ActionLogEntry | null {
  if (!isValidActivity(raw)) return null;
  const a = raw as Record<string, unknown>;

  // Parse ID - must be a number per ActionLogEntry type
  let id: number;
  if (typeof a.id === 'number') {
    id = a.id;
  } else if (typeof a.id === 'string') {
    id = parseInt(a.id, 10) || Date.now();
  } else {
    id = Date.now();
  }

  return {
    id,
    type: String(a.type ?? a.actionType ?? 'UNKNOWN') as ActionLogEntry['type'],
    timestamp: String(a.timestamp ?? a.createdAt ?? new Date().toISOString()),
    amountIRR: Number(a.amountIRR ?? a.amountIrr ?? 0),
    message: String(a.message ?? ''),
    boundary: String(a.boundary ?? 'SAFE') as ActionLogEntry['boundary'],
    assetId: a.assetId ? String(a.assetId) as ActionLogEntry['assetId'] : undefined,
  };
}

interface UseActivityFeedResult {
  activities: ActionLogEntry[];
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  hasMore: boolean;
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
}

export function useActivityFeed(initialLimit = 10): UseActivityFeedResult {
  const [activities, setActivities] = useState<ActionLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  // AUDIT FIX #9: Use ref to track if initial load happened to avoid stale closure
  const hasLoadedRef = useRef(false);

  // Check if we're in demo mode (runtime check via Redux)
  const authToken = useAppSelector((state) => state.auth.authToken);
  const reduxActionLog = useAppSelector((state) => state.portfolio.actionLog);
  const isDemoMode = authToken === DEMO_TOKEN;

  // Demo mode activities from Redux state
  const demoActivities = useMemo(() => {
    if (!isDemoMode) return [];
    return (reduxActionLog || []).slice(0, initialLimit);
  }, [isDemoMode, reduxActionLog, initialLimit]);

  const fetchActivities = useCallback(async (isRefresh = false) => {
    // In demo mode, use Redux state instead of API
    if (isDemoMode) {
      setActivities(demoActivities);
      setHasMore(false);
      setIsLoading(false);
      setIsRefreshing(false);
      return;
    }

    try {
      if (isRefresh) {
        setIsRefreshing(true);
      } else if (!hasLoadedRef.current) {
        // AUDIT FIX #9: Use ref instead of activities.length to avoid stale closure
        setIsLoading(true);
      }
      setError(null);

      const response = await activity.getRecent(initialLimit);
      // AUDIT FIX #8: Use type-safe mapping with validation
      const rawActivities = response?.activities || [];
      const mappedActivities = rawActivities
        .map(mapActivity)
        .filter((a): a is ActionLogEntry => a !== null);

      setActivities(mappedActivities);
      setHasMore(response?.hasMore || false);
      setCursor(response?.nextCursor);
      hasLoadedRef.current = true;
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load activities'));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [initialLimit, isDemoMode, demoActivities]);

  const loadMore = useCallback(async () => {
    // No pagination in demo mode
    if (isDemoMode) return;
    if (!hasMore || isLoading || !cursor) return;

    try {
      const response = await activity.getAll(cursor);
      // AUDIT FIX #8: Use type-safe mapping with validation
      const rawActivities = response?.activities || [];
      const mappedActivities = rawActivities
        .map(mapActivity)
        .filter((a): a is ActionLogEntry => a !== null);

      setActivities((prev) => [...prev, ...mappedActivities]);
      setHasMore(response.hasMore);
      setCursor(response.nextCursor);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load more activities'));
    }
  }, [hasMore, isLoading, cursor, isDemoMode]);

  const refresh = useCallback(async () => {
    await fetchActivities(true);
  }, [fetchActivities]);

  // Fetch on screen focus
  useFocusEffect(
    useCallback(() => {
      fetchActivities();
    }, [fetchActivities])
  );

  return {
    activities: isDemoMode ? demoActivities : activities,
    isLoading: isDemoMode ? false : isLoading,
    isRefreshing,
    error,
    hasMore: isDemoMode ? false : hasMore,
    refresh,
    loadMore,
  };
}

export default useActivityFeed;
