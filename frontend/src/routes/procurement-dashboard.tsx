import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  Building2,
  FileText,
  Users,
  CheckCircle2,
  Plus,
  BarChart3,
  ArrowUpRight,
  ShieldCheck,
  Loader2,
  Search,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AppShell, StatusBadge } from "@/components/wms/app-shell";
import { SectionCard, StatCard, Timeline } from "@/components/wms/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { api } from "@/lib/api-client";
import { requireRole } from "@/lib/auth-utils";

type ProcurementStats = {
  activeSuppliers: number;
  totalSuppliers: number;
  openPos: number;
  complianceRate: number | null;
  complianceTarget: number;
  totalPoValue: number;
  trend: Array<{ month: string; pos: number }>;
};

export const Route = createFileRoute("/procurement-dashboard")({
  beforeLoad: () => requireRole("PROCUREMENT"),
  head: () => ({
    meta: [
      { title: "Procurement Dashboard · NexusWMS" },
      {
        name: "description",
        content: "Manage suppliers, purchase orders, and procurement workflows.",
      },
    ],
  }),
  component: ProcurementDashboard,
});
function ProcurementDashboard() {
  const [loading, setLoading] = useState(true);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [pos, setPos] = useState<any[]>([]);
  const [stats, setStats] = useState<ProcurementStats>({
    activeSuppliers: 0,
    totalSuppliers: 0,
    openPos: 0,
    complianceRate: null,
    complianceTarget: 99,
    totalPoValue: 0,
    trend: [],
  });
  const [supplierQuery, setSupplierQuery] = useState("");
  const [poQuery, setPoQuery] = useState("");
  const [supplierResults, setSupplierResults] = useState<any[]>([]);
  const [poResults, setPoResults] = useState<any[]>([]);
  const [isSearchingSuppliers, setIsSearchingSuppliers] = useState(false);
  const [isSearchingPOs, setIsSearchingPOs] = useState(false);
  const [poSearchOpen, setPoSearchOpen] = useState(false);
  const loadData = async () => {
    try {
      setLoading(true);
      const [sData, nData, poData, statsData] = await Promise.all([
        api.getSuppliers(),
        api.getNotifications("PROCUREMENT"),
        api.getPurchaseOrders(),
        api.getProcurementStats(),
      ]);
      setSuppliers(sData);
      setNotifications(nData);
      setPos(poData);
      setStats(statsData);
    } catch (err) {
      console.error("Failed to load dashboard data", err);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    loadData();
  }, []);
  useEffect(() => {
    const refreshStats = async () => {
      try {
        setStats(await api.getProcurementStats());
      } catch (err) {
        console.error("Failed to refresh procurement stats", err);
      }
    };
    const intervalId = window.setInterval(refreshStats, 15_000);
    window.addEventListener("focus", refreshStats);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refreshStats);
    };
  }, []);
  useEffect(() => {
    if (!supplierQuery.trim()) {
      setSupplierResults([]);
      return;
    }
    const handler = setTimeout(async () => {
      setIsSearchingSuppliers(true);
      try {
        const results = await api.getSuppliers({ search: supplierQuery });
        setSupplierResults(results);
      } catch (err) {
        console.error("Supplier search failed", err);
      } finally {
        setIsSearchingSuppliers(false);
      }
    }, 300);
    return () => clearTimeout(handler);
  }, [supplierQuery]);
  useEffect(() => {
    if (!poQuery.trim()) {
      setPoResults([]);
      return;
    }
    const handler = setTimeout(async () => {
      setIsSearchingPOs(true);
      try {
        const results = await api.getPurchaseOrders(poQuery);
        setPoResults(results);
      } catch (err) {
        console.error("PO search failed", err);
      } finally {
        setIsSearchingPOs(false);
      }
    }, 300);
    return () => clearTimeout(handler);
  }, [poQuery]);
<<<<<<< HEAD

=======
>>>>>>> origin/main
  const activityItems = notifications.map((n) => ({
    time: new Date(n.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    title: n.title,
    detail: n.message,
    tone: n.title.includes("Approved")
      ? "success"
      : n.title.includes("Rejected")
        ? "danger"
        : "primary",
    link: n.link,
  }));
  return (
    <AppShell
      title="Procurement Management"
      subtitle="Manage your vendor ecosystem and purchase operations"
      actions={
        <>
          <Popover open={poSearchOpen} onOpenChange={setPoSearchOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="rounded-xl">
                <Search className="size-4" /> Find PO
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[360px] rounded-xl p-3" align="end">
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-semibold">Find a purchase order</p>
                  <p className="text-xs text-muted-foreground">
                    Search by PO number, supplier, or department
                  </p>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                  <Input
                    autoFocus
                    placeholder="Start typing to search..."
                    className="rounded-xl pl-9 pr-9"
                    value={poQuery}
                    onChange={(event) => setPoQuery(event.target.value)}
                  />
                  {isSearchingPOs && (
                    <Loader2 className="absolute right-3 top-2.5 size-4 animate-spin text-muted-foreground" />
                  )}
                </div>
                {poQuery.trim() ? (
                  isSearchingPOs && poResults.length === 0 ? (
                    <p className="py-4 text-center text-xs text-muted-foreground">Searching...</p>
                  ) : poResults.length > 0 ? (
                    <div className="max-h-72 space-y-1 overflow-y-auto">
                      {poResults.slice(0, 8).map((po) => (
                        <Link
                          key={po.id}
                          to="/purchase-order"
                          search={{ poId: po.id }}
                          onClick={() => setPoSearchOpen(false)}
                          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-accent"
                        >
                          <FileText className="size-4 shrink-0 text-teal" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium">{po.po_number}</p>
                            <p className="truncate text-[10px] text-muted-foreground">
                              {po.supplier_name || po.department || "Supplier unavailable"}
                            </p>
                          </div>
                          <StatusBadge status={po.status} />
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <p className="py-4 text-center text-xs text-muted-foreground">
                      No purchase orders match “{poQuery}”.
                    </p>
                  )
                ) : (
                  <p className="py-4 text-center text-xs text-muted-foreground">
                    Results update automatically as you type.
                  </p>
                )}
              </div>
            </PopoverContent>
          </Popover>
          <Button className="rounded-xl shadow-glow" asChild>
            <Link to="/new-supplier">
              <Plus className="size-4" /> New Supplier
            </Link>
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Active suppliers"
          value={loading ? "..." : String(stats.activeSuppliers)}
          delta="+3 this month"
          icon={Building2}
          tone="primary"
          to="/master-data"
        />
        <StatCard
<<<<<<< HEAD
          label="Supplier master"
          value={loading ? "..." : String(stats.activeSuppliers)}
          delta="Available for procurement"
=======
          label="Total suppliers"
          value={loading ? "..." : String(stats.totalSuppliers)}
          delta="All registered suppliers"
>>>>>>> origin/main
          icon={Building2}
          tone="success"
          to="/master-data"
        />
        <StatCard
          label="Open POs"
          value={loading ? "..." : String(stats.openPos)}
          delta={`Value: ₹${parseFloat(stats.totalPoValue || 0).toLocaleString()}`}
          icon={FileText}
          tone="teal"
          to="/procurement/purchase-orders"
        />
        <StatCard
          label="Compliance rate"
<<<<<<< HEAD
          value={loading ? "..." : `${stats.complianceRate}%`}
          delta="Target: 99%"
=======
          value={
            loading ? "..." : stats.complianceRate === null ? "No data" : `${stats.complianceRate}%`
          }
          delta={`Target: ${stats.complianceTarget}%`}
>>>>>>> origin/main
          icon={ShieldCheck}
          tone="success"
        />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <SectionCard
          title="PO Issuance Trend"
          description="Purchase orders created per month"
          icon={BarChart3}
          className="xl:col-span-2"
        >
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.trend} margin={{ left: -20, right: 10, top: 10 }}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="var(--color-border)"
                />
                <XAxis
                  dataKey="month"
                  tickLine={false}
                  axisLine={false}
                  fontSize={12}
                  stroke="var(--color-muted-foreground)"
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  fontSize={12}
                  stroke="var(--color-muted-foreground)"
                />
                <RTooltip
                  cursor={{ fill: "var(--color-muted)", opacity: 0.4 }}
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid var(--color-border)",
                    background: "var(--color-card)",
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="pos" fill="var(--color-primary)" radius={[4, 4, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard title="Quick Search" description="Find vendor or order" icon={Search}>
          <div className="space-y-4">
            <div className="relative space-y-2">
              <label className="text-xs font-medium uppercase text-muted-foreground">
                Search Suppliers
              </label>
              <div className="relative">
                <Input
                  placeholder="Enter vendor name or ID..."
                  className="rounded-xl pr-8"
                  value={supplierQuery}
                  onChange={(e) => setSupplierQuery(e.target.value)}
                />
                {isSearchingSuppliers && (
                  <Loader2 className="absolute right-3 top-2.5 size-4 animate-spin text-muted-foreground" />
                )}
              </div>

              {supplierResults.length > 0 && (
                <div className="absolute z-10 mt-1 w-full rounded-xl border border-border bg-card p-1 shadow-lg">
                  {supplierResults.slice(0, 5).map((s) => (
                    <Link
                      key={s.supplierId}
                      to="/supplier/$supplierId"
                      params={{ supplierId: s.supplierId }}
                      className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-accent"
                    >
                      <Building2 className="size-4 text-primary" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{s.supplierName}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {s.supplierId.substring(0, 8)}...
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <div className="relative space-y-2">
              <label className="text-xs font-medium uppercase text-muted-foreground">
                Search Purchase Orders
              </label>
              <div className="relative">
                <Input
                  placeholder="Enter PO number..."
                  className="rounded-xl pr-8"
                  value={poQuery}
                  onChange={(e) => setPoQuery(e.target.value)}
                />
                {isSearchingPOs && (
                  <Loader2 className="absolute right-3 top-2.5 size-4 animate-spin text-muted-foreground" />
                )}
              </div>

              {poResults.length > 0 && (
                <div className="absolute z-10 mt-1 w-full rounded-xl border border-border bg-card p-1 shadow-lg">
                  {poResults.slice(0, 5).map((po) => (
                    <Link
                      key={po.id}
                      to="/purchase-order"
                      search={{ poId: po.id }}
                      className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-accent"
                    >
                      <FileText className="size-4 text-teal" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{po.po_number}</p>
                        <p className="text-[10px] text-muted-foreground">{po.supplier_name}</p>
                      </div>
                      <StatusBadge status={po.status} className="h-4 px-1.5 text-[9px]" />
                    </Link>
                  ))}
                </div>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground italic text-center">
              Results appear automatically as you type
            </p>
          </div>
        </SectionCard>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <SectionCard
          title="Recent Supplier Registrations"
          description="New vendors awaiting review or recently approved"
          icon={Users}
          className="xl:col-span-2"
          actions={
            <Button variant="ghost" size="sm" className="rounded-lg" asChild>
              <Link to="/master-data">
                View all <ArrowUpRight className="size-3.5" />
              </Link>
            </Button>
          }
        >
          <div className="-mx-5 overflow-x-auto px-5">
            {loading ? (
              <div className="flex h-40 items-center justify-center gap-2">
                <Loader2 className="size-5 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Loading suppliers...</p>
              </div>
            ) : suppliers.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                No suppliers registered yet.
              </div>
            ) : (
              <table className="w-full min-w-[600px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                    <th className="pb-3 font-medium">Vendor</th>
                    <th className="pb-3 font-medium">Category</th>
                    <th className="pb-3 font-medium">GSTIN</th>
                    <th className="pb-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {suppliers.slice(0, 5).map((s) => (
                    <tr key={s.supplierId} className="border-b border-border/60 last:border-0">
                      <td className="py-3">
                        <Link
                          to="/supplier/$supplierId"
                          params={{ supplierId: s.supplierId }}
                          className="font-semibold text-primary hover:underline"
                        >
                          {s.supplierName}
                        </Link>
                        <p className="text-[11px] text-muted-foreground">
                          {s.supplierId.substring(0, 8)}...
                        </p>
                      </td>
                      <td className="py-3 text-muted-foreground">{s.category}</td>
                      <td className="py-3 font-mono text-xs">{s.gstin}</td>
                      <td className="py-3">
                        <StatusBadge status={s.status || "Approved"} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </SectionCard>

        <SectionCard
          title="Recent Activity"
          description="Updates from finance and team"
          icon={CheckCircle2}
        >
          {activityItems.length > 0 ? (
            <Timeline items={activityItems} />
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground italic">
              No recent notifications.
            </div>
          )}
        </SectionCard>
      </div>
    </AppShell>
  );
}
