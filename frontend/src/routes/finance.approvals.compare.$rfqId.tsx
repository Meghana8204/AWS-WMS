import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  Loader2,
  Table as TableIcon,
  Eye,
  CheckCircle,
  X,
  XCircle,
  ShieldCheck,
  CreditCard,
} from "lucide-react";
import { AppShell, StatusBadge } from "@/components/wms/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { requireRole } from "@/lib/auth-utils";
export const Route = createFileRoute("/finance/approvals/compare/$rfqId")({
  beforeLoad: () => requireRole("FINANCE"),
  component: FinanceComparison,
});
function FinanceComparison() {
  const navigate = useNavigate();
  const { rfqId } = Route.useParams();
  const [approvals, setApprovals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [targetPoId, setTargetPoId] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const fetchData = async () => {
    try {
      setLoading(true);
      const allApprovals = await api.getFinanceApprovals();
      const rfqApprovals = allApprovals.filter((po: any) => po.rfqId === rfqId);
      setApprovals(rfqApprovals);
    } catch (error) {
      console.error("Failed to fetch approvals:", error);
      toast.error("Failed to load comparison data");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    fetchData();
  }, [rfqId]);
  const handleApprove = async (poId: string) => {
    try {
      setSubmitting(true);
      await api.approvePurchaseOrder(poId);
      toast.success("Purchase order approved successfully!");
      navigate({ to: "/finance/approvals" });
    } catch (error: any) {
      toast.error("Approval failed: " + error.message);
    } finally {
      setSubmitting(false);
    }
  };
  const handleOpenRejectModal = (poId: string) => {
    setTargetPoId(poId);
    setIsRejectModalOpen(true);
  };
  const handleConfirmReject = async () => {
    if (!rejectionReason) {
      toast.error("Please provide a reason for rejection");
      return;
    }
    try {
      setSubmitting(true);
      await api.rejectPurchaseOrder(targetPoId, rejectionReason);
      toast.success("Purchase order rejected");
      setIsRejectModalOpen(false);
      setRejectionReason("");
      fetchData();
    } catch (error: any) {
      toast.error("Rejection failed: " + error.message);
    } finally {
      setSubmitting(false);
    }
  };
  const uniqueItemCodes = Array.from(
    new Set(
      approvals.flatMap((po) => po.items?.map((l: any) => l.materialCode || l.item_code) || []),
    ),
  ).filter(Boolean);
  return (
    <AppShell
      title="Finance Comparison Matrix"
      subtitle={`Comparing PO proposals for RFQ: ${approvals[0]?.rfqNumber || rfqId}`}
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
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="size-8 animate-spin text-primary" />
        </div>
      ) : approvals.length === 0 ? (
        <Card className="flex h-64 flex-col items-center justify-center p-6 text-center border-dashed border-border/50 bg-muted/20">
          <ShieldCheck className="size-12 text-muted-foreground/30 mb-4" />
          <h3 className="text-lg font-semibold text-muted-foreground">No proposals found</h3>
          <p className="text-sm text-muted-foreground/70">
            There are no pending proposals for this RFQ.
          </p>
        </Card>
      ) : (
        <div className="space-y-6">
          <Card className="border-border/40 shadow-soft overflow-hidden">
            <CardHeader className="bg-muted/10 border-b border-border/60">
              <div className="flex items-center gap-2">
                <TableIcon className="size-4 text-primary" />
                <CardTitle className="text-sm font-extrabold uppercase tracking-wider">
                  Proposal Comparison Matrix
                </CardTitle>
              </div>
              <CardDescription className="text-xs">
                Compare all selected supplier proposals side-by-side before final financial
                authorization.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-muted/40 border-b border-border/60">
                    <th className="p-4 font-extrabold uppercase tracking-wider w-[200px] border-r border-border/60">
                      Parameter
                    </th>
                    {approvals.map((po, idx) => (
                      <th
                        key={po.id}
                        className={cn(
                          "p-4 font-bold border-r border-border/60 min-w-[240px]",
                          (po.status === "APPROVED" || po.status === "SENT") &&
                            "bg-success-soft/10",
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <span className="block text-sm font-bold text-foreground">
                              {po.supplierName}
                            </span>
                            <span className="block text-[10px] text-muted-foreground uppercase">
                              {po.poNumber}
                            </span>
                          </div>
                          <StatusBadge status={po.status} />
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {uniqueItemCodes.map((code) => (
                    <tr key={code} className="hover:bg-muted/5 transition-colors">
                      <td className="p-4 font-semibold border-r border-border/60 text-muted-foreground uppercase text-[10px] tracking-wider">
                        Rate & Qty
                        <br />
                        <span className="text-[9px] font-mono text-primary font-bold">{code}</span>
                      </td>
                      {approvals.map((po) => {
                        const item = po.items?.find(
                          (i: any) => i.materialCode === code || i.item_code === code,
                        );
                        return (
                          <td
                            key={`${po.id}-${code}`}
                            className="p-4 border-r border-border/60 font-mono"
                          >
                            {item ? (
                              <div className="space-y-1">
                                <div>
                                  <span className="text-muted-foreground text-[10px]">Price:</span>{" "}
                                  <strong>₹ {parseFloat(item.unitPrice).toLocaleString()}</strong>
                                </div>
                                <div>
                                  <span className="text-muted-foreground text-[10px]">Qty:</span>{" "}
                                  {Math.floor(item.quantity)} units
                                </div>
                              </div>
                            ) : (
                              "—"
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}

                  <tr className="hover:bg-muted/5 transition-colors">
                    <td className="p-4 font-semibold border-r border-border/60 text-muted-foreground uppercase text-[10px] tracking-wider">
                      Discount
                    </td>
                    {approvals.map((po) => (
                      <td
                        key={`${po.id}-discount`}
                        className="p-4 border-r border-border/60 font-mono text-destructive"
                      >
                        - ₹ {parseFloat(po.discountAmount || 0).toLocaleString()}
                      </td>
                    ))}
                  </tr>
                  <tr className="hover:bg-muted/5 transition-colors">
                    <td className="p-4 font-semibold border-r border-border/60 text-muted-foreground uppercase text-[10px] tracking-wider">
                      Tax (GST)
                    </td>
                    {approvals.map((po) => (
                      <td key={`${po.id}-tax`} className="p-4 border-r border-border/60 font-mono">
                        ₹ {parseFloat(po.taxAmount || 0).toLocaleString()}
                      </td>
                    ))}
                  </tr>
                  <tr className="hover:bg-muted/5 transition-colors">
                    <td className="p-4 font-semibold border-r border-border/60 text-muted-foreground uppercase text-[10px] tracking-wider">
                      Freight
                    </td>
                    {approvals.map((po) => (
                      <td
                        key={`${po.id}-freight`}
                        className="p-4 border-r border-border/60 font-mono"
                      >
                        ₹ {parseFloat(po.freightCharges || 0).toLocaleString()}
                      </td>
                    ))}
                  </tr>

                  <tr className="hover:bg-muted/5 transition-colors">
                    <td className="p-4 font-semibold border-r border-border/60 text-muted-foreground uppercase text-[10px] tracking-wider">
                      Exp. Delivery
                    </td>
                    {approvals.map((po) => (
                      <td
                        key={`${po.id}-del`}
                        className="p-4 border-r border-border/60 font-medium"
                      >
                        {po.expectedDeliveryDate || "—"}
                      </td>
                    ))}
                  </tr>
                  <tr className="hover:bg-muted/5 transition-colors">
                    <td className="p-4 font-semibold border-r border-border/60 text-muted-foreground uppercase text-[10px] tracking-wider">
                      Payment Terms
                    </td>
                    {approvals.map((po) => (
                      <td
                        key={`${po.id}-pay`}
                        className="p-4 border-r border-border/60 text-[10px] font-medium leading-relaxed"
                      >
                        {po.paymentTerms || "—"}
                      </td>
                    ))}
                  </tr>

                  <tr className="hover:bg-muted/5 transition-colors">
                    <td className="p-4 font-semibold border-r border-border/60 text-muted-foreground uppercase text-[10px] tracking-wider bg-primary-soft/5">
                      Selection Reason
                    </td>
                    {approvals.map((po) => (
                      <td
                        key={`${po.id}-reason`}
                        className="p-4 border-r border-border/60 text-[11px] font-bold text-primary bg-primary-soft/5"
                      >
                        {po.selectionReason || "—"}
                      </td>
                    ))}
                  </tr>
                  <tr className="hover:bg-muted/5 transition-colors">
                    <td className="p-4 font-semibold border-r border-border/60 text-muted-foreground uppercase text-[10px] tracking-wider">
                      Procurement Comments
                    </td>
                    {approvals.map((po) => (
                      <td
                        key={`${po.id}-comments`}
                        className="p-4 border-r border-border/60 text-[10px] text-muted-foreground leading-relaxed italic"
                      >
                        {po.procurementComments || "No additional comments"}
                      </td>
                    ))}
                  </tr>

                  <tr className="bg-primary/5">
                    <td className="p-4 font-extrabold border-r border-border/60 text-primary uppercase text-[10px] tracking-wider">
                      Grand Total
                    </td>
                    {approvals.map((po) => (
                      <td
                        key={`${po.id}-total`}
                        className="p-4 border-r border-border/60 font-mono text-base font-black text-primary"
                      >
                        ₹ {parseFloat(po.totalAmount).toLocaleString()}
                      </td>
                    ))}
                  </tr>

                  <tr className="bg-muted/10">
                    <td className="p-4 border-r border-border/60"></td>
                    {approvals.map((po) => (
                      <td key={`${po.id}-actions`} className="p-4 border-r border-border/60">
                        {po.status === "PENDING_FINANCE" ? (
                          <div className="flex flex-col gap-2">
                            <Button
                              size="sm"
                              className="w-full rounded-xl bg-success hover:bg-success/90 font-bold text-xs h-9 shadow-glow"
                              onClick={() => handleApprove(po.id)}
                              disabled={submitting}
                            >
                              <CheckCircle className="size-3.5 mr-1.5" /> Approve
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full rounded-xl border-destructive/40 text-destructive hover:bg-destructive/10 font-bold text-xs h-9"
                              onClick={() => handleOpenRejectModal(po.id)}
                              disabled={submitting}
                            >
                              <XCircle className="size-3.5 mr-1.5" /> Reject
                            </Button>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full rounded-xl font-bold text-xs h-9 opacity-60"
                              disabled
                            >
                              Action Completed
                            </Button>
                          </div>
                        )}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      )}

      {isRejectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <Card className="w-full max-w-md border-border/40 bg-card p-6 shadow-glow relative animate-in zoom-in-95 duration-200">
            <button
              onClick={() => setIsRejectModalOpen(false)}
              className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
            >
              <X className="size-5" />
            </button>
            <CardHeader className="p-0 mb-4">
              <div className="flex items-center gap-2 text-destructive">
                <XCircle className="size-5" />
                <CardTitle className="text-base font-bold">Reject Proposal</CardTitle>
              </div>
              <CardDescription className="text-xs">
                Provide a reason for rejecting this PO proposal.
              </CardDescription>
            </CardHeader>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Rejection Reason*</Label>
                <Textarea
                  placeholder="Why is this proposal being rejected?"
                  className="min-h-[100px] rounded-xl text-sm"
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setIsRejectModalOpen(false)}
                  className="rounded-xl"
                >
                  Cancel
                </Button>
                <Button
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl shadow-glow min-w-[140px] font-bold"
                  onClick={handleConfirmReject}
                  disabled={submitting}
                >
                  {submitting ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
                  Confirm Rejection
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </AppShell>
  );
}
