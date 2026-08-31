import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Truck, Inbox, Loader2, FileText, AlertTriangle, Camera, X } from "lucide-react";
import { AppShell } from "@/components/wms/app-shell";
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

  const grnMatch = msg.match(/GRN:\s*([^\s|]+)/i);
  const poMatch = msg.match(/PO:\s*([^\s|]+)/i);
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

function Notifications() {
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [userRole, setUserRole] = useState("WAREHOUSE");

  // Modal State for Damaged Goods Details
  const [showDamageModal, setShowDamageModal] = useState(false);
  const [selectedDamageNotif, setSelectedDamageNotif] = useState<any | null>(null);
  const [enlargedPhoto, setEnlargedPhoto] = useState<string | null>(null);

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
        const arrivals = arrivalData.map((n: any) => ({
          id: n.id,
          title: "Arrival Notification",
          message:
            n.message ||
            `Truck ${n.vehicleNumber || n.vehicle_number || "not assigned"} from ${n.supplierName || n.supplier_name || "supplier not available"} is arriving.`,
          created_at:
            n.createdAt || n.created_at || n.expectedArrivalTime || n.expected_arrival_time,
          type: "arrival",
          is_read: (n.status || "").toUpperCase() === "ACKNOWLEDGED",
          po_number: n.poNumber || n.po_number,
          supplier_name: n.supplierName || n.supplier_name,
        }));
        setNotifications(
          [...workflowData, ...arrivals].sort(
            (a: any, b: any) =>
              new Date(b.created_at || b.createdAt || 0).getTime() -
              new Date(a.created_at || a.createdAt || 0).getTime(),
          ),
        );
      } else {
        const data = await api.getNotifications(role);
        setNotifications(data);
      }
    } catch (error) {
      console.error("Failed to fetch notifications", error);
      if (!quiet) toast.error("Failed to load notifications");
    } finally {
      if (!quiet) setLoading(false);
    }
  };

  const handleOpenNotificationDetails = (n: any) => {
    const isDamage =
      n.title?.toLowerCase().includes("damage") ||
      n.message?.toLowerCase().includes("damage") ||
      n.type === "damaged_goods";

    if (isDamage) {
      setSelectedDamageNotif(n);
      setShowDamageModal(true);
    } else if (n.link) {
      window.location.href = n.link;
    }
  };

  const damageDetails = selectedDamageNotif
    ? parseDamageNotificationMessage(selectedDamageNotif.message)
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
