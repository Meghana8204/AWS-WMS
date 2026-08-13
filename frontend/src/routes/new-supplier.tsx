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
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api-client";

export const Route = createFileRoute("/new-supplier")({
  component: NewSupplier,
});

const steps = [
  { id: 1, name: "Company Profile", icon: Building2 },
  { id: 2, name: "Address & Contact", icon: FileText },
  { id: 3, name: "Banking & Remarks", icon: CreditCard },
];

function NewSupplier() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = React.useState(1);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Form State
  const [formData, setFormData] = React.useState({
    supplierName: "",
    registeredCompanyName: "",
    vendorType: "",
    category: "",
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
      email: "",
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
    remarks: "",
  });

  const updateFormData = (section: string, field: string, value: string) => {
    if (section === "root") {
      setFormData((prev) => ({ ...prev, [field]: value }));
    } else {
      setFormData((prev: any) => ({
        ...prev,
        [section]: {
          ...prev[section],
          [field]: value,
        },
      }));
    }
  };

  const handleNext = () => {
    if (currentStep < 3) setCurrentStep(currentStep + 1);
  };

  const handleBack = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await api.createSupplier(formData);
      toast.success("Supplier registered successfully", {
        description: `${formData.supplierName} has been added to the system.`,
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
      subtitle="Complete the 4-step onboarding process to add a new vendor."
    >
      <div className="mx-auto max-w-4xl">
        {/* Step Indicator */}
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
                      : "border-muted bg-muted text-muted-foreground"
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
                    currentStep === step.id ? "text-primary" : "text-muted-foreground"
                  )}
                >
                  {step.name}
                </span>
              </div>
              {idx < steps.length - 1 && (
                <div
                  className={cn(
                    "h-px flex-1 bg-muted transition-all",
                    currentStep > step.id && "bg-success"
                  )}
                />
              )}
            </React.Fragment>
          ))}
        </div>

        <Card className="p-6 shadow-soft">
          {/* Step 1: Company Profile */}
          {currentStep === 1 && (
            <div className="space-y-4 animate-fade-in">
              <h3 className="text-lg font-semibold">Company Profile</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="supplierName">Supplier Display Name</Label>
                  <Input
                    id="supplierName"
                    value={formData.supplierName}
                    onChange={(e) => updateFormData("root", "supplierName", e.target.value)}
                    placeholder="e.g. Acme Corp"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="regName">Registered Company Name</Label>
                  <Input
                    id="regName"
                    value={formData.registeredCompanyName}
                    onChange={(e) => updateFormData("root", "registeredCompanyName", e.target.value)}
                    placeholder="Full legal name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Vendor Type</Label>
                  <Select
                    onValueChange={(v) => updateFormData("root", "vendorType", v)}
                    defaultValue={formData.vendorType}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Manufacturer">Manufacturer</SelectItem>
                      <SelectItem value="Distributor">Distributor</SelectItem>
                      <SelectItem value="Service Provider">Service Provider</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select
                    onValueChange={(v) => updateFormData("root", "category", v)}
                    defaultValue={formData.category}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Raw Materials">Raw Materials</SelectItem>
                      <SelectItem value="Packaging">Packaging</SelectItem>
                      <SelectItem value="Finished Goods">Finished Goods</SelectItem>
                      <SelectItem value="Consumables">Consumables</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="industry">Industry</Label>
                  <Input
                    id="industry"
                    value={formData.industry}
                    onChange={(e) => updateFormData("root", "industry", e.target.value)}
                    placeholder="e.g. Chemical, Electronics"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="gstin">GSTIN</Label>
                  <Input
                    id="gstin"
                    value={formData.gstin}
                    onChange={(e) => updateFormData("root", "gstin", e.target.value)}
                    placeholder="15-digit GST number"
                    className="font-mono"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Address & Contact */}
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
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      value={formData.address.city}
                      onChange={(e) => updateFormData("address", "city", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="state">State</Label>
                    <Input
                      id="state"
                      value={formData.address.state}
                      onChange={(e) => updateFormData("address", "state", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pincode">Pincode</Label>
                    <Input
                      id="pincode"
                      value={formData.address.pincode}
                      onChange={(e) => updateFormData("address", "pincode", e.target.value)}
                    />
                  </div>
                </div>
                <div className="border-t pt-4 mt-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="contactName">Primary Contact Name</Label>
                      <Input
                        id="contactName"
                        value={formData.contact.primaryContactName}
                        onChange={(e) => updateFormData("contact", "primaryContactName", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="designation">Designation</Label>
                      <Input id="designation" value={formData.contact.designation} onChange={(e) => updateFormData("contact", "designation", e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone</Label>
                      <Input id="phone" value={formData.contact.phone} onChange={(e) => updateFormData("contact", "phone", e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="website">Website</Label>
                      <Input id="website" type="url" value={formData.contact.website} onChange={(e) => updateFormData("contact", "website", e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email Address</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.contact.email}
                        onChange={(e) => updateFormData("contact", "email", e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Banking & Tax */}
          {currentStep === 3 && (
            <div className="space-y-4 animate-fade-in">
              <h3 className="text-lg font-semibold">Banking Information & Remarks</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="bankName">Bank Name</Label>
                  <Input
                    id="bankName"
                    value={formData.bankInfo.bankName}
                    onChange={(e) => updateFormData("bankInfo", "bankName", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="accNo">Account Number</Label>
                  <Input
                    id="accNo"
                    value={formData.bankInfo.accountNumber}
                    onChange={(e) => updateFormData("bankInfo", "accountNumber", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ifsc">IFSC Code</Label>
                  <Input
                    id="ifsc"
                    value={formData.bankInfo.ifsc}
                    onChange={(e) => updateFormData("bankInfo", "ifsc", e.target.value)}
                    className="font-mono"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="holder">Account Holder Name</Label>
                  <Input
                    id="holder"
                    value={formData.bankInfo.accountHolderName}
                    onChange={(e) => updateFormData("bankInfo", "accountHolderName", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="branch">Branch</Label>
                  <Input id="branch" value={formData.bankInfo.branch} onChange={(e) => updateFormData("bankInfo", "branch", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="swiftBic">SWIFT / BIC</Label>
                  <Input id="swiftBic" value={formData.bankInfo.swiftBic} onChange={(e) => updateFormData("bankInfo", "swiftBic", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tdsSection">TDS Section</Label>
                  <Input id="tdsSection" value={formData.bankInfo.tdsSection} onChange={(e) => updateFormData("bankInfo", "tdsSection", e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="remarks">Remarks</Label>
                <Textarea
                  id="remarks"
                  value={formData.remarks}
                  onChange={(e) => updateFormData("root", "remarks", e.target.value)}
                  placeholder="Any additional information..."
                />
              </div>
            </div>
          )}

          {/* Controls */}
          <div className="mt-8 flex items-center justify-between border-t pt-6">
            <Button
              variant="ghost"
              onClick={handleBack}
              disabled={currentStep === 1 || isSubmitting}
            >
              <ChevronLeft className="mr-2 h-4 w-4" /> Back
            </Button>

            {currentStep < 3 ? (
              <Button onClick={handleNext} className="shadow-glow">
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
    </AppShell>
  );
}
