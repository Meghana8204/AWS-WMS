import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  FileText,
  Search,
  Filter,
  Loader2,
  Calendar,
  Download,
  Eye,
  Building2,
  CreditCard,
  ArrowUpRight,
  Package,
  History,
} from "lucide-react";
import { AppShell, StatusBadge } from "@/components/wms/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { api } from "@/lib/api-client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { requireRole } from "@/lib/auth-utils";
export const Route = createFileRoute("/procurement/purchase-orders")({
  beforeLoad: () => requireRole("PROCUREMENT"),
  component: PurchaseOrders,
});
function PurchaseOrders() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const fetchData = async () => {
    try {
      setLoading(true);
      const data = await api.getPurchaseOrders();
      setOrders(data);
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
  return (
    <AppShell
      title="Purchase Orders"
      subtitle="Track and manage official purchase orders issued to suppliers"
    >
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            placeholder="Search PO number, supplier..."
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
      ) : orders.length === 0 ? (
        <Card className="flex h-64 flex-col items-center justify-center p-6 text-center border-dashed border-border/50 bg-muted/20">
          <FileText className="size-12 text-muted-foreground/30 mb-4" />
          <h3 className="text-lg font-semibold text-muted-foreground">No purchase orders found</h3>
          <p className="text-sm text-muted-foreground/70">
            Start by finalizing a supplier selection from the quotations comparison matrix.
          </p>
          <Button variant="outline" className="mt-4 rounded-xl" asChild>
            <Link to="/procurement/rfqs">View active RFQs</Link>
          </Button>
        </Card>
      ) : (
        <div className="grid gap-4">
          {orders.map((po) => (
            <Card
              key={po.id}
              className="overflow-hidden border-border/50 transition-all hover:border-primary/30 hover:shadow-soft"
            >
              <div className="flex flex-col p-5 md:flex-row md:items-center">
                <div className="mb-4 flex flex-1 items-start gap-4 md:mb-0">
                  <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-teal-soft/30 text-teal-600">
                    <FileText className="size-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-foreground tracking-tight">{po.poNumber}</h3>
                      <StatusBadge status={po.status} />
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground font-medium">
                      <Building2 className="size-3.5" />
                      {po.supplierName || "Independent Supplier"}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className="text-[10px] text-teal-700 bg-teal-soft/20 px-2 py-0.5 rounded-md border border-teal-200 uppercase font-bold">
                        ₹ {parseFloat(po.totalAmount || po.total_amount || 0).toLocaleString()}
                      </span>
                      <span className="text-[10px] text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-md border border-border/50">
                        {po.warehouseId || "Main Warehouse"}
                      </span>
                      <span className="text-[10px] text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-md border border-border/50 font-mono">
                        Ref: {po.rfqNumber || po.rfq_id?.substring(0, 8) || "N/A"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-border/40 pt-4 md:border-0 md:pt-0">
                  <div className="mr-8 text-right hidden md:block">
                    <div className="flex flex-col items-end gap-1">
                      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
                        <Calendar className="size-3" /> Delivery Date
                      </div>
                      <p className="text-sm font-semibold">
                        {po.expectedDeliveryDate || po.expected_delivery_date || "—"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" className="rounded-xl h-9" asChild>
                      <Link to="/purchase-order" search={{ poId: po.id }}>
                        <Eye className="mr-1.5 size-3.5" />{" "}
                        {po.status === "REJECTED" ? "View Details" : "View"}
                      </Link>
                    </Button>
                    {po.status === "APPROVED" && (
                      <Button
                        variant="outline"
                        className="rounded-xl h-9 border-primary/30 text-primary hover:bg-primary-soft"
                        disabled={downloadingId === po.id}
                        onClick={async () => {
                          try {
                            setDownloadingId(po.id);
                            await api.downloadPoPdf(po.id, po.poNumber);
                            toast.success("Purchase Order PDF generated and downloaded");
                          } catch (e: any) {
                            toast.error("Failed to generate PDF");
                          } finally {
                            setDownloadingId(null);
                          }
                        }}
                      >
                        {downloadingId === po.id ? (
                          <Loader2 className="size-3.5 animate-spin mr-1.5" />
                        ) : (
                          <Download className="mr-1.5 size-3.5" />
                        )}
                        PDF
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </AppShell>
  );
}
