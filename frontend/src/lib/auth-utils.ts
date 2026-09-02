import { redirect } from "@tanstack/react-router";

export interface UserInfo {
  token: string;
  username: string;
  roles: string[];
  supplierId?: string;
}

const AUTH_TOKEN_KEY = "auth_token";
const USER_INFO_KEY = "user_info";

function getActiveStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  if (localStorage.getItem(AUTH_TOKEN_KEY)) return localStorage;
  if (sessionStorage.getItem(AUTH_TOKEN_KEY)) return sessionStorage;
  return null;
}

export function getAuthToken(): string | null {
  return getActiveStorage()?.getItem(AUTH_TOKEN_KEY) ?? null;
}

export function storeAuthSession(user: UserInfo, rememberMe: boolean): void {
  if (typeof window === "undefined") return;
  clearAuthSession();
  const storage = rememberMe ? localStorage : sessionStorage;
  storage.setItem(AUTH_TOKEN_KEY, user.token);
  storage.setItem(USER_INFO_KEY, JSON.stringify(user));
}

export function clearAuthSession(): void {
  if (typeof window === "undefined") return;
  for (const storage of [localStorage, sessionStorage]) {
    storage.removeItem(AUTH_TOKEN_KEY);
    storage.removeItem(USER_INFO_KEY);
  }
}

export function getUserInfo(): UserInfo | null {
  const info = getActiveStorage()?.getItem(USER_INFO_KEY);
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
  const token = getAuthToken();
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
    // If they are authenticated but don't have the role, send them to their primary dashboard
    const user = getUserInfo();
    const primaryRole = user?.roles[0];

    throw redirect({ to: getDefaultRouteForUser(user) as any });
  }
}
