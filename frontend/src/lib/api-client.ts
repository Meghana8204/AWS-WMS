/**
 * Central API Client using native fetch.
 * Links frontend components to the backend python business-service (port 8000)
 * and Java auth-service (port 8080).
 */

export const BUSINESS_API_URL =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_BUSINESS_API_URL) ||
  (typeof window !== "undefined"
    ? window.location.hostname.includes("loca.lt")
      ? "https://wms-mobile-backend-8000.loca.lt"
      : `http://${window.location.hostname}:8000`
    : "http://localhost:8000");
function getApiErrorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") return fallback;
  const { detail, message } = payload as {
    detail?: unknown;
    message?: unknown;
  };
  if (typeof detail === "string") return detail;
  if (typeof message === "string") return message;
  if (Array.isArray(detail)) {
    return (
      detail
        .map((issue) => {
          if (!issue || typeof issue !== "object") return null;
          const { loc, msg } = issue as {
            loc?: unknown;
            msg?: unknown;
          };
          const field = Array.isArray(loc) ? loc.filter((part) => part !== "body").join(".") : "";
          return typeof msg === "string" ? (field ? `${field}: ${msg}` : msg) : null;
        })
        .filter((message): message is string => Boolean(message))
        .join("; ") || fallback
    );
  }
  return fallback;
}
function getAuthToken(): string | null {
  if (typeof window !== "undefined") {
    return localStorage.getItem("auth_token");
  }
  return null;
}
async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  const headers = new Headers(options.headers || {});
  if (typeof options.body === "string" && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  } else {
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
  async login(
    username: string,
    password: string,
  ): Promise<{
    token: string;
    username: string;
    roles: string[];
    supplierId?: string;
    mustChangePassword?: boolean;
  }> {
    if (username.startsWith("supplier_")) {
      const response = await request<any>(
        `${BUSINESS_API_URL}/api/v1/procurement/auth/supplier-login`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password }),
        },
      );
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
      const isWarehouse = username.toLowerCase().includes("warehouse");
      const isGate = username.toLowerCase().includes("gate");
      const isGrn = username.toLowerCase().includes("grn") || username.toLowerCase().includes("receiving");
      const mockUser = {
        token: isFinance
          ? "mock-jwt-finance-token"
          : isProcurement
            ? "mock-jwt-procurement-token"
            : isWarehouse
              ? "mock-jwt-warehouse-token"
              : isGate
                ? "mock-jwt-gate-entry-token"
                : isGrn
                  ? "mock-jwt-grn-token"
                  : "mock-jwt-admin-token",
        username,
        roles: isFinance
          ? ["FINANCE"]
          : isProcurement
            ? ["PROCUREMENT"]
            : isWarehouse
              ? ["WAREHOUSE"]
              : isGate
                ? ["GATE_SECURITY"]
                : isGrn
                  ? ["GRN"]
                  : ["ADMIN"],
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
  async getGateEntries(status?: string): Promise<any[]> {
    const url = status
      ? `${BUSINESS_API_URL}/api/gate-entries?status=${encodeURIComponent(status)}`
      : `${BUSINESS_API_URL}/api/gate-entries`;
    return request<any[]>(url);
  },
  async getInboundArrivals(): Promise<any[]> {
    return request<any[]>(`${BUSINESS_API_URL}/api/gate-entries/inbound-arrivals`);
  },
  async getDocks(statusOrParams?: string | { dock_type?: string; status?: string }, type?: string): Promise<any[]> {
    const query = new URLSearchParams();
    if (typeof statusOrParams === "object" && statusOrParams !== null) {
      if (statusOrParams.dock_type && statusOrParams.dock_type !== "ALL") query.append("dock_type", statusOrParams.dock_type);
      if (statusOrParams.status && statusOrParams.status !== "ALL") query.append("status", statusOrParams.status);
    } else {
      if (statusOrParams && statusOrParams !== "ALL") query.append("status", statusOrParams);
      if (type && type !== "ALL") query.append("dock_type", type);
    }
    const qs = query.toString();
    return request<any[]>(`${BUSINESS_API_URL}/api/v1/warehouse/docks${qs ? `?${qs}` : ""}`);
  },
  async getDockOverviewMetrics(): Promise<any> {
    return request<any>(`${BUSINESS_API_URL}/api/v1/warehouse/docks/availability`);
  },
  async getPendingAllocations(): Promise<any[]> {
    return request<any[]>(`${BUSINESS_API_URL}/api/v1/warehouse/dock-allocation-requests/pending`);
  },
  async getDockAllocationRequests(statusFilter?: string): Promise<any[]> {
    const query = statusFilter && statusFilter !== "ALL" ? `?status_filter=${encodeURIComponent(statusFilter)}` : "";
    return request<any[]>(`${BUSINESS_API_URL}/api/v1/warehouse/dock-allocation-requests${query}`);
  },
  async getDockHistory(): Promise<any[]> {
    return request<any[]>(`${BUSINESS_API_URL}/api/v1/warehouse/dock-history`);
  },
  async allocateDock(allocationRequestId: string, dockId: string): Promise<any> {
    return request<any>(`${BUSINESS_API_URL}/api/v1/warehouse/dock-allocations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ allocation_request_id: allocationRequestId, dock_id: dockId }),
    });
  },
  async reassignDock(allocationRequestId: string, newDockId: string, reason?: string): Promise<any> {
    return request<any>(`${BUSINESS_API_URL}/api/v1/warehouse/dock-allocations/${allocationRequestId}/reassign`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ new_dock_id: newDockId, reason }),
    });
  },
  async markVehicleArrived(allocationRequestId: string): Promise<any> {
    return request<any>(`${BUSINESS_API_URL}/api/v1/warehouse/dock-allocations/${allocationRequestId}/arrive`, {
      method: "POST",
    });
  },
  async startReceiving(allocationRequestId: string): Promise<any> {
    return request<any>(`${BUSINESS_API_URL}/api/v1/warehouse/dock-allocations/${allocationRequestId}/start-receiving`, {
      method: "POST",
    });
  },
  async completeDockReceiving(allocationRequestId: string): Promise<any> {
    return request<any>(`${BUSINESS_API_URL}/api/v1/warehouse/dock-allocations/${encodeURIComponent(allocationRequestId)}/complete`, {
      method: "POST",
    });
  },
  async releaseDock(id: string): Promise<any> {
    return request<any>(`${BUSINESS_API_URL}/api/v1/warehouse/dock-allocations/${encodeURIComponent(id)}/release`, {
      method: "POST",
    });
  },
  async releaseDockAssignment(allocationRequestId: string): Promise<any> {
    return this.releaseDock(allocationRequestId);
  },
  async cancelDockAllocation(allocationRequestId: string, reason?: string): Promise<any> {
    return request<any>(`${BUSINESS_API_URL}/api/v1/warehouse/dock-allocations/${encodeURIComponent(allocationRequestId)}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
  },
  async createDock(payload: {
    dock_code?: string;
    dock_number?: string;
    dock_name?: string;
    dock_type: string;
    location?: string;
    description?: string;
    status?: string;
    is_active?: boolean;
    warehouse_id?: string;
    capacity?: number;
  }): Promise<any> {
    const code = (payload.dock_code || payload.dock_number || "D-01").trim().toUpperCase();
    const name = (payload.dock_name || code).trim();
    return request<any>(`${BUSINESS_API_URL}/api/v1/warehouse/docks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dock_code: code,
        dock_name: name,
        dock_type: payload.dock_type,
        location: payload.location || null,
        description: payload.description || null,
        status: payload.status || "AVAILABLE",
        is_active: payload.is_active !== undefined ? payload.is_active : true,
      }),
    });
  },
  async updateDock(
    dockIdOrNumber: string,
    payload: {
      dock_code?: string;
      dock_number?: string;
      dock_name?: string;
      dock_type?: string;
      location?: string;
      description?: string;
      status?: string;
      is_active?: boolean;
      warehouse_id?: string;
      capacity?: number;
    } | any,
  ): Promise<any> {
    return request<any>(
      `${BUSINESS_API_URL}/api/v1/warehouse/docks/${encodeURIComponent(dockIdOrNumber)}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
  },
  async updateDockStatus(dockId: string, status: string, reason?: string): Promise<any> {
    return request<any>(
      `${BUSINESS_API_URL}/api/v1/warehouse/docks/${encodeURIComponent(dockId)}/status`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, reason }),
      },
    );
  },
  async assignDock(gateEntryId: string, dockId: string): Promise<any> {
    return request<any>(`${BUSINESS_API_URL}/api/gate-entries/${gateEntryId}/assign-dock`, {
      method: "POST",
      body: JSON.stringify({ dock_id: dockId }),
    });
  },
  async startDockMovement(gateEntryId: string): Promise<any> {
    return request<any>(`${BUSINESS_API_URL}/api/gate-entries/${gateEntryId}/start-dock-movement`, {
      method: "POST",
    });
  },
  async confirmDockCheckIn(gateEntryId: string): Promise<any> {
    return request<any>(`${BUSINESS_API_URL}/api/gate-entries/${gateEntryId}/dock-check-in`, {
      method: "POST",
    });
  },
  async startUnloading(gateEntryId: string): Promise<any> {
    return request<any>(`${BUSINESS_API_URL}/api/gate-entries/${gateEntryId}/start-unloading`, {
      method: "POST",
    });
  },
  async recordReceivingQuantities(
    gateEntryId: string,
    items: Array<{
      item_code: string;
      received_quantity: number;
    }>,
  ): Promise<any> {
    return request<any>(
      `${BUSINESS_API_URL}/api/gate-entries/${gateEntryId}/receiving-quantities`,
      {
        method: "PUT",
        body: JSON.stringify({ items }),
      },
    );
  },
  async getQuantityVerificationPolicy(): Promise<any> {
    return request<any>(`${BUSINESS_API_URL}/api/gate-entries/quantity-verification-policy`);
  },
  async updateQuantityVerificationPolicy(payload: {
    shortage_tolerance: number;
    excess_tolerance: number;
  }): Promise<any> {
    return request<any>(`${BUSINESS_API_URL}/api/gate-entries/quantity-verification-policy`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  },
  async recordMaterialConditions(
    gateEntryId: string,
    items: Array<{
      item_code: string;
      good_quantity: number;
      damaged_quantity: number;
      rejected_quantity: number;
      inspection_required: boolean;
      notes?: string;
    }>,
  ): Promise<any> {
    return request<any>(`${BUSINESS_API_URL}/api/gate-entries/${gateEntryId}/material-conditions`, {
      method: "PUT",
      body: JSON.stringify({ items }),
    });
  },
  async generateHandlingUnits(gateEntryId: string): Promise<any> {
    return request<any>(`${BUSINESS_API_URL}/api/gate-entries/${gateEntryId}/handling-units`, {
      method: "POST",
    });
  },
  async completeQualityInspection(
    gateEntryId: string,
    decision: "PASS" | "FAIL",
    notes?: string,
  ): Promise<any> {
    return request<any>(`${BUSINESS_API_URL}/api/gate-entries/${gateEntryId}/quality-inspection`, {
      method: "POST",
      body: JSON.stringify({ decision, notes }),
    });
  },
  async completeReceiving(gateEntryId: string): Promise<any> {
    return request<any>(`${BUSINESS_API_URL}/api/gate-entries/${gateEntryId}/complete-receiving`, {
      method: "POST",
    });
  },
  async getVehicleExitQueue(): Promise<any[]> {
    return request<any[]>(`${BUSINESS_API_URL}/api/gate-entries/exit-queue`);
  },
  async approveVehicleExit(
    gateEntryId: string,
    payload: {
      exit_document_reference: string;
      asn_verified: boolean;
      po_verified: boolean;
      grn_verified: boolean;
      receiving_verified: boolean;
      vehicle_verified: boolean;
      driver_verified: boolean;
    },
  ): Promise<any> {
    return request<any>(`${BUSINESS_API_URL}/api/gate-entries/${gateEntryId}/approve-exit`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  async getGateExitQueue(): Promise<any[]> {
    return request<any[]>(`${BUSINESS_API_URL}/api/gate-entries/gate-exit-queue`);
  },
  async completeGateExit(gateEntryId: string): Promise<any> {
    return request<any>(`${BUSINESS_API_URL}/api/gate-entries/${gateEntryId}/complete-gate-exit`, {
      method: "POST",
    });
  },
  async getGrnDrafts(status?: string, search?: string): Promise<any[]> {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (search) params.set("search", search);
    const query = params.toString();
    const url = `${BUSINESS_API_URL}/api/gate-entries/grn-drafts${query ? `?${query}` : ""}`;
    const res = await request<any>(url);
    return Array.isArray(res) ? res : res?.items || [];
  },
  async postGrn(grnId: string, verificationNotes?: string): Promise<any> {
    return request<any>(`${BUSINESS_API_URL}/api/receiving/grn/${grnId}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ verification_notes: verificationNotes }),
    });
  },
  async getInventoryTransactions(): Promise<any[]> {
    return request<any[]>(`${BUSINESS_API_URL}/api/gate-entries/inventory-transactions`);
  },
  async getPutawayTasks(): Promise<any[]> {
    return request<any[]>(`${BUSINESS_API_URL}/api/storage/putaway-tasks`);
  },
  async getStorageLocations(warehouseId?: string): Promise<any[]> {
    const query = warehouseId ? `?warehouse_id=${encodeURIComponent(warehouseId)}` : "";
    return request<any[]>(`${BUSINESS_API_URL}/api/storage/putaway-tasks/locations${query}`);
  },
  async getInventoryLocationBalances(): Promise<any[]> {
    return request<any[]>(`${BUSINESS_API_URL}/api/storage/putaway-tasks/inventory-locations`);
  },
  async getHandlingUnit(scanValue: string): Promise<any> {
    return request<any>(
      `${BUSINESS_API_URL}/api/storage/putaway-tasks/handling-units/${encodeURIComponent(scanValue)}`,
    );
  },
  async assignPutawayLocation(taskId: string, locationId: string): Promise<any> {
    return request<any>(`${BUSINESS_API_URL}/api/storage/putaway-tasks/${taskId}/location`, {
      method: "PUT",
      body: JSON.stringify({ location_id: locationId }),
    });
  },
  async startPutaway(taskId: string): Promise<any> {
    return request<any>(`${BUSINESS_API_URL}/api/storage/putaway-tasks/${taskId}/start`, {
      method: "POST",
    });
  },
  async completePutaway(
    taskId: string,
    payload: {
      material_scan: string;
      location_scan: string;
      quantity: number;
    },
  ): Promise<any> {
    return request<any>(`${BUSINESS_API_URL}/api/storage/putaway-tasks/${taskId}/complete`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  async getDashboardStats(): Promise<any> {
    return request<any>(`${BUSINESS_API_URL}/api/dashboard/stats`);
  },
  async createGateEntry(formData: FormData): Promise<any> {
    return request<any>(`${BUSINESS_API_URL}/api/gate-entries`, {
      method: "POST",
      body: formData,
    });
  },
  async resetGateEntries(): Promise<any> {
    return request<any>(`${BUSINESS_API_URL}/api/gate-entries/reset-dev-entries`, {
      method: "POST",
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
      body: JSON.stringify({
        action: approved ? "APPROVE" : "UNSCHEDULED_ARRIVAL",
        remarks: notes || (approved ? "Gate entry approved" : "Moved to unscheduled arrivals"),
      }),
    });
  },
  async getGateEntry(id: string): Promise<any> {
    return request<any>(`${BUSINESS_API_URL}/api/gate-entries/${id}`);
  },
  async downloadGatePass(id: string, gateEntryNumber?: string): Promise<void> {
    const token = getAuthToken();
    const headers = new Headers();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    } else {
      headers.set("Authorization", "Bearer local_dev_mock_token");
    }
    const response = await fetch(`${BUSINESS_API_URL}/api/gate-entries/${id}/pass`, {
      headers,
    });
    if (!response.ok) {
      throw new Error("Failed to download gate pass");
    }
    let filename = gateEntryNumber ? `Pass-${gateEntryNumber}.pdf` : `GatePass-${id}.pdf`;
    const disposition = response.headers.get("Content-Disposition");
    if (disposition && disposition.includes("filename=")) {
      const filenameMatch = disposition.match(/filename="?([^"]+)"?/);
      if (filenameMatch && filenameMatch[1]) {
        filename = filenameMatch[1];
      }
    }
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },
  async scanOcr(file: File, kind = "general"): Promise<any> {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("kind", kind);
    return request<any>(`${BUSINESS_API_URL}/api/gate-entries/scan-ocr`, {
      method: "POST",
      body: formData,
    });
  },
  async previewPoOcr(base64Image: string, _poNumberOverride?: string): Promise<any> {
    try {
      const byteCharacters = atob(base64Image);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: "image/jpeg" });
      const file = new File([blob], "po-scan.jpg", { type: "image/jpeg" });
      return this.scanOcr(file, "po");
    } catch {
      // Fallback if atob fails
      return request<any>(`${BUSINESS_API_URL}/api/gate-entries/scan-ocr`, {
        method: "POST",
        body: new FormData(),
      });
    }
  },
  async getGrn(grnId: string): Promise<any> {
    return request<any>(`${BUSINESS_API_URL}/api/receiving/grn/${grnId}`);
  },
  async getGrnContext(input?: string | { poNumber?: string; poId?: string; gateEntryId?: string }, poId?: string, gateEntryId?: string): Promise<any> {
    const params = new URLSearchParams();
    if (typeof input === "object" && input !== null) {
      if (input.poNumber) params.set("po_number", input.poNumber);
      if (input.poId) params.set("po_id", input.poId);
      if (input.gateEntryId) params.set("gate_entry_id", input.gateEntryId);
    } else if (typeof input === "string") {
      params.set("po_number", input);
      if (poId) params.set("po_id", poId);
      if (gateEntryId) params.set("gate_entry_id", gateEntryId);
    }
    return request<any>(`${BUSINESS_API_URL}/api/receiving/grn/context?${params.toString()}`);
  },
  async confirmGrn(
    poId: string,
    lines: {
      itemCode: string;
      quantity: number;
    }[],
  ): Promise<any> {
    return request<any>(`${BUSINESS_API_URL}/api/receiving/grn`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ po_id: poId, lines }),
    });
  },
  async createReturn(
    lines: {
      itemCode: string;
      quantity: number;
      reason: string;
    }[],
  ): Promise<any> {
    return request<any>(`${BUSINESS_API_URL}/api/returns`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ lines }),
    });
  },
  async checkSupplierExistence(params: {
    company_name?: string;
    gstin?: string;
    email?: string;
    phone?: string;
    account_number?: string;
    swift?: string;
  }): Promise<any> {
    const searchParams = new URLSearchParams();
    if (params.company_name) searchParams.append("company_name", params.company_name);
    if (params.gstin) searchParams.append("gstin", params.gstin);
    if (params.email) searchParams.append("email", params.email);
    if (params.phone) searchParams.append("phone", params.phone);
    if (params.account_number) searchParams.append("account_number", params.account_number);
    if (params.swift) searchParams.append("swift", params.swift);
    return request<any>(
      `${BUSINESS_API_URL}/api/v1/procurement/suppliers/check-existence?${searchParams.toString()}`,
    );
  },
  async getSuppliers(filters?: {
    search?: string;
    category?: string;
    material?: string;
    city?: string;
    vendor_type?: string;
    status?: string;
  }): Promise<any[]> {
    let url = `${BUSINESS_API_URL}/api/v1/procurement/suppliers`;
    if (filters) {
      const params = new URLSearchParams();
      if (filters.search) params.append("search", filters.search);
      if (filters.category) params.append("category", filters.category);
      if (filters.material) params.append("material", filters.material);
      if (filters.city) params.append("city", filters.city);
      if (filters.vendor_type) params.append("vendor_type", filters.vendor_type);
      if (filters.status) params.append("status", filters.status);
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
    return request<any>(`${BUSINESS_API_URL}/api/v1/procurement/suppliers/${id}/block`, {
      method: "POST",
    });
  },
  async unblockSupplier(id: string): Promise<any> {
    return request<any>(`${BUSINESS_API_URL}/api/v1/procurement/suppliers/${id}/unblock`, {
      method: "POST",
    });
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
  async getMaterialRequests(): Promise<any[]> {
    return request<any[]>(`${BUSINESS_API_URL}/api/v1/procurement/material-requests`);
  },
  async createMaterialRequest(data: any): Promise<any> {
    return request<any>(`${BUSINESS_API_URL}/api/v1/procurement/material-requests`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  },
  async updateMaterialRequest(id: string, data: any): Promise<any> {
    return request<any>(`${BUSINESS_API_URL}/api/v1/procurement/material-requests/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  },
  async processMaterialRequest(id: string): Promise<any> {
    return request<any>(`${BUSINESS_API_URL}/api/v1/procurement/material-requests/${id}/process`, {
      method: "POST",
    });
  },
  async getMaterialStock(): Promise<any[]> {
    return request<any[]>(`${BUSINESS_API_URL}/api/v1/procurement/material-stock`);
  },
  async getProcurementStats(): Promise<any> {
    return request<any>(`${BUSINESS_API_URL}/api/v1/procurement/stats`);
  },
  async uploadASNAttachment(file: File, category: string = "SUPPORTING_DOC"): Promise<any> {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("category", category);
    return request<any>(`${BUSINESS_API_URL}/api/v1/procurement/asns/attachments/upload`, {
      method: "POST",
      body: formData,
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
  async uploadQuotationDocument(file: File): Promise<any> {
    const formData = new FormData();
    formData.append("file", file);
    return request<any>(`${BUSINESS_API_URL}/api/v1/procurement/quotations/documents`, {
      method: "POST",
      body: formData,
    });
  },
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
  async getVendorTypes(): Promise<any[]> {
    return request<any[]>(`${BUSINESS_API_URL}/api/v1/procurement/vendor-types`);
  },
  async createVendorType(name: string): Promise<any> {
    return request<any>(`${BUSINESS_API_URL}/api/v1/procurement/vendor-types`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
  },
  async getSupplierCategories(): Promise<any[]> {
    return request<any[]>(`${BUSINESS_API_URL}/api/v1/procurement/supplier-categories`);
  },
  async createSupplierCategory(name: string): Promise<any> {
    return request<any>(`${BUSINESS_API_URL}/api/v1/procurement/supplier-categories`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
  },
  async getRawMaterials(): Promise<any[]> {
    return request<any[]>(`${BUSINESS_API_URL}/api/v1/procurement/raw-materials`);
  },
  async createRawMaterial(name: string): Promise<any> {
    return request<any>(`${BUSINESS_API_URL}/api/v1/procurement/raw-materials`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
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
  async getAsns(supplierId?: string): Promise<any[]> {
    const url = supplierId
      ? `${BUSINESS_API_URL}/api/v1/procurement/asns?supplier_id=${supplierId}`
      : `${BUSINESS_API_URL}/api/v1/procurement/asns`;
    return request<any[]>(url, { cache: "no-store" });
  },
  async getAsn(id: string): Promise<any> {
    return request<any>(`${BUSINESS_API_URL}/api/v1/procurement/asns/${id}`, { cache: "no-store" });
  },
  async getArrivalNotifications(): Promise<any[]> {
    try {
      const data = await request<any[]>(`${BUSINESS_API_URL}/api/v1/procurement/arrival-notifications`);
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  },
  async createAsn(data: any): Promise<any> {
    return request<any>(`${BUSINESS_API_URL}/api/v1/procurement/asns`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  },
  async updateAsn(id: string, data: any): Promise<any> {
    return request<any>(`${BUSINESS_API_URL}/api/v1/procurement/asns/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  },
  async getNextAsnNumber(): Promise<{
    asnNumber: string;
  }> {
    return request<any>(`${BUSINESS_API_URL}/api/v1/procurement/asns/next-number`);
  },
  async getNextMaterialRequestNumber(): Promise<{
    requestNumber: string;
  }> {
    return request<any>(`${BUSINESS_API_URL}/api/v1/procurement/material-requests/next-number`);
  },
  async updateQuotation(id: string, data: any): Promise<any> {
    return request<any>(`${BUSINESS_API_URL}/api/v1/procurement/quotations/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  },
  async rejectQuotation(id: string, reason: string): Promise<any> {
    return request<any>(`${BUSINESS_API_URL}/api/v1/procurement/quotations/${id}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
  },
  async declineRfq(id: string, reason: string): Promise<any> {
    return request<any>(`${BUSINESS_API_URL}/api/v1/procurement/rfqs/${id}/decline`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
  },
  async selectSupplier(rfqId: string, data: any): Promise<any> {
    return request<any>(`${BUSINESS_API_URL}/api/v1/procurement/rfqs/${rfqId}/select-supplier`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  },
  async getQuotation(id: string): Promise<any> {
    return request<any>(`${BUSINESS_API_URL}/api/v1/procurement/quotations/${id}`);
  },
  async getPurchaseOrders(search?: string): Promise<any[]> {
    const url = search
      ? `${BUSINESS_API_URL}/api/v1/procurement/purchase-orders?search=${encodeURIComponent(search)}`
      : `${BUSINESS_API_URL}/api/v1/procurement/purchase-orders`;
    return request<any[]>(url);
  },
  async getPurchaseOrder(id: string): Promise<any> {
    return request<any>(`${BUSINESS_API_URL}/api/v1/procurement/purchase-orders/${id}`);
  },
  async getPurchaseOrderByNumber(poNumber: string): Promise<any> {
    return request<any>(
      `${BUSINESS_API_URL}/api/v1/procurement/purchase-orders/by-number/${encodeURIComponent(poNumber)}`,
    );
  },
  async getPoDamagedGoods(poIdentifier: string): Promise<any> {
    return request<any>(
      `${BUSINESS_API_URL}/api/v1/procurement/purchase-orders/${encodeURIComponent(poIdentifier)}/damaged-goods`,
    );
  },
  async downloadPoPdf(id: string, poNumber?: string): Promise<void> {
    const token = getAuthToken();
    const headers = new Headers();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    } else {
      headers.set("Authorization", "Bearer local_dev_mock_token");
    }
    const response = await fetch(
      `${BUSINESS_API_URL}/api/v1/procurement/purchase-orders/${id}/pdf`,
      {
        headers,
      },
    );
    if (!response.ok) {
      throw new Error("Failed to download PDF");
    }
    let filename = poNumber ? `PO-${poNumber}.pdf` : `PO-${id}.pdf`;
    const disposition = response.headers.get("Content-Disposition");
    if (disposition && disposition.includes("filename=")) {
      const filenameMatch = disposition.match(/filename="?([^"]+)"?/);
      if (filenameMatch && filenameMatch[1]) {
        filename = filenameMatch[1];
      }
    }
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },
  async getFinanceApprovals(): Promise<any[]> {
    return request<any[]>(`${BUSINESS_API_URL}/api/v1/procurement/finance-approvals`);
  },
  async approvePurchaseOrder(id: string): Promise<any> {
    return request<any>(`${BUSINESS_API_URL}/api/v1/procurement/purchase-orders/${id}/approve`, {
      method: "POST",
    });
  },
  async rejectPurchaseOrder(id: string, reason: string): Promise<any> {
    return request<any>(`${BUSINESS_API_URL}/api/v1/procurement/purchase-orders/${id}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
  },
  async resubmitPurchaseOrder(id: string, data: any): Promise<any> {
    return request<any>(`${BUSINESS_API_URL}/api/v1/procurement/purchase-orders/${id}/resubmit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  },
  async sendPoToSupplier(id: string): Promise<any> {
    return request<any>(
      `${BUSINESS_API_URL}/api/v1/procurement/purchase-orders/${id}/send-to-supplier`,
      {
        method: "POST",
      },
    );
  },
  async getNotifications(role: string): Promise<any[]> {
    try {
      const data = await request<any[]>(`${BUSINESS_API_URL}/api/v1/procurement/notifications?role=${role}`);
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  },
  async markNotificationRead(id: string): Promise<any> {
    try {
      return await request<any>(`${BUSINESS_API_URL}/api/v1/procurement/notifications/${id}/read`, {
        method: "POST",
      });
    } catch {
      return { success: true };
    }
  },
  async markAllNotificationsRead(role: string): Promise<any> {
    try {
      return await request<any>(
        `${BUSINESS_API_URL}/api/v1/procurement/notifications/read-all?role=${encodeURIComponent(role)}`,
        {
          method: "POST",
        },
      );
    } catch {
      return { success: true };
    }
  },
  async markArrivalNotificationRead(id: string): Promise<any> {
    try {
      return await request<any>(`${BUSINESS_API_URL}/api/v1/procurement/arrival-notifications/${id}/read`, {
        method: "POST",
      });
    } catch {
      return { success: true };
    }
  },
  async markAllArrivalNotificationsRead(): Promise<any> {
    try {
      return await request<any>(`${BUSINESS_API_URL}/api/v1/procurement/arrival-notifications/read-all`, {
        method: "POST",
      });
    } catch {
      return { success: true };
    }
  },
  async globalSearch(q: string): Promise<{
    results: any[];
  }> {
    return request<any>(
      `${BUSINESS_API_URL}/api/v1/procurement/global-search?q=${encodeURIComponent(q)}`,
    );
  },
  // ============================
  // WAREHOUSE MATERIAL MASTER
  // ============================
  // ============================
  // WAREHOUSE MATERIAL MASTER
  // ============================

  async getMaterials(filters?: {
    search?: string;
    category?: string;
    status?: string;
  }): Promise<any[]> {
    const params = new URLSearchParams();

    if (filters?.search) {
      params.append("search", filters.search);
    }

    if (filters?.category) {
      params.append("category", filters.category);
    }

    if (filters?.status) {
      params.append("status", filters.status);
    }

    const query = params.toString();

    return request<any[]>(
      `${BUSINESS_API_URL}/api/v1/materials${query ? `?${query}` : ""}`,
    );
  },

  async getMaterial(id: string): Promise<any> {
    return request<any>(
      `${BUSINESS_API_URL}/api/v1/materials/${encodeURIComponent(id)}`,
    );
  },

  async createMaterial(data: {
    material_code: string;
    material_name: string;
    category: string;
    description?: string;
    base_uom: string;
    status?: string;
    variants?: any[];
  }): Promise<any> {
    return request<any>(
      `${BUSINESS_API_URL}/api/v1/materials`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      },
    );
  },

  async updateMaterial(
    id: string,
    data: any,
  ): Promise<any> {
    return request<any>(
      `${BUSINESS_API_URL}/api/v1/materials/${encodeURIComponent(id)}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      },
    );
  },

  async updateMaterialStatus(
    id: string,
    status: string,
  ): Promise<any> {
    return request<any>(
      `${BUSINESS_API_URL}/api/v1/materials/${encodeURIComponent(id)}/status`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status }),
      },
    );
  },

  async addMaterialVariant(
    materialId: string,
    data: any,
  ): Promise<any> {
    return request<any>(
      `${BUSINESS_API_URL}/api/v1/materials/${encodeURIComponent(materialId)}/variants`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      },
    );
  },

  async createMaterialVariant(
    materialId: string,
    data: any,
  ): Promise<any> {
    return this.addMaterialVariant(materialId, data);
  },

  async updateMaterialVariant(
    materialId: string,
    variantId: string,
    data: any,
  ): Promise<any> {
    return request<any>(
      `${BUSINESS_API_URL}/api/v1/materials/${encodeURIComponent(materialId)}/variants/${encodeURIComponent(variantId)}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      },
    );
  },

  async updateMaterialVariantStatus(
    materialId: string,
    variantId: string,
    status: string,
  ): Promise<any> {
    return request<any>(
      `${BUSINESS_API_URL}/api/v1/materials/${encodeURIComponent(materialId)}/variants/${encodeURIComponent(variantId)}/status`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status }),
      },
    );
  },

  async deleteMaterialVariant(
    materialId: string,
    variantId: string,
  ): Promise<any> {
    return request<any>(
      `${BUSINESS_API_URL}/api/v1/materials/${encodeURIComponent(materialId)}/variants/${encodeURIComponent(variantId)}`,
      {
        method: "DELETE",
      },
    );
  },

  async getMaterialCategories(): Promise<string[]> {
    return request<string[]>(
      `${BUSINESS_API_URL}/api/v1/materials/categories`,
    );
  },

  async getMaterialUoms(): Promise<string[]> {
    return request<string[]>(
      `${BUSINESS_API_URL}/api/v1/materials/uoms`,
    );
  },

  async getNextMaterialCode(category?: string): Promise<{
    suggested_material_code: string;
    suggested_variant_code: string;
  }> {
    const query = category
      ? `?category=${encodeURIComponent(category)}`
      : "";

    return request<any>(
      `${BUSINESS_API_URL}/api/v1/materials/next-code${query}`,
    );
  },
  async createGrnHeader(data: any): Promise<any> {
    return request<any>(`${BUSINESS_API_URL}/api/receiving/grn/header`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  },
  async updateGrnLines(grnId: string, lines: any[]): Promise<any> {
    return request<any>(`${BUSINESS_API_URL}/api/receiving/grn/${grnId}/lines`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lines }),
    });
  },
  async uploadDamageEvidence(grnLineId: string, formData: FormData): Promise<any> {
    const token = localStorage.getItem("auth_token");
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const res = await fetch(`${BUSINESS_API_URL}/api/receiving/grn/lines/${grnLineId}/damage-evidence`, {
      method: "POST",
      headers,
      body: formData,
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(err || "Failed to upload damage evidence");
    }
    return res.json();
  },
  async submitQualityInspection(grnId: string, lines: any[]): Promise<any> {
    return request<any>(`${BUSINESS_API_URL}/api/receiving/grn/${grnId}/quality`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lines }),
    });
  },
  async createGrnBatches(grnLineId: string, batches: { batch_quantity: number }[]): Promise<any[]> {
    return request<any[]>(`${BUSINESS_API_URL}/api/receiving/grn/lines/${grnLineId}/batches`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(batches),
    });
  },
  async generateDamageQrs(grnId: string): Promise<any[]> {
    return request<any[]>(`${BUSINESS_API_URL}/api/receiving/grn/${encodeURIComponent(grnId)}/damage-qrs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
  },
  async uploadGrnDocument(grnId: string, formData: FormData): Promise<any> {
    const token = localStorage.getItem("auth_token");
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const res = await fetch(`${BUSINESS_API_URL}/api/receiving/grn/${grnId}/documents`, {
      method: "POST",
      headers,
      body: formData,
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(err || "Failed to upload GRN document");
    }
    return res.json();
  },
  async completeGrn(grnId: string, verification_notes?: string): Promise<any> {
    return request<any>(`${BUSINESS_API_URL}/api/receiving/grn/${grnId}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ verification_notes }),
    });
  },
  async getGrnDetail(grnId: string): Promise<any> {
    return request<any>(`${BUSINESS_API_URL}/api/receiving/grn/${grnId}`);
  },
  async notifyVendorDamage(grnId: string, payload: { supplier_email?: string; custom_remarks?: string; notify_procurement?: boolean; damage_items?: any[]; photo_ids?: string[] }): Promise<any> {
    return request<any>(`${BUSINESS_API_URL}/api/receiving/grn/${grnId}/notify-vendor-damage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  },
  async lookupQrCode(code: string): Promise<any> {
    const encoded = encodeURIComponent(code.trim());
    return request<any>(`${BUSINESS_API_URL}/api/receiving/grn/qr-lookup?code=${encoded}`);
  },
  async getNextVariantCode(materialId: string): Promise<{
    material_code: string;
    suggested_variant_code: string;
  }> {
    return request<any>(`${BUSINESS_API_URL}/api/v1/materials/${materialId}/next-variant-code`);
  },
};

