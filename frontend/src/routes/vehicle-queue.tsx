import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowRight, Boxes, Check, CheckCircle2, Eye, Loader2, RefreshCw, Store as StoreIcon, Truck, Warehouse } from "lucide-react";
import { AppShell, StatusBadge } from "@/components/wms/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api-client";
export const Route = createFileRoute("/vehicle-queue")({
  head: () => ({ meta: [{ title: "Inbound Arrivals · NexusWMS" }] }),
  component: InboundArrivals,
});
type Arrival = {
  id: string;
  gate_entry_number: string;
  asn_id: string;
  asn_number: string;
  po_number: string;
  supplier_name: string;
  vehicle_number: string;
  driver_name: string;
  driver_contact?: string | null;
  arrival_time: string;
  expected_arrival_at?: string | null;
  status: "AWAITING_DOCK" | "DOCK_ASSIGNED" | "MOVING_TO_DOCK" | "AT_DOCK" | "RECEIVING_COMPLETED" | string;
  assigned_dock_id?: string | null;
  assigned_store_id?: string | null;
  assigned_store_code?: string | null;
  assigned_store_name?: string | null;
  po_id?: string | null;
  assigned_by?: string | null;
  assigned_at?: string | null;
  movement_started_by?: string | null;
  movement_started_at?: string | null;
  dock_checked_in_by?: string | null;
  dock_arrival_at?: string | null;
  dock_released_by?: string | null;
  dock_released_at?: string | null;
  receiving_completed_by?: string | null;
  receiving_completed_at?: string | null;
  shipment: {
    transporter?: string;
    number_of_packages?: number;
    package_type?: string;
    shipping_method?: string;
  };
  expected_materials: Array<{
    item_code: string;
    material_name?: string;
    quantity: number;
    uom?: string;
  }>;
};
type Dock = {
  id: string;
  zone: string;
  type: string;
  status: "AVAILABLE" | "OCCUPIED";
  vehicle_number?: string;
};
type Store = {
  id: string;
  store_code: string;
  store_name: string;
  warehouse_id?: string;
  status: string;
};
function InboundArrivals() {
  const [arrivals, setArrivals] = useState<Arrival[]>([]);
  const [docks, setDocks] = useState<Dock[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [selectedDock, setSelectedDock] = useState<Record<string, string>>({});
  const [selectedStore, setSelectedStore] = useState<Record<string, string>>({});
  const [assigning, setAssigning] = useState<string | null>(null);
  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const [arrivalRows, dockRows, storeRows] = await Promise.all([
        api.getInboundArrivals(),
        api.getDocks(),
        api.getStores({ status: "ACTIVE" }).catch(() => []),
      ]);
      setArrivals(arrivalRows);
      setDocks(dockRows);
      setStores(storeRows);
    } catch (error) {
      if (!quiet)
        toast.error("Unable to load inbound arrivals", {
          description: error instanceof Error ? error.message : undefined,
        });
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(true), 5000);
    return () => window.clearInterval(timer);
  }, [load]);
  async function assignDockAndStore(arrival: Arrival) {
    const dockId = selectedDock[arrival.id];
    if (!dockId) {
      toast.error("Select an available dock");
      return;
    }
    const storeId = selectedStore[arrival.id];
    if (!storeId) {
      toast.error("Select a destination store for this arrival");
      return;
    }
    const chosenStore = stores.find((s) => s.id === storeId || s.store_code === storeId);
    setAssigning(arrival.id);
    try {
      await api.assignDock(arrival.id, dockId, storeId);
      toast.success(`Dock ${dockId} & ${chosenStore?.store_name || "Store"} Assigned`, {
        description: `${arrival.vehicle_number} assigned. Notification dispatched to ${chosenStore?.store_name || "Store"}.`,
      });
      await load(true);
    } catch (error) {
      toast.error("Dock & Store assignment failed", {
        description: error instanceof Error ? error.message : undefined,
      });
      await load(true);
    } finally {
      setAssigning(null);
    }
  }
  async function startMovement(arrival: Arrival) {
    setAssigning(arrival.id);
    try {
      await api.startDockMovement(arrival.id);
      toast.success("Vehicle instructed to move", {
        description: `${arrival.vehicle_number} is moving to ${arrival.assigned_dock_id}.`,
      });
      await load(true);
    } catch (error) {
      toast.error("Unable to start dock movement", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setAssigning(null);
    }
  }
  async function confirmDockArrival(arrival: Arrival) {
    setAssigning(arrival.id);
    try {
      await api.confirmDockCheckIn(arrival.id);
      toast.success("Vehicle arrived", {
        description: `${arrival.vehicle_number} checked in at ${arrival.assigned_dock_id}.`,
      });
      await load(true);
    } catch (error) {
      toast.error("Dock check-in failed", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setAssigning(null);
    }
  }
  async function releaseArrivalDock(arrival: Arrival) {
    setAssigning(arrival.id);
    try {
      await api.releaseGateDock(arrival.id);
      toast.success(`Dock ${arrival.assigned_dock_id} Released`, {
        description: `Unloading & receiving completed for ${arrival.vehicle_number}. Dock is now available.`,
      });
      await load(true);
    } catch (error) {
      toast.error("Dock release failed", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setAssigning(null);
    }
  }
  return (
    <AppShell
      title="Inbound arrivals"
      subtitle="Approved gate entries awaiting warehouse dock & store assignment"
      actions={
        <Button variant="outline" className="rounded-xl" onClick={() => void load()}>
          <RefreshCw className="size-4" /> Refresh
        </Button>
      }
    >
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Summary
          label="Awaiting dock & store"
          value={arrivals.filter((a) => a.status === "AWAITING_DOCK").length}
        />
        <Summary
          label="Dock & store assigned"
          value={arrivals.filter((a) => a.status !== "AWAITING_DOCK").length}
        />
        <Summary
          label="Available docks"
          value={docks.filter((d) => d.status === "AVAILABLE").length}
        />
      </div>
      <Card className="overflow-hidden rounded-2xl border-border/70 p-0">
        {loading ? (
          <div className="flex h-64 items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-5 animate-spin" /> Loading arrivals…
          </div>
        ) : arrivals.length === 0 ? (
          <div className="grid h-64 place-items-center text-center text-sm text-muted-foreground">
            <div>
              <Truck className="mx-auto mb-3 size-8" />
              No approved vehicles are awaiting a dock.
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  {[
                    "ASN",
                    "PO",
                    "Supplier",
                    "Vehicle / Driver",
                    "Arrival time",
                    "Status & Assignment",
                    "Actions",
                  ].map((h) => (
                    <th key={h} className="px-4 py-3 font-semibold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {arrivals.map((arrival) => (
                  <ArrivalRows
                    key={arrival.id}
                    arrival={arrival}
                    expanded={expanded === arrival.id}
                    onToggle={() => setExpanded(expanded === arrival.id ? null : arrival.id)}
                    docks={docks}
                    stores={stores}
                    selectedDock={selectedDock[arrival.id] || ""}
                    selectedStore={selectedStore[arrival.id] || ""}
                    onSelectDock={(dockId) => setSelectedDock((v) => ({ ...v, [arrival.id]: dockId }))}
                    onSelectStore={(storeId) => setSelectedStore((v) => ({ ...v, [arrival.id]: storeId }))}
                    onAssign={() => void assignDockAndStore(arrival)}
                    onMove={() => void startMovement(arrival)}
                    onCheckIn={() => void confirmDockArrival(arrival)}
                    onRelease={() => void releaseArrivalDock(arrival)}
                    busy={assigning === arrival.id}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </AppShell>
  );
}
function ArrivalRows({
  arrival,
  expanded,
  onToggle,
  docks,
  stores,
  selectedDock,
  selectedStore,
  onSelectDock,
  onSelectStore,
  onAssign,
  onMove,
  onCheckIn,
  onRelease,
  busy,
}: {
  arrival: Arrival;
  expanded: boolean;
  onToggle: () => void;
  docks: Dock[];
  stores: Store[];
  selectedDock: string;
  selectedStore: string;
  onSelectDock: (id: string) => void;
  onSelectStore: (id: string) => void;
  onAssign: () => void;
  onMove: () => void;
  onCheckIn: () => void;
  onRelease: () => void;
  busy: boolean;
}) {
  return (
    <>
      <tr className="hover:bg-muted/20">
        <td className="px-4 py-4">
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onToggle();
            }}
            aria-expanded={expanded}
            className="font-mono font-semibold text-primary hover:underline"
          >
            {arrival.asn_number}
          </button>
        </td>
        <td className="px-4 py-4">
          <span className="font-mono">{arrival.po_number}</span>
        </td>
        <td className="px-4 py-4 font-medium">{arrival.supplier_name || "—"}</td>
        <td className="px-4 py-4">
          <p className="font-mono font-semibold">{arrival.vehicle_number}</p>
          <p className="text-xs text-muted-foreground">{arrival.driver_name || "—"}</p>
        </td>
        <td className="px-4 py-4">
          {new Date(arrival.arrival_time).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </td>
        <td className="px-4 py-4">
          <StatusBadge status={arrival.status} />
          {arrival.assigned_dock_id && (
            <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-primary">
              <Warehouse className="size-3" /> Dock {arrival.assigned_dock_id}
            </p>
          )}
          {arrival.assigned_store_name && (
            <p className="mt-0.5 flex items-center gap-1 text-xs font-medium text-muted-foreground">
              <StoreIcon className="size-3 text-emerald-600" /> {arrival.assigned_store_name} ({arrival.assigned_store_code})
            </p>
          )}
        </td>
        <td className="px-4 py-4">
          <Button size="sm" variant="outline" className="rounded-lg" onClick={onToggle}>
            <Eye className="size-3.5" /> Details
          </Button>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={7} className="bg-muted/20 px-4 py-5">
            <ArrivalDetails
              arrival={arrival}
              docks={docks}
              stores={stores}
              selectedDock={selectedDock}
              selectedStore={selectedStore}
              onSelectDock={onSelectDock}
              onSelectStore={onSelectStore}
              onAssign={onAssign}
              onMove={onMove}
              onCheckIn={onCheckIn}
              onRelease={onRelease}
              busy={busy}
            />
          </td>
        </tr>
      )}
    </>
  );
}
function Summary({ label, value }: { label: string; value: number }) {
  return (
    <Card className="rounded-2xl p-4">
      <p className="text-xs uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </Card>
  );
}
function ArrivalDetails({
  arrival,
  docks,
  stores,
  selectedDock,
  selectedStore,
  onSelectDock,
  onSelectStore,
  onAssign,
  onMove,
  onCheckIn,
  onRelease,
  busy,
}: {
  arrival: Arrival;
  docks: Dock[];
  stores: Store[];
  selectedDock: string;
  selectedStore: string;
  onSelectDock: (id: string) => void;
  onSelectStore: (id: string) => void;
  onAssign: () => void;
  onMove: () => void;
  onCheckIn: () => void;
  onRelease: () => void;
  busy: boolean;
}) {
  const userInfoStr = typeof window !== "undefined" ? localStorage.getItem("user_info") : null;
  const userInfo = userInfoStr ? JSON.parse(userInfoStr) : null;
  const userRoles: string[] = userInfo?.roles || [];
  const isAdmin = userRoles.includes("ADMIN") || userRoles.includes("SUPERUSER");
  const isStoreUser =
    userRoles.includes("STORE_MANAGER") ||
    userRoles.includes("STORE_KEEPER") ||
    userRoles.includes("STORE");
  const userStoreId = userInfo?.store_id || userInfo?.storeId;
  const userStoreCode = (userInfo?.store_code || userInfo?.storeCode || "").toUpperCase();

  const isAssignedToUserStore = Boolean(
    (userStoreId && arrival.assigned_store_id === userStoreId) ||
      (userStoreCode && arrival.assigned_store_code?.toUpperCase() === userStoreCode),
  );

  const canReleaseDock = isAdmin || (isStoreUser && isAssignedToUserStore);
  return (
    <div className="space-y-5">
      <div className="rounded-xl border bg-card p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Inbound arrival details
            </p>
            <h3 className="mt-1 font-mono text-lg font-bold text-primary">{arrival.asn_number}</h3>
          </div>
          <StatusBadge status={arrival.status} />
        </div>
        <dl className="grid gap-x-6 gap-y-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <Detail label="ASN number" value={arrival.asn_number} mono />
          <Detail label="PO number" value={arrival.po_number} mono />
          <Detail label="Supplier" value={arrival.supplier_name} />
          <Detail label="Current status" value={arrival.status.replaceAll("_", " ")} />
          <Detail label="Vehicle number" value={arrival.vehicle_number} mono />
          <Detail label="Driver" value={arrival.driver_name} />
          <Detail label="Assigned Dock" value={arrival.assigned_dock_id ? `Dock ${arrival.assigned_dock_id}` : "Pending"} mono />
          <Detail label="Assigned Store" value={arrival.assigned_store_name ? `${arrival.assigned_store_name} (${arrival.assigned_store_code})` : "Pending"} />
          <Detail label="Driver contact" value={arrival.driver_contact} />
          <Detail label="Arrival time" value={new Date(arrival.arrival_time).toLocaleString()} />
        </dl>
      </div>
      <div className="grid gap-5 lg:grid-cols-3">
        <div>
          <h3 className="mb-3 flex items-center gap-2 font-semibold">
            <Boxes className="size-4 text-primary" /> Gate entry information
          </h3>
          <dl className="grid grid-cols-2 gap-2 text-xs">
            <dt className="text-muted-foreground">Gate entry</dt>
            <dd className="font-mono">{arrival.gate_entry_number}</dd>
            <dt className="text-muted-foreground">Entry time</dt>
            <dd>{new Date(arrival.arrival_time).toLocaleString()}</dd>
            <dt className="text-muted-foreground">Transporter</dt>
            <dd>{arrival.shipment.transporter || "—"}</dd>
            <dt className="text-muted-foreground">Packages</dt>
            <dd>
              {arrival.shipment.number_of_packages ?? "—"} {arrival.shipment.package_type || ""}
            </dd>
            <dt className="text-muted-foreground">Method</dt>
            <dd>{arrival.shipment.shipping_method || "—"}</dd>
            <dt className="text-muted-foreground">Expected arrival</dt>
            <dd>
              {arrival.expected_arrival_at
                ? new Date(arrival.expected_arrival_at).toLocaleString()
                : "—"}
            </dd>
          </dl>
        </div>
        <div>
          <h3 className="mb-3 font-semibold">Expected materials</h3>
          <div className="space-y-2">
            {arrival.expected_materials.map((m) => (
              <div
                key={m.item_code}
                className="flex justify-between rounded-lg border bg-card px-3 py-2 text-xs"
              >
                <span>
                  <b>{m.item_code}</b>
                  <br />
                  {m.material_name}
                </span>
                <span className="font-semibold">
                  {m.quantity} {m.uom}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <h3 className="mb-3 flex items-center gap-2 font-semibold">
            <Warehouse className="size-4 text-primary" /> Dock & Store assignment
          </h3>
          {arrival.dock_released_at ? (
            <div className="rounded-xl border border-success/30 bg-success-soft p-4">
              <p className="font-semibold text-emerald-800">Dock {arrival.assigned_dock_id} Released</p>
              {arrival.assigned_store_name && (
                <p className="mt-1 text-xs font-semibold text-emerald-700">
                  Assigned Store: {arrival.assigned_store_name} ({arrival.assigned_store_code})
                </p>
              )}
              <p className="mt-2 text-xs text-muted-foreground">
                Released by {arrival.dock_released_by || "Store Keeper"}
                <br />
                {new Date(arrival.dock_released_at).toLocaleString()}
                <br />
                Dock status: AVAILABLE
              </p>
            </div>
          ) : arrival.status === "RECEIVING_COMPLETED" ? (
            <div className="rounded-xl border border-primary/30 bg-primary-soft p-4">
              <p className="font-semibold">Receiving Completed at Dock {arrival.assigned_dock_id}</p>
              {arrival.assigned_store_name && (
                <p className="mt-1 text-xs font-semibold text-emerald-700">
                  Assigned Store: {arrival.assigned_store_name} ({arrival.assigned_store_code})
                </p>
              )}
              <p className="mt-2 text-xs text-muted-foreground">
                Receiving completed by {arrival.receiving_completed_by || "—"}
                <br />
                {arrival.receiving_completed_at ? new Date(arrival.receiving_completed_at).toLocaleString() : "—"}
                <br />
                Unloading complete. Assigned Store Keeper can now release the dock.
              </p>
              {canReleaseDock ? (
                <Button className="mt-3 w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white" disabled={busy} onClick={onRelease}>
                  {busy ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}{" "}
                  Release Dock
                </Button>
              ) : isStoreUser ? (
                <p className="mt-3 rounded-xl border border-warning/30 bg-warning-soft p-2.5 text-xs font-medium text-warning-foreground">
                  Assigned to {arrival.assigned_store_name || "another Store"}. Release restricted to assigned store keeper.
                </p>
              ) : (
                <p className="mt-3 rounded-xl border border-border/80 bg-muted/40 p-2.5 text-xs font-medium text-muted-foreground">
                  Unloading complete. Waiting for {arrival.assigned_store_name || "Assigned Store Keeper"} to release dock.
                </p>
              )}
            </div>
          ) : arrival.status === "AT_DOCK" ? (
            <div className="rounded-xl border border-success/30 bg-success-soft p-4">
              <p className="font-semibold">Vehicle arrived at Dock {arrival.assigned_dock_id}</p>
              {arrival.assigned_store_name && (
                <p className="mt-1 text-xs font-semibold text-emerald-700">
                  Assigned Store: {arrival.assigned_store_name} ({arrival.assigned_store_code})
                </p>
              )}
              <p className="mt-2 text-xs text-muted-foreground">
                Checked in by {arrival.dock_checked_in_by || "—"}
                <br />
                {arrival.dock_arrival_at ? new Date(arrival.dock_arrival_at).toLocaleString() : "—"}
                <br />
                Dock status: OCCUPIED
              </p>
            </div>
          ) : arrival.status === "MOVING_TO_DOCK" ? (
            <div className="rounded-xl border border-primary/30 bg-primary-soft p-4">
              <p className="font-semibold">Vehicle moving to Dock {arrival.assigned_dock_id}</p>
              {arrival.assigned_store_name && (
                <p className="mt-1 text-xs font-semibold text-emerald-700">
                  Assigned Store: {arrival.assigned_store_name} ({arrival.assigned_store_code})
                </p>
              )}
              <p className="mt-2 text-xs text-muted-foreground">
                Instructed by {arrival.movement_started_by || "—"}
                <br />
                {arrival.movement_started_at
                  ? new Date(arrival.movement_started_at).toLocaleString()
                  : "—"}
              </p>
              <Button className="mt-3 w-full rounded-xl" disabled={busy} onClick={onCheckIn}>
                {busy ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Warehouse className="size-4" />
                )}{" "}
                Vehicle arrived
              </Button>
            </div>
          ) : arrival.status === "DOCK_ASSIGNED" ? (
            <div className="rounded-xl border border-success/30 bg-success-soft p-4">
              <p className="font-semibold">Assigned to Dock {arrival.assigned_dock_id}</p>
              {arrival.assigned_store_name && (
                <p className="mt-1 text-xs font-semibold text-emerald-700">
                  Assigned Store: {arrival.assigned_store_name} ({arrival.assigned_store_code})
                </p>
              )}
              <p className="mt-2 text-xs text-muted-foreground">
                Assigned by {arrival.assigned_by || "—"}
                <br />
                {arrival.assigned_at ? new Date(arrival.assigned_at).toLocaleString() : "—"}
              </p>
              <Button className="mt-3 w-full rounded-xl" disabled={busy} onClick={onMove}>
                {busy ? <Loader2 className="size-4 animate-spin" /> : <Truck className="size-4" />}{" "}
                Instruct vehicle to move
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <Label className="text-xs font-semibold uppercase text-muted-foreground mb-1.5 block">
                  1. Select Available Dock
                </Label>
                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                  {docks.map((d) => (
                    <label
                      key={d.id}
                      className={`flex items-center gap-2.5 rounded-xl border p-2.5 text-xs transition-colors ${
                        d.status === "AVAILABLE"
                          ? selectedDock === d.id
                            ? "border-primary bg-primary-soft/10 text-primary font-semibold"
                            : "cursor-pointer bg-card hover:bg-muted/40"
                          : "cursor-not-allowed opacity-40 bg-muted/20"
                      }`}
                    >
                      <input
                        type="radio"
                        name={`dock_${arrival.id}`}
                        checked={selectedDock === d.id}
                        disabled={d.status !== "AVAILABLE"}
                        onChange={() => onSelectDock(d.id)}
                        className="text-primary focus:ring-primary size-3.5"
                      />
                      <span className="font-mono">{d.id}</span>
                      <span className="ml-auto text-[10px] text-muted-foreground">
                        {d.zone} · {d.status}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <Label className="text-xs font-semibold uppercase text-muted-foreground mb-1.5 block">
                  2. Select Destination Store
                </Label>
                {stores.length === 0 ? (
                  <div className="rounded-xl border border-dashed p-3 text-center text-xs text-muted-foreground">
                    No active stores found.
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                    {stores.map((s) => (
                      <label
                        key={s.id}
                        className={`flex items-center gap-2.5 rounded-xl border p-2.5 text-xs transition-colors cursor-pointer ${
                          selectedStore === s.id
                            ? "border-emerald-600 bg-emerald-50 text-emerald-900 font-semibold"
                            : "bg-card hover:bg-muted/40"
                        }`}
                      >
                        <input
                          type="radio"
                          name={`store_${arrival.id}`}
                          checked={selectedStore === s.id}
                          onChange={() => onSelectStore(s.id)}
                          className="text-emerald-600 focus:ring-emerald-600 size-3.5"
                        />
                        <span>{s.store_name}</span>
                        <span className="ml-auto font-mono text-[10px] text-muted-foreground">
                          {s.store_code}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <Button
                className="w-full rounded-xl"
                disabled={!selectedDock || !selectedStore || busy}
                onClick={onAssign}
              >
                {busy ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <ArrowRight className="size-4" />
                )}{" "}
                Assign Dock & Store
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
function Detail({
  label,
  value,
  mono = false,
}: {
  label: string;
  value?: string | null;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={`mt-1 font-semibold ${mono ? "font-mono" : ""}`}>{value || "—"}</dd>
    </div>
  );
}

