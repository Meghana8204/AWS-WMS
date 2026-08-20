import apiClient from '@/api/api-client';
import { InventoryBalance, TraceabilityRecord } from '../types';

export const inventoryService = {
  getBalances: async () => {
    const response = await apiClient.get('/inventory/balances/');
    return response.data;
  },
  getTraceability: async () => {
    const response = await apiClient.get('/inventory/traceability/');
    return response.data;
  }
};
