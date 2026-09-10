import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import {
  Building2,
  ShieldCheck,
  UserCheck,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Layers,
  Boxes,
  ClipboardList,
  AlertTriangle,
  Info,
  Plus,
  Edit,
  Power,
  Search,
  XCircle,
  Tag,
  QrCode,
  Printer,
  Download,
  ScanLine,
  Play,
  ArrowRight,
  MapPin,
  Clock,
  PackageCheck,
  Save,
  Grid,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import QRCode from "qrcode";
import { AppShell, StatusBadge } from "@/components/wms/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/api-client";
import { getUserInfo } from "@/lib/auth-utils";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/my-store")({
  head: () => ({
    meta: [
      { title: "My Store · NexusWMS" },
      {
        name: "description",
        content:
          "Dedicated Store Keeper & Manager portal for store administration, zone and bin layout, putaway execution, and operational inventory.",
      },
    ],
  }),
  component: MyStorePage,
});

interface Store {
  id: string;
  store_code: string;
  store_name: string;
  description?: string | null;
  warehouse_id: string;
  store_manager_id?: string | null;
  store_manager_name?: string | null;
  status: string;
  created_at?: string;
  updated_at?: string;
  zones_count?: number;
}

interface Bin {
  id: string;
  store_id: string;
  zone_id: string;
  bin_code: string;
  bin_name: string;
  rack?: string | null;
  shelf?: string | null;
  capacity: number;
  occupied_quantity: number;
  status: string;
  created_at?: string;
  updated_at?: string;
}

interface Zone {
  id: string;
  store_id: string;
  zone_code: string;
  zone_name: string;
  description?: string | null;
  status: string;
  created_at?: string;
  updated_at?: string;
  bins?: Bin[];
}

interface PutawayTask {
  id: string;
  task_number: string;
  grn_id: string;
  grn_number: string;
  handling_unit_id?: string | null;
  item_code: string;
  material_name: string;
  quantity: number;
  uom: string;
  warehouse_id: string;
  source_location: string;
  destination_store_id?: string | null;
  destination_zone_id?: string | null;
  destination_bin_id?: string | null;
  destination_bin_code?: string | null;
  destination_location_id?: string | null;
  destination_zone?: string | null;
  destination_rack?: string | null;
  destination_bin?: string | null;
  location_assigned_by?: string | null;
  location_assigned_at?: string | null;
  started_by?: string | null;
  started_at?: string | null;
  completed_by?: string | null;
  completed_at?: string | null;
  status: string;
  created_by: string;
  created_at?: string | null;
}

interface PickupTask {
  id: string;
  task_number: string;
  requisition_id: string;
  requisition_item_id: string;
  request_number: string;
  store_id: string;
  store_code: string;
  store_name: string;
  department: string;
  material_code: string;
  material_name: string;
  requested_quantity: number;
  picked_quantity: number;
  uom: string;
  priority: string;
  required_date: string;
  status: string;
  picked_by?: string | null;
  picked_at?: string | null;
  created_at: string;
}

interface InventoryBalance {
  id?: string;
  material_code: string;
  material_name: string;
  category: string;
  warehouse_id: string;
  storage_location_id: string;
  location_code: string;
  store_id?: string | null;
  store_code?: string | null;
  store_name?: string | null;
  zone_id?: string | null;
  zone_code?: string | null;
  zone_name?: string | null;
  quantity: number;
  available_quantity: number;
  uom: string;
  last_grn_number?: string | null;
  updated_at: string;
}

function MyStorePage() {
  const [activeTab, setActiveTab] = useState<"putaway" | "pickup" | "zones" | "inventory">(
    "putaway",
  );
  const [store, setStore] = useState<Store | null>(null);
  const [zones, setZones] = useState<Zone[]>([]);
  const [putawayTasks, setPutawayTasks] = useState<PutawayTask[]>([]);
  const [pickupTasks, setPickupTasks] = useState<PickupTask[]>([]);
  const [inventoryBalances, setInventoryBalances] = useState<InventoryBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [zonesLoading, setZonesLoading] = useState(false);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [pickupTasksLoading, setPickupTasksLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Expanded Zones in accordion
  const [expandedZoneIds, setExpandedZoneIds] = useState<Set<string>>(new Set());

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [putawaySearch, setPutawaySearch] = useState("");
  const [putawayStatusFilter, setPutawayStatusFilter] = useState("ALL");
  const [pickupSearch, setPickupSearch] = useState("");
  const [pickupStatusFilter, setPickupStatusFilter] = useState("ALL");

  // Create Zone Modal
  const [createZoneOpen, setCreateZoneOpen] = useState(false);
  const [creatingZone, setCreatingZone] = useState(false);
  const [previewZoneCode, setPreviewZoneCode] = useState("");
  const [customZoneCode, setCustomZoneCode] = useState("");
  const [newZoneName, setNewZoneName] = useState("");
  const [newZoneDesc, setNewZoneDesc] = useState("");

  // Edit Zone Modal
  const [editZoneOpen, setEditZoneOpen] = useState(false);
  const [editingZone, setEditingZone] = useState<Zone | null>(null);
  const [editZoneName, setEditZoneName] = useState("");
  const [editZoneDesc, setEditZoneDesc] = useState("");
  const [savingZone, setSavingZone] = useState(false);

  // Zone QR Modal
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [selectedZoneForQr, setSelectedZoneForQr] = useState<Zone | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrPayloadData, setQrPayloadData] = useState<any>(null);
  const [loadingQr, setLoadingQr] = useState(false);

  // Create Bin Modal
  const [createBinOpen, setCreateBinOpen] = useState(false);
  const [targetZoneForBin, setTargetZoneForBin] = useState<Zone | null>(null);
  const [creatingBin, setCreatingBin] = useState(false);
  const [newBinName, setNewBinName] = useState("");
  const [newBinRack, setNewBinRack] = useState("R01");
  const [newBinShelf, setNewBinShelf] = useState("S01");
  const [newBinCapacity, setNewBinCapacity] = useState("1000");
  const [previewBinCode, setPreviewBinCode] = useState("");

  // Bin QR Modal
  const [binQrModalOpen, setBinQrModalOpen] = useState(false);
  const [selectedBinForQr, setSelectedBinForQr] = useState<Bin | null>(null);
  const [selectedZoneForBinQr, setSelectedZoneForBinQr] = useState<Zone | null>(null);
  const [binQrDataUrl, setBinQrDataUrl] = useState<string | null>(null);
  const [loadingBinQr, setLoadingBinQr] = useState(false);

  // Store Keeper Putaway Execution Modal
  const [executingTask, setExecutingTask] = useState<PutawayTask | null>(null);
  const [executeModalOpen, setExecuteModalOpen] = useState(false);
  const [matScanInput, setMatScanInput] = useState("");
  const [zoneScanInput, setZoneScanInput] = useState("");
  const [binScanInput, setBinScanInput] = useState("");
  const [confirmedQty, setConfirmedQty] = useState("");
  const [verifyingMat, setVerifyingMat] = useState(false);
  const [verifiedHU, setVerifiedHU] = useState<any>(null);
  const [confirmingPutaway, setConfirmingPutaway] = useState(false);

  // Store Keeper Pickup Execution Modal
  const [executingPickupTask, setExecutingPickupTask] = useState<PickupTask | null>(null);
  const [executePickupModalOpen, setExecutePickupModalOpen] = useState(false);
  const [pickupMatScan, setPickupMatScan] = useState("");
  const [pickupZoneScan, setPickupZoneScan] = useState("");
  const [pickupQty, setPickupQty] = useState("");
  const [confirmingPickup, setConfirmingPickup] = useState(false);

  const user = getUserInfo();

  const fetchStoreData = async () => {
    try {
      setLoading(true);
      setError(null);
      const storeData = await api.getMyStore();
      setStore(storeData);

      if (storeData?.id) {
        setZonesLoading(true);
        setTasksLoading(true);
        setPickupTasksLoading(true);
        const [hierarchyData, tasksData, pickupData, balancesData] = await Promise.all([
          api.getStoreHierarchy().catch(() => []),
          api.getPutawayTasks().catch(() => []),
          api.getPickupTasks().catch(() => []),
          api.getInventoryLocationBalances().catch(() => []),
        ]);

        const myHierarchy = (hierarchyData || []).find(
          (s: any) => s.id === storeData.id || s.store_code === storeData.store_code,
        );
        if (myHierarchy && myHierarchy.zones) {
          setZones(myHierarchy.zones);
        } else {
          const fallbackZones = await api.getStoreZones(storeData.id).catch(() => []);
          setZones(fallbackZones || []);
        }

        setPutawayTasks(tasksData || []);
        setPickupTasks(pickupData || []);
        // Filter balances for this store
        const storeBals = (balancesData || []).filter(
          (b: InventoryBalance) =>
            b.store_id === storeData.id || b.store_code === storeData.store_code,
        );
        setInventoryBalances(storeBals);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load assigned store.");
      toast.error("Could not load your assigned store.");
    } finally {
      setLoading(false);
      setZonesLoading(false);
      setTasksLoading(false);
      setPickupTasksLoading(false);
    }
  };

  useEffect(() => {
    fetchStoreData();
  }, []);

  const refreshZones = async () => {
    if (!store?.id) return;
    setZonesLoading(true);
    try {
      const hierarchyData = await api.getStoreHierarchy().catch(() => []);
      const myHierarchy = (hierarchyData || []).find(
        (s: any) => s.id === store.id || s.store_code === store.store_code,
      );
      if (myHierarchy && myHierarchy.zones) {
        setZones(myHierarchy.zones);
      } else {
        const z = await api.getStoreZones(store.id);
        setZones(z || []);
      }
    } catch {
      toast.error("Failed to refresh zones");
    } finally {
      setZonesLoading(false);
    }
  };

  const refreshTasksAndBalances = async () => {
    if (!store?.id) return;
    setTasksLoading(true);
    try {
      const [tasksData, balancesData] = await Promise.all([
        api.getPutawayTasks(),
        api.getInventoryLocationBalances(),
      ]);
      setPutawayTasks(tasksData || []);
      const storeBals = (balancesData || []).filter(
        (b: InventoryBalance) => b.store_id === store.id || b.store_code === store.store_code,
      );
      setInventoryBalances(storeBals);
    } catch {
      toast.error("Failed to refresh tasks and balances");
    } finally {
      setTasksLoading(false);
    }
  };

  const toggleExpandZone = (zoneId: string) => {
    setExpandedZoneIds((prev) => {
      const next = new Set(prev);
      if (next.has(zoneId)) {
        next.delete(zoneId);
      } else {
        next.add(zoneId);
      }
      return next;
    });
  };

  // Filtered Zones
  const filteredZones = useMemo(() => {
    return zones.filter((z) => {
      const matchesStatus =
        statusFilter === "ALL" || z.status?.toUpperCase() === statusFilter.toUpperCase();
      const q = search.toLowerCase().trim();
      const matchesSearch =
        !q ||
        z.zone_code.toLowerCase().includes(q) ||
        z.zone_name.toLowerCase().includes(q) ||
        (z.description && z.description.toLowerCase().includes(q));
      return matchesStatus && matchesSearch;
    });
  }, [zones, statusFilter, search]);

  // Filtered Putaway Tasks
  const filteredPutawayTasks = useMemo(() => {
    return putawayTasks.filter((t) => {
      const matchesStatus =
        putawayStatusFilter === "ALL" ||
        t.status?.toUpperCase() === putawayStatusFilter.toUpperCase();
      const q = putawaySearch.toLowerCase().trim();
      const matchesSearch =
        !q ||
        t.task_number.toLowerCase().includes(q) ||
        t.item_code.toLowerCase().includes(q) ||
        t.material_name.toLowerCase().includes(q) ||
        t.grn_number.toLowerCase().includes(q);
      return matchesStatus && matchesSearch;
    });
  }, [putawayTasks, putawayStatusFilter, putawaySearch]);

  // Filtered Pickup Tasks
  const filteredPickupTasks = useMemo(() => {
    return pickupTasks.filter((t) => {
      const matchesStatus =
        pickupStatusFilter === "ALL" ||
        t.status?.toUpperCase() === pickupStatusFilter.toUpperCase();
      const q = pickupSearch.toLowerCase().trim();
      const matchesSearch =
        !q ||
        t.task_number.toLowerCase().includes(q) ||
        t.request_number.toLowerCase().includes(q) ||
        t.material_code.toLowerCase().includes(q) ||
        t.material_name.toLowerCase().includes(q) ||
        t.department.toLowerCase().includes(q);

      return matchesStatus && matchesSearch;
    });
  }, [pickupTasks, pickupSearch, pickupStatusFilter]);

  const activeZonesList = useMemo(() => {
    return zones.filter((z) => z.status?.toUpperCase() === "ACTIVE");
  }, [zones]);

  const selectedZoneBins = useMemo(() => {
    if (!zoneScanInput) return [];
    const z = zones.find((item) => item.id === zoneScanInput || item.zone_code === zoneScanInput);
    return (z?.bins || []).filter((b) => b.status?.toUpperCase() === "ACTIVE");
  }, [zones, zoneScanInput]);

  const handleOpenCreateZone = async () => {
    if (!store) return;
    setNewZoneName("");
    setNewZoneDesc("");
    setCustomZoneCode("");
    try {
      const nextCode = await api.getNextZoneCode(store.id);
      setPreviewZoneCode(nextCode.suggested_zone_code);
      setCustomZoneCode(nextCode.suggested_zone_code);
    } catch {
      setPreviewZoneCode(`${store.store_code}-Z01`);
      setCustomZoneCode(`${store.store_code}-Z01`);
    }
    setCreateZoneOpen(true);
  };

  const handleCreateZoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!store?.id) return;
    if (!newZoneName.trim()) {
      toast.error("Please enter a Zone Name");
      return;
    }

    setCreatingZone(true);
    try {
      const created = await api.createZone(store.id, {
        zone_name: newZoneName.trim(),
        zone_code: customZoneCode.trim() ? customZoneCode.trim().toUpperCase() : undefined,
        description: newZoneDesc.trim() || undefined,
        status: "ACTIVE",
      });
      toast.success(`Zone ${created.zone_code} (${created.zone_name}) created successfully`);
      setCreateZoneOpen(false);
      refreshZones();
    } catch (err: any) {
      toast.error(err.message || "Failed to create zone");
    } finally {
      setCreatingZone(false);
    }
  };

  const handleOpenCreateBin = async (zone: Zone) => {
    setTargetZoneForBin(zone);
    setNewBinName(`${zone.zone_name} Bin`);
    setNewBinRack("R01");
    setNewBinShelf("S01");
    setNewBinCapacity("1000");
    try {
      const res = await api.getNextBinCode(zone.id);
      if (res?.suggested_bin_code) {
        setPreviewBinCode(res.suggested_bin_code);
      }
    } catch {
      setPreviewBinCode(`BIN-${zone.zone_code}-001`);
    }
    setCreateBinOpen(true);
  };

  const handleCreateBinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetZoneForBin) return;
    if (!newBinName.trim()) {
      toast.error("Please enter a Bin Name");
      return;
    }

    setCreatingBin(true);
    try {
      const created = await api.createBin(targetZoneForBin.id, {
        bin_name: newBinName.trim(),
        rack: newBinRack.trim() || "R01",
        shelf: newBinShelf.trim() || "S01",
        capacity: parseFloat(newBinCapacity) || 1000,
        status: "ACTIVE",
      });
      toast.success(`Bin ${created.bin_code} created under ${targetZoneForBin.zone_code}`);
      setCreateBinOpen(false);
      refreshZones();
    } catch (err: any) {
      toast.error(err.message || "Failed to create bin");
    } finally {
      setCreatingBin(false);
    }
  };

  const handleToggleBinStatus = async (b: Bin) => {
    const nextStatus = b.status?.toUpperCase() === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    try {
      await api.updateBinStatus(b.id, nextStatus);
      toast.success(`Bin ${b.bin_code} marked as ${nextStatus}`);
      refreshZones();
    } catch (err: any) {
      toast.error(err.message || "Failed to toggle bin status");
    }
  };

  const handleViewZoneQR = async (z: Zone) => {
    setSelectedZoneForQr(z);
    setQrDataUrl(null);
    setQrPayloadData(null);
    setLoadingQr(true);
    setQrModalOpen(true);
    try {
      const qrData = await api.getZoneQR(z.id);
      setQrPayloadData(qrData);
      const dataUrl = await QRCode.toDataURL(qrData.qr_payload || z.id, {
        width: 300,
        margin: 1,
        errorCorrectionLevel: "M",
      });
      setQrDataUrl(dataUrl);
    } catch (err: any) {
      toast.error(err.message || "Failed to generate Zone QR");
    } finally {
      setLoadingQr(false);
    }
  };

  const handleViewBinQR = async (b: Bin, z: Zone) => {
    setSelectedBinForQr(b);
    setSelectedZoneForBinQr(z);
    setBinQrDataUrl(null);
    setLoadingBinQr(true);
    setBinQrModalOpen(true);
    try {
      const qrData = await api.getBinQR(b.id);
      const dataUrl = await QRCode.toDataURL(qrData.qr_payload || b.id, {
        width: 300,
        margin: 1,
        errorCorrectionLevel: "M",
      });
      setBinQrDataUrl(dataUrl);
    } catch (err: any) {
      toast.error(err.message || "Failed to generate Bin QR");
    } finally {
      setLoadingBinQr(false);
    }
  };

  const handleDownloadQR = () => {
    if (!qrDataUrl || !selectedZoneForQr) return;
    const a = document.createElement("a");
    a.href = qrDataUrl;
    a.download = `${selectedZoneForQr.zone_code}_QR_Label.png`;
    a.click();
    toast.success(`Downloaded ${selectedZoneForQr.zone_code} QR code`);
  };

  const handlePrintQR = () => {
    if (!qrDataUrl || !selectedZoneForQr) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast.error("Popup blocked. Please allow popups to print QR label.");
      return;
    }
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Zone QR Label · ${selectedZoneForQr.zone_code}</title>
          <style>
            body { font-family: monospace, sans-serif; text-align: center; padding: 24px; }
            .label-box { border: 2px solid #000; padding: 20px; border-radius: 12px; max-width: 320px; margin: 0 auto; }
            .store-name { font-size: 13px; font-weight: bold; color: #444; }
            .zone-code { font-size: 26px; font-weight: 900; margin: 8px 0; letter-spacing: 1px; }
            .zone-name { font-size: 14px; margin-bottom: 12px; font-weight: 600; }
            img { width: 220px; height: 220px; display: block; margin: 0 auto; }
            .meta { font-size: 10px; color: #666; margin-top: 10px; }
          </style>
        </head>
        <body>
          <div class="label-box">
            <div class="store-name">${store?.store_code || "STORE"} · ${store?.store_name || "Store"}</div>
            <div class="zone-code">${selectedZoneForQr.zone_code}</div>
            <div class="zone-name">${selectedZoneForQr.zone_name}</div>
            <img src="${qrDataUrl}" alt="Zone QR Code" />
            <div class="meta">Zone ID: ${selectedZoneForQr.id}<br/>Warehouse: ${store?.warehouse_id || "Main Warehouse"}</div>
          </div>
          <script>
            window.onload = function() { window.print(); window.close(); }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleDownloadBinQR = () => {
    if (!binQrDataUrl || !selectedBinForQr) return;
    const a = document.createElement("a");
    a.href = binQrDataUrl;
    a.download = `${selectedBinForQr.bin_code}_Bin_QR.png`;
    a.click();
    toast.success(`Downloaded ${selectedBinForQr.bin_code} QR code`);
  };

  const handlePrintBinQR = () => {
    if (!binQrDataUrl || !selectedBinForQr) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast.error("Popup blocked. Please allow popups to print QR label.");
      return;
    }
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Bin QR Label · ${selectedBinForQr.bin_code}</title>
          <style>
            body { font-family: monospace, sans-serif; text-align: center; padding: 24px; }
            .label-box { border: 2px solid #000; padding: 20px; border-radius: 12px; max-width: 320px; margin: 0 auto; }
            .store-name { font-size: 13px; font-weight: bold; color: #444; }
            .bin-code { font-size: 24px; font-weight: 900; margin: 8px 0; letter-spacing: 1px; }
            .bin-name { font-size: 14px; margin-bottom: 12px; font-weight: 600; }
            img { width: 220px; height: 220px; display: block; margin: 0 auto; }
            .meta { font-size: 10px; color: #666; margin-top: 10px; }
          </style>
        </head>
        <body>
          <div class="label-box">
            <div class="store-name">${store?.store_code || "STORE"} · ${selectedZoneForBinQr?.zone_code || "ZONE"}</div>
            <div class="bin-code">${selectedBinForQr.bin_code}</div>
            <div class="bin-name">${selectedBinForQr.bin_name} (Rack: ${selectedBinForQr.rack || "-"}, Shelf: ${selectedBinForQr.shelf || "-"})</div>
            <img src="${binQrDataUrl}" alt="Bin QR Code" />
            <div class="meta">Bin ID: ${selectedBinForQr.id}<br/>Capacity: ${selectedBinForQr.capacity} · Status: ${selectedBinForQr.status}</div>
          </div>
          <script>
            window.onload = function() { window.print(); window.close(); }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleOpenEditZone = (z: Zone) => {
    setEditingZone(z);
    setEditZoneName(z.zone_name || "");
    setEditZoneDesc(z.description || "");
    setEditZoneOpen(true);
  };

  const handleEditZoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingZone) return;
    if (!editZoneName.trim()) {
      toast.error("Zone Name cannot be empty");
      return;
    }

    setSavingZone(true);
    try {
      await api.updateZone(editingZone.id, {
        zone_name: editZoneName.trim(),
        description: editZoneDesc.trim() || undefined,
      });
      toast.success(`Zone ${editingZone.zone_code} updated successfully`);
      setEditZoneOpen(false);
      refreshZones();
    } catch (err: any) {
      toast.error(err.message || "Failed to update zone");
    } finally {
      setSavingZone(false);
    }
  };

  const handleToggleZoneStatus = async (z: Zone) => {
    const nextStatus = z.status?.toUpperCase() === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    try {
      await api.updateZoneStatus(z.id, nextStatus);
      toast.success(`Zone ${z.zone_code} marked as ${nextStatus}`);
      refreshZones();
    } catch (err: any) {
      toast.error(err.message || "Failed to toggle zone status");
    }
  };

  // Putaway Execution Handlers
  const handleStartPutaway = async (task: PutawayTask) => {
    try {
      await api.startPutaway(task.id);
      toast.success("Putaway task started. Ready for physical QR scanning.");
      refreshTasksAndBalances();
      handleOpenExecuteModal(task);
    } catch (err: any) {
      toast.error(err.message || "Failed to start putaway task");
    }
  };

  const handleOpenExecuteModal = (task: PutawayTask) => {
    setExecutingTask(task);
    setMatScanInput("");
    setZoneScanInput(task.destination_zone_id || activeZonesList[0]?.id || "");
    setBinScanInput(task.destination_bin_id || "");
    setConfirmedQty(String(task.quantity));
    setVerifiedHU(null);
    setExecuteModalOpen(true);
  };

  const handleVerifyMaterial = async () => {
    if (!matScanInput.trim() || !executingTask) {
      toast.error("Scan or enter Material QR / code");
      return;
    }
    setVerifyingMat(true);
    try {
      const unit = await api.getHandlingUnit(matScanInput.trim());
      setVerifiedHU(unit);
      toast.success(`Material verified: ${unit.material_name} (${unit.item_code})`);
    } catch (err: any) {
      if (matScanInput.trim().toUpperCase() === executingTask.item_code.toUpperCase()) {
        setVerifiedHU({
          item_code: executingTask.item_code,
          material_name: executingTask.material_name,
          quantity: executingTask.quantity,
          uom: executingTask.uom,
          grn_number: executingTask.grn_number,
        });
        toast.success(`Material code verified: ${executingTask.item_code}`);
      } else {
        setVerifiedHU(null);
        toast.error("Material verification failed", {
          description: err.message || "Scanned QR does not match task material.",
        });
      }
    } finally {
      setVerifyingMat(false);
    }
  };

  const handleConfirmPutawaySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!executingTask) return;
    if (!matScanInput.trim()) {
      toast.error("Scan or enter Material QR code");
      return;
    }
    const locationScanTarget = binScanInput.trim() || zoneScanInput.trim();
    if (!locationScanTarget) {
      toast.error("Scan or select Destination Location (Zone/Bin)");
      return;
    }
    const qty = Number(confirmedQty);
    if (isNaN(qty) || qty <= 0) {
      toast.error("Quantity must be greater than zero");
      return;
    }
    if (qty > executingTask.quantity) {
      toast.error(
        `Quantity cannot exceed task remaining quantity (${executingTask.quantity} ${executingTask.uom})`,
      );
      return;
    }

    setConfirmingPutaway(true);
    try {
      const result = await api.completePutaway(executingTask.id, {
        material_scan: matScanInput.trim(),
        location_scan: locationScanTarget,
        quantity: qty,
      });
      toast.success("Physical Putaway Confirmed & Stored!", {
        description: `${qty.toLocaleString()} ${executingTask.uom} of ${executingTask.material_name} is now available in store inventory.`,
      });
      setExecuteModalOpen(false);
      refreshTasksAndBalances();
    } catch (err: any) {
      toast.error(err.message || "Putaway confirmation failed");
    } finally {
      setConfirmingPutaway(false);
    }
  };

  const handleOpenExecutePickup = (task: PickupTask) => {
    setExecutingPickupTask(task);
    setPickupMatScan(task.material_code);
    const defaultZone = activeZonesList[0]?.id || "";
    setPickupZoneScan(defaultZone);
    const remQty = Math.max(0, Number(task.requested_quantity) - Number(task.picked_quantity));
    setPickupQty(String(remQty || task.requested_quantity));
    setExecutePickupModalOpen(true);
  };

  const handleConfirmPickupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!executingPickupTask) return;

    if (!pickupMatScan.trim()) {
      toast.error("Please provide or scan Material QR / Item Code");
      return;
    }

    if (!pickupZoneScan.trim()) {
      toast.error("Please scan or select a valid Store Zone");
      return;
    }

    const qtyNum = parseFloat(pickupQty);
    if (isNaN(qtyNum) || qtyNum <= 0) {
      toast.error("Please enter a valid positive quantity");
      return;
    }

    setConfirmingPickup(true);
    try {
      await api.completePickupTask(executingPickupTask.id, {
        material_scan: pickupMatScan.trim(),
        zone_scan: pickupZoneScan.trim(),
        quantity: qtyNum,
      });

      toast.success(
        `Pickup Task ${executingPickupTask.task_number} completed! ${qtyNum} ${executingPickupTask.uom} issued to ${executingPickupTask.department}.`,
      );
      setExecutePickupModalOpen(false);
      setExecutingPickupTask(null);
      fetchStoreData();
    } catch (err: any) {
      toast.error(err.message || "Failed to complete pickup task");
    } finally {
      setConfirmingPickup(false);
    }
  };

  return (
    <AppShell
      title="Store Management & Putaway Portal"
      subtitle={`Authenticated as ${user?.username || "Store Keeper"} · Scoped to ${store?.store_name || "Store"}`}
      actions={
        <Button
          variant="outline"
          size="sm"
          onClick={fetchStoreData}
          disabled={loading}
          className="rounded-xl border-border/40"
        >
          <RefreshCw className={cn("size-3.5 mr-1.5", loading && "animate-spin")} /> Refresh
        </Button>
      }
    >
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
          <Loader2 className="size-8 animate-spin text-primary" />
          <p className="text-sm">Fetching your assigned store profile...</p>
        </div>
      ) : error || !store ? (
        <Card className="border-border/40 max-w-xl mx-auto mt-8 shadow-soft">
          <CardContent className="p-8 text-center flex flex-col items-center gap-4">
            <div className="size-14 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
              <AlertTriangle className="size-7" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground">No Store Assigned</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-md">
                {error ||
                  "Your user account is not currently linked to an active Store. Please contact the Warehouse Administrator to assign your store profile."}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchStoreData}
              className="rounded-xl text-xs mt-2"
            >
              <RefreshCw className="size-3.5 mr-1.5" /> Retry Sync
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Store Hero Banner */}
          <Card className="border-border/40 bg-gradient-to-r from-primary/10 via-card to-card shadow-soft overflow-hidden">
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-start gap-4">
                  <div className="size-16 rounded-2xl bg-primary/20 text-primary flex items-center justify-center font-extrabold text-xl shadow-inner shrink-0">
                    <Building2 className="size-8" />
                  </div>
                  <div>
                    <div className="flex items-center gap-3">
                      <h2 className="text-2xl font-black tracking-tight text-foreground">
                        {store.store_name}
                      </h2>
                      <span className="font-mono text-xs px-2.5 py-1 rounded-lg bg-primary/15 text-primary font-bold border border-primary/20">
                        {store.store_code}
                      </span>
                      <StatusBadge
                        status={store.status?.toUpperCase() === "ACTIVE" ? "PASS" : "REJECTED"}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-2 max-w-2xl leading-relaxed">
                      {store.description ||
                        "Designated organizational storage facility for specialized inventory and controlled unit access."}
                    </p>
                  </div>
                </div>

                <div className="bg-card/80 border border-border/40 p-4 rounded-xl shrink-0 min-w-48 shadow-soft">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Store Authority
                  </p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <div className="size-7 rounded-full bg-primary/15 text-primary flex items-center justify-center text-xs font-bold">
                      {store.store_manager_name ? store.store_manager_name.charAt(0) : "S"}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-foreground">
                        {store.store_manager_name || user?.username || "Store Keeper"}
                      </p>
                      <p className="text-[10px] font-mono text-muted-foreground">
                        {store.store_manager_id || "EMP-STORE"} · {store.warehouse_id}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Navigation Tabs */}
          <div className="flex flex-wrap items-center gap-2 border-b border-border/40 pb-3">
            <Button
              variant={activeTab === "putaway" ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveTab("putaway")}
              className="rounded-xl text-xs font-semibold gap-2"
            >
              <PackageCheck className="size-4" />
              Inbound Putaway Tasks
              <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-primary/20 text-primary font-bold">
                {putawayTasks.filter((t) => t.status !== "PUTAWAY_COMPLETED").length}
              </span>
            </Button>

            <Button
              variant={activeTab === "pickup" ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveTab("pickup")}
              className="rounded-xl text-xs font-semibold gap-2"
            >
              <ClipboardList className="size-4" />
              Outbound Pickup Tasks
              <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-primary/20 text-primary font-bold">
                {pickupTasks.filter((t) => t.status !== "COMPLETED").length}
              </span>
            </Button>

            <Button
              variant={activeTab === "zones" ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveTab("zones")}
              className="rounded-xl text-xs font-semibold gap-2"
            >
              <Layers className="size-4" />
              Zones & Bins ({zones.length})
            </Button>

            <Button
              variant={activeTab === "inventory" ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveTab("inventory")}
              className="rounded-xl text-xs font-semibold gap-2"
            >
              <Boxes className="size-4" />
              Store Inventory Balances ({inventoryBalances.length})
            </Button>
          </div>

          {/* TAB 1: INBOUND PUTAWAY TASKS */}
          {activeTab === "putaway" && (
            <div className="space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="relative w-72">
                  <Search className="size-3.5 absolute left-3 top-2.5 text-muted-foreground" />
                  <Input
                    placeholder="Search assigned putaway tasks..."
                    value={putawaySearch}
                    onChange={(e) => setPutawaySearch(e.target.value)}
                    className="pl-8 h-8 text-xs rounded-xl bg-background/50 border-border/40"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Select value={putawayStatusFilter} onValueChange={setPutawayStatusFilter}>
                    <SelectTrigger className="w-36 h-8 text-xs rounded-xl border-border/40">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Status</SelectItem>
                      <SelectItem value="ASSIGNED_TO_STORE">Ready to Receive</SelectItem>
                      <SelectItem value="PUTAWAY_IN_PROGRESS">In Progress</SelectItem>
                      <SelectItem value="PUTAWAY_COMPLETED">Completed</SelectItem>
                    </SelectContent>
                  </Select>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={refreshTasksAndBalances}
                    disabled={tasksLoading}
                    className="h-8 rounded-xl text-xs"
                  >
                    <RefreshCw className={cn("size-3.5", tasksLoading && "animate-spin")} />
                  </Button>
                </div>
              </div>

              {tasksLoading ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
                  <Loader2 className="size-6 animate-spin text-primary" />
                  <p className="text-xs">Loading store putaway tasks...</p>
                </div>
              ) : filteredPutawayTasks.length === 0 ? (
                <Card className="rounded-2xl p-12 text-center text-muted-foreground border-dashed">
                  <PackageCheck className="size-10 mx-auto text-muted-foreground/40 mb-3" />
                  <p className="font-semibold text-sm text-foreground">No Putaway Tasks</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {putawaySearch || putawayStatusFilter !== "ALL"
                      ? "No tasks match your filter criteria."
                      : "When Warehouse assigns goods from GRN to your store, they will appear here for physical QR scanning and confirmation."}
                  </p>
                </Card>
              ) : (
                <div className="grid gap-4 lg:grid-cols-2">
                  {filteredPutawayTasks.map((task) => {
                    const isPending =
                      task.status === "ASSIGNED_TO_STORE" || task.status === "PUTAWAY_PENDING";
                    const isInProgress = task.status === "PUTAWAY_IN_PROGRESS";
                    const isCompleted = task.status === "PUTAWAY_COMPLETED";

                    return (
                      <Card key={task.id} className="rounded-2xl p-5 shadow-sm border bg-card">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                              Store Putaway Order
                            </p>
                            <h3 className="font-mono text-base font-bold text-primary">
                              {task.task_number}
                            </h3>
                            <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                              GRN:{" "}
                              <span className="font-semibold text-foreground">
                                {task.grn_number}
                              </span>
                            </p>
                          </div>
                          <StatusBadge status={task.status} />
                        </div>

                        <div className="my-3.5 rounded-xl border bg-muted/20 p-3.5">
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="font-bold text-foreground">{task.material_name}</p>
                              <p className="font-mono text-xs text-muted-foreground">
                                {task.item_code}
                              </p>
                            </div>
                            <p className="text-right text-lg font-black text-primary">
                              {task.quantity.toLocaleString()}{" "}
                              <span className="text-xs font-normal text-muted-foreground">
                                {task.uom}
                              </span>
                            </p>
                          </div>
                        </div>

                        <div className="grid items-center gap-3 sm:grid-cols-[1fr_auto_1fr] text-xs">
                          <div className="rounded-xl border bg-muted/10 p-2.5">
                            <p className="text-[10px] font-semibold uppercase text-muted-foreground">
                              Source
                            </p>
                            <p className="font-mono font-semibold text-foreground truncate mt-0.5">
                              {task.source_location}
                            </p>
                          </div>
                          <ArrowRight className="mx-auto size-4 text-primary shrink-0" />
                          <div className="rounded-xl border bg-muted/10 p-2.5">
                            <p className="text-[10px] font-semibold uppercase text-muted-foreground">
                              Assigned Location
                            </p>
                            <p className="font-mono font-semibold text-foreground truncate mt-0.5">
                              {task.destination_bin_code ||
                                task.destination_zone ||
                                "Store Keeper Choice"}
                            </p>
                          </div>
                        </div>

                        {/* Actions based on task status */}
                        {isPending && (
                          <div className="mt-4 flex items-center justify-between gap-3 pt-3 border-t">
                            <p className="text-[11px] text-amber-700 dark:text-amber-400 font-medium flex items-center gap-1">
                              <Clock className="size-3.5" /> Assigned to your store
                            </p>
                            <Button
                              size="sm"
                              className="rounded-xl gap-1.5 shadow-glow text-xs"
                              onClick={() => handleStartPutaway(task)}
                            >
                              <Play className="size-3.5" /> Start Putaway
                            </Button>
                          </div>
                        )}

                        {isInProgress && (
                          <div className="mt-4 flex items-center justify-between gap-3 pt-3 border-t">
                            <p className="text-[11px] text-purple-700 dark:text-purple-400 font-medium flex items-center gap-1">
                              <ScanLine className="size-3.5 animate-pulse" /> Ready to scan QR codes
                            </p>
                            <Button
                              size="sm"
                              className="rounded-xl gap-1.5 shadow-glow text-xs bg-purple-600 hover:bg-purple-700 text-white"
                              onClick={() => handleOpenExecuteModal(task)}
                            >
                              <ScanLine className="size-3.5" /> Scan QR & Confirm
                            </Button>
                          </div>
                        )}

                        {isCompleted && (
                          <div className="mt-4 rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3 text-xs text-emerald-700 dark:text-emerald-400">
                            <p className="font-bold flex items-center gap-1.5">
                              <CheckCircle2 className="size-3.5 text-emerald-600" /> Stored in{" "}
                              {task.destination_bin_code || task.destination_zone || "Bin/Zone"}
                            </p>
                            <p className="text-[11px] mt-0.5 text-muted-foreground">
                              Confirmed by {task.completed_by} ·{" "}
                              {task.completed_at
                                ? new Date(task.completed_at).toLocaleString()
                                : ""}
                            </p>
                          </div>
                        )}
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: STORE ZONES & BINS */}
          {activeTab === "zones" && (
            <Card className="border-border/40 shadow-soft overflow-hidden">
              <CardHeader className="p-4 border-b border-border/40 bg-card/40 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                    <Layers className="size-4" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-bold">
                      Store Zones & Bins ({zones.length} zones)
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Physical layout: Store → Zones → Bins for organizing physical racks, shelves,
                      and storage bays.
                    </CardDescription>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="relative w-56">
                    <Search className="size-3.5 absolute left-3 top-2.5 text-muted-foreground" />
                    <Input
                      placeholder="Search zones & bins..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-8 h-8 text-xs rounded-xl bg-background/50 border-border/40"
                    />
                  </div>

                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-28 h-8 text-xs rounded-xl border-border/40">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Status</SelectItem>
                      <SelectItem value="ACTIVE">Active</SelectItem>
                      <SelectItem value="INACTIVE">Inactive</SelectItem>
                    </SelectContent>
                  </Select>

                  <Button
                    onClick={handleOpenCreateZone}
                    size="sm"
                    className="h-8 rounded-xl shadow-glow text-xs font-semibold"
                  >
                    <Plus className="size-3.5 mr-1" /> New Zone
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="p-0">
                {zonesLoading ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
                    <Loader2 className="size-6 animate-spin text-primary" />
                    <p className="text-xs">Loading zones and bins...</p>
                  </div>
                ) : filteredZones.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
                    <Layers className="size-8 text-muted-foreground/40" />
                    <p className="font-semibold text-sm text-foreground">No zones configured</p>
                    <p className="text-xs text-muted-foreground">
                      {search || statusFilter !== "ALL"
                        ? "No zones match your search filter"
                        : "Create your first store zone using the 'New Zone' button above"}
                    </p>
                  </div>
                ) : (
                  <div className="p-4 space-y-3">
                    {filteredZones.map((z) => {
                      const isZoneExpanded = expandedZoneIds.has(z.id);
                      const binsInZone = z.bins || [];

                      return (
                        <div
                          key={z.id}
                          className="rounded-xl border border-border/50 bg-card/60 overflow-hidden shadow-subtle"
                        >
                          <div className="flex items-center justify-between p-3 bg-muted/20 hover:bg-muted/30 transition-colors">
                            <div className="flex items-center gap-3">
                              <button
                                type="button"
                                onClick={() => toggleExpandZone(z.id)}
                                className="p-1 rounded-md hover:bg-muted/60 text-muted-foreground"
                              >
                                {isZoneExpanded ? (
                                  <ChevronDown className="size-4 text-indigo-400" />
                                ) : (
                                  <ChevronRight className="size-4" />
                                )}
                              </button>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-mono font-bold text-xs text-indigo-400">
                                    {z.zone_code}
                                  </span>
                                  <span className="font-semibold text-xs text-foreground">
                                    {z.zone_name}
                                  </span>
                                  <span className="font-mono text-[10px] text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded">
                                    {binsInZone.length} {binsInZone.length === 1 ? "bin" : "bins"}
                                  </span>
                                </div>
                                {z.description && (
                                  <p className="text-[11px] text-muted-foreground mt-0.5">
                                    {z.description}
                                  </p>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5">
                              <StatusBadge
                                status={z.status?.toUpperCase() === "ACTIVE" ? "PASS" : "REJECTED"}
                              />
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleOpenCreateBin(z)}
                                className="h-7 px-2 rounded-lg text-xs text-emerald-500 hover:bg-emerald-500/10"
                                title="Add Bin to Zone"
                              >
                                <Plus className="size-3 mr-1" /> Add Bin
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleViewZoneQR(z)}
                                className="h-7 px-2 rounded-lg text-xs bg-primary/5 text-primary hover:bg-primary/15"
                              >
                                <QrCode className="size-3 mr-1" /> Zone QR
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleOpenEditZone(z)}
                                className="h-7 px-2 rounded-lg text-xs hover:bg-primary/10 hover:text-primary"
                              >
                                <Edit className="size-3 mr-1" /> Edit
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleToggleZoneStatus(z)}
                                className={cn(
                                  "h-7 px-2 rounded-lg text-xs",
                                  z.status?.toUpperCase() === "ACTIVE"
                                    ? "text-amber-500 hover:bg-amber-500/10"
                                    : "text-emerald-500 hover:bg-emerald-500/10",
                                )}
                              >
                                <Power className="size-3 mr-1" />
                                {z.status?.toUpperCase() === "ACTIVE" ? "Deactivate" : "Activate"}
                              </Button>
                            </div>
                          </div>

                          {/* Nested Bins */}
                          {isZoneExpanded && (
                            <div className="p-3 pl-8 border-t border-border/40 bg-muted/10 space-y-2">
                              <div className="flex items-center justify-between text-[11px] text-muted-foreground font-semibold">
                                <div className="flex items-center gap-1.5">
                                  <Grid className="size-3.5 text-emerald-400" />
                                  <span>Physical Bins in {z.zone_code}</span>
                                </div>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleOpenCreateBin(z)}
                                  className="h-6 px-2 text-[10px] text-emerald-500 hover:bg-emerald-500/10"
                                >
                                  <Plus className="size-3 mr-1" /> Add Bin
                                </Button>
                              </div>

                              {binsInZone.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
                                  {binsInZone.map((b) => (
                                    <div
                                      key={b.id}
                                      className="flex items-start justify-between p-2.5 rounded-lg border bg-card/80 text-xs hover:border-emerald-500/30 transition-colors shadow-subtle"
                                    >
                                      <div className="space-y-1">
                                        <div className="flex items-center gap-1.5">
                                          <span className="font-mono font-bold text-emerald-400">
                                            {b.bin_code}
                                          </span>
                                          <span className="text-[11px] font-medium text-foreground">
                                            {b.bin_name}
                                          </span>
                                        </div>
                                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-mono">
                                          <span>Rack: {b.rack || "-"}</span>
                                          <span>Shelf: {b.shelf || "-"}</span>
                                          <span>Cap: {b.capacity}</span>
                                        </div>
                                      </div>
                                      <div className="flex flex-col items-end gap-1">
                                        <StatusBadge status={b.status} />
                                        <div className="flex items-center gap-1">
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleViewBinQR(b, z)}
                                            className="h-6 px-1.5 text-[10px] rounded text-primary hover:bg-primary/10"
                                            title="View Bin QR Label"
                                          >
                                            <QrCode className="size-3 mr-0.5" /> Bin QR
                                          </Button>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => handleToggleBinStatus(b)}
                                            className={cn(
                                              "size-6 rounded",
                                              b.status === "ACTIVE"
                                                ? "text-muted-foreground hover:text-rose-400"
                                                : "text-muted-foreground hover:text-emerald-400",
                                            )}
                                            title={
                                              b.status === "ACTIVE"
                                                ? "Deactivate Bin"
                                                : "Activate Bin"
                                            }
                                          >
                                            <Power className="size-3" />
                                          </Button>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="py-3 text-center text-muted-foreground text-xs italic">
                                  No physical bins in this zone yet. Click "+ Add Bin" to create
                                  one.
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* TAB 3: LIVE STORE INVENTORY */}
          {activeTab === "inventory" && (
            <Card className="border-border/40 shadow-soft overflow-hidden">
              <CardHeader className="p-4 border-b border-border/40 bg-card/40 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                    <Boxes className="size-4" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-bold">
                      Physical Stock Balances ({inventoryBalances.length})
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Materials confirmed and stored inside {store.store_name} across all zones and
                      bins.
                    </CardDescription>
                  </div>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={refreshTasksAndBalances}
                  className="h-8 rounded-xl text-xs gap-1.5"
                >
                  <RefreshCw className="size-3" /> Refresh Balances
                </Button>
              </CardHeader>

              <CardContent className="p-0">
                {inventoryBalances.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
                    <Boxes className="size-8 text-muted-foreground/40" />
                    <p className="font-semibold text-sm text-foreground">No Material Stored Yet</p>
                    <p className="text-xs text-muted-foreground">
                      Complete pending Putaway tasks to deposit material into this store.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-muted/30 text-xs font-semibold uppercase text-muted-foreground border-b border-border/40">
                        <tr>
                          <th className="py-3 px-4">Material Code</th>
                          <th className="py-3 px-4">Material Name</th>
                          <th className="py-3 px-4">Location / Zone</th>
                          <th className="py-3 px-4 text-right">Available Stock</th>
                          <th className="py-3 px-4 text-right">Last GRN</th>
                          <th className="py-3 px-4 text-right">Updated At</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/20">
                        {inventoryBalances.map((bal, idx) => (
                          <tr
                            key={bal.id || `${bal.material_code}-${bal.location_code}-${idx}`}
                            className="hover:bg-muted/10 transition-colors"
                          >
                            <td className="py-3 px-4 font-mono font-bold text-xs text-primary">
                              {bal.material_code}
                            </td>
                            <td className="py-3 px-4">
                              <div className="font-semibold text-xs text-foreground">
                                {bal.material_name}
                              </div>
                              <div className="text-[10px] text-muted-foreground">
                                {bal.category || "GENERAL"}
                              </div>
                            </td>
                            <td className="py-3 px-4 font-mono text-xs">
                              <span className="bg-muted/40 px-2 py-0.5 rounded border border-border/40">
                                {bal.location_code || bal.zone_code || "STORE"}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-bold text-xs text-emerald-600">
                              {bal.available_quantity.toLocaleString()} {bal.uom}
                            </td>
                            <td className="py-3 px-4 text-right font-mono text-xs text-muted-foreground">
                              {bal.last_grn_number || "—"}
                            </td>
                            <td className="py-3 px-4 text-right text-[11px] text-muted-foreground">
                              {bal.updated_at ? new Date(bal.updated_at).toLocaleString() : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* CREATE ZONE MODAL */}
          <Dialog open={createZoneOpen} onOpenChange={setCreateZoneOpen}>
            <DialogContent className="sm:max-w-md rounded-2xl">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Layers className="size-5 text-primary" /> Create Store Zone
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Create a physical storage zone within {store?.store_name} ({store?.store_code}).
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleCreateZoneSubmit} className="space-y-3.5 pt-2">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Zone Code (Auto-Generated)</Label>
                  <Input
                    value={customZoneCode || previewZoneCode}
                    onChange={(e) => setCustomZoneCode(e.target.value)}
                    className="text-xs font-mono font-bold text-primary rounded-xl"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">
                    Zone Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    placeholder="e.g. Electrical Panels Bay 01"
                    value={newZoneName}
                    onChange={(e) => setNewZoneName(e.target.value)}
                    required
                    className="text-xs rounded-xl"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Description / Rack Purpose</Label>
                  <Textarea
                    placeholder="Specific materials stored, temperature or security considerations..."
                    value={newZoneDesc}
                    onChange={(e) => setNewZoneDesc(e.target.value)}
                    className="text-xs rounded-xl min-h-16"
                  />
                </div>

                <DialogFooter className="pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setCreateZoneOpen(false)}
                    className="rounded-xl text-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={creatingZone}
                    className="rounded-xl text-xs font-semibold shadow-glow"
                  >
                    {creatingZone && <Loader2 className="size-3.5 animate-spin mr-1.5" />}
                    Create Zone
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          {/* CREATE BIN MODAL */}
          <Dialog open={createBinOpen} onOpenChange={setCreateBinOpen}>
            <DialogContent className="sm:max-w-md rounded-2xl">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Grid className="size-5 text-emerald-500" /> Create Physical Storage Bin
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Create a physical storage bin in Zone {targetZoneForBin?.zone_code}.
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleCreateBinSubmit} className="space-y-3.5 pt-2">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Bin Code (Auto-Generated)</Label>
                  <Input
                    value={previewBinCode}
                    disabled
                    className="text-xs font-mono font-bold text-emerald-500 rounded-xl bg-muted/40"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">
                    Bin Name / Label <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    placeholder="e.g. Primary Shelf Bin 01"
                    value={newBinName}
                    onChange={(e) => setNewBinName(e.target.value)}
                    required
                    className="text-xs rounded-xl"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Rack Code</Label>
                    <Input
                      placeholder="R01"
                      value={newBinRack}
                      onChange={(e) => setNewBinRack(e.target.value)}
                      className="text-xs rounded-xl"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Shelf Code</Label>
                    <Input
                      placeholder="S01"
                      value={newBinShelf}
                      onChange={(e) => setNewBinShelf(e.target.value)}
                      className="text-xs rounded-xl"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Capacity Quantity</Label>
                  <Input
                    type="number"
                    value={newBinCapacity}
                    onChange={(e) => setNewBinCapacity(e.target.value)}
                    required
                    className="text-xs rounded-xl"
                  />
                </div>

                <DialogFooter className="pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setCreateBinOpen(false)}
                    className="rounded-xl text-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={creatingBin}
                    className="rounded-xl text-xs font-semibold shadow-glow bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    {creatingBin && <Loader2 className="size-3.5 animate-spin mr-1.5" />}
                    Create Bin
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          {/* EDIT ZONE MODAL */}
          <Dialog open={editZoneOpen} onOpenChange={setEditZoneOpen}>
            <DialogContent className="sm:max-w-md rounded-2xl">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Edit className="size-5 text-primary" /> Edit Zone {editingZone?.zone_code}
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Update zone name and storage details.
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleEditZoneSubmit} className="space-y-3.5 pt-2">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Zone Code</Label>
                  <Input
                    value={editingZone?.zone_code || ""}
                    disabled
                    className="text-xs font-mono font-bold text-muted-foreground rounded-xl"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">
                    Zone Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    value={editZoneName}
                    onChange={(e) => setEditZoneName(e.target.value)}
                    required
                    className="text-xs rounded-xl"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Description</Label>
                  <Textarea
                    value={editZoneDesc}
                    onChange={(e) => setEditZoneDesc(e.target.value)}
                    className="text-xs rounded-xl min-h-16"
                  />
                </div>

                <DialogFooter className="pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setEditZoneOpen(false)}
                    className="rounded-xl text-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={savingZone}
                    className="rounded-xl text-xs font-semibold shadow-glow"
                  >
                    {savingZone ? (
                      <Loader2 className="size-3.5 animate-spin mr-1.5" />
                    ) : (
                      <Save className="size-3.5 mr-1.5" />
                    )}
                    Save Changes
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          {/* ZONE QR MODAL */}
          <Dialog open={qrModalOpen} onOpenChange={setQrModalOpen}>
            <DialogContent className="sm:max-w-md rounded-2xl text-center">
              <DialogHeader>
                <DialogTitle className="flex items-center justify-center gap-2">
                  <QrCode className="size-5 text-primary" /> Zone QR Code
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Physical storage location barcode label for scanning during Putaway.
                </DialogDescription>
              </DialogHeader>

              {loadingQr ? (
                <div className="flex flex-col items-center justify-center py-10 gap-2">
                  <Loader2 className="size-8 animate-spin text-primary" />
                  <p className="text-xs text-muted-foreground">Generating QR payload...</p>
                </div>
              ) : (
                selectedZoneForQr && (
                  <div className="space-y-4 pt-2">
                    <div className="p-4 rounded-xl border border-border/60 bg-white inline-block shadow-sm">
                      {qrDataUrl ? (
                        <img src={qrDataUrl} alt="Zone QR" className="size-48 mx-auto" />
                      ) : (
                        <div className="size-48 flex items-center justify-center text-xs text-muted-foreground">
                          No QR available
                        </div>
                      )}
                    </div>

                    <div>
                      <span className="font-mono text-lg font-black text-primary">
                        {selectedZoneForQr.zone_code}
                      </span>
                      <p className="font-semibold text-xs text-foreground mt-0.5">
                        {selectedZoneForQr.zone_name}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {store?.store_name} ({store?.store_code})
                      </p>
                    </div>

                    <div className="flex items-center justify-center gap-2 pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handlePrintQR}
                        className="rounded-xl text-xs gap-1.5"
                      >
                        <Printer className="size-3.5" /> Print Label
                      </Button>
                      <Button
                        variant="default"
                        size="sm"
                        onClick={handleDownloadQR}
                        className="rounded-xl text-xs gap-1.5 shadow-glow"
                      >
                        <Download className="size-3.5" /> Download PNG
                      </Button>
                    </div>
                  </div>
                )
              )}
            </DialogContent>
          </Dialog>

          {/* BIN QR MODAL */}
          <Dialog open={binQrModalOpen} onOpenChange={setBinQrModalOpen}>
            <DialogContent className="sm:max-w-md rounded-2xl text-center">
              <DialogHeader>
                <DialogTitle className="flex items-center justify-center gap-2">
                  <QrCode className="size-5 text-emerald-500" /> Bin QR Code
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Physical storage bin barcode label for exact location verification.
                </DialogDescription>
              </DialogHeader>

              {loadingBinQr ? (
                <div className="flex flex-col items-center justify-center py-10 gap-2">
                  <Loader2 className="size-8 animate-spin text-emerald-500" />
                  <p className="text-xs text-muted-foreground">Generating Bin QR payload...</p>
                </div>
              ) : (
                selectedBinForQr && (
                  <div className="space-y-4 pt-2">
                    <div className="p-4 rounded-xl border border-border/60 bg-white inline-block shadow-sm">
                      {binQrDataUrl ? (
                        <img src={binQrDataUrl} alt="Bin QR" className="size-48 mx-auto" />
                      ) : (
                        <div className="size-48 flex items-center justify-center text-xs text-muted-foreground">
                          No QR available
                        </div>
                      )}
                    </div>

                    <div>
                      <span className="font-mono text-lg font-black text-emerald-500">
                        {selectedBinForQr.bin_code}
                      </span>
                      <p className="font-semibold text-xs text-foreground mt-0.5">
                        {selectedBinForQr.bin_name}
                      </p>
                      <p className="text-[11px] text-muted-foreground font-mono">
                        Rack: {selectedBinForQr.rack || "-"} · Shelf:{" "}
                        {selectedBinForQr.shelf || "-"} · Capacity: {selectedBinForQr.capacity}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {store?.store_name} ({store?.store_code}) /{" "}
                        {selectedZoneForBinQr?.zone_code}
                      </p>
                    </div>

                    <div className="flex items-center justify-center gap-2 pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handlePrintBinQR}
                        className="rounded-xl text-xs gap-1.5"
                      >
                        <Printer className="size-3.5" /> Print Label
                      </Button>
                      <Button
                        variant="default"
                        size="sm"
                        onClick={handleDownloadBinQR}
                        className="rounded-xl text-xs gap-1.5 shadow-glow bg-emerald-600 hover:bg-emerald-700 text-white"
                      >
                        <Download className="size-3.5" /> Download PNG
                      </Button>
                    </div>
                  </div>
                )
              )}
            </DialogContent>
          </Dialog>

          {/* STORE KEEPER PUTAWAY EXECUTION MODAL */}
          <Dialog open={executeModalOpen} onOpenChange={setExecuteModalOpen}>
            <DialogContent className="sm:max-w-lg rounded-2xl">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-primary font-bold">
                  <ScanLine className="size-5" /> Execute Physical Putaway
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Scan Material QR & Destination Zone/Bin QR to confirm physical putaway into{" "}
                  {store?.store_name}.
                </DialogDescription>
              </DialogHeader>

              {executingTask && (
                <form onSubmit={handleConfirmPutawaySubmit} className="space-y-4 pt-2">
                  {/* Task Summary Banner */}
                  <div className="rounded-xl border bg-muted/20 p-3.5 text-xs">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-mono font-bold text-primary">
                          {executingTask.task_number}
                        </p>
                        <p className="font-bold text-foreground mt-0.5">
                          {executingTask.material_name}
                        </p>
                        <p className="font-mono text-muted-foreground">{executingTask.item_code}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-black text-base text-primary">
                          {executingTask.quantity.toLocaleString()} {executingTask.uom}
                        </p>
                        <p className="font-mono text-[11px] text-muted-foreground">
                          GRN: {executingTask.grn_number}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Step 1: Scan Material QR */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-foreground flex items-center justify-between">
                      <span>
                        1. Material QR / Tag <span className="text-destructive">*</span>
                      </span>
                      {verifiedHU && (
                        <span className="text-emerald-600 font-normal text-[11px] flex items-center gap-1">
                          <CheckCircle2 className="size-3" /> Verified
                        </span>
                      )}
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Scan Material QR payload / HU tag"
                        value={matScanInput}
                        onChange={(e) => setMatScanInput(e.target.value)}
                        className="text-xs font-mono"
                        required
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={!matScanInput.trim() || verifyingMat}
                        onClick={handleVerifyMaterial}
                        className="shrink-0 text-xs rounded-xl"
                      >
                        {verifyingMat ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <ScanLine className="size-3.5" />
                        )}{" "}
                        Verify
                      </Button>
                    </div>
                  </div>

                  {/* Step 2: Select Destination Zone & Bin */}
                  <div className="space-y-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-foreground">
                        2. Destination Store Zone <span className="text-destructive">*</span>
                      </Label>
                      <Select
                        value={zoneScanInput}
                        onValueChange={(val) => {
                          setZoneScanInput(val);
                          setBinScanInput("");
                        }}
                      >
                        <SelectTrigger className="text-xs rounded-xl">
                          <SelectValue placeholder="Select active store zone" />
                        </SelectTrigger>
                        <SelectContent>
                          {activeZonesList.map((z) => (
                            <SelectItem key={z.id} value={z.id}>
                              {z.zone_name} ({z.zone_code})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {selectedZoneBins.length > 0 && (
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                          <Grid className="size-3 text-emerald-400" />
                          <span>
                            Destination Bin (Optional - Auto-provisions primary bin if none
                            selected)
                          </span>
                        </Label>
                        <Select value={binScanInput} onValueChange={setBinScanInput}>
                          <SelectTrigger className="text-xs rounded-xl font-mono text-emerald-600">
                            <SelectValue placeholder="-- Select Specific Physical Bin (or Auto-assign) --" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">-- Default Zone Primary Bin --</SelectItem>
                            {selectedZoneBins.map((b) => (
                              <SelectItem key={b.id} value={b.id}>
                                {b.bin_code} — {b.bin_name} (Rack: {b.rack || "-"}, Shelf:{" "}
                                {b.shelf || "-"})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>

                  {/* Step 3: Quantity Confirmation */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-foreground">
                      3. Confirmed Quantity ({executingTask.uom}){" "}
                      <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      type="number"
                      min="0.0001"
                      max={executingTask.quantity}
                      step="any"
                      placeholder="Enter confirmed quantity"
                      value={confirmedQty}
                      onChange={(e) => setConfirmedQty(e.target.value)}
                      className="text-xs"
                      required
                    />
                  </div>

                  <DialogFooter className="pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setExecuteModalOpen(false)}
                      className="rounded-xl text-xs"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      size="sm"
                      disabled={confirmingPutaway || !matScanInput.trim() || !zoneScanInput.trim()}
                      className="rounded-xl text-xs font-semibold shadow-glow bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      {confirmingPutaway ? (
                        <Loader2 className="size-3.5 animate-spin mr-1.5" />
                      ) : (
                        <CheckCircle2 className="size-3.5 mr-1.5" />
                      )}
                      Confirm Physical Putaway
                    </Button>
                  </DialogFooter>
                </form>
              )}
            </DialogContent>
          </Dialog>

          {/* TAB 2: OUTBOUND PICKUP TASKS */}
          {activeTab === "pickup" && (
            <div className="space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="relative w-72">
                  <Search className="size-3.5 absolute left-3 top-2.5 text-muted-foreground" />
                  <Input
                    placeholder="Search assigned pickup tasks..."
                    value={pickupSearch}
                    onChange={(e) => setPickupSearch(e.target.value)}
                    className="pl-8 h-8 text-xs rounded-xl bg-background/50 border-border/40"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Select value={pickupStatusFilter} onValueChange={setPickupStatusFilter}>
                    <SelectTrigger className="w-36 h-8 text-xs rounded-xl border-border/40">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Status</SelectItem>
                      <SelectItem value="ASSIGNED_TO_STORE">Ready to Pick</SelectItem>
                      <SelectItem value="PICKING">In Progress</SelectItem>
                      <SelectItem value="COMPLETED">Completed</SelectItem>
                    </SelectContent>
                  </Select>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={fetchStoreData}
                    className="h-8 rounded-xl text-xs"
                  >
                    <RefreshCw className="size-3 mr-1" /> Refresh
                  </Button>
                </div>
              </div>

              {pickupTasksLoading ? (
                <div className="flex items-center justify-center p-12">
                  <Loader2 className="size-6 animate-spin text-primary" />
                </div>
              ) : filteredPickupTasks.length === 0 ? (
                <Card className="border-dashed border-border/60 p-8 text-center bg-card/40">
                  <ClipboardList className="size-8 mx-auto text-muted-foreground opacity-40 mb-2" />
                  <p className="text-xs font-bold text-muted-foreground">
                    No Outbound Pickup Tasks Found
                  </p>
                  <p className="text-[11px] text-muted-foreground/70 mt-0.5">
                    Material requests assigned to your store by Warehouse will appear here for
                    picking.
                  </p>
                </Card>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {filteredPickupTasks.map((pt) => {
                    const isPending = pt.status === "ASSIGNED_TO_STORE";
                    const isCompleted = pt.status === "COMPLETED";

                    return (
                      <Card key={pt.id} className="border-border/40 shadow-soft overflow-hidden">
                        <CardHeader className="p-4 bg-muted/20 border-b border-border/40 flex flex-row items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-bold text-primary">
                                {pt.task_number}
                              </span>
                              <span className="text-[10px] text-muted-foreground">
                                Req: {pt.request_number}
                              </span>
                            </div>
                            <h4 className="font-bold text-sm text-foreground mt-1">
                              {pt.material_name}
                            </h4>
                            <p className="text-xs font-mono text-muted-foreground">
                              {pt.material_code}
                            </p>
                          </div>
                          <StatusBadge status={pt.status} />
                        </CardHeader>
                        <CardContent className="p-4 space-y-3">
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="p-2.5 rounded-xl bg-card border border-border/40">
                              <p className="text-[10px] uppercase font-bold text-muted-foreground">
                                Requested Qty
                              </p>
                              <p className="font-black text-foreground mt-0.5 text-sm">
                                {pt.requested_quantity}{" "}
                                <span className="text-[10px] font-normal">{pt.uom}</span>
                              </p>
                            </div>
                            <div className="p-2.5 rounded-xl bg-card border border-border/40">
                              <p className="text-[10px] uppercase font-bold text-muted-foreground">
                                Target Dept
                              </p>
                              <p className="font-bold text-foreground mt-0.5 truncate">
                                {pt.department}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
                            <span>
                              Priority: <strong className="text-foreground">{pt.priority}</strong>
                            </span>
                            <span>
                              Required:{" "}
                              <strong>{new Date(pt.required_date).toLocaleDateString()}</strong>
                            </span>
                          </div>

                          <div className="pt-2 border-t border-border/40 flex items-center justify-between">
                            <span className="text-[10px] text-muted-foreground">
                              {isCompleted ? `Picked by ${pt.picked_by}` : "Ready for Store Pickup"}
                            </span>
                            {!isCompleted && (
                              <Button
                                size="sm"
                                onClick={() => handleOpenExecutePickup(pt)}
                                className="h-7 px-3 text-xs rounded-xl shadow-glow gap-1.5"
                              >
                                <ScanLine className="size-3.5" /> Pick & Issue
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* STORE KEEPER PICKUP EXECUTION MODAL */}
          <Dialog open={executePickupModalOpen} onOpenChange={setExecutePickupModalOpen}>
            <DialogContent className="sm:max-w-md rounded-2xl">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <ScanLine className="size-5 text-primary" /> Execute Store Pickup & Issue
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Pick and issue material from {store.store_name} to{" "}
                  {executingPickupTask?.department}.
                </DialogDescription>
              </DialogHeader>

              {executingPickupTask && (
                <form onSubmit={handleConfirmPickupSubmit} className="space-y-4 pt-2">
                  <div className="p-3 bg-muted/20 border border-border/40 rounded-xl space-y-1">
                    <p className="text-xs font-bold text-foreground">
                      {executingPickupTask.material_name}
                    </p>
                    <p className="text-[11px] font-mono text-muted-foreground">
                      Code: {executingPickupTask.material_code}
                    </p>
                    <p className="text-[11px] text-primary font-bold">
                      Requested: {executingPickupTask.requested_quantity} {executingPickupTask.uom}
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">
                      1. Material QR / Code Verification
                    </Label>
                    <Input
                      value={pickupMatScan}
                      onChange={(e) => setPickupMatScan(e.target.value)}
                      placeholder="Scan or enter material code"
                      className="text-xs font-mono rounded-xl"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">2. Source Store Zone</Label>
                    <Select value={pickupZoneScan} onValueChange={setPickupZoneScan}>
                      <SelectTrigger className="text-xs rounded-xl">
                        <SelectValue placeholder="Select Zone" />
                      </SelectTrigger>
                      <SelectContent>
                        {activeZonesList.map((z) => (
                          <SelectItem key={z.id} value={z.id}>
                            {z.zone_name} ({z.zone_code})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">
                      3. Picked / Issued Quantity ({executingPickupTask.uom})
                    </Label>
                    <Input
                      type="number"
                      step="any"
                      min="0.0001"
                      max={executingPickupTask.requested_quantity}
                      value={pickupQty}
                      onChange={(e) => setPickupQty(e.target.value)}
                      className="text-xs rounded-xl font-mono font-bold"
                      required
                    />
                  </div>

                  <DialogFooter className="pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setExecutePickupModalOpen(false)}
                      className="rounded-xl text-xs"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={confirmingPickup}
                      className="rounded-xl text-xs font-semibold shadow-glow"
                    >
                      {confirmingPickup && <Loader2 className="size-3.5 animate-spin mr-1.5" />}
                      Confirm Pickup & Issue
                    </Button>
                  </DialogFooter>
                </form>
              )}
            </DialogContent>
          </Dialog>
        </div>
      )}
    </AppShell>
  );
}
