import apiClient from '@/api/api-client';
import { Item } from '../types';

export const itemService = {
  getItems: async () => {
    const response = await apiClient.get('/items/');
    return response.data;
  },

  getItem: async (id: string) => {
    const response = await apiClient.get(`/items/${id}/`);
    return response.data;
  },

  createItem: async (data: Partial<Item>) => {
    const response = await apiClient.post('/items/', data);
    return response.data;
  },

  updateItem: async (id: string, data: Partial<Item>) => {
    const response = await apiClient.patch(`/items/${id}/`, data);
    return response.data;
  },

  deleteItem: async (id: string) => {
    await apiClient.delete(`/items/${id}/`);
  }
};
