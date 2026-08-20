import { BaseModel } from '@/types/common';
import { Currency } from '../masters/types';

export type SupplierStatus =
  | 'DRAFT'
  | 'UNDER_REVIEW'
  | 'QUALIFIED'
  | 'APPROVED'
  | 'ACTIVE'
  | 'SUSPENDED'
  | 'BLOCKED'
  | 'INACTIVE'
  | 'REJECTED';

export type ContactType = 'PROCUREMENT' | 'LOGISTICS' | 'QUALITY' | 'FINANCE' | 'MANAGEMENT';
export type AddressType = 'REGISTERED' | 'BILLING' | 'MANUFACTURING' | 'SHIPPING';

export interface SupplierContact extends BaseModel {
  supplier: string;
  name: string;
  designation: string;
  email: string;
  phone?: string;
  mobile: string;
  contact_type: ContactType;
  is_primary: boolean;
}

export interface SupplierAddress extends BaseModel {
  supplier: string;
  address_type: AddressType;
  address_line_1: string;
  address_line_2?: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  is_primary: boolean;
}

export interface Supplier extends BaseModel {
  supplier_code: string;
  supplier_name: string;
  registered_company_name: string;
  vendor_type: string;
  industry: string;
  tax_number?: string;
  registration_number?: string;
  country: string;
  default_currency: string;
  status: SupplierStatus;

  contacts?: SupplierContact[];
  addresses?: SupplierAddress[];
  // Mapping and documents added as needed
}
