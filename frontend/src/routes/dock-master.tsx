import { createFileRoute } from "@tanstack/react-router";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Edit,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Sliders,
  Warehouse,
  Wrench,
} from "lucide-react";
import { AppShell, StatusBadge } from "@/components/wms/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/dock-master")({
  head: () => ({
    meta: [
      { title: "Dock Master · NexusWMS" },
      {
        name: "description",
        content:
          "Master data management for warehouse docks, operational availability, and maintenance controls.",
      },
    ],
  }),
  component: DockMaster,
});

type Dock = {
  id: string;
  dock_code: string;
  dock_name: string;
  dock_type: string;
  location?: string | null;
  description?: string | null;
  status: "AVAILABLE" | "RESERVED" | "OCCUPIED" | "MAINTENANCE";
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

const DOCK_TYPE_CONFIG: Record<string, { prefix: string; namePrefix: string }> = {
  RAW_MATERIAL: { prefix: "RM", namePrefix: "Raw Material Dock" },
  CHEMICAL_HAZARDOUS: { prefix: "CH", namePrefix: "Chemical/Hazardous Dock" },
  ELECTRICAL: { prefix: "EL", namePrefix: "Electrical Dock" },
  ELECTRONICS: { prefix: "EC", namePrefix: "Electronics Dock" },
  MAIN_RECEIVING: { prefix: "MR", namePrefix: "Main Receiving Dock" },
  CHEMICAL: { prefix: "CH", namePrefix: "Chemical/Hazardous Dock" },
  HAZARDOUS_ITEMS: { prefix: "HZ", namePrefix: "Chemical/Hazardous Dock" },
};

function generateDockCodeAndName(dockType: string, existingDocks: { dock_code?: string }[]) {
  const config = DOCK_TYPE_CONFIG[dockType] || {
    prefix: dockType.slice(0, 2).toUpperCase(),
    namePrefix: `${dockType.replaceAll("_", " ")} Dock`,
  };

  const prefix = config.prefix;
  const regex = new RegExp(`^${prefix}-?(\\d+)`, "i");
  let maxNum = 0;

  for (const d of existingDocks) {
    if (!d.dock_code) continue;
    const match = d.dock_code.trim().match(regex);
    if (match && match[1]) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > maxNum) {
        maxNum = num;
      }
    }
  }

  const nextNumStr = String(maxNum + 1).padStart(2, "0");
  return {
    code: `${prefix}-${nextNumStr}`,
    name: `${config.namePrefix} ${nextNumStr}`,
  };
}

function DockMaster() {
  const [docks, setDocks] = useState<Dock[]>([]);
  const [metrics, setMetrics] = useState<{
    total_docks: number;
    available_docks: number;
    occupied_docks: number;
    reserved_docks: number;
    maintenance_docks: number;
  }>({
    total_docks: 0,
    available_docks: 0,
    occupied_docks: 0,
    reserved_docks: 0,
    maintenance_docks: 0,
  });
  const [loading, setLoading] = useState(true);

  // Filter & Search
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<
    "ALL" | "AVAILABLE" | "RESERVED" | "OCCUPIED" | "MAINTENANCE"
  >("ALL");
  const [dockTypeFilter, setDockTypeFilter] = useState<string>("ALL");

  // Modals & Action States
  const [selectedDetailsDock, setSelectedDetailsDock] = useState<Dock | null>(null);
  const [editingDock, setEditingDock] = useState<Dock | null>(null);
  const [showCreateDock, setShowCreateDock] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);

  const [createDockType, setCreateDockType] = useState("RAW_MATERIAL");
  const [createDockCode, setCreateDockCode] = useState("");
  const [createDockName, setCreateDockName] = useState("");

  const handleDockTypeChange = (newType: string) => {
    setCreateDockType(newType);
    const generated = generateDockCodeAndName(newType, docks);
    setCreateDockCode(generated.code);
    setCreateDockName(generated.name);
  };

  useEffect(() => {
    if (showCreateDock) {
      const generated = generateDockCodeAndName(createDockType, docks);
      setCreateDockCode(generated.code);
      setCreateDockName(generated.name);
    }
  }, [showCreateDock, docks]);

  const loadDocks = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const [docksRes, overviewRes] = await Promise.all([
        api.getDocks(),
        api.getDockOverviewMetrics().catch(() => null),
      ]);

      setDocks(docksRes);

      if (overviewRes) {
        setMetrics(overviewRes);
      } else {
        setMetrics({
          total_docks: docksRes.length,
          available_docks: docksRes.filter((d: Dock) => d.status === "AVAILABLE").length,
          occupied_docks: docksRes.filter((d: Dock) => d.status === "OCCUPIED").length,
          reserved_docks: docksRes.filter((d: Dock) => d.status === "RESERVED").length,
          maintenance_docks: docksRes.filter((d: Dock) => d.status === "MAINTENANCE").length,
        });
      }
    } catch (error) {
      if (!quiet) {
        toast.error("Unable to load dock master data", {
          description: error instanceof Error ? error.message : undefined,
        });
      }
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);

  const isAnyModalOpen = Boolean(selectedDetailsDock || showCreateDock || editingDock);

  useEffect(() => {
    void loadDocks();
    if (isAnyModalOpen) return;
    const timer = window.setInterval(() => void loadDocks(true), 5000);
    return () => window.clearInterval(timer);
  }, [loadDocks, isAnyModalOpen]);

  async function handleToggleMaintenance(dock: Dock) {
    const nextStatus = dock.status === "MAINTENANCE" ? "AVAILABLE" : "MAINTENANCE";
    setActionBusy(true);
    try {
      await api.updateDockStatus(
        dock.id,
        nextStatus,
        nextStatus === "MAINTENANCE" ? "Marked for maintenance" : "Returned to operational service",
      );
      toast.success(`Dock ${dock.dock_code} status updated to ${nextStatus}`);
      if (selectedDetailsDock?.id === dock.id) {
        setSelectedDetailsDock(null);
      }
      await loadDocks(true);
    } catch (error) {
      toast.error("Status update failed", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setActionBusy(false);
    }
  }

  async function handleCreateDock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setActionBusy(true);
    const data = new FormData(event.currentTarget);
    try {
      await api.createDock({
        dock_code: String(data.get("dock_code")),
        dock_name: String(data.get("dock_name")),
        dock_type: String(data.get("dock_type")),
        location: String(data.get("location") || ""),
        description: String(data.get("description") || ""),
        status: String(data.get("status")),
      });
      toast.success("Dock master record created successfully");
      setShowCreateDock(false);
      await loadDocks(true);
    } catch (error) {
      toast.error("Unable to create dock", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setActionBusy(false);
    }
  }

  async function handleEditDock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingDock) return;
    setActionBusy(true);
    const data = new FormData(event.currentTarget);
    try {
      await api.updateDock(editingDock.id, {
        dock_code: String(data.get("dock_code")),
        dock_name: String(data.get("dock_name")),
        dock_type: String(data.get("dock_type")),
        location: String(data.get("location") || ""),
        description: String(data.get("description") || ""),
      });
      toast.success(`Dock ${editingDock.dock_code} updated successfully`);
      setEditingDock(null);
      await loadDocks(true);
    } catch (error) {
      toast.error("Failed to update dock master record", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setActionBusy(false);
    }
  }

  const filteredDocks = docks.filter((dock) => {
    const matchesTab = activeTab === "ALL" || dock.status === activeTab;
    const matchesType = dockTypeFilter === "ALL" || dock.dock_type === dockTypeFilter;
    const q = searchTerm.toLowerCase().trim();
    const matchesSearch =
      !q ||
      dock.dock_code.toLowerCase().includes(q) ||
      dock.dock_name.toLowerCase().includes(q) ||
      (dock.location && dock.location.toLowerCase().includes(q));
    return matchesTab && matchesType && matchesSearch;
  });

  return (
    <AppShell
      title="Dock Master"
      subtitle="Master data management, dock configurations, and maintenance operational states."
      actions={
        <div className="flex gap-2">
          <Button variant="outline" className="rounded-xl text-xs" onClick={() => void loadDocks()}>
            <RefreshCw className="size-4" /> Refresh
          </Button>
          <Button className="rounded-xl text-xs shadow-glow" onClick={() => setShowCreateDock(true)}>
            <Plus className="size-4" /> + New Dock
          </Button>
        </div>
      }
    >
      {/* 1. Full Edge-to-Edge Status Coloured Summary Cards (5 Cards) */}
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <SummaryCard
          label="Total Docks"
          value={metrics.total_docks || (metrics.available_docks + metrics.reserved_docks + metrics.occupied_docks + metrics.maintenance_docks)}
          status="TOTAL"
          active={activeTab === "ALL"}
          onClick={() => setActiveTab("ALL")}
        />
        <SummaryCard
          label="Available Docks"
          value={metrics.available_docks}
          status="AVAILABLE"
          active={activeTab === "AVAILABLE"}
          onClick={() => setActiveTab("AVAILABLE")}
        />
        <SummaryCard
          label="Reserved Docks"
          value={metrics.reserved_docks}
          status="RESERVED"
          active={activeTab === "RESERVED"}
          onClick={() => setActiveTab("RESERVED")}
        />
        <SummaryCard
          label="Occupied Docks"
          value={metrics.occupied_docks}
          status="OCCUPIED"
          active={activeTab === "OCCUPIED"}
          onClick={() => setActiveTab("OCCUPIED")}
        />
        <SummaryCard
          label="Under Maintenance"
          value={metrics.maintenance_docks}
          status="MAINTENANCE"
          active={activeTab === "MAINTENANCE"}
          onClick={() => setActiveTab("MAINTENANCE")}
        />
      </div>

      {/* 2. Filter & Search Controls */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/60 bg-card p-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[260px]">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search dock code, name, location..."
              className="h-9 pl-9 rounded-xl text-xs"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1">
            {(["ALL", "AVAILABLE", "RESERVED", "OCCUPIED", "MAINTENANCE"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "rounded-xl px-3 py-1.5 text-xs font-bold transition-all",
                  activeTab === tab
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {tab === "ALL" ? "TOTAL DOCKS" : tab === "MAINTENANCE" ? "UNDER MAINTENANCE" : tab}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground hidden sm:inline">Dock type:</Label>
          <select
            value={dockTypeFilter}
            onChange={(e) => setDockTypeFilter(e.target.value)}
            className="h-9 rounded-xl border border-border bg-background px-3 text-xs font-medium"
          >
            <option value="ALL">All Types</option>
            <option value="RAW_MATERIAL">Raw Material</option>
            <option value="CHEMICAL_HAZARDOUS">Chemical/Hazardous</option>
            <option value="ELECTRICAL">Electrical</option>
            <option value="ELECTRONICS">Electronics</option>
            <option value="MAIN_RECEIVING">Main Receiving</option>
          </select>
        </div>
      </div>

      {/* 3. Create New Dock Modal Popup */}
      <Dialog open={showCreateDock} onOpenChange={setShowCreateDock}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-semibold text-lg flex items-center gap-2">
              <Sliders className="size-5 text-primary" /> Create New Dock Master
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Add a new dock master record to the WMS inventory.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateDock} className="space-y-3 py-2 text-xs">
            <div>
              <Label htmlFor="dock_type" className="text-xs font-semibold">
                Dock type
              </Label>
              <select
                id="dock_type"
                name="dock_type"
                value={createDockType}
                onChange={(e) => handleDockTypeChange(e.target.value)}
                className="mt-1.5 h-10 w-full rounded-xl border bg-background px-3 text-xs font-medium focus:ring-2 focus:ring-primary"
              >
                <option value="RAW_MATERIAL">RAW_MATERIAL (Raw Material — RM)</option>
                <option value="CHEMICAL_HAZARDOUS">CHEMICAL_HAZARDOUS (Chemical/Hazardous — CH)</option>
                <option value="ELECTRICAL">ELECTRICAL (Electrical — EL)</option>
                <option value="ELECTRONICS">ELECTRONICS (Electronics — EC)</option>
                <option value="MAIN_RECEIVING">MAIN_RECEIVING (Main Receiving — MR)</option>
              </select>
            </div>

            <div>
              <Label htmlFor="dock_code" className="text-xs font-semibold">
                Dock code <span className="text-muted-foreground font-normal">(Auto-generated)</span>
              </Label>
              <Input
                id="dock_code"
                name="dock_code"
                value={createDockCode}
                onChange={(e) => setCreateDockCode(e.target.value)}
                placeholder="e.g. CH-01, HZ-01, RM-03"
                required
                className="mt-1.5 h-10 rounded-xl bg-background font-mono font-semibold"
              />
            </div>

            <div>
              <Label htmlFor="dock_name" className="text-xs font-semibold">
                Dock name
              </Label>
              <Input
                id="dock_name"
                name="dock_name"
                value={createDockName}
                onChange={(e) => setCreateDockName(e.target.value)}
                placeholder="e.g. Chemical Dock 01"
                required
                className="mt-1.5 h-10 rounded-xl bg-background"
              />
            </div>

            <Field name="location" label="Location" placeholder="North Warehouse" />
            <Field name="description" label="Description" placeholder="General Unloading Bay" />
            <div>
              <Label htmlFor="status" className="text-xs font-semibold">
                Status
              </Label>
              <select
                id="status"
                name="status"
                className="mt-1.5 h-10 w-full rounded-xl border bg-background px-3 text-xs font-medium"
              >
                <option value="AVAILABLE">AVAILABLE</option>
                <option value="MAINTENANCE">MAINTENANCE</option>
              </select>
            </div>

            <DialogFooter className="pt-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowCreateDock(false)}
                className="rounded-xl"
              >
                Cancel
              </Button>
              <Button type="submit" disabled={actionBusy} className="rounded-xl shadow-glow">
                {actionBusy && <Loader2 className="size-4 animate-spin" />} Create Dock
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 4. Edit Dock Master Modal Popup */}
      {editingDock && (
        <Dialog open={Boolean(editingDock)} onOpenChange={() => setEditingDock(null)}>
          <DialogContent className="max-w-md rounded-2xl">
            <DialogHeader>
              <DialogTitle className="font-semibold text-lg flex items-center gap-2">
                <Edit className="size-4 text-amber-500" /> Edit Dock Master: {editingDock.dock_code}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Update master data configuration for this dock.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleEditDock} className="space-y-3 py-2 text-xs">
              <Field name="dock_code" label="Dock code" defaultValue={editingDock.dock_code} required />
              <Field name="dock_name" label="Dock name" defaultValue={editingDock.dock_name} required />
              <div>
                <Label htmlFor="edit_dock_type" className="text-xs">
                  Dock type
                </Label>
                <select
                  id="edit_dock_type"
                  name="dock_type"
                  defaultValue={editingDock.dock_type}
                  className="mt-1.5 h-10 w-full rounded-xl border bg-background px-3 text-xs font-medium"
                >
                  <option value="RAW_MATERIAL">RAW_MATERIAL</option>
                  <option value="CHEMICAL_HAZARDOUS">CHEMICAL_HAZARDOUS</option>
                  <option value="ELECTRICAL">ELECTRICAL</option>
                  <option value="ELECTRONICS">ELECTRONICS</option>
                  <option value="MAIN_RECEIVING">MAIN_RECEIVING</option>
                </select>
              </div>
              <Field name="location" label="Location" defaultValue={editingDock.location || ""} />
              <Field name="description" label="Description" defaultValue={editingDock.description || ""} />

              <DialogFooter className="pt-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditingDock(null)}
                  className="rounded-xl"
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={actionBusy} className="rounded-xl bg-amber-500 hover:bg-amber-600 text-white">
                  {actionBusy && <Loader2 className="size-4 animate-spin" />} Save changes
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* 5. Dock Master Cards Grid */}
      {loading ? (
        <div className="flex h-64 items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="size-6 animate-spin text-primary" />
          <p className="text-sm">Loading dock master data...</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filteredDocks.length === 0 ? (
            <div className="col-span-full py-16 text-center text-muted-foreground">
              <Warehouse className="mx-auto mb-2 size-8 text-muted-foreground/50" />
              <p className="text-sm font-semibold">No docks found matching the criteria.</p>
            </div>
          ) : (
            filteredDocks.map((dock) => (
              <MasterDockCard
                key={dock.id}
                dock={dock}
                onViewDetails={() => setSelectedDetailsDock(dock)}
                onEdit={() => setEditingDock(dock)}
                onToggleMaintenance={() => void handleToggleMaintenance(dock)}
              />
            ))
          )}
        </div>
      )}

      {/* 6. View Details Modal */}
      {selectedDetailsDock && (
        <Dialog open={Boolean(selectedDetailsDock)} onOpenChange={() => setSelectedDetailsDock(null)}>
          <DialogContent className="max-w-md rounded-2xl">
            <DialogHeader>
              <div className="flex items-center justify-between">
                <DialogTitle className="font-mono text-xl font-black text-primary">
                  {selectedDetailsDock.dock_code}
                </DialogTitle>
                <StatusBadge status={selectedDetailsDock.status === "MAINTENANCE" ? "Under Maintenance" : selectedDetailsDock.status} />
              </div>
              <DialogDescription className="text-xs">
                {selectedDetailsDock.dock_name} · {selectedDetailsDock.location || "Main DC Facade"}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2 text-xs">
              <div className="rounded-xl border bg-muted/30 p-3 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Dock Code:</span>
                  <span className="font-mono font-bold">{selectedDetailsDock.dock_code}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Dock Name:</span>
                  <span className="font-bold">{selectedDetailsDock.dock_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Dock Type:</span>
                  <span className="font-bold">{selectedDetailsDock.dock_type}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Operational Status:</span>
                  <span className="font-bold">{selectedDetailsDock.status}</span>
                </div>
                {selectedDetailsDock.location && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Location:</span>
                    <span>{selectedDetailsDock.location}</span>
                  </div>
                )}
                {selectedDetailsDock.description && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Description:</span>
                    <span>{selectedDetailsDock.description}</span>
                  </div>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" className="rounded-xl" onClick={() => setSelectedDetailsDock(null)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </AppShell>
  );
}

// Subcomponents
function SummaryCard({
  label,
  value,
  status,
  active,
  onClick,
}: {
  label: string;
  value: number;
  status: "TOTAL" | "AVAILABLE" | "RESERVED" | "OCCUPIED" | "MAINTENANCE";
  active: boolean;
  onClick: () => void;
}) {
  const cardStyles = {
    TOTAL: "bg-blue-500/10 border-blue-500/30 text-blue-950 dark:text-blue-200 hover:border-blue-500/60",
    AVAILABLE: "bg-emerald-500/10 border-emerald-500/30 text-emerald-950 dark:text-emerald-200 hover:border-emerald-500/60",
    RESERVED: "bg-amber-500/10 border-amber-500/30 text-amber-950 dark:text-amber-200 hover:border-amber-500/60",
    OCCUPIED: "bg-rose-500/10 border-rose-500/30 text-rose-950 dark:text-rose-200 hover:border-rose-500/60",
    MAINTENANCE: "bg-slate-500/10 border-slate-500/30 text-slate-900 dark:text-slate-200 hover:border-slate-500/60",
  };

  const countColors = {
    TOTAL: "text-blue-600 dark:text-blue-400",
    AVAILABLE: "text-emerald-600 dark:text-emerald-400",
    RESERVED: "text-amber-600 dark:text-amber-400",
    OCCUPIED: "text-rose-600 dark:text-rose-400",
    MAINTENANCE: "text-slate-600 dark:text-slate-400",
  };

  return (
    <Card
      onClick={onClick}
      className={cn(
        "cursor-pointer rounded-2xl border-2 p-4 transition-all hover:shadow-md",
        cardStyles[status],
        active && "ring-2 ring-primary border-primary shadow-glow",
      )}
    >
      <p className="text-[11px] font-extrabold uppercase tracking-wider font-mono opacity-85">
        {label}
      </p>
      <p className={cn("mt-1 text-3xl font-black tabular-nums tracking-tight", countColors[status])}>
        {value}
      </p>
      <p className="mt-1 text-[10px] font-semibold opacity-70">Click to filter</p>
    </Card>
  );
}

function MasterDockCard({
  dock,
  onViewDetails,
  onEdit,
  onToggleMaintenance,
}: {
  dock: Dock;
  onViewDetails: () => void;
  onEdit: () => void;
  onToggleMaintenance: () => void;
}) {
  const dotColors = {
    AVAILABLE: "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]",
    RESERVED: "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]",
    OCCUPIED: "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]",
    MAINTENANCE: "bg-slate-400",
  };

  const cardBorders = {
    AVAILABLE: "border-emerald-500/30 hover:border-emerald-500/60",
    RESERVED: "border-amber-500/30 hover:border-amber-500/60",
    OCCUPIED: "border-rose-500/30 hover:border-rose-500/60",
    MAINTENANCE: "border-border/80 opacity-75",
  };

  const isMaintenance = dock.status === "MAINTENANCE";

  return (
    <Card
      className={cn(
        "flex flex-col justify-between rounded-2xl border-2 p-5 transition-all shadow-soft hover:-translate-y-0.5",
        cardBorders[dock.status],
      )}
    >
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className={cn("size-3 rounded-full", dotColors[dock.status])} />
            <h3 className="font-mono text-base font-black tracking-tight">{dock.dock_code}</h3>
          </div>
          <StatusBadge status={isMaintenance ? "Under Maintenance" : dock.status} />
        </div>

        <p className="text-xs font-semibold text-muted-foreground">{dock.dock_name}</p>
        <span className="mt-2 inline-block rounded-lg bg-muted px-2 py-0.5 font-mono text-[10px] font-bold text-muted-foreground uppercase">
          {dock.dock_type === "CHEMICAL_HAZARDOUS" ? "Chemical/Hazardous" : dock.dock_type === "ELECTRICAL" ? "Electrical" : dock.dock_type === "ELECTRONICS" ? "Electronics" : dock.dock_type.replaceAll("_", " ")}
        </span>
        {dock.location && (
          <p className="mt-2 text-[11px] text-muted-foreground font-medium">📍 {dock.location}</p>
        )}
      </div>

      <div className="mt-5 space-y-2 pt-3 border-t">
        <div className="flex gap-1.5">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 rounded-xl text-xs"
            onClick={onViewDetails}
          >
            DETAILS
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1 rounded-xl text-xs"
            onClick={onEdit}
          >
            <Edit className="size-3.5" /> EDIT
          </Button>
        </div>

        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "w-full rounded-xl text-xs font-bold",
            isMaintenance ? "text-emerald-600 hover:bg-emerald-500/10" : "text-amber-600 hover:bg-amber-500/10",
          )}
          onClick={onToggleMaintenance}
          disabled={dock.status === "OCCUPIED" || dock.status === "RESERVED"}
        >
          <Wrench className="size-3.5" /> {isMaintenance ? "MAKE AVAILABLE" : "SET UNDER MAINTENANCE"}
        </Button>
      </div>
    </Card>
  );
}

function Field({
  name,
  label,
  placeholder,
  defaultValue,
  required,
}: {
  name: string;
  label: string;
  placeholder?: string;
  defaultValue?: string;
  required?: boolean;
}) {
  return (
    <div>
      <Label htmlFor={name} className="text-xs">
        {label}
      </Label>
      <Input
        id={name}
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="mt-1.5 h-10 rounded-xl text-xs font-medium"
        required={required}
      />
    </div>
  );
}
