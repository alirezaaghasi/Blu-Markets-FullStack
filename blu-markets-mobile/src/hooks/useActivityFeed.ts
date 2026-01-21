// Activity Feed Hook
// src/hooks/useActivityFeed.ts

import { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { activity } from '../services/api/index';
import type { ActionLogEntry } from '../types';

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

  const fetchActivities = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setIsRefreshing(true);
      } else if (activities.length === 0) {
        setIsLoading(true);
      }
      setError(null);

      const response = await activity.getRecent(initialLimit);
      setActivities(response?.activities || []);
      setHasMore(response?.hasMore || false);
      setCursor(response?.nextCursor);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load activities');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [initialLimit]);

  const loadMore = useCallback(async () => {
    if (!hasMore || isLoading || !cursor) return;

    try {
      const response = await activity.getAll(cursor);
      setActivities((prev) => [...prev, ...response.activities]);
      setHasMore(response.hasMore);
      setCursor(response.nextCursor);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load more activities');
    }
  }, [hasMore, isLoading, cursor]);

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
    activities,
    isLoading,
    isRefreshing,
    error,
    hasMore,
    refresh,
    loadMore,
  };
}

export default useActivityFeed;
