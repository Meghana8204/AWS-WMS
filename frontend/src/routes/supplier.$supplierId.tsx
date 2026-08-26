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
<<<<<<< HEAD
  CheckCircle2,
  Plus,
  FileIcon,
  Eye,
=======
>>>>>>> origin/main
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
<<<<<<< HEAD
  const [vendorTypes, setVendorTypes] = useState<string[]>([
    "Manufacturer",
    "Distributor",
    "Service Provider",
  ]);
=======
>>>>>>> origin/main
  const [categories, setCategories] = useState<string[]>([
    "Raw Materials",
    "Packaging",
    "Finished Goods",
    "Consumables",
  ]);
<<<<<<< HEAD
  const [rawMaterials, setRawMaterials] = useState<string[]>([
    "Steel",
    "Aluminum",
    "Plastic",
    "Copper",
  ]);
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);

  const handleDocumentUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ["application/pdf", "image/jpeg", "image/jpg"];
    const allowedExts = [".pdf", ".jpeg", ".jpg"];
    const fileExt = "." + file.name.split(".").pop()?.toLowerCase();

    if (!allowedTypes.includes(file.type.toLowerCase()) && !allowedExts.includes(fileExt)) {
      toast.error("Only PDF (.pdf) and JPEG (.jpeg, .jpg) files are allowed");
      e.target.value = "";
      return;
    }

    setIsUploadingDoc(true);
    try {
      const response = await api.uploadSupplierDocument(type, file);
      const newDoc = {
        document_type: response.document_type || type,
        file_name: response.file_name || file.name,
        file_type: response.file_type || file.type,
        file_size: response.file_size || file.size,
        storage_path: response.storage_path,
        upload_id: response.upload_id,
        documentType: response.document_type || type,
        fileName: response.file_name || file.name,
        fileType: response.file_type || file.type,
        fileSize: response.file_size || file.size,
        storagePath: response.storage_path,
        uploadId: response.upload_id,
      };

      setForm((prev: any) => {
        const existingDocs = Array.isArray(prev?.documents) ? prev.documents : [];
        const filtered = existingDocs.filter(
          (d: any) => (d.document_type || d.documentType) !== type,
        );
        return { ...prev, documents: [...filtered, newDoc] };
      });
      toast.success(`${type} uploaded successfully`);
    } catch (err: any) {
      toast.error("Upload failed: " + err.message);
    } finally {
      setIsUploadingDoc(false);
      e.target.value = "";
    }
  };

  const removeFormDocument = (index: number) => {
    setForm((prev: any) => {
      const existingDocs = Array.isArray(prev?.documents) ? prev.documents : [];
      return { ...prev, documents: existingDocs.filter((_: any, i: number) => i !== index) };
    });
  };

=======
>>>>>>> origin/main
  useEffect(() => {
    api
      .getSupplier(supplierId)
      .then(setSupplier)
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Unable to load supplier profile."),
      );
<<<<<<< HEAD

    Promise.all([
      api.getVendorTypes().catch(() => []),
      api.getSupplierCategories().catch(() => []),
      api.getRawMaterials().catch(() => []),
    ]).then(([vTypes, cats, materials]) => {
      if (vTypes.length > 0) setVendorTypes(vTypes.map((t: any) => t.name));
      if (cats.length > 0) setCategories(cats.map((c: any) => c.name));
      if (materials.length > 0) setRawMaterials(materials.map((m: any) => m.name));
    });
=======
    api
      .getSupplierCategories()
      .then((cats) => {
        if (cats.length > 0) setCategories(cats.map((c: any) => c.name));
      })
      .catch((err) => console.warn("Failed to fetch categories", err));
>>>>>>> origin/main
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
<<<<<<< HEAD

    // Clear inline error
=======
>>>>>>> origin/main
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
<<<<<<< HEAD
    const mainMaterials = Array.isArray(form.mainMaterials) ? form.mainMaterials : [];

    if (!name) newErrors.supplierName = "Supplier Display Name is required";
    else if (name.length < 2 || name.length > 100)
      newErrors.supplierName = "Must be between 2 and 100 characters";

    if (!regName) newErrors.registeredCompanyName = "Registered Company Name is required";
    else if (regName.length < 2 || regName.length > 200)
      newErrors.registeredCompanyName = "Must be between 2 and 200 characters";

    if (!form.vendorType) newErrors.vendorType = "Please select a Vendor Type";
    if (!form.category || (Array.isArray(form.category) && form.category.length === 0))
      newErrors.category = "Please select at least one Category";
    if (mainMaterials.length === 0) newErrors.mainMaterials = "Please select at least one material";

    if (!industry) newErrors.industry = "Industry is required";
    else if (industry.length < 2 || industry.length > 100)
      newErrors.industry = "Must be between 2 and 100 characters";

    if (!gstin) newErrors.gstin = "GSTIN is required";
    else if (gstin.length !== 15) newErrors.gstin = "Must be exactly 15 characters";
    else if (
      !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(gstin.toUpperCase())
    ) {
      newErrors.gstin = "Invalid GSTIN format (e.g. 29ABCDE1234F1Z5)";
=======
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
>>>>>>> origin/main
    }
    if (form.address) {
      const addr = (form.address.registeredAddress || "").trim();
      const city = (form.address.city || "").trim();
      const pincode = (form.address.pincode || "").trim();
      const state = (form.address.state || "").trim();
<<<<<<< HEAD

      if (addr && addr.length > 500)
        newErrors["address.registeredAddress"] = "Must be under 500 characters";

=======
      if (!addr) newErrors["address.registeredAddress"] = "Address is required";
      else if (addr.length < 10 || addr.length > 300)
        newErrors["address.registeredAddress"] = "Must be between 10 and 300 characters";
>>>>>>> origin/main
      if (!city) newErrors["address.city"] = "City is required";
      else if (city.length < 2 || city.length > 100)
        newErrors["address.city"] = "Must be between 2 and 100 characters";
      else if (!/^[a-zA-Z\s-]+$/.test(city))
<<<<<<< HEAD
        newErrors["address.city"] = "Only letters, spaces and hyphens allowed";

      if (state && (state.length < 2 || state.length > 100))
        newErrors["address.state"] = "Must be between 2 and 100 characters";

=======
        newErrors["address.city"] = "Letters/spaces/hyphen only";
      if (state && (state.length < 2 || state.length > 100))
        newErrors["address.state"] = "Must be 2-100 characters";
>>>>>>> origin/main
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
<<<<<<< HEAD

      if (!contactName)
        newErrors["contact.primaryContactName"] = "Primary Contact Name is required";
      else if (contactName.length < 2 || contactName.length > 100)
        newErrors["contact.primaryContactName"] = "Must be between 2 and 100 characters";
      else if (!/^[a-zA-Z\s.]+$/.test(contactName))
        newErrors["contact.primaryContactName"] = "Only letters, spaces and dots allowed";

      if (!phone) newErrors["contact.phone"] = "Phone number is required";
      else if (!/^[6-9]\d{9}$/.test(phone))
        newErrors["contact.phone"] = "Must be a valid 10-digit mobile number starting with 6-9";

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!primaryEmail) newErrors["contact.primaryEmail"] = "Primary email is required";
      else if (!emailRegex.test(primaryEmail))
        newErrors["contact.primaryEmail"] = "Invalid email format";

      if (secondaryEmail && !emailRegex.test(secondaryEmail))
        newErrors["contact.secondaryEmail"] = "Invalid email format";

      if (designation && (designation.length < 2 || designation.length > 100))
        newErrors["contact.designation"] = "Must be between 2 and 100 characters";

=======
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
>>>>>>> origin/main
      if (website) {
        try {
          new URL(website.startsWith("http") ? website : `https://${website}`);
        } catch (_) {
          newErrors["contact.website"] = "Invalid URL format";
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
<<<<<<< HEAD
        newErrors["bankInfo.accountNumber"] = "Must be between 9 and 18 digits";
      else if (!/^\d+$/.test(accNo))
        newErrors["bankInfo.accountNumber"] = "Must contain only digits";

=======
        newErrors["bankInfo.accountNumber"] = "9-18 digits required";
      else if (!/^\d+$/.test(accNo)) newErrors["bankInfo.accountNumber"] = "Digits only";
>>>>>>> origin/main
      if (!ifsc) newErrors["bankInfo.ifsc"] = "IFSC code is required";
      else if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc.toUpperCase())) {
        newErrors["bankInfo.ifsc"] = "Invalid IFSC format (e.g. SBIN0012345)";
      }
<<<<<<< HEAD

      if (!holder) newErrors["bankInfo.accountHolderName"] = "Account holder name is required";
      else if (!/^[a-zA-Z\s.]+$/.test(holder))
        newErrors["bankInfo.accountHolderName"] = "Invalid characters in name";

      if (!branch) newErrors["bankInfo.branch"] = "Branch name is required";

=======
      if (!holder) newErrors["bankInfo.accountHolderName"] = "Holder name is required";
      if (!branch) newErrors["bankInfo.branch"] = "Branch is required";
>>>>>>> origin/main
      if (swift && !/^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(swift.toUpperCase())) {
        newErrors["bankInfo.swiftBic"] = "Invalid SWIFT/BIC format";
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  const saveChanges = async () => {
    if (!validate()) {
      toast.error("Validation Error", {
        description: "Please fill in all required fields and fix highlighted errors.",
      });
      return;
    }
    const name = (form.supplierName || "").trim();
    const regName = (form.registeredCompanyName || "").trim();
    const industry = (form.industry || "").trim();
    const gstin = (form.gstin || "").trim();
    setSaving(true);
    try {
      const docPayload = Array.isArray(form.documents)
        ? form.documents.map((d: any) => ({
            document_type: d.document_type || d.documentType,
            documentType: d.document_type || d.documentType,
            file_name: d.file_name || d.fileName,
            fileName: d.file_name || d.fileName,
            file_type: d.file_type || d.fileType || "application/pdf",
            fileType: d.file_type || d.fileType || "application/pdf",
            file_size: d.file_size || d.fileSize || 0,
            fileSize: d.file_size || d.fileSize || 0,
            storage_path: d.storage_path || d.storagePath || "",
            storagePath: d.storage_path || d.storagePath || "",
            upload_id: d.upload_id || d.uploadId || "",
            uploadId: d.upload_id || d.uploadId || "",
          }))
        : [];

      const finalForm = {
        ...form,
        supplier_name: name,
        supplierName: name,
        registered_company_name: regName,
        registeredCompanyName: regName,
        vendor_type: form.vendorType,
        vendorType: form.vendorType,
        category: Array.isArray(form.category) ? form.category : [],
        industry: industry,
        gstin: gstin.toUpperCase(),
        main_materials: Array.isArray(form.mainMaterials) ? form.mainMaterials : [],
        mainMaterials: Array.isArray(form.mainMaterials) ? form.mainMaterials : [],
        address: form.address
          ? {
              registered_address: (form.address.registeredAddress || "").trim(),
              registeredAddress: (form.address.registeredAddress || "").trim(),
              city: (form.address.city || "").trim(),
              country: form.address.country || "India",
              state: (form.address.state || "").trim(),
              pincode: (form.address.pincode || "").trim(),
            }
          : undefined,
        contact: form.contact
          ? {
              primary_contact_name: (form.contact.primaryContactName || "").trim(),
              primaryContactName: (form.contact.primaryContactName || "").trim(),
              primary_email: (form.contact.primaryEmail || "").trim(),
              primaryEmail: (form.contact.primaryEmail || "").trim(),
              secondary_email: (form.contact.secondaryEmail || "").trim(),
              secondaryEmail: (form.contact.secondaryEmail || "").trim(),
              designation: (form.contact.designation || "").trim(),
              phone: (form.contact.phone || "").trim(),
              website: (form.contact.website || "").trim(),
            }
          : undefined,
        bank_info: form.bankInfo
          ? {
              bank_name: (form.bankInfo.bankName || "").trim(),
              bankName: (form.bankInfo.bankName || "").trim(),
              account_number: (form.bankInfo.accountNumber || "").trim(),
              accountNumber: (form.bankInfo.accountNumber || "").trim(),
              account_holder_name: (form.bankInfo.accountHolderName || "").trim(),
              accountHolderName: (form.bankInfo.accountHolderName || "").trim(),
              ifsc: (form.bankInfo.ifsc || "").trim().toUpperCase(),
              branch: (form.bankInfo.branch || "").trim(),
              swift_bic: (form.bankInfo.swiftBic || "").trim().toUpperCase(),
              swiftBic: (form.bankInfo.swiftBic || "").trim().toUpperCase(),
              tds_section: form.bankInfo.tdsSection,
              tdsSection: form.bankInfo.tdsSection,
            }
          : undefined,
        documents: docPayload,
        remarks: form.remarks,
      };
      const updated = await api.updateSupplier(supplierId, finalForm);
      setSupplier(updated);
      setEditing(false);
      toast.success("Company Profile Updated", {
        description: `Changes to "${name || "supplier"}" profile saved successfully.`,
      });
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
<<<<<<< HEAD
      subtitle={supplier?.registeredCompanyName}
      actions={
        supplier && (
          <>
            {!editing && (
              <Button onClick={openEditor} className="rounded-xl shadow-glow">
                <Pencil /> Edit profile
              </Button>
            )}
            {supplier.status === "Blocked" ? (
              <Button variant="outline" className="rounded-xl border-success text-success" disabled>
                Blocked
=======
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
>>>>>>> origin/main
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
<<<<<<< HEAD
            <div className="space-y-4">
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
                    maxLength={100}
                    onChange={(value) =>
                      updateForm("root", "supplierName", value.substring(0, 100))
                    }
                  />
                  <ValidatedEditField
                    label="Registered company"
                    value={form.registeredCompanyName}
                    error={errors.registeredCompanyName}
                    maxLength={200}
                    onChange={(value) =>
                      updateForm("root", "registeredCompanyName", value.substring(0, 200))
                    }
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
                        {vendorTypes.map((type) => (
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
                                checked={
                                  Array.isArray(form.category) && form.category.includes(cat)
                                }
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
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          className={cn(
                            "w-full justify-between rounded-xl h-10 px-3 font-normal",
                            errors.mainMaterials && "border-destructive",
                          )}
                        >
                          <span className="truncate">
                            {Array.isArray(form.mainMaterials) && form.mainMaterials.length > 0
                              ? form.mainMaterials.join(", ")
                              : "Select materials"}
                          </span>
                          <ChevronRight className="ml-2 h-4 w-4 shrink-0 opacity-50 rotate-90" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[300px] p-0 rounded-xl" align="start">
                        <div className="p-2 space-y-1 max-h-[300px] overflow-y-auto">
                          {rawMaterials.map((mat) => {
                            const current = Array.isArray(form.mainMaterials)
                              ? form.mainMaterials
                              : [];
                            const checked = current.includes(mat);
                            return (
                              <div
                                key={mat}
                                className="flex items-center space-x-2 p-2 hover:bg-muted rounded-lg cursor-pointer"
                                onClick={() => {
                                  const updated = checked
                                    ? current.filter((m: string) => m !== mat)
                                    : [...current, mat];
                                  updateForm("root", "mainMaterials", updated);
                                }}
                              >
                                <Checkbox
                                  id={`edit-mat-${mat}`}
                                  checked={checked}
                                  onCheckedChange={() => {
                                    const updated = checked
                                      ? current.filter((m: string) => m !== mat)
                                      : [...current, mat];
                                    updateForm("root", "mainMaterials", updated);
                                  }}
                                />
                                <Label
                                  htmlFor={`edit-mat-${mat}`}
                                  className="text-sm cursor-pointer w-full"
                                >
                                  {mat}
                                </Label>
                              </div>
                            );
                          })}
                        </div>
                      </PopoverContent>
                    </Popover>
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
                              errors["address.state"] &&
                                "border-destructive focus:ring-destructive",
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

                          // Run-time validation
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

                          // Run-time validation
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

              <SectionCard
                title="Supporting Documents"
                description="Upload or replace compliance documents (PDF or JPEG only)"
                icon={FileText}
              >
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                  {[
                    { name: "GST Certificate", mandatory: false },
                    { name: "Cancelled Cheque", mandatory: true },
                    { name: "Vendor Code of Conduct", mandatory: false },
                    { name: "Other", mandatory: false },
                  ].map((doc) => {
                    const docsList = Array.isArray(form.documents) ? form.documents : [];
                    const isUploaded = docsList.some(
                      (d: any) => (d.document_type || d.documentType) === doc.name,
                    );
                    return (
                      <div key={doc.name} className="relative">
                        <input
                          type="file"
                          id={`edit-file-${doc.name}`}
                          accept=".pdf,.jpeg,.jpg,application/pdf,image/jpeg"
                          className="hidden"
                          onChange={(e) => handleDocumentUpload(e, doc.name)}
                          disabled={isUploadingDoc}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full h-20 flex-col gap-2 rounded-xl border-dashed border-2 hover:border-primary/50 hover:bg-primary/5"
                          onClick={() => document.getElementById(`edit-file-${doc.name}`)?.click()}
                          disabled={isUploadingDoc}
                        >
                          {isUploadingDoc ? (
                            <Loader2 className="size-5 animate-spin text-primary" />
                          ) : isUploaded ? (
                            <CheckCircle2 className="size-5 text-success" />
                          ) : (
                            <Plus className="size-5 text-muted-foreground" />
                          )}
                          <span className="text-[10px] uppercase font-bold">
                            {doc.name}{" "}
                            {doc.mandatory && <span className="text-destructive">*</span>}
                          </span>
                        </Button>
                      </div>
                    );
                  })}
                </div>

                {Array.isArray(form.documents) && form.documents.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Uploaded Documents</Label>
                    <div className="grid gap-2">
                      {form.documents.map((doc: any, idx: number) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border/50"
                        >
                          <div className="flex items-center gap-3">
                            <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                              <FileIcon className="size-4" />
                            </div>
                            <div>
                              <div className="text-sm font-medium">
                                {doc.file_name || doc.fileName}
                              </div>
                              <div className="text-[10px] text-muted-foreground uppercase">
                                {doc.document_type || doc.documentType}
                              </div>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            type="button"
                            className="size-8 text-destructive hover:text-destructive hover:bg-destructive/10 rounded-lg"
                            onClick={() => removeFormDocument(idx)}
                          >
                            <X className="size-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </SectionCard>
            </div>
=======
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
>>>>>>> origin/main
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
<<<<<<< HEAD
                  {supplier.documents.map((document: any) => {
                    const rawPath = document.storagePath || document.storage_path || "";
                    const docUrl = rawPath
                      ? rawPath.startsWith("http") || rawPath.startsWith("data:")
                        ? rawPath
                        : `http://localhost:8000${rawPath.startsWith("/") ? "" : "/"}${rawPath}`
                      : null;

                    return (
                      <div
                        key={document.uploadId || document.upload_id || document.fileName}
                        className="flex items-center justify-between rounded-xl border border-border/70 p-3 bg-card hover:border-primary/40 transition-colors"
                      >
                        <div className="min-w-0 flex-1 pr-2">
                          <p className="text-sm font-medium truncate">
                            {document.fileName || document.file_name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {document.documentType || document.document_type}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {docUrl && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8 gap-1.5 px-2.5 text-xs text-primary border-primary/20 hover:bg-primary/10 rounded-lg"
                              onClick={() => window.open(docUrl, "_blank", "noopener,noreferrer")}
                              title="View Document"
                            >
                              <Eye className="size-3.5" />
                              <span>View</span>
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
=======
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
>>>>>>> origin/main
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
<<<<<<< HEAD

=======
>>>>>>> origin/main
function EditField({
  label,
  value,
  onChange,
}: {
  label: string;
<<<<<<< HEAD
  value?: string | undefined;
=======
  value?: string;
>>>>>>> origin/main
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
  value?: string | undefined;
  error?: string | undefined;
  maxLength?: number | undefined;
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
