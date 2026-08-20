import { BaseModel } from '@/types/common';

export interface Item extends BaseModel {
  item_code: string;
  item_name: string;
  description: string;
  category: string;
  category_name?: string;
  uom: string;
  uom_name?: string;
  serial_controlled: boolean;
  batch_controlled: boolean;
  hazardous: boolean;
  high_value: boolean;
  safety_critical: boolean;
}
