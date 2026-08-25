import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Truck, Inbox, Loader2, FileText } from "lucide-react";
import { AppShell } from "@/components/wms/app-shell";
import { Card } from "@/components/ui/card";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { requireAuth } from "@/lib/auth-utils";
export const Route = createFileRoute("/notifications")({
  beforeLoad: () => requireAuth(),
  component: Notifications,
});
function Notifications() {
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [userRole, setUserRole] = useState("WAREHOUSE");
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
          {notifications.map((n, i) => (
            <Card
              key={n.id}
              className={cn(
                "relative overflow-hidden border-border/50 p-5",
                !n.is_read && "bg-primary-soft/5 border-primary/20",
              )}
            >
              {!n.is_read && <div className="absolute left-0 top-0 h-full w-1 bg-primary" />}

              <div className="flex items-start gap-4">
                <div
                  className={cn(
                    "grid size-12 shrink-0 place-items-center rounded-2xl",
                    n.title?.includes("Approved")
                      ? "bg-success-soft text-success"
                      : n.title?.includes("Rejected")
                        ? "bg-destructive-soft text-destructive"
                        : "bg-primary-soft text-primary",
                  )}
                >
                  {n.type === "arrival" ? (
                    <Truck className="size-6" />
                  ) : (
                    <FileText className="size-6" />
                  )}
                </div>

                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-foreground">{n.title}</h3>
                    <span className="text-[10px] text-muted-foreground font-medium">
                      {n.created_at && !Number.isNaN(new Date(n.created_at).getTime())
                        ? new Date(n.created_at).toLocaleString()
                        : "Date unavailable"}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">{n.message}</p>

                  {(n.po_number || n.supplier_name) && (
                    <div className="mt-4 pt-4 border-t border-border/40 flex items-center justify-between">
                      <div className="flex gap-2">
                        {n.po_number && (
                          <span className="text-[10px] px-2 py-0.5 rounded bg-muted font-mono">
                            PO: {n.po_number}
                          </span>
                        )}
                        {n.supplier_name && (
                          <span className="text-[10px] px-2 py-0.5 rounded bg-muted">
                            {n.supplier_name}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </AppShell>
  );
}
