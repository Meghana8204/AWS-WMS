import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Boxes, Eye, History, Loader2, RefreshCw, Truck, FileQuestion } from "lucide-react";
import { AppShell, StatusBadge } from "@/components/wms/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { api } from "@/lib/api-client";
import { requireRole } from "@/lib/auth-utils";

export const Route = createFileRoute("/vehicle-queue")({
  beforeLoad: () => requireRole("GATE_SECURITY"),
  head: () => ({ meta: [{ title: "Inbound Arrivals · NexusWMS" }] }),
  validateSearch: (search: Record<string, unknown>) => {
    return {
      status: (search.status as string) || undefined,
    };
  },
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
  status: string;
  assigned_dock_id?: string | null;
  po_id?: string | null;
  assigned_by?: string | null;
  assigned_at?: string | null;
  movement_started_by?: string | null;
  movement_started_at?: string | null;
  dock_checked_in_by?: string | null;
  dock_arrival_at?: string | null;
  receiving_completed_at?: string | null;
  dock_released_at?: string | null;
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

function InboundArrivals() {
  const { status: filterStatus } = useSearch({ from: "/vehicle-queue" });
  return <ArrivalsPage filterStatus={filterStatus} />;
}

export function ArrivalsPage({ filterStatus }: { filterStatus?: string }) {
  const [arrivals, setArrivals] = useState<Arrival[]>([]);
  const [docks, setDocks] = useState<Dock[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [moving, setMoving] = useState<string | null>(null);
  const [view, setView] = useState<"active" | "history">("active");

  const historyStatuses = new Set(["RECEIVING_COMPLETED", "EXIT_APPROVED", "GATE_EXIT_COMPLETED"]);

  const filteredArrivals = filterStatus
    ? arrivals.filter(a => a.status === filterStatus)
    : arrivals;

  const activeArrivals = filteredArrivals.filter((arrival) => !historyStatuses.has(arrival.status));
  const historyArrivals = filteredArrivals.filter((arrival) => historyStatuses.has(arrival.status));
  const visibleArrivals = view === "active" ? activeArrivals : historyArrivals;

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const [arrivalRows, dockRows] = await Promise.all([api.getInboundArrivals(), api.getDocks()]);
      setArrivals(arrivalRows);
      setDocks(dockRows);
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

  async function startMovement(arrival: Arrival) {
    setMoving(arrival.id);
    try {
      await api.startDockMovement(arrival.id);
      toast.success(`${arrival.vehicle_number} instructed to move to ${arrival.assigned_dock_id}`);
      await load(true);
    } catch (error) {
      toast.error("Unable to start dock movement", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setMoving(null);
    }
  }

  return (
    <AppShell
      title={filterStatus === "UNSCHEDULED_ARRIVAL" ? "Unscheduled Arrivals" : "Inbound arrivals"}
      subtitle={filterStatus === "UNSCHEDULED_ARRIVAL"
        ? "Monitoring unexpected vehicle arrivals at the warehouse gate"
        : "Active inbound vehicles and completed arrival history"
      }
      actions={
        <Button variant="outline" className="rounded-xl" onClick={() => void load()}>
          <RefreshCw className="size-4" /> Refresh
        </Button>
      }
    >
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Summary
          label="Awaiting dock"
          value={activeArrivals.filter((a) => a.status === "AWAITING_DOCK").length}
        />
        <Summary
          label="Dock assigned / moving"
          value={activeArrivals.filter((a) => a.status !== "AWAITING_DOCK").length}
        />
        <Summary
          label="Available docks"
          value={docks.filter((d) => d.status === "AVAILABLE").length}
        />
      </div>
      <div className="mb-3 flex gap-2">
        <Button
          type="button"
          variant={view === "active" ? "default" : "outline"}
          className="rounded-xl"
          onClick={() => setView("active")}
        >
          <Truck className="size-4" /> Active ({activeArrivals.length})
        </Button>
        <Button
          type="button"
          variant={view === "history" ? "default" : "outline"}
          className="rounded-xl"
          onClick={() => setView("history")}
        >
          <History className="size-4" /> History ({historyArrivals.length})
        </Button>
      </div>
      <Card className="overflow-hidden rounded-2xl border-border/70 p-0">
        {loading ? (
          <div className="flex h-64 items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-5 animate-spin" /> Loading arrivals…
          </div>
        ) : visibleArrivals.length === 0 ? (
          <div className="grid h-64 place-items-center text-center text-sm text-muted-foreground">
            <div>
              <Truck className="mx-auto mb-3 size-8" />
              {view === "active"
                ? "No approved vehicles are awaiting warehouse processing."
                : "No completed arrival history yet."}
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
                    "Status",
                    "Actions",
                  ].map((h) => (
                    <th key={h} className="px-4 py-3 font-semibold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {visibleArrivals.map((arrival) => (
                  <ArrivalRows
                    key={arrival.id}
                    arrival={arrival}
                    expanded={expanded === arrival.id}
                    onToggle={() => setExpanded(expanded === arrival.id ? null : arrival.id)}
                    onMove={() => void startMovement(arrival)}
                    moving={moving === arrival.id}
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
  onMove,
  moving,
}: {
  arrival: Arrival;
  expanded: boolean;
  onToggle: () => void;
  onMove: () => void;
  moving: boolean;
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
          <Link
            to="/procurement/purchase-orders"
            className="font-mono text-primary hover:underline"
          >
            {arrival.po_number}
          </Link>
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
            <p className="mt-1 text-xs font-semibold">{arrival.assigned_dock_id}</p>
          )}
        </td>
        <td className="px-4 py-4">
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="rounded-lg" onClick={onToggle}>
              <Eye className="size-3.5" /> Details
            </Button>
            {arrival.status === "DOCK_ASSIGNED" && (
              <Button size="sm" className="rounded-lg" disabled={moving} onClick={onMove}>
                {moving ? <Loader2 className="size-3.5 animate-spin" /> : <Truck className="size-3.5" />}
                Move to dock
              </Button>
            )}
          </div>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={7} className="bg-muted/20 px-4 py-5">
            <ArrivalDetails arrival={arrival} />
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
}: {
  arrival: Arrival;
}) {
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
          <Detail label="Driver contact" value={arrival.driver_contact} />
          <Detail label="Arrival time" value={new Date(arrival.arrival_time).toLocaleString()} />
        </dl>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
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
        {/* Dock movement controls intentionally removed from Inbound Arrivals.
        <div>
          <h3 className="mb-3 flex items-center gap-2 font-semibold">
            <Warehouse className="size-4 text-primary" /> Dock movement
          </h3>
          {["RECEIVING_COMPLETED", "EXIT_APPROVED", "GATE_EXIT_COMPLETED"].includes(
            arrival.status,
          ) ? (
            <div className="rounded-xl border border-success/30 bg-success-soft p-4">
              <p className="font-semibold">Arrival workflow completed</p>
              <p className="mt-2 text-xs text-muted-foreground">
                Receiving completed: {arrival.receiving_completed_at
                  ? new Date(arrival.receiving_completed_at).toLocaleString()
                  : "—"}
                <br />
                Dock released: {arrival.dock_released_at
                  ? new Date(arrival.dock_released_at).toLocaleString()
                  : "—"}
                <br />
                Final status: {arrival.status.replaceAll("_", " ")}
              </p>
            </div>
          ) : arrival.status === "AT_DOCK" ? (
            <div className="rounded-xl border border-success/30 bg-success-soft p-4">
              <p className="font-semibold">Vehicle arrived at {arrival.assigned_dock_id}</p>
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
              <p className="font-semibold">Vehicle moving to {arrival.assigned_dock_id}</p>
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
              <p className="font-semibold">Assigned to {arrival.assigned_dock_id}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                By {arrival.assigned_by || "—"}
                <br />
                {arrival.assigned_at ? new Date(arrival.assigned_at).toLocaleString() : "—"}
              </p>
              <Button className="mt-3 w-full rounded-xl" disabled={busy} onClick={onMove}>
                {busy ? <Loader2 className="size-4 animate-spin" /> : <Truck className="size-4" />}{" "}
                Instruct vehicle to move
              </Button>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                {docks.map((d) => (
                  <label
                    key={d.id}
                    className={`flex items-center gap-3 rounded-xl border p-3 text-sm ${d.status === "AVAILABLE" ? "cursor-pointer bg-card" : "cursor-not-allowed opacity-50"}`}
                  >
                    <input
                      type="checkbox"
                      checked={selected === d.id}
                      disabled={d.status !== "AVAILABLE"}
                      onChange={() => onSelect(selected === d.id ? "" : d.id)}
                    />
                    <span className="font-mono font-semibold">{d.id}</span>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {d.zone} · {d.status}
                    </span>
                  </label>
                ))}
              </div>
              <Button
                className="mt-3 w-full rounded-xl"
                disabled={!selected || busy}
                onClick={onAssign}
              >
                {busy ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <ArrowRight className="size-4" />
                )}{" "}
                Assign dock
              </Button>
            </>
          )}
        </div>
        */}
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
