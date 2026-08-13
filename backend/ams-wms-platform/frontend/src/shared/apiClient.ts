import { authClient } from './authClient'

const BUSINESS_SERVICE_URL = import.meta.env.VITE_BUSINESS_SERVICE_URL ?? 'http://localhost:8000'

export interface ConfirmGrnLine {
  itemCode: string
  quantity: number
}

export interface ConfirmGrnRequest {
  poId: string
  lines: ConfirmGrnLine[]
}

export interface GrnResponse {
  grnId: string
  status: string
}

export interface GrnDetailResponse {
  grnId: string
  poId: string
  status: string
  lines: { itemCode: string; receivedQuantity: number; orderedQuantity: number | null }[]
}

export interface CreateReturnLine {
  itemCode: string
  quantity: number
  reason: string
}

export interface CreateReturnRequest {
  lines: CreateReturnLine[]
}

export interface ReturnResponse {
  returnId: string
  status: string
}

export interface ReturnDetailResponse {
  returnId: string
  status: string
  lines: { itemCode: string; quantity: number; reason: string }[]
}

interface ApiError {
  message: string
  timestamp: string
}

async function parseJsonOrThrow<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as ApiError | null
    throw new Error(body?.message ?? `Request failed with status ${response.status}`)
  }
  return response.json() as Promise<T>
}

function authHeaders(): Record<string, string> {
  const token = authClient.getAccessToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

/**
 * Thin wrapper around business-service's REST API (receiving + returns).
 * Every call carries the access token issued by auth-service; the token is
 * validated LOCALLY by business-service (no call back to auth-service per
 * request) - see backend/business-service/app/security/jwt.py.
 */
export const receivingApi = {
  confirmGrn(request: ConfirmGrnRequest): Promise<GrnResponse> {
    return fetch(`${BUSINESS_SERVICE_URL}/api/receiving/grn`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(request),
    }).then((r) => parseJsonOrThrow<GrnResponse>(r))
  },

  getGrn(grnId: string): Promise<GrnDetailResponse> {
    return fetch(`${BUSINESS_SERVICE_URL}/api/receiving/grn/${grnId}`, {
      headers: authHeaders(),
    }).then((r) => parseJsonOrThrow<GrnDetailResponse>(r))
  },
}

export const returnsApi = {
  createReturn(request: CreateReturnRequest): Promise<ReturnResponse> {
    return fetch(`${BUSINESS_SERVICE_URL}/api/returns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(request),
    }).then((r) => parseJsonOrThrow<ReturnResponse>(r))
  },

  getReturn(returnId: string): Promise<ReturnDetailResponse> {
    return fetch(`${BUSINESS_SERVICE_URL}/api/returns/${returnId}`, {
      headers: authHeaders(),
    }).then((r) => parseJsonOrThrow<ReturnDetailResponse>(r))
  },
}
