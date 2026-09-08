import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
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
  PackageX,
  ExternalLink,
  ShieldAlert,
  Building2,
  Warehouse as WarehouseIcon,
  Boxes,
  Check,
  Search,
} from "lucide-react";
import { AppShell, StatusBadge } from "@/components/wms/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { getUserInfo, requireAuth } from "@/lib/auth-utils";

export const Route = createFileRoute("/notifications")({
  beforeLoad: () => requireAuth(),
  component: Notifications,
});

interface ParsedDamageItem {
  code: string;
  name: string;
  quantity: string;
  reason: string;
}

interface ParsedDamageInfo {
  isDamage: boolean;
  intro: string;
  grnNumber: string;
  poNumber: string;
  supplier: string;
  warehouse: string;
  items: ParsedDamageItem[];
  remarks: string;
}

function parseDamageNotification(title?: string, message?: string): ParsedDamageInfo | null {
  if (!message) return null;
  const isDamage =
    (title && /damage|reject|quarantine/i.test(title)) ||
    /damaged\/rejected goods|damaged items:/i.test(message);

  if (!isDamage) return null;

  // Extract GRN
  const grnMatch = message.match(/GRN:?\s*([A-Za-z0-9_-]+)/i);
  const grnNumber = grnMatch ? grnMatch[1].trim() : "";

  // Extract PO
  const poMatch = message.match(/PO:?\s*([A-Za-z0-9_-]+)/i);
  const poNumber = poMatch ? poMatch[1].trim() : "";

  // Extract Supplier
  const supplierMatch = message.match(/Supplier:\s*([^|\n\r]+)/i);
  const supplier = supplierMatch ? supplierMatch[1].trim() : "";

  // Extract Warehouse
  const warehouseMatch = message.match(/Warehouse:\s*([^|\n\r]+)/i);
  const warehouse = warehouseMatch ? warehouseMatch[1].trim() : "";

  // Extract Inspector Remarks
  const remarksMatch = message.match(/Inspector Remarks:\s*([\s\S]+)$/i);
  const remarks = remarksMatch ? remarksMatch[1].trim() : "";

  // Extract Damaged Items section
  const items: ParsedDamageItem[] = [];
  const itemsSectionMatch = message.match(/Damaged Items:\s*([\s\S]*?)(?:Inspector Remarks:|$)/i);
  const itemsText = itemsSectionMatch ? itemsSectionMatch[1] : message;

  // Regex match for bulleted items: e.g. • MAT-0003 (pianos) | Qty: 10.0 PCS | Reason: fghfhgfhgfg
  const bulletRegex = /(?:[•\-*]|\d+\.)\s*([^|\n\r]+?)\s*\|\s*Qty:\s*([^|\n\r]+?)\s*\|\s*Reason:\s*([^•\-*\n\r]+)/gi;
  let match;
  while ((match = bulletRegex.exec(itemsText)) !== null) {
    const rawMaterial = match[1].trim();
    const qty = match[2].trim();
    const reason = match[3].trim();

    // Parse code and name from "MAT-0003 (pianos)"
    const matMatch = rawMaterial.match(/^([A-Za-z0-9_-]+)\s*(?:\((.*?)\))?$/);
    const code = matMatch ? matMatch[1].trim() : rawMaterial;
    const name = matMatch && matMatch[2] ? matMatch[2].trim() : "";

    items.push({
      code,
      name,
      quantity: qty,
      reason,
    });
  }

  // Fallback: If regex didn't find items with bulletRegex, try line splitting
  if (items.length === 0 && itemsText.includes("Qty:")) {
    const lines = itemsText.split(/[\n\r•]+/);
    for (const line of lines) {
      if (!line.includes("Qty:")) continue;
      const parts = line.split("|").map((p) => p.trim());
      const rawMat = parts[0] ? parts[0].replace(/^[•\-*\s]+/, "") : "";
      let qty = "";
      let reason = "";
      for (const p of parts.slice(1)) {
        if (p.toLowerCase().startsWith("qty:")) qty = p.replace(/^qty:\s*/i, "");
        if (p.toLowerCase().startsWith("reason:")) reason = p.replace(/^reason:\s*/i, "");
      }
      if (rawMat || qty) {
        const matMatch = rawMat.match(/^([A-Za-z0-9_-]+)\s*(?:\((.*?)\))?$/);
        items.push({
          code: matMatch ? matMatch[1].trim() : rawMat,
          name: matMatch && matMatch[2] ? matMatch[2].trim() : "",
          quantity: qty,
          reason: reason || "Damaged during receiving",
        });
      }
    }
  }

  const firstLine = message.split("\n")[0] || "Damaged/rejected goods detected.";

  return {
    isDamage: true,
    intro: firstLine,
    grnNumber,
    poNumber,
    supplier,
    warehouse,
    items,
    remarks,
  };
}

function formatNotificationDate(dateVal: any): string {
  if (!dateVal) return "Just now";
  try {
    let str = String(dateVal).trim();
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(str)) {
      str = str.replace(" ", "T");
    }
    const d = new Date(str.endsWith("Z") || str.includes("+") ? str : `${str}`);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    }
  } catch {}
  return String(dateVal);
}

function Notifications() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [userRole, setUserRole] = useState("WAREHOUSE");
  const [activeFilter, setActiveFilter] = useState<"ALL" | "DAMAGE" | "ARRIVAL" | "UNREAD">("ALL");
  const [searchQuery, setSearchQuery] = useState("");

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
    const timer = window.setInterval(() => void fetchData(role, true), 2500);
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
      if (role === "WAREHOUSE" || role === "GRN" || role === "RECEIVING" || role === "STORE_MANAGER") {
        const [arrivalData, workflowData] = await Promise.all([
          api.getArrivalNotifications().catch(() => []),
          api.getNotifications(role).catch(() => []),
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

  // Counts for tabs
  const damageCount = useMemo(
    () =>
      notifications.filter(
        (n) =>
          /damage|reject|quarantine/i.test(n.title || "") ||
          /damaged\/rejected goods|damaged items:/i.test(n.message || ""),
      ).length,
    [notifications],
  );

  const arrivalCount = useMemo(
    () => notifications.filter((n) => n.type === "arrival" || /arrival/i.test(n.title || "")).length,
    [notifications],
  );

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.is_read).length,
    [notifications],
  );

  // Filtered notifications list
  const filteredNotifications = useMemo(() => {
    let list = notifications;

    if (activeFilter === "DAMAGE") {
      list = list.filter(
        (n) =>
          /damage|reject|quarantine/i.test(n.title || "") ||
          /damaged\/rejected goods|damaged items:/i.test(n.message || ""),
      );
    } else if (activeFilter === "ARRIVAL") {
      list = list.filter((n) => n.type === "arrival" || /arrival/i.test(n.title || ""));
    } else if (activeFilter === "UNREAD") {
      list = list.filter((n) => !n.is_read);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (n) =>
          (n.title && n.title.toLowerCase().includes(q)) ||
          (n.message && n.message.toLowerCase().includes(q)) ||
          (n.po_number && n.po_number.toLowerCase().includes(q)) ||
          (n.supplier_name && n.supplier_name.toLowerCase().includes(q)),
      );
    }

    return list;
  }, [notifications, activeFilter, searchQuery]);

  return (
    <AppShell
      title="Notification centre"
      subtitle="Stay updated with procurement, quality alerts, and supply chain updates"
      actions={
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="rounded-xl font-medium"
            onClick={handleMarkAllRead}
            disabled={!notifications.some((notification) => !notification.is_read)}
          >
            <Check className="mr-1.5 size-4" />
            Mark all read
          </Button>
        </div>
      }
    >
      {/* FILTER TABS & SEARCH BAR */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs
          value={activeFilter}
          onValueChange={(val: any) => setActiveFilter(val)}
          className="w-full sm:w-auto"
        >
          <TabsList className="grid grid-cols-4 rounded-xl p-1 bg-muted/60">
            <TabsTrigger value="ALL" className="rounded-lg text-xs font-semibold">
              All ({notifications.length})
            </TabsTrigger>
            <TabsTrigger value="DAMAGE" className="rounded-lg text-xs font-semibold flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-rose-500 inline-block" />
              Damaged ({damageCount})
            </TabsTrigger>
            <TabsTrigger value="ARRIVAL" className="rounded-lg text-xs font-semibold flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-blue-500 inline-block" />
              Arrivals ({arrivalCount})
            </TabsTrigger>
            <TabsTrigger value="UNREAD" className="rounded-lg text-xs font-semibold flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-amber-500 inline-block" />
              Unread ({unreadCount})
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="relative max-w-xs w-full">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search notifications..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9 w-full rounded-xl border border-border bg-background pl-9 pr-3 text-xs outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="size-8 animate-spin text-primary" />
        </div>
      ) : filteredNotifications.length === 0 ? (
        <Card className="items-center gap-2 rounded-2xl border-dashed p-14 text-center shadow-none">
          <span className="grid size-14 place-items-center rounded-2xl bg-muted text-muted-foreground mx-auto">
            <Inbox className="size-6" />
          </span>
          <p className="mt-2 text-sm font-semibold">No notifications found</p>
          <p className="max-w-xs text-xs text-muted-foreground mx-auto">
            {searchQuery
              ? `No alerts matching "${searchQuery}".`
              : activeFilter === "DAMAGE"
                ? "No damaged or rejected goods notices at this time."
                : "Your notification history is empty."}
          </p>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredNotifications.map((n) => {
            const damageData = parseDamageNotification(n.title, n.message);

            // =========================================================================
            // 🛑 1. DAMAGED / REJECTED GOODS NOTIFICATION (STRUCTURED TABLE FORMAT)
            // =========================================================================
            if (damageData && damageData.isDamage) {
              const grn = damageData.grnNumber || n.po_number || "";
              const po = damageData.poNumber || n.po_number || "";
              const supplier = damageData.supplier || n.supplier_name || "";
              const warehouse = damageData.warehouse || "Main Warehouse";

              return (
                <Card
                  key={n.id}
                  className={cn(
                    "group relative overflow-hidden rounded-2xl border-2 transition-all shadow-sm",
                    !n.is_read
                      ? "border-rose-300 dark:border-rose-900 bg-rose-50/20 dark:bg-rose-950/20"
                      : "border-border/60 bg-card hover:border-rose-200 dark:hover:border-rose-900",
                  )}
                >
                  {!n.is_read && <div className="absolute left-0 top-0 h-full w-1.5 bg-rose-600" />}

                  <div className="p-5 space-y-4">
                    {/* Header Banner */}
                    <div className="flex flex-wrap items-start justify-between gap-2 border-b border-rose-100 dark:border-rose-900/60 pb-3">
                      <div className="flex items-center gap-3">
                        <div className="grid size-10 place-items-center rounded-xl bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300">
                          <PackageX className="size-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-base text-rose-950 dark:text-rose-100">
                              {n.title || "Damaged / Rejected Goods Detected"}
                            </h3>
                            <Badge className="bg-rose-100 text-rose-800 dark:bg-rose-900/80 dark:text-rose-200 border-rose-200 dark:border-rose-800 text-[10px] font-extrabold uppercase">
                              ACTION REQUIRED
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Damaged or rejected materials reported during GRN Quality Inspection
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-medium text-muted-foreground bg-muted/60 px-2.5 py-1 rounded-lg">
                          {formatNotificationDate(n.created_at || n.createdAt)}
                        </span>
                        {!n.is_read && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs text-rose-700 hover:bg-rose-100 dark:hover:bg-rose-900/50"
                            onClick={() => handleMarkRead(n.id)}
                          >
                            Mark Read
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Metadata Summary Chips */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      {grn && (
                        <div className="rounded-xl border border-border/80 bg-background/80 p-2.5 shadow-2xs">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                            GRN Number
                          </div>
                          <div className="font-mono text-xs font-bold text-foreground mt-0.5">{grn}</div>
                        </div>
                      )}
                      {po && (
                        <div className="rounded-xl border border-border/80 bg-background/80 p-2.5 shadow-2xs">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                            PO Number
                          </div>
                          <div className="font-mono text-xs font-bold text-foreground mt-0.5">{po}</div>
                        </div>
                      )}
                      {supplier && (
                        <div className="rounded-xl border border-border/80 bg-background/80 p-2.5 shadow-2xs">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                            Supplier
                          </div>
                          <div className="text-xs font-bold text-foreground truncate mt-0.5" title={supplier}>
                            {supplier}
                          </div>
                        </div>
                      )}
                      {warehouse && (
                        <div className="rounded-xl border border-border/80 bg-background/80 p-2.5 shadow-2xs">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                            Warehouse
                          </div>
                          <div className="text-xs font-bold text-foreground truncate mt-0.5" title={warehouse}>
                            {warehouse}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* 📊 STRUCTURED DAMAGED ITEMS TABLE */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wide text-foreground flex items-center gap-1.5">
                          <AlertTriangle className="size-3.5 text-rose-600" />
                          Damaged & Rejected Items Breakdown ({damageData.items.length || 1} lines)
                        </span>
                      </div>

                      <div className="overflow-hidden rounded-xl border border-rose-200 dark:border-rose-900/60 bg-background shadow-2xs">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="border-b border-rose-200 dark:border-rose-900/60 bg-rose-50/80 dark:bg-rose-950/40 text-[11px] font-extrabold text-rose-900 dark:text-rose-200 uppercase tracking-wider">
                              <th className="p-2.5 text-center w-10">#</th>
                              <th className="p-2.5">Material Code & Name</th>
                              <th className="p-2.5 text-right w-36">Damaged Qty</th>
                              <th className="p-2.5">Defect / Damage Reason</th>
                              <th className="p-2.5 text-center w-28">QA Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-rose-100 dark:divide-rose-900/40 font-mono">
                            {damageData.items.length > 0 ? (
                              damageData.items.map((item, idx) => (
                                <tr
                                  key={idx}
                                  className="hover:bg-rose-50/40 dark:hover:bg-rose-950/20 transition-colors"
                                >
                                  <td className="p-2.5 text-center text-muted-foreground font-semibold">
                                    {idx + 1}
                                  </td>
                                  <td className="p-2.5 font-sans">
                                    <div className="font-mono font-bold text-foreground text-xs">
                                      {item.code}
                                    </div>
                                    {item.name && (
                                      <div className="text-[11px] text-muted-foreground font-medium">
                                        {item.name}
                                      </div>
                                    )}
                                  </td>
                                  <td className="p-2.5 text-right font-bold">
                                    <span className="inline-block px-2 py-0.5 rounded-md bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                                      {item.quantity}
                                    </span>
                                  </td>
                                  <td className="p-2.5 font-sans text-xs text-foreground font-medium">
                                    {item.reason}
                                  </td>
                                  <td className="p-2.5 text-center">
                                    <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200 border border-rose-300 dark:border-rose-700">
                                      DAMAGED
                                    </span>
                                  </td>
                                </tr>
                              ))
                            ) : (
                              <tr>
                                <td colSpan={5} className="p-4 text-center text-xs text-muted-foreground font-sans">
                                  {n.message}
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Inspector Remarks Callout Box */}
                    {damageData.remarks && (
                      <div className="rounded-xl border border-amber-200 bg-amber-50/60 dark:border-amber-900/50 dark:bg-amber-950/20 p-3 text-xs flex items-start gap-2.5">
                        <ShieldAlert className="size-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold text-amber-900 dark:text-amber-200">
                            Inspector Remarks / Notes:
                          </span>
                          <p className="text-amber-800 dark:text-amber-300 mt-0.5 leading-relaxed font-sans">
                            {damageData.remarks}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Footer Info */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/40">
                      <div className="text-[11px] text-muted-foreground font-medium">
                        Quarantine Location: <b className="text-foreground">QUARANTINE-ZONE-A</b>
                      </div>
                    </div>
                  </div>
                </Card>
              );
            }

            // =========================================================================
            // 📦 2. STANDARD / ARRIVAL / WORKFLOW NOTIFICATIONS
            // =========================================================================
            return (
              <Card
                key={n.id}
                className={cn(
                  "group relative overflow-hidden rounded-2xl border border-border/60 p-5 transition-all hover:border-primary/30 hover:shadow-soft",
                  !n.is_read && "bg-primary-soft/5 border-primary/20",
                )}
              >
                {!n.is_read && <div className="absolute left-0 top-0 h-full w-1 bg-primary" />}

                <div className="flex items-start gap-4">
                  <div
                    className={cn(
                      "grid size-11 shrink-0 place-items-center rounded-2xl",
                      n.type === "arrival"
                        ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                        : n.title?.includes("Approved")
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                          : n.title?.includes("Rejected") || n.title?.includes("Failed")
                            ? "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300"
                            : "bg-primary-soft text-primary",
                    )}
                  >
                    {n.type === "arrival" ? (
                      <Truck className="size-5" />
                    ) : n.title?.includes("Inventory") || n.title?.includes("Putaway") ? (
                      <Package className="size-5" />
                    ) : (
                      <FileText className="size-5" />
                    )}
                  </div>

                  <div className="flex-1 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-bold text-sm text-foreground">{n.title}</h3>
                      <span className="text-[11px] text-muted-foreground font-medium bg-muted/40 px-2 py-0.5 rounded">
                        {formatNotificationDate(n.created_at || n.createdAt)}
                      </span>
                    </div>

                    <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line">
                      {n.message}
                    </p>

                    <div className="mt-3 pt-3 border-t border-border/40 flex items-center justify-between">
                      <div className="flex flex-wrap gap-2">
                        {n.po_number && (
                          <span className="text-[10px] px-2 py-0.5 rounded-md bg-muted font-mono font-bold">
                            PO: {n.po_number}
                          </span>
                        )}
                        {n.supplier_name && (
                          <span className="text-[10px] px-2 py-0.5 rounded-md bg-muted font-medium">
                            {n.supplier_name}
                          </span>
                        )}
                      </div>

                      {!n.is_read && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs text-primary hover:bg-primary-soft/20 font-semibold"
                          onClick={() => handleMarkRead(n.id)}
                        >
                          Mark Read
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
