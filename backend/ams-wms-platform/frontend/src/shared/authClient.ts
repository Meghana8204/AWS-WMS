const AUTH_SERVICE_URL = import.meta.env.VITE_AUTH_SERVICE_URL ?? 'http://localhost:8080'

const ACCESS_TOKEN_KEY = 'ams.accessToken'
const REFRESH_TOKEN_KEY = 'ams.refreshToken'

export interface TokenResponse {
  accessToken: string
  refreshToken: string
  tokenType: string
  expiresInSeconds: number
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

/**
 * Thin client for auth-service. This is the ONLY module that talks to
 * auth-service - every other request in the app goes to business-service
 * with the access token this module manages, matching the target
 * architecture's "Python validates JWT locally" design (see
 * backend/business-service/app/security/jwt.py).
 */
export const authClient = {
  async login(username: string, password: string): Promise<TokenResponse> {
    const response = await fetch(`${AUTH_SERVICE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
    const tokens = await parseJsonOrThrow<TokenResponse>(response)
    localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken)
    localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken)
    return tokens
  },

  async logout(): Promise<void> {
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY)
    const accessToken = localStorage.getItem(ACCESS_TOKEN_KEY)
    if (refreshToken && accessToken) {
      await fetch(`${AUTH_SERVICE_URL}/auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ refreshToken }),
      }).catch(() => undefined)
    }
    localStorage.removeItem(ACCESS_TOKEN_KEY)
    localStorage.removeItem(REFRESH_TOKEN_KEY)
  },

  getAccessToken(): string | null {
    return localStorage.getItem(ACCESS_TOKEN_KEY)
  },

  isAuthenticated(): boolean {
    return authClient.getAccessToken() !== null
  },
}
