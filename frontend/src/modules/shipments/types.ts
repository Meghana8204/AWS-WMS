import { BaseModel } from '@/types/common';

export interface Shipment extends BaseModel {
  shipment_number: string;
  asn: string;
  asn_number?: string;
  supplier: string;
  supplier_name?: string;
  carrier: string;
  vehicle_number: string;
  origin: string;
  destination: string;
  dispatch_date: string;
  estimated_arrival: string;
  actual_arrival?: string;
  status: string;
}
