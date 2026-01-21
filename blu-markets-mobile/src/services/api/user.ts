// User API Module
// src/services/api/user.ts

import { apiClient } from './client';
import type { UserProfile, UserSettings } from './types';

export const user = {
  getProfile: (): Promise<UserProfile> =>
    apiClient.get('/user/profile'),

  updateSettings: (settings: Partial<UserSettings>): Promise<UserSettings> =>
    apiClient.patch('/user/settings', settings),
};
