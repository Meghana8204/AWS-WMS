import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { getDefaultRouteForUser, isAuthenticated } from "@/lib/auth-utils";
import { useEffect } from "react";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    if (typeof window !== "undefined") {
      throw redirect({
        to: (isAuthenticated() ? getDefaultRouteForUser() : "/login") as any,
        replace: true,
      });
    }
  },
  component: IndexRedirect,
});

function IndexRedirect() {
  const navigate = useNavigate();

  useEffect(() => {
    const target = isAuthenticated() ? getDefaultRouteForUser() : "/login";
    navigate({ to: target as any, replace: true });
  }, [navigate]);

  return null;
}

