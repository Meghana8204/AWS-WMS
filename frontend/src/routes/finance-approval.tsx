import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  FileText,
  DollarSign,
  TrendingUp,
  Clock,
  CheckCircle,
  XCircle,
  ArrowLeft,
  Loader2,
  Calendar,
  Building,
  ClipboardList,
  ShieldCheck,
  FileCheck2,
  Download,
  AlertTriangle,
  UserCheck,
  X,
  History,
  MessageSquare
} from "lucide-react";
import { AppShell } from "@/components/wms/app-shell";
import { SectionCard } from "@/components/wms/primitives";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/finance-approval")({
  component: FinanceApproval,
});

function FinanceApproval() {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as any;
  const poId = search.poId || "";

  const [loading, setLoading] = useState(true);
  const [po, setPo] = useState<any | null>(null);
  const [quotation, setQuotation] = useState<any | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Rejection modal state
  const [rejectionModalOpen, setRejectionModalOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [financeComments, setFinanceComments] = useState("");

  const fetchPoData = async () => {
    try {
      setLoading(true);
      const poData = await api.getPurchaseOrder(poId);
      setPo(poData);

      if (poData.quotation_id) {
        const qData = await api.getQuotation(poData.quotation_id);
        setQuotation(qData);
      }
    } catch (error: any) {
      toast.error("Failed to load PO details: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Auth Check
    const userInfoStr = localStorage.getItem("user_info");
    if (!userInfoStr) {
      navigate({ to: "/login" });
      return;
    }
    const user = JSON.parse(userInfoStr);
    if (!user.roles?.includes("FINANCE") && !user.roles?.includes("ADMIN")) {
      toast.error("Unauthorized. Finance role required.");
      navigate({ to: "/dashboard" });
      return;
    }

    if (!poId) {
      setLoading(false);
      return;
    }

    fetchPoData();
  }, [poId]);

  const handleApprove = async () => {
    if (!po) return;
    setSubmitting(true);
    try {
      await api.updatePurchaseOrder(po.id, {
        status: "APPROVED",
        finance_comments: "Approved for capital release.",
      });
      toast.success("PO proposal approved & capital released!");
      navigate({ to: "/finance-dashboard" });
    } catch (error: any) {
      toast.error("Approval failed: " + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!po || !rejectionReason.trim()) {
      toast.error("Rejection reason is mandatory");
      return;
    }
    setSubmitting(true);
    try {
      await api.updatePurchaseOrder(po.id, {
        status: "REJECTED",
        rejection_reason: rejectionReason,
        finance_comments: financeComments,
      });
      toast.success("PO proposal rejected.");
      setRejectionModalOpen(false);
      navigate({ to: "/finance-dashboard" });
    } catch (error: any) {
      toast.error("Rejection failed: " + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center gap-3">
        <Loader2 className="size-8 animate-spin text-primary" />
        <span className="text-sm text-muted-foreground">Loading approval workspace...</span>
      </div>
    );
  }

  if (!poId || !po) {
    return (
      <AppShell title="Finance Approval Workspace" subtitle="Review pending requests">
        <div className="mx-auto max-w-md rounded-2xl border border-destructive/20 bg-destructive-soft/10 p-6 text-center shadow-soft">
          <AlertTriangle className="mx-auto size-10 text-destructive" />
          <h2 className="mt-4 text-lg font-bold">Invalid PO Reference</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            No valid purchase order proposal was found. Please return to the Finance Dashboard.
          </p>
        </div>
      </AppShell>
    );
  }

  // Financial summary calculations
  const subtotal = po.lines?.reduce((sum: number, l: any) => sum + (parseFloat(l.ordered_quantity) * parseFloat(l.unit_price)), 0) || 0;
  const discountVal = quotation ? parseFloat(quotation.discount || 0) : 0;
  const taxPct = quotation ? parseFloat(quotation.tax || 0) : 0;
  const freightCharges = quotation ? parseFloat(quotation.freight_charges || 0) : 0;
  const taxVal = (subtotal - discountVal) * (taxPct / 100);
  const grandTotal = (subtotal - discountVal) + taxVal + freightCharges;

  return (
    <AppShell
      title="Capital Release Approval"
      subtitle={`Review Proposal for PO: ${po.po_number}`}
      actions={
        <Button variant="outline" size="sm" onClick={() => navigate({ to: "/finance-dashboard" })} className="rounded-xl">
          <ArrowLeft className="mr-2 size-4" /> Back to Dashboard
        </Button>
      }
    >
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Status indicator */}
        <div className={cn(
          "flex items-center justify-between gap-3 rounded-2xl border p-4 text-sm font-bold",
          po.status === "PROPOSED" && "border-amber/35 bg-amber-soft/10 text-amber-foreground",
          po.status === "REJECTED" && "border-destructive/35 bg-destructive-soft/10 text-destructive",
          (po.status === "APPROVED" || po.status === "PLACED") && "border-success/35 bg-success-soft/10 text-success"
        )}>
          <span className="flex items-center gap-2">
            <Clock className="size-5" /> Capital Release Request Awaiting Review
          </span>
          <span className="font-mono text-xs uppercase tracking-wider">Status: {po.status === "PLACED" ? "APPROVED" : po.status}</span>
        </div>

        {/* PO Information section */}
        <SectionCard title="Purchase Order Details" description="General reference fields" icon={ClipboardList}>
          <div className="grid gap-6 sm:grid-cols-3">
            <div>
              <Label className="text-muted-foreground text-xs uppercase tracking-wider block">PO Number</Label>
              <span className="font-bold text-sm block mt-1">{po.po_number}</span>
            </div>
            <div>
              <Label className="text-muted-foreground text-xs uppercase tracking-wider block">PO Date</Label>
              <span className="font-bold text-sm block mt-1">{po.po_date}</span>
            </div>
            <div>
              <Label className="text-muted-foreground text-xs uppercase tracking-wider block">Supplier</Label>
              <span className="font-bold text-sm block mt-1">{po.supplier_name || `Supplier ID: ${po.supplier_id.substring(0, 8)}`}</span>
            </div>
            <div>
              <Label className="text-muted-foreground text-xs uppercase tracking-wider block">Warehouse Location</Label>
              <span className="font-bold text-sm block mt-1 uppercase">Pune DC · Plant 1200</span>
            </div>
            <div>
              <Label className="text-muted-foreground text-xs uppercase tracking-wider block">Procurement Officer</Label>
              <span className="font-bold text-sm block mt-1 uppercase text-primary">Procurement Officer</span>
            </div>
            <div>
              <Label className="text-muted-foreground text-xs uppercase tracking-wider block">Expected Delivery Date</Label>
              <span className="font-bold text-sm block mt-1 font-mono">{po.expected_delivery_date || "—"}</span>
            </div>
          </div>
        </SectionCard>

        {/* Material details grid */}
        <SectionCard title="Material Details" description="Line items mapping proposed rates and quantities" icon={FileText}>
          <div className="rounded-2xl border border-border/40 overflow-hidden bg-card">
            <table className="w-full text-xs">
              <thead className="bg-muted/50 border-b border-border/40 text-[10px] uppercase font-bold text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left">Material / Code</th>
                  <th className="px-4 py-3 text-right">Quantity</th>
                  <th className="px-4 py-3 text-right">UOM</th>
                  <th className="px-4 py-3 text-right">Unit Price</th>
                  <th className="px-4 py-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20 font-mono text-xs">
                {po.lines?.map((line: any, idx: number) => (
                  <tr key={idx} className="hover:bg-muted/5 transition-colors">
                    <td className="px-4 py-3 text-left font-bold text-foreground">
                      {line.item_code}
                    </td>
                    <td className="px-4 py-3 text-right">{parseFloat(line.ordered_quantity).toLocaleString()}</td>
                    <td className="px-4 py-3 text-right font-sans">units</td>
                    <td className="px-4 py-3 text-right">₹ {parseFloat(line.unit_price).toLocaleString()}</td>
                    <td className="px-4 py-3 text-right font-extrabold text-foreground">₹ {(parseFloat(line.ordered_quantity) * parseFloat(line.unit_price)).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>

        {/* Financial Summary */}
        <div className="grid gap-6 sm:grid-cols-2">
          {/* Supporting logs */}
          <SectionCard title="Supporting Information & Attachments" description="Audit comments and uploaded quotation" icon={ShieldCheck}>
            <div className="space-y-4 text-xs">
              <div>
                <Label className="text-muted-foreground text-[10px] uppercase tracking-wider block">Procurement Comments</Label>
                <p className="mt-1 bg-muted/20 border border-border/40 p-3 rounded-lg leading-relaxed text-foreground/80 font-medium">
                  {quotation?.remarks || "No procurement comments logged."}
                </p>
              </div>

              <div>
                <Label className="text-muted-foreground text-[10px] uppercase tracking-wider block">Supplier Quotation Documents</Label>
                {quotation?.documents && quotation.documents.length > 0 ? (
                  <div className="mt-2 space-y-2">
                    {quotation.documents.map((d: any, idx: number) => (
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

          {/* Financial summary calculations */}
          <SectionCard title="Financial Summary" description="Cost breakdowns and final invoice total" icon={DollarSign}>
            <div className="space-y-3 font-mono text-xs">
              <div className="flex justify-between items-center py-1">
                <span className="text-muted-foreground font-sans">Subtotal</span>
                <span>₹ {subtotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center py-1 text-destructive">
                <span className="text-muted-foreground font-sans">Discount</span>
                <span>- ₹ {discountVal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-muted-foreground font-sans">Tax (GST {taxPct}%)</span>
                <span>₹ {taxVal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-muted-foreground font-sans">Freight Charges</span>
                <span>₹ {freightCharges.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center border-t border-border pt-3 font-sans">
                <span className="text-sm font-bold text-foreground">Grand Total</span>
                <strong className="text-lg font-extrabold text-primary font-mono">₹ {grandTotal.toLocaleString()}</strong>
              </div>
            </div>
          </SectionCard>
        </div>

        {/* Approval History Logs */}
        <SectionCard title="Approval History Logs" description="Audit trails of past decisions" icon={History}>
          {po.logs && po.logs.length > 0 ? (
            <div className="space-y-3 text-xs font-sans">
              {po.logs.map((log: any) => (
                <div key={log.id} className="flex gap-4 rounded-xl border border-border p-4 bg-muted/5 items-start">
                  <span className={cn(
                    "rounded-full px-2 py-0.5 text-[9px] font-bold uppercase",
                    log.status === "APPROVED" ? "bg-success-soft/20 text-success" : "bg-destructive-soft/20 text-destructive"
                  )}>
                    {log.status}
                  </span>
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-4 text-[10px] text-muted-foreground">
                      <span>By: <strong className="text-foreground uppercase">{log.actor}</strong></span>
                      <span className="font-mono">{new Date(log.action_date).toLocaleString()}</span>
                    </div>
                    {log.reason && (
                      <div>
                        <span className="font-bold text-muted-foreground text-[10px] block">Reason:</span>
                        <p className="font-semibold text-destructive">{log.reason}</p>
                      </div>
                    )}
                    {log.comments && (
                      <div>
                        <span className="font-bold text-muted-foreground text-[10px] block">Comments:</span>
                        <p className="text-foreground/80">{log.comments}</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic">No past approval cycles recorded for this proposed purchase.</p>
          )}
        </SectionCard>

        {/* Action Panel */}
        {po.status === "PROPOSED" && (
          <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-card/60 p-6 shadow-soft">
            <div className="text-xs text-muted-foreground flex items-center gap-1.5 font-medium">
              <UserCheck className="size-4 text-success" /> Confirm release of capital. This action releases the PO to the supplier.
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="lg"
                className="rounded-xl h-12 text-xs border-destructive/40 text-destructive hover:bg-destructive-soft/10 font-bold"
                disabled={submitting}
                onClick={() => setRejectionModalOpen(true)}
              >
                <XCircle className="size-4 mr-2" /> Reject Proposal
              </Button>
              <Button
                size="lg"
                className="rounded-xl h-12 text-xs bg-success text-success-foreground hover:bg-success/90 shadow-glow font-bold"
                disabled={submitting}
                onClick={handleApprove}
              >
                {submitting ? (
                  <><Loader2 className="mr-2 size-4 animate-spin" /> Processing...</>
                ) : (
                  <><CheckCircle className="mr-2 size-4" /> Approve Proposal</>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Mandatory Rejection Overlay Modal */}
      {rejectionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <Card className="w-full max-w-md border-border/40 bg-card p-6 shadow-glow relative animate-in zoom-in-95 duration-200">
            <button
              onClick={() => setRejectionModalOpen(false)}
              className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
            >
              <X className="size-5" />
            </button>
            <CardHeader className="p-0 mb-4">
              <div className="flex items-center gap-2 text-destructive">
                <XCircle className="size-5" />
                <CardTitle className="text-base font-bold">Reject Purchase Proposal</CardTitle>
              </div>
              <CardDescription className="text-xs">
                A valid reason is required to reject this proposed purchase order.
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleRejectSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Rejection Reason (Mandatory)*</Label>
                <Input
                  placeholder="e.g. Budget exceeded / Incorrect quantities"
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  required
                  className="rounded-xl h-10 border-destructive/40 focus-visible:ring-destructive"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Additional Comments</Label>
                <Textarea
                  placeholder="Write comments or instructions for the procurement team..."
                  className="min-h-[80px] rounded-xl text-xs"
                  value={financeComments}
                  onChange={(e) => setFinanceComments(e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => setRejectionModalOpen(false)} className="rounded-xl">
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting || !rejectionReason.trim()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl shadow-glow font-bold">
                  {submitting ? "Rejecting..." : "Confirm Rejection"}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </AppShell>
  );
}
