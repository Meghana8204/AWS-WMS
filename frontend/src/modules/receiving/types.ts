import { BaseModel } from '@/types/common';

export interface GRNLine extends BaseModel {
  grn: string;
  po_line: string;
  item: string;
  item_name?: string;
  ordered_quantity: number;
  received_quantity: number;
  accepted_quantity: number;
  rejected_quantity: number;
}

export interface GRN extends BaseModel {
  grn_number: string;
  purchase_order: string;
  po_number?: string;
  asn?: string;
  supplier: string;
  supplier_name?: string;
  warehouse: string;
  receipt_date: string;
  receiver: string;
  receiver_name?: string;
  status: string;
  lines?: GRNLine[];
}
