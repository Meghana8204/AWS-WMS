import { createFileRoute } from "@tanstack/react-router";
import { FormEvent, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Building2, Loader2, MapPin, Plus, RefreshCw, Warehouse } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/wms/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api-client";

export const Route = createFileRoute("/warehouse-storage")({ component: WarehouseStorage });

type Location = {
  id: string;
  location_code: string;
  warehouse_id: string;
  zone: string;
  rack: string;
  bin: string;
  capacity: number;
  occupied_quantity: number;
  available_capacity: number;
  utilization_percent: number;
  active: boolean;
};

function WarehouseStorage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [warehouseFilter, setWarehouseFilter] = useState("ALL");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setLocations(await api.getStorageLocations(undefined, true));
    } catch (error) {
      toast.error("Unable to load storage locations", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const warehouses = useMemo(
    () => [...new Set(locations.map((location) => location.warehouse_id))].sort(),
    [locations],
  );
  const visible =
    warehouseFilter === "ALL"
      ? locations
      : locations.filter((location) => location.warehouse_id === warehouseFilter);
  const totalCapacity = visible.reduce((sum, location) => sum + location.capacity, 0);
  const occupied = visible.reduce((sum, location) => sum + location.occupied_quantity, 0);

  async function createLocation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    const data = new FormData(event.currentTarget);
    try {
      await api.createStorageLocation({
        location_code: String(data.get("location_code")),
        warehouse_id: String(data.get("warehouse_id")),
        zone: String(data.get("zone")),
        rack: String(data.get("rack")),
        bin: String(data.get("bin")),
        capacity: Number(data.get("capacity")),
      });
      toast.success("Storage location created");
      setShowCreate(false);
      await load();
    } catch (error) {
      toast.error("Unable to create location", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  }

  async function toggleLocation(location: Location) {
    try {
      await api.updateStorageLocation(location.id, { active: !location.active });
      toast.success(`${location.location_code} ${location.active ? "deactivated" : "activated"}`);
      await load();
    } catch (error) {
      toast.error("Unable to update location", {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  }

  return (
    <AppShell
      title="Warehouse & Storage Locations"
      subtitle="Manage warehouse structure, zones, racks, bins and capacity"
      actions={
        <div className="flex gap-2">
          <Button variant="outline" className="rounded-xl" onClick={() => void load()}>
            <RefreshCw className="size-4" /> Refresh
          </Button>
          <Button className="rounded-xl" onClick={() => setShowCreate((value) => !value)}>
            <Plus className="size-4" /> New location
          </Button>
        </div>
      }
    >
      <div className="mb-4 grid gap-3 sm:grid-cols-4">
        <Metric
          label="Warehouses"
          value={warehouses.length}
          icon={<Building2 className="size-5" />}
        />
        <Metric
          label="Storage locations"
          value={visible.length}
          icon={<MapPin className="size-5" />}
        />
        <Metric
          label="Total capacity"
          value={totalCapacity.toLocaleString()}
          icon={<Warehouse className="size-5" />}
        />
        <Metric
          label="Utilized"
          value={totalCapacity ? `${((occupied / totalCapacity) * 100).toFixed(1)}%` : "0%"}
          icon={<Warehouse className="size-5" />}
        />
      </div>

      {showCreate && (
        <Card className="mb-4 rounded-2xl p-5">
          <form onSubmit={createLocation} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            <Field name="warehouse_id" label="Warehouse ID" placeholder="MAIN" />
            <Field name="location_code" label="Location code" placeholder="MAIN-RM-A-01" />
            <Field name="zone" label="Zone" placeholder="Raw Material" />
            <Field name="rack" label="Rack" placeholder="Rack A" />
            <Field name="bin" label="Bin" placeholder="Bin 01" />
            <Field name="capacity" label="Capacity" placeholder="10000" type="number" />
            <div className="flex justify-end gap-2 sm:col-span-2 lg:col-span-6">
              <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>
                Cancel
              </Button>
              <Button disabled={saving}>
                {saving && <Loader2 className="size-4 animate-spin" />} Create location
              </Button>
            </div>
          </form>
        </Card>
      )}

      <Card className="overflow-hidden rounded-2xl p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
          <p className="font-semibold">Location registry</p>
          <select
            value={warehouseFilter}
            onChange={(event) => setWarehouseFilter(event.target.value)}
            className="h-10 rounded-xl border bg-background px-3 text-sm"
          >
            <option value="ALL">All warehouses</option>
            {warehouses.map((id) => (
              <option key={id}>{id}</option>
            ))}
          </select>
        </div>
        {loading ? (
          <div className="grid h-60 place-items-center">
            <Loader2 className="size-6 animate-spin text-primary" />
          </div>
        ) : visible.length === 0 ? (
          <div className="grid h-60 place-items-center text-sm text-muted-foreground">
            No storage locations found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="border-b bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  {[
                    "Location",
                    "Warehouse",
                    "Zone",
                    "Rack / Bin",
                    "Capacity",
                    "Occupied",
                    "Available",
                    "Utilization",
                    "Status",
                    "Action",
                  ].map((header) => (
                    <th key={header} className="px-4 py-3">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {visible.map((location) => (
                  <tr key={location.id} className="hover:bg-muted/20">
                    <td className="px-4 py-4 font-mono font-bold text-primary">
                      {location.location_code}
                    </td>
                    <td className="px-4 py-4 font-semibold">{location.warehouse_id}</td>
                    <td className="px-4 py-4">{location.zone}</td>
                    <td className="px-4 py-4">
                      {location.rack} / {location.bin}
                    </td>
                    <td className="px-4 py-4">{location.capacity.toLocaleString()}</td>
                    <td className="px-4 py-4">{location.occupied_quantity.toLocaleString()}</td>
                    <td className="px-4 py-4 font-semibold">
                      {location.available_capacity.toLocaleString()}
                    </td>
                    <td className="px-4 py-4">
                      <div className="h-2 w-24 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full bg-primary"
                          style={{ width: `${Math.min(location.utilization_percent, 100)}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {location.utilization_percent}%
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${location.active ? "bg-success-soft text-success" : "bg-muted text-muted-foreground"}`}
                      >
                        {location.active ? "ACTIVE" : "INACTIVE"}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={location.active && location.occupied_quantity > 0}
                        onClick={() => void toggleLocation(location)}
                      >
                        {location.active ? "Deactivate" : "Activate"}
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

function Metric({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number;
  icon: ReactNode;
}) {
  return (
    <Card className="rounded-2xl p-4">
      <div className="flex items-center justify-between text-muted-foreground">
        <p className="text-xs uppercase">{label}</p>
        {icon}
      </div>
      <p className="mt-2 text-2xl font-bold">{value}</p>
    </Card>
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
        min={type === "number" ? 0.0001 : undefined}
        step={type === "number" ? "any" : undefined}
        placeholder={placeholder}
        className="mt-1.5 rounded-xl"
        required
      />
    </div>
  );
}
