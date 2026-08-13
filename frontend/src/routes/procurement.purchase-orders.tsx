import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Search, Filter, FileText, ArrowUpRight, Clock, CheckCircle2, Package, Loader2, AlertTriangle, RefreshCw, X, Send } from "lucide-react";
import { AppShell, StatusBadge } from "@/components/wms/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/procurement/purchase-orders")({
  component: PurchaseOrders,
});

function PurchaseOrders() {
  const navigate = useNavigate();
  const [pos, setPos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Resubmit Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPo, setSelectedPo] = useState<any | null>(null);
  const [linesData, setLinesData] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const data = await api.getPurchaseOrders();
      setPos(data);
    } catch (error) {
      console.error("Failed to fetch purchase orders:", error);
      toast.error("Failed to load purchase orders");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenResubmitModal = (po: any) => {
    setSelectedPo(po);
    setLinesData(
      (po.items || po.lines)?.map((line: any) => ({
        item_code: line.item_code,
        ordered_quantity: String(line.ordered_quantity),
        unit_price: String(line.unit_price),
      })) || []
    );
    setIsModalOpen(true);
  };

  const handleLineChange = (idx: number, field: "ordered_quantity" | "unit_price", value: string) => {
    setLinesData((prev) => {
      const updated = [...prev];
      updated[idx] = {
        ...updated[idx],
        [field]: value,
      };
      return updated;
    });
  };

  const handleResubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPo) return;
    setSubmitting(true);
    try {
      await api.updatePurchaseOrder(selectedPo.id, {
        status: "PROPOSED",
        lines: linesData.map((l) => ({
          item_code: l.item_code,
          ordered_quantity: parseFloat(l.ordered_quantity),
          unit_price: parseFloat(l.unit_price),
        })),
      });
      toast.success("PO proposal modified and resubmitted to Finance!");
      setIsModalOpen(false);
      fetchData();
    } catch (error: any) {
      toast.error("Resubmission failed: " + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppShell
      title="Purchase Order Dashboard"
      subtitle="Track active procurement cycles and vendor fulfillment"
      actions={
        <div className="flex gap-2">
          <Button variant="outline" className="rounded-xl">Export CSV</Button>
          <Button className="rounded-xl shadow-glow" onClick={() => navigate({ to: "/procurement/new-po" })}>
            Create Manual PO
          </Button>
        </div>
      }
    >
      {/* Stat Panel */}
      <div className="grid gap-4 mb-8 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Total Active POs", value: pos.length.toString(), icon: FileText, color: "text-primary bg-primary-soft" },
          { label: "Pending Vendor Ack", value: pos.filter(po => po.status === "Draft" || po.status === "Released" || po.status === "PROPOSED").length.toString(), icon: Clock, color: "text-warning-foreground bg-warning-soft" },
          { label: "In-Transit ASNs", value: "12", icon: Package, color: "text-teal bg-teal-soft" },
          { label: "Completed (MTD)", value: pos.filter(po => po.status === "Completed").length.toString(), icon: CheckCircle2, color: "text-success bg-success-soft" },
        ].map((stat, i) => (
          <Card key={i} className="flex items-center gap-4 p-4 border-border/50">
            <div className={cn("grid size-12 place-items-center rounded-2xl", stat.color)}>
              <stat.icon className="size-6" />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{stat.label}</p>
              <p className="text-2xl font-bold">{stat.value}</p>
            </div>
          </Card>
        ))}
      </div>

      {/* Filter panel */}
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            placeholder="Search PO no, vendor..."
            className="h-10 w-full rounded-xl border border-border bg-card pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <Button variant="outline" className="rounded-xl border-border">
          <Filter className="mr-2 size-4" /> Filter
        </Button>
      </div>

      {/* PO Listing */}
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="size-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid gap-4">
          {pos.map((po) => {
            const totalVal = (po.items || po.lines)?.reduce((sum: number, line: any) => sum + (parseFloat(line.ordered_quantity) * parseFloat(line.unit_price)), 0) || 0;
            return (
              <Card key={po.id} className={cn(
                "overflow-hidden border-border/50 transition-all hover:border-primary/30 hover:shadow-soft",
                po.status === "REJECTED" && "border-destructive/30 bg-destructive-soft/5"
              )}>
                <div className="p-5">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="font-mono text-sm font-bold text-primary">{po.po_number}</span>
                        <StatusBadge status={po.status === "PLACED" ? "APPROVED" : po.status} />
                      </div>
                      <h3 className="text-lg font-semibold">{po.supplier_name || `Supplier ID: ${po.supplier_id.substring(0, 8)}`}</h3>
                      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-foreground">PO Date:</span> {po.po_date}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-foreground">Exp. Delivery:</span> {po.expected_delivery_date || "—"}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-foreground">Value:</span>
                          <span className="text-foreground">₹ {totalVal.toLocaleString()}</span>
                        </div>
                      </div>

                      {/* Display rejection details if status is REJECTED */}
                      {po.status === "REJECTED" && (
                        <div className="mt-4 rounded-xl border border-destructive/20 bg-destructive-soft/10 p-3.5 text-xs text-destructive">
                          <div className="flex items-center gap-2 font-bold mb-1">
                            <AlertTriangle className="size-4" /> Capital Release Rejected by Finance
                          </div>
                          <div>
                            <span className="font-semibold text-muted-foreground block text-[10px] uppercase">Reason:</span>
                            <p className="font-medium mt-0.5">{po.rejection_reason || "No reason specified."}</p>
                          </div>
                          {po.finance_comments && (
                            <div className="mt-2">
                              <span className="font-semibold text-muted-foreground block text-[10px] uppercase">Comments:</span>
                              <p className="mt-0.5">{po.finance_comments}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="w-full md:w-64 space-y-3">
                      <div className="flex justify-between text-[11px] font-medium">
                        <span className="text-muted-foreground uppercase tracking-wider">Fulfillment</span>
                        <span className="text-foreground">{po.status === "Completed" ? "100%" : "0%"}</span>
                      </div>
                      <Progress value={po.status === "Completed" ? 100 : 0} className="h-2 bg-muted rounded-full overflow-hidden" />
                      <p className="text-[10px] text-muted-foreground text-center italic">
                        {po.status === "Completed" ? "Fully received" : "No shipments received yet"}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 border-t border-border/40 pt-4 md:border-0 md:pt-0">
                      {po.status === "REJECTED" ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-xl border-primary/40 text-primary hover:bg-primary-soft font-bold text-xs"
                          onClick={() => handleOpenResubmitModal(po)}
                        >
                          <RefreshCw className="mr-1.5 size-3.5" /> Modify & Resubmit
                        </Button>
                      ) : (
                        <>
                          {po.status === "APPROVED" && (
                            <Button
                                size="sm"
                                className="rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-bold text-xs"
                                onClick={() => navigate({ to: "/procurement/po-detail", search: { poId: po.id } })}
                            >
                                <Send className="mr-1.5 size-3.5" /> Send PO
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            className="rounded-xl group"
                            onClick={() => navigate({ to: "/procurement/po-detail", search: { poId: po.id } })}
                          >
                            Full Details <ArrowUpRight className="ml-2 size-3 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Resubmit Modal */}
      {isModalOpen && selectedPo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <Card className="w-full max-w-lg border-border/40 bg-card p-6 shadow-glow relative animate-in zoom-in-95 duration-200">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
            >
              <X className="size-5" />
            </button>
            <CardHeader className="p-0 mb-4">
              <div className="flex items-center gap-2 text-primary">
                <RefreshCw className="size-5" />
                <CardTitle className="text-base font-bold">Modify & Resubmit Proposal</CardTitle>
              </div>
              <CardDescription className="text-xs">
                Adjust quantities or prices for PO: <strong>{selectedPo.po_number}</strong> to resolve Finance's objections.
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleResubmit} className="space-y-4">
              <div className="max-h-[220px] overflow-y-auto space-y-4 pr-1">
                {linesData.map((line, idx) => (
                  <div key={idx} className="rounded-xl border border-border p-3 bg-muted/10 space-y-2">
                    <span className="text-[11px] font-bold text-foreground font-mono">{line.item_code}</span>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-[10px]">Quantity</Label>
                        <Input
                          type="number"
                          value={line.ordered_quantity}
                          onChange={(e) => handleLineChange(idx, "ordered_quantity", e.target.value)}
                          required
                          className="h-8 rounded-lg text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px]">Unit Price (INR)</Label>
                        <Input
                          type="number"
                          value={line.unit_price}
                          onChange={(e) => handleLineChange(idx, "unit_price", e.target.value)}
                          required
                          className="h-8 rounded-lg text-xs font-mono"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)} className="rounded-xl">
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting} className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl shadow-glow font-bold">
                  {submitting ? "Processing..." : "Resubmit to Finance"}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </AppShell>
  );
}
