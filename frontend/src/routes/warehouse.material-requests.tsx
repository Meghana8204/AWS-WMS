import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
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
  Check,
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api-client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
export const Route = createFileRoute("/warehouse/material-requests")({
  component: WarehouseMaterialRequests,
});
const UOM_OPTIONS = [
  "PCS",
  "MTR",
  "KG",
  "LTR",
  "BOX",
  "PKT",
  "ROL",
  "SQM",
  "SET",
  "NOS",
  "TON",
  "BUNDLE",
];

function MaterialMasterSearchCombobox({
  value,
  onSelect,
  masterMaterials,
  placeholder = "Pick Material Master",
  className,
  size = "md",
}: {
  value: string;
  onSelect: (val: string) => void;
  masterMaterials: any[];
  placeholder?: string;
  className?: string;
  size?: "sm" | "md";
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const selectedMaterial = masterMaterials.find(
    (m) => m.id === value || m.material_code === value,
  );

  const filteredMaterials = useMemo(() => {
    if (!search.trim()) return masterMaterials;
    const q = search.toLowerCase();
    return masterMaterials.filter(
      (m) =>
        m.material_code?.toLowerCase().includes(q) ||
        m.material_name?.toLowerCase().includes(q) ||
        m.category?.toLowerCase().includes(q) ||
        m.variants?.some(
          (v: any) =>
            v.variant_code?.toLowerCase().includes(q) ||
            v.size?.toLowerCase().includes(q) ||
            v.color?.toLowerCase().includes(q) ||
            v.grade?.toLowerCase().includes(q),
        ),
    );
  }, [masterMaterials, search]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between rounded-xl font-normal text-xs bg-background hover:bg-accent/40 border-input",
            size === "sm" ? "h-9 px-2.5" : "h-9 px-3",
            className,
          )}
        >
          <div className="flex items-center gap-1.5 truncate text-left mr-1 min-w-0">
            {selectedMaterial ? (
              <>
                <span className="font-mono font-bold text-primary shrink-0">
                  {selectedMaterial.material_code}
                </span>
                <span className="text-muted-foreground shrink-0">—</span>
                <span className="truncate">{selectedMaterial.material_name}</span>
              </>
            ) : value === "CUSTOM" ? (
              <span className="text-muted-foreground italic truncate">Manual / Custom Item</span>
            ) : (
              <span className="text-muted-foreground truncate">{placeholder}</span>
            )}
          </div>
          <Search className="size-3.5 shrink-0 opacity-50 ml-1" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[320px] sm:w-[350px] p-0 rounded-2xl shadow-xl border border-border/80 bg-popover overflow-hidden z-[100]"
        align="start"
      >
        <div className="flex items-center border-b border-border/60 px-3 py-2.5 bg-muted/20">
          <Search className="size-4 shrink-0 text-muted-foreground mr-2" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search code, name, specs..."
            className="w-full bg-transparent text-xs outline-none placeholder:text-muted-foreground/70"
            autoFocus
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="text-muted-foreground hover:text-foreground text-xs px-1"
            >
              ×
            </button>
          )}
        </div>
        <div className="max-h-[250px] overflow-y-auto p-1.5 divide-y divide-border/20">
          <div className="pb-1">
            <button
              type="button"
              className={cn(
                "w-full flex items-center justify-between px-3 py-2 text-xs rounded-xl text-left transition-colors",
                value === "CUSTOM" || !value
                  ? "bg-primary/10 text-primary font-bold"
                  : "hover:bg-muted text-muted-foreground italic",
              )}
              onClick={() => {
                onSelect("CUSTOM");
                setOpen(false);
                setSearch("");
              }}
            >
              <span>Manual / Custom Item</span>
              {(value === "CUSTOM" || !value) && <Check className="size-3.5 text-primary" />}
            </button>
          </div>

          <div className="pt-1 space-y-0.5">
            {filteredMaterials.length === 0 ? (
              <div className="p-4 text-center text-xs text-muted-foreground">
                No materials matching "{search}"
              </div>
            ) : (
              filteredMaterials.map((m) => {
                const isSelected = selectedMaterial?.id === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    className={cn(
                      "w-full flex items-center justify-between px-3 py-2 text-xs rounded-xl text-left transition-colors",
                      isSelected
                        ? "bg-primary/10 text-primary font-bold"
                        : "hover:bg-muted text-foreground",
                    )}
                    onClick={() => {
                      onSelect(m.id);
                      setOpen(false);
                      setSearch("");
                    }}
                  >
                    <div className="flex flex-col gap-0.5 min-w-0 pr-2">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-bold text-primary">
                          {m.material_code}
                        </span>
                        <span className="font-medium text-foreground truncate">
                          {m.material_name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                        {m.category && (
                          <span className="bg-muted px-1.5 py-0.5 rounded border border-border/50">
                            {m.category}
                          </span>
                        )}
                        {m.variants && m.variants.length > 0 && (
                          <span>
                            {m.variants.length} variant{m.variants.length > 1 ? "s" : ""}
                          </span>
                        )}
                        {m.base_uom && <span>• {m.base_uom}</span>}
                      </div>
                    </div>
                    {isSelected && <Check className="size-4 text-primary shrink-0" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
function WarehouseMaterialRequests() {
  const [requests, setRequests] = useState<any[]>([]);
  const [masterMaterials, setMasterMaterials] = useState<any[]>([]);
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
        api.getMaterialRequests(),
        api.getMaterials({ status: "Active" }).catch(() => []),
      ]);
      setRequests(reqData);
      setMasterMaterials(matData);
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
    const code = `MAT-${String(nextSeq).padStart(3, "0")}`;
    setItems([
      ...items,
      {
        material_id: "",
        material_variant_id: "",
        material_code: code,
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
  const handleItemChange = (idx: number, field: string, value: any) => {
    setItems(items.map((it, i) => (i === idx ? { ...it, [field]: value } : it)));
  };
  const handleSelectMasterMaterial = (idx: number, matId: string) => {
    const foundMat = masterMaterials.find((m) => m.id === matId);
    if (!foundMat) return;
    const defaultVariant =
      foundMat.variants && foundMat.variants.length > 0 ? foundMat.variants[0] : null;
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
  const handleSelectVariant = (idx: number, variantId: string) => {
    const currentItem = items[idx];
    const foundMat = masterMaterials.find((m) => m.id === currentItem.material_id);
    if (!foundMat) return;
    const foundVar = foundMat.variants?.find((v: any) => v.id === variantId);
    if (!foundVar) return;
    const specDetails = [foundVar.size, foundVar.color, foundVar.grade].filter(Boolean).join(", ");
    const nameWithSpec = specDetails
      ? `${foundMat.material_name} (${specDetails})`
      : foundMat.material_name;

    setItems(
      items.map((it, i) =>
        i === idx
          ? {
              ...it,
              material_variant_id: foundVar.id,
              variant_code: foundVar.variant_code,
              material_name: nameWithSpec,
              uom: foundVar.uom || foundMat.base_uom || "PCS",
            }
          : it,
      ),
    );
  };
  const handleEditItemChange = (idx: number, field: string, value: any) => {
    if (!selectedRequest) return;
    const newItems = [...selectedRequest.items];
    newItems[idx] = { ...newItems[idx], [field]: value };
    setSelectedRequest({ ...selectedRequest, items: newItems });
  };
  const handleEditSelectMasterMaterial = (idx: number, matId: string) => {
    if (!selectedRequest) return;
    const newItems = [...selectedRequest.items];
    if (matId === "CUSTOM") {
      newItems[idx] = {
        ...newItems[idx],
        materialId: "",
        materialVariantId: "",
        variantCode: "",
      };
      setSelectedRequest({ ...selectedRequest, items: newItems });
      return;
    }
    const foundMat = masterMaterials.find((m) => m.id === matId);
    if (!foundMat) return;
    const defaultVariant =
      foundMat.variants && foundMat.variants.length > 0 ? foundMat.variants[0] : null;
    const specDetails = defaultVariant
      ? [defaultVariant.size, defaultVariant.color, defaultVariant.grade].filter(Boolean).join(", ")
      : "";
    const nameWithSpec = specDetails
      ? `${foundMat.material_name} (${specDetails})`
      : foundMat.material_name;

    newItems[idx] = {
      ...newItems[idx],
      materialId: foundMat.id,
      materialVariantId: defaultVariant?.id || "",
      materialCode: foundMat.material_code,
      variantCode: defaultVariant?.variant_code || "",
      materialName: nameWithSpec,
      uom: defaultVariant?.uom || foundMat.base_uom || "PCS",
    };
    setSelectedRequest({ ...selectedRequest, items: newItems });
  };
  const handleEditSelectVariant = (idx: number, variantId: string) => {
    if (!selectedRequest) return;
    const newItems = [...selectedRequest.items];
    const currentItem = newItems[idx];
    const foundMat = masterMaterials.find(
      (m) => m.id === currentItem.materialId || m.material_code === currentItem.materialCode,
    );
    if (!foundMat) return;
    const foundVar = foundMat.variants?.find((v: any) => v.id === variantId);
    if (!foundVar) return;
    const specDetails = [foundVar.size, foundVar.color, foundVar.grade].filter(Boolean).join(", ");
    const nameWithSpec = specDetails
      ? `${foundMat.material_name} (${specDetails})`
      : foundMat.material_name;

    newItems[idx] = {
      ...newItems[idx],
      materialVariantId: foundVar.id,
      variantCode: foundVar.variant_code,
      materialName: nameWithSpec,
      uom: foundVar.uom || foundMat.base_uom || "PCS",
    };
    setSelectedRequest({ ...selectedRequest, items: newItems });
  };
  const addEditItem = () => {
    if (!selectedRequest) return;
    const nextSeq = baseMaterialSequence + selectedRequest.items.length;
    const code = `MAT-${String(nextSeq).padStart(3, "0")}`;
    const newItem = {
      materialId: "",
      materialVariantId: "",
      materialCode: code,
      variantCode: "",
      materialName: "",
      quantity: 1,
      uom: "PCS",
    };
    setSelectedRequest({ ...selectedRequest, items: [...selectedRequest.items, newItem] });
  };
  const removeEditItem = (idx: number) => {
    if (!selectedRequest || selectedRequest.items.length <= 1) return;
    const newItems = selectedRequest.items.filter((_: any, i: number) => i !== idx);
    setSelectedRequest({ ...selectedRequest, items: newItems });
  };
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!items || items.length === 0) {
      toast.error("Please add at least one material item");
      return;
    }
    if (items.some((it) => !it.material_name?.trim())) {
      toast.error("Please fill in material description for all items");
      return;
    }
    if (items.some((it) => !it.quantity || parseFloat(it.quantity) <= 0 || isNaN(parseFloat(it.quantity)))) {
      toast.error("Quantity must be strictly greater than 0 for all items");
      return;
    }
    setSubmitting(true);
    try {
      await api.createMaterialRequest({ ...formData, items });
      toast.success("Material request submitted to Procurement");
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
      setFormData((prev) => ({ ...prev, request_number: "" }));
      fetchData();
    } catch (error: any) {
      toast.error("Failed to submit request: " + (error.message || "Unknown error"));
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
      const initialCode = `MAT-${String(nextMaterialSequence || 1).padStart(3, "0")}`;
      setFormData((prev) => ({ ...prev, request_number: requestNumber }));
      setItems([
        {
          material_id: "",
          material_variant_id: "",
          material_code: initialCode,
          variant_code: "",
          material_name: "",
          quantity: 1,
          uom: "PCS",
        },
      ]);
      setIsCreating(true);
    } catch (error) {
      toast.error("Failed to generate request number");
    }
  };
  const handleRequestClick = (req: any) => {
    const rawReq = JSON.parse(JSON.stringify(req));
    const normalizedItems = (rawReq.items || []).map((it: any) => {
      const matId =
        it.materialId ||
        it.material_id ||
        masterMaterials.find((m) => m.material_code === (it.materialCode || it.material_code))?.id ||
        "";
      const foundMat = masterMaterials.find(
        (m) => m.id === matId || m.material_code === (it.materialCode || it.material_code),
      );
      const varId =
        it.materialVariantId ||
        it.material_variant_id ||
        foundMat?.variants?.find(
          (v: any) => v.variant_code === (it.variantCode || it.variant_code),
        )?.id ||
        "";
      return {
        materialId: matId,
        materialVariantId: varId,
        materialCode: it.materialCode || it.material_code || "",
        variantCode: it.variantCode || it.variant_code || "",
        materialName: it.materialName || it.material_name || "",
        quantity: it.quantity,
        uom: it.uom || "PCS",
      };
    });
    setSelectedRequest({
      ...rawReq,
      items: normalizedItems,
    });
    setIsRequestModalOpen(true);
    setIsEditing(false);
  };
  const handleUpdate = async () => {
    if (!selectedRequest) return;
    if (!selectedRequest.items || selectedRequest.items.length === 0) {
      toast.error("Please add at least one material item");
      return;
    }
    if (
      selectedRequest.items.some(
        (it: any) => !(it.materialName || it.material_name)?.trim(),
      )
    ) {
      toast.error("Please fill in material description for all items");
      return;
    }
    if (
      selectedRequest.items.some(
        (it: any) => !it.quantity || parseFloat(it.quantity) <= 0 || isNaN(parseFloat(it.quantity)),
      )
    ) {
      toast.error("Quantity must be strictly greater than 0 for all items");
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        request_number: selectedRequest.requestNumber || selectedRequest.request_number,
        warehouse_id: selectedRequest.warehouseId || selectedRequest.warehouse_id,
        department: selectedRequest.department,
        requested_by: selectedRequest.requestedBy || selectedRequest.requested_by,
        required_date: new Date(selectedRequest.requiredDate || selectedRequest.required_date)
          .toISOString()
          .split("T")[0],
        remarks: selectedRequest.remarks,
        items: selectedRequest.items.map((it: any) => ({
          material_id: it.materialId || it.material_id || null,
          material_variant_id: it.materialVariantId || it.material_variant_id || null,
          material_code: it.materialCode || it.material_code,
          variant_code: it.variantCode || it.variant_code,
          material_name: it.materialName || it.material_name,
          quantity: parseFloat(it.quantity) || 1,
          uom: it.uom,
        })),
      };
      await api.updateMaterialRequest(selectedRequest.id, payload);
      toast.success("Request updated successfully");
      setIsEditing(false);
      setIsRequestModalOpen(false);
      fetchData();
    } catch (error: any) {
      toast.error("Update failed: " + (error.message || "Unknown error"));
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

                <div className="space-y-3">
                  {items.map((item, idx) => {
                    const selectedMat = masterMaterials.find((m) => m.id === item.material_id);
                    return (
                      <div
                        key={idx}
                        className="flex flex-col sm:flex-row gap-3 items-end p-3 rounded-xl border border-border/60 bg-muted/10"
                      >
                        {masterMaterials.length > 0 && (
                          <div className="w-full sm:w-60 space-y-1">
                            <Label className="text-[10px] font-bold">Select Material Master</Label>
                            <MaterialMasterSearchCombobox
                              value={item.material_id || "CUSTOM"}
                              onSelect={(val) => {
                                if (val === "CUSTOM") {
                                  setItems(
                                    items.map((it, i) =>
                                      i === idx
                                        ? {
                                            ...it,
                                            material_id: "",
                                            material_variant_id: "",
                                            variant_code: "",
                                          }
                                        : it,
                                    ),
                                  );
                                } else {
                                  handleSelectMasterMaterial(idx, val);
                                }
                              }}
                              masterMaterials={masterMaterials}
                            />
                          </div>
                        )}

                        {selectedMat && selectedMat.variants && selectedMat.variants.length > 0 && (
                          <div className="w-full sm:w-48 space-y-1">
                            <Label className="text-[10px] font-bold text-teal-600">
                              Select Variant
                            </Label>
                            <Select
                              value={item.material_variant_id || selectedMat.variants[0]?.id}
                              onValueChange={(val) => handleSelectVariant(idx, val)}
                            >
                              <SelectTrigger className="h-9 rounded-lg text-xs bg-background border-teal-500/30">
                                <SelectValue placeholder="Select Variant" />
                              </SelectTrigger>
                              <SelectContent className="rounded-xl">
                                {selectedMat.variants.map((v: any) => {
                                  const spec = [v.size, v.color, v.grade]
                                    .filter(Boolean)
                                    .join(" · ");
                                  return (
                                    <SelectItem key={v.id} value={v.id} className="text-xs">
                                      <span className="font-mono font-bold">{v.variant_code}</span>{" "}
                                      {spec && `(${spec})`}
                                    </SelectItem>
                                  );
                                })}
                              </SelectContent>
                            </Select>
                          </div>
                        )}

                        <div className="flex-1 space-y-1 w-full">
                          <Label className="text-[10px]">Material Description</Label>
                          <Input
                            placeholder="e.g. Wire 1.5mm Red PVC..."
                            className="h-9 rounded-lg text-xs bg-background"
                            value={item.material_name}
                            onChange={(e) => handleItemChange(idx, "material_name", e.target.value)}
                          />
                        </div>

                        <div className="w-20 space-y-1">
                          <Label className="text-[10px]">Qty</Label>
                          <Input
                            type="number"
                            min="1"
                            className="h-9 rounded-lg text-xs bg-background text-center"
                            value={item.quantity}
                            onChange={(e) => handleItemChange(idx, "quantity", e.target.value)}
                          />
                        </div>

                        <div className="w-24 space-y-1">
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
                          className="size-9 rounded-lg text-destructive disabled:opacity-30 disabled:pointer-events-none shrink-0"
                          onClick={() => removeItem(idx)}
                          disabled={items.length === 1}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    );
                  })}
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
        <DialogContent className="max-w-4xl w-full rounded-3xl p-0 overflow-hidden border-none shadow-2xl [&>button]:text-white/70 hover:[&>button]:text-white [&>button]:top-6 [&>button]:right-6">
          {selectedRequest && (
            <div className="flex flex-col h-full max-h-[90vh] w-full min-w-0 overflow-hidden">
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

              <div className="flex-1 overflow-y-auto p-6 space-y-6 w-full min-w-0">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-2xl bg-muted/20 border border-border/40">
                  <div className="space-y-1 min-w-0">
                    <Label className="text-[10px] uppercase font-black text-muted-foreground">
                      Department
                    </Label>
                    {isEditing ? (
                      <Input
                        value={selectedRequest.department}
                        onChange={(e) =>
                          setSelectedRequest({ ...selectedRequest, department: e.target.value })
                        }
                        className="h-9 rounded-xl text-sm bg-background w-full min-w-0"
                      />
                    ) : (
                      <p className="font-bold text-sm truncate">{selectedRequest.department}</p>
                    )}
                  </div>
                  <div className="space-y-1 min-w-0">
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
                        className="h-9 rounded-xl text-sm font-mono bg-background w-full min-w-0"
                      />
                    ) : (
                      <p className="font-bold text-sm tabular-nums">
                        {new Date(selectedRequest.requiredDate).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <div className="space-y-1 min-w-0">
                    <Label className="text-[10px] uppercase font-black text-muted-foreground">
                      Requested By
                    </Label>
                    <p className="font-bold text-sm truncate">{selectedRequest.requestedBy}</p>
                  </div>
                  <div className="space-y-1 min-w-0 sm:text-right">
                    <Label className="text-[10px] uppercase font-black text-muted-foreground">
                      Warehouse
                    </Label>
                    <p className="font-bold text-sm truncate">{selectedRequest.warehouseId}</p>
                  </div>
                </div>

                <div className="space-y-3">
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

                  <div className="rounded-2xl border border-border/60 overflow-hidden bg-muted/5 shadow-inner">
                    <table className="w-full table-fixed text-left text-sm border-collapse">
                      <colgroup>
                        <col className="w-[23%]" />
                        <col className="w-[27%]" />
                        <col className="w-[28%]" />
                        <col className="w-[10%]" />
                        <col className="w-[12%]" />
                        {isEditing && <col className="w-10" />}
                      </colgroup>
                      <thead>
                        <tr className="bg-muted/50 border-b border-border/60">
                          <th className="p-3 text-[10px] uppercase font-black text-muted-foreground truncate">
                            Material Code
                          </th>
                          <th className="p-3 text-[10px] uppercase font-black text-muted-foreground truncate">
                            Variant Code
                          </th>
                          <th className="p-3 text-[10px] uppercase font-black text-muted-foreground truncate">
                            Material Name & Specs
                          </th>
                          <th className="p-3 text-[10px] uppercase font-black text-muted-foreground text-center truncate">
                            Qty
                          </th>
                          <th className="p-3 text-[10px] uppercase font-black text-muted-foreground truncate">
                            UOM
                          </th>
                          {isEditing && <th className="p-3 text-right"></th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                        {selectedRequest.items?.map((item: any, idx: number) => {
                          const selectedMat = masterMaterials.find(
                            (m) =>
                              m.id === item.materialId ||
                              m.material_code === (item.materialCode || item.material_code),
                          );
                          const currentMaterialId =
                            item.materialId || selectedMat?.id || "CUSTOM";
                          const hasVariants =
                            selectedMat &&
                            selectedMat.variants &&
                            selectedMat.variants.length > 0;
                          const currentVariantId =
                            item.materialVariantId ||
                            selectedMat?.variants?.find(
                              (v: any) =>
                                v.variant_code ===
                                (item.variantCode || item.variant_code),
                            )?.id ||
                            selectedMat?.variants?.[0]?.id ||
                            "";

                          return (
                            <tr key={idx} className="hover:bg-muted/20 transition-colors">
                              <td className="p-2.5 min-w-0 overflow-hidden">
                                {isEditing ? (
                                  <MaterialMasterSearchCombobox
                                    value={currentMaterialId}
                                    onSelect={(val) =>
                                      handleEditSelectMasterMaterial(idx, val)
                                    }
                                    masterMaterials={masterMaterials}
                                    size="sm"
                                  />
                                ) : (
                                  <span className="font-mono font-bold text-xs text-primary truncate block">
                                    {item.materialCode || item.material_code}
                                  </span>
                                )}
                              </td>
                              <td className="p-2.5 min-w-0 overflow-hidden">
                                {isEditing ? (
                                  hasVariants ? (
                                    <Select
                                      value={currentVariantId}
                                      onValueChange={(val) =>
                                        handleEditSelectVariant(idx, val)
                                      }
                                    >
                                      <SelectTrigger className="h-9 rounded-xl text-xs bg-background border-teal-500/30 text-teal-700 font-semibold font-mono w-full min-w-0 truncate [&>span]:truncate [&>span]:block">
                                        <SelectValue placeholder="Select Variant" />
                                      </SelectTrigger>
                                      <SelectContent className="rounded-xl max-h-60">
                                        {selectedMat.variants.map((v: any) => {
                                          const spec = [v.size, v.color, v.grade]
                                            .filter(Boolean)
                                            .join(" · ");
                                          return (
                                            <SelectItem
                                              key={v.id}
                                              value={v.id}
                                              className="text-xs"
                                            >
                                              <span className="font-mono font-bold text-teal-700">
                                                {v.variant_code}
                                              </span>{" "}
                                              {spec && `(${spec})`}
                                            </SelectItem>
                                          );
                                        })}
                                      </SelectContent>
                                    </Select>
                                  ) : (
                                    <Input
                                      value={item.variantCode || item.variant_code || ""}
                                      placeholder="Variant Code"
                                      onChange={(e) =>
                                        handleEditItemChange(idx, "variantCode", e.target.value)
                                      }
                                      className="h-9 text-xs font-mono w-full min-w-0 bg-background rounded-xl"
                                    />
                                  )
                                ) : (
                                  <span className="font-mono text-xs text-teal-600 font-semibold truncate block">
                                    {item.variantCode || item.variant_code || "—"}
                                  </span>
                                )}
                              </td>
                              <td className="p-2.5 min-w-0 overflow-hidden">
                                {isEditing ? (
                                  <Input
                                    value={item.materialName || item.material_name || ""}
                                    placeholder="Material Name / Specification"
                                    onChange={(e) =>
                                      handleEditItemChange(
                                        idx,
                                        "materialName",
                                        e.target.value,
                                      )
                                    }
                                    className="h-9 text-xs bg-background rounded-xl w-full min-w-0"
                                  />
                                ) : (
                                  <span className="text-xs font-medium truncate block">
                                    {item.materialName || item.material_name}
                                  </span>
                                )}
                              </td>
                              <td className="p-2.5 min-w-0 overflow-hidden text-center">
                                {isEditing ? (
                                  <Input
                                    type="number"
                                    min="1"
                                    step="any"
                                    value={item.quantity}
                                    onChange={(e) =>
                                      handleEditItemChange(
                                        idx,
                                        "quantity",
                                        e.target.value,
                                      )
                                    }
                                    className="h-9 text-xs text-center bg-background rounded-xl w-full min-w-0"
                                  />
                                ) : (
                                  <span className="font-bold text-xs text-center block">
                                    {item.quantity}
                                  </span>
                                )}
                              </td>
                              <td className="p-2.5 min-w-0 overflow-hidden">
                                {isEditing ? (
                                  <Select
                                    value={item.uom}
                                    onValueChange={(val) =>
                                      handleEditItemChange(idx, "uom", val)
                                    }
                                  >
                                    <SelectTrigger className="h-9 text-xs bg-background rounded-xl w-full min-w-0">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl">
                                      {UOM_OPTIONS.map((uom) => (
                                        <SelectItem
                                          key={uom}
                                          value={uom}
                                          className="text-xs rounded-lg"
                                        >
                                          {uom}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                ) : (
                                  <span className="text-muted-foreground font-mono text-xs block">
                                    {item.uom}
                                  </span>
                                )}
                              </td>
                              {isEditing && (
                                <td className="p-2.5 text-center min-w-0">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="size-8 rounded-lg text-destructive hover:bg-destructive/10"
                                    onClick={() => removeEditItem(idx)}
                                    disabled={selectedRequest.items.length <= 1}
                                  >
                                    <Trash2 className="size-4" />
                                  </Button>
                                </td>
                              )}
                            </tr>
                          );
                        })}
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
                      {selectedRequest.status?.toUpperCase() === "PENDING" ? (
                        <Button
                          className="rounded-full h-11 px-8 bg-blue-600 hover:bg-blue-700 shadow-glow font-bold text-xs uppercase"
                          onClick={() => setIsEditing(true)}
                        >
                          Edit Request
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          disabled
                          className="rounded-full h-11 px-6 font-bold text-xs uppercase opacity-60 cursor-not-allowed"
                        >
                          {selectedRequest.status} (Locked)
                        </Button>
                      )}
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
