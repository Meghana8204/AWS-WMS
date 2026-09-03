import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Boxes,
  Search,
  Loader2,
  AlertTriangle,
  Plus,
  History,
  MapPin,
} from "lucide-react";
import { AppShell, StatusBadge } from "@/components/wms/app-shell";
import { StatCard } from "@/components/wms/primitives";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/api-client";
import { toast } from "sonner";
export const Route = createFileRoute("/inventory")({
  component: Inventory,
});
function Inventory() {
  const [stock, setStock] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [locationBalances, setLocationBalances] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [stockFilter, setStockFilter] = useState("ALL");
  const fetchData = async () => {
    try {
      setLoading(true);
      const [data, transactionData, locationData] = await Promise.all([
        api.getMaterialStock(),
        api.getInventoryTransactions(),
        api.getInventoryLocationBalances(),
      ]);
      setStock(data);
      setTransactions(transactionData);
      setLocationBalances(locationData);
    } catch (error) {
      toast.error("Failed to load inventory");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    fetchData();
  }, []);

  const filteredStock = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return stock.filter((item) => {
      const onHand = Number(item.onHand ?? 0);
      const reorderPoint = Number(item.reorderPoint ?? 0);
      const matchesSearch = !query || [item.materialCode, item.materialName, item.category, item.warehouseId]
        .some((value) => value?.toLowerCase().includes(query));
      const matchesStatus = stockFilter === "ALL"
        || (stockFilter === "LOW" && onHand > 0 && onHand < reorderPoint)
        || (stockFilter === "OUT" && onHand === 0)
        || (stockFilter === "AVAILABLE" && onHand >= reorderPoint);
      return matchesSearch && matchesStatus;
    });
  }, [searchTerm, stock, stockFilter]);
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
      <div className="mb-6 grid auto-rows-fr items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total SKUs" value={loading ? "..." : String(stock.length)} icon={Boxes} tone="primary" />
        <StatCard
          label="Low Stock"
          value={loading ? "..." : String(stock.filter((s) => Number(s.onHand) > 0 && Number(s.onHand) < Number(s.reorderPoint)).length)}
          icon={AlertTriangle}
          tone="warning"
        />
        <StatCard
          label="Out of Stock"
          value={loading ? "..." : String(stock.filter((s) => Number(s.onHand) === 0).length)}
          icon={Boxes}
          tone="danger"
        />
        <StatCard
          label="Total Units"
          value={loading ? "..." : stock.reduce((acc, s) => acc + Number(s.onHand ?? 0), 0).toLocaleString()}
          icon={Boxes}
          tone="success"
        />
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[280px] max-w-md flex-1">
          <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search material code or name..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className="h-10 rounded-xl border-border bg-card pl-10 pr-4 text-sm focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <Select value={stockFilter} onValueChange={setStockFilter}>
          <SelectTrigger className="h-10 w-44 rounded-xl bg-card text-xs font-medium">
            <SelectValue placeholder="All Stock" />
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            <SelectItem value="ALL">All Stock</SelectItem>
            <SelectItem value="AVAILABLE">Available</SelectItem>
            <SelectItem value="LOW">Low Stock</SelectItem>
            <SelectItem value="OUT">Out of Stock</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="size-8 animate-spin text-primary" />
        </div>
      ) : (
        <Card className="overflow-hidden rounded-2xl border-border/70 shadow-soft">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="border-b border-border bg-muted/30 text-[11px] uppercase tracking-wide text-muted-foreground">
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
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {filteredStock.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-14 text-center text-sm text-muted-foreground">
                      {searchTerm || stockFilter !== "ALL"
                        ? "No inventory matches your search or filter."
                        : "No inventory has been posted yet."}
                    </td>
                  </tr>
                ) : filteredStock.map((s) => (
                  <tr key={s.id} className="transition-colors hover:bg-muted/20">
                    <td className="px-6 py-4">
                      <p className="font-semibold text-foreground">{s.materialName}</p>
                      <p className="font-mono text-[11px] text-muted-foreground">
                        {s.materialCode}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="min-w-64 space-y-2">
                        {locationBalances.filter(
                          (location) => location.material_code === s.materialCode,
                        ).length === 0 ? (
                          <span className="text-xs text-muted-foreground">Awaiting putaway</span>
                        ) : (
                          locationBalances
                            .filter((location) => location.material_code === s.materialCode)
                            .map((location) => (
                              <div
                                key={location.id}
                                className="rounded-lg border bg-muted/20 px-3 py-2"
                              >
                                <p className="flex items-center gap-1 font-mono text-xs font-bold">
                                  <MapPin className="size-3 text-primary" />
                                  {location.warehouse_id} / {location.zone} / {location.rack} /{" "}
                                  {location.bin}
                                </p>
                                <p className="mt-1 text-[11px] text-muted-foreground">
                                  Stock:{" "}
                                  <b className="text-foreground">
                                    {location.quantity.toLocaleString()} {location.uom}
                                  </b>{" "}
                                  · Available:{" "}
                                  <b className="text-success">
                                    {location.available_quantity.toLocaleString()} {location.uom}
                                  </b>
                                </p>
                              </div>
                            ))
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground font-medium">{s.category}</td>
                    <td className="px-6 py-4 text-right font-mono font-semibold tabular-nums">
                      {parseFloat(s.onHand).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-muted-foreground">
                      {parseFloat(s.allocated).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-right font-mono font-semibold text-primary tabular-nums">
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
                      {parseFloat(s.onHand) < parseFloat(s.reorderPoint) ? (
                        <StatusBadge status="Waiting" />
                      ) : (
                        <StatusBadge status="Active" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      {!loading && (
        <Card className="mt-6 overflow-hidden rounded-2xl border-border/70 shadow-soft">
          <div className="flex items-center gap-3 border-b p-5">
            <History className="size-5 text-primary" />
            <div>
              <h2 className="text-sm font-semibold tracking-tight">Inventory Transactions</h2>
              <p className="text-xs text-muted-foreground">
                GRN → Inventory transaction → Stock updated
              </p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-muted/30 text-[11px] uppercase tracking-wide text-muted-foreground">
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
