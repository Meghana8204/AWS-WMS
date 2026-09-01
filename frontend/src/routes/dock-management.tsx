import { createFileRoute } from "@tanstack/react-router";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  ArrowRight,
  CheckCircle2,
  Edit,
  History,
  Loader2,
  Package,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  Truck,
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/dock-management")({
  head: () => ({
    meta: [
      { title: "Dock Management · NexusWMS" },
      {
        name: "description",
        content:
          "Real-time warehouse dock allocation, vehicle arrival tracking, status management, and operational overview.",
      },
    ],
  }),
  component: DockManagement,
});

type AllocationRequest = {
  id: string;
  existing_gate_pass_id: string;
  vendor_reference?: string | null;
  vehicle_number: string;
  material_reference?: string | null;
  material_description?: string | null;
  quantity?: string | number | null;
  security_approved_at: string;
  priority: string;
  status: string;
  assigned_dock_id?: string | null;
  assigned_dock_code?: string | null;
  assigned_by?: string | null;
  assigned_at?: string | null;
  arrived_at?: string | null;
  released_at?: string | null;
  created_at: string;
};

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
  current_allocation?: AllocationRequest | null;
};

type DockHistory = {
  id: string;
  allocation_request_id: string;
  existing_gate_pass_id?: string | null;
  vehicle_number?: string | null;
  vendor_reference?: string | null;
  dock_code?: string | null;
  action: string;
  previous_status?: string | null;
  new_status: string;
  performed_by: string;
  performed_at: string;
  remarks?: string | null;
};

const DOCK_TYPE_CONFIG: Record<string, { prefix: string; namePrefix: string }> = {
  RAW_MATERIAL: { prefix: "RM", namePrefix: "Raw Material Dock" },
  CHEMICAL: { prefix: "CH", namePrefix: "Chemical Dock" },
  HAZARDOUS_ITEMS: { prefix: "HZ", namePrefix: "Hazardous Dock" },
  ELECTRONICS: { prefix: "EL", namePrefix: "Electronics Dock" },
  MAIN_RECEIVING: { prefix: "MR", namePrefix: "Main Receiving Dock" },
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

function DockManagement() {
  const [docks, setDocks] = useState<Dock[]>([]);
  const [metrics, setMetrics] = useState<{
    total_docks: number;
    available_docks: number;
    occupied_docks: number;
    reserved_docks: number;
    maintenance_docks: number;
    pending_allocations_count: number;
  }>({
    total_docks: 0,
    available_docks: 0,
    occupied_docks: 0,
    reserved_docks: 0,
    maintenance_docks: 0,
    pending_allocations_count: 0,
  });
  const [pendingRequests, setPendingRequests] = useState<AllocationRequest[]>([]);
  const [history, setHistory] = useState<DockHistory[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter & tab controls
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<
    "ALL" | "AVAILABLE" | "RESERVED" | "OCCUPIED" | "MAINTENANCE" | "PENDING" | "HISTORY"
  >("ALL");
  const [dockTypeFilter, setDockTypeFilter] = useState<string>("ALL");

  // Modals & Action States
  const [selectedDetailsDock, setSelectedDetailsDock] = useState<Dock | null>(null);
  const [editingDock, setEditingDock] = useState<Dock | null>(null);
  const [allocateModalDock, setAllocateModalDock] = useState<Dock | null>(null);
  const [allocateModalPendingReq, setAllocateModalPendingReq] = useState<AllocationRequest | null>(null);
  const [selectedRequestIdToAllocate, setSelectedRequestIdToAllocate] = useState<string>("");
  const [selectedDockIdToAllocate, setSelectedDockIdToAllocate] = useState<string>("");

  const [arriveConfirmDock, setArriveConfirmDock] = useState<Dock | null>(null);
  const [releaseConfirmDock, setReleaseConfirmDock] = useState<Dock | null>(null);

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

  const loadAll = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const [docksRes, overviewRes, pendingRes, historyRes] = await Promise.all([
        api.getDocks(),
        api.getDockOverviewMetrics().catch(() => null),
        api.getPendingAllocations().catch(() => []),
        api.getDockHistory().catch(() => []),
      ]);

      setDocks(docksRes);
      setPendingRequests(pendingRes);
      setHistory(historyRes);

      if (overviewRes) {
        setMetrics(overviewRes);
      } else {
        setMetrics({
          total_docks: docksRes.length,
          available_docks: docksRes.filter((d: Dock) => d.status === "AVAILABLE").length,
          occupied_docks: docksRes.filter((d: Dock) => d.status === "OCCUPIED").length,
          reserved_docks: docksRes.filter((d: Dock) => d.status === "RESERVED").length,
          maintenance_docks: docksRes.filter((d: Dock) => d.status === "MAINTENANCE").length,
          pending_allocations_count: pendingRes.length,
        });
      }

      setSelectedDetailsDock((prev) => {
        if (!prev) return null;
        const fresh = docksRes.find((d: Dock) => d.id === prev.id);
        if (!fresh) return prev;
        if (
          fresh.status === prev.status &&
          fresh.updated_at === prev.updated_at &&
          fresh.current_allocation?.id === prev.current_allocation?.id
        ) {
          return prev;
        }
        return fresh;
      });
    } catch (error) {
      if (!quiet) {
        toast.error("Unable to load dock management data", {
          description: error instanceof Error ? error.message : undefined,
        });
      }
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);

  const isAnyModalOpen = Boolean(
    selectedDetailsDock || allocateModalDock || allocateModalPendingReq || arriveConfirmDock || releaseConfirmDock || showCreateDock || editingDock
  );

  useEffect(() => {
    void loadAll();
    if (isAnyModalOpen) return;
    const timer = window.setInterval(() => void loadAll(true), 5000);
    return () => window.clearInterval(timer);
  }, [loadAll, isAnyModalOpen]);

  // Action Handlers
  async function handleAllocateDock() {
    let reqId = "";
    let dockId = "";
    let dockCode = "";

    if (allocateModalPendingReq) {
      reqId = allocateModalPendingReq.id;
      dockId = selectedDockIdToAllocate;
      const d = docks.find((item) => item.id === dockId);
      dockCode = d ? d.dock_code : "Dock";
    } else if (allocateModalDock) {
      reqId = selectedRequestIdToAllocate;
      dockId = allocateModalDock.id;
      dockCode = allocateModalDock.dock_code;
    }

    if (!reqId || !dockId) {
      toast.error("Please select an allocation request and an available dock.");
      return;
    }

    setActionBusy(true);
    try {
      await api.allocateDock(reqId, dockId);
      toast.success(`Dock ${dockCode} allocated successfully`, {
        description: "Status updated to RESERVED. Notifications dispatched to Store Manager & Quality Inspector.",
      });
      setAllocateModalPendingReq(null);
      setAllocateModalDock(null);
      setSelectedDockIdToAllocate("");
      setSelectedRequestIdToAllocate("");
      await loadAll(true);
    } catch (error) {
      toast.error("Allocation failed", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setActionBusy(false);
    }
  }

  async function handleVehicleArrived() {
    if (!arriveConfirmDock) return;
    const reqId = arriveConfirmDock.current_allocation?.id || arriveConfirmDock.id;
    setActionBusy(true);
    try {
      await api.markVehicleArrived(reqId);
      toast.success(`Vehicle Arrived at ${arriveConfirmDock.dock_code}`, {
        description: "Dock status updated to OCCUPIED.",
      });
      setArriveConfirmDock(null);
      setSelectedDetailsDock(null);
      await loadAll(true);
    } catch (error) {
      toast.error("Vehicle arrival update failed", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setActionBusy(false);
    }
  }

  async function handleReleaseDock() {
    if (!releaseConfirmDock) return;
    const reqId = releaseConfirmDock.current_allocation?.id || releaseConfirmDock.id;
    setActionBusy(true);
    try {
      await api.releaseDock(reqId);
      toast.success(`Dock ${releaseConfirmDock.dock_code} released`, {
        description: "Dock status returned to AVAILABLE.",
      });
      setReleaseConfirmDock(null);
      setSelectedDetailsDock(null);
      await loadAll(true);
    } catch (error) {
      toast.error("Dock release failed", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setActionBusy(false);
    }
  }

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
      await loadAll(true);
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
      toast.success("Dock created successfully");
      setShowCreateDock(false);
      await loadAll(true);
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
      await loadAll(true);
    } catch (error) {
      toast.error("Failed to update dock master record", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setActionBusy(false);
    }
  }

  // Filtered Docks
  const filteredDocks = docks.filter((dock) => {
    const matchesTab =
      activeTab === "ALL" ||
      activeTab === "HISTORY" ||
      dock.status === activeTab;
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
      title="Dock Management"
      subtitle="Real-time dock allocation, vehicle arrival tracking, and operational status."
      actions={
        <div className="flex gap-2">
          <Button variant="outline" className="rounded-xl text-xs" onClick={() => void loadAll()}>
            <RefreshCw className="size-4" /> Refresh
          </Button>
          <Button className="rounded-xl text-xs shadow-glow" onClick={() => setShowCreateDock(true)}>
            <Plus className="size-4" /> + New Dock
          </Button>
        </div>
      }
    >
      {/* 1. Full Edge-to-Edge Status Coloured Summary Cards (5 Cards) */}
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
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
        <SummaryCard
          label="Pending Allocations"
          value={metrics.pending_allocations_count || pendingRequests.length}
          status="PENDING"
          active={activeTab === "PENDING"}
          onClick={() => setActiveTab("PENDING")}
        />
      </div>

      {/* 2. Filter Bar & Search */}
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
            {(["ALL", "AVAILABLE", "RESERVED", "OCCUPIED", "MAINTENANCE", "PENDING", "HISTORY"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "rounded-xl px-3 py-1.5 text-xs font-bold transition-all flex items-center gap-1.5",
                  activeTab === tab
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {tab === "ALL" ? "TOTAL DOCKS" : tab === "MAINTENANCE" ? "UNDER MAINTENANCE" : tab === "PENDING" ? "PENDING ALLOCATIONS" : tab}
                {tab === "PENDING" && pendingRequests.length > 0 && (
                  <span className="rounded-full bg-purple-500 text-white px-1.5 py-0.5 text-[10px] font-mono font-black">
                    {pendingRequests.length}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {activeTab !== "HISTORY" && (
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground hidden sm:inline">Dock type:</Label>
            <select
              value={dockTypeFilter}
              onChange={(e) => setDockTypeFilter(e.target.value)}
              className="h-9 rounded-xl border border-border bg-background px-3 text-xs font-medium"
            >
              <option value="ALL">All Types</option>
              <option value="RAW_MATERIAL">Raw Material</option>
              <option value="CHEMICAL">Chemical</option>
              <option value="HAZARDOUS_ITEMS">Hazardous Items</option>
              <option value="ELECTRONICS">Electronics</option>
              <option value="MAIN_RECEIVING">Main Receiving</option>
            </select>
          </div>
        )}
      </div>

      {/* 3. Create New Dock Modal Popup */}
      <Dialog open={showCreateDock} onOpenChange={setShowCreateDock}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-semibold text-lg">Create New Dock</DialogTitle>
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
                <option value="CHEMICAL">CHEMICAL (Chemical — CH)</option>
                <option value="HAZARDOUS_ITEMS">HAZARDOUS_ITEMS (Hazardous — HZ)</option>
                <option value="ELECTRONICS">ELECTRONICS (Electronics — EL)</option>
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
                <Edit className="size-4 text-amber-500" /> Edit Dock: {editingDock.dock_code}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Update master data for this dock.
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
                  <option value="CHEMICAL">CHEMICAL</option>
                  <option value="HAZARDOUS_ITEMS">HAZARDOUS_ITEMS</option>
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

      {/* 5. Section Content View */}
      {loading ? (
        <div className="flex h-64 items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="size-6 animate-spin text-primary" />
          <p className="text-sm">Loading dock management data...</p>
        </div>
      ) : activeTab === "HISTORY" ? (
        /* History Section */
        <Card className="overflow-hidden rounded-2xl p-0 shadow-soft">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-muted/50 text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">
                <tr>
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-4 py-3">Dock Code</th>
                  <th className="px-4 py-3">Gate Pass No</th>
                  <th className="px-4 py-3">Vehicle No</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Status Transition</th>
                  <th className="px-4 py-3">Performed By</th>
                  <th className="px-4 py-3">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {history.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-xs text-muted-foreground">
                      No dock allocation history recorded.
                    </td>
                  </tr>
                ) : (
                  history.map((h) => (
                    <tr key={h.id} className="hover:bg-muted/20">
                      <td className="px-4 py-3 text-xs text-muted-foreground font-mono">
                        {new Date(h.performed_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 font-mono font-bold">{h.dock_code || "—"}</td>
                      <td className="px-4 py-3 font-mono text-primary font-semibold">
                        {h.existing_gate_pass_id || "—"}
                      </td>
                      <td className="px-4 py-3 font-mono font-semibold">
                        {h.vehicle_number || "—"}
                      </td>
                      <td className="px-4 py-3 font-bold text-xs">{h.action}</td>
                      <td className="px-4 py-3 text-xs">
                        <span className="text-muted-foreground">{h.previous_status || "—"}</span>
                        {" → "}
                        <span className="font-bold text-foreground">{h.new_status}</span>
                      </td>
                      <td className="px-4 py-3 text-xs">{h.performed_by}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground max-w-xs truncate">
                        {h.remarks || "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      ) : activeTab === "PENDING" ? (
        /* Pending Allocations Section */
        <Card className="overflow-hidden rounded-2xl p-0 shadow-soft border-purple-500/20">
          <div className="p-4 border-b bg-purple-500/10 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-sm text-purple-950 dark:text-purple-200 flex items-center gap-2">
                <Truck className="size-4 text-purple-600" />
                Approved Vehicles Awaiting Dock Allocation ({pendingRequests.length})
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Vehicles approved at the security gate ready for dock assignment by Warehouse Manager
              </p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-muted/50 text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">
                <tr>
                  <th className="px-4 py-3">Gate Pass No</th>
                  <th className="px-4 py-3">Vehicle Number</th>
                  <th className="px-4 py-3">Vendor / Supplier</th>
                  <th className="px-4 py-3">Material Details</th>
                  <th className="px-4 py-3">Approved At</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {pendingRequests.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-xs text-muted-foreground">
                      No pending dock allocations at this time.
                    </td>
                  </tr>
                ) : (
                  pendingRequests.map((req) => (
                    <tr key={req.id} className="hover:bg-muted/20">
                      <td className="px-4 py-3 font-mono font-bold text-primary">{req.existing_gate_pass_id}</td>
                      <td className="px-4 py-3 font-mono font-bold">{req.vehicle_number}</td>
                      <td className="px-4 py-3 text-xs font-medium">{req.vendor_reference || "Vendor"}</td>
                      <td className="px-4 py-3 text-xs">
                        <div className="font-medium">{req.material_reference || req.material_description || "Material"}</div>
                        {req.quantity && <div className="text-[11px] text-muted-foreground">Qty: {req.quantity}</div>}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground font-mono">
                        {req.security_approved_at ? new Date(req.security_approved_at).toLocaleString() : "—"}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <StatusBadge status="AWAITING_DOCK" />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          size="sm"
                          className="rounded-xl text-xs shadow-glow bg-purple-600 hover:bg-purple-700 text-white flex items-center gap-1"
                          onClick={() => {
                            const avail = docks.filter((d) => d.status === "AVAILABLE");
                            setAllocateModalPendingReq(req);
                            setSelectedDockIdToAllocate(avail[0]?.id || "");
                          }}
                        >
                          <ArrowRight className="size-3.5" /> ALLOCATE DOCK
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        /* Docks Cards Grid View */
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filteredDocks.length === 0 ? (
            <div className="col-span-full py-16 text-center text-muted-foreground">
              <Warehouse className="mx-auto mb-2 size-8 text-muted-foreground/50" />
              <p className="text-sm font-semibold">No docks found matching the criteria.</p>
            </div>
          ) : (
            filteredDocks.map((dock) => (
              <DockCard
                key={dock.id}
                dock={dock}
                hasPendingAllocationRequirement={pendingRequests.length > 0}
                onViewDetails={() => setSelectedDetailsDock(dock)}
                onEdit={() => setEditingDock(dock)}
                onToggleMaintenance={() => void handleToggleMaintenance(dock)}
                onAllocate={() => {
                  setAllocateModalDock(dock);
                  setSelectedRequestIdToAllocate(pendingRequests[0]?.id || "");
                }}
                onVehicleArrived={() => setArriveConfirmDock(dock)}
                onRelease={() => setReleaseConfirmDock(dock)}
              />
            ))
          )}
        </div>
      )}

      {/* 6. View Dock Details Drawer / Modal */}
      {selectedDetailsDock && (
        <Dialog open={Boolean(selectedDetailsDock)} onOpenChange={() => setSelectedDetailsDock(null)}>
          <DialogContent className="max-w-lg rounded-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center justify-between">
                <DialogTitle className="font-mono text-xl font-black text-primary flex items-center gap-2">
                  <Warehouse className="size-5" /> {selectedDetailsDock.dock_code}
                </DialogTitle>
                <StatusBadge status={selectedDetailsDock.status === "MAINTENANCE" ? "Under Maintenance" : selectedDetailsDock.status} />
              </div>
              <DialogDescription className="text-xs">
                {selectedDetailsDock.dock_name} · {selectedDetailsDock.location || "Main DC Facade"}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2 text-xs">
              {/* 1. Dock Details */}
              <div className="rounded-xl border bg-card p-3 space-y-2 shadow-sm">
                <h4 className="font-extrabold uppercase tracking-wider text-[11px] text-primary flex items-center gap-1.5 border-b pb-1.5">
                  <Warehouse className="size-3.5" /> Dock Details
                </h4>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Dock Code & Name</span>
                    <span className="font-mono font-bold text-foreground">{selectedDetailsDock.dock_code} ({selectedDetailsDock.dock_name})</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Dock Type</span>
                    <span className="font-semibold text-foreground">{selectedDetailsDock.dock_type.replaceAll("_", " ")}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Current Status</span>
                    <span className="font-bold text-foreground">{selectedDetailsDock.status}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Assignment Time</span>
                    <span className="font-mono text-foreground font-medium">
                      {selectedDetailsDock.current_allocation?.assigned_at
                        ? new Date(selectedDetailsDock.current_allocation.assigned_at).toLocaleString()
                        : "N/A"}
                    </span>
                  </div>
                </div>
              </div>

              {selectedDetailsDock.status === "AVAILABLE" && (
                <div className="rounded-xl border border-dashed border-emerald-500/40 bg-emerald-500/10 p-4 text-center text-xs text-emerald-600 font-medium">
                  <CheckCircle2 className="mx-auto mb-1 size-6" />
                  This dock is currently Available and ready for vehicle allocation.
                </div>
              )}

              {selectedDetailsDock.status === "MAINTENANCE" && (
                <div className="rounded-xl border border-dashed border-amber-500/40 bg-amber-500/10 p-4 text-center text-xs text-amber-600 font-medium">
                  <Wrench className="mx-auto mb-1 size-6" />
                  This dock is under maintenance. Vehicle allocation is currently disabled.
                </div>
              )}

              {(selectedDetailsDock.status === "RESERVED" ||
                selectedDetailsDock.status === "OCCUPIED") && (
                <>
                  {/* 2. Vehicle Details */}
                  <div className="rounded-xl border bg-card p-3 space-y-2 shadow-sm">
                    <h4 className="font-extrabold uppercase tracking-wider text-[11px] text-primary flex items-center gap-1.5 border-b pb-1.5">
                      <Truck className="size-3.5" /> Vehicle & Gate Entry Details
                    </h4>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-muted-foreground block text-[11px]">Vehicle Number</span>
                        <span className="font-mono font-black text-sm text-primary">
                          {selectedDetailsDock.current_allocation?.vehicle_number || "KA-01-AB-1234"}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[11px]">Gate Entry / Pass No</span>
                        <span className="font-mono font-bold text-foreground">
                          {selectedDetailsDock.current_allocation?.existing_gate_pass_id || "GE-2026-001"}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[11px]">Gate Entry Status</span>
                        <span className="font-bold text-foreground">
                          {selectedDetailsDock.current_allocation?.status || "DOCK_ASSIGNED"}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[11px]">Approved At</span>
                        <span className="font-mono text-muted-foreground">
                          {selectedDetailsDock.current_allocation?.security_approved_at
                            ? new Date(selectedDetailsDock.current_allocation.security_approved_at).toLocaleString()
                            : "—"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 3. Material Details */}
                  <div className="rounded-xl border bg-card p-3 space-y-2 shadow-sm">
                    <h4 className="font-extrabold uppercase tracking-wider text-[11px] text-primary flex items-center gap-1.5 border-b pb-1.5">
                      <Package className="size-3.5" /> Material & PO Details
                    </h4>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-muted-foreground block text-[11px]">Material Code / Name</span>
                        <span className="font-semibold text-foreground">
                          {selectedDetailsDock.current_allocation?.material_reference ||
                            selectedDetailsDock.current_allocation?.material_description ||
                            "Inbound Material Batch"}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[11px]">Vendor / Supplier</span>
                        <span className="font-semibold text-foreground">
                          {selectedDetailsDock.current_allocation?.vendor_reference || "Approved Supplier"}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[11px]">Quantity</span>
                        <span className="font-mono font-bold text-foreground">
                          {selectedDetailsDock.current_allocation?.quantity || "100.0"} PCS
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[11px]">PO Reference</span>
                        <span className="font-mono font-bold text-primary">
                          {selectedDetailsDock.current_allocation?.existing_gate_pass_id || "PO-2026-1001"}
                        </span>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" className="rounded-xl" onClick={() => setSelectedDetailsDock(null)}>
                Close
              </Button>

              {selectedDetailsDock.status === "AVAILABLE" && pendingRequests.length > 0 && (
                <Button
                  className="rounded-xl shadow-glow w-full sm:w-auto text-xs"
                  onClick={() => {
                    const target = selectedDetailsDock;
                    setSelectedDetailsDock(null);
                    setAllocateModalDock(target);
                    setSelectedRequestIdToAllocate(pendingRequests[0]?.id || "");
                  }}
                >
                  <ArrowRight className="size-4" /> ALLOCATE DOCK
                </Button>
              )}

              {selectedDetailsDock.status === "RESERVED" && (
                <Button
                  className="rounded-xl bg-amber-500 hover:bg-amber-600 text-white shadow-glow w-full sm:w-auto text-xs"
                  onClick={() => {
                    const target = selectedDetailsDock;
                    setSelectedDetailsDock(null);
                    setArriveConfirmDock(target);
                  }}
                >
                  <Truck className="size-4" /> VEHICLE ARRIVED
                </Button>
              )}

              {selectedDetailsDock.status === "OCCUPIED" && (
                <Button
                  variant="destructive"
                  className="rounded-xl shadow-glow w-full sm:w-auto text-xs"
                  onClick={() => {
                    const target = selectedDetailsDock;
                    setSelectedDetailsDock(null);
                    setReleaseConfirmDock(target);
                  }}
                >
                  <CheckCircle2 className="size-4" /> RELEASE DOCK
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* 7. Allocate Dock Selection Modal */}
      {allocateModalDock && (
        <Dialog open={Boolean(allocateModalDock)} onOpenChange={() => setAllocateModalDock(null)}>
          <DialogContent className="max-w-lg rounded-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ArrowRight className="size-5 text-primary" /> Allocate Dock:{" "}
                <span className="font-mono font-black text-primary">
                  {allocateModalDock.dock_code}
                </span>
              </DialogTitle>
              <DialogDescription className="text-xs">
                Select an approved Gate Pass to reserve dock {allocateModalDock.dock_code}.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2 text-xs">
              <Label className="text-xs font-semibold">Select Pending Gate Pass Request:</Label>
              {pendingRequests.length === 0 ? (
                <div className="rounded-xl border border-dashed p-4 text-center text-xs text-muted-foreground">
                  No pending gate pass requests currently awaiting dock allocation.
                </div>
              ) : (
                <div className="max-h-60 overflow-y-auto space-y-2 border rounded-xl p-2 bg-muted/20">
                  {pendingRequests.map((req) => (
                    <label
                      key={req.id}
                      onClick={() => setSelectedRequestIdToAllocate(req.id)}
                      className={cn(
                        "flex cursor-pointer items-center justify-between rounded-xl border p-3 transition-all",
                        selectedRequestIdToAllocate === req.id
                          ? "border-primary bg-primary-soft/30 shadow-sm"
                          : "border-border/60 hover:bg-muted/50",
                      )}
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-primary">
                            {req.existing_gate_pass_id}
                          </span>
                          <span className="font-mono font-bold">{req.vehicle_number}</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          {req.vendor_reference || "Vendor"} · {req.material_reference || req.material_description || "Material"}
                        </p>
                      </div>
                      <input
                        type="radio"
                        name="allocation_request"
                        checked={selectedRequestIdToAllocate === req.id}
                        onChange={() => setSelectedRequestIdToAllocate(req.id)}
                        className="size-4 accent-primary"
                      />
                    </label>
                  ))}
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                className="rounded-xl"
                onClick={() => setAllocateModalDock(null)}
              >
                Cancel
              </Button>
              <Button
                disabled={!selectedRequestIdToAllocate || actionBusy}
                className="rounded-xl shadow-glow"
                onClick={() => void handleAllocateDock()}
              >
                {actionBusy && <Loader2 className="size-4 animate-spin" />} Confirm Allocation
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* 7b. Select Available Dock Modal for Pending Allocation */}
      {allocateModalPendingReq && (
        <Dialog open={Boolean(allocateModalPendingReq)} onOpenChange={() => setAllocateModalPendingReq(null)}>
          <DialogContent className="max-w-lg rounded-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-primary font-bold">
                <Warehouse className="size-5" /> Select Available Dock
              </DialogTitle>
              <DialogDescription className="text-xs">
                Assign an AVAILABLE dock to Gate Pass <strong className="font-mono text-foreground">{allocateModalPendingReq.existing_gate_pass_id}</strong> (Vehicle: <span className="font-mono font-bold text-foreground">{allocateModalPendingReq.vehicle_number}</span>)
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2 text-xs">
              <div className="rounded-xl border bg-muted/30 p-3 space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Material:</span>
                  <span className="font-semibold text-foreground">
                    {allocateModalPendingReq.material_reference || allocateModalPendingReq.material_description || "Inbound Goods"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Supplier / Vendor:</span>
                  <span className="font-semibold text-foreground">{allocateModalPendingReq.vendor_reference || "Supplier"}</span>
                </div>
                {allocateModalPendingReq.quantity && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Quantity:</span>
                    <span className="font-mono font-bold text-foreground">{allocateModalPendingReq.quantity} PCS</span>
                  </div>
                )}
              </div>

              <Label className="text-xs font-semibold block pt-1">Currently AVAILABLE Docks (Backend Live):</Label>
              {docks.filter((d) => d.status === "AVAILABLE").length === 0 ? (
                <div className="rounded-xl border border-dashed border-amber-500/40 bg-amber-500/10 p-4 text-center text-xs text-amber-600 font-medium space-y-1">
                  <Wrench className="mx-auto size-6" />
                  <p className="font-bold">No Docks Currently AVAILABLE</p>
                  <p className="text-[11px] text-muted-foreground">
                    All docks are currently RESERVED, OCCUPIED, or UNDER MAINTENANCE. Please release an occupied dock first.
                  </p>
                </div>
              ) : (
                <div className="max-h-64 overflow-y-auto space-y-2 border rounded-xl p-2 bg-muted/20">
                  {docks
                    .filter((d) => d.status === "AVAILABLE")
                    .map((dock) => (
                      <label
                        key={dock.id}
                        onClick={() => setSelectedDockIdToAllocate(dock.id)}
                        className={cn(
                          "flex cursor-pointer items-center justify-between rounded-xl border p-3 transition-all",
                          selectedDockIdToAllocate === dock.id
                            ? "border-primary bg-primary-soft/40 shadow-sm"
                            : "border-border/60 hover:bg-muted/50",
                        )}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-black text-sm text-primary">
                              {dock.dock_code}
                            </span>
                            <span className="font-semibold text-foreground text-xs">{dock.dock_name}</span>
                            <StatusBadge status="AVAILABLE" />
                          </div>
                          <p className="text-[11px] text-muted-foreground">
                            {dock.dock_type.replaceAll("_", " ")} · {dock.location || "Main Facade"}
                          </p>
                        </div>
                        <input
                          type="radio"
                          name="available_dock_selection"
                          checked={selectedDockIdToAllocate === dock.id}
                          onChange={() => setSelectedDockIdToAllocate(dock.id)}
                          className="size-4 accent-primary"
                        />
                      </label>
                    ))}
                </div>
              )}
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="outline"
                className="rounded-xl"
                onClick={() => setAllocateModalPendingReq(null)}
              >
                Cancel
              </Button>
              <Button
                disabled={!selectedDockIdToAllocate || docks.filter((d) => d.status === "AVAILABLE").length === 0 || actionBusy}
                className="rounded-xl shadow-glow bg-primary text-primary-foreground font-semibold"
                onClick={() => void handleAllocateDock()}
              >
                {actionBusy && <Loader2 className="size-4 animate-spin" />} Confirm Dock Assignment
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* 8. Vehicle Arrived Confirmation Dialog */}
      <AlertDialog
        open={Boolean(arriveConfirmDock)}
        onOpenChange={() => setArriveConfirmDock(null)}
      >
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Truck className="size-5 text-amber-500" /> Vehicle Arrival Confirmation
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="mt-2 space-y-2 text-xs text-muted-foreground">
                <div className="rounded-xl border bg-muted/40 p-3 text-foreground space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Dock:</span>
                    <span className="font-mono font-bold">{arriveConfirmDock?.dock_code}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Vehicle:</span>
                    <span className="font-mono font-bold">
                      {arriveConfirmDock?.current_allocation?.vehicle_number || "KA01AB1234"}
                    </span>
                  </div>
                </div>
                <p>Confirm that the vehicle has physically arrived at dock {arriveConfirmDock?.dock_code}?</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={actionBusy}
              className="rounded-xl bg-amber-500 hover:bg-amber-600 text-white"
              onClick={(e) => {
                e.preventDefault();
                void handleVehicleArrived();
              }}
            >
              {actionBusy && <Loader2 className="size-4 animate-spin" />} Confirm Arrival
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 9. Release Dock Confirmation Dialog */}
      <AlertDialog
        open={Boolean(releaseConfirmDock)}
        onOpenChange={() => setReleaseConfirmDock(null)}
      >
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <ShieldAlert className="size-5" /> Release Dock?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="mt-2 space-y-2 text-xs text-muted-foreground">
                <div className="rounded-xl border bg-muted/40 p-3 text-foreground space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Dock:</span>
                    <span className="font-mono font-bold">{releaseConfirmDock?.dock_code}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Vehicle:</span>
                    <span className="font-mono font-bold">
                      {releaseConfirmDock?.current_allocation?.vehicle_number || "KA01AB1234"}
                    </span>
                  </div>
                </div>
                <p>Are you sure you want to release dock {releaseConfirmDock?.dock_code}? It will return to AVAILABLE status.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={actionBusy}
              className="rounded-xl bg-destructive hover:bg-destructive/90 text-white"
              onClick={(e) => {
                e.preventDefault();
                void handleReleaseDock();
              }}
            >
              {actionBusy && <Loader2 className="size-4 animate-spin" />} Release Dock
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
  status: "TOTAL" | "AVAILABLE" | "RESERVED" | "OCCUPIED" | "MAINTENANCE" | "PENDING";
  active: boolean;
  onClick: () => void;
}) {
  const cardStyles = {
    TOTAL: "bg-blue-500/10 border-blue-500/30 text-blue-950 dark:text-blue-200 hover:border-blue-500/60",
    AVAILABLE: "bg-emerald-500/10 border-emerald-500/30 text-emerald-950 dark:text-emerald-200 hover:border-emerald-500/60",
    RESERVED: "bg-amber-500/10 border-amber-500/30 text-amber-950 dark:text-amber-200 hover:border-amber-500/60",
    OCCUPIED: "bg-rose-500/10 border-rose-500/30 text-rose-950 dark:text-rose-200 hover:border-rose-500/60",
    MAINTENANCE: "bg-slate-500/10 border-slate-500/30 text-slate-900 dark:text-slate-200 hover:border-slate-500/60",
    PENDING: "bg-purple-500/10 border-purple-500/30 text-purple-950 dark:text-purple-200 hover:border-purple-500/60",
  };

  const countColors = {
    TOTAL: "text-blue-600 dark:text-blue-400",
    AVAILABLE: "text-emerald-600 dark:text-emerald-400",
    RESERVED: "text-amber-600 dark:text-amber-400",
    OCCUPIED: "text-rose-600 dark:text-rose-400",
    MAINTENANCE: "text-slate-600 dark:text-slate-400",
    PENDING: "text-purple-600 dark:text-purple-400",
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

function DockCard({
  dock,
  hasPendingAllocationRequirement,
  onViewDetails,
  onEdit,
  onToggleMaintenance,
  onAllocate,
  onVehicleArrived,
  onRelease,
}: {
  dock: Dock;
  hasPendingAllocationRequirement?: boolean;
  onViewDetails: () => void;
  onEdit: () => void;
  onToggleMaintenance: () => void;
  onAllocate: () => void;
  onVehicleArrived: () => void;
  onRelease: () => void;
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

  const vehicleNo = dock.current_allocation?.vehicle_number || (dock.status === "RESERVED" || dock.status === "OCCUPIED" ? "KA01AB1234" : null);
  const gatePassNo = dock.current_allocation?.existing_gate_pass_id || (dock.status === "RESERVED" || dock.status === "OCCUPIED" ? "GP-00125" : null);
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
          {dock.dock_type.replaceAll("_", " ")}
        </span>

        {/* Assigned Vehicle Preview */}
        {(dock.status === "RESERVED" || dock.status === "OCCUPIED") && vehicleNo && (
          <div className="mt-4 rounded-xl border bg-muted/30 p-3 text-xs space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-muted-foreground uppercase">
                Vehicle
              </span>
              <span className="font-mono font-black text-primary">{vehicleNo}</span>
            </div>
            {gatePassNo && (
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground">Gate Pass</span>
                <span className="font-mono text-[11px] font-bold">{gatePassNo}</span>
              </div>
            )}
          </div>
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
            VIEW DETAILS
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 rounded-xl px-2.5 text-xs"
            onClick={onEdit}
            title="Edit Dock Master"
          >
            <Edit className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-8 rounded-xl px-2.5 text-xs",
              isMaintenance ? "text-emerald-600 hover:bg-emerald-500/10" : "text-amber-600 hover:bg-amber-500/10",
            )}
            onClick={onToggleMaintenance}
            disabled={dock.status === "OCCUPIED" || dock.status === "RESERVED"}
            title={isMaintenance ? "Make Available" : "Set Under Maintenance"}
          >
            <Wrench className="size-3.5" />
          </Button>
        </div>

        {dock.status === "AVAILABLE" && hasPendingAllocationRequirement && (
          <Button
            size="sm"
            className="w-full rounded-xl text-xs shadow-glow"
            onClick={onAllocate}
          >
            <ArrowRight className="size-3.5" /> ALLOCATE DOCK
          </Button>
        )}

        {dock.status === "RESERVED" && (
          <Button
            size="sm"
            className="w-full rounded-xl text-xs bg-amber-500 hover:bg-amber-600 text-white shadow-glow"
            onClick={onVehicleArrived}
          >
            <Truck className="size-3.5" /> VEHICLE ARRIVED
          </Button>
        )}

        {dock.status === "OCCUPIED" && (
          <Button
            size="sm"
            variant="destructive"
            className="w-full rounded-xl text-xs shadow-glow"
            onClick={onRelease}
          >
            <CheckCircle2 className="size-3.5" /> RELEASE DOCK
          </Button>
        )}

        {dock.status === "MAINTENANCE" && (
          <div className="py-1 text-center text-[11px] text-muted-foreground italic font-medium">
            Under Maintenance
          </div>
        )}
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
