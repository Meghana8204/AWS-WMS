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
    return JSON.parse(info);
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
  return !!localStorage.getItem("auth_token") && !!getUserInfo();
}
export function requireAuth() {
  if (typeof window === "undefined") return;
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
  if (typeof window === "undefined") return;
  requireAuth();
  if (!hasRole(roles)) {
    const user = getUserInfo();
    const primaryRole = user?.roles[0];
    let target = "/warehouse-dashboard";
    if (user?.roles.includes("FINANCE")) target = "/finance-dashboard";
    else if (user?.roles.includes("PROCUREMENT")) target = "/procurement-dashboard";
    else if (user?.roles.includes("GATE_SECURITY")) target = "/gate-entry";
    else if (user?.roles.includes("SUPPLIER")) target = "/submit-quotation";
    throw redirect({ to: target as any });
  }
}
