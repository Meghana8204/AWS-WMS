import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { ArrowRight, FileCheck2, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { AppShell, StatusBadge } from "@/components/wms/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api-client";

export const Route = createFileRoute("/grn")({ component: Grn });
type Item = { item_code: string; material_name?: string; uom?: string; po_quantity: number; received_quantity: number; accepted_quantity: number; damaged_quantity: number; rejected_quantity: number; quality_result?: string };
type Draft = { id: string; grn_number: string; status: "GRN_DRAFT" | "GRN_POSTED"; po_number: string; asn_number: string; supplier_name: string; vehicle_number: string; warehouse_id: string; dock_number: string; items: Item[]; posted_by?: string; posted_at?: string; verification_notes?: string; official_record?: boolean; inventory_updated?: boolean };

function Grn() {
  const [drafts, setDrafts] = useState<Draft[]>([]), [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null), [notes, setNotes] = useState<Record<string, string>>({});
  const load = useCallback(async () => { setLoading(true); try { setDrafts(await api.getGrnDrafts()); } catch (error) { toast.error("Unable to load GRN drafts", { description: error instanceof Error ? error.message : undefined }); } finally { setLoading(false); } }, []);
  useEffect(() => { void load(); }, [load]);
  async function post(draft: Draft) { setBusy(draft.id); try { await api.postGrn(draft.id, notes[draft.id]); toast.success("GRN posted and inventory updated", { description: `${draft.grn_number} is now the official receiving record.` }); await load(); } catch (error) { toast.error("Unable to post GRN", { description: error instanceof Error ? error.message : undefined }); } finally { setBusy(null); } }
  return <AppShell title="Goods Received Notes" subtitle="Draft receipts prepared from completed inbound receiving" actions={<Button variant="outline" className="rounded-xl" onClick={() => void load()}><RefreshCw className="size-4" /> Refresh</Button>}>
    {loading ? <div className="grid h-64 place-items-center"><Loader2 className="size-6 animate-spin text-primary" /></div> : drafts.length === 0 ? <Card className="grid h-64 place-items-center rounded-2xl text-center text-sm text-muted-foreground"><div><FileCheck2 className="mx-auto mb-3 size-8" />No GRN drafts have been prepared.</div></Card> : <div className="space-y-5">{drafts.map(draft => <Card key={draft.id} className="rounded-2xl p-5">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-medium uppercase text-muted-foreground">Goods Received Note</p><h2 className="font-mono text-xl font-bold text-primary">{draft.grn_number}</h2></div><StatusBadge status={draft.status} /></div>
      <div className="my-5 grid gap-3 rounded-xl border bg-muted/20 p-4 text-sm sm:grid-cols-2 lg:grid-cols-3"><Info label="PO" value={draft.po_number} /><Info label="ASN" value={draft.asn_number} /><Info label="Supplier" value={draft.supplier_name} /><Info label="Vehicle" value={draft.vehicle_number} /><Info label="Warehouse" value={draft.warehouse_id} /><Info label="Dock" value={draft.dock_number} /></div>
      <div className="mb-4 flex flex-wrap items-center justify-center gap-2 rounded-xl border p-3 text-xs font-semibold"><span>PO</span><ArrowRight className="size-3" /><span>ASN</span><ArrowRight className="size-3" /><span>Actual Receiving</span><ArrowRight className="size-3" /><span>Quality Result</span><ArrowRight className="size-3" /><span>GRN</span></div>
      <div className="overflow-x-auto rounded-xl border"><table className="w-full text-sm"><thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground"><tr><th className="px-4 py-3">Material</th><th className="px-4 py-3">PO Qty</th><th className="px-4 py-3">Received</th><th className="px-4 py-3">Accepted</th><th className="px-4 py-3">Damaged</th><th className="px-4 py-3">Quality</th></tr></thead><tbody className="divide-y">{draft.items.map(item => <tr key={item.item_code}><td className="px-4 py-3"><b>{item.material_name || item.item_code}</b><p className="font-mono text-xs text-muted-foreground">{item.item_code}</p></td><Qty value={item.po_quantity} uom={item.uom} /><Qty value={item.received_quantity} uom={item.uom} /><Qty value={item.accepted_quantity} uom={item.uom} /><Qty value={item.damaged_quantity} uom={item.uom} /><td className="px-4 py-3 font-bold">{item.quality_result || "—"}</td></tr>)}</tbody></table></div>
      {draft.status === "GRN_DRAFT" ? <div className="mt-4 flex flex-wrap items-end justify-end gap-3"><label className="min-w-64 flex-1 text-xs font-medium">Verification notes<Input className="mt-1" value={notes[draft.id] || ""} onChange={event => setNotes(all => ({ ...all, [draft.id]: event.target.value }))} placeholder="Optional posting notes" /></label><Button className="rounded-xl" disabled={busy === draft.id} onClick={() => void post(draft)}>{busy === draft.id && <Loader2 className="size-4 animate-spin" />} Post GRN</Button></div> : <div className="mt-4 rounded-xl border border-success/30 bg-success-soft p-3 text-sm"><b className="text-success">Official receiving record · Inventory updated</b><p className="text-xs text-muted-foreground">Posted by {draft.posted_by || "responsible user"}{draft.posted_at ? ` · ${new Date(draft.posted_at).toLocaleString()}` : ""}</p>{draft.verification_notes && <p className="mt-1 text-xs">{draft.verification_notes}</p>}</div>}
    </Card>)}</div>}
  </AppShell>;
}
function Info({ label, value }: { label: string; value?: string }) { return <div><p className="text-xs uppercase text-muted-foreground">{label}</p><p className="font-mono font-semibold">{value || "—"}</p></div>; }
function Qty({ value, uom }: { value: number; uom?: string }) { return <td className="px-4 py-3 font-semibold">{value.toLocaleString()} {uom}</td>; }
