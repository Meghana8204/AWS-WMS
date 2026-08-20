import apiClient from '@/api/api-client';
import { GateEntry } from '../types';

export const gateEntryService = {
  getEntries: async () => {
    const response = await apiClient.get('/gate-entries/');
    return response.data;
  },
  getEntry: async (id: string) => {
    const response = await apiClient.get(`/gate-entries/${id}/`);
    return response.data;
  },
  createEntry: async (data: Partial<GateEntry>) => {
    const response = await apiClient.post('/gate-entries/', data);
    return response.data;
  }
};
