import { BaseModel } from '@/types/common';

export interface ASNLine extends BaseModel {
  asn: string;
  po_line: string;
  item: string;
  item_name?: string;
  quantity: number;
  uom: string;
  uom_symbol?: string;
  package_count: number;
}

export interface ASN extends BaseModel {
  asn_number: string;
  purchase_order: string;
  po_number?: string;
  supplier: string;
  supplier_name?: string;
  expected_arrival_date: string;
  carrier: string;
  vehicle_number: string;
  packing_configuration: string;
  hazardous_material_declaration: boolean;
  notes: string;
  status: string;
  lines?: ASNLine[];
}
