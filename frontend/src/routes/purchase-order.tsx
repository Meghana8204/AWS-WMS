import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  Building2,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Download,
  Loader2,
  History,
  XCircle,
  Truck,
  Mail,
  User,
  Warehouse,
  CreditCard,
  Send,
} from "lucide-react";
import { AppShell, StatusBadge } from "@/components/wms/app-shell";
import { Field, SectionCard } from "@/components/wms/primitives";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";

type POSearch = {
  poId?: string;
};

export const Route = createFileRoute("/purchase-order")({
  head: () => ({
    meta: [
      { title: "Purchase Order Details · NexusWMS" },
      {
        name: "description",
        content: "Comprehensive Purchase Order details and supplier communication.",
      },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): POSearch => {
    return {
      poId: (search.poId as string) || undefined,
    };
  },
  component: PurchaseOrder,
});

function PurchaseOrder() {
  const { poId } = Route.useSearch();
  const [poData, setPoData] = useState<any>(null);
  const [loading, setLoading] = useState(!!poId);
  const [sending, setSending] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const navigate = useNavigate();

  const fetchPo = async () => {
    try {
      setLoading(true);
      const data = await api.getPurchaseOrder(poId as string);
      setPoData(data);
    } catch (err) {
      console.error("Failed to fetch PO details:", err);
      toast.error("Could not load PO details");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (poId) fetchPo();
  }, [poId]);

  const handleSendToSupplier = async () => {
    try {
      setSending(true);
      const result = await api.sendPoToSupplier(poId as string);
      toast.success(
        result.message ||
          (result.resent ? "Purchase Order resent successfully." : "Purchase Order sent successfully."),
      );
      fetchPo();
    } catch (e: any) {
      toast.error("Failed to send PO: " + e.message);
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <AppShell title="Loading PO..." subtitle="Please wait">
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="size-8 animate-spin text-primary" />
        </div>
      </AppShell>
    );
  }

  if (!poData) {
    return (
      <AppShell title="Not Found" subtitle="PO details not found">
        <div className="flex flex-col items-center justify-center p-12 text-center">
          <AlertTriangle className="size-12 text-destructive mb-4" />
          <p>The requested Purchase Order could not be located.</p>
        </div>
      </AppShell>
    );
  }

  const subtotal = Number(poData.subtotal) || 0;
  const discountAmount = Number(poData.discountAmount) || 0;
  const freightCharges = Number(poData.freightCharges) || 0;
  const taxAmount = Number(poData.taxAmount) || 0;
  const taxableAmount = subtotal - discountAmount;
  const discountPercentage = subtotal > 0 ? (discountAmount / subtotal) * 100 : 0;
  const taxPercentage = taxableAmount > 0 ? (taxAmount / taxableAmount) * 100 : 0;
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(value);

  return (
    <AppShell
      title={`Purchase Order: ${poData.poNumber}`}
      subtitle={`${poData.supplierName} · ₹ ${parseFloat(poData.totalAmount).toLocaleString()}`}
      actions={
        <>
          {poData.status === "APPROVED" && (
            <Button
              className="rounded-xl shadow-glow bg-primary hover:bg-primary/90"
              onClick={handleSendToSupplier}
              disabled={sending}
            >
              {sending ? (
                <Loader2 className="size-4 animate-spin mr-2" />
              ) : (
                <Send className="size-4 mr-2" />
              )}
              Send to Supplier
            </Button>
          )}
          {poData.status === "SENT" && (
            <Button
              variant="outline"
              className="rounded-xl border-success/30 text-success bg-success-soft/10"
              onClick={handleSendToSupplier}
              disabled={sending}
            >
              {sending ? (
                <Loader2 className="size-4 animate-spin mr-2" />
              ) : (
                <Send className="size-4 mr-2" />
              )}
              Resend to Supplier
            </Button>
          )}
          <Button
            variant="outline"
            className="rounded-xl"
            disabled={downloading}
            onClick={async () => {
              try {
                setDownloading(true);
                await api.downloadPoPdf(poData.id, poData.poNumber);
                toast.success("Purchase Order PDF generated and downloaded");
              } catch (e: any) {
                toast.error("Failed to generate PDF: " + e.message);
              } finally {
                setDownloading(false);
              }
            }}
          >
            {downloading ? (
              <Loader2 className="size-4 animate-spin mr-2" />
            ) : (
              <Download className="size-4 mr-2" />
            )}
            Download PDF
          </Button>
        </>
      }
    >
      <div className="grid gap-6 xl:grid-cols-3">
        {/* PO Header & Supplier Info */}
        <div className="space-y-6">
          <SectionCard title="PO Information" icon={FileText}>
            <div className="grid gap-3">
              <Field label="PO Number" value={poData.poNumber} mono />
              <Field label="PO Date" value={new Date(poData.createdAt).toLocaleDateString()} />
              <Field label="Status" value={<StatusBadge status={poData.status} />} />
              <Field label="Procurement Officer" value={poData.procurementOfficer} />
              <Field label="Department" value={poData.department || "Procurement"} />
            </div>
          </SectionCard>

          <SectionCard title="Supplier Information" icon={Building2}>
            <div className="grid gap-3">
              <Field label="Supplier Code" value={poData.supplierCode} mono />
              <Field label="Company Name" value={poData.supplierName} />
              <Field label="Contact Person" value={poData.supplierContactPerson} />
              <Field label="Phone" value={poData.supplierPhone} />
              <Field label="Email" value={poData.supplierEmail} />
              <Field label="GSTIN" value={poData.supplierGstin} mono />
              <Field label="Address" value={poData.supplierAddress} />
            </div>
          </SectionCard>
        </div>

        {/* Item Details */}
        <div className="xl:col-span-2 space-y-6">
          <SectionCard title="Order Items" icon={Truck}>
            <div className="mt-2 -mx-5 overflow-x-auto px-5">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
                    <th className="pb-3">Material</th>
                    <th className="pb-3 text-right">Quantity</th>
                    <th className="pb-3">UoM</th>
                    <th className="pb-3 text-right">Unit Price</th>
                    <th className="pb-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40 font-medium">
                  {poData.items?.map((l: any, idx: number) => (
                    <tr key={idx} className="group hover:bg-muted/5 transition-colors">
                      <td className="py-4">
                        <p className="font-bold text-foreground">{l.materialName}</p>
                        <p className="font-mono text-[10px] text-muted-foreground">
                          {l.materialCode}
                        </p>
                      </td>
                      <td className="py-4 text-right tabular-nums">{Math.floor(l.quantity)}</td>
                      <td className="py-4 text-muted-foreground">{l.uom}</td>
                      <td className="py-4 text-right tabular-nums">
                        ₹ {parseFloat(l.unitPrice).toLocaleString()}
                      </td>
                      <td className="py-4 text-right tabular-nums font-bold text-foreground">
                        ₹{" "}
                        {(
                          Math.floor(parseFloat(l.quantity)) * parseFloat(l.unitPrice)
                        ).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="hidden" aria-hidden="true">
              <div className="ml-auto max-w-xs space-y-3">
                <SummaryRow label="Subtotal" value={poData.subtotal} />
                <SummaryRow label="Discount" value={poData.discountAmount} isNegative />
                <SummaryRow label="Tax (GST)" value={poData.taxAmount} />
                <SummaryRow label="Additional Charges" value={poData.additionalCharges} />
                <div className="pt-3 border-t border-primary/20 flex items-center justify-between">
                  <span className="text-sm font-black text-foreground uppercase">Grand Total</span>
                  <span className="text-xl font-black text-primary">
                    ₹ {parseFloat(poData.totalAmount).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="RFQ Response Summary"
            description="Selected supplier quotation totals and commercial terms"
            icon={CheckCircle2}
          >
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <SummaryMetric label="Items quoted" value={`${poData.items?.length || 0}`} />
              <SummaryMetric label="Subtotal" value={formatCurrency(subtotal)} />
              <SummaryMetric
                label={`Discount (${discountPercentage.toFixed(2)}%)`}
                value={`− ${formatCurrency(discountAmount)}`}
                valueClassName="text-destructive"
              />
              <SummaryMetric
                label={`GST (${taxPercentage.toFixed(2)}%)`}
                value={formatCurrency(taxAmount)}
              />
              <SummaryMetric label="Freight charges" value={formatCurrency(freightCharges)} />
              <SummaryMetric
                label="Quotation total"
                value={formatCurrency(Number(poData.totalAmount) || 0)}
                valueClassName="text-primary"
                emphasis
              />
            </div>
            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted-foreground">
              <span>Expected delivery: {poData.expectedDeliveryDate || "Not specified"}</span>
              <span>Payment: {poData.paymentTerms || "Not specified"}</span>
            </div>
          </SectionCard>

          <div className="grid gap-6 sm:grid-cols-2">
            <SectionCard title="Delivery Details" icon={Warehouse}>
              <div className="grid gap-3">
                <Field label="Delivery Warehouse" value={poData.deliveryWarehouseName} />
                <Field
                  label="Expected Delivery"
                  value={poData.expectedDeliveryDate || "As per schedule"}
                />
                <Field label="Delivery Address" value={poData.deliveryAddress} />
              </div>
            </SectionCard>

            <SectionCard title="Selection Summary" icon={CheckCircle2}>
              <div className="grid gap-3">
                <Field label="Selected By" value={poData.selectedBy} />
                <Field label="Selection Reason" value={poData.selectionReason} />
                <Field label="Payment Terms" value={poData.paymentTerms} />
              </div>
            </SectionCard>
          </div>
        </div>
      </div>

      {poData.status === "REJECTED" && (
        <Card className="mt-6 border-destructive/30 bg-destructive/5 overflow-hidden">
          <CardHeader className="bg-destructive/10 border-b border-destructive/20 py-3">
            <div className="flex items-center gap-2 text-destructive">
              <XCircle className="size-4" />
              <CardTitle className="text-xs font-black uppercase">Rejection Notice</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <p className="text-sm font-bold text-destructive italic text-center">
              "{poData.rejectionReason}"
            </p>
            <div className="mt-4 p-3 bg-white/50 rounded-lg border border-destructive/10">
              <p className="text-xs text-destructive font-bold uppercase tracking-tighter">
                Status: Permanent Rejection
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">
                This Purchase Order has been rejected by Finance and is permanently closed. It
                cannot be modified or resubmitted.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {poData.history && poData.history.length > 0 && (
        <div className="mt-6">
          <SectionCard title="Approval Lifecycle" icon={History}>
            <div className="space-y-4">
              {poData.history.map((h: any, idx: number) => (
                <div key={idx} className="flex gap-4 items-start relative pb-4 last:pb-0">
                  {idx < poData.history.length - 1 && (
                    <div className="absolute left-[15px] top-7 bottom-0 w-0.5 bg-border/40" />
                  )}
                  <div
                    className={cn(
                      "grid size-8 shrink-0 place-items-center rounded-full border text-[10px] font-bold",
                      h.status === "APPROVED" || h.status === "Approved"
                        ? "bg-success-soft text-success border-success/30"
                        : h.status === "REJECTED" ||
                            h.status === "Rejected" ||
                            h.status === "FINANCE_REJECTED"
                          ? "bg-danger-soft text-destructive border-destructive/30"
                          : h.status === "SHIPPED" ||
                              h.status === "Shipped" ||
                              h.status === "IN_TRANSIT" ||
                              h.status === "ASN_SUBMITTED"
                            ? "bg-teal-soft text-teal border-teal/30"
                            : "bg-muted text-muted-foreground",
                    )}
                  >
                    {idx + 1}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-bold">{h.status}</p>
                      <p className="text-[10px] text-muted-foreground font-mono">
                        {new Date(h.created_at).toLocaleString()}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground font-medium italic">
                      By {h.actor_name}
                    </p>
                    {h.comments && (
                      <p className="mt-1 text-xs text-foreground/70 bg-muted/30 p-2 rounded-lg">
                        {h.comments}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      )}
    </AppShell>
  );
}

function SummaryRow({ label, value, isNegative = false }: any) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground font-medium">{label}</span>
      <span className={cn("font-mono font-bold", isNegative && "text-destructive")}>
        {isNegative ? "- " : ""}₹ {parseFloat(value || 0).toLocaleString()}
      </span>
    </div>
  );
}

function SummaryMetric({ label, value, valueClassName, emphasis = false }: any) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border/60 bg-muted/20 p-4",
        emphasis && "border-primary/30 bg-primary-soft/15",
      )}
    >
      <p className={cn("text-xs font-medium text-muted-foreground", emphasis && "font-bold text-primary")}>
        {label}
      </p>
      <p className={cn("mt-1 text-lg font-bold", valueClassName)}>{value}</p>
    </div>
  );
}
