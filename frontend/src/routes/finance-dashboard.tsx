import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  FileText,
  DollarSign,
  TrendingUp,
  Clock,
  CheckCircle,
  XCircle,
  ArrowRight,
  Loader2,
  Calendar,
  Building,
  ClipboardList
} from "lucide-react";
import { AppShell } from "@/components/wms/app-shell";
import { SectionCard } from "@/components/wms/primitives";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";

function KpiCard({
  title,
  value,
  description,
  icon: Icon,
  color,
}: {
  title: string;
  value: string;
  description: string;
  icon: any;
  color: "primary" | "amber" | "success" | "destructive";
}) {
  const bgColors = {
    primary: "bg-primary-soft text-primary",
    amber: "bg-amber-soft text-amber-foreground",
    success: "bg-success-soft text-success",
    destructive: "bg-destructive-soft text-destructive",
  };
  return (
    <Card className="gap-0 rounded-2xl border-border/70 p-5 shadow-soft">
      <div className="flex items-start justify-between">
        <span className={cn("grid size-11 place-items-center rounded-xl", bgColors[color])}>
          <Icon className="size-5" />
        </span>
      </div>
      <p className="mt-4 text-3xl font-semibold tracking-tight tabular-nums">{value}</p>
      <p className="mt-1 text-sm text-muted-foreground">{title}</p>
      <p className="mt-2 text-xs font-medium text-muted-foreground">{description}</p>
    </Card>
  );
}

export const Route = createFileRoute("/finance-dashboard")({
  component: FinanceDashboard,
});

function FinanceDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const fetchPOs = async () => {
    try {
      const data = await api.getPurchaseOrders();
      setPurchaseOrders(data);
    } catch (error: any) {
      toast.error("Failed to load PO proposals: " + error.message);
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
    fetchPOs();
  }, []);

  const handleAction = async (id: string, status: "APPROVED" | "REJECTED") => {
    setProcessingId(id);
    try {
      await api.updatePurchaseOrder(id, { status });
      toast.success(status === "APPROVED" ? "PO approved & released!" : "PO proposal rejected.");
      fetchPOs();
    } catch (error: any) {
      toast.error("Failed to complete action: " + error.message);
    } finally {
      setProcessingId(null);
    }
  };

  // Compute Metrics
  const proposedPOs = purchaseOrders.filter((po) => po.status === "PROPOSED");
  const approvedPOs = purchaseOrders.filter((po) => po.status === "PLACED" || po.status === "APPROVED");
  const rejectedPOs = purchaseOrders.filter((po) => po.status === "REJECTED");

  const computeTotalValue = (list: any[]) => {
    return list.reduce((sum, po) => {
      const poValue = po.lines?.reduce((lineSum: number, line: any) => {
        return lineSum + (parseFloat(line.ordered_quantity) * parseFloat(line.unit_price));
      }, 0) || 0;
      return sum + poValue;
    }, 0);
  };

  const pendingValue = computeTotalValue(proposedPOs);
  const releasedValue = computeTotalValue(approvedPOs);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center gap-3">
        <Loader2 className="size-8 animate-spin text-primary" />
        <span className="text-sm text-muted-foreground">Loading Finance workspace...</span>
      </div>
    );
  }

  return (
    <AppShell title="Finance Control Center" subtitle="Approve purchase proposals & capital releases">
      <div className="space-y-6">
        {/* KPI Panel */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            title="Pending Proposals"
            value={proposedPOs.length.toString()}
            description="Awaiting capital release"
            icon={Clock}
            color="primary"
          />
          <KpiCard
            title="Pending Value"
            value={`₹ ${pendingValue.toLocaleString()}`}
            description="Commitment value"
            icon={DollarSign}
            color="amber"
          />
          <KpiCard
            title="Released Capital"
            value={`₹ ${releasedValue.toLocaleString()}`}
            description="Approved active POs"
            icon={TrendingUp}
            color="success"
          />
          <KpiCard
            title="Rejected Proposals"
            value={rejectedPOs.length.toString()}
            description="Bids returned/cancelled"
            icon={XCircle}
            color="destructive"
          />
        </div>

        {/* Proposed POs Pending Review */}
        <SectionCard title="Capital Release Approvals" description="Review pending purchase order proposals" icon={ClipboardList}>
          {proposedPOs.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/60 p-12 text-center text-muted-foreground bg-muted/5">
              <CheckCircle className="mx-auto size-10 text-success mb-3" />
              <p className="text-sm font-bold">All caught up!</p>
              <p className="text-xs text-muted-foreground/80 mt-1">No pending PO proposals require approval.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {proposedPOs.map((po) => {
                const totalVal = po.lines?.reduce((sum: number, line: any) => sum + (parseFloat(line.ordered_quantity) * parseFloat(line.unit_price)), 0) || 0;
                return (
                  <div key={po.id} className="rounded-2xl border border-border/80 bg-muted/10 p-5 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-foreground">{po.po_number}</span>
                          <span className="rounded-full bg-amber-soft/20 px-2 py-0.5 text-[10px] font-bold text-amber">Pending approval</span>
                        </div>
                        <div className="flex items-center gap-4 text-[10px] font-mono text-muted-foreground uppercase">
                          <span>Date: {po.po_date}</span>
                          <span>Supplier ID: {po.supplier_id.substring(0, 8)}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-xs text-muted-foreground block uppercase">Proposed Value</span>
                        <strong className="text-lg font-extrabold text-primary font-mono">₹ {totalVal.toLocaleString()}</strong>
                      </div>
                    </div>

                    <div className="border-t border-border/40 pt-4">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-2">Required Materials</span>
                      <div className="rounded-xl border border-border/40 overflow-hidden bg-card">
                        <table className="w-full text-xs">
                          <thead className="bg-muted/50 border-b border-border/40 text-[10px] uppercase font-bold text-muted-foreground">
                            <tr>
                              <th className="px-4 py-2 text-left">Item Code</th>
                              <th className="px-4 py-2 text-right">Quantity</th>
                              <th className="px-4 py-2 text-right">Unit Price</th>
                              <th className="px-4 py-2 text-right">Total</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/20 font-mono text-[11px]">
                            {po.lines?.map((line: any, idx: number) => (
                              <tr key={idx}>
                                <td className="px-4 py-2.5 text-left font-bold text-foreground">{line.item_code}</td>
                                <td className="px-4 py-2.5 text-right">{parseFloat(line.ordered_quantity).toLocaleString()}</td>
                                <td className="px-4 py-2.5 text-right">₹ {parseFloat(line.unit_price).toLocaleString()}</td>
                                <td className="px-4 py-2.5 text-right font-extrabold text-foreground">₹ {(parseFloat(line.ordered_quantity) * parseFloat(line.unit_price)).toLocaleString()}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-3 pt-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="rounded-xl text-primary font-bold text-xs h-9 hover:bg-primary-soft/10"
                        onClick={() => navigate({ to: `/finance-approval?poId=${po.id}` })}
                      >
                        Detailed Review &rarr;
                      </Button>
                      <div className="flex items-center gap-3">
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-xl border-destructive/40 text-destructive hover:bg-destructive-soft/10 text-xs h-9 font-bold"
                          disabled={processingId !== null}
                          onClick={() => handleAction(po.id, "REJECTED")}
                        >
                          <XCircle className="size-4 mr-1.5" /> Reject
                        </Button>
                        <Button
                          size="sm"
                          className="rounded-xl bg-success text-success-foreground hover:bg-success/90 text-xs h-9 font-bold shadow-glow"
                          disabled={processingId !== null}
                          onClick={() => handleAction(po.id, "APPROVED")}
                        >
                          <CheckCircle className="size-4 mr-1.5" /> Quick Approve
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>

        {/* Release History */}
        <SectionCard title="Release Log & History" description="Recently approved or rejected purchase proposals" icon={FileText}>
          <div className="overflow-hidden rounded-2xl border border-border/60 bg-card">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-muted/40 border-b border-border/60 text-[10px] uppercase font-bold text-muted-foreground">
                  <th className="p-4">PO Number</th>
                  <th className="p-4">Date</th>
                  <th className="p-4">Supplier</th>
                  <th className="p-4 text-right">Total Capital</th>
                  <th className="p-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60 font-mono">
                {purchaseOrders.filter((po) => po.status !== "PROPOSED").map((po) => {
                  const totalVal = po.lines?.reduce((sum: number, line: any) => sum + (parseFloat(line.ordered_quantity) * parseFloat(line.unit_price)), 0) || 0;
                  return (
                    <tr key={po.id} className="hover:bg-muted/5 transition-colors">
                      <td className="p-4 font-bold text-foreground">{po.po_number}</td>
                      <td className="p-4 text-muted-foreground">{po.po_date}</td>
                      <td className="p-4 font-sans text-xs">{po.supplier_name || `Supplier ID: ${po.supplier_id.substring(0, 8)}`}</td>
                      <td className="p-4 text-right font-extrabold text-foreground">₹ {totalVal.toLocaleString()}</td>
                      <td className="p-4 text-center">
                        <span className={cn(
                          "inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                          (po.status === "APPROVED" || po.status === "PLACED") ? "bg-success-soft/20 text-success" : "bg-destructive-soft/20 text-destructive"
                        )}>
                          {po.status === "PLACED" ? "APPROVED" : po.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {purchaseOrders.filter((po) => po.status !== "PROPOSED").length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-muted-foreground font-sans">
                      No release history found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </SectionCard>
      </div>
    </AppShell>
  );
}
