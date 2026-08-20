import apiClient from '@/api/api-client';
import { ASN } from '../types';

export const asnService = {
  getASNs: async () => {
    const response = await apiClient.get('/asn/asns/');
    return response.data;
  },
  getASN: async (id: string) => {
    const response = await apiClient.get(`/asn/asns/${id}/`);
    return response.data;
  },
  createASN: async (data: Partial<ASN>) => {
    const response = await apiClient.post('/asn/asns/', data);
    return response.data;
  }
};
