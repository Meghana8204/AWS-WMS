import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Ban, Building2, FileText, Loader2, Mail, MapPin, Pencil, Phone, ReceiptText, Save, ShieldCheck, X } from "lucide-react";
import { AppShell, StatusBadge } from "@/components/wms/app-shell";
import { Field, SectionCard } from "@/components/wms/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api-client";
import { toast } from "sonner";

export const Route = createFileRoute("/supplier/$supplierId")({
  component: SupplierProfile,
});

function SupplierProfile() {
  const { supplierId } = Route.useParams();
  const [supplier, setSupplier] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const [form, setForm] = useState<any>(null);

  useEffect(() => {
    api.getSupplier(supplierId).then(setSupplier).catch((err) => setError(err instanceof Error ? err.message : "Unable to load supplier profile."));
  }, [supplierId]);

  const title = supplier?.supplierName || "Supplier profile";
  const openEditor = () => {
    setForm(JSON.parse(JSON.stringify(supplier)));
    setEditing(true);
  };
  const updateForm = (section: string, field: string, value: string) => {
    setForm((current: any) => section === "root" ? { ...current, [field]: value } : { ...current, [section]: { ...current[section], [field]: value } });
  };
  const saveChanges = async () => {
    setSaving(true);
    try {
      const updated = await api.updateSupplier(supplierId, form);
      setSupplier(updated);
      setEditing(false);
      toast.success("Supplier profile updated");
    } catch (err) {
      toast.error("Unable to update supplier", { description: err instanceof Error ? err.message : undefined });
    } finally { setSaving(false); }
  };
  const blockSupplier = async () => {
    if (!window.confirm(`Block ${supplier.supplierName}? It will no longer be available for operational use.`)) return;
    setBlocking(true);
    try {
      setSupplier(await api.blockSupplier(supplierId));
      toast.success("Supplier blocked");
    } catch (err) {
      toast.error("Unable to block supplier", { description: err instanceof Error ? err.message : undefined });
    } finally { setBlocking(false); }
  };
  const unblockSupplier = async () => {
    setBlocking(true);
    try {
      setSupplier(await api.unblockSupplier(supplierId));
      toast.success("Supplier unblocked and active");
    } catch (err) {
      toast.error("Unable to unblock supplier", { description: err instanceof Error ? err.message : undefined });
    } finally { setBlocking(false); }
  };

  return (
    <AppShell
      title={title}
      subtitle={supplier ? `${supplier.registeredCompanyName || "Supplier master record"} · ${supplier.supplierId}` : "Loading supplier master record"}
      actions={supplier && <><Button variant="outline" className="rounded-xl" onClick={openEditor}><Pencil /> Edit</Button>{supplier.status === "Blocked" ? <Button className="rounded-xl bg-success hover:bg-success/90" disabled={blocking} onClick={unblockSupplier}><ShieldCheck /> {blocking ? "Unblocking…" : "Unblock"}</Button> : <Button variant="destructive" className="rounded-xl" disabled={blocking} onClick={blockSupplier}><Ban /> {blocking ? "Blocking…" : "Block"}</Button>}</>}
    >
      <Button variant="ghost" className="mb-4 rounded-xl" asChild><Link to="/master-data"><ArrowLeft /> Back to master data</Link></Button>
      {!supplier && !error && <div className="flex h-64 items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-5 animate-spin text-primary" /> Loading supplier profile…</div>}
      {error && <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6"><p className="font-medium text-destructive">Supplier profile could not be loaded.</p><p className="mt-1 text-sm text-muted-foreground">{error}</p></div>}
      {supplier && (
        <div className="space-y-4">
          {editing && form && <SectionCard title="Edit supplier" description="Changes are saved immediately to the supplier master" icon={Pencil} actions={<><Button variant="ghost" size="sm" onClick={() => setEditing(false)} disabled={saving}><X /> Cancel</Button><Button size="sm" onClick={saveChanges} disabled={saving}><Save /> {saving ? "Saving…" : "Save changes"}</Button></>}>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <EditField label="Supplier name" value={form.supplierName} onChange={(value) => updateForm("root", "supplierName", value)} />
              <EditField label="Registered company" value={form.registeredCompanyName} onChange={(value) => updateForm("root", "registeredCompanyName", value)} />
              <EditField label="Vendor type" value={form.vendorType} onChange={(value) => updateForm("root", "vendorType", value)} />
              <EditField label="Category" value={form.category} onChange={(value) => updateForm("root", "category", value)} />
              <EditField label="Industry" value={form.industry} onChange={(value) => updateForm("root", "industry", value)} />
              <EditField label="GSTIN" value={form.gstin} onChange={(value) => updateForm("root", "gstin", value)} />
              {form.address && <><EditField label="Address" value={form.address.registeredAddress} onChange={(value) => updateForm("address", "registeredAddress", value)} /><EditField label="City" value={form.address.city} onChange={(value) => updateForm("address", "city", value)} /><EditField label="State" value={form.address.state} onChange={(value) => updateForm("address", "state", value)} /><EditField label="Country" value={form.address.country} onChange={(value) => updateForm("address", "country", value)} /><EditField label="Pincode" value={form.address.pincode} onChange={(value) => updateForm("address", "pincode", value)} /></>}
              {form.contact && <><EditField label="Primary contact" value={form.contact.primaryContactName} onChange={(value) => updateForm("contact", "primaryContactName", value)} /><EditField label="Email" value={form.contact.email} onChange={(value) => updateForm("contact", "email", value)} /><EditField label="Phone" value={form.contact.phone} onChange={(value) => updateForm("contact", "phone", value)} /></>}
              {form.bankInfo && <><EditField label="Bank" value={form.bankInfo.bankName} onChange={(value) => updateForm("bankInfo", "bankName", value)} /><EditField label="Account number" value={form.bankInfo.accountNumber} onChange={(value) => updateForm("bankInfo", "accountNumber", value)} /><EditField label="IFSC" value={form.bankInfo.ifsc} onChange={(value) => updateForm("bankInfo", "ifsc", value)} /></>}
            </div>
            <div className="mt-4"><Label htmlFor="remarks">Remarks</Label><Textarea id="remarks" value={form.remarks || ""} onChange={(event) => updateForm("root", "remarks", event.target.value)} className="mt-2" /></div>
          </SectionCard>}
          <SectionCard title="Supplier overview" description="Core vendor record" icon={Building2} actions={<StatusBadge status={supplier.status || "Active"} />}>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Supplier name" value={supplier.supplierName} />
              <Field label="Vendor type" value={supplier.vendorType || "—"} />
              <Field label="Category" value={supplier.category || "—"} />
              <Field label="GSTIN" value={supplier.gstin || "—"} mono />
            </div>
          </SectionCard>

          <div className="grid gap-4 xl:grid-cols-2">
            <SectionCard title="Address" description="Registered business location" icon={MapPin}>
              {supplier.address ? <div className="grid gap-5 sm:grid-cols-2"><Field label="Registered address" value={supplier.address.registeredAddress || "—"} /><Field label="City / State" value={[supplier.address.city, supplier.address.state].filter(Boolean).join(", ") || "—"} /><Field label="Country" value={supplier.address.country || "—"} /><Field label="Pincode" value={supplier.address.pincode || "—"} /></div> : <EmptySection text="No address has been recorded." />}
            </SectionCard>
            <SectionCard title="Primary contact" description="Supplier contact details" icon={Phone}>
              {supplier.contact ? <div className="grid gap-5 sm:grid-cols-2"><Field label="Contact" value={supplier.contact.primaryContactName || "—"} /><Field label="Phone" value={supplier.contact.phone || "—"} /><Field label="Email" value={supplier.contact.email || "—"} /></div> : <EmptySection text="No contact has been recorded." />}
            </SectionCard>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <SectionCard title="Tax & banking" description="Payment and compliance details" icon={ReceiptText}>
              {supplier.bankInfo ? <div className="grid gap-5 sm:grid-cols-2"><Field label="Bank" value={supplier.bankInfo.bankName || "—"} /><Field label="Account holder" value={supplier.bankInfo.accountHolderName || "—"} /><Field label="IFSC" value={supplier.bankInfo.ifsc || "—"} mono /><Field label="Branch" value={supplier.bankInfo.branch || "—"} /></div> : <EmptySection text="No banking details have been recorded." />}
            </SectionCard>
            <SectionCard title="Documents" description="Compliance documents attached to this supplier" icon={FileText}>
              {supplier.documents?.length ? <div className="space-y-3">{supplier.documents.map((document: any) => <div key={document.uploadId} className="flex items-center justify-between rounded-xl border border-border/70 p-3"><div><p className="text-sm font-medium">{document.fileName}</p><p className="text-xs text-muted-foreground">{document.documentType}</p></div><span className="text-xs text-muted-foreground">{Math.ceil((document.fileSize || 0) / 1024)} KB</span></div>)}</div> : <EmptySection text="No documents have been attached." />}
            </SectionCard>
          </div>
          {supplier.remarks && <SectionCard title="Remarks" icon={Mail}><p className="text-sm text-muted-foreground">{supplier.remarks}</p></SectionCard>}
        </div>
      )}
    </AppShell>
  );
}

function EmptySection({ text }: { text: string }) {
  return <p className="py-4 text-sm text-muted-foreground">{text}</p>;
}

function EditField({ label, value, onChange }: { label: string; value?: string; onChange: (value: string) => void }) {
  return <div className="space-y-1.5"><Label>{label}</Label><Input value={value || ""} onChange={(event) => onChange(event.target.value)} /></div>;
}
