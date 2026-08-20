import apiClient from '@/api/api-client';
import { GRN } from '../types';

export const receivingService = {
  getGRNs: async () => {
    const response = await apiClient.get('/receiving/grns/');
    return response.data;
  },
  getGRN: async (id: string) => {
    const response = await apiClient.get(`/receiving/grns/${id}/`);
    return response.data;
  },
  createGRN: async (data: Partial<GRN>) => {
    const response = await apiClient.post('/receiving/grns/', data);
    return response.data;
  }
};
