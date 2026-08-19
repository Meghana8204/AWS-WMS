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
  ExternalLink,
  X,
  FileText,
  Info
} from "lucide-react";
import { AppShell, StatusBadge } from "@/components/wms/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api-client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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
          <p className="text-sm text-muted-foreground/70">All warehouse requirements have been processed.</p>
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
                      <h3 className="font-bold text-foreground tracking-tight">{req.requestNumber}</h3>
                      <StatusBadge status={req.status} />
                    </div>
                    <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground font-medium">
                      <span className="flex items-center gap-1"><Building2 className="size-3.5" /> {req.warehouseId}</span>
                      <span className="flex items-center gap-1"><Clock className="size-3.5" /> Requested by {req.requestedBy}</span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {req.items?.map((item: any, idx: number) => (
                        <span key={idx} className="text-[10px] text-orange-700 bg-orange-soft/20 px-2 py-0.5 rounded-md border border-orange-200 uppercase font-bold">
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
                    <Button variant="ghost" size="icon" className="rounded-xl h-9 w-9 text-muted-foreground group-hover:text-primary transition-colors">
                      <ArrowRight className="size-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* View Details Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-3xl rounded-3xl p-0 overflow-hidden border-none shadow-2xl">
          {selectedRequest && (
            <div className="flex flex-col h-full max-h-[90vh]">
              {/* Header */}
              <div className="p-6 text-white bg-slate-900 flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <DialogTitle className="text-xl font-bold tracking-tight">Material Request Details</DialogTitle>
                    <StatusBadge status={selectedRequest.status} />
                  </div>
                  <p className="text-white/70 text-sm font-mono font-bold tracking-widest">{selectedRequest.requestNumber}</p>
                </div>
                <Button variant="ghost" size="icon" className="text-white/50 hover:text-white hover:bg-white/10 rounded-full" onClick={() => setIsModalOpen(false)}>
                  <X className="size-5" />
                </Button>
              </div>

              {/* Scrollable Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-8">
                {/* Basic Info */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase font-black text-muted-foreground">Department</Label>
                    <p className="font-bold text-sm">{selectedRequest.department || "N/A"}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase font-black text-muted-foreground">Required Date</Label>
                    <p className="font-bold text-sm tabular-nums">{new Date(selectedRequest.requiredDate).toLocaleDateString()}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase font-black text-muted-foreground">Requested By</Label>
                    <p className="font-bold text-sm">{selectedRequest.requestedBy}</p>
                  </div>
                  <div className="space-y-1 text-right">
                    <Label className="text-[10px] uppercase font-black text-muted-foreground">Warehouse</Label>
                    <p className="font-bold text-sm">{selectedRequest.warehouseId}</p>
                  </div>
                </div>

                {/* Items Table */}
                <div className="space-y-4">
                  <Label className="text-[10px] uppercase font-black text-muted-foreground">Requested Materials</Label>
                  <div className="rounded-2xl border border-border/60 overflow-hidden bg-muted/5">
                    <table className="w-full text-left text-sm border-collapse">
                      <thead>
                        <tr className="bg-muted/50 border-b border-border/60">
                          <th className="p-3 text-[10px] uppercase font-black text-muted-foreground">Code</th>
                          <th className="p-3 text-[10px] uppercase font-black text-muted-foreground">Description</th>
                          <th className="p-3 text-[10px] uppercase font-black text-muted-foreground w-20 text-center">Qty</th>
                          <th className="p-3 text-[10px] uppercase font-black text-muted-foreground w-24">UOM</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedRequest.items?.map((item: any, idx: number) => (
                          <tr key={idx} className="border-b border-border/40 last:border-0 hover:bg-muted/20 transition-colors">
                            <td className="p-3 font-mono text-xs font-bold text-primary">{item.materialCode}</td>
                            <td className="p-3 font-medium text-foreground">{item.materialName}</td>
                            <td className="p-3 text-center font-bold text-orange-600 tabular-nums">{Math.floor(item.quantity)}</td>
                            <td className="p-3 text-[10px] font-black uppercase text-muted-foreground">{item.uom}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Remarks */}
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-black text-muted-foreground">Remarks / Justification</Label>
                  <p className="text-sm bg-muted/30 p-4 rounded-2xl italic text-muted-foreground border border-border/40 leading-relaxed">
                    {selectedRequest.remarks || "No additional remarks provided."}
                  </p>
                </div>
              </div>

              {/* Footer Actions */}
              <div className="p-6 bg-muted/10 border-t border-border/60 flex items-center justify-between">
                <Button variant="ghost" className="rounded-2xl h-11 px-6 font-bold text-xs uppercase" onClick={() => setIsModalOpen(false)}>Close</Button>
                <div className="flex items-center gap-3">
                  <Button className="rounded-2xl h-11 px-8 shadow-glow font-bold text-xs uppercase" asChild>
                    <Link to="/procurement/new-rfq" search={{ fromRequestId: selectedRequest.id }}>
                      <ArrowRight className="mr-2 size-4" /> Create RFQ from Request
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
