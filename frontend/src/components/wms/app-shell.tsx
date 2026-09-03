import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  DoorOpen,
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
  LogOut,
  Building2,
  FileText,
  ClipboardList,
  FileQuestion,
  FileBadge,
  Loader2,
  Factory,
  Users,
  Menu,
  AlertTriangle,
  ShieldCheck,
  Sliders,
  PanelLeft,
  PanelLeftClose,
  AlertTriangle,
  QrCode,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api-client";
import { getUserInfo } from "@/lib/auth-utils";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";

const grnNav = [
  { label: "GRN Operations Dashboard", to: "/grn?tab=dashboard", icon: LayoutDashboard },
  { label: "GRN Records History", to: "/grn?tab=records", icon: ClipboardList },
  { label: "Header Details & Entry", to: "/grn?tab=wizard&page=1", icon: ShieldCheck },
  { label: "Material Receiving", to: "/grn?tab=wizard&page=2", icon: PackageCheck },
  { label: "Quality & Photos", to: "/grn?tab=wizard&page=3", icon: AlertTriangle },
  { label: "Batch Allocation", to: "/grn?tab=wizard&page=4", icon: Boxes },
  { label: "Documents & Posting", to: "/grn?tab=wizard&page=5", icon: FileText },
  { label: "Batch QR Code Labels", to: "/grn?tab=wizard&page=6", icon: QrCode },
  { label: "Inbound Arrivals", to: "/vehicle-queue", icon: ListOrdered },
];
const warehouseNav = [
  { label: "Dashboard", to: "/warehouse-dashboard", icon: LayoutDashboard },
  { label: "Material Master", to: "/warehouse/materials", icon: Database },
  { label: "Inventory", to: "/inventory", icon: Boxes },
  { label: "Warehouses & Locations", to: "/warehouse-storage", icon: Warehouse },
  { label: "Putaway Tasks", to: "/putaway-tasks", icon: PackageCheck },
  { label: "Pick Tasks", to: "/pick-tasks", icon: PackageCheck },
  { label: "Material Requests", to: "/warehouse/material-requests", icon: ClipboardList },
  { label: "Vehicle Exit", to: "/vehicle-exit", icon: LogOut },
  { label: "Dock Management", to: "/dock-management", icon: Warehouse },
  { label: "Dock / Receiving", to: "/receiving", icon: PackageCheck },
  { label: "GRN", to: "/grn", icon: FileCheck2 },
  { label: "Damage Claims", to: "/damage-claims", icon: AlertTriangle },
];

const procurementNav = [
  { label: "Dashboard", to: "/procurement-dashboard", icon: LayoutDashboard },
  { label: "Suppliers", to: "/master-data", icon: Building2 },
  { label: "Material Requests", to: "/procurement/material-requests", icon: ClipboardList },
  { label: "RFQs", to: "/procurement/rfqs", icon: FileQuestion },
  { label: "Quotations", to: "/procurement/quotations", icon: FileBadge },
  { label: "Purchase Orders", to: "/procurement/purchase-orders", icon: FileText },
  { label: "ASNs", to: "/procurement/asns", icon: Truck },
  { label: "Quality Issues", to: "/procurement/quality-issues", icon: AlertTriangle },
  { label: "Damage Claims", to: "/damage-claims", icon: FileCheck2 },
];

const supplierNav = [
  { label: "Dashboard", to: "/supplier-dashboard", icon: LayoutDashboard },
  { label: "Quotation Portal", to: "/submit-quotation", icon: FileBadge },
  { label: "ASNs", to: "/supplier/asns/new", icon: Truck },
  { label: "Quality Issues", to: "/supplier/quality-issues", icon: AlertTriangle },
  { label: "Damage Claims", to: "/damage-claims", icon: FileCheck2 },
];

const financeNav = [
  { label: "Dashboard", to: "/finance-dashboard", icon: LayoutDashboard },
  { label: "Pending Approvals", to: "/finance/approvals", icon: FileCheck2 },
];

const gateSecurityNav = [
  { label: "Dashboard", to: "/gate-dashboard", icon: LayoutDashboard },
  { label: "Gate Entry", to: "/gate-entry", icon: DoorOpen },
  { label: "Vehicle Exit", to: "/vehicle-exit", icon: LogOut },
  { label: "Inbound Arrivals", to: "/vehicle-queue", icon: ListOrdered },
  { label: "Unscheduled Arrivals", to: "/unscheduled-arrivals", icon: FileQuestion },
  { label: "Replacement Claims", to: "/damage-claims", icon: AlertTriangle },
];

const assemblyNav = [
  { label: "Dashboard", to: "/assembly-dashboard", icon: LayoutDashboard },
  { label: "Assembly Orders", to: "/assembly-orders", icon: Factory },
  { label: "Material Requirements", to: "/assembly-material-requirements", icon: ClipboardList },
  { label: "Material Reservations", to: "/assembly-material-reservations", icon: Boxes },
  { label: "Material Issues", to: "/assembly-material-issues", icon: PackageCheck },
  { label: "Work Orders", to: "/assembly-work-orders", icon: Factory },
  { label: "Assembly Teams", to: "/assembly-workforce", icon: Users },
  { label: "Assembly Progress", to: "/assembly-progress", icon: BarChart3 },
  { label: "Material Consumption", to: "/assembly-material-consumption", icon: Boxes },
  { label: "Scrap / Wastage", to: "/assembly-scrap-wastage", icon: FileText },
  { label: "Quality Inspection", to: "/assembly-quality-inspection", icon: FileCheck2 },
  { label: "Rework", to: "/assembly-rework", icon: Settings },
  { label: "Finished Goods", to: "/assembly-finished-goods", icon: Warehouse },
  { label: "Reports", to: "/assembly-reports", icon: BarChart3 },
  { label: "Notifications", to: "/notifications", icon: Bell },
];

function isActiveRoute(path: string, target: string): boolean {
  return path === target || path.startsWith(`${target}/`);
}

function isActiveNavItem(
  path: string,
  currentSearch: Record<string, unknown>,
  item: { to: string; search?: Record<string, unknown> },
  navItems: ReadonlyArray<{ to: string; search?: Record<string, unknown> }>,
): boolean {
  if (!isActiveRoute(path, item.to)) return false;

  if (item.search) {
    return Object.entries(item.search).every(([key, value]) => currentSearch[key] === value);
  }

  // A base link and a filtered link can share a pathname. Keep the base link
  // inactive while one of its sibling filters is selected.
  const siblingSearchKeys = navItems
    .filter((navItem) => navItem.to === item.to && navItem.search)
    .flatMap((navItem) => Object.keys(navItem.search ?? {}));

  return siblingSearchKeys.every((key) => currentSearch[key] == null);
}

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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [dark, setDark] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { path, currentSearch } = useRouterState({
    select: (s) => ({
      path: s.location.pathname,
      currentSearch: s.location.search as Record<string, unknown>,
    }),
  });
  const fullHref = path;
  const navigate = useNavigate();
  const [user, setUser] = useState<{ username?: string; roles?: string[] } | null>(null);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  // Global Search State
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
    let cleanup: (() => void) | undefined;
    setMounted(true);
    document.documentElement.classList.toggle("dark", dark);

    // Load user only on client side to prevent hydration mismatch
    try {
      const savedUser = getUserInfo();
      if (savedUser) {
        const u = savedUser;
        setUser(u);

        // Fetch notifications for the user's role
        const role = u.roles?.includes("SUPPLIER")
          ? "SUPPLIER"
          : u.roles?.includes("FINANCE")
            ? "FINANCE"
            : u.roles?.includes("PROCUREMENT")
              ? "PROCUREMENT"
              : u.roles?.includes("ASSEMBLY_MANAGER")
                ? "ASSEMBLY_MANAGER"
                : "WAREHOUSE";
        const fetchNotifications = async () => {
          try {
            if (role === "WAREHOUSE") {
              const data = await api.getArrivalNotifications();
              setUnreadNotifications(
                Array.isArray(data)
                  ? data.filter((n) => String(n?.status || "").toUpperCase() !== "ACKNOWLEDGED").length
                  : 0,
              );
            } else {
              const data = await api.getNotifications(role);
              setUnreadNotifications(
                Array.isArray(data)
                  ? data.filter((n) => !(n?.is_read ?? n?.isRead)).length
                  : 0,
              );
            }
          } catch {
            // Silently ignore during background polling
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
  const isGrnUser = mounted && (user?.roles?.includes("GRN") || user?.username?.toLowerCase() === "grn");
  const isGrnRoute = path === "/grn" || path.startsWith("/grn");
  const isProcurementRoute = path === "/procurement-dashboard" || path.startsWith("/procurement/");
  const isSupplierRoute = path === "/supplier-dashboard" || path === "/submit-quotation" || path.startsWith("/supplier/");
  const isFinanceRoute = path === "/finance-dashboard" || path.startsWith("/finance/");
  const isGateSecurityRoute =
    path === "/gate-dashboard" ||
    path === "/gate-entry" ||
    path === "/vehicle-exit" ||
    path === "/vehicle-queue" ||
    path === "/unscheduled-arrivals";
  const isAssemblyRoute = path === "/assembly-dashboard" || path.startsWith("/assembly-orders") || path.startsWith("/assembly-workforce");
  const isWarehouseRoute =
    path === "/warehouse-dashboard" ||
    [
      "/inventory",
      "/warehouse-storage",
      "/warehouse/material-requests",
      "/notifications",
      "/receiving",
      "/grn",
    ].some((p) => path.startsWith(p));

  const routeNav = (isGrnUser || isGrnRoute)
    ? grnNav
    : isSupplierRoute
      ? supplierNav
      : isProcurementRoute
        ? procurementNav
        : isFinanceRoute
          ? financeNav
          : isGateSecurityRoute
            ? gateSecurityNav
            : isAssemblyRoute
              ? assemblyNav
              : isWarehouseRoute
                ? warehouseNav
                : null;

  const roleNav = user?.roles?.includes("SUPPLIER")
    ? supplierNav
    : user?.roles?.includes("FINANCE")
      ? financeNav
      : user?.roles?.includes("PROCUREMENT")
        ? procurementNav
        : user?.roles?.includes("GATE_SECURITY")
          ? gateSecurityNav
          : user?.roles?.includes("ASSEMBLY_MANAGER")
            ? assemblyNav
            : warehouseNav;

  const nav = routeNav ?? (mounted ? roleNav : warehouseNav);

  const moduleLabel = isSupplierRoute
    ? "Supplier Portal"
    : isProcurementRoute
      ? "Procurement Portal"
      : isFinanceRoute
        ? "Finance Portal"
        : isGateSecurityRoute
          ? "Gate Security Portal"
          : isAssemblyRoute
            ? "Assembly Portal"
            : "Warehouse navigation";
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
            </>
          ) : (
            <div className="grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground shadow-glow">
              <Warehouse className="size-5" />
            </div>
          )}
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-3">
          {nav.map((item) => {
            const active = isActiveNavItem(path, currentSearch, item, nav);
            return (
              <Link
                key={`${item.label}-${item.to}`}
                to={item.to}
                search={item.search}
                title={item.label}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-sidebar-foreground transition-all",
                  "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  active && "bg-primary-soft text-primary shadow-soft",
                )}
              >
                <item.icon className={cn("size-[18px] shrink-0", active && "text-primary")} />
                {!collapsed && <span className="truncate">{item.label}</span>}
                {!collapsed && (item as any).badge && (
                  <span className="ml-auto grid size-5 place-items-center rounded-full bg-destructive text-[10px] font-semibold text-destructive-foreground">
                    {(item as any).badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-sidebar-border p-3 space-y-1">
          <button
            type="button"
            suppressHydrationWarning
            onClick={() => setCollapsed((value) => !value)}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent"
          >
            {collapsed ? (
              <PanelLeft className="size-[18px] shrink-0" />
            ) : (
              <PanelLeftClose className="size-[18px] shrink-0" />
            )}
            {!collapsed && <span>Collapse</span>}
          </button>
          <button
            type="button"
            suppressHydrationWarning
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-destructive transition-colors hover:bg-danger-soft"
          >
            <LogOut className="size-[18px]" />
            {!collapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>

      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side="left" className="flex w-[300px] flex-col gap-0 border-sidebar-border bg-sidebar p-0 sm:max-w-[320px]">
          <SheetTitle className="sr-only">{moduleLabel}</SheetTitle>
          <SheetDescription className="sr-only">Navigate within the current module</SheetDescription>
          <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-4">
            <div className="grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground shadow-glow">
              <Warehouse className="size-5" />
            </div>
            <div>
              <p className="text-sm font-semibold tracking-tight">NexusWMS</p>
              <p className="text-[11px] text-muted-foreground">Pune DC · Plant 1200</p>
            </div>
          </div>
          <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
            {nav.map((item) => {
              const active = isActiveNavItem(path, currentSearch, item, nav);
              return (
                <Link
                  key={`${item.label}-${item.to}`}
                  to={item.to}
                  search={item.search}
                  onClick={() => setMobileMenuOpen(false)}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent",
                    active && "bg-primary-soft text-primary",
                  )}
                >
                  <item.icon className="size-[18px] shrink-0" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
          <div className="border-t border-sidebar-border p-3">
            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-destructive hover:bg-danger-soft"
            >
              <LogOut className="size-[18px]" /> Logout
            </button>
          </div>
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 glass-strong">
          <div className="flex h-16 items-center gap-3 px-4 lg:px-7">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation menu"
              className="grid size-10 shrink-0 place-items-center rounded-xl border border-border bg-card text-foreground shadow-sm md:hidden"
            >
              <Menu className="size-5" />
            </button>
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

              {/* Search Results Dropdown */}
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
                type="button"
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
                          : user?.roles?.includes("ASSEMBLY_MANAGER")
                            ? "Assembly Manager"
                          : "Operations Manager"}
                  </p>
                </div>
                <button
                  type="button"
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

      </div>
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
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
    RESERVED: "bg-warning-soft text-warning-foreground border-warning/30",
    Reserved: "bg-warning-soft text-warning-foreground border-warning/30",
    MAINTENANCE: "bg-slate-500/10 text-slate-600 border-slate-500/30 dark:text-slate-400",
    "Under Maintenance": "bg-slate-500/10 text-slate-600 border-slate-500/30 dark:text-slate-400",
    UNDER_MAINTENANCE: "bg-slate-500/10 text-slate-600 border-slate-500/30 dark:text-slate-400",
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
  let displayLabel = status.replace(/_/g, " ");
  if (displayLabel.toUpperCase() === "OCCUPIED") {
    displayLabel = "AT DOCK";
  }

  return (
    <Badge
      variant="outline"
      className={cn(
        "relative rounded-full border px-2.5 py-0.5 text-[11px] font-semibold",
        map[status] ?? map[displayLabel] ?? map["Hold"],
        isLive && "pl-5",
      )}
    >
      {isLive && (
        <span className="absolute left-2 top-1/2 flex size-1.5 -translate-y-1/2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-75"></span>
          <span className="relative inline-flex size-1.5 rounded-full bg-current"></span>
        </span>
      )}
      {displayLabel}
    </Badge>
  );
}

export function parseDockAllocationDetails(n: any) {
  const msg = n?.message || "";

  const gatePass =
    n?.gate_pass_number ||
    n?.gatePassNumber ||
    msg.match(/Gate Pass:\s*([^\n]+)/i)?.[1]?.trim() ||
    "N/A";
  const vehicle =
    n?.vehicle_number ||
    n?.vehicleNumber ||
    msg.match(/Vehicle:\s*([^\n]+)/i)?.[1]?.trim() ||
    "N/A";
  const driverName =
    n?.driver_name ||
    n?.driverName ||
    msg.match(/Driver:\s*([^\n]+)/i)?.[1]?.trim();
  const driverPhone =
    n?.driver_phone ||
    n?.driverPhone ||
    msg.match(/Driver Phone:\s*([^\n]+)/i)?.[1]?.trim() ||
    msg.match(/Phone:\s*([^\n]+)/i)?.[1]?.trim();
  const asnNumber =
    n?.asn_number ||
    n?.asnNumber ||
    msg.match(/ASN:\s*([^\n]+)/i)?.[1]?.trim();
  const poNumber =
    n?.po_number ||
    n?.poNumber ||
    msg.match(/PO:\s*([^\n]+)/i)?.[1]?.trim();

  const dockCode =
    n?.dock_code ||
    n?.dockCode ||
    msg.match(/Dock Code:\s*([^\n]+)/i)?.[1]?.trim() ||
    msg.match(/Proceed (?:directly )?to Dock\s*([^\n.]+)/i)?.[1]?.trim() ||
    "D-01";
  const dockName =
    n?.dock_name ||
    n?.dockName ||
    msg.match(/Dock Name:\s*([^\n]+)/i)?.[1]?.trim() ||
    `Inbound Dock ${dockCode}`;
  const dockLocation =
    n?.dock_location ||
    n?.dockLocation ||
    msg.match(/Location:\s*([^\n]+)/i)?.[1]?.trim() ||
    "Receiving Bay - A";
  const dockType =
    n?.dock_type ||
    n?.dockType ||
    msg.match(/Dock Type:\s*([^\n]+)/i)?.[1]?.trim() ||
    "Inbound";
  const warehouseName =
    n?.warehouse_name ||
    n?.warehouseName ||
    msg.match(/Warehouse:\s*([^\n]+)/i)?.[1]?.trim() ||
    "Main Warehouse";

  const rawTime =
    n?.allocation_time ||
    n?.allocationTime ||
    msg.match(/Allocated At:\s*([^\n]+)/i)?.[1]?.trim() ||
    n?.created_at ||
    n?.createdAt;
  let allocatedAt = "N/A";
  if (rawTime) {
    const d = new Date(rawTime);
    if (!isNaN(d.getTime())) {
      allocatedAt = d
        .toLocaleString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        })
        .replace(",", "");
    } else {
      allocatedAt = String(rawTime);
    }
  }

  return {
    gatePass,
    vehicle,
    driverName: driverName && driverName !== "N/A" ? driverName : null,
    driverPhone: driverPhone && driverPhone !== "N/A" ? driverPhone : null,
    asnNumber: asnNumber && asnNumber !== "N/A" ? asnNumber : null,
    poNumber: poNumber && poNumber !== "N/A" ? poNumber : null,
    dockCode,
    dockName,
    dockLocation,
    dockType,
    warehouseName,
    allocatedAt,
  };
}

export function DockAllocationNotificationCard({ notification }: { notification: any }) {
  const details = parseDockAllocationDetails(notification);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-teal-500/30 bg-teal-500/5 p-5 shadow-sm space-y-4 font-sans text-foreground">
      <div className="absolute left-0 top-0 h-full w-1 bg-teal-600 dark:bg-teal-400" />
      
      {/* Header */}
      <div className="flex items-center justify-between border-b border-teal-500/20 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="grid size-9 place-items-center rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400">
            <Warehouse className="size-5" />
          </div>
          <div>
            <h3 className="font-black text-base tracking-tight text-foreground uppercase">
              DOCK ALLOCATION CONFIRMED
            </h3>
            <p className="text-xs text-muted-foreground">Vehicle assigned & dock allocated</p>
          </div>
        </div>
        <Badge variant="outline" className="bg-teal-500/10 text-teal-700 dark:text-teal-300 border-teal-500/30 font-extrabold text-[11px] px-2.5 py-0.5 rounded-full">
          Dock Allocated
        </Badge>
      </div>

      {/* Details Grid */}
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Vehicle Details */}
        <div className="space-y-2 rounded-xl bg-card/80 p-3.5 border border-border/50 text-xs shadow-2xs">
          <span className="text-[10px] font-black uppercase text-muted-foreground tracking-wider block border-b border-border/40 pb-1">
            Vehicle Details
          </span>
          <div className="space-y-1.5 pt-1 font-medium">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Gate Pass:</span>
              <span className="font-mono font-bold text-foreground">{details.gatePass}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Vehicle:</span>
              <span className="font-mono font-bold text-primary">{details.vehicle}</span>
            </div>
            {details.driverName && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Driver:</span>
                <span className="font-semibold text-foreground">{details.driverName}</span>
              </div>
            )}
            {details.driverPhone && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Driver Phone:</span>
                <span className="font-mono text-foreground">{details.driverPhone}</span>
              </div>
            )}
            {details.asnNumber && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">ASN:</span>
                <span className="font-mono font-semibold text-foreground">{details.asnNumber}</span>
              </div>
            )}
            {details.poNumber && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">PO:</span>
                <span className="font-mono font-semibold text-foreground">{details.poNumber}</span>
              </div>
            )}
          </div>
        </div>

        {/* Allocated Dock Details */}
        <div className="space-y-2 rounded-xl bg-card/80 p-3.5 border border-border/50 text-xs shadow-2xs">
          <span className="text-[10px] font-black uppercase text-muted-foreground tracking-wider block border-b border-border/40 pb-1">
            Allocated Dock Details
          </span>
          <div className="space-y-1.5 pt-1 font-medium">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Dock Code:</span>
              <span className="font-mono font-bold text-teal-600 dark:text-teal-400">{details.dockCode}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Dock Name:</span>
              <span className="font-semibold text-foreground">{details.dockName}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Location:</span>
              <span className="text-foreground">{details.dockLocation}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Dock Type:</span>
              <span className="text-foreground">{details.dockType}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Warehouse:</span>
              <span className="text-foreground">{details.warehouseName}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Allocated At:</span>
              <span className="text-foreground">{details.allocatedAt}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Instruction Banner */}
      <div className="rounded-xl border border-teal-500/20 bg-teal-500/10 p-3 text-xs flex items-center justify-between">
        <div>
          <span className="text-[10px] font-black uppercase tracking-wider block text-teal-700 dark:text-teal-300">
            Instruction
          </span>
          <p className="font-extrabold text-teal-900 dark:text-teal-100 mt-0.5">
            Proceed directly to Dock {details.dockCode}.
          </p>
        </div>
      </div>
    </div>
  );
}
