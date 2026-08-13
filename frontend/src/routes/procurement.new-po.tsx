import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  Save,
  Calendar as CalendarIcon,
  Building2,
  User,
  FileText,
  Loader2,
  Plus,
  Trash2,
  Package,
  Calculator,
  Mail,
  Phone,
  MapPin,
  Tag
} from "lucide-react";
import { AppShell } from "@/components/wms/app-shell";
import { SectionCard } from "@/components/wms/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/procurement/new-po")({
  component: NewPurchaseOrder,
});

const inputClass = "mt-1.5 h-11 rounded-xl border-border/80 bg-background focus:ring-primary/20";

function NewPurchaseOrder() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loadingSuppliers, setLoadingSuppliers] = useState(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState("");
  const [supplierDetails, setSupplierDetails] = useState<any>(null);

  const [formData, setFormData] = useState({
    po_date: new Date().toISOString().split("T")[0],
    warehouse_id: "MAIN-WH",
    department: "Procurement",
    buyer: "",
    expected_delivery_date: "",
    payment_terms: "NET30",
    additional_charges: 0,
  });

  const [items, setItems] = useState<any[]>([
    {
      material_code: "",
      material_name: "",
      category: "Raw Material",
      unit_of_measure: "PCS",
      quantity: 1,
      unit_price: 0,
      discount: 0,
      tax: 0,
    }
  ]);

  useEffect(() => {
    async function fetchSuppliers() {
      try {
        setLoadingSuppliers(true);
        const data = await api.getSuppliers();
        setSuppliers(data);
      } catch (err) {
        toast.error("Failed to load suppliers");
      } finally {
        setLoadingSuppliers(false);
      }
    }
    fetchSuppliers();
  }, []);

  useEffect(() => {
    const userInfo = localStorage.getItem("user_info");
    if (userInfo) {
      const user = JSON.parse(userInfo);
      setFormData(prev => ({ ...prev, buyer: user.username || "" }));
    }
  }, []);

  useEffect(() => {
    if (selectedSupplierId) {
      const supplier = suppliers.find(s => s.supplierId === selectedSupplierId);
      if (supplier) {
        setSupplierDetails(supplier);
      } else {
        // Fetch full details if not in the list
        api.getSupplier(selectedSupplierId).then(setSupplierDetails).catch(() => {
          toast.error("Failed to load supplier details");
        });
      }
    } else {
      setSupplierDetails(null);
    }
  }, [selectedSupplierId, suppliers]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: name === "additional_charges" ? parseFloat(value) || 0 : value }));
  };

  const addItem = () => {
    setItems((prev) => [
      ...prev,
      {
        material_code: "",
        material_name: "",
        category: "Raw Material",
        unit_of_measure: "PCS",
        quantity: 1,
        unit_price: 0,
        discount: 0,
        tax: 0,
      },
    ]);
  };

  const removeItem = (index: number) => {
    if (items.length === 1) {
      toast.error("At least one item is required");
      return;
    }
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        const updated = { ...item, [field]: value };

        // Auto-calculate tax (mock 18% if tax is 0 and price/qty changes)
        if ((field === "unit_price" || field === "quantity") && updated.tax === 0) {
            const sub = (parseFloat(updated.quantity) || 0) * (parseFloat(updated.unit_price) || 0);
            const disc = parseFloat(updated.discount) || 0;
            updated.tax = parseFloat(((sub - disc) * 0.18).toFixed(2));
        }

        return updated;
      })
    );
  };

  const summary = useMemo(() => {
    const subtotal = items.reduce((acc, item) => acc + (parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0), 0);
    const discount = items.reduce((acc, item) => acc + (parseFloat(item.discount) || 0), 0);
    const tax = items.reduce((acc, item) => acc + (parseFloat(item.tax) || 0), 0);
    const grandTotal = subtotal - discount + tax + (parseFloat(formData.additional_charges as any) || 0);

    return {
      subtotal,
      discount,
      tax,
      additional_charges: formData.additional_charges,
      grandTotal
    };
  }, [items, formData.additional_charges]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplierId) {
      toast.error("Please select a supplier");
      return;
    }

    if (items.some(item => !item.material_code.trim())) {
      toast.error("Please fill in Material Code for all items");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        supplier_id: selectedSupplierId,
        warehouse_id: formData.warehouse_id,
        expected_delivery_date: formData.expected_delivery_date,
        po_date: formData.po_date,
        department: formData.department,
        buyer: formData.buyer,
        payment_terms: formData.payment_terms,
        additional_charges: formData.additional_charges,
        supplier_info: {
          supplier_code: supplierDetails?.supplierCode,
          supplier_name: supplierDetails?.supplierName,
          contact_person: supplierDetails?.contactPerson,
          phone: supplierDetails?.phone,
          email: supplierDetails?.email,
          gst_number: supplierDetails?.gstNumber || supplierDetails?.taxId,
          supplier_address: supplierDetails?.address || supplierDetails?.city,
        },
        items: items.map(item => ({
          ...item,
          quantity: parseFloat(item.quantity) || 0,
          unit_price: parseFloat(item.unit_price) || 0,
          discount: parseFloat(item.discount) || 0,
          tax: parseFloat(item.tax) || 0,
        })),
      };

      await api.createPurchaseOrder(payload);
      toast.success("Purchase Order created successfully");
      navigate({ to: "/procurement/purchase-orders" });
    } catch (error: any) {
      toast.error("Failed to create PO", { description: error.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppShell
      title="Create Purchase Order"
      subtitle="Issue a new official order to a supplier"
      actions={
        <Button variant="outline" className="rounded-xl" onClick={() => navigate({ to: "/procurement/purchase-orders" })}>
          <ArrowLeft className="mr-2 size-4" /> Cancel
        </Button>
      }
    >
      <form onSubmit={handleSubmit} className="mx-auto max-w-5xl space-y-6 pb-20">
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <SectionCard title="PO Information" icon={FileText}>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="po_date">PO Date</Label>
                  <Input
                    id="po_date"
                    name="po_date"
                    type="date"
                    className={inputClass}
                    value={formData.po_date}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="expected_delivery_date">Expected Delivery Date</Label>
                  <Input
                    id="expected_delivery_date"
                    name="expected_delivery_date"
                    type="date"
                    className={inputClass}
                    value={formData.expected_delivery_date}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="warehouse_id">Warehouse</Label>
                  <select
                    id="warehouse_id"
                    name="warehouse_id"
                    className={cn(inputClass, "w-full px-3 text-sm outline-none border border-border")}
                    value={formData.warehouse_id}
                    onChange={handleInputChange}
                  >
                    <option value="MAIN-WH">Main Warehouse</option>
                    <option value="RM-WH">Raw Material WH</option>
                    <option value="FG-WH">Finished Goods WH</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="department">Department</Label>
                  <Input
                    id="department"
                    name="department"
                    placeholder="e.g. Production"
                    className={inputClass}
                    value={formData.department}
                    onChange={handleInputChange}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="buyer">Procurement Officer</Label>
                  <Input
                    id="buyer"
                    name="buyer"
                    placeholder="Buyer name"
                    className={inputClass}
                    value={formData.buyer}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="payment_terms">Payment Terms</Label>
                  <select
                    id="payment_terms"
                    name="payment_terms"
                    className={cn(inputClass, "w-full px-3 text-sm outline-none border border-border")}
                    value={formData.payment_terms}
                    onChange={handleInputChange}
                  >
                    <option value="NET30">NET 30 Days</option>
                    <option value="NET45">NET 45 Days</option>
                    <option value="NET60">NET 60 Days</option>
                    <option value="IMMEDIATE">Immediate</option>
                  </select>
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Order Items" icon={Package}>
              <div className="space-y-4">
                {items.map((item, index) => (
                  <div key={index} className="rounded-xl border border-border/60 bg-muted/5 p-4 relative group">
                    <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-8 rounded-lg text-destructive hover:bg-destructive-soft/10"
                            onClick={() => removeItem(index)}
                        >
                            <Trash2 className="size-4" />
                        </Button>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-4">
                      <div className="space-y-1.5 col-span-1">
                        <Label className="text-[10px] uppercase font-bold text-muted-foreground">Material Code</Label>
                        <Input
                          placeholder="Code"
                          className="h-9 rounded-lg text-xs font-mono"
                          value={item.material_code}
                          onChange={(e) => handleItemChange(index, "material_code", e.target.value)}
                          required
                        />
                      </div>
                      <div className="space-y-1.5 col-span-2">
                        <Label className="text-[10px] uppercase font-bold text-muted-foreground">Material Name</Label>
                        <Input
                          placeholder="Name / Description"
                          className="h-9 rounded-lg text-xs"
                          value={item.material_name}
                          onChange={(e) => handleItemChange(index, "material_name", e.target.value)}
                        />
                      </div>
                      <div className="space-y-1.5 col-span-1">
                        <Label className="text-[10px] uppercase font-bold text-muted-foreground">UOM</Label>
                        <Input
                          placeholder="UOM"
                          className="h-9 rounded-lg text-xs"
                          value={item.unit_of_measure}
                          onChange={(e) => handleItemChange(index, "unit_of_measure", e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="mt-3 grid gap-4 grid-cols-2 sm:grid-cols-5">
                      <div className="space-y-1.5">
                        <Label className="text-[10px] uppercase font-bold text-muted-foreground">Quantity</Label>
                        <Input
                          type="number"
                          className="h-9 rounded-lg text-xs"
                          value={item.quantity}
                          onChange={(e) => handleItemChange(index, "quantity", e.target.value)}
                          required
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] uppercase font-bold text-muted-foreground">Unit Price</Label>
                        <Input
                          type="number"
                          className="h-9 rounded-lg text-xs"
                          value={item.unit_price}
                          onChange={(e) => handleItemChange(index, "unit_price", e.target.value)}
                          required
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] uppercase font-bold text-muted-foreground">Discount</Label>
                        <Input
                          type="number"
                          className="h-9 rounded-lg text-xs"
                          value={item.discount}
                          onChange={(e) => handleItemChange(index, "discount", e.target.value)}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] uppercase font-bold text-muted-foreground">Tax (GST)</Label>
                        <Input
                          type="number"
                          className="h-9 rounded-lg text-xs"
                          value={item.tax}
                          onChange={(e) => handleItemChange(index, "tax", e.target.value)}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] uppercase font-bold text-muted-foreground">Line Total</Label>
                        <div className="h-9 flex items-center px-3 rounded-lg bg-muted/30 border border-border/40 text-xs font-bold tabular-nums">
                            ₹ {((parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0) - (parseFloat(item.discount) || 0) + (parseFloat(item.tax) || 0)).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-11 rounded-xl border-dashed border-primary/30 text-primary hover:bg-primary-soft/10"
                  onClick={addItem}
                >
                  <Plus className="mr-2 size-4" /> Add Item
                </Button>
              </div>
            </SectionCard>
          </div>

          <div className="space-y-6">
            <SectionCard title="Supplier" icon={Building2}>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Select Supplier</Label>
                  <select
                    className="w-full h-11 rounded-xl border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                    value={selectedSupplierId}
                    onChange={(e) => setSelectedSupplierId(e.target.value)}
                    required
                  >
                    <option value="">-- Choose Vendor --</option>
                    {suppliers.map(s => (
                      <option key={s.supplierId} value={s.supplierId}>
                        {s.supplierName} ({s.supplierCode})
                      </option>
                    ))}
                  </select>
                </div>

                {supplierDetails && (
                  <div className="rounded-xl border border-border/50 bg-card p-4 space-y-3 animate-in fade-in slide-in-from-top-2">
                    <div className="flex items-center gap-3 text-sm">
                      <User className="size-4 text-muted-foreground" />
                      <span className="font-medium">{supplierDetails.contactPerson || "No Contact"}</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <Mail className="size-4 text-muted-foreground" />
                      <span className="truncate">{supplierDetails.email || "No Email"}</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <Phone className="size-4 text-muted-foreground" />
                      <span>{supplierDetails.phone || "No Phone"}</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <Tag className="size-4 text-muted-foreground" />
                      <span className="font-mono text-[11px] font-bold text-primary">{supplierDetails.gstNumber || supplierDetails.taxId || "NO-GST"}</span>
                    </div>
                    <div className="flex items-start gap-3 text-sm">
                      <MapPin className="size-4 text-muted-foreground mt-0.5" />
                      <span className="text-xs text-muted-foreground leading-relaxed">{supplierDetails.address || supplierDetails.city}</span>
                    </div>
                  </div>
                )}
              </div>
            </SectionCard>

            <SectionCard title="Order Summary" icon={Calculator}>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-mono font-medium">₹ {summary.subtotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Discount</span>
                  <span className="font-mono font-medium text-destructive">- ₹ {summary.discount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tax (GST)</span>
                  <span className="font-mono font-medium text-success">+ ₹ {summary.tax.toLocaleString()}</span>
                </div>
                <div className="space-y-1.5 pt-2 border-t border-border/60">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Additional Charges</Label>
                    <Input
                      type="number"
                      name="additional_charges"
                      className="h-9 rounded-lg text-xs font-mono"
                      value={formData.additional_charges}
                      onChange={handleInputChange}
                    />
                </div>
                <div className="flex justify-between pt-4 mt-2 border-t border-border text-lg font-bold">
                  <span>Grand Total</span>
                  <span className="text-primary tabular-nums">₹ {summary.grandTotal.toLocaleString()}</span>
                </div>
              </div>

              <Button type="submit" className="w-full mt-6 h-12 rounded-xl shadow-glow" disabled={submitting}>
                {submitting ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}
                Confirm & Create PO
              </Button>
            </SectionCard>
          </div>
        </div>
      </form>
    </AppShell>
  );
}
