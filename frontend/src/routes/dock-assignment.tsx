import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Warehouse, MapPin, Loader2 } from "lucide-react";
import { AppShell, StatusBadge } from "@/components/wms/app-shell";
import { SectionCard, StepRail } from "@/components/wms/primitives";
import { Button } from "@/components/ui/button";
import { docks, activeArrival } from "@/lib/wms-data";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/dock-assignment")({
  head: () => ({
    meta: [
      { title: "Dock Assignment · NexusWMS" },
      { name: "description", content: "Warehouse dock map with live availability, occupancy and ETA to assign an unloading bay to the accepted truck." },
      { property: "og:title", content: "Dock Assignment · NexusWMS" },
      { property: "og:description", content: "Assign an unloading dock from the live warehouse map." },
    ],
  }),
  component: DockAssignment,
});

function DockAssignment() {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<string | null>("D-04");
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  return (
    <AppShell
      title="Assign unloading dock"
      subtitle={`${activeArrival.truckNo} · ${activeArrival.pallets} pallets · palletised forklift unloading`}
      actions={
        <Button className="rounded-xl shadow-glow" disabled={!selected} onClick={() => setConfirm(true)}>
          <Warehouse className="size-4" /> Assign {selected ?? "dock"}
        </Button>
      }
    >
      <StepRail current={6} />

      <div className="grid gap-4 xl:grid-cols-3">
        <SectionCard title="Warehouse dock map" description="Pune DC · inbound face" icon={MapPin} className="xl:col-span-2">
          <div className="rounded-2xl border border-border/70 bg-muted/40 p-5">
            <div className="mb-4 flex flex-wrap gap-4 text-[11px] text-muted-foreground">
              {[
                { c: "bg-success", l: "Available" },
                { c: "bg-destructive", l: "Occupied" },
                { c: "bg-warning", l: "Reserved" },
                { c: "bg-muted-foreground", l: "Cleaning" },
              ].map((k) => (
                <span key={k.l} className="flex items-center gap-1.5">
                  <span className={cn("size-2.5 rounded-full", k.c)} /> {k.l}
                </span>
              ))}
            </div>
            <div className="grid grid-cols-4 gap-3">
              {docks.map((d) => {
                const active = selected === d.id;
                const free = d.status === "Available";
                return (
                  <button
                    key={d.id}
                    disabled={!free}
                    onClick={() => setSelected(d.id)}
                    className={cn(
                      "rounded-xl border-2 p-3 text-left transition-all",
                      free ? "border-success/40 bg-card hover:-translate-y-0.5 hover:shadow-soft" : "cursor-not-allowed border-border bg-muted/60 opacity-70",
                      active && "border-primary bg-primary-soft shadow-glow",
                    )}
                  >
                    <p className="font-mono text-sm font-bold">{d.id}</p>
                    <p className="mt-1 text-[10px] leading-tight text-muted-foreground">{d.type}</p>
                    <span
                      className={cn(
                        "mt-2 block size-2 rounded-full",
                        d.status === "Available" && "bg-success",
                        d.status === "Occupied" && "bg-destructive",
                        d.status === "Reserved" && "bg-warning",
                        d.status === "Cleaning" && "bg-muted-foreground",
                      )}
                    />
                  </button>
                );
              })}
            </div>
            <div className="mt-5 rounded-xl border border-dashed border-border bg-card/60 py-6 text-center text-xs text-muted-foreground">
              Inbound yard · staging lanes S1–S6 · holding bay B
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Dock availability" description="Live occupancy and ETA" icon={Warehouse}>
          <div className="space-y-2.5">
            {docks.map((d) => (
              <button
                key={d.id}
                onClick={() => d.status === "Available" && setSelected(d.id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl border border-border/70 p-3 text-left transition-colors",
                  selected === d.id && "border-primary/40 bg-primary-soft",
                )}
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted font-mono text-[11px] font-bold">
                  {d.id}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{d.zone}</span>
                  <span className="block text-[11px] text-muted-foreground">{d.vehicle ?? d.eta}</span>
                </span>
                <StatusBadge status={d.status} />
              </button>
            ))}
          </div>
        </SectionCard>
      </div>

      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Assign dock {selected}?</AlertDialogTitle>
            <AlertDialogDescription>
              {activeArrival.truckNo} will be called forward from the yard and the receiving team for Zone B will be notified.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-xl"
              disabled={busy}
              onClick={(e) => {
                e.preventDefault();
                setBusy(true);
                setTimeout(() => {
                  setBusy(false);
                  toast.success(`Dock ${selected} assigned`, { description: "Driver notified via SMS. Team Bravo alerted." });
                  navigate({ to: "/arrival-success" });
                }, 900);
              }}
            >
              {busy && <Loader2 className="size-4 animate-spin" />} Confirm assignment
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
