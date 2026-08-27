import { createFileRoute, Link } from "@tanstack/react-router";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, RefreshCw, Warehouse } from "lucide-react";
import { AppShell, StatusBadge } from "@/components/wms/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api-client";
export const Route = createFileRoute("/dock-management")({ component: DockManagement });
type Dock = {
  dock_number: string;
  warehouse_id: string;
  dock_type: string;
  capacity: number;
  status: string;
  current_vehicle?: string;
  current_asn_id?: string;
  current_asn?: string;
  current_po?: string;
  assigned_by?: string;
  assigned_at?: string;
};
function DockManagement() {
  const [docks, setDocks] = useState<Dock[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      setDocks(await api.getDocks());
    } catch (error) {
      toast.error("Unable to load docks", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  async function createDock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    const data = new FormData(event.currentTarget);
    try {
      await api.createDock({
        dock_number: String(data.get("dock_number")),
        warehouse_id: String(data.get("warehouse_id")),
        dock_type: String(data.get("dock_type")),
        capacity: Number(data.get("capacity")),
        status: String(data.get("status")),
      });
      toast.success("Dock created");
      setShowCreate(false);
      await load();
    } catch (error) {
      toast.error("Unable to create dock", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  }
  async function toggleMaintenance(dock: Dock) {
    const status = dock.status === "MAINTENANCE" ? "AVAILABLE" : "MAINTENANCE";
    try {
      await api.updateDock(dock.dock_number, { status });
      toast.success(`${dock.dock_number} marked ${status.toLowerCase()}`);
      await load();
    } catch (error) {
      toast.error("Dock status update failed", {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  }
  return (
    <AppShell
      title="Dock management"
      subtitle="Warehouse dock capacity, availability and active assignments"
      actions={
        <div className="flex gap-2">
          <Button variant="outline" className="rounded-xl" onClick={() => void load()}>
            <RefreshCw className="size-4" /> Refresh
          </Button>
          <Button className="rounded-xl" onClick={() => setShowCreate((v) => !v)}>
            <Plus className="size-4" /> New dock
          </Button>
        </div>
      }
    >
      <div className="mb-4 grid gap-3 sm:grid-cols-4">
        {["AVAILABLE", "OCCUPIED", "MAINTENANCE"].map((status) => (
          <Card key={status} className="rounded-2xl p-4">
            <p className="text-xs text-muted-foreground">{status.replace("_", " ")}</p>
            <p className="mt-1 text-2xl font-bold">
              {docks.filter((d) => d.status === status).length}
            </p>
          </Card>
        ))}
        <Card className="rounded-2xl p-4">
          <p className="text-xs text-muted-foreground">TOTAL CAPACITY</p>
          <p className="mt-1 text-2xl font-bold">{docks.reduce((sum, d) => sum + d.capacity, 0)}</p>
        </Card>
      </div>
      {showCreate && (
        <Card className="mb-4 rounded-2xl p-5">
          <form onSubmit={createDock} className="grid gap-3 sm:grid-cols-5">
            <Field name="dock_number" label="Dock number" placeholder="DOCK-05" />
            <Field name="warehouse_id" label="Warehouse" placeholder="WH-PUNE-01" />
            <Field name="dock_type" label="Dock type" placeholder="GENERAL" />
            <Field name="capacity" label="Capacity" placeholder="20" type="number" />
            <div>
              <Label>Status</Label>
              <select
                name="status"
                className="mt-1.5 h-10 w-full rounded-xl border bg-background px-3 text-sm"
              >
                <option>AVAILABLE</option>
                <option>MAINTENANCE</option>
              </select>
            </div>
            <div className="sm:col-span-5 flex justify-end">
              <Button disabled={saving}>
                {saving && <Loader2 className="size-4 animate-spin" />} Create dock
              </Button>
            </div>
          </form>
        </Card>
      )}
      <Card className="overflow-hidden rounded-2xl p-0">
        {loading ? (
          <div className="flex h-60 items-center justify-center">
            <Loader2 className="size-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1200px] text-left text-sm">
              <thead className="border-b bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  {[
                    "Dock number",
                    "Warehouse",
                    "Dock type",
                    "Capacity",
                    "Status",
                    "Current vehicle",
                    "Current ASN",
                    "Current PO",
                    "Assignment",
                    "Action",
                  ].map((h) => (
                    <th key={h} className="px-4 py-3">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {docks.map((dock) => (
                  <tr key={dock.dock_number} className="hover:bg-muted/20">
                    <td className="px-4 py-4 font-mono font-bold">{dock.dock_number}</td>
                    <td className="px-4 py-4">{dock.warehouse_id}</td>
                    <td className="px-4 py-4">{dock.dock_type}</td>
                    <td className="px-4 py-4 font-semibold">{dock.capacity}</td>
                    <td className="px-4 py-4">
                      <StatusBadge status={dock.status} />
                    </td>
                    <td className="px-4 py-4 font-mono">{dock.current_vehicle || "—"}</td>
                    <td className="px-4 py-4">
                      {dock.current_asn_id ? (
                        <Link
                          to="/procurement/asns/$asnId"
                          params={{ asnId: dock.current_asn_id }}
                          className="font-mono text-primary hover:underline"
                        >
                          {dock.current_asn}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-4 font-mono">{dock.current_po || "—"}</td>
                    <td className="px-4 py-4 text-xs">
                      {dock.assigned_by || "—"}
                      <br />
                      {dock.assigned_at ? new Date(dock.assigned_at).toLocaleString() : ""}
                    </td>
                    <td className="px-4 py-4">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={dock.status === "OCCUPIED"}
                        onClick={() => void toggleMaintenance(dock)}
                      >
                        {dock.status === "MAINTENANCE" ? "Make available" : "Maintenance"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </AppShell>
  );
}
function Field({
  name,
  label,
  placeholder,
  type = "text",
}: {
  name: string;
  label: string;
  placeholder: string;
  type?: string;
}) {
  return (
    <div>
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        type={type}
        min={type === "number" ? 1 : undefined}
        placeholder={placeholder}
        className="mt-1.5 rounded-xl"
        required
      />
    </div>
  );
}
