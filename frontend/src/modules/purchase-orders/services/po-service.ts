import apiClient from '@/api/api-client';
import { PurchaseOrder } from '../types';

export const poService = {
  getPOs: async () => {
    const response = await apiClient.get<PurchaseOrder[]>('/purchase-orders/orders/');
    return response.data;
  },

  getPO: async (id: string) => {
    const response = await apiClient.get<PurchaseOrder>(`/purchase-orders/orders/${id}/`);
    return response.data;
  },

  createPO: async (data: any) => {
    const response = await apiClient.post<PurchaseOrder>('/purchase-orders/orders/', data);
    return response.data;
  },

  submitPO: async (id: string) => {
    const response = await apiClient.post(`/purchase-orders/orders/${id}/submit/`);
    return response.data;
  },

  approvePO: async (id: string) => {
    const response = await apiClient.post(`/purchase-orders/orders/${id}/approve/`);
    return response.data;
  },

  transmitPO: async (id: string) => {
    const response = await apiClient.post(`/purchase-orders/orders/${id}/transmit/`);
    return response.data;
  }
};
