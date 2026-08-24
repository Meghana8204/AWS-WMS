import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Ban,
  Building2,
  FileText,
  Loader2,
  Mail,
  MapPin,
  Pencil,
  Phone,
  ReceiptText,
  Save,
  ShieldCheck,
  X,
  AlertCircle,
  ChevronRight,
} from "lucide-react";
import { AppShell, StatusBadge } from "@/components/wms/app-shell";
import { Field, SectionCard } from "@/components/wms/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { api } from "@/lib/api-client";
import { toast } from "sonner";
import { INDIAN_STATES, TDS_SECTIONS } from "@/lib/constants";
import { cn } from "@/lib/utils";
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
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);
  const [form, setForm] = useState<any>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [categories, setCategories] = useState<string[]>([
    "Raw Materials",
    "Packaging",
    "Finished Goods",
    "Consumables",
  ]);
  useEffect(() => {
    api
      .getSupplier(supplierId)
      .then(setSupplier)
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Unable to load supplier profile."),
      );
    api
      .getSupplierCategories()
      .then((cats) => {
        if (cats.length > 0) setCategories(cats.map((c: any) => c.name));
      })
      .catch((err) => console.warn("Failed to fetch categories", err));
  }, [supplierId]);
  const title = supplier?.supplierName || "Supplier profile";
  const openEditor = () => {
    setForm(JSON.parse(JSON.stringify(supplier)));
    setEditing(true);
  };
  const updateForm = (section: string, field: string, value: any) => {
    setForm((current: any) =>
      section === "root"
        ? { ...current, [field]: value }
        : { ...current, [section]: { ...current[section], [field]: value } },
    );
    const errorKey = section === "root" ? field : `${section}.${field}`;
    if (errors[errorKey]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[errorKey];
        return next;
      });
    }
  };
  const validate = () => {
    const newErrors: Record<string, string> = {};
    const name = (form.supplierName || "").trim();
    const regName = (form.registeredCompanyName || "").trim();
    const industry = (form.industry || "").trim();
    const gstin = (form.gstin || "").trim();
    const mainMaterials = form.mainMaterials || [];
    if (!name) newErrors.supplierName = "Supplier name is required";
    else if (name.length < 2 || name.length > 100)
      newErrors.supplierName = "Must be between 2 and 100 characters";
    if (!regName) newErrors.registeredCompanyName = "Registered company name is required";
    else if (regName.length < 2 || regName.length > 200)
      newErrors.registeredCompanyName = "Must be between 2 and 200 characters";
    if (!form.vendorType) newErrors.vendorType = "Vendor type is required";
    if (!form.category || form.category.length === 0)
      newErrors.category = "At least one category is required";
    if (mainMaterials.length === 0) newErrors.mainMaterials = "Select at least one material";
    if (!industry) newErrors.industry = "Industry is required";
    else if (industry.length < 2 || industry.length > 100)
      newErrors.industry = "Must be between 2 and 100 characters";
    if (!gstin) newErrors.gstin = "GSTIN is required";
    else if (gstin.length !== 15) newErrors.gstin = "Exactly 15 characters";
    else if (
      !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(gstin.toUpperCase())
    ) {
      newErrors.gstin = "Invalid format (e.g. 29ABCDE1234F1Z5)";
    }
    if (form.address) {
      const addr = (form.address.registeredAddress || "").trim();
      const city = (form.address.city || "").trim();
      const pincode = (form.address.pincode || "").trim();
      const state = (form.address.state || "").trim();
      if (!addr) newErrors["address.registeredAddress"] = "Address is required";
      else if (addr.length < 10 || addr.length > 300)
        newErrors["address.registeredAddress"] = "Must be between 10 and 300 characters";
      if (!city) newErrors["address.city"] = "City is required";
      else if (city.length < 2 || city.length > 100)
        newErrors["address.city"] = "Must be between 2 and 100 characters";
      else if (!/^[a-zA-Z\s-]+$/.test(city))
        newErrors["address.city"] = "Letters/spaces/hyphen only";
      if (state && (state.length < 2 || state.length > 100))
        newErrors["address.state"] = "Must be 2-100 characters";
      if (!pincode) newErrors["address.pincode"] = "Pincode is required";
      else if (!/^\d{6}$/.test(pincode)) newErrors["address.pincode"] = "Must be exactly 6 digits";
    }
    if (form.contact) {
      const contactName = (form.contact.primaryContactName || "").trim();
      const phone = (form.contact.phone || "").trim();
      const primaryEmail = (form.contact.primaryEmail || "").trim();
      const secondaryEmail = (form.contact.secondaryEmail || "").trim();
      const website = (form.contact.website || "").trim();
      const designation = (form.contact.designation || "").trim();
      if (!contactName) newErrors["contact.primaryContactName"] = "Name is required";
      else if (contactName.length < 2 || contactName.length > 100)
        newErrors["contact.primaryContactName"] = "Must be 2-100 characters";
      else if (!/^[a-zA-Z\s]+$/.test(contactName))
        newErrors["contact.primaryContactName"] = "Letters and spaces only";
      if (!phone) newErrors["contact.phone"] = "Phone is required";
      else if (!/^[6-9]\d{9}$/.test(phone))
        newErrors["contact.phone"] = "Must be 10-digit mobile number";
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!primaryEmail) newErrors["contact.primaryEmail"] = "Email is required";
      else if (!emailRegex.test(primaryEmail)) newErrors["contact.primaryEmail"] = "Invalid email";
      if (secondaryEmail && !emailRegex.test(secondaryEmail))
        newErrors["contact.secondaryEmail"] = "Invalid email";
      if (designation && (designation.length < 2 || designation.length > 100))
        newErrors["contact.designation"] = "Must be 2-100 characters";
      if (website) {
        try {
          new URL(website.startsWith("http") ? website : `https://${website}`);
        } catch (_) {
          newErrors["contact.website"] = "Invalid URL";
        }
      }
    }
    if (form.bankInfo) {
      const bankName = (form.bankInfo.bankName || "").trim();
      const accNo = (form.bankInfo.accountNumber || "").trim();
      const ifsc = (form.bankInfo.ifsc || "").trim();
      const holder = (form.bankInfo.accountHolderName || "").trim();
      const branch = (form.bankInfo.branch || "").trim();
      const swift = (form.bankInfo.swiftBic || "").trim();
      if (!bankName) newErrors["bankInfo.bankName"] = "Bank name is required";
      if (!accNo) newErrors["bankInfo.accountNumber"] = "Account number is required";
      else if (accNo.length < 9 || accNo.length > 18)
        newErrors["bankInfo.accountNumber"] = "9-18 digits required";
      else if (!/^\d+$/.test(accNo)) newErrors["bankInfo.accountNumber"] = "Digits only";
      if (!ifsc) newErrors["bankInfo.ifsc"] = "IFSC code is required";
      else if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc.toUpperCase())) {
        newErrors["bankInfo.ifsc"] = "Invalid format (e.g. SBIN0012345)";
      }
      if (!holder) newErrors["bankInfo.accountHolderName"] = "Holder name is required";
      if (!branch) newErrors["bankInfo.branch"] = "Branch is required";
      if (swift && !/^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(swift.toUpperCase())) {
        newErrors["bankInfo.swiftBic"] = "Invalid format";
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  const saveChanges = async () => {
    if (!validate()) {
      return;
    }
    const name = (form.supplierName || "").trim();
    const regName = (form.registeredCompanyName || "").trim();
    const industry = (form.industry || "").trim();
    const gstin = (form.gstin || "").trim();
    setSaving(true);
    try {
      const finalForm = {
        ...form,
        supplierName: name,
        registeredCompanyName: regName,
        industry: industry,
        gstin: gstin.toUpperCase(),
      };
      const updated = await api.updateSupplier(supplierId, finalForm);
      setSupplier(updated);
      setEditing(false);
      toast.success("Supplier profile updated");
    } catch (err) {
      toast.error("Unable to update supplier", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  };
  const blockSupplier = async () => {
    const previousSupplier = supplier;
    setSupplier((prev: any) => ({ ...prev, status: "Blocked" }));
    setBlocking(true);
    try {
      const updated = await api.blockSupplier(supplierId);
      setSupplier(updated);
      toast.success("Supplier blocked");
    } catch (err) {
      setSupplier(previousSupplier);
      toast.error("Unable to block supplier", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setBlocking(false);
      setShowBlockConfirm(false);
    }
  };
  const unblockSupplier = async () => {
    const previousSupplier = supplier;
    setSupplier((prev: any) => ({ ...prev, status: "Active" }));
    setBlocking(true);
    try {
      const updated = await api.unblockSupplier(supplierId);
      setSupplier(updated);
      toast.success("Supplier unblocked and active");
    } catch (err) {
      setSupplier(previousSupplier);
      toast.error("Unable to unblock supplier", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setBlocking(false);
    }
  };
  return (
    <AppShell
      title={title}
      subtitle={
        supplier
          ? `${supplier.registeredCompanyName || "Supplier master record"} · ${supplier.supplierId}`
          : "Loading supplier master record"
      }
      actions={
        supplier && (
          <>
            <Button variant="outline" className="rounded-xl" onClick={openEditor}>
              <Pencil /> Edit
            </Button>
            {supplier.status === "Blocked" ? (
              <Button
                className="rounded-xl bg-success hover:bg-success/90"
                disabled={blocking}
                onClick={unblockSupplier}
              >
                <ShieldCheck /> {blocking ? "Unblocking…" : "Unblock"}
              </Button>
            ) : (
              <Button
                variant="destructive"
                className="rounded-xl"
                disabled={blocking}
                onClick={() => setShowBlockConfirm(true)}
              >
                <Ban /> {blocking ? "Blocking…" : "Block"}
              </Button>
            )}
          </>
        )
      }
    >
      <AlertDialog open={showBlockConfirm} onOpenChange={setShowBlockConfirm}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Block supplier?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to block <strong>{supplier?.supplierName}</strong>? This action
              will prevent the supplier from being used in any active operational processes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={blockSupplier}
              className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Confirm block
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Button variant="ghost" className="mb-4 rounded-xl" asChild>
        <Link to="/master-data">
          <ArrowLeft /> Back to master data
        </Link>
      </Button>
      {!supplier && !error && (
        <div className="flex h-64 items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-5 animate-spin text-primary" /> Loading supplier profile…
        </div>
      )}
      {error && (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6">
          <p className="font-medium text-destructive">Supplier profile could not be loaded.</p>
          <p className="mt-1 text-sm text-muted-foreground">{error}</p>
        </div>
      )}
      {supplier && (
        <div className="space-y-4">
          {editing && form && (
            <SectionCard
              title="Edit supplier"
              description="Changes are saved immediately to the supplier master"
              icon={Pencil}
              actions={
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditing(false)}
                    disabled={saving}
                  >
                    <X /> Cancel
                  </Button>
                  <Button size="sm" onClick={saveChanges} disabled={saving}>
                    <Save /> {saving ? "Saving…" : "Save changes"}
                  </Button>
                </>
              }
            >
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <ValidatedEditField
                  label="Supplier name"
                  value={form.supplierName}
                  error={errors.supplierName}
                  onChange={(value) => {
                    const sanitized = value.replace(/[^a-zA-Z\s]/g, "");
                    updateForm("root", "supplierName", sanitized);
                  }}
                />
                <ValidatedEditField
                  label="Registered company"
                  value={form.registeredCompanyName}
                  error={errors.registeredCompanyName}
                  onChange={(value) => {
                    const sanitized = value.replace(/[^a-zA-Z\s]/g, "");
                    updateForm("root", "registeredCompanyName", sanitized);
                  }}
                />
                <div className="space-y-1.5">
                  <Label>Vendor type</Label>
                  <Select
                    onValueChange={(v) => updateForm("root", "vendorType", v)}
                    value={form.vendorType}
                  >
                    <SelectTrigger
                      className={cn(
                        errors.vendorType && "border-destructive focus:ring-destructive",
                      )}
                    >
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {["Manufacturer", "Distributor", "Service Provider"].map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.vendorType && (
                    <p className="text-[11px] font-medium text-destructive flex items-center gap-1">
                      <AlertCircle className="size-3" /> {errors.vendorType}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label>Category</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        className={cn(
                          "w-full justify-between rounded-xl h-10 px-3 font-normal",
                          errors.category && "border-destructive",
                        )}
                      >
                        <span className="truncate">
                          {Array.isArray(form.category) && form.category.length > 0
                            ? form.category.join(", ")
                            : "Select categories"}
                        </span>
                        <ChevronRight className="ml-2 h-4 w-4 shrink-0 opacity-50 rotate-90" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[300px] p-0 rounded-xl" align="start">
                      <div className="p-2 space-y-1 max-h-[300px] overflow-y-auto">
                        {categories.map((cat) => (
                          <div
                            key={cat}
                            className="flex items-center space-x-2 p-2 hover:bg-muted rounded-lg cursor-pointer"
                            onClick={() => {
                              const current = Array.isArray(form.category) ? form.category : [];
                              const updated = current.includes(cat)
                                ? current.filter((c: string) => c !== cat)
                                : [...current, cat];
                              updateForm("root", "category", updated);
                            }}
                          >
                            <Checkbox
                              id={`edit-cat-${cat}`}
                              checked={Array.isArray(form.category) && form.category.includes(cat)}
                              onCheckedChange={() => {
                                const current = Array.isArray(form.category) ? form.category : [];
                                const updated = current.includes(cat)
                                  ? current.filter((c: string) => c !== cat)
                                  : [...current, cat];
                                updateForm("root", "category", updated);
                              }}
                            />
                            <Label
                              htmlFor={`edit-cat-${cat}`}
                              className="text-sm cursor-pointer w-full"
                            >
                              {cat}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                  {errors.category && (
                    <p className="text-[11px] font-medium text-destructive flex items-center gap-1">
                      <AlertCircle className="size-3" /> {errors.category}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label>Main materials</Label>
                  <Input
                    value={
                      Array.isArray(form.mainMaterials)
                        ? form.mainMaterials.join(", ")
                        : form.mainMaterial || ""
                    }
                    onChange={(event) =>
                      updateForm(
                        "root",
                        "mainMaterials",
                        event.target.value
                          .split(",")
                          .map((s) => s.trim())
                          .filter(Boolean),
                      )
                    }
                    placeholder="Comma separated list"
                    className={cn(
                      errors.mainMaterials && "border-destructive focus-visible:ring-destructive",
                    )}
                  />
                  {errors.mainMaterials && (
                    <p className="text-[11px] font-medium text-destructive flex items-center gap-1">
                      <AlertCircle className="size-3" /> {errors.mainMaterials}
                    </p>
                  )}
                </div>
                <ValidatedEditField
                  label="Industry"
                  value={form.industry}
                  error={errors.industry}
                  onChange={(value) => updateForm("root", "industry", value)}
                />
                <ValidatedEditField
                  label="GSTIN"
                  value={form.gstin}
                  error={errors.gstin}
                  maxLength={15}
                  onChange={(value) => updateForm("root", "gstin", value.substring(0, 15))}
                />
                {form.address && (
                  <>
                    <ValidatedEditField
                      label="Address"
                      value={form.address.registeredAddress}
                      error={errors["address.registeredAddress"]}
                      onChange={(value) => updateForm("address", "registeredAddress", value)}
                    />
                    <ValidatedEditField
                      label="City"
                      value={form.address.city}
                      error={errors["address.city"]}
                      onChange={(value) => updateForm("address", "city", value)}
                    />
                    <div className="space-y-1.5">
                      <Label>State</Label>
                      <Select
                        onValueChange={(v) => updateForm("address", "state", v)}
                        value={form.address.state}
                      >
                        <SelectTrigger
                          className={cn(
                            errors["address.state"] && "border-destructive focus:ring-destructive",
                          )}
                        >
                          <SelectValue placeholder="Select state" />
                        </SelectTrigger>
                        <SelectContent>
                          {INDIAN_STATES.map((state) => (
                            <SelectItem key={state} value={state}>
                              {state}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {errors["address.state"] && (
                        <p className="text-[11px] font-medium text-destructive flex items-center gap-1">
                          <AlertCircle className="size-3" /> {errors["address.state"]}
                        </p>
                      )}
                    </div>
                    <EditField
                      label="Country"
                      value={form.address.country}
                      onChange={(value) => updateForm("address", "country", value)}
                    />
                    <ValidatedEditField
                      label="Pincode"
                      value={form.address.pincode}
                      error={errors["address.pincode"]}
                      maxLength={6}
                      onChange={(value) => {
                        const sanitized = value.replace(/\D/g, "").substring(0, 6);
                        updateForm("address", "pincode", sanitized);
                      }}
                    />
                  </>
                )}
                {form.contact && (
                  <>
                    <ValidatedEditField
                      label="Primary contact"
                      value={form.contact.primaryContactName}
                      error={errors["contact.primaryContactName"]}
                      onChange={(value) => updateForm("contact", "primaryContactName", value)}
                    />
                    <ValidatedEditField
                      label="Primary Email"
                      value={form.contact.primaryEmail}
                      error={errors["contact.primaryEmail"]}
                      maxLength={128}
                      onChange={(value) => {
                        const sanitized = value.replace(/\s/g, "").substring(0, 128);
                        updateForm("contact", "primaryEmail", sanitized);
                        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                        if (sanitized && !emailRegex.test(sanitized)) {
                          setErrors((prev) => ({
                            ...prev,
                            ["contact.primaryEmail"]: "Invalid email format",
                          }));
                        } else {
                          setErrors((prev) => {
                            const next = { ...prev };
                            delete next["contact.primaryEmail"];
                            return next;
                          });
                        }
                      }}
                    />
                    <ValidatedEditField
                      label="Secondary Email"
                      value={form.contact.secondaryEmail}
                      error={errors["contact.secondaryEmail"]}
                      maxLength={128}
                      onChange={(value) => {
                        const sanitized = value.replace(/\s/g, "").substring(0, 128);
                        updateForm("contact", "secondaryEmail", sanitized);
                        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                        if (sanitized && !emailRegex.test(sanitized)) {
                          setErrors((prev) => ({
                            ...prev,
                            ["contact.secondaryEmail"]: "Invalid email format",
                          }));
                        } else {
                          setErrors((prev) => {
                            const next = { ...prev };
                            delete next["contact.secondaryEmail"];
                            return next;
                          });
                        }
                      }}
                    />
                    <ValidatedEditField
                      label="Phone"
                      value={form.contact.phone}
                      error={errors["contact.phone"]}
                      maxLength={10}
                      onChange={(value) => {
                        const sanitized = value.replace(/\D/g, "").substring(0, 10);
                        updateForm("contact", "phone", sanitized);
                      }}
                    />
                  </>
                )}
                {form.bankInfo && (
                  <>
                    <ValidatedEditField
                      label="Bank Name"
                      value={form.bankInfo.bankName}
                      error={errors["bankInfo.bankName"]}
                      onChange={(value) => updateForm("bankInfo", "bankName", value)}
                    />
                    <ValidatedEditField
                      label="Account Number"
                      value={form.bankInfo.accountNumber}
                      error={errors["bankInfo.accountNumber"]}
                      maxLength={18}
                      onChange={(value) =>
                        updateForm(
                          "bankInfo",
                          "accountNumber",
                          value.replace(/\D/g, "").substring(0, 18),
                        )
                      }
                    />
                    <ValidatedEditField
                      label="IFSC Code"
                      value={form.bankInfo.ifsc}
                      error={errors["bankInfo.ifsc"]}
                      maxLength={11}
                      onChange={(value) =>
                        updateForm(
                          "bankInfo",
                          "ifsc",
                          value
                            .replace(/[^a-zA-Z0-9]/g, "")
                            .substring(0, 11)
                            .toUpperCase(),
                        )
                      }
                    />
                    <ValidatedEditField
                      label="Account Holder"
                      value={form.bankInfo.accountHolderName}
                      error={errors["bankInfo.accountHolderName"]}
                      onChange={(value) => updateForm("bankInfo", "accountHolderName", value)}
                    />
                    <ValidatedEditField
                      label="Branch"
                      value={form.bankInfo.branch}
                      error={errors["bankInfo.branch"]}
                      onChange={(value) => updateForm("bankInfo", "branch", value)}
                    />
                    <ValidatedEditField
                      label="SWIFT / BIC"
                      value={form.bankInfo.swiftBic}
                      error={errors["bankInfo.swiftBic"]}
                      maxLength={11}
                      onChange={(value) =>
                        updateForm(
                          "bankInfo",
                          "swiftBic",
                          value
                            .replace(/[^a-zA-Z0-9]/g, "")
                            .substring(0, 11)
                            .toUpperCase(),
                        )
                      }
                    />
                    <div className="space-y-1.5">
                      <Label>TDS Section</Label>
                      <Select
                        onValueChange={(v) => updateForm("bankInfo", "tdsSection", v)}
                        value={form.bankInfo.tdsSection}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select TDS section" />
                        </SelectTrigger>
                        <SelectContent>
                          {TDS_SECTIONS.map((section) => (
                            <SelectItem key={section} value={section}>
                              {section}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}
              </div>
              <div className="mt-4">
                <Label htmlFor="remarks">Remarks</Label>
                <Textarea
                  id="remarks"
                  value={form.remarks || ""}
                  onChange={(event) => updateForm("root", "remarks", event.target.value)}
                  className="mt-2"
                />
              </div>
            </SectionCard>
          )}
          <SectionCard
            title="Supplier overview"
            description="Core vendor record"
            icon={Building2}
            actions={<StatusBadge status={supplier.status || "Active"} />}
          >
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Supplier name" value={supplier.supplierName} />
              <Field label="Vendor type" value={supplier.vendorType || "—"} />
              <Field
                label="Category"
                value={
                  Array.isArray(supplier.category)
                    ? supplier.category.join(", ")
                    : supplier.category || "—"
                }
              />
              <Field
                label="Main materials"
                value={
                  Array.isArray(supplier.mainMaterials)
                    ? supplier.mainMaterials.join(", ")
                    : supplier.mainMaterial || "—"
                }
              />
              <Field label="GSTIN" value={supplier.gstin || "—"} mono />
            </div>
          </SectionCard>

          <div className="grid gap-4 xl:grid-cols-2">
            <SectionCard title="Address" description="Registered business location" icon={MapPin}>
              {supplier.address ? (
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field
                    label="Registered address"
                    value={supplier.address.registeredAddress || "—"}
                  />
                  <Field
                    label="City / State"
                    value={
                      [supplier.address.city, supplier.address.state].filter(Boolean).join(", ") ||
                      "—"
                    }
                  />
                  <Field label="Country" value={supplier.address.country || "—"} />
                  <Field label="Pincode" value={supplier.address.pincode || "—"} />
                </div>
              ) : (
                <EmptySection text="No address has been recorded." />
              )}
            </SectionCard>
            <SectionCard
              title="Primary contact"
              description="Supplier contact details"
              icon={Phone}
            >
              {supplier.contact ? (
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field label="Contact" value={supplier.contact.primaryContactName || "—"} />
                  <Field label="Phone" value={supplier.contact.phone || "—"} />
                  <Field label="Primary Email" value={supplier.contact.primaryEmail || "—"} />
                  <Field label="Secondary Email" value={supplier.contact.secondaryEmail || "—"} />
                </div>
              ) : (
                <EmptySection text="No contact has been recorded." />
              )}
            </SectionCard>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <SectionCard
              title="Tax & banking"
              description="Payment and compliance details"
              icon={ReceiptText}
            >
              {supplier.bankInfo ? (
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field label="Bank" value={supplier.bankInfo.bankName || "—"} />
                  <Field
                    label="Account number"
                    value={supplier.bankInfo.accountNumber || "—"}
                    mono
                  />
                  <Field label="IFSC" value={supplier.bankInfo.ifsc || "—"} mono />
                  <Field
                    label="Account holder"
                    value={supplier.bankInfo.accountHolderName || "—"}
                  />
                  <Field label="Branch" value={supplier.bankInfo.branch || "—"} />
                  <Field label="SWIFT / BIC" value={supplier.bankInfo.swiftBic || "—"} mono />
                  <Field label="TDS Section" value={supplier.bankInfo.tdsSection || "—"} />
                </div>
              ) : (
                <EmptySection text="No banking details have been recorded." />
              )}
            </SectionCard>
            <SectionCard
              title="Audit Trail"
              description="Audit and record tracking"
              icon={ShieldCheck}
            >
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Created
                  </p>
                  <div className="flex items-center gap-2">
                    <div className="size-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] text-primary font-bold uppercase">
                      {(supplier.createdBy || "S").charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        {supplier.createdBy || "System Generated"}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {supplier.createdAt
                          ? new Date(supplier.createdAt).toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "—"}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Last Updated
                  </p>
                  <div className="flex items-center gap-2">
                    <div className="size-6 rounded-full bg-muted flex items-center justify-center text-[10px] text-muted-foreground font-bold uppercase">
                      {(supplier.updatedBy || supplier.createdBy || "S").charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        {supplier.updatedBy || supplier.createdBy || "System Generated"}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {supplier.updatedAt
                          ? new Date(supplier.updatedAt).toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "—"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </SectionCard>
          </div>
          <div className="grid gap-4 xl:grid-cols-1">
            <SectionCard
              title="Documents"
              description="Compliance documents attached to this supplier"
              icon={FileText}
            >
              {supplier.documents?.length ? (
                <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                  {supplier.documents.map((document: any) => (
                    <div
                      key={document.uploadId}
                      className="flex items-center justify-between rounded-xl border border-border/70 p-3"
                    >
                      <div>
                        <p className="text-sm font-medium">{document.fileName}</p>
                        <p className="text-xs text-muted-foreground">{document.documentType}</p>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {Math.ceil((document.fileSize || 0) / 1024)} KB
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptySection text="No documents have been attached." />
              )}
            </SectionCard>
          </div>
          {supplier.remarks && (
            <SectionCard title="Remarks" icon={Mail}>
              <p className="text-sm text-muted-foreground">{supplier.remarks}</p>
            </SectionCard>
          )}
        </div>
      )}
    </AppShell>
  );
}
function EmptySection({ text }: { text: string }) {
  return <p className="py-4 text-sm text-muted-foreground">{text}</p>;
}
function EditField({
  label,
  value,
  onChange,
}: {
  label: string;
  value?: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input value={value || ""} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}
function ValidatedEditField({
  label,
  value,
  error,
  maxLength,
  onChange,
}: {
  label: string;
  value?: string;
  error?: string;
  maxLength?: number;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input
        value={value || ""}
        maxLength={maxLength}
        onChange={(event) => onChange(event.target.value)}
        className={cn(error && "border-destructive focus-visible:ring-destructive")}
      />
      {error && (
        <p className="text-[11px] font-medium text-destructive flex items-center gap-1">
          <AlertCircle className="size-3" /> {error}
        </p>
      )}
    </div>
  );
}
