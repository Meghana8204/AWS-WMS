import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Building2,
  Calendar,
  CheckCircle2,
  ClipboardList,
  Loader2,
  PackageCheck,
  Send,
} from "lucide-react";
import { AppShell, StatusBadge } from "@/components/wms/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api-client";
import { getUserInfo } from "@/lib/auth-utils";
import { toast } from "sonner";

export const Route = createFileRoute("/procurement/finished-goods")({
  component: ProcurementFinishedGoods,
});

const today = () => new Date().toISOString().split("T")[0];

function formatDisplayDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "-";
  const date = new Date(String(dateStr));
  if (Number.isNaN(date.getTime())) return String(dateStr).split("T")[0];
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function ProcurementFinishedGoods() {
  const [requests, setRequests] = useState<any[]>([]);
  const [finishedGoods, setFinishedGoods] = useState<any[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [loadingFinishedGoods, setLoadingFinishedGoods] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    finished_goods_id: "",
    warehouse_id: "MAIN",
    material_code: "",
    material_name: "",
    quantity: "1",
    uom: "PCS",
    required_date: today(),
    remarks: "",
  });

  const fetchRequests = async () => {
    try {
      setLoadingRequests(true);
      const data = await api.getFinishedGoodsRequests();
      setRequests(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to fetch finished goods requests:", error);
      toast.error("Failed to load finished goods requests");
    } finally {
      setLoadingRequests(false);
    }
  };

  const fetchFinishedGoods = async () => {
    try {
      setLoadingFinishedGoods(true);
      const data = await api.getAssemblyFinishedGoods();
      setFinishedGoods(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to fetch finished goods:", error);
      toast.error("Failed to load finished goods");
    } finally {
      setLoadingFinishedGoods(false);
    }
  };

  useEffect(() => {
    fetchRequests();
    fetchFinishedGoods();
  }, []);

  const handleFinishedGoodSelect = (id: string) => {
    const selected = finishedGoods.find((item) => String(item.id) === id);
    setForm((current) => ({
      ...current,
      finished_goods_id: id,
      material_code: selected?.product_code || "",
      material_name: selected?.product_name || "",
      warehouse_id: selected?.warehouse || current.warehouse_id,
      uom: selected?.uom || current.uom,
    }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const requester = getUserInfo()?.username?.trim() || "procurement";
    const materialName = form.material_name.trim();
    const quantity = Number(form.quantity);

    if (!form.warehouse_id.trim()) {
      toast.error("Warehouse is required");
      return;
    }
    if (!materialName) {
      toast.error("Finished goods name is required");
      return;
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      toast.error("Quantity must be greater than 0");
      return;
    }

    setSubmitting(true);
    try {
      await api.createFinishedGoodsRequest({
        warehouse_id: form.warehouse_id.trim(),
        finished_goods_code: form.material_code.trim() || null,
        finished_goods_name: materialName,
        quantity,
        uom: form.uom.trim() || "PCS",
        required_date: form.required_date,
        requested_by: requester,
        remarks: form.remarks.trim() || null,
      });
      toast.success("Finished goods request sent to warehouse");
      setForm((current) => ({
        finished_goods_id: "",
        warehouse_id: current.warehouse_id,
        material_code: "",
        material_name: "",
        quantity: "1",
        uom: "PCS",
        required_date: today(),
        remarks: "",
      }));
      await fetchRequests();
    } catch (error: any) {
      toast.error("Failed to send request", { description: error.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppShell
      title="Finished Goods"
      subtitle="Ask warehouse to confirm finished goods availability"
    >
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-border bg-card p-6 shadow-sm"
        >
          <div className="mb-6 flex items-center gap-3 border-b border-border/60 pb-5">
            <div className="grid size-11 place-items-center rounded-xl bg-primary-soft text-primary">
              <PackageCheck className="size-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold tracking-tight">Finished Goods Request</h2>
              <p className="text-sm text-muted-foreground">
                Send one availability check to warehouse.
              </p>
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="fg-select">Finished Goods</Label>
              <Select
                value={form.finished_goods_id}
                onValueChange={handleFinishedGoodSelect}
                disabled={loadingFinishedGoods || finishedGoods.length === 0}
              >
                <SelectTrigger id="fg-select" className="h-11 rounded-xl">
                  <SelectValue
                    placeholder={
                      loadingFinishedGoods
                        ? "Loading finished goods..."
                        : finishedGoods.length === 0
                          ? "No finished goods available"
                          : "Select finished goods"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {finishedGoods.map((item) => (
                    <SelectItem key={item.id} value={String(item.id)}>
                      {item.product_code} - {item.product_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="fg-warehouse">Warehouse</Label>
              <Input
                id="fg-warehouse"
                value={form.warehouse_id}
                onChange={(event) =>
                  setForm((current) => ({ ...current, warehouse_id: event.target.value }))
                }
                className="h-11 rounded-xl"
                placeholder="MAIN"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fg-required-date">Required Date</Label>
              <Input
                id="fg-required-date"
                type="date"
                min={today()}
                value={form.required_date}
                onChange={(event) =>
                  setForm((current) => ({ ...current, required_date: event.target.value }))
                }
                className="h-11 rounded-xl"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fg-code">Finished Goods Code</Label>
              <Input
                id="fg-code"
                value={form.material_code}
                className="h-11 rounded-xl bg-muted/40 font-mono"
                placeholder="Select finished goods"
                readOnly
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fg-name">Finished Goods Name</Label>
              <Input
                id="fg-name"
                value={form.material_name}
                className="h-11 rounded-xl bg-muted/40"
                placeholder="Select finished goods"
                readOnly
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fg-qty">Quantity Needed</Label>
              <Input
                id="fg-qty"
                type="number"
                min="0.01"
                step="0.01"
                value={form.quantity}
                onChange={(event) =>
                  setForm((current) => ({ ...current, quantity: event.target.value }))
                }
                className="h-11 rounded-xl"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fg-uom">UOM</Label>
              <Input
                id="fg-uom"
                value={form.uom}
                onChange={(event) =>
                  setForm((current) => ({ ...current, uom: event.target.value }))
                }
                className="h-11 rounded-xl"
                placeholder="PCS"
                required
              />
            </div>
          </div>

          <div className="mt-5 space-y-2">
            <Label htmlFor="fg-remarks">Remarks</Label>
            <Textarea
              id="fg-remarks"
              value={form.remarks}
              onChange={(event) =>
                setForm((current) => ({ ...current, remarks: event.target.value }))
              }
              className="min-h-28 rounded-xl"
              placeholder="Ask warehouse to confirm available stock, storage location, or expected readiness."
            />
          </div>

          <div className="mt-6 flex justify-end border-t border-border/60 pt-5">
            <Button type="submit" className="h-11 rounded-xl px-6" disabled={submitting}>
              {submitting ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Send className="mr-2 size-4" />
              )}
              Send to Warehouse
            </Button>
          </div>
        </form>

        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between border-b border-border/60 pb-4">
            <div>
              <h2 className="text-base font-semibold tracking-tight">Recent Requests</h2>
              <p className="text-xs text-muted-foreground">Finished-goods checks sent to warehouse</p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-xl"
              onClick={() => fetchRequests()}
              disabled={loadingRequests}
            >
              {loadingRequests ? <Loader2 className="size-4 animate-spin" /> : "Refresh"}
            </Button>
          </div>

          {loadingRequests ? (
            <div className="flex h-48 items-center justify-center">
              <Loader2 className="size-7 animate-spin text-primary" />
            </div>
          ) : requests.length === 0 ? (
            <Card className="flex h-48 flex-col items-center justify-center border-dashed bg-muted/20 p-5 text-center">
              <ClipboardList className="mb-3 size-10 text-muted-foreground/40" />
              <p className="text-sm font-semibold text-muted-foreground">No finished goods requests</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {requests.slice(0, 6).map((request) => {
                return (
                  <div
                    key={request.id}
                    className="rounded-xl border border-border/70 bg-background p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{request.requestNumber}</p>
                        <p className="truncate text-sm text-muted-foreground">
                          {request.finishedGoodsName || request.finished_goods_name || "Finished goods"}
                        </p>
                      </div>
                      <StatusBadge status={request.status || "SUBMITTED"} />
                    </div>
                    <div className="mt-3 grid gap-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-2">
                        <Building2 className="size-3.5" />
                        {request.warehouseId || request.warehouse_id || "MAIN"}
                      </span>
                      <span className="flex items-center gap-2">
                        <Calendar className="size-3.5" />
                        {formatDisplayDate(request.requiredDate || request.required_date)}
                      </span>
                      <span className="flex items-center gap-2 font-medium text-foreground">
                        <CheckCircle2 className="size-3.5 text-primary" />
                        {request.quantity || 0} {request.uom || "PCS"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
