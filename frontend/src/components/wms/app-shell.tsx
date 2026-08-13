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
  PanelLeftClose,
  PanelLeft,
  LogOut,
  Building2,
  FileText,
  ClipboardList,
  FileQuestion,
  FileBadge,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api-client";
import { toast } from "sonner";

const warehouseNav = [
  { label: "Dashboard", to: "/dashboard", icon: LayoutDashboard },
  { label: "Gate Entry", to: "/gate-entry", icon: DoorOpen },
  { label: "Arrival Management", to: "/notifications", icon: Truck, badge: "2" },
  { label: "Vehicle Queue", to: "/vehicle-queue", icon: ListOrdered },
  { label: "Dock Assignment", to: "/dock-assignment", icon: Warehouse },
  { label: "Receiving", to: "/receiving", icon: PackageCheck },
  { label: "GRN", to: "/grn", icon: FileCheck2 },
  { label: "Inventory", to: "/inventory", icon: Boxes },
  { label: "Reports", to: "/reports", icon: BarChart3 },
  { label: "Master Data", to: "/master-data", icon: Database },
  { label: "Settings", to: "/settings", icon: Settings },
];

const procurementNav = [
  { label: "Dashboard", to: "/procurement-dashboard", icon: LayoutDashboard },
  { label: "Suppliers", to: "/master-data", icon: Building2 },
  { label: "RFQs", to: "/procurement/rfqs", icon: FileQuestion },
  { label: "Quotations", to: "/procurement/quotations", icon: FileBadge },
  { label: "Purchase Orders", to: "/procurement/purchase-orders", icon: FileText },
  { label: "ASNs", to: "/procurement/asns", icon: Truck },
];

const supplierNav = [
  { label: "Dashboard", to: "/supplier-dashboard", icon: LayoutDashboard },
  { label: "Quotation Portal", to: "/submit-quotation", icon: FileBadge },
  { label: "Prepare Shipment", to: "/gate-entry", icon: Truck },
];

const financeNav = [
  { label: "Dashboard", to: "/finance-dashboard", icon: LayoutDashboard },
  { label: "Reports", to: "/reports", icon: BarChart3 },
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
  const [user, setUser] = useState<{ username?: string; roles?: string[] } | null>(null);

  useEffect(() => {
    setMounted(true);
    document.documentElement.classList.toggle("dark", dark);

    // Load user only on client side to prevent hydration mismatch
    try {
      const savedUser = localStorage.getItem("user_info");
      if (savedUser) setUser(JSON.parse(savedUser));
    } catch (e) {
      console.error("Failed to parse user info", e);
    }
  }, [dark]);

  // The current route is available during server rendering, so procurement/supplier/finance
  // pages can select their sidebar immediately rather than waiting for the
  // client-side localStorage role lookup.
  const isProcurementRoute = path === "/procurement-dashboard" || path.startsWith("/procurement/");
  const isSupplierRoute = path === "/supplier-dashboard" || path === "/submit-quotation";
  const isFinanceRoute = path === "/finance-dashboard" || path.startsWith("/finance/");

  const nav = isSupplierRoute || (mounted && user?.roles?.includes("SUPPLIER"))
    ? supplierNav
    : (isFinanceRoute || (mounted && user?.roles?.includes("FINANCE"))
        ? financeNav
        : (isProcurementRoute || (mounted && user?.roles?.includes("PROCUREMENT"))
            ? procurementNav
            : warehouseNav));

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
        <div className="flex h-16 items-center gap-3 px-4">
          <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-glow">
            <Warehouse className="size-5" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold tracking-tight">NexusWMS</p>
              <p className="truncate text-[11px] text-muted-foreground">Pune DC · Plant 1200</p>
            </div>
          )}
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-3">
          {nav.map((item) => {
            const active = path === item.to || (item.to !== "/dashboard" && path.startsWith(item.to));
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

        <div className="border-t border-sidebar-border p-3 space-y-1">
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent"
          >
            {collapsed ? <PanelLeft className="size-[18px]" /> : <PanelLeftClose className="size-[18px]" />}
            {!collapsed && <span>Collapse</span>}
          </button>
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-destructive transition-colors hover:bg-danger-soft"
          >
            <LogOut className="size-[18px]" />
            {!collapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 glass-strong">
          <div className="flex h-16 items-center gap-3 px-4 lg:px-7">
            <Link to={nav[0].to} className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground md:hidden">
              <Warehouse className="size-4" />
            </Link>
            <label className="relative hidden max-w-md flex-1 items-center sm:flex">
              <Search className="pointer-events-none absolute left-3 size-4 text-muted-foreground" />
              <input
                placeholder="Search truck no, PO, vendor, gate entry…"
                className="h-10 w-full rounded-xl border border-border bg-muted/60 pl-9 pr-16 text-sm outline-none transition-shadow placeholder:text-muted-foreground focus:bg-card focus:ring-2 focus:ring-ring/40"
              />
              <kbd className="absolute right-3 hidden rounded-md border border-border bg-card px-1.5 py-0.5 text-[10px] text-muted-foreground lg:block">
                ⌘K
              </kbd>
            </label>

            <div className="ml-auto flex items-center gap-1.5">
              <button
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
                <span className="absolute right-2 top-2 size-2 rounded-full bg-destructive animate-pulse-ring" />
              </Link>
              <div className="group relative ml-1 flex items-center gap-2.5 rounded-xl border border-border bg-card py-1.5 pl-1.5 pr-3 transition-colors hover:bg-accent/50">
                <span className="grid size-8 place-items-center rounded-lg bg-primary text-xs font-semibold text-primary-foreground">
                  {user?.username?.substring(0, 2).toUpperCase() || "RS"}
                </span>
                <div className="hidden leading-tight lg:block">
                  <p className="text-xs font-semibold">{user?.username || "Rohit Sharma"}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {user?.roles?.includes("PROCUREMENT") ? "Procurement Manager" : "Warehouse Manager"}
                  </p>
                </div>
                <button
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

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    Waiting: "bg-warning-soft text-warning-foreground border-warning/30",
    Active: "bg-success-soft text-success border-success/30",
    Blocked: "bg-danger-soft text-destructive border-destructive/25",
    Approved: "bg-primary-soft text-primary border-primary/25",
    "Dock Assigned": "bg-teal-soft text-teal border-teal/30",
    Receiving: "bg-primary-soft text-primary border-primary/25",
    Completed: "bg-success-soft text-success border-success/30",
    Rejected: "bg-danger-soft text-destructive border-destructive/25",
    Hold: "bg-muted text-muted-foreground border-border",
    Available: "bg-success-soft text-success border-success/30",
    Occupied: "bg-danger-soft text-destructive border-destructive/25",
    Reserved: "bg-warning-soft text-warning-foreground border-warning/30",
    Cleaning: "bg-muted text-muted-foreground border-border",
  };
  return (
    <Badge variant="outline" className={cn("rounded-full border px-2.5 py-0.5 text-[11px] font-semibold", map[status] ?? map["Hold"])}>
      {status}
    </Badge>
  );
}
