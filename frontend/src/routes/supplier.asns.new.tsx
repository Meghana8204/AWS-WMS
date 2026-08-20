import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  Calendar as CalendarIcon,
  Building2,
  FileText,
  Loader2,
  Package,
  Truck,
  CheckCircle2,
  Info,
  Upload,
  X,
  Plus,
  File as FileIcon
} from "lucide-react";
import { AppShell } from "@/components/wms/app-shell";
import { SectionCard } from "@/components/wms/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { requireRole } from "@/lib/auth-utils";

export const Route = createFileRoute("/supplier/asns/new")({
  beforeLoad: () => requireRole("SUPPLIER"),
  component: NewAsn,
});

const inputClass = "mt-1.5 h-11 rounded-xl border-border/80 bg-background focus:ring-primary/20";

function NewAsn() {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as any;
  const poId = search.po_id || search.poId || "";
  const poNumberFromSearch = search.po_number || search.poNumber || "";
  const draftStorageKey = `supplier-asn-draft:${poId || poNumberFromSearch || "new"}`;
  const draftHydrated = useRef(false);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [po, setPo] = useState<any>(null);
  const [asnNumber, setAsnNumber] = useState("");

  const [formData, setFormData] = useState({
    shipment_date: new Date().toISOString().split("T")[0],
    expected_arrival_date: "",
    vehicle_number: "",
    driver_name: "",
    driver_contact: "",
    transporter: "",
    number_of_packages: "",
    package_type: "",
  });

  const [lines, setLines] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [uploadingDoc, setUploadingDoc] = useState(false);

  useEffect(() => {
    async function init() {
      try {
        draftHydrated.current = false;
        setLoading(true);

        let savedDraft: any = null;
        try {
          const saved = localStorage.getItem(draftStorageKey);
          savedDraft = saved ? JSON.parse(saved) : null;
          if (savedDraft?.formData) setFormData((current) => ({ ...current, ...savedDraft.formData }));
          if (Array.isArray(savedDraft?.documents)) setDocuments(savedDraft.documents);
        } catch {
          localStorage.removeItem(draftStorageKey);
        }

        // 1. Fetch next ASN number
        const { asnNumber: nextAsn } = await api.getNextAsnNumber();
        setAsnNumber(nextAsn);

        // 2. Fetch PO details if poId is provided
        if (poId) {
          const poData = await api.getPurchaseOrder(poId);
          setPo(poData);

          // Initialize lines from PO items
          const poItems = poData.items || poData.lines || [];
          setLines(poItems.map((item: any) => {
            const itemCode = item.itemCode || item.materialCode || item.material_code;
            const savedLine = savedDraft?.lines?.find((line: any) => line.item_code === itemCode);
            return {
              item_code: itemCode,
              material_name: item.materialName || item.material_name,
              uom: item.uom || "PCS",
              ordered_quantity: parseFloat(item.quantity) || 0,
              already_shipped_quantity: 0, // In a real app, track cumulative shipments
              shipped_quantity: savedLine?.shipped_quantity ?? (parseFloat(item.quantity) || 0),
            };
          }));
        }
      } catch (err: any) {
        toast.error("Initialization failed", { description: err.message });
      } finally {
        draftHydrated.current = true;
        setLoading(false);
      }
    }
    init();
  }, [draftStorageKey, poId]);

  useEffect(() => {
    if (loading || !draftHydrated.current) return;

    localStorage.setItem(draftStorageKey, JSON.stringify({
      formData,
      lines,
      documents,
      updatedAt: new Date().toISOString(),
    }));
  }, [asnNumber, documents, draftStorageKey, formData, lines, loading]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };


  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingDoc(true);
    try {
      // Reusing supplier document upload for now as it's a generic multipart endpoint
      const response = await api.uploadSupplierDocument(type, file);

      const newDoc = {
        document_type: type,
        file_name: file.name,
        file_url: response.storage_path || response.file_url || "",
        uploaded_by: "Supplier User", // In a real app, get from auth context
        uploaded_at: new Date().toISOString(),
      };

      setDocuments(prev => [...prev, newDoc]);
      toast.success(`${type} uploaded successfully`);
    } catch (error: any) {
      toast.error("Upload failed", { description: error.message });
    } finally {
      setUploadingDoc(false);
    }
  };

  const removeDocument = (index: number) => {
    setDocuments(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!poId) {
        toast.error("No Purchase Order referenced");
        return;
    }

    setSubmitting(true);
    try {
      // Validate quantities before submission
      const overShippedItems = lines.filter(l => (l.shipped_quantity + l.already_shipped_quantity) > l.ordered_quantity);
      if (overShippedItems.length > 0) {
        toast.error("Over-shipment detected", {
          description: `Items ${overShippedItems.map(i => i.item_code).join(", ")} exceed ordered quantity.`
        });
        setSubmitting(false);
        return;
      }

      const payload = {
        po_id: poId || null,
        po_number: String(po?.poNumber || poNumberFromSearch || ""),
        asn_number: asnNumber,
        shipment_date: formData.shipment_date || null,
        expected_arrival_at: formData.expected_arrival_date ? new Date(formData.expected_arrival_date).toISOString() : null,
        vehicle_number: String(formData.vehicle_number || ""),
        driver_name: String(formData.driver_name || ""),
        driver_contact: String(formData.driver_contact || ""),
        transporter: String(formData.transporter || ""),
        number_of_packages: parseInt(formData.number_of_packages) || 0,
        package_type: String(formData.package_type || ""),
        status: "SUBMITTED",
        documents: documents,
        lines: lines.map(l => ({
          item_code: String(l.item_code),
          shipped_quantity: parseFloat(l.shipped_quantity as any) || 0,
          material_name: String(l.material_name || ""),
          uom: String(l.uom || "PCS"),
        })),
      };

      const createdAsn = await api.createAsn(payload);
      localStorage.removeItem(draftStorageKey);
      toast.success("Advance Shipment Notice submitted successfully");
      navigate({
        to: "/procurement/asns/$asnId",
        params: { asnId: createdAsn.id },
      });
    } catch (error: any) {
      toast.error("Failed to submit ASN", { description: error.message });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center gap-3">
        <Loader2 className="size-8 animate-spin text-primary" />
        <span className="text-sm text-muted-foreground">Preparing ASN workspace...</span>
      </div>
    );
  }

  return (
    <AppShell
      title="Create Advance Shipment Notice"
      subtitle={`PO: ${po?.poNumber || poNumberFromSearch} · Supplier Portal`}
      actions={
        <Button variant="outline" className="rounded-xl" onClick={() => window.history.back()}>
          <ArrowLeft className="mr-2 size-4" /> Back
        </Button>
      }
    >
      <form onSubmit={handleSubmit} className="mx-auto max-w-5xl space-y-6 pb-20">
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <SectionCard title="ASN Information" icon={FileText}>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>ASN Number</Label>
                  <div className="h-11 flex items-center px-4 rounded-xl bg-muted/50 border border-border font-mono text-sm font-bold text-primary">
                    {asnNumber}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Reference PO Number</Label>
                  <div className="h-11 flex items-center px-4 rounded-xl bg-muted/50 border border-border font-mono text-sm font-bold">
                    {po?.poNumber || poNumberFromSearch}
                  </div>
                </div>
                <div className="space-y-1.5 col-span-2">
                  <Label>Supplier</Label>
                  <div className="h-11 flex items-center px-4 rounded-xl bg-muted/50 border border-border text-sm font-medium">
                    {po?.supplierName || "Independent Supplier"}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="shipment_date">Shipment Date</Label>
                  <Input
                    id="shipment_date"
                    name="shipment_date"
                    type="date"
                    min={new Date().toISOString().split("T")[0]}
                    className={inputClass}
                    value={formData.shipment_date}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="expected_arrival_date">Expected Arrival Date</Label>
                  <Input
                    id="expected_arrival_date"
                    name="expected_arrival_date"
                    type="date"
                    min={new Date().toISOString().split("T")[0]}
                    className={inputClass}
                    value={formData.expected_arrival_date}
                    onChange={handleInputChange}
                    required
                  />
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Shipment Contents" description="Specify quantities for this dispatch" icon={Package}>
              <div className="rounded-2xl border border-border/40 overflow-hidden bg-card">
                <table className="w-full text-xs text-left">
                  <thead className="bg-muted/50 border-b border-border/40 text-[10px] uppercase font-bold text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3">Material</th>
                      <th className="px-4 py-3 text-right">Ordered</th>
                      <th className="px-4 py-3 text-right">Already Shipped</th>
                      <th className="px-4 py-3 text-right">UOM</th>
                      <th className="px-4 py-3 text-right w-32">Shipped This Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/20">
                    {lines.map((line, idx) => (
                      <tr key={idx} className="hover:bg-muted/5 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-bold text-primary font-mono">{line.item_code}</div>
                          <div className="text-muted-foreground">{line.material_name}</div>
                        </td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums">
                          {line.ordered_quantity.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums text-muted-foreground">
                          {line.already_shipped_quantity.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {line.uom}
                        </td>
                        <td className="px-4 py-3">
                          <div className="h-8 flex items-center justify-end px-3 rounded-lg text-xs font-mono text-right bg-muted/50 border border-border/40 font-bold text-primary">
                            {line.shipped_quantity.toLocaleString()}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {lines.length === 0 && (
                        <tr>
                            <td colSpan={3} className="px-4 py-12 text-center text-muted-foreground italic">
                                <Info className="size-5 mx-auto mb-2 opacity-50" />
                                No items found in the referenced Purchase Order.
                            </td>
                        </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </SectionCard>

            <SectionCard title="Attachments" description="Upload supporting shipping documents" icon={Upload}>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  {[
                    "Invoice",
                    "Other"
                  ].map((type) => (
                    <div key={type} className="relative">
                      <input
                        type="file"
                        id={`file-${type}`}
                        className="hidden"
                        onChange={(e) => handleFileUpload(e, type)}
                        disabled={uploadingDoc}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full h-20 flex-col gap-2 rounded-xl border-dashed border-2 hover:border-primary/50 hover:bg-primary/5 group"
                        onClick={() => document.getElementById(`file-${type}`)?.click()}
                        disabled={uploadingDoc}
                      >
                        {uploadingDoc ? (
                          <Loader2 className="size-5 animate-spin text-primary" />
                        ) : documents.some((d) => d.document_type === type) ? (
                          <CheckCircle2 className="size-5 text-success" />
                        ) : (
                          <Plus className="size-5 text-muted-foreground group-hover:text-primary transition-colors" />
                        )}
                        <span className="text-[10px] uppercase font-bold">{type}</span>
                      </Button>
                    </div>
                  ))}
                </div>

                {documents.length > 0 && (
                  <div className="mt-6 space-y-2">
                    <Label className="text-xs text-muted-foreground">Uploaded Documents</Label>
                    <div className="grid gap-2">
                      {documents.map((doc, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border/50">
                          <div className="flex items-center gap-3">
                            <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                              <FileIcon className="size-4" />
                            </div>
                            <div>
                              <div className="text-sm font-medium">{doc.file_name}</div>
                              <div className="text-[10px] text-muted-foreground uppercase">{doc.document_type} · {new Date(doc.uploaded_at).toLocaleDateString()}</div>
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-8 text-destructive hover:text-destructive hover:bg-destructive/10 rounded-lg"
                            onClick={() => removeDocument(idx)}
                          >
                            <X className="size-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </SectionCard>
          </div>

          <div className="space-y-6">
            <SectionCard title="Logistics Details" icon={Truck}>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="transporter">Transporter</Label>
                  <Input
                    id="transporter"
                    name="transporter"
                    placeholder="e.g. Blue Dart, DHL"
                    className={inputClass}
                    value={formData.transporter}
                    onChange={handleInputChange}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="vehicle_number">Vehicle Number</Label>
                  <Input
                    id="vehicle_number"
                    name="vehicle_number"
                    placeholder="e.g. MH-12-PQ-1234"
                    className={cn(inputClass, "uppercase")}
                    value={formData.vehicle_number}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="number_of_packages">Number of Packages</Label>
                    <Input
                      id="number_of_packages"
                      name="number_of_packages"
                      type="number"
                      min="0"
                      placeholder="0"
                      className={inputClass}
                      value={formData.number_of_packages}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="package_type">Package Type</Label>
                    <Input
                      id="package_type"
                      name="package_type"
                      placeholder="e.g. Boxes, Pallets"
                      className={inputClass}
                      value={formData.package_type}
                      onChange={handleInputChange}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="driver_name">Driver Name</Label>
                  <Input
                    id="driver_name"
                    name="driver_name"
                    placeholder="Full Name"
                    className={inputClass}
                    value={formData.driver_name}
                    onChange={handleInputChange}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="driver_contact">Driver Contact</Label>
                  <Input
                    id="driver_contact"
                    name="driver_contact"
                    placeholder="+91 XXXXX XXXXX"
                    className={inputClass}
                    value={formData.driver_contact}
                    onChange={handleInputChange}
                  />
                </div>

                <div className="pt-4 border-t border-border mt-4">
                    <div className="rounded-xl bg-primary-soft/10 border border-primary/20 p-4">
                        <div className="flex gap-3 text-xs text-primary leading-relaxed font-medium">
                            <CheckCircle2 className="size-4 shrink-0 mt-0.5" />
                            <span>By submitting this ASN, you confirm that the goods listed above have been dispatched.</span>
                        </div>
                    </div>
                </div>

                <div className="grid gap-3 mt-6">
                  <Button
                    type="submit"
                    className="w-full h-12 rounded-xl shadow-glow"
                    disabled={submitting || lines.length === 0}
                  >
                    {submitting ? <Loader2 className="mr-2 size-4 animate-spin" /> : <CheckCircle2 className="mr-2 size-4" />}
                    Submit ASN
                  </Button>
                </div>
              </div>
            </SectionCard>
          </div>
        </div>
      </form>
    </AppShell>
  );
}
