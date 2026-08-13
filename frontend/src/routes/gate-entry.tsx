import { createFileRoute, Link } from "@tanstack/react-router";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Camera, CheckCircle2, ClipboardCheck, Loader2, RefreshCw, ScanLine, ShieldCheck, Truck, UserRound, X, Upload } from "lucide-react";
import { AppShell, StatusBadge } from "@/components/wms/app-shell";
import { SectionCard } from "@/components/wms/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api-client";

export const Route = createFileRoute("/gate-entry")({ component: GateEntry });

type GateEntryRecord = { id: string; po_number: string; vehicle_number: string; driver_name: string; status: string; verification_result?: { reasons?: string[] } | null };
type CaptureKind = "po" | "vehicle" | "driver" | "license";
const inputClass = "mt-1.5 h-10 rounded-xl border-border/80 bg-background";

function GateEntry() {
  const [entries, setEntries] = useState<GateEntryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [scanning, setScanning] = useState<CaptureKind | null>(null);
  const [poDocument, setPoDocument] = useState<File | null>(null);
  const [vehiclePhoto, setVehiclePhoto] = useState<File | null>(null);
  const [driverPhoto, setDriverPhoto] = useState<File | null>(null);
  const [licensePhoto, setLicensePhoto] = useState<File | null>(null);
  const [poNumber, setPoNumber] = useState("");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [driverName, setDriverName] = useState("Driver");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [driverPhone, setDriverPhone] = useState("");
  const [extractedDetails, setExtractedDetails] = useState<Record<string, unknown> | null>(null);

  const loadEntries = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try { setEntries(await api.getGateEntries()); }
    catch (error) { if (!quiet) toast.error("Unable to load gate entries", { description: error instanceof Error ? error.message : undefined }); }
    finally { if (!quiet) setLoading(false); }
  }, []);

  useEffect(() => {
    void loadEntries();
    const timer = window.setInterval(() => void loadEntries(true), 10000);
    return () => window.clearInterval(timer);
  }, [loadEntries]);

  async function scanCapture(kind: CaptureKind, file: File) {
    console.log(`Starting scanCapture for kind: ${kind}`, file);
    setScanning(null);
    if (kind === "po") setPoDocument(file);
    if (kind === "vehicle") setVehiclePhoto(file);
    if (kind === "driver") { setDriverPhoto(file); toast.success("Driver photo captured"); return; }
    if (kind === "license") setLicensePhoto(file);

    const toastId = toast.loading(`Gemini is analyzing ${kind === "po" ? "document" : kind === "vehicle" ? "vehicle" : "ID"}...`);

    try {
      console.log(`Calling api.geminiScan for ${kind}...`);
      const result = await api.geminiScan(file, kind);
      console.log("Gemini Scan Result:", result);

      const extraction = result.extraction || result;
      const fields = extraction.fields || {};
      setExtractedDetails(extraction);

      // Greedy extraction: if we find these core fields in ANY scan, fill them
      const detectedPo = result.po_number || fields.po_number || fields.purchase_order_number;
      const detectedVehicle = result.vehicle_number || fields.vehicle_number || fields.license_plate || fields.plate_number || fields.license_plate_number;
      const detectedDriver = result.driver_name || fields.driver_name || fields.full_name;
      const detectedLicense = result.license_number || fields.license_number || fields.dl_number;

      if (detectedPo) setPoNumber(detectedPo);
      if (detectedVehicle && detectedVehicle !== "NOT_FOUND") setVehicleNumber(detectedVehicle);
      if (detectedDriver) setDriverName(detectedDriver);
      if (detectedLicense) setLicenseNumber(detectedLicense);

      if (kind === "po") {
        toast.success("PO details extracted", { id: toastId, description: result.supplier_name ? `Vendor: ${result.supplier_name}` : undefined });
      } else if (kind === "vehicle") {
        toast.success(detectedVehicle === "NOT_FOUND" ? "Vehicle details extracted — enter the plate manually" : "Vehicle plate detected", { id: toastId, description: detectedVehicle === "NOT_FOUND" ? undefined : detectedVehicle });
      } else if (kind === "license") {
        toast.success("Driver details extracted", { id: toastId });
      }
    } catch (error: any) {
      console.error("Gemini Scan Error:", error);
      toast.error("AI Scan failed", {
        id: toastId,
        description: error.message || "Falling back to manual entry."
      });
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!poDocument) return toast.error("Scan or upload the purchase order document before creating the entry");
    const form = new FormData(event.currentTarget);
    form.append("po_document", poDocument);
    if (vehiclePhoto) form.append("vehicle_photo", vehiclePhoto);
    if (driverPhoto) form.append("driver_photo", driverPhoto);
    if (licensePhoto) form.append("license_photo", licensePhoto);
    setSubmitting(true);
    try {
      const entry = await api.createGateEntry(form);
      toast.success("Gate entry created", { description: `${entry.vehicle_number} was published to the live queue.` });
      event.currentTarget.reset();
      setPoDocument(null); setVehiclePhoto(null); setDriverPhoto(null); setLicensePhoto(null);
      setPoNumber(""); setVehicleNumber(""); setDriverName("Driver"); setLicenseNumber(""); setDriverPhone("");
      await loadEntries(true);
    } catch (error) { toast.error("Gate entry could not be created", { description: error instanceof Error ? error.message : undefined }); }
    finally { setSubmitting(false); }
  }

  return <AppShell title="Gate entry" subtitle="Powered by Gemini AI. Scan or upload images to automatically fill arrival and driver details." actions={<Button variant="outline" className="rounded-xl" onClick={() => void loadEntries()} disabled={loading}><RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} /> Refresh queue</Button>}>
    <div className="grid gap-4 xl:grid-cols-3">
      <form onSubmit={submit} className="space-y-4 xl:col-span-2">
        <SectionCard title="Arrival scanning & upload" description="Capture from camera or upload an image—OCR/ANPR will process either" icon={ScanLine}>
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            <ScanCard label="PO document" detail={poDocument ? "PO document ready" : "Required"} kind="po" captured={!!poDocument} onOpen={setScanning} onUpload={(f) => void scanCapture("po", f)} />
            <ScanCard label="Vehicle plate" detail={vehiclePhoto ? "Vehicle photo ready" : "Optional"} kind="vehicle" captured={!!vehiclePhoto} onOpen={setScanning} onUpload={(f) => void scanCapture("vehicle", f)} />
            <ScanCard label="Driver photo" detail={driverPhoto ? "Driver photo ready" : "Optional"} kind="driver" captured={!!driverPhoto} onOpen={setScanning} onUpload={(f) => void scanCapture("driver", f)} />
            <ScanCard label="Driver ID / Licence" detail={licensePhoto ? "ID photo ready" : "Optional"} kind="license" captured={!!licensePhoto} onOpen={setScanning} onUpload={(f) => void scanCapture("license", f)} />
          </div>
          <p className="mt-4 text-xs text-muted-foreground"><ShieldCheck className="mr-1 inline size-3.5 text-primary" />Captured or uploaded images stay attached to the audited gate-entry record.</p>
        </SectionCard>

        <SectionCard title="Auto-filled arrival details" description="Review values detected by OCR and ANPR before submission" icon={Truck}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><Label htmlFor="po_number">Purchase order number</Label><Input id="po_number" name="po_number" value={poNumber} onChange={(e) => setPoNumber(e.target.value)} placeholder="Scan a purchase order" className={inputClass} /></div>
            <div><Label htmlFor="vehicle_number">Vehicle number</Label><Input id="vehicle_number" name="vehicle_number" value={vehicleNumber} onChange={(e) => setVehicleNumber(e.target.value)} placeholder="Scan a vehicle plate" className={inputClass} /></div>
          </div>
        </SectionCard>

        {extractedDetails && <SectionCard title="AI extracted details" description="All readable information from the most recently scanned file" icon={ScanLine}>
          <ExtractedDetails details={extractedDetails} />
        </SectionCard>}

        <SectionCard title="Driver information" description="Add any details that cannot be captured automatically" icon={UserRound}>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div><Label htmlFor="driver_name">Driver name</Label><Input id="driver_name" name="driver_name" value={driverName} onChange={(e) => setDriverName(e.target.value)} className={inputClass} required /></div>
            <div><Label htmlFor="driver_license_number">Licence number</Label><Input id="driver_license_number" name="driver_license_number" value={licenseNumber} onChange={(e) => setLicenseNumber(e.target.value)} placeholder="MH12 2016 004821" className={inputClass} /></div>
            <div><Label htmlFor="driver_phone">Phone number</Label><Input id="driver_phone" name="driver_phone" type="tel" value={driverPhone} onChange={(e) => setDriverPhone(e.target.value)} placeholder="+91 98765 43210" className={inputClass} /></div>
          </div>
        </SectionCard>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/20 bg-primary-soft/50 p-4"><p className="text-sm text-muted-foreground">Creating the entry publishes the verified arrival to the yard in real time.</p><Button type="submit" className="rounded-xl shadow-glow" disabled={submitting || !poDocument}>{submitting ? <Loader2 className="size-4 animate-spin" /> : <ClipboardCheck className="size-4" />}{submitting ? "Creating entry…" : "Create gate entry"}</Button></div>
      </form>

      <SectionCard title="Live gate queue" description="Refreshes automatically every 10 seconds" icon={CheckCircle2}>
        {loading ? <div className="flex min-h-56 items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Loading live entries…</div> : entries.length === 0 ? <div className="grid min-h-56 place-items-center rounded-xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground">No gate entries yet.</div> : <div className="space-y-3">{entries.slice(0, 8).map((entry) => <Link key={entry.id} to="/vehicle-queue" className="block rounded-xl border border-border/70 p-3 transition-colors hover:border-primary/30 hover:bg-primary-soft"><div className="flex items-start justify-between gap-2"><p className="font-mono text-sm font-semibold text-primary">{entry.vehicle_number}</p><StatusBadge status={entry.status} /></div><p className="mt-1 truncate text-sm">{entry.driver_name}</p><p className="mt-1 font-mono text-xs text-muted-foreground">{entry.po_number}</p>{entry.verification_result?.reasons?.[0] && <p className="mt-2 text-xs text-warning-foreground">{entry.verification_result.reasons[0]}</p>}</Link>)}</div>}
      </SectionCard>
    </div>
    {scanning && <CameraScanner kind={scanning} onClose={() => setScanning(null)} onCapture={(file) => void scanCapture(scanning, file)} />}
  </AppShell>;
}

function ScanCard({ label, detail, kind, captured, onOpen, onUpload }: { label: string; detail: string; kind: CaptureKind; captured: boolean; onOpen: (kind: CaptureKind) => void; onUpload: (file: File) => void }) {
  const fileInput = useRef<HTMLInputElement>(null);

  return (
    <div className="relative flex flex-col gap-2">
      <button
        type="button"
        onClick={() => onOpen(kind)}
        className="flex-1 rounded-2xl border border-dashed border-border bg-muted/30 p-4 text-left transition-colors hover:border-primary/40 hover:bg-primary-soft"
      >
        <span className={`grid size-9 place-items-center rounded-xl ${captured ? "bg-success-soft text-success" : "bg-primary-soft text-primary"}`}>
          {captured ? <CheckCircle2 className="size-[18px]" /> : <Camera className="size-[18px]" />}
        </span>
        <p className="mt-3 text-sm font-semibold">{label}</p>
        <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
      </button>

      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 w-full rounded-lg text-[10px]"
          onClick={() => onOpen(kind)}
        >
          <Camera className="mr-1 size-3" /> Camera
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 w-full rounded-lg text-[10px]"
          onClick={() => fileInput.current?.click()}
        >
          <Upload className="mr-1 size-3" /> Upload
        </Button>
      </div>

      <input
        type="file"
        ref={fileInput}
        className="hidden"
        accept="image/*"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onUpload(file);
          e.target.value = ""; // Reset for same file re-upload
        }}
      />
    </div>
  );
}

function ExtractedDetails({ details }: { details: Record<string, unknown> }) {
  const fields = details.fields && typeof details.fields === "object" && !Array.isArray(details.fields)
    ? details.fields as Record<string, unknown>
    : details;
  const entries = Object.entries(fields).filter(([, value]) => value !== null && value !== "" && typeof value !== "object");
  const rawText = typeof details.raw_text === "string" ? details.raw_text : "";

  return <div className="space-y-4">
    {entries.length > 0 ? <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
      {entries.map(([label, value]) => <div key={label} className="border-b border-border/60 pb-2"><dt className="text-xs capitalize text-muted-foreground">{label.replace(/_/g, " ")}</dt><dd className="mt-0.5 break-words text-sm font-medium">{String(value)}</dd></div>)}
    </dl> : <p className="text-sm text-muted-foreground">No readable structured details were found in this image.</p>}
    {rawText && <details className="rounded-xl border border-border bg-muted/30 p-3"><summary className="cursor-pointer text-sm font-medium">View all readable text</summary><pre className="mt-3 max-h-48 overflow-auto whitespace-pre-wrap font-sans text-xs text-muted-foreground">{rawText}</pre></details>}
  </div>;
}

function CameraScanner({ kind, onClose, onCapture }: { kind: CaptureKind; onClose: () => void; onCapture: (file: File) => void }) {
  const video = useRef<HTMLVideoElement>(null); const stream = useRef<MediaStream | null>(null); const [error, setError] = useState("");
  useEffect(() => { navigator.mediaDevices?.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false }).then((active) => { stream.current = active; if (video.current) video.current.srcObject = active; }).catch(() => setError("Camera access was blocked. Allow camera access and try again.")); return () => stream.current?.getTracks().forEach((track) => track.stop()); }, []);
  function capture() {
    const element = video.current;
    if (!element || !element.videoWidth) return;

    const canvas = document.createElement("canvas");
    // Resize for speed: Max dimension 1280px is plenty for OCR/ANPR
    const maxDim = 1280;
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
    canvas.toBlob((blob) => {
      if (blob) onCapture(new File([blob], `${kind}-scan-${Date.now()}.jpg`, { type: "image/jpeg" }));
    }, "image/jpeg", 0.85); // Optimized quality for speed vs detail
  }
  return <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/70 p-4"><div className="w-full max-w-2xl rounded-2xl bg-card p-4 shadow-lift"><div className="mb-3 flex items-center justify-between"><div><p className="font-semibold">{kind === "po" ? "Scan purchase order" : kind === "vehicle" ? "Scan vehicle plate" : "Capture driver photo"}</p><p className="text-xs text-muted-foreground">Align the subject inside the camera frame.</p></div><Button type="button" variant="ghost" size="icon" onClick={onClose}><X className="size-5" /></Button></div>{error ? <p className="rounded-xl bg-danger-soft p-4 text-sm text-destructive">{error}</p> : <video ref={video} autoPlay playsInline className="max-h-[60vh] w-full rounded-xl bg-muted object-contain" />}<div className="mt-4 flex justify-end gap-2"><Button type="button" variant="outline" className="rounded-xl" onClick={onClose}>Cancel</Button><Button type="button" className="rounded-xl" disabled={!!error} onClick={capture}><Camera className="size-4" /> Capture & scan</Button></div></div></div>;
}
