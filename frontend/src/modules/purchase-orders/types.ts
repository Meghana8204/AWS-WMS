import { BaseModel } from '@/types/common';
import { Item } from '../items/types';
import { Supplier } from '../suppliers/types';
import { Warehouse } from '../warehouses/types';
import { Currency, PaymentTerm, UOM } from '../masters/types';

export type POType = 'STANDARD' | 'BLANKET' | 'FRAMEWORK';

export type POWorkflowStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'UNDER_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'SENT'
  | 'ACKNOWLEDGED'
  | 'REVISION_REQUIRED'
  | 'CANCELLED';

export type POBusinessStatus = 'OPEN' | 'PARTIALLY_RECEIVED' | 'FULLY_RECEIVED' | 'CLOSED';

export interface POLineItem extends BaseModel {
  purchase_order: string;
  item: string;
  item_name?: string;
  description: string;
  quantity: number;
  uom: string;
  uom_code?: string;
  unit_price: number;
  tax_percentage: number;
  discount_percentage: number;
  line_total: number;
  expected_delivery_date: string;
  received_quantity: number;
  accepted_quantity: number;
  rejected_quantity: number;
}

export interface PurchaseOrder extends BaseModel {
  po_number: string;
  po_date: string;
  po_type: POType;
  company: string;
  supplier: string;
  supplier_name?: string;
  warehouse: string;
  warehouse_name?: string;
  currency: string;
  reporting_currency: string;
  payment_terms: string;
  expected_delivery_date: string;
  status: POWorkflowStatus;
  receipt_status: POBusinessStatus;
  total_amount: number;
  tax_amount: number;
  discount_amount: number;
  net_amount: number;
  version: number;
  is_amended: boolean;
  notes: string;
  lines?: POLineItem[];
}
