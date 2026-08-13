import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { User, ShieldCheck, Phone, IdCard, CheckCircle2, XCircle } from "lucide-react";
import { AppShell, StatusBadge } from "@/components/wms/app-shell";
import { Field, SectionCard, StepRail } from "@/components/wms/primitives";
import { Button } from "@/components/ui/button";
import { activeArrival } from "@/lib/wms-data";
import driverPhoto from "@/assets/driver.jpg";

export const Route = createFileRoute("/driver-verification")({
  head: () => ({
    meta: [
      { title: "Driver Verification · NexusWMS" },
      { name: "description", content: "Verify driver identity, licence validity, contact details, previous visits and blacklist status before dock entry." },
      { property: "og:title", content: "Driver Verification · NexusWMS" },
      { property: "og:description", content: "Identity, licence and blacklist checks for inbound truck drivers." },
    ],
  }),
  component: DriverVerification,
});

function DriverVerification() {
  const a = activeArrival;
  const navigate = useNavigate();

  return (
    <AppShell
      title="Driver verification"
      subtitle={`${a.driver} · licence ${a.license}`}
      actions={
        <>
          <Button
            variant="outline"
            className="rounded-xl border-destructive/30 text-destructive hover:bg-danger-soft hover:text-destructive"
            onClick={() => toast.error("Driver rejected", { description: "Transporter asked to send a replacement driver." })}
          >
            <XCircle className="size-4" /> Reject
          </Button>
          <Button
            className="rounded-xl shadow-glow"
            onClick={() => {
              toast.success("Driver approved", { description: "Continue to vendor and purchase order check." });
              navigate({ to: "/purchase-order" });
            }}
          >
            <CheckCircle2 className="size-4" /> Approve
          </Button>
        </>
      }
    >
      <StepRail current={3} />

      <div className="grid gap-4 xl:grid-cols-3">
        <SectionCard title="Driver identity" icon={User} className="xl:col-span-2">
          <div className="flex flex-wrap items-start gap-6">
            <img
              src={driverPhoto}
              alt={`${a.driver}, delivery driver`}
              loading="lazy"
              width={640}
              height={640}
              className="size-36 rounded-2xl object-cover shadow-soft"
            />
            <div className="grid flex-1 gap-4 sm:grid-cols-2">
              <Field label="Full name" value={a.driver} />
              <Field label="Mobile" value={a.driverPhone} mono />
              <Field label="Licence number" value={a.license} mono />
              <Field label="Licence validity" value="Valid till 18 Aug 2029" />
              <Field label="Licence class" value="HMV · Transport endorsement" />
              <Field label="Aadhaar (masked)" value="XXXX XXXX 4471" mono />
              <Field label="Transporter" value={a.transporter} />
              <Field label="Safety induction" value="Completed 22 Jul 2026" />
            </div>
          </div>
        </SectionCard>

        <div className="space-y-4">
          <SectionCard title="Compliance status" icon={ShieldCheck}>
            <div className="space-y-3">
              {[
                { label: "Blacklist check", value: "Clear", ok: true },
                { label: "Breath analyser", value: "Negative · 09:08", ok: true },
                { label: "PPE compliance", value: "Helmet + vest issued", ok: true },
                { label: "Licence authenticity", value: "Verified via VAHAN", ok: true },
              ].map((c) => (
                <div key={c.label} className="flex items-center justify-between rounded-xl border border-border/70 px-3 py-2.5">
                  <span className="text-sm">{c.label}</span>
                  <span className="text-xs font-semibold text-success">{c.value}</span>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Previous visits" icon={IdCard}>
            <div className="space-y-3 text-sm">
              <Field label="Total visits" value="14 visits · since Feb 2025" />
              <Field label="Last visit" value="22 Jul 2026 · dock D-04" />
              <Field label="Incidents" value="0 reported" />
              <Field label="Status" value={<StatusBadge status="Approved" />} />
            </div>
            <Button
              variant="outline"
              className="mt-4 w-full rounded-xl"
              onClick={() => toast.info("Calling driver", { description: a.driverPhone })}
            >
              <Phone className="size-4" /> Call driver
            </Button>
          </SectionCard>
        </div>
      </div>
    </AppShell>
  );
}
