import { createFileRoute, Link } from "@tanstack/react-router";
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
} from "lucide-react";
import { AppShell, StatusBadge } from "@/components/wms/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api-client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

function formatDisplayDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const clean = String(dateStr).split("T")[0];
  const parts = clean.split("-");
  if (parts.length === 3) {
    const [year, month, day] = parts;
    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    const mIdx = parseInt(month, 10) - 1;
    if (mIdx >= 0 && mIdx < 12) {
      return `${parseInt(day, 10)} ${months[mIdx]} ${year}`;
    }
  }
  return clean;
}

export const Route = createFileRoute("/procurement/material-requests")({
  component: MaterialRequests,
});
function MaterialRequests() {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

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
    setSelectedRequest(req);
    setIsModalOpen(true);
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
                      <p className="text-sm font-semibold">{formatDisplayDate(req.requiredDate)}</p>
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

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-4xl w-full rounded-3xl p-0 overflow-hidden border-none shadow-2xl [&>button]:text-white/80 hover:[&>button]:text-white [&>button]:top-5 [&>button]:right-5">
          {selectedRequest && (
            <div className="flex flex-col h-full max-h-[90vh]">
              {/* Vibrant Blue Header */}
              <div className="px-7 py-5 text-white bg-blue-600 flex justify-between items-center">
                <div>
                  <div className="flex items-center gap-3">
                    <DialogTitle className="text-xl font-bold tracking-tight text-white">
                      Material Request Details
                    </DialogTitle>
                    <span className="rounded-full bg-white/20 text-white font-bold text-[11px] uppercase tracking-wider px-3 py-0.5 border border-white/20">
                      {selectedRequest.status}
                    </span>
                  </div>
                  <p className="text-blue-100 text-xs font-mono font-semibold tracking-wider mt-1.5">
                    {selectedRequest.requestNumber}
                  </p>
                </div>
              </div>

              {/* Modal Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6 w-full min-w-0">
                {/* 1. Metadata 4-Column Box */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 p-5 rounded-2xl bg-slate-50/70 dark:bg-muted/20 border border-slate-100 dark:border-border/40">
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400">
                      Department
                    </Label>
                    <p className="font-bold text-sm text-slate-900 dark:text-slate-100">
                      {selectedRequest.department || "Inventory"}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400">
                      Required Date
                    </Label>
                    <p className="font-bold text-sm text-slate-900 dark:text-slate-100 tabular-nums">
                      {formatDisplayDate(selectedRequest.requiredDate)}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400">
                      Requested By
                    </Label>
                    <p className="font-bold text-sm text-slate-900 dark:text-slate-100">
                      {selectedRequest.requestedBy || "warehouse"}
                    </p>
                  </div>
                  <div className="space-y-1 sm:text-right">
                    <Label className="text-[10px] uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400">
                      Warehouse
                    </Label>
                    <p className="font-bold text-sm text-slate-900 dark:text-slate-100">
                      {selectedRequest.warehouseName ||
                        (selectedRequest.warehouseId === "WH-001"
                          ? "Main Warehouse"
                          : selectedRequest.warehouseId) ||
                        "Main Warehouse"}
                    </p>
                  </div>
                </div>

                {/* 2. Requested Materials Table */}
                <div className="space-y-2.5">
                  <Label className="text-[11px] uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400 block">
                    Requested Materials
                  </Label>
                  <div className="rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden bg-white dark:bg-card shadow-2xs">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-50/70 dark:bg-muted/40 border-b border-slate-100 dark:border-border/60">
                          <th className="px-5 py-3 text-[10.5px] uppercase font-bold text-slate-500 tracking-wider">
                            Material Code
                          </th>
                          <th className="px-5 py-3 text-[10.5px] uppercase font-bold text-slate-500 tracking-wider">
                            Variant Code
                          </th>
                          <th className="px-5 py-3 text-[10.5px] uppercase font-bold text-slate-500 tracking-wider">
                            Material Name &amp; Specs
                          </th>
                          <th className="px-5 py-3 text-[10.5px] uppercase font-bold text-slate-500 tracking-wider text-center">
                            Qty
                          </th>
                          <th className="px-5 py-3 text-[10.5px] uppercase font-bold text-slate-500 tracking-wider">
                            UOM
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-border/40">
                        {selectedRequest.items?.map((item: any, idx: number) => (
                          <tr
                            key={idx}
                            className="hover:bg-slate-50/50 dark:hover:bg-muted/20 transition-colors"
                          >
                            <td className="px-5 py-3.5 font-mono text-xs font-bold text-blue-600 dark:text-blue-400">
                              {item.materialCode || item.material_code}
                            </td>
                            <td className="px-5 py-3.5 font-mono text-xs font-bold text-teal-600 dark:text-teal-400">
                              {item.variantCode || item.variant_code || "—"}
                            </td>
                            <td className="px-5 py-3.5 font-medium text-slate-800 dark:text-slate-100 text-xs">
                              {item.materialName || item.material_name || "—"}
                            </td>
                            <td className="px-5 py-3.5 font-bold text-orange-500 text-xs text-center tabular-nums">
                              {item.quantity}
                            </td>
                            <td className="px-5 py-3.5 font-bold uppercase text-slate-500 dark:text-slate-400 text-xs">
                              {item.uom}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 3. Remarks / Justification */}
                <div className="space-y-2">
                  <Label className="text-[11px] uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400 block">
                    Remarks / Justification
                  </Label>
                  <p className="text-xs bg-slate-50/70 dark:bg-muted/30 p-4 rounded-2xl italic text-slate-600 dark:text-slate-400 border border-slate-100 dark:border-border/40 leading-relaxed">
                    {selectedRequest.remarks || "No remarks provided."}
                  </p>
                </div>
              </div>

              {/* Modal Footer matching screenshot */}
              <div className="p-4 px-7 bg-white dark:bg-card border-t border-slate-100 dark:border-border/60 flex items-center justify-between">
                <button
                  type="button"
                  className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white px-2 py-1 transition-colors"
                  onClick={() => setIsModalOpen(false)}
                >
                  CLOSE
                </button>

                <Button
                  className="rounded-full h-10 px-6 font-bold text-xs uppercase bg-blue-600 hover:bg-blue-700 text-white shadow-md flex items-center gap-2 tracking-wider"
                  asChild
                >
                  <Link to="/procurement/new-rfq" search={{ fromRequestId: selectedRequest.id }}>
                    <ArrowRight className="size-4" /> CREATE RFQ FROM REQUEST
                  </Link>
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
