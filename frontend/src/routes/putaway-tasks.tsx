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
  UserRound,
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
  po_number: string;
  dock_number: string;
  item_code: string;
  material_name: string;
  quantity: number;
  uom: string;
  warehouse_id: string;
  source_location: string;
  destination_location_id?: string;
  handling_unit_number?: string;
  handling_unit_barcode?: string;
  destination_zone?: string;
  destination_rack?: string;
  destination_bin?: string;
  location_assigned_by?: string;
  location_assigned_at?: string;
  assigned_to?: string;
  assigned_by?: string;
  assigned_at?: string;
  material_category?: string;
  handling_requirement?: string;
  rotation_policy?: string;
  placement_metadata?: { score?: number; reasons?: string[] };
  destination_location_code?: string;
  movement_instruction?: string;
  started_by?: string;
  started_at?: string;
  completed_by?: string;
  completed_at?: string;
  status: string;
  created_by: string;
  created_at: string;
  audit_trail?: Array<{
    status: string;
    label: string;
    actor?: string;
    operator?: string;
    timestamp: string;
    source?: string;
    destination?: string;
    quantity?: number;
    uom?: string;
  }>;
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

const normalizeWarehouseId = (warehouseId?: string) =>
  warehouseId?.trim().toUpperCase().replaceAll("_", "-") || "";

function PutawayTasks() {
  const [tasks, setTasks] = useState<Task[]>([]),
    [locations, setLocations] = useState<StorageLocation[]>([]),
    [loading, setLoading] = useState(true),
    [fetchingLocations, setFetchingLocations] = useState(false);
  const [selections, setSelections] = useState<Record<string, string>>({}),
    [saving, setSaving] = useState<string>();
  const [locationSearch, setLocationSearch] = useState<Record<string, string>>({});
  const [operators, setOperators] = useState<Record<string, string>>({});
  const [confirmations, setConfirmations] = useState<
    Record<
      string,
      {
        material: string;
        location: string;
        quantity: string;
        batch: string;
        serial: string;
        container: string;
      }
    >
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
      setOperators(
        Object.fromEntries(
          nextTasks
            .filter((task: Task) => task.assigned_to)
            .map((task: Task) => [task.id, task.assigned_to]),
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
  const refreshLocations = async (taskId?: string) => {
    setFetchingLocations(true);
    try {
      // Always fetch all locations to ensure we have a complete registry for all tasks on the page
      const data = await api.getStorageLocations(undefined, false);
      setLocations(data);
      toast.success("Storage locations synced from backend");
    } catch (error) {
      console.error("Failed to fetch locations:", error);
      toast.error("Failed to sync locations");
    } finally {
      setFetchingLocations(false);
    }
  };

  const assign = async (task: Task) => {
    const locationId = selections[task.id];
    if (!locationId) return toast.error("Select a storage bin");
    setSaving(task.id);
    try {
      const updated = await api.assignPutawayLocation(task.id, locationId);
      setTasks((current) =>
        current.map((item) => (item.id === task.id ? { ...item, ...updated } : item)),
      );
      toast.success("Storage location assigned");
    } catch (error) {
      toast.error("Unable to assign location", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setSaving(undefined);
    }
  };
  const assignOperator = async (task: Task) => {
    const operator = operators[task.id]?.trim();
    if (!operator) return toast.error("Enter a warehouse operator");
    setSaving(`operator:${task.id}`);
    try {
      const updated = await api.assignPutawayOperator(task.id, operator);
      setTasks((current) =>
        current.map((item) => (item.id === task.id ? { ...item, ...updated } : item)),
      );
      toast.success(`Task assigned to ${operator}`, { description: updated.movement_instruction });
    } catch (error) {
      toast.error("Unable to assign operator", {
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
      setTasks((current) =>
        current.map((item) => (item.id === task.id ? { ...item, ...updated } : item)),
      );
      setConfirmations((current) => ({
        ...current,
        [task.id]: {
          material: "",
          location: "",
          quantity: String(task.quantity),
          batch: "",
          serial: "",
          container: "",
        },
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
    const scan = confirmations[task.id]?.material?.trim();
    if (!scan) return toast.error("Scan a handling unit first");
    if (
      task.handling_unit_barcode &&
      !scan.startsWith("{") &&
      scan !== task.handling_unit_barcode
    ) {
      return toast.error("Incorrect handling-unit barcode", {
        description: `Scan ${task.handling_unit_barcode}; ${task.quantity} is the quantity, not the HU barcode.`,
      });
    }
    setSaving(`scan:${task.id}`);
    try {
      const unit = await api.getHandlingUnit(scan);
      if (unit.putaway_task_id !== task.id)
        throw new Error(
          `Handling unit belongs to ${unit.putaway_task_number || "another putaway task"}`,
        );
      setHandlingUnits((current) => ({ ...current, [task.id]: unit }));
      if (unit.batch_number) updateConfirmation(task.id, "batch", unit.batch_number);
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
    if (
      task.destination_location_code &&
      values.location.trim().toUpperCase() !== task.destination_location_code.trim().toUpperCase()
    ) {
      return toast.error("Incorrect destination scan", {
        description: `Scan location code ${task.destination_location_code}; ${task.destination_bin || "the bin label"} is the display name.`,
      });
    }
    setSaving(task.id);
    try {
      const updated = await api.completePutaway(task.id, {
        material_scan: values.material,
        location_scan: values.location,
        material_code: task.item_code,
        material_name: task.material_name,
        source_location: task.source_location,
        destination_location: task.destination_location_code || values.location,
        quantity: Number(values.quantity),
        batch_lot: values.batch || undefined,
        serial_number: values.serial || undefined,
        container_pallet: values.container || undefined,
      });
      setTasks((current) =>
        current.map((item) => (item.id === task.id ? { ...item, ...updated } : item)),
      );
      toast.success("Putaway completed", {
        description: updated.inventory_update
          ? `${updated.inventory_update.material_name}: ${updated.inventory_update.available.toLocaleString()} ${task.uom} available at ${updated.inventory_update.location} · Active`
          : `${task.quantity.toLocaleString()} ${task.uom} is now available inventory.`,
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
    field: "material" | "location" | "quantity" | "batch" | "serial" | "container",
    value: string,
  ) =>
    setConfirmations((current) => ({
      ...current,
      [taskId]: {
        material: current[taskId]?.material ?? "",
        location: current[taskId]?.location ?? "",
        quantity: current[taskId]?.quantity ?? "",
        batch: current[taskId]?.batch ?? "",
        serial: current[taskId]?.serial ?? "",
        container: current[taskId]?.container ?? "",
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
                  <p className="mt-1 font-mono text-xs text-muted-foreground">
                    GRN: {task.grn_number}
                  </p>
                  <p className="font-mono text-xs text-muted-foreground">PO: {task.po_number}</p>
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
              <div className="mt-4 rounded-xl border border-primary/25 bg-primary/5 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-primary">
                      System storage recommendation
                    </p>
                    <p className="mt-1 font-mono text-sm font-bold">
                      {task.destination_bin
                        ? `${task.warehouse_id} → ${task.destination_zone} → ${task.destination_rack} → ${task.destination_bin}`
                        : "No compatible location currently has enough capacity"}
                    </p>
                  </div>
                  {task.placement_metadata?.score != null && (
                    <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">
                      Score {task.placement_metadata.score}
                    </span>
                  )}
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  <span className="rounded-md border bg-background px-2 py-1">
                    Category: {task.material_category || "General"}
                  </span>
                  <span className="rounded-md border bg-background px-2 py-1">UOM: {task.uom}</span>
                  <span className="rounded-md border bg-background px-2 py-1">
                    Handling: {(task.handling_requirement || "STANDARD").replaceAll("_", " ")}
                  </span>
                  <span className="rounded-md border bg-background px-2 py-1">
                    Rotation: {task.rotation_policy || "FIFO"}
                  </span>
                </div>
                {task.placement_metadata?.reasons?.length ? (
                  <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                    {task.placement_metadata.reasons.map((reason) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
              {task.assigned_to && (
                <div className="mt-4 rounded-xl border border-success/30 bg-success-soft p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-success">
                    Operator instruction · {task.assigned_to}
                  </p>
                  <p className="mt-1 text-base font-bold">
                    {task.movement_instruction ||
                      `Put ${task.quantity.toLocaleString()} ${task.uom} ${task.material_name} into ${task.destination_location_code || task.destination_bin}`}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Move the handling unit from {task.source_location} to the assigned storage
                    location.
                  </p>
                </div>
              )}
              {task.status === "OPEN" && (
                <>
                  <div className="mt-4 rounded-xl border bg-muted/20 p-3">
                    <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase text-muted-foreground">
                      <UserRound className="size-4" /> Warehouse Operator Assignment
                    </p>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Operator name or employee ID"
                        value={operators[task.id] ?? ""}
                        onChange={(event) =>
                          setOperators((current) => ({ ...current, [task.id]: event.target.value }))
                        }
                      />
                      <Button
                        variant="outline"
                        className="rounded-lg"
                        disabled={
                          !task.destination_location_id ||
                          !operators[task.id]?.trim() ||
                          saving === `operator:${task.id}`
                        }
                        onClick={() => void assignOperator(task)}
                      >
                        {saving === `operator:${task.id}` ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <UserRound className="size-4" />
                        )}
                        Assign Operator
                      </Button>
                    </div>
                    {task.assigned_to && (
                      <p className="mt-2 text-xs font-semibold text-success">
                        Assigned to {task.assigned_to}
                      </p>
                    )}
                  </div>
                  <div className="mt-4 rounded-xl border bg-muted/20 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-xs font-bold uppercase text-muted-foreground">
                        Storage Location Assignment
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-[10px] font-bold text-primary"
                        onClick={() => void refreshLocations(task.id)}
                        disabled={fetchingLocations}
                      >
                        {fetchingLocations ? (
                          <Loader2 className="mr-1 size-3 animate-spin" />
                        ) : (
                          <RefreshCw className="mr-1 size-3" />
                        )}
                        Fetch from backend
                      </Button>
                    </div>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        {(() => {
                          const taskWarehouseId = normalizeWarehouseId(task.warehouse_id);
                          const matchingLocations = locations.filter(
                            (location) =>
                              normalizeWarehouseId(location.warehouse_id) === taskWarehouseId,
                          );
                          const availableLocations = matchingLocations.filter(
                            (location) => location.available_capacity >= task.quantity,
                          );

                          return (
                            <>
                        <select
                          className="h-10 w-full rounded-lg border bg-background px-3 text-sm pr-10"
                          value={selections[task.id] ?? ""}
                          onChange={(event) =>
                            setSelections((current) => ({
                              ...current,
                              [task.id]: event.target.value,
                            }))
                          }
                        >
                          <option value="">Select warehouse / zone / rack / bin</option>
                          {availableLocations.map((location) => (
                              <option key={location.id} value={location.id}>
                                {location.location_code} ({location.available_capacity.toLocaleString()}{" "}
                                available)
                              </option>
                          ))}
                        </select>
                        {matchingLocations.length === 0 && !fetchingLocations && (
                          <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-background/80 text-[10px] text-destructive font-bold pointer-events-none px-4 text-center">
                            No locations found in {task.warehouse_id}. Found {locations.length} total locations in registry.
                          </div>
                        )}
                            </>
                          );
                        })()}
                      </div>
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
                </>
              )}
              {task.status === "ASSIGNED" && (
                <Button
                  className="mt-4 w-full rounded-xl"
                  disabled={saving === task.id}
                  onClick={() => void start(task)}
                >
                  <Play className="size-4" /> Start Physical Movement
                </Button>
              )}
              {task.status === "PUTAWAY_IN_PROGRESS" && (
                <div className="mt-4 space-y-3 rounded-xl border border-primary/25 bg-primary/5 p-4">
                  <p className="flex items-center gap-2 text-sm font-bold">
                    <ScanLine className="size-4 text-primary" /> Scan and confirm movement
                  </p>
                  <div className="grid gap-2 rounded-xl border bg-background p-3 text-xs sm:grid-cols-2">
                    <Confirmation label="Material code" value={task.item_code} />
                    <Confirmation label="Material name" value={task.material_name} />
                    <Confirmation
                      label="Quantity"
                      value={`${task.quantity.toLocaleString()} ${task.uom}`}
                    />
                    <Confirmation
                      label="Expected HU barcode"
                      value={
                        task.handling_unit_barcode || task.handling_unit_number || "Not generated"
                      }
                    />
                    <Confirmation label="Source" value={task.source_location} />
                    <Confirmation
                      label="Destination"
                      value={
                        task.destination_location_code || task.destination_bin || "Not assigned"
                      }
                    />
                    <Confirmation
                      label="Assigned operator"
                      value={task.assigned_to || "Not assigned"}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Input
                      placeholder={
                        task.handling_unit_barcode
                          ? `Scan ${task.handling_unit_barcode}`
                          : "Scan HU QR / barcode"
                      }
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
                  <div className="grid gap-2 sm:grid-cols-3">
                    <Input
                      placeholder="Batch / lot (if applicable)"
                      value={confirmations[task.id]?.batch ?? ""}
                      onChange={(event) => updateConfirmation(task.id, "batch", event.target.value)}
                    />
                    <Input
                      placeholder="Serial number (if applicable)"
                      value={confirmations[task.id]?.serial ?? ""}
                      onChange={(event) =>
                        updateConfirmation(task.id, "serial", event.target.value)
                      }
                    />
                    <Input
                      placeholder="Container / pallet (if applicable)"
                      value={confirmations[task.id]?.container ?? ""}
                      onChange={(event) =>
                        updateConfirmation(task.id, "container", event.target.value)
                      }
                    />
                  </div>
                  <Input
                    placeholder={
                      task.destination_location_code
                        ? `Scan location code ${task.destination_location_code}`
                        : "Scan destination bin code"
                    }
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
              {task.audit_trail?.length ? <AuditTrail task={task} /> : null}
              {task.assigned_at && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Operator {task.assigned_to} assigned by {task.assigned_by} ·{" "}
                  {new Date(task.assigned_at).toLocaleString()}
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
function AuditTrail({ task }: { task: Task }) {
  return (
    <div className="mt-4 rounded-xl border bg-muted/20 p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Audit Trail</p>
      <p className="mt-2 font-mono text-sm font-bold">{task.grn_number}</p>
      <div className="mt-3 border-l-2 border-primary/30 pl-4">
        {task.audit_trail?.map((event) => (
          <div key={`${event.status}-${event.timestamp}`} className="relative pb-4 last:pb-0">
            <span className="absolute -left-[21px] top-1 size-2.5 rounded-full bg-primary" />
            <p className="text-sm font-bold">{event.label}</p>
            {event.status === "PUTAWAY_COMPLETED" && (
              <p className="mt-1 font-mono text-xs text-muted-foreground">
                Source: {event.source} · Destination: {event.destination} ·{" "}
                {event.quantity?.toLocaleString()} {event.uom}
              </p>
            )}
            <p className="mt-1 text-xs text-muted-foreground">
              {event.operator ? `Operator ${event.operator} · ` : ""}
              {event.actor || "System"} · {new Date(event.timestamp).toLocaleString()}
            </p>
          </div>
        ))}
      </div>
    </div>
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
function Confirmation({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="uppercase text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-mono font-semibold">{value}</p>
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
