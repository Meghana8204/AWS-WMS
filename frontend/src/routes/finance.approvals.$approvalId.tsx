import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Loader2,
  FileText,
  Building2,
  Warehouse,
  User,
  Calendar,
  CreditCard,
  Info,
  Download,
  MessageSquare,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { AppShell, StatusBadge } from "@/components/wms/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api-client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
export const Route = createFileRoute("/finance/approvals/$approvalId")({
  component: ApprovalDetail,
});
function ApprovalDetail() {
  const { approvalId } = Route.useParams();
  const navigate = useNavigate();
  const [po, setPo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [isRejecting, setIsRejecting] = useState(false);
  const [hasRelatedProposals, setHasRelatedProposals] = useState(false);
  const fetchPo = async () => {
    try {
      setLoading(true);
      const data = await api.getPurchaseOrder(approvalId);
      setPo(data);
      if (data.rfqId) {
        const allApprovals = await api.getFinanceApprovals();
        const related = allApprovals.filter(
          (p: any) => p.rfqId === data.rfqId && p.id !== approvalId,
        );
        setHasRelatedProposals(related.length > 0);
      }
    } catch (error) {
      console.error("Failed to fetch PO:", error);
      toast.error("Failed to load purchase order details");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    fetchPo();
  }, [approvalId]);
  const handleApprove = async () => {
    try {
      setProcessing(true);
      await api.approvePurchaseOrder(approvalId);
      toast.success("Purchase order approved successfully!");
      navigate({ to: "/finance/approvals" });
    } catch (error: any) {
      toast.error("Approval failed: " + error.message);
    } finally {
      setProcessing(false);
    }
  };
  const handleReject = async () => {
    if (!rejectionReason) {
      toast.error("Please provide a reason for rejection");
      return;
    }
    try {
      setProcessing(true);
      await api.rejectPurchaseOrder(approvalId, rejectionReason);
      toast.success("Purchase order rejected");
      navigate({ to: "/finance/approvals" });
    } catch (error: any) {
      toast.error("Rejection failed: " + error.message);
    } finally {
      setProcessing(false);
      setIsRejecting(false);
    }
  };
  if (loading) {
    return (
      <AppShell title="Loading Proposal..." subtitle="Please wait">
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="size-8 animate-spin text-primary" />
        </div>
      </AppShell>
    );
  }
  if (!po) return null;
  return (
    <AppShell
      title={`Review PO Proposal: ${po.poNumber}`}
      subtitle={`Submitted on ${new Date(po.createdAt).toLocaleString()}`}
      actions={
        <Button
          variant="outline"
          className="rounded-xl"
          onClick={() => navigate({ to: "/finance/approvals" })}
        >
          <ArrowLeft className="mr-2 size-4" /> Back to Queue
        </Button>
      }
    >
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {hasRelatedProposals && (
            <Card className="bg-primary/5 border-primary/20 shadow-soft overflow-hidden">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                    <Sparkles className="size-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm">Related Proposals Found</h4>
                    <p className="text-xs text-muted-foreground">
                      Multiple suppliers were selected for RFQ: {po.rfqId}
                    </p>
                  </div>
                </div>
                <Button size="sm" className="rounded-xl shadow-glow bg-primary font-bold" asChild>
                  <Link to="/finance/approvals/compare/$rfqId" params={{ rfqId: po.rfqId }}>
                    Open Comparison Matrix <ArrowRight className="ml-2 size-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )}

          <Card className="border-border/40 shadow-soft">
            <CardHeader className="bg-muted/10 border-b border-border/60">
              <div className="flex items-center gap-2">
                <Info className="size-4 text-primary" />
                <CardTitle className="text-sm font-bold uppercase tracking-wider">
                  PO Information
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid gap-6 sm:grid-cols-2">
                <InfoField label="PO Number" value={po.poNumber} mono />
                <InfoField label="PO Date" value={new Date(po.createdAt).toLocaleDateString()} />
                <InfoField label="Supplier" value={po.supplierName} icon={Building2} />
                <InfoField label="Warehouse" value={po.warehouseId} icon={Warehouse} />
                <InfoField label="Procurement Officer" value={po.procurementOfficer} icon={User} />
                <InfoField
                  label="Expected Delivery"
                  value={po.expectedDeliveryDate || "Not Specified"}
                  icon={Calendar}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/40 shadow-soft overflow-hidden">
            <CardHeader className="bg-muted/10 border-b border-border/60">
              <div className="flex items-center gap-2">
                <FileText className="size-4 text-primary" />
                <CardTitle className="text-sm font-bold uppercase tracking-wider">
                  Material Details
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="bg-muted/40 border-b border-border/60 text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
                    <th className="p-4">Material</th>
                    <th className="p-4 text-right">Quantity</th>
                    <th className="p-4">UOM</th>
                    <th className="p-4 text-right">Unit Price</th>
                    <th className="p-4 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {po.items?.map((item: any, idx: number) => (
                    <tr key={idx} className="hover:bg-muted/5 transition-colors">
                      <td className="p-4">
                        <p className="font-semibold text-foreground">{item.materialName}</p>
                        <span className="font-mono text-[10px] text-muted-foreground">
                          {item.materialCode}
                        </span>
                      </td>
                      <td className="p-4 text-right font-mono font-bold">
                        {Math.floor(item.quantity)}
                      </td>
                      <td className="p-4 font-semibold text-muted-foreground">{item.uom}</td>
                      <td className="p-4 text-right font-mono">
                        ₹ {parseFloat(item.unitPrice).toLocaleString()}
                      </td>
                      <td className="p-4 text-right font-mono font-bold">
                        ₹{" "}
                        {(Math.floor(item.quantity) * parseFloat(item.unitPrice)).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          <Card className="border-border/40 shadow-soft">
            <CardHeader className="bg-muted/10 border-b border-border/60">
              <div className="flex items-center gap-2">
                <MessageSquare className="size-4 text-primary" />
                <CardTitle className="text-sm font-bold uppercase tracking-wider">
                  Supporting Information
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div>
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
                  Procurement Selection Reason
                </Label>
                <p className="mt-1 text-sm font-medium text-foreground bg-primary-soft/10 p-3 rounded-xl border border-primary/10">
                  {po.selectionReason || "No reason provided"}
                </p>
              </div>
              {po.procurementComments && (
                <div>
                  <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
                    Procurement Comments
                  </Label>
                  <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                    {po.procurementComments}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="border-border/40 shadow-soft overflow-hidden sticky top-24">
            <CardHeader className="bg-primary text-primary-foreground">
              <div className="flex items-center gap-2">
                <CreditCard className="size-4" />
                <CardTitle className="text-sm font-bold uppercase tracking-wider">
                  Financial Summary
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <SummaryRow label="Subtotal" value={po.subtotal} />
              <SummaryRow label="Discount" value={po.discountAmount} isNegative />
              <SummaryRow
                label={`Tax (GST ${parseFloat(po.taxPercentage || 0).toLocaleString()}%)`}
                value={po.taxAmount}
              />
              <SummaryRow label="Freight Charges" value={po.freightCharges} />
              <SummaryRow label="Freight" value={po.freightCharges} />

              <div className="pt-4 border-t border-border mt-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-foreground uppercase tracking-tight">
                    Grand Total
                  </span>
                  <span className="text-xl font-black text-primary">
                    ₹ {parseFloat(po.totalAmount).toLocaleString()}
                  </span>
                </div>
              </div>

              {po.paymentTerms && (
                <div className="mt-4 p-3 rounded-xl bg-muted/30 border border-border/60">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
                    Payment Terms
                  </p>
                  <p className="text-sm font-semibold">{po.paymentTerms}</p>
                </div>
              )}

              <div className="space-y-3 pt-6">
                {!isRejecting ? (
                  <>
                    <Button
                      className="w-full h-12 rounded-xl bg-success hover:bg-success/90 shadow-glow font-bold"
                      onClick={handleApprove}
                      disabled={processing}
                    >
                      {processing ? (
                        <Loader2 className="size-4 animate-spin mr-2" />
                      ) : (
                        <CheckCircle2 className="size-4 mr-2" />
                      )}
                      Approve PO Proposal
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full h-12 rounded-xl border-destructive/30 text-destructive hover:bg-destructive-soft font-bold"
                      onClick={() => setIsRejecting(true)}
                      disabled={processing}
                    >
                      <XCircle className="size-4 mr-2" />
                      Reject Proposal
                    </Button>
                  </>
                ) : (
                  <div className="space-y-4 animate-in slide-in-from-right-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-destructive">
                        Rejection Reason*
                      </Label>
                      <Textarea
                        placeholder="Please specify why this PO is being rejected..."
                        className="rounded-xl min-h-[100px] border-destructive/20 focus-visible:ring-destructive/20"
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        className="flex-1 rounded-xl text-xs"
                        onClick={() => setIsRejecting(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        className="flex-[2] rounded-xl bg-destructive hover:bg-destructive/90 font-bold text-xs"
                        onClick={handleReject}
                        disabled={processing}
                      >
                        Confirm Rejection
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
function InfoField({ label, value, icon: Icon, mono = false }: any) {
  return (
    <div className="space-y-1.5">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold flex items-center gap-1.5">
        {Icon && <Icon className="size-3" />} {label}
      </p>
      <p className={cn("text-sm font-semibold text-foreground", mono && "font-mono")}>
        {value || "—"}
      </p>
    </div>
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
