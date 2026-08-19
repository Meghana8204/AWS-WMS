import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  Save,
  Calendar as CalendarIcon,
  Building2,
  User,
  FileText,
  Loader2,
  CheckCircle2,
  Search,
  Plus,
  Trash2,
  Package,
  Sparkles
} from "lucide-react";
import { AppShell } from "@/components/wms/app-shell";
import { SectionCard } from "@/components/wms/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/procurement/new-rfq")({
  component: NewRfq,
});

const inputClass = "mt-1.5 h-11 rounded-xl border-border/80 bg-background";

function NewRfq() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [selectedSuppliers, setSelectedSuppliers] = useState<string[]>([]);
  const [loadingSuppliers, setLoadingSuppliers] = useState(true);
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  const [filters, setFilters] = useState({
    search: "",
    category: "",
    material: "",
    city: "",
  });

  const [formData, setFormData] = useState({
    rfq_date: new Date().toISOString().split("T")[0],
    material_request_number: "",
    required_delivery_date: "",
    warehouse: "Main Warehouse",
    procurement_officer: "",
    remarks: "",
  });

  const generateRandomCode = () => `MAT-${Math.floor(100000 + Math.random() * 900000)}`;

  const [items, setItems] = useState<any[]>([
    {
      material_code: generateRandomCode(),
      material_name: "",
      category: "Raw Materials",
      quantity: 1,
      uom: "PCS",
      special_requirements: "",
    }
  ]);

  const addItem = () => {
    setItems((prev) => [
      ...prev,
      {
        material_code: generateRandomCode(),
        material_name: "",
        category: "Raw Materials",
        quantity: 1,
        uom: "PCS",
        special_requirements: "",
      },
    ]);
  };

  const removeItem = (index: number) => {
    if (items.length === 1) {
      toast.error("At least one material requirement is required");
      return;
    }
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  };

  useEffect(() => {
    async function fetchSuppliers() {
      try {
        setLoadingSuppliers(true);
        const data = await api.getSuppliers({ ...filters, status: "Active" });
        // Keep the RFQ invitation list safe even if an older backend ignores
        // the status query parameter.
        setSuppliers(data.filter((supplier: any) =>
          String(supplier.status ?? "").trim().toLowerCase() === "active"
        ));
      } catch (err) {
        toast.error("Failed to load suppliers");
      } finally {
        setLoadingSuppliers(false);
      }
    }
    const debounceTimer = setTimeout(() => {
      fetchSuppliers();
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [filters]);

  useEffect(() => {
    // Fetch available supplier categories for the filter
    const fetchCategories = async () => {
      try {
        const cats = await api.getSupplierCategories();
        if (cats.length > 0) {
          setAvailableCategories(cats.map((c: any) => c.name));
        } else {
          // Fallback if no categories in DB yet
          setAvailableCategories(["Raw Materials", "Components", "Services", "Hardware"]);
        }
      } catch (e) {
        console.warn("Failed to fetch supplier categories", e);
        setAvailableCategories(["Raw Materials", "Components", "Services", "Hardware"]);
      }
    };
    fetchCategories();

    // Get current user for procurement officer field
    const userInfo = localStorage.getItem("user_info");
    if (userInfo) {
      const user = JSON.parse(userInfo);
      setFormData(prev => ({ ...prev, procurement_officer: user.username || "" }));
    }

    // Handle auto-fill from Material Request
    const urlParams = new URLSearchParams(window.location.search);
    const fromRequestId = urlParams.get('fromRequestId');

    if (fromRequestId) {
      const loadMR = async () => {
        try {
          const allMRs = await api.getMaterialRequests();
          const mr = allMRs.find(r => r.id === fromRequestId);
          if (mr) {
            setFormData(prev => ({
              ...prev,
              material_request_number: mr.requestNumber,
              warehouse: mr.warehouseId,
              required_delivery_date: mr.requiredDate,
            }));

            setItems(mr.items.map((it: any) => ({
              material_code: it.materialCode,
              material_name: it.materialName || it.materialCode,
              category: "Raw Materials",
              quantity: it.quantity,
              uom: it.uom,
              special_requirements: ""
            })));
          }
        } catch (e) {
          console.error("Failed to load MR details", e);
        }
      };
      loadMR();
    } else {
      void fetchNextMrNumber();
    }
  }, []);

  const fetchNextMrNumber = async () => {
    try {
      const { requestNumber } = await api.getNextMaterialRequestNumber();
      setFormData(prev => ({
        ...prev,
        material_request_number: requestNumber
      }));
    } catch (e) {
      console.error("Failed to fetch next MR number", e);
      // Fallback if API fails
      const yearMonth = new Date().toISOString().slice(0, 7).replace(/-/g, '');
      setFormData(prev => ({
        ...prev,
        material_request_number: `MR-${yearMonth}-0001`
      }));
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const toggleSupplier = (id: string) => {
    setSelectedSuppliers(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedSuppliers.length === 0) {
      toast.error("Please select at least one supplier");
      return;
    }

    if (items.some(item => !item.material_code.trim() || !item.material_name.trim())) {
      toast.error("Please fill in Material Code and Name for all items");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        ...formData,
        supplier_ids: selectedSuppliers,
        items: items.map(item => ({
          ...item,
          quantity: parseFloat(item.quantity) || 0,
        })),
        // Convert empty strings to null for optional date fields to prevent Pydantic errors
        required_delivery_date: formData.required_delivery_date || null,
      };

      await api.createRfq(payload);
      toast.success("RFQ Draft created successfully");
      navigate({ to: "/procurement/rfqs" });
    } catch (error: any) {
      toast.error("Failed to create RFQ", { description: error.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppShell
      title="Create New RFQ"
      subtitle="Request for Quotations — Auto-generate RFQ numbers and track bids"
      actions={
        <Button variant="outline" className="rounded-xl" onClick={() => navigate({ to: "/procurement/rfqs" })}>
          <ArrowLeft className="mr-2 size-4" /> Cancel
        </Button>
      }
    >
      <form onSubmit={handleSubmit} className="mx-auto max-w-4xl space-y-6">
        <SectionCard title="RFQ Metadata" description="Core identification and scheduling for this request" icon={FileText}>
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="rfq_date">RFQ Date</Label>
              <div className="relative">
                <CalendarIcon className="absolute left-3 top-3 size-4 text-muted-foreground" />
                <Input
                  id="rfq_date"
                  name="rfq_date"
                  type="date"
                  min={new Date().toISOString().split("T")[0]}
                  className={cn(inputClass, "pl-10 bg-muted/50")}
                  value={formData.rfq_date}
                  readOnly
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="material_request_number">Material Request Number</Label>
              <div className="relative">
                <FileText className="absolute left-3 top-3 size-4 text-muted-foreground" />
                <Input
                  id="material_request_number"
                  name="material_request_number"
                  placeholder="e.g. MR-202608-0001"
                  className={cn(inputClass, "pl-10 bg-muted/50")}
                  value={formData.material_request_number}
                  readOnly
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="required_delivery_date">Required Delivery Date</Label>
              <div className="relative">
                <CalendarIcon className="absolute left-3 top-3 size-4 text-muted-foreground" />
                <Input
                  id="required_delivery_date"
                  name="required_delivery_date"
                  type="date"
                  min={new Date().toISOString().split("T")[0]}
                  className={cn(inputClass, "pl-10")}
                  value={formData.required_delivery_date}
                  onChange={handleInputChange}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="warehouse">Warehouse</Label>
              <div className="relative">
                <Building2 className="absolute left-3 top-3 size-4 text-muted-foreground" />
                <Input
                  id="warehouse"
                  name="warehouse"
                  placeholder="e.g. Pune Plant 1"
                  className={cn(inputClass, "pl-10")}
                  value={formData.warehouse}
                  onChange={handleInputChange}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="procurement_officer">Procurement Officer</Label>
              <div className="relative">
                <User className="absolute left-3 top-3 size-4 text-muted-foreground" />
                <Input
                  id="procurement_officer"
                  name="procurement_officer"
                  placeholder="Officer name"
                  className={cn(inputClass, "pl-10")}
                  value={formData.procurement_officer}
                  onChange={handleInputChange}
                  required
                />
              </div>
            </div>
          </div>

          <div className="mt-6 space-y-2">
            <Label htmlFor="remarks">Remarks</Label>
            <Textarea
              id="remarks"
              name="remarks"
              placeholder="Additional instructions for suppliers..."
              className="min-h-[100px] rounded-xl border-border/80 bg-background"
              value={formData.remarks}
              onChange={handleInputChange}
            />
          </div>
        </SectionCard>

        <SectionCard title="Material Requirements" description="List materials required in this RFQ" icon={Package}>
          <div className="space-y-6">
            {items.map((item, index) => (
              <div key={index} className="relative rounded-2xl border border-border/80 bg-muted/20 p-5 transition-all hover:bg-muted/30">
                <div className="absolute right-4 top-4">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 rounded-xl text-destructive hover:bg-destructive-soft/10 hover:text-destructive"
                    onClick={() => removeItem(index)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>

                <p className="mb-4 text-xs font-bold text-primary uppercase tracking-wider">Item #{index + 1}</p>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Material Code</Label>
                    <Input
                      placeholder="e.g. MAT-001"
                      className="h-10 rounded-xl bg-muted/50"
                      value={item.material_code}
                      readOnly
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Material Name</Label>
                    <Input
                      placeholder="e.g. Steel Pipe 2\"
                      className="h-10 rounded-xl"
                      value={item.material_name}
                      onChange={(e) => handleItemChange(index, "material_name", e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Category Description</Label>
                    <select
                      className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                      value={item.category}
                      onChange={(e) => handleItemChange(index, "category", e.target.value)}
                    >
                      <option value="Raw Materials">Raw Materials</option>
                      <option value="Components">Components</option>
                      <option value="Services">Services</option>
                      <option value="Hardware">Hardware</option>
                      <option value="General">General</option>
                    </select>
                  </div>
                </div>

                <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Required Quantity</Label>
                    <Input
                      type="number"
                      min="1"
                      step="1"
                      className="h-10 rounded-xl font-mono"
                      value={Math.floor(item.quantity)}
                      onChange={(e) => handleItemChange(index, "quantity", e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">UOM</Label>
                    <Input
                      placeholder="e.g. PCS, KG, MTR"
                      className="h-10 rounded-xl"
                      value={item.uom}
                      onChange={(e) => handleItemChange(index, "uom", e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="mt-4 space-y-1.5">
                  <Label className="text-xs">Special Requirements</Label>
                  <Input
                    placeholder="e.g. Needs specialized temperature control, surface treatment certificate..."
                    className="h-10 rounded-xl"
                    value={item.special_requirements}
                    onChange={(e) => handleItemChange(index, "special_requirements", e.target.value)}
                  />
                </div>
              </div>
            ))}

            <Button
              type="button"
              variant="outline"
              className="w-full h-11 rounded-xl border-dashed border-primary/40 text-primary hover:bg-primary-soft/10 hover:border-primary"
              onClick={addItem}
            >
              <Plus className="mr-2 size-4" /> Add Material Requirement
            </Button>
          </div>
        </SectionCard>

        <SectionCard title="Select Suppliers" description="Search and select active vendors from the master data" icon={Building2}>
          <div className="mb-6 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Name or code..."
                  className="pl-10 rounded-xl"
                  value={filters.search}
                  onChange={(e) => setFilters(f => ({ ...f, search: e.target.value }))}
                />
              </div>
              <Input
                placeholder="Material..."
                className="rounded-xl"
                value={filters.material}
                onChange={(e) => setFilters(f => ({ ...f, material: e.target.value }))}
              />
              <Input
                placeholder="City/Location..."
                className="rounded-xl"
                value={filters.city}
                onChange={(e) => setFilters(f => ({ ...f, city: e.target.value }))}
              />
              <select
                className="h-11 rounded-xl border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                value={filters.category}
                onChange={(e) => setFilters(f => ({ ...f, category: e.target.value }))}
              >
                <option value="">All Categories</option>
                {availableCategories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          </div>

          {loadingSuppliers ? (
            <div className="flex h-48 items-center justify-center gap-2">
              <Loader2 className="size-6 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Searching supplier master...</p>
            </div>
          ) : suppliers.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground border-2 border-dashed rounded-2xl border-border/40">
              No suppliers found matching your criteria.
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {suppliers.map((s) => (
                <div
                  key={s.supplierId}
                  onClick={() => toggleSupplier(s.supplierId)}
                  className={cn(
                    "relative cursor-pointer rounded-2xl border p-4 transition-all hover:bg-accent/30",
                    selectedSuppliers.includes(s.supplierId)
                      ? "border-primary bg-primary-soft/10 ring-1 ring-primary"
                      : "border-border/60 bg-card"
                  )}
                >
                  <div className="flex items-start gap-4">
                    <div className={cn(
                      "grid size-12 shrink-0 place-items-center rounded-xl transition-colors",
                      selectedSuppliers.includes(s.supplierId) ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                    )}>
                      {selectedSuppliers.includes(s.supplierId) ? <CheckCircle2 className="size-6" /> : <Building2 className="size-6" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-bold">{s.supplierName}</p>
                      </div>
                      <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">
                        {s.category}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {selectedSuppliers.length > 0 && (
            <div className="mt-4 flex items-center justify-between rounded-xl bg-primary-soft/20 px-4 py-2 border border-primary/20">
              <p className="text-xs font-semibold text-primary">
                {selectedSuppliers.length} supplier(s) selected for invitation
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-[10px] text-primary hover:bg-primary-soft/30"
                onClick={(e) => { e.stopPropagation(); setSelectedSuppliers([]); }}
              >
                Clear all
              </Button>
            </div>
          )}
        </SectionCard>

        <div className="flex items-center justify-end gap-4 rounded-2xl border border-primary/10 bg-primary-soft/5 p-6 shadow-soft">
          <p className="hidden text-sm text-muted-foreground sm:block">
            Creating this RFQ will notify the selected suppliers via the portal.
          </p>
          <Button type="submit" size="lg" className="rounded-xl shadow-glow" disabled={submitting}>
            {submitting ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}
            Create RFQ
          </Button>
        </div>
      </form>
    </AppShell>
  );
}
