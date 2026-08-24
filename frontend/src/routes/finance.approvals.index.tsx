import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  FileCheck2,
  Search,
  Filter,
  Loader2,
  Calendar,
  Eye,
  Building2,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  Sparkles,
  ShieldCheck,
} from "lucide-react";
import { AppShell, StatusBadge } from "@/components/wms/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { api } from "@/lib/api-client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { requireRole } from "@/lib/auth-utils";
export const Route = createFileRoute("/finance/approvals/")({
  beforeLoad: () => requireRole("FINANCE"),
  component: FinanceApprovals,
});
function FinanceApprovals() {
  const [approvals, setApprovals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const fetchData = async () => {
    try {
      setLoading(true);
      const data = await api.getFinanceApprovals();
      setApprovals(data);
    } catch (error) {
      console.error("Failed to fetch approvals:", error);
      toast.error("Failed to load pending approvals");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    fetchData();
  }, []);
  const rfqGroups: Record<
    string,
    {
      id: string;
      number: string;
      pos: any[];
    }
  > = {};
  approvals.forEach((po) => {
    const rfqId = po.rfqId || "none";
    const rfqNumber = po.rfqNumber || po.rfqId || "none";
    if (!rfqGroups[rfqId]) {
      rfqGroups[rfqId] = { id: rfqId, number: rfqNumber, pos: [] };
    }
    rfqGroups[rfqId].pos.push(po);
  });
  return (
    <AppShell
      title="Finance Approvals"
      subtitle="Review and authorize pending purchase order proposals"
    >
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            placeholder="Search PO number, procurement officer..."
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
      ) : approvals.length === 0 ? (
        <Card className="flex h-64 flex-col items-center justify-center p-6 text-center border-dashed border-border/50 bg-muted/20">
          <ShieldCheck className="size-12 text-muted-foreground/30 mb-4" />
          <h3 className="text-lg font-semibold text-muted-foreground">Queue is empty</h3>
          <p className="text-sm text-muted-foreground/70">
            There are no pending purchase orders awaiting your approval.
          </p>
        </Card>
      ) : (
        <div className="space-y-8">
          {Object.entries(rfqGroups).map(([rfqId, group]) => {
            const { number: rfqNumber, pos } = group;
            const isGrouped = rfqId !== "none" && pos.length > 1;
            if (isGrouped) {
              return (
                <Card
                  key={rfqId}
                  className="overflow-hidden border-primary/30 shadow-glow bg-primary-soft/5"
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between p-6 border-b border-primary/10 bg-primary/5 gap-4">
                    <div className="flex items-center gap-3">
                      <div className="size-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                        <Sparkles className="size-6" />
                      </div>
                      <div>
                        <h3 className="font-extrabold text-lg tracking-tight">
                          Competitive Bid Comparison
                        </h3>
                        <p className="text-sm text-muted-foreground font-medium">
                          RFQ: {rfqNumber} · {pos.length} Suppliers Selected
                        </p>
                      </div>
                    </div>
                    <Button
                      className="rounded-xl shadow-glow bg-primary font-bold h-11 px-6"
                      asChild
                    >
                      <Link to="/finance/approvals/compare/$rfqId" params={{ rfqId }}>
                        Compare & Authorize <ArrowRight className="ml-2 size-5" />
                      </Link>
                    </Button>
                  </div>

                  <div className="overflow-x-auto p-4 pt-0">
                    <div className="rounded-xl border border-border/60 overflow-hidden">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-muted/40 border-b border-border/60">
                            <th className="p-3 font-extrabold uppercase tracking-wider text-muted-foreground w-[180px] border-r border-border/60">
                              Parameter
                            </th>
                            {pos.map((po) => (
                              <th
                                key={po.id}
                                className="p-3 font-bold border-r border-border/60 min-w-[200px] bg-card"
                              >
                                <div className="flex flex-col gap-0.5">
                                  <span className="text-foreground">{po.supplierName}</span>
                                  <span className="text-[10px] text-muted-foreground font-mono">
                                    {po.poNumber}
                                  </span>
                                </div>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/60">
                          <tr className="hover:bg-muted/5 transition-colors">
                            <td className="p-3 font-bold text-muted-foreground uppercase text-[9px] tracking-widest border-r border-border/60">
                              Bid Amount
                            </td>
                            {pos.map((po) => (
                              <td
                                key={`${po.id}-amt`}
                                className="p-3 border-r border-border/60 font-black text-primary text-sm"
                              >
                                ₹ {parseFloat(po.totalAmount).toLocaleString()}
                              </td>
                            ))}
                          </tr>
                          <tr className="hover:bg-muted/5 transition-colors">
                            <td className="p-3 font-bold text-muted-foreground uppercase text-[9px] tracking-widest border-r border-border/60">
                              Delivery Date
                            </td>
                            {pos.map((po) => (
                              <td
                                key={`${po.id}-date`}
                                className="p-3 border-r border-border/60 font-medium"
                              >
                                {po.expectedDeliveryDate || "Not specified"}
                              </td>
                            ))}
                          </tr>
                          <tr className="hover:bg-muted/5 transition-colors">
                            <td className="p-3 font-bold text-muted-foreground uppercase text-[9px] tracking-widest border-r border-border/60">
                              Selection Reason
                            </td>
                            {pos.map((po) => (
                              <td
                                key={`${po.id}-reason`}
                                className="p-3 border-r border-border/60 text-[10px] font-semibold text-primary/80"
                              >
                                {po.selectionReason || "—"}
                              </td>
                            ))}
                          </tr>
                          <tr className="bg-muted/10">
                            <td className="p-3 border-r border-border/60"></td>
                            {pos.map((po) => (
                              <td key={`${po.id}-action`} className="p-3 border-r border-border/60">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="w-full rounded-lg h-7 text-[10px] font-bold border-primary/20 text-primary hover:bg-primary-soft"
                                  asChild
                                >
                                  <Link
                                    to="/finance/approvals/$approvalId"
                                    params={{ approvalId: po.id }}
                                  >
                                    Review & Approve
                                  </Link>
                                </Button>
                              </td>
                            ))}
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </Card>
              );
            }
            return (
              <div key={rfqId} className="grid gap-4">
                {pos.map((po) => (
                  <Card
                    key={po.id}
                    className="overflow-hidden border-border/50 transition-all hover:border-primary/30 hover:shadow-soft"
                  >
                    <div className="flex flex-col p-5 md:flex-row md:items-center">
                      <div className="mb-4 flex flex-1 items-start gap-4 md:mb-0">
                        <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-primary-soft/30 text-primary">
                          <FileCheck2 className="size-6" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-foreground tracking-tight">
                              {po.poNumber}
                            </h3>
                            <StatusBadge status="Pending Approval" />
                          </div>
                          <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground font-medium">
                            <span className="flex items-center gap-1">
                              <Building2 className="size-3.5" /> {po.supplierName}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="size-3.5" /> Proposed by {po.procurementOfficer}
                            </span>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <span className="text-[10px] text-primary-soft-foreground bg-primary-soft/20 px-2 py-0.5 rounded-md border border-primary/20 uppercase font-bold">
                              ₹ {parseFloat(po.totalAmount).toLocaleString()}
                            </span>
                            <span className="text-[10px] text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-md border border-border/50">
                              {po.items?.length || 0} Line Items
                            </span>
                            {po.rfqNumber && (
                              <span className="text-[10px] text-primary bg-primary/10 px-2 py-0.5 rounded-md border border-primary/20 uppercase font-bold">
                                RFQ: {po.rfqNumber}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between border-t border-border/40 pt-4 md:border-0 md:pt-0">
                        <div className="mr-8 text-right hidden md:block">
                          <div className="flex flex-col items-end gap-1">
                            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
                              <Calendar className="size-3" /> Submission Date
                            </div>
                            <p className="text-sm font-semibold">
                              {new Date(po.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button className="rounded-xl h-9 shadow-glow" asChild>
                            <Link
                              to="/finance/approvals/$approvalId"
                              params={{ approvalId: po.id }}
                            >
                              Review Proposal <ArrowRight className="ml-1.5 size-3.5" />
                            </Link>
                          </Button>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
