import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  ClipboardCheck,
  FileCheck2,
  Loader2,
  PackageCheck,
  RefreshCw,
  ShieldCheck,
  Truck,
  UserCheck,
  Warehouse,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell, StatusBadge } from "@/components/wms/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api-client";
import { requireRole } from "@/lib/auth-utils";
export const Route = createFileRoute("/vehicle-exit")({
  beforeLoad: () => requireRole("GATE_SECURITY"),
  component: VehicleExit,
});
type ExitRecord = {
  gate_entry_id: string;
  gate_entry_number: string;
  asn_number: string;
  po_number: string;
  grn_number: string;
  grn_status: string;
  vehicle_number: string;
  driver_name: string;
  driver_phone?: string;
  dock_number: string;
  receiving_completed_at?: string;
  dock_released_at: string;
  status: "RECEIVING_COMPLETED" | "EXIT_APPROVED";
  exit_document_reference?: string;
  approved_by?: string;
  approved_at?: string;
};
const checks = [
  ["vehicle_verified", "Vehicle verified", Truck],
  ["driver_verified", "Driver verified", UserCheck],
  ["asn_verified", "ASN verified", ClipboardCheck],
  ["po_verified", "PO verified", FileCheck2],
  ["grn_verified", "GRN posted and verified", PackageCheck],
  ["receiving_verified", "Receiving complete and dock released", Warehouse],
] as const;
type CheckKey = (typeof checks)[number][0];
type VerificationState = Record<CheckKey, boolean>;
const emptyVerification = (): VerificationState => ({
  vehicle_verified: false,
  driver_verified: false,
  asn_verified: false,
  po_verified: false,
  grn_verified: false,
  receiving_verified: false,
});
function VehicleExit() {
  const [records, setRecords] = useState<ExitRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [references, setReferences] = useState<Record<string, string>>({});
  const [verification, setVerification] = useState<Record<string, VerificationState>>({});
  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      setRecords(await api.getVehicleExitQueue());
    } catch (error) {
      if (!quiet) {
        toast.error("Unable to load the vehicle exit queue", {
          description: error instanceof Error ? error.message : undefined,
        });
      }
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(true), 5000);
    return () => window.clearInterval(timer);
  }, [load]);
  const awaiting = useMemo(
    () => records.filter((record) => record.status === "RECEIVING_COMPLETED"),
    [records],
  );
  const approved = useMemo(
    () => records.filter((record) => record.status === "EXIT_APPROVED"),
    [records],
  );
  function updateCheck(id: string, key: CheckKey, checked: boolean) {
    setVerification((current) => ({
      ...current,
      [id]: { ...(current[id] || emptyVerification()), [key]: checked },
    }));
  }
  async function approve(record: ExitRecord) {
    const selected = verification[record.gate_entry_id] || emptyVerification();
    if (!checks.every(([key]) => selected[key])) {
      toast.error("Complete all six security checks before approving exit");
      return;
    }
    const reference = references[record.gate_entry_id]?.trim();
    if (!reference) {
      toast.error("Enter an exit document reference");
      return;
    }
    setBusy(record.gate_entry_id);
    try {
      const result = await api.approveVehicleExit(record.gate_entry_id, {
        exit_document_reference: reference,
        ...selected,
      });
      toast.success("Vehicle exit approved", {
        description: `${result.vehicle_number} may leave. Received materials remain in warehouse inventory.`,
      });
      await load(true);
    } catch (error) {
      toast.error("Unable to approve vehicle exit", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setBusy(null);
    }
  }
  return (
    <AppShell
      title="Vehicle Exit Approval"
      subtitle="Final security verification after receiving and dock release"
      actions={
        <Button variant="outline" className="rounded-xl" onClick={() => void load()}>
          <RefreshCw className="size-4" /> Refresh
        </Button>
      }
    >
      <Card className="mb-6 rounded-2xl border-primary/20 bg-primary-soft/30 p-4">
        <div className="flex gap-3">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" />
          <div>
            <p className="font-semibold">This is the final vehicle transaction</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Approval releases the supplier vehicle from the warehouse. GRN-posted materials stay
              in warehouse inventory and continue to putaway.
            </p>
          </div>
        </div>
      </Card>

      {loading ? (
        <div className="grid h-64 place-items-center">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      ) : awaiting.length === 0 ? (
        <Card className="grid min-h-56 place-items-center rounded-2xl border-dashed p-6 text-center">
          <div>
            <CheckCircle2 className="mx-auto mb-3 size-9 text-success" />
            <p className="font-semibold">No vehicles awaiting exit approval</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Vehicles appear here after receiving completes, the GRN is posted, and the dock is
              released.
            </p>
          </div>
        </Card>
      ) : (
        <div className="space-y-5">
          {awaiting.map((record) => {
            const selected = verification[record.gate_entry_id] || emptyVerification();
            const ready =
              checks.every(([key]) => selected[key]) &&
              Boolean(references[record.gate_entry_id]?.trim());
            return (
              <Card key={record.gate_entry_id} className="rounded-2xl p-5 shadow-soft">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-xs text-muted-foreground">
                      {record.gate_entry_number}
                    </p>
                    <h2 className="mt-1 font-mono text-xl font-black text-primary">
                      {record.vehicle_number}
                    </h2>
                    <p className="text-sm">
                      {record.driver_name}
                      {record.driver_phone ? ` · ${record.driver_phone}` : ""}
                    </p>
                  </div>
                  <StatusBadge status={record.status} />
                </div>

                <div className="my-5 grid gap-3 rounded-xl border bg-muted/20 p-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
                  <Info label="ASN" value={record.asn_number} />
                  <Info label="PO" value={record.po_number} />
                  <Info label="GRN" value={`${record.grn_number} · ${record.grn_status}`} />
                  <Info label="Released dock" value={record.dock_number} />
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {checks.map(([key, label, Icon]) => (
                    <Label
                      key={key}
                      className="flex cursor-pointer items-center gap-3 rounded-xl border p-3 font-medium"
                    >
                      <Checkbox
                        checked={selected[key]}
                        onCheckedChange={(value) =>
                          updateCheck(record.gate_entry_id, key, value === true)
                        }
                      />
                      <Icon className="size-4 text-primary" /> {label}
                    </Label>
                  ))}
                </div>

                <div className="mt-5 flex flex-col gap-3 border-t pt-5 sm:flex-row sm:items-end">
                  <div className="flex-1">
                    <Label htmlFor={`reference-${record.gate_entry_id}`}>
                      Exit document reference
                    </Label>
                    <Input
                      id={`reference-${record.gate_entry_id}`}
                      className="mt-1.5"
                      placeholder="e.g. OUT-2026-00125"
                      value={references[record.gate_entry_id] || ""}
                      onChange={(event) =>
                        setReferences((current) => ({
                          ...current,
                          [record.gate_entry_id]: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <Button
                    className="rounded-xl"
                    disabled={!ready || busy === record.gate_entry_id}
                    onClick={() => void approve(record)}
                  >
                    {busy === record.gate_entry_id ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <ShieldCheck className="size-4" />
                    )}
                    Approve vehicle exit
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {approved.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted-foreground">
            Recently approved exits
          </h2>
          <div className="space-y-3">
            {approved.map((record) => (
              <Card
                key={record.gate_entry_id}
                className="flex flex-wrap items-center justify-between gap-4 rounded-xl p-4"
              >
                <div className="flex items-center gap-3">
                  <span className="grid size-10 place-items-center rounded-full bg-success-soft text-success">
                    <CheckCircle2 className="size-5" />
                  </span>
                  <div>
                    <p className="font-mono font-bold">{record.vehicle_number}</p>
                    <p className="text-xs text-muted-foreground">
                      {record.grn_number} · {record.exit_document_reference}
                    </p>
                  </div>
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  <p className="font-semibold text-success">Exit approved · Vehicle released</p>
                  <p>
                    {record.approved_by}
                    {record.approved_at
                      ? ` · ${new Date(record.approved_at).toLocaleString()}`
                      : ""}
                  </p>
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}
    </AppShell>
  );
}
function Info({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <p className="text-xs uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 font-mono font-semibold">{value || "—"}</p>
    </div>
  );
}
