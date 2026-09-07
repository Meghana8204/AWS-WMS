import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Boxes,
  CheckCircle2,
  Clock,
  Filter,
  Info,
  Loader2,
  MapPin,
  RefreshCw,
  Save,
  Send,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell, StatusBadge } from "@/components/wms/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api-client";

export const Route = createFileRoute("/putaway-tasks")({
  head: () => ({
    meta: [
      { title: "Putaway Management · NexusWMS" },
      {
        name: "description",
        content:
          "Warehouse store assignment and putaway tracking. Warehouse assigns destination stores and monitors physical execution by Store Keepers.",
      },
    ],
  }),
  component: WarehousePutawayTasksPage,
});

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
  destination_store_id?: string;
  destination_zone_id?: string;
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

type Zone = {
  id: string;
  store_id: string;
  zone_code: string;
  zone_name: string;
  status: string;
};

type Store = {
  id: string;
  store_code: string;
  store_name: string;
  warehouse_id: string;
  status: string;
  zones?: Zone[];
};

function WarehousePutawayTasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string>();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Store & Zone selections: taskId -> { storeId, zoneId }
  const [storeSelections, setStoreSelections] = useState<Record<string, string>>({});
  const [zoneSelections, setZoneSelections] = useState<Record<string, string>>({});

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const [nextTasks, storeHierarchy] = await Promise.all([
        api.getPutawayTasks(),
        api.getStoreHierarchy().catch(() => []),
      ]);
      setTasks(nextTasks);
      setStores(storeHierarchy);

      // Pre-populate selections from assigned tasks
      const initialStores: Record<string, string> = {};
      const initialZones: Record<string, string> = {};

      nextTasks.forEach((task: Task) => {
        if (task.destination_store_id) {
          initialStores[task.id] = task.destination_store_id;
        }
        if (task.destination_zone_id) {
          initialZones[task.id] = task.destination_zone_id;
        }
      });

      setStoreSelections(initialStores);
      setZoneSelections(initialZones);
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

  const handleStoreChange = (taskId: string, storeId: string): void => {
    setStoreSelections((current) => ({ ...current, [taskId]: storeId }));
    setZoneSelections((current) => {
      const next = { ...current };
      delete next[taskId];
      return next;
    });
  };

  const handleZoneChange = (taskId: string, zoneId: string): void => {
    setZoneSelections((current) => ({ ...current, [taskId]: zoneId }));
  };

  const assignStoreAndNotify = async (task: Task): Promise<void> => {
    const storeId = storeSelections[task.id] || task.destination_store_id;
    const zoneId = zoneSelections[task.id] || task.destination_zone_id;

    if (!storeId) {
      toast.error("Please select a Destination Store");
      return;
    }

    setSaving(task.id);
    try {
      const updated = await api.assignPutawayLocation(
        task.id,
        undefined,
        storeId,
        zoneId || undefined,
      );
      setTasks((current) => current.map((item) => (item.id === task.id ? updated : item)));
      const assignedStore = stores.find((s) => s.id === storeId);
      toast.success("Destination Store Assigned & Notified", {
        description: `Notification sent to ${assignedStore?.store_name || "Store"}. Awaiting Store Keeper physical confirmation.`,
      });
    } catch (error) {
      toast.error("Unable to assign Destination Store", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setSaving(undefined);
    }
  };

  const getStoreName = (storeId?: string): string | null => {
    if (!storeId) return null;
    const store = stores.find((s) => s.id === storeId);
    return store ? `${store.store_name} (${store.store_code})` : storeId;
  };

  const getZoneName = (storeId?: string, zoneId?: string): string | null => {
    if (!zoneId) return null;
    if (storeId) {
      const store = stores.find((s) => s.id === storeId);
      const zone = store?.zones?.find((z) => z.id === zoneId);
      if (zone) return `${zone.zone_name} (${zone.zone_code})`;
    }
    for (const s of stores) {
      const zone = s.zones?.find((z) => z.id === zoneId);
      if (zone) return `${zone.zone_name} (${zone.zone_code})`;
    }
    return zoneId;
  };

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      const matchesStatus =
        statusFilter === "ALL" || task.status?.toUpperCase() === statusFilter.toUpperCase();

      const q = search.trim().toLowerCase();
      const matchesSearch =
        !q ||
        task.task_number.toLowerCase().includes(q) ||
        task.grn_number.toLowerCase().includes(q) ||
        task.item_code.toLowerCase().includes(q) ||
        task.material_name.toLowerCase().includes(q);

      return matchesStatus && matchesSearch;
    });
  }, [tasks, search, statusFilter]);

  const metrics = useMemo(() => {
    const total = tasks.length;
    const pending = tasks.filter((t) => t.status === "PUTAWAY_PENDING").length;
    const assigned = tasks.filter((t) => t.status === "ASSIGNED_TO_STORE").length;
    const inProgress = tasks.filter((t) => t.status === "PUTAWAY_IN_PROGRESS").length;
    const completed = tasks.filter((t) => t.status === "PUTAWAY_COMPLETED").length;
    return { total, pending, assigned, inProgress, completed };
  }, [tasks]);

  return (
    <AppShell
      title="Putaway Task Assignment"
      subtitle="Assign destination Stores for incoming GRN goods and monitor Store Keeper execution."
      actions={
        <Button variant="outline" className="rounded-xl" onClick={() => void load()}>
          <RefreshCw className="size-4" /> Refresh
        </Button>
      }
    >
      {/* Metrics Banner */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Card className="rounded-xl p-3.5 shadow-sm border bg-card">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Total Tasks
          </p>
          <p className="text-xl font-black text-foreground mt-0.5">{metrics.total}</p>
        </Card>
        <Card className="rounded-xl p-3.5 shadow-sm border bg-amber-500/5 border-amber-500/20">
          <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider">
            Needs Assignment
          </p>
          <p className="text-xl font-black text-amber-700 dark:text-amber-400 mt-0.5">
            {metrics.pending}
          </p>
        </Card>
        <Card className="rounded-xl p-3.5 shadow-sm border bg-blue-500/5 border-blue-500/20">
          <p className="text-[11px] font-semibold text-blue-700 dark:text-blue-400 uppercase tracking-wider">
            Store Notified
          </p>
          <p className="text-xl font-black text-blue-700 dark:text-blue-400 mt-0.5">
            {metrics.assigned}
          </p>
        </Card>
        <Card className="rounded-xl p-3.5 shadow-sm border bg-purple-500/5 border-purple-500/20">
          <p className="text-[11px] font-semibold text-purple-700 dark:text-purple-400 uppercase tracking-wider">
            In Physical Execution
          </p>
          <p className="text-xl font-black text-purple-700 dark:text-purple-400 mt-0.5">
            {metrics.inProgress}
          </p>
        </Card>
        <Card className="rounded-xl p-3.5 shadow-sm border bg-emerald-500/5 border-emerald-500/20 col-span-2 sm:col-span-1">
          <p className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
            Completed & In Stock
          </p>
          <p className="text-xl font-black text-emerald-700 dark:text-emerald-400 mt-0.5">
            {metrics.completed}
          </p>
        </Card>
      </div>

      {/* Role Notice */}
      <div className="flex items-start gap-3 rounded-xl border border-blue-500/25 bg-blue-500/5 p-3.5 text-xs text-blue-900 dark:text-blue-300">
        <Info className="size-4 shrink-0 text-blue-600 mt-0.5" />
        <div>
          <span className="font-bold">Warehouse Assignment Authority:</span> Warehouse selects and
          assigns the destination Store and dispatches notification. Physical QR scanning, Zone
          verification, and stock confirmation are securely executed by the assigned Store Keeper in
          their <b>My Store</b> portal.
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Input
          placeholder="Search by task #, GRN #, material code, or name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-md text-xs rounded-xl"
        />
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
            <Filter className="size-3.5" /> Status:
          </span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-9 rounded-xl border bg-background px-3 text-xs font-medium"
          >
            <option value="ALL">All Statuses</option>
            <option value="PUTAWAY_PENDING">Needs Assignment</option>
            <option value="ASSIGNED_TO_STORE">Store Notified</option>
            <option value="PUTAWAY_IN_PROGRESS">In Progress</option>
            <option value="PUTAWAY_COMPLETED">Completed</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="grid h-64 place-items-center">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      ) : filteredTasks.length === 0 ? (
        <Card className="grid h-64 place-items-center rounded-2xl text-sm text-muted-foreground">
          <div className="text-center">
            <Boxes className="mx-auto mb-3 size-8" />
            No putaway tasks match the selected filter.
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {filteredTasks.map((task) => {
            const selectedStoreId = storeSelections[task.id] || task.destination_store_id;
            const selectedStore = stores.find((s) => s.id === selectedStoreId);
            const activeZones = selectedStore?.zones?.filter((z) => z.status === "ACTIVE") || [];

            const assignedStoreDisplay =
              getStoreName(task.destination_store_id) || "Store unassigned";
            const assignedZoneDisplay =
              getZoneName(task.destination_store_id, task.destination_zone_id) ||
              task.destination_zone ||
              "Zone optional / Store Keeper selects";

            const isPendingAssignment = task.status === "PUTAWAY_PENDING";
            const isAssigned = task.status === "ASSIGNED_TO_STORE";
            const isInProgress = task.status === "PUTAWAY_IN_PROGRESS";
            const isCompleted = task.status === "PUTAWAY_COMPLETED";

            return (
              <Card key={task.id} className="rounded-2xl p-5 shadow-sm border">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Putaway Task
                    </p>
                    <h2 className="font-mono text-base font-bold text-primary">
                      {task.task_number}
                    </h2>
                    <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                      GRN: <span className="font-semibold text-foreground">{task.grn_number}</span>
                    </p>
                  </div>
                  <StatusBadge status={task.status} />
                </div>

                <div className="my-4 rounded-xl border bg-muted/20 p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-bold text-foreground">{task.material_name}</p>
                      <p className="font-mono text-xs text-muted-foreground">{task.item_code}</p>
                    </div>
                    <p className="text-right text-lg font-black text-primary">
                      {task.quantity.toLocaleString()}{" "}
                      <span className="text-xs font-normal text-muted-foreground">{task.uom}</span>
                    </p>
                  </div>
                </div>

                <div className="grid items-center gap-3 sm:grid-cols-[1fr_auto_1fr]">
                  <Location
                    label="Source Location"
                    value={task.source_location.replaceAll("_", " ")}
                  />
                  <ArrowRight className="mx-auto size-5 text-primary" />
                  <Location
                    label="Destination Store"
                    value={task.destination_store_id ? `${assignedStoreDisplay}` : "Not assigned"}
                  />
                </div>

                {/* Warehouse Assignment Action */}
                {(isPendingAssignment || isAssigned) && (
                  <div className="mt-4 space-y-3 rounded-xl border bg-muted/20 p-3.5">
                    <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                      <Send className="size-3.5 text-primary" /> Assign Destination Store & Notify
                    </p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {/* Store Selector */}
                      <div>
                        <label className="mb-1 block text-xs font-medium text-muted-foreground">
                          Destination Store <span className="text-destructive">*</span>
                        </label>
                        <select
                          className="h-9.5 w-full rounded-lg border bg-background px-3 text-xs font-medium"
                          value={storeSelections[task.id] ?? task.destination_store_id ?? ""}
                          onChange={(e) => handleStoreChange(task.id, e.target.value)}
                        >
                          <option value="">Select Destination Store</option>
                          {stores
                            .filter((s) => s.status === "ACTIVE")
                            .map((store) => (
                              <option key={store.id} value={store.id}>
                                {store.store_name} ({store.store_code})
                              </option>
                            ))}
                        </select>
                      </div>

                      {/* Zone Selector */}
                      <div>
                        <label className="mb-1 block text-xs font-medium text-muted-foreground">
                          Target Zone (Optional)
                        </label>
                        <select
                          className="h-9.5 w-full rounded-lg border bg-background px-3 text-xs font-medium"
                          value={zoneSelections[task.id] ?? task.destination_zone_id ?? ""}
                          onChange={(e) => handleZoneChange(task.id, e.target.value)}
                          disabled={!selectedStoreId}
                        >
                          <option value="">
                            {!selectedStoreId
                              ? "Select store first"
                              : "Default / Store Keeper Choice"}
                          </option>
                          {activeZones.map((zone) => (
                            <option key={zone.id} value={zone.id}>
                              {zone.zone_name} ({zone.zone_code})
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="flex justify-end pt-1">
                      <Button
                        size="sm"
                        className="rounded-lg"
                        disabled={
                          !(storeSelections[task.id] || task.destination_store_id) ||
                          saving === task.id
                        }
                        onClick={() => void assignStoreAndNotify(task)}
                      >
                        {saving === task.id ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <Send className="size-3.5" />
                        )}{" "}
                        {task.destination_store_id
                          ? "Update Store & Re-notify"
                          : "Assign Store & Notify"}
                      </Button>
                    </div>
                  </div>
                )}

                {/* Status: ASSIGNED_TO_STORE */}
                {isAssigned && (
                  <div className="mt-4 rounded-xl border border-blue-500/25 bg-blue-500/10 p-3 text-xs text-blue-800 dark:text-blue-300 flex items-start gap-2">
                    <Clock className="size-4 shrink-0 text-blue-600 mt-0.5" />
                    <div>
                      <p className="font-bold">Notification Dispatched to Store Keeper</p>
                      <p className="mt-0.5 text-muted-foreground">
                        Assigned to {assignedStoreDisplay}. Waiting for the assigned Store Keeper to
                        scan QR codes and confirm physical receipt.
                      </p>
                    </div>
                  </div>
                )}

                {/* Status: IN PROGRESS */}
                {isInProgress && (
                  <div className="mt-4 rounded-xl border border-purple-500/25 bg-purple-500/10 p-3 text-xs text-purple-800 dark:text-purple-300 flex items-start gap-2">
                    <Loader2 className="size-4 shrink-0 text-purple-600 animate-spin mt-0.5" />
                    <div>
                      <p className="font-bold">Store Keeper Executing Physical Putaway</p>
                      <p className="mt-0.5 text-muted-foreground">
                        Started by{" "}
                        <span className="font-semibold text-foreground">{task.started_by}</span> at{" "}
                        {task.started_at ? new Date(task.started_at).toLocaleTimeString() : ""}.
                        Store Keeper is verifying Material QR and scanning Zone QR.
                      </p>
                    </div>
                  </div>
                )}

                {/* Status: COMPLETED */}
                {isCompleted && (
                  <div className="mt-4 rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3.5 text-xs text-emerald-700 dark:text-emerald-400">
                    <p className="flex items-center gap-1.5 font-bold">
                      <CheckCircle2 className="size-4 text-emerald-600" /> Physical Putaway
                      Confirmed
                    </p>
                    <p className="mt-1">
                      Confirmed by <span className="font-semibold">{task.completed_by}</span> at{" "}
                      {task.completed_at ? new Date(task.completed_at).toLocaleString() : ""}.
                      Stored in {assignedStoreDisplay} → {assignedZoneDisplay}. Available in
                      inventory.
                    </p>
                  </div>
                )}

                <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground pt-2 border-t">
                  <span>GRN Created: {new Date(task.created_at).toLocaleDateString()}</span>
                  {task.location_assigned_by && (
                    <span>Assigned by: {task.location_assigned_by}</span>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}

function Location({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-muted/10 p-3">
      <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        <MapPin className="size-3" />
        {label}
      </p>
      <p className="mt-1 font-mono text-xs font-semibold text-foreground truncate" title={value}>
        {value}
      </p>
    </div>
  );
}
