import { BaseModel } from '@/types/common';

export interface Category extends BaseModel {
  code: string;
  name: string;
  description: string;
  status: string;
}

export interface UOM extends BaseModel {
  code: string;
  name: string;
  symbol: string;
}

export interface Currency extends BaseModel {
  code: string;
  name: string;
  symbol: string;
  exchange_rate: number;
}

export interface PaymentTerm extends BaseModel {
  code: string;
  name: string;
  days: number;
  description: string;
}
