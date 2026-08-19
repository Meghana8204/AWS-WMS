import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Boxes,
  Search,
  Filter,
  Loader2,
  ArrowUpRight,
  AlertTriangle,
  MoreHorizontal,
  Plus,
  History,
  MapPin
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
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      setLoading(true);
      const data = await api.getMaterialStock();
      setStock(data);
    } catch (error) {
      toast.error("Failed to load inventory");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <AppShell
      title="Warehouse Inventory"
      subtitle="Real-time stock on hand and bin locations"
      actions={
        <Button className="rounded-xl shadow-glow" asChild>
           <Link to="/warehouse/material-requests"><Plus className="size-4 mr-2" /> Raise MR</Link>
        </Button>
      }
    >
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search material code or name..."
            className="pl-10 rounded-xl border-border"
          />
        </div>
        <Button variant="outline" className="rounded-xl border-border">
          <Filter className="mr-2 size-4" /> Filter
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
         <InventoryStat label="Total SKUs" value={stock.length} icon={Boxes} color="text-primary" bg="bg-primary-soft/20" />
         <InventoryStat label="Low Stock" value={stock.filter(s => parseFloat(s.onHand) < parseFloat(s.reorderPoint)).length} icon={AlertTriangle} color="text-warning" bg="bg-warning-soft/20" />
         <InventoryStat label="Out of Stock" value={stock.filter(s => parseFloat(s.onHand) === 0).length} icon={Boxes} color="text-destructive" bg="bg-destructive-soft/20" />
         <InventoryStat label="Total Units" value={stock.reduce((acc, s) => acc + parseFloat(s.onHand), 0).toLocaleString()} icon={Boxes} color="text-success" bg="bg-success-soft/20" />
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
                    {stock.map((s) => (
                      <tr key={s.id} className="hover:bg-muted/5 transition-colors group">
                         <td className="px-6 py-4">
                            <p className="font-bold text-foreground">{s.materialName}</p>
                            <p className="font-mono text-[10px] text-muted-foreground">{s.materialCode}</p>
                         </td>
                         <td className="px-6 py-4 text-muted-foreground font-medium">{s.category}</td>
                         <td className="px-6 py-4 text-right font-mono font-bold">{parseFloat(s.onHand).toLocaleString()}</td>
                         <td className="px-6 py-4 text-right font-mono text-muted-foreground">{parseFloat(s.allocated).toLocaleString()}</td>
                         <td className="px-6 py-4 text-right font-mono font-black text-primary">{parseFloat(s.available).toLocaleString()}</td>
                         <td className="px-6 py-4 font-bold text-muted-foreground">{s.uom}</td>
                         <td className="px-6 py-4">
                            <div className="flex items-center gap-1.5 text-xs font-medium">
                               <MapPin className="size-3 text-muted-foreground" />
                               {s.warehouseId}
                            </div>
                         </td>
                         <td className="px-6 py-4">
                            {parseFloat(s.onHand) < parseFloat(s.reorderPoint) ? (
                               <StatusBadge status="Waiting" /> // Reuse "Waiting" for low stock warning
                            ) : (
                               <StatusBadge status="Active" />
                            )}
                         </td>
                         <td className="px-6 py-4 text-right">
                            <Button variant="ghost" size="icon" className="rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                               <MoreHorizontal className="size-4" />
                            </Button>
                         </td>
                      </tr>
                    ))}
                 </tbody>
              </table>
           </div>
        </Card>
      )}
    </AppShell>
  );
}

function InventoryStat({ label, value, icon: Icon, color, bg }: any) {
  return (
    <Card className="border-border/40 shadow-soft overflow-hidden">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">{label}</p>
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
