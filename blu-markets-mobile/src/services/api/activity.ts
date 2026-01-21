// Activity API Module
// src/services/api/activity.ts

import { apiClient } from './client';
import type { ActivityResponse } from './types';

export const activity = {
  getRecent: (limit = 20): Promise<ActivityResponse> =>
    apiClient.get(`/history/activity?limit=${limit}`),

  getAll: (cursor?: string): Promise<ActivityResponse> =>
    apiClient.get(`/history/all${cursor ? `?cursor=${cursor}` : ''}`),
};
