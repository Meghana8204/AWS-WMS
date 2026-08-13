import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, XCircle, ClipboardCheck, Loader2 } from "lucide-react";
import { AppShell, StatusBadge } from "@/components/wms/app-shell";
import { Field, SectionCard, StepRail } from "@/components/wms/primitives";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { activeArrival } from "@/lib/wms-data";

export const Route = createFileRoute("/accept-arrival")({
  head: () => ({
    meta: [
      { title: "Accept Arrival · NexusWMS" },
      { name: "description", content: "Final arrival acceptance summary covering vehicle, vendor, purchase order, arrival time and receiving warehouse." },
      { property: "og:title", content: "Accept Arrival · NexusWMS" },
      { property: "og:description", content: "Confirm the truck arrival and move to dock assignment." },
    ],
  }),
  component: AcceptArrival,
});

function AcceptArrival() {
  const a = activeArrival;
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  return (
    <AppShell title="Accept arrival" subtitle="Review the consolidated summary and confirm acceptance">
      <StepRail current={5} />
      <div className="grid gap-4 xl:grid-cols-3">
        <SectionCard title="Arrival summary" icon={ClipboardCheck} className="xl:col-span-2">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Gate entry" value={a.gateEntryNo} mono />
            <Field label="Truck number" value={a.truckNo} mono />
            <Field label="Transporter" value={a.transporter} />
            <Field label="Driver" value={a.driver} />
            <Field label="Vendor" value={a.vendor} />
            <Field label="Purchase order" value={a.po} mono />
            <Field label="Material" value={a.material} />
            <Field label="Load" value={`${a.pallets} pallets · ${a.weight}`} />
            <Field label="Arrival time" value={`${a.arrivalTime} · 31 Jul 2026`} />
            <Field label="Receiving warehouse" value="Pune DC · Plant 1200" />
            <Field label="Storage location" value="RM-BULK-01" />
            <Field label="Status" value={<StatusBadge status="Waiting" />} />
          </div>
          <div className="mt-5">
            <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Manager remarks</p>
            <Textarea
              rows={3}
              className="rounded-xl"
              defaultValue="All three verifications cleared. Proceed with bulk unloading in Zone A."
            />
          </div>
        </SectionCard>

        <SectionCard title="Verification checklist" icon={CheckCircle2}>
          <div className="space-y-3">
            {["Vehicle verified · OCR matched", "Driver approved · blacklist clear", "Vendor verified · rating A", "Purchase order verified · no mismatch"].map((c) => (
              <div key={c} className="flex items-start gap-3 rounded-xl border border-success/25 bg-success-soft px-3 py-2.5">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
                <span className="text-sm">{c}</span>
              </div>
            ))}
          </div>
          <div className="mt-5 flex flex-col gap-2">
            <Button
              className="h-11 rounded-xl shadow-glow"
              disabled={loading}
              onClick={() => {
                setLoading(true);
                setTimeout(() => {
                  setLoading(false);
                  toast.success("Arrival accepted", { description: "Now assign an unloading dock." });
                  navigate({ to: "/dock-assignment" });
                }, 900);
              }}
            >
              {loading ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
              {loading ? "Accepting…" : "Accept arrival"}
            </Button>
            <Button
              variant="outline"
              className="h-11 rounded-xl border-destructive/30 text-destructive hover:bg-danger-soft hover:text-destructive"
              onClick={() => {
                toast.error("Arrival rejected");
                navigate({ to: "/notifications" });
              }}
            >
              <XCircle className="size-4" /> Reject
            </Button>
          </div>
        </SectionCard>
      </div>
    </AppShell>
  );
}
