import { createFileRoute, Link } from "@tanstack/react-router";
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
import { api } from "@/lib/api-client";
import { activity, arrivalTrend, docks } from "@/lib/wms-data";
import { Progress } from "@/components/ui/progress";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Warehouse Dashboard · NexusWMS Pune DC" },
      { name: "description", content: "Live view of today's truck arrivals, dock occupancy, vehicle queue and receiving progress at Pune Distribution Centre." },
      { property: "og:title", content: "Warehouse Dashboard · NexusWMS Pune DC" },
      { property: "og:description", content: "Live truck arrivals, dock occupancy and receiving progress for warehouse managers." },
    ],
  }),
  component: Dashboard,
});

const quickActions = [
  { label: "New Arrival", to: "/notifications", icon: Plus },
  { label: "Vehicle Queue", to: "/vehicle-queue", icon: ListOrdered },
  { label: "Receiving", to: "/receiving", icon: PackageCheck },
  { label: "Reports", to: "/reports", icon: BarChart3 },
];

function Dashboard() {
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

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
  }, []);

  const stats = dashboardData?.stats || {
    totalArrivals: 0,
    pendingArrivals: 0,
    occupiedDocks: "0/8",
    vehiclesWaiting: 0,
    receivingInProgress: 0
  };
  const items = dashboardData?.gateEntries || [];
  const activeTrend = dashboardData?.arrivalTrend || [];
  const activeActivity = dashboardData?.activity || [];
  const targetProgress = dashboardData?.targetProgress || { current: 14, target: 22, percentage: 64 };

  return (
    <AppShell
      title="Good morning, Rohit"
      subtitle="Friday, 31 July 2026 · Pune Distribution Centre · Shift A (06:00 – 14:00)"
      actions={
        <>
          <Button variant="outline" className="rounded-xl" asChild>
            <Link to="/vehicle-queue">
              <ListOrdered className="size-4" /> Vehicle queue
            </Link>
          </Button>
          <Button className="rounded-xl shadow-glow" asChild>
            <Link to="/notifications">
              <Truck className="size-4" /> Incoming arrivals
            </Link>
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Today's arrivals" value={loading ? "..." : String(stats.totalArrivals)} delta="+4 vs yesterday" icon={Truck} tone="primary" to="/vehicle-queue" />
        <StatCard label="Pending arrivals" value={loading ? "..." : String(stats.pendingArrivals)} delta="Oldest waiting 18 min" icon={Clock3} tone="warning" to="/notifications" />
        <StatCard label="Dock occupancy" value={loading ? ".../8" : stats.occupiedDocks} delta="3 docks free now" icon={Warehouse} tone="teal" to="/dock-assignment" />
        <StatCard label="Vehicles waiting" value={loading ? "..." : String(stats.vehiclesWaiting)} delta="Avg wait 21 min" icon={ListOrdered} tone="danger" to="/vehicle-queue" />
        <StatCard label="Receiving in progress" value={loading ? "..." : String(stats.receivingInProgress)} delta="D-01 · 62% complete" icon={PackageCheck} tone="success" to="/receiving" />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <SectionCard
          title="Arrival vs receiving throughput"
          description="Vehicles processed per hour — Shift A"
          icon={BarChart3}
          className="xl:col-span-2"
          actions={<span className="rounded-full bg-success-soft px-2.5 py-1 text-[11px] font-semibold text-success">Live</span>}
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
                <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="var(--color-border)" />
                <XAxis dataKey="hour" tickLine={false} axisLine={false} fontSize={11} stroke="var(--color-muted-foreground)" />
                <YAxis tickLine={false} axisLine={false} fontSize={11} stroke="var(--color-muted-foreground)" />
                <RTooltip
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid var(--color-border)",
                    background: "var(--color-card)",
                    fontSize: 12,
                  }}
                />
                <Area type="monotone" dataKey="arrivals" stroke="var(--color-chart-1)" strokeWidth={2.5} fill="url(#gA)" />
                <Area type="monotone" dataKey="received" stroke="var(--color-chart-2)" strokeWidth={2.5} fill="url(#gB)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard title="Quick actions" description="Frequent warehouse manager tasks" icon={Plus}>
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
              <span className="font-semibold tabular-nums">{loading ? "..." : `${targetProgress.current} / ${targetProgress.target}`}</span>
            </div>
            <Progress value={loading ? 0 : targetProgress.percentage} className="mt-3 h-2" />
            <p className="mt-2 text-xs text-muted-foreground">{loading ? "..." : `${targetProgress.percentage}% of planned inbound completed.`}</p>
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
            <Button variant="ghost" size="sm" className="rounded-lg" asChild>
              <Link to="/vehicle-queue">
                View all <ArrowUpRight className="size-3.5" />
              </Link>
            </Button>
          }
        >
          <div className="-mx-5 overflow-x-auto px-5">
            {loading ? (
              <div className="flex h-40 items-center justify-center gap-2">
                <Loader2 className="size-5 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Loading queue from backend...</p>
              </div>
            ) : items.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                No vehicles in queue.
              </div>
            ) : (
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                    <th className="pb-3 font-medium">Truck</th>
                    <th className="pb-3 font-medium">Driver / Vendor</th>
                    <th className="pb-3 font-medium">PO</th>
                    <th className="pb-3 font-medium">Arrival</th>
                    <th className="pb-3 font-medium">Dock</th>
                    <th className="pb-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((a) => (
                    <tr key={a.id} className="group border-b border-border/60 last:border-0">
                      <td className="py-3">
                        <Link to="/gate-entry" className="font-mono text-[13px] font-semibold text-primary hover:underline">
                          {a.vehicle_number || a.truckNo || "MH 12 QT 4489"}
                        </Link>
                        <p className="text-[11px] text-muted-foreground">{a.gate_entry_no || a.gateEntryNo || `GE/${a.id}`}</p>
                      </td>
                      <td className="py-3">
                        <p className="max-w-[190px] truncate">{a.driver_name || a.vendor || "Unknown"}</p>
                        <p className="text-[11px] text-muted-foreground">{a.driver_phone || a.transporter || "—"}</p>
                      </td>
                      <td className="py-3 font-mono text-xs">{a.po_number || a.po || "—"}</td>
                      <td className="py-3 tabular-nums">{a.arrival_time || a.arrivalTime || "09:00"}</td>
                      <td className="py-3 font-medium">{a.dock_number || a.dock || "—"}</td>
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

        <SectionCard title="Recent activity" description="Gate, dock and receiving events" icon={CircleDot}>
          <Timeline items={activeActivity} />
        </SectionCard>
      </div>
    </AppShell>
  );
}
