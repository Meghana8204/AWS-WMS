import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  Save,
  Calendar as CalendarIcon,
  Building2,
  FileText,
  Loader2,
  Package,
  Truck,
  CheckCircle2,
  Info
} from "lucide-react";
import { AppShell } from "@/components/wms/app-shell";
import { SectionCard } from "@/components/wms/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/supplier/asns/new")({
  component: NewAsn,
});

const inputClass = "mt-1.5 h-11 rounded-xl border-border/80 bg-background focus:ring-primary/20";

function NewAsn() {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as any;
  const poId = search.po_id || search.poId || "";
  const poNumberFromSearch = search.po_number || search.poNumber || "";

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [po, setPo] = useState<any>(null);
  const [asnNumber, setAsnNumber] = useState("");

  const [formData, setFormData] = useState({
    shipment_date: new Date().toISOString().split("T")[0],
    expected_arrival_date: "",
    vehicle_number: "",
    driver_name: "",
    driver_contact: "",
  });

  const [lines, setLines] = useState<any[]>([]);

  useEffect(() => {
    async function init() {
      try {
        setLoading(true);

        // 1. Fetch next ASN number
        const { asnNumber: nextAsn } = await api.getNextAsnNumber();
        setAsnNumber(nextAsn);

        // 2. Fetch PO details if poId is provided
        if (poId) {
          const poData = await api.getPurchaseOrder(poId);
          setPo(poData);

          // Initialize lines from PO items
          const poItems = poData.items || poData.lines || [];
          setLines(poItems.map((item: any) => ({
            item_code: item.item_code || item.material_code,
            material_name: item.material_name,
            ordered_quantity: item.ordered_quantity || item.quantity,
            shipped_quantity: item.ordered_quantity || item.quantity, // Default to full shipment
          })));
        }
      } catch (err: any) {
        toast.error("Initialization failed", { description: err.message });
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [poId]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleLineChange = (index: number, value: string) => {
    const qty = parseFloat(value) || 0;
    setLines((prev) =>
      prev.map((line, i) => (i === index ? { ...line, shipped_quantity: qty } : line))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!poId) {
        toast.error("No Purchase Order referenced");
        return;
    }

    setSubmitting(true);
    try {
      const payload = {
        po_id: poId,
        asn_number: asnNumber,
        shipment_date: formData.shipment_date,
        expected_arrival_at: formData.expected_arrival_date ? new Date(formData.expected_arrival_date).toISOString() : null,
        vehicle_number: formData.vehicle_number,
        driver_name: formData.driver_name,
        driver_contact: formData.driver_contact,
        lines: lines.map(l => ({
          item_code: l.item_code,
          shipped_quantity: l.shipped_quantity,
        })),
      };

      await api.createAsn(payload);
      toast.success("Advance Shipment Notice submitted successfully");
      navigate({ to: "/supplier-dashboard" });
    } catch (error: any) {
      toast.error("Failed to submit ASN", { description: error.message });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center gap-3">
        <Loader2 className="size-8 animate-spin text-primary" />
        <span className="text-sm text-muted-foreground">Preparing ASN workspace...</span>
      </div>
    );
  }

  return (
    <AppShell
      title="Create Advance Shipment Notice"
      subtitle={`PO: ${po?.po_number || poNumberFromSearch} · Supplier Portal`}
      actions={
        <Button variant="outline" className="rounded-xl" onClick={() => window.history.back()}>
          <ArrowLeft className="mr-2 size-4" /> Back
        </Button>
      }
    >
      <form onSubmit={handleSubmit} className="mx-auto max-w-5xl space-y-6 pb-20">
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <SectionCard title="ASN Information" icon={FileText}>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>ASN Number</Label>
                  <div className="h-11 flex items-center px-4 rounded-xl bg-muted/50 border border-border font-mono text-sm font-bold text-primary">
                    {asnNumber}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Reference PO Number</Label>
                  <div className="h-11 flex items-center px-4 rounded-xl bg-muted/50 border border-border font-mono text-sm font-bold">
                    {po?.po_number || poNumberFromSearch}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="shipment_date">Shipment Date</Label>
                  <Input
                    id="shipment_date"
                    name="shipment_date"
                    type="date"
                    className={inputClass}
                    value={formData.shipment_date}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="expected_arrival_date">Expected Arrival Date</Label>
                  <Input
                    id="expected_arrival_date"
                    name="expected_arrival_date"
                    type="date"
                    className={inputClass}
                    value={formData.expected_arrival_date}
                    onChange={handleInputChange}
                    required
                  />
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Shipment Contents" description="Specify quantities for this dispatch" icon={Package}>
              <div className="rounded-2xl border border-border/40 overflow-hidden bg-card">
                <table className="w-full text-xs text-left">
                  <thead className="bg-muted/50 border-b border-border/40 text-[10px] uppercase font-bold text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3">Material</th>
                      <th className="px-4 py-3 text-right">Ordered</th>
                      <th className="px-4 py-3 text-right w-32">Shipped</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/20">
                    {lines.map((line, idx) => (
                      <tr key={idx} className="hover:bg-muted/5 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-bold text-primary font-mono">{line.item_code}</div>
                          <div className="text-muted-foreground">{line.material_name}</div>
                        </td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums">
                          {parseFloat(line.ordered_quantity).toLocaleString()}
                        </td>
                        <td className="px-4 py-3">
                          <Input
                            type="number"
                            className="h-8 rounded-lg text-xs font-mono text-right"
                            value={line.shipped_quantity}
                            onChange={(e) => handleLineChange(idx, e.target.value)}
                            max={line.ordered_quantity}
                            required
                          />
                        </td>
                      </tr>
                    ))}
                    {lines.length === 0 && (
                        <tr>
                            <td colSpan={3} className="px-4 py-12 text-center text-muted-foreground italic">
                                <Info className="size-5 mx-auto mb-2 opacity-50" />
                                No items found in the referenced Purchase Order.
                            </td>
                        </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          </div>

          <div className="space-y-6">
            <SectionCard title="Logistics Details" icon={Truck}>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="vehicle_number">Vehicle Number</Label>
                  <Input
                    id="vehicle_number"
                    name="vehicle_number"
                    placeholder="e.g. MH-12-PQ-1234"
                    className={cn(inputClass, "uppercase")}
                    value={formData.vehicle_number}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="driver_name">Driver Name</Label>
                  <Input
                    id="driver_name"
                    name="driver_name"
                    placeholder="Full Name"
                    className={inputClass}
                    value={formData.driver_name}
                    onChange={handleInputChange}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="driver_contact">Driver Contact</Label>
                  <Input
                    id="driver_contact"
                    name="driver_contact"
                    placeholder="+91 XXXXX XXXXX"
                    className={inputClass}
                    value={formData.driver_contact}
                    onChange={handleInputChange}
                  />
                </div>

                <div className="pt-4 border-t border-border mt-4">
                    <div className="rounded-xl bg-primary-soft/10 border border-primary/20 p-4">
                        <div className="flex gap-3 text-xs text-primary leading-relaxed font-medium">
                            <CheckCircle2 className="size-4 shrink-0 mt-0.5" />
                            <span>By submitting this ASN, you confirm that the goods listed above have been dispatched.</span>
                        </div>
                    </div>
                </div>

                <Button type="submit" className="w-full mt-6 h-12 rounded-xl shadow-glow" disabled={submitting || lines.length === 0}>
                  {submitting ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}
                  Submit ASN
                </Button>
              </div>
            </SectionCard>
          </div>
        </div>
      </form>
    </AppShell>
  );
}
