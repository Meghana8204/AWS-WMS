import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { GripVertical, ListOrdered, Loader2 } from "lucide-react";
import { AppShell, StatusBadge } from "@/components/wms/app-shell";
import { Card } from "@/components/ui/card";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/vehicle-queue")({
  head: () => ({
    meta: [
      { title: "Vehicle Queue · NexusWMS" },
      { name: "description", content: "Kanban board of the inbound vehicle queue: waiting, dock assigned, receiving and completed trucks." },
      { property: "og:title", content: "Vehicle Queue · NexusWMS" },
      { property: "og:description", content: "Drag trucks across waiting, dock assigned, receiving and completed lanes." },
    ],
  }),
  component: VehicleQueue,
});

type ArrivalStatus = "Waiting" | "Dock Assigned" | "Receiving" | "Completed";

const lanes: { key: ArrivalStatus; tone: string }[] = [
  { key: "Waiting", tone: "bg-warning" },
  { key: "Dock Assigned", tone: "bg-teal" },
  { key: "Receiving", tone: "bg-primary" },
  { key: "Completed", tone: "bg-success" },
];

// Map frontend lane key to backend GateEntryStatus enum value
function mapLaneToBackendStatus(lane: ArrivalStatus): string {
  switch (lane) {
    case "Waiting": return "WAITING";
    case "Dock Assigned": return "DOCK_ASSIGNED";
    case "Receiving": return "RECEIVING";
    case "Completed": return "COMPLETED";
  }
}

// Map backend GateEntryStatus enum value to frontend lane key
function mapBackendStatusToLane(status: string): ArrivalStatus {
  const norm = status.toUpperCase();
  if (norm.includes("DOCK")) return "Dock Assigned";
  if (norm.includes("RECEIV")) return "Receiving";
  if (norm.includes("COMPLET")) return "Completed";
  return "Waiting";
}

function VehicleQueue() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dragId, setDragId] = useState<string | null>(null);

  async function fetchQueue() {
    try {
      const data = await api.getGateEntries();
      setItems(data);
    } catch (err: any) {
      toast.error("Failed to load vehicle queue: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchQueue();
  }, []);

  async function drop(lane: ArrivalStatus) {
    if (!dragId) return;
    const moved = items.find((i) => i.id === dragId);
    if (!moved) return;

    try {
      // Optimistically update the UI
      setItems((prev) => prev.map((i) => (i.id === dragId ? { ...i, status: mapLaneToBackendStatus(lane) } : i)));
      
      // Call backend to update status
      const backendStatus = mapLaneToBackendStatus(lane);
      await api.verifyGateEntry(dragId, backendStatus === "COMPLETED", `Moved to ${lane} via Kanban board`);
      
      toast.success(`${moved.vehicle_number || moved.truckNo || "Vehicle"} moved to ${lane}`);
    } catch (err: any) {
      toast.error("Failed to update status on server: " + err.message);
      // Revert on error
      fetchQueue();
    } finally {
      setDragId(null);
    }
  }

  return (
    <AppShell title="Vehicle queue" subtitle="Drag a vehicle card between lanes to update its stage">
      {loading ? (
        <div className="flex h-60 items-center justify-center gap-2">
          <Loader2 className="size-6 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading queue from backend...</p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-4">
          {lanes.map((lane) => {
            const cards = items.filter((i) => mapBackendStatusToLane(i.status) === lane.key);
            return (
              <div
                key={lane.key}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => drop(lane.key)}
                className="rounded-2xl border border-border/70 bg-muted/40 p-3"
              >
                <div className="mb-3 flex items-center gap-2 px-1">
                  <span className={cn("size-2.5 rounded-full", lane.tone)} />
                  <p className="text-sm font-semibold">{lane.key}</p>
                  <span className="ml-auto rounded-full bg-card px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                    {cards.length}
                  </span>
                </div>
                <div className="space-y-2.5">
                  {cards.length === 0 && (
                    <p className="rounded-xl border border-dashed border-border py-8 text-center text-xs text-muted-foreground">
                      Drop a vehicle here
                    </p>
                  )}
                  {cards.map((c) => (
                    <Card
                      key={c.id}
                      draggable
                      onDragStart={() => setDragId(c.id)}
                      className="cursor-grab gap-0 rounded-xl border-border/70 p-3 shadow-soft transition-shadow active:cursor-grabbing hover:shadow-lift"
                    >
                      <div className="flex items-start gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <Link to="/gate-entry" className="font-mono text-[13px] font-semibold text-primary hover:underline">
                              {c.vehiclePlate || c.vehicle_number || c.truckNo || "MH 12 QT 4489"}
                            </Link>
                            <StatusBadge status={c.status} />
                          </div>
                          <p className="mt-1 truncate text-xs text-muted-foreground">{c.driverName || c.driver_name || "Unknown Driver"}</p>
                          <p className="mt-1 font-mono text-[10px] text-muted-foreground uppercase tracking-tight">PO: {c.poNumber || c.po_number || "PO-2026"}</p>
                        </div>
                        {c.truckPhotoBase64 ? (
                          <div className="size-12 shrink-0 overflow-hidden rounded-lg border border-border/40">
                            <img
                              src={`data:image/jpeg;base64,${c.truckPhotoBase64}`}
                              alt="Vehicle"
                              className="h-full w-full object-cover"
                            />
                          </div>
                        ) : (
                          <div className="grid size-12 shrink-0 place-items-center rounded-lg bg-muted border border-border/40 text-muted-foreground">
                            <GripVertical className="size-4" />
                          </div>
                        )}
                      </div>
                      <div className="mt-2.5 flex items-center gap-2 border-t border-border/40 pt-2">
                        {c.dock_number && <span className="text-[10px] font-bold text-muted-foreground">DOCK {c.dock_number}</span>}
                        <span className="text-[10px] text-muted-foreground ml-auto">{new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
      <p className="mt-5 flex items-center gap-2 rounded-2xl border border-border/70 bg-card p-4 text-xs text-muted-foreground shadow-soft">
        <ListOrdered className="size-4 text-primary" />
        Lane changes publish instantly to the yard display boards and driver SMS notifications.
      </p>
    </AppShell>
  );
}
