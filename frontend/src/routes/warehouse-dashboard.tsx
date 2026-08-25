import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  Truck,
  Clock3,
  Warehouse,
  ListOrdered,
  PackageCheck,
  Plus,
  BarChart3,
  ArrowUpRight,
  CircleDot,
  Loader2,
  Search,
  Boxes,
} from "lucide-react";
import {
  Area,
  AreaChart,
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
import { api } from "@/lib/api-client";
import { activity, arrivalTrend, docks } from "@/lib/wms-data";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { getUserInfo } from "@/lib/auth-utils";
export const Route = createFileRoute("/warehouse-dashboard")({
  beforeLoad: () => {
    if (getUserInfo()?.roles.includes("GATE_SECURITY")) {
      throw redirect({ to: "/gate-dashboard" });
    }
  },
  head: () => ({
    meta: [
      { title: "Warehouse Dashboard · NexusWMS Pune DC" },
      {
        name: "description",
        content:
          "Live view of today's truck arrivals, dock occupancy, vehicle queue and receiving progress at Pune Distribution Centre.",
      },
      { property: "og:title", content: "Warehouse Dashboard · NexusWMS Pune DC" },
      {
        property: "og:description",
        content:
          "Live truck arrivals, dock occupancy and receiving progress for warehouse managers.",
      },
    ],
  }),
  component: WarehouseDashboard,
});
const quickActions = [
  { label: "Receiving", to: "/receiving", icon: PackageCheck },
  { label: "Reports", to: "/reports", icon: BarChart3 },
];
function WarehouseDashboard() {
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState("ALL");
  async function fetchDashboardData() {
    try {
      const data = await api.getDashboardStats();
      setDashboardData(data);
    } catch (err) {
      console.error("Failed to load dashboard data", err);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    fetchDashboardData();
    const timer = window.setInterval(fetchDashboardData, 10000);
    return () => window.clearInterval(timer);
  }, []);
  const stats = dashboardData?.stats || {
    totalArrivals: 0,
    verifiedArrivals: 0,
    unscheduledArrivals: 0,
    occupiedDocks: "0/8",
    vehiclesWaiting: 0,
  };
  const rawItems = dashboardData?.gateEntries || [];
  const filteredItems = rawItems.filter((item: any) => {
    const matchesFilter =
      activeFilter === "ALL" ||
      (activeFilter === "VERIFIED" && item.status === "PO_VERIFIED") ||
      (activeFilter === "UNSCHEDULED" && item.status === "UNSCHEDULED_ARRIVAL");
    if (!matchesFilter) return false;
    if (!searchTerm) return true;
    const s = searchTerm.toLowerCase();
    return (
      item.vehicle_number?.toLowerCase().includes(s) ||
      item.gate_entry_no?.toLowerCase().includes(s) ||
      item.po_number?.toLowerCase().includes(s) ||
      item.vendor?.toLowerCase().includes(s) ||
      item.material?.toLowerCase().includes(s)
    );
  });
  const activeTrend = dashboardData?.arrivalTrend || [];
  const activeActivity = dashboardData?.activity || [];
  const targetProgress = dashboardData?.targetProgress || { current: 0, target: 10, percentage: 0 };
  return (
    <AppShell
      title="Warehouse Dashboard"
      subtitle="Warehouse Operations · Live arrivals, receiving and inventory overview"
      actions={
        <>
          <Button variant="outline" className="rounded-xl" asChild>
            <Link to="/receiving">
              <PackageCheck className="size-4" /> Go to Receiving
            </Link>
          </Button>
          <Button className="rounded-xl shadow-glow" asChild>
            <Link to="/inventory">
              <Boxes className="size-4" /> View Inventory
            </Link>
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label="Total arrivals"
          value={loading ? "..." : String(stats.totalArrivals)}
          delta="Live from gate"
          icon={Truck}
          tone="primary"
          to="/vehicle-queue"
        />
        <StatCard
          label="Verified POs"
          value={loading ? "..." : String(stats.verifiedArrivals)}
          delta="Matched in DB"
          icon={Clock3}
          tone="success"
          to="/vehicle-queue"
        />
        <StatCard
          label="Unscheduled"
          value={loading ? "..." : String(stats.unscheduledArrivals)}
          delta="Manual review"
          icon={CircleDot}
          tone="warning"
          to="/gate-entry"
        />
        <StatCard
          label="Dock occupancy"
          value={loading ? ".../8" : stats.occupiedDocks}
          delta="Real-time status"
          icon={Warehouse}
          tone="teal"
          to="/dock-assignment"
        />
        <StatCard
          label="Vehicles waiting"
          value={loading ? "..." : String(stats.vehiclesWaiting)}
          delta="Avg wait 12 min"
          icon={ListOrdered}
          tone="danger"
          to="/vehicle-queue"
        />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <SectionCard
          title="Arrival vs receiving throughput"
          description="Vehicles processed per hour — Shift A"
          icon={BarChart3}
          className="xl:col-span-2"
          actions={
            <span className="rounded-full bg-success-soft px-2.5 py-1 text-[11px] font-semibold text-success">
              Live
            </span>
          }
        >
          <div className="h-[248px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={activeTrend} margin={{ left: -22, right: 6, top: 6 }}>
                <defs>
                  <linearGradient id="gA" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-chart-1)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--color-chart-1)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gB" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-chart-2)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--color-chart-2)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="4 4"
                  vertical={false}
                  stroke="var(--color-border)"
                />
                <XAxis
                  dataKey="hour"
                  tickLine={false}
                  axisLine={false}
                  fontSize={11}
                  stroke="var(--color-muted-foreground)"
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  fontSize={11}
                  stroke="var(--color-muted-foreground)"
                />
                <RTooltip
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid var(--color-border)",
                    background: "var(--color-card)",
                    fontSize: 12,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="arrivals"
                  stroke="var(--color-chart-1)"
                  strokeWidth={2.5}
                  fill="url(#gA)"
                />
                <Area
                  type="monotone"
                  dataKey="received"
                  stroke="var(--color-chart-2)"
                  strokeWidth={2.5}
                  fill="url(#gB)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard
          title="Quick actions"
          description="Frequent warehouse manager tasks"
          icon={Plus}
        >
          <div className="grid grid-cols-2 gap-3">
            {quickActions.map((a) => (
              <Link
                key={a.label}
                to={a.to}
                className="group flex flex-col gap-3 rounded-2xl border border-border/70 bg-muted/40 p-4 transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:bg-primary-soft hover:shadow-soft"
              >
                <span className="grid size-9 place-items-center rounded-xl bg-card text-primary shadow-soft">
                  <a.icon className="size-[18px]" />
                </span>
                <span className="text-sm font-medium">{a.label}</span>
              </Link>
            ))}
          </div>
          <div className="mt-4 rounded-2xl border border-border/70 p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Shift receiving target</span>
              <span className="font-semibold tabular-nums">
                {loading ? "..." : `${targetProgress.current} / ${targetProgress.target}`}
              </span>
            </div>
            <Progress value={loading ? 0 : targetProgress.percentage} className="mt-3 h-2" />
            <p className="mt-2 text-xs text-muted-foreground">
              {loading ? "..." : `${targetProgress.percentage}% of planned inbound completed.`}
            </p>
          </div>
        </SectionCard>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <SectionCard
          title="Live vehicle queue"
          description="Trucks currently inside or awaiting the facility"
          icon={Truck}
          className="xl:col-span-2"
          actions={
            <div className="flex items-center gap-3">
              <div className="relative hidden sm:block">
                <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search queue..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="h-8 w-48 rounded-lg border-border/60 bg-muted/30 pl-9 text-xs focus:bg-background"
                />
              </div>
              <Button variant="ghost" size="sm" className="rounded-lg" asChild>
                <Link to="/vehicle-queue">
                  View all <ArrowUpRight className="size-3.5" />
                </Link>
              </Button>
            </div>
          }
        >
          <div className="mb-5 flex flex-wrap items-center gap-2 border-b border-border/40 pb-4">
            <FilterButton
              label="All"
              count={stats.totalArrivals}
              active={activeFilter === "ALL"}
              onClick={() => setActiveFilter("ALL")}
            />
            <FilterButton
              label="Verified"
              count={stats.verifiedArrivals}
              active={activeFilter === "VERIFIED"}
              tone="success"
              onClick={() => setActiveFilter("VERIFIED")}
            />
            <FilterButton
              label="Unscheduled"
              count={stats.unscheduledArrivals}
              active={activeFilter === "UNSCHEDULED"}
              tone="warning"
              onClick={() => setActiveFilter("UNSCHEDULED")}
            />
          </div>

          <div className="-mx-5 overflow-x-auto px-5">
            {loading ? (
              <div className="flex h-40 items-center justify-center gap-2">
                <Loader2 className="size-5 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Loading queue from backend...</p>
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                {searchTerm ? "No results found matching your search." : "No vehicles in queue."}
              </div>
            ) : (
              <table className="w-full min-w-[850px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                    <th className="pb-3 font-medium">Snapshot</th>
                    <th className="pb-3 font-medium">Pass & Plate</th>
                    <th className="pb-3 font-medium">Supplier & Material</th>
                    <th className="pb-3 font-medium">PO / Qty</th>
                    <th className="pb-3 font-medium">Arrival</th>
                    <th className="pb-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((a: any) => (
                    <tr
                      key={a.id}
                      className="group border-b border-border/60 last:border-0 hover:bg-muted/20"
                    >
                      <td className="py-3">
                        <div className="size-12 overflow-hidden rounded-lg border border-border/40 bg-muted/30">
                          {a.truck_photo_base64 ? (
                            <img
                              src={`data:image/jpeg;base64,${a.truck_photo_base64}`}
                              alt="Truck"
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="grid h-full w-full place-items-center text-muted-foreground/40">
                              <Truck className="size-5" />
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="py-3">
                        <p className="font-mono text-[10px] text-muted-foreground uppercase leading-tight">
                          {a.gate_entry_no}
                        </p>
                        <div className="mt-1 flex items-center gap-1.5">
                          <span className="rounded bg-primary-soft px-1.5 py-0.5 font-mono text-[11px] font-bold text-primary border border-primary/20">
                            {a.vehicle_number}
                          </span>
                        </div>
                      </td>
                      <td className="py-3">
                        <p className="max-w-[200px] truncate font-bold text-xs">{a.vendor}</p>
                        <p className="max-w-[200px] truncate text-[11px] text-muted-foreground">
                          {a.material}
                        </p>
                      </td>
                      <td className="py-3">
                        <p className="font-mono text-xs font-medium">{a.po_number}</p>
                        <p className="text-[11px] text-muted-foreground">{a.quantity} Units</p>
                      </td>
                      <td className="py-3">
                        <div className="flex items-center gap-1.5 text-xs tabular-nums">
                          <Clock3 className="size-3 text-muted-foreground" />
                          {a.arrival_time}
                        </div>
                      </td>
                      <td className="py-3">
                        <StatusBadge status={a.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </SectionCard>

        <SectionCard
          title="Recent activity"
          description="Gate, dock and receiving events"
          icon={CircleDot}
        >
          <Timeline items={activeActivity} />
        </SectionCard>
      </div>
    </AppShell>
  );
}
function FilterButton({
  label,
  count,
  active,
  onClick,
  tone = "primary",
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  tone?: "primary" | "success" | "warning";
}) {
  const activeTones = {
    primary: "bg-primary text-primary-foreground border-primary",
    success: "bg-success text-success-foreground border-success",
    warning: "bg-warning text-warning-foreground border-warning",
  };
  const inactiveTones = {
    primary: "hover:bg-primary-soft hover:text-primary border-border/60",
    success: "hover:bg-success-soft hover:text-success border-border/60",
    warning: "hover:bg-warning-soft hover:text-warning border-border/60",
  };
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-bold transition-all",
        active ? activeTones[tone] : inactiveTones[tone],
      )}
    >
      {label}
      <span
        className={cn(
          "ml-1 grid size-5 place-items-center rounded-full text-[10px] font-black",
          active ? "bg-white/20" : "bg-muted",
        )}
      >
        {count}
      </span>
    </button>
  );
}
