/**
 * Central API Client using native fetch.
 * Links frontend components to the backend python business-service (port 8000)
 * and Java auth-service (port 8080).
 */
import QRCode from "qrcode";

const BUSINESS_API_URL =
  import.meta.env.VITE_BUSINESS_SERVICE_URL ||
  (typeof window === "undefined"
    ? "http://localhost:8000"
    : `${window.location.protocol}//${window.location.hostname}:8000`);
import { clearAuthSession, getAuthToken, storeAuthSession } from "./auth-utils";

function getApiErrorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") return fallback;

  const { detail, message } = payload as { detail?: unknown; message?: unknown };
  if (typeof detail === "string") return detail;
  if (typeof message === "string") return message;

  if (Array.isArray(detail)) {
    return (
      detail
        .map((issue) => {
          if (!issue || typeof issue !== "object") return null;
          const { loc, msg } = issue as { loc?: unknown; msg?: unknown };
          const field = Array.isArray(loc) ? loc.filter((part) => part !== "body").join(".") : "";
          return typeof msg === "string" ? (field ? `${field}: ${msg}` : msg) : null;
        })
        .filter((message): message is string => Boolean(message))
        .join("; ") || fallback
    );
  }

  return fallback;
}

/**
 * PostgreSQL Decimal values are serialized by the API as strings (for example,
 * "1.0000"). Convert only quantity-shaped response fields to numbers so every
 * screen renders whole quantities as "1" while retaining real fractions such
 * as "1.5". Storage and request precision are not changed.
 */
function normalizeQuantityValues(value: unknown, key = ""): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeQuantityValues(item));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([entryKey, entryValue]) => [
        entryKey,
        normalizeQuantityValues(entryValue, entryKey),
      ]),
    );
  }

  const isQuantityField = /(?:^|_)(?:qty|quantity|quantities)$/i.test(key) ||
    /(?:Qty|Quantity|Quantities)$/.test(key);
  if (isQuantityField && typeof value === "string" && value.trim() !== "") {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : value;
  }

  return value;
}

// Request helper with automatic header injection
async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  const headers = new Headers(options.headers || {});

  // Fetch treats a string body as plain text unless its media type is declared.
  // All string bodies produced by this client are JSON.stringify payloads.
  if (typeof options.body === "string" && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

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

  // Successful DELETE requests commonly return 204 with no response body.
  // Calling response.json() for an empty body throws "Unexpected end of JSON input".
  if (response.status === 204 || response.status === 205) {
    return undefined as T;
  }

  const responseText = await response.text();
  if (!responseText.trim()) {
    return undefined as T;
  }

  return normalizeQuantityValues(JSON.parse(responseText)) as T;
}

export const api = {
  // Authentication Use Cases
  async login(
    username: string,
    password: string,
    rememberMe = false,
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
      storeAuthSession(supplierUser, rememberMe);
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
      storeAuthSession(devUser, rememberMe);
      return devUser;
    } catch (e: any) {
      console.warn("Dev server login failed, falling back to client-side mock:", e.message);
      const isProcurement = username.toLowerCase().includes("procurement");
      const isFinance = username.toLowerCase().includes("finance");
      const isWarehouse = username.toLowerCase().includes("warehouse");
      const isGate = username.toLowerCase().includes("gate");
      const isAssembly = username.toLowerCase().includes("assembly");
      const mockUser = {
        token: isFinance
          ? "mock-jwt-finance-token"
          : isProcurement
            ? "mock-jwt-procurement-token"
            : isWarehouse
              ? "mock-jwt-warehouse-token"
              : isGate
                ? "mock-jwt-gate-entry-token"
                : isAssembly
                  ? "mock-jwt-assembly-manager-token"
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
                : isAssembly
                  ? ["ASSEMBLY_MANAGER"]
                  : ["ADMIN"],
      };
      storeAuthSession(mockUser, rememberMe);
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
    clearAuthSession();
  },

  // Gate Entry Use Cases
  async getGateEntries(status?: string): Promise<any[]> {
    const url = status
      ? `${BUSINESS_API_URL}/api/gate-entries?status=${encodeURIComponent(status)}`
      : `${BUSINESS_API_URL}/api/gate-entries`;
    return request<any[]>(url);
  },

  async getInboundArrivals(): Promise<any[]> {
    return request<any[]>(`${BUSINESS_API_URL}/api/gate-entries/inbound-arrivals`);
  },
  async createUnscheduledGateEntry(formData: FormData): Promise<any> {
    return request<any>(`${BUSINESS_API_URL}/api/gate-entries/unscheduled`, {
      method: "POST",
      body: formData,
    });
  },

  async getDocks(status?: string, type?: string): Promise<any[]> {
    const params = new URLSearchParams();
    if (status) params.append("status", status);
    if (type) params.append("dock_type", type);
    const query = params.toString();
    return request<any[]>(`${BUSINESS_API_URL}/api/v1/warehouse/docks${query ? `?${query}` : ""}`);
  },
  async getDockOverviewMetrics(): Promise<any> {
    return request<any>(`${BUSINESS_API_URL}/api/v1/warehouse/docks/availability`);
  },
  async getDockTypes(): Promise<string[]> {
    return request<string[]>(`${BUSINESS_API_URL}/api/v1/warehouse/dock-types`);
  },

  async createDock(payload: {
    dock_code: string;
    dock_name: string;
    dock_type?: string;
    location?: string;
    description?: string;
    status?: string;
  }): Promise<any> {
    return request<any>(`${BUSINESS_API_URL}/api/v1/warehouse/docks`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  async updateDockStatus(
    dockId: string,
    status: string,
    reason?: string,
  ): Promise<any> {
    return request<any>(
      `${BUSINESS_API_URL}/api/v1/warehouse/docks/${encodeURIComponent(dockId)}/status`,
      { method: "PATCH", body: JSON.stringify({ status, reason }) },
    );
  },
  async updateDock(id: string, payload: any): Promise<any> {
    return request<any>(`${BUSINESS_API_URL}/api/v1/warehouse/docks/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  },
  async allocateDock(allocationRequestId: string, dockId: string): Promise<any> {
    return request<any>(`${BUSINESS_API_URL}/api/v1/warehouse/dock-allocations`, {
      method: "POST",
      body: JSON.stringify({ allocation_request_id: allocationRequestId, dock_id: dockId }),
    });
  },
  async markVehicleArrived(id: string): Promise<any> {
    return request<any>(`${BUSINESS_API_URL}/api/v1/warehouse/dock-allocations/${encodeURIComponent(id)}/arrive`, {
      method: "POST",
    });
  },
  async releaseDock(id: string): Promise<any> {
    return request<any>(`${BUSINESS_API_URL}/api/v1/warehouse/dock-allocations/${encodeURIComponent(id)}/release`, {
      method: "POST",
    });
  },
  async getPendingAllocations(): Promise<any[]> {
    return request<any[]>(`${BUSINESS_API_URL}/api/v1/warehouse/dock-allocation-requests/pending`);
  },
  async getDockHistory(): Promise<any[]> {
    return request<any[]>(`${BUSINESS_API_URL}/api/v1/warehouse/dock-history`);
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
    items: Array<{ item_code: string; received_quantity: number }>,
  ): Promise<any> {
    return request<any>(
      `${BUSINESS_API_URL}/api/gate-entries/${gateEntryId}/receiving-quantities`,
      {
        method: "PUT",
        body: JSON.stringify({ items }),
      },
    );
  },

  async recordMaterialConditions(
    gateEntryId: string,
    items: Array<{
      item_code: string;
      good_quantity: number;
      damaged_quantity: number;
      rejected_quantity: number;
      inspection_required: boolean;
      physical_condition_ok: boolean;
      packaging_ok: boolean;
      specifications_ok: boolean;
      serial_batch_number?: string;
      serial_batch_verified: boolean;
      notes?: string;
    }>,
  ): Promise<any> {
    return request<any>(`${BUSINESS_API_URL}/api/gate-entries/${gateEntryId}/material-conditions`, {
      method: "PUT",
      body: JSON.stringify({ items }),
    });
  },

  async createDamageReport(
    gateEntryId: string,
    data: { itemCode: string; damagedQuantity: number; damageReason: string; remarks?: string; photos: File[] },
  ): Promise<any> {
    const form = new FormData();
    form.append("item_code", data.itemCode);
    form.append("damaged_quantity", String(data.damagedQuantity));
    form.append("damage_reason", data.damageReason);
    if (data.remarks) form.append("remarks", data.remarks);
    data.photos.forEach((photo) => form.append("photos", photo));
    return request<any>(`${BUSINESS_API_URL}/api/gate-entries/${gateEntryId}/damage-reports`, {
      method: "POST",
      body: form,
    });
  },

  async quarantineDamagedMaterial(gateEntryId: string, itemCode: string): Promise<any> {
    return request<any>(
      `${BUSINESS_API_URL}/api/gate-entries/${gateEntryId}/materials/${encodeURIComponent(itemCode)}/quarantine`,
      { method: "POST" },
    );
  },

  async submitDamageReport(reportId: string): Promise<any> {
    return request<any>(`${BUSINESS_API_URL}/api/gate-entries/damage-reports/${reportId}/submit`, {
      method: "POST",
    });
  },

  async createSupplierDamageClaim(reportId: string): Promise<any> {
    return request<any>(`${BUSINESS_API_URL}/api/gate-entries/quality/damage-reports/${reportId}/claims`, { method: "POST" });
  },

  async getDamageClaims(): Promise<any[]> { return request<any[]>(`${BUSINESS_API_URL}/api/damage-claims`); },
  async respondToDamageClaim(id: string, data: any): Promise<any> { return request<any>(`${BUSINESS_API_URL}/api/damage-claims/${id}/respond`, { method: "POST", body: JSON.stringify(data) }); },
  async createReplacementShipment(id: string, data: any): Promise<any> { return request<any>(`${BUSINESS_API_URL}/api/damage-claims/${id}/replacement-shipments`, { method: "POST", body: JSON.stringify(data) }); },
  async replacementGateEntry(id: string, vehicle_number: string): Promise<any> { return request<any>(`${BUSINESS_API_URL}/api/damage-claims/replacement-shipments/${id}/gate-entry`, { method: "POST", body: JSON.stringify({ vehicle_number }) }); },
  async receiveReplacement(id: string, received_quantity: number): Promise<any> { return request<any>(`${BUSINESS_API_URL}/api/damage-claims/replacement-shipments/${id}/receive`, { method: "POST", body: JSON.stringify({ received_quantity }) }); },
  async inspectReplacement(id: string, accepted_quantity: number, damaged_quantity: number): Promise<any> { return request<any>(`${BUSINESS_API_URL}/api/damage-claims/replacement-shipments/${id}/inspect`, { method: "POST", body: JSON.stringify({ accepted_quantity, damaged_quantity }) }); },
  async putawayReplacement(id: string, location: string): Promise<any> { return request<any>(`${BUSINESS_API_URL}/api/damage-claims/replacement-shipments/${id}/putaway`, { method: "POST", body: JSON.stringify({ location }) }); },
  async postReplacementInventory(id: string): Promise<any> { return request<any>(`${BUSINESS_API_URL}/api/damage-claims/replacement-shipments/${id}/post-inventory`, { method: "POST" }); },
  async createSupplierReturn(id: string, vehicle_number: string): Promise<any> { return request<any>(`${BUSINESS_API_URL}/api/damage-claims/${id}/returns`, { method: "POST", body: JSON.stringify({ vehicle_number }) }); },
  async completeSupplierReturn(id: string): Promise<any> { return request<any>(`${BUSINESS_API_URL}/api/damage-claims/returns/${id}/gate-exit`, { method: "POST" }); },
  async closeDamageClaim(id: string): Promise<any> { return request<any>(`${BUSINESS_API_URL}/api/damage-claims/${id}/close`, { method: "POST" }); },

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

  async sendQualityIssue(gateEntryId: string, image: File): Promise<any> {
    const formData = new FormData();
    formData.append("image", image);
    return request<any>(`${BUSINESS_API_URL}/api/gate-entries/${gateEntryId}/quality-issue`, {
      method: "POST",
      body: formData,
    });
  },

  async getQualityIssues(): Promise<any[]> {
    return request<any[]>(`${BUSINESS_API_URL}/api/gate-entries/quality/issues`, { cache: "no-store" });
  },

  async forwardQualityIssue(gateEntryId: string): Promise<any> {
    return request<any>(`${BUSINESS_API_URL}/api/gate-entries/quality/issues/${gateEntryId}/forward`, {
      method: "POST",
    });
  },


  async completeReceiving(gateEntryId: string): Promise<any> {
    return request<any>(`${BUSINESS_API_URL}/api/gate-entries/${gateEntryId}/complete-receiving`, {
      method: "POST",
    });
  },
  async releaseDock(gateEntryId: string): Promise<any> {
    return request<any>(`${BUSINESS_API_URL}/api/gate-entries/${gateEntryId}/release-dock`, {
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

  async getGrnDrafts(): Promise<any[]> {
    return request<any[]>(`${BUSINESS_API_URL}/api/gate-entries/grn-drafts`);
  },

  async postGrn(grnId: string, verificationNotes?: string): Promise<any> {
    return request<any>(`${BUSINESS_API_URL}/api/gate-entries/grns/${grnId}/post`, {
      method: "POST",
      body: JSON.stringify({ verification_notes: verificationNotes }),
    });
  },

  async getInventoryTransactions(): Promise<any[]> {
    return request<any[]>(`${BUSINESS_API_URL}/api/gate-entries/inventory-transactions`);
  },

  async getPutawayTasks(): Promise<any[]> {
    return request<any[]>(`${BUSINESS_API_URL}/api/storage/putaway-tasks`);
  },

  async getStorageLocations(warehouseId?: string, includeInactive = false): Promise<any[]> {
    const query = warehouseId ? `?warehouse_id=${encodeURIComponent(warehouseId)}` : "";
    const separator = query ? "&" : "?";
    return request<any[]>(
      `${BUSINESS_API_URL}/api/storage/putaway-tasks/locations${query}${separator}include_inactive=${includeInactive}`,
    );
  },

  async createStorageLocation(payload: any): Promise<any> {
    return request<any>(`${BUSINESS_API_URL}/api/storage/putaway-tasks/locations`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async updateStorageLocation(locationId: string, payload: any): Promise<any> {
    return request<any>(`${BUSINESS_API_URL}/api/storage/putaway-tasks/locations/${locationId}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
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

  async assignPutawayOperator(taskId: string, operator: string): Promise<any> {
    return request<any>(`${BUSINESS_API_URL}/api/storage/putaway-tasks/${taskId}/operator`, {
      method: "PUT",
      body: JSON.stringify({ operator }),
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
      material_code: string;
      material_name: string;
      source_location: string;
      destination_location: string;
      quantity: number;
      batch_lot?: string;
      serial_number?: string;
      container_pallet?: string;
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
      // Leave Content-Type empty to let the browser set it automatically for Form-Data boundary
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
    // Open synchronously from the click handler so browser pop-up protection
    // does not prevent the printable pass from appearing after the fetch.
    const passWindow = window.open("", "gate-pass", "width=520,height=760");
    if (!passWindow) {
      throw new Error("Allow pop-ups to print the gate pass");
    }

    const token = getAuthToken();
    const headers = new Headers();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    } else {
      headers.set("Authorization", "Bearer local_dev_mock_token");
    }

    try {
      const response = await fetch(`${BUSINESS_API_URL}/api/gate-entries/${id}/pass`, {
        headers,
      });

      if (!response.ok) {
        passWindow.close();
        throw new Error("Failed to download gate pass");
      }

      let passHtml = await response.text();

      // Generate QR Code to embed in the pass for digital verification at internal checkpoints
      try {
        const qrData = gateEntryNumber || id;
        const qrDataUrl = await QRCode.toDataURL(qrData, {
          width: 160,
          margin: 1,
          color: {
            dark: "#000000",
            light: "#ffffff",
          },
        });

        const qrHtml = `
          <div style="display: flex; flex-direction: column; align-items: center;" class="qr-container">
            <img src="${qrDataUrl}" style="width: 140px; height: 140px; border: 1px solid #eee; padding: 8px; border-radius: 12px; background: #fff;" alt="Pass QR Code" />
          </div>
        `;

        // Replace the placeholder entirely if it exists
        if (passHtml.includes('<div class="pass-number">')) {
          // Find the end of the div and replace its contents or the whole div
          // For simplicity with string replacement, we'll just target the placeholder text if found
          const placeholderText = '(Auto-generated)';
          if (passHtml.includes(placeholderText)) {
             passHtml = passHtml.replace(/<div class="pass-number">[\s\S]*?<\/div>/, qrHtml);
          } else {
             passHtml = passHtml.replace('<div class="pass-number">', `${qrHtml}<div class="pass-number">`);
          }
        }
      } catch (qrErr) {
        console.error("QR generation failed", qrErr);
      }

      passWindow.document.open();
      passWindow.document.write(passHtml);
      passWindow.document.close();
      passWindow.focus();
      window.setTimeout(() => passWindow.print(), 250);
    } catch (error) {
      if (passWindow) passWindow.close();
      throw error;
    }
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

  async previewPoOcr(base64Image: string, poNumberOverride?: string): Promise<any> {
    return request<any>(`${BUSINESS_API_URL}/api/gate/po-ocr-preview`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        documentImageBase64: base64Image,
        poNumberOverride: poNumberOverride,
      }),
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
  async createReturn(
    lines: { itemCode: string; quantity: number; reason: string }[],
  ): Promise<any> {
    return request<any>(`${BUSINESS_API_URL}/api/returns`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ lines }),
    });
  },

  // Procurement Use Cases
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

  async getBankDetailsByIfsc(ifsc: string): Promise<{
    ifsc: string;
    bank_name: string;
    branch_name: string;
  }> {
    const response = await fetch(`https://ifsc.razorpay.com/${encodeURIComponent(ifsc)}`);
    if (response.status === 404) throw new Error("IFSC code was not found");
    if (!response.ok) throw new Error("IFSC lookup service is unavailable");
    const details = await response.json();
    if (!details.BANK || !details.BRANCH) throw new Error("Incomplete bank details received");
    return { ifsc: details.IFSC, bank_name: details.BANK, branch_name: details.BRANCH };
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

  async getPickTasks(): Promise<any[]> {
    return request<any[]>(`${BUSINESS_API_URL}/api/v1/procurement/pick-tasks`);
  },

  async assignPickTask(taskId: string, operator: string): Promise<any> {
    return request<any>(
      `${BUSINESS_API_URL}/api/v1/procurement/pick-tasks/${taskId}/assign?operator=${encodeURIComponent(operator)}`,
      { method: "POST" },
    );
  },

  async startPickTask(taskId: string): Promise<any> {
    return request<any>(`${BUSINESS_API_URL}/api/v1/procurement/pick-tasks/${taskId}/start`, {
      method: "POST",
    });
  },

  async completePickTask(taskId: string): Promise<any> {
    return request<any>(`${BUSINESS_API_URL}/api/v1/procurement/pick-tasks/${taskId}/complete`, {
      method: "POST",
    });
  },

  async issuePickedMaterial(taskId: string, receivedBy: string): Promise<any> {
    return request<any>(
      `${BUSINESS_API_URL}/api/v1/procurement/pick-tasks/${taskId}/issue?received_by=${encodeURIComponent(receivedBy)}`,
      { method: "POST" },
    );
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

  async getMaterialCatalog(): Promise<any[]> {
    return request<any[]>(`${BUSINESS_API_URL}/api/v1/procurement/material-catalog`, {
      cache: "no-store",
    });
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
    return request<any[]>(`${BUSINESS_API_URL}/api/v1/procurement/arrival-notifications`);
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

  async getNextAsnNumber(): Promise<{ asnNumber: string }> {
    return request<any>(`${BUSINESS_API_URL}/api/v1/procurement/asns/next-number`);
  },

  async getNextMaterialRequestNumber(): Promise<{
    requestNumber: string;
    nextMaterialSequence: number;
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

  async getPurchaseOrders(search?: string, signal?: AbortSignal): Promise<any[]> {
    const url = search
      ? `${BUSINESS_API_URL}/api/v1/procurement/purchase-orders?search=${encodeURIComponent(search)}`
      : `${BUSINESS_API_URL}/api/v1/procurement/purchase-orders`;
    return request<any[]>(url, { cache: "no-store", signal });
  },

  async getPurchaseOrder(id: string): Promise<any> {
    return request<any>(`${BUSINESS_API_URL}/api/v1/procurement/purchase-orders/${id}`);
  },
  async getPurchaseOrderByNumber(poNumber: string): Promise<any> {
    return request<any>(
      `${BUSINESS_API_URL}/api/v1/procurement/purchase-orders/by-number/${encodeURIComponent(poNumber)}`,
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

    // Try to get filename from Content-Disposition header
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
    return request<any[]>(`${BUSINESS_API_URL}/api/v1/procurement/notifications?role=${role}`);
  },

  async markNotificationRead(id: string): Promise<any> {
    return request<any>(`${BUSINESS_API_URL}/api/v1/procurement/notifications/${id}/read`, {
      method: "POST",
    });
  },

  async markAllNotificationsRead(role: string): Promise<any> {
    return request<any>(
      `${BUSINESS_API_URL}/api/v1/procurement/notifications/read-all?role=${encodeURIComponent(role)}`,
      {
        method: "POST",
      },
    );
  },

  async markArrivalNotificationRead(id: string): Promise<any> {
    return request<any>(`${BUSINESS_API_URL}/api/v1/procurement/arrival-notifications/${id}/read`, {
      method: "POST",
    });
  },

  async markAllArrivalNotificationsRead(): Promise<any> {
    return request<any>(`${BUSINESS_API_URL}/api/v1/procurement/arrival-notifications/read-all`, {
      method: "POST",
    });
  },

  async globalSearch(q: string): Promise<{ results: any[] }> {
    return request<any>(
      `${BUSINESS_API_URL}/api/v1/procurement/global-search?q=${encodeURIComponent(q)}`,
    );
  },
  async getAssemblyDashboard(): Promise<any> {
    return request<any>(`${BUSINESS_API_URL}/api/v1/assembly/dashboard`);
  },

  async getAssemblyReports(): Promise<any> {
    return request<any>(`${BUSINESS_API_URL}/api/v1/assembly/reports`);
  },

  async getAssemblyModuleOverview(section: string): Promise<any> {
    return request<any>(
      `${BUSINESS_API_URL}/api/v1/assembly/overview/${encodeURIComponent(section)}`,
    );
  },

  async getAssemblyOrders(): Promise<any[]> {
    return request<any[]>(`${BUSINESS_API_URL}/api/v1/assembly/orders`);
  },

  async updateAssemblyOrderDetails(id: string, data: any): Promise<any> {
    return request<any>(`${BUSINESS_API_URL}/api/v1/assembly/orders/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  async updateAssemblyOrder(id: string, data: any): Promise<any> {
    return request<any>(`${BUSINESS_API_URL}/api/v1/assembly/orders/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  async getOrderRequirements(id: string): Promise<any> {
    return request<any>(`${BUSINESS_API_URL}/api/v1/assembly/orders/${id}/requirements`);
  },

  async getAssemblyOrder(id: string): Promise<any> {
    return request<any>(`${BUSINESS_API_URL}/api/v1/assembly/orders/${id}`);
  },

  async getAssemblyMaterialIssue(id: string): Promise<any> {
    return request<any>(`${BUSINESS_API_URL}/api/v1/assembly/orders/${id}/material-issue`);
  },

  async updateAssemblyStep(orderId: string, stepId: string, status: string): Promise<any> {
    return request<any>(`${BUSINESS_API_URL}/api/v1/assembly/orders/${orderId}/steps/${stepId}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
  },

  async updateAssemblyProgress(orderId: string, completedQuantity: number): Promise<any> {
    return request<any>(`${BUSINESS_API_URL}/api/v1/assembly/orders/${orderId}/progress`, {
      method: "PATCH",
      body: JSON.stringify({ completed_quantity: completedQuantity }),
    });
  },

  async getAssemblyConsumption(orderId: string): Promise<any> {
    return request<any>(`${BUSINESS_API_URL}/api/v1/assembly/orders/${orderId}/consumption`);
  },

  async recordAssemblyConsumption(orderId: string, data: any): Promise<any> {
    return request<any>(`${BUSINESS_API_URL}/api/v1/assembly/orders/${orderId}/consumption`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  async getAssemblyScrap(orderId: string): Promise<any> {
    return request<any>(`${BUSINESS_API_URL}/api/v1/assembly/orders/${orderId}/scrap`);
  },

  async createAssemblyScrap(orderId: string, data: any): Promise<any> {
    return request<any>(`${BUSINESS_API_URL}/api/v1/assembly/orders/${orderId}/scrap`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async approveAssemblyScrap(orderId: string, scrapId: string, approvedBy: string): Promise<any> {
    return request<any>(
      `${BUSINESS_API_URL}/api/v1/assembly/orders/${orderId}/scrap/${scrapId}/approve`,
      {
        method: "PATCH",
        body: JSON.stringify({ approved_by: approvedBy }),
      },
    );
  },

  async getAssemblyQualityInspection(orderId: string): Promise<any> {
    return request<any>(`${BUSINESS_API_URL}/api/v1/assembly/orders/${orderId}/quality-inspection`);
  },

  async recordAssemblyQualityInspection(orderId: string, data: any): Promise<any> {
    return request<any>(
      `${BUSINESS_API_URL}/api/v1/assembly/orders/${orderId}/quality-inspection`,
      {
        method: "PUT",
        body: JSON.stringify(data),
      },
    );
  },

  async getMaterials(filters?: {
    search?: string;
    category?: string;
    status?: string;
  }): Promise<any[]> {
    const params = new URLSearchParams();
    if (filters?.search) params.append("search", filters.search);
    if (filters?.category) params.append("category", filters.category);
    if (filters?.status) params.append("status", filters.status);
    const query = params.toString();
    return request<any[]>(`${BUSINESS_API_URL}/api/v1/materials${query ? `?${query}` : ""}`);
  },
  async getMaterial(id: string): Promise<any> {
    return request<any>(`${BUSINESS_API_URL}/api/v1/materials/${id}`);
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
    return request<any>(`${BUSINESS_API_URL}/api/v1/materials`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  },
  async updateMaterial(id: string, data: any): Promise<any> {
    return request<any>(`${BUSINESS_API_URL}/api/v1/materials/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  },
  async updateMaterialStatus(id: string, status: string): Promise<any> {
    return request<any>(`${BUSINESS_API_URL}/api/v1/materials/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
  },
  async addMaterialVariant(materialId: string, data: any): Promise<any> {
    return request<any>(`${BUSINESS_API_URL}/api/v1/materials/${materialId}/variants`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  },
  async updateMaterialVariant(materialId: string, variantId: string, data: any): Promise<any> {
    return request<any>(
      `${BUSINESS_API_URL}/api/v1/materials/${materialId}/variants/${variantId}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      },
    );
  },
  async getAssemblyFinishedGoods(): Promise<any[]> {
    return request<any[]>(`${BUSINESS_API_URL}/api/v1/assembly/finished-goods`);
  },

  async getAssemblyRework(orderId: string): Promise<any> {
    return request<any>(`${BUSINESS_API_URL}/api/v1/assembly/orders/${orderId}/rework`);
  },

  async createAssemblyRework(orderId: string, data: any): Promise<any> {
    return request<any>(`${BUSINESS_API_URL}/api/v1/assembly/orders/${orderId}/rework`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async updateAssemblyRework(orderId: string, reworkId: string, data: any): Promise<any> {
    return request<any>(
      `${BUSINESS_API_URL}/api/v1/assembly/orders/${orderId}/rework/${reworkId}`,
      {
        method: "PATCH",
        body: JSON.stringify(data),
      },
    );
  },

  async getAssemblyTeams(): Promise<any[]> {
    return request<any[]>(`${BUSINESS_API_URL}/api/v1/assembly/teams`);
  },

  async createAssemblyTeam(data: any): Promise<any> {
    return request<any>(`${BUSINESS_API_URL}/api/v1/assembly/teams`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async updateAssemblyTeam(id: string, data: any): Promise<any> {
    return request<any>(`${BUSINESS_API_URL}/api/v1/assembly/teams/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  async requestShortageMaterials(id: string): Promise<any> {
    return request<any>(`${BUSINESS_API_URL}/api/v1/assembly/orders/${id}/material-request`, {
      method: "POST",
    });
  },

  async updateMaterialVariantStatus(
    materialId: string,
    variantId: string,
    status: string,
  ): Promise<any> {
    return request<any>(
      `${BUSINESS_API_URL}/api/v1/materials/${materialId}/variants/${variantId}/status`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      },
    );
  },
  async deleteMaterialVariant(materialId: string, variantId: string): Promise<any> {
    return request<any>(
      `${BUSINESS_API_URL}/api/v1/materials/${materialId}/variants/${variantId}`,
      {
        method: "DELETE",
      },
    );
  },
  async getMaterialCategories(): Promise<string[]> {
    return request<string[]>(`${BUSINESS_API_URL}/api/v1/materials/categories`);
  },
  async getMaterialUoms(): Promise<string[]> {
    return request<string[]>(`${BUSINESS_API_URL}/api/v1/materials/uoms`);
  },
  async getNextMaterialCode(category?: string): Promise<{
    suggested_material_code: string;
    suggested_variant_code: string;
  }> {
    const query = category ? `?category=${encodeURIComponent(category)}` : "";
    return request<any>(`${BUSINESS_API_URL}/api/v1/materials/next-code${query}`);
  },
  async getNextVariantCode(materialId: string): Promise<{
    material_code: string;
    suggested_variant_code: string;
  }> {
    return request<any>(`${BUSINESS_API_URL}/api/v1/materials/${materialId}/next-variant-code`);
  },
};
