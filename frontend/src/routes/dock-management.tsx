import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  ArrowRight,
  CheckCircle2,
  Loader2,
  Package,
  RefreshCw,
  Search,
  ShieldAlert,
  SquarePen,
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
          "Real-time dock allocation, vehicle arrival tracking, and operational status.",
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

export const PREDEFINED_CATEGORIES = [
  { id: "ALL", name: "All Types" },
  { id: "CHEMICAL_HAZARDOUS", name: "Chemical / Hazardous" },
  { id: "ELECTRONICS", name: "Electronics" },
  { id: "ELECTRICAL", name: "Electrical" },
  { id: "RAW_MATERIAL", name: "Raw Material" },
  { id: "MAIN_RECEIVING", name: "Main Receiving" },
];

function getCategoryLabel(dockType: string): string {
  switch (dockType) {
    case "CHEMICAL_HAZARDOUS":
    case "CHEMICAL":
    case "HAZARDOUS_ITEMS":
      return "CHEMICAL/HAZARDOUS";
    case "ELECTRONICS":
    case "ELECTRONIC":
      return "ELECTRONICS";
    case "ELECTRICAL":
      return "ELECTRICAL";
    case "RAW_MATERIAL":
      return "RAW MATERIAL";
    case "MAIN_RECEIVING":
      return "MAIN RECEIVING";
    default:
      return dockType ? dockType.replaceAll("_", "/").toUpperCase() : "STANDARD";
  }
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
    total_docks: 10,
    available_docks: 6,
    occupied_docks: 4,
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
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");

  // Modals & Action States
  const [selectedDetailsDock, setSelectedDetailsDock] = useState<Dock | null>(null);
  const [allocateModalDock, setAllocateModalDock] = useState<Dock | null>(null);
  const [allocateModalPendingReq, setAllocateModalPendingReq] = useState<AllocationRequest | null>(
    null,
  );
  const [selectedRequestIdToAllocate, setSelectedRequestIdToAllocate] = useState<string>("");
  const [selectedDockIdToAllocate, setSelectedDockIdToAllocate] = useState<string>("");
  const [releaseConfirmDock, setReleaseConfirmDock] = useState<Dock | null>(null);

  // Edit & Maintenance Modals
  const [editDockModalDock, setEditDockModalDock] = useState<Dock | null>(null);
  const [editDockForm, setEditDockForm] = useState({
    name: "",
    type: "RAW_MATERIAL",
    location: "",
    description: "",
  });

  const [maintenanceConfirmDock, setMaintenanceConfirmDock] = useState<Dock | null>(null);

  const [actionBusy, setActionBusy] = useState(false);

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
        const avail = docksRes.filter((d: Dock) => d.status === "AVAILABLE").length;
        const occ = docksRes.filter(
          (d: Dock) => d.status === "OCCUPIED" || d.status === "RESERVED",
        ).length;
        const maint = docksRes.filter((d: Dock) => d.status === "MAINTENANCE").length;
        setMetrics({
          total_docks: docksRes.length || 10,
          available_docks: avail,
          occupied_docks: occ,
          reserved_docks: 0,
          maintenance_docks: maint,
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
    selectedDetailsDock ||
      allocateModalDock ||
      allocateModalPendingReq ||
      releaseConfirmDock ||
      editDockModalDock ||
      maintenanceConfirmDock,
  );

  useEffect(() => {
    void loadAll();
    if (isAnyModalOpen) return;
    const timer = window.setInterval(() => void loadAll(true), 5000);
    return () => window.clearInterval(timer);
  }, [loadAll, isAnyModalOpen]);

  // Handle Edit Dock Update
  async function handleUpdateDock() {
    if (!editDockModalDock) return;
    setActionBusy(true);
    try {
      await api.updateDock(editDockModalDock.id, {
        dock_name: editDockForm.name.trim() || editDockModalDock.dock_name,
        dock_type: editDockForm.type,
        location: editDockForm.location.trim() || undefined,
        description: editDockForm.description.trim() || undefined,
      });
      toast.success(`Dock ${editDockModalDock.dock_code} updated successfully`);
      setEditDockModalDock(null);
      await loadAll(true);
    } catch (error) {
      toast.error("Failed to update dock", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setActionBusy(false);
    }
  }

  // Handle Maintenance Toggle
  async function handleToggleMaintenance() {
    if (!maintenanceConfirmDock) return;
    const isMaint = maintenanceConfirmDock.status === "MAINTENANCE";
    const nextStatus = isMaint ? "AVAILABLE" : "MAINTENANCE";
    setActionBusy(true);
    try {
      await api.updateDockStatus(
        maintenanceConfirmDock.id,
        nextStatus,
        isMaint ? "Maintenance completed" : "Scheduled routine maintenance",
      );
      toast.success(
        `Dock ${maintenanceConfirmDock.dock_code} ${isMaint ? "returned to Available" : "marked Under Maintenance"}`,
      );
      setMaintenanceConfirmDock(null);
      await loadAll(true);
    } catch (error) {
      toast.error("Status update failed", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setActionBusy(false);
    }
  }

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

    // Verify dock availability
    const targetDock = docks.find((d) => d.id === dockId);
    if (targetDock && targetDock.status !== "AVAILABLE") {
      toast.error("Selected dock is not Available. Please choose an Available dock.");
      return;
    }

    setActionBusy(true);
    try {
      await api.allocateDock(reqId, dockId);
      toast.success(`Dock ${dockCode} allocated successfully`, {
        description: "Status updated to OCCUPIED. Vehicle ready to proceed to dock.",
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

  // Filtered Docks
  const filteredDocks = docks.filter((dock) => {
    let matchesTab = true;
    if (activeTab === "AVAILABLE") {
      matchesTab = dock.status === "AVAILABLE";
    } else if (activeTab === "OCCUPIED") {
      matchesTab = dock.status === "OCCUPIED";
    } else if (activeTab === "RESERVED") {
      matchesTab = dock.status === "RESERVED";
    } else if (activeTab === "MAINTENANCE") {
      matchesTab = dock.status === "MAINTENANCE";
    }

    let matchesCategory = true;
    if (categoryFilter !== "ALL") {
      if (categoryFilter === "ELECTRONICS") {
        matchesCategory = dock.dock_type === "ELECTRONICS" || dock.dock_type === "ELECTRONIC";
      } else if (categoryFilter === "CHEMICAL_HAZARDOUS") {
        matchesCategory =
          dock.dock_type === "CHEMICAL_HAZARDOUS" ||
          dock.dock_type === "CHEMICAL" ||
          dock.dock_type === "HAZARDOUS_ITEMS";
      } else {
        matchesCategory = dock.dock_type === categoryFilter;
      }
    }

    const q = searchTerm.toLowerCase().trim();
    const matchesSearch =
      !q ||
      dock.dock_code.toLowerCase().includes(q) ||
      dock.dock_name.toLowerCase().includes(q) ||
      (dock.location && dock.location.toLowerCase().includes(q)) ||
      (dock.current_allocation?.vehicle_number &&
        dock.current_allocation.vehicle_number.toLowerCase().includes(q)) ||
      (dock.current_allocation?.existing_gate_pass_id &&
        dock.current_allocation.existing_gate_pass_id.toLowerCase().includes(q)) ||
      (dock.current_allocation?.vendor_reference &&
        dock.current_allocation.vendor_reference.toLowerCase().includes(q));

    return matchesTab && matchesCategory && matchesSearch;
  });

  return (
    <AppShell
      title="Dock Management"
      subtitle="Real-time dock allocation, vehicle arrival tracking, and operational status."
      actions={
        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            className="h-9 rounded-full px-4 text-xs font-semibold border-border/80 bg-card hover:bg-muted/60 shadow-2xs text-muted-foreground hover:text-foreground gap-1.5"
            onClick={() => void loadAll()}
          >
            <RefreshCw className={cn("size-3.5", loading && "animate-spin text-primary")} />
            Refresh
          </Button>
          <Button
            className="h-9 rounded-full px-4 text-xs font-semibold shadow-glow gap-1.5"
            onClick={() => setShowCreateDock(true)}
          >
            <Plus className="size-3.5" />
            New Dock
          </Button>
        </div>
      }
    >
      {/* Summary cards use the same neutral surfaces and semantic tokens as the rest of the app. */}
      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <SummaryCard
          label="TOTAL DOCKS"
          value={metrics.total_docks}
          variant="total"
          active={activeTab === "ALL"}
          onClick={() => setActiveTab("ALL")}
        />
        <SummaryCard
          label="AVAILABLE DOCKS"
          value={metrics.available_docks}
          variant="available"
          active={activeTab === "AVAILABLE"}
          onClick={() => setActiveTab("AVAILABLE")}
        />
        <SummaryCard
          label="RESERVED DOCKS"
          value={metrics.reserved_docks}
          variant="reserved"
          active={activeTab === "RESERVED"}
          onClick={() => setActiveTab("RESERVED")}
        />
        <SummaryCard
          label="OCCUPIED DOCKS"
          value={metrics.occupied_docks}
          variant="occupied"
          active={activeTab === "OCCUPIED"}
          onClick={() => setActiveTab("OCCUPIED")}
        />
        <SummaryCard
          label="UNDER MAINTENANCE"
          value={metrics.maintenance_docks}
          variant="maintenance"
          active={activeTab === "MAINTENANCE"}
          onClick={() => setActiveTab("MAINTENANCE")}
        />
        <SummaryCard
          label="PENDING ALLOCATIONS"
          value={metrics.pending_allocations_count || pendingRequests.length}
          variant="pending"
          active={activeTab === "PENDING"}
          onClick={() => setActiveTab("PENDING")}
        />
      </div>

      {/* 2. Filter Bar & Search Container */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-full border border-border/80 bg-card p-1.5 px-4 shadow-2xs">
        <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
          {/* Search Box */}
          <div className="relative flex items-center w-56 sm:w-64">
            <Search className="size-4 text-muted-foreground/70 shrink-0 ml-1" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search truck no, PO, vendor, gate entry..."
              className="h-8 border-none bg-transparent pl-2.5 pr-2 text-xs focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground/60"
            />
          </div>

          {/* Filter Pills */}
          <div className="flex flex-wrap items-center gap-1">
            {(
              [
                { key: "ALL", label: "TOTAL DOCKS" },
                { key: "AVAILABLE", label: "AVAILABLE" },
                { key: "RESERVED", label: "RESERVED" },
                { key: "OCCUPIED", label: "OCCUPIED" },
                { key: "MAINTENANCE", label: "UNDER MAINTENANCE" },
                { key: "PENDING", label: "PENDING ALLOCATIONS" },
                { key: "HISTORY", label: "HISTORY" },
              ] as const
            ).map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  "rounded-full px-3.5 py-1.5 text-xs font-bold transition-all whitespace-nowrap",
                  activeTab === tab.key
                    ? "bg-blue-600 text-white shadow-xs"
                    : "text-muted-foreground hover:text-foreground font-semibold hover:bg-muted/40",
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Dock Type Dropdown on Right */}
        {activeTab !== "HISTORY" && activeTab !== "PENDING" && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground font-medium whitespace-nowrap">
              Dock type:
            </span>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="h-8 rounded-full border border-border/80 bg-background px-3 text-xs font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
            >
              {PREDEFINED_CATEGORIES.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* 3. Main Content View */}
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
                      <td className="px-4 py-3 font-mono font-bold text-primary">
                        {req.existing_gate_pass_id}
                      </td>
                      <td className="px-4 py-3 font-mono font-bold">{req.vehicle_number}</td>
                      <td className="px-4 py-3 text-xs font-medium">
                        {req.vendor_reference || "Vendor"}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <div className="font-semibold text-foreground">
                          {req.material_reference || req.material_description || "—"}
                        </div>
                        {req.quantity && (
                          <div className="text-[11px] text-muted-foreground tabular-nums">
                            Qty: {req.quantity}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground font-mono">
                        {req.security_approved_at
                          ? new Date(req.security_approved_at).toLocaleString()
                          : "—"}
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
        /* 3-Column Dock Grid View matching screenshot */
        <div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredDocks.map((dock) => (
              <DockCard
                key={dock.id}
                dock={dock}
                onViewDetails={() => setSelectedDetailsDock(dock)}
                onEdit={() => {
                  setEditDockModalDock(dock);
                  setEditDockForm({
                    name: dock.dock_name,
                    type: dock.dock_type,
                    location: dock.location || "",
                    description: dock.description || "",
                  });
                }}
                onMaintenanceToggle={() => setMaintenanceConfirmDock(dock)}
                onRelease={() => setReleaseConfirmDock(dock)}
              />
            ))}
          </div>

          {filteredDocks.length === 0 && (
            <div className="py-20 text-center text-muted-foreground">
              <Warehouse className="mx-auto mb-2 size-8 text-muted-foreground/50" />
              <p className="text-sm font-semibold">No docks found matching the criteria.</p>
            </div>
          )}
        </div>
      )}

      {/* 4. View Dock Details Modal */}
      {selectedDetailsDock && (
        <Dialog
          open={Boolean(selectedDetailsDock)}
          onOpenChange={() => setSelectedDetailsDock(null)}
        >
          <DialogContent className="max-w-lg rounded-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center justify-between">
                <DialogTitle className="font-mono text-xl font-black text-primary flex items-center gap-2">
                  <Warehouse className="size-5" /> {selectedDetailsDock.dock_code}
                </DialogTitle>
                <span
                  className={cn(
                    "rounded-full px-3 py-0.5 text-xs font-extrabold tracking-wider border",
                    selectedDetailsDock.status === "AVAILABLE"
                      ? "bg-[#dcfce7] text-[#15803d] border-[#bbf7d0]"
                      : selectedDetailsDock.status === "MAINTENANCE"
                        ? "bg-slate-100 text-slate-700 border-slate-200"
                        : "bg-[#ffe4e6] text-[#e11d48] border-[#fecdd3]",
                  )}
                >
                  {selectedDetailsDock.status === "OCCUPIED" ? "AT DOCK" : selectedDetailsDock.status}
                </span>
              </div>
              <DialogDescription className="text-xs">
                {selectedDetailsDock.dock_name}
                {selectedDetailsDock.location ? ` · ${selectedDetailsDock.location}` : ""}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2 text-xs">
              <div className="rounded-xl border bg-card p-3 space-y-2 shadow-sm">
                <h4 className="font-extrabold uppercase tracking-wider text-[11px] text-primary flex items-center gap-1.5 border-b pb-1.5">
                  <Warehouse className="size-3.5" /> Dock Information
                </h4>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground block text-[11px]">
                      Dock Code & Name
                    </span>
                    <span className="font-mono font-bold text-foreground">
                      {selectedDetailsDock.dock_code} ({selectedDetailsDock.dock_name})
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Dock Category</span>
                    <span className="font-semibold text-foreground">
                      {getCategoryLabel(selectedDetailsDock.dock_type)}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Current Status</span>
                    <span
                      className={cn(
                        "font-bold",
                        selectedDetailsDock.status === "AVAILABLE"
                          ? "text-emerald-600"
                          : selectedDetailsDock.status === "MAINTENANCE"
                            ? "text-slate-600"
                            : "text-rose-600",
                      )}
                    >
                      {selectedDetailsDock.status === "OCCUPIED" ? "AT DOCK" : selectedDetailsDock.status}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Assignment Time</span>
                    <span className="font-mono text-foreground font-medium">
                      {selectedDetailsDock.current_allocation?.assigned_at
                        ? new Date(
                            selectedDetailsDock.current_allocation.assigned_at,
                          ).toLocaleString()
                        : "N/A"}
                    </span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-muted-foreground block text-[11px]">Location</span>
                    <span className="font-medium text-foreground">
                      {selectedDetailsDock.location || "Central Receiving"}
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

              {selectedDetailsDock.status !== "AVAILABLE" && selectedDetailsDock.status !== "MAINTENANCE" && (
                <>
                  <div className="rounded-xl border bg-card p-3 space-y-2 shadow-sm">
                    <h4 className="font-extrabold uppercase tracking-wider text-[11px] text-primary flex items-center gap-1.5 border-b pb-1.5">
                      <Truck className="size-3.5" /> Allocated Vehicle & Gate Entry Details
                    </h4>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-muted-foreground block text-[11px]">
                          Vehicle Number
                        </span>
                        <span className="font-mono font-black text-sm text-[#2563eb]">
                          {selectedDetailsDock.current_allocation?.vehicle_number || "—"}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[11px]">
                          Gate Entry / Pass No
                        </span>
                        <span className="font-mono font-bold text-foreground">
                          {selectedDetailsDock.current_allocation?.existing_gate_pass_id || "—"}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[11px]">
                          Allocation Status
                        </span>
                        <span className="font-bold text-foreground">
                          {selectedDetailsDock.current_allocation?.status || "AT DOCK"}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[11px]">Approved At</span>
                        <span className="font-mono text-muted-foreground">
                          {selectedDetailsDock.current_allocation?.security_approved_at
                            ? new Date(
                                selectedDetailsDock.current_allocation.security_approved_at,
                              ).toLocaleString()
                            : "—"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border bg-card p-3 space-y-2 shadow-sm">
                    <h4 className="font-extrabold uppercase tracking-wider text-[11px] text-primary flex items-center gap-1.5 border-b pb-1.5">
                      <Package className="size-3.5" /> Material & Supplier Details
                    </h4>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-muted-foreground block text-[11px]">
                          Material Code / Name
                        </span>
                        <span className="font-semibold text-foreground">
                          {selectedDetailsDock.current_allocation?.material_reference ||
                            selectedDetailsDock.current_allocation?.material_description ||
                            "—"}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[11px]">
                          Vendor / Supplier
                        </span>
                        <span className="font-semibold text-foreground">
                          {selectedDetailsDock.current_allocation?.vendor_reference ||
                            "Approved Supplier"}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[11px]">Quantity</span>
                        <span className="font-mono font-bold text-foreground">
                          {selectedDetailsDock.current_allocation?.quantity ?? "—"}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[11px]">
                          Gate Pass Ref
                        </span>
                        <span className="font-mono font-bold text-primary">
                          {selectedDetailsDock.current_allocation?.existing_gate_pass_id || "—"}
                        </span>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button
                variant="outline"
                className="rounded-xl"
                onClick={() => setSelectedDetailsDock(null)}
              >
                Close
              </Button>

              {selectedDetailsDock.status === "AVAILABLE" && pendingRequests.length > 0 && (
                <Button
                  className="rounded-xl shadow-glow w-full sm:w-auto text-xs bg-blue-600 hover:bg-blue-700 text-white"
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

              {selectedDetailsDock.status === "OCCUPIED" && (
                <Button
                  className="rounded-xl shadow-glow w-full sm:w-auto text-xs bg-[#ef4444] hover:bg-red-600 text-white"
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

      {/* 5. Allocate Vehicle to This Specific Available Dock Modal */}
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
                Select an approved Gate Pass vehicle to allocate to {allocateModalDock.dock_name}.
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
                          {req.vendor_reference || "Vendor"} ·{" "}
                          {req.material_reference || req.material_description || "Material"}
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
                className="rounded-xl shadow-glow bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                onClick={() => void handleAllocateDock()}
              >
                {actionBusy && <Loader2 className="size-4 animate-spin" />} Confirm Allocation
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* 6. Release Dock Confirmation Dialog */}
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
                    <span className="font-mono font-bold">
                      {releaseConfirmDock?.dock_code} ({releaseConfirmDock?.dock_name})
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Vehicle:</span>
                    <span className="font-mono font-bold text-[#2563eb]">
                      {releaseConfirmDock?.current_allocation?.vehicle_number || "—"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Gate Pass:</span>
                    <span className="font-mono font-bold">
                      {releaseConfirmDock?.current_allocation?.existing_gate_pass_id || "—"}
                    </span>
                  </div>
                </div>
                <p>
                  Releasing will immediately change the dock status back to{" "}
                  <strong className="text-emerald-600 font-bold">AVAILABLE</strong>, freeing it for
                  new vehicle allocations.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={actionBusy}
              className="rounded-xl bg-rose-600 hover:bg-rose-700 text-white"
              onClick={(e) => {
                e.preventDefault();
                void handleReleaseDock();
              }}
            >
              {actionBusy && <Loader2 className="size-4 animate-spin" />} Confirm Release
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>



      {/* 8. Edit Dock Dialog */}
      <Dialog open={Boolean(editDockModalDock)} onOpenChange={() => setEditDockModalDock(null)}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <SquarePen className="size-5 text-blue-600" /> Edit Dock: {editDockModalDock?.dock_code}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Update dock parameters and configuration.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 py-2 text-xs">
            <div>
              <Label className="text-xs font-semibold">Dock Name</Label>
              <Input
                value={editDockForm.name}
                onChange={(e) => setEditDockForm({ ...editDockForm, name: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold">Dock Category</Label>
              <select
                value={editDockForm.type}
                onChange={(e) => setEditDockForm({ ...editDockForm, type: e.target.value })}
                className="mt-1 w-full h-9 rounded-md border border-input bg-background px-3 text-xs"
              >
                <option value="CHEMICAL_HAZARDOUS">Chemical / Hazardous</option>
                <option value="ELECTRONICS">Electronics</option>
                <option value="ELECTRICAL">Electrical</option>
                <option value="RAW_MATERIAL">Raw Material</option>
                <option value="MAIN_RECEIVING">Main Receiving</option>
              </select>
            </div>
            <div>
              <Label className="text-xs font-semibold">Location</Label>
              <Input
                value={editDockForm.location}
                onChange={(e) => setEditDockForm({ ...editDockForm, location: e.target.value })}
                className="mt-1"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              className="rounded-xl"
              onClick={() => setEditDockModalDock(null)}
            >
              Cancel
            </Button>
            <Button
              disabled={actionBusy}
              className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white"
              onClick={() => void handleUpdateDock()}
            >
              {actionBusy && <Loader2 className="size-4 animate-spin mr-1" />} Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 9. Maintenance Toggle Dialog */}
      <AlertDialog
        open={Boolean(maintenanceConfirmDock)}
        onOpenChange={() => setMaintenanceConfirmDock(null)}
      >
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-amber-600">
              <Wrench className="size-5" />{" "}
              {maintenanceConfirmDock?.status === "MAINTENANCE"
                ? "Complete Maintenance?"
                : "Put Dock Under Maintenance?"}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="mt-2 space-y-2 text-xs text-muted-foreground">
                <p>
                  Dock:{" "}
                  <strong className="text-foreground font-mono">
                    {maintenanceConfirmDock?.dock_code} ({maintenanceConfirmDock?.dock_name})
                  </strong>
                </p>
                {maintenanceConfirmDock?.status === "OCCUPIED" && (
                  <p className="text-rose-600 font-semibold">
                    Note: This dock currently has an assigned vehicle. Please release the dock
                    before putting it under maintenance.
                  </p>
                )}
                {maintenanceConfirmDock?.status !== "OCCUPIED" && (
                  <p>
                    {maintenanceConfirmDock?.status === "MAINTENANCE"
                      ? "Dock will be restored to AVAILABLE status for receiving."
                      : "Dock will be marked UNDER MAINTENANCE and removed from available allocation bays."}
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={maintenanceConfirmDock?.status === "OCCUPIED" || actionBusy}
              className="rounded-xl bg-amber-600 hover:bg-amber-700 text-white"
              onClick={(e) => {
                e.preventDefault();
                void handleToggleMaintenance();
              }}
            >
              {actionBusy && <Loader2 className="size-4 animate-spin" />} Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}

function SummaryCard({
  label,
  value,
  variant,
  active,
  onClick,
}: {
  label: string;
  value: number;
  variant: "total" | "available" | "reserved" | "occupied" | "maintenance" | "pending";
  active: boolean;
  onClick: () => void;
}) {
  const presentation = {
    total: {
      icon: Warehouse,
      card: "border-blue-300 bg-gradient-to-br from-blue-50/80 via-card to-card",
      iconTone: "border-blue-200 bg-blue-100 text-blue-600",
    },
    available: {
      icon: CheckCircle2,
      card: "border-emerald-200 bg-gradient-to-br from-emerald-50/80 via-card to-card",
      iconTone: "border-emerald-200 bg-emerald-100 text-emerald-600",
    },
    reserved: {
      icon: History,
      card: "border-cyan-200 bg-gradient-to-br from-cyan-50/80 via-card to-card",
      iconTone: "border-cyan-200 bg-cyan-100 text-cyan-600",
    },
    occupied: {
      icon: Truck,
      card: "border-amber-200 bg-gradient-to-br from-amber-50/80 via-card to-card",
      iconTone: "border-amber-200 bg-amber-100 text-amber-600",
    },
    maintenance: {
      icon: Wrench,
      card: "border-rose-200 bg-gradient-to-br from-rose-50/80 via-card to-card",
      iconTone: "border-rose-200 bg-rose-100 text-rose-600",
    },
    pending: {
      icon: Package,
      card: "border-violet-200 bg-gradient-to-br from-violet-50/80 via-card to-card",
      iconTone: "border-violet-200 bg-violet-100 text-violet-600",
    },
  };
  const current = presentation[variant];
  const Icon = current.icon;

  return (
    <div
      onClick={onClick}
      className={cn(
        "group flex min-h-32 cursor-pointer flex-col justify-between gap-3 rounded-[22px] border p-5 text-card-foreground shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lift",
        current.card,
        active && "ring-2 ring-primary/25",
      )}
    >
      <div className="flex items-center justify-between">
        <p className="min-w-0 pr-2 text-[11px] font-black uppercase leading-tight text-slate-500">
          {label}
        </p>
        <span
          className={cn(
            "grid size-10 shrink-0 place-items-center rounded-full border shadow-sm",
            current.iconTone,
          )}
        >
          <Icon className="size-4" />
        </span>
      </div>
      <div className="flex items-end justify-between gap-2">
        <p className="text-4xl font-black leading-none tabular-nums text-slate-950 xl:text-3xl 2xl:text-4xl">{value}</p>
        <ArrowRight className="mb-1 size-4 -translate-x-1 text-muted-foreground opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
      </div>
    </div>
  );
}

function DockCard({
  dock,
  onViewDetails,
  onEdit,
  onMaintenanceToggle,
  onRelease,
}: {
  dock: Dock;
  onViewDetails: () => void;
  onEdit: () => void;
  onMaintenanceToggle: () => void;
  onRelease: () => void;
}) {
  const isAvailable = dock.status === "AVAILABLE";
  const isOccupied = dock.status === "OCCUPIED" || dock.status === "RESERVED";
  const isMaintenance = dock.status === "MAINTENANCE";

  const cardBorder = isAvailable
    ? "border-2 border-[#a7f3d0] dark:border-emerald-900/60"
    : isOccupied
      ? "border-2 border-[#fecdd3] dark:border-rose-900/60"
      : "border-2 border-slate-300 dark:border-slate-800";

  const dotColor = isAvailable
    ? "bg-emerald-500"
    : isOccupied
      ? "bg-rose-500"
      : "bg-slate-500";

  const badgeStyle = isAvailable
    ? "bg-[#dcfce7] text-[#15803d] border-[#bbf7d0]"
    : isOccupied
      ? "bg-[#ffe4e6] text-[#e11d48] border-[#fecdd3]"
      : "bg-slate-100 text-slate-700 border-slate-200";

  const badgeText = isAvailable ? "AVAILABLE" : isOccupied ? "AT DOCK" : "MAINTENANCE";

  const vehicleNo = dock.current_allocation?.vehicle_number;
  const gatePassNo = dock.current_allocation?.existing_gate_pass_id;

  return (
    <Card
      className={cn(
        "flex flex-col justify-between rounded-3xl bg-card p-6 transition-all duration-200 shadow-2xs hover:shadow-soft",
        cardBorder,
      )}
    >
      <div>
        {/* Top Header Row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={cn("size-2.5 rounded-full shrink-0", dotColor)} />
            <h3 className="font-mono text-base font-black tracking-tight text-foreground">
              {dock.dock_code}
            </h3>
          </div>
          <span
            className={cn(
              "rounded-full px-3 py-0.5 text-[10px] font-extrabold tracking-wider border",
              badgeStyle,
            )}
          >
            {badgeText}
          </span>
        </div>

        {/* Dock Name */}
        <p className="mt-2 text-xs font-semibold text-muted-foreground">{dock.dock_name}</p>

        {/* Category Pill */}
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="inline-block rounded-full bg-slate-100 dark:bg-slate-800/80 px-2.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
            {getCategoryLabel(dock.dock_type)}
          </span>
          {dock.location && (
            <span className="text-[11px] text-muted-foreground/80">• {dock.location}</span>
          )}
        </div>

        {/* Vehicle Info Box if Occupied */}
        {isOccupied && (
          <div className="mt-5 rounded-2xl border border-border/50 bg-slate-50/70 dark:bg-slate-900/40 p-3.5 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                VEHICLE
              </span>
              <span className="font-mono font-bold text-sm text-[#2563eb]">
                {vehicleNo || "KA-12-AB-5678"}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-xs font-medium text-muted-foreground">Gate Pass</span>
              <span className="font-mono font-bold text-xs text-foreground">
                {gatePassNo || "GE-20260902-6BB06B"}
              </span>
            </div>
          </div>
        )}

        {/* Space reserved for available / maintenance so cards have identical height */}
        {!isOccupied && <div className="min-h-[66px] mt-5" />}
      </div>

      {/* Bottom Actions */}
      <div className="mt-6 pt-4 border-t border-border/60 space-y-2.5">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="flex-1 rounded-full border-border/80 bg-card hover:bg-muted text-xs font-bold text-slate-700 dark:text-slate-200 h-9 shadow-2xs"
            onClick={onViewDetails}
          >
            VIEW DETAILS
          </Button>
          <button
            type="button"
            onClick={onEdit}
            title="Edit Dock"
            className="size-9 rounded-full border border-border/80 flex items-center justify-center hover:bg-muted text-slate-600 dark:text-slate-300 transition-colors shrink-0 shadow-2xs"
          >
            <SquarePen className="size-4" />
          </button>
          <button
            type="button"
            onClick={onMaintenanceToggle}
            title={isMaintenance ? "Resume Operation" : "Set Maintenance"}
            className="size-9 rounded-full border border-border/80 flex items-center justify-center hover:bg-muted text-amber-500 hover:text-amber-600 transition-colors shrink-0 shadow-2xs"
          >
            <Wrench className="size-4" />
          </button>
        </div>

        {isOccupied && (
          <Button
            className="w-full rounded-full bg-[#ef4444] hover:bg-red-600 text-white font-bold text-xs h-9 shadow-2xs flex items-center justify-center gap-1.5"
            onClick={onRelease}
          >
            <CheckCircle2 className="size-4" /> RELEASE DOCK
          </Button>
        )}
      </div>
    </Card>
  );
}
