import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import {
  ClipboardCheck,
  Search,
  Loader2,
  Calendar,
  Building2,
  CheckCircle2,
  Clock,
  ArrowRight,
  Warehouse,
  Boxes,
  Eye,
  Send,
} from "lucide-react";
import { AppShell, StatusBadge } from "@/components/wms/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { api } from "@/lib/api-client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/warehouse/assembly-requisitions")({
  head: () => ({
    meta: [
      { title: "Assembly Material Requisitions · NexusWMS" },
      {
        name: "description",
        content:
          "Review Assembly material requisitions, approve and assign fulfilling Stores for pickup tasks.",
      },
    ],
  }),
  component: WarehouseAssemblyRequisitionsPage,
});

function WarehouseAssemblyRequisitionsPage() {
  const [requisitions, setRequisitions] = useState<any[]>([]);
  const [stores, setStores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Store Assignment modal
  const [assigningReq, setAssigningReq] = useState<any>(null);
  const [selectedStoreId, setSelectedStoreId] = useState("");
  const [assigning, setAssigning] = useState(false);

  // View details modal
  const [viewingReq, setViewingReq] = useState<any>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [reqData, storeData] = await Promise.all([
        api.getAssemblyRequisitions(),
        api.getStores({ status: "ACTIVE" }).catch(() => []),
      ]);
      setRequisitions(reqData || []);
      setStores(storeData || []);
    } catch {
      toast.error("Failed to load assembly requisitions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAssignStore = async () => {
    if (!assigningReq || !selectedStoreId) {
      toast.error("Please select a Store to fulfill this requisition");
      return;
    }

    setAssigning(true);
    try {
      const res = await api.assignAssemblyRequisitionStore(assigningReq.id, selectedStoreId);
      toast.success(
        `Requisition assigned to ${res?.assigned_store?.store_name || "Store"}! Pickup tasks created for Store Keepers.`,
      );
      setAssigningReq(null);
      setSelectedStoreId("");
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed to assign store to requisition");
    } finally {
      setAssigning(false);
    }
  };

  const filteredRequisitions = useMemo(() => {
    return requisitions.filter((r) => {
      const matchesStatus =
        statusFilter === "ALL" || (r.status || "").toUpperCase() === statusFilter.toUpperCase();
      const q = search.trim().toLowerCase();
      const reqNum = (r.requisitionNumber || r.requisition_number || "").toLowerCase();
      const matchesSearch =
        !q ||
        reqNum.includes(q) ||
        (r.department || "").toLowerCase().includes(q) ||
        (r.remarks || "").toLowerCase().includes(q) ||
        (r.items || []).some((it: any) =>
          (it.materialName || it.material_name || it.materialCode || it.material_code || "")
            .toLowerCase()
            .includes(q),
        );
      return matchesStatus && matchesSearch;
    });
  }, [requisitions, search, statusFilter]);

  return (
    <AppShell
      title="Assembly Material Requisitions"
      subtitle="Review internal requisitions from Assembly and assign destination Stores for physical pickup"
    >
      <div className="space-y-6">
        {/* Filters */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="relative w-72">
            <Search className="size-3.5 absolute left-3 top-2.5 text-muted-foreground" />
            <Input
              placeholder="Search requisition or item..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-9 text-xs rounded-xl bg-background/60 border-border/40"
            />
          </div>

          <div className="flex items-center gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-44 h-9 text-xs rounded-xl border-border/40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Status</SelectItem>
                <SelectItem value="PENDING">Pending Store Assignment</SelectItem>
                <SelectItem value="ASSIGNED_TO_STORE">Assigned to Store</SelectItem>
                <SelectItem value="PICKING">Picking In Progress</SelectItem>
                <SelectItem value="PARTIALLY_ISSUED">Partially Issued</SelectItem>
                <SelectItem value="COMPLETED">Completed</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              size="sm"
              onClick={fetchData}
              className="h-9 rounded-xl text-xs"
            >
              Refresh
            </Button>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
            <Loader2 className="size-8 animate-spin text-primary" />
            <p className="text-sm">Loading assembly requisitions...</p>
          </div>
        ) : filteredRequisitions.length === 0 ? (
          <Card className="border-dashed border-border/60 p-12 text-center bg-card/40">
            <ClipboardCheck className="size-10 mx-auto text-muted-foreground opacity-40 mb-3" />
            <h3 className="text-sm font-bold text-foreground">No Requisitions Found</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              Assembly requisitions awaiting warehouse store assignment or processing will appear
              here.
            </p>
          </Card>
        ) : (
          <div className="grid gap-3">
            {filteredRequisitions.map((req) => {
              const isAssigned = Boolean(req.assignedStoreId || req.assigned_store_id);
              return (
                <Card
                  key={req.id}
                  className="border-border/40 hover:border-primary/40 transition-colors shadow-soft"
                >
                  <CardContent className="p-5">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-2.5">
                          <span className="font-mono text-sm font-bold text-foreground">
                            {req.requisitionNumber || req.requisition_number}
                          </span>
                          <StatusBadge status={req.status} />
                          {req.priority && (
                            <span
                              className={cn(
                                "text-[10px] font-bold px-2 py-0.5 rounded-full uppercase",
                                req.priority === "URGENT"
                                  ? "bg-red-100 text-red-700"
                                  : req.priority === "HIGH"
                                    ? "bg-amber-100 text-amber-700"
                                    : "bg-blue-100 text-blue-700",
                              )}
                            >
                              {req.priority}
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Building2 className="size-3.5" /> Department:{" "}
                            <strong className="text-foreground">{req.department}</strong>
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="size-3.5" /> Required Date:{" "}
                            <strong className="text-foreground">
                              {new Date(req.requiredDate || req.required_date).toLocaleDateString()}
                            </strong>
                          </span>
                          <span className="flex items-center gap-1">
                            <Boxes className="size-3.5" /> Items:{" "}
                            <strong className="text-foreground">{(req.items || []).length}</strong>
                          </span>
                        </div>

                        {/* Store Info Banner */}
                        {isAssigned ? (
                          <div className="text-xs bg-emerald-50 border border-emerald-200 text-emerald-800 px-3 py-1.5 rounded-xl flex items-center gap-2 font-medium">
                            <Warehouse className="size-3.5 text-emerald-600" />
                            <span>
                              Assigned Store:{" "}
                              <strong>{req.assignedStoreName || req.assigned_store_name}</strong> (
                              {req.assignedStoreCode || req.assigned_store_code})
                            </span>
                          </div>
                        ) : (
                          <div className="text-xs bg-amber-50 border border-amber-200 text-amber-800 px-3 py-1.5 rounded-xl flex items-center gap-2 font-medium">
                            <Clock className="size-3.5 text-amber-600" />
                            <span>
                              Awaiting Store Assignment — Assign a Store to dispatch Store Keeper
                              pickup tasks
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-xl h-9 text-xs"
                          onClick={() => setViewingReq(req)}
                        >
                          <Eye className="size-3.5 mr-1" /> View Items
                        </Button>

                        {req.status === "PENDING" && (
                          <Button
                            size="sm"
                            className="rounded-xl h-9 text-xs bg-blue-600 hover:bg-blue-700 text-white font-bold"
                            onClick={() => {
                              setAssigningReq(req);
                              setSelectedStoreId(
                                req.assignedStoreId || req.assigned_store_id || "",
                              );
                            }}
                          >
                            <Send className="size-3.5 mr-1.5" /> Assign Store
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Assign Store Modal */}
      <Dialog open={Boolean(assigningReq)} onOpenChange={(open) => !open && setAssigningReq(null)}>
        <DialogContent className="max-w-md rounded-3xl p-6 bg-card border-none shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <Warehouse className="size-5 text-blue-600" />
              Assign Fulfilling Store
            </DialogTitle>
          </DialogHeader>

          {assigningReq && (
            <div className="space-y-4 py-2">
              <div className="p-3 bg-muted/40 rounded-2xl space-y-1 text-xs">
                <p className="text-muted-foreground">Requisition Number:</p>
                <p className="font-mono font-bold text-sm text-foreground">
                  {assigningReq.requisitionNumber || assigningReq.requisition_number}
                </p>
                <p className="text-muted-foreground mt-1">
                  Department: <strong className="text-foreground">{assigningReq.department}</strong>{" "}
                  · Priority: <strong className="text-foreground">{assigningReq.priority}</strong>
                </p>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold">Select Fulfilling Store</Label>
                <Select value={selectedStoreId} onValueChange={setSelectedStoreId}>
                  <SelectTrigger className="rounded-xl text-xs h-10 border-border/40">
                    <SelectValue placeholder="Choose a Store (e.g. Mechanical Store, Electrical Store)..." />
                  </SelectTrigger>
                  <SelectContent>
                    {stores.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="font-mono font-bold text-primary">
                            {s.store_code || s.storeCode}
                          </span>
                          <span>—</span>
                          <span className="font-medium">{s.store_name || s.storeName}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  Assigning a Store will automatically create Pickup Tasks for that store's Store
                  Keepers and send them targeted notifications.
                </p>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="ghost" className="rounded-xl" onClick={() => setAssigningReq(null)}>
              Cancel
            </Button>
            <Button
              className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold"
              disabled={assigning || !selectedStoreId}
              onClick={handleAssignStore}
            >
              {assigning ? (
                <Loader2 className="size-4 animate-spin mr-2" />
              ) : (
                <CheckCircle2 className="size-4 mr-2" />
              )}
              Confirm & Dispatch Tasks
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Details Modal */}
      <Dialog open={Boolean(viewingReq)} onOpenChange={(open) => !open && setViewingReq(null)}>
        <DialogContent className="max-w-lg rounded-3xl p-6 bg-card border-none shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <ClipboardCheck className="size-5 text-blue-600" />
              Requisition Details
            </DialogTitle>
          </DialogHeader>

          {viewingReq && (
            <div className="space-y-4 py-2 text-xs">
              <div className="flex justify-between items-center bg-muted/40 p-3 rounded-2xl">
                <div>
                  <p className="text-[10px] uppercase font-bold text-muted-foreground">
                    Requisition Number
                  </p>
                  <p className="font-mono font-bold text-sm text-foreground">
                    {viewingReq.requisitionNumber || viewingReq.requisition_number}
                  </p>
                </div>
                <StatusBadge status={viewingReq.status} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-muted-foreground">Department:</span>{" "}
                  <strong className="text-foreground">{viewingReq.department}</strong>
                </div>
                <div>
                  <span className="text-muted-foreground">Requested By:</span>{" "}
                  <strong className="text-foreground">
                    {viewingReq.requested_by || viewingReq.requestedBy}
                  </strong>
                </div>
                <div>
                  <span className="text-muted-foreground">Required Date:</span>{" "}
                  <strong className="text-foreground">
                    {new Date(
                      viewingReq.requiredDate || viewingReq.required_date,
                    ).toLocaleDateString()}
                  </strong>
                </div>
                <div>
                  <span className="text-muted-foreground">Priority:</span>{" "}
                  <strong className="text-foreground">{viewingReq.priority}</strong>
                </div>
              </div>

              <div className="space-y-2">
                <p className="font-bold text-muted-foreground uppercase text-[11px]">
                  Requested Materials
                </p>
                <div className="p-3 bg-muted/20 border border-border/40 rounded-2xl space-y-2">
                  {(viewingReq.items || []).map((it: any, idx: number) => (
                    <div key={idx} className="flex justify-between items-center text-xs">
                      <div>
                        <p className="font-semibold text-foreground">
                          {it.materialName || it.material_name}
                        </p>
                        <p className="font-mono text-[10px] text-muted-foreground">
                          {it.materialCode || it.material_code}
                          {it.variantCode || it.variant_code
                            ? ` · ${it.variantCode || it.variant_code}`
                            : ""}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="font-mono font-bold text-primary">
                          {it.requestedQuantity || it.requested_quantity || it.quantity} {it.uom}
                        </span>
                        {(it.issuedQuantity || it.issued_quantity) > 0 && (
                          <p className="text-[10px] text-emerald-600 font-bold">
                            Issued: {it.issuedQuantity || it.issued_quantity}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {viewingReq.remarks && (
                <div className="p-3 bg-muted/20 rounded-xl text-muted-foreground">
                  <strong>Remarks:</strong> {viewingReq.remarks}
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" className="rounded-xl" onClick={() => setViewingReq(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
