import apiClient from '@/api/api-client';
import { Shipment } from '../types';

export const shipmentService = {
  getShipments: async () => {
    const response = await apiClient.get('/shipments/');
    return response.data;
  },
  getShipment: async (id: string) => {
    const response = await apiClient.get(`/shipments/${id}/`);
    return response.data;
  }
};
