import { useState } from 'react'
import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import FinanceApprovalPage from './features/finance/FinanceApprovalPage'
import SupplierPortalPage from './features/supplier/SupplierPortalPage'
import SupplierPortalASNPage from './features/supplier/SupplierPortalASNPage'
import RawMaterialRequestsPage from './features/procurement/RawMaterialRequestsPage'
import ReceivingPage from './features/receiving/ReceivingPage'
import ReturnsPage from './features/returns/ReturnsPage'
import DashboardPage from './features/dashboard/DashboardPage'
import AdminPage from './features/admin/AdminPage'
import LoginPage from './features/auth/LoginPage'
import BackendTesterPage from './features/backend-tester/BackendTesterPage'
import { authClient } from './shared/authClient'

export default function App() {
  const [authed, setAuthed] = useState(authClient.isAuthenticated())

  if (!authed) {
    return <LoginPage onLoggedIn={() => setAuthed(true)} />
  }

  async function handleLogout() {
    await authClient.logout()
    setAuthed(false)
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <span className="app-title">AMS / WMS Platform</span>
        <nav className="app-nav">
          <NavLink to="/procurement/requests">📦 Raw Material Requests</NavLink>
          <NavLink to="/finance/approvals">💳 Finance Approvals</NavLink>
          <NavLink to="/supplier/portal">🌐 Supplier Portal</NavLink>
          <NavLink to="/supplier/asn">🚚 Page 3 — ASN</NavLink>
          <NavLink to="/receiving">Receiving</NavLink>
          <NavLink to="/returns">Returns</NavLink>
          <NavLink to="/dashboard">Dashboard</NavLink>
          <NavLink to="/admin">Admin</NavLink>
          <NavLink to="/">⚡ Backend Tester</NavLink>
          <button className="link-button" onClick={handleLogout}>Sign out</button>
        </nav>
      </header>
      <main className="app-main">
        <Routes>
          <Route path="/procurement/requests" element={<RawMaterialRequestsPage />} />
          <Route path="/finance/approvals" element={<FinanceApprovalPage />} />
          <Route path="/supplier/portal" element={<SupplierPortalPage />} />
          <Route path="/supplier/asn" element={<SupplierPortalASNPage />} />
          <Route path="/supplier/quotation/new" element={<SupplierPortalPage />} />
          <Route path="/" element={<RawMaterialRequestsPage />} />
          <Route path="/receiving" element={<ReceivingPage />} />
          <Route path="/returns" element={<ReturnsPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/tester" element={<BackendTesterPage />} />
          <Route path="*" element={<Navigate to="/procurement/requests" replace />} />
        </Routes>
      </main>
    </div>
  )
}
