import { BaseModel } from '@/types/common';

export interface Bin extends BaseModel {
  zone: string;
  bin_code: string;
}

export interface Zone extends BaseModel {
  warehouse: string;
  zone_code: string;
  description: string;
  bins?: Bin[];
}

export interface Warehouse extends BaseModel {
  warehouse_code: string;
  warehouse_name: string;
  company: string;
  address: string;
  country: string;
  timezone: string;
  status: string;
  zones?: Zone[];
}
