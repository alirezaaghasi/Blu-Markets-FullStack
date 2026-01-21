// Prices API Module
// src/services/api/prices.ts

import { apiClient } from './client';
import type { PricesResponse } from './types';

export const prices = {
  getAll: (): Promise<PricesResponse> =>
    apiClient.get('/prices'),
};
