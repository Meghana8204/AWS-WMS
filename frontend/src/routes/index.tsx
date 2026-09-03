import { createFileRoute, redirect } from "@tanstack/react-router";
import { getDefaultRouteForUser, isAuthenticated } from "@/lib/auth-utils";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
<<<<<<< HEAD
    if (typeof window === "undefined") {
      throw redirect({ to: "/login" });
    }

    if (isAuthenticated()) {
      const user = getUserInfo();
      let target = "/warehouse-dashboard";
      if (user?.roles?.includes("GRN") || user?.username?.toLowerCase() === "grn") target = "/grn";
      else if (user?.roles?.includes("FINANCE")) target = "/finance-dashboard";
      else if (user?.roles?.includes("PROCUREMENT")) target = "/procurement-dashboard";
      else if (user?.roles?.includes("GATE_SECURITY")) target = "/gate-dashboard";
      else if (user?.roles?.includes("SUPPLIER")) target = "/submit-quotation";

      throw redirect({ to: target as any });
    }

=======
>>>>>>> main
    throw redirect({
      to: (isAuthenticated() ? getDefaultRouteForUser() : "/login") as any,
      replace: true,
    });
  },
});
