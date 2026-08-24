import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  FileBadge,
  ArrowLeft,
  CheckCircle2,
  Download,
  Trophy,
  Loader2,
  Table as TableIcon,
  MessageSquare,
  Sparkles,
  Eye,
  CheckCircle,
  X,
  XCircle,
  ArrowRight,
  FileCheck2,
} from "lucide-react";
import { AppShell } from "@/components/wms/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";
type QuotationsSearch = {
  rfqId?: string;
};
export const Route = createFileRoute("/procurement/quotations")({
  component: Quotations,
  validateSearch: (search: Record<string, unknown>): QuotationsSearch => {
    return {
      rfqId: (search.rfqId as string) || undefined,
    };
  },
});
function Quotations() {
  const navigate = useNavigate();
  const { rfqId } = Route.useSearch();
  const [quotations, setQuotations] = useState<any[]>([]);
  const [rfq, setRfq] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [evalComments, setEvalComments] = useState<Record<string, string>>({});
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"SELECT" | "REJECT">("SELECT");
  const [submitting, setSubmitting] = useState(false);
  const [targetQuotationId, setTargetQuotationId] = useState("");
  const [targetSupplierId, setTargetSupplierId] = useState("");
  const [reason, setReason] = useState("");
  const [procurementComments, setProcurementComments] = useState("");
  const fetchData = async () => {
    try {
      setLoading(true);
      const [quotesData, rfqData] = await Promise.all([
        api.getQuotations(rfqId),
        rfqId ? api.getRfq(rfqId) : Promise.resolve(null),
      ]);
      setQuotations(quotesData);
      setRfq(rfqData);
      const comments: Record<string, string> = {};
      quotesData.forEach((q: any) => {
        comments[q.id] = q.remarks || "";
      });
      setEvalComments(comments);
    } catch (error) {
      console.error("Failed to fetch data:", error);
      toast.error("Failed to load quotations");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    fetchData();
  }, [rfqId]);
  const selectionFinalized = quotations.some((quotation) => quotation.status === "Selected");
  const handleOpenModal = (quotationId: string, supplierId: string, mode: "SELECT" | "REJECT") => {
    setTargetQuotationId(quotationId);
    setTargetSupplierId(supplierId);
    setModalMode(mode);
    setReason(mode === "SELECT" ? "L1 Cost Effective Bid" : "");
    if (mode === "SELECT") {
    }
    setIsModalOpen(true);
  };
  const handleAction = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const effectiveRfqId = rfqId || quotations.find((q) => q.id === targetQuotationId)?.rfqId;
    if (!targetQuotationId) {
      toast.error("Required selection IDs are missing.");
      return;
    }
    try {
      setSubmitting(true);
      if (modalMode === "SELECT") {
        if (!effectiveRfqId || !targetSupplierId) {
          toast.error("Missing RFQ or Supplier ID for selection");
          return;
        }
        const result = await api.selectSupplier(effectiveRfqId, {
          supplier_id: targetSupplierId,
          selection_reason: reason,
          selection_comments: procurementComments,
        });
        toast.success(
          result.status === "already_saved"
            ? `Selection already saved as ${result.po_number}`
            : "Supplier selected and PO proposal generated",
        );
      } else {
        await api.rejectQuotation(targetQuotationId, reason);
        toast.success("Quotation rejected");
      }
      setIsModalOpen(false);
      fetchData();
      setReason("");
      setProcurementComments("");
    } catch (error: any) {
      toast.error(`Action failed: ${error.message}`);
    } finally {
      setSubmitting(false);
    }
  };
  const handleSaveComment = async (id: string) => {
    try {
      await api.updateQuotation(id, { remarks: evalComments[id] });
      toast.success("Evaluation comment saved!");
    } catch (error: any) {
      toast.error("Failed to save evaluation comment: " + error.message);
    }
  };
  const uniqueItemCodes = Array.from(
    new Set(quotations.flatMap((q) => q.lines?.map((l: any) => l.itemCode || l.item_code) || [])),
  ).filter(Boolean);
  return (
    <AppShell
      title="Quotation Comparison Matrix"
      subtitle={
        rfqId
          ? `Comparing bids for RFQ: ${rfq?.rfqNumber || rfqId}`
          : "Select an RFQ to view side-by-side supplier comparisons"
      }
      actions={
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            className="rounded-xl"
            onClick={() => navigate({ to: "/procurement/rfqs" })}
          >
            <ArrowLeft className="mr-2 size-4" /> Back to RFQs
          </Button>
        </div>
      }
    >
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="size-8 animate-spin text-primary" />
        </div>
      ) : quotations.length === 0 ? (
        <Card className="flex h-64 flex-col items-center justify-center p-6 text-center border-dashed border-border/50 bg-muted/20">
          <FileBadge className="size-12 text-muted-foreground/30 mb-4" />
          <h3 className="text-lg font-semibold text-muted-foreground">No quotations found</h3>
          <p className="text-sm text-muted-foreground/70">
            There are currently no quotations received for this request.
          </p>
        </Card>
      ) : (
        <div className="space-y-6">
          <Card className="border-border/40 shadow-soft overflow-hidden">
            <CardHeader className="bg-muted/10 border-b border-border/60">
              <div className="flex items-center gap-2">
                <TableIcon className="size-4 text-primary" />
                <CardTitle className="text-sm font-extrabold uppercase tracking-wider">
                  Comparison Matrix
                </CardTitle>
              </div>
              <CardDescription className="text-xs">
                Supplier proposals compared side-by-side across logistical & commercial criteria.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-muted/40 border-b border-border/60">
                    <th
                      key="header-param"
                      className="p-4 font-extrabold uppercase tracking-wider w-[200px] border-r border-border/60"
                    >
                      Parameter
                    </th>
                    {quotations.map((q, idx) => (
                      <th
                        key={q.id || `q-head-${idx}`}
                        className={cn(
                          "p-4 font-bold border-r border-border/60 min-w-[220px]",
                          q.status === "Selected" && "bg-primary-soft/10",
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <span className="block text-sm font-bold text-foreground">
                              {q.supplierInfo?.supplierName || `Supplier ${idx + 1}`}
                            </span>
                            <span className="block text-[10px] text-muted-foreground uppercase">
                              {q.id.substring(0, 8)}
                            </span>
                          </div>
                          {q.status === "Selected" && (
                            <span className="flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider bg-success-soft/30 text-success px-2 py-0.5 rounded-full">
                              <Sparkles className="size-3" /> Selected L1
                            </span>
                          )}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {uniqueItemCodes.map((code) => (
                    <tr key={`row-item-${code}`} className="hover:bg-muted/5 transition-colors">
                      <td
                        key="param-name"
                        className="p-4 font-semibold border-r border-border/60 text-muted-foreground uppercase text-[10px] tracking-wider"
                      >
                        Rate & Available Qty
                        <br />
                        <span className="text-[9px] font-mono text-primary font-bold">{code}</span>
                      </td>
                      {quotations.map((q, idx) => {
                        const line = q.lines?.find(
                          (l: any) => l.itemCode === code || l.item_code === code,
                        );
                        return (
                          <td
                            key={q.id || `q-item-${code}-${idx}`}
                            className={cn(
                              "p-4 border-r border-border/60",
                              q.status === "Selected" && "bg-primary-soft/5",
                            )}
                          >
                            {line ? (
                              <div className="space-y-1 font-mono">
                                <div>
                                  <span className="text-muted-foreground text-[10px]">Price:</span>{" "}
                                  <strong className="text-sm font-bold text-foreground">
                                    ₹{" "}
                                    {parseFloat(line.unitPrice || line.unit_price).toLocaleString()}
                                  </strong>
                                </div>
                                <div>
                                  <span className="text-muted-foreground text-[10px]">Qty:</span>{" "}
                                  <span className="font-semibold">
                                    {Math.floor(parseFloat(line.quantity)).toLocaleString()} units
                                  </span>
                                </div>
                              </div>
                            ) : (
                              <span className="text-muted-foreground font-mono">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}

                  <tr key="row-discount" className="hover:bg-muted/5 transition-colors">
                    <td
                      key="param-discount"
                      className="p-4 font-semibold border-r border-border/60 text-muted-foreground uppercase text-[10px] tracking-wider"
                    >
                      Discount
                    </td>
                    {quotations.map((q, idx) => (
                      <td
                        key={q.id || `q-disc-${idx}`}
                        className={cn(
                          "p-4 border-r border-border/60 font-mono text-sm",
                          q.status === "Selected" && "bg-primary-soft/5",
                        )}
                      >
                        ₹ {parseFloat(q.discount || 0).toLocaleString()}
                      </td>
                    ))}
                  </tr>

                  <tr key="row-tax" className="hover:bg-muted/5 transition-colors">
                    <td
                      key="param-tax"
                      className="p-4 font-semibold border-r border-border/60 text-muted-foreground uppercase text-[10px] tracking-wider"
                    >
                      Tax (GST %)
                    </td>
                    {quotations.map((q, idx) => (
                      <td
                        key={q.id || `q-tax-${idx}`}
                        className={cn(
                          "p-4 border-r border-border/60 font-mono text-sm",
                          q.status === "Selected" && "bg-primary-soft/5",
                        )}
                      >
                        {parseFloat(q.tax || 0)} %
                      </td>
                    ))}
                  </tr>

                  <tr key="row-freight" className="hover:bg-muted/5 transition-colors">
                    <td
                      key="param-freight"
                      className="p-4 font-semibold border-r border-border/60 text-muted-foreground uppercase text-[10px] tracking-wider"
                    >
                      Freight Charges
                    </td>
                    {quotations.map((q, idx) => (
                      <td
                        key={q.id || `q-freight-${idx}`}
                        className={cn(
                          "p-4 border-r border-border/60 font-mono text-sm",
                          q.status === "Selected" && "bg-primary-soft/5",
                        )}
                      >
                        ₹ {parseFloat(q.freightCharges || q.freight_charges || 0).toLocaleString()}
                      </td>
                    ))}
                  </tr>

                  <tr key="row-delivery-time" className="hover:bg-muted/5 transition-colors">
                    <td
                      key="param-del-time"
                      className="p-4 font-semibold border-r border-border/60 text-muted-foreground uppercase text-[10px] tracking-wider"
                    >
                      Delivery Time
                    </td>
                    {quotations.map((q, idx) => (
                      <td
                        key={q.id || `q-deltime-${idx}`}
                        className={cn(
                          "p-4 border-r border-border/60 text-sm font-semibold",
                          q.status === "Selected" && "bg-primary-soft/5",
                        )}
                      >
                        {q.deliveryTime || q.delivery_time || "—"}
                      </td>
                    ))}
                  </tr>

                  <tr key="row-expected-delivery" className="hover:bg-muted/5 transition-colors">
                    <td
                      key="param-exp-del"
                      className="p-4 font-semibold border-r border-border/60 text-muted-foreground uppercase text-[10px] tracking-wider"
                    >
                      Expected Delivery
                    </td>
                    {quotations.map((q, idx) => (
                      <td
                        key={q.id || `q-expdel-${idx}`}
                        className={cn(
                          "p-4 border-r border-border/60 font-mono text-sm",
                          q.status === "Selected" && "bg-primary-soft/5",
                        )}
                      >
                        {q.expectedDeliveryDate || q.expected_delivery_date || "—"}
                      </td>
                    ))}
                  </tr>

                  <tr key="row-payment-terms" className="hover:bg-muted/5 transition-colors">
                    <td
                      key="param-payment"
                      className="p-4 font-semibold border-r border-border/60 text-muted-foreground uppercase text-[10px] tracking-wider"
                    >
                      Payment Terms
                    </td>
                    {quotations.map((q, idx) => (
                      <td
                        key={q.id || `q-pay-${idx}`}
                        className={cn(
                          "p-4 border-r border-border/60 text-sm font-medium",
                          q.status === "Selected" && "bg-primary-soft/5",
                        )}
                      >
                        {q.paymentTerms || q.payment_terms || "—"}
                      </td>
                    ))}
                  </tr>

                  <tr key="row-total-amount" className="bg-muted/20">
                    <td
                      key="param-total"
                      className="p-4 font-extrabold border-r border-border/60 text-foreground uppercase text-[10px] tracking-wider"
                    >
                      Total Net Amount
                    </td>
                    {quotations.map((q, idx) => {
                      let total = parseFloat(q.totalAmount || q.total_amount || 0);
                      if (total === 0 && q.lines && q.lines.length > 0) {
                        const lineTotal = q.lines.reduce(
                          (sum: number, l: any) =>
                            sum +
                            parseFloat(l.quantity) * parseFloat(l.unitPrice || l.unit_price || 0),
                          0,
                        );
                        const disc = parseFloat(q.discount || 0);
                        const tx = parseFloat(q.tax || 0);
                        const fr = parseFloat(q.freightCharges || q.freight_charges || 0);
                        const base = lineTotal - disc;
                        total = base + base * (tx / 100) + fr;
                      }
                      return (
                        <td
                          key={q.id || `q-total-${idx}`}
                          className={cn(
                            "p-4 border-r border-border/60 font-mono text-base font-extrabold text-primary",
                            q.status === "Selected" && "bg-primary-soft/5",
                          )}
                        >
                          ₹ {Math.floor(total).toLocaleString()}
                        </td>
                      );
                    })}
                  </tr>

                  <tr key="row-documents" className="hover:bg-muted/5 transition-colors">
                    <td
                      key="param-docs"
                      className="p-4 font-semibold border-r border-border/60 text-muted-foreground uppercase text-[10px] tracking-wider"
                    >
                      Documents
                    </td>
                    {quotations.map((q, idx) => (
                      <td
                        key={q.id || `q-docs-${idx}`}
                        className={cn(
                          "p-4 border-r border-border/60 space-y-1.5",
                          q.status === "Selected" && "bg-primary-soft/5",
                        )}
                      >
                        {q.documents && q.documents.length > 0 ? (
                          q.documents.map((d: any, dIdx: number) => (
                            <a
                              key={`${q.id}-doc-${dIdx}`}
                              href={d.file_url}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center gap-1 text-[11px] text-primary font-bold hover:underline"
                            >
                              <Download className="size-3" /> {d.file_name}
                            </a>
                          ))
                        ) : (
                          <span className="text-muted-foreground text-xs">
                            No documents attached
                          </span>
                        )}
                      </td>
                    ))}
                  </tr>

                  <tr key="row-comments" className="hover:bg-muted/5 transition-colors">
                    <td
                      key="param-comments"
                      className="p-4 font-semibold border-r border-border/60 text-muted-foreground uppercase text-[10px] tracking-wider flex items-center gap-1"
                    >
                      <MessageSquare className="size-3 text-muted-foreground" /> Comments
                    </td>
                    {quotations.map((q, idx) => (
                      <td
                        key={q.id || `q-comm-${idx}`}
                        className={cn(
                          "p-4 border-r border-border/60 space-y-2",
                          q.status === "Selected" && "bg-primary-soft/5",
                        )}
                      >
                        <Textarea
                          placeholder="Add evaluation remarks..."
                          className="min-h-[60px] rounded-xl text-xs"
                          value={evalComments[q.id] || ""}
                          onChange={(e) =>
                            setEvalComments((prev) => ({ ...prev, [q.id]: e.target.value }))
                          }
                        />
                        <Button
                          variant="secondary"
                          size="sm"
                          className="rounded-lg text-[10px] h-7 w-full font-bold uppercase"
                          onClick={() => handleSaveComment(q.id)}
                        >
                          Save Comment
                        </Button>
                      </td>
                    ))}
                  </tr>

                  <tr key="row-actions" className="bg-muted/10">
                    <td key="param-actions" className="p-4 border-r border-border/60"></td>
                    {quotations.map((q, idx) => (
                      <td
                        key={q.id || `q-act-${idx}`}
                        className={cn(
                          "p-4 border-r border-border/60",
                          q.status === "Selected" && "bg-primary-soft/5",
                        )}
                      >
                        {q.status === "Selected" ? (
                          <div className="space-y-2">
                            <Button
                              size="sm"
                              className="w-full rounded-xl bg-success/20 text-success border-success/30 font-bold text-xs"
                              disabled
                            >
                              <CheckCircle2 className="size-3.5 mr-1.5" /> Selected
                            </Button>
                            <p className="text-center text-[10px] font-medium text-muted-foreground">
                              Saved for Finance review
                            </p>
                          </div>
                        ) : q.status === "Rejected" ? (
                          <div className="space-y-2">
                            <Button
                              size="sm"
                              className="w-full rounded-xl bg-destructive/20 text-destructive border-destructive/30 font-bold text-xs"
                              disabled
                            >
                              <X className="size-3.5 mr-1.5" /> Rejected
                            </Button>
                            {!selectionFinalized && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="w-full rounded-xl text-primary hover:bg-primary/10 text-[10px]"
                                onClick={() =>
                                  handleOpenModal(q.id, q.supplierId || q.supplier_id, "SELECT")
                                }
                              >
                                Change to Select
                              </Button>
                            )}
                          </div>
                        ) : (
                          <div className="flex flex-col gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full rounded-xl border-primary/40 text-primary hover:bg-primary-soft font-bold text-xs"
                              onClick={() =>
                                handleOpenModal(q.id, q.supplierId || q.supplier_id, "SELECT")
                              }
                            >
                              <CheckCircle className="size-3.5 mr-1.5" /> Select
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full rounded-xl border-destructive/40 text-destructive hover:bg-destructive/10 font-bold text-xs"
                              onClick={() =>
                                handleOpenModal(q.id, q.supplierId || q.supplier_id, "REJECT")
                              }
                            >
                              <X className="size-3.5 mr-1.5" /> Reject
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

          {quotations.some((q) => q.status === "Selected") && (
            <div className="flex justify-end pt-4">
              <Button
                size="lg"
                className="rounded-xl shadow-glow bg-primary font-bold"
                onClick={() => navigate({ to: "/procurement/purchase-orders" })}
              >
                View Generated PO Proposals <ArrowRight className="ml-2 size-5" />
              </Button>
            </div>
          )}
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <Card className="w-full max-w-md border-border/40 bg-card p-6 shadow-glow relative animate-in zoom-in-95 duration-200">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
            >
              <X className="size-5" />
            </button>
            <CardHeader className="p-0 mb-4">
              <div
                className={cn(
                  "flex items-center gap-2",
                  modalMode === "SELECT" ? "text-primary" : "text-destructive",
                )}
              >
                {modalMode === "SELECT" ? (
                  <FileCheck2 className="size-5" />
                ) : (
                  <XCircle className="size-5" />
                )}
                <CardTitle className="text-base font-bold">
                  {modalMode === "SELECT" ? "Select Supplier & Generate PO" : "Reject Quotation"}
                </CardTitle>
              </div>
              <CardDescription className="text-xs">
                {modalMode === "SELECT"
                  ? "Log the supplier selection reasoning to finalize the evaluation process."
                  : "Provide a reason for rejecting this quotation."}
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleAction} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs">
                  {modalMode === "SELECT" ? "Selection Reason*" : "Rejection Reason*"}
                </Label>
                <Input
                  placeholder={
                    modalMode === "SELECT"
                      ? "e.g. L1 Price / Technical Fit"
                      : "e.g. High price / Poor delivery terms"
                  }
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  required
                  className="rounded-xl h-10"
                />
              </div>

              {modalMode === "SELECT" && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Procurement Evaluation Comments</Label>
                  <Textarea
                    placeholder="Write selection notes or evaluations details..."
                    className="min-h-[90px] rounded-xl text-xs"
                    value={procurementComments}
                    onChange={(e) => setProcurementComments(e.target.value)}
                  />
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-xl"
                  disabled={submitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className={cn(
                    "rounded-xl shadow-glow min-w-[140px] font-bold",
                    modalMode === "SELECT"
                      ? "bg-primary text-primary-foreground hover:bg-primary/90"
                      : "bg-destructive text-destructive-foreground hover:bg-destructive/90",
                  )}
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" /> Processing...
                    </>
                  ) : modalMode === "SELECT" ? (
                    "Finalize & Select"
                  ) : (
                    "Confirm Rejection"
                  )}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </AppShell>
  );
}
