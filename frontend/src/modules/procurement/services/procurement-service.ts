import apiClient from '@/api/api-client';

export const procurementService = {
  getDashboardStats: async () => {
    const response = await apiClient.get('/procurement/dashboard/');
    return response.data;
  },
};
