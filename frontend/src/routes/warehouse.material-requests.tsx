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
  component: () => <MaterialRequestsPage />,
});

const UOM_OPTIONS = ["PCS", "MTR", "KG", "LTR", "BOX", "PKT", "ROL", "SQM", "SET", "NOS"];

type MaterialRequestsPageProps = {
  mode?: "warehouse" | "assembly";
};

export function MaterialRequestsPage({ mode = "warehouse" }: MaterialRequestsPageProps) {
  const isAssembly = mode === "assembly";
  const [requests, setRequests] = useState<any[]>([]);
  const [materialStock, setMaterialStock] = useState<any[]>([]);
  const [materialCatalog, setMaterialCatalog] = useState<any[]>([]);
  const [masterLinked, setMasterLinked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [nextRequestNumber, setNextRequestNumber] = useState("");
  const [baseMaterialSequence, setBaseMaterialSequence] = useState(1);

  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [isViewing, setIsRequestModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    request_number: "",
    warehouse_id: "MAIN",
    department: isAssembly ? "Assembly" : "Inventory",
    requested_by: isAssembly ? "Assembly Manager" : "Warehouse Manager",
    required_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    remarks: "",
  });

  const [items, setItems] = useState<any[]>([
    {
      material_code: "",
      material_name: "",
      product_name: "",
      category: "",
      sub_category: "",
      price_range: "",
      quantity: 1,
      uom: "PCS",
      master_selected: false,
    },
  ]);
  const [activeCodeSearch, setActiveCodeSearch] = useState<number | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [data, stock, catalog, materialMaster] = await Promise.all([
        api.getMaterialRequests(),
        api.getMaterialStock(),
        api.getMaterialCatalog(),
        api.getMaterials(),
      ]);
      const masterByCode = new Map(
        materialMaster.map((material: any) => [material.code, material]),
      );
      // Filter for this warehouse's requests in a real app
      setRequests(
        isAssembly
          ? data.filter((request) => String(request.department).toLowerCase() === "assembly")
          : data,
      );
      setMaterialStock(stock);
      setMaterialCatalog(
        catalog
          .filter((material: any) => material.materialCode)
          .map((material: any) => ({
            ...masterByCode.get(material.materialCode),
            name: material.name,
            materialCode: material.materialCode,
            uom: String(material.uom || "NOS").toUpperCase(),
            masterCategory: String(material.category || "").replaceAll("_", " "),
            subCategory: String(
              material.subCategory ||
                (masterByCode.get(material.materialCode) as any)?.subCategory ||
                "",
            ),
            barcode: String(
              material.barcode || (masterByCode.get(material.materialCode) as any)?.barcode || "",
            ),
            minimumPrice:
              material.minimumPrice ??
              (masterByCode.get(material.materialCode) as any)?.minimumPrice,
            maximumPrice:
              material.maximumPrice ??
              (masterByCode.get(material.materialCode) as any)?.maximumPrice,
            currency: String(
              material.currency ||
                (masterByCode.get(material.materialCode) as any)?.currency ||
                "INR",
            ),
            reorderLevel: material.reorderLevel,
            materialType: String(material.category || "").replaceAll("_", " "),
            variants: [],
          })),
      );
      setMasterLinked(true);
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
      setFormData((prev) => ({
        ...prev,
        requested_by: user.username || (isAssembly ? "Assembly Manager" : "Warehouse Manager"),
      }));
    }
  }, []);

  useEffect(() => {
    if (!isViewing || !selectedRequest?.id || isEditing) return;

    const requestId = selectedRequest.id;
    const refreshSelectedRequest = async () => {
      try {
        const latestRequests = await api.getMaterialRequests();
        const latest = latestRequests.find((request: any) => request.id === requestId);
        if (!latest) return;
        setSelectedRequest(latest);
        setRequests(
          isAssembly
            ? latestRequests.filter(
                (request: any) => String(request.department).toLowerCase() === "assembly",
              )
            : latestRequests,
        );
      } catch {
        // Keep the last successful backend snapshot; the next poll retries.
      }
    };

    void refreshSelectedRequest();
    const timer = window.setInterval(() => void refreshSelectedRequest(), 3_000);
    return () => window.clearInterval(timer);
  }, [isAssembly, isEditing, isViewing, selectedRequest?.id]);

  const addItem = () => {
    setItems([
      ...items,
      {
        material_code: "",
        material_name: "",
        product_name: "",
        category: "",
        sub_category: "",
        price_range: "",
        quantity: 1,
        uom: "PCS",
        master_selected: false,
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

  const normalizeMaterialSearch = (value: string) =>
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
  const matchingMaterials = (value: string) => {
    const query = normalizeMaterialSearch(value);
    return materialCatalog
      .filter(
        (material: any) =>
          !query ||
          [
            material.materialCode,
            material.name,
            material.masterCategory,
            material.subCategory,
            material.barcode,
          ].some((field) => normalizeMaterialSearch(String(field || "")).includes(query)),
      )
      .slice(0, 8);
  };
  const selectMaterial = (idx: number, product: any) => {
    setItems((current) =>
      current.map((line, lineIndex) =>
        lineIndex === idx
          ? {
              ...line,
              material_code: product.materialCode,
              product_name: product.name,
              material_name: product.name,
              category: product.masterCategory || "",
              sub_category: product.subCategory || "",
              price_range:
                product.minimumPrice != null || product.maximumPrice != null
                  ? `${product.currency} ${Number(product.minimumPrice || 0).toLocaleString()} – ${product.currency} ${Number(product.maximumPrice || 0).toLocaleString()}`
                  : "",
              material_type: product.materialType || "",
              uom: product.uom || "PCS",
              master_selected: true,
            }
          : line,
      ),
    );
    setActiveCodeSearch(null);
  };

  const formatPriceRange = (product: any) => {
    if (!product || (product.minimumPrice == null && product.maximumPrice == null)) return "";
    const currency = product.currency || "INR";
    const symbol = currency === "INR" ? "₹" : currency;
    return `${symbol}${Number(product.minimumPrice || 0).toLocaleString()} – ${symbol}${Number(product.maximumPrice || 0).toLocaleString()}`;
  };

  const stockSummary = (materialCode: string) => {
    const records = materialStock.filter(
      (stock: any) => stock.materialCode === materialCode || stock.material_code === materialCode,
    );
    return records.reduce(
      (total: any, stock: any) => ({
        available: total.available + Number(stock.available || 0),
        reserved: total.reserved + Number(stock.allocated || 0),
        reorderLevel: Math.max(
          total.reorderLevel,
          Number(stock.reorderPoint || stock.reorder_point || 0),
        ),
      }),
      { available: 0, reserved: 0, reorderLevel: 0 },
    );
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
    const code = `MAT-${String(nextSeq).padStart(3, "0")}`;
    const newItem = { materialCode: code, materialName: "", quantity: 1, uom: "PCS" };
    setSelectedRequest({ ...selectedRequest, items: [...selectedRequest.items, newItem] });
  };

  const removeEditItem = (idx: number) => {
    if (!selectedRequest || selectedRequest.items.length <= 1) return;
    const newItems = selectedRequest.items.filter((_: any, i: number) => i !== idx);
    setSelectedRequest({ ...selectedRequest, items: newItems });
  };

  const submitRequest = async () => {
    if (!formData.remarks.trim()) {
      toast.error("Enter a reason or justification for this material request");
      return;
    }
    if (items.some((it) => !it.product_name?.trim() || !it.material_code?.trim() || !it.quantity)) {
      toast.error("Please select a material and quantity for all items");
      return;
    }
    if (items.some((it) => !it.master_selected)) {
      toast.error("Every item must be selected from Material Master");
      return;
    }
    if (
      items.some((it) => {
        const product = materialCatalog.find((entry) => entry.name === it.product_name);
        return product?.variants?.length > 0 && !it.category;
      })
    ) {
      toast.error("Please select a category/size for each material");
      return;
    }

    setSubmitting(true);
    try {
      await api.createMaterialRequest({
        ...formData,
        items: items
          .filter((item) => item.master_selected && item.quantity)
          .map((item) => ({
            material_code: item.material_code,
            material_name: item.material_name,
            quantity: item.quantity,
            uom: item.uom,
          })),
      });
      toast.success(
        isAssembly
          ? "Material request sent to Warehouse Manager"
          : "Material request submitted to Procurement",
      );
      setIsCreating(false);
      setItems([
        {
          material_code: "",
          material_name: "",
          product_name: "",
          category: "",
          price_range: "",
          quantity: 1,
          uom: "PCS",
        },
      ]);
      setFormData((prev) => ({ ...prev, request_number: "", remarks: "" }));
      fetchData();
    } catch (error: any) {
      toast.error(`Failed to submit request: ${error.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void submitRequest();
  };

  const startCreating = async () => {
    try {
      const { requestNumber, nextMaterialSequence } =
        (await api.getNextMaterialRequestNumber()) as any;
      setNextRequestNumber(requestNumber);
      setBaseMaterialSequence(nextMaterialSequence || 1);

      setFormData((prev) => ({ ...prev, request_number: requestNumber }));
      setItems([
        {
          material_code: "",
          material_name: "",
          product_name: "",
          category: "",
          sub_category: "",
          master_selected: false,
          price_range: "",
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

  const approveAndReserve = async () => {
    if (!selectedRequest) return;
    setSubmitting(true);
    try {
      const result = await api.processMaterialRequest(selectedRequest.id);
      const updated = {
        ...selectedRequest,
        status: result.status,
        approvedBy: result.approval?.approved_by,
        approvedAt: result.approval?.approved_at,
        pickTask: result.pick_task,
      };
      setSelectedRequest(updated);
      setRequests((current) =>
        current.map((request) => (request.id === updated.id ? updated : request)),
      );
      const inventory = result.inventory_updates?.[0];
      toast.success("Stock reserved and pick task created", {
        description: inventory
          ? `${inventory.material_name}: On Hand ${inventory.on_hand.toLocaleString()} · Allocated ${inventory.allocated.toLocaleString()} · Available ${inventory.available.toLocaleString()} ${inventory.uom}`
          : result.pick_task?.task_number,
      });
      const refreshedStock = await api.getMaterialStock();
      setMaterialStock(refreshedStock);
    } catch (error) {
      toast.error("Unable to approve material request", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppShell
      title={isAssembly ? "Assembly Material Requests" : "Warehouse Material Requests"}
      subtitle={
        isAssembly
          ? "Request production materials from the warehouse team"
          : "Request stocks and consumables from the procurement team"
      }
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
                    readOnly={isAssembly}
                    className={cn("rounded-xl", isAssembly && "bg-muted/50")}
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
                    Material Items{" "}
                    {masterLinked && (
                      <span className="ml-2 normal-case tracking-normal text-success">
                        · Linked to Material Master
                      </span>
                    )}
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
                    <div
                      key={idx}
                      className="grid items-start gap-x-3 gap-y-5 md:grid-cols-2 xl:grid-cols-[1fr_1.4fr_1.1fr_1fr_1.1fr_.65fr_.65fr_auto]"
                    >
                      <div className="relative min-w-0 space-y-1">
                        <Label className="text-[10px]">Material Code</Label>
                        <Input
                          value={item.material_code}
                          readOnly={item.master_selected}
                          onFocus={() => !item.master_selected && setActiveCodeSearch(idx)}
                          onBlur={() => setActiveCodeSearch(null)}
                          onChange={(event) => {
                            const code = event.target.value.toUpperCase();
                            const normalizedCode = normalizeMaterialSearch(code);
                            const exactMasterMatch = materialCatalog.find((product: any) =>
                              [product.materialCode, product.barcode].some(
                                (value) =>
                                  normalizeMaterialSearch(String(value || "")) === normalizedCode,
                              ),
                            );
                            if (exactMasterMatch) {
                              selectMaterial(idx, exactMasterMatch);
                              return;
                            }
                            let match: any = null;
                            for (const product of materialCatalog) {
                              const variant = product.variants?.find(
                                (entry: any) => entry.materialCode === code,
                              );
                              if (variant) {
                                match = { product, variant };
                                break;
                              }
                              if (
                                String(product.materialCode).trim().toUpperCase() === code.trim()
                              ) {
                                match = { product, variant: null };
                              }
                            }
                            setItems((current) =>
                              current.map((line, lineIndex) =>
                                lineIndex === idx
                                  ? {
                                      ...line,
                                      material_code: code,
                                      ...(match
                                        ? {
                                            product_name: match.product.name,
                                            category:
                                              match.variant?.category ||
                                              match.product.masterCategory ||
                                              "",
                                            sub_category: match.product.subCategory || "",
                                            material_name: match.variant
                                              ? `${match.product.name} - ${match.variant.category}`
                                              : match.product.name,
                                            price_range: match.variant
                                              ? `₹${match.variant.priceMin} - ₹${match.variant.priceMax}`
                                              : "",
                                            material_type: match.product.materialType || "",
                                            uom: match.product.uom || "PCS",
                                          }
                                        : {}),
                                    }
                                  : line,
                              ),
                            );
                          }}
                          autoComplete="off"
                          placeholder="Search MAT-001, 001 or 01"
                          aria-label="Material code"
                          className="h-9 rounded-lg font-mono text-xs"
                        />
                        {item.master_selected && (
                          <button
                            type="button"
                            className="absolute left-0 top-full mt-1 text-[10px] font-semibold text-primary"
                            onClick={() =>
                              setItems((current) =>
                                current.map((line, lineIndex) =>
                                  lineIndex === idx
                                    ? {
                                        ...line,
                                        material_code: "",
                                        material_name: "",
                                        product_name: "",
                                        category: "",
                                        sub_category: "",
                                        price_range: "",
                                        uom: "PCS",
                                        master_selected: false,
                                      }
                                    : line,
                                ),
                              )
                            }
                          >
                            Change material
                          </button>
                        )}
                        {activeCodeSearch === idx && (
                          <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-y-auto rounded-xl border border-border bg-popover p-1 shadow-lg">
                            {matchingMaterials(item.material_code).length ? (
                              matchingMaterials(item.material_code).map((material: any) => (
                                <button
                                  key={material.materialCode}
                                  type="button"
                                  onMouseDown={(event) => event.preventDefault()}
                                  onClick={() => selectMaterial(idx, material)}
                                  className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left hover:bg-muted"
                                >
                                  <span>
                                    <span className="block font-mono text-xs font-bold text-primary">
                                      {material.materialCode}
                                    </span>
                                    <span className="block text-xs text-muted-foreground">
                                      {material.name}
                                    </span>
                                  </span>
                                  <span className="shrink-0 text-[10px] text-muted-foreground">
                                    {material.masterCategory}
                                  </span>
                                </button>
                              ))
                            ) : (
                              <p className="px-3 py-3 text-xs text-muted-foreground">
                                No matching backend material.
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 space-y-1">
                        <Label className="text-[10px]">Material Name</Label>
                        <Input
                          value={item.product_name}
                          readOnly={item.master_selected}
                          onChange={(event) => {
                            const value = event.target.value;
                            const product = materialCatalog.find(
                              (entry) =>
                                entry.name.trim().toLowerCase() === value.trim().toLowerCase(),
                            );
                            setItems((current) =>
                              current.map((line, lineIndex) =>
                                lineIndex === idx
                                  ? {
                                      ...line,
                                      material_code: product?.materialCode || line.material_code,
                                      product_name: value,
                                      material_name: product?.name || value,
                                      category: product?.masterCategory || line.category,
                                      sub_category: product?.subCategory || line.sub_category,
                                      price_range: product ? "" : line.price_range,
                                      material_type: product?.materialType || line.material_type,
                                      uom: product?.uom || line.uom,
                                    }
                                  : line,
                              ),
                            );
                          }}
                          list={item.master_selected ? undefined : `material-names-${idx}`}
                          placeholder="Enter or select material"
                          aria-label="Material name"
                          className="h-9 rounded-lg text-xs"
                        />
                        <datalist id={`material-names-${idx}`}>
                          {materialCatalog.map((material) => (
                            <option key={material.materialCode} value={material.name}>
                              {material.materialCode}
                            </option>
                          ))}
                        </datalist>
                      </div>
                      <div className="min-w-0 space-y-1">
                        <Label className="text-[10px]">
                          Category {masterLinked ? "/ Type" : "/ Size"}
                        </Label>
                        <Select
                          disabled={
                            !materialCatalog.find((product) => product.name === item.product_name)
                              ?.variants?.length
                          }
                          value={item.category}
                          onValueChange={(value) => {
                            const product = materialCatalog.find(
                              (entry) => entry.name === item.product_name,
                            );
                            const variant = product?.variants?.find(
                              (entry: any) => entry.category === value,
                            );
                            setItems((current) =>
                              current.map((line, lineIndex) =>
                                lineIndex === idx
                                  ? {
                                      ...line,
                                      material_code: variant?.materialCode || line.material_code,
                                      category: value,
                                      material_name: `${line.product_name} - ${value}`,
                                      price_range: variant
                                        ? `₹${variant.priceMin} - ₹${variant.priceMax}`
                                        : "",
                                    }
                                  : line,
                              ),
                            );
                          }}
                        >
                          <SelectTrigger className="h-9 rounded-lg text-xs">
                            <SelectValue
                              placeholder={
                                masterLinked ? item.material_type || "From master" : "Select size"
                              }
                            />
                          </SelectTrigger>
                          <SelectContent>
                            {(
                              materialCatalog.find((product) => product.name === item.product_name)
                                ?.variants || []
                            ).map((variant: any) => (
                              <SelectItem key={variant.category} value={variant.category}>
                                {variant.category}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="min-w-0 space-y-1">
                        <Label className="text-[10px]">Sub Category</Label>
                        <Input
                          value={item.sub_category || ""}
                          readOnly
                          placeholder="From material master"
                          className="h-9 rounded-lg bg-muted/50 text-xs"
                        />
                      </div>
                      <div className="min-w-0 space-y-1">
                        <Label className="text-[10px]">Price Range</Label>
                        <Input
                          value={
                            item.price_range ||
                            formatPriceRange(
                              materialCatalog.find(
                                (material: any) => material.materialCode === item.material_code,
                              ),
                            )
                          }
                          readOnly
                          placeholder="Auto-filled"
                          className="h-9 rounded-lg bg-muted/50 text-xs"
                        />
                      </div>
                      <div className="min-w-0 space-y-1">
                        <Label className="text-[10px]">Required Quantity</Label>
                        <Input
                          type="number"
                          min="1"
                          className="h-9 rounded-lg text-xs"
                          value={item.quantity}
                          onChange={(e) => handleItemChange(idx, "quantity", e.target.value)}
                        />
                      </div>
                      <div className="min-w-0 space-y-1">
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
                        className="mt-[18px] size-9 rounded-lg text-destructive disabled:pointer-events-none disabled:opacity-30"
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
                <Label>Remarks / Justification *</Label>
                <Textarea
                  required
                  placeholder="Example: Required for production activity scheduled for September."
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

      {/* View/Edit Modal */}
      <Dialog open={isViewing} onOpenChange={setIsRequestModalOpen}>
        <DialogContent className="max-w-3xl rounded-3xl p-0 overflow-hidden border-none shadow-2xl [&>button]:text-white/70 hover:[&>button]:text-white [&>button]:top-6 [&>button]:right-6">
          {selectedRequest && (
            <div className="flex flex-col h-full max-h-[90vh]">
              {/* Header */}
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

              {/* Scrollable Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-8">
                {/* Basic Info */}
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

                {/* Items Table */}
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

                {/* Remarks */}
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
                {!isEditing && (
                  <div className="rounded-2xl border bg-muted/20 p-4">
                    <Label className="text-[10px] uppercase font-black text-muted-foreground">
                      Outbound Workflow
                    </Label>
                    <div className="mt-3 grid gap-2 sm:grid-cols-5">
                      {[
                        "Material Request",
                        "Approval",
                        "Stock Check",
                        "Reservation",
                        "Pick Task",
                      ].map((step, index) => {
                        const requestProcessed = selectedRequest.status !== "PENDING";
                        const complete =
                          index === 0 ||
                          (requestProcessed && index < 4) ||
                          (index === 4 && Boolean(selectedRequest.pickTask));
                        return (
                          <div
                            key={step}
                            className={cn(
                              "rounded-xl border p-3 text-center text-xs font-bold",
                              complete
                                ? "border-success/30 bg-success-soft text-success"
                                : "bg-background text-muted-foreground",
                            )}
                          >
                            {complete && <CheckCircle2 className="mx-auto mb-1 size-4" />}
                            {step}
                          </div>
                        );
                      })}
                    </div>
                    {selectedRequest.pickTask && (
                      <div className="mt-3 rounded-xl border border-success/30 bg-background p-3 text-sm">
                        <p className="font-mono font-bold text-success">
                          {selectedRequest.pickTask.task_number}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Status: {selectedRequest.pickTask.status} ·{" "}
                          {selectedRequest.pickTask.status === "ISSUED"
                            ? `Material issued to ${selectedRequest.department}`
                            : selectedRequest.pickTask.status === "COMPLETED"
                              ? "Picking complete; awaiting material issue"
                              : selectedRequest.pickTask.status === "IN_PROGRESS"
                                ? "Warehouse picking in progress"
                                : selectedRequest.pickTask.status === "ASSIGNED"
                                  ? "Assigned to a warehouse operator"
                                  : `Stock reserved for ${selectedRequest.department}`}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Footer Actions */}
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
                      {!isAssembly && selectedRequest.status === "PENDING" && (
                        <Button
                          variant="outline"
                          className="rounded-full h-11 px-6 font-bold text-xs uppercase"
                          onClick={() => setIsEditing(true)}
                        >
                          Edit Request
                        </Button>
                      )}
                      {selectedRequest.status === "PENDING" && (
                        <Button
                          className="rounded-full h-11 px-8 bg-blue-600 hover:bg-blue-700 shadow-glow font-bold text-xs uppercase"
                          onClick={() => void approveAndReserve()}
                          disabled={submitting}
                        >
                          {submitting ? (
                            <Loader2 className="mr-2 size-4 animate-spin" />
                          ) : (
                            <CheckCircle2 className="mr-2 size-4" />
                          )}{" "}
                          Approve & Reserve
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
