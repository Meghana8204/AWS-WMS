import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Building2, FileText, CheckCircle2, AlertTriangle, Download } from "lucide-react";
import { AppShell, StatusBadge } from "@/components/wms/app-shell";
import { Field, SectionCard, StepRail } from "@/components/wms/primitives";
import { Button } from "@/components/ui/button";
import { activeArrival, poLines } from "@/lib/wms-data";

export const Route = createFileRoute("/purchase-order")({
  head: () => ({
    meta: [
      { title: "Purchase Order PO-2026-118432 · NexusWMS" },
      { name: "description", content: "Vendor verification and purchase order details: expected quantity, delivery date, material category and reference documents." },
      { property: "og:title", content: "Purchase Order PO-2026-118432 · NexusWMS" },
      { property: "og:description", content: "Vendor and purchase order verification before accepting a truck arrival." },
    ],
  }),
  component: PurchaseOrder,
});

function PurchaseOrder() {
  const a = activeArrival;
  const navigate = useNavigate();

  return (
    <AppShell
      title="Vendor & purchase order verification"
      subtitle={`${a.po} · ${a.vendor} · ${a.poValue}`}
      actions={
        <>
          <Button
            variant="outline"
            className="rounded-xl border-warning/40 text-warning-foreground hover:bg-warning-soft"
            onClick={() => toast.warning("Mismatch flagged", { description: "Procurement buyer notified for PO reconciliation." })}
          >
            <AlertTriangle className="size-4" /> Report mismatch
          </Button>
          <Button
            className="rounded-xl shadow-glow"
            onClick={() => {
              toast.success("Purchase order verified", { description: "Proceed to arrival acceptance." });
              navigate({ to: "/accept-arrival" });
            }}
          >
            <CheckCircle2 className="size-4" /> Mark verified
          </Button>
        </>
      }
    >
      <StepRail current={4} />

      <div className="grid gap-4 xl:grid-cols-3">
        <SectionCard title="Vendor verification" icon={Building2}>
          <div className="grid gap-3">
            <Field label="Vendor name" value={a.vendor} />
            <Field label="Vendor code" value={a.vendorCode} mono />
            <Field label="GSTIN" value="27AAACH2702H1ZV" mono />
            <Field label="Vendor rating" value="A · 96% on-time, 0.4% rejection" />
            <Field label="Contract" value="Annual rate contract till 31 Mar 2027" />
            <Field label="Approval status" value={<StatusBadge status="Approved" />} />
          </div>
        </SectionCard>

        <SectionCard title="Purchase order header" icon={FileText} className="xl:col-span-2">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="PO number" value={a.po} mono />
            <Field label="PO date" value="18 Jul 2026" />
            <Field label="Buyer" value="N. Deshpande · Procurement" />
            <Field label="Expected quantity" value="1,240 units · 24 pallets" />
            <Field label="Expected delivery" value="31 Jul 2026" />
            <Field label="Material category" value="Raw material · Polymers" />
            <Field label="Incoterm" value="FOR Destination" />
            <Field label="Payment terms" value="45 days from GRN" />
            <Field label="PO value" value={a.poValue} />
          </div>

          <div className="mt-5 -mx-5 overflow-x-auto px-5">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="pb-3 font-medium">Material</th>
                  <th className="pb-3 font-medium">Description</th>
                  <th className="pb-3 font-medium">UoM</th>
                  <th className="pb-3 text-right font-medium">Ordered</th>
                  <th className="pb-3 text-right font-medium">Pending</th>
                  <th className="pb-3 text-right font-medium">Rate</th>
                </tr>
              </thead>
              <tbody>
                {poLines.map((l) => (
                  <tr key={l.code} className="border-b border-border/60 last:border-0">
                    <td className="py-3 font-mono text-xs">{l.code}</td>
                    <td className="py-3">{l.desc}</td>
                    <td className="py-3 text-muted-foreground">{l.uom}</td>
                    <td className="py-3 text-right tabular-nums">{l.ordered}</td>
                    <td className="py-3 text-right tabular-nums font-medium">{l.pending}</td>
                    <td className="py-3 text-right tabular-nums">{l.rate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      </div>

      <div className="mt-4">
        <SectionCard title="Reference documents" icon={FileText}>
          <div className="grid gap-3 sm:grid-cols-3">
            {["PO_Copy_2026-118432.pdf", "Rate_Contract_HPL_2026.pdf", "Quality_Spec_HDPE_5502.pdf"].map((d) => (
              <button
                key={d}
                onClick={() => toast.info("Opening document", { description: d })}
                className="flex items-center gap-3 rounded-2xl border border-border/70 p-3 text-left transition-colors hover:border-primary/30 hover:bg-primary-soft"
              >
                <span className="grid size-9 place-items-center rounded-xl bg-muted text-muted-foreground">
                  <FileText className="size-4" />
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{d}</span>
                <Download className="size-4 text-muted-foreground" />
              </button>
            ))}
          </div>
        </SectionCard>
      </div>
    </AppShell>
  );
}
