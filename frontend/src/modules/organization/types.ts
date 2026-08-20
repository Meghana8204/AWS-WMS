import { BaseModel } from '@/types/common';

export interface Company extends BaseModel {
  company_code: string;
  company_name: string;
  legal_name: string;
  tax_id: string;
  country: string;
  base_currency: string;
  timezone: string;
  status: string;
}
