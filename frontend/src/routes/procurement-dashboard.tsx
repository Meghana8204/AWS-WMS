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
import { api } from "@/lib/api-client";

export const Route = createFileRoute("/procurement-dashboard")({
  head: () => ({
    meta: [
      { title: "Procurement Dashboard · NexusWMS" },
      { name: "description", content: "Manage suppliers, purchase orders, and procurement workflows." },
    ],
  }),
  component: ProcurementDashboard,
});

const poData = [
  { month: "Jan", pos: 45 },
  { month: "Feb", pos: 52 },
  { month: "Mar", pos: 48 },
  { month: "Apr", pos: 61 },
  { month: "May", pos: 55 },
  { month: "Jun", pos: 67 },
];

const recentActivities = [
  { time: "10:30 AM", title: "New PO Created", detail: "PO-2026-8821 for Tech Components Corp.", tone: "primary" },
  { time: "09:15 AM", title: "Supplier Added", detail: "High-Tech Alloys was added to the supplier master.", tone: "success" },
  { time: "Yesterday", title: "Document Update", detail: "Quality certificates uploaded for Swift Logistics.", tone: "warning" },
];

function ProcurementDashboard() {
  const [loading, setLoading] = useState(true);
  const [suppliers, setSuppliers] = useState<any[]>([]);

  async function fetchSuppliers() {
    try {
      const data = await api.getSuppliers();
      setSuppliers(data);
    } catch (err) {
      console.error("Failed to load suppliers", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const stats = {
    activeSuppliers: suppliers.length,
    openPOs: 42, // Still mock for now as PO module is partially implemented
    complianceRate: "98.2%"
  };

  return (
    <AppShell
      title="Procurement Management"
      subtitle="Manage your vendor ecosystem and purchase operations"
      actions={
        <>
          <Button variant="outline" className="rounded-xl">
            <Search className="size-4" /> Find PO
          </Button>
          <Button className="rounded-xl shadow-glow" asChild>
            <Link to="/new-supplier">
              <Plus className="size-4" /> New Supplier
            </Link>
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Active suppliers" value={loading ? "..." : String(stats.activeSuppliers)} delta="+3 this month" icon={Building2} tone="primary" to="/master-data" />
        <StatCard label="Supplier master" value={loading ? "..." : String(stats.activeSuppliers)} delta="Available for procurement" icon={Building2} tone="success" to="/master-data" />
        <StatCard label="Open POs" value={loading ? "..." : String(stats.openPOs)} delta="Value: $1.2M" icon={FileText} tone="teal" to="/procurement/purchase-orders" />
        <StatCard label="Compliance rate" value={loading ? "..." : stats.complianceRate} delta="Target: 99%" icon={ShieldCheck} tone="success" />
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
              <BarChart data={poData} margin={{ left: -20, right: 10, top: 10 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={12} stroke="var(--color-muted-foreground)" />
                <YAxis tickLine={false} axisLine={false} fontSize={12} stroke="var(--color-muted-foreground)" />
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
            <div className="space-y-2">
              <label className="text-xs font-medium uppercase text-muted-foreground">Search Suppliers</label>
              <Input placeholder="Enter vendor name or ID..." className="rounded-xl" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium uppercase text-muted-foreground">Search Purchase Orders</label>
              <Input placeholder="Enter PO number..." className="rounded-xl" />
            </div>
            <Button className="w-full rounded-xl">Search</Button>
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
                        <Link to="/supplier/$supplierId" params={{ supplierId: s.supplierId }} className="font-semibold text-primary hover:underline">{s.supplierName}</Link>
                        <p className="text-[11px] text-muted-foreground">{s.supplierId.substring(0, 8)}...</p>
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

        <SectionCard title="Recent Activity" description="Updates from procurement team" icon={CheckCircle2}>
          <Timeline items={recentActivities} />
        </SectionCard>
      </div>
    </AppShell>
  );
}
