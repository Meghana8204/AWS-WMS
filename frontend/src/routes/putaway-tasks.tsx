import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowRight,
  Boxes,
  CheckCircle2,
  Loader2,
  MapPin,
  Play,
  RefreshCw,
  Save,
  ScanLine,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell, StatusBadge } from "@/components/wms/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api-client";

export const Route = createFileRoute("/putaway-tasks")({ component: PutawayTasks });
type Task = {
  id: string;
  task_number: string;
  grn_number: string;
  item_code: string;
  material_name: string;
  quantity: number;
  uom: string;
  warehouse_id: string;
  source_location: string;
  destination_location_id?: string;
  destination_zone?: string;
  destination_rack?: string;
  destination_bin?: string;
  location_assigned_by?: string;
  location_assigned_at?: string;
  started_by?: string;
  started_at?: string;
  completed_by?: string;
  completed_at?: string;
  status: string;
  created_by: string;
  created_at: string;
};
type StorageLocation = {
  id: string;
  location_code: string;
  warehouse_id: string;
  zone: string;
  rack: string;
  bin: string;
  capacity: number;
  occupied_quantity: number;
  available_capacity: number;
};
type HandlingUnit = {
  id: string;
  hu_number: string;
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
  putaway_task_id?: string;
  destination?: string;
};

function PutawayTasks() {
  const [tasks, setTasks] = useState<Task[]>([]),
    [locations, setLocations] = useState<StorageLocation[]>([]),
    [loading, setLoading] = useState(true);
  const [selections, setSelections] = useState<Record<string, string>>({}),
    [saving, setSaving] = useState<string>();
  const [confirmations, setConfirmations] = useState<
    Record<string, { material: string; location: string; quantity: string }>
  >({});
  const [handlingUnits, setHandlingUnits] = useState<Record<string, HandlingUnit>>({});
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [nextTasks, nextLocations] = await Promise.all([
        api.getPutawayTasks(),
        api.getStorageLocations(),
      ]);
      setTasks(nextTasks);
      setLocations(nextLocations);
      setSelections(
        Object.fromEntries(
          nextTasks
            .filter((task: Task) => task.destination_location_id)
            .map((task: Task) => [task.id, task.destination_location_id]),
        ),
      );
    } catch (error) {
      toast.error("Unable to load putaway tasks", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const assign = async (task: Task) => {
    const locationId = selections[task.id];
    if (!locationId) return toast.error("Select a storage bin");
    setSaving(task.id);
    try {
      const updated = await api.assignPutawayLocation(task.id, locationId);
      setTasks((current) => current.map((item) => (item.id === task.id ? updated : item)));
      toast.success("Storage location assigned");
    } catch (error) {
      toast.error("Unable to assign location", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setSaving(undefined);
    }
  };
  const start = async (task: Task) => {
    setSaving(task.id);
    try {
      const updated = await api.startPutaway(task.id);
      setTasks((current) => current.map((item) => (item.id === task.id ? updated : item)));
      setConfirmations((current) => ({
        ...current,
        [task.id]: { material: "", location: "", quantity: String(task.quantity) },
      }));
      toast.success("Putaway started");
    } catch (error) {
      toast.error("Unable to start putaway", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setSaving(undefined);
    }
  };
  const resolveHandlingUnit = async (task: Task) => {
    const scan = confirmations[task.id]?.material;
    if (!scan) return toast.error("Scan a handling unit first");
    setSaving(`scan:${task.id}`);
    try {
      const unit = await api.getHandlingUnit(scan);
      if (unit.putaway_task_id !== task.id)
        throw new Error(
          `Handling unit belongs to ${unit.putaway_task_number || "another putaway task"}`,
        );
      setHandlingUnits((current) => ({ ...current, [task.id]: unit }));
      toast.success(`${unit.hu_number} verified`);
    } catch (error) {
      setHandlingUnits((current) => {
        const next = { ...current };
        delete next[task.id];
        return next;
      });
      toast.error("Unable to verify handling unit", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setSaving(undefined);
    }
  };
  const complete = async (task: Task) => {
    const values = confirmations[task.id];
    if (!values?.material || !values.location || !values.quantity)
      return toast.error("Complete both scans and confirm quantity");
    setSaving(task.id);
    try {
      const updated = await api.completePutaway(task.id, {
        material_scan: values.material,
        location_scan: values.location,
        quantity: Number(values.quantity),
      });
      setTasks((current) => current.map((item) => (item.id === task.id ? updated : item)));
      toast.success("Putaway completed", {
        description: `${task.quantity.toLocaleString()} ${task.uom} is now available inventory.`,
      });
    } catch (error) {
      toast.error("Unable to complete putaway", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setSaving(undefined);
    }
  };
  const updateConfirmation = (
    taskId: string,
    field: "material" | "location" | "quantity",
    value: string,
  ) =>
    setConfirmations((current) => ({
      ...current,
      [taskId]: {
        material: current[taskId]?.material ?? "",
        location: current[taskId]?.location ?? "",
        quantity: current[taskId]?.quantity ?? "",
        [field]: value,
      },
    }));
  return (
    <AppShell
      title="Putaway Tasks"
      subtitle="Move GRN-received material from receiving into warehouse storage"
      actions={
        <Button variant="outline" className="rounded-xl" onClick={() => void load()}>
          <RefreshCw className="size-4" /> Refresh
        </Button>
      }
    >
      {loading ? (
        <div className="grid h-64 place-items-center">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      ) : tasks.length === 0 ? (
        <Card className="grid h-64 place-items-center rounded-2xl text-sm text-muted-foreground">
          <div className="text-center">
            <Boxes className="mx-auto mb-3 size-8" />
            No putaway tasks are pending.
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {tasks.map((task) => (
            <Card key={task.id} className="rounded-2xl p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase text-muted-foreground">Putaway Task</p>
                  <h2 className="font-mono font-bold text-primary">{task.task_number}</h2>
                  <p className="mt-1 font-mono text-xs text-muted-foreground">{task.grn_number}</p>
                </div>
                <StatusBadge status={task.status} />
              </div>
              <div className="my-5 rounded-xl border bg-muted/20 p-4">
                <p className="font-bold">{task.material_name}</p>
                <p className="font-mono text-xs text-muted-foreground">{task.item_code}</p>
                <p className="mt-2 text-lg font-black">
                  {task.quantity.toLocaleString()} {task.uom}
                </p>
              </div>
              <div className="grid items-center gap-3 sm:grid-cols-[1fr_auto_1fr]">
                <Location label="Source" value={task.source_location.replaceAll("_", " ")} />
                <ArrowRight className="mx-auto size-5 text-primary" />
                <Location
                  label="Destination"
                  value={
                    task.destination_bin
                      ? `${task.warehouse_id} / ${task.destination_zone} / ${task.destination_rack} / ${task.destination_bin}`
                      : "Not assigned"
                  }
                />
              </div>
              {task.status === "PUTAWAY_PENDING" && (
                <>
                  <div className="mt-4 rounded-xl border bg-muted/20 p-3">
                    <p className="mb-2 text-xs font-bold uppercase text-muted-foreground">
                      Storage Location Assignment
                    </p>
                    <div className="flex gap-2">
                      <select
                        className="h-10 min-w-0 flex-1 rounded-lg border bg-background px-3 text-sm"
                        value={selections[task.id] ?? ""}
                        onChange={(event) =>
                          setSelections((current) => ({
                            ...current,
                            [task.id]: event.target.value,
                          }))
                        }
                      >
                        <option value="">Select warehouse / zone / rack / bin</option>
                        {locations
                          .filter(
                            (location) =>
                              location.warehouse_id === task.warehouse_id &&
                              location.available_capacity >= task.quantity,
                          )
                          .map((location) => (
                            <option key={location.id} value={location.id}>
                              {location.warehouse_id} / {location.zone} / {location.rack} /{" "}
                              {location.bin} ({location.available_capacity.toLocaleString()}{" "}
                              available)
                            </option>
                          ))}
                      </select>
                      <Button
                        className="rounded-lg"
                        disabled={!selections[task.id] || saving === task.id}
                        onClick={() => void assign(task)}
                      >
                        {saving === task.id ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Save className="size-4" />
                        )}{" "}
                        Assign
                      </Button>
                    </div>
                  </div>
                  <Button
                    className="mt-3 w-full rounded-xl"
                    disabled={!task.destination_location_id || saving === task.id}
                    onClick={() => void start(task)}
                  >
                    <Play className="size-4" /> Start Putaway
                  </Button>
                </>
              )}
              {task.status === "PUTAWAY_IN_PROGRESS" && (
                <div className="mt-4 space-y-3 rounded-xl border border-primary/25 bg-primary/5 p-4">
                  <p className="flex items-center gap-2 text-sm font-bold">
                    <ScanLine className="size-4 text-primary" /> Scan and confirm movement
                  </p>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Scan HU QR / barcode"
                      value={confirmations[task.id]?.material ?? ""}
                      onChange={(event) => {
                        updateConfirmation(task.id, "material", event.target.value);
                        setHandlingUnits((current) => {
                          const next = { ...current };
                          delete next[task.id];
                          return next;
                        });
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") void resolveHandlingUnit(task);
                      }}
                    />
                    <Button
                      variant="outline"
                      disabled={!confirmations[task.id]?.material || saving === `scan:${task.id}`}
                      onClick={() => void resolveHandlingUnit(task)}
                    >
                      {saving === `scan:${task.id}` ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <ScanLine className="size-4" />
                      )}{" "}
                      Verify HU
                    </Button>
                  </div>
                  {handlingUnits[task.id] && <HandlingUnitDetails unit={handlingUnits[task.id]} />}
                  <Input
                    placeholder="Scan destination bin code"
                    value={confirmations[task.id]?.location ?? ""}
                    onChange={(event) =>
                      updateConfirmation(task.id, "location", event.target.value)
                    }
                  />
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      min="0"
                      step="any"
                      placeholder="Confirm quantity"
                      value={confirmations[task.id]?.quantity ?? String(task.quantity)}
                      onChange={(event) =>
                        updateConfirmation(task.id, "quantity", event.target.value)
                      }
                    />
                    <Button
                      className="shrink-0 rounded-lg"
                      disabled={saving === task.id || !handlingUnits[task.id]}
                      onClick={() => void complete(task)}
                    >
                      {saving === task.id ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="size-4" />
                      )}{" "}
                      Confirm Putaway
                    </Button>
                  </div>
                </div>
              )}
              {task.status === "PUTAWAY_COMPLETED" && (
                <div className="mt-4 rounded-xl border border-success/25 bg-success-soft p-4 text-sm text-success">
                  <p className="flex items-center gap-2 font-bold">
                    <CheckCircle2 className="size-4" /> Putaway complete
                  </p>
                  <p className="mt-1">Material is stored and available in inventory.</p>
                </div>
              )}
              {task.location_assigned_at && (
                <p className="mt-3 text-xs text-muted-foreground">
                  Location assigned by {task.location_assigned_by} ·{" "}
                  {new Date(task.location_assigned_at).toLocaleString()}
                </p>
              )}
              <p className="mt-4 text-xs text-muted-foreground">
                Created by {task.created_by} · {new Date(task.created_at).toLocaleString()}
              </p>
            </Card>
          ))}
        </div>
      )}
    </AppShell>
  );
}
function Location({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border p-3">
      <p className="flex items-center gap-1 text-xs uppercase text-muted-foreground">
        <MapPin className="size-3" />
        {label}
      </p>
      <p className="mt-1 font-mono text-sm font-semibold">{value}</p>
    </div>
  );
}
function HandlingUnitDetails({ unit }: { unit: HandlingUnit }) {
  const fields = [
    ["Material", `${unit.material_name} (${unit.item_code})`],
    ["Quantity", `${unit.quantity.toLocaleString()} ${unit.uom}`],
    ["Batch", unit.batch_number || "Not specified"],
    ["Supplier", unit.supplier_name],
    ["PO", unit.po_number],
    ["ASN", unit.asn_number],
    ["GRN", unit.grn_number || "Pending"],
    ["HU", unit.hu_number],
    ["Current location", unit.current_location],
    ["Status", unit.status],
  ];
  return (
    <div className="rounded-xl border border-success/30 bg-success-soft p-3">
      <p className="mb-2 text-xs font-bold uppercase text-success">Handling Unit Verified</p>
      <dl className="grid gap-x-4 gap-y-1 text-xs sm:grid-cols-[7rem_1fr_7rem_1fr]">
        {fields.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="font-semibold">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
