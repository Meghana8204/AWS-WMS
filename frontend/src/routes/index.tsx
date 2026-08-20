import { createFileRoute, redirect } from "@tanstack/react-router";
import { isAuthenticated, getUserInfo } from "@/lib/auth-utils";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    // Skip server-side redirects for localStorage-based auth
    if (typeof window === "undefined") return;

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
});
