import { useState, useEffect } from 'react'

const BUSINESS_SERVICE_URL = import.meta.env.VITE_BUSINESS_SERVICE_URL ?? 'http://localhost:8000'
const AUTH_SERVICE_URL = import.meta.env.VITE_AUTH_SERVICE_URL ?? 'http://localhost:8080'

interface HealthStatus {
  status: 'checking' | 'online' | 'offline'
  latencyMs?: number
  data?: any
  error?: string
}

const PRESET_ENDPOINTS = [
  {
    name: 'Health Check (Public)',
    method: 'GET',
    path: '/health',
    body: '',
    requireAuth: false,
    description: 'Basic service health check'
  },
  {
    name: 'Readiness Probe (Public)',
    method: 'GET',
    path: '/health/ready',
    body: '',
    requireAuth: false,
    description: 'Check if business-service is ready for traffic'
  },
  {
    name: 'List Purchase Orders (Procurement)',
    method: 'GET',
    path: '/api/procurement/purchase-orders',
    body: '',
    requireAuth: true,
    description: 'Fetch purchase orders from business service'
  },
  {
    name: 'Create Purchase Order (Procurement)',
    method: 'POST',
    path: '/api/procurement/purchase-orders',
    body: JSON.stringify({
      supplierId: 'sup-101',
      items: [
        { itemCode: 'ITEM-A', quantity: 50, unitPrice: 12.5 },
        { itemCode: 'ITEM-B', quantity: 20, unitPrice: 45.0 }
      ]
    }, null, 2),
    requireAuth: true,
    description: 'Create a new purchase order'
  },
  {
    name: 'Confirm GRN (Receiving)',
    method: 'POST',
    path: '/api/receiving/grn',
    body: JSON.stringify({
      poId: '11111111-1111-1111-1111-111111111111',
      lines: [
        { itemCode: 'ITEM-A', quantity: 10 }
      ]
    }, null, 2),
    requireAuth: true,
    description: 'Confirm goods receipt note against PO'
  },
  {
    name: 'Create Return (Returns)',
    method: 'POST',
    path: '/api/returns',
    body: JSON.stringify({
      lines: [
        { itemCode: 'ITEM-A', quantity: 2, reason: 'Damaged during transit' }
      ]
    }, null, 2),
    requireAuth: true,
    description: 'Submit an item return request'
  }
]

export default function BackendTesterPage() {
  const [bizHealth, setBizHealth] = useState<HealthStatus>({ status: 'checking' })
  const [authHealth, setAuthHealth] = useState<HealthStatus>({ status: 'checking' })
  
  // API Tester state
  const [selectedPreset, setSelectedPreset] = useState(0)
  const [method, setMethod] = useState('GET')
  const [endpointPath, setEndpointPath] = useState('/health')
  const [requestBody, setRequestBody] = useState('')
  const [bearerToken, setBearerToken] = useState('')
  
  // Response state
  const [responseStatus, setResponseStatus] = useState<number | null>(null)
  const [responseHeaders, setResponseHeaders] = useState<Record<string, string>>({})
  const [responseBody, setResponseBody] = useState<string>('')
  const [responseTime, setResponseTime] = useState<number | null>(null)
  const [executing, setExecuting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Check health on mount
  useEffect(() => {
    checkHealth()
  }, [])

  async function checkHealth() {
    setBizHealth({ status: 'checking' })
    setAuthHealth({ status: 'checking' })

    // Business Service Health
    const t0 = performance.now()
    try {
      const res = await fetch(`${BUSINESS_SERVICE_URL}/health`)
      const t1 = performance.now()
      if (res.ok) {
        const data = await res.json()
        setBizHealth({ status: 'online', latencyMs: Math.round(t1 - t0), data })
      } else {
        setBizHealth({ status: 'offline', error: `HTTP ${res.status}` })
      }
    } catch (err: any) {
      setBizHealth({ status: 'offline', error: err?.message || 'Connection Refused' })
    }

    // Auth Service Health
    const t0a = performance.now()
    try {
      const res = await fetch(`${AUTH_SERVICE_URL}/health`)
      const t1a = performance.now()
      if (res.ok) {
        const data = await res.json()
        setAuthHealth({ status: 'online', latencyMs: Math.round(t1a - t0a), data })
      } else {
        setAuthHealth({ status: 'offline', error: `HTTP ${res.status}` })
      }
    } catch (err: any) {
      setAuthHealth({ status: 'offline', error: err?.message || 'Connection Refused' })
    }
  }

  function applyPreset(index: number) {
    const preset = PRESET_ENDPOINTS[index]
    setSelectedPreset(index)
    setMethod(preset.method)
    setEndpointPath(preset.path)
    setRequestBody(preset.body)
  }

  async function executeRequest() {
    setExecuting(true)
    setErrorMsg(null)
    setResponseStatus(null)
    setResponseBody('')
    setResponseTime(null)

    const url = endpointPath.startsWith('http')
      ? endpointPath
      : `${BUSINESS_SERVICE_URL}${endpointPath.startsWith('/') ? '' : '/'}${endpointPath}`

    const headers: Record<string, string> = {}
    if (method !== 'GET' && method !== 'HEAD') {
      headers['Content-Type'] = 'application/json'
    }
    if (bearerToken.trim()) {
      headers['Authorization'] = `Bearer ${bearerToken.trim()}`
    }

    const t0 = performance.now()
    try {
      const res = await fetch(url, {
        method,
        headers,
        body: method !== 'GET' && method !== 'HEAD' && requestBody.trim() ? requestBody : undefined
      })
      const t1 = performance.now()
      setResponseTime(Math.round(t1 - t0))
      setResponseStatus(res.status)

      const headerObj: Record<string, string> = {}
      res.headers.forEach((val, key) => {
        headerObj[key] = val
      })
      setResponseHeaders(headerObj)

      const text = await res.text()
      try {
        const parsed = JSON.parse(text)
        setResponseBody(JSON.stringify(parsed, null, 2))
      } catch {
        setResponseBody(text)
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Network request failed')
    } finally {
      setExecuting(false)
    }
  }

  return (
    <section className="page backend-tester">
      <div className="tester-header">
        <div>
          <h1>Backend Health & API Tester</h1>
          <p className="page-subtitle">
            Directly inspect and test <code>business-service</code> (FastAPI) running on{' '}
            <a href={`${BUSINESS_SERVICE_URL}/docs`} target="_blank" rel="noreferrer">
              {BUSINESS_SERVICE_URL}
            </a>
          </p>
        </div>
        <button className="btn-secondary" onClick={checkHealth}>
          🔄 Refresh Status
        </button>
      </div>

      {/* Service Status Cards */}
      <div className="status-grid">
        <div className={`status-card ${bizHealth.status}`}>
          <div className="status-card-header">
            <span className="service-title">Business Service (FastAPI)</span>
            <span className={`status-badge ${bizHealth.status}`}>
              {bizHealth.status === 'online' ? '● ONLINE' : bizHealth.status === 'offline' ? '○ OFFLINE' : '⏳ CHECKING'}
            </span>
          </div>
          <div className="status-card-body">
            <p><strong>URL:</strong> <code>{BUSINESS_SERVICE_URL}</code></p>
            {bizHealth.latencyMs !== undefined && <p><strong>Latency:</strong> {bizHealth.latencyMs} ms</p>}
            {bizHealth.data && <pre className="mini-code">{JSON.stringify(bizHealth.data, null, 2)}</pre>}
            {bizHealth.error && <p className="text-error">{bizHealth.error}</p>}
          </div>
          <div className="status-card-footer">
            <a href={`${BUSINESS_SERVICE_URL}/docs`} target="_blank" rel="noreferrer" className="link-docs">
              📖 Open Swagger OpenAPI Docs
            </a>
          </div>
        </div>

        <div className={`status-card ${authHealth.status}`}>
          <div className="status-card-header">
            <span className="service-title">Auth Service (Spring Boot)</span>
            <span className={`status-badge ${authHealth.status}`}>
              {authHealth.status === 'online' ? '● ONLINE' : authHealth.status === 'offline' ? '○ OFFLINE' : '⏳ CHECKING'}
            </span>
          </div>
          <div className="status-card-body">
            <p><strong>URL:</strong> <code>{AUTH_SERVICE_URL}</code></p>
            {authHealth.latencyMs !== undefined && <p><strong>Latency:</strong> {authHealth.latencyMs} ms</p>}
            {authHealth.data && <pre className="mini-code">{JSON.stringify(authHealth.data, null, 2)}</pre>}
            {authHealth.error && <p className="text-error">{authHealth.error}</p>}
          </div>
          <div className="status-card-footer">
            <span className="text-muted">Port 8080 (Optional for dev testing)</span>
          </div>
        </div>
      </div>

      {/* Interactive API Tester */}
      <div className="card tester-panel">
        <h2>⚡ Interactive API Tester</h2>
        <p className="card-subtitle">Select an API preset or type any custom endpoint path to test backend responses.</p>

        {/* Preset Buttons */}
        <div className="presets-bar">
          <label><strong>Quick Presets:</strong></label>
          <div className="preset-chips">
            {PRESET_ENDPOINTS.map((p, idx) => (
              <button
                key={idx}
                type="button"
                className={`chip ${selectedPreset === idx ? 'chip-active' : ''}`}
                onClick={() => applyPreset(idx)}
              >
                <span className={`method-tag method-${p.method}`}>{p.method}</span> {p.name}
              </button>
            ))}
          </div>
        </div>

        {/* Request Config Form */}
        <div className="form-row">
          <div className="form-group method-group">
            <label>Method</label>
            <select value={method} onChange={(e) => setMethod(e.target.value)}>
              <option value="GET">GET</option>
              <option value="POST">POST</option>
              <option value="PUT">PUT</option>
              <option value="DELETE">DELETE</option>
            </select>
          </div>
          <div className="form-group path-group">
            <label>Endpoint Path</label>
            <input
              type="text"
              value={endpointPath}
              onChange={(e) => setEndpointPath(e.target.value)}
              placeholder="/health or /api/procurement/purchase-orders"
            />
          </div>
        </div>

        {/* Auth Token Input */}
        <div className="form-group">
          <label>
            Bearer Token <span className="text-muted">(Optional - required for protected routes)</span>
          </label>
          <input
            type="text"
            value={bearerToken}
            onChange={(e) => setBearerToken(e.target.value)}
            placeholder="Paste JWT Access Token here..."
          />
        </div>

        {/* Request Body Editor */}
        {method !== 'GET' && method !== 'HEAD' && (
          <div className="form-group">
            <label>Request Body (JSON)</label>
            <textarea
              rows={6}
              value={requestBody}
              onChange={(e) => setRequestBody(e.target.value)}
              placeholder='{ "key": "value" }'
            />
          </div>
        )}

        <button className="btn-primary" onClick={executeRequest} disabled={executing}>
          {executing ? 'Sending Request...' : '🚀 Send API Request'}
        </button>
      </div>

      {/* Response Panel */}
      {(responseStatus !== null || errorMsg || executing) && (
        <div className="card response-panel">
          <div className="response-header">
            <h3>Response Results</h3>
            {responseStatus !== null && (
              <div className="response-meta">
                <span className={`status-pill status-code-${Math.floor(responseStatus / 100)}xx`}>
                  Status: {responseStatus}
                </span>
                {responseTime !== null && <span className="time-pill">Time: {responseTime} ms</span>}
              </div>
            )}
          </div>

          {errorMsg && <div className="card card-error"><strong>Error:</strong> {errorMsg}</div>}

          {responseBody && (
            <div className="code-viewer">
              <div className="code-viewer-title">JSON Payload Response:</div>
              <pre>{responseBody}</pre>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
