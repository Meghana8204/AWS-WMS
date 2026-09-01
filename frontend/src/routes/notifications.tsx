import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Truck, Inbox, Loader2, FileText, AlertTriangle, Camera, X } from "lucide-react";
import { AppShell, DockAllocationNotificationCard } from "@/components/wms/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { requireAuth } from "@/lib/auth-utils";

export const Route = createFileRoute("/notifications")({
  beforeLoad: () => requireAuth(),
  component: Notifications,
});

function parseDamageNotificationMessage(msg?: string) {
  if (!msg) return { grnNumber: "", poNumber: "", supplierName: "", warehouseName: "", reportedBy: "", customRemarks: "", items: [] };

  const grnMatch = msg.match(/GRN:\s*([^\s|\n]+)/i) || msg.match(/for GRN\s+([^\s|\n]+)/i);
  const poMatch = msg.match(/PO:\s*([^\s|\n]+)/i) || msg.match(/against PO\s+([^\s|\.\n]+)/i);
  const supplierMatch = msg.match(/Supplier:\s*([^|\n]+)/i);
  const warehouseMatch = msg.match(/Warehouse:\s*([^|\n]+)/i);
  const remarksMatch = msg.match(/Inspector Remarks:\s*([^\n]+)/i);

  const items: { material: string; quantity: string; reason: string }[] = [];
  const lines = msg.split("\n");
  let inItems = false;
  for (const line of lines) {
    if (line.toLowerCase().includes("damaged items:")) {
      inItems = true;
      continue;
    }
    if (inItems && line.trim().startsWith("•")) {
      const cleanLine = line.trim().replace(/^•\s*/, "");
      const parts = cleanLine.split("|").map((p) => p.trim());
      const mat = parts[0] || "Material Item";
      const qty = parts.find((p) => p.toLowerCase().startsWith("qty:"))?.replace(/^qty:\s*/i, "") || "Recorded Qty";
      const rsn = parts.find((p) => p.toLowerCase().startsWith("reason:"))?.replace(/^reason:\s*/i, "") || (remarksMatch ? remarksMatch[1] : "Damaged / Rejected");
      items.push({ material: mat, quantity: qty, reason: rsn });
    }
  }

  return {
    grnNumber: grnMatch ? grnMatch[1] : "GRN-2026-0001",
    poNumber: poMatch ? poMatch[1] : "PO-1001",
    supplierName: supplierMatch ? supplierMatch[1].trim() : "Supplier",
    warehouseName: warehouseMatch ? warehouseMatch[1].trim() : "Main Warehouse",
    reportedBy: "GRN Quality Inspector",
    customRemarks: remarksMatch ? remarksMatch[1].trim() : "",
    items: items.length > 0 ? items : [{ material: "Damaged Material Item", quantity: "Recorded Qty", reason: "Damaged during receiving inspection" }],
  };
}

function parseGrnNotificationDetails(n: any) {
  if (!n) return null;
  const msg = n.message || "";
  const title = n.title || "";

  const grnMatch = msg.match(/GRN:\s*([^\s|\n]+)/i) || msg.match(/GRN Draft Created:\s*([^\s|\n]+)/i) || msg.match(/(GRN-[A-Za-z0-9-]+)/i);
  const poMatch = msg.match(/PO:\s*([^\s|\n]+)/i) || msg.match(/(PO-[A-Za-z0-9-]+)/i);
  const supplierMatch = msg.match(/Supplier:\s*([^|\n]+)/i);
  const vehicleMatch = msg.match(/vehicle:\s*([^\s|\n,]+)/i) || msg.match(/Vehicle:\s*([^\s|\n,]+)/i) || msg.match(/for\s+([A-Z0-9-]+)\s+at/i);
  const dockMatch = msg.match(/at\s+([A-Z0-9-]+)\s+has/i) || msg.match(/Dock:\s*([^\s|\n]+)/i);

  const grnNumber = n.grn_number || n.grnNumber || (grnMatch ? grnMatch[1] : null);
  const poNumber = n.po_number || n.poNumber || (poMatch ? poMatch[1] : null);
  const supplierName = n.supplier_name || n.supplierName || (supplierMatch ? supplierMatch[1].trim() : null);
  const vehicleNumber = n.vehicle_number || n.vehicleNumber || (vehicleMatch ? vehicleMatch[1].trim() : null);
  const dockCode = n.dock_code || n.dockCode || (dockMatch ? dockMatch[1].trim() : null);

  let statusText = "Goods Receiving";
  if (title.toLowerCase().includes("draft")) statusText = "GRN Draft Created";
  else if (title.toLowerCase().includes("posted")) statusText = "GRN Posted";
  else if (title.toLowerCase().includes("required")) statusText = "Quality Inspection Required";
  else if (title.toLowerCase().includes("pass")) statusText = "Quality Inspection Passed";
  else if (title.toLowerCase().includes("fail") || title.toLowerCase().includes("damage")) statusText = "Quality Failed / Damaged";
  else if (title.toLowerCase().includes("completed")) statusText = "Receiving Completed";

  return {
    title,
    grnNumber,
    poNumber,
    supplierName,
    vehicleNumber,
    dockCode,
    statusText,
    created_at: n.created_at || n.createdAt,
    message: msg,
    link: n.link,
  };
}

function Notifications() {
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [userRole, setUserRole] = useState("WAREHOUSE");

  // Modal State for Damaged Goods Details
  const [showDamageModal, setShowDamageModal] = useState(false);
  const [selectedDamageNotif, setSelectedDamageNotif] = useState<any | null>(null);
  const [enlargedPhoto, setEnlargedPhoto] = useState<string | null>(null);

  // Modal State for GRN & Quality Notification Details
  const [showGrnModal, setShowGrnModal] = useState(false);
  const [selectedGrnNotif, setSelectedGrnNotif] = useState<any | null>(null);

  useEffect(() => {
    const info = localStorage.getItem("user_info");
    const roles = info ? JSON.parse(info).roles || [] : [];
    const role = roles.includes("SUPPLIER")
      ? "SUPPLIER"
      : roles.includes("FINANCE")
        ? "FINANCE"
        : roles.includes("PROCUREMENT")
          ? "PROCUREMENT"
          : "WAREHOUSE";
    setUserRole(role);
    void fetchData(role, false);
    const timer = window.setInterval(() => void fetchData(role, true), 2000);
    const refresh = () => void fetchData(role, true);
    window.addEventListener("focus", refresh);
    window.addEventListener("notifications:refresh", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("notifications:refresh", refresh);
    };
  }, []);

  const fetchData = async (role: string, quiet = false) => {
    try {
      if (!quiet) setLoading(true);
      if (role === "WAREHOUSE") {
        const [arrivalData, workflowData] = await Promise.all([
          api.getArrivalNotifications(),
          api.getNotifications("WAREHOUSE"),
        ]);
        const arrivals = (Array.isArray(arrivalData) ? arrivalData : []).map((n: any) => ({
          id: n?.id,
          title: "Arrival Notification",
          message:
            n?.message ||
            `Truck ${n?.vehicleNumber || n?.vehicle_number || "not assigned"} from ${n?.supplierName || n?.supplier_name || "supplier not available"} is arriving.`,
          created_at:
            n?.createdAt || n?.created_at || n?.expectedArrivalTime || n?.expected_arrival_time,
          type: "arrival",
          is_read: (n?.status || "").toUpperCase() === "ACKNOWLEDGED",
          po_number: n?.poNumber || n?.po_number,
          supplier_name: n?.supplierName || n?.supplier_name,
        }));
        const workflows = Array.isArray(workflowData) ? workflowData : [];
        setNotifications(
          [...workflows, ...arrivals].sort(
            (a: any, b: any) =>
              new Date(b.created_at || b.createdAt || 0).getTime() -
              new Date(a.created_at || a.createdAt || 0).getTime(),
          ),
        );
      } else {
        const data = await api.getNotifications(role);
        setNotifications(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      if (!quiet) console.warn("Failed to fetch notifications", error);
    } finally {
      if (!quiet) setLoading(false);
    }
  };

  const handleOpenNotificationDetails = (n: any) => {
    const isDockAllocation =
      n.title?.toUpperCase().includes("DOCK ALLOCAT") ||
      n.title?.toUpperCase().includes("DOCK CONFIRMED");

    const isDamage =
      n.title?.toLowerCase().includes("damage") ||
      n.message?.toLowerCase().includes("damage") ||
      n.type === "damaged_goods";

    const isGrnOrQuality =
      n.title?.toLowerCase().includes("grn") ||
      n.title?.toLowerCase().includes("quality") ||
      n.title?.toLowerCase().includes("receiving") ||
      n.message?.toLowerCase().includes("grn") ||
      n.message?.toLowerCase().includes("inspection");

    if (isDamage) {
      setSelectedDamageNotif(n);
      setShowDamageModal(true);
    } else if (isGrnOrQuality) {
      setSelectedGrnNotif(n);
      setShowGrnModal(true);
    } else if (isDockAllocation) {
      // Dock allocation card is rendered directly on page
    } else if (n.link && !["/warehouse-dashboard", "/receiving"].includes(n.link)) {
      window.location.href = n.link;
    } else {
      setSelectedGrnNotif(n);
      setShowGrnModal(true);
    }
  };

  const damageDetails = selectedDamageNotif
    ? parseDamageNotificationMessage(selectedDamageNotif.message)
    : null;

  const grnDetails = selectedGrnNotif
    ? parseGrnNotificationDetails(selectedGrnNotif)
    : null;

  return (
    <AppShell
      title="Notification centre"
      subtitle="Stay updated with procurement and supply chain alerts"
    >
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="size-8 animate-spin text-primary" />
        </div>
      ) : notifications.length === 0 ? (
        <Card className="items-center gap-2 rounded-2xl border-dashed p-14 text-center shadow-none">
          <span className="grid size-14 place-items-center rounded-2xl bg-muted text-muted-foreground">
            <Inbox className="size-6" />
          </span>
          <p className="mt-2 text-sm font-semibold">Nothing in this queue</p>
          <p className="max-w-xs text-xs text-muted-foreground">
            Your notification history is empty.
          </p>
        </Card>
      ) : (
        <div className="grid gap-4">
          {notifications.map((n) => {
            const isDockAllocation =
              n.title?.toUpperCase().includes("DOCK ALLOCAT") ||
              n.title?.toUpperCase().includes("DOCK CONFIRMED");

            if (isDockAllocation) {
              return <DockAllocationNotificationCard key={n.id} notification={n} />;
            }

            const isDamage =
              n.title?.toLowerCase().includes("damage") ||
              n.message?.toLowerCase().includes("damage");

            return (
              <Card
                key={n.id}
                onClick={() => handleOpenNotificationDetails(n)}
                className={cn(
                  "relative overflow-hidden border-border/50 p-5 cursor-pointer hover:border-primary/40 transition-all",
                  !n.is_read && "bg-primary-soft/5 border-primary/20",
                  isDamage && "border-rose-500/30 bg-rose-500/5 hover:border-rose-500/60",
                )}
              >
                {!n.is_read && (
                  <div
                    className={cn(
                      "absolute left-0 top-0 h-full w-1",
                      isDamage ? "bg-rose-600" : "bg-primary",
                    )}
                  />
                )}

                <div className="flex items-start gap-4">
                  <div
                    className={cn(
                      "grid size-12 shrink-0 place-items-center rounded-2xl",
                      isDamage
                        ? "bg-rose-500/10 text-rose-600"
                        : n.title?.includes("Approved")
                          ? "bg-success-soft text-success"
                          : n.title?.includes("Rejected")
                            ? "bg-destructive-soft text-destructive"
                            : "bg-primary-soft text-primary",
                    )}
                  >
                    {isDamage ? (
                      <AlertTriangle className="size-6" />
                    ) : n.type === "arrival" ? (
                      <Truck className="size-6" />
                    ) : (
                      <FileText className="size-6" />
                    )}
                  </div>

                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <h3
                        className={cn(
                          "font-bold text-foreground",
                          isDamage && "text-rose-700 font-extrabold flex items-center gap-1.5",
                        )}
                      >
                        {n.title}
                      </h3>
                      <span className="text-[10px] text-muted-foreground font-medium">
                        {n.created_at && !Number.isNaN(new Date(n.created_at).getTime())
                          ? new Date(n.created_at).toLocaleString()
                          : "Date unavailable"}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                      {n.message}
                    </p>

                    <div className="mt-4 pt-4 border-t border-border/40 flex items-center justify-between">
                      <div className="flex flex-wrap gap-2">
                        {n.po_number && (
                          <span className="text-[10px] px-2 py-0.5 rounded bg-muted font-mono font-bold">
                            PO: {n.po_number}
                          </span>
                        )}
                        {n.supplier_name && (
                          <span className="text-[10px] px-2 py-0.5 rounded bg-muted font-bold">
                            {n.supplier_name}
                          </span>
                        )}
                      </div>

                      <Button
                        size="sm"
                        variant={isDamage ? "default" : "outline"}
                        className={cn(
                          "rounded-xl text-xs font-bold",
                          isDamage && "bg-rose-600 hover:bg-rose-700 text-white shadow-sm",
                        )}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenNotificationDetails(n);
                        }}
                      >
                        <FileText className="mr-1.5 size-3.5" /> View Details
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* ✨ DAMAGED GOODS DETAILS MODAL (POPUP) */}
      <Dialog open={showDamageModal} onOpenChange={setShowDamageModal}>
        <DialogContent className="max-w-3xl rounded-3xl p-6 space-y-6 max-h-[90vh] overflow-y-auto border shadow-2xl">
          {/* HEADER */}
          <DialogHeader className="border-b pb-4 flex flex-row items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-full text-xs font-black bg-rose-500/10 text-rose-700 border border-rose-500/20 flex items-center gap-1.5 uppercase tracking-wider">
                  <AlertTriangle className="size-3.5" /> Damaged Goods Notification
                </span>
                <span className="px-2.5 py-0.5 rounded-md font-mono text-xs font-bold bg-muted text-foreground">
                  Ref: {damageDetails?.grnNumber}
                </span>
              </div>
              <DialogTitle className="text-xl font-black text-foreground mt-2">
                {selectedDamageNotif?.title || "Damaged Goods Reported"}
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Reported Date & Time:{" "}
                <b className="text-foreground">
                  {selectedDamageNotif?.created_at
                    ? new Date(selectedDamageNotif.created_at).toLocaleString()
                    : new Date().toLocaleString()}
                </b>
              </p>
            </div>
          </DialogHeader>

          {/* GENERAL DETAILS GRID */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 bg-muted/30 rounded-2xl p-4 border text-xs font-sans">
            <div className="space-y-0.5">
              <span className="text-[10px] font-extrabold uppercase text-muted-foreground tracking-wider block">
                GRN Number
              </span>
              <span className="font-mono text-sm font-black text-primary block">
                {damageDetails?.grnNumber}
              </span>
            </div>

            <div className="space-y-0.5">
              <span className="text-[10px] font-extrabold uppercase text-muted-foreground tracking-wider block">
                PO Reference
              </span>
              <span className="font-mono text-sm font-bold text-foreground block">
                {damageDetails?.poNumber}
              </span>
            </div>

            <div className="space-y-0.5">
              <span className="text-[10px] font-extrabold uppercase text-muted-foreground tracking-wider block">
                Supplier Name
              </span>
              <span className="text-xs font-bold text-foreground block">
                {damageDetails?.supplierName}
              </span>
            </div>

            <div className="space-y-0.5">
              <span className="text-[10px] font-extrabold uppercase text-muted-foreground tracking-wider block">
                Warehouse Name
              </span>
              <span className="text-xs font-bold text-foreground block">
                {damageDetails?.warehouseName}
              </span>
            </div>

            <div className="space-y-0.5">
              <span className="text-[10px] font-extrabold uppercase text-muted-foreground tracking-wider block">
                Damage Reported Date/Time
              </span>
              <span className="text-xs font-medium text-foreground block">
                {selectedDamageNotif?.created_at
                  ? new Date(selectedDamageNotif.created_at).toLocaleString()
                  : new Date().toLocaleString()}
              </span>
            </div>

            <div className="space-y-0.5">
              <span className="text-[10px] font-extrabold uppercase text-muted-foreground tracking-wider block">
                Reported / Received By
              </span>
              <span className="text-xs font-bold text-foreground block">
                {damageDetails?.reportedBy}
              </span>
            </div>
          </div>

          {/* INSPECTOR CUSTOM REMARKS IF PRESENT */}
          {damageDetails?.customRemarks && (
            <div className="rounded-2xl border border-amber-300 bg-amber-500/10 p-3.5 text-xs text-amber-900">
              <span className="font-black uppercase tracking-wider block text-[10px] text-amber-700">
                Inspector Custom Remarks & Instructions
              </span>
              <p className="font-medium mt-1 leading-relaxed">{damageDetails.customRemarks}</p>
            </div>
          )}

          {/* DAMAGED MATERIAL DETAILS TABLE */}
          <div className="space-y-2">
            <h4 className="text-xs font-black uppercase text-foreground tracking-wider flex items-center justify-between">
              <span>Damaged Material Details</span>
              <span className="text-[10px] font-bold text-rose-600 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20">
                {damageDetails?.items.length || 0} Line Item(s) Flagged
              </span>
            </h4>
            <div className="rounded-2xl border overflow-hidden shadow-sm">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/70 font-bold uppercase text-[10px] text-muted-foreground tracking-wider border-b">
                  <tr>
                    <th className="px-4 py-3">Material Code & Name</th>
                    <th className="px-4 py-3">Damaged Quantity</th>
                    <th className="px-4 py-3">Damage Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y font-medium">
                  {damageDetails?.items.map((item, idx) => (
                    <tr key={idx} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 font-bold text-foreground">{item.material}</td>
                      <td className="px-4 py-3 font-mono font-bold text-rose-600">{item.quantity}</td>
                      <td className="px-4 py-3 text-muted-foreground">{item.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* FOOTER - ONLY CLOSE BUTTON */}
          <DialogFooter className="pt-4 border-t flex justify-end">
            <Button
              variant="outline"
              className="rounded-xl font-bold px-6 border-muted-foreground/30 hover:bg-muted"
              onClick={() => setShowDamageModal(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ✨ GRN & QUALITY NOTIFICATION DETAILS MODAL */}
      <Dialog open={showGrnModal} onOpenChange={setShowGrnModal}>
        <DialogContent className="max-w-2xl rounded-3xl p-6 space-y-6 max-h-[90vh] overflow-y-auto border shadow-2xl">
          {/* HEADER */}
          <DialogHeader className="border-b pb-4 flex flex-row items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-full text-xs font-black bg-primary/10 text-primary border border-primary/20 flex items-center gap-1.5 uppercase tracking-wider">
                  <FileText className="size-3.5" /> {grnDetails?.statusText || "GRN Details"}
                </span>
                {grnDetails?.grnNumber && (
                  <span className="px-2.5 py-0.5 rounded-md font-mono text-xs font-bold bg-muted text-foreground">
                    {grnDetails.grnNumber}
                  </span>
                )}
              </div>
              <DialogTitle className="text-xl font-black text-foreground mt-2">
                {selectedGrnNotif?.title || "GRN Notification Details"}
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Date & Time:{" "}
                <b className="text-foreground">
                  {selectedGrnNotif?.created_at
                    ? new Date(selectedGrnNotif.created_at).toLocaleString()
                    : new Date().toLocaleString()}
                </b>
              </p>
            </div>
          </DialogHeader>

          {/* DETAILS GRID */}
          <div className="grid gap-3 sm:grid-cols-2 bg-muted/30 rounded-2xl p-4 border text-xs font-sans">
            {grnDetails?.grnNumber && (
              <div className="space-y-0.5">
                <span className="text-[10px] font-extrabold uppercase text-muted-foreground tracking-wider block">
                  GRN Number
                </span>
                <span className="font-mono text-sm font-black text-primary block">
                  {grnDetails.grnNumber}
                </span>
              </div>
            )}

            {grnDetails?.poNumber && (
              <div className="space-y-0.5">
                <span className="text-[10px] font-extrabold uppercase text-muted-foreground tracking-wider block">
                  PO Reference
                </span>
                <span className="font-mono text-sm font-bold text-foreground block">
                  {grnDetails.poNumber}
                </span>
              </div>
            )}

            {grnDetails?.supplierName && (
              <div className="space-y-0.5">
                <span className="text-[10px] font-extrabold uppercase text-muted-foreground tracking-wider block">
                  Supplier Name
                </span>
                <span className="text-xs font-bold text-foreground block">
                  {grnDetails.supplierName}
                </span>
              </div>
            )}

            {grnDetails?.vehicleNumber && (
              <div className="space-y-0.5">
                <span className="text-[10px] font-extrabold uppercase text-muted-foreground tracking-wider block">
                  Vehicle Number
                </span>
                <span className="font-mono text-xs font-bold text-foreground block">
                  {grnDetails.vehicleNumber}
                </span>
              </div>
            )}

            {grnDetails?.dockCode && (
              <div className="space-y-0.5">
                <span className="text-[10px] font-extrabold uppercase text-muted-foreground tracking-wider block">
                  Dock Code
                </span>
                <span className="font-mono text-xs font-bold text-teal-600 block">
                  {grnDetails.dockCode}
                </span>
              </div>
            )}

            <div className="space-y-0.5">
              <span className="text-[10px] font-extrabold uppercase text-muted-foreground tracking-wider block">
                Notification Type
              </span>
              <span className="text-xs font-bold text-foreground block">
                {grnDetails?.statusText || "Goods Receiving"}
              </span>
            </div>
          </div>

          {/* MESSAGE BODY */}
          <div className="rounded-2xl border bg-card p-4 space-y-1">
            <span className="text-[10px] font-black uppercase text-muted-foreground tracking-wider block">
              Notification Message
            </span>
            <p className="text-sm font-medium text-foreground whitespace-pre-line leading-relaxed">
              {selectedGrnNotif?.message}
            </p>
          </div>

          {/* FOOTER */}
          <DialogFooter className="pt-4 border-t flex flex-wrap items-center justify-between gap-3">
            <Button
              variant="default"
              className="rounded-xl font-bold text-xs bg-primary hover:bg-primary/90 text-primary-foreground"
              onClick={() => {
                setShowGrnModal(false);
                window.location.href = "/grn";
              }}
            >
              <FileText className="mr-1.5 size-4" /> Open GRN Management (/grn)
            </Button>

            <Button
              variant="outline"
              className="rounded-xl font-bold text-xs px-6"
              onClick={() => setShowGrnModal(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ENLARGED PHOTO LIGHTBOX MODAL IF CLICKED */}
      {enlargedPhoto && (
        <Dialog open={!!enlargedPhoto} onOpenChange={() => setEnlargedPhoto(null)}>
          <DialogContent className="max-w-2xl rounded-2xl p-4 bg-black/95 text-white border-none">
            <div className="flex justify-between items-center pb-2 border-b border-white/20">
              <span className="text-xs font-bold uppercase tracking-wider text-rose-400">
                Damage Photo Evidence
              </span>
              <button
                onClick={() => setEnlargedPhoto(null)}
                className="text-white/70 hover:text-white"
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="mt-3 overflow-hidden rounded-xl bg-black flex items-center justify-center max-h-[70vh]">
              <img src={enlargedPhoto} alt="Enlarged damage evidence" className="max-h-[70vh] object-contain" />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </AppShell>
  );
}
