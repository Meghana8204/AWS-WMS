import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { isAuthenticated, getUserInfo } from "@/lib/auth-utils";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    if (typeof window !== "undefined" && isAuthenticated()) {
      const user = getUserInfo();
      let target = "/warehouse-dashboard";
      if (user?.roles?.includes("FINANCE")) target = "/finance-dashboard";
      else if (user?.roles?.includes("PROCUREMENT")) target = "/procurement-dashboard";
      else if (user?.roles?.includes("GATE_SECURITY")) target = "/gate-entry";
      else if (user?.roles?.includes("SUPPLIER")) target = "/submit-quotation";

      throw redirect({ to: target as any });
    }

    throw redirect({
      to: "/login",
      replace: true,
    });
  },
  component: IndexComponent,
});

function IndexComponent() {
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated()) {
      const user = getUserInfo();
      let target = "/warehouse-dashboard";
      if (user?.roles?.includes("FINANCE")) target = "/finance-dashboard";
      else if (user?.roles?.includes("PROCUREMENT")) target = "/procurement-dashboard";
      else if (user?.roles?.includes("GATE_SECURITY")) target = "/gate-entry";
      else if (user?.roles?.includes("SUPPLIER")) target = "/submit-quotation";

      navigate({ to: target as any, replace: true });
    } else {
      navigate({ to: "/login", replace: true });
    }
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground text-sm">
      Loading NexusWMS...
    </div>
  );
}
