import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PackageCheck, Users, ListChecks, Clock3, ArrowRight } from "lucide-react";
import { AppShell, StatusBadge } from "@/components/wms/app-shell";
import { SectionCard, StepRail, Timeline, Field } from "@/components/wms/primitives";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { api } from "@/lib/api-client";
import { activeArrival, receivingChecklist, receivingTeam } from "@/lib/wms-data";

export const Route = createFileRoute("/receiving")({
  head: () => ({
    meta: [
      { title: "Receiving in Progress · NexusWMS" },
      { name: "description", content: "Live receiving progress at dock D-04 with assigned team, unloading checklist, timeline and GRN handover." },
      { property: "og:title", content: "Receiving in Progress · NexusWMS" },
      { property: "og:description", content: "Track unloading progress, checklist and team until GRN is raised." },
    ],
  }),
  component: Receiving,
});

const timeline = [
  { time: "09:52", title: "Vehicle docked at D-04", detail: "Wheel chocks placed, dock leveller engaged", tone: "primary" },
  { time: "09:56", title: "Seal SL-772391 broken in presence of QC", detail: "Pooja Nair · photo captured", tone: "teal" },
  { time: "10:04", title: "Unloading started", detail: "Team Bravo · 2 forklifts assigned", tone: "primary" },
  { time: "10:21", title: "14 of 24 pallets offloaded", detail: "No visible damage reported", tone: "success" },
];

type VerifiedGatePo = {
  gateEntryId: string;
  poNumber: string;
  supplierName: string;
  materialDescription: string;
  totalQuantity: string;
  vehicleNumber: string;
};

function Receiving() {
  const a = activeArrival;
  const [gatePo, setGatePo] = useState<VerifiedGatePo | null>(null);
  const [checks, setChecks] = useState(receivingChecklist.map((c) => c.done));
  const [postingGrn, setPostingGrn] = useState(false);
  const [postedGrn, setPostedGrn] = useState<{ grn_id: string; status: string } | null>(null);
  const done = checks.filter(Boolean).length;
  const pct = Math.round((done / checks.length) * 100);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("verified_gate_po");
      if (stored) setGatePo(JSON.parse(stored) as VerifiedGatePo);
    } catch {
      localStorage.removeItem("verified_gate_po");
    }
  }, []);

  const receivingPoNumber = gatePo?.poNumber || a.po;

  async function confirmGrn() {
    if (postedGrn) {
      toast.info("GRN already posted", { description: `GRN ${postedGrn.grn_id} was created earlier.` });
      return;
    }

    setPostingGrn(true);
    try {
      const response = await api.confirmGrn(receivingPoNumber, [
        { itemCode: "ITEM-A", quantity: 14 },
        { itemCode: "ITEM-B", quantity: 10 },
      ]);
      setPostedGrn(response);
      toast.success("GRN posted to backend", {
        description: `GRN ${response.grn_id} status ${response.status}`,
      });
    } catch (err: any) {
      toast.error("Failed to post GRN: " + (err?.message || "unknown error"));
    } finally {
      setPostingGrn(false);
    }
  }

  return (
    <AppShell
      title="Receiving in progress"
      subtitle={`${a.truckNo} · dock D-04 · started 10:04 · ${a.pallets} pallets expected`}
      actions={
        <>
          <StatusBadge status="Receiving" />
          <Button variant="outline" className="rounded-xl" onClick={confirmGrn} disabled={postingGrn}>
            {postingGrn ? "Posting GRN..." : postedGrn ? `GRN ${postedGrn.grn_id}` : "Post GRN"}
          </Button>
          <Button
            className="rounded-xl shadow-glow"
            onClick={() => toast.success("Handover queued", { description: "Awaiting GRN posting by stores." })}
            asChild
          >
            <Link to="/grn">
              Continue <ArrowRight className="size-4" />
            </Link>
          </Button>
        </>
      }
    >
      <StepRail current={7} />

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          {postedGrn ? (
            <SectionCard title="GRN Posted" description={`Backend confirmed GRN ${postedGrn.grn_id}`} icon={PackageCheck}>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Field label="GRN ID" value={postedGrn.grn_id} mono />
                <Field label="Status" value={postedGrn.status} />
                <Field label="PO number" value={receivingPoNumber} mono />
              </div>
            </SectionCard>
          ) : null}

          <SectionCard title="Unloading progress" description="Live pallet count from handheld scanners" icon={PackageCheck}>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-3xl font-semibold tabular-nums">14 / 24</p>
                <p className="text-xs text-muted-foreground">pallets offloaded · 6 scanned into staging</p>
              </div>
              <p className="text-sm font-semibold text-primary">58%</p>
            </div>
            <Progress value={58} className="mt-3 h-2.5" />
            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              <Field label="Elapsed" value="27 min" />
              <Field label="Estimated completion" value="10:48" />
              <Field label="Damage reported" value="0 pallets" />
            </div>
          </SectionCard>

          {gatePo ? (
            <SectionCard title="Verified gate PO" description="Carried from the completed gate-entry scan" icon={PackageCheck}>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Field label="PO number" value={gatePo.poNumber} mono />
                <Field label="Supplier" value={gatePo.supplierName || "—"} />
                <Field label="Material" value={gatePo.materialDescription || "—"} />
                <Field label="Expected quantity" value={gatePo.totalQuantity || "—"} />
              </div>
            </SectionCard>
          ) : null}

          <SectionCard title="Receiving checklist" description={`${done} of ${checks.length} steps complete · ${pct}%`} icon={ListChecks}>
            <div className="space-y-2.5">
              {receivingChecklist.map((c, i) => (
                <label
                  key={c.label}
                  className="flex cursor-pointer items-center gap-3 rounded-xl border border-border/70 px-3 py-2.5 transition-colors hover:bg-accent"
                >
                  <Checkbox
                    checked={!!checks[i]}
                    onCheckedChange={(v) => {
                      setChecks((prev) => prev.map((p, idx) => (idx === i ? !!v : p)));
                      if (v) toast.success("Step completed", { description: c.label });
                    }}
                  />
                  <span className="text-sm">{c.label}</span>
                </label>
              ))}
            </div>
          </SectionCard>
        </div>

        <div className="space-y-4">
          <SectionCard title="Assigned team" description="Team Bravo · Zone B" icon={Users}>
            <div className="space-y-3">
              {receivingTeam.map((m) => (
                <div key={m.name} className="flex items-center gap-3">
                  <span className="grid size-9 place-items-center rounded-xl bg-primary-soft text-xs font-semibold text-primary">
                    {m.initials}
                  </span>
                  <div>
                    <p className="text-sm font-medium">{m.name}</p>
                    <p className="text-[11px] text-muted-foreground">{m.role}</p>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Receiving timeline" icon={Clock3}>
            <Timeline items={timeline} />
          </SectionCard>
        </div>
      </div>
    </AppShell>
  );
}
