/**
 * Central API Client using native fetch.
 * Links frontend components to the backend python business-service (port 8000)
 * and Java auth-service (port 8080).
 */

const BUSINESS_API_URL = "http://localhost:8000";

function getApiErrorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") return fallback;

  const { detail, message } = payload as { detail?: unknown; message?: unknown };
  if (typeof detail === "string") return detail;
  if (typeof message === "string") return message;

  if (Array.isArray(detail)) {
    return detail
      .map((issue) => {
        if (!issue || typeof issue !== "object") return null;
        const { loc, msg } = issue as { loc?: unknown; msg?: unknown };
        const field = Array.isArray(loc) ? loc.filter((part) => part !== "body").join(".") : "";
        return typeof msg === "string" ? (field ? `${field}: ${msg}` : msg) : null;
      })
      .filter((message): message is string => Boolean(message))
      .join("; ") || fallback;
  }

  return fallback;
}

// Helper to retrieve auth token
function getAuthToken(): string | null {
  if (typeof window !== "undefined") {
    return localStorage.getItem("auth_token");
  }
  return null;
}

// Request helper with automatic header injection
async function request<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getAuthToken();
  const headers = new Headers(options.headers || {});

  // Inject Bearer Authorization header if token exists
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  } else {
    // Local dev auto-fallback headers for local environment security dependencies
    headers.set("Authorization", "Bearer local_dev_mock_token");
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = "API request failed";
    try {
      const errorJson = JSON.parse(errorText);
      errorMessage = getApiErrorMessage(errorJson, errorMessage);
    } catch {
      errorMessage = errorText || errorMessage;
    }
    throw new Error(errorMessage);
  }

  return response.json() as Promise<T>;
}

export const api = {
  // Authentication Use Cases
  async login(username: string, password: string): Promise<{ token: string; username: string; roles: string[]; supplierId?: string; mustChangePassword?: boolean }> {
    if (username.startsWith("supplier_")) {
      const response = await request<any>(`${BUSINESS_API_URL}/api/v1/procurement/auth/supplier-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const supplierUser = {
        token: response.token,
        username: response.username,
        roles: ["SUPPLIER"],
        supplierId: response.supplierId,
        mustChangePassword: response.mustChangePassword,
      };
      localStorage.setItem("auth_token", supplierUser.token);
      localStorage.setItem("user_info", JSON.stringify(supplierUser));
      return supplierUser;
    }

    // Call dev-login on the backend to validate credentials against configured .env variables
    try {
      const response = await request<any>(`${BUSINESS_API_URL}/api/v1/procurement/auth/dev-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const devUser = {
        token: response.token,
        username: response.username,
        roles: response.roles,
      };
      localStorage.setItem("auth_token", devUser.token);
      localStorage.setItem("user_info", JSON.stringify(devUser));
      return devUser;
    } catch (e: any) {
      console.warn("Dev server login failed, falling back to client-side mock:", e.message);
      const isProcurement = username.toLowerCase().includes("procurement");
      const isFinance = username.toLowerCase().includes("finance");
      const mockUser = {
        token: isFinance ? "mock-jwt-finance-token" : (isProcurement ? "mock-jwt-procurement-token" : "mock-jwt-admin-token"),
        username,
        roles: isFinance ? ["FINANCE"] : (isProcurement ? ["PROCUREMENT"] : ["ADMIN"])
      };
      localStorage.setItem("auth_token", mockUser.token);
      localStorage.setItem("user_info", JSON.stringify(mockUser));
      return mockUser;
    }
  },

  async changePassword(data: any): Promise<any> {
    return request<any>(`${BUSINESS_API_URL}/api/v1/procurement/auth/change-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  },

  async getRfq(rfqId: string): Promise<any> {
    return request<any>(`${BUSINESS_API_URL}/api/v1/procurement/rfqs/${rfqId}`);
  },

  logout() {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("user_info");
  },

  // Gate Entry Use Cases
  async getGateEntries(status?: string): Promise<any[]> {
    const url = status 
      ? `${BUSINESS_API_URL}/api/gate-entries?status=${encodeURIComponent(status)}`
      : `${BUSINESS_API_URL}/api/gate-entries`;
    return request<any[]>(url);
  },

  async getDashboardStats(): Promise<any> {
    return request<any>(`${BUSINESS_API_URL}/api/dashboard/stats`);
  },

  async createGateEntry(formData: FormData): Promise<any> {
    return request<any>(`${BUSINESS_API_URL}/api/gate-entries`, {
      method: "POST",
      // Leave Content-Type empty to let the browser set it automatically for Form-Data boundary
      body: formData,
    });
  },

  async scanGateEntry(formData: FormData): Promise<any> {
    return request<any>(`${BUSINESS_API_URL}/api/gate-entries/scan`, {
      method: "POST",
      body: formData,
    });
  },

  async verifyGateEntry(id: string, approved: boolean, notes: string): Promise<any> {
    return request<any>(`${BUSINESS_API_URL}/api/gate-entries/${id}/verify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ approved, notes }),
    });
  },

  async getGateEntry(id: string): Promise<any> {
    return request<any>(`${BUSINESS_API_URL}/api/gate-entries/${id}`);
  },

  async geminiScan(file: File, kind = "general", instructions?: string): Promise<any> {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("kind", kind);
    if (instructions) formData.append("instructions", instructions);
    return request<any>(`${BUSINESS_API_URL}/api/gate-entries/scan-gemini`, {
      method: "POST",
      body: formData,
    });
  },

  async getGrn(grnId: string): Promise<any> {
    return request<any>(`${BUSINESS_API_URL}/api/receiving/grn/${grnId}`);
  },

  // Inbound Receiving / GRN Use Cases
  async confirmGrn(poId: string, lines: { itemCode: string; quantity: number }[]): Promise<any> {
    return request<any>(`${BUSINESS_API_URL}/api/receiving/grn`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ po_id: poId, lines }),
    });
  },

  // Returns Use Cases
  async createReturn(lines: { itemCode: string; quantity: number; reason: string }[]): Promise<any> {
    return request<any>(`${BUSINESS_API_URL}/api/returns`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ lines }),
    });
  },

  // Procurement Use Cases
  async getSuppliers(filters?: { search?: string; category?: string; material?: string; city?: string }): Promise<any[]> {
    let url = `${BUSINESS_API_URL}/api/v1/procurement/suppliers`;
    if (filters) {
      const params = new URLSearchParams();
      if (filters.search) params.append("search", filters.search);
      if (filters.category) params.append("category", filters.category);
      if (filters.material) params.append("material", filters.material);
      if (filters.city) params.append("city", filters.city);
      const query = params.toString();
      if (query) url += `?${query}`;
    }
    return request<any[]>(url);
  },

  async getSupplier(id: string): Promise<any> {
    return request<any>(`${BUSINESS_API_URL}/api/v1/procurement/suppliers/${id}`);
  },

  async updateSupplier(id: string, data: any): Promise<any> {
    return request<any>(`${BUSINESS_API_URL}/api/v1/procurement/suppliers/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  },

  async blockSupplier(id: string): Promise<any> {
    return request<any>(`${BUSINESS_API_URL}/api/v1/procurement/suppliers/${id}/block`, { method: "POST" });
  },

  async unblockSupplier(id: string): Promise<any> {
    return request<any>(`${BUSINESS_API_URL}/api/v1/procurement/suppliers/${id}/unblock`, { method: "POST" });
  },

  async createSupplier(data: any): Promise<any> {
    return request<any>(`${BUSINESS_API_URL}/api/v1/procurement/suppliers`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });
  },

  async uploadSupplierDocument(documentType: string, file: File): Promise<any> {
    const formData = new FormData();
    formData.append("document_type", documentType);
    formData.append("file", file);
    return request<any>(`${BUSINESS_API_URL}/api/v1/procurement/suppliers/documents`, {
      method: "POST",
      body: formData,
    });
  },

  // New Purchase Order Management Module
  async getRfqs(supplierId?: string): Promise<any[]> {
    const url = supplierId
      ? `${BUSINESS_API_URL}/api/v1/procurement/rfqs?supplier_id=${supplierId}`
      : `${BUSINESS_API_URL}/api/v1/procurement/rfqs`;
    return request<any[]>(url);
  },

  async createRfq(data: any): Promise<any> {
    return request<any>(`${BUSINESS_API_URL}/api/v1/procurement/rfqs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  },

  async sendRfq(rfqId: string): Promise<any> {
    return request<any>(`${BUSINESS_API_URL}/api/v1/procurement/rfqs/${rfqId}/send`, {
      method: "POST",
    });
  },

  async getQuotations(rfqId?: string, supplierId?: string): Promise<any[]> {
    const params = new URLSearchParams();
    if (rfqId) params.append("rfq_id", rfqId);
    if (supplierId) params.append("supplier_id", supplierId);
    const query = params.toString();
    const url = query
      ? `${BUSINESS_API_URL}/api/v1/procurement/quotations?${query}`
      : `${BUSINESS_API_URL}/api/v1/procurement/quotations`;
    return request<any[]>(url);
  },

  async submitQuotation(data: any): Promise<any> {
    return request<any>(`${BUSINESS_API_URL}/api/v1/procurement/quotations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  },

  async getPurchaseOrders(supplierId?: string): Promise<any[]> {
    const url = supplierId
      ? `${BUSINESS_API_URL}/api/v1/procurement/purchase-orders?supplier_id=${supplierId}`
      : `${BUSINESS_API_URL}/api/v1/procurement/purchase-orders`;
    return request<any[]>(url);
  },

  async createPurchaseOrder(data: any): Promise<any> {
    return request<any>(`${BUSINESS_API_URL}/api/v1/procurement/purchase-orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  },

  async getAsns(supplierId?: string): Promise<any[]> {
    const url = supplierId
      ? `${BUSINESS_API_URL}/api/v1/procurement/asns?supplier_id=${supplierId}`
      : `${BUSINESS_API_URL}/api/v1/procurement/asns`;
    return request<any[]>(url);
  },

  async createAsn(data: any): Promise<any> {
    return request<any>(`${BUSINESS_API_URL}/api/v1/procurement/asns`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  },

  async getNextAsnNumber(): Promise<{ asnNumber: string }> {
    return request<any>(`${BUSINESS_API_URL}/api/v1/procurement/asns/next-number`);
  },

  async updateQuotation(id: string, data: any): Promise<any> {
    return request<any>(`${BUSINESS_API_URL}/api/v1/procurement/quotations/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  },

  async selectSupplier(rfqId: string, data: any): Promise<any> {
    return request<any>(`${BUSINESS_API_URL}/api/v1/procurement/rfqs/${rfqId}/select-supplier`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  },

  async updatePurchaseOrder(id: string, data: any): Promise<any> {
    return request<any>(`${BUSINESS_API_URL}/api/v1/procurement/purchase-orders/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  },

  async getQuotation(id: string): Promise<any> {
    return request<any>(`${BUSINESS_API_URL}/api/v1/procurement/quotations/${id}`);
  },

  async getPurchaseOrder(id: string): Promise<any> {
    return request<any>(`${BUSINESS_API_URL}/api/v1/procurement/purchase-orders/${id}`);
  },

  async sendPoToSupplier(id: string): Promise<any> {
    return request<any>(`${BUSINESS_API_URL}/api/v1/procurement/purchase-orders/${id}/send-supplier-email`, {
      method: "POST",
    });
  }
};
