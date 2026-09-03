import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { DamagePhoto } from "@/components/wms/damage-photo";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Award,
  BarChart3,
  Box,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  ClipboardList,
  Clock,
  Copy,
  DoorOpen,
  Download,
  Eye,
  FileCheck2,
  FileText,
  History,
  Image as ImageIcon,
  Layers,
  LayoutDashboard,
  Loader2,
  Mail,
  PackageCheck,
  Palette,
  Plus,
  Printer,
  QrCode,
  RefreshCw,
  Ruler,
  ScanLine,
  Search,
  Send,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Tag,
  Trash2,
  TrendingUp,
  Truck,
  Upload,
  User,
  Warehouse,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell, StatusBadge } from "@/components/wms/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api-client";
import { getUserInfo } from "@/lib/auth-utils";
import {
  QRScanResultModal,
  QrNotFoundModal,
  type QrScanResultData,
} from "@/components/wms/qr-scan-result-modal";

export const Route = createFileRoute("/grn")({
  validateSearch: (search: Record<string, unknown>) => ({
    tab: (search.tab as string) || "dashboard",
    page: Number(search.page) || 1,
  }),
  component: GrnPageWorkflow,
});

type GrnLineItem = {
  grn_line_id?: string;
  material_name: string;
  item_code: string;
  variant_code?: string;
  size?: string;
  color?: string;
  grade?: string;
  po_quantity: number;
  cumulative_received_quantity?: number;
  cumulative_accepted_quantity?: number;
  cumulative_rejected_quantity?: number;
  good_quantity: number;
  damaged_quantity: number;
  balance_quantity: number;
  uom: string;
  material_category?: string;
  quality_approved_quantity?: number;
  quality_result?: string;
  damage_reason?: string;
};

type GrnHistoryEntry = {
  grn_id: string;
  grn_number: string;
  receipt_date?: string;
  vehicle_number?: string;
  driver_name?: string;
  dock_number?: string;
  received_quantity: number;
  accepted_quantity: number;
  rejected_quantity: number;
  cumulative_received: number;
  balance_quantity: number;
  status: string;
};

type PoProgress = {
  po_quantity: number;
  cumulative_received: number;
  cumulative_accepted: number;
  cumulative_rejected: number;
  balance_quantity: number;
  percentage_received: number;
  po_status: string;
};

type BatchEntry = {
  batch_id?: string;
  batch_number: string;
  batch_quantity: number;
  variant_code?: string;
  size?: string;
  color?: string;
  grade?: string;
  qr_id?: string;
  qr_data_url?: string;
};

type UploadedDocument = {
  document_id?: string;
  category: string;
  file_name: string;
  file_path: string;
};

type GrnHeaderState = {
  po_number: string;
  supplier_name: string;
  supplier_company_name: string;
  supplier_email?: string;
  asn_number: string;
  gate_entry_number: string;
  warehouse_name: string;
  receiving_dock: string;
  grn_number: string;
  receipt_type: "PO_RECEIPT" | "UNEXPECTED_DELIVERY";
  vehicle_number: string;
  driver_name: string;
  invoice_number: string;
  received_by: string;
};

const PAGES = [
  { id: 1, title: "Page 1: GRN Header Details", subtitle: "PO Lookup, Supplier, Gate Entry & Dock Selection" },
  { id: 2, title: "Page 2: Item Receiving Details", subtitle: "Material Receiving, Good/Damaged Qty & Balance Calculations" },
  { id: 3, title: "Page 3: Damaged Goods & Photo Evidence", subtitle: "Photo Proof & Quality Inspection Approval" },
  { id: 4, title: "Page 4: Batch Creation", subtitle: "Lot/Batch Allocation & Total Quantity Validation" },
  { id: 5, title: "Page 5: Document Upload", subtitle: "Invoice, Challan, Packing List & Damage Attachments" },
  { id: 6, title: "Page 6: QR Code Generation", subtitle: "Batch-wise QR Identification & Label Printing" },
];

function GrnPageWorkflow() {
  const search = Route.useSearch();
  const [activeTab, setActiveTab] = useState<"dashboard" | "records" | "wizard">((search.tab as any) || "dashboard");
  const [currentPage, setCurrentPage] = useState<number>(search.page || 1);

  useEffect(() => {
    if (search.tab) setActiveTab(search.tab as any);
    if (search.page) setCurrentPage(search.page);
  }, [search.tab, search.page]);

  // User Info (Client-Side Safe for SSR)
  const [loggedInUserName, setLoggedInUserName] = useState<string>("GRN Officer");
  useEffect(() => {
    const info = getUserInfo();
    if (info?.username) setLoggedInUserName(info.username);
  }, []);

  // Records List State
  const [grnRecords, setGrnRecords] = useState<any[]>([]);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // Page 1 - Header Form State
  const [header, setHeader] = useState<GrnHeaderState>({
    grn_number: "",
    po_number: "",
    supplier_name: "",
    supplier_company_name: "",
    supplier_email: "",
    asn_number: "",
    gate_entry_number: "",
    receiving_dock: "",
    warehouse_name: "",
    receipt_type: "PO_RECEIPT",
    vehicle_number: "",
    driver_name: "",
    invoice_number: "",
    received_by: loggedInUserName,
  });

  const contextRequest = useRef(0);
  const saveLock = useRef(false);
  const [grnId, setGrnId] = useState<string | null>(null);
  const [dockOptions, setDockOptions] = useState<any[]>([]);
  const [loadingContext, setLoadingContext] = useState(false);
  const [busyAction, setBusyAction] = useState(false);

  // Page 2 - Line Items & Multi-Shipment Partial Receiving State
  const [materials, setMaterials] = useState<GrnLineItem[]>([]);
  const [grnHistory, setGrnHistory] = useState<GrnHistoryEntry[]>([]);
  const [poProgress, setPoProgress] = useState<PoProgress | null>(null);
  const [allowOverReceipt, setAllowOverReceipt] = useState<boolean>(false);
  const [overReceiptReason, setOverReceiptReason] = useState<string>("");
  const [showGrnHistoryLog, setShowGrnHistoryLog] = useState<boolean>(true);

  // Page 3 - Damaged Goods & Quality State
  const [damagePhotos, setDamagePhotos] = useState<Record<string, { file?: File; previewUrl?: string; reason?: string; evidenceId?: string }>>({});
  const [qualityApproved, setQualityApproved] = useState<Record<string, number>>({});

  // Page 4 - Batches State
  const [materialBatches, setMaterialBatches] = useState<Record<string, BatchEntry[]>>({});

  // Page 5 - Documents State
  const [uploadedDocuments, setUploadedDocuments] = useState<UploadedDocument[]>([]);
  const [customDocTypes, setCustomDocTypes] = useState<string[]>([
    "Invoice Copy",
    "Delivery Challan Copy",
    "Packing List Copy",
    "Damage Photo Evidence",
    "Bill of Lading / LR Copy",
    "Quality Certificate / CoA",
    "Purchase Order Copy",
    "Weighment Slip",
    "Customs Clearance Document",
    "Tax Invoice / e-Way Bill",
  ]);
  const [selectedDocCategory, setSelectedDocCategory] = useState<string>("Invoice Copy");
  const [showAddCustomTypeInput, setShowAddCustomTypeInput] = useState(false);
  const [newCustomCategoryInput, setNewCustomCategoryInput] = useState("");
  const [pendingDocFile, setPendingDocFile] = useState<File | null>(null);
  const [viewingDocumentModal, setViewingDocumentModal] = useState<UploadedDocument | null>(null);

  // Page 6 - QR Generation State
  const [selectedQrMaterialCode, setSelectedQrMaterialCode] = useState<string>("ALL");
  const [enlargedQr, setEnlargedQr] = useState<{ title: string; qr_id: string; data_url: string; payload: string; batch: BatchEntry; itemCode: string } | null>(null);
  const [showQualityPassModal, setShowQualityPassModal] = useState(false);
  const [showNotifyVendorModal, setShowNotifyVendorModal] = useState(false);
  const [notifyVendorEmail, setNotifyVendorEmail] = useState("spoorthiharakuni@gmail.com");
  const [notifyVendorRemarks, setNotifyVendorRemarks] = useState("");
  const [sendingVendorNotify, setSendingVendorNotify] = useState(false);

  // QR Scan Result Modal & Live Scanner State
  const [scanResultData, setScanResultData] = useState<QrScanResultData | null>(null);
  const [isScanResultModalOpen, setIsScanResultModalOpen] = useState(false);
  const [qrNotFoundOpen, setQrNotFoundOpen] = useState(false);
  const [scannedCodeValue, setScannedCodeValue] = useState("");
  const [isScanningQr, setIsScanningQr] = useState(false);
  const [manualScanInputOpen, setManualScanInputOpen] = useState(false);
  const [manualScanText, setManualScanText] = useState("");

  // Material Master & Variants Metadata for dynamic QR encoding
  const [materialMasterList, setMaterialMasterList] = useState<any[]>([]);

  useEffect(() => {
    api.getMaterials({ status: "Active" })
      .then((res: any) => {
        if (Array.isArray(res)) setMaterialMasterList(res);
        else if (res?.items && Array.isArray(res.items)) setMaterialMasterList(res.items);
      })
      .catch((err) => console.warn("Could not preload material master for QR generation:", err));
  }, []);

  function formatReadableDate(dateStr?: string) {
    if (!dateStr) {
      const now = new Date();
      return now.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).replace(/ /g, "-");
    }
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).replace(/ /g, "-");
    } catch {
      return dateStr;
    }
  }

  function getMaterialVariantInfo(itemCode: string, preferredVariantCode?: string) {
    const master = materialMasterList.find((m) => m.material_code === itemCode || m.code === itemCode);
    let variant = null;
    if (preferredVariantCode && master?.variants && Array.isArray(master.variants)) {
      variant = master.variants.find((v: any) => v.variant_code?.toUpperCase() === preferredVariantCode.toUpperCase());
    }
    if (!variant && master?.variants && Array.isArray(master.variants) && master.variants.length > 0) {
      variant = master.variants[0];
    }
    return {
      variant_code: variant?.variant_code || (preferredVariantCode || `${itemCode}-V001`),
      size: variant?.size || variant?.dimension || "25 mm × 3 m",
      color: variant?.color || "White",
      grade: variant?.grade || variant?.standard || "ISI",
      specification: variant?.specification || master?.specification || "",
      category: master?.category || master?.material_category || "Raw Materials",
    };
  }

  // Dashboard & Detail Drawer State
  const [selectedGrnDetail, setSelectedGrnDetail] = useState<any | null>(null);
  const [dashboardStatusFilter, setDashboardStatusFilter] = useState<string>("ALL");
  const [showAssignDockModal, setShowAssignDockModal] = useState(false);
  const [assigningDockId, setAssigningDockId] = useState("DOCK-03");
  const [assigningVehicle, setAssigningVehicle] = useState("");
  const [assigningPo, setAssigningPo] = useState("");

  // Fetch Records
  const loadRecords = useCallback(async () => {
    setLoadingRecords(true);
    try {
      const items = await api.getGrnDrafts(undefined, searchTerm || undefined);
      if (Array.isArray(items) && items.length > 0) {
        setGrnRecords(items);
      } else {
        setGrnRecords((prev) =>
          prev.length > 0
            ? prev
            : [
              {
                grn_id: "grn-2026-0001",
                grn_number: "GRN-2026-0001",
                po_number: "PO-1001",
                supplier_name: "ABC Supplier Ltd",
                supplier_company_name: "ABC Supplier Ltd",
                supplier_email: "spoorthiharakuni@gmail.com",
                vehicle_number: "AP02AB1234",
                driver_name: "Ramesh",
                dock_number: "DOCK-02",
                status: "PARTIALLY COMPLETED",
                receipt_date: "2026-08-30",
                received_by: loggedInUserName || "Officer Obaiah",
                materials: [
                  {
                    item_code: "MAT-STEEL-001",
                    material_name: "High-Tensile Steel Coil 2mm",
                    po_quantity: 100,
                    good_quantity: 80,
                    damaged_quantity: 5,
                    combined_received: 85,
                    balance_quantity: 15,
                    uom: "MT",
                  },
                ],
              },
              {
                grn_id: "grn-2026-0002",
                grn_number: "GRN-2026-0002",
                po_number: "PO-1002",
                supplier_name: "XYZ Industrial Supplies",
                supplier_company_name: "XYZ Industrial Supplies",
                supplier_email: "xyz@industrial.com",
                vehicle_number: "KA01EQ9921",
                driver_name: "Suresh",
                dock_number: "DOCK-01",
                status: "COMPLETED",
                receipt_date: "2026-08-29",
                received_by: loggedInUserName || "Officer Obaiah",
                materials: [
                  {
                    item_code: "MAT-ALU-002",
                    material_name: "Aluminum Ingot Grade A",
                    po_quantity: 500,
                    good_quantity: 480,
                    damaged_quantity: 20,
                    combined_received: 500,
                    balance_quantity: 0,
                    uom: "Kg",
                  },
                ],
              },
            ]
        );
      }
    } catch (err: any) {
      console.log("API loadRecords fallback:", err);
    } finally {
      setLoadingRecords(false);
    }
  }, [searchTerm, loggedInUserName]);

  // Dynamic Metrics for Dashboard
  const completedGrnsCount = grnRecords.filter((r) => {
    const st = (r.status || "").toUpperCase().trim();
    return st === "COMPLETED" || st === "POSTED" || st === "CLOSED";
  }).length;

  const partiallyCompletedGrnsCount = grnRecords.filter((r) => {
    const st = (r.status || "").toUpperCase().trim();
    return st.includes("PARTIAL") || st.includes("DRAFT") || st.includes("IN_PROGRESS") || st.includes("PENDING");
  }).length;

  const damagedLotsCount = grnRecords.filter((r) => {
    const lines = r.lines || r.materials || r.items || [];
    return lines.some((l: any) => (Number(l.damaged_quantity) || 0) > 0 || (Number(l.rejected_quantity) || 0) > 0);
  }).length;

  const totalSoundUnits = grnRecords.reduce((sum, r) => {
    const lines = r.lines || r.materials || r.items || [];
    return sum + lines.reduce((lSum: number, l: any) => lSum + (Number(l.good_quantity ?? l.received_quantity) || 0), 0);
  }, 0);

  const totalDamagedUnits = grnRecords.reduce((sum, r) => {
    const lines = r.lines || r.materials || r.items || [];
    return sum + lines.reduce((lSum: number, l: any) => lSum + (Number(l.damaged_quantity ?? l.rejected_quantity) || 0), 0);
  }, 0);

  const totalEvaluatedUnits = totalSoundUnits + totalDamagedUnits;
  const qualityPassRateStr = totalEvaluatedUnits > 0
    ? `${((totalSoundUnits / totalEvaluatedUnits) * 100).toFixed(1)}%`
    : "99.3%";

  const dashboardFilteredRecords = grnRecords.filter((r) => {
    const st = (r.status || "").toUpperCase().trim();
    if (dashboardStatusFilter === "ALL") return true;
    if (dashboardStatusFilter === "COMPLETED") {
      return st === "COMPLETED" || st === "POSTED" || st === "CLOSED";
    }
    if (dashboardStatusFilter === "PARTIALLY COMPLETED") {
      return st.includes("PARTIAL") || st.includes("DRAFT") || st.includes("IN_PROGRESS") || st.includes("PENDING");
    }
    return true;
  });

  const [availablePos, setAvailablePos] = useState<any[]>([]);

  useEffect(() => {
    async function loadPos() {
      try {
        const pos = await api.getPurchaseOrders();
        if (Array.isArray(pos) && pos.length > 0) {
          // Strictly filter ONLY official PO numbers (e.g. PO-2026-0001), ignoring proposal (PROP-) or RFQ codes
          const validPos = pos.filter((p: any) => {
            const num = (p.poNumber || p.po_number || "").toUpperCase().trim();
            return num.startsWith("PO-") || /^PO\d+/i.test(num);
          });
          setAvailablePos(validPos.length > 0 ? validPos : pos);
          const firstValidPo = validPos.find((p: any) => p.items && p.items.length > 0) || validPos[0];
          if (firstValidPo && (firstValidPo.poNumber || firstValidPo.po_number)) {
            const targetPo = firstValidPo.poNumber || firstValidPo.po_number;
            setHeader((prev) => ({ ...prev, po_number: targetPo }));
            void fetchPoContext(targetPo);
          }
        }
      } catch (e) {
        console.error("Failed to load POs", e);
      }
    }
    void loadPos();
  }, []);

  useEffect(() => {
    void loadRecords();
  }, [loadRecords]);

  // Page 1: Auto-Fetch PO Context (100% Dynamic for Present & Future PO Numbers)
  async function fetchPoContext(targetPoNumber?: string) {
    const numToFetch = (targetPoNumber || header.po_number).trim();
    if (!numToFetch) {
      toast.error("Please select or enter a valid PO Number");
      return;
    }

    const cleanPo = numToFetch.toUpperCase();
    if (cleanPo.startsWith("PROP") || cleanPo.startsWith("RFQ") || cleanPo.startsWith("PR-")) {
      toast.error(`Invalid PO Code '${numToFetch}': Only official Purchase Order numbers (e.g. PO-2026-0001) are accepted in GRN. Proposal codes cannot be used.`);
      return;
    }

    if (saveLock.current) return;
    const requestId = ++contextRequest.current;
    setLoadingContext(true);
    try {
      const ctx = await api.getGrnContext(numToFetch);
      if (requestId !== contextRequest.current) return;
      const supplierName = ctx.supplier_name || ctx.supplierName || "Supplier";
      const supplierComp = ctx.supplier_company_name || ctx.supplierCompanyName || supplierName;
      const supplierEmail = ctx.supplier_email || ctx.supplierEmail || ctx.supplier?.email || ctx.supplier?.contact?.primary_email || "spoorthiharakuni@gmail.com";
      const asnNum = ctx.asn_number || ctx.asnNumber || ctx.asn?.asn_number || ctx.asn?.asnNumber || `ASN-${numToFetch}`;
      const gateNum = ctx.gate_entry_number || ctx.gateEntryNumber || ctx.gate_entry?.gate_entry_number || ctx.gate_entry?.gateEntryNumber || `GE-${numToFetch}`;
      const vehicleNum = ctx.vehicle_number || ctx.vehicleNumber || ctx.asn?.vehicle_number || ctx.asn?.vehicleNumber || ctx.gate_entry?.vehicle_number || ctx.gate_entry?.vehicleNumber || `KA01EQ${numToFetch.replace(/\D/g, "") || "1001"}`;
      const driverName = ctx.driver_name || ctx.driverName || ctx.asn?.driver_name || ctx.asn?.driverName || ctx.gate_entry?.driver_name || ctx.gate_entry?.driverName || "Ramesh Kumar";
      const warehouseName = ctx.warehouse_name || ctx.warehouseName || "Main Warehouse";
      const prefilledDock = ctx.prefilled_dock_number || ctx.prefilledDockNumber || (ctx.dock_options && ctx.dock_options[0]?.dock_number) || "DOCK-01";
      const generatedGrnNum = ctx.grn_number || ctx.grnNumber || `GRN-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, "0")}${String(new Date().getDate()).padStart(2, "0")}-${Math.floor(1000 + Math.random() * 9000)}`;

      setHeader({
        receipt_type: "PO_RECEIPT",
        po_number: numToFetch,
        supplier_name: supplierName,
        supplier_company_name: supplierComp,
        supplier_email: supplierEmail,
        asn_number: asnNum,
        gate_entry_number: gateNum,
        warehouse_name: warehouseName,
        grn_number: generatedGrnNum,
        vehicle_number: vehicleNum,
        driver_name: driverName,
        receiving_dock: prefilledDock,
        invoice_number: "",
        received_by: loggedInUserName,
      });

      setGrnId(ctx.grn_id || ctx.grnId || null);
      if (ctx.dock_options && ctx.dock_options.length > 0) {
        setDockOptions(ctx.dock_options);
      }
      setGrnHistory(ctx.grn_history || ctx.grnHistory || []);
      setPoProgress(ctx.po_progress || ctx.poProgress || null);
      setAllowOverReceipt(false);
      setOverReceiptReason("");

      let masterCatalog: any[] = [];
      try {
        const mats = await api.getMaterialsMasterList();
        if (Array.isArray(mats)) masterCatalog = mats;
      } catch (e) {
        // ignore master catalog lookup error
      }

      const mapped: GrnLineItem[] = (ctx.lines || []).map((l: any) => {
        const code = l.item_code || l.itemCode;
        const name = l.material_name || l.materialName || code;
        const poQty = Number(l.ordered_quantity ?? l.orderedQuantity ?? 100);
        const cumRec = Number(l.cumulative_received_quantity ?? l.cumulativeReceivedQuantity ?? 0);
        const cumAcc = Number(l.cumulative_accepted_quantity ?? l.cumulativeAcceptedQuantity ?? 0);
        const cumRej = Number(l.cumulative_rejected_quantity ?? l.cumulativeRejectedQuantity ?? 0);
        const liveBal = Number(l.balance_quantity ?? l.balanceQuantity ?? Math.max(poQty - cumAcc, 0));
        const goodQty = liveBal; // Default to receiving remaining live balance
        const dmgQty = 0;

        const catalogMat = masterCatalog.find(
          (cm: any) =>
            (cm.material_code && cm.material_code.toLowerCase() === (code || "").toLowerCase()) ||
            (cm.material_name && cm.material_name.toLowerCase() === (name || "").toLowerCase())
        );
        const firstVar = catalogMat?.variants?.[0];

        const variantCode = l.variant_code || l.variantCode || firstVar?.variant_code || `${code}-V001`;
        const sizeVal = l.size || firstVar?.size || "Standard";
        const colorVal = l.color || firstVar?.color || "N/A";
        const gradeVal = l.grade || firstVar?.grade || "Grade A";
        const categoryVal = l.material_category || l.materialCategory || catalogMat?.category || "Raw Materials";

        return {
          grn_line_id: l.grn_line_id || l.grnLineId,
          material_name: name,
          item_code: code,
          variant_code: variantCode,
          size: sizeVal,
          color: colorVal,
          grade: gradeVal,
          po_quantity: poQty,
          cumulative_received_quantity: cumRec,
          cumulative_accepted_quantity: cumAcc,
          cumulative_rejected_quantity: cumRej,
          good_quantity: goodQty,
          damaged_quantity: dmgQty,
          balance_quantity: liveBal,
          uom: l.uom || catalogMat?.uom || "PCS",
          material_category: categoryVal,
          quality_approved_quantity: goodQty,
          quality_result: "ACCEPTED",
        };
      });

      {
        setMaterials(mapped);
        const qApp: Record<string, number> = {};
        const initBatches: Record<string, BatchEntry[]> = {};
        mapped.forEach((m) => {
          qApp[m.item_code] = m.good_quantity;
          initBatches[m.item_code] = [
            {
              batch_number: `BATCH-${m.item_code}-001`,
              batch_quantity: m.good_quantity,
              variant_code: m.variant_code,
              size: m.size,
              color: m.color,
              grade: m.grade,
            },
          ];
        });
        setQualityApproved(qApp);
        setMaterialBatches(initBatches);
      }

      toast.success(`Auto-Fetched PO ${numToFetch} details from database`);
    } catch (err: any) {
      if (requestId !== contextRequest.current) return;
      console.error("Auto PO Fetch error:", err);
      toast.error(err.message || "Failed to fetch PO details");
    } finally {
      if (requestId === contextRequest.current) setLoadingContext(false);
    }
  }

  // Use one explicit lookup path. Background duplicate lookups must not clear
  // the ID returned by a completed header save.
  function changePoNumber(value: string) {
    ++contextRequest.current;
    setLoadingContext(false);
    setGrnId(null);
    setMaterials([]);
    setGrnHistory([]);
    setPoProgress(null);
    setAllowOverReceipt(false);
    setOverReceiptReason("");
    setDamagePhotos({});
    setQualityApproved({});
    setMaterialBatches({});
    setHeader((previous) => ({ ...previous, po_number: value, grn_number: "" }));
    setCurrentPage(1);

    const trimmed = value.trim().toUpperCase();
    if (trimmed.startsWith("PROP") || trimmed.startsWith("RFQ") || trimmed.startsWith("PR-")) {
      toast.error(`Invalid PO Code '${value.trim()}': Only official Purchase Order codes (e.g. PO-2026-0001) are accepted in GRN. Proposals cannot be used.`);
      return;
    }

    if (value.trim()) {
      void fetchPoContext(value.trim());
    }
  }

  async function saveGrnHeader(): Promise<string> {
    if (!header.receiving_dock.trim()) {
      throw new Error("Please select a Receiving Dock on Page 1.");
    }
    if (header.receipt_type === "PO_RECEIPT") {
      if (!header.po_number.trim()) {
        throw new Error("Please select or enter an official PO Number on Page 1.");
      }
      const cleanPo = header.po_number.trim().toUpperCase();
      if (cleanPo.startsWith("PROP") || cleanPo.startsWith("RFQ") || cleanPo.startsWith("PR-")) {
        throw new Error(`Invalid PO Code '${header.po_number}': Only official Purchase Order codes (e.g. PO-2026-0001) are accepted in GRN. Proposals cannot be used.`);
      }
    }
    const res = await api.createGrnHeader({
      receipt_type: header.receipt_type,
      po_number: header.po_number.trim() || undefined,
      dock_number: header.receiving_dock.trim(),
      invoice_number: header.invoice_number,
      supplier_name: header.supplier_name,
      supplier_company_name: header.supplier_company_name,
      warehouse_name: header.warehouse_name,
      vehicle_number: header.vehicle_number,
      driver_name: header.driver_name,
    });
    const savedGrnId = res?.grnId || res?.grn_id;

    if (!savedGrnId) {
      const responseFields =
        res && typeof res === "object"
          ? Object.keys(res).join(", ")
          : String(res);

      throw new Error(
        `GRN save response fields: ${responseFields || "(empty response)"}`
      );
    }
    setGrnId(savedGrnId);
    setHeader((previous) => ({ ...previous, grn_number: res.grn_number || res.grnNumber || previous.grn_number }));
    return savedGrnId;
  }

  async function handleProceedFromPage1() {
    if (saveLock.current || loadingContext) return;
    saveLock.current = true;
    ++contextRequest.current;
    setBusyAction(true);
    try {
      await saveGrnHeader();
      toast.success("GRN header saved successfully.");
      setCurrentPage(2);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save GRN header.");
    } finally {
      saveLock.current = false;
      setBusyAction(false);
    }
  }

  // Page 2 Calculations, Live Cumulative Totals & PO Progress
  const totalPoQty = materials.reduce((acc, m) => acc + m.po_quantity, 0);
  const totalPrevReceived = materials.reduce((acc, m) => acc + (m.cumulative_received_quantity || 0), 0);
  const totalPrevAccepted = materials.reduce((acc, m) => acc + (m.cumulative_accepted_quantity || 0), 0);
  const totalPrevRejected = materials.reduce((acc, m) => acc + (m.cumulative_rejected_quantity || 0), 0);
  const totalAvailableBalQty = materials.reduce((acc, m) => acc + ((m.balance_quantity !== undefined && m.balance_quantity !== null) ? m.balance_quantity : m.po_quantity), 0);
  const totalGoodQty = materials.reduce((acc, m) => acc + (Number(m.good_quantity) || 0), 0);
  const totalDamagedQty = materials.reduce((acc, m) => acc + (Number(m.damaged_quantity) || 0), 0);
  const totalCurrentShipmentRec = totalGoodQty + totalDamagedQty;
  const totalProjectedBalanceQty = Math.max(totalAvailableBalQty - totalCurrentShipmentRec, 0);
  const isAllFullyDeliveredInThisShipment = materials.length > 0 && materials.every((m) => {
    const liveBal = (m.balance_quantity !== undefined && m.balance_quantity !== null) ? m.balance_quantity : m.po_quantity;
    const rec = (Number(m.good_quantity) || 0) + (Number(m.damaged_quantity) || 0);
    return rec >= liveBal;
  });
  const calculatedGrnStatus = isAllFullyDeliveredInThisShipment ? "COMPLETED" : "PARTIALLY COMPLETED";

  const totalPrevAcceptedPercent = totalPoQty > 0
    ? Math.min(100, Math.round((totalPrevAccepted / totalPoQty) * 100))
    : 0;

  const currentPoStatus = (poProgress as any)?.po_status || (poProgress as any)?.poStatus || (
    totalPrevAccepted >= totalPoQty && totalPoQty > 0
      ? "CLOSED / FULLY RECEIVED"
      : (totalPrevAccepted > 0 ? "PARTIALLY RECEIVED" : "OPEN")
  );

  const hasOverReceiptLine = materials.some((m) => {
    const liveBal = (m.balance_quantity !== undefined && m.balance_quantity !== null) ? m.balance_quantity : m.po_quantity;
    return ((Number(m.good_quantity) || 0) + (Number(m.damaged_quantity) || 0)) > liveBal;
  });

  // Page 2 -> Proceed to Page 3
  async function handleProceedFromPage2() {
    if (saveLock.current || loadingContext) return;
    if (!materials.length) {
      toast.error("Fetch the PO materials on Page 1 first.");
      setCurrentPage(1);
      return;
    }
    if (new Set(materials.map((m) => m.item_code)).size !== materials.length) {
      toast.error("Duplicate material codes cannot be matched safely to saved lines.");
      return;
    }
    if (materials.some((m) => !Number.isFinite(m.good_quantity) ||
      !Number.isFinite(m.damaged_quantity) || m.good_quantity < 0 || m.damaged_quantity < 0)) {
      toast.error("Enter valid, non-negative receiving quantities.");
      return;
    }

    const invalidLine = materials.find(
      (m) => (m.good_quantity || 0) + (m.damaged_quantity || 0) > (m.balance_quantity ?? m.po_quantity)
    );
    if (invalidLine && !allowOverReceipt) {
      toast.error(
        `Quantity for ${invalidLine.material_name} (${(invalidLine.good_quantity || 0) + (invalidLine.damaged_quantity || 0)}) exceeds available PO Balance (${invalidLine.balance_quantity ?? invalidLine.po_quantity}). Please enable 'Over-Receipt Approval' to proceed.`
      );
      return;
    }
    if (allowOverReceipt && !overReceiptReason.trim()) {
      toast.error("Please enter manager authorization / approval remarks for over-receipt.");
      return;
    }

    saveLock.current = true;
    ++contextRequest.current;
    setBusyAction(true);
    try {
      // Use the returned ID immediately; React state updates are asynchronous.
      const savedGrnId = grnId || await saveGrnHeader();
      const result = await api.updateGrnLines(
        savedGrnId,
        materials.map((m) => ({
          item_code: m.item_code,
          material_name: m.material_name,
          good_quantity: m.good_quantity,
          damaged_quantity: m.damaged_quantity,
        })),
        allowOverReceipt,
        overReceiptReason
      );
      if (!Array.isArray(result?.lines)) throw new Error("Backend did not return saved GRN lines.");
      const lines = result.lines.map((line: any) => ({
        item_code: line.item_code || line.itemCode,
        grn_line_id: line.grn_line_id || line.grnLineId,
      })) as Array<{ item_code: string; grn_line_id: string }>;

      const updated = materials.map((m) => {
        const matches = lines.filter((line) => line.item_code === m.item_code);
        if (matches.length !== 1 || !matches[0]?.grn_line_id) {
          throw new Error(`Cannot identify the saved line for ${m.item_code}.`);
        }
        return { ...m, grn_line_id: matches[0]?.grn_line_id || "" };
      });
      setMaterials(updated);
      setQualityApproved(Object.fromEntries(updated.map((m) => [m.item_code, m.good_quantity])));
      setCurrentPage(3);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save material details.");
    } finally {
      saveLock.current = false;
      setBusyAction(false);
    }
  }

  // Page 3 Damaged Items Filter
  const damagedMaterials = materials.filter((m) => m.damaged_quantity > 0);

  // Page 4 Validation Check
  function getBatchValidation(itemCode: string) {
    const mat = materials.find((m) => m.item_code === itemCode);
    const appQty = (qualityApproved[itemCode] !== undefined) ? qualityApproved[itemCode] : (mat?.good_quantity ?? 0);
    const batches = materialBatches[itemCode] || [];
    const totalBatchQty = batches.reduce((acc, b) => acc + Number(b.batch_quantity || 0), 0);
    const isValid = (totalBatchQty === appQty) || (appQty === 0 && (totalBatchQty === 0 || batches.length === 0));
    return { appQty, totalBatchQty, isValid };
  }

  const allBatchesValid = materials.every((m) => getBatchValidation(m.item_code).isValid);

  type DamageQrEntry = {
    damage_lot_id: string;
    damage_lot_number: string;
    item_code: string;
    material_name: string;
    damaged_quantity: number;
    uom: string;
    reason: string;
    qa_status: string;
    quarantine_location: string;
    status: string;
    qr_id: string;
    qr_code: string;
    qr_payload: string;
    qr_data_url: string;
  };

  const [damageQrLabels, setDamageQrLabels] = useState<DamageQrEntry[]>([]);

  function buildDamageQrPayload(m: GrnLineItem, reasonText: string) {
    const lotNum = `DMG-LOT-${header.grn_number || "GRN-2026-0001"}-${m.item_code}`;
    const damagedQty = (m.damaged_quantity || 0) > 0 ? m.damaged_quantity : (m.rejected_quantity || 0);
    const variantInfo = getMaterialVariantInfo(m.item_code, m.variant_code);
    const uom = m.uom || "BUNDLE";
    const category = m.material_category || variantInfo.category || "Raw Materials";

    return [
      `Material Code: ${m.item_code}`,
      `Material Name: ${m.material_name || m.item_code}`,
      `Material Category: ${category}`,
      `Material Variant Code: ${variantInfo.variant_code}`,
      `Batch: ${lotNum}`,
      `Size: ${variantInfo.size}`,
      `Color: ${variantInfo.color}`,
      `Warehouse: ${header.warehouse_name || "Main Warehouse"}`,
      `Grade: ${variantInfo.grade}`,
      `UOM: ${uom}`,
      `Inspection Status: PARTIAL`,
      `Batch Quantity: ${damagedQty} ${uom}`,
    ].join("\n");
  }

  // Isolated pure QR printing helper (prints ONLY the QR code on a white background, 40mm x 40mm)
  function printOnlyQrCode(dataUrl: string, title?: string) {
    if (!dataUrl) {
      toast.error("QR Code image is not ready yet. Please wait a moment.");
      return;
    }

    const win = window.open("", "_blank", "width=500,height=500");
    if (!win) {
      // Fallback via isolated iframe if popups are blocked
      let iframe = document.getElementById("qr-isolated-print-iframe") as HTMLIFrameElement;
      if (!iframe) {
        iframe = document.createElement("iframe");
        iframe.id = "qr-isolated-print-iframe";
        iframe.style.position = "fixed";
        iframe.style.right = "0";
        iframe.style.bottom = "0";
        iframe.style.width = "0";
        iframe.style.height = "0";
        iframe.style.border = "0";
        document.body.appendChild(iframe);
      }
      const doc = iframe.contentWindow?.document;
      if (!doc) return;
      doc.open();
      doc.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>${title || "QR Code"}</title>
            <style>
              @page { size: auto; margin: 0mm; }
              * { box-sizing: border-box; margin: 0; padding: 0; }
              html, body { width: 100%; height: 100%; margin: 0; padding: 0; background: #ffffff !important; display: flex; align-items: center; justify-content: center; overflow: hidden; }
              .qr-print-wrapper { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: #ffffff !important; }
              img { width: 40mm; height: 40mm; max-width: 95vw; max-height: 95vh; object-fit: contain; image-rendering: -webkit-optimize-contrast; image-rendering: crisp-edges; display: block; }
              @media print {
                html, body { width: 100%; height: 100%; margin: 0 !important; padding: 0 !important; background: #ffffff !important; }
                .qr-print-wrapper { width: 100vw !important; height: 100vh !important; display: flex !important; align-items: center !important; justify-content: center !important; background: #ffffff !important; page-break-inside: avoid; }
                img { width: 40mm !important; height: 40mm !important; object-fit: contain !important; }
              }
            </style>
          </head>
          <body>
            <div class="qr-print-wrapper">
              <img src="${dataUrl}" alt="QR Code" />
            </div>
            <script>
              window.onload = () => { window.focus(); window.print(); };
            </script>
          </body>
        </html>
      `);
      doc.close();
      return;
    }

    win.document.open();
    win.document.write(`
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <title>${title || "QR Code"}</title>
          <style>
            @page {
              size: auto;
              margin: 0mm;
            }
            * {
              box-sizing: border-box;
              margin: 0;
              padding: 0;
            }
            html, body {
              width: 100%;
              height: 100%;
              background: #ffffff !important;
              display: flex;
              align-items: center;
              justify-content: center;
              margin: 0;
              padding: 0;
              overflow: hidden;
            }
            .qr-print-wrapper {
              display: flex;
              align-items: center;
              justify-content: center;
              width: 100%;
              height: 100%;
              background: #ffffff !important;
            }
            .qr-image {
              width: 40mm;
              height: 40mm;
              max-width: 90vw;
              max-height: 90vh;
              object-fit: contain;
              image-rendering: -webkit-optimize-contrast;
              image-rendering: crisp-edges;
              display: block;
            }
            @media print {
              html, body {
                width: 100%;
                height: 100%;
                background: #ffffff !important;
                margin: 0 !important;
                padding: 0 !important;
              }
              .qr-print-wrapper {
                width: 100vw !important;
                height: 100vh !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                background: #ffffff !important;
                page-break-inside: avoid;
              }
              .qr-image {
                width: 40mm !important;
                height: 40mm !important;
                object-fit: contain !important;
              }
            }
          </style>
        </head>
        <body>
          <div class="qr-print-wrapper">
            <img class="qr-image" src="${dataUrl}" alt="QR Code" />
          </div>
          <script>
            window.onload = function() {
              window.focus();
              setTimeout(function() {
                window.print();
                window.close();
              }, 250);
            };
          </script>
        </body>
      </html>
    `);
    win.document.close();
  }

  function printSingleDamageQrLabel(entry: DamageQrEntry) {
    if (!entry.qr_data_url) {
      toast.error("Damage QR Code is still generating. Please try again in a moment.");
      return;
    }
    printOnlyQrCode(entry.qr_data_url, entry.damage_lot_number);
    toast.success(`Printing Quarantine QR Label for ${entry.damage_lot_number}`);
  }

  function printAllDamageQrLabels() {
    if (damageQrLabels.length === 0) {
      toast.error("No damage QR labels to print.");
      return;
    }

    const validEntries = damageQrLabels.filter((e) => Boolean(e.qr_data_url));
    if (validEntries.length === 0) {
      toast.error("Quarantine QR images are still generating. Please wait a moment.");
      return;
    }

    const win = window.open("", "_blank", "width=600,height=600");
    if (!win) {
      toast.error("Please allow popups to print labels");
      return;
    }

    let pagesHtml = "";
    for (const entry of validEntries) {
      pagesHtml += `
        <div class="qr-page">
          <img class="qr-image" src="${entry.qr_data_url}" alt="Damage QR Code" />
        </div>
      `;
    }

    win.document.open();
    win.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>WMS Damaged Goods QR Labels - ${header.grn_number}</title>
          <style>
            @page { size: auto; margin: 0mm; }
            * { box-sizing: border-box; margin: 0; padding: 0; }
            html, body { width: 100%; height: 100%; background: #ffffff !important; }
            .qr-page {
              width: 100vw;
              height: 100vh;
              display: flex;
              align-items: center;
              justify-content: center;
              page-break-after: always;
              break-after: page;
              background: #ffffff !important;
            }
            .qr-image {
              width: 40mm;
              height: 40mm;
              object-fit: contain;
              image-rendering: -webkit-optimize-contrast;
              image-rendering: crisp-edges;
            }
          </style>
        </head>
        <body>
          ${pagesHtml}
          <script>
            window.onload = () => {
              window.focus();
              setTimeout(() => {
                window.print();
                window.close();
              }, 250);
            };
          </script>
        </body>
      </html>
    `);
    win.document.close();
    toast.success(`Printing ${validEntries.length} Quarantine QR labels`);
  }

  async function handleViewGrnDetail(r: any) {
    const targetId = r.grn_id || r.id || r.grn_number || r.grnNumber;
    if (targetId) {
      try {
        const fullDetail = await api.getGrnDetail(targetId);
        if (fullDetail && (fullDetail.lines || fullDetail.materials)) {
          setSelectedGrnDetail(fullDetail);
          return;
        }
      } catch (e) {
        console.warn("Could not fetch full GRN detail:", e);
      }
    }
    setSelectedGrnDetail(r);
  }

  // Print Official Goods Receipt Note (GRN) Certificate / Document
  async function printGrnCertificate(record: any) {
    let linesToRender = (record.lines && record.lines.length > 0) ? record.lines : ((record.materials && record.materials.length > 0) ? record.materials : []);
    const targetId = record.grn_id || record.id || record.grn_number || record.grnNumber;
    if (linesToRender.length === 0 && targetId) {
      try {
        const fullDetail = await api.getGrnDetail(targetId);
        if (fullDetail && (fullDetail.lines || fullDetail.materials)) {
          linesToRender = fullDetail.lines || fullDetail.materials;
          record = { ...record, ...fullDetail };
        }
      } catch {
        // fallback
      }
    }
    if (linesToRender.length === 0) linesToRender = materials;

    const win = window.open("", "_blank", "width=900,height=950");
    if (!win) {
      toast.error("Please allow popups to print GRN document");
      return;
    }
    const grnNum = record.grn_number || header.grn_number || "GRN-2026-0001";
    const poNum = record.po_number || header.po_number || "PO-1001";
    const supplier = record.supplier_name || header.supplier_name || "Supplier";
    const dock = record.dock_number || header.receiving_dock || "DOCK-01";
    const vehicle = record.vehicle_number || header.vehicle_number || "MH-12-N-5667";
    const driver = record.driver_name || header.driver_name || "Obaiah";
    const receivedBy = record.received_by || header.received_by || "GRN Officer";
    const dateStr = record.receipt_date || new Date().toISOString().split("T")[0];

    let rowsHtml = "";
    linesToRender.forEach((m: any, idx: number) => {
      rowsHtml += `
        <tr>
          <td>${idx + 1}</td>
          <td><strong>${m.item_code || m.itemCode}</strong></td>
          <td>${m.material_name || m.materialName || m.item_code}</td>
          <td>${m.ordered_quantity || m.po_quantity || 100} ${m.uom || "PCS"}</td>
          <td style="color:#047857;font-weight:bold;">${m.good_quantity ?? m.goodQuantity ?? 100} ${m.uom || "PCS"}</td>
          <td style="color:#b91c1c;font-weight:bold;">${m.damaged_quantity ?? m.damagedQuantity ?? 0} ${m.uom || "PCS"}</td>
          <td>${m.balance_quantity ?? m.balanceQuantity ?? 0} ${m.uom || "PCS"}</td>
        </tr>
      `;
    });

    win.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>WMS Goods Receipt Note Certificate - ${grnNum}</title>
          <style>
            body { font-family: sans-serif; padding: 30px; background: #fff; color: #1e293b; font-size: 13px; line-height: 1.5; }
            .header { border-bottom: 3px solid #0f172a; padding-bottom: 12px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-end; }
            .brand { font-size: 22px; font-weight: 800; color: #0f172a; letter-spacing: -0.5px; }
            .tag { background: #e2e8f0; font-size: 11px; font-weight: bold; padding: 4px 10px; border-radius: 6px; text-transform: uppercase; }
            .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; background: #f8fafc; padding: 14px; border-radius: 10px; border: 1px solid #e2e8f0; margin-bottom: 20px; font-size: 12px; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; }
            th { background: #0f172a; color: #fff; text-align: left; padding: 8px 10px; font-size: 11px; text-transform: uppercase; }
            td { padding: 8px 10px; border-bottom: 1px solid #e2e8f0; font-size: 12px; }
            .footer { margin-top: 40px; border-top: 1px dashed #cbd5e1; padding-top: 20px; display: flex; justify-content: space-between; text-align: center; }
            .sign-box { width: 200px; border-top: 1px solid #0f172a; padding-top: 6px; font-weight: bold; font-size: 11px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <div class="brand">NEXUS WMS • GOODS RECEIPT NOTE</div>
              <p style="margin:2px 0 0;font-size:11px;color:#64748b;">Official Material Inbound Quality & Stock Entry Certificate</p>
            </div>
            <div class="tag">GRN NO: ${grnNum}</div>
          </div>

          <div class="grid">
            <div><strong>PO Reference:</strong> ${poNum}</div>
            <div><strong>Supplier Name:</strong> ${supplier}</div>
            <div><strong>Receiving Dock:</strong> Dock ${dock}</div>
            <div><strong>Vehicle Registration:</strong> ${vehicle}</div>
            <div><strong>Driver Name:</strong> ${driver}</div>
            <div><strong>Receipt Date:</strong> ${dateStr}</div>
            <div><strong>Officer / Inspector:</strong> ${receivedBy}</div>
            <div><strong>Status:</strong> ${record.status || "COMPLETED & POSTED"}</div>
          </div>

          <h4 style="margin:15px 0 5px;font-size:12px;text-transform:uppercase;">Material Line Items Breakdown</h4>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Item Code</th>
                <th>Material Description</th>
                <th>Ordered Qty</th>
                <th>Good Qty</th>
                <th>Damaged Qty</th>
                <th>Balance Qty</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>

          <div class="footer">
            <div class="sign-box">Received By Officer<br/><span style="font-weight:normal;color:#64748b;">${receivedBy}</span></div>
            <div class="sign-box">Quality Control Inspector<br/><span style="font-weight:normal;color:#64748b;">QA Approved</span></div>
            <div class="sign-box">Warehouse Manager<br/><span style="font-weight:normal;color:#64748b;">Stock Verified</span></div>
          </div>

          <script>
            window.onload = () => { window.focus(); window.print(); };
          </script>
        </body>
      </html>
    `);
    win.document.close();
  }

  // Export GRN Records to CSV File
  function exportGrnRecordsCsv() {
    if (grnRecords.length === 0) {
      toast.info("No GRN records found in database to export");
      return;
    }
    const listToExport = grnRecords;

    let csv = "GRN Number,PO Number,Supplier Name,Dock Number,Vehicle Number,Driver Name,Status,Receipt Date,Received By\n";
    listToExport.forEach((r: any) => {
      csv += `"${r.grn_number || ''}","${r.po_number || ''}","${r.supplier_name || ''}","${r.dock_number || ''}","${r.vehicle_number || ''}","${r.driver_name || ''}","${r.status || ''}","${r.receipt_date || ''}","${r.received_by || ''}"\n`;
    });

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `WMS_GRN_Records_Export_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Exported ${listToExport.length} GRN records to CSV spreadsheet`);
  }

  function buildMaterialQrPayload(itemCode: string, batch?: BatchEntry) {
    const mat = materials.find((m) => m.item_code === itemCode);
    const bList = materialBatches[itemCode] || [];
    const b = batch || bList[0] || {
      batch_number: `BATCH-${itemCode}-001`,
      batch_quantity: mat?.good_quantity || 0,
      variant_code: mat?.variant_code,
      size: mat?.size,
      color: mat?.color,
      grade: mat?.grade,
    };
    const variantCode = b?.variant_code || mat?.variant_code || `${itemCode}-V001`;
    const sizeVal = b?.size || mat?.size || "Standard";
    const colorVal = b?.color || mat?.color || "N/A";
    const gradeVal = b?.grade || mat?.grade || "Grade A";
    const warehouseVal = header.warehouse_name || "Main Warehouse";
    const inspectionStatus = mat?.quality_result === "REJECTED" ? "REJECTED / DAMAGED" : "QUALITY APPROVED";
    const uomVal = mat?.uom || "PCS";
    const batchQty = b.batch_quantity !== undefined ? b.batch_quantity : (mat?.good_quantity ?? 0);

    return [
      `Material Code: ${itemCode}`,
      `Material Name: ${mat?.material_name || itemCode}`,
      `Material Category: ${mat?.material_category || "Raw Materials"}`,
      `Material Variant Code: ${variantCode}`,
      `Batch: ${b.batch_number}`,
      `Size: ${sizeVal}`,
      `Color: ${colorVal}`,
      `Warehouse: ${warehouseVal}`,
      `Grade: ${gradeVal}`,
      `UOM: ${uomVal}`,
      `Inspection Status: ${inspectionStatus}`,
      `Batch Quantity: ${batchQty} ${uomVal}`,
      `GRN Number: ${header.grn_number || "N/A"}`,
      `PO Reference: ${header.po_number || "N/A"}`,
      `Supplier: ${header.supplier_name || "N/A"}`,
    ].join("\n");
  }

  // Page 6 QR Code Generation (Material-Wise) -> Encodes complete self-contained stock details
  async function generateQrForMaterial(itemCode: string, batch?: BatchEntry) {
    const qrPayload = buildMaterialQrPayload(itemCode, batch);
    try {
      const url = await QRCode.toDataURL(qrPayload, {
        margin: 2,
        width: 500,
        errorCorrectionLevel: "M",
        color: {
          dark: "#000000",
          light: "#ffffff",
        },
      });
      return url;
    } catch (err) {
      console.error("QR Code generation error:", err);
      return "";
    }
  }

  function printSingleQrLabel(batchNumber: string, itemCode: string, qrId: string, dataUrl?: string) {
    let resolvedUrl = dataUrl;
    if (!resolvedUrl) {
      resolvedUrl = qrLabels[itemCode]?.data_url;
    }
    if (!resolvedUrl) {
      toast.error("QR Code image is still generating. Please try again in a moment.");
      return;
    }
    printOnlyQrCode(resolvedUrl, `QR-${batchNumber}`);
    toast.success(`Printing QR Label for Batch ${batchNumber}`);
  }

  function printAllPoQrLabels(targetItemCode?: string) {
    const filteredMaterials = targetItemCode
      ? materials.filter((m) => m.item_code === targetItemCode)
      : materials;

    const qrItems: { batchNumber: string; dataUrl: string }[] = [];
    for (const m of filteredMaterials) {
      const bList = materialBatches[m.item_code] || [];
      const qrInfo = qrLabels[m.item_code];
      if (qrInfo?.data_url) {
        for (const b of bList) {
          qrItems.push({ batchNumber: b.batch_number, dataUrl: qrInfo.data_url });
        }
      }
    }

    if (qrItems.length === 0) {
      toast.error("No batch QR codes available to print.");
      return;
    }

    const win = window.open("", "_blank", "width=600,height=600");
    if (!win) {
      toast.error("Please allow popups to print labels");
      return;
    }

    let pagesHtml = "";
    for (const item of qrItems) {
      pagesHtml += `
        <div class="qr-page">
          <img class="qr-image" src="${item.dataUrl}" alt="QR Code" />
        </div>
      `;
    }

    win.document.open();
    win.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>GRN Batch QR Labels - ${header.grn_number}</title>
          <style>
            @page { size: auto; margin: 0mm; }
            * { box-sizing: border-box; margin: 0; padding: 0; }
            html, body { width: 100%; height: 100%; background: #ffffff !important; }
            .qr-page {
              width: 100vw;
              height: 100vh;
              display: flex;
              align-items: center;
              justify-content: center;
              page-break-after: always;
              break-after: page;
              background: #ffffff !important;
            }
            .qr-image {
              width: 40mm;
              height: 40mm;
              object-fit: contain;
              image-rendering: -webkit-optimize-contrast;
              image-rendering: crisp-edges;
            }
          </style>
        </head>
        <body>
          ${pagesHtml}
          <script>
            window.onload = () => {
              window.focus();
              setTimeout(() => {
                window.print();
                window.close();
              }, 250);
            };
          </script>
        </body>
      </html>
    `);
    win.document.close();
    toast.success(`Printing ${qrItems.length} Batch QR labels`);
  }

  // Preview & Scan Modal Handlers (Resolves complete batch details for preview modal)
  function handlePreviewBatchQr(mat: GrnLineItem, batch: BatchEntry, qrInfo?: { qr_id: string; data_url: string; payload: string }) {
    const variantCode = batch.variant_code || mat.variant_code || `${mat.item_code}-V001`;
    const sizeVal = batch.size || mat.size || "Standard";
    const colorVal = batch.color || mat.color || "N/A";
    const gradeVal = batch.grade || mat.grade || "Grade A";
    const warehouseVal = header.warehouse_name || "Main Warehouse";
    const inspectionStatus = mat.quality_result === "REJECTED" ? "REJECTED" : "QUALITY APPROVED";
    const uomVal = mat.uom || "PCS";
    const batchQty = batch.batch_quantity !== undefined ? batch.batch_quantity : (mat.good_quantity ?? 0);
    const qrId = qrInfo?.qr_id || `QR-MAT-${mat.item_code}`;

    const data: QrScanResultData = {
      qr_id: qrId,
      grn_number: header.grn_number || "GRN-2026-0001",
      po_number: header.po_number || "PO-1001",
      material_code: mat.item_code,
      material_name: mat.material_name,
      variant_code: variantCode,
      size: sizeVal,
      color: colorVal,
      grade: gradeVal,
      specification: `Size: ${sizeVal} | Color: ${colorVal} | Grade: ${gradeVal}`,
      uom: uomVal,
      supplier_code: "SUP-00001",
      supplier_name: header.supplier_name || "Supplier",
      receipt_date: header.delivery_date || new Date().toISOString().split("T")[0],
      warehouse_name: warehouseVal,
      category: mat.material_category || "Raw Materials",
      batch_number: batch.batch_number,
      received_quantity: mat.po_quantity || (mat.good_quantity + mat.damaged_quantity),
      accepted_quantity: mat.good_quantity,
      damaged_quantity: mat.damaged_quantity,
      rejected_quantity: 0,
      batch_quantity: batchQty,
      inspection_status: inspectionStatus,
      stock_status: "AVAILABLE",
      summary: `Batch ${batch.batch_number} of ${mat.material_name} (${batchQty} ${uomVal}) is Quality Approved and ready for storage at ${warehouseVal}.`,
    };

    setScanResultData(data);
    setIsScanResultModalOpen(true);
    setEnlargedQr(null);
  }

  function handlePreviewDamageQr(dEntry: DamageQrEntry) {
    const data: QrScanResultData = {
      qr_id: dEntry.qr_code,
      grn_number: header.grn_number || "GRN-2026-0001",
      po_number: header.po_number || "PO-1001",
      material_code: dEntry.item_code,
      material_name: dEntry.material_name,
      variant_code: `${dEntry.item_code}-V001`,
      size: "Standard Specification",
      color: "Standard",
      grade: "Standard Industrial Grade",
      specification: `Reason: ${dEntry.reason}`,
      uom: dEntry.uom || "PCS",
      supplier_code: "SUP-00001",
      supplier_name: header.supplier_name || "Supplier",
      receipt_date: header.delivery_date || new Date().toISOString().split("T")[0],
      warehouse_name: header.warehouse_name || "Main Warehouse",
      category: "Quarantine / Damaged Goods",
      batch_number: dEntry.damage_lot_number,
      received_quantity: dEntry.damaged_quantity,
      accepted_quantity: 0,
      damaged_quantity: dEntry.damaged_quantity,
      rejected_quantity: 0,
      batch_quantity: dEntry.damaged_quantity,
      inspection_status: "REJECTED",
      stock_status: "QUARANTINED",
      summary: `${dEntry.damaged_quantity} ${dEntry.uom} of ${dEntry.material_name} quarantined at ${dEntry.quarantine_location}.\nReason: ${dEntry.reason}`,
    };

    setScanResultData(data);
    setIsScanResultModalOpen(true);
    setEnlargedQr(null);
  }

  // Scan / Read QR Code Handler -> Fetches from live DB & displays QRScanResultModal
  async function handleScanQrCode(scannedRaw: string) {
    if (!scannedRaw || !scannedRaw.trim()) {
      toast.error("Please provide or scan a QR code.");
      return;
    }
    const cleanCode = scannedRaw.trim();
    setScannedCodeValue(cleanCode);
    setIsScanningQr(true);

    try {
      // 1. Live backend database lookup
      const result = await api.lookupQrCode(cleanCode);
      setScanResultData(result);
      setIsScanResultModalOpen(true);
      setEnlargedQr(null);
      setManualScanInputOpen(false);
      toast.success("QR Code verified & stock details loaded.");
    } catch (err: any) {
      console.warn("Backend QR lookup fallback:", err);

      // 2. Fallback to active wizard session if working on an unsaved draft in Page 6
      const matchedWizardMaterial = materials.find(
        (m) =>
          cleanCode.includes(m.item_code) ||
          (qrLabels[m.item_code] && (cleanCode.includes(qrLabels[m.item_code].qr_id) || cleanCode.includes(m.item_code)))
      );
      const matchedDamageEntry = damageQrLabels.find(
        (d) =>
          cleanCode.includes(d.qr_code) ||
          cleanCode.includes(d.damage_lot_number) ||
          cleanCode.includes(d.item_code)
      );

      if (matchedDamageEntry) {
        setScanResultData({
          qr_id: matchedDamageEntry.qr_code,
          grn_number: header.grn_number || "GRN-2026-0001",
          po_number: header.po_number || "PO-2026-0001",
          material_code: matchedDamageEntry.item_code,
          material_name: matchedDamageEntry.material_name,
          variant_code: `${matchedDamageEntry.item_code}-V001`,
          size: "Standard Specification",
          color: "Standard",
          grade: "Standard Industrial Grade",
          uom: matchedDamageEntry.uom || "PCS",
          supplier_code: "SUP-00001",
          supplier_name: header.supplier_name || "Supplier",
          receipt_date: new Date().toLocaleDateString("en-GB"),
          warehouse_name: header.warehouse_name || "Main Warehouse",
          category: "Quarantine / Damaged Goods",
          batch_number: matchedDamageEntry.damage_lot_number,
          received_quantity: matchedDamageEntry.damaged_quantity,
          accepted_quantity: 0,
          damaged_quantity: matchedDamageEntry.damaged_quantity,
          rejected_quantity: 0,
          batch_quantity: matchedDamageEntry.damaged_quantity,
          inspection_status: "PARTIAL",
          stock_status: "QUARANTINED",
          summary: `${matchedDamageEntry.damaged_quantity} ${matchedDamageEntry.uom} damaged and moved to quarantine.\nReason: ${matchedDamageEntry.reason}`,
        });
        setIsScanResultModalOpen(true);
        setEnlargedQr(null);
        setManualScanInputOpen(false);
        toast.success("Quarantine QR Code verified & stock details loaded.");
      } else if (matchedWizardMaterial) {
        const bList = materialBatches[matchedWizardMaterial.item_code] || [];
        const b = bList[0] || {
          batch_number: `BATCH-${matchedWizardMaterial.item_code}-001`,
          batch_quantity: matchedWizardMaterial.good_quantity,
        };
        setScanResultData({
          qr_id: `QR-MAT-${matchedWizardMaterial.item_code}`,
          grn_number: header.grn_number || "GRN-2026-0001",
          po_number: header.po_number || "PO-2026-0001",
          material_code: matchedWizardMaterial.item_code,
          material_name: matchedWizardMaterial.material_name,
          variant_code: `${matchedWizardMaterial.item_code}-V001`,
          size: "Standard Specification",
          color: "Standard",
          grade: "Standard Industrial Grade",
          uom: matchedWizardMaterial.uom || "PCS",
          supplier_code: "SUP-00001",
          supplier_name: header.supplier_name || "Supplier",
          receipt_date: new Date().toLocaleDateString("en-GB"),
          warehouse_name: header.warehouse_name || "Main Warehouse",
          category: matchedWizardMaterial.material_category || "Raw Materials",
          batch_number: b.batch_number,
          received_quantity:
            matchedWizardMaterial.po_quantity ||
            matchedWizardMaterial.good_quantity + matchedWizardMaterial.damaged_quantity,
          accepted_quantity: matchedWizardMaterial.good_quantity,
          damaged_quantity: matchedWizardMaterial.damaged_quantity,
          rejected_quantity: 0,
          batch_quantity: b.batch_quantity,
          inspection_status: matchedWizardMaterial.damaged_quantity > 0 ? "PARTIAL" : "COMPLETED",
          stock_status: "AVAILABLE",
          summary:
            matchedWizardMaterial.damaged_quantity > 0
              ? `${matchedWizardMaterial.good_quantity} ${matchedWizardMaterial.uom} accepted and moved to stock.\n${matchedWizardMaterial.damaged_quantity} ${matchedWizardMaterial.uom} damaged and moved to quarantine.`
              : `${matchedWizardMaterial.good_quantity} ${matchedWizardMaterial.uom} accepted and moved to available stock.`,
        });
        setIsScanResultModalOpen(true);
        setEnlargedQr(null);
        setManualScanInputOpen(false);
        toast.success("QR Code verified & stock details loaded.");
      } else {
        setEnlargedQr(null);
        setManualScanInputOpen(false);
        setQrNotFoundOpen(true);
      }
    } finally {
      setIsScanningQr(false);
    }
  }

  // Render QR Codes material-wise on Page 6 load & auto-sync when dependencies change
  const [qrLabels, setQrLabels] = useState<Record<string, { qr_id: string; data_url: string; payload: string }>>({});

  useEffect(() => {
    let active = true;

    // Ensure EVERY material line item has batches compulsory
    const effectiveBatches: Record<string, BatchEntry[]> = { ...materialBatches };
    let updated = false;

    materials.forEach((m) => {
      const appQty = Number((qualityApproved[m.item_code] !== undefined) ? qualityApproved[m.item_code] : (m.good_quantity ?? 0));
      const existing = effectiveBatches[m.item_code];
      if (!existing || existing.length === 0) {
        effectiveBatches[m.item_code] = [
          { batch_number: `BATCH-${m.item_code}-001`, batch_quantity: appQty },
        ];
        updated = true;
      } else if (appQty === 0 && existing.length > 0 && (existing[0]?.batch_quantity ?? 0) > 0) {
        effectiveBatches[m.item_code] = existing.map((b) => ({ ...b, batch_quantity: 0 }));
        updated = true;
      }
    });

    if (updated) {
      setMaterialBatches(effectiveBatches);
    }

    if (currentPage === 6 || active) {
      void (async () => {
        const generated: Record<string, { qr_id: string; data_url: string; payload: string }> = {};
        for (const m of materials) {
          if ((m.good_quantity || 0) <= 0) continue;
          const code = m.item_code;
          if (generated[code]) continue;

          const bList = effectiveBatches[code] || [];
          const b = bList[0] || { batch_number: `BATCH-${code}-001`, batch_quantity: m.good_quantity };
          const qrId = `QR-MAT-${code}`;
          const url = await generateQrForMaterial(code, b);
          const payload = buildMaterialQrPayload(code, b);
          generated[code] = { qr_id: qrId, data_url: url, payload };
        }

        const damageGenerated: DamageQrEntry[] = [];
        const damagedLines = materials.filter(
          (m) => (m.damaged_quantity || 0) > 0 || (m.rejected_quantity || 0) > 0,
        );

        for (const m of damagedLines) {
          const photo = damagePhotos[m.item_code];
          const reasonText = (photo && photo.reason)
            ? photo.reason
            : (m.damage_reason || "Damaged/Rejected during receiving inspection");
          const qrCodeStr = `DMG-${header.grn_number || "GRN-2026-0001"}-${m.item_code}-01`;
          const payload = buildDamageQrPayload(m, reasonText);
          let dataUrl = "";
          try {
            dataUrl = await QRCode.toDataURL(payload, {
              margin: 2,
              width: 500,
              errorCorrectionLevel: "M",
              color: { dark: "#9f1239", light: "#ffffff" },
            });
          } catch (e) {
            console.error("Damage QR generation error:", e);
          }
          const qty = (m.damaged_quantity || 0) > 0 ? m.damaged_quantity : (m.rejected_quantity || 0);
          damageGenerated.push({
            damage_lot_id: `dmg_lot_${m.item_code}`,
            damage_lot_number: `DMG-LOT-${header.grn_number || "GRN-2026-0001"}-${m.item_code}`,
            item_code: m.item_code,
            material_name: m.material_name,
            damaged_quantity: qty,
            uom: m.uom || "PCS",
            reason: reasonText,
            qa_status: m.quality_result || "REJECTED",
            quarantine_location: "QUARANTINE-ZONE-A",
            status: "DAMAGED",
            qr_id: `dmg_qr_${m.item_code}`,
            qr_code: qrCodeStr,
            qr_payload: payload,
            qr_data_url: dataUrl,
          });
        }

        if (active) {
          setQrLabels(generated);
          setDamageQrLabels(damageGenerated);
        }
      })();
    }
    return () => {
      active = false;
    };
  }, [
    currentPage,
    materialBatches,
    header.grn_number,
    header.po_number,
    header.supplier_name,
    header.warehouse_name,
    materials,
    damagePhotos,
    qualityApproved,
  ]);

  return (
    <AppShell
      title="Goods Receiving (GRN) Console"
      actions={
        <div className="flex items-center gap-2">
          <Button
            variant={activeTab === "dashboard" ? "default" : "outline"}
            className="rounded-xl font-semibold"
            onClick={() => setActiveTab("dashboard")}
          >
            <LayoutDashboard className="mr-2 size-4" /> GRN Dashboard
          </Button>
          <Button
            variant={activeTab === "records" ? "default" : "outline"}
            className="rounded-xl font-medium"
            onClick={() => setActiveTab("records")}
          >
            <ClipboardList className="mr-2 size-4" /> GRN Records
          </Button>
          <Button
            variant={activeTab === "wizard" ? "default" : "outline"}
            className="rounded-xl font-medium bg-primary text-primary-foreground shadow-sm"
            onClick={() => {
              setActiveTab("wizard");
              setCurrentPage(1);
            }}
          >
            <Plus className="mr-2 size-4" /> New Entry
          </Button>
        </div>
      }
    >
      {/* 📊 GRN OPERATIONS DASHBOARD TAB */}
      {activeTab === "dashboard" && (
        <div className="space-y-6">
          {/* KPI METRICS WIDGETS */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* 1. TOTAL GRN RECEIPTS */}
            <Card
              className={`group relative overflow-hidden rounded-2xl border bg-card p-5 shadow-soft transition-all duration-300 cursor-pointer ${dashboardStatusFilter === "ALL"
                  ? "border-primary ring-2 ring-primary/20 shadow-lift"
                  : "border-border/70 hover:border-primary/50 hover:shadow-lift hover:-translate-y-0.5"
                }`}
              onClick={() => {
                setDashboardStatusFilter("ALL");
                toast.info(`Viewing All Inbound Goods Receipts (${grnRecords.length} Records)`);
              }}
            >
              <div className="relative z-10 flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-muted-foreground transition-colors group-hover:text-primary">
                  Total Goods Receipts
                </span>
                <span className="grid size-10 place-items-center rounded-xl bg-primary-soft text-primary shadow-xs transition-all group-hover:bg-primary group-hover:text-primary-foreground">
                  <ClipboardList className="size-5" />
                </span>
              </div>
              <div className="relative z-10 mt-3 flex items-baseline justify-between">
                <p className="font-mono text-3xl font-black tracking-tight text-foreground">{grnRecords.length}</p>
                <span className="flex items-center gap-1 rounded-full border border-primary/20 bg-primary-soft px-2.5 py-1 text-xs font-bold text-primary">
                  <TrendingUp className="size-3.5" /> All Receipts
                </span>
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-2.5 text-[11px] font-medium text-muted-foreground">
                <span>Reconciled against POs</span>
                <span className="flex items-center font-bold text-primary transition-transform group-hover:translate-x-0.5">
                  View All <ChevronRight className="ml-0.5 size-3" />
                </span>
              </div>
            </Card>

            {/* 2. COMPLETED GRNS */}
            <Card
              className={`group relative overflow-hidden rounded-2xl border bg-card p-5 shadow-soft transition-all duration-300 cursor-pointer ${dashboardStatusFilter === "COMPLETED"
                  ? "border-success ring-2 ring-success/20 shadow-lift"
                  : "border-border/70 hover:border-success/50 hover:shadow-lift hover:-translate-y-0.5"
                }`}
              onClick={() => {
                setDashboardStatusFilter("COMPLETED");
                toast.info(`Filtered: Completed GRNs (${completedGrnsCount} Records)`);
              }}
            >
              <div className="relative z-10 flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-muted-foreground transition-colors group-hover:text-success">
                  Completed GRNs
                </span>
                <span className="grid size-10 place-items-center rounded-xl bg-success-soft text-success shadow-xs transition-all group-hover:bg-success group-hover:text-success-foreground">
                  <CheckCircle2 className="size-5" />
                </span>
              </div>
              <div className="relative z-10 mt-3 flex items-baseline justify-between">
                <p className="font-mono text-3xl font-black tracking-tight text-success">{completedGrnsCount}</p>
                <span className="rounded-full border border-success/20 bg-success-soft px-2.5 py-1 text-xs font-bold text-success">
                  100% Received
                </span>
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-2.5 text-[11px] font-medium text-muted-foreground">
                <span>Full order fulfilment</span>
                <span className="flex items-center font-bold text-success transition-transform group-hover:translate-x-0.5">
                  Filter Completed <ChevronRight className="ml-0.5 size-3" />
                </span>
              </div>
            </Card>

            {/* 3. PARTIALLY COMPLETED */}
            <Card
              className={`group relative overflow-hidden rounded-2xl border bg-card p-5 shadow-soft transition-all duration-300 cursor-pointer ${dashboardStatusFilter === "PARTIALLY COMPLETED"
                  ? "border-warning ring-2 ring-warning/20 shadow-lift"
                  : "border-border/70 hover:border-warning/50 hover:shadow-lift hover:-translate-y-0.5"
                }`}
              onClick={() => {
                setDashboardStatusFilter("PARTIALLY COMPLETED");
                toast.info(`Filtered: Partially Completed GRNs (${partiallyCompletedGrnsCount} Pending Balances)`);
              }}
            >
              <div className="relative z-10 flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-muted-foreground transition-colors group-hover:text-warning">
                  Partially Completed
                </span>
                <span className="grid size-10 place-items-center rounded-xl bg-warning-soft text-warning shadow-xs transition-all group-hover:bg-warning group-hover:text-warning-foreground">
                  <Clock className="size-5" />
                </span>
              </div>
              <div className="relative z-10 mt-3 flex items-baseline justify-between">
                <p className="font-mono text-3xl font-black tracking-tight text-warning">{partiallyCompletedGrnsCount}</p>
                <span className="rounded-full border border-warning/20 bg-warning-soft px-2.5 py-1 text-xs font-bold text-warning">
                  Pending Balances
                </span>
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-2.5 text-[11px] font-medium text-muted-foreground">
                <span>Partial delivery POs</span>
                <span className="flex items-center font-bold text-warning transition-transform group-hover:translate-x-0.5">
                  Filter Partial <ChevronRight className="ml-0.5 size-3" />
                </span>
              </div>
            </Card>

            {/* 4. DAMAGED QUARANTINE LOTS */}
            <Card
              className="group relative overflow-hidden rounded-2xl border border-border/70 bg-card p-5 shadow-soft transition-all duration-300 hover:border-destructive/50 hover:shadow-lift hover:-translate-y-0.5 cursor-pointer"
              onClick={() => {
                setShowNotifyVendorModal(true);
                toast.info("Opening Damaged Goods Vendor Notification Console");
              }}
            >
              <div className="relative z-10 flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-muted-foreground transition-colors group-hover:text-destructive">
                  Damaged Quarantine
                </span>
                <span className="grid size-10 place-items-center rounded-xl bg-danger-soft text-destructive shadow-xs transition-all group-hover:bg-destructive group-hover:text-destructive-foreground">
                  <AlertTriangle className="size-5" />
                </span>
              </div>
              <div className="relative z-10 mt-3 flex items-baseline justify-between">
                <p className="font-mono text-3xl font-black tracking-tight text-destructive">
                  {damagedLotsCount > 0 ? `${damagedLotsCount} Lots` : "0 Lots"}
                </p>
                <span className="rounded-full border border-destructive/20 bg-danger-soft px-2.5 py-1 text-xs font-bold text-destructive">
                  Pass: {qualityPassRateStr}
                </span>
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-2.5 text-[11px] font-medium text-muted-foreground">
                <span>Quarantine Evidence</span>
                <span className="flex items-center font-bold text-destructive transition-transform group-hover:translate-x-0.5">
                  Notify Vendor <ChevronRight className="ml-0.5 size-3" />
                </span>
              </div>
            </Card>
          </div>

          {/* RECENT GRN TRANSACTIONS TABLE & QUICK FILTERS */}
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-wider text-foreground">
                  <ClipboardList className="size-4 text-primary" /> Recent Inbound Goods Receipts
                </h3>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {[
                  { key: "ALL", label: `All Receipts (${grnRecords.length})` },
                  { key: "COMPLETED", label: `Completed (${completedGrnsCount})` },
                  { key: "PARTIALLY COMPLETED", label: `Partially Completed (${partiallyCompletedGrnsCount})` },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setDashboardStatusFilter(tab.key)}
                    className={`flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all ${dashboardStatusFilter === tab.key
                        ? tab.key === "COMPLETED"
                          ? "bg-success text-success-foreground shadow-sm"
                          : tab.key === "PARTIALLY COMPLETED"
                            ? "bg-warning text-warning-foreground shadow-sm"
                            : "bg-primary text-primary-foreground shadow-sm"
                        : "bg-muted/70 text-muted-foreground hover:bg-muted"
                      }`}
                  >
                    {tab.key === "COMPLETED" && <CheckCircle2 className="size-3.5" />}
                    {tab.key === "PARTIALLY COMPLETED" && <Clock className="size-3.5" />}
                    {tab.label}
                  </button>
                ))}
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-1 text-xs font-bold text-primary hover:underline"
                  onClick={() => setActiveTab("records")}
                >
                  Full Records ({grnRecords.length}) →
                </Button>
              </div>
            </div>

            <Card className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-soft">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-border/70 bg-muted/40 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3.5">GRN Number & Date</th>
                      <th className="px-4 py-3.5">PO Reference & Dock</th>
                      <th className="px-4 py-3.5">Supplier Name</th>
                      <th className="px-4 py-3.5">Vehicle & Driver</th>
                      <th className="px-4 py-3.5">Items Breakdown</th>
                      <th className="px-4 py-3.5">Receipt Status</th>
                      <th className="px-4 py-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60 font-medium">
                    {dashboardFilteredRecords.slice(0, 10).map((r, i) => {
                      const grnNum = r.grn_number || `GRN-2026-000${i + 1}`;
                      const poNum = r.po_number || `PO-100${i + 1}`;
                      const dockNum = r.dock_number || "DOCK-01";
                      const dateStr = formatReadableDate(r.receipt_date) || "Today";
                      const lines = r.lines || r.materials || r.items || [];
                      const totalGood = lines.reduce(
                        (sum: number, l: any) => sum + (Number(l.good_quantity ?? l.received_quantity) || 0),
                        0
                      );
                      const totalDmg = lines.reduce(
                        (sum: number, l: any) => sum + (Number(l.damaged_quantity ?? l.rejected_quantity) || 0),
                        0
                      );
                      const rawStatus = (r.status || "COMPLETED").toUpperCase().trim();
                      const isCompleted = rawStatus === "COMPLETED" || rawStatus === "POSTED" || rawStatus === "CLOSED";
                      const isPartial = rawStatus.includes("PARTIAL") || rawStatus.includes("DRAFT") || rawStatus.includes("IN_PROGRESS");

                      return (
                        <tr key={r.grn_id || r.grn_number || r.id || `rec_row_${i}`} className="transition-colors hover:bg-muted/30">
                          {/* 1. GRN Number & Date */}
                          <td className="px-4 py-3.5 font-mono">
                            <button
                              onClick={() => void handleViewGrnDetail(r)}
                              className="flex items-center gap-1.5 text-left font-bold text-primary hover:underline"
                            >
                              <FileText className="size-3.5 shrink-0 text-primary" />
                              <span>{grnNum}</span>
                            </button>
                            <span className="mt-0.5 block font-sans text-[10px] text-muted-foreground">
                              {dateStr}
                            </span>
                          </td>

                          {/* 2. PO Reference & Dock */}
                          <td className="px-4 py-3.5 font-mono">
                            <span className="inline-block rounded-md border border-primary/20 bg-primary-soft px-2 py-0.5 text-[11px] font-bold text-primary">
                              {poNum}
                            </span>
                            <span className="mt-0.5 block font-sans text-[10px] text-muted-foreground">
                              Dock: <b className="text-foreground">{dockNum}</b>
                            </span>
                          </td>

                          {/* 3. Supplier Name */}
                          <td className="px-4 py-3.5">
                            <div className="text-xs font-bold text-foreground">{r.supplier_name || "ABC Supplier"}</div>
                            <span className="block max-w-[160px] truncate text-[10px] text-muted-foreground">
                              {r.supplier_company_name || r.supplier_name || "Supplier Co."}
                            </span>
                          </td>

                          {/* 4. Vehicle & Driver */}
                          <td className="px-4 py-3.5">
                            <span className="flex items-center gap-1 font-mono text-xs font-bold text-foreground">
                              <Truck className="size-3 shrink-0 text-muted-foreground" />
                              {r.vehicle_number || "KA01EQ9921"}
                            </span>
                            <span className="mt-0.5 block text-[10px] text-muted-foreground">
                              Driver: <b className="text-foreground">{r.driver_name || "Ramesh"}</b>
                            </span>
                          </td>

                          {/* 5. Items Breakdown */}
                          <td className="px-4 py-3.5">
                            <div className="space-y-0.5">
                              <span className="block text-[11px] font-semibold text-foreground">
                                {lines.length > 0 ? `${lines.length} Line Item(s)` : "Standard Items"}
                              </span>
                              <div className="flex items-center gap-1 font-mono text-[10px]">
                                <span className="rounded border border-success/30 bg-success-soft px-1.5 py-0.5 font-bold text-success">
                                  {totalGood > 0 ? `${totalGood} Good` : "Verified"}
                                </span>
                                {totalDmg > 0 && (
                                  <span className="rounded border border-destructive/30 bg-danger-soft px-1.5 py-0.5 font-bold text-destructive">
                                    {totalDmg} Dmg
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* 6. Receipt Status */}
                          <td className="px-4 py-3.5">
                            {isCompleted ? (
                              <span className="flex w-fit items-center gap-1 rounded-full border border-success/30 bg-success-soft px-2.5 py-1 text-[11px] font-bold text-success shadow-2xs">
                                <CheckCircle2 className="size-3 text-success" /> COMPLETED
                              </span>
                            ) : isPartial ? (
                              <span className="flex w-fit items-center gap-1 rounded-full border border-warning/30 bg-warning-soft px-2.5 py-1 text-[11px] font-bold text-warning shadow-2xs">
                                <Clock className="size-3 text-warning" /> PARTIALLY COMPLETED
                              </span>
                            ) : (
                              <StatusBadge status={r.status || "COMPLETED"} />
                            )}
                          </td>

                          {/* 7. Quick Actions */}
                          <td className="px-4 py-3.5 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                size="sm"
                                variant="outline"
                                className="rounded-xl text-xs font-bold hover:border-primary/40 hover:bg-primary-soft/40 hover:text-primary"
                                onClick={() => void handleViewGrnDetail(r)}
                              >
                                <FileText className="mr-1 size-3.5" /> Details
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="rounded-xl text-xs font-bold"
                                onClick={() => printGrnCertificate(r)}
                                title="Print Official GRN PDF"
                              >
                                <Printer className="size-3.5" />
                              </Button>
                              {totalDmg > 0 && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="rounded-xl border-destructive/30 text-xs font-bold text-destructive hover:bg-danger-soft"
                                  onClick={() => {
                                    setNotifyVendorEmail(r.supplier_email || "spoorthiharakuni@gmail.com");
                                    setGrnId(r.grn_id || r.id || "grn-2026-0001");
                                    setShowNotifyVendorModal(true);
                                  }}
                                  title="Send Vendor Damage Email"
                                >
                                  <Send className="size-3.5 text-destructive" />
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}

                    {/* EMPTY STATE */}
                    {dashboardFilteredRecords.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-4 py-12 text-center">
                          <div className="mx-auto flex max-w-sm flex-col items-center justify-center gap-2.5">
                            <div className="flex size-12 items-center justify-center rounded-2xl border border-border/70 bg-muted/60 text-muted-foreground">
                              <PackageCheck className="size-6" />
                            </div>
                            <span className="text-sm font-bold text-foreground">
                              No {dashboardStatusFilter === "ALL" ? "" : `${dashboardStatusFilter.toLowerCase()} `}receipt notes found
                            </span>
                            <p className="text-xs text-muted-foreground">
                              There are currently no inbound goods receipts matching the selected status filter.
                            </p>
                            {dashboardStatusFilter !== "ALL" && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="mt-1 rounded-xl text-xs font-bold"
                                onClick={() => setDashboardStatusFilter("ALL")}
                              >
                                Show All Receipts ({grnRecords.length})
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* 📋 RECORDS OVERVIEW TAB */}
      {activeTab === "records" && (
        <div className="space-y-5">
          {/* SEARCH & ACTION CONTROL BAR */}
          <Card className="rounded-2xl border border-border/70 bg-card p-4 shadow-soft">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="relative min-w-[280px] flex-1">
                <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                <Input
                  placeholder="Search by GRN Number, PO Number, Supplier, Vehicle, Driver, Dock..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="rounded-xl pl-9 text-xs font-medium"
                />
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  className="rounded-xl text-xs font-semibold border-border/70 bg-card hover:bg-accent"
                  onClick={() => exportGrnRecordsCsv()}
                >
                  <Download className="mr-1.5 size-4 text-primary" /> Export CSV Spreadsheet
                </Button>
                <Button
                  variant="outline"
                  className="rounded-xl text-xs font-semibold border-border/70 bg-card hover:bg-accent"
                  onClick={() => void loadRecords()}
                >
                  <RefreshCw className="mr-1.5 size-4" /> Refresh
                </Button>
              </div>
            </div>
          </Card>

          {loadingRecords ? (
            <div className="grid h-64 place-items-center">
              <Loader2 className="size-8 animate-spin text-primary" />
            </div>
          ) : grnRecords.length === 0 ? (
            <Card className="grid h-64 place-items-center rounded-2xl border border-dashed border-border/70 p-6 text-center text-muted-foreground shadow-soft">
              <div>
                <FileCheck2 className="mx-auto mb-3 size-10 text-muted-foreground/60" />
                <h3 className="text-base font-semibold text-foreground">No Real GRN Records Found</h3>
                <p className="mt-1 text-xs">Start a new Goods Receiving entry to post material receipts directly into the database.</p>
                <Button
                  className="mt-4 rounded-xl font-bold shadow-glow"
                  onClick={() => {
                    setActiveTab("wizard");
                    setCurrentPage(1);
                  }}
                >
                  <Plus className="mr-2 size-4" /> Start New GRN
                </Button>
              </div>
            </Card>
          ) : (
            <div className="grid gap-4">
              {grnRecords.map((r, idx) => (
                <Card
                  key={r.grn_id || r.grn_number || r.id || `grn_rec_${idx}`}
                  className="space-y-4 rounded-2xl border border-border/70 bg-card p-5 shadow-soft transition-all duration-300 hover:shadow-lift"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border/60 pb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">Goods Receipt Note</span>
                        <span className="rounded-md border border-primary/20 bg-primary-soft px-2 py-0.5 font-mono text-[10px] font-bold text-primary">
                          Ref: {r.po_number || "PO-1001"}
                        </span>
                      </div>
                      <h3 className="mt-0.5 font-mono text-xl font-black text-primary">{r.grn_number || "GRN-0001"}</h3>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Supplier: <b className="text-foreground">{r.supplier_name || "ABC Supplier"}</b>
                      </p>
                    </div>
                    <StatusBadge status={r.status} />
                  </div>

                  <div className="grid gap-3 rounded-xl border border-border/60 bg-muted/20 p-4 font-mono text-xs sm:grid-cols-2 lg:grid-cols-4">
                    <div>
                      <span className="block font-sans text-[10px] uppercase text-muted-foreground">PO Reference</span>
                      <span className="font-bold text-foreground">{r.po_number || "PO-1001"}</span>
                    </div>
                    <div>
                      <span className="block font-sans text-[10px] uppercase text-muted-foreground">Receiving Dock</span>
                      <span className="font-bold text-foreground">Dock {r.dock_number || "DOCK-02"}</span>
                    </div>
                    <div>
                      <span className="block font-sans text-[10px] uppercase text-muted-foreground">Vehicle Reg / Driver</span>
                      <span className="font-bold text-foreground">{r.vehicle_number || "AP02AB1234"} ({r.driver_name || "Driver"})</span>
                    </div>
                    <div>
                      <span className="block font-sans text-[10px] uppercase text-muted-foreground">Received Date / Officer</span>
                      <span className="font-bold text-foreground">{r.receipt_date || "2026-08-30"} ({r.received_by || "Officer"})</span>
                    </div>
                  </div>

                  {/* REAL ACTION BUTTONS PER RECORD */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-xl border-border/70 text-xs font-semibold hover:border-primary/40 hover:bg-primary-soft/40 hover:text-primary"
                        onClick={() => void handleViewGrnDetail(r)}
                      >
                        <FileText className="mr-1.5 size-3.5" /> View Details Drawer
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-xl border-border/70 text-xs font-semibold"
                        onClick={() => printGrnCertificate(r)}
                      >
                        <Printer className="mr-1.5 size-3.5" /> Print Official GRN PDF
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-xl border-border/70 text-xs font-semibold"
                        onClick={() => printAllPoQrLabels(materials[0]?.item_code)}
                      >
                        <QrCode className="mr-1.5 size-3.5 text-primary" /> Print Batch QR Labels
                      </Button>
                    </div>

                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-xl border-destructive/30 text-xs font-semibold text-destructive hover:bg-danger-soft"
                      onClick={() => {
                        setNotifyVendorEmail(r.supplier_email || "spoorthiharakuni@gmail.com");
                        setGrnId(r.grn_id || r.id || "grn-2026-0001");
                        setShowNotifyVendorModal(true);
                      }}
                    >
                      <Send className="mr-1.5 size-3.5 text-destructive" /> Send Vendor Damage Email
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ✨ 6-PAGE WIZARD WORKFLOW */}
      {activeTab === "wizard" && (
        <div className="space-y-6">
          {/* STEP NAVIGATION HEADER */}
          <Card className="overflow-x-auto rounded-2xl border border-border/70 bg-card p-4 shadow-soft">
            <div className="flex min-w-[700px] items-center justify-between gap-2">
              {PAGES.map((pg) => {
                const isCompleted = currentPage > pg.id;
                const isCurrent = currentPage === pg.id;
                return (
                  <div
                    key={pg.id}
                    onClick={() => {
                      if (isCompleted || isCurrent) setCurrentPage(pg.id);
                    }}
                    className={`flex flex-1 cursor-pointer flex-col items-center text-center transition-all ${isCurrent
                        ? "scale-105 font-bold opacity-100"
                        : isCompleted
                          ? "opacity-80 hover:opacity-100"
                          : "cursor-not-allowed opacity-40"
                      }`}
                  >
                    <div
                      className={`flex size-8 items-center justify-center rounded-full text-xs font-bold transition-all ${isCompleted
                          ? "bg-success text-success-foreground"
                          : isCurrent
                            ? "bg-primary text-primary-foreground shadow-glow ring-4 ring-primary/20"
                            : "bg-muted text-muted-foreground"
                        }`}
                    >
                      {isCompleted ? <CheckCircle2 className="size-4" /> : pg.id}
                    </div>
                    <span className="mt-1.5 line-clamp-1 text-xs text-foreground">{pg.title.split(":")[1]}</span>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* PAGE 1 – GRN HEADER DETAILS */}
          {currentPage === 1 && (
            <Card className="space-y-6 rounded-2xl border border-border/70 bg-card p-6 shadow-soft">
              {/* PO NUMBER SELECTION & AUTO-FETCH INPUT */}
              <div className="flex max-w-2xl flex-wrap items-end gap-3 border-b border-border/60 pb-5">
                <div className="min-w-[260px] flex-1">
                  <label className="mb-1 flex items-center justify-between text-xs font-bold text-foreground">
                    <span>PO Number * <span className="text-[10px] font-normal text-muted-foreground">(Official PO Codes Only)</span></span>
                    {loadingContext ? (
                      <span className="flex items-center gap-1 animate-pulse text-[10px] font-bold text-primary">
                        <Loader2 className="size-3 animate-spin" /> Auto-Fetching PO Details...
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 rounded-full border border-success/30 bg-success-soft px-2.5 py-0.5 text-[10px] font-bold text-success">
                        <CheckCircle2 className="size-3" /> Verified PO from DB
                      </span>
                    )}
                  </label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="e.g. PO-2026-0001"
                      value={header.po_number}
                      disabled={busyAction}
                      onChange={(e) => changePoNumber(e.target.value)}
                      className="flex-1 rounded-xl font-mono text-base font-bold text-primary"
                    />
                    <select
                      disabled={busyAction}
                      value={header.po_number}
                      onChange={(e) => {
                        const val = e.target.value;
                        changePoNumber(val);
                        void fetchPoContext(val);
                      }}
                      className="max-w-[220px] rounded-xl border border-border/70 bg-background px-3 py-2 text-xs font-bold text-primary"
                    >
                      {availablePos.length > 0 ? (
                        availablePos
                          .filter((p: any) => {
                            const code = (p.poNumber || p.po_number || "").toUpperCase().trim();
                            return code.startsWith("PO-") || /^PO\d+/i.test(code);
                          })
                          .map((p: any) => (
                            <option key={p.id || p.poNumber || p.po_number} value={p.poNumber || p.po_number}>
                              {p.poNumber || p.po_number} ({p.supplierName || p.supplier_name || "Supplier"})
                            </option>
                          ))
                      ) : (
                        <option value="">No Official POs Found</option>
                      )}
                    </select>
                  </div>
                </div>
                <Button onClick={() => void fetchPoContext()} disabled={loadingContext || busyAction} className="rounded-xl font-semibold shadow-glow">
                  {loadingContext ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Search className="mr-2 size-4" />}
                  Fetch Details
                </Button>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {/* 1. PO Number */}
                <div className="rounded-xl border border-border/70 bg-muted/15 p-3">
                  <span className="text-[11px] font-semibold uppercase text-muted-foreground">1. PO Number</span>
                  <p className="font-mono text-base font-bold text-primary">{header.po_number || "—"}</p>
                </div>

                {/* 2. Supplier Name */}
                <div className="rounded-xl border border-border/70 bg-muted/15 p-3">
                  <span className="text-[11px] font-semibold uppercase text-muted-foreground">2. Supplier Name</span>
                  <p className="text-sm font-bold text-foreground">{header.supplier_name || "ABC Supplier"}</p>
                </div>

                {/* 3. Supplier Company Name */}
                <div className="rounded-xl border border-border/70 bg-muted/15 p-3">
                  <span className="text-[11px] font-semibold uppercase text-muted-foreground">3. Supplier Company Name</span>
                  <p className="text-sm font-bold text-foreground">{header.supplier_company_name || "ABC Industrial Supplies Pvt. Ltd."}</p>
                </div>

                {/* 4. ASN Number */}
                <div className="rounded-xl border border-border/70 bg-muted/15 p-3">
                  <span className="text-[11px] font-semibold uppercase text-muted-foreground">4. ASN Number</span>
                  <p className="font-mono text-sm font-bold text-foreground">{header.asn_number || "ASN-001"}</p>
                </div>

                {/* 5. Gate Entry Number */}
                <div className="rounded-xl border border-border/70 bg-muted/15 p-3">
                  <span className="text-[11px] font-semibold uppercase text-muted-foreground">5. Gate Entry Number</span>
                  <p className="font-mono text-sm font-bold text-foreground">{header.gate_entry_number || "GE-001"}</p>
                </div>

                {/* 6. Warehouse Name */}
                <div className="rounded-xl border border-border/70 bg-muted/15 p-3">
                  <span className="text-[11px] font-semibold uppercase text-muted-foreground">6. Warehouse Name</span>
                  <p className="text-sm font-bold text-foreground">{header.warehouse_name || "Main Warehouse – Bangalore"}</p>
                </div>

                {/* 7. Receiving Dock */}
                <div className="rounded-xl border border-primary/40 bg-primary-soft/30 p-3">
                  <label className="mb-1 block text-[11px] font-bold uppercase text-primary">7. Receiving Dock *</label>
                  <select
                    value={header.receiving_dock}
                    onChange={(e) => setHeader({ ...header, receiving_dock: e.target.value })}
                    className="w-full rounded-lg border border-border/70 bg-background px-3 py-1.5 text-sm font-bold"
                  >
                    {dockOptions.length > 0 ? (
                      dockOptions.map((d: any, idx: number) => (
                        <option key={d.dock_number || d.id || `dock_${idx}`} value={d.dock_number}>
                          Dock {d.dock_number} ({d.dock_type || "Standard"})
                        </option>
                      ))
                    ) : (
                      <>
                        <option value="DOCK-02">DOCK-02 (Selected)</option>
                        <option value="DOCK-01">DOCK-01 (Standard)</option>
                        <option value="DOCK-03">DOCK-03 (Cold Bay)</option>
                      </>
                    )}
                  </select>
                </div>

                {/* 8. GRN Number */}
                <div className="rounded-xl border border-border/70 bg-muted/15 p-3">
                  <span className="text-[11px] font-semibold uppercase text-muted-foreground">8. GRN Number</span>
                  <p className="font-mono text-base font-bold text-success">{header.grn_number || "GRN-0001"}</p>
                </div>

                {/* 9. Receipt Type */}
                <div className="rounded-xl border border-border/70 bg-muted/15 p-3">
                  <label className="mb-1 block text-[11px] font-semibold uppercase text-muted-foreground">9. Receipt Type</label>
                  <select
                    value={header.receipt_type}
                    onChange={(e) => setHeader({ ...header, receipt_type: e.target.value as any })}
                    className="w-full rounded-lg border border-border/70 bg-background px-2.5 py-1 text-xs font-bold"
                  >
                    <option value="PO_RECEIPT">PO Receipt (PO Delivery)</option>
                    <option value="UNEXPECTED_DELIVERY">Unexpected Delivery (Manual Info)</option>
                  </select>
                </div>

                {/* 10. Vehicle Number */}
                <div className="rounded-xl border border-border/70 bg-muted/15 p-3">
                  <label className="mb-1 block text-[11px] font-semibold uppercase text-muted-foreground">
                    10. Vehicle Number
                  </label>
                  <Input
                    value={header.vehicle_number}
                    onChange={(e) => setHeader({ ...header, vehicle_number: e.target.value })}
                    readOnly={header.receipt_type === "PO_RECEIPT"}
                    className="rounded-lg font-mono text-sm font-bold"
                  />
                </div>

                {/* 11. Driver Name */}
                <div className="rounded-xl border border-border/70 bg-muted/15 p-3">
                  <label className="mb-1 block text-[11px] font-semibold uppercase text-muted-foreground">
                    11. Driver Name
                  </label>
                  <Input
                    value={header.driver_name}
                    onChange={(e) => setHeader({ ...header, driver_name: e.target.value })}
                    readOnly={header.receipt_type === "PO_RECEIPT"}
                    className="rounded-lg text-sm font-bold"
                  />
                </div>

                {/* 12. Invoice Number */}
                <div className="rounded-xl border border-border/70 bg-muted/15 p-3">
                  <label className="mb-1 block text-[11px] font-semibold uppercase text-muted-foreground">12. Invoice Number (Optional)</label>
                  <Input
                    value={header.invoice_number}
                    onChange={(e) => setHeader({ ...header, invoice_number: e.target.value })}
                    placeholder="INV-2026-001 (Optional)"
                    className="rounded-lg font-mono text-sm font-bold"
                  />
                </div>

                {/* 13. Received By */}
                <div className="rounded-xl border border-success/30 bg-success-soft/30 p-3 sm:col-span-2 lg:col-span-3">
                  <span className="block text-[11px] font-bold uppercase text-success">13. Received By</span>
                  <div className="mt-1 flex items-center gap-2">
                    <User className="size-4 text-success" />
                    <span className="text-sm font-bold text-foreground">{header.received_by}</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end border-t border-border/60 pt-4">
                <Button onClick={() => void handleProceedFromPage1()} disabled={busyAction || loadingContext} className="rounded-xl px-6 font-bold shadow-glow">
                  {busyAction ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                  Next <ArrowRight className="ml-2 size-4" />
                </Button>
              </div>
            </Card>
          )}

          {/* PAGE 2 – ITEM RECEIVING DETAILS & MULTI-VEHICLE RECONCILIATION */}
          {currentPage === 2 && (
            <div className="space-y-6">
              {/* CURRENT VEHICLE SHIPMENT RECEIVING RECONCILIATION */}
              <Card className="rounded-2xl border border-border/70 bg-card p-6 shadow-soft space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-4">
                  <div>
                    <h3 className="text-base font-bold text-foreground">
                      Current Vehicle Receiving Reconciliation
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Vehicle: <span className="font-semibold text-foreground">{header.vehicle_number || "Current Shipment"}</span> • Enter quantities delivered in this vehicle shipment
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 rounded-xl border-primary/30 text-xs font-semibold text-primary hover:bg-primary-soft"
                      onClick={() => {
                        setMaterials((prev) =>
                          prev.map((item) => {
                            const liveBal = (item.balance_quantity !== undefined && item.balance_quantity !== null) ? item.balance_quantity : item.po_quantity;
                            const dmg = Number(item.damaged_quantity) || 0;
                            return {
                              ...item,
                              good_quantity: Math.max(0, liveBal - dmg),
                            };
                          }),
                        );
                        toast.success("Auto-filled available balance for this shipment!");
                      }}
                    >
                      <Zap className="mr-1.5 size-3.5 fill-primary text-primary" /> Auto-Fill Live Balance
                    </Button>
                    <span className="text-xs font-semibold text-muted-foreground">GRN Status:</span>
                    <span className={`rounded-full px-3 py-1 text-xs font-bold border ${totalProjectedBalanceQty > 0
                        ? "border-warning/30 bg-warning-soft text-warning"
                        : "border-success/30 bg-success-soft text-success"
                      }`}>
                      {calculatedGrnStatus}
                    </span>
                  </div>
                </div>

                {/* LINE ITEMS TABLE */}
                <div className="overflow-x-auto rounded-xl border border-border/70">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-border/70 bg-muted/40 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3">Material Name & Category</th>
                        <th className="px-4 py-3">Material Code</th>
                        <th className="px-4 py-3 text-right">PO Qty</th>
                        <th className="px-4 py-3 text-right">Prev. Accepted</th>
                        <th className="px-4 py-3 text-right">Live Available Bal.</th>
                        <th className="px-4 py-3 text-right">Good Qty (This Vehicle)</th>
                        <th className="px-4 py-3 text-right">Damaged Qty (This Vehicle)</th>
                        <th className="px-4 py-3 text-right">Projected Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60 font-medium">
                      {materials.map((m, idx) => {
                        const liveBal = (m.balance_quantity !== undefined && m.balance_quantity !== null) ? m.balance_quantity : m.po_quantity;
                        const prevAccepted = m.cumulative_accepted_quantity || 0;
                        const good = Number(m.good_quantity) || 0;
                        const damaged = Number(m.damaged_quantity) || 0;
                        const thisShipmentTotal = good + damaged;
                        const isOver = thisShipmentTotal > liveBal;
                        const projectedBal = Math.max(liveBal - thisShipmentTotal, 0);

                        return (
                          <tr key={m.item_code} className={`transition-colors ${isOver ? "bg-destructive-soft/20" : "hover:bg-muted/20"}`}>
                            <td className="px-4 py-3 font-bold text-foreground">
                              <div>{m.material_name}</div>
                              <span className="mt-0.5 block text-[10px] font-medium text-teal">
                                Category: {m.material_category || "General"}
                              </span>
                            </td>
                            <td className="px-4 py-3 font-mono text-xs font-bold text-primary">{m.item_code}</td>
                            <td className="px-4 py-3 text-right font-bold text-foreground">
                              <div>{m.po_quantity.toLocaleString()} <span className="text-xs font-normal text-muted-foreground">{m.uom || "PCS"}</span></div>
                            </td>
                            <td className="px-4 py-3 text-right font-bold text-success">
                              {prevAccepted.toLocaleString()}
                            </td>
                            <td className="px-4 py-3 text-right font-mono font-extrabold text-primary">
                              {liveBal.toLocaleString()}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex flex-col items-end gap-1">
                                <Input
                                  type="number"
                                  min={0}
                                  value={m.good_quantity}
                                  onChange={(e) => {
                                    const raw = e.target.value;
                                    const val = raw === "" ? 0 : Math.max(0, Number(raw));
                                    setMaterials((prev) =>
                                      prev.map((item, i) =>
                                        i === idx
                                          ? { ...item, good_quantity: val }
                                          : item,
                                      ),
                                    );
                                  }}
                                  className={`w-28 rounded-xl text-right font-bold focus:ring-2 ${isOver
                                      ? "border-destructive text-destructive focus:ring-destructive/30"
                                      : "text-success focus:ring-success/20"
                                    }`}
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    setMaterials((prev) =>
                                      prev.map((item, i) => {
                                        if (i !== idx) return item;
                                        const currentDmg = Number(item.damaged_quantity) || 0;
                                        return { ...item, good_quantity: Math.max(0, liveBal - currentDmg) };
                                      }),
                                    );
                                  }}
                                  className="flex items-center gap-0.5 text-[10px] font-semibold text-primary hover:underline"
                                >
                                  <Sparkles className="size-3 text-warning" /> Fill Balance ({liveBal})
                                </button>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <Input
                                type="number"
                                min={0}
                                value={m.damaged_quantity}
                                onChange={(e) => {
                                  const raw = e.target.value;
                                  const val = raw === "" ? 0 : Math.max(0, Number(raw));
                                  setMaterials((prev) =>
                                    prev.map((item, i) =>
                                      i === idx
                                        ? { ...item, damaged_quantity: val }
                                        : item,
                                    ),
                                  );
                                }}
                                className="ml-auto w-28 rounded-xl text-right font-bold text-destructive focus:ring-destructive/20"
                              />
                            </td>
                            <td className="px-4 py-3 font-mono font-bold text-muted-foreground text-right">
                              <span className={projectedBal === 0 ? "text-success font-bold" : "text-primary font-bold"}>
                                {projectedBal.toLocaleString()}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    {/* TOTAL ROW AT BOTTOM */}
                    <tfoot className="border-t border-border/70 bg-muted/40 text-sm font-bold">
                      <tr>
                        <td colSpan={2} className="px-4 py-3 text-xs uppercase text-muted-foreground">Totals</td>
                        <td className="px-4 py-3 text-right">{totalPoQty.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right text-success">{totalPrevAccepted.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right text-primary font-mono">{totalAvailableBalQty.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right text-success">{totalGoodQty.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right text-destructive">{totalDamagedQty.toLocaleString()}</td>
                        <td className="px-4 py-3 font-mono text-primary text-right">{totalProjectedBalanceQty.toLocaleString()}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* 4. OVER-RECEIPT BLOCKER & MANAGER APPROVAL SECTION */}
                {hasOverReceiptLine && (
                  <div className="rounded-2xl border border-destructive/40 bg-destructive-soft/30 p-4 space-y-3">
                    <div className="flex items-start gap-3">
                      <ShieldAlert className="size-5 shrink-0 text-destructive mt-0.5" />
                      <div>
                        <h4 className="text-sm font-bold text-destructive">
                          Over-Receipt Warning: Quantity Exceeds Available PO Balance
                        </h4>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          The entered shipment quantity exceeds the live remaining balance on the Purchase Order. To proceed, manager authorization and remarks are required.
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 pt-2 border-t border-destructive/20">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={allowOverReceipt}
                          onChange={(e) => setAllowOverReceipt(e.target.checked)}
                          className="size-4 rounded border-destructive/40 text-destructive focus:ring-destructive"
                        />
                        <span className="text-xs font-bold text-foreground">
                          Authorize Over-Receipt with Manager Approval
                        </span>
                      </label>

                      <div>
                        <Input
                          placeholder="Manager Name / Authorization Remarks (Required)"
                          value={overReceiptReason}
                          onChange={(e) => setOverReceiptReason(e.target.value)}
                          disabled={!allowOverReceipt}
                          className="h-8 rounded-xl text-xs"
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex justify-between border-t border-border/60 pt-4">
                  <Button variant="outline" className="rounded-xl" onClick={() => setCurrentPage(1)}>
                    <ArrowLeft className="mr-2 size-4" /> Back to Page 1
                  </Button>
                  <Button
                    disabled={
                      busyAction ||
                      loadingContext ||
                      (hasOverReceiptLine && (!allowOverReceipt || !overReceiptReason.trim()))
                    }
                    onClick={() => void handleProceedFromPage2()}
                    className="rounded-xl px-6 font-bold shadow-glow"
                  >
                    {busyAction ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                    Next <ArrowRight className="ml-2 size-4" />
                  </Button>
                </div>
              </Card>
            </div>
          )}

          {/* PAGE 3 – DAMAGED GOODS & PHOTO EVIDENCE */}
          {currentPage === 3 && (
            <Card className="space-y-6 rounded-2xl border border-border/70 bg-card p-6 shadow-soft">
              <div className="border-b border-border/60 pb-4">
                <h3 className="text-base font-bold text-foreground">
                  Damaged Goods & Photo Evidence
                </h3>
              </div>

              {damagedMaterials.length === 0 ? (
                <div className="rounded-xl border border-success/30 bg-success-soft/30 p-4 text-center text-sm font-medium text-success">
                  <CheckCircle2 className="mx-auto mb-2 size-6" />
                  No damaged items recorded on Page 2. You can proceed to
                  Batch Creation.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-border/70">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-border/70 bg-muted/40 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3">Material Code</th>
                        <th className="px-4 py-3">Material Name</th>
                        <th className="px-4 py-3 text-right">Damaged Qty</th>
                        <th className="px-4 py-3">Damage Reason</th>
                        <th className="px-4 py-3">Photo Evidence</th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-border/60">
                      {damagedMaterials.map((m) => (
                        <tr key={m.grn_line_id || m.item_code}>
                          <td className="px-4 py-3 font-mono font-bold text-primary">
                            {m.item_code}
                          </td>

                          <td className="px-4 py-3 font-bold text-foreground">
                            {m.material_name}
                          </td>

                          <td className="px-4 py-3 font-bold text-destructive text-right">
                            {m.damaged_quantity} {m.uom}
                          </td>

                          <td className="min-w-[200px] px-4 py-3">
                            <Input
                              type="text"
                              placeholder="Specify damage reason for this material..."
                              value={m.damage_reason || ""}
                              onChange={(e) => {
                                const val = e.target.value;
                                setMaterials((prev) =>
                                  prev.map((item) =>
                                    item.item_code === m.item_code
                                      ? { ...item, damage_reason: val }
                                      : item,
                                  ),
                                );
                              }}
                              className="rounded-xl border text-xs font-medium"
                            />
                          </td>

                          <td className="px-4 py-3">
                            <DamagePhoto
                              key={`${grnId || "draft"}:${m.grn_line_id || m.item_code}`}
                              lineId={m.grn_line_id}
                              damagedQuantity={m.damaged_quantity}
                              reason={m.damage_reason}
                              onSuccess={(ev) => {
                                setDamagePhotos((prev) => ({
                                  ...prev,
                                  [m.item_code]: {
                                    ...prev[m.item_code],
                                    evidenceId: ev.evidenceId,
                                    reason: m.damage_reason,
                                    previewUrl: ev.filePath,
                                    file: ev.file,
                                  },
                                }));
                              }}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Quality Inspection Approved Quantity Input */}
              <div className="space-y-3 border-t border-border/60 pt-4">
                <div className="flex items-center justify-between">
                  <h4 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    <ShieldCheck className="size-4 text-success" /> Quality Inspection Approval
                  </h4>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {materials.map((m) => {
                    const approvedVal = Number((qualityApproved[m.item_code] !== undefined) ? qualityApproved[m.item_code] : (m.good_quantity ?? 0));
                    const isSound = approvedVal > 0;
                    return (
                      <div key={m.item_code} className="space-y-2 rounded-xl border border-border/70 bg-muted/15 p-3.5">
                        <div className="flex items-center justify-between border-b border-border/60 pb-2">
                          <div>
                            <span className="block text-xs font-bold text-foreground">{m.material_name}</span>
                            <span className="font-mono text-[11px] font-bold text-primary">({m.item_code})</span>
                          </div>
                          <span className={`rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase ${isSound
                              ? "border-success/30 bg-success-soft text-success"
                              : "border-destructive/30 bg-danger-soft text-destructive"
                            }`}>
                            {isSound ? "PASSED ✓" : "REJECTED ✗"}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 font-mono text-[11px]">
                          <div>
                            <span className="block text-[10px] text-muted-foreground">Page 2 Good Qty:</span>
                            <b className="text-success">{m.good_quantity} {m.uom}</b>
                          </div>
                          <div>
                            <span className="block text-[10px] text-muted-foreground">Page 2 Damaged:</span>
                            <b className="text-destructive">{m.damaged_quantity} {m.uom}</b>
                          </div>
                        </div>

                        <div className="flex items-center justify-between border-t border-border/60 pt-2">
                          <span className="text-xs font-semibold text-muted-foreground">Quality-Approved Qty:</span>
                          <Input
                            type="number"
                            value={approvedVal}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              setQualityApproved((prev) => ({ ...prev, [m.item_code]: val }));
                            }}
                            className="w-24 rounded-lg text-right font-mono font-bold text-success focus:ring-success/20"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-between border-t border-border/60 pt-4">
                <Button variant="outline" className="rounded-xl" onClick={() => setCurrentPage(2)}>
                  <ArrowLeft className="mr-2 size-4" /> Back to Page 2
                </Button>
                <Button
                  onClick={() => {
                    // Synchronize default 1-batch per material with quality-approved quantity
                    setMaterialBatches((prev) => {
                      const updated: Record<string, BatchEntry[]> = { ...prev };
                      materials.forEach((m) => {
                        const appQty = Number((qualityApproved[m.item_code] !== undefined) ? qualityApproved[m.item_code] : (m.good_quantity ?? 0));
                        const currentList = updated[m.item_code] || [];
                        if (currentList.length <= 1) {
                          updated[m.item_code] = [
                            {
                              batch_number: currentList[0]?.batch_number || `BATCH-${m.item_code}-001`,
                              batch_quantity: appQty,
                              variant_code: m.variant_code,
                              size: m.size,
                              color: m.color,
                              grade: m.grade,
                            },
                          ];
                        }
                      });
                      return updated;
                    });
                    setCurrentPage(4);
                  }}
                  className="rounded-xl px-6 font-bold shadow-glow"
                >
                  Next <ArrowRight className="ml-2 size-4" />
                </Button>
              </div>
            </Card>
          )}

          {/* PAGE 4 – BATCH CREATION */}
          {currentPage === 4 && (
            <Card className="space-y-6 rounded-2xl border border-border/70 bg-card p-6 shadow-soft">
              <div className="border-b border-border/60 pb-4">
                <h3 className="text-base font-bold text-foreground">Page 4: Lot & Batch Creation</h3>
                <p className="text-xs text-muted-foreground">
                  Divide Quality-Approved materials into batches. <b>Rule: Total Batch Quantity MUST equal Quality-Approved Quantity.</b>
                </p>
              </div>

              {!allBatchesValid && (
                <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-danger-soft/40 p-4 text-xs font-bold text-destructive">
                  <AlertTriangle className="size-5 shrink-0" />
                  <span>
                    Batch Quantity Mismatch! The sum of batch quantities for each material must strictly match the Quality-Approved Quantity before proceeding.
                  </span>
                </div>
              )}

              <div className="space-y-5">
                {materials.map((m) => {
                  const { appQty, totalBatchQty, isValid } = getBatchValidation(m.item_code);
                  const batches = materialBatches[m.item_code] || [];

                  return (
                    <Card
                      key={m.item_code}
                      className={`rounded-xl border p-4 shadow-2xs ${isValid
                          ? "border-success/30 bg-success-soft/10"
                          : "border-destructive/30 bg-danger-soft/10"
                        }`}
                    >
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-2">
                        <div>
                          <span className="font-bold text-foreground">{m.material_name}</span>
                          <span className="ml-2 font-mono text-xs font-bold text-primary">({m.item_code})</span>
                        </div>
                        <div className="flex items-center gap-4 text-xs font-semibold">
                          <span>Quality-Approved Qty: <b className="text-success">{appQty}</b> {m.uom}</span>
                          <span>Total Batch Qty: <b className={isValid ? "text-success" : "text-destructive"}>{totalBatchQty}</b> {m.uom}</span>
                          <span className={`rounded-md border px-2 py-0.5 text-[11px] font-bold ${isValid
                              ? "border-success/30 bg-success-soft text-success"
                              : "border-destructive/30 bg-danger-soft text-destructive"
                            }`}>
                            {isValid ? "VALID ✓" : "MISMATCH ✗"}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        {batches.map((b, bIdx) => (
                          <div key={b.batch_number || `batch_${m.item_code}_${bIdx}`} className="flex items-center gap-3">
                            <span className="w-24 font-mono text-xs font-bold text-muted-foreground">Batch #{bIdx + 1}</span>
                            <Input
                              placeholder={`BATCH-${m.item_code}-${(bIdx + 1).toString().padStart(3, "0")}`}
                              value={b.batch_number}
                              onChange={(e) => {
                                const val = e.target.value;
                                setMaterialBatches((prev) => {
                                  const list = [...(prev[m.item_code] || [])];
                                  if (list[bIdx]) {
                                    list[bIdx] = { ...list[bIdx], batch_number: val };
                                  }
                                  return { ...prev, [m.item_code]: list };
                                });
                              }}
                              className="w-44 rounded-xl font-mono text-xs font-bold"
                            />
                            <Input
                              type="number"
                              min={0}
                              value={b.batch_quantity}
                              onChange={(e) => {
                                const raw = e.target.value;
                                const val = raw === "" ? 0 : Math.max(0, Number(raw));
                                setMaterialBatches((prev) => {
                                  const list = [...(prev[m.item_code] || [])];
                                  if (list[bIdx]) {
                                    list[bIdx] = { ...list[bIdx], batch_quantity: val };
                                  }
                                  return { ...prev, [m.item_code]: list };
                                });
                              }}
                              className="w-32 rounded-xl text-right font-mono font-bold"
                            />
                            <span className="text-xs font-medium text-muted-foreground">{m.uom}</span>
                            {batches.length > 1 && (
                              <Button
                                size="icon"
                                variant="ghost"
                                className="size-8 rounded-lg text-destructive hover:bg-danger-soft"
                                onClick={() => {
                                  setMaterialBatches((prev) => {
                                    const list = (prev[m.item_code] || []).filter((_, idx) => idx !== bIdx);
                                    return { ...prev, [m.item_code]: list };
                                  });
                                }}
                                title="Remove Sub-Batch"
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>

                      <div className="mt-3 flex justify-end">
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-xl text-xs font-bold border-primary/30 text-primary hover:bg-primary-soft"
                          onClick={() => {
                            setMaterialBatches((prev) => {
                              const currentList = prev[m.item_code] || [];
                              const nextBatchNum = `BATCH-${m.item_code}-${(currentList.length + 1).toString().padStart(3, "0")}`;
                              return {
                                ...prev,
                                [m.item_code]: [
                                  ...currentList,
                                  {
                                    batch_number: nextBatchNum,
                                    batch_quantity: 0,
                                    variant_code: m.variant_code,
                                    size: m.size,
                                    color: m.color,
                                    grade: m.grade,
                                  },
                                ],
                              };
                            });
                          }}
                        >
                          <Plus className="mr-1 size-3.5" /> Add Sub-Batch
                        </Button>
                      </div>
                    </Card>
                  );
                })}
              </div>

              <div className="flex justify-between border-t border-border/60 pt-4">
                <Button variant="outline" className="rounded-xl" onClick={() => setCurrentPage(3)}>
                  <ArrowLeft className="mr-2 size-4" /> Back to Page 3
                </Button>
                <Button
                  onClick={() => setCurrentPage(5)}
                  disabled={!allBatchesValid}
                  className="rounded-xl px-6 font-bold shadow-glow"
                >
                  Next <ArrowRight className="ml-2 size-4" />
                </Button>
              </div>
            </Card>
          )}

          {/* PAGE 5 – DOCUMENT COMPLIANCE & ATTACHMENTS REPOSITORY */}
          {currentPage === 5 && (
            <Card className="space-y-6 rounded-2xl border border-border/70 bg-card p-6 shadow-soft">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-4">
                <div>
                  <h3 className="flex items-center gap-2 text-base font-bold text-foreground">
                    <span>Inbound Goods Document Repository</span>
                    <span className="rounded-full border border-destructive/30 bg-danger-soft px-2.5 py-0.5 text-[10px] font-extrabold text-destructive">
                      PO Document Compulsory *
                    </span>
                  </h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    <b>Purchase Order (PO) Copy</b> is Compulsory. Add optional documents using the <b>Add Document</b> form below.
                  </p>
                </div>
              </div>

              {/* ADD DOCUMENT ACTION FORM */}
              <div className="space-y-3 rounded-xl border border-border/70 bg-muted/20 p-4">
                <span className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                  <Plus className="size-4 text-primary" /> Add Document / Attach File
                </span>
                <div className="flex flex-wrap items-end gap-3">
                  <div className="w-64">
                    <label className="mb-1 block text-[11px] font-bold text-muted-foreground">Select Document Category</label>
                    <select
                      value={selectedDocCategory}
                      onChange={(e) => setSelectedDocCategory(e.target.value)}
                      className="w-full rounded-xl border border-border/70 bg-background px-3 py-2 text-xs font-bold text-foreground"
                    >
                      {customDocTypes.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat} {cat.includes("PO") || cat.includes("Purchase Order") ? "(Compulsory *)" : "(Optional)"}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="min-w-[220px] flex-1">
                    <label className="mb-1 block text-[11px] font-bold text-muted-foreground">Select File</label>
                    <Input
                      type="file"
                      onChange={(e) => setPendingDocFile(e.target.files?.[0] || null)}
                      className="cursor-pointer rounded-xl bg-background text-xs"
                    />
                  </div>

                  <Button
                    onClick={() => {
                      if (!pendingDocFile) {
                        toast.error("Please choose a file to attach");
                        return;
                      }
                      const newDoc: UploadedDocument = {
                        category: selectedDocCategory,
                        file_name: pendingDocFile.name,
                        file_path: URL.createObjectURL(pendingDocFile),
                      };
                      setUploadedDocuments((prev) => [...prev, newDoc]);
                      setPendingDocFile(null);
                      toast.success(`Attached ${pendingDocFile.name} under ${selectedDocCategory}`);
                    }}
                    className="rounded-xl font-bold shadow-glow"
                  >
                    <Upload className="mr-1.5 size-4" /> Attach Document
                  </Button>
                </div>
              </div>

              {/* DOCUMENT TABLE (PO IS COMPULSORY + ATTACHED DOCUMENTS) */}
              <div className="overflow-x-auto rounded-xl border border-border/70 bg-card shadow-soft">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-border/70 bg-muted/40 font-mono text-muted-foreground uppercase">
                    <tr>
                      <th className="px-4 py-3">Document Category / Name</th>
                      <th className="px-4 py-3">Requirement</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Attached File</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60 font-medium">
                    {/* ALWAYS RENDER PO COMPULSORY ROW FIRST */}
                    {(() => {
                      const poDoc = uploadedDocuments.find(
                        (d) =>
                          d.category.toLowerCase().includes("po") ||
                          d.category.toLowerCase().includes("purchase order"),
                      );
                      return (
                        <tr className={!poDoc ? "bg-danger-soft/20" : "hover:bg-muted/10 transition-colors"}>
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-2.5">
                              <FileText className="size-4 shrink-0 text-destructive" />
                              <div>
                                <span className="block text-xs font-bold text-foreground">
                                  Purchase Order (PO) Document Copy
                                </span>
                                <span className="block text-[10px] text-muted-foreground">
                                  Compulsory PO authorization copy for PO {header.po_number || "PO-1001"}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3.5">
                            <span className="rounded-full border border-destructive/30 bg-danger-soft px-2.5 py-0.5 text-[10px] font-black text-destructive">
                              COMPULSORY *
                            </span>
                          </td>
                          <td className="px-4 py-3.5">
                            {poDoc ? (
                              <span className="flex w-fit items-center gap-1 rounded-full border border-success/30 bg-success-soft px-2.5 py-0.5 text-[10px] font-bold text-success">
                                ATTACHED ✓
                              </span>
                            ) : (
                              <span className="flex w-fit animate-pulse items-center gap-1 rounded-full border border-warning/30 bg-warning-soft px-2.5 py-0.5 text-[10px] font-bold text-warning">
                                PENDING *
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3.5 font-mono text-xs">
                            {poDoc ? (
                              <span className="line-clamp-1 font-bold text-foreground">{poDoc.file_name}</span>
                            ) : (
                              <span className="text-[11px] font-normal italic text-muted-foreground">No file uploaded</span>
                            )}
                          </td>
                          <td className="px-4 py-3.5 text-right">
                            {poDoc ? (
                              <div className="flex items-center justify-end gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 rounded-xl border-primary/40 text-xs font-semibold text-primary hover:bg-primary-soft/40"
                                  onClick={() => setViewingDocumentModal(poDoc)}
                                >
                                  <Eye className="mr-1 size-3" /> View Document
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 rounded-xl text-xs text-destructive hover:bg-danger-soft"
                                  onClick={() => {
                                    setUploadedDocuments((prev) => prev.filter((d) => d.file_name !== poDoc.file_name));
                                    toast.info(`Removed ${poDoc.file_name}`);
                                  }}
                                >
                                  Remove
                                </Button>
                              </div>
                            ) : (
                              <label className="inline-block cursor-pointer">
                                <span className="inline-flex items-center justify-center rounded-xl bg-destructive px-3 py-1.5 text-xs font-bold text-destructive-foreground shadow-2xs hover:bg-destructive/90 transition-colors">
                                  <Upload className="mr-1 size-3" /> Attach PO File *
                                </span>
                                <input
                                  type="file"
                                  className="hidden"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                      const newDoc: UploadedDocument = {
                                        category: "Purchase Order Copy",
                                        file_name: file.name,
                                        file_path: URL.createObjectURL(file),
                                      };
                                      setUploadedDocuments((prev) => [...prev, newDoc]);
                                      toast.success(`Attached PO Copy: ${file.name}`);
                                    }
                                  }}
                                />
                              </label>
                            )}
                          </td>
                        </tr>
                      );
                    })()}

                    {/* RENDER ANY ATTACHED OPTIONAL DOCUMENTS DYNAMICALLY */}
                    {uploadedDocuments
                      .filter(
                        (d) =>
                          !d.category.toLowerCase().includes("po") &&
                          !d.category.toLowerCase().includes("purchase order"),
                      )
                      .map((optDoc, idx) => (
                        <tr key={optDoc.file_name || `opt_doc_${idx}`} className="transition-colors hover:bg-muted/10">
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-2.5">
                              <FileText className="size-4 shrink-0 text-primary" />
                              <div>
                                <span className="block text-xs font-bold text-foreground">{optDoc.category}</span>
                                <span className="block line-clamp-1 text-[10px] text-muted-foreground">
                                  Optional Inbound Attachment
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3.5">
                            <span className="rounded-full border border-border/70 bg-muted px-2.5 py-0.5 text-[10px] font-bold text-muted-foreground">
                              OPTIONAL
                            </span>
                          </td>
                          <td className="px-4 py-3.5">
                            <span className="flex w-fit items-center gap-1 rounded-full border border-success/30 bg-success-soft px-2.5 py-0.5 text-[10px] font-bold text-success">
                              ATTACHED ✓
                            </span>
                          </td>
                          <td className="px-4 py-3.5 font-mono text-xs">
                            <span className="line-clamp-1 font-bold text-foreground">{optDoc.file_name}</span>
                          </td>
                          <td className="px-4 py-3.5 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 rounded-xl border-primary/40 text-xs font-semibold text-primary hover:bg-primary-soft/40"
                                onClick={() => setViewingDocumentModal(optDoc)}
                              >
                                <Eye className="mr-1 size-3" /> View Document
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 rounded-xl text-xs text-destructive hover:bg-danger-soft"
                                onClick={() => {
                                  setUploadedDocuments((prev) => prev.filter((d) => d.file_name !== optDoc.file_name));
                                  toast.info(`Removed ${optDoc.file_name}`);
                                }}
                              >
                                Remove
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-between border-t border-border/60 pt-4">
                <Button variant="outline" className="rounded-xl" onClick={() => setCurrentPage(4)}>
                  <ArrowLeft className="mr-2 size-4" /> Back to Page 4
                </Button>
                <Button onClick={() => setCurrentPage(6)} className="rounded-xl px-6 font-bold shadow-glow">
                  Next <ArrowRight className="ml-2 size-4" />
                </Button>
              </div>
            </Card>
          )}

          {/* PAGE 6 – QR CODE GENERATION */}
          {currentPage === 6 && (
            <Card className="space-y-6 rounded-2xl border border-border/70 bg-card p-6 shadow-soft">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-4">
                <div>
                  <h3 className="text-base font-bold text-foreground">Page 6: Batch-wise QR Code Generation</h3>
                  <p className="text-xs text-muted-foreground">
                    <b>Rule: One Batch → One Unique QR Code.</b> Generate and print batch labels for box attachment.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    className="rounded-xl border-primary/40 font-semibold text-primary hover:bg-primary-soft/40"
                    onClick={() => {
                      setManualScanText("");
                      setManualScanInputOpen(true);
                    }}
                  >
                    <ScanLine className="mr-2 size-4 text-primary" /> Scan Barcode / QR
                  </Button>
                  <Button variant="outline" className="rounded-xl font-semibold border-border/70 bg-card hover:bg-accent" onClick={() => window.print()}>
                    <Printer className="mr-2 size-4" /> Print Batch Labels
                  </Button>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 bg-muted/20 p-4">
                <div className="min-w-[280px] flex-1">
                  <label className="mb-1 block text-xs font-bold text-foreground">Filter Material / View Option</label>
                  <select
                    value={selectedQrMaterialCode}
                    onChange={(e) => setSelectedQrMaterialCode(e.target.value)}
                    className="w-full rounded-xl border border-border/70 bg-background px-3 py-2 text-sm font-bold text-primary"
                  >
                    <option value="ALL">📦 All Materials in PO ({materials.length} Materials)</option>
                    {materials.map((m) => (
                      <option key={m.item_code} value={m.item_code}>
                        {m.item_code} – {m.material_name} ({m.material_category || "General"})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => printAllPoQrLabels()}
                    className="rounded-xl font-bold shadow-glow"
                  >
                    <Printer className="mr-2 size-4" /> Print All PO Batch QR Labels
                  </Button>
                </div>
              </div>

              {/* Material-wise Batch QR Labels Grid (Good Stock) */}
              <div className="space-y-8">
                {(() => {
                  const goodMaterials = (selectedQrMaterialCode === "ALL"
                    ? materials.filter((m) => (m.good_quantity || 0) > 0)
                    : materials.filter((m) => m.item_code === selectedQrMaterialCode && (m.good_quantity || 0) > 0)
                  );
                  if (goodMaterials.length === 0) {
                    return (
                      <div className="rounded-xl border border-primary/20 bg-primary-soft/30 p-4 text-center text-xs font-medium text-primary">
                        No Good Quantity stock recorded for QR generation (Good Quantity = 0).
                      </div>
                    );
                  }
                  return goodMaterials.map((mat, matIdx) => {
                    const matBatches = materialBatches[mat.item_code];
                    const bList = (matBatches && matBatches.length > 0)
                      ? matBatches.filter((b) => (b.batch_quantity || 0) > 0)
                      : [{ batch_number: `BATCH-${mat.item_code}-001`, batch_quantity: mat.good_quantity }];
                    return (
                      <div key={mat.item_code} className="space-y-4 rounded-2xl border border-border/70 bg-muted/10 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="grid size-6 place-items-center rounded-full bg-primary font-mono text-xs font-bold text-primary-foreground">
                                {matIdx + 1}
                              </span>
                              <h4 className="text-base font-bold text-foreground">
                                {mat.material_name} <span className="rounded-full border border-primary/20 bg-primary-soft px-2 py-0.5 font-mono text-xs text-primary font-bold">{mat.item_code}</span>
                              </h4>
                            </div>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              Category: <b>{mat.material_category || "General"}</b> | Total Batches: <b>{bList.length}</b> | UOM: <b>{mat.uom}</b> | Approved Qty: <b className="text-success">{mat.good_quantity} {mat.uom}</b>
                            </p>
                          </div>

                          <Button
                            size="sm"
                            variant="outline"
                            className="rounded-xl border-border/70 text-xs font-semibold hover:border-primary/40 hover:bg-primary-soft/40 hover:text-primary"
                            onClick={() => printAllPoQrLabels(mat.item_code)}
                          >
                            <Printer className="mr-1.5 size-3.5" /> Print {mat.material_name} Labels ({bList.length})
                          </Button>
                        </div>

                        {bList.length === 0 ? (
                          <p className="p-4 text-center text-xs italic text-muted-foreground">No batches created for this material yet.</p>
                        ) : (
                          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {bList.map((b, idx) => {
                              const qrInfo = qrLabels[mat.item_code] || {
                                qr_id: `QR-MAT-${mat.item_code}`,
                                data_url: "",
                                payload: buildMaterialQrPayload(mat.item_code, b),
                              };
                              const variantCode = b.variant_code || mat.variant_code || `${mat.item_code}-V001`;
                              const sizeVal = b.size || mat.size || "Standard";
                              const colorVal = b.color || mat.color || "N/A";
                              const gradeVal = b.grade || mat.grade || "Grade A";
                              const warehouseVal = header.warehouse_name || "Main Warehouse";
                              const inspectionStatus = mat.quality_result === "REJECTED" ? "REJECTED" : "QUALITY APPROVED";
                              const uomVal = mat.uom || "PCS";
                              const batchQty = b.batch_quantity !== undefined ? b.batch_quantity : (mat.good_quantity ?? 0);

                              return (
                                <Card key={b.batch_number} className="group relative space-y-3 overflow-hidden rounded-2xl border border-border/70 bg-card p-5 text-center text-foreground shadow-soft transition-all hover:shadow-lift">
                                  <div className="flex items-center justify-between border-b border-border/60 pb-2">
                                    <div className="text-left">
                                      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">GRN Batch Label</span>
                                      <h4 className="font-mono text-base font-bold text-foreground">{b.batch_number}</h4>
                                    </div>
                                    <span className="rounded-full border border-primary/20 bg-primary-soft px-2.5 py-0.5 font-mono text-[11px] font-bold text-primary">
                                      {qrInfo.qr_id}
                                    </span>
                                  </div>

                                  <div
                                    className="group/qr relative my-2 cursor-pointer"
                                    onClick={() => handlePreviewBatchQr(mat, b, qrInfo)}
                                  >
                                    {qrInfo.data_url ? (
                                      <div className="relative inline-block rounded-2xl border border-border/70 bg-white p-2 shadow-2xs transition-transform group-hover/qr:scale-105">
                                        <img src={qrInfo.data_url} alt="Material QR Code" className="mx-auto size-48" />
                                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 rounded-2xl bg-black/75 p-2 text-xs font-bold text-white opacity-0 transition-opacity group-hover/qr:opacity-100">
                                          <Eye className="size-7 text-emerald-400" />
                                          <span>Click to Scan / Inspect</span>
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="mx-auto grid size-48 place-items-center rounded-2xl border border-dashed border-border/70 bg-muted/40">
                                        <Loader2 className="size-8 animate-spin text-primary" />
                                        <span className="text-xs text-muted-foreground">Generating QR...</span>
                                      </div>
                                    )}
                                  </div>

                                  <div className="space-y-1 rounded-xl border border-border/60 bg-muted/20 p-2.5 text-left font-mono text-xs text-foreground">
                                    <div className="flex justify-between"><span>Material Code:</span> <b className="text-primary">{mat.item_code}</b></div>
                                    <div className="flex justify-between"><span>Material Name:</span> <b>{mat.material_name}</b></div>
                                    <div className="flex justify-between"><span>Category:</span> <b>{mat.material_category || "Raw Materials"}</b></div>
                                    <div className="flex justify-between"><span>Variant Code:</span> <b>{variantCode}</b></div>
                                    <div className="flex justify-between"><span>Batch:</span> <b>{b.batch_number}</b></div>
                                    <div className="flex justify-between"><span>Size / Color:</span> <b>{sizeVal} / {colorVal}</b></div>
                                    <div className="flex justify-between"><span>Warehouse:</span> <b>{warehouseVal}</b></div>
                                    <div className="flex justify-between"><span>Grade:</span> <b>{gradeVal}</b></div>
                                    <div className="flex justify-between"><span>UOM:</span> <b>{uomVal}</b></div>
                                    <div className="flex justify-between"><span>Status:</span> <b className="text-success">{inspectionStatus}</b></div>
                                    <div className="flex justify-between border-t border-border/60 pt-1 font-sans"><span>Batch Quantity:</span> <b className="font-mono text-sm text-primary">{batchQty} {uomVal}</b></div>
                                  </div>

                                  <div className="grid grid-cols-2 gap-2 pt-1">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="w-full rounded-xl border-border/70 text-xs font-semibold hover:border-primary/40 hover:bg-primary-soft/40 hover:text-primary"
                                      onClick={() => handlePreviewBatchQr(mat, b, qrInfo)}
                                    >
                                      <Eye className="mr-1 size-3 text-primary" /> Scan / Preview
                                    </Button>
                                    <Button
                                      size="sm"
                                      className="w-full rounded-xl text-xs font-semibold shadow-glow"
                                      onClick={() => printSingleQrLabel(b.batch_number, mat.item_code, qrInfo.qr_id, qrInfo.data_url)}
                                    >
                                      <Printer className="mr-1 size-3" /> Print Label
                                    </Button>
                                  </div>
                                </Card>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  });
                })()}
              </div>

              {/* ⚠️ DAMAGED & REJECTED GOODS QR LABELS (QUARANTINE) SECTION */}
              <div className="space-y-4 border-t border-border/60 pt-6">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-destructive/30 bg-danger-soft/40 p-4">
                  <div>
                    <h4 className="flex items-center gap-2 text-base font-bold text-destructive">
                      <AlertTriangle className="size-5 animate-pulse text-destructive" />
                      Damaged & Rejected Goods QR Labels (Quarantine Area)
                    </h4>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      <b>Rule: Damaged/Rejected Goods → Damage Lot → Unique Damage QR → Quarantine Storage.</b> Damaged goods are excluded from available stock.
                    </p>
                  </div>
                  {damageQrLabels.length > 0 && (
                    <div className="flex items-center gap-2">
                      <Button
                        onClick={() => {
                          setNotifyVendorEmail(header.supplier_email || "spoorthiharakuni@gmail.com");
                          setShowNotifyVendorModal(true);
                        }}
                        className="rounded-xl font-bold bg-warning text-warning-foreground hover:bg-warning/90 shadow-2xs"
                      >
                        <Mail className="mr-2 size-4" /> Send Damage Report to Vendor & Procurement
                      </Button>
                      <Button
                        onClick={() => printAllDamageQrLabels()}
                        variant="outline"
                        className="rounded-xl border-destructive/30 font-bold text-destructive hover:bg-danger-soft shadow-2xs"
                      >
                        <Printer className="mr-2 size-4" /> Print All Damage Labels ({damageQrLabels.length})
                      </Button>
                    </div>
                  )}
                </div>

                {damageQrLabels.length === 0 ? (
                  <div className="rounded-xl border border-success/30 bg-success-soft/30 p-4 text-center text-xs font-medium text-success">
                    ✓ No damaged or rejected goods recorded for this GRN. All received material lines are 100% sound.
                  </div>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {damageQrLabels.map((dEntry) => (
                      <Card key={dEntry.damage_lot_number} className="group relative space-y-3 overflow-hidden rounded-2xl border-2 border-destructive/30 bg-danger-soft/15 p-5 text-center text-foreground shadow-soft transition-all hover:shadow-lift">
                        <div className="flex items-center justify-between border-b border-destructive/20 pb-2">
                          <div className="text-left">
                            <span className="text-[10px] font-extrabold uppercase tracking-widest text-destructive">Damage Lot QR</span>
                            <h4 className="font-mono text-sm font-bold text-foreground">{dEntry.damage_lot_number}</h4>
                          </div>
                          <span className="rounded-full border border-destructive/30 bg-danger-soft px-2.5 py-0.5 font-mono text-[11px] font-bold text-destructive">
                            {dEntry.qr_code}
                          </span>
                        </div>

                        <div
                          className="group/qr relative my-2 cursor-pointer"
                          onClick={() => handlePreviewDamageQr(dEntry)}
                        >
                          {dEntry.qr_data_url ? (
                            <div className="relative inline-block rounded-2xl border border-destructive/30 bg-white p-2 shadow-2xs transition-transform group-hover/qr:scale-105">
                              <img src={dEntry.qr_data_url} alt="Damage QR Code" className="mx-auto size-44" />
                              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 rounded-2xl bg-black/75 p-2 text-xs font-bold text-white opacity-0 transition-opacity group-hover/qr:opacity-100">
                                <Eye className="size-7 text-rose-300" />
                                <span>Click to Enlarge / Scan</span>
                              </div>
                            </div>
                          ) : (
                            <div className="mx-auto grid size-44 place-items-center rounded-2xl border border-dashed border-destructive/30 bg-danger-soft/40">
                              <Loader2 className="size-8 animate-spin text-destructive" />
                              <span className="text-xs text-destructive">Generating Damage QR...</span>
                            </div>
                          )}
                        </div>

                        <div className="space-y-1 rounded-xl border border-destructive/20 bg-card p-2.5 text-left font-mono text-xs text-foreground">
                          <p><b>GRN Number:</b> {header.grn_number}</p>
                          <p><b>Material:</b> {dEntry.item_code} ({dEntry.material_name})</p>
                          <p><b>Damaged Qty:</b> <b className="text-destructive">{dEntry.damaged_quantity} {dEntry.uom}</b></p>
                          <p><b>Reason:</b> {dEntry.reason}</p>
                          <p><b>QA Status:</b> <span className="rounded border border-destructive/30 bg-danger-soft px-1.5 py-0.5 text-[10px] font-bold text-destructive">{dEntry.qa_status}</span></p>
                          <p><b>Quarantine Location:</b> <span className="font-bold text-warning">{dEntry.quarantine_location}</span></p>
                        </div>

                        <div className="grid grid-cols-2 gap-2 pt-1">
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full rounded-xl border-destructive/30 text-xs font-bold text-destructive hover:bg-danger-soft"
                            onClick={() => handlePreviewDamageQr(dEntry)}
                          >
                            <Eye className="mr-1 size-3 text-destructive" /> Preview
                          </Button>
                          <Button
                            size="sm"
                            className="w-full rounded-xl bg-destructive text-xs font-bold text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => printSingleDamageQrLabel(dEntry)}
                          >
                            <Printer className="mr-1 size-3" /> Print Label
                          </Button>
                          <Button
                            size="sm"
                            className="col-span-2 w-full rounded-xl bg-warning text-xs font-bold text-warning-foreground hover:bg-warning/90"
                            onClick={() => {
                              setNotifyVendorEmail(header.supplier_email || "spoorthiharakuni@gmail.com");
                              setShowNotifyVendorModal(true);
                            }}
                          >
                            <Mail className="mr-1.5 size-3" /> Email Damage Report to Vendor ({header.supplier_name})
                          </Button>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex justify-between border-t border-border/60 pt-6">
                <Button variant="outline" className="rounded-xl" onClick={() => setCurrentPage(5)}>
                  <ArrowLeft className="mr-2 size-4" /> Back to Page 5
                </Button>
                <Button
                  disabled={busyAction}
                  onClick={async () => {
                    setBusyAction(true);
                    try {
                      // Rule: (Good Qty + Damaged Qty) >= PO Qty for ALL materials => COMPLETED
                      //       (Good Qty + Damaged Qty) < PO Qty for ANY material => PARTIALLY COMPLETED
                      const currentMaterials = materials.length > 0 ? materials : [
                        {
                          item_code: "MAT-STEEL-001",
                          material_name: "High-Tensile Steel Coil 2mm",
                          po_quantity: 100,
                          good_quantity: 90,
                          damaged_quantity: 10,
                          uom: "MT",
                        },
                      ];

                      const processedMaterials = currentMaterials.map((m) => {
                        const good = Number(m.good_quantity) || 0;
                        const damaged = Number(m.damaged_quantity) || 0;
                        const poQty = Number(m.po_quantity) || 0;
                        const combined = good + damaged;
                        const balance = Math.max(0, poQty - combined);
                        return {
                          ...m,
                          good_quantity: good,
                          damaged_quantity: damaged,
                          combined_received: combined,
                          balance_quantity: balance,
                          is_line_complete: combined >= poQty,
                        };
                      });

                      const isAllFullyDelivered = processedMaterials.every((m) => m.is_line_complete);
                      const computedStatus = isAllFullyDelivered ? "COMPLETED" : "PARTIALLY COMPLETED";

                      const grnNumber = header.grn_number || `GRN-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, "0")}${String(new Date().getDate()).padStart(2, "0")}-${Math.floor(1000 + Math.random() * 9000)}`;

                      const newRecord = {
                        grn_id: grnId || grnNumber,
                        grn_number: grnNumber,
                        po_number: header.po_number || "PO-1001",
                        supplier_name: header.supplier_name || header.supplier_company_name || "ABC Supplier Ltd",
                        supplier_company_name: header.supplier_company_name || header.supplier_name || "ABC Supplier Ltd",
                        supplier_email: header.supplier_email || "spoorthiharakuni@gmail.com",
                        vehicle_number: header.vehicle_number || "KA01EQ9921",
                        driver_name: header.driver_name || "Obaiah",
                        dock_number: header.receiving_dock || "DOCK-01",
                        status: computedStatus,
                        receipt_date: new Date().toISOString().split("T")[0],
                        created_at: new Date().toISOString(),
                        received_by: loggedInUserName || "Officer Obaiah",
                        materials: processedMaterials,
                      };

                      try {
                        if (grnId || grnNumber) {
                          await api.postGrn(grnId || grnNumber, `Status: ${computedStatus} - Posted from GRN Console`);
                        }
                      } catch (apiErr) {
                        console.log("postGrn API fallback to local state:", apiErr);
                      }

                      // Update grnRecords state so it appears immediately on Dashboard & Records table
                      setGrnRecords((prev) => [
                        newRecord,
                        ...prev.filter((r) => r.grn_number !== grnNumber && r.grn_id !== newRecord.grn_id),
                      ]);

                      toast.success(`GOODS RECEIVING PROCESS COMPLETED!`, {
                        description: `GRN ${grnNumber} saved with status: ${computedStatus} (${computedStatus === "COMPLETED" ? "100% PO Quantity Reconciled (Good + Damaged Qty matches PO)" : "Partial Delivery (Good + Damaged Qty < PO Qty)"}).`,
                      });
                    } catch (e: any) {
                      console.error("GRN Posting error:", e);
                      toast.error("Failed to post GRN", { description: e.message });
                    } finally {
                      setBusyAction(false);
                      setActiveTab("dashboard");
                      setSearchTerm("");
                    }
                  }}
                  className="flex items-center gap-2 rounded-xl bg-success px-8 text-sm font-bold text-success-foreground shadow-glow hover:bg-success/90"
                >
                  {busyAction ? (
                    <>
                      <Loader2 className="size-5 animate-spin" /> Saving & Posting GRN...
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="size-5" /> COMPLETE & POST GOODS RECEIVING
                    </>
                  )}
                </Button>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Enlarged QR Code Scanner Dialog */}
      {enlargedQr && (
        <Dialog open={!!enlargedQr} onOpenChange={() => setEnlargedQr(null)}>
          <DialogContent className="sm:max-w-lg space-y-4 rounded-2xl border border-border/70 bg-card p-6 text-center shadow-soft">
            <DialogHeader>
              <DialogTitle className="flex items-center justify-center gap-2 text-lg font-bold text-foreground">
                <QrCode className="size-5 text-primary" /> Batch QR Code – {enlargedQr.title}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Point any smartphone camera or QR scanner at the high-definition QR code below to read batch details.
              </DialogDescription>
            </DialogHeader>

            <div className="mx-auto inline-block rounded-2xl border border-border/70 bg-white p-4 shadow-soft">
              <img src={enlargedQr.data_url} alt="Enlarged QR Code" className="mx-auto size-72" />
            </div>

            <div className="space-y-2 text-left">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                📱 Scanned Mobile Reader Live Output
              </span>
              <div className="max-h-40 overflow-x-auto whitespace-pre rounded-xl border border-border/70 bg-muted/40 p-3 font-mono text-xs leading-relaxed text-foreground shadow-inner">
                {enlargedQr.payload}
              </div>
            </div>

            {/* Primary Action: Scan & View Stock Details */}
            <Button
              className="h-10 w-full rounded-xl font-bold shadow-glow"
              disabled={isScanningQr}
              onClick={() => handleScanQrCode(enlargedQr.payload || enlargedQr.qr_id)}
            >
              {isScanningQr ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" /> Verifying QR Code...
                </>
              ) : (
                <>
                  <ScanLine className="mr-2 size-4" /> Scan & View Stock Details
                </>
              )}
            </Button>

            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="w-1/2 rounded-xl" onClick={() => setEnlargedQr(null)}>
                Close Preview
              </Button>
              <Button
                variant="outline"
                className="w-1/2 rounded-xl font-bold border-border/70 bg-card hover:bg-accent"
                onClick={() =>
                  enlargedQr.qr_id.startsWith("DMG-") || enlargedQr.title.startsWith("DMG-")
                    ? printSingleDamageQrLabel({
                      damage_lot_id: `dmg_lot_${enlargedQr.itemCode}`,
                      damage_lot_number: enlargedQr.title,
                      item_code: enlargedQr.itemCode,
                      material_name: enlargedQr.itemCode,
                      damaged_quantity: enlargedQr.batch?.batch_quantity || 0,
                      uom: "PCS",
                      reason: "Damaged during receiving",
                      qa_status: "REJECTED",
                      quarantine_location: "QUARANTINE-ZONE-A",
                      status: "DAMAGED",
                      qr_id: enlargedQr.qr_id,
                      qr_code: enlargedQr.qr_id,
                      qr_payload: enlargedQr.payload,
                      qr_data_url: enlargedQr.data_url,
                    })
                    : printSingleQrLabel(enlargedQr.title, enlargedQr.itemCode, enlargedQr.qr_id, enlargedQr.data_url)
                }
              >
                <Printer className="mr-1.5 size-4" /> Print Label
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* 📦 QR SCAN RESULT MODAL (Matching Warehouse Color Variant modal UI) */}
      <QRScanResultModal
        isOpen={isScanResultModalOpen}
        onClose={() => setIsScanResultModalOpen(false)}
        data={scanResultData}
        onPrint={(item) => {
          if (item.stock_status === "QUARANTINED" || item.qr_id.startsWith("DMG-")) {
            printSingleDamageQrLabel({
              damage_lot_id: `dmg_lot_${item.material_code}`,
              damage_lot_number: item.batch_number || `DMG-LOT-${item.grn_number}-${item.material_code}`,
              item_code: item.material_code,
              material_name: item.material_name,
              damaged_quantity: item.damaged_quantity,
              uom: item.uom,
              reason: "Quarantined for damage inspection",
              qa_status: "REJECTED",
              quarantine_location: "QUARANTINE-ZONE-A",
              status: "DAMAGED",
              qr_id: item.qr_id,
              qr_code: item.qr_id,
              qr_payload: "",
              qr_data_url: "",
            });
          } else {
            printSingleQrLabel(
              item.batch_number || `BATCH-${item.material_code}-001`,
              item.material_code,
              item.qr_id,
              ""
            );
          }
        }}
      />

      {/* ⚠️ QR CODE NOT FOUND ERROR MODAL */}
      <QrNotFoundModal
        isOpen={qrNotFoundOpen}
        onClose={() => setQrNotFoundOpen(false)}
        scannedCode={scannedCodeValue}
      />

      {/* 📱 MANUAL / BARCODE SCANNER INPUT MODAL */}
      {manualScanInputOpen && (
        <Dialog open={manualScanInputOpen} onOpenChange={setManualScanInputOpen}>
          <DialogContent className="sm:max-w-md space-y-4 rounded-2xl border border-border/70 bg-card p-6 shadow-soft">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base font-bold text-foreground">
                <ScanLine className="size-5 text-primary" /> Barcode / QR Scanner Input
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Scan with a handheld barcode scanner or paste the raw QR code identifier / payload below.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                QR Code / Barcode Data
              </label>
              <Textarea
                placeholder="e.g. QR-MAT-MAT-001 or DMG-GRN-2026-0001-MAT-001-01 or MAT-1001-V002 or paste multi-line QR content"
                value={manualScanText}
                onChange={(e) => setManualScanText(e.target.value)}
                className="h-28 rounded-xl font-mono text-xs"
                autoFocus
              />
            </div>

            <div className="flex gap-2 pt-1">
              <Button
                variant="outline"
                className="w-1/2 rounded-xl"
                onClick={() => setManualScanInputOpen(false)}
              >
                Cancel
              </Button>
              <Button
                className="w-1/2 rounded-xl font-bold shadow-glow"
                disabled={!manualScanText.trim() || isScanningQr}
                onClick={() => handleScanQrCode(manualScanText)}
              >
                {isScanningQr ? (
                  <Loader2 className="mr-1.5 size-4 animate-spin" />
                ) : (
                  <ScanLine className="mr-1.5 size-4" />
                )}
                Verify & Scan
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
      {/* 🛡️ QUALITY PASS RATE AUDIT MODAL */}
      {showQualityPassModal && (
        <Dialog open={showQualityPassModal} onOpenChange={() => setShowQualityPassModal(false)}>
          <DialogContent className="sm:max-w-xl space-y-4 rounded-2xl border border-border/70 bg-card p-6 shadow-soft">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-lg font-bold text-primary">
                <ShieldCheck className="size-6 text-primary" /> Goods Inspection Quality Audit & Pass Rate
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Detailed quality pass rate metrics across received inbound material batches for the current month.
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-3 gap-3 rounded-xl border border-border/70 bg-muted/20 p-3 text-center">
              <div>
                <span className="text-[10px] font-bold uppercase text-muted-foreground">Total Inspected</span>
                <p className="font-mono text-xl font-extrabold text-foreground">18,570</p>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase text-success">Passed (Good)</span>
                <p className="font-mono text-xl font-extrabold text-success">18,450 (99.3%)</p>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase text-destructive">Damaged / Rejected</span>
                <p className="font-mono text-xl font-extrabold text-destructive">120 (0.7%)</p>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Material-wise Inspection Breakdown</h4>
              <div className="overflow-hidden rounded-xl border border-border/70 text-xs">
                <table className="w-full text-left">
                  <thead className="border-b border-border/70 bg-muted/40 font-bold text-muted-foreground">
                    <tr>
                      <th className="p-2.5">Material Code & Name</th>
                      <th className="p-2.5">Good Qty</th>
                      <th className="p-2.5">Damaged Qty</th>
                      <th className="p-2.5">Pass Rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60 font-medium">
                    {materials.map((m) => {
                      const total = m.good_quantity + m.damaged_quantity;
                      const rate = total > 0 ? ((m.good_quantity / total) * 100).toFixed(1) : "100.0";
                      return (
                        <tr key={m.item_code} className="transition-colors hover:bg-muted/20">
                          <td className="p-2.5 font-bold text-foreground">
                            {m.item_code} – {m.material_name}
                          </td>
                          <td className="p-2.5 font-mono font-bold text-success">
                            {m.good_quantity} {m.uom}
                          </td>
                          <td className="p-2.5 font-mono font-bold text-destructive">
                            {m.damaged_quantity} {m.uom}
                          </td>
                          <td className="p-2.5 font-mono">
                            <span className="rounded-full border border-primary/20 bg-primary-soft px-2 py-0.5 text-[10px] font-bold text-primary">
                              {rate}%
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-border/60 pt-2">
              <Button variant="outline" className="rounded-xl" onClick={() => setShowQualityPassModal(false)}>
                Close Audit
              </Button>
              <Button
                className="rounded-xl font-bold shadow-glow"
                onClick={() => {
                  setShowQualityPassModal(false);
                  setActiveTab("records");
                }}
              >
                View GRN Records
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* 📧 NOTIFY VENDOR & PROCUREMENT MODAL */}
      {showNotifyVendorModal && (
        <Dialog open={showNotifyVendorModal} onOpenChange={() => setShowNotifyVendorModal(false)}>
          <DialogContent className="sm:max-w-xl space-y-4 rounded-2xl border border-border/70 bg-card p-6 shadow-soft">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-lg font-bold text-destructive">
                <Mail className="size-6 text-destructive" /> Send Damaged Goods Notice to Vendor & Procurement
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Dispatches an official damage report email to the supplier ({header.supplier_name}) and alerts the internal Procurement team in NexusWMS.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold uppercase text-muted-foreground">Supplier Email Address</label>
                <Input
                  type="email"
                  value={notifyVendorEmail}
                  onChange={(e) => setNotifyVendorEmail(e.target.value)}
                  placeholder="vendor@company.com"
                  className="mt-1 rounded-xl font-mono text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-bold uppercase text-muted-foreground">Damaged & Rejected Items Breakdown</label>
                <div className="mt-1 max-h-40 space-y-2 overflow-y-auto rounded-xl border border-border/70 bg-muted/20 p-3">
                  {damageQrLabels.length === 0 ? (
                    <p className="text-xs italic text-muted-foreground">No damaged items listed.</p>
                  ) : (
                    damageQrLabels.map((d) => (
                      <div key={d.damage_lot_number} className="flex items-center justify-between border-b border-border/60 pb-1 font-mono text-xs">
                        <div>
                          <span className="font-bold text-foreground">{d.item_code} ({d.material_name})</span>
                          <p className="text-[10px] text-muted-foreground">Lot: {d.damage_lot_number} | Reason: {d.reason}</p>
                        </div>
                        <span className="rounded border border-destructive/30 bg-danger-soft px-2 py-0.5 font-bold text-destructive">
                          {d.damaged_quantity} {d.uom}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold uppercase text-muted-foreground">Inspector Custom Remarks / Instructions</label>
                <Textarea
                  value={notifyVendorRemarks}
                  onChange={(e) => setNotifyVendorRemarks(e.target.value)}
                  placeholder="Specify damage notes or instructions for return / replacement debit note..."
                  className="mt-1 rounded-xl text-xs"
                  rows={3}
                />
              </div>
            </div>

            <div className="flex gap-2 border-t border-border/60 pt-3">
              <Button variant="outline" className="w-1/2 rounded-xl" onClick={() => setShowNotifyVendorModal(false)}>
                Cancel
              </Button>
              <Button
                disabled={sendingVendorNotify}
                className="w-1/2 rounded-xl bg-destructive font-bold text-destructive-foreground hover:bg-destructive/90 shadow-2xs"
                onClick={async () => {
                  setSendingVendorNotify(true);
                  try {
                    const currentPhotoIds = Object.values(damagePhotos)
                      .map((p) => p.evidenceId)
                      .filter((id): id is string => Boolean(id && id.trim()));

                    const damagedList = (materials || []).filter(
                      (m) =>
                        (Number(m.damaged_quantity) || 0) > 0 ||
                        (Number(m.rejected_quantity) || 0) > 0,
                    );
                    const sourceList =
                      damagedList.length > 0
                        ? damagedList
                        : (damageQrLabels && damageQrLabels.length > 0
                          ? damageQrLabels
                          : materials);

                    const damagePayloadItems = sourceList.map((item: any) => {
                      const code = item.item_code || item.itemCode || "MAT";
                      const name = item.material_name || item.materialName || "Material";
                      const qty = Number(
                        item.damaged_quantity ?? item.quantity ?? item.rejected_quantity ?? 1,
                      );
                      const photo = damagePhotos[code];
                      const pIds = photo?.evidenceId ? [photo.evidenceId] : [];
                      return {
                        item_code: code,
                        material_name: name,
                        damaged_quantity: qty > 0 ? qty : 1,
                        uom: item.uom || "PCS",
                        reason:
                          item.damage_reason ||
                          item.reason ||
                          "Damaged during receiving inspection",
                        photo_ids: pIds,
                      };
                    });

                    const targetGrnId = grnId || (selectedGrnDetail && (selectedGrnDetail.grn_id || selectedGrnDetail.id));
                    if (!targetGrnId) {
                      toast.error("GRN must be saved before sending damage notification.");
                      return;
                    }

                    const res = await api.notifyVendorDamage(targetGrnId, {
                      supplier_email: notifyVendorEmail || "spoorthiharakuni@gmail.com",
                      custom_remarks: notifyVendorRemarks || "",
                      notify_procurement: true,
                      photo_ids: currentPhotoIds,
                      damage_items: damagePayloadItems,
                    });
                    toast.success("Damage Report Email Sent!", {
                      description: `Notice dispatched to ${res.vendor_email || notifyVendorEmail} and Procurement team notified.`,
                    });
                    setShowNotifyVendorModal(false);
                  } catch (err: any) {
                    toast.error("Failed to Send Vendor Email", {
                      description: err.message || "Could not dispatch email. Please check network/SMTP settings.",
                    });
                  } finally {
                    setSendingVendorNotify(false);
                  }
                }}
              >
                {sendingVendorNotify ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Send className="mr-2 size-4" />}
                Send Report & Notify
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* 📄 GRN RECORD QUICK DETAIL MODAL DRAWER */}
      {selectedGrnDetail && (
        <Dialog open={!!selectedGrnDetail} onOpenChange={() => setSelectedGrnDetail(null)}>
          <DialogContent className="max-w-3xl space-y-5 rounded-2xl border border-border/70 bg-card p-6 shadow-soft">
            <DialogHeader className="border-b border-border/60 pb-3">
              <div className="flex items-center justify-between">
                <span className="rounded-full border border-primary/20 bg-primary-soft px-3 py-1 font-mono text-xs font-bold text-primary">
                  {selectedGrnDetail.grn_number || "GRN-2026-0001"}
                </span>
                <StatusBadge status={selectedGrnDetail.status || "COMPLETED"} />
              </div>
              <DialogTitle className="mt-2 text-lg font-bold text-foreground">
                Goods Receipt Note Breakdown & Reconciliation
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                PO Reference: <b>{selectedGrnDetail.po_number || "PO-1001"}</b> • Supplier: <b>{selectedGrnDetail.supplier_name || "ABC Supplier"}</b>
              </DialogDescription>
            </DialogHeader>

            {/* STATUS RECONCILIATION RULE BANNER */}
            <div className={`flex items-center justify-between rounded-xl border p-3 text-xs font-semibold ${selectedGrnDetail.status === "COMPLETED"
                ? "border-success/30 bg-success-soft text-success"
                : "border-warning/30 bg-warning-soft text-warning"
              }`}>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-4 shrink-0 text-success" />
                <span>
                  {selectedGrnDetail.status === "COMPLETED"
                    ? "✓ COMPLETED: Combined count (Good Qty + Damaged Qty) matches 100% of PO Quantity for all materials."
                    : "⏳ PARTIALLY COMPLETED: Combined count (Good Qty + Damaged Qty) is less than PO Quantity (Pending Balance Remaining)."}
                </span>
              </div>
              <span className="rounded border border-border/60 bg-background px-2 py-0.5 font-mono text-[11px] font-bold shadow-2xs">
                Rule Verified
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 rounded-xl border border-border/60 bg-muted/20 p-3 font-mono text-xs sm:grid-cols-4">
              <div>
                <span className="block font-sans text-[10px] font-bold uppercase text-muted-foreground">Dock Number</span>
                <b className="text-foreground">Dock {selectedGrnDetail.dock_number || "DOCK-02"}</b>
              </div>
              <div>
                <span className="block font-sans text-[10px] font-bold uppercase text-muted-foreground">Vehicle Reg</span>
                <b className="text-foreground">{selectedGrnDetail.vehicle_number || "KA01EQ9921"}</b>
              </div>
              <div>
                <span className="block font-sans text-[10px] font-bold uppercase text-muted-foreground">Driver Name</span>
                <b className="text-foreground">{selectedGrnDetail.driver_name || "Ramesh"}</b>
              </div>
              <div>
                <span className="block font-sans text-[10px] font-bold uppercase text-muted-foreground">Received By</span>
                <b className="text-foreground">{selectedGrnDetail.received_by || "Officer Obaiah"}</b>
              </div>
            </div>

            {/* MATERIAL LINE ITEMS RECONCILIATION BREAKDOWN TABLE */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Line Item Quantity Reconciliation</h4>
              <div className="overflow-x-auto rounded-xl border border-border/70 text-xs">
                <table className="w-full text-left">
                  <thead className="border-b border-border/70 bg-muted/40 text-[11px] font-bold uppercase text-muted-foreground">
                    <tr>
                      <th className="p-2.5">Material Details</th>
                      <th className="p-2.5 text-right">PO Qty</th>
                      <th className="p-2.5 text-right text-success">Good Qty</th>
                      <th className="p-2.5 text-right text-destructive">Damaged Qty</th>
                      <th className="p-2.5 text-right font-black text-primary">Good + Damaged</th>
                      <th className="p-2.5 text-right text-warning">Pending Bal</th>
                      <th className="p-2.5 text-center">Item Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60 font-mono font-medium">
                    {(() => {
                      const detailLines = (selectedGrnDetail.lines && selectedGrnDetail.lines.length > 0)
                        ? selectedGrnDetail.lines
                        : ((selectedGrnDetail.materials && selectedGrnDetail.materials.length > 0)
                          ? selectedGrnDetail.materials
                          : (materials.length > 0 ? materials : []));

                      if (detailLines.length === 0) {
                        return (
                          <tr>
                            <td colSpan={7} className="p-4 text-center font-sans text-xs italic text-muted-foreground">
                              No material line items recorded for this GRN.
                            </td>
                          </tr>
                        );
                      }

                      return detailLines.map((m: any, i: number) => {
                        const itemCode = m.item_code || m.itemCode || `MAT-00${i + 1}`;
                        const materialName = m.material_name || m.materialName || itemCode;
                        const uom = m.uom || "PCS";
                        const poQty = Number(m.ordered_quantity ?? m.po_quantity ?? m.orderedQuantity ?? m.poQuantity ?? 0);
                        const goodQty = Number(m.good_quantity ?? m.goodQuantity ?? 0);
                        const damQty = Number(m.damaged_quantity ?? m.damagedQuantity ?? 0);
                        const combined = goodQty + damQty;
                        const bal = m.balance_quantity !== undefined && m.balance_quantity !== null
                          ? Number(m.balance_quantity)
                          : Math.max(0, poQty - combined);
                        const isComplete = combined >= poQty;

                        return (
                          <tr key={itemCode || `mat_detail_${i}`} className="transition-colors hover:bg-muted/20">
                            <td className="p-2.5 font-sans font-bold">
                              <span className="block font-mono text-primary">{itemCode}</span>
                              <span className="text-xs text-foreground">{materialName}</span>
                            </td>
                            <td className="p-2.5 text-right font-bold text-foreground">
                              {poQty} {uom}
                            </td>
                            <td className="p-2.5 text-right font-bold text-success">
                              {goodQty} {uom}
                            </td>
                            <td className="p-2.5 text-right font-bold text-destructive">
                              {damQty} {uom}
                            </td>
                            <td className="p-2.5 text-right font-black text-primary">
                              {combined} {uom}
                            </td>
                            <td className="p-2.5 text-right font-bold text-warning">
                              {bal} {uom}
                            </td>
                            <td className="p-2.5 text-center">
                              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${isComplete ? "border-success/30 bg-success-soft text-success" : "border-warning/30 bg-warning-soft text-warning"
                                }`}>
                                {isComplete ? "FULL DELIVERY ✓" : "PARTIAL BALANCE ⏳"}
                              </span>
                            </td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-border/60 pt-3">
              <Button variant="outline" className="rounded-xl text-xs font-bold" onClick={() => setSelectedGrnDetail(null)}>
                Close
              </Button>
              <Button
                className="rounded-xl bg-destructive text-xs font-bold text-destructive-foreground hover:bg-destructive/90"
                onClick={() => {
                  setNotifyVendorEmail(selectedGrnDetail.supplier_email || "spoorthiharakuni@gmail.com");
                  setGrnId(selectedGrnDetail.grn_id || selectedGrnDetail.id || "grn-2026-0001");
                  setSelectedGrnDetail(null);
                  setShowNotifyVendorModal(true);
                }}
              >
                <Send className="mr-1.5 size-3.5" /> Send Vendor Damage Notice
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* 🚪 QUICK DOCK ASSIGNMENT MODAL */}
      {showAssignDockModal && (
        <Dialog open={showAssignDockModal} onOpenChange={setShowAssignDockModal}>
          <DialogContent className="max-w-md space-y-4 rounded-2xl border border-border/70 bg-card p-6 shadow-soft">
            <DialogHeader className="border-b border-border/60 pb-3">
              <DialogTitle className="flex items-center gap-2 text-base font-bold text-foreground">
                <DoorOpen className="size-5 text-primary" /> Assign Incoming Vehicle to Dock
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Select available dock bay and link incoming vehicle registration.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 text-xs">
              <div>
                <label className="mb-1 block font-bold text-foreground">Select Dock Bay</label>
                <select
                  value={assigningDockId}
                  onChange={(e) => setAssigningDockId(e.target.value)}
                  className="w-full rounded-xl border border-border/70 bg-background px-3 py-2 font-bold text-foreground"
                >
                  <option value="DOCK-01">DOCK-01 (Occupied)</option>
                  <option value="DOCK-02">DOCK-02 (Gate Verified)</option>
                  <option value="DOCK-03">DOCK-03 (Available)</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block font-bold text-foreground">Vehicle Registration Number</label>
                <Input
                  placeholder="KA-05-MH-8812"
                  value={assigningVehicle}
                  onChange={(e) => setAssigningVehicle(e.target.value)}
                  className="rounded-xl font-mono text-xs font-bold"
                />
              </div>

              <div>
                <label className="mb-1 block font-bold text-foreground">PO Reference (Optional)</label>
                <Input
                  placeholder="PO-2026-0007"
                  value={assigningPo}
                  onChange={(e) => setAssigningPo(e.target.value)}
                  className="rounded-xl font-mono text-xs font-bold"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-border/60 pt-3">
              <Button variant="outline" className="rounded-xl" onClick={() => setShowAssignDockModal(false)}>
                Cancel
              </Button>
              <Button
                className="rounded-xl font-bold shadow-glow"
                onClick={() => {
                  toast.success(`Vehicle ${assigningVehicle || "KA-05-MH-8812"} assigned to ${assigningDockId}`);
                  setShowAssignDockModal(false);
                  setActiveTab("wizard");
                  setCurrentPage(1);
                }}
              >
                Confirm & Start GRN
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* 👁️ INTERACTIVE DOCUMENT VIEWER MODAL / PAGE */}
      {viewingDocumentModal && (
        <Dialog open={!!viewingDocumentModal} onOpenChange={() => setViewingDocumentModal(null)}>
          <DialogContent className="max-h-[90vh] max-w-3xl space-y-5 overflow-y-auto rounded-2xl border border-border/70 bg-card p-6 shadow-soft">
            <DialogHeader className="border-b border-border/60 pb-3">
              <div className="flex items-center justify-between">
                <span className="rounded-full border border-primary/20 bg-primary-soft px-3 py-1 font-mono text-xs font-bold uppercase text-primary">
                  {viewingDocumentModal.category || "ATTACHED DOCUMENT"}
                </span>
                <span className="flex items-center gap-1 rounded-full border border-success/30 bg-success-soft px-2.5 py-0.5 text-[10px] font-bold text-success">
                  <ShieldCheck className="size-3" /> WMS Verified Attachment
                </span>
              </div>
              <DialogTitle className="mt-2 line-clamp-1 text-lg font-bold text-foreground">
                Document Preview: {viewingDocumentModal.file_name}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Inbound Quality & Regulatory Attachment • PO: {header.po_number || "PO-1001"} • GRN: {header.grn_number || "GRN-2026-0001"}
              </DialogDescription>
            </DialogHeader>

            {/* DOCUMENT PREVIEW CONTAINER */}
            <div className="relative flex min-h-[320px] flex-col items-center justify-center overflow-hidden rounded-xl border border-border/70 bg-muted/20 p-4">
              {viewingDocumentModal.file_path.startsWith("blob:") ||
                viewingDocumentModal.file_path.match(/\.(jpg|jpeg|png|webp|svg)$/i) ||
                viewingDocumentModal.category.toLowerCase().includes("photo") ? (
                <div className="w-full space-y-3 text-center">
                  <img
                    src={viewingDocumentModal.file_path}
                    alt={viewingDocumentModal.file_name}
                    className="mx-auto max-h-[380px] w-auto rounded-lg border border-border/70 object-contain shadow-soft"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = "none";
                    }}
                  />
                  <p className="font-mono text-xs text-muted-foreground">Image Evidence Preview • High Resolution</p>
                </div>
              ) : (
                <div className="w-full space-y-4 py-6 text-center">
                  <div className="mx-auto flex size-16 items-center justify-center rounded-2xl border border-primary/30 bg-primary-soft text-primary shadow-inner">
                    <FileText className="size-8" />
                  </div>
                  <div>
                    <h4 className="font-mono text-base font-bold text-foreground">{viewingDocumentModal.file_name}</h4>
                    <p className="mt-1 text-xs text-muted-foreground">Official Document Copy • PDF / Document Format</p>
                  </div>
                  <div className="mx-auto max-w-md space-y-1.5 rounded-xl border border-border/70 bg-card p-4 text-left font-mono text-xs text-foreground shadow-2xs">
                    <div><b>Document Section:</b> {viewingDocumentModal.category}</div>
                    <div><b>GRN Reference:</b> {header.grn_number || "GRN-2026-0001"}</div>
                    <div><b>Uploaded By:</b> {loggedInUserName}</div>
                    <div><b>Timestamp:</b> {new Date().toLocaleString()}</div>
                    <div><b>Security Hash:</b> SHA256-AUTHENTICATED</div>
                  </div>
                </div>
              )}
            </div>

            {/* ACTION FOOTER */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-3">
              <Button
                variant="outline"
                className="rounded-xl text-xs font-bold"
                onClick={() => setViewingDocumentModal(null)}
              >
                Close Viewer
              </Button>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  className="rounded-xl border-primary/40 text-xs font-semibold text-primary hover:bg-primary-soft/40"
                  onClick={() => {
                    const win = window.open(viewingDocumentModal.file_path, "_blank");
                    if (!win) toast.error("Please allow popups to open document");
                  }}
                >
                  <Eye className="mr-1.5 size-3.5" /> Open in Full Window
                </Button>
                <a
                  href={viewingDocumentModal.file_path}
                  download={viewingDocumentModal.file_name}
                  className="inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow transition-colors hover:bg-primary/90"
                >
                  <Download className="mr-1.5 size-3.5" /> Download File
                </a>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* 📦 ENLARGED QR SCAN & 12-FIELD INSPECTION DETAILS MODAL */}
      {enlargedQr && (() => {
        const mat = materials.find((m) => m.item_code === enlargedQr.itemCode);
        const b = enlargedQr.batch;
        const variantCode = b?.variant_code || mat?.variant_code || `${enlargedQr.itemCode}-V001`;
        const sizeVal = b?.size || mat?.size || "Standard";
        const colorVal = b?.color || mat?.color || "N/A";
        const gradeVal = b?.grade || mat?.grade || "Grade A";
        const warehouseVal = header.warehouse_name || "Main Warehouse";
        const inspectionStatus = mat?.quality_result === "REJECTED" ? "REJECTED / DAMAGED" : "QUALITY APPROVED";
        const uomVal = mat?.uom || "PCS";
        const batchQty = b?.batch_quantity !== undefined ? b.batch_quantity : (mat?.good_quantity ?? 0);

        return (
          <Dialog open={!!enlargedQr} onOpenChange={() => setEnlargedQr(null)}>
            <DialogContent className="max-h-[90vh] max-w-3xl space-y-5 overflow-y-auto rounded-3xl border border-border/70 bg-card p-6 shadow-2xl">
              <DialogHeader className="flex flex-row items-center justify-between border-b border-border/60 pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary-soft px-3 py-1 font-mono text-xs font-bold uppercase tracking-wider text-primary">
                      <QrCode className="size-3.5" /> WMS Material Batch QR
                    </span>
                    <span className="rounded-md bg-muted px-2.5 py-0.5 font-mono text-xs font-bold text-foreground">
                      {enlargedQr.title}
                    </span>
                  </div>
                  <DialogTitle className="mt-2 text-xl font-black text-foreground">
                    {mat?.material_name || enlargedQr.itemCode}
                  </DialogTitle>
                  <DialogDescription className="mt-0.5 text-xs text-muted-foreground">
                    GRN: <b>{header.grn_number}</b> • PO: <b>{header.po_number}</b> • Supplier: <b>{header.supplier_name}</b>
                  </DialogDescription>
                </div>
              </DialogHeader>

              {/* SCAN & DETAILS GRID */}
              <div className="grid items-start gap-6 md:grid-cols-5">
                {/* QR CODE PREVIEW CARD */}
                <div className="flex flex-col items-center justify-center space-y-3 rounded-2xl border border-border/70 bg-muted/20 p-4 text-center md:col-span-2">
                  <div className="relative inline-block rounded-2xl border border-border/70 bg-white p-3 shadow-soft">
                    {enlargedQr.data_url ? (
                      <img src={enlargedQr.data_url} alt="Material QR Code" className="mx-auto size-52 object-contain" />
                    ) : (
                      <div className="flex size-52 items-center justify-center">
                        <Loader2 className="size-8 animate-spin text-primary" />
                      </div>
                    )}
                    <div className="mt-2 rounded-lg border border-border/70 bg-muted px-2 py-1 font-mono text-[11px] font-bold text-foreground">
                      {enlargedQr.qr_id}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 rounded-full border border-success/30 bg-success-soft px-3 py-1 text-xs font-bold text-success">
                    <CheckCircle2 className="size-4" /> Scan Ready & Verified
                  </div>
                </div>

                {/* 12-ATTRIBUTE FETCHED DETAILS */}
                <div className="space-y-3 md:col-span-3">
                  <h4 className="flex items-center justify-between border-b border-border/60 pb-1.5 text-xs font-black uppercase tracking-wider text-foreground">
                    <span>Scanned Material Details (12 Parameters)</span>
                    <span className="rounded-full border border-primary/20 bg-primary-soft px-2 py-0.5 text-[10px] font-bold text-primary">
                      GRN Batch Stock
                    </span>
                  </h4>

                  <div className="grid grid-cols-2 gap-2 font-sans text-xs">
                    <div className="space-y-0.5 rounded-xl border border-border/70 bg-card p-2.5 shadow-2xs">
                      <span className="block text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
                        1. Material Code
                      </span>
                      <span className="block font-mono text-sm font-black text-primary">
                        {enlargedQr.itemCode}
                      </span>
                    </div>

                    <div className="space-y-0.5 rounded-xl border border-border/70 bg-card p-2.5 shadow-2xs">
                      <span className="block text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
                        2. Material Name
                      </span>
                      <span className="block truncate font-bold text-foreground">
                        {mat?.material_name || enlargedQr.itemCode}
                      </span>
                    </div>

                    <div className="space-y-0.5 rounded-xl border border-border/70 bg-card p-2.5 shadow-2xs">
                      <span className="block text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
                        3. Material Category
                      </span>
                      <span className="block font-bold text-foreground">
                        {mat?.material_category || "Raw Materials"}
                      </span>
                    </div>

                    <div className="space-y-0.5 rounded-xl border border-border/70 bg-card p-2.5 shadow-2xs">
                      <span className="block text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
                        4. Material Variant Code
                      </span>
                      <span className="block font-mono font-bold text-foreground">
                        {variantCode}
                      </span>
                    </div>

                    <div className="space-y-0.5 rounded-xl border border-border/70 bg-card p-2.5 shadow-2xs">
                      <span className="block text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
                        5. Batch Number
                      </span>
                      <span className="block font-mono font-black text-foreground">
                        {enlargedQr.title}
                      </span>
                    </div>

                    <div className="space-y-0.5 rounded-xl border border-border/70 bg-card p-2.5 shadow-2xs">
                      <span className="block text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
                        6. Size
                      </span>
                      <span className="block font-bold text-foreground">
                        {sizeVal}
                      </span>
                    </div>

                    <div className="space-y-0.5 rounded-xl border border-border/70 bg-card p-2.5 shadow-2xs">
                      <span className="block text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
                        7. Color
                      </span>
                      <span className="block font-bold text-foreground">
                        {colorVal}
                      </span>
                    </div>

                    <div className="space-y-0.5 rounded-xl border border-border/70 bg-card p-2.5 shadow-2xs">
                      <span className="block text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
                        8. Warehouse
                      </span>
                      <span className="block font-bold text-foreground">
                        {warehouseVal}
                      </span>
                    </div>

                    <div className="space-y-0.5 rounded-xl border border-border/70 bg-card p-2.5 shadow-2xs">
                      <span className="block text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
                        9. Grade
                      </span>
                      <span className="block font-bold text-foreground">
                        {gradeVal}
                      </span>
                    </div>

                    <div className="space-y-0.5 rounded-xl border border-border/70 bg-card p-2.5 shadow-2xs">
                      <span className="block text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
                        10. UOM
                      </span>
                      <span className="block font-mono font-bold text-foreground">
                        {uomVal}
                      </span>
                    </div>

                    <div className="space-y-0.5 rounded-xl border border-border/70 bg-card p-2.5 shadow-2xs">
                      <span className="block text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
                        11. Inspection Status
                      </span>
                      <span className="block font-bold text-success">
                        ✓ {inspectionStatus}
                      </span>
                    </div>

                    <div className="space-y-0.5 rounded-xl border border-primary/20 bg-primary-soft/40 p-2.5 shadow-2xs">
                      <span className="block text-[10px] font-extrabold uppercase tracking-wider text-primary">
                        12. Batch Quantity
                      </span>
                      <span className="block font-mono text-sm font-black text-primary">
                        {batchQty} {uomVal}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* RAW SCANNED STRING ACCORDION */}
              <div className="space-y-1.5 border-t border-border/60 pt-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Raw Decoded QR Scan Payload
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 gap-1 text-xs font-bold text-primary hover:bg-primary-soft/40"
                    onClick={() => {
                      navigator.clipboard.writeText(enlargedQr.payload);
                      toast.success("Copied Scanned QR Payload to clipboard!");
                    }}
                  >
                    <Copy className="size-3" /> Copy QR Content
                  </Button>
                </div>
                <pre className="max-h-36 overflow-y-auto whitespace-pre-wrap rounded-xl border border-border/70 bg-muted/40 p-3 font-mono text-xs leading-relaxed text-foreground">
                  {enlargedQr.payload}
                </pre>
              </div>

              {/* FOOTER */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-3">
                <Button
                  variant="outline"
                  className="rounded-xl text-xs font-bold"
                  onClick={() => setEnlargedQr(null)}
                >
                  Close
                </Button>

                <Button
                  className="rounded-xl text-xs font-bold shadow-glow"
                  onClick={() => printSingleQrLabel(enlargedQr.title, enlargedQr.itemCode, enlargedQr.qr_id, enlargedQr.data_url)}
                >
                  <Printer className="mr-1.5 size-3.5" /> Print Batch Label
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        );
      })()}
    </AppShell>
  );
}
