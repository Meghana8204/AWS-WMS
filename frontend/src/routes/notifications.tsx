import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  Bell,
  Truck,
  CheckCircle2,
  XCircle,
  Eye,
  Filter,
  Inbox,
  Loader2,
  Calendar,
  FileText,
  ArrowRight,
  Package,
  AlertTriangle,
  Camera,
  X,
  ExternalLink,
} from "lucide-react";
import { AppShell, StatusBadge, DockAllocationNotificationCard } from "@/components/wms/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { api, BUSINESS_API_URL } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { getUserInfo, requireAuth } from "@/lib/auth-utils";

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
      const rsn = parts.find((p) => p.toLowerCase().startsWith("reason:"))?.replace(/^reason:\s*/i, "") || (remarksMatch && remarksMatch[1] ? remarksMatch[1] : "Damaged / Rejected");
      items.push({ material: mat, quantity: qty, reason: rsn });
    }
  }

  return {
    grnNumber: grnMatch && grnMatch[1] ? grnMatch[1] : "GRN-2026-0001",
    poNumber: poMatch && poMatch[1] ? poMatch[1] : "PO-1001",
    supplierName: supplierMatch && supplierMatch[1] ? supplierMatch[1].trim() : "Supplier",
    warehouseName: warehouseMatch && warehouseMatch[1] ? warehouseMatch[1].trim() : "Main Warehouse",
    reportedBy: "GRN Quality Inspector",
    customRemarks: remarksMatch && remarksMatch[1] ? remarksMatch[1].trim() : "",
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
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [userRole, setUserRole] = useState("WAREHOUSE");

  // Modal State for Damaged Goods Details
  const [showDamageModal, setShowDamageModal] = useState(false);
  const [selectedDamageNotif, setSelectedDamageNotif] = useState<any | null>(null);
  const [enlargedPhoto, setEnlargedPhoto] = useState<string | null>(null);
  const [damageGrnData, setDamageGrnData] = useState<any | null>(null);
  const [damageLoading, setDamageLoading] = useState(false);

  // Modal State for GRN & Quality Notification Details
  const [showGrnModal, setShowGrnModal] = useState(false);
  const [selectedGrnNotif, setSelectedGrnNotif] = useState<any | null>(null);

  useEffect(() => {
    const roles = getUserInfo()?.roles || [];
    const role = roles.includes("SUPPLIER")
      ? "SUPPLIER"
      : roles.includes("FINANCE")
        ? "FINANCE"
        : roles.includes("PROCUREMENT")
          ? "PROCUREMENT"
          : roles.includes("ASSEMBLY_MANAGER")
            ? "ASSEMBLY_MANAGER"
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

  // Fetch full GRN damage data when damage notification is selected
  useEffect(() => {
    if (!selectedDamageNotif) {
      setDamageGrnData(null);
      return;
    }
    let isMounted = true;
    const loadDamageData = async () => {
      try {
        setDamageLoading(true);
        const parsed = parseDamageNotificationMessage(selectedDamageNotif.message);
        let targetId = parsed.grnNumber;
        if (selectedDamageNotif.link) {
          const matchId = selectedDamageNotif.link.match(/grn_id=([^&]+)/);
          const matchNum = selectedDamageNotif.link.match(/grn_number=([^&]+)/);
          if (matchId && matchId[1]) targetId = matchId[1];
          else if (matchNum && matchNum[1]) targetId = matchNum[1];
        }

        let grnResult = null;
        if (targetId) {
          try {
            grnResult = await api.getGrn(targetId);
          } catch (grnErr) {
            console.warn("api.getGrn failed for", targetId, grnErr);
          }
        }

        const hasEvidence = grnResult?.lines?.some(
          (l: any) =>
            (Array.isArray(l.damageEvidence) && l.damageEvidence.length > 0) ||
            (Array.isArray(l.damage_evidence) && l.damage_evidence.length > 0)
        );

        if (!hasEvidence && (parsed.poNumber || selectedDamageNotif.po_number)) {
          const poNum = (parsed.poNumber || selectedDamageNotif.po_number || "").trim();
          try {
            const poDmg = await api.getPoDamagedGoods(poNum);
            if (poDmg?.has_damaged_goods && Array.isArray(poDmg.materials)) {
              if (!grnResult) grnResult = { lines: [] };
              grnResult.lines = poDmg.materials.map((m: any) => ({
                item_code: m.item_code,
                itemCode: m.item_code,
                material_name: m.material_name,
                materialName: m.material_name,
                damage_evidence: (m.photos || []).map((p: any) => ({
                  evidence_id: p.id,
                  evidenceId: p.id,
                  file_name: p.file_name,
                  fileName: p.file_name,
                  file_path: p.url,
                  filePath: p.url,
                })),
              }));
            }
          } catch (poErr) {
            console.warn("api.getPoDamagedGoods fallback failed for", poNum, poErr);
          }
        }

        if (isMounted) setDamageGrnData(grnResult);
      } catch (err) {
        console.warn("Could not fetch full GRN details for damage photos", err);
      } finally {
        if (isMounted) setDamageLoading(false);
      }
    };
    void loadDamageData();
    return () => {
      isMounted = false;
    };
  }, [selectedDamageNotif]);

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

  const getPhotosForMaterial = (matString: string) => {
    if (!damageGrnData?.lines) return [];
    const cleanMat = matString.toLowerCase().trim();
    const codeMatch = matString.match(/^([A-Za-z0-9_-]+)/);
    const extractedCode = codeMatch ? codeMatch[1].toLowerCase() : "";

    const matchedLine = damageGrnData.lines.find((l: any) => {
      const code = (l.itemCode || l.item_code || "").toLowerCase().trim();
      const name = (l.materialName || l.material_name || "").toLowerCase().trim();
      return (
        (code && (cleanMat.includes(code) || (extractedCode && (code === extractedCode || cleanMat.startsWith(code))))) ||
        (name && (cleanMat.includes(name) || name.includes(cleanMat)))
      );
    });
    const lineEvidence = matchedLine?.damageEvidence || matchedLine?.damage_evidence || matchedLine?.photos;
    if (Array.isArray(lineEvidence) && lineEvidence.length > 0) return lineEvidence;
    if (damageGrnData.lines.length === 1) {
      const ev = damageGrnData.lines[0]?.damageEvidence || damageGrnData.lines[0]?.damage_evidence || damageGrnData.lines[0]?.photos;
      if (Array.isArray(ev) && ev.length > 0) return ev;
    }
    return [];
  };

  const handleMarkRead = async (id: string) => {
    try {
      const notification = notifications.find((n) => n.id === id);
      if (userRole === "WAREHOUSE" && notification?.type === "arrival")
        await api.markArrivalNotificationRead(id);
      else await api.markNotificationRead(id);
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
      window.dispatchEvent(new Event("notifications:refresh"));
    } catch (e) {
      toast.error("Unable to mark notification as read");
    }
  };

  const handleMarkAllRead = async () => {
    try {
      if (userRole === "WAREHOUSE") {
        await Promise.all([
          api.markAllArrivalNotificationsRead(),
          api.markAllNotificationsRead(userRole),
        ]);
      } else await api.markAllNotificationsRead(userRole);
      setNotifications((prev) => prev.map((notification) => ({ ...notification, is_read: true })));
      window.dispatchEvent(new Event("notifications:refresh"));
      toast.success("All notifications marked as read");
    } catch (error) {
      toast.error("Unable to mark all notifications as read");
    }
  };

  return (
    <AppShell
      title="Notification centre"
      subtitle="Stay updated with procurement and supply chain alerts"
      actions={
        <Button
          variant="outline"
          size="sm"
          className="rounded-xl border-border/80 text-xs font-semibold"
          onClick={handleMarkAllRead}
        >
          Mark all as read
        </Button>
      }
    >
      <div className="mx-auto max-w-4xl space-y-6">
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="size-8 animate-spin text-primary" />
          </div>
        ) : notifications.length === 0 ? (
          <Card className="flex h-64 flex-col items-center justify-center p-6 text-center border-dashed border-border/50 bg-muted/20">
            <Inbox className="size-12 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-semibold text-muted-foreground">No notifications</h3>
            <p className="text-sm text-muted-foreground/70">
              You are all caught up! Check back later for new alerts.
            </p>
          </Card>
        ) : (
          <div className="grid gap-3">
            {notifications.map((n) => {
              const isDockAlloc =
                n.title?.toUpperCase().includes("DOCK ALLOCAT") ||
                n.title?.toUpperCase().includes("DOCK CONFIRMED");

              if (isDockAlloc) {
                return <DockAllocationNotificationCard key={n.id} notification={n} />;
              }

              return (
                <Card
                  key={n.id}
                  className={cn(
                    "p-4 transition-all duration-200 border-border/50 hover:border-primary/30 hover:shadow-soft cursor-pointer",
                    !n.is_read && "bg-primary-soft/10 border-primary/20",
                  )}
                  onClick={() => handleOpenNotificationDetails(n)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0">
                      <div
                        className={cn(
                          "grid size-10 shrink-0 place-items-center rounded-xl text-primary bg-primary/10",
                          n.title?.toLowerCase().includes("damage") && "bg-destructive/10 text-destructive",
                        )}
                      >
                        {n.title?.toLowerCase().includes("damage") ? (
                          <AlertTriangle className="size-5" />
                        ) : (
                          <Bell className="size-5" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-sm text-foreground truncate">{n.title}</h4>
                          {!n.is_read && (
                            <span className="size-2 rounded-full bg-primary shrink-0" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                          {n.message}
                        </p>
                        <p className="text-[10px] font-mono text-muted-foreground/70 mt-2">
                          {n.created_at || n.createdAt
                            ? new Date(n.created_at || n.createdAt).toLocaleString()
                            : "Just now"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 rounded-lg text-xs text-primary hover:bg-primary-soft/30 font-bold"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenNotificationDetails(n);
                        }}
                      >
                        <Eye className="size-3.5 mr-1" /> View Details
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Damaged Goods Evidence Modal */}
      <Dialog open={showDamageModal} onOpenChange={setShowDamageModal}>
        <DialogContent className="max-w-3xl rounded-3xl p-0 overflow-hidden border-none shadow-2xl">
          {selectedDamageNotif && damageDetails && (
            <div className="flex flex-col h-full max-h-[90vh]">
              <div className="p-6 bg-destructive text-destructive-foreground flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <AlertTriangle className="size-5" />
                    <DialogTitle className="text-xl font-bold">
                      Damaged Goods Alert Notice
                    </DialogTitle>
                  </div>
                  <p className="text-destructive-foreground/80 text-xs font-mono">
                    GRN: {damageDetails.grnNumber} · PO: {damageDetails.poNumber}
                  </p>
                </div>
              </div>

              <div className="p-6 overflow-y-auto space-y-6 flex-1">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-2xl bg-muted/20 border border-border/40 text-xs">
                  <div>
                    <span className="text-[10px] font-black uppercase text-muted-foreground">
                      Supplier
                    </span>
                    <p className="font-bold mt-0.5">{damageDetails.supplierName}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase text-muted-foreground">
                      Warehouse
                    </span>
                    <p className="font-bold mt-0.5">{damageDetails.warehouseName}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase text-muted-foreground">
                      Reported By
                    </span>
                    <p className="font-bold mt-0.5">{damageDetails.reportedBy}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase text-muted-foreground">
                      Report Date
                    </span>
                    <p className="font-bold mt-0.5">
                      {selectedDamageNotif.created_at || selectedDamageNotif.createdAt
                        ? new Date(
                            selectedDamageNotif.created_at || selectedDamageNotif.createdAt,
                          ).toLocaleDateString()
                        : "Today"}
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="text-xs font-black uppercase text-muted-foreground tracking-wider">
                    Damaged Line Items &amp; Photo Evidence
                  </h4>

                  {damageLoading ? (
                    <div className="flex items-center justify-center py-8 gap-2">
                      <Loader2 className="size-5 animate-spin text-primary" />
                      <span className="text-xs text-muted-foreground">
                        Loading damage evidence photos...
                      </span>
                    </div>
                  ) : (
                    damageDetails.items.map((item, idx) => {
                      const photos = getPhotosForMaterial(item.material);

                      return (
                        <div
                          key={idx}
                          className="p-4 rounded-2xl border border-destructive/20 bg-destructive/5 space-y-3"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="font-bold text-sm text-foreground">{item.material}</p>
                              <p className="text-xs text-destructive font-semibold mt-0.5">
                                Reason: {item.reason}
                              </p>
                            </div>
                            <span className="text-xs font-black text-destructive bg-destructive/10 px-2.5 py-1 rounded-lg border border-destructive/20 font-mono">
                              Qty: {item.quantity}
                            </span>
                          </div>

                          {photos.length > 0 ? (
                            <div>
                              <p className="text-[10px] font-bold text-muted-foreground uppercase mb-2 flex items-center gap-1">
                                <Camera className="size-3 text-destructive" /> Evidence Photos (
                                {photos.length})
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {photos.map((photo: any, pIdx: number) => {
                                  const rawPath = photo.filePath || photo.file_path || photo.url || "";
                                  const fullUrl = rawPath.startsWith("http")
                                    ? rawPath
                                    : `${BUSINESS_API_URL}${rawPath.startsWith("/") ? "" : "/"}${rawPath}`;

                                  return (
                                    <div
                                      key={pIdx}
                                      className="relative group size-20 rounded-xl overflow-hidden border border-border/80 shadow-xs cursor-pointer hover:ring-2 hover:ring-primary transition-all"
                                      onClick={() => setEnlargedPhoto(fullUrl)}
                                    >
                                      <img
                                        src={fullUrl}
                                        alt={`Evidence ${pIdx + 1}`}
                                        className="size-full object-cover"
                                      />
                                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[10px] font-bold">
                                        View
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ) : (
                            <p className="text-[10px] text-muted-foreground italic">
                              No photo evidence attached to this line item.
                            </p>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                {damageDetails.customRemarks && (
                  <div className="p-4 rounded-2xl bg-muted/20 border border-border/40 space-y-1">
                    <span className="text-[10px] font-black uppercase text-muted-foreground">
                      Inspector Remarks
                    </span>
                    <p className="text-xs text-foreground font-medium italic">
                      "{damageDetails.customRemarks}"
                    </p>
                  </div>
                )}
              </div>

              <div className="p-4 bg-muted/10 border-t border-border/60 flex items-center justify-end gap-3">
                <Button
                  variant="ghost"
                  className="rounded-xl text-xs font-semibold"
                  onClick={() => setShowDamageModal(false)}
                >
                  Close
                </Button>
                {selectedDamageNotif.link && (
                  <Button
                    className="rounded-xl text-xs font-bold shadow-glow"
                    onClick={() => {
                      setShowDamageModal(false);
                      window.location.href = selectedDamageNotif.link;
                    }}
                  >
                    Open GRN Inspection <ExternalLink className="ml-1.5 size-3.5" />
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Enlarged Photo Preview Modal */}
      {enlargedPhoto && (
        <div
          className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in"
          onClick={() => setEnlargedPhoto(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] overflow-hidden rounded-3xl bg-background border border-border/60 shadow-2xl p-2">
            <button
              className="absolute top-4 right-4 z-10 size-10 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black transition-colors"
              onClick={() => setEnlargedPhoto(null)}
            >
              <X className="size-5" />
            </button>
            <img
              src={enlargedPhoto}
              alt="Enlarged evidence"
              className="max-h-[85vh] w-auto max-w-full rounded-2xl object-contain mx-auto"
            />
          </div>
        </div>
      )}

      {/* GRN & Quality Notification Details Modal */}
      <Dialog open={showGrnModal} onOpenChange={setShowGrnModal}>
        <DialogContent className="max-w-2xl rounded-3xl p-0 overflow-hidden border-none shadow-2xl">
          {selectedGrnNotif && grnDetails && (
            <div className="flex flex-col h-full max-h-[90vh]">
              <div className="p-6 bg-primary text-primary-foreground flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Package className="size-5" />
                    <DialogTitle className="text-xl font-bold tracking-tight">
                      {grnDetails.title || "Receiving & GRN Notification"}
                    </DialogTitle>
                  </div>
                  <p className="text-primary-foreground/80 text-xs font-mono">
                    Status: {grnDetails.statusText}
                  </p>
                </div>
              </div>

              <div className="p-6 overflow-y-auto space-y-6 flex-1">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 p-4 rounded-2xl bg-muted/20 border border-border/40 text-xs">
                  {grnDetails.grnNumber && (
                    <div>
                      <span className="text-[10px] font-black uppercase text-muted-foreground">
                        GRN Number
                      </span>
                      <p className="font-bold mt-0.5 font-mono text-primary">
                        {grnDetails.grnNumber}
                      </p>
                    </div>
                  )}
                  {grnDetails.poNumber && (
                    <div>
                      <span className="text-[10px] font-black uppercase text-muted-foreground">
                        PO Number
                      </span>
                      <p className="font-bold mt-0.5 font-mono">{grnDetails.poNumber}</p>
                    </div>
                  )}
                  {grnDetails.supplierName && (
                    <div>
                      <span className="text-[10px] font-black uppercase text-muted-foreground">
                        Supplier
                      </span>
                      <p className="font-bold mt-0.5">{grnDetails.supplierName}</p>
                    </div>
                  )}
                  {grnDetails.vehicleNumber && (
                    <div>
                      <span className="text-[10px] font-black uppercase text-muted-foreground">
                        Vehicle Number
                      </span>
                      <p className="font-bold mt-0.5 font-mono">{grnDetails.vehicleNumber}</p>
                    </div>
                  )}
                  {grnDetails.dockCode && (
                    <div>
                      <span className="text-[10px] font-black uppercase text-muted-foreground">
                        Dock Location
                      </span>
                      <p className="font-bold mt-0.5 font-mono text-primary">
                        {grnDetails.dockCode}
                      </p>
                    </div>
                  )}
                  {grnDetails.created_at && (
                    <div>
                      <span className="text-[10px] font-black uppercase text-muted-foreground">
                        Timestamp
                      </span>
                      <p className="font-bold mt-0.5">
                        {new Date(grnDetails.created_at).toLocaleString()}
                      </p>
                    </div>
                  )}
                </div>

                <div className="p-4 rounded-2xl bg-muted/20 border border-border/40 space-y-2">
                  <span className="text-[10px] font-black uppercase text-muted-foreground">
                    Message Details
                  </span>
                  <p className="text-xs text-foreground font-medium leading-relaxed whitespace-pre-line">
                    {grnDetails.message}
                  </p>
                </div>
              </div>

              <div className="p-4 bg-muted/10 border-t border-border/60 flex items-center justify-end gap-3">
                <Button
                  variant="ghost"
                  className="rounded-xl text-xs font-semibold"
                  onClick={() => setShowGrnModal(false)}
                >
                  Close
                </Button>
                {grnDetails.link && (
                  <Button
                    className="rounded-xl text-xs font-bold shadow-glow"
                    onClick={() => {
                      setShowGrnModal(false);
                      window.location.href = grnDetails.link;
                    }}
                  >
                    Open Details <ExternalLink className="ml-1.5 size-3.5" />
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
