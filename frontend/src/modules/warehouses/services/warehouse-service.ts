import apiClient from '@/api/api-client';
import { Warehouse, Zone, Bin } from '../types';

export const warehouseService = {
  getWarehouses: async () => {
    const response = await apiClient.get('/warehouses/warehouses/');
    return response.data;
  },

  getWarehouse: async (id: string) => {
    const response = await apiClient.get(`/warehouses/warehouses/${id}/`);
    return response.data;
  },

  createWarehouse: async (data: Partial<Warehouse>) => {
    const response = await apiClient.post('/warehouses/warehouses/', data);
    return response.data;
  },

  updateWarehouse: async (id: string, data: Partial<Warehouse>) => {
    const response = await apiClient.patch(`/warehouses/warehouses/${id}/`, data);
    return response.data;
  },

  getZones: async (warehouseId: string) => {
    const response = await apiClient.get(`/warehouses/zones/?warehouse=${warehouseId}`);
    return response.data;
  },

  getBins: async (zoneId: string) => {
    const response = await apiClient.get(`/warehouses/bins/?zone=${zoneId}`);
    return response.data;
  }
};
