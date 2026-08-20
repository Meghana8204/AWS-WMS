import apiClient from '@/api/api-client';
import { Company } from '../types';

export const organizationService = {
  getCompanies: async () => {
    const response = await apiClient.get('/organization/companies/');
    return response.data;
  },

  getCompany: async (id: string) => {
    const response = await apiClient.get(`/organization/companies/${id}/`);
    return response.data;
  },

  createCompany: async (data: Partial<Company>) => {
    const response = await apiClient.post('/organization/companies/', data);
    return response.data;
  },

  updateCompany: async (id: string, data: Partial<Company>) => {
    const response = await apiClient.patch(`/organization/companies/${id}/`, data);
    return response.data;
  },

  deleteCompany: async (id: string) => {
    await apiClient.delete(`/organization/companies/${id}/`);
  }
};
