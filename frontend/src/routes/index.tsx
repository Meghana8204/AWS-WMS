import { createFileRoute, redirect } from "@tanstack/react-router";
import { getDefaultRouteForUser, isAuthenticated } from "@/lib/auth-utils";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({
      to: (isAuthenticated() ? getDefaultRouteForUser() : "/login") as any,
      replace: true,
    });
  },
});
