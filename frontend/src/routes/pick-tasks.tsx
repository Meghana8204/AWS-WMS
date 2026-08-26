import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Loader2,
  MapPin,
  PackageCheck,
  Play,
  RefreshCw,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell, StatusBadge } from "@/components/wms/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api-client";

export const Route = createFileRoute("/pick-tasks")({ component: PickTasks });

function PickTasks() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [operators, setOperators] = useState<Record<string, string>>({});
  const [receivers, setReceivers] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string>();
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      setTasks(await api.getPickTasks());
    } catch (error) {
      toast.error("Unable to load pick tasks", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const update = (id: string, values: any) =>
    setTasks((current) => current.map((task) => (task.id === id ? { ...task, ...values } : task)));
  const run = async (key: string, action: () => Promise<any>, message: string) => {
    setBusy(key);
    try {
      const result = await action();
      update(key, result);
      const stock = result.stock_updates?.[0];
      toast.success(message, {
        description: stock
          ? `${stock.material_name}: On Hand ${stock.after.on_hand.toLocaleString()} · Allocated ${stock.after.allocated.toLocaleString()} · Available ${stock.after.available.toLocaleString()} ${stock.uom}`
          : undefined,
      });
    } catch (error) {
      toast.error(message, { description: error instanceof Error ? error.message : undefined });
    } finally {
      setBusy(undefined);
    }
  };
  return (
    <AppShell
      title="Pick Tasks"
      subtitle="Pick reserved material and move it to production staging"
      actions={
        <Button variant="outline" onClick={() => void load()}>
          <RefreshCw className="size-4" /> Refresh
        </Button>
      }
    >
      {loading ? (
        <div className="grid h-64 place-items-center">
          <Loader2 className="size-7 animate-spin text-primary" />
        </div>
      ) : tasks.length === 0 ? (
        <Card className="grid h-64 place-items-center text-muted-foreground">No pick tasks.</Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {tasks.map((task) => (
            <Card key={task.id} className="rounded-2xl p-5">
              <div className="flex justify-between">
                <div>
                  <p className="text-xs uppercase text-muted-foreground">Pick Task</p>
                  <h2 className="font-mono font-bold text-primary">{task.task_number}</h2>
                  <p className="text-xs text-muted-foreground">
                    MR {task.request_number} · {task.department}
                  </p>
                </div>
                <StatusBadge status={task.status} />
              </div>
              <div className="mt-4 space-y-3">
                {task.items.map((item: any) => (
                  <div key={item.material_code} className="rounded-xl border bg-muted/20 p-4">
                    <p className="font-bold">{item.material_name}</p>
                    <p className="font-mono text-xs text-muted-foreground">{item.material_code}</p>
                    <p className="mt-2 text-lg font-black">
                      {item.quantity.toLocaleString()} {item.uom}
                    </p>
                    {item.allocations.map((allocation: any) => (
                      <div
                        key={allocation.location_id}
                        className="mt-2 flex items-center gap-2 text-sm"
                      >
                        <MapPin className="size-4 text-primary" />
                        <b className="font-mono">{allocation.location}</b>
                        <span>
                          {allocation.quantity.toLocaleString()} {allocation.uom}
                        </span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
              <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                <div className="rounded-xl border p-3 text-center text-sm">
                  <b>From</b>
                  <p className="font-mono">
                    {task.items
                      .flatMap((item: any) => item.allocations.map((a: any) => a.location))
                      .join(", ")}
                  </p>
                </div>
                <ArrowRight className="size-5 text-primary" />
                <div className="rounded-xl border p-3 text-center text-sm">
                  <b>To</b>
                  <p>{task.destination}</p>
                </div>
              </div>
              {task.status === "OPEN" && (
                <div className="mt-4 flex gap-2">
                  <Input
                    placeholder="Operator name / ID"
                    value={operators[task.id] || ""}
                    onChange={(event) =>
                      setOperators((current) => ({ ...current, [task.id]: event.target.value }))
                    }
                  />
                  <Button
                    disabled={!operators[task.id]?.trim() || busy === task.id}
                    onClick={() =>
                      void run(
                        task.id,
                        () => api.assignPickTask(task.id, operators[task.id]),
                        "Pick task assigned",
                      )
                    }
                  >
                    <UserRound className="size-4" /> Assign
                  </Button>
                </div>
              )}
              {task.status === "ASSIGNED" && (
                <Button
                  className="mt-4 w-full"
                  disabled={busy === task.id}
                  onClick={() =>
                    void run(task.id, () => api.startPickTask(task.id), "Picking started")
                  }
                >
                  <Play className="size-4" /> Start Picking
                </Button>
              )}
              {task.status === "IN_PROGRESS" && (
                <div className="mt-4 rounded-xl border border-primary/25 bg-primary/5 p-4">
                  <p className="text-xs font-bold uppercase text-primary">Picking Confirmation</p>
                  {task.items.map((item: any) => (
                    <div
                      key={item.material_code}
                      className="mt-3 grid gap-2 text-sm sm:grid-cols-3"
                    >
                      <p>
                        <CheckCircle2 className="mr-1 inline size-4 text-success" />
                        <b>Material</b>
                        <br />
                        {item.material_name}
                      </p>
                      <p>
                        <CheckCircle2 className="mr-1 inline size-4 text-success" />
                        <b>Quantity</b>
                        <br />
                        {item.quantity.toLocaleString()} {item.uom}
                      </p>
                      <p>
                        <CheckCircle2 className="mr-1 inline size-4 text-success" />
                        <b>Source Bin</b>
                        <br />
                        {item.allocations.map((allocation: any) => allocation.location).join(", ")}
                      </p>
                    </div>
                  ))}
                  <Button
                    className="mt-4 w-full"
                    disabled={busy === task.id}
                    onClick={() =>
                      void run(
                        task.id,
                        () => api.completePickTask(task.id),
                        "Pick confirmed; reservation released",
                      )
                    }
                  >
                    <PackageCheck className="size-4" /> Confirm Material, Quantity & Source Bin
                  </Button>
                </div>
              )}
              {task.status === "COMPLETED" && (
                <div className="mt-4 rounded-xl border border-success/30 bg-success-soft p-4 text-success">
                  <p className="flex items-center gap-2 font-bold">
                    <CheckCircle2 className="size-4" /> Picking completed
                  </p>
                  <p className="mt-1 text-xs">
                    Delivered to {task.destination} by {task.completed_by}. Stock remains
                    warehouse-owned until issue or consumption.
                  </p>
                </div>
              )}
              {task.status === "COMPLETED" && (
                <div className="mt-3 flex gap-2">
                  <Input
                    placeholder="Production receiver name / ID"
                    value={receivers[task.id] || ""}
                    onChange={(event) =>
                      setReceivers((current) => ({ ...current, [task.id]: event.target.value }))
                    }
                  />
                  <Button
                    disabled={!receivers[task.id]?.trim() || busy === task.id}
                    onClick={() =>
                      void run(
                        task.id,
                        () => api.issuePickedMaterial(task.id, receivers[task.id]),
                        "Material issued to production",
                      )
                    }
                  >
                    <ArrowRight className="size-4" /> Issue
                  </Button>
                </div>
              )}
              {task.status === "ISSUED" && (
                <div className="mt-4 rounded-xl border border-primary/30 bg-primary/5 p-4">
                  <p className="font-bold text-primary">Material issued</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Production received the material and warehouse inventory was deducted.
                  </p>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </AppShell>
  );
}
