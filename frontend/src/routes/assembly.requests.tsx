import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import {
  ClipboardList,
  Plus,
  Search,
  Loader2,
  Calendar,
  Clock,
  Building2,
  CheckCircle2,
  Trash2,
  Save,
  X,
  Check,
  PackageCheck,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import { AppShell, StatusBadge } from "@/components/wms/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api-client";
import { getUserInfo } from "@/lib/auth-utils";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/assembly/requests")({
  head: () => ({
    meta: [
      { title: "Assembly Material Requisitions · NexusWMS" },
      {
        name: "description",
        content:
          "Create and track internal material requisitions from Assembly to Stores and Warehouse.",
      },
    ],
  }),
  component: AssemblyRequestsPage,
});

const UOM_OPTIONS = ["PCS", "MTR", "KG", "LTR", "BOX", "PKT", "SET", "NOS"];

function AssemblyRequestsPage() {
  const [requests, setRequests] = useState<any[]>([]);
  const [masterMaterials, setMasterMaterials] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [isViewing, setIsViewing] = useState(false);

  const user = getUserInfo();

  const [formData, setFormData] = useState({
    warehouse_id: "Main Warehouse",
    department: "Assembly",
    requested_by: user?.username || "Assembly Operator",
    priority: "MEDIUM",
    required_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    remarks: "",
  });

  const [items, setItems] = useState<any[]>([
    {
      material_id: "",
      material_variant_id: "",
      material_code: "",
      variant_code: "",
      material_name: "",
      quantity: 1,
      uom: "PCS",
    },
  ]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [reqData, matData] = await Promise.all([
        api.getAssemblyRequisitions("Assembly"),
        api.getMaterials({ status: "Active" }).catch(() => []),
      ]);
      setRequests(reqData || []);
      setMasterMaterials(matData || []);
    } catch {
      toast.error("Failed to load assembly material requisitions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const addItem = () => {
    setItems([
      ...items,
      {
        material_id: "",
        material_variant_id: "",
        material_code: "",
        variant_code: "",
        material_name: "",
        quantity: 1,
        uom: "PCS",
      },
    ]);
  };

  const removeItem = (idx: number) => {
    if (items.length === 1) return;
    setItems(items.filter((_, i) => i !== idx));
  };

  const handleSelectMaterial = (idx: number, matId: string) => {
    const foundMat = masterMaterials.find((m) => m.id === matId);
    if (!foundMat) return;
    const defaultVariant = foundMat.variants?.[0];
    const specDetails = defaultVariant
      ? [defaultVariant.size, defaultVariant.color, defaultVariant.grade].filter(Boolean).join(", ")
      : "";
    const nameWithSpec = specDetails
      ? `${foundMat.material_name} (${specDetails})`
      : foundMat.material_name;

    setItems(
      items.map((it, i) =>
        i === idx
          ? {
              ...it,
              material_id: foundMat.id,
              material_variant_id: defaultVariant?.id || "",
              material_code: foundMat.material_code,
              variant_code: defaultVariant?.variant_code || "",
              material_name: nameWithSpec,
              uom: defaultVariant?.uom || foundMat.base_uom || "PCS",
            }
          : it,
      ),
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.some((it) => !it.material_code?.trim() || !it.material_name?.trim())) {
      toast.error("Please select a material for all item rows");
      return;
    }
    if (items.some((it) => !it.quantity || parseFloat(it.quantity) <= 0)) {
      toast.error("Quantity must be greater than 0");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        warehouse_id: formData.warehouse_id,
        department: "Assembly",
        requested_by: formData.requested_by,
        priority: formData.priority,
        required_date: formData.required_date,
        remarks: formData.remarks,
        items: items.map((it) => ({
          material_id: it.material_id || null,
          material_variant_id: it.material_variant_id || null,
          material_code: it.material_code,
          variant_code: it.variant_code || null,
          material_name: it.material_name,
          quantity: parseFloat(it.quantity) || 1,
          uom: it.uom || "PCS",
        })),
      };

      await api.createAssemblyRequisition(payload);
      toast.success("Assembly Material Requisition submitted to Warehouse!");
      setIsCreating(false);
      setItems([
        {
          material_id: "",
          material_variant_id: "",
          material_code: "",
          variant_code: "",
          material_name: "",
          quantity: 1,
          uom: "PCS",
        },
      ]);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed to create assembly material requisition");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredRequests = useMemo(() => {
    return requests.filter((r) => {
      const matchesStatus =
        statusFilter === "ALL" || (r.status || "").toUpperCase() === statusFilter.toUpperCase();
      const q = search.trim().toLowerCase();
      const reqNum = (
        r.requisitionNumber ||
        r.requisition_number ||
        r.requestNumber ||
        r.request_number ||
        ""
      ).toLowerCase();
      const matchesSearch =
        !q ||
        reqNum.includes(q) ||
        (r.remarks || "").toLowerCase().includes(q) ||
        (r.items || []).some((it: any) =>
          (it.materialName || it.material_name || it.materialCode || it.material_code || "")
            .toLowerCase()
            .includes(q),
        );
      return matchesStatus && matchesSearch;
    });
  }, [requests, search, statusFilter]);

  return (
    <AppShell
      title="Assembly Material Requisitions"
      subtitle="Request components and production materials from Warehouse & Stores"
      actions={
        <Button
          className="rounded-xl shadow-glow bg-blue-600 hover:bg-blue-700 text-white font-bold"
          onClick={() => setIsCreating(true)}
        >
          <Plus className="mr-2 size-4" /> New Material Requisition
        </Button>
      }
    >
      <div className="space-y-6">
        {/* Filters */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="relative w-72">
            <Search className="size-3.5 absolute left-3 top-2.5 text-muted-foreground" />
            <Input
              placeholder="Search request number or material..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-9 text-xs rounded-xl bg-background/60 border-border/40"
            />
          </div>

          <div className="flex items-center gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40 h-9 text-xs rounded-xl border-border/40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Status</SelectItem>
                <SelectItem value="PENDING">Pending Warehouse</SelectItem>
                <SelectItem value="ASSIGNED_TO_STORE">Assigned to Store</SelectItem>
                <SelectItem value="PICKING">Picking In Progress</SelectItem>
                <SelectItem value="COMPLETED">Completed / Handed Over</SelectItem>
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

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
            <Loader2 className="size-8 animate-spin text-primary" />
            <p className="text-sm">Loading assembly requests...</p>
          </div>
        ) : filteredRequests.length === 0 ? (
          <Card className="border-dashed border-border/60 p-12 text-center bg-card/40">
            <ClipboardList className="size-10 mx-auto text-muted-foreground opacity-40 mb-3" />
            <h3 className="text-sm font-bold text-foreground">No Material Requests Found</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              Create a new request to notify Warehouse and have your required items picked from the
              appropriate Store.
            </p>
            <Button
              size="sm"
              onClick={() => setIsCreating(true)}
              className="mt-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold"
            >
              <Plus className="size-3.5 mr-1.5" /> Create First Request
            </Button>
          </Card>
        ) : (
          <div className="grid gap-3">
            {filteredRequests.map((req) => (
              <Card
                key={req.id}
                className="border-border/40 hover:border-primary/40 transition-colors cursor-pointer shadow-soft"
                onClick={() => {
                  setSelectedRequest(req);
                  setIsViewing(true);
                }}
              >
                <CardContent className="p-5">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2.5">
                        <span className="font-mono text-sm font-bold text-foreground">
                          {req.requisitionNumber ||
                            req.requisition_number ||
                            req.requestNumber ||
                            req.request_number}
                        </span>
                        <StatusBadge status={req.status} />
                        {req.priority && (
                          <span
                            className={cn(
                              "text-[10px] font-bold px-2 py-0.5 rounded-full uppercase",
                              req.priority === "URGENT"
                                ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
                                : req.priority === "HIGH"
                                  ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                                  : "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
                            )}
                          >
                            {req.priority}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Building2 className="size-3.5" /> Dept:{" "}
                          <strong className="text-foreground">{req.department}</strong>
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="size-3.5" /> Required by:{" "}
                          <strong className="text-foreground">
                            {new Date(req.requiredDate || req.required_date).toLocaleDateString()}
                          </strong>
                        </span>
                        {req.assignedStoreName || req.assigned_store_name ? (
                          <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800 text-[11px]">
                            <Building2 className="size-3" /> Fulfilling Store:{" "}
                            {req.assignedStoreName || req.assigned_store_name} (
                            {req.assignedStoreCode || req.assigned_store_code})
                          </span>
                        ) : (
                          <span className="text-amber-600 text-[11px] font-medium italic">
                            Awaiting Warehouse Store Assignment
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-2 pt-1">
                        {req.items?.map((it: any, idx: number) => {
                          const reqQty = Number(
                            it.requestedQuantity || it.requested_quantity || it.quantity || 0,
                          );
                          const issQty = Number(it.issuedQuantity || it.issued_quantity || 0);
                          const remQty = Math.max(0, reqQty - issQty);
                          return (
                            <span
                              key={idx}
                              className="text-[11px] text-primary bg-primary/10 px-2.5 py-1 rounded-lg border border-primary/20 font-medium"
                            >
                              {it.materialName ||
                                it.material_name ||
                                it.materialCode ||
                                it.material_code}
                              :{" "}
                              <strong>
                                {reqQty} {it.uom}
                              </strong>
                              {issQty > 0 && (
                                <span className="ml-1.5 text-emerald-600 font-bold">
                                  (Issued: {issQty}/{reqQty}
                                  {remQty > 0 ? ` · Rem: ${remQty}` : " · Complete"})
                                </span>
                              )}
                            </span>
                          );
                        })}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <p className="text-[10px] uppercase font-bold text-muted-foreground">
                        Created
                      </p>
                      <p className="text-xs font-bold tabular-nums">
                        {new Date(req.createdAt || req.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Create Material Request Dialog */}
      <Dialog open={isCreating} onOpenChange={setIsCreating}>
        <DialogContent className="max-w-2xl rounded-3xl p-6 border-none shadow-2xl bg-card">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <ClipboardList className="size-5 text-blue-600" />
              New Assembly Material Request
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-bold text-muted-foreground">Department</Label>
                <Input value="Assembly" readOnly className="h-9 rounded-xl text-xs bg-muted/50" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-bold text-muted-foreground">Priority</Label>
                <Select
                  value={formData.priority}
                  onValueChange={(val) => setFormData({ ...formData, priority: val })}
                >
                  <SelectTrigger className="h-9 rounded-xl text-xs">
                    <SelectValue placeholder="Priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LOW">Low</SelectItem>
                    <SelectItem value="MEDIUM">Medium</SelectItem>
                    <SelectItem value="HIGH">High</SelectItem>
                    <SelectItem value="URGENT">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1 col-span-2 sm:col-span-1">
                <Label className="text-xs font-bold text-muted-foreground">Required Date</Label>
                <Input
                  type="date"
                  min={new Date().toISOString().split("T")[0]}
                  value={formData.required_date}
                  onChange={(e) => setFormData({ ...formData, required_date: e.target.value })}
                  className="h-9 rounded-xl text-xs"
                  required
                />
              </div>
            </div>

            {/* Requested Items */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold uppercase text-muted-foreground">
                  Requested Items
                </Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addItem}
                  className="h-7 text-xs rounded-lg"
                >
                  <Plus className="size-3 mr-1" /> Add Item
                </Button>
              </div>

              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {items.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-muted/20 border border-border/50 rounded-2xl flex flex-col sm:flex-row gap-2 items-start sm:items-center"
                  >
                    <div className="flex-1 w-full">
                      <Select
                        value={item.material_id}
                        onValueChange={(val) => handleSelectMaterial(idx, val)}
                      >
                        <SelectTrigger className="h-9 rounded-xl text-xs">
                          <SelectValue placeholder="Select Material" />
                        </SelectTrigger>
                        <SelectContent className="max-h-60">
                          {masterMaterials.map((m) => (
                            <SelectItem key={m.id} value={m.id}>
                              <span className="font-mono font-bold text-primary">
                                {m.material_code}
                              </span>{" "}
                              — {m.material_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="w-24">
                      <Input
                        type="number"
                        min="0.0001"
                        step="any"
                        placeholder="Qty"
                        value={item.quantity}
                        onChange={(e) =>
                          setItems(
                            items.map((it, i) =>
                              i === idx ? { ...it, quantity: e.target.value } : it,
                            ),
                          )
                        }
                        className="h-9 rounded-xl text-xs"
                        required
                      />
                    </div>

                    <div className="w-20">
                      <Select
                        value={item.uom}
                        onValueChange={(val) =>
                          setItems(items.map((it, i) => (i === idx ? { ...it, uom: val } : it)))
                        }
                      >
                        <SelectTrigger className="h-9 rounded-xl text-xs">
                          <SelectValue placeholder="UOM" />
                        </SelectTrigger>
                        <SelectContent>
                          {UOM_OPTIONS.map((u) => (
                            <SelectItem key={u} value={u}>
                              {u}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={items.length <= 1}
                      onClick={() => removeItem(idx)}
                      className="size-9 rounded-xl text-destructive hover:bg-destructive/10 shrink-0"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold text-muted-foreground">
                Remarks / Line Usage Justification
              </Label>
              <Textarea
                placeholder="Specify production line or purpose (e.g. Urgent motors for Line 3 assembly)"
                value={formData.remarks}
                onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                className="rounded-xl text-xs min-h-[60px]"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="ghost"
                className="rounded-xl"
                onClick={() => setIsCreating(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold"
                disabled={submitting}
              >
                {submitting ? (
                  <Loader2 className="size-4 animate-spin mr-2" />
                ) : (
                  <CheckCircle2 className="size-4 mr-2" />
                )}
                Submit to Warehouse
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Request Details View Dialog */}
      <Dialog open={isViewing} onOpenChange={setIsViewing}>
        <DialogContent className="max-w-lg rounded-3xl p-6 border-none shadow-2xl bg-card">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <ClipboardList className="size-5 text-blue-600" />
              Request Details
            </DialogTitle>
          </DialogHeader>

          {selectedRequest && (
            <div className="space-y-4 py-2">
              <div className="flex justify-between items-center bg-muted/40 p-3 rounded-2xl">
                <div>
                  <p className="text-[10px] uppercase font-bold text-muted-foreground">
                    Requisition Number
                  </p>
                  <p className="font-mono font-bold text-sm text-foreground">
                    {selectedRequest.requisitionNumber ||
                      selectedRequest.requisition_number ||
                      selectedRequest.requestNumber ||
                      selectedRequest.request_number}
                  </p>
                </div>
                <StatusBadge status={selectedRequest.status} />
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-muted-foreground">Department:</span>{" "}
                  <strong className="text-foreground">{selectedRequest.department}</strong>
                </div>
                <div>
                  <span className="text-muted-foreground">Priority:</span>{" "}
                  <strong className="text-foreground">
                    {selectedRequest.priority || "MEDIUM"}
                  </strong>
                </div>
                <div>
                  <span className="text-muted-foreground">Required Date:</span>{" "}
                  <strong className="text-foreground">
                    {new Date(
                      selectedRequest.requiredDate || selectedRequest.required_date,
                    ).toLocaleDateString()}
                  </strong>
                </div>
                <div>
                  <span className="text-muted-foreground">Fulfilling Store:</span>{" "}
                  <strong className="text-emerald-600 dark:text-emerald-400">
                    {selectedRequest.assignedStoreName ||
                      selectedRequest.assigned_store_name ||
                      "Pending Assignment"}
                  </strong>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-bold text-muted-foreground uppercase">Items</p>
                <div className="p-3 bg-muted/20 border border-border/40 rounded-2xl space-y-2">
                  {selectedRequest.items?.map((it: any, idx: number) => {
                    const reqQty = Number(
                      it.requestedQuantity || it.requested_quantity || it.quantity || 0,
                    );
                    const issQty = Number(it.issuedQuantity || it.issued_quantity || 0);
                    return (
                      <div key={idx} className="flex justify-between items-center text-xs">
                        <div>
                          <p className="font-semibold text-foreground">
                            {it.materialName ||
                              it.material_name ||
                              it.materialCode ||
                              it.material_code}
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
                            Requested: {reqQty} {it.uom}
                          </span>
                          {issQty > 0 && (
                            <p className="text-[10px] text-emerald-600 font-bold">
                              Issued: {issQty} {it.uom}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {selectedRequest.remarks && (
                <div className="text-xs text-muted-foreground bg-muted/20 p-3 rounded-xl">
                  <strong>Remarks:</strong> {selectedRequest.remarks}
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" className="rounded-xl" onClick={() => setIsViewing(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
