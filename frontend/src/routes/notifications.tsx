import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Bell, Truck, CheckCircle2, XCircle, Eye, Filter, Inbox } from "lucide-react";
import { AppShell, StatusBadge } from "@/components/wms/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { arrivals } from "@/lib/wms-data";
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

export const Route = createFileRoute("/notifications")({
  head: () => ({
    meta: [
      { title: "Arrival Notifications · NexusWMS" },
      { name: "description", content: "Notification centre for new truck arrivals approved by security, awaiting warehouse manager acceptance." },
      { property: "og:title", content: "Arrival Notifications · NexusWMS" },
      { property: "og:description", content: "Accept, reject or review incoming truck arrivals cleared by gate security." },
    ],
  }),
  component: Notifications,
});

function Notifications() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("new");
  const [reject, setReject] = useState<string | null>(null);

  const filtered = arrivals.filter((a) =>
    tab === "new" ? a.status === "Waiting" : tab === "hold" ? a.status === "Hold" : true,
  );

  return (
    <AppShell
      title="Notification centre"
      subtitle="Security-cleared vehicles awaiting warehouse manager action"
      actions={
        <>
          <Button variant="outline" className="rounded-xl">
            <Filter className="size-4" /> Filters
          </Button>
          <Button variant="outline" className="rounded-xl" onClick={() => toast.success("All notifications marked as read")}>
            Mark all read
          </Button>
        </>
      }
    >
      <Tabs value={tab} onValueChange={setTab} className="mb-5">
        <TabsList className="rounded-xl">
          <TabsTrigger value="new" className="rounded-lg">
            New arrivals <span className="ml-2 rounded-full bg-destructive px-1.5 text-[10px] text-destructive-foreground">2</span>
          </TabsTrigger>
          <TabsTrigger value="hold" className="rounded-lg">On hold</TabsTrigger>
          <TabsTrigger value="all" className="rounded-lg">All</TabsTrigger>
        </TabsList>
      </Tabs>

      {filtered.length === 0 ? (
        <Card className="items-center gap-2 rounded-2xl border-dashed p-14 text-center shadow-none">
          <span className="grid size-14 place-items-center rounded-2xl bg-muted text-muted-foreground">
            <Inbox className="size-6" />
          </span>
          <p className="mt-2 text-sm font-semibold">Nothing in this queue</p>
          <p className="max-w-xs text-xs text-muted-foreground">
            New gate entries approved by security will appear here instantly.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((a, i) => (
            <Card
              key={a.id}
              className="animate-fade-up gap-0 rounded-2xl border-border/70 p-0 shadow-soft transition-shadow hover:shadow-lift"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <div className="flex flex-wrap items-start gap-4 p-5">
                <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-primary-soft text-primary">
                  <Truck className="size-5" />
                </span>

                <div className="min-w-[220px] flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-mono text-sm font-semibold">{a.truckNo}</p>
                    <StatusBadge status={a.status} />
                    {a.priority === "High" && (
                      <span className="rounded-full bg-danger-soft px-2 py-0.5 text-[10px] font-semibold text-destructive">
                        High priority
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {a.vendor} · {a.material}
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-xs sm:grid-cols-4">
                    <div>
                      <p className="text-muted-foreground">PO number</p>
                      <p className="font-mono font-medium">{a.po}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Arrival time</p>
                      <p className="font-medium tabular-nums">{a.arrivalTime} · waiting {a.waitMins}m</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Load</p>
                      <p className="font-medium">{a.pallets} pallets · {a.weight}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Cleared by</p>
                      <p className="font-medium">{a.securityGuard}</p>
                    </div>
                  </div>
                </div>

                <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                  <Button variant="outline" className="rounded-xl" asChild>
                    <Link to="/gate-entry">
                      <Eye className="size-4" /> View
                    </Link>
                  </Button>
                  <Button
                    variant="outline"
                    className="rounded-xl border-destructive/30 text-destructive hover:bg-danger-soft hover:text-destructive"
                    onClick={() => setReject(a.truckNo)}
                  >
                    <XCircle className="size-4" /> Reject
                  </Button>
                  <Button
                    className="rounded-xl shadow-glow"
                    onClick={() => {
                      toast.success(`Arrival accepted · ${a.truckNo}`, { description: "Proceed to vehicle verification." });
                      navigate({ to: "/gate-entry" });
                    }}
                  >
                    <CheckCircle2 className="size-4" /> Accept
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <div className="mt-6 flex items-center gap-2 rounded-2xl border border-border/70 bg-card p-4 text-xs text-muted-foreground shadow-soft">
        <Bell className="size-4 text-primary" />
        Notifications are pushed from Gate Security in real time. Escalation triggers automatically if a vehicle waits over 45 minutes.
      </div>

      <AlertDialog open={!!reject} onOpenChange={(o) => !o && setReject(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Reject arrival {reject}?</AlertDialogTitle>
            <AlertDialogDescription>
              The vehicle will be turned away at the gate and the vendor plus procurement buyer will be notified. This action is
              logged against your employee ID.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => toast.error(`Arrival rejected · ${reject}`, { description: "Vendor and buyer notified." })}
            >
              Confirm rejection
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
