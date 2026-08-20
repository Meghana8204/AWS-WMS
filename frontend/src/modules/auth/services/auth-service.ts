import apiClient from '@/api/api-client';
import { LoginResponse } from '../types';

export const authService = {
  login: async (credentials: any) => {
    const response = await apiClient.post<LoginResponse>('/auth/login/', credentials);
    return response.data;
  },

  logout: async () => {
    const refresh = localStorage.getItem('refresh_token');
    await apiClient.post('/auth/logout/', { refresh });
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
  },

  getCurrentUser: async () => {
    const response = await apiClient.get('/auth/me/');
    return response.data;
  }
};
