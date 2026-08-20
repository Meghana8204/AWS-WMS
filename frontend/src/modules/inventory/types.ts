import { BaseModel } from '@/types/common';

export interface TraceabilityRecord extends BaseModel {
  item: string;
  item_name?: string;
  grn: string;
  serial_number?: string;
  batch_number?: string;
  manufacture_date?: string;
  expiry_date?: string;
  warehouse: string;
  location?: string;
}

export interface InventoryBalance extends BaseModel {
  item: string;
  item_name?: string;
  item_code?: string;
  warehouse: string;
  total_quantity: number;
  available_quantity: number;
  on_hold_quantity: number;
  reserved_quantity: number;
}
