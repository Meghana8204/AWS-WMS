import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ClipboardList,
  Plus,
  Search,
  Filter,
  Loader2,
  Calendar,
  Clock,
  Building2,
  CheckCircle2,
  Trash2,
  Save,
  X,
} from "lucide-react";
import { AppShell, StatusBadge } from "@/components/wms/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api-client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
export const Route = createFileRoute("/warehouse/material-requests")({
  component: WarehouseMaterialRequests,
});
const UOM_OPTIONS = ["PCS", "MTR", "KG", "LTR", "BOX", "PKT", "ROL", "SQM", "SET", "NOS"];
function WarehouseMaterialRequests() {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [nextRequestNumber, setNextRequestNumber] = useState("");
  const [baseMaterialSequence, setBaseMaterialSequence] = useState(1);
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [isViewing, setIsRequestModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    request_number: "",
    warehouse_id: "Main Warehouse",
    department: "Inventory",
    requested_by: "Warehouse Manager",
    required_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    remarks: "",
  });
  const [items, setItems] = useState<any[]>([
    { material_code: "", material_name: "", quantity: 1, uom: "PCS" },
  ]);
  const fetchData = async () => {
    try {
      setLoading(true);
      const data = await api.getMaterialRequests();
      setRequests(data);
    } catch (error) {
      toast.error("Failed to load requests");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    fetchData();
    const info = localStorage.getItem("user_info");
    if (info) {
      const user = JSON.parse(info);
      setFormData((prev) => ({ ...prev, requested_by: user.username || "Warehouse Manager" }));
    }
  }, []);
  const addItem = () => {
    const nextSeq = baseMaterialSequence + items.length;
    const code = `MAT-${String(nextSeq).padStart(4, "0")}`;
    setItems([...items, { material_code: code, material_name: "", quantity: 1, uom: "PCS" }]);
  };
  const removeItem = (idx: number) => {
    if (items.length === 1) return;
    setItems(items.filter((_, i) => i !== idx));
  };
  const handleItemChange = (idx: number, field: string, value: any) => {
    setItems(items.map((it, i) => (i === idx ? { ...it, [field]: value } : it)));
  };
  const handleEditItemChange = (idx: number, field: string, value: any) => {
    if (!selectedRequest) return;
    const newItems = [...selectedRequest.items];
    newItems[idx] = { ...newItems[idx], [field]: value };
    setSelectedRequest({ ...selectedRequest, items: newItems });
  };
  const addEditItem = () => {
    if (!selectedRequest) return;
    const nextSeq = baseMaterialSequence + selectedRequest.items.length;
    const code = `MAT-${String(nextSeq).padStart(4, "0")}`;
    const newItem = { materialCode: code, materialName: "", quantity: 1, uom: "PCS" };
    setSelectedRequest({ ...selectedRequest, items: [...selectedRequest.items, newItem] });
  };
  const removeEditItem = (idx: number) => {
    if (!selectedRequest || selectedRequest.items.length <= 1) return;
    const newItems = selectedRequest.items.filter((_: any, i: number) => i !== idx);
    setSelectedRequest({ ...selectedRequest, items: newItems });
  };
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.some((it) => !it.material_name?.trim() || !it.quantity)) {
      toast.error("Please fill in material description and quantity for all items");
      return;
    }
    setSubmitting(true);
    try {
      await api.createMaterialRequest({ ...formData, items });
      toast.success("Material request submitted to Procurement");
      setIsCreating(false);
      setItems([{ material_code: "", material_name: "", quantity: 1, uom: "PCS" }]);
      setFormData((prev) => ({ ...prev, request_number: "" }));
      fetchData();
    } catch (error: any) {
      toast.error("Failed to submit request: " + error.message);
    } finally {
      setSubmitting(false);
    }
  };
  const startCreating = async () => {
    try {
      const { requestNumber, nextMaterialSequence } =
        (await api.getNextMaterialRequestNumber()) as any;
      setNextRequestNumber(requestNumber);
      setBaseMaterialSequence(nextMaterialSequence || 1);
      const initialCode = `MAT-${String(nextMaterialSequence || 1).padStart(4, "0")}`;
      setFormData((prev) => ({ ...prev, request_number: requestNumber }));
      setItems([{ material_code: initialCode, material_name: "", quantity: 1, uom: "PCS" }]);
      setIsCreating(true);
    } catch (error) {
      toast.error("Failed to generate request number");
    }
  };
  const handleRequestClick = (req: any) => {
    setSelectedRequest(JSON.parse(JSON.stringify(req)));
    setIsRequestModalOpen(true);
    setIsEditing(false);
  };
  const handleUpdate = async () => {
    if (!selectedRequest) return;
    setSubmitting(true);
    try {
      const payload = {
        request_number: selectedRequest.requestNumber,
        warehouse_id: selectedRequest.warehouseId,
        department: selectedRequest.department,
        requested_by: selectedRequest.requestedBy,
        required_date: new Date(selectedRequest.requiredDate).toISOString().split("T")[0],
        remarks: selectedRequest.remarks,
        items: selectedRequest.items.map((it: any) => ({
          material_code: it.materialCode,
          material_name: it.materialName,
          quantity: it.quantity,
          uom: it.uom,
        })),
      };
      await api.updateMaterialRequest(selectedRequest.id, payload);
      toast.success("Request updated successfully");
      setIsEditing(false);
      setIsRequestModalOpen(false);
      fetchData();
    } catch (error: any) {
      toast.error("Update failed: " + error.message);
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <AppShell
      title="Warehouse Material Requests"
      subtitle="Request stocks and consumables from the procurement team"
      actions={
        <Button className="rounded-xl shadow-glow" onClick={startCreating}>
          <Plus className="mr-2 size-4" /> New Request
        </Button>
      }
    >
      {isCreating ? (
        <Card className="mb-8 border-primary/20 shadow-soft animate-in slide-in-from-top-4">
          <CardHeader className="border-b border-border/60 bg-muted/10">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-bold uppercase tracking-wider">
                Create Stock Requirement
              </CardTitle>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full"
                onClick={() => setIsCreating(false)}
              >
                <X className="size-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid gap-6 sm:grid-cols-4">
                <div className="space-y-1.5">
                  <Label>Request Number</Label>
                  <Input
                    value={formData.request_number}
                    readOnly
                    className="rounded-xl font-mono bg-muted/50"
                    placeholder="MR-2026-XXXX"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Warehouse</Label>
                  <Input value={formData.warehouse_id} readOnly className="bg-muted/50" />
                </div>
                <div className="space-y-1.5">
                  <Label>Department</Label>
                  <Input
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Required Date</Label>
                  <Input
                    type="date"
                    min={new Date().toISOString().split("T")[0]}
                    value={formData.required_date}
                    onChange={(e) => setFormData({ ...formData, required_date: e.target.value })}
                    className="rounded-xl"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground">
                    Material Items
                  </Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 rounded-lg text-[10px] font-bold"
                    onClick={addItem}
                  >
                    <Plus className="size-3 mr-1" /> Add Item
                  </Button>
                </div>

                <div className="space-y-2">
                  {items.map((item, idx) => (
                    <div key={idx} className="flex gap-3 items-end">
                      <div className="flex-[2] space-y-1">
                        <Label className="text-[10px]">Material Code</Label>
                        <Input
                          placeholder="MAT-XXXX"
                          className="h-9 rounded-lg font-mono text-xs bg-muted/50"
                          value={item.material_code}
                          readOnly
                        />
                      </div>
                      <div className="flex-[3] space-y-1">
                        <Label className="text-[10px]">Material Name</Label>
                        <Input
                          placeholder="Steel Pipe..."
                          className="h-9 rounded-lg text-xs"
                          value={item.material_name}
                          onChange={(e) => handleItemChange(idx, "material_name", e.target.value)}
                        />
                      </div>
                      <div className="flex-1 space-y-1">
                        <Label className="text-[10px]">Qty</Label>
                        <Input
                          type="number"
                          min="1"
                          className="h-9 rounded-lg text-xs"
                          value={item.quantity}
                          onChange={(e) => handleItemChange(idx, "quantity", e.target.value)}
                        />
                      </div>
                      <div className="flex-1 space-y-1">
                        <Label className="text-[10px]">UOM</Label>
                        <Select
                          value={item.uom}
                          onValueChange={(value) => handleItemChange(idx, "uom", value)}
                        >
                          <SelectTrigger className="h-9 rounded-lg text-xs bg-background">
                            <SelectValue placeholder="UOM" />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl">
                            {UOM_OPTIONS.map((uom) => (
                              <SelectItem key={uom} value={uom} className="text-xs rounded-lg">
                                {uom}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-9 rounded-lg text-destructive disabled:opacity-30 disabled:pointer-events-none"
                        onClick={() => removeItem(idx)}
                        disabled={items.length === 1}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Remarks / Justification</Label>
                <Textarea
                  placeholder="Why is this stock needed?"
                  className="rounded-xl min-h-[80px]"
                  value={formData.remarks}
                  onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button
                  type="button"
                  variant="ghost"
                  className="rounded-xl"
                  onClick={() => setIsCreating(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" className="rounded-xl shadow-glow px-8" disabled={submitting}>
                  {submitting ? (
                    <Loader2 className="size-4 animate-spin mr-2" />
                  ) : (
                    <Save className="size-4 mr-2" />
                  )}
                  Submit Request
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <div className="mb-6 flex flex-wrap items-center gap-4">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            placeholder="Search request number..."
            className="h-10 w-full rounded-xl border border-border bg-card pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="size-8 animate-spin text-primary" />
        </div>
      ) : requests.length === 0 ? (
        <Card className="flex h-64 flex-col items-center justify-center p-6 text-center border-dashed border-border/50 bg-muted/20">
          <ClipboardList className="size-12 text-muted-foreground/30 mb-4" />
          <h3 className="text-lg font-semibold text-muted-foreground">No active requests</h3>
          <p className="text-sm text-muted-foreground/70">
            Create a new request to notify the procurement team.
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
                        <Building2 className="size-3.5" /> {req.department}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="size-3.5" /> Required by{" "}
                        {new Date(req.requiredDate).toLocaleDateString()}
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
                <div className="text-right hidden md:block">
                  <p className="text-[10px] uppercase font-black text-muted-foreground mb-1">
                    Created At
                  </p>
                  <p className="text-sm font-bold tabular-nums">
                    {new Date(req.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isViewing} onOpenChange={setIsRequestModalOpen}>
        <DialogContent className="max-w-3xl rounded-3xl p-0 overflow-hidden border-none shadow-2xl [&>button]:text-white/70 hover:[&>button]:text-white [&>button]:top-6 [&>button]:right-6">
          {selectedRequest && (
            <div className="flex flex-col h-full max-h-[90vh]">
              <div className={cn("p-6 text-white flex justify-between items-start", "bg-blue-600")}>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <DialogTitle className="text-xl font-bold tracking-tight">
                      {isEditing ? "Edit Request" : "Request Details"}
                    </DialogTitle>
                    {!isEditing && <StatusBadge status={selectedRequest.status} />}
                  </div>
                  <p className="text-white/70 text-sm font-mono font-bold tracking-widest">
                    {selectedRequest.requestNumber}
                  </p>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-8">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase font-black text-muted-foreground">
                      Department
                    </Label>
                    {isEditing ? (
                      <Input
                        value={selectedRequest.department}
                        onChange={(e) =>
                          setSelectedRequest({ ...selectedRequest, department: e.target.value })
                        }
                        className="h-9 rounded-xl text-sm"
                      />
                    ) : (
                      <p className="font-bold text-sm">{selectedRequest.department}</p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase font-black text-muted-foreground">
                      Required Date
                    </Label>
                    {isEditing ? (
                      <Input
                        type="date"
                        min={new Date().toISOString().split("T")[0]}
                        value={new Date(selectedRequest.requiredDate).toISOString().split("T")[0]}
                        onChange={(e) =>
                          setSelectedRequest({ ...selectedRequest, requiredDate: e.target.value })
                        }
                        className="h-9 rounded-xl text-sm font-mono"
                      />
                    ) : (
                      <p className="font-bold text-sm tabular-nums">
                        {new Date(selectedRequest.requiredDate).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase font-black text-muted-foreground">
                      Requested By
                    </Label>
                    <p className="font-bold text-sm">{selectedRequest.requestedBy}</p>
                  </div>
                  <div className="space-y-1 text-right">
                    <Label className="text-[10px] uppercase font-black text-muted-foreground">
                      Warehouse
                    </Label>
                    <p className="font-bold text-sm">{selectedRequest.warehouseId}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-[10px] uppercase font-black text-muted-foreground">
                      Requested Materials
                    </Label>
                    {isEditing && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 rounded-lg text-[10px] font-bold"
                        onClick={addEditItem}
                      >
                        <Plus className="size-3 mr-1" /> Add Item
                      </Button>
                    )}
                  </div>

                  <div className="rounded-2xl border border-border/60 overflow-hidden bg-muted/5">
                    <table className="w-full text-left text-sm border-collapse">
                      <thead>
                        <tr className="bg-muted/50 border-b border-border/60">
                          <th className="p-3 text-[10px] uppercase font-black text-muted-foreground">
                            Material Code
                          </th>
                          <th className="p-3 text-[10px] uppercase font-black text-muted-foreground">
                            Material Name
                          </th>
                          <th className="p-3 text-[10px] uppercase font-black text-muted-foreground w-20 text-center">
                            Qty
                          </th>
                          <th className="p-3 text-[10px] uppercase font-black text-muted-foreground w-24">
                            UOM
                          </th>
                          {isEditing && <th className="p-3 w-10"></th>}
                        </tr>
                      </thead>
                      <tbody>
                        {selectedRequest.items?.map((item: any, idx: number) => (
                          <tr
                            key={idx}
                            className="border-b border-border/40 last:border-0 hover:bg-muted/20 transition-colors"
                          >
                            <td className="p-3 font-mono text-xs font-bold text-primary">
                              {isEditing ? (
                                <Input
                                  value={item.materialCode}
                                  className="h-8 rounded-lg text-[10px] font-mono bg-muted/50"
                                  readOnly
                                />
                              ) : (
                                item.materialCode
                              )}
                            </td>
                            <td className="p-3">
                              {isEditing ? (
                                <Input
                                  value={item.materialName}
                                  onChange={(e) =>
                                    handleEditItemChange(idx, "materialName", e.target.value)
                                  }
                                  className="h-8 rounded-lg text-[10px]"
                                />
                              ) : (
                                <span className="font-medium text-foreground">
                                  {item.materialName}
                                </span>
                              )}
                            </td>
                            <td className="p-3 text-center">
                              {isEditing ? (
                                <Input
                                  type="number"
                                  min="1"
                                  step="1"
                                  value={Math.floor(item.quantity)}
                                  onChange={(e) =>
                                    handleEditItemChange(idx, "quantity", e.target.value)
                                  }
                                  className="h-8 rounded-lg text-[10px] text-center"
                                />
                              ) : (
                                <span className="font-bold text-orange-600 tabular-nums">
                                  {Math.floor(item.quantity)}
                                </span>
                              )}
                            </td>
                            <td className="p-3">
                              {isEditing ? (
                                <Select
                                  value={item.uom}
                                  onValueChange={(val) => handleEditItemChange(idx, "uom", val)}
                                >
                                  <SelectTrigger className="h-8 rounded-lg text-[10px] bg-background">
                                    <SelectValue placeholder="UOM" />
                                  </SelectTrigger>
                                  <SelectContent className="rounded-xl">
                                    {UOM_OPTIONS.map((uom) => (
                                      <SelectItem
                                        key={uom}
                                        value={uom}
                                        className="text-[10px] rounded-lg"
                                      >
                                        {uom}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              ) : (
                                <span className="text-[10px] font-black uppercase text-muted-foreground">
                                  {item.uom}
                                </span>
                              )}
                            </td>
                            {isEditing && (
                              <td className="p-2">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-8 rounded-lg text-destructive hover:bg-destructive/10 disabled:opacity-30 disabled:pointer-events-none"
                                  onClick={() => removeEditItem(idx)}
                                  disabled={selectedRequest.items.length <= 1}
                                >
                                  <Trash2 className="size-4" />
                                </Button>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-black text-muted-foreground">
                    Remarks / Justification
                  </Label>
                  {isEditing ? (
                    <Textarea
                      value={selectedRequest.remarks}
                      onChange={(e) =>
                        setSelectedRequest({ ...selectedRequest, remarks: e.target.value })
                      }
                      className="rounded-2xl min-h-[100px] text-sm"
                    />
                  ) : (
                    <p className="text-sm bg-muted/30 p-4 rounded-2xl italic text-muted-foreground border border-border/40 leading-relaxed">
                      {selectedRequest.remarks || "No remarks provided."}
                    </p>
                  )}
                </div>
              </div>

              <div className="p-6 bg-muted/10 border-t border-border/60 flex items-center justify-end">
                <div className="flex items-center gap-3">
                  {isEditing ? (
                    <>
                      <Button
                        variant="ghost"
                        className="rounded-2xl h-11 px-6 font-bold text-xs uppercase"
                        onClick={() => setIsEditing(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        className="rounded-full h-11 px-8 bg-blue-600 hover:bg-blue-700 shadow-glow font-bold text-xs uppercase"
                        onClick={handleUpdate}
                        disabled={submitting}
                      >
                        {submitting ? (
                          <Loader2 className="size-4 animate-spin mr-2" />
                        ) : (
                          <Save className="size-4 mr-2" />
                        )}
                        Update Request
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        variant="ghost"
                        className="rounded-2xl h-11 px-6 font-bold text-xs uppercase"
                        onClick={() => setIsRequestModalOpen(false)}
                      >
                        Close
                      </Button>
                      <Button
                        className="rounded-full h-11 px-8 bg-blue-600 hover:bg-blue-700 shadow-glow font-bold text-xs uppercase"
                        onClick={() => setIsEditing(true)}
                      >
                        Edit Request
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
