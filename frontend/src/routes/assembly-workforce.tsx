import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Loader2, Pencil, Plus, RefreshCw, UserRoundCog, Users } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/wms/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api-client";
import { requireRole } from "@/lib/auth-utils";

export const Route = createFileRoute("/assembly-workforce")({
  beforeLoad: () => requireRole(["ASSEMBLY_MANAGER", "ADMIN"]),
  head: () => ({ meta: [{ title: "Assembly Workforce · NexusWMS" }] }),
  component: AssemblyWorkforce,
});

const emptyForm = { name: "", team_leader: "", workers: "", shift: "", workstation: "", active: true };

function AssemblyWorkforce() {
  const [teams, setTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any>();
  const [form, setForm] = useState<any>(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try { setTeams(await api.getAssemblyTeams()); }
    catch (error) { toast.error("Unable to load assembly teams", { description: error instanceof Error ? error.message : undefined }); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  function open(team?: any) {
    setEditing(team || { id: undefined });
    setForm(team ? { ...team, workers: team.workers.join(", ") } : emptyForm);
  }

  async function save() {
    setSaving(true);
    const payload = { ...form, workers: form.workers.split(",").map((name: string) => name.trim()).filter(Boolean) };
    try {
      if (editing.id) await api.updateAssemblyTeam(editing.id, payload); else await api.createAssemblyTeam(payload);
      toast.success(editing.id ? "Assembly team updated" : "Assembly team created");
      setEditing(undefined); await load();
    } catch (error) { toast.error("Unable to save assembly team", { description: error instanceof Error ? error.message : undefined }); }
    finally { setSaving(false); }
  }

  return <AppShell title="Assembly Teams & Workforce" subtitle="Manage workers, leaders, shifts, workstations and current assembly workload"
    actions={<><Button variant="outline" onClick={() => void load()}><RefreshCw className="size-4" /> Refresh</Button><Button onClick={() => open()}><Plus className="size-4" /> New team</Button></>}>
    {loading ? <div className="grid h-64 place-items-center"><Loader2 className="size-8 animate-spin text-primary" /></div>
      : teams.length === 0 ? <Card className="grid h-64 place-items-center text-center text-muted-foreground"><div><Users className="mx-auto mb-2 size-10 opacity-40" /><p>No assembly teams configured.</p><Button className="mt-4" onClick={() => open()}>Create first team</Button></div></Card>
      : <div className="grid gap-4 xl:grid-cols-2">{teams.map((team) => <Card key={team.id} className="gap-4 rounded-2xl p-5 shadow-soft">
        <div className="flex items-start justify-between"><div><h2 className="text-xl font-bold">{team.name}</h2><p className="mt-1 text-sm text-muted-foreground"><UserRoundCog className="mr-1 inline size-4" />Leader: {team.team_leader}</p></div><Badge className={team.active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}>{team.active ? "ACTIVE" : "INACTIVE"}</Badge></div>
        <div className="grid grid-cols-2 gap-3 rounded-xl border bg-muted/20 p-4 sm:grid-cols-4">
          <Stat label="Workers" value={String(team.workers_count)} /><Stat label="Shift" value={team.shift} />
          <Stat label="Workstation" value={team.workstation} /><Stat label="Workload" value={`${team.current_workload} orders`} />
        </div>
        <div><p className="mb-2 text-xs font-bold uppercase text-muted-foreground">Workers</p><div className="flex flex-wrap gap-2">{team.workers.map((worker: string) => <Badge key={worker} variant="outline">{worker}</Badge>)}</div></div>
        <div><p className="mb-2 text-xs font-bold uppercase text-muted-foreground">Assigned orders · Target {team.target_units} units</p>
          {team.assigned_orders.length ? <div className="space-y-2">{team.assigned_orders.map((order: any) => <div key={order.id} className="flex items-center justify-between rounded-lg border p-3 text-sm"><div><b className="font-mono text-primary">{order.order_number}</b><p>{order.product_name}</p></div><div className="text-right"><b>{order.target_quantity} units</b><p className="text-xs text-muted-foreground">{order.status.replaceAll("_", " ")}</p></div></div>)}</div> : <p className="text-sm text-muted-foreground">No active work orders.</p>}
        </div>
        <Button variant="outline" onClick={() => open(team)}><Pencil className="size-4" /> Edit workforce</Button>
      </Card>)}</div>}

    <Dialog open={Boolean(editing)} onOpenChange={(value) => !value && setEditing(undefined)}><DialogContent className="max-w-xl">
      <DialogHeader><DialogTitle>{editing?.id ? "Edit assembly team" : "Create assembly team"}</DialogTitle><DialogDescription>Workers can be entered as a comma-separated list.</DialogDescription></DialogHeader>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Team name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Assembly Team A" /></Field>
        <Field label="Team leader"><Input value={form.team_leader} onChange={(e) => setForm({ ...form, team_leader: e.target.value })} /></Field>
        <Field label="Shift"><Input value={form.shift} onChange={(e) => setForm({ ...form, shift: e.target.value })} placeholder="Morning" /></Field>
        <Field label="Workstation"><Input value={form.workstation} onChange={(e) => setForm({ ...form, workstation: e.target.value })} placeholder="WS-03" /></Field>
        <div className="space-y-2 sm:col-span-2"><Label>Workers</Label><Input value={form.workers} onChange={(e) => setForm({ ...form, workers: e.target.value })} placeholder="Worker 1, Worker 2, Worker 3" /></div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> Active team</label>
      </div>
      <Button disabled={saving || !form.name.trim() || !form.team_leader.trim() || !form.shift.trim() || !form.workstation.trim()} onClick={() => void save()}>{saving && <Loader2 className="size-4 animate-spin" />} Save team</Button>
    </DialogContent></Dialog>
  </AppShell>;
}

function Stat({ label, value }: { label: string; value: string }) { return <div><p className="text-[10px] font-bold uppercase text-muted-foreground">{label}</p><p className="mt-1 font-semibold">{value}</p></div>; }
function Field({ label, children }: { label: string; children: ReactNode }) { return <div className="space-y-2"><Label>{label}</Label>{children}</div>; }
