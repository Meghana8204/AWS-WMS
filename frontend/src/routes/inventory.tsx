import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Boxes,
  Search,
  Filter,
  Loader2,
  AlertTriangle,
  Plus,
  History,
  MapPin,
  RefreshCw,
} from "lucide-react";
import { AppShell, StatusBadge } from "@/components/wms/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api-client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/inventory")({
  component: Inventory,
});

function Inventory() {
  const [stock, setStock] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [locationBalances, setLocationBalances] = useState<any[]>([]);
  const [putawayTasks, setPutawayTasks] = useState<any[]>([]);
  const [finishedGoods, setFinishedGoods] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [showAwaitingOnly, setShowAwaitingOnly] = useState(false);

  const fetchData = useCallback(async (showLoader = true, showError = true) => {
    try {
      if (showLoader) setLoading(true);
      const [data, transactionData, locationData, taskData, finishedGoodsData] = await Promise.all([
        api.getMaterialStock(),
        api.getInventoryTransactions(),
        api.getInventoryLocationBalances(),
        api.getPutawayTasks(),
        api.getAssemblyFinishedGoods(),
      ]);
      setStock(data);
      setTransactions(transactionData);
      setLocationBalances(locationData);
      setPutawayTasks(taskData);
      setFinishedGoods(finishedGoodsData);
    } catch (error) {
      if (showError) {
        toast.error("Failed to load inventory", {
          description: error instanceof Error ? error.message : undefined,
        });
      }
    } finally {
      if (showLoader) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();

    const refreshFromBackend = () => {
      if (document.visibilityState === "visible") void fetchData(false, false);
    };
    const interval = window.setInterval(refreshFromBackend, 5_000);
    window.addEventListener("focus", refreshFromBackend);
    document.addEventListener("visibilitychange", refreshFromBackend);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshFromBackend);
      document.removeEventListener("visibilitychange", refreshFromBackend);
    };
  }, [fetchData]);

  const inventoryRows = useMemo(
    () =>
      stock
        .map((item) => {
          const trackedLocations = locationBalances.filter(
            (location) =>
              location.material_code === item.materialCode &&
              location.warehouse_id === item.warehouseId,
          );
          const postedLocations = finishedGoods
            .filter(
              (posting) =>
                posting.product_code === item.materialCode &&
                posting.warehouse === item.warehouseId &&
                posting.status === "AVAILABLE",
            )
            .map((posting) => ({
              id: `finished-good-${posting.id}`,
              material_code: posting.product_code,
              material_name: posting.product_name,
              warehouse_id: posting.warehouse,
              location_code: posting.location,
              quantity: Number(posting.quantity),
              available_quantity: Number(posting.quantity),
              uom: posting.uom,
              status: "ACTIVE",
              source: "FINISHED_GOODS_POSTING",
            }));
          const locations = trackedLocations.length ? trackedLocations : postedLocations;
          const pendingTasks = putawayTasks.filter(
            (task) =>
              task.item_code === item.materialCode &&
              task.warehouse_id === item.warehouseId &&
              ["OPEN", "ASSIGNED", "PUTAWAY_IN_PROGRESS"].includes(task.status),
          );
          return {
            ...item,
            locations,
            awaitingQuantity: pendingTasks.reduce(
              (total, task) => total + Number(task.quantity || 0),
              0,
            ),
          };
        })
        .filter((item) => {
          const search = query.trim().toLocaleLowerCase();
          const matchesSearch =
            !search ||
            item.materialName.toLocaleLowerCase().includes(search) ||
            item.materialCode.toLocaleLowerCase().includes(search);
          return matchesSearch && (!showAwaitingOnly || item.awaitingQuantity > 0);
        }),
    [finishedGoods, locationBalances, putawayTasks, query, showAwaitingOnly, stock],
  );

  return (
    <AppShell
      title="Warehouse Inventory"
      subtitle="Real-time stock on hand and bin locations"
      actions={
        <Button className="rounded-xl shadow-glow" asChild>
          <Link to="/warehouse/material-requests">
            <Plus className="size-4 mr-2" /> Raise MR
          </Link>
        </Button>
      }
    >
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search material code or name..."
            className="pl-10 rounded-xl border-border"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <Button
          variant={showAwaitingOnly ? "default" : "outline"}
          className="rounded-xl"
          onClick={() => setShowAwaitingOnly((value) => !value)}
        >
          <Filter className="mr-2 size-4" /> Awaiting Putaway
        </Button>
        <Button
          variant="outline"
          className="rounded-xl"
          onClick={() => void fetchData()}
          disabled={loading}
        >
          <RefreshCw className={cn("mr-2 size-4", loading && "animate-spin")} /> Refresh
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <InventoryStat
          label="Total SKUs"
          value={stock.length}
          icon={Boxes}
          color="text-primary"
          bg="bg-primary-soft/20"
        />
        <InventoryStat
          label="Low Stock"
          value={stock.filter((s) => parseFloat(s.onHand) < parseFloat(s.reorderPoint)).length}
          icon={AlertTriangle}
          color="text-warning"
          bg="bg-warning-soft/20"
        />
        <InventoryStat
          label="Out of Stock"
          value={stock.filter((s) => parseFloat(s.onHand) === 0).length}
          icon={Boxes}
          color="text-destructive"
          bg="bg-destructive-soft/20"
        />
        <InventoryStat
          label="Total Units"
          value={stock.reduce((acc, s) => acc + parseFloat(s.onHand), 0).toLocaleString()}
          icon={Boxes}
          color="text-success"
          bg="bg-success-soft/20"
        />
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="size-8 animate-spin text-primary" />
        </div>
      ) : (
        <Card className="border-border/40 overflow-hidden shadow-soft">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/30 border-b border-border/60 text-[10px] uppercase font-black tracking-widest text-muted-foreground">
                <tr>
                  <th className="px-6 py-4">Material</th>
                  <th className="px-6 py-4">Storage Locations</th>
                  <th className="px-6 py-4">Category</th>
                  <th className="px-6 py-4 text-right">On Hand</th>
                  <th className="px-6 py-4 text-right">Allocated</th>
                  <th className="px-6 py-4 text-right">Available</th>
                  <th className="px-6 py-4">UOM</th>
                  <th className="px-6 py-4">Warehouse</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {inventoryRows.map((s) => {
                  const materialLocations = s.locations;
                  const awaitingQuantity = s.awaitingQuantity;
                  return (
                    <tr key={s.id} className="hover:bg-muted/5 transition-colors group">
                      <td className="px-6 py-4">
                        <p className="font-bold text-foreground">{s.materialName}</p>
                        <p className="font-mono text-[10px] text-muted-foreground">
                          {s.materialCode}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <div className="min-w-64 space-y-2">
                          {awaitingQuantity > 0 && (
                            <div className="rounded-lg border border-warning/30 bg-warning-soft/30 px-3 py-2">
                              <p className="font-semibold text-warning-foreground">
                                Awaiting Putaway
                              </p>
                              <p className="mt-1 text-[11px] text-muted-foreground">
                                {awaitingQuantity.toLocaleString()} {s.uom} · Receiving area
                              </p>
                            </div>
                          )}
                          {materialLocations.map((location) => (
                            <div
                              key={location.id}
                              className={cn(
                                "rounded-lg border px-3 py-2",
                                location.quantity > 0
                                  ? "border-success/25 bg-success-soft/30"
                                  : "border-muted-foreground/20 bg-muted/30",
                              )}
                            >
                              <p className="flex items-center gap-1 font-mono text-xs font-bold">
                                <MapPin className="size-3 text-primary" />
                                {location.location_code ||
                                  `${location.zone} / ${location.rack} / ${location.bin}`}
                              </p>
                              <p className="mt-1 text-[11px] text-muted-foreground">
                                Stock:{" "}
                                <b className="text-foreground">
                                  {location.quantity.toLocaleString()} {location.uom}
                                </b>{" "}
                                · Available:{" "}
                                <b className={location.available_quantity > 0 ? "text-success" : "text-muted-foreground"}>
                                  {location.available_quantity.toLocaleString()} {location.uom}
                                </b>
                              </p>
                              {location.status === "DEPLETED" && (
                                <p className="mt-1 text-[11px] font-semibold text-muted-foreground">
                                  Bin depleted after material issue
                                </p>
                              )}
                              {location.source === "FINISHED_GOODS_POSTING" && (
                                <p className="mt-1 text-[11px] font-semibold text-primary">
                                  Finished-goods production posting
                                </p>
                              )}
                            </div>
                          ))}
                          {awaitingQuantity === 0 && materialLocations.length === 0 && (
                            <span className="text-xs text-muted-foreground">
                              No tracked bin location
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground font-medium">
                        {String(s.category).replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase())}
                      </td>
                      <td className="px-6 py-4 text-right font-mono font-bold">
                        {parseFloat(s.onHand).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-right font-mono text-muted-foreground">
                        {parseFloat(s.allocated).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-right font-mono font-black text-primary">
                        {parseFloat(s.available).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 font-bold text-muted-foreground">{s.uom}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5 text-xs font-medium">
                          <MapPin className="size-3 text-muted-foreground" />
                          {s.warehouseId}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <StatusBadge
                          status={
                            awaitingQuantity > 0
                              ? "AWAITING_PUTAWAY"
                              : Number(s.onHand) === 0
                                ? "OUT_OF_STOCK"
                                : "ACTIVE"
                          }
                        />
                      </td>
                      <td className="px-6 py-4 text-right" />
                    </tr>
                  );
                })}
                {inventoryRows.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-6 py-12 text-center text-muted-foreground">
                      No inventory matches the current filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      {!loading && locationBalances.length > 0 && (
        <StoredInventoryTable locations={locationBalances} />
      )}
      {!loading && (
        <Card className="mt-8 overflow-hidden border-border/40 shadow-soft">
          <div className="flex items-center gap-3 border-b p-5">
            <History className="size-5 text-primary" />
            <div>
              <h2 className="font-bold">Inventory Transactions</h2>
              <p className="text-xs text-muted-foreground">
                GRN → Inventory transaction → Stock updated
              </p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/30 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">GRN / References</th>
                  <th className="px-4 py-3">Supplier</th>
                  <th className="px-4 py-3">Warehouse</th>
                  <th className="px-4 py-3">Material</th>
                  <th className="px-4 py-3 text-right">Previous</th>
                  <th className="px-4 py-3 text-right">GRN</th>
                  <th className="px-4 py-3 text-right">New Stock</th>
                  <th className="px-4 py-3">Date / Time</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                      No posted GRN inventory transactions.
                    </td>
                  </tr>
                ) : (
                  transactions.map((tx) => (
                    <tr key={tx.id}>
                      <td className="px-4 py-3">
                        <b className="font-mono text-primary">{tx.grn_number}</b>
                        <p className="font-mono text-xs text-muted-foreground">
                          {tx.po_number} · {tx.asn_number}
                        </p>
                      </td>
                      <td className="px-4 py-3">{tx.supplier_name}</td>
                      <td className="px-4 py-3 font-mono">{tx.warehouse_id}</td>
                      <td className="px-4 py-3">
                        <b>{tx.material_name}</b>
                        <p className="font-mono text-xs text-muted-foreground">{tx.item_code}</p>
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        {tx.previous_stock.toLocaleString()} {tx.uom}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-success">
                        +{tx.quantity.toLocaleString()} {tx.uom}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold">
                        {tx.new_stock.toLocaleString()} {tx.uom}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {new Date(tx.posted_at).toLocaleString()}
                        <p className="text-muted-foreground">{tx.posted_by}</p>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </AppShell>
  );
}

function StoredInventoryTable({ locations }: { locations: any[] }) {
  return (
    <Card className="mt-8 overflow-hidden border-border/40 shadow-soft">
      <div className="flex items-center gap-3 border-b p-5">
        <MapPin className="size-5 text-success" />
        <div>
          <h2 className="font-bold">Tracked Bin Inventory</h2>
          <p className="text-xs text-muted-foreground">
            Current and depleted stock by actual storage location
          </p>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/30 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            <tr>
              <th className="px-5 py-3">Material</th>
              <th className="px-5 py-3">Location</th>
              <th className="px-5 py-3 text-right">On Hand</th>
              <th className="px-5 py-3 text-right">Available</th>
              <th className="px-5 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {locations.map((location) => (
              <tr key={location.id}>
                <td className="px-5 py-4">
                  <p className="font-bold">{location.material_name}</p>
                  <p className="font-mono text-xs text-muted-foreground">
                    {location.material_code}
                  </p>
                </td>
                <td className="px-5 py-4 font-mono font-bold text-primary">
                  {location.location_code}
                </td>
                <td className="px-5 py-4 text-right font-mono font-bold">
                  {location.quantity.toLocaleString()} {location.uom}
                </td>
                <td className="px-5 py-4 text-right font-mono font-black text-success">
                  {location.available_quantity.toLocaleString()} {location.uom}
                </td>
                <td className="px-5 py-4">
                  <StatusBadge status={location.status || "ACTIVE"} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function InventoryStat({ label, value, icon: Icon, color, bg }: any) {
  return (
    <Card className="border-border/40 shadow-soft overflow-hidden">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">
              {label}
            </p>
            <h2 className="text-2xl font-black mt-1">{value}</h2>
          </div>
          <div className={cn("size-12 rounded-2xl flex items-center justify-center", bg, color)}>
            <Icon className="size-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
