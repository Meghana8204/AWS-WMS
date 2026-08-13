import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  FileText,
  DollarSign,
  Clock,
  ArrowLeft,
  Loader2,
  Calendar,
  Building,
  ClipboardList,
  ShieldCheck,
  Download,
  Building2,
  User,
  Phone,
  Mail,
  MapPin,
  FileCheck2,
  Send,
  ExternalLink,
  Info,
  X
} from "lucide-react";
import { AppShell } from "@/components/wms/app-shell";
import { SectionCard } from "@/components/wms/primitives";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/procurement/po-detail")({
  component: PurchaseOrderDetail,
});

function PurchaseOrderDetail() {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as any;
  const poId = search.poId || "";

  const [loading, setLoading] = useState(true);
  const [po, setPo] = useState<any | null>(null);
  const [sending, setSending] = useState(false);
  const [emailPreview, setEmailPreview] = useState<any | null>(null);

  const fetchPoData = async () => {
    try {
      setLoading(true);
      const data = await api.getPurchaseOrder(poId);
      setPo(data);
    } catch (error: any) {
      toast.error("Failed to load Purchase Order details: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!poId) {
      setLoading(false);
      return;
    }

    fetchPoData();
  }, [poId]);

  const handleSendToSupplier = async () => {
    setSending(true);
    try {
      const response = await api.sendPoToSupplier(poId);
      setEmailPreview(response.details);
      toast.success("Purchase Order transmitted to supplier!");
      // Refresh PO data to update status
      const updatedPo = await api.getPurchaseOrder(poId);
      setPo(updatedPo);
    } catch (error: any) {
      toast.error("Transmission failed", { description: error.message });
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center gap-3">
        <Loader2 className="size-8 animate-spin text-primary" />
        <span className="text-sm text-muted-foreground">Loading Purchase Order details...</span>
      </div>
    );
  }

  if (!poId || !po) {
    return (
      <AppShell title="Purchase Order Detail" subtitle="View procurement details">
        <div className="mx-auto max-w-md rounded-2xl border border-destructive/20 bg-destructive-soft/10 p-6 text-center shadow-soft">
          <h2 className="text-lg font-bold text-destructive">Invalid Purchase Order Reference</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            No valid purchase order was found. Please return to the PO Dashboard.
          </p>
          <Button className="mt-4 rounded-xl" onClick={() => navigate({ to: "/procurement/purchase-orders" })}>
            Back to Dashboard
          </Button>
        </div>
      </AppShell>
    );
  }

  // Financial Summary calculations
  const subtotal = po.lines?.reduce((sum: number, l: any) => sum + (parseFloat(l.ordered_quantity) * parseFloat(l.unit_price)), 0) || 0;
  const discountVal = po.quotation_info ? parseFloat(po.quotation_info.discount || 0) : 0;
  const taxPct = po.quotation_info ? parseFloat(po.quotation_info.tax || 0) : 0;
  const freightCharges = po.quotation_info ? parseFloat(po.quotation_info.freight_charges || 0) : 0;
  const taxVal = (subtotal - discountVal) * (taxPct / 100);
  const grandTotal = (subtotal - discountVal) + taxVal + freightCharges;

  // Retrieve contact & address info from po object
  const contactPerson = po.supplier_info?.contact_person || "—";
  const contactPhone = po.supplier_info?.phone || "—";
  const contactEmail = po.supplier_info?.email || "—";
  const gstNumber = po.supplier_info?.gst_number || "—";
  const supplierAddress = po.supplier_info?.supplier_address || "—";
  const deliveryAddress = po.delivery_details?.delivery_address || "—";
  const deliveryWarehouse = po.delivery_details?.delivery_warehouse || po.warehouse_id || "—";

  return (
    <AppShell
      title="Purchase Order Detail View"
      subtitle={`Formal released PO: ${po.po_number}`}
      actions={
        <div className="flex gap-2">
          {po.status === "APPROVED" && (
            <Button
                onClick={handleSendToSupplier}
                disabled={sending}
                className="rounded-xl shadow-glow bg-primary text-primary-foreground"
            >
              {sending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Send className="mr-2 size-4" />}
              Send to Supplier
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => navigate({ to: "/procurement/purchase-orders" })} className="rounded-xl">
            <ArrowLeft className="mr-2 size-4" /> Back to Dashboard
          </Button>
        </div>
      }
    >
      <div className="mx-auto max-w-5xl space-y-6">
        
        {/* Release Status Banner */}
        <div className={cn(
            "flex items-center justify-between gap-3 rounded-2xl border p-5 font-bold",
            po.status === "ISSUED" || po.status === "PLACED" || po.status === "SENT" || po.status === "ACKNOWLEDGED"
                ? "border-success/35 bg-success-soft/10 text-success"
                : "border-warning/35 bg-warning-soft/10 text-warning-foreground"
        )}>
          <span className="flex items-center gap-2 text-sm">
            {po.status === "ISSUED" || po.status === "SENT" || po.status === "ACKNOWLEDGED" ? (
                <><CheckCircle2 className="size-5" /> PO Released & Transmitted to Supplier Successfully</>
            ) : (
                <><Info className="size-5" /> {po.status === "APPROVED" ? "PO Approved by Finance. Ready for transmission." : `Status: ${po.status}`}</>
            )}
          </span>
          <span className="font-mono text-xs uppercase tracking-wider bg-current/10 px-3 py-1 rounded-full text-[10px]">
            {po.status}
          </span>
        </div>

        {/* PO & Supplier General Grid */}
        <div className="grid gap-6 md:grid-cols-2">
          
          {/* PO General Info Card */}
          <SectionCard title="PO Information" description="Released document references" icon={ClipboardList}>
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <Label className="text-muted-foreground block text-[10px] uppercase">PO Number</Label>
                <span className="font-bold text-sm block mt-0.5">{po.po_number}</span>
              </div>
              <div>
                <Label className="text-muted-foreground block text-[10px] uppercase">PO Date</Label>
                <span className="font-bold text-sm block mt-0.5">{po.po_date}</span>
              </div>
              <div>
                <Label className="text-muted-foreground block text-[10px] uppercase">Department</Label>
                <span className="font-bold text-sm block mt-0.5">{po.department}</span>
              </div>
              <div>
                <Label className="text-muted-foreground block text-[10px] uppercase">Procurement Officer</Label>
                <span className="font-bold text-sm block mt-0.5 text-primary uppercase">{po.buyer}</span>
              </div>
              <div>
                <Label className="text-muted-foreground block text-[10px] uppercase">Warehouse</Label>
                <span className="font-bold text-sm block mt-0.5 uppercase">{deliveryWarehouse}</span>
              </div>
              <div>
                <Label className="text-muted-foreground block text-[10px] uppercase">Expected Delivery Date</Label>
                <span className="font-bold text-sm block mt-0.5 font-mono">{po.expected_delivery_date || "—"}</span>
              </div>
            </div>
          </SectionCard>

          {/* Supplier Master Info Card */}
          <SectionCard title="Supplier Master Information" description="Auto-fetched vendor credentials" icon={Building2}>
            <div className="space-y-3.5 text-xs">
              <div className="flex justify-between border-b border-border/40 pb-1.5">
                <span className="text-muted-foreground">Supplier Code</span>
                <strong className="text-foreground uppercase">{po.supplier_info?.supplier_code || "VND-1002"}</strong>
              </div>
              <div className="flex justify-between border-b border-border/40 pb-1.5">
                <span className="text-muted-foreground">Supplier Name</span>
                <strong className="text-foreground uppercase">{po.supplier_name || po.supplier_info?.supplier_name || "Supplier Master"}</strong>
              </div>
              <div className="flex justify-between border-b border-border/40 pb-1.5">
                <span className="text-muted-foreground">GST Identification No (GSTIN)</span>
                <strong className="text-foreground font-mono">{gstNumber}</strong>
              </div>
              
              <div className="grid grid-cols-3 gap-2 pt-1 font-medium">
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground min-w-0">
                  <User className="size-3.5 shrink-0 text-primary" />
                  <span className="truncate">{contactPerson}</span>
                </div>
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground min-w-0">
                  <Phone className="size-3.5 shrink-0 text-primary" />
                  <span className="truncate">{contactPhone}</span>
                </div>
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground min-w-0">
                  <Mail className="size-3.5 shrink-0 text-primary" />
                  <span className="truncate">{contactEmail}</span>
                </div>
              </div>

              <div className="pt-2 flex gap-1.5 items-start">
                <MapPin className="size-4 text-primary shrink-0 mt-0.5" />
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-bold block">Supplier Address</span>
                  <p className="text-foreground/80 font-medium leading-normal mt-0.5">{supplierAddress}</p>
                </div>
              </div>
            </div>
          </SectionCard>

        </div>

        {/* Order Items Table */}
        <SectionCard title="Order Items" description="Line items to be fulfilled by the vendor" icon={FileText}>
          <div className="rounded-2xl border border-border/40 overflow-hidden bg-card">
            <table className="w-full text-xs">
              <thead className="bg-muted/50 border-b border-border/40 text-[10px] uppercase font-bold text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left">Item Code</th>
                  <th className="px-4 py-3 text-left">Material Name / Category</th>
                  <th className="px-4 py-3 text-right">Quantity</th>
                  <th className="px-4 py-3 text-right">UOM</th>
                  <th className="px-4 py-3 text-right">Unit Price</th>
                  <th className="px-4 py-3 text-right">Discount</th>
                  <th className="px-4 py-3 text-right">Tax</th>
                  <th className="px-4 py-3 text-right">Line Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20 font-mono text-xs">
                {po.items?.map((line: any, idx: number) => (
                  <tr key={idx} className="hover:bg-muted/5 transition-colors">
                    <td className="px-4 py-3 text-left font-bold text-primary">
                      {line.material_code}
                    </td>
                    <td className="px-4 py-3 text-left font-sans font-medium text-foreground">
                      <div>{line.material_name}</div>
                      <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded font-bold uppercase">{line.category || "General"}</span>
                    </td>
                    <td className="px-4 py-3 text-right">{parseFloat(line.quantity).toLocaleString()}</td>
                    <td className="px-4 py-3 text-right font-sans">{line.unit_of_measure}</td>
                    <td className="px-4 py-3 text-right">₹ {parseFloat(line.unit_price).toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-destructive">- ₹ {parseFloat(line.discount || 0).toLocaleString()}</td>
                    <td className="px-4 py-3 text-right font-sans text-muted-foreground">₹ {parseFloat(line.tax || 0).toLocaleString()}</td>
                    <td className="px-4 py-3 text-right font-extrabold text-foreground">₹ {parseFloat(line.line_total).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>

        {/* Delivery & Attachments Grid */}
        <div className="grid gap-6 md:grid-cols-2">
          
          {/* Delivery details */}
          <SectionCard title="Delivery Details" description="Consignee warehouse and address" icon={MapPin}>
            <div className="space-y-4 text-xs font-medium">
              <div>
                <Label className="text-muted-foreground block text-[10px] uppercase">Delivery Warehouse</Label>
                <span className="font-bold text-sm block mt-0.5 uppercase">{deliveryWarehouse}</span>
              </div>
              <div>
                <Label className="text-muted-foreground block text-[10px] uppercase">Delivery Address</Label>
                <p className="text-foreground/80 mt-0.5 leading-relaxed">{deliveryAddress}</p>
              </div>
              <div>
                <Label className="text-muted-foreground block text-[10px] uppercase">Expected Delivery Date</Label>
                <span className="font-bold block mt-0.5 font-mono">{po.expected_delivery_date || "—"}</span>
              </div>
            </div>
          </SectionCard>

          {/* Attachments */}
          <SectionCard title="Attachments & Supporting Files" description="Contract copies and quotations" icon={ShieldCheck}>
            <div className="space-y-4 text-xs">
              <div>
                <Label className="text-muted-foreground text-[10px] uppercase tracking-wider block">Attached Quotation Documents</Label>
                {po.quotation_info?.documents && po.quotation_info.documents.length > 0 ? (
                  <div className="mt-2 space-y-2">
                    {po.quotation_info.documents.map((d: any, idx: number) => (
                      <a
                        key={idx}
                        href={d.file_url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-[11px] font-bold text-primary hover:underline hover:border-primary/45 transition-colors"
                      >
                        <Download className="size-4" /> {d.file_name} ({d.document_type.replace("_", " ")})
                      </a>
                    ))}
                  </div>
                ) : (
                  <p className="mt-1 text-muted-foreground italic">No attached documents.</p>
                )}
              </div>
            </div>
          </SectionCard>

        </div>

        {/* Order Summary details */}
        <div className="flex justify-end">
          <Card className="w-full max-w-sm border-border/50 bg-card p-6 shadow-soft">
            <CardHeader className="p-0 mb-4 border-b border-border/40 pb-3">
              <CardTitle className="text-sm font-bold">Order Summary</CardTitle>
            </CardHeader>
            <div className="space-y-3 font-mono text-xs">
              <div className="flex justify-between items-center py-1">
                <span className="text-muted-foreground font-sans">Subtotal</span>
                <span>₹ {po.summary.subtotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center py-1 text-destructive">
                <span className="text-muted-foreground font-sans">Total Discount</span>
                <span>- ₹ {po.summary.total_discount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-muted-foreground font-sans">Tax (GST)</span>
                <span>₹ {po.summary.tax_amount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-muted-foreground font-sans">Freight / Additional Charges</span>
                <span>₹ {po.summary.additional_charges.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center border-t border-border pt-3 font-sans">
                <span className="text-sm font-bold text-foreground">Grand Total</span>
                <strong className="text-lg font-extrabold text-primary font-mono">₹ {po.summary.grand_total.toLocaleString()}</strong>
              </div>
            </div>
          </Card>
        </div>

      </div>

      {/* Email Simulation Modal */}
      {emailPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200 p-4">
          <Card className="w-full max-w-2xl border-border/40 bg-card shadow-glow relative animate-in zoom-in-95 duration-200 overflow-hidden">
            <CardHeader className="bg-primary/5 border-b border-primary/10 pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-primary">
                  <Mail className="size-5" />
                  <CardTitle className="text-base font-bold text-foreground">Supplier Notification Sent</CardTitle>
                </div>
                <button onClick={() => setEmailPreview(null)} className="text-muted-foreground hover:text-foreground">
                  <X className="size-5" />
                </button>
              </div>
              <CardDescription className="text-xs mt-1">
                The following official notification was transmitted to: <strong>{emailPreview.supplier_email || emailPreview.supplier_name}</strong>
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="bg-muted/10 p-4 space-y-3">
                <div className="flex gap-2 text-xs border-b border-border/40 pb-2">
                  <span className="font-bold text-muted-foreground w-16">Subject:</span>
                  <span className="font-medium">{emailPreview.subject}</span>
                </div>
                <div className="bg-background rounded-lg border border-border/60 p-4 font-mono text-[11px] whitespace-pre-wrap leading-relaxed max-h-[400px] overflow-y-auto">
                  {emailPreview.email_body}
                </div>
              </div>
              <div className="p-4 bg-primary/5 border-t border-primary/10 flex justify-end">
                <Button onClick={() => setEmailPreview(null)} className="rounded-xl shadow-glow">
                  Done
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </AppShell>
  );
}
