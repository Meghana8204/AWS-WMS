import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Truck,
  ListOrdered,
  Warehouse,
  PackageCheck,
  FileCheck2,
  Boxes,
  BarChart3,
  Database,
  Settings,
  Search,
  Bell,
  Moon,
  Sun,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Building2,
  FileText,
  ClipboardList,
  FileQuestion,
  FileBadge,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api-client";
import { toast } from "sonner";
<<<<<<< HEAD

type NavItem = { label: string; to: string; icon: any; badge?: number | string };

const warehouseNav: NavItem[] = [
=======
const warehouseNav = [
>>>>>>> origin/main
  { label: "Dashboard", to: "/warehouse-dashboard", icon: LayoutDashboard },
  { label: "Inventory", to: "/inventory", icon: Boxes },
  { label: "Putaway Tasks", to: "/putaway-tasks", icon: PackageCheck },
  { label: "Material Requests", to: "/warehouse/material-requests", icon: ClipboardList },
  { label: "Inbound Arrivals", to: "/vehicle-queue", icon: ListOrdered },
  { label: "Vehicle Exit", to: "/vehicle-exit", icon: LogOut },
  { label: "Dock Management", to: "/dock-management", icon: Warehouse },
  { label: "Dock / Receiving", to: "/receiving", icon: PackageCheck },
  { label: "Reports", to: "/reports", icon: BarChart3 },
];
<<<<<<< HEAD

const procurementNav: NavItem[] = [
=======
const procurementNav = [
>>>>>>> origin/main
  { label: "Dashboard", to: "/procurement-dashboard", icon: LayoutDashboard },
  { label: "Suppliers", to: "/master-data", icon: Building2 },
  { label: "Material Requests", to: "/procurement/material-requests", icon: ClipboardList },
  { label: "RFQs", to: "/procurement/rfqs", icon: FileQuestion },
  { label: "Quotations", to: "/procurement/quotations", icon: FileBadge },
  { label: "Purchase Orders", to: "/procurement/purchase-orders", icon: FileText },
  { label: "ASNs", to: "/procurement/asns", icon: Truck },
];
<<<<<<< HEAD

const supplierNav: NavItem[] = [
=======
const supplierNav = [
>>>>>>> origin/main
  { label: "Dashboard", to: "/supplier-dashboard", icon: LayoutDashboard },
  { label: "Quotation Portal", to: "/submit-quotation", icon: FileBadge },
  { label: "ASNs", to: "/supplier/asns/new", icon: Truck },
];
<<<<<<< HEAD

const financeNav: NavItem[] = [
=======
const financeNav = [
>>>>>>> origin/main
  { label: "Dashboard", to: "/finance-dashboard", icon: LayoutDashboard },
  { label: "Pending Approvals", to: "/finance/approvals", icon: FileCheck2 },
  { label: "Reports", to: "/reports", icon: BarChart3 },
];
<<<<<<< HEAD

const gateSecurityNav: NavItem[] = [
  { label: "Dashboard", to: "/warehouse-dashboard", icon: LayoutDashboard },
  { label: "Gate Entry", to: "/gate-entry", icon: DoorOpen },
  { label: "Arrival Mgmt", to: "/notifications", icon: Truck },
=======
const gateSecurityNav = [
  { label: "Dashboard", to: "/gate-dashboard", icon: LayoutDashboard },
  { label: "Gate Entry", to: "/gate-entry", icon: ShieldCheck },
>>>>>>> origin/main
  { label: "Inbound Arrivals", to: "/vehicle-queue", icon: ListOrdered },
  { label: "Vehicle Exit", to: "/vehicle-exit", icon: LogOut },
];
export function AppShell({
  children,
  title,
  subtitle,
  actions,
}: {
  children: ReactNode;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [dark, setDark] = useState(false);
  const [mounted, setMounted] = useState(false);
  const path = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const [user, setUser] = useState<{
    username?: string;
    roles?: string[];
  } | null>(null);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (searchTerm.length >= 2) {
        setIsSearching(true);
        try {
          const data = await api.globalSearch(searchTerm);
          setSearchResults(data.results);
          setShowSearch(true);
        } catch (e) {
          console.error("Search failed", e);
        } finally {
          setIsSearching(false);
        }
      } else {
        setSearchResults([]);
        setShowSearch(false);
      }
    }, 300);
    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm]);
  useEffect(() => {
    setMounted(true);
    document.documentElement.classList.toggle("dark", dark);
<<<<<<< HEAD

    let cleanup: (() => void) | undefined;
=======
>>>>>>> origin/main
    try {
      const savedUser = localStorage.getItem("user_info");
      if (savedUser) {
        const u = JSON.parse(savedUser);
        setUser(u);
<<<<<<< HEAD

        // Fetch notifications for the user's role
=======
>>>>>>> origin/main
        const role = u.roles?.includes("SUPPLIER")
          ? "SUPPLIER"
          : u.roles?.includes("FINANCE")
            ? "FINANCE"
            : u.roles?.includes("PROCUREMENT")
              ? "PROCUREMENT"
              : "WAREHOUSE";
        const fetchNotifications = async () => {
          try {
            if (role === "WAREHOUSE") {
              const data = await api.getArrivalNotifications();
              setUnreadNotifications(
                data.filter((n) => String(n.status || "").toUpperCase() !== "ACKNOWLEDGED").length,
              );
            } else {
              const data = await api.getNotifications(role);
              setUnreadNotifications(data.filter((n) => !(n.is_read ?? n.isRead)).length);
            }
          } catch (e) {
            console.error("Failed to fetch notifications", e);
          }
        };
        void fetchNotifications();
        const interval = window.setInterval(fetchNotifications, 2000);
        window.addEventListener("notifications:refresh", fetchNotifications);
        window.addEventListener("focus", fetchNotifications);
        cleanup = () => {
          window.clearInterval(interval);
          window.removeEventListener("notifications:refresh", fetchNotifications);
          window.removeEventListener("focus", fetchNotifications);
        };
      }
    } catch (e) {
      console.error("Failed to parse user info", e);
    }
    return () => {
      if (cleanup) cleanup();
    };
  }, [dark]);
  const isProcurementRoute =
    path === "/procurement-dashboard" ||
    path.startsWith("/procurement/") ||
    path === "/master-data" ||
    path === "/new-supplier" ||
    (path.startsWith("/supplier/") && !path.startsWith("/supplier/asns/"));
  const isSupplierRoute = path === "/supplier-dashboard" || path === "/submit-quotation";
<<<<<<< HEAD
  const isFinanceRoute = path === "/finance-dashboard" || path.startsWith("/finance/");
  const isWarehouseRoute =
    path === "/warehouse-dashboard" ||
    [
      "/inventory",
      "/warehouse/material-requests",
      "/gate-entry",
      "/notifications",
      "/vehicle-queue",
      "/receiving",
      "/reports",
    ].some((p) => path.startsWith(p));

  const nav =
    isSupplierRoute || (mounted && user?.roles?.includes("SUPPLIER"))
      ? supplierNav
      : isFinanceRoute || (mounted && user?.roles?.includes("FINANCE"))
        ? financeNav
        : isProcurementRoute || (mounted && user?.roles?.includes("PROCUREMENT"))
          ? procurementNav
          : mounted && user?.roles?.includes("GATE_SECURITY")
            ? gateSecurityNav
            : warehouseNav;

=======
  const isFinanceUser = mounted && user?.roles?.includes("FINANCE");
  const isSharedFinanceRoute = path.startsWith("/reports");
  const isFinanceRoute =
    path === "/finance-dashboard" ||
    path.startsWith("/finance/") ||
    (isFinanceUser && isSharedFinanceRoute);
  const isGateSecurityUser = mounted && user?.roles?.includes("GATE_SECURITY");
  const isNotificationsRoute = path.startsWith("/notifications");
  const isSharedOperationsRoute = ["/warehouse-dashboard", "/vehicle-queue", "/vehicle-exit"].some(
    (route) => path.startsWith(route),
  );
  const isWarehouseRoute =
    isSharedOperationsRoute ||
    [
      "/inventory",
      "/warehouse/material-requests",
      "/dock-management",
      "/receiving",
      "/putaway-tasks",
      "/reports",
    ].some((p) => path.startsWith(p));
  const isGateSecurityRoute =
    [
      "/gate-entry",
      "/gate-dashboard",
      "/accept-arrival",
      "/driver-verification",
      "/vehicle-verification",
      "/dock-assignment",
      "/arrival-success",
    ].some((route) => path.startsWith(route)) ||
    (isGateSecurityUser && (isSharedOperationsRoute || isNotificationsRoute));
  const resolvedNav = isSupplierRoute
    ? supplierNav
    : isFinanceRoute
      ? financeNav
      : isProcurementRoute
        ? procurementNav
        : isGateSecurityRoute
          ? gateSecurityNav
          : isWarehouseRoute
            ? warehouseNav
            : mounted && user?.roles?.includes("SUPPLIER")
              ? supplierNav
              : mounted && user?.roles?.includes("FINANCE")
                ? financeNav
                : mounted && user?.roles?.includes("PROCUREMENT")
                  ? procurementNav
                  : isGateSecurityUser
                    ? gateSecurityNav
                    : warehouseNav;
  const navigationPending = !mounted && (isSharedOperationsRoute || isSharedFinanceRoute);
  const nav = navigationPending ? [] : resolvedNav;
>>>>>>> origin/main
  const handleLogout = () => {
    api.logout();
    toast.success("Logged out successfully");
    navigate({ to: "/login" });
  };
  return (
    <div className="flex min-h-screen w-full bg-background">
      <aside
        className={cn(
          "sticky top-0 hidden h-screen shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-300 md:flex",
          collapsed ? "w-[76px]" : "w-[264px]",
        )}
      >
        <div
          className={cn(
            "flex h-16 items-center border-b border-sidebar-border/40 transition-all",
            collapsed ? "justify-center px-2" : "justify-between gap-2 px-4",
          )}
        >
          {!collapsed ? (
            <>
              <div className="flex items-center gap-3 min-w-0">
                <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-glow">
                  <Warehouse className="size-5" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold tracking-tight">NexusWMS</p>
                  <p className="truncate text-[11px] text-muted-foreground">Pune DC · Plant 1200</p>
                </div>
              </div>
              <button
                onClick={() => setCollapsed(true)}
                title="Collapse sidebar"
                className="grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
              >
                <ChevronLeft className="size-5" />
              </button>
            </>
          ) : (
            <button
              onClick={() => setCollapsed(false)}
              title="Expand sidebar"
              className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary transition-all hover:bg-primary hover:text-primary-foreground shadow-soft"
            >
              <ChevronRight className="size-5" />
            </button>
          )}
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-3">
          {navigationPending &&
            Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-10 animate-pulse rounded-xl bg-sidebar-accent/60" />
            ))}
          {nav.map((item) => {
            const active =
              path === item.to || (item.to !== "/dashboard" && path.startsWith(item.to));
            return (
              <Link
                key={item.to}
                to={item.to}
                title={item.label}
                className={cn(
                  "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-sidebar-foreground transition-all",
                  "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  active && "bg-primary-soft text-primary shadow-soft",
                )}
              >
                <item.icon className={cn("size-[18px] shrink-0", active && "text-primary")} />
                {!collapsed && <span className="truncate">{item.label}</span>}
                {!collapsed && item.badge && (
                  <span className="ml-auto grid size-5 place-items-center rounded-full bg-destructive text-[10px] font-semibold text-destructive-foreground">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
<<<<<<< HEAD
=======

        <div className="border-t border-sidebar-border p-3 space-y-1">
          <button
            suppressHydrationWarning
            onClick={() => setCollapsed((c) => !c)}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent"
          >
            {collapsed ? (
              <PanelLeft className="size-[18px]" />
            ) : (
              <PanelLeftClose className="size-[18px]" />
            )}
            {!collapsed && <span>Collapse</span>}
          </button>
          <button
            suppressHydrationWarning
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-destructive transition-colors hover:bg-danger-soft"
          >
            <LogOut className="size-[18px]" />
            {!collapsed && <span>Logout</span>}
          </button>
        </div>
>>>>>>> origin/main
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 glass-strong">
          <div className="flex h-16 items-center gap-3 px-4 lg:px-7">
            <Link
<<<<<<< HEAD
              to={nav[0]?.to || "/"}
=======
              to={nav[0]?.to ?? "/warehouse-dashboard"}
>>>>>>> origin/main
              className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground md:hidden"
            >
              <Warehouse className="size-4" />
            </Link>
            <div className="relative hidden max-w-md flex-1 items-center sm:flex">
              <Search className="pointer-events-none absolute left-3 size-4 text-muted-foreground" />
              <input
                suppressHydrationWarning
                placeholder="Search truck no, PO, vendor, gate entry…"
                className="h-10 w-full rounded-xl border border-border bg-muted/60 pl-9 pr-16 text-sm outline-none transition-shadow placeholder:text-muted-foreground focus:bg-card focus:ring-2 focus:ring-ring/40"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onFocus={() => searchTerm.length >= 2 && setShowSearch(true)}
              />
              <kbd className="absolute right-3 hidden rounded-md border border-border bg-card px-1.5 py-0.5 text-[10px] text-muted-foreground lg:block">
                {isSearching ? <Loader2 className="size-3 animate-spin" /> : "⌘K"}
              </kbd>

              {showSearch && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowSearch(false)} />
                  <div className="absolute top-full left-0 mt-2 w-full min-w-[320px] max-h-[480px] overflow-y-auto z-50 rounded-2xl border border-border bg-card shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="p-2">
                      {searchResults.length > 0 ? (
                        <div className="space-y-1">
                          {searchResults.map((result) => (
                            <Link
                              key={`${result.type}-${result.id}`}
                              to={result.link}
                              onClick={() => {
                                setShowSearch(false);
                                setSearchTerm("");
                              }}
                              className="flex flex-col gap-0.5 rounded-xl px-4 py-2.5 transition-colors hover:bg-accent"
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-bold tracking-tight">
                                  {result.title}
                                </span>
                                <Badge
                                  variant="outline"
                                  className="text-[10px] font-black uppercase py-0 leading-tight border-primary/20 text-primary bg-primary-soft/30"
                                >
                                  {result.type.replace("_", " ")}
                                </Badge>
                              </div>
                              <span className="text-[11px] text-muted-foreground line-clamp-1">
                                {result.subtitle}
                              </span>
                            </Link>
                          ))}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                          <Search className="mb-2 size-8 opacity-20" />
                          <p className="text-sm font-medium">No results found for "{searchTerm}"</p>
                          <p className="text-xs">Try searching for a different PO, ASN or Vendor</p>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="ml-auto flex items-center gap-1.5">
              <button
                suppressHydrationWarning
                onClick={() => setDark((d) => !d)}
                aria-label="Toggle dark mode"
                className="grid size-10 place-items-center rounded-xl text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                {dark ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
              </button>
              <Link
                to="/notifications"
                aria-label="Notifications"
                className="relative grid size-10 place-items-center rounded-xl text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <Bell className="size-[18px]" />
                {unreadNotifications > 0 && (
                  <span className="absolute right-2 top-2 grid size-4 place-items-center rounded-full bg-destructive text-[9px] font-bold text-white animate-pulse-ring">
                    {unreadNotifications}
                  </span>
                )}
              </Link>
              <div className="group relative ml-1 flex items-center gap-2.5 rounded-xl border border-border bg-card py-1.5 pl-1.5 pr-3 transition-colors hover:bg-accent/50">
                <span className="grid size-8 place-items-center rounded-lg bg-primary text-xs font-semibold text-primary-foreground">
                  {user?.username?.substring(0, 2).toUpperCase() || "AO"}
                </span>
                <div className="hidden leading-tight lg:block">
                  <p className="text-xs font-semibold">{user?.username || "Admin Officer"}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {user?.roles?.includes("PROCUREMENT")
                      ? "Procurement Manager"
                      : user?.roles?.includes("FINANCE")
                        ? "Finance Manager"
                        : user?.roles?.includes("GATE_SECURITY")
                          ? "Security Officer"
<<<<<<< HEAD
                          : "Warehouse Manager"}
=======
                          : "Operations Manager"}
>>>>>>> origin/main
                  </p>
                </div>
                <button
                  suppressHydrationWarning
                  onClick={handleLogout}
                  className="ml-2 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                  title="Logout"
                >
                  <LogOut className="size-4" />
                </button>
              </div>
            </div>
          </div>
        </header>

        <main className="page-enter flex-1 px-4 py-6 lg:px-7">
          <div className="mx-auto w-full max-w-[1360px]">
            <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight lg:text-[28px]">{title}</h1>
                {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
              </div>
              {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
            </div>
            {children}
          </div>
        </main>

        <nav className="sticky bottom-0 z-30 grid grid-cols-5 border-t border-border glass-strong md:hidden">
          {nav.slice(0, 5).map((item) => {
            const active = path === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium text-muted-foreground",
                  active && "text-primary",
                )}
              >
                <item.icon className="size-[18px]" />
                {item.label.split(" ")[0]}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
<<<<<<< HEAD

export function StatusBadge({ status, className }: { status: string; className?: string }) {
=======
export function StatusBadge({ status }: { status: string }) {
>>>>>>> origin/main
  const map: Record<string, string> = {
    Waiting: "bg-warning-soft text-warning-foreground border-warning/30",
    Active: "bg-success-soft text-success border-success/30",
    Blocked: "bg-danger-soft text-destructive border-destructive/25",
    Approved: "bg-success-soft text-success border-success/30",
    APPROVED: "bg-success-soft text-success border-success/30",
    "Dock Assigned": "bg-teal-soft text-teal border-teal/30",
    Receiving: "bg-primary-soft text-primary border-primary/25",
    Completed: "bg-success-soft text-success border-success/30",
    Rejected: "bg-danger-soft text-destructive border-destructive/25",
    REJECTED: "bg-danger-soft text-destructive border-destructive/25",
    FINANCE_REJECTED: "bg-danger-soft text-destructive border-destructive/25",
    PO_VERIFIED: "bg-success-soft text-success border-success/30",
    UNSCHEDULED_ARRIVAL: "bg-warning-soft text-warning-foreground border-warning/30",
    AWAITING_DOCK: "bg-warning-soft text-warning-foreground border-warning/30",
    DOCK_ASSIGNED: "bg-teal-soft text-teal border-teal/30",
    MOVING_TO_DOCK: "bg-primary-soft text-primary border-primary/25",
    AT_DOCK: "bg-success-soft text-success border-success/30",
    UNLOADING_IN_PROGRESS: "bg-primary-soft text-primary border-primary/25",
    QUALITY_INSPECTION_REQUIRED: "bg-warning-soft text-warning border-warning/25",
    QUALITY_PASSED: "bg-success-soft text-success border-success/25",
    QUALITY_FAILED: "bg-destructive/10 text-destructive border-destructive/25",
    RECEIVING_COMPLETED: "bg-success-soft text-success border-success/25",
    GRN_DRAFT: "bg-warning-soft text-warning border-warning/25",
    GRN_POSTED: "bg-success-soft text-success border-success/25",
    PUTAWAY_PENDING: "bg-warning-soft text-warning border-warning/25",
    PUTAWAY_IN_PROGRESS: "bg-info-soft text-info border-info/25",
    PUTAWAY_COMPLETED: "bg-success-soft text-success border-success/25",
    EXIT_APPROVED: "bg-success-soft text-success border-success/25",
    GATE_EXIT_COMPLETED: "bg-success-soft text-success border-success/25",
    GATE_ENTRY_APPROVED: "bg-success-soft text-success border-success/30",
    FIELD_MISMATCH_DETECTED: "bg-danger-soft text-destructive border-destructive/25",
    Hold: "bg-muted text-muted-foreground border-border",
    Available: "bg-success-soft text-success border-success/30",
    Occupied: "bg-danger-soft text-destructive border-destructive/25",
    AVAILABLE: "bg-success-soft text-success border-success/30",
    OCCUPIED: "bg-danger-soft text-destructive border-destructive/25",
    MAINTENANCE: "bg-muted text-muted-foreground border-border",
    Reserved: "bg-warning-soft text-warning-foreground border-warning/30",
    Cleaning: "bg-muted text-muted-foreground border-border",
    SUBMITTED: "bg-primary-soft text-primary border-primary/25",
    DRAFT: "bg-muted text-muted-foreground border-border",
    ASN_SUBMITTED: "bg-primary-soft text-primary border-primary/25",
    IN_TRANSIT: "bg-teal-soft text-teal border-teal/30",
    PLACED: "bg-teal-soft text-teal border-teal/30",
    PENDING_FINANCE: "bg-warning-soft text-warning-foreground border-warning/30",
    SENT: "bg-primary-soft text-primary border-primary/25",
    SHIPPED: "bg-teal-soft text-teal border-teal/30",
    DISPATCHED: "bg-teal-soft text-teal border-teal/30",
  };
  const isLive = ["PO_VERIFIED", "APPROVED", "Receiving", "Active"].includes(status);
  return (
    <Badge
      variant="outline"
      className={cn(
        "relative rounded-full border px-2.5 py-0.5 text-[11px] font-semibold",
        map[status] ?? map["Hold"],
        isLive && "pl-5",
<<<<<<< HEAD
        className,
=======
>>>>>>> origin/main
      )}
    >
      {isLive && (
        <span className="absolute left-2 top-1/2 flex size-1.5 -translate-y-1/2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-75"></span>
          <span className="relative inline-flex size-1.5 rounded-full bg-current"></span>
        </span>
      )}
      {status.replace(/_/g, " ")}
    </Badge>
  );
}
