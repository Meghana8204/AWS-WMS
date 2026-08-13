import { createFileRoute } from "@tanstack/react-router";
import { Search, Filter, Truck, MoreHorizontal, ArrowRight, Loader2, Calendar, MapPin } from "lucide-react";
import { AppShell, StatusBadge } from "@/components/wms/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { api } from "@/lib/api-client";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/procurement/asns")({
  component: Asns,
});

function Asns() {
  const [asns, setAsns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const data = await api.getAsns();
        setAsns(data);
      } catch (error) {
        console.error("Failed to fetch ASNs:", error);
        toast.error("Failed to load ASNs");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  return (
    <AppShell
      title="Advanced Shipping Notices"
      subtitle="Track incoming supplier shipments and vehicle arrivals"
      actions={
        <Button className="rounded-xl shadow-glow">
          <Truck className="mr-2 size-4" /> New ASN
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
      ) : (
        <div className="grid gap-4">
          {asns.map((asn) => (
            <Card key={asn.id} className="overflow-hidden border-border/50 transition-all hover:border-primary/30 hover:shadow-soft">
              <div className="flex flex-col p-5 md:flex-row md:items-center">
                <div className="mb-4 flex flex-1 items-start gap-4 md:mb-0">
                  <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-teal-soft text-teal">
                    <Truck className="size-6" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-foreground">{asn.asn_number || asn.asnNo}</h3>
                      <StatusBadge status={asn.status} />
                    </div>
                    <p className="mt-1 font-medium text-foreground">{asn.supplier_name || asn.vendor}</p>
                    <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <span className="font-medium text-foreground">PO Ref:</span> {asn.po_number || asn.poNo}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="font-medium text-foreground">Vehicle:</span> {asn.vehicle_number || asn.truckNo}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-border/40 pt-4 md:border-0 md:pt-0">
                  <div className="mr-8 text-right hidden md:block">
                    <div className="flex flex-col items-end gap-1">
                      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                        <MapPin className="size-3" /> Expected Arrival
                      </div>
                      <p className="text-sm font-medium">{asn.expected_arrival_date || asn.expectedArrival}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" className="rounded-xl">
                      <MoreHorizontal className="size-4" />
                    </Button>
                    <Button variant="outline" className="rounded-xl group">
                      Track Shipment <ArrowRight className="ml-2 size-3 transition-transform group-hover:translate-x-1" />
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
