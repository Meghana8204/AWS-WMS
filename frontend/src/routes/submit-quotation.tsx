import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  FileText,
  Calendar,
  Building,
  Package,
  CheckCircle,
  AlertTriangle,
  Loader2,
  DollarSign,
  Truck,
  ShieldCheck,
  FileCheck
} from "lucide-react";
import { AppShell } from "@/components/wms/app-shell";
import { SectionCard } from "@/components/wms/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/submit-quotation")({
  component: SubmitQuotation,
});

function SubmitQuotation() {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as any;
  const rfqId = search.rfqId || "";

  const [loading, setLoading] = useState(true);
  const [rfq, setRfq] = useState<any | null>(null);
  const [existingQuote, setExistingQuote] = useState<any | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [isLocked, setIsLocked] = useState(false);

  // Supplier user state
  const [supplierId, setSupplierId] = useState("");
  const [username, setUsername] = useState("");

  // Bid form state
  const [itemsData, setItemsData] = useState<Record<string, { unitPrice: string; availableQty: string }>>({});
  const [metaData, setMetaData] = useState({
    discount: "0",
    tax: "18",
    freightCharges: "0",
    deliveryTime: "",
    expectedDeliveryDate: "",
    paymentTerms: "Net 30",
    quotationValidity: "",
    remarks: "",
  });

  // Document Upload state
  const [uploadedDocs, setUploadedDocs] = useState<Array<{ document_type: string; file_name: string; file_url: string }>>([]);

  useEffect(() => {
    // Check if supplier is logged in
    const userInfoStr = localStorage.getItem("user_info");
    if (!userInfoStr) {
      toast.error("Please login first to submit a quotation");
      const redirect = encodeURIComponent(window.location.pathname + window.location.search);
      navigate({ to: `/login?redirect=${redirect}` });
      return;
    }

    const userInfo = JSON.parse(userInfoStr);
    if (!userInfo.roles?.includes("SUPPLIER")) {
      toast.error("Unauthorized. Only suppliers can submit quotations.");
      navigate({ to: "/login" });
      return;
    }

    setSupplierId(userInfo.supplierId || "");
    setUsername(userInfo.username || "");

    if (!rfqId) {
      setLoading(false);
      return;
    }

    // Fetch RFQ details and check for existing quotations
    const fetchRfqAndQuotation = async () => {
      try {
        const sid = userInfo.supplierId || "";
        const [rfqData, quotesList] = await Promise.all([
          api.getRfq(rfqId),
          api.getQuotations(rfqId, sid)
        ]);

        setRfq(rfqData);

        // Check if there is an existing quotation (Draft or Submitted)
        const existing = quotesList.find((q: any) => q.rfq_id === rfqId && q.supplier_id === sid);
        if (existing) {
          setExistingQuote(existing);
          setIsLocked(existing.status === "SUBMITTED");

          // Map items data
          const mappedItems: any = {};
          existing.lines?.forEach((line: any) => {
            mappedItems[line.item_code] = {
              unitPrice: String(line.unit_price),
              availableQty: String(line.quantity),
            };
          });
          setItemsData(mappedItems);

          // Map meta data
          setMetaData({
            discount: String(existing.discount || "0"),
            tax: String(existing.tax || "0"),
            freightCharges: String(existing.freight_charges || "0"),
            deliveryTime: existing.delivery_time || "",
            expectedDeliveryDate: existing.expected_delivery_date || "",
            paymentTerms: existing.payment_terms || "",
            quotationValidity: existing.quotation_validity || "",
            remarks: existing.remarks || "",
          });

          // Map documents
          setUploadedDocs(existing.documents || []);
        } else {
          // Initialize empty
          const initialItems: any = {};
          rfqData.items?.forEach((item: any) => {
            initialItems[item.materialCode] = {
              unitPrice: "",
              availableQty: String(item.quantity),
            };
          });
          setItemsData(initialItems);
        }

      } catch (error: any) {
        toast.error("Failed to load workspace: " + error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchRfqAndQuotation();
  }, [rfqId]);

  const handleItemChange = (itemCode: string, field: "unitPrice" | "availableQty", value: string) => {
    if (isLocked) return;
    setItemsData((prev) => ({
      ...prev,
      [itemCode]: {
        ...prev[itemCode],
        [field]: value,
      },
    }));
  };

  const handleMetaChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (isLocked) return;
    const { name, value } = e.target;
    setMetaData((prev) => ({ ...prev, [name]: value }));
  };

  // Mock document upload
  const handleFileUpload = (documentType: string, e: React.ChangeEvent<HTMLInputElement>) => {
    if (isLocked) return;
    const file = e.target.files?.[0];
    if (!file) return;

    // Simulate file upload delay
    toast.info(`Uploading ${file.name}...`);
    setTimeout(() => {
      setUploadedDocs((prev) => [
        ...prev.filter((d) => d.document_type !== documentType), // replace existing document of same type
        {
          document_type: documentType,
          file_name: file.name,
          file_url: `/media/documents/${file.name}`,
        }
      ]);
      toast.success(`${file.name} uploaded successfully!`);
    }, 800);
  };

  const handleSave = async (status: "DRAFT" | "SUBMITTED") => {
    if (!rfq || isLocked) return;

    // Validation for submission
    if (status === "SUBMITTED") {
      const lineCodes = Object.keys(itemsData);
      if (lineCodes.some((code) => !itemsData[code].unitPrice || parseFloat(itemsData[code].unitPrice) <= 0)) {
        toast.error("Please enter a valid unit price for all items before submitting");
        return;
      }
    }

    setSubmitting(true);
    try {
      const payload = {
        rfq_id: rfq.id,
        supplier_id: supplierId,
        status: status,
        lines: rfq.items.map((item: any) => ({
          item_code: item.materialCode,
          quantity: parseFloat(itemsData[item.materialCode]?.availableQty) || item.quantity,
          unit_price: parseFloat(itemsData[item.materialCode]?.unitPrice) || 0,
        })),
        discount: parseFloat(metaData.discount) || 0,
        tax: parseFloat(metaData.tax) || 0,
        freight_charges: parseFloat(metaData.freightCharges) || 0,
        delivery_time: metaData.deliveryTime,
        expected_delivery_date: metaData.expectedDeliveryDate || null,
        payment_terms: metaData.paymentTerms,
        quotation_validity: metaData.quotationValidity || null,
        remarks: metaData.remarks,
        documents: uploadedDocs,
      };

      if (existingQuote) {
        // Update existing
        await api.updateQuotation(existingQuote.id, payload);
      } else {
        // Create new
        await api.submitQuotation(payload);
      }

      toast.success(status === "SUBMITTED" ? "Quotation submitted and locked!" : "Draft saved successfully!");
      if (status === "SUBMITTED") {
        setIsLocked(true);
      }
      navigate({ to: "/supplier-dashboard" });
    } catch (error: any) {
      toast.error("Operation failed: " + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center gap-3">
        <Loader2 className="size-8 animate-spin text-primary" />
        <span className="text-sm text-muted-foreground">Loading bidding portal...</span>
      </div>
    );
  }

  if (!rfqId || !rfq) {
    return (
      <AppShell title="Quotation Workspace" subtitle="Submit bids for pending requests">
        <div className="mx-auto max-w-md rounded-2xl border border-destructive/20 bg-destructive-soft/10 p-6 text-center shadow-soft">
          <AlertTriangle className="mx-auto size-10 text-destructive" />
          <h2 className="mt-4 text-lg font-bold">Invalid RFQ Reference</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            No valid RFQ identifier was found in your request link. Please check the URL sent in your email invitation.
          </p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="RFQ Response Workspace"
      subtitle={`RFQ Number: ${rfq.rfqNumber}`}
      actions={
        <Button variant="outline" size="sm" onClick={() => navigate({ to: "/supplier-dashboard" })} className="rounded-xl">
          <ArrowLeft className="mr-2 size-4" /> Back to Dashboard
        </Button>
      }
    >
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Lock Banner */}
        {isLocked && (
          <div className="flex items-center gap-3 rounded-2xl border border-success/35 bg-success-soft/10 p-4 text-sm text-success font-bold">
            <Lock className="size-5" />
            This quotation has been officially submitted and is locked from further modifications.
          </div>
        )}

        {/* RFQ Details Summary (Read-Only) */}
        <SectionCard title="RFQ Information (Read-Only)" description="Reference details for this request" icon={FileText}>
          <div className="grid gap-6 sm:grid-cols-3 lg:grid-cols-5">
            <div>
              <Label className="text-muted-foreground text-xs uppercase tracking-wider block">RFQ Number</Label>
              <span className="font-bold text-sm block mt-1">{rfq.rfqNumber}</span>
            </div>
            <div>
              <Label className="text-muted-foreground text-xs uppercase tracking-wider block">Request Date</Label>
              <span className="font-bold text-sm block mt-1">{rfq.rfqDate || "—"}</span>
            </div>
            <div>
              <Label className="text-muted-foreground text-xs uppercase tracking-wider block">Required Delivery Date</Label>
              <span className="font-bold text-sm block mt-1">{rfq.requiredDeliveryDate || "—"}</span>
            </div>
            <div>
              <Label className="text-muted-foreground text-xs uppercase tracking-wider block">Warehouse Location</Label>
              <span className="font-bold text-sm block mt-1">{rfq.warehouse}</span>
            </div>
            <div>
              <Label className="text-muted-foreground text-xs uppercase tracking-wider block">Procurement Officer</Label>
              <span className="font-bold text-sm block mt-1 uppercase tracking-wider text-primary">{rfq.procurementOfficer}</span>
            </div>
          </div>
          {rfq.remarks && (
            <div className="mt-4 pt-4 border-t border-border/50">
              <Label className="text-muted-foreground text-xs uppercase tracking-wider">Remarks / Instructions</Label>
              <p className="text-xs text-foreground/80 mt-1.5 leading-relaxed bg-muted/20 p-3 rounded-lg border border-border/40">
                {rfq.remarks}
              </p>
            </div>
          )}
        </SectionCard>

        {/* Required Materials Bidding Form */}
        <SectionCard title="Material Response" description="Enter pricing and available quantity for each material requirement" icon={Package}>
          <div className="space-y-6">
            {rfq.items?.map((item: any, idx: number) => (
              <div key={idx} className="rounded-2xl border border-border/80 bg-muted/10 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h4 className="text-sm font-bold text-foreground">{item.materialName}</h4>
                    <span className="text-[10px] font-mono text-muted-foreground uppercase">{item.materialCode} · {item.category}</span>
                  </div>
                  <span className="rounded-full bg-primary-soft/20 px-2.5 py-0.5 text-xs font-bold text-primary">
                    Requested: {item.quantity} {item.uom}
                  </span>
                </div>

                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Unit Price (INR)*</Label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                      <Input
                        type="number"
                        min="0.01"
                        step="any"
                        placeholder="0.00"
                        className="pl-9 rounded-xl h-10 font-mono"
                        disabled={isLocked}
                        value={itemsData[item.materialCode]?.unitPrice || ""}
                        onChange={(e) => handleItemChange(item.materialCode, "unitPrice", e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Available Quantity</Label>
                    <Input
                      type="number"
                      min="0.0001"
                      step="any"
                      placeholder="Available quantity"
                      className="rounded-xl h-10 font-mono"
                      disabled={isLocked}
                      value={itemsData[item.materialCode]?.availableQty || ""}
                      onChange={(e) => handleItemChange(item.materialCode, "availableQty", e.target.value)}
                      required
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        {/* Commercial & Logistical Details */}
        <SectionCard title="Logistics & Commercials" description="Bidding parameters, terms, and conditions" icon={Truck}>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Discount (INR)</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  type="number"
                  name="discount"
                  className="pl-9 rounded-xl h-10 font-mono"
                  disabled={isLocked}
                  value={metaData.discount}
                  onChange={handleMetaChange}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Tax (GST %)</Label>
              <div className="relative">
                <Percent className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  type="number"
                  name="tax"
                  className="pl-9 rounded-xl h-10 font-mono"
                  disabled={isLocked}
                  value={metaData.tax}
                  onChange={handleMetaChange}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Freight Charges (INR)</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  type="number"
                  name="freightCharges"
                  className="pl-9 rounded-xl h-10 font-mono"
                  disabled={isLocked}
                  value={metaData.freightCharges}
                  onChange={handleMetaChange}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Delivery Time (e.g. 7 days)</Label>
              <Input
                name="deliveryTime"
                placeholder="e.g. 7 days"
                className="rounded-xl h-10"
                disabled={isLocked}
                value={metaData.deliveryTime}
                onChange={handleMetaChange}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Expected Delivery Date</Label>
              <Input
                type="date"
                name="expectedDeliveryDate"
                className="rounded-xl h-10 font-mono"
                disabled={isLocked}
                value={metaData.expectedDeliveryDate}
                onChange={handleMetaChange}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Payment Terms</Label>
              <Input
                name="paymentTerms"
                placeholder="e.g. Net 30"
                className="rounded-xl h-10"
                disabled={isLocked}
                value={metaData.paymentTerms}
                onChange={handleMetaChange}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Quotation Validity</Label>
              <Input
                type="date"
                name="quotationValidity"
                className="rounded-xl h-10 font-mono"
                disabled={isLocked}
                value={metaData.quotationValidity}
                onChange={handleMetaChange}
              />
            </div>
          </div>

          <div className="mt-4 space-y-1.5">
            <Label className="text-xs">Remarks / Terms Details</Label>
            <Textarea
              name="remarks"
              placeholder="Enter details on commercial conditions or exclusions..."
              className="min-h-[80px] rounded-xl"
              disabled={isLocked}
              value={metaData.remarks}
              onChange={handleMetaChange}
            />
          </div>
        </SectionCard>

        {/* Document Uploads section */}
        <SectionCard title="Quotation Supporting Documents" description="Upload PDFs or compliance certifications" icon={Upload}>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { label: "Quotation PDF", key: "QUOTATION_PDF" },
              { label: "Commercial Documents", key: "COMMERCIAL_DOC" },
              { label: "Technical Documents", key: "TECHNICAL_DOC" },
              { label: "Other Supporting Documents", key: "OTHER" },
            ].map((docType) => {
              const uploaded = uploadedDocs.find((d) => d.document_type === docType.key);
              return (
                <div key={docType.key} className="flex flex-col gap-2 rounded-2xl border border-border p-4 bg-muted/5">
                  <span className="text-xs font-bold">{docType.label}</span>
                  {uploaded ? (
                    <div className="flex items-center justify-between gap-2 rounded-xl bg-success-soft/20 px-3 py-2 text-xs text-success-foreground border border-success/20">
                      <span className="truncate max-w-[180px] font-mono">{uploaded.file_name}</span>
                      <span className="text-[10px] uppercase font-bold">Uploaded</span>
                    </div>
                  ) : (
                    <div className="relative">
                      <input
                        type="file"
                        id={`file-${docType.key}`}
                        className="hidden"
                        disabled={isLocked}
                        accept=".pdf,.jpg,.jpeg"
                        onChange={(e) => handleFileUpload(docType.key, e)}
                      />
                      <Label
                        htmlFor={`file-${docType.key}`}
                        className={cn(
                          "flex items-center justify-center gap-2 rounded-xl border border-dashed border-border/80 hover:border-primary/80 py-3 text-xs font-medium cursor-pointer transition-colors",
                          isLocked && "opacity-50 cursor-not-allowed hover:border-border/80"
                        )}
                      >
                        <Upload className="size-4 text-muted-foreground" /> Choose file...
                      </Label>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </SectionCard>

        {/* Action Panel */}
        {!isLocked && (
          <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-card/60 p-6 shadow-soft">
            <div className="text-xs text-muted-foreground flex items-center gap-1.5">
              <ShieldCheck className="size-4 text-success" /> Click Submit to finalize and lock this bid proposal.
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="lg"
                className="rounded-xl h-12 text-xs"
                disabled={submitting}
                onClick={() => handleSave("DRAFT")}
              >
                Save Draft
              </Button>
              <Button
                size="lg"
                className="rounded-xl h-12 text-xs bg-success text-success-foreground hover:bg-success/90 shadow-glow"
                disabled={submitting}
                onClick={() => handleSave("SUBMITTED")}
              >
                {submitting ? (
                  <><Loader2 className="mr-2 size-4 animate-spin" /> Processing...</>
                ) : (
                  <><FileCheck className="mr-2 size-4" /> Submit Quotation</>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
