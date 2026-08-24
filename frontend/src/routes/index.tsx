import { createFileRoute, redirect } from "@tanstack/react-router";
import { isAuthenticated, getUserInfo } from "@/lib/auth-utils";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    // On server-side (SSR), default to /login so the initial HTML payload is non-empty
    if (typeof window === "undefined") {
      throw redirect({ to: "/login" });
    }

    if (isAuthenticated()) {
      const user = getUserInfo();
      let target = "/warehouse-dashboard";
      if (user?.roles.includes("FINANCE")) target = "/finance-dashboard";
      else if (user?.roles.includes("PROCUREMENT")) target = "/procurement-dashboard";
      else if (user?.roles.includes("GATE_SECURITY")) target = "/gate-entry";
      else if (user?.roles.includes("SUPPLIER")) target = "/submit-quotation";

      throw redirect({ to: target as any });
    }

    throw redirect({
      to: "/login",
      replace: true,
    });
  },
  component: IndexPage,
});

function IndexPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex items-center gap-2 text-muted-foreground">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <span className="text-sm font-medium">Loading NexusWMS...</span>
      </div>
    </div>
  );
}
