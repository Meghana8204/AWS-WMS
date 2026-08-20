import apiClient from '@/api/api-client';
import { Supplier, SupplierContact, SupplierAddress, SupplierDocument } from '../types';

export const suppliersService = {
  getSuppliers: async () => {
    const response = await apiClient.get('/suppliers/');
    return response.data;
  },

  getSupplier: async (id: string) => {
    const response = await apiClient.get(`/suppliers/${id}/`);
    return response.data;
  },

  createSupplier: async (data: Partial<Supplier>) => {
    const response = await apiClient.post('/suppliers/', data);
    return response.data;
  },

  updateStatus: async (id: string, status: string, comments: string) => {
    const response = await apiClient.post(`/suppliers/${id}/update_status/`, { status, comments });
    return response.data;
  },

  // Contacts
  createContact: async (data: Partial<SupplierContact>) => {
    const response = await apiClient.post('/suppliers/contacts/', data);
    return response.data;
  },

  // Addresses
  createAddress: async (data: Partial<SupplierAddress>) => {
    const response = await apiClient.post('/suppliers/addresses/', data);
    return response.data;
  },

  // Documents
  uploadDocument: async (formData: FormData) => {
    const response = await apiClient.post('/suppliers/documents/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  }
};
