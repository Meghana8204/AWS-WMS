import { createFileRoute, Link } from "@tanstack/react-router";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Camera,
  CheckCircle2,
  ClipboardCheck,
  Loader2,
  RefreshCw,
  ScanLine,
  ShieldCheck,
  Truck,
  UserRound,
  X,
  Upload,
  Printer,
  Trash2,
} from "lucide-react";
import { AppShell, StatusBadge } from "@/components/wms/app-shell";
import { SectionCard } from "@/components/wms/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { requireRole } from "@/lib/auth-utils";
import { PoCameraScanner } from "@/components/wms/PoCameraScanner";

async function compressFileForUpload(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let w = img.width;
      let h = img.height;
      const maxDim = 1024;
      if (w > maxDim || h > maxDim) {
        if (w > h) {
          h = Math.round((h * maxDim) / w);
          w = maxDim;
        } else {
          w = Math.round((w * maxDim) / h);
          h = maxDim;
        }
      }
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) { resolve(file); return; }
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob(
        (blob) => {
          if (!blob) { resolve(file); return; }
          resolve(new File([blob], file.name, { type: "image/jpeg" }));
        },
        "image/jpeg",
        0.82
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };
    img.src = url;
  });
}
export const Route = createFileRoute("/gate-entry")({
  beforeLoad: () => requireRole("GATE_SECURITY"),
  component: GateEntry,
});
type GateEntryRecord = {
  id: string;
  gate_entry_number?: string;
  poNumber: string;
  poStatus?: string;
  asnNumber?: string;
  asnStatus?: string;
  vehiclePlate: string;
  driverName: string;
  status: string;
  truckPhotoBase64?: string | null;
  verificationResult?: {
    reasons?: string[];
  } | null;
};
type CaptureKind = "po" | "vehicle";
type ArrivalLineItem = {
  material_code: string;
  material_description: string;
  quantity: string;
  uom: string;
};
const inputClass = "mt-1.5 h-10 rounded-xl border-border/80 bg-background";
function formatVehicleNumber(value: string): string {
  const compact = value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 11);
  const bharat = compact.match(/^(\d{2})BH(\d{4})([A-Z]{2})$/);
  if (bharat) return `${bharat[1]}-BH-${bharat[2]}-${bharat[3]}`;
  const standard = compact.match(/^([A-Z]{2})(\d{1,2})([A-Z]{1,3})(\d{4})$/);
  if (standard)
    return `${standard[1]}-${standard[2].padStart(2, "0")}-${standard[3]}-${standard[4]}`;
  return compact;
}
function isValidVehicleNumber(value: string): boolean {
  const compact = value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return /^(?:[A-Z]{2}\d{1,2}[A-Z]{1,3}\d{4}|\d{2}BH\d{4}[A-Z]{2})$/.test(compact);
}
function GateEntry() {
  const [entries, setEntries] = useState<GateEntryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [scanning, setScanning] = useState<CaptureKind | null>(null);
  const [poScannerOpen, setPoScannerOpen] = useState(false);
  const [poDocument, setPoDocument] = useState<File | null>(null);
  const [vehiclePhoto, setVehiclePhoto] = useState<File | null>(null);
  const [poPreview, setPoPreview] = useState<string | null>(null);
  const [vehiclePreview, setVehiclePreview] = useState<string | null>(null);
  const [poNumber, setPoNumber] = useState("");
  const [asnReference, setAsnReference] = useState("");
  const [poVerificationStatus, setPoVerificationStatus] = useState<
    "PO_VERIFIED" | "UNSCHEDULED_ARRIVAL" | null
  >(null);
  const [supplierName, setSupplierName] = useState("");
  const [materialDescription, setMaterialDescription] = useState("");
  const [totalQuantity, setTotalQuantity] = useState("");
  const [arrivalLineItems, setArrivalLineItems] = useState<ArrivalLineItem[]>([]);
  const [poDate, setPoDate] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [driverName, setDriverName] = useState("Driver");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [driverPhone, setDriverPhone] = useState("");
  const [extractedDetails, setExtractedDetails] = useState<Record<string, unknown> | null>(null);
  const [lastCreatedEntry, setLastCreatedEntry] = useState<GateEntryRecord | null>(null);
  const handleVehicleNumberChange = (rawVal: string) => {
    setVehicleNumber(formatVehicleNumber(rawVal));
  };
  const applyLineItems = (rawItems: unknown): boolean => {
    if (!Array.isArray(rawItems) || rawItems.length === 0) return false;
    const items = rawItems
      .map((item: any) => ({
        material_code: String(item.material_code ?? item.materialCode ?? ""),
        material_description: String(
          item.material_description ??
            item.materialDescription ??
            item.material_name ??
            item.materialName ??
            "",
        ),
        quantity: String(item.quantity ?? ""),
        uom: String(item.uom ?? item.unit ?? ""),
      }))
      .filter((item) => item.material_description || item.material_code);
    if (!items.length) return false;
    setArrivalLineItems(items);
    setMaterialDescription(
      items
        .map((item) => item.material_description)
        .filter(Boolean)
        .join(", "),
    );
    setTotalQuantity(String(items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0)));
    return true;
  };
  const updateLineItem = (index: number, field: keyof ArrivalLineItem, value: string) => {
    const items = arrivalLineItems.map((item, itemIndex) =>
      itemIndex === index ? { ...item, [field]: value } : item,
    );
    setArrivalLineItems(items);
    setMaterialDescription(
      items
        .map((item) => item.material_description)
        .filter(Boolean)
        .join(", "),
    );
    setTotalQuantity(String(items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0)));
  };
  const loadEntries = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      setEntries(await api.getGateEntries());
    } catch (error) {
      if (!quiet)
        toast.error("Unable to load gate entries", {
          description: error instanceof Error ? error.message : undefined,
        });
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);
  useEffect(() => {
    void loadEntries();
    const timer = window.setInterval(() => void loadEntries(true), 2000);
    return () => window.clearInterval(timer);
  }, [loadEntries]);
  useEffect(() => {
    if (poDocument) {
      const url = URL.createObjectURL(poDocument);
      setPoPreview(url);
      return () => URL.revokeObjectURL(url);
    }
    setPoPreview(null);
  }, [poDocument]);
  useEffect(() => {
    if (vehiclePhoto) {
      const url = URL.createObjectURL(vehiclePhoto);
      setVehiclePreview(url);
      return () => URL.revokeObjectURL(url);
    }
    setVehiclePreview(null);
  }, [vehiclePhoto]);
  async function scanCapture(kind: CaptureKind, file: File) {
    console.log(`Starting scanCapture for kind: ${kind}`, file);
    setScanning(null);
    if (kind === "po") setPoDocument(file);
    if (kind === "vehicle") setVehiclePhoto(file);
    const toastId = toast.loading(`OCR is analyzing ${kind === "po" ? "document" : "vehicle"}...`);
    try {
      console.log(`Calling api.scanOcr for ${kind}...`);
      const uploadFile = await compressFileForUpload(file);
      const result = await api.scanOcr(uploadFile, kind);
      console.log("OCR scan result:", result);
      const extraction = result.extraction || result;
      const fields = extraction.fields || {};
      setExtractedDetails({
        ...extraction,
        source: result.source || "ocr",
        confidence: result.confidence,
        verified_against_backend: result.verified ?? false,
      });
      const detectedPo = result.po_number || fields.po_number || fields.purchase_order_number;
      const detectedVehicle =
        result.vehicle_number ||
        fields.vehicle_number ||
        fields.license_plate ||
        fields.plate_number ||
        fields.license_plate_number;
      const detectedDriver = result.driver_name || fields.driver_name || fields.full_name;
      const detectedLicense = result.license_number || fields.license_number || fields.dl_number;
      if (detectedPo) {
        setPoNumber(detectedPo);
        if (kind === "po")
          setPoVerificationStatus(result.verified ? "PO_VERIFIED" : "UNSCHEDULED_ARRIVAL");
        void fetchPoDetails(String(detectedPo), true);
      }
      if (result.supplier_name || fields.supplier_name)
        setSupplierName(result.supplier_name || fields.supplier_name);
      const foundLineItems = applyLineItems(
        result.line_items || result.lineItems || fields.line_items || fields.lineItems,
      );
      if (!foundLineItems) {
        setArrivalLineItems([]);
        if (result.material_description || fields.material_description)
          setMaterialDescription(result.material_description || fields.material_description);
        const scannedQuantity = result.quantity ?? fields.quantity;
        if (scannedQuantity !== undefined && scannedQuantity !== null && scannedQuantity !== "")
          setTotalQuantity(String(scannedQuantity));
      }
      if (result.po_date || fields.po_date) setPoDate(result.po_date || fields.po_date);
      if (result.delivery_date || fields.delivery_date)
        setDeliveryDate(result.delivery_date || fields.delivery_date);
      if (detectedVehicle && detectedVehicle !== "NOT_FOUND") {
        handleVehicleNumberChange(detectedVehicle);
      }
      if (detectedDriver) setDriverName(detectedDriver);
      if (detectedLicense) setLicenseNumber(detectedLicense);
      if (kind === "po") {
        const missing = [
          ["supplier name", result.supplier_name || fields.supplier_name],
          ["material", result.material_description || fields.material_description],
          ["quantity", result.quantity ?? fields.quantity],
          ["PO date", result.po_date || fields.po_date],
          ["delivery date", result.delivery_date || fields.delivery_date],
        ]
          .filter(([, value]) => value === undefined || value === null || value === "")
          .map(([label]) => label);
        if (missing.length) {
          toast.warning("PO scanned with fields requiring review", {
            id: toastId,
            description: `Check: ${missing.join(", ")}`,
          });
        } else {
          toast.success(
            result.verified
              ? "PO verified and filled from backend"
              : "PO details extracted from image",
            {
              id: toastId,
              description: `Confidence: ${Math.round((Number(result.confidence) || 0) * 100)}%`,
            },
          );
        }
      } else if (kind === "vehicle") {
        toast.success(
          detectedVehicle === "NOT_FOUND"
            ? "Vehicle details extracted — enter the plate manually"
            : "Vehicle plate detected",
          {
            id: toastId,
            description: detectedVehicle === "NOT_FOUND" ? undefined : detectedVehicle,
          },
        );
      } else if (kind === "license") {
        toast.success("Driver details extracted", { id: toastId });
      }
    } catch (error: any) {
      console.error("OCR scan error:", error);
      toast.error("OCR scan failed", {
        id: toastId,
        description: error.message || "Falling back to manual entry.",
      });
    }
  }
  async function handlePoScannerSuccess(data: any, file: File) {
    setPoDocument(file);
    const result = data.ocr_result || data;
    const fields = data.extraction?.fields || result.extraction?.fields || {};

    setExtractedDetails({
      ...data,
      source: "local-ocr",
      confidence: result.confidence,
    });

    const detectedPo = result.po_number || fields.po_number;
    const detectedSupplier = result.supplier_name || fields.supplier_name;
    const detectedMaterial = result.material_description || fields.material_description;
    const detectedQty = result.total_quantity ?? result.quantity ?? fields.total_quantity ?? fields.quantity;
    const detectedPoDate = result.po_date || fields.po_date;
    const detectedDeliveryDate = result.delivery_date || fields.delivery_date;

    if (detectedPo) {
      setPoNumber(detectedPo);
      const previewStatus = data.computedStatus || data.computed_status || data.status;
      setPoVerificationStatus(previewStatus === "PO_VERIFIED" || data.verified ? "PO_VERIFIED" : "UNSCHEDULED_ARRIVAL");
      void fetchPoDetails(detectedPo, true);
    }
    if (detectedSupplier) setSupplierName(detectedSupplier);
    if (detectedMaterial) setMaterialDescription(detectedMaterial);
    if (detectedQty !== undefined && detectedQty !== null && detectedQty !== "") setTotalQuantity(String(detectedQty));
    if (detectedPoDate) setPoDate(detectedPoDate);
    if (detectedDeliveryDate) setDeliveryDate(detectedDeliveryDate);

    const lineItems = result.line_items || result.lineItems || fields.line_items || [];
    if (lineItems.length) {
      applyLineItems(lineItems);
    }
  }

  async function fetchPoDetails(number: string, preserveScannedFields = false) {
    if (!number || number.length < 5) return;
    const toastId = toast.loading(`Fetching details for PO: ${number}...`);
    try {
      const [purchaseOrders, asns] = await Promise.all([api.getPurchaseOrders(), api.getAsns()]);
      const lookup = number.trim().toUpperCase();
      const exactPo = purchaseOrders.find(
        (candidate: any) =>
          String(candidate.poNumber || candidate.po_number || "").toUpperCase() === lookup,
      );
      const prefixMatches = purchaseOrders.filter((candidate: any) =>
        String(candidate.poNumber || candidate.po_number || "")
          .toUpperCase()
          .startsWith(`${lookup}-`),
      );
      const po =
        exactPo ||
        prefixMatches.find((candidate: any) => {
          const candidateNumber = candidate.poNumber || candidate.po_number;
          return asns.some(
            (asn: any) =>
              String(asn.poNumber || asn.po_number || "").toUpperCase() ===
              String(candidateNumber).toUpperCase(),
          );
        }) ||
        (prefixMatches.length === 1 ? prefixMatches[0] : undefined);
      if (!po) {
        if (preserveScannedFields) {
          setPoVerificationStatus("UNSCHEDULED_ARRIVAL");
          setVehicleNumber("");
          toast.info("PO extracted but not stored in procurement", {
            id: toastId,
            description: `${number} will continue as an unscheduled arrival.`,
          });
          return;
        }
        throw new Error(`Complete purchase order not found for ${number}`);
      }
      const resolvedPoNumber = String(po.poNumber || po.po_number || number);
      setPoNumber(resolvedPoNumber);
      setPoVerificationStatus("PO_VERIFIED");
      const items = po.items || [];
      if (items.length) {
        applyLineItems(items);
      }

      setSupplierName((prev) => prev || po.supplierName || po.supplier_name || "");
      setPoDate((prev) => prev || po.poDate || po.po_date || "");
      setDeliveryDate((prev) => prev || po.expectedDeliveryDate || po.expected_delivery_date || "");

      const systemMat = items.map((i: any) => i.materialName || i.material_name).filter(Boolean).join(", ");
      if (systemMat) setMaterialDescription((prev) => prev || systemMat);

      const systemQty = items.reduce((sum: number, i: any) => sum + Number(i.quantity || 0), 0);
      if (systemQty > 0) setTotalQuantity((prev) => prev || String(systemQty));

      const shipment = asns.find(
        (asn: any) =>
          String(asn.poNumber || asn.po_number || "").toUpperCase() ===
          resolvedPoNumber.toUpperCase(),
      );
      setVehicleNumber("");
      if (shipment?.driverName || shipment?.driver_name) {
        setDriverName(shipment.driverName || shipment.driver_name);
      }
      if (shipment?.driverContact || shipment?.driver_contact) {
        setDriverPhone(shipment.driverContact || shipment.driver_contact);
      }
      toast.success(
        shipment?.vehicleNumber || shipment?.vehicle_number
          ? "PO and vehicle details fetched from system"
          : "PO details fetched; no submitted ASN vehicle found",
        { id: toastId },
      );
      if (shipment?.vehicleNumber || shipment?.vehicle_number) {
        handleVehicleNumberChange(shipment.vehicleNumber || shipment.vehicle_number);
      }
    } catch (error: any) {
      console.warn("Manual PO lookup failed:", error);
      toast.error(error.message || "PO not found in system", { id: toastId });
    }
  }
  async function fetchAsnDetails(reference: string) {
    if (!reference.trim()) return;
    const toastId = toast.loading(`Loading ASN ${reference}...`);
    try {
      const asns = await api.getAsns();
      const lookup = reference.trim().toUpperCase();
      const shipment = asns.find(
        (asn: any) =>
          String(asn.id || "").toUpperCase() === lookup ||
          String(asn.asnNumber || asn.asn_number || "").toUpperCase() === lookup,
      );
      if (!shipment) throw new Error(`ASN ${reference} was not found`);
      setAsnReference(shipment.asnNumber || shipment.asn_number || shipment.id);
      setPoNumber(shipment.poNumber || shipment.po_number || "");
      setSupplierName(shipment.supplierName || shipment.supplier_name || "");
      setVehicleNumber(
        formatVehicleNumber(shipment.vehicleNumber || shipment.vehicle_number || ""),
      );
      setDriverName(shipment.driverName || shipment.driver_name || "Driver");
      setDriverPhone(shipment.driverContact || shipment.driver_contact || "");
      setDeliveryDate(
        (shipment.expectedArrivalAt || shipment.expected_arrival_at || "").slice(0, 10),
      );
      applyLineItems(shipment.lines || shipment.items || []);
      toast.success("ASN details loaded", {
        id: toastId,
        description: "PO, supplier, vehicle and shipment data remain sourced from the ASN.",
      });
    } catch (error) {
      toast.error("Unable to load ASN", {
        id: toastId,
        description: error instanceof Error ? error.message : undefined,
      });
    }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    if (!vehiclePhoto) {
      return toast.error("Vehicle photo is required", {
        description: "Please capture or upload a vehicle photo before creating the entry.",
      });
    }
    if (!poNumber.trim()) {
      return toast.error("Purchase order number is required");
    }
    if (!supplierName.trim()) {
      return toast.error("Supplier name is required");
    }
    const parsedQty = parseFloat(totalQuantity);
    if (!totalQuantity || isNaN(parsedQty) || parsedQty <= 0) {
      return toast.error("Total quantity is required and must be greater than 0");
    }
    if (!vehicleNumber.trim()) {
      return toast.error("Vehicle number is required");
    }
    const isVehicleValid = isValidVehicleNumber(vehicleNumber);
    if (!isVehicleValid) {
      return toast.error("Invalid Vehicle Number format", {
        description: "Use a valid format such as MH-12-AB-1234 or 22-BH-1234-AA.",
      });
    }
    const form = new FormData(formElement);
    if (poDocument) form.append("po_document", poDocument);
    if (vehiclePhoto) form.append("vehicle_photo", vehiclePhoto);
    setSubmitting(true);
    try {
      const entry = await api.createGateEntry(form);
      const createdVehicle =
        entry.vehicleNumber ||
        entry.vehicle_number ||
        entry.vehiclePlate ||
        entry.vehicle_plate ||
        vehicleNumber;
      const createdPo = entry.poNumber || entry.po_number || poNumber;
      const createdGateNumber = entry.gateEntryNumber || entry.gate_entry_number;
      const createdDriver = entry.driverName || entry.driver_name || driverName;
      localStorage.setItem(
        "verified_gate_po",
        JSON.stringify({
          gateEntryId: entry.id,
          poNumber,
          supplierName,
          materialDescription,
          totalQuantity,
          poDate,
          deliveryDate,
          vehicleNumber,
          verifiedAt: new Date().toISOString(),
        }),
      );
      toast.success("Gate entry approved", {
        description: "The Warehouse Manager has been notified.",
      });
      setLastCreatedEntry({
        id: entry.id,
        gate_entry_number: createdGateNumber,
        poNumber: createdPo,
        poStatus: entry.poStatus,
        asnNumber: entry.asnNumber,
        asnStatus: entry.asnStatus,
        vehiclePlate: createdVehicle,
        driverName: createdDriver,
        status: entry.status,
      });
      formElement.reset();
      setPoDocument(null);
      setVehiclePhoto(null);
      setAsnReference("");
      setPoNumber("");
      setPoVerificationStatus(null);
      setSupplierName("");
      setMaterialDescription("");
      setTotalQuantity("");
      setArrivalLineItems([]);
      setPoDate("");
      setDeliveryDate("");
      setVehicleNumber("");
      setDriverName("Driver");
      setLicenseNumber("");
      setDriverPhone("");
      await loadEntries(true);
    } catch (error) {
      toast.error("Gate entry could not be created", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setSubmitting(false);
    }
  }
  const handleClearAll = async () => {
    if (!confirm("Are you sure you want to delete all gate entry data? This cannot be undone."))
      return;
    try {
      await api.resetGateEntries();
      toast.success("Gate entry data deleted successfully");
      void loadEntries();
    } catch (error) {
      toast.error("Failed to delete data");
    }
  };
  return (
    <AppShell
      title="Gate Entry"
      subtitle="Security verification, vehicle photo capture, and arrival queue management."
      actions={
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="rounded-xl text-destructive hover:bg-destructive/10 border-destructive/20"
            onClick={handleClearAll}
          >
            <Trash2 className="mr-2 size-4" /> Delete all data
          </Button>
          <Button
            variant="outline"
            className="rounded-xl"
            onClick={() => void loadEntries()}
            disabled={loading}
          >
            <RefreshCw className={`mr-2 size-4 ${loading ? "animate-spin" : ""}`} /> Refresh queue
          </Button>
        </div>
      }
    >
      <div className="grid gap-4 xl:grid-cols-3">
        <form onSubmit={submit} className="space-y-4 xl:col-span-2">
          <SectionCard
            title="ASN Reference Lookup (Optional)"
            description="Enter an ASN reference to quickly auto-populate PO, supplier, vehicle, and item details"
            icon={ScanLine}
          >
            <div className="w-full">
              <Label htmlFor="asn_reference">ASN Reference</Label>
              <div className="relative mt-1.5">
                <Input
                  suppressHydrationWarning
                  id="asn_reference"
                  name="asn_reference"
                  value={asnReference}
                  onChange={(e) => setAsnReference(e.target.value)}
                  onBlur={() => void fetchAsnDetails(asnReference)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void fetchAsnDetails(asnReference);
                    }
                  }}
                  placeholder="e.g. ASN-2026-0001 (Press Enter or click refresh to load)"
                  className={cn(inputClass, "pr-10")}
                />
                <button
                  suppressHydrationWarning
                  type="button"
                  onClick={() => void fetchAsnDetails(asnReference)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary transition-colors"
                  title="Load ASN Details"
                >
                  <RefreshCw className="size-4" />
                </button>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Arrival scanning & upload"
            description="Capture from camera or upload an image—OCR/ANPR will process either"
            icon={ScanLine}
          >
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 w-full">
              <ScanCard
                label="PO document"
                detail={poDocument ? "PO document ready" : "Optional (Scan/Upload)"}
                kind="po"
                captured={!!poDocument}
                onOpen={() => setPoScannerOpen(true)}
                onUpload={(f) => void scanCapture("po", f)}
              />
              <ScanCard
                label="Vehicle photo"
                detail={vehiclePhoto ? "Vehicle photo ready" : "Required"}
                kind="vehicle"
                captured={!!vehiclePhoto}
                onOpen={setScanning}
                onUpload={(f) => void scanCapture("vehicle", f)}
              />
            </div>

            {(poPreview || vehiclePreview) && (
              <div className="mt-6 grid gap-4 grid-cols-1 sm:grid-cols-2 w-full">
                {poPreview && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-[10px] uppercase font-bold text-muted-foreground">
                        PO Document
                      </Label>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 px-1 text-destructive"
                        onClick={() => setPoDocument(null)}
                      >
                        <X className="size-3" />
                      </Button>
                    </div>
                    <div className="aspect-[4/3] rounded-xl border border-border/60 overflow-hidden bg-muted/20">
                      <img
                        src={poPreview}
                        alt="PO Preview"
                        className="w-full h-full object-contain"
                      />
                    </div>
                  </div>
                )}
                {vehiclePreview && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-[10px] uppercase font-bold text-muted-foreground">
                        Vehicle Photo <span className="text-destructive">*</span>
                      </Label>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 px-1 text-destructive"
                        onClick={() => setVehiclePhoto(null)}
                      >
                        <X className="size-3" />
                      </Button>
                    </div>
                    <div className="aspect-[4/3] rounded-xl border border-border/60 overflow-hidden bg-muted/20">
                      <img
                        src={vehiclePreview}
                        alt="Vehicle Preview"
                        className="w-full h-full object-contain"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            <p className="mt-4 text-xs text-muted-foreground">
              <ShieldCheck className="mr-1 inline size-3.5 text-primary" />
              Captured or uploaded images stay attached to the audited gate-entry record.
            </p>
          </SectionCard>

          <SectionCard
            title="ASN shipment details"
            description="Read from the ASN and shown here for security verification"
            icon={Truck}
          >
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="relative">
                <Label htmlFor="po_number">
                  Purchase order number <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <Input
                    id="po_number"
                    name="po_number"
                    required
                    value={poNumber}
                    onChange={(e) => {
                      setPoNumber(e.target.value);
                      setPoVerificationStatus(null);
                    }}
                    onBlur={() => fetchPoDetails(poNumber)}
                    placeholder="Scan a purchase order"
                    className={cn(inputClass, "pr-10")}
                  />
                  <button
                    suppressHydrationWarning
                    type="button"
                    onClick={() => fetchPoDetails(poNumber)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary transition-colors"
                    title="Lookup PO details"
                  >
                    <RefreshCw className="size-4" />
                  </button>
                </div>
                {poVerificationStatus && (
                  <div className="mt-2">
                    <StatusBadge status={poVerificationStatus} />
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {poVerificationStatus === "PO_VERIFIED"
                        ? "Exact purchase order found in the procurement database."
                        : "Purchase order was not found; this will be recorded as an unscheduled arrival."}
                    </p>
                  </div>
                )}
              </div>
              <div>
                <Label htmlFor="supplier_name">
                  Supplier name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="supplier_name"
                  name="supplier_name"
                  required
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  placeholder="Auto-filled from PO"
                  className={inputClass}
                />
              </div>
              {arrivalLineItems.length ? (
                <div className="space-y-3 sm:col-span-2 lg:col-span-3">
                  <Label>Materials detected ({arrivalLineItems.length})</Label>
                  <div className="space-y-3">
                    {arrivalLineItems.map((item, index) => (
                      <div
                        key={`${item.material_code}-${index}`}
                        className="grid gap-3 rounded-xl border border-border/80 bg-muted/20 p-3 sm:grid-cols-2 lg:grid-cols-4"
                      >
                        <div>
                          <Label htmlFor={`material_code_${index}`}>Material code</Label>
                          <Input
                            id={`material_code_${index}`}
                            value={item.material_code}
                            onChange={(e) => updateLineItem(index, "material_code", e.target.value)}
                            className={inputClass}
                          />
                        </div>
                        <div className="lg:col-span-2">
                          <Label htmlFor={`material_description_${index}`}>
                            Material description
                          </Label>
                          <Input
                            id={`material_description_${index}`}
                            value={item.material_description}
                            onChange={(e) =>
                              updateLineItem(index, "material_description", e.target.value)
                            }
                            className={inputClass}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label htmlFor={`quantity_${index}`}>Quantity</Label>
                            <Input
                              id={`quantity_${index}`}
                              type="number"
                              min="0"
                              step="any"
                              value={item.quantity}
                              onChange={(e) => updateLineItem(index, "quantity", e.target.value)}
                              className={inputClass}
                            />
                          </div>
                          <div>
                            <Label htmlFor={`uom_${index}`}>UOM</Label>
                            <Input
                              id={`uom_${index}`}
                              value={item.uom}
                              onChange={(e) => updateLineItem(index, "uom", e.target.value)}
                              className={inputClass}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <input type="hidden" name="material_description" value={materialDescription} />
                  <input type="hidden" name="total_quantity" value={totalQuantity} />
                </div>
              ) : (
                <>
                  <div>
                    <Label htmlFor="material_description">Material description</Label>
                    <Input
                      id="material_description"
                      name="material_description"
                      value={materialDescription}
                      onChange={(e) => setMaterialDescription(e.target.value)}
                      placeholder="Auto-filled from PO"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <Label htmlFor="total_quantity">
                      Total quantity <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="total_quantity"
                      name="total_quantity"
                      type="number"
                      min="0.01"
                      step="any"
                      required
                      value={totalQuantity}
                      onChange={(e) => setTotalQuantity(e.target.value)}
                      placeholder="Auto-filled from PO"
                      className={inputClass}
                    />
                  </div>
                </>
              )}
              <div>
                <Label htmlFor="po_date">PO date</Label>
                <Input
                  id="po_date"
                  name="po_date"
                  type="date"
                  min={new Date().toISOString().split("T")[0]}
                  value={poDate}
                  onChange={(e) => setPoDate(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <Label htmlFor="delivery_date">Delivery date</Label>
                <Input
                  id="delivery_date"
                  name="delivery_date"
                  type="date"
                  min={new Date().toISOString().split("T")[0]}
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div className="relative">
                <Label htmlFor="vehicle_number">
                  Vehicle number <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="vehicle_number"
                  name="vehicle_number"
                  required
                  value={vehicleNumber}
                  onChange={(e) => handleVehicleNumberChange(e.target.value)}
                  placeholder="MH-12-AB-1234"
                  className={cn(
                    inputClass,
                    vehicleNumber && !isValidVehicleNumber(vehicleNumber)
                      ? "border-destructive focus-visible:ring-destructive"
                      : "",
                  )}
                />
                {vehicleNumber && !isValidVehicleNumber(vehicleNumber) && (
                  <p className="absolute -bottom-5 left-0 text-[10px] font-medium text-destructive animate-in fade-in slide-in-from-top-1">
                    Format: MH-12-AB-1234 or 22-BH-1234-AA
                  </p>
                )}
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Driver information"
            description="Add any details that cannot be captured automatically"
            icon={UserRound}
          >
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <Label htmlFor="driver_name">Driver name</Label>
                <Input
                  id="driver_name"
                  name="driver_name"
                  value={driverName}
                  onChange={(e) => setDriverName(e.target.value)}
                  className={inputClass}
                  required
                />
              </div>
              <div>
                <Label htmlFor="driver_license_number">Licence number</Label>
                <Input
                  id="driver_license_number"
                  name="driver_license_number"
                  value={licenseNumber}
                  onChange={(e) => setLicenseNumber(e.target.value)}
                  placeholder="MH12 2016 004821"
                  className={inputClass}
                />
              </div>
              <div>
                <Label htmlFor="driver_phone">Phone number</Label>
                <Input
                  id="driver_phone"
                  name="driver_phone"
                  type="tel"
                  value={driverPhone}
                  onChange={(e) => setDriverPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className={inputClass}
                />
              </div>
            </div>
          </SectionCard>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/20 bg-primary-soft/50 p-4">
            <p className="text-sm text-muted-foreground">
              Creating the entry publishes the verified arrival to the yard in real time.
            </p>
            <Button
              type="submit"
              className="rounded-xl shadow-glow"
              disabled={
                submitting ||
                !vehiclePhoto ||
                !poNumber.trim() ||
                !supplierName.trim() ||
                !totalQuantity ||
                parseFloat(totalQuantity) <= 0 ||
                !vehicleNumber.trim() ||
                !isValidVehicleNumber(vehicleNumber)
              }
            >
              {submitting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <ClipboardCheck className="size-4" />
              )}
              {submitting ? "Creating entry…" : "Create gate entry"}
            </Button>
          </div>
        </form>

        <SectionCard
          title="Live gate queue"
          description="Refreshes automatically every 2 seconds"
          icon={CheckCircle2}
        >
          {loading ? (
            <div className="flex min-h-56 items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Loading live entries…
            </div>
          ) : entries.length === 0 ? (
            <div className="grid min-h-56 place-items-center rounded-xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground">
              No gate entries yet.
            </div>
          ) : (
            <div className="space-y-3">
              {entries.slice(0, 8).map((entry) => (
                <div key={entry.id} className="relative group">
                  <div className="flex items-center gap-3 rounded-xl border border-border/70 p-3 transition-colors hover:border-primary/30 hover:bg-primary-soft">
                    {entry.truckPhotoBase64 ? (
                      <div className="size-14 shrink-0 overflow-hidden rounded-lg border border-border/40">
                        <img
                          src={`data:image/jpeg;base64,${entry.truckPhotoBase64}`}
                          alt="Vehicle"
                          className="h-full w-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="grid size-14 shrink-0 place-items-center rounded-lg bg-muted border border-border/40 text-muted-foreground">
                        <Truck className="size-6" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <Link
                          to="/vehicle-queue"
                          className="truncate font-mono text-sm font-semibold text-primary hover:underline"
                        >
                          {entry.vehiclePlate || "NO PLATE"}
                        </Link>
                        <StatusBadge status={entry.status} />
                      </div>
                      <p className="mt-0.5 truncate text-sm font-medium">{entry.driverName}</p>
                      <p className="mt-0.5 font-mono text-[10px] text-muted-foreground uppercase tracking-tight">
                        PO: {entry.poNumber}
                      </p>
                      {entry.gate_entry_number && (
                        <p className="mt-0.5 font-mono text-[9px] text-muted-foreground/70">
                          {entry.gate_entry_number}
                        </p>
                      )}
                      {entry.verificationResult?.reasons?.[0] && (
                        <p className="mt-1.5 text-[10px] text-warning-foreground font-medium">
                          ⚠️ {entry.verificationResult.reasons[0]}
                        </p>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-2 bottom-2 size-8 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 backdrop-blur-sm border border-border/50 shadow-sm"
                    title="Print Gate Pass"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      void api.downloadGatePass(entry.id, entry.gate_entry_number);
                    }}
                  >
                    <Printer className="size-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
      {scanning && (
        <CameraScanner
          kind={scanning}
          onClose={() => setScanning(null)}
          onCapture={(file) => void scanCapture(scanning, file)}
        />
      )}
      {poScannerOpen && (
        <PoCameraScanner
          onClose={() => setPoScannerOpen(false)}
          onOcrSuccess={handlePoScannerSuccess}
        />
      )}
      {lastCreatedEntry && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-foreground/60 p-4 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="relative w-full max-w-sm rounded-3xl bg-card p-6 shadow-2xl border border-border/50 animate-in zoom-in-95 duration-200">
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-4 top-4 rounded-full"
              onClick={() => setLastCreatedEntry(null)}
            >
              <X className="size-5" />
            </Button>

            <div className="text-center">
              <div className="mx-auto mb-4 grid size-12 place-items-center rounded-full bg-success-soft text-success">
                <CheckCircle2 className="size-6" />
              </div>
              <h3 className="text-xl font-bold tracking-tight">Gate Entry Approved</h3>
              <p className="text-sm text-muted-foreground">Warehouse Manager notified.</p>
            </div>

            <div className="mt-8 space-y-4 rounded-2xl border border-dashed border-border bg-muted/30 p-5">
              <div className="flex flex-col items-center border-b border-border/50 pb-4 text-center">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Pass Number
                </span>
                <span className="mt-1 font-mono text-lg font-black text-primary">
                  {lastCreatedEntry.gate_entry_number}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    PO Number
                  </span>
                  <p className="mt-1 font-mono text-sm font-bold">{lastCreatedEntry.poNumber}</p>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Vehicle No
                  </span>
                  <p className="mt-1 font-mono text-sm font-bold">
                    {lastCreatedEntry.vehiclePlate}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    PO Status
                  </span>
                  <div className="mt-1.5">
                    {lastCreatedEntry.poStatus ? (
                      <StatusBadge status={lastCreatedEntry.poStatus} />
                    ) : (
                      <span className="text-[10px] font-medium text-muted-foreground italic tracking-tight">
                        Manual entry
                      </span>
                    )}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    ASN Status
                  </span>
                  <div className="mt-1.5">
                    {lastCreatedEntry.asnStatus ? (
                      <StatusBadge status={lastCreatedEntry.asnStatus} />
                    ) : (
                      <span className="text-[10px] font-medium text-muted-foreground italic tracking-tight">
                        Direct arrival
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Status
                </span>
                <div className="mt-1.5">
                  <StatusBadge status={lastCreatedEntry.status} />
                </div>
              </div>
            </div>

            <div className="mt-8 grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                className="rounded-xl font-bold"
                onClick={() => setLastCreatedEntry(null)}
              >
                Done
              </Button>
              <Button
                className="rounded-xl font-bold shadow-glow"
                onClick={() => {
                  void api.downloadGatePass(
                    lastCreatedEntry.id,
                    lastCreatedEntry.gate_entry_number,
                  );
                }}
              >
                <Printer className="mr-2 size-4" /> Print Pass
              </Button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
function ScanCard({
  label,
  detail,
  kind,
  captured,
  onOpen,
  onUpload,
  hideCamera = false,
}: {
  label: string;
  detail: string;
  kind: CaptureKind;
  captured: boolean;
  onOpen: (kind: CaptureKind) => void;
  onUpload: (file: File) => void;
  hideCamera?: boolean;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const isRequired = detail.toLowerCase().includes("required");
  return (
    <div
      suppressHydrationWarning
      className={cn(
        "relative flex flex-col justify-between rounded-2xl border p-4 transition-all duration-200",
        captured
          ? "border-success/40 bg-success-soft/20 shadow-sm"
          : isRequired
            ? "border-primary/30 bg-card hover:border-primary/50 hover:shadow-md"
            : "border-border bg-card hover:border-primary/30 hover:shadow-sm",
      )}
    >
      <div
        suppressHydrationWarning
        role="button"
        tabIndex={0}
        onClick={() => (hideCamera ? fileInput.current?.click() : onOpen(kind))}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            hideCamera ? fileInput.current?.click() : onOpen(kind);
          }
        }}
        className="cursor-pointer space-y-3"
      >
        <div className="flex items-center justify-between">
          <span
            className={cn(
              "grid size-10 place-items-center rounded-xl transition-colors",
              captured
                ? "bg-success text-success-foreground shadow-sm"
                : "bg-primary/10 text-primary",
            )}
          >
            {captured ? (
              <CheckCircle2 className="size-5" />
            ) : hideCamera ? (
              <Upload className="size-5" />
            ) : (
              <Camera className="size-5" />
            )}
          </span>
          <Badge
            variant="outline"
            className={cn(
              "text-[10px] font-bold uppercase tracking-wider",
              captured
                ? "border-success/30 bg-success-soft text-success"
                : isRequired
                  ? "border-destructive/30 bg-destructive/10 text-destructive"
                  : "border-border text-muted-foreground",
            )}
          >
            {captured ? "Attached" : isRequired ? "Required *" : "Optional"}
          </Badge>
        </div>

        <div>
          <p className="text-sm font-semibold text-foreground">{label}</p>
          <p className="text-xs text-muted-foreground">{detail}</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 pt-3 border-t border-border/50">
        {!hideCamera && (
          <Button
            suppressHydrationWarning
            type="button"
            variant="outline"
            size="sm"
            className="h-8 w-full rounded-xl text-xs font-semibold bg-background hover:bg-primary-soft hover:text-primary hover:border-primary/40 transition-colors"
            onClick={() => onOpen(kind)}
          >
            <Camera className="mr-1.5 size-3.5" /> Camera
          </Button>
        )}
        <Button
          suppressHydrationWarning
          type="button"
          variant="outline"
          size="sm"
          className={cn(
            "h-8 w-full rounded-xl text-xs font-semibold transition-colors",
            hideCamera
              ? "col-span-2 bg-primary text-primary-foreground hover:bg-primary/90"
              : "bg-background hover:bg-primary-soft hover:text-primary hover:border-primary/40",
          )}
          onClick={() => fileInput.current?.click()}
        >
          <Upload className="mr-1.5 size-3.5" /> Upload
        </Button>
      </div>

      <input
        suppressHydrationWarning
        type="file"
        ref={fileInput}
        className="hidden"
        accept="image/*"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onUpload(file);
        }}
      />
    </div>
  );
}
function ExtractedDetails({ details }: { details: Record<string, unknown> }) {
  const fields =
    details.fields && typeof details.fields === "object" && !Array.isArray(details.fields)
      ? (details.fields as Record<string, unknown>)
      : details;
  const entries = Object.entries(fields).filter(
    ([, value]) => value !== null && value !== "" && typeof value !== "object",
  );
  const rawText = typeof details.raw_text === "string" ? details.raw_text : "";
  return (
    <div className="space-y-4">
      {entries.length > 0 ? (
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          {entries.map(([label, value]) => (
            <div key={label} className="border-b border-border/60 pb-2">
              <dt className="text-xs capitalize text-muted-foreground">
                {label.replace(/_/g, " ")}
              </dt>
              <dd className="mt-0.5 break-words text-sm font-medium">{String(value)}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="text-sm text-muted-foreground">
          No readable structured details were found in this image.
        </p>
      )}
      {rawText && (
        <details className="rounded-xl border border-border bg-muted/30 p-3">
          <summary className="cursor-pointer text-sm font-medium">View all readable text</summary>
          <pre className="mt-3 max-h-48 overflow-auto whitespace-pre-wrap font-sans text-xs text-muted-foreground">
            {rawText}
          </pre>
        </details>
      )}
    </div>
  );
}
function CameraScanner({
  kind,
  onClose,
  onCapture,
}: {
  kind: CaptureKind;
  onClose: () => void;
  onCapture: (file: File) => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let mounted = true;
    if (navigator.mediaDevices?.getUserMedia) {
      navigator.mediaDevices
        .getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false })
        .then((active) => {
          if (mounted) {
            stream.current = active;
            if (video.current) {
              video.current.srcObject = active;
            }
          } else {
            active.getTracks().forEach((track) => track.stop());
          }
        })
        .catch((err) => {
          console.error("Camera access error:", err);
          if (mounted) setError("Camera access was blocked. Allow camera access and try again.");
        });
    } else {
      setError("Camera not supported on this browser.");
    }
    return () => {
      mounted = false;
      if (stream.current) {
        stream.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);
  function capture() {
    const element = video.current;
    if (!element || !element.videoWidth) return;
    const canvas = document.createElement("canvas");
    const maxDim = 2000;
    let width = element.videoWidth;
    let height = element.videoHeight;
    if (width > height) {
      if (width > maxDim) {
        height *= maxDim / width;
        width = maxDim;
      }
    } else {
      if (height > maxDim) {
        width *= maxDim / height;
        height = maxDim;
      }
    }
    canvas.width = width;
    canvas.height = height;
    canvas.getContext("2d")?.drawImage(element, 0, 0, width, height);
    canvas.toBlob(
      (blob) => {
        if (blob) {
          onCapture(new File([blob], `${kind}-scan-${Date.now()}.jpg`, { type: "image/jpeg" }));
        }
      },
      "image/jpeg",
      0.95,
    );
  }
  const title = kind === "po" ? "Scan purchase order" : "Capture vehicle photo";
  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-foreground/80 p-4 backdrop-blur-sm">
      <div className="flex max-h-full w-full max-w-2xl flex-col rounded-3xl bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border/50 p-5">
          <div>
            <h3 className="text-lg font-bold tracking-tight">{title}</h3>
            <p className="text-xs text-muted-foreground">
              Align the subject inside the camera frame.
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="rounded-full"
            onClick={onClose}
          >
            <X className="size-5" />
          </Button>
        </div>

        <div className="relative flex-1 overflow-hidden bg-black/5 p-2">
          {error ? (
            <div className="flex h-64 flex-col items-center justify-center p-8 text-center">
              <div className="mb-4 rounded-full bg-destructive/10 p-3 text-destructive">
                <X className="size-6" />
              </div>
              <p className="text-sm font-medium text-destructive">{error}</p>
            </div>
          ) : (
            <video
              ref={video}
              autoPlay
              playsInline
              muted
              className="h-full w-full rounded-2xl bg-muted object-cover"
              style={{ minHeight: "320px", maxHeight: "60vh" }}
            />
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-border/50 p-5">
          <Button
            type="button"
            variant="outline"
            className="rounded-xl h-11 px-6 font-bold"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="rounded-xl h-11 px-8 font-bold shadow-glow"
            disabled={!!error}
            onClick={capture}
          >
            <Camera className="mr-2 size-4" /> Capture & scan
          </Button>
        </div>
      </div>
    </div>
  );
}
