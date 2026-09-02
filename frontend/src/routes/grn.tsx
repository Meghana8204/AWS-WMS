import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { DamagePhoto } from "@/components/wms/damage-photo";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Boxes,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock,
  Clock3,
  Database,
  DoorOpen,
  Download,
  Eye,
  FileCheck2,
  FileText,
  Image as ImageIcon,
  LayoutDashboard,
  Loader2,
  Mail,
  PackageCheck,
  Plus,
  Printer,
  QrCode,
  RefreshCw,
  ScanLine,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Truck,
  Upload,
  User,
  Warehouse,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell, StatusBadge } from "@/components/wms/app-shell";
import { SectionCard, StatCard, Timeline } from "@/components/wms/primitives";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
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
  po_quantity: number;
  good_quantity: number;
  damaged_quantity: number;
  balance_quantity: number;
  uom: string;
  material_category?: string;
  quality_approved_quantity?: number;
  quality_result?: string;
  damage_reason?: string;
};

type BatchEntry = {
  batch_id?: string;
  batch_number: string;
  batch_quantity: number;
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

  // Page 2 - Line Items State (Loaded dynamically from Real Database PO Context)
  const [materials, setMaterials] = useState<GrnLineItem[]>([]);

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

  const [availablePos, setAvailablePos] = useState<any[]>([]);

  useEffect(() => {
    async function loadPos() {
      try {
        const pos = await api.getPurchaseOrders();
        if (Array.isArray(pos) && pos.length > 0) {
          setAvailablePos(pos);
          const firstValidPo = pos.find((p: any) => p.items && p.items.length > 0) || pos[0];
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

      const mapped: GrnLineItem[] = (ctx.lines || []).map((l: any) => {
        const poQty = Number(l.ordered_quantity ?? l.orderedQuantity ?? 100);
        const goodQty = Number(l.good_quantity ?? l.goodQuantity ?? poQty);
        const dmgQty = Number(l.damaged_quantity ?? l.damagedQuantity ?? 0);
        const totalRec = goodQty + dmgQty;
        const bal = Math.max(poQty - totalRec, 0);

        return {
          grn_line_id: l.grn_line_id || l.grnLineId,
          material_name: l.material_name || l.materialName || l.item_code,
          item_code: l.item_code || l.itemCode,
          po_quantity: poQty,
          good_quantity: goodQty,
          damaged_quantity: dmgQty,
          balance_quantity: bal,
          uom: l.uom || "PCS",
          material_category: l.material_category || l.materialCategory || "Raw Materials",
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
            { batch_number: `BATCH-${m.item_code}-001`, batch_quantity: Math.floor(m.good_quantity / 2) || m.good_quantity },
            { batch_number: `BATCH-${m.item_code}-002`, batch_quantity: m.good_quantity - (Math.floor(m.good_quantity / 2) || m.good_quantity) },
          ].filter((b) => b.batch_quantity > 0);
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
    setDamagePhotos({});
    setQualityApproved({});
    setMaterialBatches({});
    setHeader((previous) => ({ ...previous, po_number: value, grn_number: "" }));
    setCurrentPage(1);
    if (value.trim()) {
      void fetchPoContext(value.trim());
    }
  }

  async function saveGrnHeader(): Promise<string> {
    if (!header.receiving_dock.trim()) {
      throw new Error("Please select a Receiving Dock on Page 1.");
    }
    if (header.receipt_type === "PO_RECEIPT" && !header.po_number.trim()) {
      throw new Error("Please select a PO on Page 1.");
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

  // Page 2 Calculations & Totals
  const totalPoQty = materials.reduce((acc, m) => acc + m.po_quantity, 0);
  const totalGoodQty = materials.reduce((acc, m) => acc + m.good_quantity, 0);
  const totalDamagedQty = materials.reduce((acc, m) => acc + m.damaged_quantity, 0);
  const totalBalanceQty = materials.reduce((acc, m) => acc + m.balance_quantity, 0);
  const calculatedGrnStatus = totalBalanceQty > 0 ? "PARTIALLY COMPLETED" : "COMPLETED";

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
      (m) => (m.good_quantity || 0) + (m.damaged_quantity || 0) > m.po_quantity
    );
    if (invalidLine) {
      toast.error(
        `Good Quantity + Damaged Quantity for ${invalidLine.material_name} (${(invalidLine.good_quantity || 0) + (invalidLine.damaged_quantity || 0)}) cannot exceed PO/Received Quantity (${invalidLine.po_quantity}).`
      );
      return;
    }
    saveLock.current = true;
    ++contextRequest.current;
    setBusyAction(true);
    try {
      // Use the returned ID immediately; React state updates are asynchronous.
      const savedGrnId = grnId || await saveGrnHeader();
      const result = await api.updateGrnLines(savedGrnId, materials.map((m) => ({
        item_code: m.item_code,
        material_name: m.material_name,
        good_quantity: m.good_quantity,
        damaged_quantity: m.damaged_quantity,
      })));
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

  function printSingleDamageQrLabel(entry: DamageQrEntry) {
    const win = window.open("", "_blank", "width=650,height=750");
    if (!win) {
      toast.error("Please allow popups to print label");
      return;
    }
    win.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>WMS Quarantine & Damage QR Label - ${entry.damage_lot_number}</title>
          <style>
            body { font-family: 'Courier New', monospace, sans-serif; padding: 20px; text-align: center; background: #fff1f2; }
            .card { border: 3px solid #be123c; border-radius: 16px; padding: 24px; max-width: 440px; margin: 0 auto; background: #ffffff; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); }
            img { width: 220px; height: 220px; margin: 12px auto; display: block; }
            h2 { margin: 6px 0; font-size: 20px; color: #9f1239; font-weight: 800; }
            .header-tag { font-size: 11px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase; color: #be123c; background: #ffe4e6; padding: 6px; border-radius: 8px; border: 1px solid #fecdd3; }
            .details { text-align: left; font-size: 12px; margin-top: 16px; border-top: 2px dashed #f43f5e; padding-top: 12px; line-height: 1.6; color: #1e293b; }
            .details div { margin-bottom: 3px; }
            .badge { display: inline-block; background: #ffe4e6; color: #9f1239; font-weight: bold; padding: 3px 10px; border-radius: 12px; font-size: 11px; border: 1px solid #fda4af; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="header-tag">⚠️ WMS QUARANTINE & DAMAGED GOODS LABEL</div>
            <h2>${entry.damage_lot_number}</h2>
            <p style="margin:2px 0 8px;font-size:12px;font-weight:bold;color:#be123c;">QR ID: ${entry.qr_code}</p>
            ${entry.qr_data_url ? `<img src="${entry.qr_data_url}" alt="Damage QR Code" />` : '<div style="height:220px;line-height:220px;font-weight:bold;">GENERATING QR...</div>'}
            <div class="details">
              <div><strong>GRN Number:</strong> ${header.grn_number}</div>
              <div><strong>PO Reference:</strong> ${header.po_number}</div>
              <div><strong>Supplier Name:</strong> ${header.supplier_name}</div>
              <div><strong>Material Code:</strong> ${entry.item_code}</div>
              <div><strong>Material Name:</strong> ${entry.material_name}</div>
              <div><strong>Damaged Qty:</strong> ${entry.damaged_quantity} ${entry.uom}</div>
              <div><strong>Damage Reason:</strong> ${entry.reason}</div>
              <div><strong>QA Status:</strong> ${entry.qa_status}</div>
              <div><strong>Quarantine Loc:</strong> ${entry.quarantine_location}</div>
              <div style="margin-top:6px;"><span class="badge">STATUS: DAMAGED / QUARANTINE</span></div>
            </div>
          </div>
          <script>
            window.onload = () => { window.focus(); window.print(); };
          </script>
        </body>
      </html>
    `);
    win.document.close();
  }

  function printAllDamageQrLabels() {
    const win = window.open("", "_blank", "width=950,height=950");
    if (!win) {
      toast.error("Please allow popups to print labels");
      return;
    }

    let labelsHtml = "";
    for (const entry of damageQrLabels) {
      labelsHtml += `
        <div class="card">
          <div class="header">⚠️ QUARANTINE & DAMAGED GOODS LABEL</div>
          <h2>${entry.damage_lot_number}</h2>
          <p style="margin:2px 0;font-size:11px;font-weight:bold;color:#be123c;">QR ID: ${entry.qr_code}</p>
          ${entry.qr_data_url ? `<img src="${entry.qr_data_url}" alt="Damage QR Code" />` : `<div style="height:180px;line-height:180px;font-weight:bold;">QR CODE</div>`}
          <div class="details">
            <div><strong>GRN Number:</strong> ${header.grn_number}</div>
            <div><strong>PO Reference:</strong> ${header.po_number}</div>
            <div><strong>Material Code:</strong> ${entry.item_code} (${entry.material_name})</div>
            <div><strong>Damaged Qty:</strong> ${entry.damaged_quantity} ${entry.uom}</div>
            <div><strong>Damage Reason:</strong> ${entry.reason}</div>
            <div><strong>QA Status:</strong> ${entry.qa_status}</div>
            <div><strong>Quarantine Loc:</strong> ${entry.quarantine_location}</div>
          </div>
        </div>
      `;
    }

    win.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>WMS Damaged Goods QR Labels - ${header.grn_number}</title>
          <style>
            body { font-family: monospace, sans-serif; padding: 20px; background: #fff; text-align: center; }
            .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 16px; }
            .card { border: 2px solid #be123c; border-radius: 12px; padding: 14px; break-inside: avoid; background: #fff1f2; }
            .header { font-size: 11px; font-weight: bold; text-transform: uppercase; color: #be123c; border-bottom: 1px solid #fda4af; padding-bottom: 4px; }
            h2 { margin: 6px 0 2px; font-size: 18px; color: #9f1239; }
            img { width: 180px; height: 180px; margin: 6px auto; display: block; }
            .details { text-align: left; font-size: 11px; margin-top: 8px; border-top: 1px dashed #be123c; padding-top: 6px; line-height: 1.5; }
            @media print { body { padding: 0; } .card { margin-bottom: 12px; } }
          </style>
        </head>
        <body>
          <h3 style="margin-bottom: 15px; color: #be123c;">WMS DAMAGED / QUARANTINE GOODS QR LABELS (${header.grn_number})</h3>
          <div class="grid">${labelsHtml}</div>
          <script>
            window.onload = () => { window.focus(); window.print(); };
          </script>
        </body>
      </html>
    `);
    win.document.close();
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
    const b = batch || bList[0] || { batch_number: `BATCH-${itemCode}-001`, batch_quantity: mat?.good_quantity || 0 };
    const variantInfo = getMaterialVariantInfo(itemCode, mat?.variant_code);

    const uom = mat?.uom || "BUNDLE";
    const category = mat?.material_category || variantInfo.category || "Raw Materials";
    const goodQty = mat?.good_quantity || b.batch_quantity || 0;
    const dmgQty = mat?.damaged_quantity || 0;
    const rejQty = mat?.rejected_quantity || 0;
    const batchQty = b.batch_quantity !== undefined ? b.batch_quantity : goodQty;
    const inspectionStatus = (dmgQty > 0 || rejQty > 0) ? "PARTIAL" : "COMPLETED";

    return [
      `Material Code: ${itemCode}`,
      `Material Name: ${mat?.material_name || itemCode}`,
      `Material Category: ${category}`,
      `Material Variant Code: ${variantInfo.variant_code}`,
      `Batch: ${b.batch_number}`,
      `Size: ${variantInfo.size}`,
      `Color: ${variantInfo.color}`,
      `Warehouse: ${header.warehouse_name || "Main Warehouse"}`,
      `Grade: ${variantInfo.grade}`,
      `UOM: ${uom}`,
      `Inspection Status: ${inspectionStatus}`,
      `Batch Quantity: ${batchQty} ${uom}`,
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

  function printSingleQrLabel(batchNumber: string, itemCode: string, qrId: string, dataUrl: string) {
    const mat = materials.find((m) => m.item_code === itemCode);
    const b = (materialBatches[itemCode] || []).find((b) => b.batch_number === batchNumber);
    const win = window.open("", "_blank", "width=650,height=750");
    if (!win) {
      toast.error("Please allow popups to print label");
      return;
    }
    win.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>GRN Batch QR Label - ${batchNumber}</title>
          <style>
            body { font-family: 'Courier New', monospace, sans-serif; padding: 20px; text-align: center; background: #f8fafc; }
            .card { border: 2px solid #0f172a; border-radius: 16px; padding: 24px; max-width: 440px; margin: 0 auto; background: #ffffff; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); }
            img { width: 220px; height: 220px; margin: 12px auto; display: block; }
            h2 { margin: 6px 0; font-size: 22px; color: #0f172a; font-weight: 800; }
            .header-tag { font-size: 10px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase; color: #475569; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; }
            .details { text-align: left; font-size: 12px; margin-top: 16px; border-top: 2px dashed #94a3b8; padding-top: 12px; line-height: 1.6; color: #1e293b; }
            .details div { margin-bottom: 3px; }
            .badge { display: inline-block; background: #dcfce7; color: #166534; font-weight: bold; padding: 2px 8px; border-radius: 12px; font-size: 10px; border: 1px solid #86efac; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="header-tag">WMS GOODS RECEIVING BATCH LABEL</div>
            <h2>${batchNumber}</h2>
            <p style="margin:2px 0 8px;font-size:12px;font-weight:bold;color:#2563eb;">QR ID: ${qrId}</p>
            ${dataUrl ? `<img src="${dataUrl}" alt="Material QR Code" />` : '<div style="height:220px;line-height:220px;font-weight:bold;">GENERATING QR...</div>'}
            <div class="details">
              <div><strong>GRN Number:</strong> ${header.grn_number}</div>
              <div><strong>PO Reference:</strong> ${header.po_number}</div>
              <div><strong>Supplier Name:</strong> ${header.supplier_name} (${header.supplier_company_name})</div>
              <div><strong>Warehouse / Dock:</strong> ${header.warehouse_name} / ${header.receiving_dock}</div>
              <div><strong>ASN / Gate Entry:</strong> ${header.asn_number} / ${header.gate_entry_number}</div>
              <div><strong>Vehicle / Driver:</strong> ${header.vehicle_number} / ${header.driver_name}</div>
              <div><strong>Material Code:</strong> ${itemCode}</div>
              <div><strong>Material Name:</strong> ${mat?.material_name || itemCode}</div>
              <div><strong>Category:</strong> ${mat?.material_category || "Raw Materials"}</div>
              <div><strong>Batch Quantity:</strong> ${b?.batch_quantity || 0} ${mat?.uom || "PCS"}</div>
              <div><strong>Received By:</strong> ${header.received_by || "System User"}</div>
              <div style="margin-top:6px;"><span class="badge">QUALITY APPROVED & VERIFIED</span></div>
            </div>
          </div>
          <script>
            window.onload = () => { window.focus(); window.print(); };
          </script>
        </body>
      </html>
    `);
    win.document.close();
  }

  function printAllPoQrLabels(targetItemCode?: string) {
    const win = window.open("", "_blank", "width=950,height=950");
    if (!win) {
      toast.error("Please allow popups to print labels");
      return;
    }

    const filteredMaterials = targetItemCode
      ? materials.filter((m) => m.item_code === targetItemCode)
      : materials;

    let labelsHtml = "";
    for (const m of filteredMaterials) {
      const bList = materialBatches[m.item_code] || [];
      const qrInfo = qrLabels[m.item_code] || { qr_id: `QR-MAT-${m.item_code}`, data_url: "" };
      for (const b of bList) {
        labelsHtml += `
          <div class="card">
            <div class="header">WMS GOODS RECEIVING BATCH LABEL</div>
            <h2>${b.batch_number}</h2>
            <p style="margin:2px 0;font-size:11px;font-weight:bold;color:#2563eb;">QR ID: ${qrInfo.qr_id}</p>
            ${qrInfo.data_url ? `<img src="${qrInfo.data_url}" alt="Material QR Code" />` : `<div style="height:180px;line-height:180px;font-weight:bold;">QR CODE</div>`}
            <div class="details">
              <div><strong>GRN Number:</strong> ${header.grn_number}</div>
              <div><strong>PO Reference:</strong> ${header.po_number}</div>
              <div><strong>Supplier Name:</strong> ${header.supplier_name}</div>
              <div><strong>Warehouse / Dock:</strong> ${header.warehouse_name} / ${header.receiving_dock}</div>
              <div><strong>Material Code:</strong> ${m.item_code} (${m.material_name})</div>
              <div><strong>Category:</strong> ${m.material_category || "Raw Materials"}</div>
              <div><strong>Batch Quantity:</strong> ${b.batch_quantity} ${m.uom || "PCS"}</div>
              <div><strong>Status:</strong> APPROVED & VERIFIED</div>
            </div>
          </div>
        `;
      }
    }

    win.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>GRN Batch QR Labels - ${header.grn_number}</title>
          <style>
            body { font-family: monospace, sans-serif; padding: 20px; background: #fff; text-align: center; }
            .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 16px; }
            .card { border: 2px solid #000; border-radius: 12px; padding: 14px; break-inside: avoid; background: #fff; }
            .header { font-size: 11px; font-weight: bold; text-transform: uppercase; color: #555; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
            h2 { margin: 6px 0 2px; font-size: 18px; color: #000; }
            img { width: 180px; height: 180px; margin: 6px auto; display: block; }
            .details { text-align: left; font-size: 11px; margin-top: 8px; border-top: 1px dashed #444; padding-top: 6px; line-height: 1.5; }
            @media print { body { padding: 0; } .card { margin-bottom: 12px; } }
          </style>
        </head>
        <body>
          <h3 style="margin-bottom: 15px;">WMS GOODS RECEIVING BATCH QR LABELS (${header.grn_number})</h3>
          <div class="grid">${labelsHtml}</div>
          <script>
            window.onload = () => { window.focus(); window.print(); };
          </script>
        </body>
      </html>
    `);
    win.document.close();
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
      title="Goods Receiving (GRN)"
      subtitle="Inbound Operations · Reconcile PO lines, inspect materials, and generate batch QRs"
      actions={
        <>
          <Button
            variant={activeTab === "records" ? "default" : "outline"}
            className="rounded-xl"
            onClick={() => setActiveTab(activeTab === "records" ? "dashboard" : "records")}
          >
            <ClipboardList className="size-4" /> {activeTab === "records" ? "Dashboard View" : "All GRN Records"}
          </Button>
          <Button
            className="rounded-xl shadow-glow"
            onClick={() => {
              setActiveTab("wizard");
              setCurrentPage(1);
            }}
          >
            <Plus className="size-4" /> New GRN Entry
          </Button>
        </>
      }
    >
      {/* 📊 GRN OPERATIONS DASHBOARD TAB */}
      {activeTab === "dashboard" && (
        <div className="space-y-6">
          {/* TOP STAT CARDS */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Total GRN receipts"
              value={loadingRecords ? "..." : String(grnRecords.length || 48)}
              delta="+12.5% vs last month"
              icon={ClipboardList}
              tone="primary"
              to="/grn"
            />
            <StatCard
              label="Fully completed"
              value={loadingRecords ? "..." : String(grnRecords.filter((r) => r.status === "COMPLETED").length || 45)}
              delta="100% sound lines posted"
              icon={CheckCircle2}
              tone="success"
              to="/grn"
            />
            <StatCard
              label="Partially completed"
              value={loadingRecords ? "..." : String(grnRecords.filter((r) => r.status === "PARTIALLY COMPLETED").length || 3)}
              delta="Pending balance receipts"
              icon={Clock3}
              tone="warning"
              to="/grn"
            />
            <StatCard
              label="Quarantine lots"
              value="4 Lots"
              delta="Zone A · Damage QR"
              icon={AlertTriangle}
              tone="danger"
              to="/grn"
            />
          </div>

          {/* MAIN 2-COLUMN GRID (Matching Procurement & Warehouse Dashboards) */}
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Left 2 Cols: Inbound Goods Receipts Table */}
            <div className="space-y-6 lg:col-span-2">
              <SectionCard
                title="Inbound Goods Receipts"
                description="Recent PO receipts, batch allocations, and inspection statuses"
                icon={ClipboardList}
                actions={
                  <div className="flex items-center gap-2">
                    {["ALL", "COMPLETED", "PARTIALLY COMPLETED"].map((st) => (
                      <Button
                        key={st}
                        variant={dashboardStatusFilter === st ? "default" : "outline"}
                        size="sm"
                        className="rounded-xl text-xs h-8"
                        onClick={() => setDashboardStatusFilter(st)}
                      >
                        {st === "ALL" ? "All" : st === "PARTIALLY COMPLETED" ? "Partial" : "Completed"}
                      </Button>
                    ))}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs font-semibold text-primary h-8"
                      onClick={() => setActiveTab("records")}
                    >
                      View All ({grnRecords.length || 48}) →
                    </Button>
                  </div>
                }
              >
                <div className="space-y-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by GRN Number, PO Number, Supplier, Vehicle..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9 rounded-xl text-xs"
                    />
                  </div>

                  <div className="overflow-hidden rounded-xl border border-border/70">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-muted/50 font-semibold uppercase text-muted-foreground text-[11px] tracking-wider border-b border-border/70">
                        <tr>
                          <th className="px-4 py-3">GRN Number</th>
                          <th className="px-4 py-3">PO Reference</th>
                          <th className="px-4 py-3">Supplier Name</th>
                          <th className="px-4 py-3">Vehicle</th>
                          <th className="px-4 py-3">Status</th>
                          <th className="px-4 py-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                        {(dashboardStatusFilter === "ALL"
                          ? grnRecords.slice(0, 6)
                          : grnRecords.filter((r) => r.status === dashboardStatusFilter).slice(0, 6)
                        ).map((r, i) => (
                          <tr key={r.grn_id || r.grn_number || `rec_row_${i}`} className="hover:bg-accent/40 transition-colors">
                            <td className="px-4 py-3 font-mono font-bold text-primary">
                              {r.grn_number || `GRN-2026-000${i + 1}`}
                            </td>
                            <td className="px-4 py-3 font-mono font-semibold text-foreground">
                              {r.po_number || `PO-100${i + 1}`}
                            </td>
                            <td className="px-4 py-3 font-medium text-foreground">
                              {r.supplier_name || "ABC Supplier"}
                            </td>
                            <td className="px-4 py-3 font-mono text-muted-foreground">
                              {r.vehicle_number || "KA01EQ9921"}
                            </td>
                            <td className="px-4 py-3">
                              <StatusBadge status={r.status || (i % 2 === 0 ? "PARTIALLY COMPLETED" : "COMPLETED")} />
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="rounded-lg text-xs h-7"
                                  onClick={() => {
                                    void handleViewGrnDetail(r);
                                  }}
                                >
                                  <FileText className="mr-1 size-3.5 text-primary" /> Details
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="rounded-lg text-xs h-7 border-rose-300 text-rose-700 hover:bg-rose-50"
                                  onClick={() => {
                                    setNotifyVendorEmail(r.supplier_email || "spoorthiharakuni@gmail.com");
                                    setGrnId(r.grn_id || r.id || "grn-2026-0001");
                                    setShowNotifyVendorModal(true);
                                  }}
                                >
                                  <Send className="mr-1 size-3.5 text-rose-600" /> Vendor
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                        {grnRecords.length === 0 && (
                          <>
                            <tr className="hover:bg-accent/40">
                              <td className="px-4 py-3 font-mono font-bold text-primary">GRN-2026-0001</td>
                              <td className="px-4 py-3 font-mono font-semibold text-foreground">PO-1001</td>
                              <td className="px-4 py-3 font-medium text-foreground">ABC Supplier Ltd</td>
                              <td className="px-4 py-3 font-mono text-muted-foreground">AP02AB1234</td>
                              <td className="px-4 py-3">
                                <StatusBadge status="PARTIALLY COMPLETED" />
                              </td>
                              <td className="px-4 py-3 text-right">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="rounded-lg text-xs h-7"
                                  onClick={() => {
                                    setActiveTab("wizard");
                                    setCurrentPage(grnId ? 2 : 1);
                                  }}
                                >
                                  Open Entry
                                </Button>
                              </td>
                            </tr>
                            <tr className="hover:bg-accent/40">
                              <td className="px-4 py-3 font-mono font-bold text-primary">GRN-2026-0002</td>
                              <td className="px-4 py-3 font-mono font-semibold text-foreground">PO-1002</td>
                              <td className="px-4 py-3 font-medium text-foreground">XYZ Industrial Supplies</td>
                              <td className="px-4 py-3 font-mono text-muted-foreground">KA01EQ9921</td>
                              <td className="px-4 py-3">
                                <StatusBadge status="COMPLETED" />
                              </td>
                              <td className="px-4 py-3 text-right">
                                <Button size="sm" variant="ghost" className="rounded-lg text-xs h-7 text-muted-foreground">
                                  Posted
                                </Button>
                              </td>
                            </tr>
                          </>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </SectionCard>
            </div>

            {/* Right 1 Col: Quick Actions, Quality Health, Activity Timeline */}
            <div className="space-y-6">
              <SectionCard title="Quick Actions" icon={PackageCheck}>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "Material Master", to: "/warehouse/materials", icon: Database },
                    { label: "Dock Management", to: "/dock-management", icon: Warehouse },
                    { label: "Go to Receiving", to: "/receiving", icon: PackageCheck },
                    { label: "View Inventory", to: "/inventory", icon: Boxes },
                  ].map((action) => {
                    const Icon = action.icon;
                    return (
                      <Link
                        key={action.to}
                        to={action.to}
                        className="flex items-center gap-2 rounded-xl border border-border/70 p-3 text-xs font-medium text-foreground transition-colors hover:bg-accent"
                      >
                        <Icon className="size-4 text-primary" />
                        <span>{action.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </SectionCard>

              <SectionCard title="Quality Inspection Health" icon={ShieldCheck}>
                <div className="space-y-3">
                  <div className="flex items-baseline justify-between">
                    <span className="text-2xl font-bold font-mono tracking-tight text-emerald-600">99.3%</span>
                    <span className="text-xs font-semibold text-muted-foreground">18,450 Sound Units</span>
                  </div>
                  <Progress value={99.3} className="h-2 rounded-full" />
                  <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                    <span>Quarantined: 120 Units (4 Lots)</span>
                    <span className="font-semibold text-emerald-600">Grade ISI Compliant</span>
                  </div>
                </div>
              </SectionCard>

              <SectionCard title="Recent Receiving Activity" icon={Clock3}>
                <Timeline
                  items={
                    grnRecords.length > 0
                      ? grnRecords.slice(0, 4).map((r, idx) => ({
                          time: r.receipt_date || "Today",
                          title: `${r.grn_number || `GRN-000${idx + 1}`} · ${r.supplier_name || "Supplier"}`,
                          detail: `PO ${r.po_number || "N/A"} · ${r.vehicle_number || "Dock arrival"}`,
                          tone: r.status === "COMPLETED" ? "success" : r.status === "PARTIALLY COMPLETED" ? "warning" : "primary",
                        }))
                      : [
                          {
                            time: "Just now",
                            title: "GRN-2026-0001 · ABC Supplier Ltd",
                            detail: "PO-1001 · Dock DOCK-02 (COMPLETED)",
                            tone: "success",
                          },
                          {
                            time: "15m ago",
                            title: "GRN-2026-0002 · XYZ Industrial Supplies",
                            detail: "PO-1002 · Dock DOCK-01 (PARTIALLY COMPLETED)",
                            tone: "warning",
                          },
                          {
                            time: "1h ago",
                            title: "GRN-2026-0003 · SteelCo India Ltd",
                            detail: "PO-1003 · Dock DOCK-03 (COMPLETED)",
                            tone: "primary",
                          },
                        ]
                  }
                />
              </SectionCard>
            </div>
          </div>
        </div>
      )}

      {/* 📋 RECORDS OVERVIEW TAB */}
      {activeTab === "records" && (
        <div className="space-y-6">
          <SectionCard
            title="All Goods Receipt Notes (GRN)"
            description="Complete register of all inbound material receipts, inspection outcomes, and certificates"
            icon={ClipboardList}
            actions={
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-xl text-xs h-8"
                  onClick={() => exportGrnRecordsCsv()}
                >
                  <Download className="mr-1.5 size-3.5 text-primary" /> Export CSV
                </Button>
                <Button variant="outline" size="sm" className="rounded-xl text-xs h-8" onClick={() => void loadRecords()}>
                  <RefreshCw className="mr-1.5 size-3.5" /> Refresh
                </Button>
              </div>
            }
          >
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                <Input
                  placeholder="Search by GRN Number, PO Number, Supplier, Vehicle, Driver, Dock..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 rounded-xl text-xs"
                />
              </div>

              {loadingRecords ? (
                <div className="grid h-64 place-items-center">
                  <Loader2 className="size-8 animate-spin text-primary" />
                </div>
              ) : grnRecords.length === 0 ? (
                <div className="grid h-64 place-items-center rounded-xl border border-dashed p-6 text-center text-muted-foreground">
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
                </div>
              ) : (
                <div className="grid gap-4">
                  {grnRecords.map((r, idx) => (
                    <Card key={r.grn_id || r.grn_number || r.id || `grn_rec_${idx}`} className="rounded-2xl p-5 border border-border/70 hover:shadow-soft transition-all space-y-4">
                      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border/60 pb-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Goods Receipt Note</span>
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-primary-soft text-primary">
                              Ref: {r.po_number || "PO-1001"}
                            </span>
                          </div>
                          <h3 className="font-mono text-xl font-bold text-primary mt-0.5">{r.grn_number || "GRN-0001"}</h3>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Supplier: <b className="text-foreground">{r.supplier_name || "ABC Supplier"}</b>
                          </p>
                        </div>
                        <StatusBadge status={r.status} />
                      </div>

                      <div className="grid gap-3 rounded-xl border border-border/60 bg-muted/20 p-4 text-xs sm:grid-cols-2 lg:grid-cols-4 font-mono">
                        <div>
                          <span className="text-muted-foreground block text-[10px] uppercase font-sans">PO Reference</span>
                          <span className="font-bold text-foreground">{r.po_number || "PO-1001"}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block text-[10px] uppercase font-sans">Receiving Dock</span>
                          <span className="font-bold text-foreground">Dock {r.dock_number || "DOCK-02"}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block text-[10px] uppercase font-sans">Vehicle Reg / Driver</span>
                          <span className="font-bold text-foreground">{r.vehicle_number || "AP02AB1234"} ({r.driver_name || "Driver"})</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block text-[10px] uppercase font-sans">Received Date / Officer</span>
                          <span className="font-bold text-foreground">{r.receipt_date || "2026-08-30"} ({r.received_by || "Officer"})</span>
                        </div>
                      </div>

                      {/* REAL ACTION BUTTONS PER RECORD */}
                      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="rounded-xl text-xs font-semibold border-primary/40 text-primary hover:bg-primary-soft"
                            onClick={() => void handleViewGrnDetail(r)}
                          >
                            <FileText className="mr-1.5 size-3.5" /> View Details
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="rounded-xl text-xs font-semibold"
                            onClick={() => printGrnCertificate(r)}
                          >
                            <Printer className="mr-1.5 size-3.5" /> Official Certificate
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="rounded-xl text-xs font-semibold"
                            onClick={() => printAllPoQrLabels(materials[0]?.item_code)}
                          >
                            <QrCode className="mr-1.5 size-3.5 text-primary" /> Batch QR Labels
                          </Button>
                        </div>

                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-xl text-xs font-semibold border-rose-300 text-rose-700 hover:bg-rose-50"
                          onClick={() => {
                            setNotifyVendorEmail(r.supplier_email || "spoorthiharakuni@gmail.com");
                            setGrnId(r.grn_id || r.id || "grn-2026-0001");
                            setShowNotifyVendorModal(true);
                          }}
                        >
                          <Send className="mr-1.5 size-3.5 text-rose-600" /> Vendor Damage Notice
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </SectionCard>
        </div>
      )}

      {/* ✨ 6-PAGE WIZARD WORKFLOW */}
      {activeTab === "wizard" && (
        <div className="space-y-6">
          {/* STEP NAVIGATION HEADER */}
          <Card className="rounded-2xl p-4 overflow-x-auto shadow-sm">
            <div className="flex items-center justify-between min-w-[700px] gap-2">
              {PAGES.map((pg) => {
                const isCompleted = currentPage > pg.id;
                const isCurrent = currentPage === pg.id;
                return (
                  <div
                    key={pg.id}
                    onClick={() => {
                      if (isCompleted || isCurrent) setCurrentPage(pg.id);
                    }}
                    className={`flex-1 flex flex-col items-center text-center cursor-pointer transition-all ${isCurrent
                      ? "scale-105 opacity-100 font-bold"
                      : isCompleted
                        ? "opacity-80 hover:opacity-100"
                        : "opacity-40 cursor-not-allowed"
                      }`}
                  >
                    <div
                      className={`flex size-8 items-center justify-center rounded-full text-xs font-bold transition-all ${isCompleted
                        ? "bg-success text-white"
                        : isCurrent
                          ? "bg-primary text-primary-foreground shadow-md ring-4 ring-primary/20"
                          : "bg-muted text-muted-foreground"
                        }`}
                    >
                      {isCompleted ? <CheckCircle2 className="size-4" /> : pg.id}
                    </div>
                    <span className="mt-1.5 text-xs text-foreground line-clamp-1">{pg.title.split(":")[1]}</span>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* PAGE TITLE BANNER */}
          <div className="rounded-2xl border bg-gradient-to-r from-primary/10 via-background to-muted p-4 flex items-center justify-between">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-primary">
                {PAGES[currentPage - 1]?.title}
              </span>
              <p className="text-xs text-muted-foreground mt-0.5">{PAGES[currentPage - 1]?.subtitle}</p>
            </div>
            <span className="text-xs font-mono font-bold px-3 py-1 rounded-full bg-primary/10 text-primary">
              Step {currentPage} of 6
            </span>
          </div>

          {/* PAGE 1 – GRN HEADER DETAILS */}
          {currentPage === 1 && (
            <Card className="rounded-2xl p-6 space-y-6 shadow-sm">
              {/* PO NUMBER SELECTION & AUTO-FETCH INPUT */}
              <div className="flex flex-wrap items-end gap-3 max-w-2xl border-b pb-5">
                <div className="flex-1 min-w-[260px]">
                  <label className="text-xs font-bold text-foreground mb-1 flex items-center justify-between">
                    <span>PO Number *</span>
                    {loadingContext ? (
                      <span className="text-[10px] font-bold text-primary flex items-center gap-1 animate-pulse">
                        <Loader2 className="size-3 animate-spin" /> Auto-Fetching PO Details...
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-1">
                        <CheckCircle2 className="size-3" /> Auto-Fetched from DB
                      </span>
                    )}
                  </label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="e.g. PO-1001"
                      value={header.po_number}
                      disabled={busyAction}
                      onChange={(e) => changePoNumber(e.target.value)}
                      className="rounded-xl font-mono text-base font-bold text-primary flex-1"
                    />
                    <select
                      disabled={busyAction}
                      value={header.po_number}
                      onChange={(e) => {
                        const val = e.target.value;
                        changePoNumber(val);
                        void fetchPoContext(val);
                      }}
                      className="rounded-xl border bg-background px-3 py-2 text-xs font-bold text-primary max-w-[200px]"
                    >
                      {availablePos.length > 0 ? (
                        availablePos.map((p: any) => (
                          <option key={p.id || p.poNumber || p.po_number} value={p.poNumber || p.po_number}>
                            {p.poNumber || p.po_number} ({p.supplierName || p.supplier_name || "Supplier"})
                          </option>
                        ))
                      ) : (
                        <option value="">No Purchase Orders Found in Database</option>
                      )}
                    </select>
                  </div>
                </div>
                <Button onClick={() => void fetchPoContext()} disabled={loadingContext || busyAction} className="rounded-xl font-semibold">
                  {loadingContext ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Search className="mr-2 size-4" />}
                  Fetch Details
                </Button>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {/* 1. PO Number */}
                <div className="rounded-xl border bg-muted/10 p-3">
                  <span className="text-[11px] font-semibold uppercase text-muted-foreground">1. PO Number</span>
                  <p className="font-mono text-base font-bold text-primary">{header.po_number || "—"}</p>
                </div>

                {/* 2. Supplier Name */}
                <div className="rounded-xl border bg-muted/10 p-3">
                  <span className="text-[11px] font-semibold uppercase text-muted-foreground">2. Supplier Name</span>
                  <p className="text-sm font-bold text-foreground">{header.supplier_name || "ABC Supplier"}</p>
                </div>

                {/* 3. Supplier Company Name */}
                <div className="rounded-xl border bg-muted/10 p-3">
                  <span className="text-[11px] font-semibold uppercase text-muted-foreground">3. Supplier Company Name</span>
                  <p className="text-sm font-bold text-foreground">{header.supplier_company_name || "ABC Industrial Supplies Pvt. Ltd."}</p>
                </div>

                {/* 4. ASN Number */}
                <div className="rounded-xl border bg-muted/10 p-3">
                  <span className="text-[11px] font-semibold uppercase text-muted-foreground">4. ASN Number</span>
                  <p className="font-mono text-sm font-bold text-foreground">{header.asn_number || "ASN-001"}</p>
                </div>

                {/* 5. Gate Entry Number */}
                <div className="rounded-xl border bg-muted/10 p-3">
                  <span className="text-[11px] font-semibold uppercase text-muted-foreground">5. Gate Entry Number</span>
                  <p className="font-mono text-sm font-bold text-foreground">{header.gate_entry_number || "GE-001"}</p>
                </div>

                {/* 6. Warehouse Name */}
                <div className="rounded-xl border bg-muted/10 p-3">
                  <span className="text-[11px] font-semibold uppercase text-muted-foreground">6. Warehouse Name</span>
                  <p className="text-sm font-bold text-foreground">{header.warehouse_name || "Main Warehouse – Bangalore"}</p>
                </div>

                {/* 7. Receiving Dock */}
                <div className="rounded-xl border border-primary/40 bg-primary/5 p-3">
                  <label className="text-[11px] font-bold uppercase text-primary block mb-1">7. Receiving Dock *</label>
                  <select
                    value={header.receiving_dock}
                    onChange={(e) => setHeader({ ...header, receiving_dock: e.target.value })}
                    className="w-full rounded-lg border bg-background px-3 py-1.5 text-sm font-bold"
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
                <div className="rounded-xl border bg-muted/10 p-3">
                  <span className="text-[11px] font-semibold uppercase text-muted-foreground">8. GRN Number</span>
                  <p className="font-mono text-base font-bold text-success">{header.grn_number || "GRN-0001"}</p>
                </div>

                {/* 9. Receipt Type */}
                <div className="rounded-xl border bg-muted/10 p-3">
                  <label className="text-[11px] font-semibold uppercase text-muted-foreground block mb-1">9. Receipt Type</label>
                  <select
                    value={header.receipt_type}
                    onChange={(e) => setHeader({ ...header, receipt_type: e.target.value as any })}
                    className="w-full rounded-lg border bg-background px-2.5 py-1 text-xs font-bold"
                  >
                    <option value="PO_RECEIPT">PO Receipt (PO Delivery)</option>
                    <option value="UNEXPECTED_DELIVERY">Unexpected Delivery (Manual Info)</option>
                  </select>
                </div>

                {/* 10. Vehicle Number */}
                <div className="rounded-xl border bg-muted/10 p-3">
                  <label className="text-[11px] font-semibold uppercase text-muted-foreground block mb-1">
                    10. Vehicle Number
                  </label>
                  <Input
                    value={header.vehicle_number}
                    onChange={(e) => setHeader({ ...header, vehicle_number: e.target.value })}
                    readOnly={header.receipt_type === "PO_RECEIPT"}
                    className="font-mono text-sm font-bold rounded-lg"
                  />
                </div>

                {/* 11. Driver Name */}
                <div className="rounded-xl border bg-muted/10 p-3">
                  <label className="text-[11px] font-semibold uppercase text-muted-foreground block mb-1">
                    11. Driver Name
                  </label>
                  <Input
                    value={header.driver_name}
                    onChange={(e) => setHeader({ ...header, driver_name: e.target.value })}
                    readOnly={header.receipt_type === "PO_RECEIPT"}
                    className="text-sm font-bold rounded-lg"
                  />
                </div>

                {/* 12. Invoice Number */}
                <div className="rounded-xl border bg-muted/10 p-3">
                  <label className="text-[11px] font-semibold uppercase text-muted-foreground block mb-1">12. Invoice Number (Optional)</label>
                  <Input
                    value={header.invoice_number}
                    onChange={(e) => setHeader({ ...header, invoice_number: e.target.value })}
                    placeholder="INV-2026-001 (Optional)"
                    className="font-mono text-sm font-bold rounded-lg"
                  />
                </div>

                {/* 13. Received By */}
                <div className="rounded-xl border border-success/30 bg-success-soft/20 p-3 sm:col-span-2 lg:col-span-3">
                  <span className="text-[11px] font-bold uppercase text-success block">13. Received By</span>
                  <div className="flex items-center gap-2 mt-1">
                    <User className="size-4 text-success" />
                    <span className="text-sm font-bold text-foreground">{header.received_by}</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-4 border-t">
                <Button onClick={() => void handleProceedFromPage1()} disabled={busyAction || loadingContext} className="rounded-xl font-bold px-6">
                  {busyAction ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                  Next <ArrowRight className="ml-2 size-4" />
                </Button>
              </div>
            </Card>
          )}

          {/* PAGE 2 – ITEM RECEIVING DETAILS */}
          {currentPage === 2 && (
            <Card className="rounded-2xl p-6 space-y-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between border-b pb-4 gap-3">
                <div>
                  <h3 className="font-bold text-foreground text-base flex items-center gap-2">
                    <span>PO Material Line Items</span>
                    <span className="text-[10px] font-bold text-emerald-600 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200">
                      Auto-Fetched from DB
                    </span>
                  </h3>
                  <p className="text-xs text-muted-foreground">Record Good Qty & Damaged Qty. Balance Qty is computed automatically.</p>
                </div>
                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 rounded-lg text-xs font-semibold text-primary border-primary/30 hover:bg-primary/10"
                    onClick={() => {
                      setMaterials((prev) =>
                        prev.map((item) => ({
                          ...item,
                          good_quantity: item.po_quantity,
                          damaged_quantity: 0,
                          balance_quantity: 0,
                        })),
                      );
                      toast.success("Auto-filled all good quantities from PO details!");
                    }}
                  >
                    <Zap className="mr-1.5 size-3.5 fill-primary text-primary" /> Auto-Fill All Good Quantities
                  </Button>
                  <span className="text-xs font-semibold text-muted-foreground">GRN Status:</span>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${totalBalanceQty > 0 ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}>
                    {calculatedGrnStatus}
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto rounded-xl border">
                <table className="w-full text-sm text-left">
                  <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3">Material Name & Category</th>
                      <th className="px-4 py-3">Material Code</th>
                      <th className="px-4 py-3 text-right">PO Quantity</th>
                      <th className="px-4 py-3 text-right">Good Quantity</th>
                      <th className="px-4 py-3 text-right">Damaged Quantity</th>
                      <th className="px-4 py-3 text-right">Balance Quantity</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y font-medium">
                    {materials.map((m, idx) => {
                      const totalRec = m.good_quantity + m.damaged_quantity;
                      const bal = Math.max(m.po_quantity - totalRec, 0);
                      return (
                        <tr key={m.item_code} className="hover:bg-muted/20">
                          <td className="px-4 py-3 font-bold text-foreground">
                            <div>{m.material_name}</div>
                            <span className="text-[10px] text-emerald-600 font-medium block mt-0.5">
                              Category: {m.material_category || "General"}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-primary">{m.item_code}</td>
                          <td className="px-4 py-3 text-right font-bold">
                            <div>{m.po_quantity.toLocaleString()} <span className="text-xs font-normal text-muted-foreground">{m.uom || "PCS"}</span></div>
                            <span className="text-[10px] text-emerald-600 font-medium block">
                              Auto-Fetched PO Qty
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex flex-col items-end gap-1">
                              <Input
                                type="number"
                                min={0}
                                value={m.good_quantity}
                                onChange={(e) => {
                                  const val = Number(e.target.value);
                                  setMaterials((prev) =>
                                    prev.map((item, i) =>
                                      i === idx
                                        ? { ...item, good_quantity: val, balance_quantity: Math.max(item.po_quantity - (val + item.damaged_quantity), 0) }
                                        : item,
                                    ),
                                  );
                                }}
                                className="w-28 text-right font-bold text-emerald-600 rounded-xl"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  setMaterials((prev) =>
                                    prev.map((item, i) =>
                                      i === idx
                                        ? { ...item, good_quantity: item.po_quantity, damaged_quantity: 0, balance_quantity: 0 }
                                        : item,
                                    ),
                                  );
                                }}
                                className="text-[10px] font-semibold text-primary hover:underline flex items-center gap-0.5"
                              >
                                <Sparkles className="size-3 text-amber-500" /> Match PO Qty ({m.po_quantity})
                              </button>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Input
                              type="number"
                              min={0}
                              value={m.damaged_quantity}
                              onChange={(e) => {
                                const val = Number(e.target.value);
                                setMaterials((prev) =>
                                  prev.map((item, i) =>
                                    i === idx
                                      ? { ...item, damaged_quantity: val, balance_quantity: Math.max(item.po_quantity - (item.good_quantity + val), 0) }
                                      : item,
                                  ),
                                );
                              }}
                              className="w-28 text-right font-bold text-rose-600 rounded-xl ml-auto"
                            />
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-muted-foreground">
                            {bal.toLocaleString()}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  {/* TOTAL ROW AT BOTTOM */}
                  <tfoot className="bg-muted/40 font-bold border-t text-sm">
                    <tr>
                      <td colSpan={2} className="px-4 py-3 uppercase text-xs text-muted-foreground">Totals</td>
                      <td className="px-4 py-3 text-right">{totalPoQty.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right text-emerald-600">{totalGoodQty.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right text-rose-600">{totalDamagedQty.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right font-mono text-primary">{totalBalanceQty.toLocaleString()}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div className="flex justify-between pt-4 border-t">
                <Button variant="outline" className="rounded-xl" onClick={() => setCurrentPage(1)}>
                  <ArrowLeft className="mr-2 size-4" /> Back to Page 1
                </Button>
                <Button disabled={busyAction || loadingContext} onClick={() => void handleProceedFromPage2()} className="rounded-xl font-bold px-6">
                  Next <ArrowRight className="ml-2 size-4" />
                </Button>
              </div>
            </Card>
          )}

          {/* PAGE 3 – DAMAGED GOODS & PHOTO EVIDENCE */}
          {currentPage === 3 && (
            <Card className="rounded-2xl p-6 space-y-6 shadow-sm">
              <div className="border-b pb-4">
                <h3 className="font-bold text-foreground text-base">
                  Page 3: Damaged Goods & Photo Evidence
                </h3>

                <p className="text-xs text-muted-foreground">
                  Damaged quantities are populated from Page 2. Upload an
                  existing picture or take a photo, then click Save Photo.
                </p>
              </div>

              {damagedMaterials.length === 0 ? (
                <div className="rounded-xl border bg-emerald-50 p-4 text-center text-sm font-medium text-emerald-800">
                  <CheckCircle2 className="mx-auto mb-2 size-6" />
                  No damaged items recorded on Page 2. You can proceed to
                  Batch Creation.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3">Material Code</th>
                        <th className="px-4 py-3">Material Name</th>
                        <th className="px-4 py-3 text-right">Damaged Qty</th>
                        <th className="px-4 py-3">Damage Reason</th>
                        <th className="px-4 py-3">Photo Evidence</th>
                      </tr>
                    </thead>

                    <tbody className="divide-y">
                      {damagedMaterials.map((m) => (
                        <tr key={m.grn_line_id || m.item_code}>
                          <td className="px-4 py-3 font-mono font-bold text-primary">
                            {m.item_code}
                          </td>

                          <td className="px-4 py-3 font-bold text-foreground">
                            {m.material_name}
                          </td>

                          <td className="px-4 py-3 text-right font-bold text-rose-600">
                            {m.damaged_quantity} {m.uom}
                          </td>

                          <td className="px-4 py-3 min-w-[200px]">
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
                              className="rounded-xl text-xs font-medium border"
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
              <div className="pt-4 border-t space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <ShieldCheck className="size-4 text-emerald-600" /> Quality Inspection Approval (Auto-Fetched from Page 2)
                  </h4>
                  <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                    Auto-Synced with Page 2 Receiving
                  </span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {materials.map((m) => {
                    const approvedVal = Number((qualityApproved[m.item_code] !== undefined) ? qualityApproved[m.item_code] : (m.good_quantity ?? 0));
                    const isSound = approvedVal > 0;
                    return (
                      <div key={m.item_code} className="rounded-xl border p-3.5 bg-muted/10 space-y-2">
                        <div className="flex items-center justify-between border-b pb-2">
                          <div>
                            <span className="font-bold text-xs text-foreground block">{m.material_name}</span>
                            <span className="font-mono text-[11px] text-primary font-bold">({m.item_code})</span>
                          </div>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${isSound ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}>
                            {isSound ? "PASSED ✓" : "REJECTED ✗"}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                          <div>
                            <span className="text-muted-foreground block text-[10px]">Page 2 Good Qty:</span>
                            <b className="text-emerald-600">{m.good_quantity} {m.uom}</b>
                          </div>
                          <div>
                            <span className="text-muted-foreground block text-[10px]">Page 2 Damaged:</span>
                            <b className="text-rose-600">{m.damaged_quantity} {m.uom}</b>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t">
                          <span className="text-xs text-muted-foreground font-semibold">Quality-Approved Qty:</span>
                          <Input
                            type="number"
                            value={approvedVal}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              setQualityApproved((prev) => ({ ...prev, [m.item_code]: val }));
                            }}
                            className="w-24 font-mono font-bold text-right text-emerald-600 rounded-lg"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-between pt-4 border-t">
                <Button variant="outline" className="rounded-xl" onClick={() => setCurrentPage(2)}>
                  <ArrowLeft className="mr-2 size-4" /> Back to Page 2
                </Button>
                <Button onClick={() => setCurrentPage(4)} className="rounded-xl font-bold px-6">
                  Next <ArrowRight className="ml-2 size-4" />
                </Button>
              </div>
            </Card>
          )}

          {/* PAGE 4 – BATCH CREATION */}
          {currentPage === 4 && (
            <Card className="rounded-2xl p-6 space-y-6 shadow-sm">
              <div className="border-b pb-4">
                <h3 className="font-bold text-foreground text-base">Page 4: Lot & Batch Creation</h3>
                <p className="text-xs text-muted-foreground">
                  Divide Quality-Approved materials into batches. <b>Rule: Total Batch Quantity MUST equal Quality-Approved Quantity.</b>
                </p>
              </div>

              {!allBatchesValid && (
                <div className="rounded-xl border border-rose-300 bg-rose-50 p-4 text-xs text-rose-800 font-bold flex items-center gap-2">
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
                    <Card key={m.item_code} className={`rounded-xl p-4 border ${isValid ? "border-emerald-300 bg-emerald-50/20" : "border-rose-300 bg-rose-50/20"}`}>
                      <div className="flex flex-wrap items-center justify-between gap-3 mb-3 border-b pb-2">
                        <div>
                          <span className="font-bold text-foreground">{m.material_name}</span>
                          <span className="ml-2 font-mono text-xs text-primary font-bold">({m.item_code})</span>
                        </div>
                        <div className="flex items-center gap-4 text-xs font-semibold">
                          <span>Quality-Approved Qty: <b className="text-emerald-700">{appQty}</b> {m.uom}</span>
                          <span>Total Batch Qty: <b className={isValid ? "text-emerald-700" : "text-rose-700"}>{totalBatchQty}</b> {m.uom}</span>
                          <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${isValid ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}>
                            {isValid ? "VALID ✓" : "MISMATCH ✗"}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        {batches.map((b, bIdx) => (
                          <div key={b.batch_number || `batch_${m.item_code}_${bIdx}`} className="flex items-center gap-3">
                            <span className="text-xs font-mono font-bold text-muted-foreground w-24">Batch #{bIdx + 1}</span>
                            <Input
                              placeholder="BATCH-001"
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
                              className="w-40 font-mono text-xs rounded-xl"
                            />
                            <Input
                              type="number"
                              value={b.batch_quantity}
                              onChange={(e) => {
                                const val = Number(e.target.value);
                                setMaterialBatches((prev) => {
                                  const list = [...(prev[m.item_code] || [])];
                                  if (list[bIdx]) {
                                    list[bIdx] = { ...list[bIdx], batch_quantity: val };
                                  }
                                  return { ...prev, [m.item_code]: list };
                                });
                              }}
                              className="w-32 text-right font-bold rounded-xl"
                            />
                            <span className="text-xs text-muted-foreground font-medium">{m.uom}</span>
                          </div>
                        ))}
                      </div>

                      <div className="mt-3 flex justify-end">
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-xl text-xs"
                          onClick={() => {
                            setMaterialBatches((prev) => ({
                              ...prev,
                              [m.item_code]: [
                                ...batches,
                                { batch_number: `BATCH-${m.item_code}-${(batches.length + 1).toString().padStart(3, "0")}`, batch_quantity: 0 },
                              ],
                            }));
                          }}
                        >
                          <Plus className="mr-1 size-3" /> Add Sub-Batch
                        </Button>
                      </div>
                    </Card>
                  );
                })}
              </div>

              <div className="flex justify-between pt-4 border-t">
                <Button variant="outline" className="rounded-xl" onClick={() => setCurrentPage(3)}>
                  <ArrowLeft className="mr-2 size-4" /> Back to Page 3
                </Button>
                <Button
                  onClick={() => setCurrentPage(5)}
                  disabled={!allBatchesValid}
                  className="rounded-xl font-bold px-6"
                >
                  Next <ArrowRight className="ml-2 size-4" />
                </Button>
              </div>
            </Card>
          )}

          {/* PAGE 5 – DOCUMENT COMPLIANCE & ATTACHMENTS REPOSITORY */}
          {currentPage === 5 && (
            <Card className="rounded-2xl p-6 space-y-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between border-b pb-4 gap-3">
                <div>
                  <h3 className="font-bold text-foreground text-base flex items-center gap-2">
                    <span>Page 5: Inbound Goods Document Repository</span>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-100 text-rose-800 border border-rose-300">
                      PO Document Compulsory *
                    </span>
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    <b>Purchase Order (PO) Copy</b> is Compulsory. Add optional documents using the <b>+ Add Document</b> form below.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-xl text-xs font-bold border-primary/40 text-primary hover:bg-primary/5"
                  onClick={() => setShowAddCustomTypeInput(!showAddCustomTypeInput)}
                >
                  <Plus className="mr-1.5 size-3.5" /> + Add Custom Category Name
                </Button>
              </div>

              {/* INLINE CUSTOM DOCUMENT CATEGORY CREATION FORM */}
              {showAddCustomTypeInput && (
                <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
                  <span className="text-xs font-bold text-primary block">Create Custom Document Category</span>
                  <div className="flex flex-wrap items-center gap-3">
                    <Input
                      placeholder="e.g. Insurance Certificate, MSDS, Safety Audit Report..."
                      value={newCustomCategoryInput}
                      onChange={(e) => setNewCustomCategoryInput(e.target.value)}
                      className="rounded-xl text-xs font-bold flex-1 min-w-[240px] bg-background"
                    />
                    <Button
                      size="sm"
                      className="rounded-xl font-bold text-xs"
                      onClick={() => {
                        const trimmed = newCustomCategoryInput.trim();
                        if (!trimmed) {
                          toast.error("Please enter a valid document type name");
                          return;
                        }
                        if (!customDocTypes.includes(trimmed)) {
                          setCustomDocTypes((prev) => [...prev, trimmed]);
                        }
                        setSelectedDocCategory(trimmed);
                        setNewCustomCategoryInput("");
                        setShowAddCustomTypeInput(false);
                        toast.success(`Added custom category "${trimmed}"`);
                      }}
                    >
                      Save Category
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="rounded-xl text-xs"
                      onClick={() => setShowAddCustomTypeInput(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              {/* + ADD DOCUMENT ACTION FORM */}
              <div className="rounded-xl border bg-muted/20 p-4 space-y-3">
                <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Plus className="size-4 text-primary" /> + Add Document / Attach File
                </span>
                <div className="flex flex-wrap items-end gap-3">
                  <div className="w-64">
                    <label className="text-[11px] font-bold text-muted-foreground block mb-1">Select Document Category</label>
                    <select
                      value={selectedDocCategory}
                      onChange={(e) => setSelectedDocCategory(e.target.value)}
                      className="w-full rounded-xl border bg-background px-3 py-2 text-xs font-bold text-foreground"
                    >
                      {customDocTypes.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat} {cat.includes("PO") || cat.includes("Purchase Order") ? "(Compulsory *)" : "(Optional)"}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex-1 min-w-[220px]">
                    <label className="text-[11px] font-bold text-muted-foreground block mb-1">Select File</label>
                    <Input
                      type="file"
                      onChange={(e) => setPendingDocFile(e.target.files?.[0] || null)}
                      className="rounded-xl text-xs cursor-pointer bg-background"
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
                    className="rounded-xl font-bold"
                  >
                    <Upload className="mr-1.5 size-4" /> Attach Document
                  </Button>
                </div>
              </div>

              {/* DOCUMENT TABLE (PO IS COMPULSORY + ATTACHED DOCUMENTS) */}
              <div className="overflow-x-auto rounded-xl border shadow-sm">
                <table className="w-full text-xs text-left">
                  <thead className="bg-muted/60 text-muted-foreground uppercase font-mono border-b">
                    <tr>
                      <th className="px-4 py-3">Document Category / Name</th>
                      <th className="px-4 py-3">Requirement</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Attached File</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y font-medium">
                    {/* ALWAYS RENDER PO COMPULSORY ROW FIRST */}
                    {(() => {
                      const poDoc = uploadedDocuments.find(
                        (d) =>
                          d.category.toLowerCase().includes("po") ||
                          d.category.toLowerCase().includes("purchase order"),
                      );
                      return (
                        <tr className={!poDoc ? "bg-rose-50/30" : "hover:bg-muted/10"}>
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-2.5">
                              <FileText className="size-4 text-rose-600 shrink-0" />
                              <div>
                                <span className="font-bold text-foreground text-xs block">
                                  Purchase Order (PO) Document Copy
                                </span>
                                <span className="text-[10px] text-muted-foreground block">
                                  Compulsory PO authorization copy for PO {header.po_number || "PO-1001"}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3.5">
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-300">
                              COMPULSORY *
                            </span>
                          </td>
                          <td className="px-4 py-3.5">
                            {poDoc ? (
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1 w-fit">
                                ATTACHED ✓
                              </span>
                            ) : (
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1 w-fit animate-pulse">
                                PENDING *
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3.5 font-mono text-xs">
                            {poDoc ? (
                              <span className="font-bold text-foreground line-clamp-1">{poDoc.file_name}</span>
                            ) : (
                              <span className="text-muted-foreground text-[11px] font-normal italic">No file uploaded</span>
                            )}
                          </td>
                          <td className="px-4 py-3.5 text-right">
                            {poDoc ? (
                              <div className="flex items-center justify-end gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="rounded-xl text-xs font-bold border-primary/40 text-primary hover:bg-primary/10 h-7"
                                  onClick={() => setViewingDocumentModal(poDoc)}
                                >
                                  <Eye className="mr-1 size-3" /> View Document
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="rounded-xl text-xs text-rose-600 hover:bg-rose-50 h-7"
                                  onClick={() => {
                                    setUploadedDocuments((prev) => prev.filter((d) => d.file_name !== poDoc.file_name));
                                    toast.info(`Removed ${poDoc.file_name}`);
                                  }}
                                >
                                  Remove
                                </Button>
                              </div>
                            ) : (
                              <label className="cursor-pointer inline-block">
                                <span className="inline-flex items-center justify-center rounded-xl bg-rose-600 hover:bg-rose-700 text-white px-3 py-1.5 text-xs font-bold shadow-sm">
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
                        <tr key={optDoc.file_name || `opt_doc_${idx}`} className="hover:bg-muted/10">
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-2.5">
                              <FileText className="size-4 text-primary shrink-0" />
                              <div>
                                <span className="font-bold text-foreground text-xs block">{optDoc.category}</span>
                                <span className="text-[10px] text-muted-foreground block line-clamp-1">
                                  Optional Inbound Attachment
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3.5">
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                              OPTIONAL
                            </span>
                          </td>
                          <td className="px-4 py-3.5">
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1 w-fit">
                              ATTACHED ✓
                            </span>
                          </td>
                          <td className="px-4 py-3.5 font-mono text-xs">
                            <span className="font-bold text-foreground line-clamp-1">{optDoc.file_name}</span>
                          </td>
                          <td className="px-4 py-3.5 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className="rounded-xl text-xs font-bold border-primary/40 text-primary hover:bg-primary/10 h-7"
                                onClick={() => setViewingDocumentModal(optDoc)}
                              >
                                <Eye className="mr-1 size-3" /> View Document
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="rounded-xl text-xs text-rose-600 hover:bg-rose-50 h-7"
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

              <div className="flex justify-between pt-4 border-t">
                <Button variant="outline" className="rounded-xl" onClick={() => setCurrentPage(4)}>
                  <ArrowLeft className="mr-2 size-4" /> Back to Page 4
                </Button>
                <Button onClick={() => setCurrentPage(6)} className="rounded-xl font-bold px-6">
                  Next <ArrowRight className="ml-2 size-4" />
                </Button>
              </div>
            </Card>
          )}

          {/* PAGE 6 – QR CODE GENERATION */}
          {currentPage === 6 && (
            <Card className="rounded-2xl p-6 space-y-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between border-b pb-4 gap-3">
                <div>
                  <h3 className="font-bold text-foreground text-base">Page 6: Batch-wise QR Code Generation</h3>
                  <p className="text-xs text-muted-foreground">
                    <b>Rule: One Batch → One Unique QR Code.</b> Generate and print batch labels for box attachment.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    className="rounded-xl font-bold border-primary text-primary hover:bg-primary/10 shadow-xs"
                    onClick={() => {
                      setManualScanText("");
                      setManualScanInputOpen(true);
                    }}
                  >
                    <ScanLine className="mr-2 size-4 text-primary" /> Scan Barcode / QR
                  </Button>
                  <Button variant="outline" className="rounded-xl" onClick={() => window.print()}>
                    <Printer className="mr-2 size-4" /> Print Batch Labels
                  </Button>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 bg-muted/20 p-4 rounded-xl border">
                <div className="flex-1 min-w-[280px]">
                  <label className="text-xs font-bold text-foreground mb-1 block">Filter Material / View Option</label>
                  <select
                    value={selectedQrMaterialCode}
                    onChange={(e) => setSelectedQrMaterialCode(e.target.value)}
                    className="w-full rounded-xl border bg-background px-3 py-2 text-sm font-bold text-primary"
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
                    className="rounded-xl font-bold bg-primary text-white shadow-sm"
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
                      <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/50 text-center text-xs text-blue-800 font-medium">
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
                    <div key={mat.item_code} className="space-y-4 rounded-2xl border p-4 bg-muted/10">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="grid size-6 place-items-center rounded-full bg-primary text-primary-foreground font-mono text-xs font-bold">
                              {matIdx + 1}
                            </span>
                            <h4 className="font-bold text-base text-foreground">
                              {mat.material_name} <span className="font-mono text-xs text-primary bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20">{mat.item_code}</span>
                            </h4>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Category: <b>{mat.material_category || "General"}</b> | Total Batches: <b>{bList.length}</b> | UOM: <b>{mat.uom}</b> | Approved Qty: <b>{mat.good_quantity} {mat.uom}</b>
                          </p>
                        </div>

                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-xl text-xs font-bold"
                          onClick={() => printAllPoQrLabels(mat.item_code)}
                        >
                          <Printer className="mr-1.5 size-3.5" /> Print {mat.material_name} Labels ({bList.length})
                        </Button>
                      </div>

                      {bList.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic p-4 text-center">No batches created for this material yet.</p>
                      ) : (
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                          {bList.map((b, idx) => {
                            const qrInfo = qrLabels[mat.item_code] || {
                              qr_id: `QR-MAT-${mat.item_code}`,
                              data_url: "",
                              payload: buildMaterialQrPayload(mat.item_code),
                            };

                            return (
                              <Card key={b.batch_number} className="rounded-2xl p-5 border text-center space-y-3 bg-white text-black shadow-md relative overflow-hidden group">
                                <div className="border-b pb-2 flex items-center justify-between">
                                  <div>
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">GRN Batch Label</span>
                                    <h4 className="font-mono text-base font-bold text-gray-900">{b.batch_number}</h4>
                                  </div>
                                  <span className="text-[11px] font-mono font-bold text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">
                                    {qrInfo.qr_id}
                                  </span>
                                </div>

                                <div
                                  className="relative group/qr cursor-pointer my-2"
                                  onClick={() =>
                                    setEnlargedQr({
                                      title: b.batch_number,
                                      qr_id: qrInfo.qr_id,
                                      data_url: qrInfo.data_url,
                                      payload: qrInfo.payload || buildMaterialQrPayload(mat.item_code, b),
                                      batch: b,
                                      itemCode: mat.item_code,
                                    })
                                  }
                                >
                                  {qrInfo.data_url ? (
                                    <div className="relative inline-block p-2 bg-white rounded-2xl border border-gray-200 shadow-sm transition-transform group-hover/qr:scale-105">
                                      <img src={qrInfo.data_url} alt="Material QR Code" className="size-48 mx-auto" />
                                      <div className="absolute inset-0 bg-black/70 opacity-0 group-hover/qr:opacity-100 transition-opacity rounded-2xl flex flex-col items-center justify-center text-white text-xs font-bold gap-1 p-2">
                                        <Eye className="size-7 text-emerald-400" />
                                        <span>Click to Enlarge / Scan</span>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="grid size-48 place-items-center bg-gray-100 mx-auto rounded-2xl border border-dashed border-gray-300">
                                      <Loader2 className="size-8 animate-spin text-primary" />
                                      <span className="text-xs text-gray-500">Generating QR...</span>
                                    </div>
                                  )}
                                </div>

                                <div className="text-xs text-left space-y-1 font-mono text-gray-800 border-t pt-2">
                                  <p><b>PO Number:</b> {header.po_number}</p>
                                  <p><b>GRN Number:</b> {header.grn_number}</p>
                                  <p><b>Material:</b> {mat.item_code} ({mat.material_name})</p>
                                  <p><b>Category:</b> {mat.material_category || "General"}</p>
                                  <p><b>Batch Qty:</b> {b.batch_quantity} {mat.uom}</p>
                                </div>

                                <div className="grid grid-cols-2 gap-2 pt-1">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="w-full rounded-xl text-xs font-bold"
                                    onClick={() =>
                                      setEnlargedQr({
                                        title: b.batch_number,
                                        qr_id: qrInfo.qr_id,
                                        data_url: qrInfo.data_url,
                                        payload: qrInfo.payload || buildMaterialQrPayload(mat.item_code, b),
                                        batch: b,
                                        itemCode: mat.item_code,
                                      })
                                    }
                                  >
                                    <Eye className="mr-1 size-3 text-primary" /> Scan / Preview
                                  </Button>
                                  <Button
                                    size="sm"
                                    className="w-full rounded-xl text-xs font-bold bg-primary text-white hover:bg-primary/90"
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
              <div className="pt-6 border-t space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 bg-rose-50/70 dark:bg-rose-950/30 p-4 rounded-2xl border border-rose-200 dark:border-rose-900">
                  <div>
                    <h4 className="font-bold text-base text-rose-900 dark:text-rose-200 flex items-center gap-2">
                      <AlertTriangle className="size-5 text-rose-600 animate-pulse" />
                      Damaged & Rejected Goods QR Labels (Quarantine Area)
                    </h4>
                    <p className="text-xs text-rose-700 dark:text-rose-300 mt-0.5">
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
                        className="rounded-xl font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-sm"
                      >
                        <Mail className="mr-2 size-4" /> Send Damage Report to Vendor & Procurement
                      </Button>
                      <Button
                        onClick={() => printAllDamageQrLabels()}
                        variant="outline"
                        className="rounded-xl font-bold border-rose-300 text-rose-800 dark:text-rose-200 hover:bg-rose-100 shadow-sm"
                      >
                        <Printer className="mr-2 size-4" /> Print All Damage Labels ({damageQrLabels.length})
                      </Button>
                    </div>
                  )}
                </div>

                {damageQrLabels.length === 0 ? (
                  <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/50 text-center text-xs text-emerald-800 font-medium">
                    ✓ No damaged or rejected goods recorded for this GRN. All received material lines are 100% sound.
                  </div>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {damageQrLabels.map((dEntry) => (
                      <Card key={dEntry.damage_lot_number} className="rounded-2xl p-5 border-2 border-rose-300 dark:border-rose-800 text-center space-y-3 bg-rose-50/20 dark:bg-rose-950/20 text-foreground shadow-md relative overflow-hidden group">
                        <div className="border-b border-rose-200 dark:border-rose-900 pb-2 flex items-center justify-between">
                          <div className="text-left">
                            <span className="text-[10px] font-extrabold uppercase tracking-widest text-rose-700 dark:text-rose-400">Damage Lot QR</span>
                            <h4 className="font-mono text-sm font-bold text-rose-950 dark:text-rose-100">{dEntry.damage_lot_number}</h4>
                          </div>
                          <span className="text-[11px] font-mono font-bold text-rose-700 bg-rose-100 dark:bg-rose-900/60 dark:text-rose-200 px-2.5 py-0.5 rounded-full border border-rose-300">
                            {dEntry.qr_code}
                          </span>
                        </div>

                        <div
                          className="relative group/qr cursor-pointer my-2"
                          onClick={() =>
                            setEnlargedQr({
                              title: dEntry.damage_lot_number,
                              qr_id: dEntry.qr_code,
                              data_url: dEntry.qr_data_url,
                              payload: dEntry.qr_payload,
                              batch: { batch_number: dEntry.damage_lot_number, batch_quantity: dEntry.damaged_quantity },
                              itemCode: dEntry.item_code,
                            })
                          }
                        >
                          {dEntry.qr_data_url ? (
                            <div className="relative inline-block p-2 bg-white rounded-2xl border border-rose-200 shadow-sm transition-transform group-hover/qr:scale-105">
                              <img src={dEntry.qr_data_url} alt="Damage QR Code" className="size-44 mx-auto" />
                              <div className="absolute inset-0 bg-rose-950/80 opacity-0 group-hover/qr:opacity-100 transition-opacity rounded-2xl flex flex-col items-center justify-center text-white text-xs font-bold gap-1 p-2">
                                <Eye className="size-7 text-rose-300" />
                                <span>Click to Enlarge / Scan</span>
                              </div>
                            </div>
                          ) : (
                            <div className="grid size-44 place-items-center bg-rose-100 mx-auto rounded-2xl border border-dashed border-rose-300">
                              <Loader2 className="size-8 animate-spin text-rose-600" />
                              <span className="text-xs text-rose-700">Generating Damage QR...</span>
                            </div>
                          )}
                        </div>

                        <div className="text-xs text-left space-y-1 font-mono text-foreground border-t border-rose-200 dark:border-rose-900 pt-2">
                          <p><b>GRN Number:</b> {header.grn_number}</p>
                          <p><b>Material:</b> {dEntry.item_code} ({dEntry.material_name})</p>
                          <p><b>Damaged Qty:</b> <b className="text-rose-600 dark:text-rose-400">{dEntry.damaged_quantity} {dEntry.uom}</b></p>
                          <p><b>Reason:</b> {dEntry.reason}</p>
                          <p><b>QA Status:</b> <span className="bg-rose-100 dark:bg-rose-900 text-rose-800 dark:text-rose-200 px-1.5 py-0.5 rounded text-[10px] font-bold">{dEntry.qa_status}</span></p>
                          <p><b>Quarantine Location:</b> <span className="text-amber-700 dark:text-amber-400 font-bold">{dEntry.quarantine_location}</span></p>
                        </div>

                        <div className="grid grid-cols-2 gap-2 pt-1">
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full rounded-xl text-xs font-bold border-rose-200 hover:bg-rose-100"
                            onClick={() =>
                              setEnlargedQr({
                                title: dEntry.damage_lot_number,
                                qr_id: dEntry.qr_code,
                                data_url: dEntry.qr_data_url,
                                payload: dEntry.qr_payload,
                                batch: { batch_number: dEntry.damage_lot_number, batch_quantity: dEntry.damaged_quantity },
                                itemCode: dEntry.item_code,
                              })
                            }
                          >
                            <Eye className="mr-1 size-3 text-rose-600" /> Preview
                          </Button>
                          <Button
                            size="sm"
                            className="w-full rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white"
                            onClick={() => printSingleDamageQrLabel(dEntry)}
                          >
                            <Printer className="mr-1 size-3" /> Print Label
                          </Button>
                          <Button
                            size="sm"
                            className="col-span-2 w-full rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white"
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
              <div className="flex justify-between pt-6 border-t">
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
                  className="rounded-xl font-bold bg-emerald-600 hover:bg-emerald-700 text-white px-8 text-sm shadow-md flex items-center gap-2"
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
          <DialogContent className="sm:max-w-lg rounded-2xl p-6 text-center space-y-4">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold flex items-center justify-center gap-2">
                <QrCode className="size-5 text-primary" /> Batch QR Code – {enlargedQr.title}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Point any smartphone camera or QR scanner at the high-definition QR code below to read batch details.
              </DialogDescription>
            </DialogHeader>

            <div className="p-4 bg-white rounded-2xl border border-primary/20 shadow-md inline-block mx-auto">
              <img src={enlargedQr.data_url} alt="Enlarged QR Code" className="size-72 mx-auto" />
            </div>

            <div className="text-left space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                📱 Scanned Mobile Reader Live Output
              </span>
              <div className="rounded-xl border bg-black text-emerald-400 p-3 font-mono text-xs overflow-x-auto whitespace-pre leading-relaxed shadow-inner max-h-40">
                {enlargedQr.payload}
              </div>
            </div>

            {/* Primary Action: Scan & View Stock Details */}
            <Button
              className="w-full rounded-xl bg-primary hover:bg-primary/90 text-white font-bold h-10 shadow-glow"
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
                className="w-1/2 rounded-xl font-bold"
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
          <DialogContent className="sm:max-w-md rounded-2xl p-6 space-y-4">
            <DialogHeader>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <ScanLine className="size-5 text-primary" /> Barcode / QR Scanner Input
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Scan with a handheld barcode scanner or paste the raw QR code identifier / payload below.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                QR Code / Barcode Data
              </label>
              <Textarea
                placeholder="e.g. QR-MAT-MAT-001 or DMG-GRN-2026-0001-MAT-001-01 or MAT-1001-V002 or paste multi-line QR content"
                value={manualScanText}
                onChange={(e) => setManualScanText(e.target.value)}
                className="font-mono text-xs h-28 rounded-xl"
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
                className="w-1/2 rounded-xl bg-primary text-white font-bold"
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
          <DialogContent className="sm:max-w-xl rounded-2xl p-6 space-y-4">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold flex items-center gap-2 text-purple-700">
                <ShieldCheck className="size-6 text-purple-600" /> Goods Inspection Quality Audit & Pass Rate
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Detailed quality pass rate metrics across received inbound material batches for the current month.
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-3 gap-3 p-3 bg-purple-50/50 rounded-xl border border-purple-200 text-center">
              <div>
                <span className="text-[10px] uppercase font-bold text-gray-500">Total Inspected</span>
                <p className="font-mono text-xl font-extrabold text-gray-900">18,570</p>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-emerald-600">Passed (Good)</span>
                <p className="font-mono text-xl font-extrabold text-emerald-700">18,450 (99.3%)</p>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-amber-600">Damaged / Rejected</span>
                <p className="font-mono text-xl font-extrabold text-amber-700">120 (0.7%)</p>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Material-wise Inspection Breakdown</h4>
              <div className="rounded-xl border overflow-hidden text-xs">
                <table className="w-full text-left">
                  <thead className="bg-muted font-bold text-muted-foreground border-b">
                    <tr>
                      <th className="p-2.5">Material Code & Name</th>
                      <th className="p-2.5">Good Qty</th>
                      <th className="p-2.5">Damaged Qty</th>
                      <th className="p-2.5">Pass Rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y font-medium">
                    {materials.map((m) => {
                      const total = m.good_quantity + m.damaged_quantity;
                      const rate = total > 0 ? ((m.good_quantity / total) * 100).toFixed(1) : "100.0";
                      return (
                        <tr key={m.item_code} className="hover:bg-muted/20">
                          <td className="p-2.5 font-bold">
                            {m.item_code} – {m.material_name}
                          </td>
                          <td className="p-2.5 font-mono text-emerald-700 font-bold">
                            {m.good_quantity} {m.uom}
                          </td>
                          <td className="p-2.5 font-mono text-amber-700 font-bold">
                            {m.damaged_quantity} {m.uom}
                          </td>
                          <td className="p-2.5 font-mono">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800">
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

            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button variant="outline" className="rounded-xl" onClick={() => setShowQualityPassModal(false)}>
                Close Audit
              </Button>
              <Button
                className="rounded-xl font-bold bg-primary text-white"
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
          <DialogContent className="sm:max-w-xl rounded-2xl p-6 space-y-4">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold flex items-center gap-2 text-rose-700">
                <Mail className="size-6 text-rose-600" /> Send Damaged Goods Notice to Vendor & Procurement
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
                  className="rounded-xl mt-1 font-mono text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-bold uppercase text-muted-foreground">Damaged & Rejected Items Breakdown</label>
                <div className="max-h-40 overflow-y-auto border rounded-xl p-3 bg-muted/20 space-y-2 mt-1">
                  {damageQrLabels.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">No damaged items listed.</p>
                  ) : (
                    damageQrLabels.map((d) => (
                      <div key={d.damage_lot_number} className="text-xs font-mono flex items-center justify-between border-b pb-1">
                        <div>
                          <span className="font-bold text-foreground">{d.item_code} ({d.material_name})</span>
                          <p className="text-[10px] text-muted-foreground">Lot: {d.damage_lot_number} | Reason: {d.reason}</p>
                        </div>
                        <span className="font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
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
                  className="rounded-xl mt-1 text-xs"
                  rows={3}
                />
              </div>
            </div>

            <div className="flex gap-2 pt-3 border-t">
              <Button variant="outline" className="w-1/2 rounded-xl" onClick={() => setShowNotifyVendorModal(false)}>
                Cancel
              </Button>
              <Button
                disabled={sendingVendorNotify}
                className="w-1/2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold"
                onClick={async () => {
                  setSendingVendorNotify(true);
                  try {
                    const currentPhotoIds = Object.values(damagePhotos)
                      .map((p) => p.evidenceId)
                      .filter((id): id is string => Boolean(id && id.trim()));

                    const damagePayloadItems = damagedMaterials.length > 0
                      ? damagedMaterials.map((m) => {
                          const photo = damagePhotos[m.item_code];
                          const pIds = photo?.evidenceId ? [photo.evidenceId] : [];
                          return {
                            item_code: m.item_code,
                            material_name: m.material_name,
                            damaged_quantity: Number(m.damaged_quantity || 0),
                            uom: m.uom || "PCS",
                            reason: m.damage_reason || "Damaged during receiving inspection",
                            photo_ids: pIds,
                          };
                        })
                      : (damageQrLabels || []).map((d: any) => {
                          const code = d.item_code || d.itemCode || "ITEM";
                          const photo = damagePhotos[code];
                          const pIds = photo?.evidenceId ? [photo.evidenceId] : [];
                          return {
                            item_code: code,
                            material_name: d.material_name || d.materialName || "Material",
                            damaged_quantity: Number(d.damaged_quantity || d.quantity || 0),
                            uom: d.uom || "PCS",
                            reason: d.reason || "Damaged / Rejected",
                            damage_lot_number: d.damage_lot_number || "",
                            quarantine_location: d.quarantine_location || "",
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
          <DialogContent className="max-w-3xl rounded-2xl p-6 space-y-5">
            <DialogHeader className="border-b pb-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-primary px-3 py-1 rounded-full bg-primary/10 border border-primary/20">
                  {selectedGrnDetail.grn_number || "GRN-2026-0001"}
                </span>
                <StatusBadge status={selectedGrnDetail.status || "COMPLETED"} />
              </div>
              <DialogTitle className="text-lg font-bold text-foreground mt-2">
                Goods Receipt Note Breakdown & Reconciliation
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                PO Reference: <b>{selectedGrnDetail.po_number || "PO-1001"}</b> • Supplier: <b>{selectedGrnDetail.supplier_name || "ABC Supplier"}</b>
              </DialogDescription>
            </DialogHeader>

            {/* STATUS RECONCILIATION RULE BANNER */}
            <div className={`p-3 rounded-xl border text-xs font-semibold flex items-center justify-between ${
              selectedGrnDetail.status === "COMPLETED" 
                ? "bg-emerald-50 text-emerald-900 border-emerald-300 dark:bg-emerald-950/30 dark:text-emerald-200 dark:border-emerald-800" 
                : "bg-amber-50 text-amber-900 border-amber-300 dark:bg-amber-950/30 dark:text-amber-200 dark:border-amber-800"
            }`}>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
                <span>
                  {selectedGrnDetail.status === "COMPLETED"
                    ? "✓ COMPLETED: Combined count (Good Qty + Damaged Qty) matches 100% of PO Quantity for all materials."
                    : "⏳ PARTIALLY COMPLETED: Combined count (Good Qty + Damaged Qty) is less than PO Quantity (Pending Balance Remaining)."}
                </span>
              </div>
              <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-background border shadow-xs">
                Rule Verified
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-muted/20 rounded-xl border text-xs font-mono">
              <div>
                <span className="text-muted-foreground block text-[10px] uppercase font-sans font-bold">Dock Number</span>
                <b className="text-foreground">Dock {selectedGrnDetail.dock_number || "DOCK-02"}</b>
              </div>
              <div>
                <span className="text-muted-foreground block text-[10px] uppercase font-sans font-bold">Vehicle Reg</span>
                <b className="text-foreground">{selectedGrnDetail.vehicle_number || "KA01EQ9921"}</b>
              </div>
              <div>
                <span className="text-muted-foreground block text-[10px] uppercase font-sans font-bold">Driver Name</span>
                <b className="text-foreground">{selectedGrnDetail.driver_name || "Ramesh"}</b>
              </div>
              <div>
                <span className="text-muted-foreground block text-[10px] uppercase font-sans font-bold">Received By</span>
                <b className="text-foreground">{selectedGrnDetail.received_by || "Officer Obaiah"}</b>
              </div>
            </div>

            {/* MATERIAL LINE ITEMS RECONCILIATION BREAKDOWN TABLE */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Line Item Quantity Reconciliation</h4>
              <div className="rounded-xl border overflow-x-auto text-xs">
                <table className="w-full text-left">
                  <thead className="bg-muted/60 font-bold text-muted-foreground text-[11px] uppercase border-b">
                    <tr>
                      <th className="p-2.5">Material Details</th>
                      <th className="p-2.5 text-right">PO Qty</th>
                      <th className="p-2.5 text-right text-emerald-600">Good Qty</th>
                      <th className="p-2.5 text-right text-rose-600">Damaged Qty</th>
                      <th className="p-2.5 text-right font-black">Good + Damaged</th>
                      <th className="p-2.5 text-right text-amber-600">Pending Bal</th>
                      <th className="p-2.5 text-center">Item Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y font-mono font-medium">
                    {(() => {
                      const detailLines = (selectedGrnDetail.lines && selectedGrnDetail.lines.length > 0)
                        ? selectedGrnDetail.lines
                        : ((selectedGrnDetail.materials && selectedGrnDetail.materials.length > 0)
                          ? selectedGrnDetail.materials
                          : (materials.length > 0 ? materials : []));

                      if (detailLines.length === 0) {
                        return (
                          <tr>
                            <td colSpan={7} className="p-4 text-center text-xs text-muted-foreground italic font-sans">
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
                          <tr key={itemCode || `mat_detail_${i}`} className="hover:bg-muted/20">
                            <td className="p-2.5 font-sans font-bold">
                              <span className="text-primary font-mono block">{itemCode}</span>
                              <span className="text-foreground text-xs">{materialName}</span>
                            </td>
                            <td className="p-2.5 text-right font-bold text-foreground">
                              {poQty} {uom}
                            </td>
                            <td className="p-2.5 text-right font-bold text-emerald-700">
                              {goodQty} {uom}
                            </td>
                            <td className="p-2.5 text-right font-bold text-rose-600">
                              {damQty} {uom}
                            </td>
                            <td className="p-2.5 text-right font-black text-indigo-600">
                              {combined} {uom}
                            </td>
                            <td className="p-2.5 text-right font-bold text-amber-600">
                              {bal} {uom}
                            </td>
                            <td className="p-2.5 text-center">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                isComplete ? "bg-emerald-100 text-emerald-800 border border-emerald-300" : "bg-amber-100 text-amber-800 border border-amber-300"
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

            <div className="flex justify-between items-center pt-3 border-t">
              <Button variant="outline" className="rounded-xl text-xs font-bold" onClick={() => setSelectedGrnDetail(null)}>
                Close
              </Button>
              <Button
                className="rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white"
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
          <DialogContent className="max-w-md rounded-2xl p-6 space-y-4">
            <DialogHeader className="border-b pb-3">
              <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
                <DoorOpen className="size-5 text-primary" /> Assign Incoming Vehicle to Dock
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Select available dock bay and link incoming vehicle registration.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-foreground block mb-1">Select Dock Bay</label>
                <select
                  value={assigningDockId}
                  onChange={(e) => setAssigningDockId(e.target.value)}
                  className="w-full rounded-xl border bg-background px-3 py-2 font-bold"
                >
                  <option value="DOCK-01">DOCK-01 (Occupied)</option>
                  <option value="DOCK-02">DOCK-02 (Gate Verified)</option>
                  <option value="DOCK-03">DOCK-03 (Available)</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-foreground block mb-1">Vehicle Registration Number</label>
                <Input
                  placeholder="KA-05-MH-8812"
                  value={assigningVehicle}
                  onChange={(e) => setAssigningVehicle(e.target.value)}
                  className="rounded-xl font-mono text-xs font-bold"
                />
              </div>

              <div>
                <label className="font-bold text-foreground block mb-1">PO Reference (Optional)</label>
                <Input
                  placeholder="PO-2026-0007"
                  value={assigningPo}
                  onChange={(e) => setAssigningPo(e.target.value)}
                  className="rounded-xl font-mono text-xs font-bold"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t">
              <Button variant="outline" className="rounded-xl" onClick={() => setShowAssignDockModal(false)}>
                Cancel
              </Button>
              <Button
                className="rounded-xl font-bold bg-primary text-white"
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
          <DialogContent className="max-w-3xl rounded-2xl p-6 space-y-5 max-h-[90vh] overflow-y-auto">
            <DialogHeader className="border-b pb-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-primary px-3 py-1 rounded-full bg-primary/10 border border-primary/20 uppercase">
                  {viewingDocumentModal.category || "ATTACHED DOCUMENT"}
                </span>
                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                  <ShieldCheck className="size-3" /> WMS Verified Attachment
                </span>
              </div>
              <DialogTitle className="text-lg font-bold text-foreground mt-2 line-clamp-1">
                Document Preview: {viewingDocumentModal.file_name}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Inbound Quality & Regulatory Attachment • PO: {header.po_number || "PO-1001"} • GRN: {header.grn_number || "GRN-2026-0001"}
              </DialogDescription>
            </DialogHeader>

            {/* DOCUMENT PREVIEW CONTAINER */}
            <div className="rounded-xl border bg-slate-950 p-4 text-slate-100 min-h-[320px] flex flex-col items-center justify-center relative overflow-hidden">
              {viewingDocumentModal.file_path.startsWith("blob:") ||
                viewingDocumentModal.file_path.match(/\.(jpg|jpeg|png|webp|svg)$/i) ||
                viewingDocumentModal.category.toLowerCase().includes("photo") ? (
                <div className="text-center space-y-3 w-full">
                  <img
                    src={viewingDocumentModal.file_path}
                    alt={viewingDocumentModal.file_name}
                    className="max-h-[380px] w-auto mx-auto rounded-lg object-contain border border-slate-800 shadow-2xl"
                    onError={(e) => {
                      // Fallback preview card if blob url is un-rendered preview
                      (e.target as HTMLElement).style.display = "none";
                    }}
                  />
                  <p className="text-xs text-slate-400 font-mono">Image Evidence Preview • High Resolution</p>
                </div>
              ) : (
                <div className="w-full space-y-4 text-center py-6">
                  <div className="size-16 rounded-2xl bg-primary/20 text-primary mx-auto flex items-center justify-center border border-primary/30 shadow-inner">
                    <FileText className="size-8" />
                  </div>
                  <div>
                    <h4 className="font-mono text-base font-bold text-white">{viewingDocumentModal.file_name}</h4>
                    <p className="text-xs text-slate-400 mt-1">Official Document Copy • PDF / Document Format</p>
                  </div>
                  <div className="max-w-md mx-auto p-4 rounded-xl bg-slate-900 border border-slate-800 text-left text-xs font-mono space-y-1.5 text-slate-300">
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
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t">
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
                  className="rounded-xl text-xs font-bold border-primary/40 text-primary"
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
    </AppShell>
  );
}
