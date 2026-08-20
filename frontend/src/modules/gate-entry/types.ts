import { BaseModel } from '@/types/common';

export interface GateEntry extends BaseModel {
  gate_entry_number: string;
  vehicle_number: string;
  driver_name: string;
  driver_contact: string;
  carrier: string;
  supplier: string;
  supplier_name?: string;
  purchase_order?: string;
  po_number?: string;
  asn?: string;
  asn_number?: string;
  arrival_time: string;
  scheduled_slot?: string;
  status: string;
}
