export type ArrivalStatus =
  | "Waiting"
  | "Approved"
  | "Dock Assigned"
  | "Receiving"
  | "Completed"
  | "Rejected"
  | "Hold";

export interface Arrival {
  id: string;
  gateEntryNo: string;
  truckNo: string;
  transporter: string;
  vendor: string;
  vendorCode: string;
  po: string;
  poValue: string;
  driver: string;
  driverPhone: string;
  license: string;
  arrivalTime: string;
  waitMins: number;
  status: ArrivalStatus;
  material: string;
  pallets: number;
  weight: string;
  dock?: string;
  securityGuard: string;
  remarks: string;
  priority: "High" | "Normal" | "Low";
}

export const arrivals: Arrival[] = [
  {
    id: "GE-4821",
    gateEntryNo: "GE/2026/07/4821",
    truckNo: "MH 12 QT 4489",
    transporter: "Blue Dart Surface Logistics",
    vendor: "Hindustan Polymers Ltd.",
    vendorCode: "VND-10294",
    po: "PO-2026-118432",
    poValue: "₹ 24,88,500",
    driver: "Ramesh Kulkarni",
    driverPhone: "+91 98220 45781",
    license: "MH1220190045781",
    arrivalTime: "09:12",
    waitMins: 18,
    status: "Waiting",
    material: "HDPE Granules — Raw Material",
    pallets: 24,
    weight: "18.4 T",
    securityGuard: "S. Patil (Gate 2)",
    remarks: "Seal intact. Tarpaulin dry. Weighbridge slip attached.",
    priority: "High",
  },
  {
    id: "GE-4822",
    gateEntryNo: "GE/2026/07/4822",
    truckNo: "GJ 05 AW 1123",
    transporter: "Safexpress Pvt Ltd",
    vendor: "Arvind Packaging Solutions",
    vendorCode: "VND-10488",
    po: "PO-2026-118455",
    poValue: "₹ 6,42,000",
    driver: "Iqbal Shaikh",
    driverPhone: "+91 99042 11876",
    license: "GJ0520170112233",
    arrivalTime: "09:38",
    waitMins: 9,
    status: "Waiting",
    material: "Corrugated Cartons — Packaging",
    pallets: 16,
    weight: "5.1 T",
    securityGuard: "R. Yadav (Gate 1)",
    remarks: "Driver ID verified. Vehicle documents current.",
    priority: "Normal",
  },
  {
    id: "GE-4819",
    gateEntryNo: "GE/2026/07/4819",
    truckNo: "KA 51 MD 7702",
    transporter: "TCI Freight",
    vendor: "Sundaram Fasteners",
    vendorCode: "VND-10077",
    po: "PO-2026-118401",
    poValue: "₹ 11,20,300",
    driver: "Mahesh Gowda",
    driverPhone: "+91 90083 55210",
    license: "KA5120150778120",
    arrivalTime: "08:24",
    waitMins: 46,
    status: "Dock Assigned",
    dock: "D-03",
    material: "Fasteners & Fittings — Component",
    pallets: 12,
    weight: "9.8 T",
    securityGuard: "S. Patil (Gate 2)",
    remarks: "Second visit this week. Cleared without exception.",
    priority: "Normal",
  },
  {
    id: "GE-4817",
    gateEntryNo: "GE/2026/07/4817",
    truckNo: "TN 09 BK 5560",
    transporter: "VRL Logistics",
    vendor: "Chennai Steel Traders",
    vendorCode: "VND-10912",
    po: "PO-2026-118388",
    poValue: "₹ 32,05,000",
    driver: "Selvam Murugan",
    driverPhone: "+91 94440 87231",
    license: "TN0920160443211",
    arrivalTime: "07:52",
    waitMins: 0,
    status: "Receiving",
    dock: "D-01",
    material: "CR Sheets — Raw Material",
    pallets: 30,
    weight: "26.2 T",
    securityGuard: "R. Yadav (Gate 1)",
    remarks: "Overdimension load, escorted to dock.",
    priority: "High",
  },
  {
    id: "GE-4815",
    gateEntryNo: "GE/2026/07/4815",
    truckNo: "DL 01 LX 3391",
    transporter: "Gati KWE",
    vendor: "NorthTech Electricals",
    vendorCode: "VND-10333",
    po: "PO-2026-118370",
    poValue: "₹ 4,15,600",
    driver: "Harpreet Singh",
    driverPhone: "+91 98110 23344",
    license: "DL0120180991122",
    arrivalTime: "07:05",
    waitMins: 0,
    status: "Completed",
    dock: "D-05",
    material: "Cable Harness — Component",
    pallets: 8,
    weight: "2.4 T",
    securityGuard: "M. Das (Gate 1)",
    remarks: "GRN raised, vehicle released 08:41.",
    priority: "Low",
  },
  {
    id: "GE-4820",
    gateEntryNo: "GE/2026/07/4820",
    truckNo: "RJ 14 PC 8890",
    transporter: "Rivigo Services",
    vendor: "Marwar Chemicals",
    vendorCode: "VND-10555",
    po: "PO-2026-118420",
    poValue: "₹ 8,70,900",
    driver: "Devendra Rathore",
    driverPhone: "+91 93140 66120",
    license: "RJ1420140556677",
    arrivalTime: "08:57",
    waitMins: 33,
    status: "Hold",
    material: "Industrial Solvent — Hazardous",
    pallets: 10,
    weight: "7.6 T",
    securityGuard: "M. Das (Gate 1)",
    remarks: "MSDS copy pending from vendor. Held at holding bay B.",
    priority: "High",
  },
];

export const activeArrival = arrivals[0]!;

export const docks = [
  { id: "D-01", zone: "Zone A — Bulk", status: "Occupied", vehicle: "TN 09 BK 5560", eta: "Free in 42 min", type: "Bulk / Crane" },
  { id: "D-02", zone: "Zone A — Bulk", status: "Available", vehicle: null, eta: "Ready now", type: "Bulk / Crane" },
  { id: "D-03", zone: "Zone B — Palletised", status: "Reserved", vehicle: "KA 51 MD 7702", eta: "Docking 09:55", type: "Forklift" },
  { id: "D-04", zone: "Zone B — Palletised", status: "Available", vehicle: null, eta: "Ready now", type: "Forklift" },
  { id: "D-05", zone: "Zone B — Palletised", status: "Cleaning", vehicle: null, eta: "Free in 12 min", type: "Forklift" },
  { id: "D-06", zone: "Zone C — Cold Chain", status: "Available", vehicle: null, eta: "Ready now", type: "Reefer" },
  { id: "D-07", zone: "Zone C — Cold Chain", status: "Occupied", vehicle: "MP 09 TG 2210", eta: "Free in 1h 05m", type: "Reefer" },
  { id: "D-08", zone: "Zone D — Hazmat", status: "Available", vehicle: null, eta: "Ready now", type: "Hazmat certified" },
] as const;

export const activity = [
  { time: "09:38", title: "Gate pass approved by Security", detail: "GJ 05 AW 1123 · Gate 1 · S. Patil", tone: "primary" },
  { time: "09:12", title: "New arrival notification raised", detail: "MH 12 QT 4489 · Hindustan Polymers Ltd.", tone: "primary" },
  { time: "08:56", title: "Dock D-03 reserved", detail: "KA 51 MD 7702 · Sundaram Fasteners", tone: "teal" },
  { time: "08:41", title: "GRN 2026/GRN/9911 posted", detail: "DL 01 LX 3391 · 8 pallets accepted", tone: "success" },
  { time: "08:20", title: "Arrival placed on hold", detail: "RJ 14 PC 8890 · MSDS document missing", tone: "warning" },
  { time: "07:52", title: "Receiving started at D-01", detail: "TN 09 BK 5560 · Team Alpha (4 members)", tone: "teal" },
];

export const arrivalTrend = [
  { hour: "06:00", arrivals: 2, received: 1 },
  { hour: "07:00", arrivals: 5, received: 3 },
  { hour: "08:00", arrivals: 8, received: 6 },
  { hour: "09:00", arrivals: 11, received: 7 },
  { hour: "10:00", arrivals: 9, received: 8 },
  { hour: "11:00", arrivals: 12, received: 9 },
  { hour: "12:00", arrivals: 7, received: 6 },
];

export const poLines = [
  { code: "RM-HDPE-04", desc: "HDPE Granules Grade 5502 — 25kg bag", uom: "BAG", ordered: 960, pending: 960, rate: "₹ 2,180" },
  { code: "RM-HDPE-09", desc: "HDPE Granules Grade 6070 — 25kg bag", uom: "BAG", ordered: 240, pending: 240, rate: "₹ 2,410" },
  { code: "PK-LIN-02", desc: "LDPE Liner Sheet 1200mm", uom: "ROLL", ordered: 40, pending: 18, rate: "₹ 3,050" },
];

export const receivingTeam = [
  { name: "Anil Verma", role: "Receiving Lead", initials: "AV" },
  { name: "Pooja Nair", role: "QC Inspector", initials: "PN" },
  { name: "Sanjay Rao", role: "Forklift Operator", initials: "SR" },
  { name: "Farid Khan", role: "Material Handler", initials: "FK" },
];

export const receivingChecklist = [
  { label: "Vehicle positioned & wheel chocks placed", done: true },
  { label: "Seal number verified against gate entry", done: true },
  { label: "Tailgate opened in presence of QC", done: true },
  { label: "Pallet count reconciled with invoice", done: false },
  { label: "Sample drawn for QC inspection", done: false },
  { label: "Putaway location proposed by WMS", done: false },
];
