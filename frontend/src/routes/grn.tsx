import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import QRCode from "qrcode";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock,
  DoorOpen,
  Eye,
  FileCheck2,
  FileText,
  Image as ImageIcon,
  LayoutDashboard,
  Loader2,
  PackageCheck,
  Plus,
  Printer,
  QrCode,
  RefreshCw,
  Search,
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
import { api } from "@/lib/api-client";
import { getUserInfo } from "@/lib/auth-utils";

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
  category: "INVOICE" | "DELIVERY_CHALLAN" | "PACKING_LIST" | "DAMAGE_PHOTO" | "ADDITIONAL";
  file_name: string;
  file_path: string;
};

type GrnHeaderState = {
  po_number: string;
  supplier_name: string;
  supplier_company_name: string;
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

  // Page 1 - Header State
  const [header, setHeader] = useState<GrnHeaderState>({
    po_number: "PO-2026-0007",
    supplier_name: "Email Supplier",
    supplier_company_name: "Email Comp",
    asn_number: "ASN-2026-0005",
    gate_entry_number: "GE-PO-2026-0007",
    warehouse_name: "Main Warehouse",
    receiving_dock: "DOCK-01",
    grn_number: "GRN-20260828-0007",
    receipt_type: "PO_RECEIPT",
    vehicle_number: "MH-12-N-5667",
    driver_name: "Obaiah",
    invoice_number: "INV-20260007-001",
    received_by: loggedInUserName,
  });

  const [grnId, setGrnId] = useState<string | null>(null);
  const [dockOptions, setDockOptions] = useState<any[]>([]);
  const [loadingContext, setLoadingContext] = useState(false);
  const [busyAction, setBusyAction] = useState(false);

  // Page 2 - Line Items State (Matching Workflow Diagram)
  const [materials, setMaterials] = useState<GrnLineItem[]>([
    { material_name: "steel", item_code: "MAT-0014", po_quantity: 1000, good_quantity: 1000, damaged_quantity: 0, balance_quantity: 0, uom: "KG", material_category: "Raw Materials", quality_approved_quantity: 1000 },
  ]);

  // Page 3 - Damaged Goods & Quality State
  const [damagePhotos, setDamagePhotos] = useState<Record<string, { file?: File; previewUrl?: string; reason?: string }>>({
    "MAT-001": { reason: "Material damaged during transportation" },
    "MAT-003": { reason: "Packing torn and items scratched" },
  });
  const [qualityApproved, setQualityApproved] = useState<Record<string, number>>({
    "MAT-001": 90,
    "MAT-002": 500,
    "MAT-003": 180,
    "MAT-004": 300,
  });

  // Page 4 - Batches State
  const [materialBatches, setMaterialBatches] = useState<Record<string, BatchEntry[]>>({
    "MAT-001": [
      { batch_number: "BATCH-001", batch_quantity: 30 },
      { batch_number: "BATCH-002", batch_quantity: 30 },
      { batch_number: "BATCH-003", batch_quantity: 30 },
    ],
    "MAT-002": [{ batch_number: "BATCH-MAT-002-001", batch_quantity: 500 }],
    "MAT-003": [{ batch_number: "BATCH-MAT-003-001", batch_quantity: 180 }],
    "MAT-004": [{ batch_number: "BATCH-MAT-004-001", batch_quantity: 300 }],
  });

  // Page 5 - Documents State
  const [uploadedDocuments, setUploadedDocuments] = useState<UploadedDocument[]>([
    { category: "INVOICE", file_name: "INV-2026-001.pdf", file_path: "/uploads/INV-2026-001.pdf" },
    { category: "DELIVERY_CHALLAN", file_name: "DC-001.pdf, DC-002.pdf", file_path: "/uploads/DC-001.pdf" },
    { category: "PACKING_LIST", file_name: "PL-001.pdf", file_path: "/uploads/PL-001.pdf" },
    { category: "DAMAGE_PHOTO", file_name: "2 Files Uploaded", file_path: "/uploads/damage_photos.zip" },
  ]);
  const [pendingDocType, setPendingDocType] = useState<UploadedDocument["category"]>("INVOICE");
  const [pendingDocFile, setPendingDocFile] = useState<File | null>(null);

  // Page 6 - QR Generation State
  const [selectedQrMaterialCode, setSelectedQrMaterialCode] = useState<string>("ALL");
  const [enlargedQr, setEnlargedQr] = useState<{ title: string; qr_id: string; data_url: string; payload: string; batch: BatchEntry; itemCode: string } | null>(null);
  const [showQualityPassModal, setShowQualityPassModal] = useState(false);

  // Fetch Records
  const loadRecords = useCallback(async () => {
    setLoadingRecords(true);
    try {
      const items = await api.getGrnDrafts(undefined, searchTerm || undefined);
      setGrnRecords(items);
    } catch (err: any) {
      toast.error("Failed to load GRN records", { description: err.message });
    } finally {
      setLoadingRecords(false);
    }
  }, [searchTerm]);

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
    setLoadingContext(true);
    try {
      const ctx = await api.getGrnContext(numToFetch);
      const supplierName = ctx.supplier_name || ctx.supplierName || "Supplier";
      const supplierComp = ctx.supplier_company_name || ctx.supplierCompanyName || supplierName;
      const asnNum = ctx.asn_number || ctx.asnNumber || ctx.asn?.asn_number || ctx.asn?.asnNumber || `ASN-${numToFetch}`;
      const gateNum = ctx.gate_entry_number || ctx.gateEntryNumber || ctx.gate_entry?.gate_entry_number || ctx.gate_entry?.gateEntryNumber || `GE-${numToFetch}`;
      const vehicleNum = ctx.vehicle_number || ctx.vehicleNumber || ctx.asn?.vehicle_number || ctx.asn?.vehicleNumber || ctx.gate_entry?.vehicle_number || ctx.gate_entry?.vehicleNumber || "MH-12-N-5667";
      const driverName = ctx.driver_name || ctx.driverName || ctx.asn?.driver_name || ctx.asn?.driverName || ctx.gate_entry?.driver_name || ctx.gate_entry?.driverName || "Obaiah";
      const warehouseName = ctx.warehouse_name || ctx.warehouseName || "Main Warehouse";
      const prefilledDock = ctx.prefilled_dock_number || ctx.prefilledDockNumber || (ctx.dock_options && ctx.dock_options[0]?.dock_number) || "DOCK-01";
      const generatedGrnNum = ctx.grn_number || ctx.grnNumber || `GRN-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, "0")}${String(new Date().getDate()).padStart(2, "0")}-${Math.floor(1000 + Math.random() * 9000)}`;
      const fetchedInvoice = ctx.invoice_number || ctx.invoiceNumber || `INV-${numToFetch.replace(/\D/g, "") || "2026"}-001`;

      setHeader({
        receipt_type: "PO_RECEIPT",
        po_number: numToFetch,
        supplier_name: supplierName,
        supplier_company_name: supplierComp,
        asn_number: asnNum,
        gate_entry_number: gateNum,
        warehouse_name: warehouseName,
        grn_number: generatedGrnNum,
        vehicle_number: vehicleNum,
        driver_name: driverName,
        receiving_dock: prefilledDock,
        invoice_number: fetchedInvoice,
        received_by: loggedInUserName,
      });

      setGrnId(ctx.grn_id || null);
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

      if (mapped.length > 0) {
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
      console.error("Auto PO Fetch error:", err);
      toast.error(err.message || "Failed to fetch PO details");
    } finally {
      setLoadingContext(false);
    }
  }

  // Auto-fetch PO details whenever PO number changes
  useEffect(() => {
    const trimmed = header.po_number.trim();
    if (!trimmed || trimmed.length < 3) return;

    const timer = setTimeout(() => {
      void fetchPoContext(trimmed);
    }, 450);

    return () => clearTimeout(timer);
  }, [header.po_number]);

  // Page 1 -> Proceed to Page 2
  async function handleProceedFromPage1() {
    if (!header.receiving_dock) {
      toast.error("Please select or enter a Receiving Dock (e.g. DOCK-02)");
      return;
    }
    setBusyAction(true);
    try {
      const res = await api.createGrnHeader({
        receipt_type: header.receipt_type,
        po_number: header.po_number,
        dock_number: header.receiving_dock,
        invoice_number: header.invoice_number,
        supplier_name: header.supplier_name,
        vehicle_number: header.vehicle_number,
        driver_name: header.driver_name,
      });
      setGrnId(res.grn_id);
      setHeader((prev) => ({ ...prev, grn_number: res.grn_number || prev.grn_number }));
      toast.success(`GRN Header Saved: ${res.grn_number || header.grn_number}`);
      setCurrentPage(2);
    } catch (err: any) {
      toast.error("Failed to save GRN Header", { description: err.message });
    } finally {
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
    if (grnId) {
      setBusyAction(true);
      try {
        await api.updateGrnLines(
          grnId,
          materials.map((m) => ({
            item_code: m.item_code,
            good_quantity: m.good_quantity,
            damaged_quantity: m.damaged_quantity,
            material_name: m.material_name,
          })),
        );
      } catch (err) {
        console.warn("Backend update skipped:", err);
      } finally {
        setBusyAction(false);
      }
    }
    setCurrentPage(3);
  }

  // Page 3 Damaged Items Filter
  const damagedMaterials = materials.filter((m) => m.damaged_quantity > 0);

  // Page 4 Validation Check
  function getBatchValidation(itemCode: string) {
    const appQty = qualityApproved[itemCode] ?? 0;
    const batches = materialBatches[itemCode] || [];
    const totalBatchQty = batches.reduce((acc, b) => acc + Number(b.batch_quantity || 0), 0);
    const isValid = totalBatchQty === appQty;
    return { appQty, totalBatchQty, isValid };
  }

  const allBatchesValid = materials.every((m) => getBatchValidation(m.item_code).isValid);

  // Helper to format payload string for QR encoding and scanning
  function buildBatchQrPayload(batch: BatchEntry, itemCode: string) {
    const mat = materials.find((m) => m.item_code === itemCode);
    const todayStr = new Date().toISOString().split("T")[0];
    return `📦 WMS GOODS RECEIVING BATCH LABEL
----------------------------------------
• GRN Number       : ${header.grn_number}
• PO Reference     : ${header.po_number}
• Supplier Name    : ${header.supplier_name}
• Supplier Company : ${header.supplier_company_name}
• Warehouse / Dock : ${header.warehouse_name} / ${header.receiving_dock}
• ASN Number       : ${header.asn_number}
• Gate Entry No    : ${header.gate_entry_number}
• Vehicle Number   : ${header.vehicle_number}
• Driver Name      : ${header.driver_name}
• Material Code    : ${itemCode}
• Material Name    : ${mat?.material_name || itemCode}
• Category         : ${mat?.material_category || "Raw Materials"}
• Batch Number     : ${batch.batch_number}
• Batch Quantity   : ${batch.batch_quantity} ${mat?.uom || "PCS"}
• Inspection Date  : ${todayStr}
• Received By      : ${header.received_by || "System User"}
• Quality Status   : APPROVED & VERIFIED
----------------------------------------`;
  }

  // Page 6 QR Code Generation
  async function generateQrForBatch(batch: BatchEntry, itemCode: string) {
    const qrPayload = buildBatchQrPayload(batch, itemCode);
    try {
      const url = await QRCode.toDataURL(qrPayload, {
        margin: 2,
        width: 500,
        errorCorrectionLevel: "H",
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
            ${dataUrl ? `<img src="${dataUrl}" alt="QR Code" />` : '<div style="height:220px;line-height:220px;font-weight:bold;">GENERATING QR...</div>'}
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
    let globalIdx = 1;
    for (const m of filteredMaterials) {
      const bList = materialBatches[m.item_code] || [];
      for (const b of bList) {
        const key = `${m.item_code}_${b.batch_number}`;
        const qrInfo = qrLabels[key] || { qr_id: `QR-${globalIdx.toString().padStart(6, "0")}`, data_url: "" };
        globalIdx++;
        labelsHtml += `
          <div class="card">
            <div class="header">WMS GOODS RECEIVING BATCH LABEL</div>
            <h2>${b.batch_number}</h2>
            <p style="margin:2px 0;font-size:11px;font-weight:bold;color:#2563eb;">QR ID: ${qrInfo.qr_id}</p>
            ${qrInfo.data_url ? `<img src="${qrInfo.data_url}" alt="QR Code" />` : `<div style="height:180px;line-height:180px;font-weight:bold;">QR CODE</div>`}
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

  // Render QR Codes on Page 6 load & auto-sync when dependencies change (Compulsory Generation for All Materials)
  const [qrLabels, setQrLabels] = useState<Record<string, { qr_id: string; data_url: string; payload: string }>>({});

  useEffect(() => {
    let active = true;

    // Ensure EVERY material line item has batches compulsory
    const effectiveBatches: Record<string, BatchEntry[]> = { ...materialBatches };
    let updated = false;

    materials.forEach((m) => {
      if (!effectiveBatches[m.item_code] || effectiveBatches[m.item_code].length === 0) {
        effectiveBatches[m.item_code] = [
          { batch_number: `BATCH-${m.item_code}-001`, batch_quantity: m.good_quantity || 100 },
        ];
        updated = true;
      }
    });

    if (updated) {
      setMaterialBatches(effectiveBatches);
    }

    if (currentPage === 6 || active) {
      void (async () => {
        const generated: Record<string, { qr_id: string; data_url: string; payload: string }> = {};
        let globalIndex = 1;
        for (const [code, bList] of Object.entries(effectiveBatches)) {
          for (let i = 0; i < bList.length; i++) {
            const b = bList[i];
            if (!b) continue;
            const qrId = `QR-${globalIndex.toString().padStart(6, "0")}`;
            globalIndex++;
            const url = await generateQrForBatch(b, code);
            const payload = buildBatchQrPayload(b, code);
            generated[`${code}_${b.batch_number}`] = { qr_id: qrId, data_url: url, payload };
          }
        }
        if (active) {
          setQrLabels(generated);
        }
      })();
    }
    return () => {
      active = false;
    };
  }, [currentPage, materialBatches, header, materials]);

  return (
    <AppShell
      title="Goods Receiving (GRN) Console"
      subtitle="Connected Flow: Procurement PO → ASN → Gate Entry → GRN → Quality → Batch QR"
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
            <Plus className="mr-2 size-4" /> New 6-Page Entry
          </Button>
        </div>
      }
    >
      {/* 📊 GRN OPERATIONS DASHBOARD TAB */}
      {activeTab === "dashboard" && (
        <div className="space-y-6">
          {/* USER WELCOME & ROLE BADGE BANNER */}
          <Card className="rounded-2xl border bg-gradient-to-r from-primary/15 via-background to-muted p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-wider">
                    GRN Officer Console
                  </span>
                  <span className="text-xs text-muted-foreground" suppressHydrationWarning>User: <b className="text-foreground" suppressHydrationWarning>{loggedInUserName}</b></span>
                </div>
                <h2 className="text-2xl font-bold text-foreground mt-1">Goods Receiving Operations Dashboard</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Monitor active dock receiving, pending balance receipts, quality inspection pass rates, and batch QR code printing.
                </p>
              </div>

              <Button
                className="rounded-xl font-bold bg-primary hover:bg-primary/90 text-primary-foreground px-5 shadow-md"
                onClick={() => {
                  setActiveTab("wizard");
                  setCurrentPage(1);
                }}
              >
                <Plus className="mr-2 size-4" /> Start New 6-Page GRN
              </Button>
            </div>
          </Card>

          {/* KPI METRICS WIDGETS */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card
              className="rounded-2xl p-5 border shadow-sm hover:border-primary/60 hover:shadow-md transition-all cursor-pointer group bg-card"
              onClick={() => {
                setSearchTerm("");
                setActiveTab("records");
                toast.info("Viewing All Monthly GRN Receipts (48 Records)");
              }}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase text-muted-foreground group-hover:text-primary transition-colors">
                  Monthly GRN Receipts
                </span>
                <span className="rounded-full bg-primary/10 p-2 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  <ClipboardList className="size-4" />
                </span>
              </div>
              <p className="mt-2 font-mono text-3xl font-extrabold text-foreground">48</p>
              <p className="mt-1 text-[11px] text-emerald-600 font-semibold flex items-center">
                <TrendingUp className="mr-1 size-3" /> +12.5% vs last month · Click to View All
              </p>
            </Card>

            <Card
              className="rounded-2xl p-5 border shadow-sm hover:border-amber-400/60 hover:shadow-md transition-all cursor-pointer group bg-card"
              onClick={() => {
                setSearchTerm("PARTIALLY");
                setActiveTab("records");
                toast.info("Filtered: Partially Completed GRNs (3 Pending Balance Receipts)");
              }}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase text-muted-foreground group-hover:text-amber-700 transition-colors">
                  Partially Completed
                </span>
                <span className="rounded-full bg-amber-100 p-2 text-amber-800 group-hover:bg-amber-500 group-hover:text-white transition-colors">
                  <Clock className="size-4" />
                </span>
              </div>
              <p className="mt-2 font-mono text-3xl font-extrabold text-amber-700">3</p>
              <p className="mt-1 text-[11px] text-amber-600 font-semibold">
                Pending balance receipts against POs · Click to Filter
              </p>
            </Card>

            <Card
              className="rounded-2xl p-5 border shadow-sm hover:border-emerald-400/60 hover:shadow-md transition-all cursor-pointer group bg-card"
              onClick={() => {
                setSearchTerm("COMPLETED");
                setActiveTab("records");
                toast.info("Filtered: Completed & Posted GRNs (40 Stock Updated Records)");
              }}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase text-muted-foreground group-hover:text-emerald-700 transition-colors">
                  Completed & Posted
                </span>
                <span className="rounded-full bg-emerald-100 p-2 text-emerald-800 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                  <CheckCircle2 className="size-4" />
                </span>
              </div>
              <p className="mt-2 font-mono text-3xl font-extrabold text-emerald-700">40</p>
              <p className="mt-1 text-[11px] text-emerald-600 font-semibold">
                Stock updated & Putaway created · Click to Filter
              </p>
            </Card>

            <Card
              className="rounded-2xl p-5 border shadow-sm hover:border-purple-400/60 hover:shadow-md transition-all cursor-pointer group bg-card"
              onClick={() => {
                setShowQualityPassModal(true);
                toast.info("Opening Quality Pass Rate & Audit Breakdown");
              }}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase text-muted-foreground group-hover:text-purple-700 transition-colors">
                  Quality Pass Rate
                </span>
                <span className="rounded-full bg-purple-100 p-2 text-purple-800 group-hover:bg-purple-600 group-hover:text-white transition-colors">
                  <ShieldCheck className="size-4" />
                </span>
              </div>
              <p className="mt-2 font-mono text-3xl font-extrabold text-purple-700">99.3%</p>
              <p className="mt-1 text-[11px] text-purple-600 font-semibold">
                18,450 Good · 120 Damaged Units · Click for Audit Details
              </p>
            </Card>
          </div>

          {/* ACTIVE RECEIVING DOCKS WIDGET */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-foreground uppercase tracking-wide">Active Receiving Docks</h3>
            <div className="grid gap-4 sm:grid-cols-3">
              <Card className="rounded-2xl p-4 border border-emerald-300 bg-emerald-50/20 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-emerald-800 text-sm flex items-center">
                    <DoorOpen className="mr-1.5 size-4" /> DOCK-01 (Occupied)
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-200 text-emerald-900 uppercase">
                    Receiving
                  </span>
                </div>
                <div className="text-xs space-y-0.5 text-muted-foreground font-mono">
                  <p><b>Vehicle:</b> KA-01-EQ-9921</p>
                  <p><b>PO Ref:</b> PO-1001 (ABC Supplier)</p>
                </div>
                <Button
                  size="sm"
                  className="w-full rounded-xl text-xs font-bold mt-2"
                  onClick={() => {
                    setActiveTab("wizard");
                    setCurrentPage(2);
                  }}
                >
                  Continue Page 2 Receiving
                </Button>
              </Card>

              <Card className="rounded-2xl p-4 border border-blue-300 bg-blue-50/20 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-blue-800 text-sm flex items-center">
                    <DoorOpen className="mr-1.5 size-4" /> DOCK-02 (Assigned)
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-200 text-blue-900 uppercase">
                    Gate Verified
                  </span>
                </div>
                <div className="text-xs space-y-0.5 text-muted-foreground font-mono">
                  <p><b>Vehicle:</b> AP-02-AB-1234</p>
                  <p><b>Gate Entry:</b> GE-001 (Ramesh)</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full rounded-xl text-xs font-bold mt-2"
                  onClick={() => {
                    setActiveTab("wizard");
                    setCurrentPage(1);
                  }}
                >
                  Start Page 1 Entry
                </Button>
              </Card>

              <Card className="rounded-2xl p-4 border border-muted bg-muted/10 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-foreground text-sm flex items-center">
                    <DoorOpen className="mr-1.5 size-4" /> DOCK-03 (Available)
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-muted text-muted-foreground uppercase">
                    Idle
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">Ready for next incoming supplier vehicle assignment.</p>
              </Card>
            </div>
          </div>

          {/* RECENT GRN TRANSACTIONS */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-foreground uppercase tracking-wide">Recent Goods Receipts</h3>
              <Button variant="ghost" size="sm" className="text-xs font-bold text-primary" onClick={() => setActiveTab("records")}>
                View All Records →
              </Button>
            </div>

            <Card className="rounded-2xl overflow-hidden border shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-muted/50 font-bold uppercase text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3">GRN Number</th>
                      <th className="px-4 py-3">PO Reference</th>
                      <th className="px-4 py-3">Supplier Name</th>
                      <th className="px-4 py-3">Dock & Vehicle</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y font-medium">
                    <tr className="hover:bg-muted/20">
                      <td className="px-4 py-3 font-mono font-bold text-primary">GRN-0001</td>
                      <td className="px-4 py-3 font-mono">PO-1001</td>
                      <td className="px-4 py-3 font-bold text-foreground">ABC Supplier</td>
                      <td className="px-4 py-3 font-mono">Dock DOCK-02 · AP02AB1234</td>
                      <td className="px-4 py-3">
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800">
                          PARTIALLY COMPLETED
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="rounded-lg text-xs font-bold text-primary"
                          onClick={() => {
                            setActiveTab("wizard");
                            setCurrentPage(2);
                          }}
                        >
                          Open Entry
                        </Button>
                      </td>
                    </tr>
                    <tr className="hover:bg-muted/20">
                      <td className="px-4 py-3 font-mono font-bold text-primary">GRN-0002</td>
                      <td className="px-4 py-3 font-mono">PO-1002</td>
                      <td className="px-4 py-3 font-bold text-foreground">XYZ Industries</td>
                      <td className="px-4 py-3 font-mono">Dock DOCK-01 · KA01EQ9921</td>
                      <td className="px-4 py-3">
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                          COMPLETED
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button size="sm" variant="ghost" className="rounded-lg text-xs font-bold text-muted-foreground">
                          Posted
                        </Button>
                      </td>
                    </tr>
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
          <Card className="rounded-2xl p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="relative flex-1 min-w-[280px]">
                <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                <Input
                  placeholder="Search by GRN Number, PO Number, Supplier, Vehicle..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 rounded-xl"
                />
              </div>
              <Button variant="outline" className="rounded-xl" onClick={() => void loadRecords()}>
                <RefreshCw className="size-4" />
              </Button>
            </div>
          </Card>

          {loadingRecords ? (
            <div className="grid h-64 place-items-center">
              <Loader2 className="size-8 animate-spin text-primary" />
            </div>
          ) : grnRecords.length === 0 ? (
            <Card className="grid h-64 place-items-center rounded-2xl p-6 text-center text-muted-foreground">
              <div>
                <FileCheck2 className="mx-auto mb-3 size-10 text-muted-foreground/60" />
                <h3 className="text-base font-semibold text-foreground">No GRN Records Found</h3>
                <p className="mt-1 text-xs">Start a new 6-page Goods Receiving entry to post material receipts.</p>
                <Button
                  className="mt-4 rounded-xl"
                  onClick={() => {
                    setActiveTab("wizard");
                    setCurrentPage(1);
                  }}
                >
                  <Plus className="mr-2 size-4" /> Start GRN Page 1
                </Button>
              </div>
            </Card>
          ) : (
            <div className="grid gap-4">
              {grnRecords.map((r, idx) => (
                <Card key={r.grn_id || r.grn_number || r.id || `grn_rec_${idx}`} className="rounded-2xl p-5 border hover:shadow-md transition-all">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <span className="text-xs font-semibold uppercase text-muted-foreground">Goods Receipt Note</span>
                      <h3 className="font-mono text-xl font-bold text-primary">{r.grn_number || "GRN-0001"}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Received by <b className="text-foreground">{r.received_by || "John Doe"}</b>
                      </p>
                    </div>
                    <StatusBadge status={r.status} />
                  </div>
                  <div className="my-4 grid gap-3 rounded-xl border bg-muted/20 p-4 text-xs sm:grid-cols-2 lg:grid-cols-4">
                    <div>
                      <span className="text-muted-foreground block text-[11px] uppercase">PO Reference</span>
                      <span className="font-mono font-bold text-foreground">{r.po_number || "PO-1001"}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[11px] uppercase">Supplier</span>
                      <span className="font-bold text-foreground">{r.supplier_name || "ABC Supplier"}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[11px] uppercase">Receiving Dock</span>
                      <span className="font-bold text-foreground">Dock {r.dock_number || "DOCK-02"}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[11px] uppercase">Vehicle</span>
                      <span className="font-mono font-bold text-foreground">{r.vehicle_number || "AP02AB1234"}</span>
                    </div>
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
                    className={`flex-1 flex flex-col items-center text-center cursor-pointer transition-all ${
                      isCurrent
                        ? "scale-105 opacity-100 font-bold"
                        : isCompleted
                        ? "opacity-80 hover:opacity-100"
                        : "opacity-40 cursor-not-allowed"
                    }`}
                  >
                    <div
                      className={`flex size-8 items-center justify-center rounded-full text-xs font-bold transition-all ${
                        isCompleted
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
                {PAGES[currentPage - 1].title}
              </span>
              <p className="text-xs text-muted-foreground mt-0.5">{PAGES[currentPage - 1].subtitle}</p>
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
                    <span>PO Number (Type or Select) *</span>
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
                      onChange={(e) => setHeader({ ...header, po_number: e.target.value })}
                      className="rounded-xl font-mono text-base font-bold text-primary flex-1"
                    />
                    <select
                      value={header.po_number}
                      onChange={(e) => {
                        const val = e.target.value;
                        setHeader({ ...header, po_number: val });
                        void fetchPoContext(val);
                      }}
                      className="rounded-xl border bg-background px-3 py-2 text-xs font-bold text-primary max-w-[200px]"
                    >
                      {availablePos.length > 0 ? (
                        availablePos.map((p: any) => (
                          <option key={p.id || p.poNumber} value={p.poNumber || p.po_number}>
                            {p.poNumber || p.po_number} ({p.supplierName || p.supplier_name || "Supplier"})
                          </option>
                        ))
                      ) : (
                        <>
                          <option value="PO-2026-0003">PO-2026-0003 (obys)</option>
                          <option value="PO-2026-0004">PO-2026-0004 (obys)</option>
                          <option value="PO-2026-0005">PO-2026-0005 (obys)</option>
                          <option value="PO-2026-0006">PO-2026-0006 (Email Supplier)</option>
                          <option value="PO-2026-0007">PO-2026-0007 (Email Supplier)</option>
                        </>
                      )}
                    </select>
                  </div>
                </div>
                <Button onClick={() => void fetchPoContext()} disabled={loadingContext} className="rounded-xl font-semibold">
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
                  <span className="text-[11px] font-semibold uppercase text-muted-foreground">2. Supplier Name (Auto)</span>
                  <p className="text-sm font-bold text-foreground">{header.supplier_name || "ABC Supplier"}</p>
                </div>

                {/* 3. Supplier Company Name */}
                <div className="rounded-xl border bg-muted/10 p-3">
                  <span className="text-[11px] font-semibold uppercase text-muted-foreground">3. Supplier Company Name (Auto)</span>
                  <p className="text-sm font-bold text-foreground">{header.supplier_company_name || "ABC Industrial Supplies Pvt. Ltd."}</p>
                </div>

                {/* 4. ASN Number */}
                <div className="rounded-xl border bg-muted/10 p-3">
                  <span className="text-[11px] font-semibold uppercase text-muted-foreground">4. ASN Number (Auto)</span>
                  <p className="font-mono text-sm font-bold text-foreground">{header.asn_number || "ASN-001"}</p>
                </div>

                {/* 5. Gate Entry Number */}
                <div className="rounded-xl border bg-muted/10 p-3">
                  <span className="text-[11px] font-semibold uppercase text-muted-foreground">5. Gate Entry Number (Auto)</span>
                  <p className="font-mono text-sm font-bold text-foreground">{header.gate_entry_number || "GE-001"}</p>
                </div>

                {/* 6. Warehouse Name */}
                <div className="rounded-xl border bg-muted/10 p-3">
                  <span className="text-[11px] font-semibold uppercase text-muted-foreground">6. Warehouse Name (Auto)</span>
                  <p className="text-sm font-bold text-foreground">{header.warehouse_name || "Main Warehouse – Bangalore"}</p>
                </div>

                {/* 7. Receiving Dock */}
                <div className="rounded-xl border border-primary/40 bg-primary/5 p-3">
                  <label className="text-[11px] font-bold uppercase text-primary block mb-1">7. Receiving Dock (Manual Selection) *</label>
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
                  <span className="text-[11px] font-semibold uppercase text-muted-foreground">8. GRN Number (Auto-Generated 1 PO → 1 GRN)</span>
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
                    10. Vehicle Number ({header.receipt_type === "PO_RECEIPT" ? "Auto-Fetched" : "Manual"})
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
                    11. Driver Name ({header.receipt_type === "PO_RECEIPT" ? "Auto-Fetched" : "Manual"})
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
                  <label className="text-[11px] font-semibold uppercase text-muted-foreground block mb-1">12. Invoice Number</label>
                  <Input
                    value={header.invoice_number}
                    onChange={(e) => setHeader({ ...header, invoice_number: e.target.value })}
                    placeholder="INV-2026-001"
                    className="font-mono text-sm font-bold rounded-lg"
                  />
                </div>

                {/* 13. Received By */}
                <div className="rounded-xl border border-success/30 bg-success-soft/20 p-3 sm:col-span-2 lg:col-span-3">
                  <span className="text-[11px] font-bold uppercase text-success block">13. Received By (Captured Logged-In User)</span>
                  <div className="flex items-center gap-2 mt-1">
                    <User className="size-4 text-success" />
                    <span className="text-sm font-bold text-foreground">{header.received_by}</span>
                    <span className="text-xs text-muted-foreground">(Audit & Accountability Tracking)</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-4 border-t">
                <Button onClick={() => void handleProceedFromPage1()} disabled={busyAction} className="rounded-xl font-bold px-6">
                  {busyAction ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                  NEXT: Item Receiving Details <ArrowRight className="ml-2 size-4" />
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
                <Button onClick={() => void handleProceedFromPage2()} className="rounded-xl font-bold px-6">
                  NEXT: Damaged Goods & Photo Evidence <ArrowRight className="ml-2 size-4" />
                </Button>
              </div>
            </Card>
          )}

          {/* PAGE 3 – DAMAGED GOODS & PHOTO EVIDENCE */}
          {currentPage === 3 && (
            <Card className="rounded-2xl p-6 space-y-6 shadow-sm">
              <div className="border-b pb-4">
                <h3 className="font-bold text-foreground text-base">Page 3: Damaged Goods & Photo Evidence</h3>
                <p className="text-xs text-muted-foreground">
                  Damaged quantities auto-populated from Page 2. Capture photo evidence for Quality & Supplier Claims.
                </p>
              </div>

              {damagedMaterials.length === 0 ? (
                <div className="rounded-xl border bg-emerald-50 p-4 text-center text-sm font-medium text-emerald-800">
                  <CheckCircle2 className="mx-auto mb-2 size-6" />
                  No damaged items recorded on Page 2. You can proceed to Batch Creation.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3">Material Code</th>
                        <th className="px-4 py-3">Material Name</th>
                        <th className="px-4 py-3 text-right">Damaged Qty</th>
                        <th className="px-4 py-3">Photo Evidence</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {damagedMaterials.map((m) => (
                        <tr key={m.item_code}>
                          <td className="px-4 py-3 font-mono font-bold text-primary">{m.item_code}</td>
                          <td className="px-4 py-3 font-bold text-foreground">{m.material_name}</td>
                          <td className="px-4 py-3 text-right font-bold text-rose-600">{m.damaged_quantity} {m.uom}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <Input
                                type="file"
                                accept="image/*"
                                onChange={(e) => {
                                  if (e.target.files?.[0]) {
                                    const file = e.target.files[0];
                                    const url = URL.createObjectURL(file);
                                    setDamagePhotos((prev) => ({
                                      ...prev,
                                      [m.item_code]: { file, previewUrl: url },
                                    }));
                                    toast.success(`Photo evidence selected for ${m.item_code}`);
                                  }
                                }}
                                className="text-xs rounded-xl cursor-pointer max-w-[220px]"
                              />
                              {damagePhotos[m.item_code]?.previewUrl && (
                                <img
                                  src={damagePhotos[m.item_code].previewUrl}
                                  alt="Evidence"
                                  className="size-10 rounded-lg object-cover border"
                                />
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Quality Inspection Approved Quantity Input */}
              <div className="pt-4 border-t space-y-3">
                <h4 className="text-xs font-bold uppercase text-muted-foreground">Quality Inspection Approval</h4>
                <div className="grid gap-3 sm:grid-cols-3">
                  {materials.map((m) => (
                    <div key={m.item_code} className="rounded-xl border p-3 bg-muted/10">
                      <span className="font-bold text-xs text-foreground block">{m.material_name} ({m.item_code})</span>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-muted-foreground">Quality-Approved Qty:</span>
                        <Input
                          type="number"
                          value={qualityApproved[m.item_code] ?? m.good_quantity}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setQualityApproved((prev) => ({ ...prev, [m.item_code]: val }));
                          }}
                          className="w-24 font-bold text-right rounded-lg"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-between pt-4 border-t">
                <Button variant="outline" className="rounded-xl" onClick={() => setCurrentPage(2)}>
                  <ArrowLeft className="mr-2 size-4" /> Back to Page 2
                </Button>
                <Button onClick={() => setCurrentPage(4)} className="rounded-xl font-bold px-6">
                  NEXT: Batch Creation <ArrowRight className="ml-2 size-4" />
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
                                  list[bIdx] = { ...list[bIdx], batch_number: val };
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
                                  list[bIdx] = { ...list[bIdx], batch_quantity: val };
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
                  NEXT: Document Upload <ArrowRight className="ml-2 size-4" />
                </Button>
              </div>
            </Card>
          )}

          {/* PAGE 5 – DOCUMENT UPLOAD */}
          {currentPage === 5 && (
            <Card className="rounded-2xl p-6 space-y-6 shadow-sm">
              <div className="border-b pb-4">
                <h3 className="font-bold text-foreground text-base">Page 5: Document Upload</h3>
                <p className="text-xs text-muted-foreground">
                  Upload Invoice Copy, Delivery Challan, Packing List, Damage Photos, and Additional Documents.
                </p>
              </div>

              <div className="flex flex-wrap items-end gap-3 max-w-xl border-b pb-4">
                <div className="w-48">
                  <label className="text-xs font-bold text-foreground mb-1 block">Document Section</label>
                  <select
                    value={pendingDocType}
                    onChange={(e) => setPendingDocType(e.target.value as any)}
                    className="w-full rounded-xl border bg-background px-3 py-2 text-xs font-bold"
                  >
                    <option value="INVOICE">Invoice Copy</option>
                    <option value="DELIVERY_CHALLAN">Delivery Challan Copy</option>
                    <option value="PACKING_LIST">Packing List Copy</option>
                    <option value="DAMAGE_PHOTO">Damage Photo</option>
                    <option value="ADDITIONAL">Additional Document</option>
                  </select>
                </div>

                <div className="flex-1 min-w-[200px]">
                  <label className="text-xs font-bold text-foreground mb-1 block">Select File (Supports Multiple)</label>
                  <Input
                    type="file"
                    onChange={(e) => setPendingDocFile(e.target.files?.[0] || null)}
                    className="rounded-xl text-xs cursor-pointer"
                  />
                </div>

                <Button
                  onClick={() => {
                    if (!pendingDocFile) {
                      toast.error("Please choose a file to upload");
                      return;
                    }
                    const newDoc: UploadedDocument = {
                      category: pendingDocType,
                      file_name: pendingDocFile.name,
                      file_path: URL.createObjectURL(pendingDocFile),
                    };
                    setUploadedDocuments((prev) => [...prev, newDoc]);
                    setPendingDocFile(null);
                    toast.success(`Document uploaded to ${pendingDocType}`);
                  }}
                  className="rounded-xl font-bold"
                >
                  <Upload className="mr-1.5 size-4" /> Upload File
                </Button>
              </div>

              {/* Uploaded Documents List */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase text-muted-foreground">Attached Document Copies</h4>
                {uploadedDocuments.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">No optional documents uploaded yet.</p>
                ) : (
                  <div className="grid gap-2">
                    {uploadedDocuments.map((d, i) => (
                      <div key={d.document_id || d.file_name || `doc_${i}`} className="flex items-center justify-between rounded-xl border p-3 text-xs bg-muted/20">
                        <div className="flex items-center gap-2">
                          <FileText className="size-4 text-primary" />
                          <span className="font-bold text-foreground">{d.category}</span>
                          <span className="text-muted-foreground font-mono">{d.file_name}</span>
                        </div>
                        <a href={d.file_path} target="_blank" rel="noreferrer" className="text-primary underline font-bold">
                          View
                        </a>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-between pt-4 border-t">
                <Button variant="outline" className="rounded-xl" onClick={() => setCurrentPage(4)}>
                  <ArrowLeft className="mr-2 size-4" /> Back to Page 4
                </Button>
                <Button onClick={() => setCurrentPage(6)} className="rounded-xl font-bold px-6">
                  NEXT: QR Code Generation <ArrowRight className="ml-2 size-4" />
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
                <Button variant="outline" className="rounded-xl" onClick={() => window.print()}>
                  <Printer className="mr-2 size-4" /> Print Batch Labels
                </Button>
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

              {/* Material-wise Batch QR Labels Grid */}
              <div className="space-y-8">
                {(selectedQrMaterialCode === "ALL"
                  ? materials
                  : materials.filter((m) => m.item_code === selectedQrMaterialCode)
                ).map((mat, matIdx) => {
                  const bList = (materialBatches[mat.item_code] && materialBatches[mat.item_code].length > 0)
                    ? materialBatches[mat.item_code]
                    : [{ batch_number: `BATCH-${mat.item_code}-001`, batch_quantity: mat.good_quantity || 100 }];
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
                            const key = `${mat.item_code}_${b.batch_number}`;
                            const qrInfo = qrLabels[key] || {
                              qr_id: `QR-${(idx + 1).toString().padStart(6, "0")}`,
                              data_url: "",
                              payload: buildBatchQrPayload(b, mat.item_code),
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
                                      payload: qrInfo.payload || buildBatchQrPayload(b, mat.item_code),
                                      batch: b,
                                      itemCode: mat.item_code,
                                    })
                                  }
                                >
                                  {qrInfo.data_url ? (
                                    <div className="relative inline-block p-2 bg-white rounded-2xl border border-gray-200 shadow-sm transition-transform group-hover/qr:scale-105">
                                      <img src={qrInfo.data_url} alt="QR Code" className="size-48 mx-auto" />
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
                                        payload: qrInfo.payload || buildBatchQrPayload(b, mat.item_code),
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
                })}
              </div>


              <div className="flex justify-between pt-6 border-t">
                <Button variant="outline" className="rounded-xl" onClick={() => setCurrentPage(5)}>
                  <ArrowLeft className="mr-2 size-4" /> Back to Page 5
                </Button>
                <Button
                  onClick={() => {
                    toast.success("GOODS RECEIVING PROCESS COMPLETED!", {
                      description: `GRN ${header.grn_number} is saved and batch QR labels are printed.`,
                    });
                    setActiveTab("dashboard");
                    void loadRecords();
                  }}
                  className="rounded-xl font-bold bg-success hover:bg-success/90 text-white px-8 text-sm shadow-md"
                >
                  <ShieldCheck className="mr-2 size-5" /> COMPLETE GOODS RECEIVING
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
              <div className="rounded-xl border bg-black text-emerald-400 p-3 font-mono text-xs overflow-x-auto whitespace-pre leading-relaxed shadow-inner max-h-48">
                {enlargedQr.payload}
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="w-1/2 rounded-xl" onClick={() => setEnlargedQr(null)}>
                Close Preview
              </Button>
              <Button
                className="w-1/2 rounded-xl bg-primary text-white font-bold"
                onClick={() => printSingleQrLabel(enlargedQr.title, enlargedQr.itemCode, enlargedQr.qr_id, enlargedQr.data_url)}
              >
                <Printer className="mr-1.5 size-4" /> Print Label
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
    </AppShell>
  );
}
