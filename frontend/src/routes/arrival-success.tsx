import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, PackagePlus, Eye } from "lucide-react";
import { AppShell } from "@/components/wms/app-shell";
import { Field } from "@/components/wms/primitives";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { activeArrival } from "@/lib/wms-data";

export const Route = createFileRoute("/arrival-success")({
  head: () => ({
    meta: [
      { title: "Arrival Confirmed · NexusWMS" },
      { name: "description", content: "Arrival confirmation with gate entry number, assigned dock, arrival time and next step to start receiving." },
      { property: "og:title", content: "Arrival Confirmed · NexusWMS" },
      { property: "og:description", content: "Truck accepted and dock assigned — ready to start receiving." },
    ],
  }),
  component: ArrivalSuccess,
});

function ArrivalSuccess() {
  const a = activeArrival;
  return (
    <AppShell title="Arrival confirmed" subtitle="The vehicle has been accepted and a dock is reserved">
      <Card className="surface-mesh mx-auto max-w-2xl items-center gap-0 rounded-2xl border-border/70 p-10 text-center shadow-lift">
        <span className="grid size-20 place-items-center rounded-full bg-success-soft text-success animate-pulse-ring">
          <CheckCircle2 className="size-10" />
        </span>
        <h2 className="mt-6 text-2xl font-semibold tracking-tight">Arrival accepted successfully</h2>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          {a.truckNo} has been called forward to dock D-04. The receiving team has been notified.
        </p>

        <div className="mt-8 grid w-full gap-4 rounded-2xl border border-border/70 bg-card p-5 text-left sm:grid-cols-2">
          <Field label="Gate entry number" value={a.gateEntryNo} mono />
          <Field label="Assigned dock" value="D-04 · Zone B — Palletised" />
          <Field label="Arrival time" value={`${a.arrivalTime} · 31 Jul 2026`} />
          <Field label="Accepted by" value="Rohit Sharma · Warehouse Manager" />
        </div>

        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Button variant="outline" className="rounded-xl" asChild>
            <Link to="/gate-entry">
              <Eye className="size-4" /> View details
            </Link>
          </Button>
          <Button className="rounded-xl shadow-glow" asChild>
            <Link to="/receiving">
              <PackagePlus className="size-4" /> Start receiving
            </Link>
          </Button>
        </div>
      </Card>
    </AppShell>
  );
}
