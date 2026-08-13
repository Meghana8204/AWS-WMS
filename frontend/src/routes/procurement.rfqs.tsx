import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus, Search, Filter, Mail, MoreHorizontal, ArrowRight, Loader2, Calendar, X, Send, Eye, Building2, Package, Info } from "lucide-react";
import { AppShell, StatusBadge } from "@/components/wms/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api-client";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/procurement/rfqs")({
  component: Rfqs,
});

function Rfqs() {
  const [rfqs, setRfqs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRfq, setSelectedRfq] = useState<any | null>(null);
  const [sendingRfq, setSendingRfq] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const data = await api.getRfqs();
      setRfqs(data);
    } catch (error) {
      console.error("Failed to fetch RFQs:", error);
      toast.error("Failed to load RFQs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSendRfq = async (rfqId: string) => {
    try {
      setSendingRfq(true);
      await api.sendRfq(rfqId);
      toast.success("RFQ published and sent to suppliers successfully!");
      setSelectedRfq(null);
      await fetchData();
    } catch (error: any) {
      toast.error("Failed to send RFQ", { description: error.message });
    } finally {
      setSendingRfq(false);
    }
  };

  return (
    <AppShell
      title="Request for Quotations"
      subtitle="Manage and track RFQs sent to various suppliers"
      actions={
        <Link to="/procurement/new-rfq">
          <Button className="rounded-xl shadow-glow">
            <Plus className="mr-2 size-4" /> New RFQ
          </Button>
        </Link>
      }
    >
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            placeholder="Search RFQ no, title..."
            className="h-10 w-full rounded-xl border border-border bg-card pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <Button variant="outline" className="rounded-xl border-border">
          <Filter className="mr-2 size-4" /> Filter
        </Button>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="size-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid gap-4">
          {rfqs.map((rfq) => (
            <Card key={rfq.id} className="overflow-hidden border-border/50 transition-all hover:border-primary/30 hover:shadow-soft">
              <div className="flex flex-col p-5 md:flex-row md:items-center">
                <div className="mb-4 flex flex-1 items-start gap-4 md:mb-0">
                  <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-primary-soft/30 text-primary">
                    <Mail className="size-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-foreground">{rfq.rfqNumber}</h3>
                      <StatusBadge status={rfq.status} />
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Issued {rfq.rfqDate} · {rfq.warehouse}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {rfq.materialRequestNumber && (
                        <span className="text-[10px] text-primary bg-primary-soft/20 px-2 py-0.5 rounded-md border border-primary/20">
                          Ref: {rfq.materialRequestNumber}
                        </span>
                      )}
                      <span className="text-[10px] text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-md border border-border/50">
                        {rfq.supplierIds?.length || 0} Suppliers invited
                      </span>
                      <span className="text-[10px] text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-md border border-border/50 font-mono">
                        {rfq.items?.length || 0} items
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-border/40 pt-4 md:border-0 md:pt-0">
                  <div className="mr-8 text-right hidden md:block">
                    <div className="flex flex-col items-end gap-1">
                      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                        <Calendar className="size-3" /> Valid Until
                      </div>
                      <p className="text-sm font-medium">{rfq.validUntil || "—"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" className="rounded-xl" onClick={() => setSelectedRfq(rfq)}>
                      {rfq.status === "DRAFT" ? (
                        <>Review & Send</>
                      ) : (
                        <><Eye className="mr-1.5 size-3.5" /> View Details</>
                      )}
                    </Button>
                    {rfq.status !== "DRAFT" && (
                      <Link to="/procurement/quotations" search={{ rfqId: rfq.id }}>
                        <Button variant="outline" className="rounded-xl group">
                          Compare Bids <ArrowRight className="ml-2 size-3 transition-transform group-hover:translate-x-1" />
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Detail & Review Modal */}
      {selectedRfq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm transition-all duration-200">
          <Card className="flex max-h-[85vh] w-full max-w-4xl flex-col border-border/80 bg-card shadow-soft animate-in fade-in zoom-in-95">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border/60 p-6">
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-bold">{selectedRfq.rfqNumber}</h2>
                  <StatusBadge status={selectedRfq.status} />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">Created on {new Date(selectedRfq.createdAt).toLocaleString()}</p>
              </div>
              <Button variant="ghost" size="icon" className="rounded-xl" onClick={() => setSelectedRfq(null)}>
                <X className="size-5" />
              </Button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Metadata Grid */}
              <div className="grid gap-4 rounded-xl border border-border/60 bg-muted/10 p-4 sm:grid-cols-3">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Procurement Officer</p>
                  <p className="mt-1 text-sm font-semibold">{selectedRfq.procurementOfficer}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Warehouse</p>
                  <p className="mt-1 text-sm font-semibold">{selectedRfq.warehouse}</p>
                </div>
                {selectedRfq.materialRequestNumber && (
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Material Request Ref</p>
                    <p className="mt-1 text-sm font-semibold">{selectedRfq.materialRequestNumber}</p>
                  </div>
                )}
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">RFQ Date</p>
                  <p className="mt-1 text-sm font-semibold">{selectedRfq.rfqDate}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Required Delivery Date</p>
                  <p className="mt-1 text-sm font-semibold">{selectedRfq.requiredDeliveryDate || "—"}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Valid Until</p>
                  <p className="mt-1 text-sm font-semibold">{selectedRfq.validUntil || "—"}</p>
                </div>
              </div>

              {/* Items Section */}
              <div>
                <h3 className="flex items-center gap-2 text-sm font-bold border-b border-border/50 pb-2">
                  <Package className="size-4 text-primary" /> Material Requirements
                </h3>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full min-w-[600px] text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-border/60 text-[10px] uppercase tracking-wider text-muted-foreground">
                        <th className="py-2.5 font-medium">Material</th>
                        <th className="py-2.5 font-medium">Category</th>
                        <th className="py-2.5 font-medium text-right">Quantity</th>
                        <th className="py-2.5 font-medium">UOM</th>
                        <th className="py-2.5 font-medium">Delivery Date</th>
                        <th className="py-2.5 font-medium">Warehouse</th>
                        <th className="py-2.5 font-medium">Special Requirements</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedRfq.items && selectedRfq.items.length > 0 ? (
                        selectedRfq.items.map((item: any, idx: number) => (
                          <tr key={idx} className="border-b border-border/40 hover:bg-muted/5">
                            <td className="py-3 pr-2">
                              <p className="font-semibold text-foreground">{item.materialName}</p>
                              <span className="font-mono text-[10px] text-muted-foreground">{item.materialCode}</span>
                            </td>
                            <td className="py-3 text-muted-foreground">{item.category}</td>
                            <td className="py-3 text-right font-mono font-bold pr-4">{item.quantity}</td>
                            <td className="py-3 font-semibold text-muted-foreground">{item.uom}</td>
                            <td className="py-3 text-muted-foreground">{item.requiredDeliveryDate}</td>
                            <td className="py-3 text-muted-foreground">{item.warehouse}</td>
                            <td className="py-3 text-muted-foreground italic max-w-[200px] truncate" title={item.specialRequirements || ""}>
                              {item.specialRequirements || "None"}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-muted-foreground">
                            No material requirements listed for this RFQ.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Suppliers count info */}
              <div className="flex items-start gap-3 rounded-xl border border-warning/20 bg-warning-soft/10 p-4">
                <Info className="size-5 text-warning shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-warning-foreground">Invitation Scope</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    This RFQ invitation will be sent to <strong>{selectedRfq.supplierIds?.length || 0}</strong> selected suppliers. Suppliers will be notified immediately to submit bids once published.
                  </p>
                </div>
              </div>

              {selectedRfq.remarks && (
                <div>
                  <h4 className="text-xs uppercase tracking-wider font-bold text-muted-foreground">Remarks / Instructions</h4>
                  <p className="mt-1.5 rounded-lg bg-muted/30 p-3 text-xs text-foreground/80 leading-relaxed whitespace-pre-wrap">
                    {selectedRfq.remarks}
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 border-t border-border/60 p-6 bg-muted/5">
              <Button variant="outline" className="rounded-xl" onClick={() => setSelectedRfq(null)}>
                Close
              </Button>
              {selectedRfq.status === "DRAFT" && (
                <Button
                  className="rounded-xl shadow-glow"
                  disabled={sendingRfq}
                  onClick={() => handleSendRfq(selectedRfq.id)}
                >
                  {sendingRfq ? (
                    <><Loader2 className="mr-2 size-4 animate-spin" /> Sending...</>
                  ) : (
                    <><Send className="mr-2 size-4" /> Approve & Send RFQ</>
                  )}
                </Button>
              )}
            </div>
          </Card>
        </div>
      )}
    </AppShell>
  );
}

