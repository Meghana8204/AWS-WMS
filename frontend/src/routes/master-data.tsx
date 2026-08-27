import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Building2, Loader2, Plus, RefreshCw, Search } from "lucide-react";
import { AppShell, StatusBadge } from "@/components/wms/app-shell";
import { SectionCard, StatCard } from "@/components/wms/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";
export const Route = createFileRoute("/master-data")({
  head: () => ({
    meta: [
      { title: "Master Data · NexusWMS" },
      {
        name: "description",
        content:
          "Maintain vendors, vehicles, docks, materials and warehouse topology master records.",
      },
      { property: "og:title", content: "Master Data · NexusWMS" },
      { property: "og:description", content: "Vendor, vehicle, dock and material master records." },
    ],
  }),
  component: MasterData,
});
function MasterData() {
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "blocked">("all");
  const loadSuppliers = async () => {
    setLoading(true);
    setError(null);
    try {
      setSuppliers(await api.getSuppliers());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load suppliers.");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    loadSuppliers();
  }, []);
  const filteredSuppliers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return suppliers.filter((supplier) => {
      const matchesStatus =
        statusFilter === "all" || (supplier.status || "Active").toLowerCase() === statusFilter;
      const matchesQuery =
        !normalizedQuery ||
        [supplier.supplierName, supplier.registeredCompanyName, supplier.category, supplier.gstin]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalizedQuery));
      return matchesStatus && matchesQuery;
    });
  }, [query, statusFilter, suppliers]);
  return (
    <AppShell
      title="Master data"
      subtitle="Manage the reference records used across warehouse and procurement operations"
      actions={
        <Button className="rounded-xl shadow-glow" asChild>
          <Link to="/new-supplier">
            <Plus className="size-4" /> New supplier
          </Link>
        </Button>
      }
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="All suppliers"
          value={loading ? "…" : String(suppliers.length)}
          delta="Vendor master records"
          icon={Building2}
          tone="primary"
          to="/master-data"
        />
        <StatCard
          label="Active suppliers"
          value={
            loading
              ? "…"
              : String(
                  suppliers.filter((supplier) => (supplier.status || "Active") === "Active").length,
                )
          }
          delta="Available for operations"
          icon={Building2}
          tone="success"
          to="/master-data"
        />
        <StatCard
          label="Blocked suppliers"
          value={
            loading
              ? "…"
              : String(suppliers.filter((supplier) => supplier.status === "Blocked").length)
          }
          delta="Unavailable for operations"
          icon={Building2}
          tone="danger"
          to="/master-data"
        />
      </div>

      <div className="mt-4">
        <SectionCard
          title="Supplier master"
          description="Registered vendors available for procurement and gate-entry workflows"
          icon={Building2}
          actions={
            <Button
              variant="outline"
              size="sm"
              className="rounded-lg"
              onClick={loadSuppliers}
              disabled={loading}
            >
              <RefreshCw className={loading ? "animate-spin" : ""} /> Refresh
            </Button>
          }
        >
          <div className="relative mb-4 max-w-sm">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search supplier, category or GSTIN"
              className="rounded-xl pl-9"
            />
          </div>
          <div className="mb-4 flex flex-wrap gap-2" aria-label="Supplier status navigation">
            {[
              { id: "all", label: "All suppliers", count: suppliers.length },
              {
                id: "active",
                label: "Active",
                count: suppliers.filter((supplier) => (supplier.status || "Active") === "Active")
                  .length,
              },
              {
                id: "blocked",
                label: "Blocked",
                count: suppliers.filter((supplier) => supplier.status === "Blocked").length,
              },
            ].map((item) => (
              <Button
                key={item.id}
                variant="outline"
                size="sm"
                onClick={() => setStatusFilter(item.id as typeof statusFilter)}
                className={cn(
                  "rounded-full",
                  statusFilter === item.id &&
                    "border-primary bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground",
                )}
              >
                {item.label}{" "}
                <span className="rounded-full bg-background/30 px-1.5 py-0.5 text-[10px]">
                  {item.count}
                </span>
              </Button>
            ))}
          </div>

          {loading ? (
            <div className="flex h-44 items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-5 animate-spin text-primary" /> Loading supplier records…
            </div>
          ) : error ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
              <p className="text-sm font-medium text-destructive">
                Supplier records could not be loaded.
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{error}</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3 rounded-lg"
                onClick={loadSuppliers}
              >
                Try again
              </Button>
            </div>
          ) : filteredSuppliers.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
              <Building2 className="size-8 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">
                  {query || statusFilter !== "all"
                    ? "No matching suppliers"
                    : "No suppliers registered yet"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {query || statusFilter !== "all"
                    ? "Try a different search term or status."
                    : "Add the first vendor to begin building your supplier master."}
                </p>
              </div>
              {!query && statusFilter === "all" && (
                <Button size="sm" className="rounded-lg" asChild>
                  <Link to="/new-supplier">
                    <Plus /> Add supplier
                  </Link>
                </Button>
              )}
            </div>
          ) : (
            <div className="-mx-5 overflow-x-auto px-5">
              <table className="w-full min-w-[680px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                    <th className="pb-3 font-medium">Supplier</th>
                    <th className="pb-3 font-medium">Category</th>
                    <th className="pb-3 font-medium">GSTIN</th>
                    <th className="pb-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSuppliers.map((supplier) => (
                    <tr
                      key={supplier.supplierId}
                      className="border-b border-border/60 last:border-0"
                    >
                      <td className="py-3">
                        <Link
                          to="/supplier/$supplierId"
                          params={{ supplierId: supplier.supplierId }}
                          className="font-semibold text-primary hover:underline"
                        >
                          {supplier.supplierName}
                        </Link>
                        <p className="text-[11px] text-muted-foreground">
                          {supplier.registeredCompanyName || supplier.supplierCode || supplier.supplierId}
                        </p>
                      </td>
                      <td className="py-3 text-muted-foreground">{supplier.category || "—"}</td>
                      <td className="py-3 font-mono text-xs">{supplier.gstin || "—"}</td>
                      <td className="py-3">
                        <StatusBadge status={supplier.status || "Active"} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      </div>
    </AppShell>
  );
}
