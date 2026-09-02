import { redirect } from "@tanstack/react-router";

export interface UserInfo {
  token: string;
  username: string;
  roles: string[];
  supplierId?: string;
}

export function getUserInfo(): UserInfo | null {
  if (typeof window === "undefined") return null;
  const info = localStorage.getItem("user_info");
  if (!info) return null;
  try {
    const user = JSON.parse(info) as Partial<UserInfo>;
    if (
      typeof user.token !== "string" ||
      typeof user.username !== "string" ||
      !Array.isArray(user.roles) ||
      !user.roles.every((role) => typeof role === "string")
    ) {
      return null;
    }

    return user as UserInfo;
  } catch {
    return null;
  }
}

export function hasRole(roles: string[] | string): boolean {
  const user = getUserInfo();
  if (!user) return false;
  const requiredRoles = Array.isArray(roles) ? roles : [roles];
  return requiredRoles.some((role) => user.roles.includes(role));
}

export function isAuthenticated(): boolean {
  if (typeof window === "undefined") return false;
  const token = localStorage.getItem("auth_token");
  const user = getUserInfo();
  return Boolean(token?.trim() && user && user.token === token);
}

/**
 * Returns an in-app location only. This prevents a login URL such as
 * `/login?redirect=https://example.com` from sending users off-site.
 */
export function getSafeRedirectPath(redirectPath: unknown): string | null {
  if (
    typeof redirectPath !== "string" ||
    !redirectPath.startsWith("/") ||
    redirectPath.startsWith("//")
  ) {
    return null;
  }

  return redirectPath;
}

export function getDefaultRouteForUser(user = getUserInfo()): string {
  if (user?.roles.includes("FINANCE")) return "/finance-dashboard";
  if (user?.roles.includes("PROCUREMENT")) return "/procurement-dashboard";
  if (user?.roles.includes("GATE_SECURITY")) return "/gate-entry";
  if (user?.roles.includes("SUPPLIER")) return "/submit-quotation";
  if (user?.roles.includes("ASSEMBLY_MANAGER")) return "/assembly-dashboard";
  return "/warehouse-dashboard";
}

export function requireAuth() {
  if (typeof window === "undefined") return; // Skip server-side redirect for localStorage auth
  if (!isAuthenticated()) {
    throw redirect({
      to: "/login",
      search: {
        redirect: window.location.pathname,
      },
    });
  }
}

export function requireRole(roles: string[] | string) {
  if (typeof window === "undefined") return; // Skip server-side redirect for localStorage auth
  requireAuth();
  if (!hasRole(roles)) {
    // If they are authenticated but don't have the role, send them to their primary dashboard
    const user = getUserInfo();
    const primaryRole = user?.roles[0];

    throw redirect({ to: getDefaultRouteForUser(user) as any });
  }
}
