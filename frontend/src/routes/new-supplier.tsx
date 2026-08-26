import * as React from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  Building2,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  FileText,
  CreditCard,
  Loader2,
  Plus,
  Upload,
  MessageSquare,
  FileIcon,
  Eye,
  X,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/wms/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api-client";
import { INDIAN_STATES, TDS_SECTIONS } from "@/lib/constants";
import { Certificate } from "crypto";
export const Route = createFileRoute("/new-supplier")({
  component: NewSupplier,
});
const steps = [
  { id: 1, name: "Company Profile", icon: Building2 },
  { id: 2, name: "Address & Contact", icon: FileText },
  { id: 3, name: "Banking Information", icon: CreditCard },
  { id: 4, name: "Documents", icon: Upload },
  { id: 5, name: "Remarks", icon: MessageSquare },
];
<<<<<<< HEAD

const DRAFT_STORAGE_KEY = "new_supplier_form_draft";

const defaultFormState = {
  supplierName: "",
  registeredCompanyName: "",
  vendorType: "",
  category: [] as string[],
  mainMaterials: [] as string[],
  industry: "",
  gstin: "",
  address: {
    registeredAddress: "",
    city: "",
    country: "India",
    state: "",
    pincode: "",
  },
  contact: {
    primaryContactName: "",
    primaryEmail: "",
    secondaryEmail: "",
    designation: "",
    phone: "",
    website: "",
  },
  bankInfo: {
    bankName: "",
    accountNumber: "",
    accountHolderName: "",
    ifsc: "",
    branch: "",
    swiftBic: "",
    tdsSection: "",
  },
  documents: [] as any[],
  remarks: "",
};

=======
>>>>>>> origin/main
function NewSupplier() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = React.useState(() => {
    try {
      if (typeof window !== "undefined") {
        const saved = localStorage.getItem(DRAFT_STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.currentStep) return Number(parsed.currentStep);
        }
      }
    } catch (_) {}
    return 1;
  });

  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [isLookingUpState, setIsLookingUpState] = React.useState(false);
  const [stateLookupMessage, setStateLookupMessage] = React.useState("");
  const [vendorTypes, setVendorTypes] = React.useState([
    "Manufacturer",
    "Distributor",
    "Service Provider",
  ]);
  const [categories, setCategories] = React.useState([
    "Raw Materials",
    "Packaging",
    "Finished Goods",
    "Consumables",
  ]);
  const [rawMaterials, setRawMaterials] = React.useState([
    "Steel",
    "Aluminum",
    "Plastic",
    "Copper",
  ]);
  const [showAddVendorType, setShowAddVendorType] = React.useState(false);
  const [showAddCategory, setShowAddCategory] = React.useState(false);
  const [showAddRawMaterial, setShowAddRawMaterial] = React.useState(false);
  const [newVendorType, setNewVendorType] = React.useState("");
  const [newCategory, setNewCategory] = React.useState("");
  const [newRawMaterial, setNewRawMaterial] = React.useState("");
  React.useEffect(() => {
    const fetchMasterData = async () => {
      try {
        const [vTypes, cats, materials] = await Promise.all([
          api.getVendorTypes(),
          api.getSupplierCategories(),
          api.getRawMaterials(),
        ]);
        if (vTypes.length > 0) setVendorTypes(vTypes.map((t: any) => t.name));
        if (cats.length > 0) setCategories(cats.map((c: any) => c.name));
        if (materials.length > 0) setRawMaterials(materials.map((m: any) => m.name));
      } catch (e) {
        console.warn("Failed to fetch master data, using defaults", e);
      }
    };
    fetchMasterData();
  }, []);
<<<<<<< HEAD

  // Form State initialized from localStorage draft
  const [formData, setFormData] = React.useState(() => {
    try {
      if (typeof window !== "undefined") {
        const saved = localStorage.getItem(DRAFT_STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.formData) {
            return {
              ...defaultFormState,
              ...parsed.formData,
              address: { ...defaultFormState.address, ...(parsed.formData.address || {}) },
              contact: { ...defaultFormState.contact, ...(parsed.formData.contact || {}) },
              bankInfo: { ...defaultFormState.bankInfo, ...(parsed.formData.bankInfo || {}) },
            };
          }
        }
      }
    } catch (_) {}
    return defaultFormState;
  });

  // Automatically save form data and current step to localStorage on change
  React.useEffect(() => {
    try {
      if (typeof window !== "undefined") {
        localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify({ formData, currentStep }));
      }
    } catch (_) {}
  }, [formData, currentStep]);

=======
  const [formData, setFormData] = React.useState({
    supplierName: "",
    registeredCompanyName: "",
    vendorType: "",
    category: [] as string[],
    mainMaterials: [] as string[],
    industry: "",
    gstin: "",
    address: {
      registeredAddress: "",
      city: "",
      country: "India",
      state: "",
      pincode: "",
    },
    contact: {
      primaryContactName: "",
      primaryEmail: "",
      secondaryEmail: "",
      designation: "",
      phone: "",
      website: "",
    },
    bankInfo: {
      bankName: "",
      accountNumber: "",
      accountHolderName: "",
      ifsc: "",
      branch: "",
      swiftBic: "",
      tdsSection: "",
    },
    documents: [] as any[],
    remarks: "",
  });
>>>>>>> origin/main
  const [isUploading, setIsUploading] = React.useState(false);
  React.useEffect(() => {
    const pincode = formData.address.pincode;

    if (!/^\d{6}$/.test(pincode)) {
      setIsLookingUpState(false);
      setStateLookupMessage("");
      return;
    }

    const controller = new AbortController();
    const lookupTimer = window.setTimeout(async () => {
      setIsLookingUpState(true);
      setStateLookupMessage("");
      try {
        const response = await fetch(`https://api.postalpincode.in/pincode/${pincode}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("PIN lookup failed");

        const payload = await response.json();
        const postOffices = payload?.[0]?.PostOffice;
        const postalState = Array.isArray(postOffices) ? postOffices[0]?.State : "";
        const postalCity = Array.isArray(postOffices)
          ? postOffices[0]?.District || postOffices[0]?.Block || postOffices[0]?.Name
          : "";
        const stateAliases: Record<string, string> = {
          "Andaman & Nicobar Islands": "Andaman and Nicobar Islands",
          "Dadra & Nagar Haveli": "Dadra and Nagar Haveli and Daman and Diu",
          "Daman & Diu": "Dadra and Nagar Haveli and Daman and Diu",
          "Jammu & Kashmir": "Jammu and Kashmir",
          "NCT of Delhi": "Delhi",
          Orissa: "Odisha",
          Pondicherry: "Puducherry",
        };
        const resolvedState = stateAliases[postalState] || postalState;

        if (!postalCity || !resolvedState || !INDIAN_STATES.includes(resolvedState)) {
          throw new Error("No address found for this PIN code");
        }

        setFormData((previous) => ({
          ...previous,
          address: { ...previous.address, city: postalCity, state: resolvedState },
        }));
        setErrors((previous) => {
          const nextErrors = { ...previous };
          delete nextErrors["address.city"];
          delete nextErrors["address.state"];
          return nextErrors;
        });
        setStateLookupMessage(`City and state selected from PIN ${pincode}`);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setStateLookupMessage("City and state could not be detected. Please enter them manually.");
      } finally {
        if (!controller.signal.aborted) setIsLookingUpState(false);
      }
    }, 400);

    return () => {
      window.clearTimeout(lookupTimer);
      controller.abort();
    };
  }, [formData.address.pincode]);

  const updateFormData = (section: string, field: string, value: string) => {
    if (section === "root") {
      setFormData((prev) => ({ ...prev, [field]: value }));
      if (errors[field]) {
        setErrors((prev) => {
          const newErrors = { ...prev };
          delete newErrors[field];
          return newErrors;
        });
      }
    } else {
      setFormData((prev: any) => ({
        ...prev,
        [section]: {
          ...prev[section],
          [field]: value,
        },
      }));
      const errorKey = `${section}.${field}`;
      if (errors[errorKey]) {
        setErrors((prev) => {
          const newErrors = { ...prev };
          delete newErrors[errorKey];
          return newErrors;
        });
      }
    }
  };
  const validateStep = async (step: number) => {
    const newErrors: Record<string, string> = {};
    if (step === 1) {
      const name = formData.supplierName.trim();
      const regName = formData.registeredCompanyName.trim();
      const industry = formData.industry.trim();
      const gstin = formData.gstin.trim();
      if (!name) newErrors.supplierName = "Supplier Display Name is required";
      else if (name.length < 2 || name.length > 100)
        newErrors.supplierName = "Must be between 2 and 100 characters";
<<<<<<< HEAD

      if (!regName) newErrors.registeredCompanyName = "Registered Company Name is required";
      else if (regName.length < 2 || regName.length > 200)
        newErrors.registeredCompanyName = "Must be between 2 and 200 characters";

=======
      if (!regName) newErrors.registeredCompanyName = "Registered Company Name is required";
      else if (regName.length < 2 || regName.length > 200)
        newErrors.registeredCompanyName = "Must be between 2 and 200 characters";
>>>>>>> origin/main
      if (!formData.vendorType) newErrors.vendorType = "Please select a Vendor Type";
      if (formData.category.length === 0)
        newErrors.category = "Please select at least one Category";
      if (formData.mainMaterials.length === 0)
        newErrors.mainMaterials = "Please select at least one material";
<<<<<<< HEAD

      if (!industry) newErrors.industry = "Industry is required";
      else if (industry.length < 2 || industry.length > 100)
        newErrors.industry = "Must be between 2 and 100 characters";

=======
      if (!industry) newErrors.industry = "Industry is required";
      else if (industry.length < 2 || industry.length > 100)
        newErrors.industry = "Must be between 2 and 100 characters";
>>>>>>> origin/main
      if (!gstin) newErrors.gstin = "GSTIN is required";
      else if (gstin.length !== 15) newErrors.gstin = "Must be exactly 15 characters";
      else if (
        !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(gstin.toUpperCase())
      ) {
        newErrors.gstin = "Invalid GSTIN format (e.g. 29ABCDE1234F1Z5)";
      }
      if (Object.keys(newErrors).length === 0) {
        try {
          const existence = await api.checkSupplierExistence({
            company_name: regName,
            gstin: gstin,
          });
          if (existence.company_name)
            newErrors.registeredCompanyName = "This company is already registered";
          if (existence.gstin) newErrors.gstin = "This GSTIN is already registered";
        } catch (e) {
          console.error("Duplicate check failed", e);
        }
      }
    }
    if (step === 2) {
      const addr = formData.address.registeredAddress.trim();
      const city = formData.address.city.trim();
      const state = formData.address.state.trim();
      const pincode = formData.address.pincode.trim();
      const contactName = formData.contact.primaryContactName.trim();
      const designation = formData.contact.designation.trim();
      const phone = formData.contact.phone.trim();
      const website = formData.contact.website.trim();
      const primaryEmail = formData.contact.primaryEmail.trim();
      const secondaryEmail = formData.contact.secondaryEmail.trim();
<<<<<<< HEAD

      // Address Validation (Strict validation removed for registered address)
      if (addr && addr.length > 500)
        newErrors["address.registeredAddress"] = "Must be under 500 characters";

=======
      if (addr && addr.length > 500)
        newErrors["address.registeredAddress"] = "Must be under 500 characters";
>>>>>>> origin/main
      if (!city) newErrors["address.city"] = "City is required";
      else if (city.length < 2 || city.length > 100)
        newErrors["address.city"] = "Must be between 2 and 100 characters";
      else if (!/^[a-zA-Z\s-]+$/.test(city))
        newErrors["address.city"] = "Only letters, spaces and hyphens allowed";
<<<<<<< HEAD

      if (state && (state.length < 2 || state.length > 100))
        newErrors["address.state"] = "Must be between 2 and 100 characters";

      if (!pincode) newErrors["address.pincode"] = "Pincode is required";
      else if (!/^\d{6}$/.test(pincode)) newErrors["address.pincode"] = "Must be exactly 6 digits";

      // Contact Validation
=======
      if (!state) newErrors["address.state"] = "State is required";
      else if (state.length < 2 || state.length > 100)
        newErrors["address.state"] = "Must be between 2 and 100 characters";
      if (!pincode) newErrors["address.pincode"] = "Pincode is required";
      else if (!/^\d{6}$/.test(pincode)) newErrors["address.pincode"] = "Must be exactly 6 digits";
>>>>>>> origin/main
      if (!contactName)
        newErrors["contact.primaryContactName"] = "Primary Contact Name is required";
      else if (contactName.length < 2 || contactName.length > 100)
        newErrors["contact.primaryContactName"] = "Must be between 2 and 100 characters";
      else if (!/^[a-zA-Z\s]+$/.test(contactName))
        newErrors["contact.primaryContactName"] = "Only letters and spaces allowed";
<<<<<<< HEAD

      if (designation && (designation.length < 2 || designation.length > 100))
        newErrors["contact.designation"] = "Must be between 2 and 100 characters";

      if (!phone) newErrors["contact.phone"] = "Phone number is required";
      else if (!/^[6-9]\d{9}$/.test(phone))
        newErrors["contact.phone"] = "Must be a 10-digit Indian mobile number";

=======
      if (designation && (designation.length < 2 || designation.length > 100))
        newErrors["contact.designation"] = "Must be between 2 and 100 characters";
      if (!phone) newErrors["contact.phone"] = "Phone number is required";
      else if (!/^[6-9]\d{9}$/.test(phone))
        newErrors["contact.phone"] = "Must be a 10-digit Indian mobile number";
>>>>>>> origin/main
      if (website) {
        try {
          new URL(website.startsWith("http") ? website : `https://${website}`);
        } catch (_) {
          newErrors["contact.website"] = "Please enter a valid URL";
        }
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!primaryEmail) newErrors["contact.primaryEmail"] = "Primary Email is required";
      else if (!emailRegex.test(primaryEmail))
        newErrors["contact.primaryEmail"] = "Invalid email format";
<<<<<<< HEAD

      if (secondaryEmail && !emailRegex.test(secondaryEmail))
        newErrors["contact.secondaryEmail"] = "Invalid email format";

      // Backend Duplicate Check
=======
      if (secondaryEmail && !emailRegex.test(secondaryEmail))
        newErrors["contact.secondaryEmail"] = "Invalid email format";
>>>>>>> origin/main
      if (Object.keys(newErrors).length === 0) {
        try {
          const existence = await api.checkSupplierExistence({
            email: primaryEmail,
            phone: phone,
          });
          if (existence.email) newErrors["contact.primaryEmail"] = "This email is already in use";
          if (existence.phone) newErrors["contact.phone"] = "This phone number is already in use";
        } catch (e) {
          console.error("Duplicate check failed", e);
        }
      }
    }
    if (step === 3) {
      const bankName = formData.bankInfo.bankName.trim();
      const accNo = formData.bankInfo.accountNumber.trim();
      const ifsc = formData.bankInfo.ifsc.trim();
      const holder = formData.bankInfo.accountHolderName.trim();
      const branch = formData.bankInfo.branch.trim();
      const swift = formData.bankInfo.swiftBic.trim();
      if (!bankName) newErrors["bankInfo.bankName"] = "Bank name is required";
      if (!accNo) newErrors["bankInfo.accountNumber"] = "Account number is required";
      else if (accNo.length < 9 || accNo.length > 18)
        newErrors["bankInfo.accountNumber"] = "Must be between 9 and 18 digits";
      else if (!/^\d+$/.test(accNo))
        newErrors["bankInfo.accountNumber"] = "Must contain only digits";
<<<<<<< HEAD

=======
>>>>>>> origin/main
      if (!ifsc) newErrors["bankInfo.ifsc"] = "IFSC code is required";
      else if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc.toUpperCase())) {
        newErrors["bankInfo.ifsc"] = "Invalid IFSC format (e.g. SBIN0012345)";
      }
      if (!holder) newErrors["bankInfo.accountHolderName"] = "Account holder name is required";
      else if (!/^[a-zA-Z\s.]+$/.test(holder))
        newErrors["bankInfo.accountHolderName"] = "Invalid characters in name";
<<<<<<< HEAD

=======
>>>>>>> origin/main
      if (!branch) newErrors["bankInfo.branch"] = "Branch name is required";
      if (swift && !/^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(swift.toUpperCase())) {
        newErrors["bankInfo.swiftBic"] = "Invalid SWIFT/BIC format";
      }
      if (Object.keys(newErrors).length === 0) {
        try {
          const existence = await api.checkSupplierExistence({
            account_number: accNo,
            swift: swift,
          });
          if (existence.account_number)
            newErrors["bankInfo.accountNumber"] = "This bank account is already registered";
          if (existence.swift) newErrors["bankInfo.swiftBic"] = "This SWIFT/BIC is already in use";
        } catch (e) {
          console.error("Duplicate check failed", e);
        }
      }
    }
    if (step === 4) {
      const hasCancelledCheque = formData.documents.some(
        (d) => d.document_type === "Cancelled Cheque",
      );
      if (!hasCancelledCheque) {
        newErrors["documents"] = "Cancelled Cheque is mandatory";
        toast.error("Cancelled Cheque is mandatory for registration");
      }
      const hasGSTCertificate = formData.documents.some(
        (d) => d.document_type === "GST Certificate",
      );
      if (!hasGSTCertificate) {
        newErrors["documents"] = "GST Certificate is mandatory";
        toast.error("GST Certificate is mandatory for registration");
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  const handleNext = async () => {
    setIsSubmitting(true);
    const isValid = await validateStep(currentStep);
    setIsSubmitting(false);
    if (isValid) {
      if (currentStep < 5) setCurrentStep(currentStep + 1);
    }
  };
  const handleBack = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: string) => {
    const file = e.target.files?.[0];
    if (!file) return;
<<<<<<< HEAD

    // Validate file type (Only PDF or JPEG allowed)
    const allowedTypes = ["application/pdf", "image/jpeg", "image/jpg"];
    const allowedExts = [".pdf", ".jpeg", ".jpg"];
    const fileExt = "." + file.name.split(".").pop()?.toLowerCase();

    if (!allowedTypes.includes(file.type.toLowerCase()) && !allowedExts.includes(fileExt)) {
      toast.error("Only PDF (.pdf) and JPEG (.jpeg, .jpg) files are allowed");
      e.target.value = "";
      return;
    }

=======
>>>>>>> origin/main
    setIsUploading(true);
    try {
      const response = await api.uploadSupplierDocument(type, file);
      const newDoc = {
        document_type: response.document_type,
        file_name: response.file_name,
        file_type: response.file_type,
        file_size: response.file_size,
        storage_path: response.storage_path,
        upload_id: response.upload_id,
      };
      setFormData((prev) => ({
        ...prev,
<<<<<<< HEAD
        // Replace existing document of the same type so only ONE document is kept per type
        documents: [...prev.documents.filter((d) => d.document_type !== type), newDoc],
=======
        documents: [...prev.documents, newDoc],
>>>>>>> origin/main
      }));
      toast.success(`${type} uploaded successfully`);
    } catch (e: any) {
      toast.error("Upload failed: " + e.message);
    } finally {
      setIsUploading(false);
      e.target.value = "";
    }
  };
  const removeDocument = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      documents: prev.documents.filter((_, i) => i !== index),
    }));
  };
  const toggleMainMaterial = (material: string) => {
    setFormData((prev) => {
      const current = prev.mainMaterials || [];
      const updated = current.includes(material)
        ? current.filter((m) => m !== material)
        : [...current, material];
      return { ...prev, mainMaterials: updated };
    });
  };
  const toggleCategory = (cat: string) => {
    setFormData((prev) => {
      const current = prev.category || [];
      const updated = current.includes(cat) ? current.filter((c) => c !== cat) : [...current, cat];
      return { ...prev, category: updated };
    });
  };
  const handleAddVendorType = async () => {
    if (!newVendorType.trim()) {
      toast.error("Please enter a vendor type name");
      return;
    }
    if (vendorTypes.includes(newVendorType.trim())) {
      toast.error("This vendor type already exists");
      return;
    }
    try {
      await api.createVendorType(newVendorType.trim());
      setVendorTypes((prev) => [...prev, newVendorType.trim()]);
      updateFormData("root", "vendorType", newVendorType.trim());
      setNewVendorType("");
      setShowAddVendorType(false);
      toast.success("Vendor type created", {
        description: `"${newVendorType.trim()}" has been added and selected.`,
      });
    } catch (e: any) {
      toast.error("Failed to save vendor type: " + e.message);
    }
  };
  const handleAddCategory = async () => {
    if (!newCategory.trim()) {
      toast.error("Please enter a category name");
      return;
    }
    if (categories.includes(newCategory.trim())) {
      toast.error("This category already exists");
      return;
    }
    try {
      await api.createSupplierCategory(newCategory.trim());
      setCategories((prev) => [...prev, newCategory.trim()]);
      toggleCategory(newCategory.trim());
      setNewCategory("");
      setShowAddCategory(false);
      toast.success("Category created", {
        description: `"${newCategory.trim()}" has been added to categories.`,
      });
    } catch (e: any) {
      toast.error("Failed to save category: " + e.message);
    }
  };
  const handleAddRawMaterial = async () => {
    if (!newRawMaterial.trim()) {
      toast.error("Please enter a material name");
      return;
    }
    if (rawMaterials.includes(newRawMaterial.trim())) {
      toast.error("This material already exists");
      return;
    }
    try {
      await api.createRawMaterial(newRawMaterial.trim());
      setRawMaterials((prev) => [...prev, newRawMaterial.trim()]);
      toggleMainMaterial(newRawMaterial.trim());
      setNewRawMaterial("");
      setShowAddRawMaterial(false);
      toast.success("Material created", {
        description: `"${newRawMaterial.trim()}" has been added to materials.`,
      });
    } catch (e: any) {
      toast.error("Failed to save material: " + e.message);
    }
  };
  const handleSubmit = async () => {
    setIsSubmitting(true);
    const step1Valid = await validateStep(1);
    const step2Valid = await validateStep(2);
    const step3Valid = await validateStep(3);
    const step4Valid = await validateStep(4);
    setIsSubmitting(false);
    if (!step1Valid || !step2Valid || !step3Valid || !step4Valid) {
      toast.error("Please fix errors in previous steps before submitting.");
      return;
    }
    const name = formData.supplierName.trim();
    const regName = formData.registeredCompanyName.trim();
    const industry = formData.industry.trim();
    const gstin = formData.gstin.trim();
    setIsSubmitting(true);
    try {
      const finalData = {
        ...formData,
        supplierName: name,
        registeredCompanyName: regName,
        industry: industry,
        gstin: gstin.toUpperCase(),
        address: {
          ...formData.address,
          registeredAddress: formData.address.registeredAddress.trim(),
          city: formData.address.city.trim(),
          pincode: formData.address.pincode.trim(),
        },
        contact: {
          ...formData.contact,
          primaryContactName: formData.contact.primaryContactName.trim(),
          primaryEmail: formData.contact.primaryEmail.trim(),
          phone: formData.contact.phone.trim(),
        },
      };
      await api.createSupplier(finalData);
      try {
        if (typeof window !== "undefined") {
          localStorage.removeItem(DRAFT_STORAGE_KEY);
        }
      } catch (_) {}
      toast.success("Company Profile Registered", {
        description: `Company profile for "${name}" registered successfully.`,
      });
      navigate({ to: "/procurement-dashboard" });
    } catch (error: any) {
      toast.error("Failed to register supplier", {
        description: error.message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  return (
    <AppShell
      title="Register New Supplier"
      subtitle="Complete the 5-step onboarding process to add a new vendor."
    >
      <div className="mx-auto max-w-4xl">
        <div className="mb-8 flex items-center justify-between">
          {steps.map((step, idx) => (
            <React.Fragment key={step.id}>
              <div className="flex flex-col items-center gap-2">
                <div
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all",
                    currentStep === step.id
                      ? "border-primary bg-primary text-primary-foreground shadow-glow"
                      : currentStep > step.id
                        ? "border-success bg-success text-success-foreground"
                        : "border-muted bg-muted text-muted-foreground",
                  )}
                >
                  {currentStep > step.id ? (
                    <CheckCircle2 className="h-5 w-5" />
                  ) : (
                    <step.icon className="h-5 w-5" />
                  )}
                </div>
                <span
                  className={cn(
                    "text-xs font-medium",
                    currentStep === step.id ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  {step.name}
                </span>
              </div>
              {idx < steps.length - 1 && (
                <div
                  className={cn(
                    "h-px flex-1 bg-muted transition-all",
                    currentStep > step.id && "bg-success",
                  )}
                />
              )}
            </React.Fragment>
          ))}
        </div>

        <Card className="p-6 shadow-soft">
          {currentStep === 1 && (
            <div className="space-y-4 animate-fade-in">
              <h3 className="text-lg font-semibold">Company Profile</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="supplierName">
                    Supplier Display Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="supplierName"
                    value={formData.supplierName}
                    onChange={(e) => {
                      const sanitized = e.target.value.replace(/[^a-zA-Z\s]/g, "");
                      updateFormData("root", "supplierName", sanitized);
                    }}
                    placeholder="e.g. Acme Corp"
                    className={cn(
                      errors.supplierName && "border-destructive focus-visible:ring-destructive",
                    )}
                  />
                  {errors.supplierName && (
                    <p className="text-[11px] font-medium text-destructive flex items-center gap-1">
                      <AlertCircle className="size-3" /> {errors.supplierName}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="regName">
                    Registered Company Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="regName"
                    value={formData.registeredCompanyName}
                    onChange={(e) => {
                      const sanitized = e.target.value.replace(/[^a-zA-Z\s]/g, "");
                      updateFormData("root", "registeredCompanyName", sanitized);
                    }}
                    placeholder="Full legal name"
                    className={cn(
                      errors.registeredCompanyName &&
                        "border-destructive focus-visible:ring-destructive",
                    )}
                  />
                  {errors.registeredCompanyName && (
                    <p className="text-[11px] font-medium text-destructive flex items-center gap-1">
                      <AlertCircle className="size-3" /> {errors.registeredCompanyName}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>
                    Vendor Type <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    onValueChange={(v) => updateFormData("root", "vendorType", v)}
                    value={formData.vendorType}
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
                      <div className="px-2 py-2 border-t border-border mt-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full justify-start text-primary font-bold h-8 px-2"
                          onClick={(e) => {
                            e.preventDefault();
                            setShowAddVendorType(true);
                          }}
                        >
                          <Plus className="mr-2 size-3" /> Add New Vendor Type
                        </Button>
                      </div>
                    </SelectContent>
                  </Select>
                  {errors.vendorType && (
                    <p className="text-[11px] font-medium text-destructive flex items-center gap-1">
                      <AlertCircle className="size-3" /> {errors.vendorType}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>
                    Category <span className="text-destructive">*</span>
                  </Label>
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
                          {formData.category?.length > 0
                            ? formData.category.join(", ")
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
                            onClick={() => toggleCategory(cat)}
                          >
                            <Checkbox
                              id={`cat-${cat}`}
                              checked={formData.category?.includes(cat)}
                              onCheckedChange={() => toggleCategory(cat)}
                            />
                            <Label htmlFor={`cat-${cat}`} className="text-sm cursor-pointer w-full">
                              {cat}
                            </Label>
                          </div>
                        ))}
                      </div>
                      <div className="p-2 border-t border-border">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full justify-start text-primary font-bold h-8 px-2"
                          onClick={(e) => {
                            e.preventDefault();
                            setShowAddCategory(true);
                          }}
                        >
                          <Plus className="mr-2 size-3" /> Add New Category
                        </Button>
                      </div>
                    </PopoverContent>
                  </Popover>
                  {errors.category && (
                    <p className="text-[11px] font-medium text-destructive flex items-center gap-1">
                      <AlertCircle className="size-3" /> {errors.category}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>
                    Main Raw Materials <span className="text-destructive">*</span>
                  </Label>
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
                          {formData.mainMaterials?.length > 0
                            ? formData.mainMaterials.join(", ")
                            : "Select materials"}
                        </span>
                        <ChevronRight className="ml-2 h-4 w-4 shrink-0 opacity-50 rotate-90" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[300px] p-0 rounded-xl" align="start">
                      <div className="p-2 space-y-1 max-h-[300px] overflow-y-auto">
                        {rawMaterials.map((mat) => (
                          <div
                            key={mat}
                            className="flex items-center space-x-2 p-2 hover:bg-muted rounded-lg cursor-pointer"
                            onClick={() => toggleMainMaterial(mat)}
                          >
                            <Checkbox
                              id={`mat-${mat}`}
                              checked={formData.mainMaterials?.includes(mat)}
                              onCheckedChange={() => toggleMainMaterial(mat)}
                            />
                            <Label htmlFor={`mat-${mat}`} className="text-sm cursor-pointer w-full">
                              {mat}
                            </Label>
                          </div>
                        ))}
                      </div>
                      <div className="p-2 border-t border-border">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full justify-start text-primary font-bold h-8 px-2"
                          onClick={(e) => {
                            e.preventDefault();
                            setShowAddRawMaterial(true);
                          }}
                        >
                          <Plus className="mr-2 size-3" /> Add New Material
                        </Button>
                      </div>
                    </PopoverContent>
                  </Popover>
                  {errors.mainMaterials && (
                    <p className="text-[11px] font-medium text-destructive flex items-center gap-1">
                      <AlertCircle className="size-3" /> {errors.mainMaterials}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="industry">
                    Industry <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="industry"
                    value={formData.industry}
                    onChange={(e) => updateFormData("root", "industry", e.target.value)}
                    placeholder="e.g. Chemical, Electronics"
                    className={cn(
                      errors.industry && "border-destructive focus-visible:ring-destructive",
                    )}
                  />
                  {errors.industry && (
                    <p className="text-[11px] font-medium text-destructive flex items-center gap-1">
                      <AlertCircle className="size-3" /> {errors.industry}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="gstin">
                    GSTIN <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="gstin"
                    value={formData.gstin}
                    maxLength={15}
                    onChange={(e) => {
                      const val = e.target.value.substring(0, 15);
                      updateFormData("root", "gstin", val);
                    }}
                    placeholder="15-digit GST number"
                    className={cn(
                      "font-mono",
                      errors.gstin && "border-destructive focus-visible:ring-destructive",
                    )}
                  />
                  {errors.gstin && (
                    <p className="text-[11px] font-medium text-destructive flex items-center gap-1">
                      <AlertCircle className="size-3" /> {errors.gstin}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-4 animate-fade-in">
              <h3 className="text-lg font-semibold">Address & Primary Contact</h3>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="address">Registered Address</Label>
                  <Textarea
                    id="address"
                    value={formData.address.registeredAddress}
                    onChange={(e) => updateFormData("address", "registeredAddress", e.target.value)}
                    placeholder="Plot no, Building, Street..."
                    className={cn(
                      errors["address.registeredAddress"] &&
                        "border-destructive focus-visible:ring-destructive",
                    )}
                  />
                  {errors["address.registeredAddress"] && (
                    <p className="text-[11px] font-medium text-destructive flex items-center gap-1">
                      <AlertCircle className="size-3" /> {errors["address.registeredAddress"]}
                    </p>
                  )}
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="city">
                      City <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="city"
                      value={formData.address.city}
                      onChange={(e) => updateFormData("address", "city", e.target.value)}
                      className={cn(
                        errors["address.city"] &&
                          "border-destructive focus-visible:ring-destructive",
                      )}
                    />
                    {errors["address.city"] && (
                      <p className="text-[11px] font-medium text-destructive flex items-center gap-1">
                        <AlertCircle className="size-3" /> {errors["address.city"]}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="state" className="flex items-center gap-2">
                      State <span className="text-destructive">*</span>
                      {isLookingUpState && (
                        <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
                      )}
                    </Label>
                    <Select
                      onValueChange={(v) => updateFormData("address", "state", v)}
                      value={formData.address.state}
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
<<<<<<< HEAD
=======
                    {stateLookupMessage && !errors["address.state"] && (
                      <p
                        className={cn(
                          "flex items-center gap-1 text-[11px] font-medium",
                          stateLookupMessage.startsWith("City and state selected")
                            ? "text-success"
                            : "text-muted-foreground",
                        )}
                      >
                        {stateLookupMessage.startsWith("City and state selected") ? (
                          <CheckCircle2 className="size-3" />
                        ) : (
                          <AlertCircle className="size-3" />
                        )}
                        {stateLookupMessage}
                      </p>
                    )}
>>>>>>> origin/main
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pincode">
                      Pincode <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="pincode"
                      value={formData.address.pincode}
                      maxLength={6}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, "").substring(0, 6);
                        updateFormData("address", "pincode", val);
                      }}
                      className={cn(
                        errors["address.pincode"] &&
                          "border-destructive focus-visible:ring-destructive",
                      )}
                      placeholder="6-digit PIN"
                    />
                    {errors["address.pincode"] && (
                      <p className="text-[11px] font-medium text-destructive flex items-center gap-1">
                        <AlertCircle className="size-3" /> {errors["address.pincode"]}
                      </p>
                    )}
                  </div>
                </div>
                <div className="border-t pt-4 mt-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="contactName">
                        Primary Contact Name <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="contactName"
                        value={formData.contact.primaryContactName}
                        onChange={(e) =>
                          updateFormData("contact", "primaryContactName", e.target.value)
                        }
                        className={cn(
                          errors["contact.primaryContactName"] &&
                            "border-destructive focus-visible:ring-destructive",
                        )}
                      />
                      {errors["contact.primaryContactName"] && (
                        <p className="text-[11px] font-medium text-destructive flex items-center gap-1">
                          <AlertCircle className="size-3" /> {errors["contact.primaryContactName"]}
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="designation">Designation</Label>
                      <Input
                        id="designation"
                        value={formData.contact.designation}
                        onChange={(e) => updateFormData("contact", "designation", e.target.value)}
                        className={cn(
                          errors["contact.designation"] &&
                            "border-destructive focus-visible:ring-destructive",
                        )}
                      />
                      {errors["contact.designation"] && (
                        <p className="text-[11px] font-medium text-destructive flex items-center gap-1">
                          <AlertCircle className="size-3" /> {errors["contact.designation"]}
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">
                        Phone <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="phone"
                        value={formData.contact.phone}
                        maxLength={10}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, "").substring(0, 10);
                          updateFormData("contact", "phone", val);
                        }}
                        className={cn(
                          errors["contact.phone"] &&
                            "border-destructive focus-visible:ring-destructive",
                        )}
                        placeholder="10-digit mobile number"
                      />
                      {errors["contact.phone"] && (
                        <p className="text-[11px] font-medium text-destructive flex items-center gap-1">
                          <AlertCircle className="size-3" /> {errors["contact.phone"]}
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="website">Website</Label>
                      <Input
                        id="website"
                        type="url"
                        value={formData.contact.website}
                        onChange={(e) => updateFormData("contact", "website", e.target.value)}
                        className={cn(
                          errors["contact.website"] &&
                            "border-destructive focus-visible:ring-destructive",
                        )}
                        placeholder="https://example.com"
                      />
                      {errors["contact.website"] && (
                        <p className="text-[11px] font-medium text-destructive flex items-center gap-1">
                          <AlertCircle className="size-3" /> {errors["contact.website"]}
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="primaryEmail">
                        Primary Email (Main) <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="primaryEmail"
                        type="email"
                        value={formData.contact.primaryEmail}
                        maxLength={128}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\s/g, "").substring(0, 128);
                          updateFormData("contact", "primaryEmail", val);
                          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                          if (val && !emailRegex.test(val)) {
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
                        placeholder="main@company.com"
                        className={cn(
                          errors["contact.primaryEmail"] &&
                            "border-destructive focus-visible:ring-destructive",
                        )}
                      />
                      {errors["contact.primaryEmail"] && (
                        <p className="text-[11px] font-medium text-destructive flex items-center gap-1">
                          <AlertCircle className="size-3" /> {errors["contact.primaryEmail"]}
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="secondaryEmail">Secondary Email (Reference)</Label>
                      <Input
                        id="secondaryEmail"
                        type="email"
                        value={formData.contact.secondaryEmail}
                        maxLength={128}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\s/g, "").substring(0, 128);
                          updateFormData("contact", "secondaryEmail", val);
                          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                          if (val && !emailRegex.test(val)) {
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
                        placeholder="reference@company.com"
                        className={cn(
                          errors["contact.secondaryEmail"] &&
                            "border-destructive focus-visible:ring-destructive",
                        )}
                      />
                      {errors["contact.secondaryEmail"] && (
                        <p className="text-[11px] font-medium text-destructive flex items-center gap-1">
                          <AlertCircle className="size-3" /> {errors["contact.secondaryEmail"]}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div className="space-y-4 animate-fade-in">
              <h3 className="text-lg font-semibold">Banking Information</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="bankName">
                    Bank Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="bankName"
                    value={formData.bankInfo.bankName}
                    onChange={(e) => updateFormData("bankInfo", "bankName", e.target.value)}
                    className={cn(
                      errors["bankInfo.bankName"] &&
                        "border-destructive focus-visible:ring-destructive",
                    )}
                  />
                  {errors["bankInfo.bankName"] && (
                    <p className="text-[11px] font-medium text-destructive flex items-center gap-1">
                      <AlertCircle className="size-3" /> {errors["bankInfo.bankName"]}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="accNo">
                    Account Number <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="accNo"
                    value={formData.bankInfo.accountNumber}
                    maxLength={18}
                    onChange={async (e) => {
                      const val = e.target.value.replace(/\D/g, "").substring(0, 18);
                      updateFormData("bankInfo", "accountNumber", val);
                      if (val.length >= 9) {
                        try {
                          const existence = await api.checkSupplierExistence({
                            account_number: val,
                          });
                          if (existence.account_number) {
                            setErrors((prev) => ({
                              ...prev,
                              ["bankInfo.accountNumber"]: "This account number already exists",
                            }));
                          } else {
                            setErrors((prev) => {
                              const next = { ...prev };
                              delete next["bankInfo.accountNumber"];
                              return next;
                            });
                          }
                        } catch (err) {
                          console.error("Runtime duplicate check failed", err);
                        }
                      }
                    }}
                    className={cn(
                      errors["bankInfo.accountNumber"] &&
                        "border-destructive focus-visible:ring-destructive",
                    )}
                  />
                  {errors["bankInfo.accountNumber"] && (
                    <p className="text-[11px] font-medium text-destructive flex items-center gap-1">
                      <AlertCircle className="size-3" /> {errors["bankInfo.accountNumber"]}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ifsc">
                    IFSC Code <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="ifsc"
                    value={formData.bankInfo.ifsc}
                    maxLength={11}
                    onChange={(e) => {
                      const val = e.target.value
                        .replace(/[^a-zA-Z0-9]/g, "")
                        .substring(0, 11)
                        .toUpperCase();
                      updateFormData("bankInfo", "ifsc", val);
                    }}
                    className={cn(
                      "font-mono",
                      errors["bankInfo.ifsc"] &&
                        "border-destructive focus-visible:ring-destructive",
                    )}
                    placeholder="e.g. SBIN0012345"
                  />
                  {errors["bankInfo.ifsc"] && (
                    <p className="text-[11px] font-medium text-destructive flex items-center gap-1">
                      <AlertCircle className="size-3" /> {errors["bankInfo.ifsc"]}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="holder">
                    Account Holder Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="holder"
                    value={formData.bankInfo.accountHolderName}
                    onChange={(e) =>
                      updateFormData("bankInfo", "accountHolderName", e.target.value)
                    }
                    className={cn(
                      errors["bankInfo.accountHolderName"] &&
                        "border-destructive focus-visible:ring-destructive",
                    )}
                  />
                  {errors["bankInfo.accountHolderName"] && (
                    <p className="text-[11px] font-medium text-destructive flex items-center gap-1">
                      <AlertCircle className="size-3" /> {errors["bankInfo.accountHolderName"]}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="branch">
                    Branch <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="branch"
                    value={formData.bankInfo.branch}
                    onChange={(e) => updateFormData("bankInfo", "branch", e.target.value)}
                    className={cn(
                      errors["bankInfo.branch"] &&
                        "border-destructive focus-visible:ring-destructive",
                    )}
                  />
                  {errors["bankInfo.branch"] && (
                    <p className="text-[11px] font-medium text-destructive flex items-center gap-1">
                      <AlertCircle className="size-3" /> {errors["bankInfo.branch"]}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="swiftBic">SWIFT / BIC</Label>
                  <Input
                    id="swiftBic"
                    value={formData.bankInfo.swiftBic}
                    maxLength={11}
                    onChange={(e) => {
                      const val = e.target.value
                        .replace(/[^a-zA-Z0-9]/g, "")
                        .substring(0, 11)
                        .toUpperCase();
                      updateFormData("bankInfo", "swiftBic", val);
                    }}
                    className={cn(
                      "font-mono",
                      errors["bankInfo.swiftBic"] &&
                        "border-destructive focus-visible:ring-destructive",
                    )}
                  />
                  {errors["bankInfo.swiftBic"] && (
                    <p className="text-[11px] font-medium text-destructive flex items-center gap-1">
                      <AlertCircle className="size-3" /> {errors["bankInfo.swiftBic"]}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tdsSection">TDS Section</Label>
                  <Select
                    onValueChange={(v) => updateFormData("bankInfo", "tdsSection", v)}
                    value={formData.bankInfo.tdsSection}
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
              </div>
            </div>
          )}

          {currentStep === 4 && (
            <div className="space-y-4 animate-fade-in">
              <h3 className="text-lg font-semibold">Supporting Documents</h3>
              <p className="text-sm text-muted-foreground">
                Upload copies of legal and tax documents for verification.
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[
                  { name: "GST Certificate", mandatory: true },
                  { name: "Cancelled Cheque", mandatory: true },
                  { name: "Vendor Code of Conduct", mandatory: false },
                  { name: "Other", mandatory: false },
                ].map((doc) => (
                  <div key={doc.name} className="relative">
                    <input
                      type="file"
                      id={`file-${doc.name}`}
                      accept=".pdf,.jpeg,.jpg,application/pdf,image/jpeg"
                      className="hidden"
                      onChange={(e) => handleFileUpload(e, doc.name)}
                      disabled={isUploading}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full h-24 flex-col gap-2 rounded-xl border-dashed border-2 hover:border-primary/50 hover:bg-primary/5"
                      onClick={() => document.getElementById(`file-${doc.name}`)?.click()}
                      disabled={isUploading}
                    >
                      {isUploading ? (
                        <Loader2 className="size-5 animate-spin" />
                      ) : formData.documents.some((d) => d.document_type === doc.name) ? (
                        <CheckCircle2 className="size-5 text-success" />
                      ) : (
                        <Plus className="size-5" />
                      )}
                      <span className="text-[10px] uppercase font-bold">
                        {doc.name} {doc.mandatory && <span className="text-destructive">*</span>}
                      </span>
                    </Button>
                  </div>
                ))}
              </div>

              {errors["documents"] && (
                <p className="text-[11px] font-medium text-destructive flex items-center gap-1">
                  <AlertCircle className="size-3" /> {errors["documents"]}
                </p>
              )}

              {formData.documents.length > 0 && (
                <div className="mt-8 space-y-2">
                  <Label className="text-xs text-muted-foreground">Uploaded Documents</Label>
                  <div className="grid gap-2">
<<<<<<< HEAD
                    {formData.documents.map((doc, idx) => {
                      const rawPath = doc.storage_path || doc.storagePath || "";
                      const docUrl = rawPath
                        ? rawPath.startsWith("http") || rawPath.startsWith("data:")
                          ? rawPath
                          : `http://localhost:8000${rawPath.startsWith("/") ? "" : "/"}${rawPath}`
                        : null;

                      return (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border/50 hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="size-8 shrink-0 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                              <FileIcon className="size-4" />
                            </div>
                            <div className="min-w-0">
                              <div className="text-sm font-medium truncate">{doc.file_name}</div>
                              <div className="text-[10px] text-muted-foreground uppercase">
                                {doc.document_type}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {docUrl && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-8 gap-1.5 px-2.5 text-xs text-primary hover:bg-primary/10 rounded-lg"
                                onClick={() => window.open(docUrl, "_blank", "noopener,noreferrer")}
                                title="View Document"
                              >
                                <Eye className="size-3.5" />
                                <span>View</span>
                              </Button>
                            )}
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-8 text-destructive hover:text-destructive hover:bg-destructive/10 rounded-lg"
                              onClick={() => removeDocument(idx)}
                              title="Delete Document"
                            >
                              <X className="size-4" />
                            </Button>
=======
                    {formData.documents.map((doc, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border/50"
                      >
                        <div className="flex items-center gap-3">
                          <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                            <FileIcon className="size-4" />
                          </div>
                          <div>
                            <div className="text-sm font-medium">{doc.file_name}</div>
                            <div className="text-[10px] text-muted-foreground uppercase">
                              {doc.document_type}
                            </div>
>>>>>>> origin/main
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {currentStep === 5 && (
            <div className="space-y-6 animate-fade-in">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Final Remarks</h3>
                <div className="space-y-2">
                  <Label htmlFor="remarks">Additional Information / Justification</Label>
                  <Textarea
                    id="remarks"
                    value={formData.remarks}
                    onChange={(e) => updateFormData("root", "remarks", e.target.value)}
                    placeholder="Enter any additional notes about this vendor..."
                    className="min-h-[120px] rounded-xl"
                  />
                </div>
              </div>

              <div className="rounded-2xl bg-muted/30 border border-border/50 p-5 space-y-4">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <AlertCircle className="size-4" />
                  <h4 className="text-xs font-bold uppercase tracking-wider">Audit Information</h4>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase text-muted-foreground font-bold">
                      Created By
                    </Label>
                    <div className="text-sm font-medium flex items-center gap-2">
                      <div className="size-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] text-primary font-bold">
                        P
                      </div>
                      Procurement Officer (Current Session)
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase text-muted-foreground font-bold">
                      Registration Date
                    </Label>
                    <div className="text-sm font-medium">
                      {new Date().toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="mt-8 flex items-center justify-between border-t pt-6">
            <Button
              variant="ghost"
              onClick={handleBack}
              disabled={currentStep === 1 || isSubmitting}
            >
              <ChevronLeft className="mr-2 h-4 w-4" /> Back
            </Button>

            {currentStep < 5 ? (
              <Button onClick={handleNext} className="shadow-glow" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Next <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                className="bg-success hover:bg-success/90 shadow-glow"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Registering...
                  </>
                ) : (
                  <>
                    Submit Registration <CheckCircle2 className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            )}
          </div>
        </Card>
      </div>
      <Dialog open={showAddVendorType} onOpenChange={setShowAddVendorType}>
        <DialogContent className="sm:max-w-[425px] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="size-5 text-primary" />
              Add Custom Vendor Type
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="custom-vendor-type">Vendor Type Name</Label>
              <Input
                id="custom-vendor-type"
                placeholder="e.g. OEM, Logistics Partner"
                value={newVendorType}
                onChange={(e) => setNewVendorType(e.target.value)}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowAddVendorType(false)}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button onClick={handleAddVendorType} className="rounded-xl bg-primary shadow-glow">
              Add Vendor Type
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showAddCategory} onOpenChange={setShowAddCategory}>
        <DialogContent className="sm:max-w-[425px] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="size-5 text-primary" />
              Add Custom Category
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="custom-category">Category Name</Label>
              <Input
                id="custom-category"
                placeholder="e.g. Chemicals, Electronics"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowAddCategory(false)}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button onClick={handleAddCategory} className="rounded-xl bg-primary shadow-glow">
              Add Category
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showAddRawMaterial} onOpenChange={setShowAddRawMaterial}>
        <DialogContent className="sm:max-w-[425px] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="size-5 text-primary" />
              Add Custom Raw Material
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="custom-material">Material Name</Label>
              <Input
                id="custom-material"
                placeholder="e.g. Rare Earth Metals, High-Grade Steel"
                value={newRawMaterial}
                onChange={(e) => setNewRawMaterial(e.target.value)}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowAddRawMaterial(false)}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button onClick={handleAddRawMaterial} className="rounded-xl bg-primary shadow-glow">
              Add Material
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
