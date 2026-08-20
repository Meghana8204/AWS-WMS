import apiClient from '@/api/api-client';
import { Category, UOM, Currency, PaymentTerm } from '../types';

export const mastersService = {
  // Categories
  getCategories: async () => {
    const response = await apiClient.get('/masters/categories/');
    return response.data;
  },
  createCategory: async (data: Partial<Category>) => {
    const response = await apiClient.post('/masters/categories/', data);
    return response.data;
  },

  // UOMs
  getUOMs: async () => {
    const response = await apiClient.get('/masters/uoms/');
    return response.data;
  },
  createUOM: async (data: Partial<UOM>) => {
    const response = await apiClient.post('/masters/uoms/', data);
    return response.data;
  },

  // Currencies
  getCurrencies: async () => {
    const response = await apiClient.get('/masters/currencies/');
    return response.data;
  },
  createCurrency: async (data: Partial<Currency>) => {
    const response = await apiClient.post('/masters/currencies/', data);
    return response.data;
  },

  // Payment Terms
  getPaymentTerms: async () => {
    const response = await apiClient.get('/masters/payment-terms/');
    return response.data;
  },
  createPaymentTerm: async (data: Partial<PaymentTerm>) => {
    const response = await apiClient.post('/masters/payment-terms/', data);
    return response.data;
  }
};
