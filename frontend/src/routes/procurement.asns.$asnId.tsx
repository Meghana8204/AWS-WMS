import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  Truck,
  Calendar,
  Package,
  User,
  Phone,
  Clock,
  CheckCircle2,
  Loader2,
  Navigation,
  FileText,
  Download,
  Building2,
  Pencil,
  X,
  RefreshCw,
} from "lucide-react";
import { AppShell, StatusBadge } from "@/components/wms/app-shell";
import { SectionCard, Field } from "@/components/wms/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api-client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
export const Route = createFileRoute("/procurement/asns/$asnId")({
  component: AsnTracking,
});
function AsnTracking() {
  const { asnId } = Route.useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [asn, setAsn] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [editData, setEditData] = useState<any>(null);
  const refreshAsn = useCallback(
    async (showLoader = false) => {
      try {
        if (showLoader) setRefreshing(true);
        const data = await api.getAsn(asnId);
        setAsn(data);
      } catch (error: any) {
        console.error("Failed to refresh ASN:", error);
        if (showLoader) toast.error("Failed to refresh ASN", { description: error.message });
      } finally {
        if (showLoader) setRefreshing(false);
      }
    },
    [asnId],
  );
  const beginEditing = () => {
    setEditData({
      shipment_date: asn.shipmentDate || "",
      expected_arrival_at: asn.expectedArrivalAt
        ? new Date(asn.expectedArrivalAt).toISOString().slice(0, 16)
        : "",
      vehicle_number: asn.vehicleNumber || "",
      driver_name: asn.driverName || "",
      driver_contact: asn.driverContact || "",
      transporter: asn.transporter || "",
      number_of_packages: asn.numberOfPackages ?? "",
      package_type: asn.packageType || "",
      lines: (asn.lines || []).map((line: any) => ({
        item_code: line.itemCode,
        material_name: line.materialName,
        shipped_quantity: line.shippedQuantity,
        uom: line.uom || "PCS",
      })),
    });
    setEditing(true);
  };
  const handleResubmit = async () => {
    if (!editData.expected_arrival_at || !editData.vehicle_number) {
      toast.error("Vehicle number and expected arrival are required");
      return;
    }
    setSaving(true);
    try {
      const updated = await api.updateAsn(asnId, {
        asn_number: asn.asnNumber,
        po_id: asn.poId,
        po_number: asn.poNumber,
        shipment_date: editData.shipment_date || null,
        expected_arrival_at: new Date(editData.expected_arrival_at).toISOString(),
        vehicle_number: editData.vehicle_number,
        driver_name: editData.driver_name,
        driver_contact: editData.driver_contact,
        transporter: editData.transporter,
        number_of_packages: parseInt(editData.number_of_packages) || 0,
        package_type: editData.package_type,
        status: "DISPATCHED",
        documents: (asn.documents || []).map((document: any) => ({
          document_type: document.documentType,
          file_name: document.fileName,
          file_url: document.fileUrl,
          uploaded_by: document.uploadedBy,
          uploaded_at: document.uploadedAt,
        })),
        lines: editData.lines,
      });
      setAsn(updated);
      setEditing(false);
      toast.success("ASN re-submitted successfully");
      navigate({ to: "/supplier-dashboard" });
    } catch (error: any) {
      toast.error("Failed to re-submit ASN", { description: error.message });
    } finally {
      setSaving(false);
    }
  };
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const userInfo = localStorage.getItem("user_info");
        if (userInfo) {
          setUser(JSON.parse(userInfo));
        }
        const data = await api.getAsn(asnId);
        setAsn(data);
      } catch (error) {
        console.error("Failed to fetch ASN:", error);
        toast.error("Failed to load tracking data");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [asnId]);
  useEffect(() => {
    if (editing) return;
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") refreshAsn();
    };
    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    const refreshTimer = window.setInterval(() => refreshAsn(), 10000);
    return () => {
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      window.clearInterval(refreshTimer);
    };
  }, [editing, refreshAsn]);
  if (loading) {
    return (
      <AppShell title="Loading Tracking Data..." subtitle="Please wait">
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="size-8 animate-spin text-primary" />
        </div>
      </AppShell>
    );
  }
  if (!asn) return null;
  const eta = asn.expectedArrivalAt ? new Date(asn.expectedArrivalAt) : null;
  const isNear =
    eta && eta.getTime() - Date.now() < 12 * 60 * 60 * 1000 && eta.getTime() - Date.now() > 0;
  const operationalStatus = asn.warehouseStatus || asn.status;
  const statusOrder = [
    "SUBMITTED",
    "DISPATCHED",
    "GATE_ENTRY_APPROVED",
    "AWAITING_DOCK",
    "DOCK_ASSIGNED",
    "MOVING_TO_DOCK",
    "AT_DOCK",
    "UNLOADING_IN_PROGRESS",
    "QUALITY_INSPECTION_REQUIRED",
    "QUALITY_PASSED",
    "RECEIVING_COMPLETED",
  ];
  const currentStatusIndex = statusOrder.indexOf(operationalStatus);
  const stepStatus = (activeStatuses: string[], completedAt: string) => {
    if (activeStatuses.includes(operationalStatus)) return "Active";
    const completedIndex = statusOrder.indexOf(completedAt);
    return currentStatusIndex > completedIndex ? "Completed" : "Pending";
  };
  const steps = [
    { label: "Shipment Dispatched", status: "Completed", date: asn.shipmentDate },
    {
      label: "Real-time Tracking",
      status: stepStatus(["SUBMITTED", "DISPATCHED"], "DISPATCHED"),
      date: isNear ? "Nearing Warehouse" : "GPS Signal Online",
      icon: <Navigation className="size-3.5 fill-current" />,
    },
    {
      label: "At Warehouse Gate",
      status: stepStatus(["GATE_ENTRY_APPROVED", "AWAITING_DOCK"], "AWAITING_DOCK"),
      date: asn.warehouseStatusUpdatedAt,
    },
    {
      label: "Dock Assigned",
      status: stepStatus(["DOCK_ASSIGNED", "MOVING_TO_DOCK"], "MOVING_TO_DOCK"),
      date: asn.assignedDockId || "-",
    },
    {
      label: "At Dock",
      status: stepStatus(["AT_DOCK"], "AT_DOCK"),
      date: asn.assignedDockId || "-",
    },
    {
      label: "Unloading / Quality",
      status: stepStatus(
        ["UNLOADING_IN_PROGRESS", "QUALITY_INSPECTION_REQUIRED", "QUALITY_PASSED"],
        "QUALITY_PASSED",
      ),
      date: asn.warehouseStatusUpdatedAt,
    },
    {
      label: "Goods Received",
      status: operationalStatus === "RECEIVING_COMPLETED" ? "Completed" : "Pending",
      date: operationalStatus === "RECEIVING_COMPLETED" ? asn.warehouseStatusUpdatedAt : "-",
    },
  ];
  const isSupplier = user?.roles?.includes("SUPPLIER");
  return (
    <AppShell
      title={isSupplier ? `ASN Details: ${asn.asnNumber}` : `Tracking Shipment: ${asn.asnNumber}`}
      subtitle={
        isSupplier
          ? `PO Ref: ${asn.poNumber} · ${asn.transporter || "Standard Freight"}`
          : `Supplier: ${asn.supplierName || "N/A"} · PO Ref: ${asn.poNumber} · ${asn.transporter || "Standard Freight"}`
      }
      actions={
        <div className="flex items-center gap-2">
          {!isSupplier && (
            <>
              <Button variant="outline" className="rounded-xl" asChild>
                <Link to="/procurement/asns">
                  <ArrowLeft className="mr-2 size-4" /> Back to List
                </Link>
              </Button>
              <Button
                variant="outline"
                className="rounded-xl"
                onClick={() => refreshAsn(true)}
                disabled={refreshing}
              >
                <RefreshCw className={`mr-2 size-4 ${refreshing ? "animate-spin" : ""}`} /> Refresh
              </Button>
            </>
          )}
          {isSupplier && (
            <Button variant="outline" className="rounded-xl" onClick={() => window.history.back()}>
              <ArrowLeft className="mr-2 size-4" /> Back
            </Button>
          )}
          {editing ? (
            <Button variant="outline" className="rounded-xl" onClick={() => setEditing(false)}>
              <X className="mr-2 size-4" /> Cancel
            </Button>
          ) : (
            isSupplier && (
              <Button className="rounded-xl" onClick={beginEditing}>
                <Pencil className="mr-2 size-4" /> Edit
              </Button>
            )
          )}
        </div>
      }
    >
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {!isSupplier && (
            <Card className="border-border/40 shadow-soft">
              <CardHeader className="bg-muted/10 border-b border-border/60 py-4">
                <div className="flex items-center gap-2">
                  <Clock className="size-4 text-primary" />
                  <CardTitle className="text-sm font-bold uppercase tracking-wider">
                    Status Timeline
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-6">
                  {steps.map((step, idx) => (
                    <div key={idx} className="flex gap-4 relative">
                      {idx < steps.length - 1 && (
                        <div
                          className={cn(
                            "absolute left-[11px] top-6 w-0.5 h-10 bg-border/40",
                            step.status === "Completed" && "bg-primary",
                          )}
                        />
                      )}
                      <div
                        className={cn(
                          "size-6 rounded-full border-2 flex items-center justify-center z-10 bg-background",
                          step.status === "Completed"
                            ? "border-primary bg-primary text-white"
                            : step.status === "Active"
                              ? "border-primary text-primary animate-pulse"
                              : "border-border text-muted-foreground",
                        )}
                      >
                        {step.status === "Completed" ? (
                          <CheckCircle2 className="size-3.5" />
                        ) : (
                          (step as any).icon || <div className="size-1.5 rounded-full bg-current" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <p
                            className={cn(
                              "text-sm font-bold",
                              step.status === "Pending"
                                ? "text-muted-foreground"
                                : "text-foreground",
                            )}
                          >
                            {step.label}
                          </p>
                          <p className="text-[10px] text-muted-foreground font-mono">
                            {step.date && !isNaN(new Date(step.date).getTime())
                              ? new Date(step.date).toLocaleString()
                              : step.date || "-"}
                          </p>
                        </div>
                        <p className="text-[11px] text-muted-foreground">{step.status}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <SectionCard title="Shipped Materials" icon={Package}>
            {editing && (
              <div className="grid gap-4 pb-5 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Shipment Date</Label>
                  <Input
                    type="date"
                    min={new Date().toISOString().split("T")[0]}
                    value={editData.shipment_date}
                    onChange={(event) =>
                      setEditData({ ...editData, shipment_date: event.target.value })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Expected Arrival</Label>
                  <Input
                    type="datetime-local"
                    min={new Date().toISOString().slice(0, 16)}
                    value={editData.expected_arrival_at}
                    onChange={(event) =>
                      setEditData({ ...editData, expected_arrival_at: event.target.value })
                    }
                    required
                  />
                </div>
              </div>
            )}
            <div className="mt-2 -mx-5 overflow-x-auto px-5">
              <table className="w-full min-w-[500px] text-sm text-left">
                <thead className="bg-muted/30 border-b border-border/60 text-[10px] uppercase font-bold text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Material</th>
                    <th className="px-4 py-3 text-right">Qty</th>
                    <th className="px-4 py-3 text-right">UOM</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {asn.lines?.map((line: any, idx: number) => (
                    <tr key={idx} className="hover:bg-muted/5 transition-colors">
                      <td className="px-4 py-3 font-medium">
                        <p className="font-bold">{line.materialName || "Material"}</p>
                        <p className="font-mono text-[10px] text-muted-foreground">
                          {line.itemCode}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-primary">
                        {line.shippedQuantity}
                      </td>
                      <td className="px-4 py-3 text-right text-muted-foreground">{line.uom}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </div>

        <div className="space-y-6">
          <SectionCard title="Logistics Carrier" icon={Truck}>
            <div className="space-y-4">
              {!editing && asn.warehouseStatus && (
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Warehouse Manager Update
                  </p>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <StatusBadge status={asn.warehouseStatus} />
                    <span className="text-[10px] text-muted-foreground">
                      {asn.warehouseStatusUpdatedAt
                        ? new Date(asn.warehouseStatusUpdatedAt).toLocaleString()
                        : "Live status"}
                    </span>
                  </div>
                  {asn.assignedDockId && (
                    <p className="mt-2 text-xs font-semibold">
                      Assigned dock: {asn.assignedDockId}
                    </p>
                  )}
                </div>
              )}
              {editing ? (
                <>
                  {[
                    ["Transporter", "transporter", "text"],
                    ["Vehicle Number", "vehicle_number", "text"],
                    ["Package Count", "number_of_packages", "number"],
                    ["Package Type", "package_type", "text"],
                  ].map(([label, field, type]) => (
                    <div className="space-y-1.5" key={field}>
                      <Label>{label}</Label>
                      <Input
                        type={type}
                        value={editData[field]}
                        onChange={(event) =>
                          setEditData({ ...editData, [field]: event.target.value })
                        }
                      />
                    </div>
                  ))}
                </>
              ) : (
                <>
                  <Field
                    label="Transporter"
                    value={asn.transporter || "Not Specified"}
                    icon={Building2}
                  />
                  <Field label="Vehicle Number" value={asn.vehicleNumber} mono icon={Navigation} />
                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <Field label="Pkg Count" value={asn.numberOfPackages || "0"} />
                    <Field label="Pkg Type" value={asn.packageType || "-"} />
                  </div>
                </>
              )}
            </div>
          </SectionCard>

          <SectionCard title="Driver Details" icon={User}>
            <div className="space-y-4">
              {editing ? (
                <>
                  <div className="space-y-1.5">
                    <Label>Driver Name</Label>
                    <Input
                      value={editData.driver_name}
                      onChange={(event) =>
                        setEditData({ ...editData, driver_name: event.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Driver Contact</Label>
                    <Input
                      value={editData.driver_contact}
                      onChange={(event) =>
                        setEditData({ ...editData, driver_contact: event.target.value })
                      }
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-4 p-4 rounded-xl bg-muted/20 border border-border/40">
                    <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                      <User className="size-6" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-foreground">
                        {asn.driverName || "Unknown Driver"}
                      </p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Phone className="size-3" /> {asn.driverContact || "No Contact"}
                      </p>
                    </div>
                  </div>
                  <Button className="w-full rounded-xl bg-success hover:bg-success/90 h-11 font-bold">
                    <Phone className="size-4 mr-2" /> Call Driver
                  </Button>
                </>
              )}
            </div>
          </SectionCard>

          <SectionCard title="Documents" icon={FileText}>
            <div className="space-y-2">
              {asn.documents?.length > 0 ? (
                asn.documents.map((doc: any, i: number) => (
                  <button
                    key={i}
                    className="w-full flex items-center justify-between p-3 rounded-xl border border-border/60 hover:bg-muted/30 transition-colors text-left"
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="size-4 text-primary" />
                      <div>
                        <p className="text-xs font-bold truncate max-w-[120px]">{doc.fileName}</p>
                        <p className="text-[10px] text-muted-foreground uppercase">
                          {doc.documentType}
                        </p>
                      </div>
                    </div>
                    <Download className="size-4 text-muted-foreground" />
                  </button>
                ))
              ) : (
                <div className="py-8 text-center text-xs text-muted-foreground italic border-2 border-dashed rounded-xl border-border/40">
                  No shipping documents attached.
                </div>
              )}
            </div>
          </SectionCard>
        </div>
      </div>
      {editing && (
        <div className="mt-6 flex justify-end">
          <Button
            className="h-12 rounded-xl px-8 shadow-glow"
            onClick={handleResubmit}
            disabled={saving}
          >
            {saving ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <CheckCircle2 className="mr-2 size-4" />
            )}
            Re-submit ASN
          </Button>
        </div>
      )}
    </AppShell>
  );
}
