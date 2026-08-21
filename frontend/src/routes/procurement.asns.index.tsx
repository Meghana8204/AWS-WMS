import { createFileRoute, Link } from "@tanstack/react-router";
import { Search, Filter, Truck, MoreHorizontal, ArrowRight, Loader2, MapPin, Eye, FileText, RefreshCw } from "lucide-react";
import { AppShell, StatusBadge } from "@/components/wms/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { api } from "@/lib/api-client";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/procurement/asns/")({
  component: Asns,
});

function Asns() {
  const [asns, setAsns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async (showLoader = false) => {
    try {
      if (showLoader) setRefreshing(true);
      const data = await api.getAsns();
      setAsns(data);
    } catch (error) {
      console.error("Failed to fetch ASNs:", error);
      if (showLoader) toast.error("Failed to refresh ASNs");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();

    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") fetchData();
    };
    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    const refreshTimer = window.setInterval(() => fetchData(), 15000);

    return () => {
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      window.clearInterval(refreshTimer);
    };
  }, [fetchData]);

  return (
    <AppShell
      title="Advanced Shipping Notices"
      subtitle="Track incoming supplier shipments and vehicle arrivals"
      actions={
        <Button className="rounded-xl shadow-glow" onClick={() => fetchData(true)} disabled={refreshing}>
          <RefreshCw className={`mr-2 size-4 ${refreshing ? "animate-spin" : ""}`} /> Refresh ASNs
        </Button>
      }
    >
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            placeholder="Search ASN no, PO no, vendor..."
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
      ) : asns.length === 0 ? (
        <Card className="flex h-64 flex-col items-center justify-center p-6 text-center border-dashed border-border/50 bg-muted/20">
          <Truck className="size-12 text-muted-foreground/30 mb-4" />
          <h3 className="text-lg font-semibold text-muted-foreground">No shipments tracked yet</h3>
          <p className="text-sm text-muted-foreground/70">Incoming supplier shipments will appear here once ASNs are submitted.</p>
        </Card>
      ) : (
        <div className="grid gap-4">
          {asns.map((asn) => (
            <Card key={asn.id} className="overflow-hidden border-border/50 transition-all hover:border-primary/30 hover:shadow-soft">
              <div className="flex flex-col p-5 md:flex-row md:items-center">
                <div className="mb-4 flex flex-1 items-start gap-4 md:mb-0">
                  <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-teal-soft/30 text-teal-600">
                    <Truck className="size-6" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-foreground tracking-tight">{asn.asnNumber}</h3>
                      <StatusBadge status={asn.warehouseStatus || asn.status} />
                    </div>
                    <p className="mt-1 text-sm font-semibold text-foreground/80">{asn.supplierName || "Independent Supplier"}</p>
                    <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground font-medium">
                      <span className="flex items-center gap-1.5 italic bg-muted/50 px-2 py-0.5 rounded border border-border/40">
                         PO Ref: {asn.poNumber || "N/A"}
                      </span>
                      <span className="flex items-center gap-1.5">
                        Transporter: <span className="text-foreground font-bold">{asn.transporter || "N/A"}</span>
                      </span>
                      <span className="flex items-center gap-1.5">
                        Vehicle: <span className="text-foreground font-bold">{asn.vehicleNumber || "N/A"}</span>
                      </span>
                      <span className="flex items-center gap-1.5">
                        Pkg: <span className="text-foreground font-bold">{asn.numberOfPackages || 0}</span>
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-border/40 pt-4 md:border-0 md:pt-0">
                  <div className="mr-8 text-right hidden md:block">
                    <div className="flex flex-col items-end gap-1">
                      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground font-black">
                        <MapPin className="size-3 text-primary" /> Expected Arrival
                      </div>
                      <p className="text-sm font-bold tabular-nums text-foreground">
                         {asn.expectedArrivalAt ? new Date(asn.expectedArrivalAt).toLocaleDateString() : "-"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="rounded-xl hover:bg-muted/50">
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="rounded-xl min-w-[160px]">
                        <DropdownMenuItem className="rounded-lg gap-2 cursor-pointer font-medium text-xs">
                          <Eye className="size-3.5" /> View Documents
                        </DropdownMenuItem>
                        <DropdownMenuItem className="rounded-lg gap-2 cursor-pointer font-medium text-xs">
                          <FileText className="size-3.5" /> Export PDF
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>

                    <Button variant="outline" className="rounded-xl group h-9 px-4 font-bold border-primary/20 text-primary hover:bg-primary-soft/10" asChild>
                      <Link to="/procurement/asns/$asnId" params={{ asnId: asn.id }}>
                        Track Shipment <ArrowRight className="ml-2 size-3.5 transition-transform group-hover:translate-x-1" />
                      </Link>
                    </Button>
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
