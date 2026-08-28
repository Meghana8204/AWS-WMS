import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import QRCode from "qrcode";
import JsBarcode from "jsbarcode";
import {
  ArrowDown,
  DoorOpen,
  Loader2,
  PackageCheck,
  Printer,
  QrCode,
  RefreshCw,
  Save,
  Truck,
  Zap,
  Sparkles,
  CheckCircle2,
} from "lucide-react";
import { AppShell, StatusBadge } from "@/components/wms/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";
export const Route = createFileRoute("/receiving")({ component: Receiving });
type Material = {
  item_code: string;
  material_name?: string;
  po_quantity: number;
  quantity: number;
  uom?: string;
  received_quantity?: number | null;
  recorded_by?: string;
  recorded_at?: string;
  verification_status?: "MATCH" | "SHORT" | "EXCESS";
  exception_quantity?: number;
  good_quantity?: number | null;
  damaged_quantity?: number | null;
  rejected_quantity?: number | null;
  condition_result?: string;
  inspection_required?: boolean;
};
type Shipment = {
  id: string;
  asn_id: string;
  asn_number: string;
  po_number: string;
  vehicle_number: string;
  assigned_dock_id: string;
  supplier_name: string;
  status:
    | "AT_DOCK"
    | "UNLOADING_IN_PROGRESS"
    | "QUALITY_INSPECTION_REQUIRED"
    | "QUALITY_PASSED"
    | "QUALITY_FAILED"
    | "RECEIVING_COMPLETED";
  expected_materials: Material[];
  quality_decision?: string;
  quality_inspected_by?: string;
  quality_inspected_at?: string;
  prepared_grn_id?: string;
  receiving_completed_by?: string;
  receiving_completed_at?: string;
  dock_released_by?: string;
  dock_released_at?: string;
};
function Receiving() {
  const [shipments, setShipments] = useState<Shipment[]>([]),
    [quantities, setQuantities] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true),
    [busy, setBusy] = useState<string | null>(null);
  const [policy, setPolicy] = useState({ shortage_tolerance: "0", excess_tolerance: "0" });
  const [conditions, setConditions] = useState<
    Record<
      string,
      {
        good: string;
        damaged: string;
        rejected: string;
        inspect: boolean;
      }
    >
  >({});
  const [labelShipment, setLabelShipment] = useState<Shipment | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rows, rule]: [
        Shipment[],
        {
          shortage_tolerance: number;
          excess_tolerance: number;
        },
      ] = await Promise.all([api.getInboundArrivals(), api.getQuantityVerificationPolicy()]);
      const receiving = rows.filter((row) =>
        [
          "AT_DOCK",
          "UNLOADING_IN_PROGRESS",
          "QUALITY_INSPECTION_REQUIRED",
          "QUALITY_PASSED",
          "QUALITY_FAILED",
          "RECEIVING_COMPLETED",
        ].includes(row.status),
      );
      setShipments(receiving);
      setPolicy({
        shortage_tolerance: String(rule.shortage_tolerance),
        excess_tolerance: String(rule.excess_tolerance),
      });
      setQuantities(
        Object.fromEntries(
          receiving.flatMap((s) =>
            s.expected_materials.map((m) => [
              `${s.id}:${m.item_code}`,
              m.received_quantity == null ? "" : String(m.received_quantity),
            ]),
          ),
        ),
      );
      setConditions(
        Object.fromEntries(
          receiving.flatMap((s) =>
            s.expected_materials.map((m) => [
              `${s.id}:${m.item_code}`,
              {
                good:
                  m.good_quantity == null
                    ? String(m.received_quantity ?? "")
                    : String(m.good_quantity),
                damaged: String(m.damaged_quantity ?? 0),
                rejected: String(m.rejected_quantity ?? 0),
                inspect: Boolean(m.inspection_required),
              },
            ]),
          ),
        ),
      );
    } catch (error) {
      toast.error("Unable to load receiving queue", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  async function start(s: Shipment) {
    setBusy(s.id);
    try {
      await api.startUnloading(s.id);
      toast.success("Unloading started");
      await load();
    } catch (e) {
      toast.error("Unable to start unloading", {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setBusy(null);
    }
  }
  async function save(s: Shipment) {
    const values = s.expected_materials.map((m) => ({
      item_code: m.item_code,
      raw: quantities[`${s.id}:${m.item_code}`] ?? "",
    }));
    if (
      values.some(
        (i) => i.raw.trim() === "" || !Number.isFinite(Number(i.raw)) || Number(i.raw) < 0,
      )
    ) {
      toast.error("Enter a valid received quantity for every material");
      return;
    }
    const items = values.map((i) => ({ item_code: i.item_code, received_quantity: Number(i.raw) }));
    setBusy(s.id);
    try {
      await api.recordReceivingQuantities(s.id, items);
      toast.success("Received quantities saved", {
        description: `${s.asn_number} compared with PO and ASN quantities.`,
      });
      await load();
    } catch (e) {
      toast.error("Unable to save received quantities", {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setBusy(null);
    }
  }
  async function savePolicy() {
    const shortage_tolerance = Number(policy.shortage_tolerance),
      excess_tolerance = Number(policy.excess_tolerance);
    if (
      !Number.isFinite(shortage_tolerance) ||
      !Number.isFinite(excess_tolerance) ||
      shortage_tolerance < 0 ||
      excess_tolerance < 0
    ) {
      toast.error("Tolerances must be zero or positive");
      return;
    }
    setBusy("policy");
    try {
      await api.updateQuantityVerificationPolicy({ shortage_tolerance, excess_tolerance });
      toast.success("Quantity verification policy updated");
    } catch (e) {
      toast.error("Unable to update policy", {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setBusy(null);
    }
  }
  async function saveConditions(s: Shipment) {
    const items = s.expected_materials.map((m) => {
      const c = conditions[`${s.id}:${m.item_code}`];
      return {
        item_code: m.item_code,
        good_quantity: Number(c?.good),
        damaged_quantity: Number(c?.damaged),
        rejected_quantity: Number(c?.rejected),
        inspection_required: Boolean(c?.inspect),
      };
    });
    if (
      items.some((i) =>
        [i.good_quantity, i.damaged_quantity, i.rejected_quantity].some(
          (v) => !Number.isFinite(v) || v < 0,
        ),
      )
    ) {
      toast.error("Enter valid condition quantities");
      return;
    }
    setBusy(`condition:${s.id}`);
    try {
      await api.recordMaterialConditions(s.id, items);
      toast.success("Material conditions recorded");
      await load();
    } catch (e) {
      toast.error("Unable to record material conditions", {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setBusy(null);
    }
  }
  async function decideQuality(s: Shipment, decision: "PASS" | "FAIL") {
    setBusy(`quality:${s.id}`);
    try {
      await api.completeQualityInspection(s.id, decision);
      toast.success(`Quality inspection ${decision.toLowerCase()}`);
      await load();
    } catch (e) {
      toast.error("Unable to complete inspection", {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setBusy(null);
    }
  }
  async function complete(s: Shipment) {
    setBusy(`complete:${s.id}`);
    try {
      const result = await api.completeReceiving(s.id);
      toast.success("Receiving completed", { description: `GRN ${result.grn_id} prepared.` });
      await load();
    } catch (e) {
      toast.error("Unable to complete receiving", {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setBusy(null);
    }
  }
  async function releaseDock(s: Shipment) {
    setBusy(`release:${s.id}`);
    try {
      const result = await api.releaseDock(s.id);
      toast.success(`${result.dock_number} released`, {
        description: `${result.vehicle_number} / ${result.grn_number}`,
      });
      await load();
    } catch (e) {
      toast.error("Unable to release dock", {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setBusy(null);
    }
  }
  return (
    <AppShell
      title="Receiving"
      subtitle="Compare ordered, shipped, and physically received quantities"
      actions={
        <Button variant="outline" className="rounded-xl" onClick={() => void load()}>
          <RefreshCw className="size-4" /> Refresh
        </Button>
      }
    >
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      ) : (
        <div className="space-y-4">
          <Card className="rounded-2xl p-5">
            <div className="flex flex-wrap items-end gap-4">
              <div className="mr-auto">
                <h3 className="font-semibold">Quantity verification policy</h3>
                <p className="text-xs text-muted-foreground">
                  A variance within tolerance is classified as MATCH. Set both to 0 for exact
                  matching.
                </p>
              </div>
              <label className="text-xs font-medium">
                Short tolerance
                <Input
                  className="mt-1 w-40"
                  type="number"
                  min="0"
                  step="any"
                  value={policy.shortage_tolerance}
                  onChange={(e) => setPolicy((p) => ({ ...p, shortage_tolerance: e.target.value }))}
                />
              </label>
              <label className="text-xs font-medium">
                Excess tolerance
                <Input
                  className="mt-1 w-40"
                  type="number"
                  min="0"
                  step="any"
                  value={policy.excess_tolerance}
                  onChange={(e) => setPolicy((p) => ({ ...p, excess_tolerance: e.target.value }))}
                />
              </label>
              <Button
                variant="outline"
                disabled={busy === "policy"}
                onClick={() => void savePolicy()}
              >
                {busy === "policy" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Save className="size-4" />
                )}{" "}
                Save policy
              </Button>
            </div>
          </Card>
          {shipments.length === 0 ? (
            <Card className="grid h-64 place-items-center rounded-2xl text-sm text-muted-foreground">
              <div className="text-center">
                <PackageCheck className="mx-auto mb-3 size-8" />
                No vehicles are ready for receiving.
              </div>
            </Card>
          ) : (
            shipments.map((s) => (
              <Card key={s.id} className="rounded-2xl p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className="grid size-11 place-items-center rounded-xl bg-primary-soft text-primary">
                      <Truck className="size-5" />
                    </span>
                    <div>
                      <p className="font-mono font-bold">{s.vehicle_number}</p>
                      <p className="text-xs text-muted-foreground">{s.supplier_name}</p>
                    </div>
                  </div>
                  <StatusBadge status={s.status} />
                </div>
                <div className="my-5 grid items-center gap-2 rounded-xl border bg-muted/20 p-4 text-center sm:grid-cols-7">
                  <Link
                    to="/procurement/asns/$asnId"
                    params={{ asnId: s.asn_id }}
                    className="font-mono font-semibold text-primary hover:underline"
                  >
                    {s.asn_number}
                  </Link>
                  <ArrowDown className="mx-auto size-4 -rotate-90 text-muted-foreground" />
                  <span className="font-mono font-semibold">{s.po_number}</span>
                  <ArrowDown className="mx-auto size-4 -rotate-90 text-muted-foreground" />
                  <span className="font-mono font-semibold">{s.vehicle_number}</span>
                  <ArrowDown className="mx-auto size-4 -rotate-90 text-muted-foreground" />
                  <span className="font-mono font-semibold">{s.assigned_dock_id}</span>
                </div>
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold">Physical Receiving Comparison</h3>
                    <p className="text-xs text-muted-foreground">
                      PO Reference: <span className="font-mono font-bold text-foreground">{s.po_number}</span> · Supplier: {s.supplier_name}
                    </p>
                  </div>
                  {s.status === "UNLOADING_IN_PROGRESS" && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 rounded-lg text-xs font-semibold text-primary border-primary/30 hover:bg-primary/10"
                      onClick={() => {
                        const newQ: Record<string, string> = {};
                        s.expected_materials.forEach((m) => {
                          const targetQty = m.po_quantity && m.po_quantity > 0 ? m.po_quantity : m.quantity;
                          newQ[`${s.id}:${m.item_code}`] = String(targetQty);
                        });
                        setQuantities((prev) => ({ ...prev, ...newQ }));
                        toast.success(`Auto-filled all physical quantities from PO ${s.po_number} details!`);
                      }}
                    >
                      <Zap className="mr-1.5 size-3.5 fill-primary text-primary" /> Auto-Fill All PO Quantities
                    </Button>
                  )}
                </div>
                <div className="overflow-x-auto rounded-xl border bg-card">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3">Material Nameplate & Code</th>
                        <th className="px-4 py-3">Actual PO Detail Qty</th>
                        <th className="px-4 py-3">ASN Shipped Qty</th>
                        <th className="px-4 py-3">Physical Received Qty</th>
                        <th className="px-4 py-3">Verification Result</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {s.expected_materials.map((m) => {
                        const targetPoQty = m.po_quantity && m.po_quantity > 0 ? m.po_quantity : m.quantity;
                        const raw = quantities[`${s.id}:${m.item_code}`] ?? "",
                          received = raw === "" ? null : Number(raw),
                          variance = received == null ? null : received - targetPoQty,
                          shortage = Number(policy.shortage_tolerance) || 0,
                          excess = Number(policy.excess_tolerance) || 0,
                          result =
                            variance == null
                              ? "PENDING"
                              : variance < -shortage
                                ? "SHORT"
                                : variance > excess
                                  ? "EXCESS"
                                  : "MATCH";
                        return (
                          <tr key={m.item_code} className="hover:bg-muted/30 transition-colors">
                            <td className="px-4 py-3">
                              <div className="flex items-start gap-2">
                                <div>
                                  <b className="text-foreground text-sm font-semibold block">
                                    {m.material_name || m.item_code}
                                  </b>
                                  <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-muted border text-primary">
                                      {m.item_code}
                                    </span>
                                    <span className="text-[10px] font-medium text-muted-foreground px-1.5 py-0.5 rounded bg-muted/60">
                                      PO: {s.po_number}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="font-semibold text-foreground">
                                {targetPoQty.toLocaleString()} <span className="text-xs font-normal text-muted-foreground">{m.uom || "PCS"}</span>
                              </div>
                              <span className="text-[10px] text-emerald-600 font-medium block">
                                Auto-Fetched PO Detail
                              </span>
                            </td>
                            <td className="px-4 py-3 font-semibold text-foreground">
                              {m.quantity.toLocaleString()} <span className="text-xs font-normal text-muted-foreground">{m.uom || "PCS"}</span>
                            </td>
                            <td className="min-w-48 px-4 py-3">
                              <div className="space-y-1">
                                <Input
                                  type="number"
                                  min="0"
                                  step="any"
                                  disabled={s.status !== "UNLOADING_IN_PROGRESS"}
                                  value={raw}
                                  onChange={(e) =>
                                    setQuantities((q) => ({
                                      ...q,
                                      [`${s.id}:${m.item_code}`]: e.target.value,
                                    }))
                                  }
                                  placeholder={`PO Qty: ${targetPoQty}`}
                                  className="h-9 font-mono font-bold"
                                />
                                {s.status === "UNLOADING_IN_PROGRESS" && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setQuantities((q) => ({
                                        ...q,
                                        [`${s.id}:${m.item_code}`]: String(targetPoQty),
                                      }))
                                    }
                                    className="text-[10px] font-semibold text-primary hover:underline flex items-center gap-1"
                                  >
                                    <Sparkles className="size-3 text-amber-500" /> Match PO Qty ({targetPoQty} {m.uom || "PCS"})
                                  </button>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              {result === "PENDING" ? (
                                <span className="text-muted-foreground text-xs font-medium">Pending Entry</span>
                              ) : result === "MATCH" ? (
                                <span className="inline-flex items-center gap-1 font-bold text-success text-xs bg-success/10 px-2 py-1 rounded-md border border-success/20">
                                  <CheckCircle2 className="size-3.5" /> MATCH
                                </span>
                              ) : (
                                <span
                                  className={cn(
                                    "inline-flex items-center gap-1 font-bold text-xs px-2 py-1 rounded-md border",
                                    result === "SHORT"
                                      ? "text-destructive bg-destructive/10 border-destructive/20"
                                      : "text-warning bg-warning/10 border-warning/20",
                                  )}
                                >
                                  {result} ({Math.abs(variance!).toLocaleString()} {m.uom || "PCS"})
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {s.expected_materials.every((m) => m.received_quantity != null) && (
                  <>
                    <h3 className="mb-2 mt-5 text-sm font-semibold">Quality / condition check</h3>
                    <div className="overflow-x-auto rounded-xl border">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                          <tr>
                            <th className="px-3 py-3">Material</th>
                            <th className="px-3 py-3">Received</th>
                            <th className="px-3 py-3">Good</th>
                            <th className="px-3 py-3">Damaged</th>
                            <th className="px-3 py-3">Rejected</th>
                            <th className="px-3 py-3">Inspect</th>
                            <th className="px-3 py-3">Result</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {s.expected_materials.map((m) => {
                            const key = `${s.id}:${m.item_code}`,
                              c = conditions[key] || {
                                good: "",
                                damaged: "0",
                                rejected: "0",
                                inspect: false,
                              },
                              locked = ["QUALITY_PASSED", "QUALITY_FAILED"].includes(s.status),
                              damaged = Number(c.damaged),
                              rejected = Number(c.rejected),
                              result = c.inspect
                                ? "INSPECTION REQUIRED"
                                : rejected > 0
                                  ? "REJECTED"
                                  : damaged > 0
                                    ? "DAMAGED"
                                    : m.verification_status === "SHORT" ||
                                        m.verification_status === "EXCESS"
                                      ? m.verification_status
                                      : "ACCEPTED";
                            const update = (
                              field: "good" | "damaged" | "rejected",
                              value: string,
                            ) =>
                              setConditions((all) => ({ ...all, [key]: { ...c, [field]: value } }));
                            return (
                              <tr key={key}>
                                <td className="px-3 py-3 font-medium">
                                  {m.material_name || m.item_code}
                                </td>
                                <td className="px-3 py-3 font-semibold">
                                  {m.received_quantity?.toLocaleString()} {m.uom}
                                </td>
                                <td className="min-w-32 px-3 py-3">
                                  <Input
                                    type="number"
                                    min="0"
                                    step="any"
                                    disabled={locked}
                                    value={c.good}
                                    onChange={(e) => update("good", e.target.value)}
                                  />
                                </td>
                                <td className="min-w-32 px-3 py-3">
                                  <Input
                                    type="number"
                                    min="0"
                                    step="any"
                                    disabled={locked}
                                    value={c.damaged}
                                    onChange={(e) => update("damaged", e.target.value)}
                                  />
                                </td>
                                <td className="min-w-32 px-3 py-3">
                                  <Input
                                    type="number"
                                    min="0"
                                    step="any"
                                    disabled={locked}
                                    value={c.rejected}
                                    onChange={(e) => update("rejected", e.target.value)}
                                  />
                                </td>
                                <td className="px-3 py-3 text-center">
                                  <input
                                    type="checkbox"
                                    className="size-4 accent-primary"
                                    disabled={locked}
                                    checked={c.inspect}
                                    onChange={(e) =>
                                      setConditions((all) => ({
                                        ...all,
                                        [key]: { ...c, inspect: e.target.checked },
                                      }))
                                    }
                                  />
                                </td>
                                <td className="px-3 py-3 font-bold">{result}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    <div className="mt-3 flex justify-end gap-2">
                      {!["QUALITY_PASSED", "QUALITY_FAILED"].includes(s.status) && (
                        <Button
                          variant="outline"
                          disabled={busy === `condition:${s.id}`}
                          onClick={() => void saveConditions(s)}
                        >
                          {busy === `condition:${s.id}` && (
                            <Loader2 className="size-4 animate-spin" />
                          )}{" "}
                          Save condition check
                        </Button>
                      )}
                      {s.status === "QUALITY_INSPECTION_REQUIRED" && (
                        <>
                          <Button
                            variant="destructive"
                            disabled={busy === `quality:${s.id}`}
                            onClick={() => void decideQuality(s, "FAIL")}
                          >
                            Fail inspection
                          </Button>
                          <Button
                            disabled={busy === `quality:${s.id}`}
                            onClick={() => void decideQuality(s, "PASS")}
                          >
                            Pass inspection
                          </Button>
                        </>
                      )}
                      {s.quality_decision && (
                        <span className="rounded-lg border px-3 py-2 text-sm font-bold">
                          Inspection {s.quality_decision}
                        </span>
                      )}
                    </div>
                  </>
                )}
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs text-muted-foreground">
                    {s.expected_materials.some((m) => m.recorded_at)
                      ? `Last recorded by ${s.expected_materials.find((m) => m.recorded_by)?.recorded_by} · ${new Date(s.expected_materials.find((m) => m.recorded_at)!.recorded_at!).toLocaleString()}`
                      : "Actual quantities have not been recorded."}
                  </p>
                  {s.status === "AT_DOCK" ? (
                    <Button
                      className="rounded-xl shadow-glow"
                      disabled={busy === s.id}
                      onClick={() => void start(s)}
                    >
                      {busy === s.id && <Loader2 className="size-4 animate-spin" />} Start unloading
                    </Button>
                  ) : (
                    <Button
                      className="rounded-xl"
                      disabled={busy === s.id}
                      onClick={() => void save(s)}
                    >
                      {busy === s.id ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Save className="size-4" />
                      )}{" "}
                      Save received quantities
                    </Button>
                  )}
                </div>
                {s.status === "RECEIVING_COMPLETED" ? (
                  <div className="mt-4 rounded-xl border border-success/30 bg-success-soft p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-bold text-success">
                          All Items Verified · Receiving Completed
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          GRN {s.prepared_grn_id} is prepared
                          {s.receiving_completed_by ? ` by ${s.receiving_completed_by}` : ""}.
                        </p>
                        {s.dock_released_at && (
                          <p className="mt-2 text-xs font-semibold text-success">
                            {s.assigned_dock_id} is AVAILABLE · Released by {s.dock_released_by} ·{" "}
                            {new Date(s.dock_released_at).toLocaleString()}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button variant="outline" onClick={() => setLabelShipment(s)}>
                          <QrCode className="size-4" /> Generate QR / Barcode Labels
                        </Button>
                        {!s.dock_released_at && (
                          <Button
                            disabled={busy === `release:${s.id}`}
                            onClick={() => void releaseDock(s)}
                          >
                            {busy === `release:${s.id}` ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <DoorOpen className="size-4" />
                            )}{" "}
                            Release Dock
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ) : s.expected_materials.every((m) => Boolean(m.condition_result)) &&
                  (s.status === "UNLOADING_IN_PROGRESS" || s.status === "QUALITY_PASSED") ? (
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-success/30 bg-success-soft p-4">
                    <div>
                      <p className="font-bold text-success">All Items Verified</p>
                      <p className="text-xs text-muted-foreground">
                        Accepted quantity equals Good quantity. Generate labels before completing
                        receiving.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" onClick={() => setLabelShipment(s)}>
                        <QrCode className="size-4" /> Generate QR / Barcode Labels
                      </Button>
                      <Button
                        disabled={busy === `complete:${s.id}`}
                        onClick={() => void complete(s)}
                      >
                        {busy === `complete:${s.id}` && <Loader2 className="size-4 animate-spin" />}{" "}
                        Complete receiving
                      </Button>
                    </div>
                  </div>
                ) : null}
              </Card>
            ))
          )}
        </div>
      )}
      <MaterialLabelsDialog
        shipment={labelShipment}
        onOpenChange={(open) => {
          if (!open) setLabelShipment(null);
        }}
      />
    </AppShell>
  );
}
type HandlingUnit = {
  id: string;
  hu_number: string;
  barcode_value: string;
  item_code: string;
  material_name: string;
  quantity: number;
  uom: string;
  batch_number?: string;
  supplier_name: string;
  po_number: string;
  asn_number: string;
  grn_number?: string;
  warehouse_id: string;
  current_location: string;
  status: string;
};
type GeneratedLabel = {
  unit: HandlingUnit;
  qr: string;
  barcode: string;
};
function MaterialLabelsDialog({
  shipment,
  onOpenChange,
}: {
  shipment: Shipment | null;
  onOpenChange: (open: boolean) => void;
}) {
  const [labels, setLabels] = useState<GeneratedLabel[]>([]);
  const [generating, setGenerating] = useState(false);
  useEffect(() => {
    if (!shipment) {
      setLabels([]);
      return;
    }
    let active = true;
    setGenerating(true);
    api
      .generateHandlingUnits(shipment.id)
      .then((response: { items: HandlingUnit[] }) =>
        Promise.all(
          response.items.map(async (unit) => {
            const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            JsBarcode(svg, unit.barcode_value, {
              format: "CODE128",
              displayValue: true,
              height: 45,
              margin: 4,
              fontSize: 13,
            });
            const barcode = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(svg))}`;
            const qrPayload = [
              "NEXUSWMS MATERIAL HANDLING UNIT",
              `HU: ${unit.hu_number}`,
              `Material: ${unit.material_name}`,
              `Material Code: ${unit.item_code}`,
              `Accepted Quantity: ${unit.quantity} ${unit.uom}`,
              `Batch: ${unit.batch_number || "Not specified"}`,
              `Supplier: ${unit.supplier_name}`,
              `PO: ${unit.po_number}`,
              `ASN: ${unit.asn_number}`,
              `GRN: ${unit.grn_number || "Pending"}`,
              `Warehouse: ${unit.warehouse_id}`,
              `Current Location: ${unit.current_location}`,
              `Status: ${unit.status}`,
            ].join("\n");
            const qr = await QRCode.toDataURL(qrPayload, {
              errorCorrectionLevel: "M",
              margin: 1,
              width: 320,
            });
            return { unit, qr, barcode };
          }),
        ),
      )
      .then((result) => {
        if (active) setLabels(result);
      })
      .catch((error) =>
        toast.error("Unable to generate material labels", {
          description: error instanceof Error ? error.message : undefined,
        }),
      )
      .finally(() => {
        if (active) setGenerating(false);
      });
    return () => {
      active = false;
    };
  }, [shipment]);
  function printLabels() {
    if (!shipment) return;
    const escape = (value: unknown) =>
      String(value ?? "").replace(
        /[&<>"']/g,
        (character) =>
          ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!,
      );
    const popup = window.open("", "material-label-print", "width=1000,height=800");
    if (!popup) {
      toast.error("Allow pop-ups to print material labels");
      return;
    }
    popup.opener = null;
    const cards = labels
      .map(
        ({ unit, qr, barcode }) =>
          `<article><div class="codes"><img class="qr" src="${qr}" alt="QR code"><img class="barcode" src="${barcode}" alt="Barcode"></div><section><h2>${escape(unit.material_name)}</h2><p class="code">${escape(unit.item_code)}</p><p class="hu">${escape(unit.hu_number)}</p><dl><dt>Accepted quantity</dt><dd>${escape(unit.quantity)} ${escape(unit.uom)}</dd><dt>Batch</dt><dd>${escape(unit.batch_number || "Not specified")}</dd><dt>PO / ASN</dt><dd>${escape(unit.po_number)} / ${escape(unit.asn_number)}</dd><dt>Supplier</dt><dd>${escape(unit.supplier_name)}</dd><dt>Warehouse / Dock</dt><dd>${escape(unit.warehouse_id)} / ${escape(shipment.assigned_dock_id)}</dd></dl></section></article>`,
      )
      .join("");
    popup.document.write(
      `<!doctype html><html><head><title>Material labels - ${escape(shipment.asn_number)}</title><style>@page{size:auto;margin:8mm}body{font-family:Arial,sans-serif;margin:0}article{box-sizing:border-box;border:2px solid #111;border-radius:10px;display:flex;gap:16px;align-items:center;padding:14px;margin:0 0 8mm;break-inside:avoid;min-height:70mm}.codes{width:48mm;text-align:center}.qr{width:38mm;height:38mm}.barcode{display:block;width:48mm;height:18mm;object-fit:contain}h2{font-size:18px;margin:0 0 4px}.code,.hu{font-family:monospace;font-weight:700;margin:0 0 5px}.hu{color:#174ea6}dl{display:grid;grid-template-columns:130px 1fr;gap:5px;margin:8px 0 0;font-size:13px}dt{color:#555}dd{font-weight:700;margin:0}@media print{article:last-child{margin-bottom:0}}</style></head><body>${cards}<script>window.onload=async()=>{const images=Array.from(document.images);await Promise.all(images.map(image=>image.complete?Promise.resolve():new Promise(resolve=>{image.onload=resolve;image.onerror=resolve})));window.focus();window.print()};window.onafterprint=()=>window.close()</script></body></html>`,
    );
    popup.document.close();
  }
  return (
    <Dialog open={Boolean(shipment)} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Material QR / Barcode Labels</DialogTitle>
          <DialogDescription>
            One label per accepted material line. Accepted quantity is the recorded Good quantity.
          </DialogDescription>
        </DialogHeader>
        {generating ? (
          <div className="grid h-40 place-items-center">
            <Loader2 className="size-6 animate-spin text-primary" />
          </div>
        ) : labels.length === 0 ? (
          <p className="rounded-xl border p-6 text-center text-sm text-muted-foreground">
            There are no accepted quantities to label.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {labels.map(({ unit, qr, barcode }) => (
              <div
                key={unit.id}
                className="grid grid-cols-[7rem_1fr] items-center gap-3 rounded-xl border p-3"
              >
                <img
                  className="size-28 rounded-md"
                  src={qr}
                  alt={`QR code for ${unit.hu_number}`}
                />
                <div className="min-w-0">
                  <p className="font-semibold">{unit.material_name}</p>
                  <p className="font-mono text-xs text-muted-foreground">{unit.item_code}</p>
                  <p className="mt-1 font-mono text-xs font-bold text-primary">{unit.hu_number}</p>
                  <p className="mt-2 text-sm">
                    Accepted:{" "}
                    <b>
                      {unit.quantity.toLocaleString()} {unit.uom}
                    </b>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {unit.po_number} · {unit.asn_number}
                  </p>
                </div>
                <img
                  className="col-span-2 h-14 w-full object-contain"
                  src={barcode}
                  alt={`Barcode for ${unit.hu_number}`}
                />
              </div>
            ))}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button disabled={generating || labels.length === 0} onClick={printLabels}>
            <Printer className="size-4" /> Print labels
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
