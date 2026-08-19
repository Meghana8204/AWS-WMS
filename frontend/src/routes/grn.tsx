import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { FileCheck2, Loader2, ArrowRight } from "lucide-react";
import { AppShell, StatusBadge } from "@/components/wms/app-shell";
import { Field, SectionCard } from "@/components/wms/primitives";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api-client";
import { activeArrival } from "@/lib/wms-data";

export const Route = createFileRoute("/grn")({
  head: () => ({
    meta: [
      { title: "Waiting for GRN · NexusWMS" },
      { name: "description", content: "Unloading complete — awaiting goods receipt note posting by the stores team before vehicle release." },
      { property: "og:title", content: "Waiting for GRN · NexusWMS" },
      { property: "og:description", content: "Goods receipt note pending after unloading completion." },
    ],
  }),
  component: Grn,
});

function Grn() {
  const a = activeArrival;
  const [posting, setPosting] = useState(false);
  const [grnResult, setGrnResult] = useState<{ grn_id: string; status: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function postGrn() {
    if (grnResult) {
      toast.info("GRN already posted", { description: `GRN ${grnResult.grn_id} is already confirmed.` });
      return;
    }

    setError(null);
    setPosting(true);
    try {
      const result = await api.confirmGrn(a.po, [
        { itemCode: "ITEM-A", quantity: 14 },
        { itemCode: "ITEM-B", quantity: 10 },
      ]);
      setGrnResult(result);
      toast.success("GRN posted", { description: `GRN ${result.grn_id} created successfully.` });
    } catch (err: any) {
      setError(err?.message || "Unable to post GRN");
      toast.error("GRN post failed: " + (err?.message || "unknown error"));
    } finally {
      setPosting(false);
    }
  }

  return (
    <AppShell title="Waiting for GRN" subtitle="Unloading complete — stores team is posting the goods receipt note">
      <div className="grid gap-4 xl:grid-cols-3">
        <SectionCard title="Handover summary" icon={FileCheck2} className="xl:col-span-2">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Gate entry" value={a.gateEntryNo} mono />
            <Field label="Truck" value={a.truckNo} mono />
            <Field label="Dock" value="D-04 · Zone B" />
            <Field label="Purchase order" value={a.po} mono />
            <Field label="Pallets received" value="24 of 24" />
            <Field label="Short / damaged" value="0" />
            <Field label="Unloading window" value="10:04 – 10:46" />
            <Field label="QC sample" value="Drawn · lab ref QC-88120" />
            <Field label="Status" value={<StatusBadge status="Completed" />} />
          </div>
        </SectionCard>

        <Card className="items-center gap-0 rounded-2xl border-border/70 p-6 text-center shadow-soft">
          <span className="grid size-14 place-items-center rounded-2xl bg-warning-soft text-warning-foreground">
            <Loader2 className="size-6 animate-spin" />
          </span>
          <p className="mt-4 text-sm font-semibold">GRN posting in progress</p>
          <p className="mt-1 text-xs text-muted-foreground">Stores clerk: Meena Joshi · started 10:47</p>
          <div className="mt-5 w-full space-y-2">
            <Skeleton className="h-3 w-full rounded-full" />
            <Skeleton className="h-3 w-4/5 rounded-full" />
            <Skeleton className="h-3 w-3/5 rounded-full" />
          </div>
          <Button variant="outline" className="mt-6 w-full rounded-xl" asChild>
            <Link to="/warehouse-dashboard">
              Back to dashboard <ArrowRight className="size-4" />
            </Link>
          </Button>
        </Card>
      </div>
    </AppShell>
  );
}
