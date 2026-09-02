import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ClipboardList,
  Search,
  Filter,
  Loader2,
  Calendar,
  ArrowRight,
  Package,
  Building2,
  CheckCircle2,
  Clock,
  ExternalLink,
  X,
  FileText,
  Info,
} from "lucide-react";
import { AppShell, StatusBadge } from "@/components/wms/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api-client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/procurement/material-requests")({
  component: MaterialRequests,
});

function MaterialRequests() {
  const navigate = useNavigate();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      setLoading(true);
      const data = await api.getMaterialRequests();
      setRequests(data);
    } catch (error) {
      console.error("Failed to fetch material requests:", error);
      toast.error("Failed to load material requests");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRequestClick = (req: any) => {
    navigate({
      to: "/procurement/new-rfq",
      search: { fromRequestId: req.id },
    });
  };

  return (
    <AppShell
      title="Material Requests"
      subtitle="View and process material requirements from the warehouse"
    >
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            placeholder="Search request no, material..."
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
      ) : requests.length === 0 ? (
        <Card className="flex h-64 flex-col items-center justify-center p-6 text-center border-dashed border-border/50 bg-muted/20">
          <ClipboardList className="size-12 text-muted-foreground/30 mb-4" />
          <h3 className="text-lg font-semibold text-muted-foreground">No pending requests</h3>
          <p className="text-sm text-muted-foreground/70">
            All warehouse requirements have been processed.
          </p>
        </Card>
      ) : (
        <div className="grid gap-4">
          {requests.map((req) => (
            <Card
              key={req.id}
              className="overflow-hidden border-border/50 transition-all hover:border-primary/30 hover:shadow-soft cursor-pointer group"
              onClick={() => handleRequestClick(req)}
            >
              <div className="flex flex-col p-5 md:flex-row md:items-center">
                <div className="mb-4 flex flex-1 items-start gap-4 md:mb-0">
                  <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-orange-soft/30 text-orange-600">
                    <ClipboardList className="size-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-foreground tracking-tight">
                        {req.requestNumber}
                      </h3>
                      <StatusBadge status={req.status} />
                    </div>
                    <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground font-medium">
                      <span className="flex items-center gap-1">
                        <Building2 className="size-3.5" /> {req.warehouseId}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="size-3.5" /> Requested by {req.requestedBy}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {req.items?.map((item: any, idx: number) => (
                        <span
                          key={idx}
                          className="text-[10px] text-orange-700 bg-orange-soft/20 px-2 py-0.5 rounded-md border border-orange-200 uppercase font-bold"
                        >
                          {item.materialCode}: {Math.floor(item.quantity)} {item.uom}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-border/40 pt-4 md:border-0 md:pt-0">
                  <div className="mr-8 text-right hidden md:block">
                    <div className="flex flex-col items-end gap-1">
                      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
                        <Calendar className="size-3" /> Required By
                      </div>
                      <p className="text-sm font-semibold">{req.requiredDate}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="rounded-xl h-9 w-9 text-muted-foreground group-hover:text-primary transition-colors"
                    >
                      <ArrowRight className="size-4" />
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
