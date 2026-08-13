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
  FileCheck2
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
  const [loading, setLoading] = useState(true);

  // Comments state
  const [evalComments, setEvalComments] = useState<Record<string, string>>({});

  // Selection Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [targetQuotationId, setTargetQuotationId] = useState("");
  const [targetSupplierId, setTargetSupplierId] = useState("");
  const [selectionReason, setSelectionReason] = useState("L1 Cost Effective Bid");
  const [procurementComments, setProcurementComments] = useState("");

  const fetchData = async () => {
    try {
      setLoading(true);
      const data = await api.getQuotations(rfqId);
      setQuotations(data);

      // Initialize comments
      const comments: Record<string, string> = {};
      data.forEach((q: any) => {
        comments[q.id] = q.remarks || "";
      });
      setEvalComments(comments);
    } catch (error) {
      console.error("Failed to fetch quotations:", error);
      toast.error("Failed to load quotations");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [rfqId]);

  const handleOpenSelectionModal = (quotationId: string, supplierId: string) => {
    setTargetQuotationId(quotationId);
    setTargetSupplierId(supplierId);
    setIsModalOpen(true);
  };

  const handleConfirmSelection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rfqId || !targetSupplierId || !targetQuotationId) return;

    try {
      // 1. Submit RFQ supplier selection details
      await api.selectSupplier(rfqId, {
        supplier_id: targetSupplierId,
        selection_reason: selectionReason,
        selection_comments: procurementComments,
      });

      // 2. Mark the winning quotation as 'Selected'
      await api.updateQuotation(targetQuotationId, { status: "Selected" });

      toast.success("Supplier selected and quotation locked!");
      setIsModalOpen(false);
      fetchData(); // reload status
    } catch (error: any) {
      toast.error("Failed to complete selection: " + error.message);
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

  const handleCreatePO = async (q: any) => {
    try {
      const payload = {
        quotation_id: q.id,
        supplier_id: q.supplier_id,
        lines: q.lines.map((l: any) => ({
          item_code: l.item_code,
          ordered_quantity: l.quantity,
          unit_price: l.unit_price,
        })),
        po_number: `PO-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
        po_date: new Date().toISOString().split('T')[0]
      };
      await api.createPurchaseOrder(payload);
      toast.success("Purchase Order generated successfully!");
      navigate({ to: "/procurement/purchase-orders" });
    } catch (error: any) {
      toast.error("Failed to create PO: " + error.message);
    }
  };

  // Group line items by code to compare pricing
  const uniqueItemCodes = Array.from(
    new Set(quotations.flatMap((q) => q.lines?.map((l: any) => l.item_code) || []))
  );

  return (
    <AppShell
      title="Quotation Comparison Matrix"
      subtitle={rfqId ? `Comparing bids for RFQ: ${rfqId}` : "Select an RFQ to view side-by-side supplier comparisons"}
      actions={
        <Button variant="outline" className="rounded-xl" onClick={() => navigate({ to: "/procurement/rfqs" })}>
          <ArrowLeft className="mr-2 size-4" /> Back to RFQs
        </Button>
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
          <p className="text-sm text-muted-foreground/70">There are currently no quotations received for this request.</p>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Side-by-side parameters matrix */}
          <Card className="border-border/40 shadow-soft overflow-hidden">
            <CardHeader className="bg-muted/10 border-b border-border/60">
              <div className="flex items-center gap-2">
                <TableIcon className="size-4 text-primary" />
                <CardTitle className="text-sm font-extrabold uppercase tracking-wider">Comparison Matrix</CardTitle>
              </div>
              <CardDescription className="text-xs">Supplier proposals compared side-by-side across logistical & commercial criteria.</CardDescription>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-muted/40 border-b border-border/60">
                    <th className="p-4 font-extrabold uppercase tracking-wider w-[200px] border-r border-border/60">Parameter</th>
                    {quotations.map((q, idx) => (
                      <th key={q.id} className={cn(
                        "p-4 font-bold border-r border-border/60 min-w-[220px]",
                        q.status === "Selected" && "bg-primary-soft/10"
                      )}>
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <span className="block text-sm font-bold text-foreground">Supplier {idx + 1}</span>
                            <span className="block text-[10px] text-muted-foreground uppercase">{q.id.substring(0, 8)}</span>
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
                  {/* Item Rates and Qty */}
                  {uniqueItemCodes.map((code) => (
                    <tr key={code} className="hover:bg-muted/5 transition-colors">
                      <td className="p-4 font-semibold border-r border-border/60 text-muted-foreground uppercase text-[10px] tracking-wider">
                        Rate & Available Qty<br />
                        <span className="text-[9px] font-mono text-primary font-bold">{code}</span>
                      </td>
                      {quotations.map((q) => {
                        const line = q.lines?.find((l: any) => l.item_code === code);
                        return (
                          <td key={q.id} className={cn(
                            "p-4 border-r border-border/60",
                            q.status === "Selected" && "bg-primary-soft/5"
                          )}>
                            {line ? (
                              <div className="space-y-1 font-mono">
                                <div><span className="text-muted-foreground text-[10px]">Price:</span> <strong className="text-sm font-bold text-foreground">₹ {parseFloat(line.unit_price).toLocaleString()}</strong></div>
                                <div><span className="text-muted-foreground text-[10px]">Qty:</span> <span className="font-semibold">{parseFloat(line.quantity).toLocaleString()} units</span></div>
                              </div>
                            ) : (
                              <span className="text-muted-foreground font-mono">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}

                  {/* Discount */}
                  <tr className="hover:bg-muted/5 transition-colors">
                    <td className="p-4 font-semibold border-r border-border/60 text-muted-foreground uppercase text-[10px] tracking-wider">Discount</td>
                    {quotations.map((q) => (
                      <td key={q.id} className={cn("p-4 border-r border-border/60 font-mono text-sm", q.status === "Selected" && "bg-primary-soft/5")}>
                        ₹ {parseFloat(q.discount || 0).toLocaleString()}
                      </td>
                    ))}
                  </tr>

                  {/* Tax */}
                  <tr className="hover:bg-muted/5 transition-colors">
                    <td className="p-4 font-semibold border-r border-border/60 text-muted-foreground uppercase text-[10px] tracking-wider">Tax (GST %)</td>
                    {quotations.map((q) => (
                      <td key={q.id} className={cn("p-4 border-r border-border/60 font-mono text-sm", q.status === "Selected" && "bg-primary-soft/5")}>
                        {parseFloat(q.tax || 0)} %
                      </td>
                    ))}
                  </tr>

                  {/* Freight */}
                  <tr className="hover:bg-muted/5 transition-colors">
                    <td className="p-4 font-semibold border-r border-border/60 text-muted-foreground uppercase text-[10px] tracking-wider">Freight Charges</td>
                    {quotations.map((q) => (
                      <td key={q.id} className={cn("p-4 border-r border-border/60 font-mono text-sm", q.status === "Selected" && "bg-primary-soft/5")}>
                        ₹ {parseFloat(q.freight_charges || 0).toLocaleString()}
                      </td>
                    ))}
                  </tr>

                  {/* Delivery Time */}
                  <tr className="hover:bg-muted/5 transition-colors">
                    <td className="p-4 font-semibold border-r border-border/60 text-muted-foreground uppercase text-[10px] tracking-wider">Delivery Time</td>
                    {quotations.map((q) => (
                      <td key={q.id} className={cn("p-4 border-r border-border/60 text-sm font-semibold", q.status === "Selected" && "bg-primary-soft/5")}>
                        {q.delivery_time || "—"}
                      </td>
                    ))}
                  </tr>

                  {/* Expected Delivery Date */}
                  <tr className="hover:bg-muted/5 transition-colors">
                    <td className="p-4 font-semibold border-r border-border/60 text-muted-foreground uppercase text-[10px] tracking-wider">Expected Delivery</td>
                    {quotations.map((q) => (
                      <td key={q.id} className={cn("p-4 border-r border-border/60 font-mono text-sm", q.status === "Selected" && "bg-primary-soft/5")}>
                        {q.expected_delivery_date || "—"}
                      </td>
                    ))}
                  </tr>

                  {/* Payment Terms */}
                  <tr className="hover:bg-muted/5 transition-colors">
                    <td className="p-4 font-semibold border-r border-border/60 text-muted-foreground uppercase text-[10px] tracking-wider">Payment Terms</td>
                    {quotations.map((q) => (
                      <td key={q.id} className={cn("p-4 border-r border-border/60 text-sm font-medium", q.status === "Selected" && "bg-primary-soft/5")}>
                        {q.payment_terms || "—"}
                      </td>
                    ))}
                  </tr>

                  {/* Total Amount */}
                  <tr className="bg-muted/20">
                    <td className="p-4 font-extrabold border-r border-border/60 text-foreground uppercase text-[10px] tracking-wider">Total Net Amount</td>
                    {quotations.map((q) => (
                      <td key={q.id} className={cn("p-4 border-r border-border/60 font-mono text-base font-extrabold text-primary", q.status === "Selected" && "bg-primary-soft/5")}>
                        ₹ {parseFloat(q.total_amount || 0).toLocaleString()}
                      </td>
                    ))}
                  </tr>

                  {/* Documents */}
                  <tr className="hover:bg-muted/5 transition-colors">
                    <td className="p-4 font-semibold border-r border-border/60 text-muted-foreground uppercase text-[10px] tracking-wider">Documents</td>
                    {quotations.map((q) => (
                      <td key={q.id} className={cn("p-4 border-r border-border/60 space-y-1.5", q.status === "Selected" && "bg-primary-soft/5")}>
                        {q.documents && q.documents.length > 0 ? (
                          q.documents.map((d: any, idx: number) => (
                            <a
                              key={idx}
                              href={d.file_url}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center gap-1 text-[11px] text-primary font-bold hover:underline"
                            >
                              <Download className="size-3" /> {d.file_name}
                            </a>
                          ))
                        ) : (
                          <span className="text-muted-foreground text-xs">No documents attached</span>
                        )}
                      </td>
                    ))}
                  </tr>

                  {/* Evaluation Comments */}
                  <tr className="hover:bg-muted/5 transition-colors">
                    <td className="p-4 font-semibold border-r border-border/60 text-muted-foreground uppercase text-[10px] tracking-wider flex items-center gap-1">
                      <MessageSquare className="size-3 text-muted-foreground" /> Comments
                    </td>
                    {quotations.map((q) => (
                      <td key={q.id} className={cn("p-4 border-r border-border/60 space-y-2", q.status === "Selected" && "bg-primary-soft/5")}>
                        <Textarea
                          placeholder="Add evaluation remarks..."
                          className="min-h-[60px] rounded-xl text-xs"
                          value={evalComments[q.id] || ""}
                          onChange={(e) => setEvalComments((prev) => ({ ...prev, [q.id]: e.target.value }))}
                        />
                        <Button variant="secondary" size="sm" className="rounded-lg text-[10px] h-7 w-full font-bold uppercase" onClick={() => handleSaveComment(q.id)}>
                          Save Comment
                        </Button>
                      </td>
                    ))}
                  </tr>

                  {/* Selection Actions */}
                  <tr className="bg-muted/10">
                    <td className="p-4 border-r border-border/60"></td>
                    {quotations.map((q) => (
                      <td key={q.id} className={cn("p-4 border-r border-border/60", q.status === "Selected" && "bg-primary-soft/5")}>
                        {q.status === "Selected" ? (
                          <Button size="sm" className="w-full rounded-xl bg-success text-success-foreground hover:bg-success/90 shadow-glow font-bold text-xs" onClick={() => handleCreatePO(q)}>
                            <CheckCircle2 className="size-3.5 mr-1.5" /> Generate PO
                          </Button>
                        ) : (
                          <Button variant="outline" size="sm" className="w-full rounded-xl border-primary/40 text-primary hover:bg-primary-soft font-bold text-xs" onClick={() => handleOpenSelectionModal(q.id, q.supplier_id)}>
                            <CheckCircle className="size-3.5 mr-1.5" /> Select Supplier
                          </Button>
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

      {/* Selection Overlay Dialog Modal */}
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
              <div className="flex items-center gap-2 text-primary">
                <FileCheck2 className="size-5" />
                <CardTitle className="text-base font-bold">Select Supplier & Lock Bids</CardTitle>
              </div>
              <CardDescription className="text-xs">
                Log the supplier selection reasoning to finalize the evaluation process.
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleConfirmSelection} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Selection Reason*</Label>
                <Input
                  placeholder="e.g. L1 Price / Technical Fit / Faster Lead Time"
                  value={selectionReason}
                  onChange={(e) => setSelectionReason(e.target.value)}
                  required
                  className="rounded-xl h-10"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Procurement Evaluation Comments</Label>
                <Textarea
                  placeholder="Write selection notes or evaluations details..."
                  className="min-h-[90px] rounded-xl text-xs"
                  value={procurementComments}
                  onChange={(e) => setProcurementComments(e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)} className="rounded-xl">
                  Cancel
                </Button>
                <Button type="submit" className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl shadow-glow">
                  Finalize & Select
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </AppShell>
  );
}
