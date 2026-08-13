import { FormEvent, useState } from 'react'
import { authClient } from '../../shared/authClient'

/**
 * Calls auth-service directly (POST /auth/login) - the only place in the
 * app that does. On success, the token is stored by authClient and every
 * subsequent business-service call picks it up automatically.
 */
export default function LoginPage({ onLoggedIn }: { onLoggedIn: () => void }) {
  const [username, setUsername] = useState('admin')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await authClient.login(username, password)
      onLoggedIn()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  function handleDevBypass() {
    // Set a dev token so isAuthenticated() returns true and user can explore backend
    localStorage.setItem('ams.accessToken', 'dev-mode-test-token')
    onLoggedIn()
  }

  return (
    <section className="page">
      <h1>Sign in</h1>
      <p className="page-subtitle">
        Calls <code>POST /auth/login</code> on auth-service (Port 8080). Seed user: <code>admin</code>.
      </p>
      <form className="card" onSubmit={handleSubmit}>
        <label>
          Username
          <input value={username} onChange={(e) => setUsername(e.target.value)} />
        </label>
        <label>
          Password
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
          <button type="submit" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
          <button type="button" className="btn-secondary" onClick={handleDevBypass}>
            ⚡ Test Backend Directly (Dev Mode)
          </button>
        </div>
      </form>
      {error && (
        <div className="card card-error">
          <p><strong>Login Failed:</strong> {error}</p>
          <p style={{ marginTop: '8px', fontSize: '13px' }}>
            If <code>auth-service</code> is not running on port 8080, click <strong>"Test Backend Directly (Dev Mode)"</strong> above to test FastAPI endpoints on <code>http://localhost:8000</code>.
          </p>
        </div>
      )}
    </section>
  )
}
