import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Truck, ZoomIn, ScanLine, History, CheckCircle2, AlertTriangle } from "lucide-react";
import { AppShell, StatusBadge } from "@/components/wms/app-shell";
import { Field, SectionCard, StepRail } from "@/components/wms/primitives";
import { Button } from "@/components/ui/button";
import { activeArrival } from "@/lib/wms-data";
import truckGate from "@/assets/truck-gate.jpg";
import truckRear from "@/assets/truck-rear.jpg";
import { Dialog, DialogContent } from "@/components/ui/dialog";

export const Route = createFileRoute("/vehicle-verification")({
  head: () => ({
    meta: [
      { title: "Vehicle Verification · MH 12 QT 4489 · NexusWMS" },
      { name: "description", content: "Verify truck images, OCR-read plate number, fitness documents and visit history before dock allocation." },
      { property: "og:title", content: "Vehicle Verification · NexusWMS" },
      { property: "og:description", content: "Image, OCR and compliance verification for inbound vehicles." },
    ],
  }),
  component: VehicleVerification,
});

const history = [
  { date: "22 Jul 2026", po: "PO-2026-117905", result: "Accepted", note: "No exception" },
  { date: "09 Jul 2026", po: "PO-2026-117402", result: "Accepted", note: "Late by 40 min" },
  { date: "27 Jun 2026", po: "PO-2026-116988", result: "Accepted", note: "No exception" },
];

function VehicleVerification() {
  const a = activeArrival;
  const navigate = useNavigate();
  const [zoom, setZoom] = useState<string | null>(null);

  return (
    <AppShell
      title="Vehicle verification"
      subtitle={`${a.truckNo} · ${a.transporter} · gate entry ${a.gateEntryNo}`}
      actions={
        <>
          <Button
            variant="outline"
            className="rounded-xl border-warning/40 text-warning-foreground hover:bg-warning-soft"
            onClick={() => toast.warning("Issue reported", { description: "Vehicle exception raised to gate security." })}
          >
            <AlertTriangle className="size-4" /> Report issue
          </Button>
          <Button
            className="rounded-xl shadow-glow"
            onClick={() => {
              toast.success("Vehicle verified", { description: "Proceed to driver verification." });
              navigate({ to: "/driver-verification" });
            }}
          >
            <CheckCircle2 className="size-4" /> Mark verified
          </Button>
        </>
      }
    >
      <StepRail current={2} />

      <div className="grid gap-4 xl:grid-cols-3">
        <SectionCard title="Captured vehicle images" description="Tap an image to zoom" icon={Truck} className="xl:col-span-2">
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { src: truckGate, label: "Front · Gate 2 · 09:04" },
              { src: truckRear, label: "Rear seal · 09:06" },
            ].map((img) => (
              <button
                key={img.label}
                onClick={() => setZoom(img.src)}
                className="group relative overflow-hidden rounded-2xl border border-border/70"
              >
                <img src={img.src} alt={img.label} loading="lazy" width={1024} height={640} className="h-56 w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                <span className="absolute right-3 top-3 grid size-8 place-items-center rounded-lg bg-card/90 text-foreground shadow-soft">
                  <ZoomIn className="size-4" />
                </span>
                <span className="absolute inset-x-0 bottom-0 bg-foreground/60 px-3 py-2 text-left text-[11px] font-medium text-background">
                  {img.label}
                </span>
              </button>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="OCR plate reading" description="Automatic number plate recognition" icon={ScanLine}>
          <div className="rounded-2xl border border-success/30 bg-success-soft p-4 text-center">
            <p className="font-mono text-xl font-bold tracking-widest">{a.truckNo}</p>
            <p className="mt-1 text-xs font-medium text-success">98.7% confidence · matches gate entry</p>
          </div>
          <div className="mt-4 grid gap-3">
            <Field label="RC validity" value="Valid till 14 Mar 2029" />
            <Field label="Fitness certificate" value="Valid till 09 Nov 2027" />
            <Field label="Insurance" value="Valid till 21 Feb 2027" />
            <Field label="PUC" value="Valid till 03 Jan 2027" />
            <Field label="Vehicle status" value={<StatusBadge status="Approved" />} />
          </div>
        </SectionCard>
      </div>

      <div className="mt-4">
        <SectionCard title="Visit history" description="Last three visits by this vehicle" icon={History}>
          <div className="-mx-5 overflow-x-auto px-5">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="pb-3 font-medium">Date</th>
                  <th className="pb-3 font-medium">PO</th>
                  <th className="pb-3 font-medium">Outcome</th>
                  <th className="pb-3 font-medium">Notes</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.po} className="border-b border-border/60 last:border-0">
                    <td className="py-3">{h.date}</td>
                    <td className="py-3 font-mono text-xs">{h.po}</td>
                    <td className="py-3"><StatusBadge status="Completed" /></td>
                    <td className="py-3 text-muted-foreground">{h.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      </div>

      <Dialog open={!!zoom} onOpenChange={(o) => !o && setZoom(null)}>
        <DialogContent className="max-w-3xl rounded-2xl p-2">
          {zoom && <img src={zoom} alt="Vehicle capture enlarged" className="w-full rounded-xl" />}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
