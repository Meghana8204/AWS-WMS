import { FormEvent, useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { procurementApi } from '../../shared/procurementApi'
import SupplierRFQResponseModal from './SupplierRFQResponseModal'

interface SupplierSession {
  username: string
  supplierName: string
  supplierCode: string
  supplierId: string
  mustChangePassword?: boolean
}

export default function SupplierPortalPage() {
  // Session State
  const [session, setSession] = useState<SupplierSession | null>(() => {
    const saved = localStorage.getItem('supplier_session')
    return saved ? JSON.parse(saved) : null
  })

  // Login Form State
  const [username, setUsername] = useState('supplier_supp_vertex')
  const [password, setPassword] = useState('TempPass9981!')
  const [loginError, setLoginError] = useState<string | null>(null)

  // Force Password Change Modal
  const [showPasswordChangeModal, setShowPasswordChangeModal] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordChangeSuccess, setPasswordChangeSuccess] = useState(false)

  // Portal Data State
  const [activeTab, setActiveTab] = useState<'DASHBOARD' | 'RFQS' | 'QUOTATIONS' | 'POS' | 'ASN'>('DASHBOARD')
  const [rfqs, setRfqs] = useState<any[]>([])
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  // Quotation Submission Modal State
  const [selectedRfq, setSelectedRfq] = useState<any | null>(null)
  const [unitPrice, setUnitPrice] = useState('8.20')
  const [availableQty, setAvailableQty] = useState('100')
  const [deliveryDays, setDeliveryDays] = useState('7')
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() + 10)
    return d.toISOString().split('T')[0]
  })
  const [taxPercent, setTaxPercent] = useState('5.0')
  const [freightCharges, setFreightCharges] = useState('150.00')
  const [paymentTerms, setPaymentTerms] = useState('Net 30 Days')
  const [validityDays, setValidityDays] = useState('30')
  const [additionalConditions, setAdditionalConditions] = useState('Price includes standard pallet packing & ISO quality certificates.')
  const [submittingQuote, setSubmittingQuote] = useState(false)

  // Toast / Alert banner
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  function handleLogin(e: FormEvent) {
    e.preventDefault()
    setLoginError(null)

    if (!username.trim() || !password.trim()) {
      setLoginError('Please enter both username and password.')
      return
    }

    // Mock secure supplier authentication mapping
    const isTempPassword = password.startsWith('TempPass') || password === 'TempPass9981!'
    const supplierCode = username.replace('supplier_', '').toUpperCase().replace('_', '-')
    
    const sess: SupplierSession = {
      username: username.trim(),
      supplierName: username.includes('vertex') ? 'Vertex Metals Corp' : 'Global Industrial Supplies Ltd',
      supplierCode: supplierCode || 'SUPP-VERTEX',
      supplierId: username.includes('vertex') ? 'supp-101' : 'supp-102',
      mustChangePassword: isTempPassword,
    }

    setSession(sess)
    localStorage.setItem('supplier_session', JSON.stringify(sess))

    if (isTempPassword) {
      setShowPasswordChangeModal(true)
    }
  }

  function handleLogout() {
    setSession(null)
    localStorage.removeItem('supplier_session')
  }

  function handlePasswordChangeSubmit(e: FormEvent) {
    e.preventDefault()
    if (newPassword.length < 6) {
      alert('Password must be at least 6 characters long.')
      return
    }
    if (newPassword !== confirmPassword) {
      alert('Passwords do not match.')
      return
    }

    if (session) {
      const updated = { ...session, mustChangePassword: false }
      setSession(updated)
      localStorage.setItem('supplier_session', JSON.stringify(updated))
    }

    setPasswordChangeSuccess(true)
    setShowPasswordChangeModal(false)
    setToastMessage('🔒 Password successfully updated! Credentials secured.')
    setTimeout(() => setToastMessage(null), 5000)
  }

  async function loadSupplierData() {
    if (!session) return
    setLoading(true)
    try {
      const allRfqs = await procurementApi.listRFQs()
      setRfqs(allRfqs)
      const allPos = await procurementApi.listPurchaseOrders()
      setPurchaseOrders(allPos)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (session) {
      loadSupplierData()
    }
  }, [session])

  async function handleQuotationSubmit(e: FormEvent) {
    e.preventDefault()
    if (!selectedRfq || !session) return

    setSubmittingQuote(true)
    try {
      await procurementApi.submitQuotation({
        rfq_id: selectedRfq.id,
        supplier_id: session.supplierId,
        supplier_code: session.supplierCode,
        supplier_name: session.supplierName,
        payment_terms: paymentTerms,
        remarks: `${additionalConditions} (Tax: ${taxPercent}%, Freight: $${freightCharges})`,
        items: selectedRfq.items.map((it: any) => ({
          material_code: it.material_code,
          material_name: it.material_name,
          offered_qty: parseFloat(availableQty) || it.quantity,
          unit_price: parseFloat(unitPrice) || 10.0,
          lead_time_days: parseInt(deliveryDays) || 7,
          unit_of_measure: it.unit_of_measure || 'PCS',
        })),
      })

      setToastMessage(`🎉 Quotation for RFQ ${selectedRfq.rfq_number} successfully submitted to Procurement!`)
      setTimeout(() => setToastMessage(null), 6000)
      setSelectedRfq(null)
      loadSupplierData()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to submit quotation')
    } finally {
      setSubmittingQuote(false)
    }
  }

  // Dashboard Metrics Calculation
  const rfqsReceivedCount = rfqs.length
  const rfqsPendingResponseCount = rfqs.filter((r) => r.status === 'PUBLISHED' || r.status === 'DRAFT').length
  const quotationsSubmittedCount = rfqs.filter((r) => r.status === 'QUOTATIONS_RECEIVED' || r.status === 'EVALUATED').length
  const purchaseOrdersCount = purchaseOrders.length
  const asnPendingCount = purchaseOrders.filter((po) => po.status === 'ISSUED' || po.status === 'APPROVED' || po.status === 'CONFIRMED').length

  // UNAUTHENTICATED SUPPLIER LOGIN VIEW
  if (!session) {
    return (
      <div className="modal-backdrop" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)' }}>
        <div className="modal-content medium-modal" style={{ boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
          <div className="modal-header" style={{ background: '#0284c7' }}>
            <div>
              <div className="badge-tag" style={{ color: '#e0f2fe' }}>AMS / WMS Supplier Portal</div>
              <h2>Supplier Login</h2>
            </div>
            <span style={{ fontSize: '24px' }}>🔐</span>
          </div>

          <form onSubmit={handleLogin}>
            <div className="modal-body">
              {loginError && <div className="card card-error">{loginError}</div>}

              <p className="sub-text" style={{ fontSize: '13px', marginBottom: '20px' }}>
                Welcome to the WMS Supplier Portal. Please sign in using the credentials provided in your RFQ invitation email.
              </p>

              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label>Username</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. supplier_vertex"
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label>Password / Temporary Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                />
              </div>

              <div className="card" style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>
                  🔑 Demo Supplier Credentials:
                </div>
                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                  • Username: <code>supplier_supp_vertex</code> | Password: <code>TempPass9981!</code><br />
                  • Username: <code>supplier_supp_global</code> | Password: <code>TempPass9981!</code>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button type="submit" className="btn-primary" style={{ width: '100%', background: '#0284c7' }}>
                Sign In to Supplier Portal ➔
              </button>
            </div>
          </form>
        </div>
      </div>
    )
  }

  // AUTHENTICATED SUPPLIER PORTAL DASHBOARD VIEW
  return (
    <div className="page procurement-page">
      {/* Portal Top Header */}
      <div className="page-header-row">
        <div>
          <div className="breadcrumb" style={{ color: '#0ea5e9' }}>Supplier Portal &nbsp;/&nbsp; Enterprise Dashboard</div>
          <h1>Welcome, {session.supplierName}</h1>
          <p className="page-subtitle">
            Supplier Code: <code>{session.supplierCode}</code> | Signed in as <strong>{session.username}</strong>
          </p>
        </div>
        <div className="header-actions">
          {session.mustChangePassword && (
            <button className="btn-secondary" style={{ borderColor: '#eab308', color: '#854d0e', background: '#fef9c3' }} onClick={() => setShowPasswordChangeModal(true)}>
              ⚠️ Change Password
            </button>
          )}
          <button className="btn-secondary" onClick={handleLogout}>
            Sign Out
          </button>
        </div>
      </div>

      {toastMessage && <div className="toast-banner">{toastMessage}</div>}

      {/* 5 Required Metric Cards for Supplier Dashboard */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px', marginBottom: '24px' }}>
        <div
          className={`card ${activeTab === 'RFQS' ? 'active-card' : ''}`}
          style={{ cursor: 'pointer', padding: '16px', borderTop: '4px solid #3b82f6' }}
          onClick={() => setActiveTab('RFQS')}
        >
          <div className="text-xs">RFQs Received</div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#1e3a8a', marginTop: '4px' }}>
            {rfqsReceivedCount}
          </div>
          <div className="sub-text" style={{ fontSize: '11px', marginTop: '4px' }}>Total invitations</div>
        </div>

        <div
          className={`card ${activeTab === 'RFQS' ? 'active-card' : ''}`}
          style={{ cursor: 'pointer', padding: '16px', borderTop: '4px solid #eab308' }}
          onClick={() => setActiveTab('RFQS')}
        >
          <div className="text-xs">RFQs Pending Response</div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#854d0e', marginTop: '4px' }}>
            {rfqsPendingResponseCount}
          </div>
          <div className="sub-text" style={{ fontSize: '11px', marginTop: '4px', color: '#d97706', fontWeight: 600 }}>Action Required</div>
        </div>

        <div
          className={`card ${activeTab === 'QUOTATIONS' ? 'active-card' : ''}`}
          style={{ cursor: 'pointer', padding: '16px', borderTop: '4px solid #10b981' }}
          onClick={() => setActiveTab('QUOTATIONS')}
        >
          <div className="text-xs">Quotations Submitted</div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#065f46', marginTop: '4px' }}>
            {quotationsSubmittedCount}
          </div>
          <div className="sub-text" style={{ fontSize: '11px', marginTop: '4px' }}>Submitted & under review</div>
        </div>

        <div
          className={`card ${activeTab === 'POS' ? 'active-card' : ''}`}
          style={{ cursor: 'pointer', padding: '16px', borderTop: '4px solid #6366f1' }}
          onClick={() => setActiveTab('POS')}
        >
          <div className="text-xs">Purchase Orders</div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#3730a3', marginTop: '4px' }}>
            {purchaseOrdersCount}
          </div>
          <div className="sub-text" style={{ fontSize: '11px', marginTop: '4px' }}>Confirmed PO contracts</div>
        </div>

        <div
          className={`card ${activeTab === 'ASN' ? 'active-card' : ''}`}
          style={{ cursor: 'pointer', padding: '16px', borderTop: '4px solid #ec4899' }}
          onClick={() => setActiveTab('ASN')}
        >
          <div className="text-xs">ASN Pending</div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#9d174d', marginTop: '4px' }}>
            {asnPendingCount}
          </div>
          <div className="sub-text" style={{ fontSize: '11px', marginTop: '4px', color: '#be185d', fontWeight: 600 }}>Ready for Dispatch</div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="filter-card">
        <div className="filter-tabs">
          <button className={`tab-chip ${activeTab === 'DASHBOARD' ? 'active' : ''}`} onClick={() => setActiveTab('DASHBOARD')}>
            📊 Dashboard Overview
          </button>
          <button className={`tab-chip ${activeTab === 'RFQS' ? 'active' : ''}`} onClick={() => setActiveTab('RFQS')}>
            📄 RFQs Received ({rfqsReceivedCount})
          </button>
          <button className={`tab-chip ${activeTab === 'QUOTATIONS' ? 'active' : ''}`} onClick={() => setActiveTab('QUOTATIONS')}>
            📝 Quotations Submitted ({quotationsSubmittedCount})
          </button>
          <button className={`tab-chip ${activeTab === 'POS' ? 'active' : ''}`} onClick={() => setActiveTab('POS')}>
            📜 Purchase Orders ({purchaseOrdersCount})
          </button>
          <button className={`tab-chip ${activeTab === 'ASN' ? 'active' : ''}`} onClick={() => setActiveTab('ASN')}>
            🚚 ASN Pending ({asnPendingCount})
          </button>
        </div>
      </div>

      {/* Main Content Area Based on Active Tab */}
      <div className="card table-card">
        {activeTab === 'DASHBOARD' && (
          <div style={{ padding: '24px' }}>
            <h3 className="section-heading" style={{ marginTop: 0 }}>Supplier Portal Status</h3>
            <p>Select a tab above to review active RFQs, submit quotations, or manage Advance Shipping Notices (ASN).</p>

            <h4 style={{ marginTop: '20px', marginBottom: '12px' }}>Action Items Needing Your Attention:</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {rfqsPendingResponseCount > 0 && (
                <div style={{ background: '#fefce8', border: '1px solid #fef08a', padding: '16px', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <strong style={{ color: '#854d0e' }}>⚠️ {rfqsPendingResponseCount} RFQ(s) Pending Quotation Submission</strong>
                    <div style={{ fontSize: '12px', color: '#a16207', marginTop: '2px' }}>Procurement is waiting for your pricing and lead time response.</div>
                  </div>
                  <button className="btn-primary" onClick={() => setActiveTab('RFQS')} style={{ background: '#d97706', borderColor: '#b45309' }}>
                    Submit Quotations Now ➔
                  </button>
                </div>
              )}

              {asnPendingCount > 0 && (
                <div style={{ background: '#fdf2f8', border: '1px solid #fbcfe8', padding: '16px', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <strong style={{ color: '#9d174d' }}>🚚 {asnPendingCount} Approved Purchase Order(s) Awaiting ASN Dispatch</strong>
                    <div style={{ fontSize: '12px', color: '#be185d', marginTop: '2px' }}>Generate Advance Shipping Notices prior to vehicle arrival at warehouse gate.</div>
                  </div>
                  <button className="btn-primary" onClick={() => setActiveTab('ASN')} style={{ background: '#db2777', borderColor: '#be185d' }}>
                    Create ASN ➔
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {(activeTab === 'RFQS' || activeTab === 'QUOTATIONS') && (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>RFQ Number</th>
                  <th>Title</th>
                  <th>Warehouse</th>
                  <th>Due Date</th>
                  <th>Status</th>
                  <th className="text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {rfqs.map((rfq) => (
                  <tr key={rfq.id}>
                    <td><span className="req-number-badge">{rfq.rfq_number}</span></td>
                    <td><strong>{rfq.title}</strong></td>
                    <td><span className="wh-badge">{rfq.warehouse_id}</span></td>
                    <td><span className="date-tag">{rfq.due_date}</span></td>
                    <td><span className={`status-pill status-${rfq.status.toLowerCase()}`}>{rfq.status}</span></td>
                    <td className="text-center">
                      <button
                        className="btn-action btn-rfq"
                        onClick={() => setSelectedRfq(rfq)}
                        style={{ background: '#0284c7' }}
                      >
                        [SUBMIT QUOTATION]
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {(activeTab === 'POS' || activeTab === 'ASN') && (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>PO Number</th>
                  <th>PO Date</th>
                  <th>Warehouse</th>
                  <th>Expected Delivery</th>
                  <th>Total Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {purchaseOrders.map((po) => (
                  <tr key={po.id}>
                    <td><span className="req-number-badge">{po.po_number}</span></td>
                    <td>{po.po_date}</td>
                    <td><span className="wh-badge">{po.warehouse_id}</span></td>
                    <td><span className="date-tag">{po.expected_delivery_date}</span></td>
                    <td className="font-bold">${po.order_summary?.total_amount?.toFixed(2) || '0.00'}</td>
                    <td><span className={`status-pill status-${po.status.toLowerCase()}`}>{po.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Supplier RFQ Response / Submit Quotation Modal */}
      {selectedRfq && (
        <SupplierRFQResponseModal
          rfq={selectedRfq}
          supplier={{
            supplierId: session.supplierId,
            supplierCode: session.supplierCode,
            supplierName: session.supplierName,
            username: session.username,
          }}
          onClose={() => setSelectedRfq(null)}
          onSuccess={(isDraft) => {
            setToastMessage(
              isDraft
                ? `💾 Quotation for ${selectedRfq.rfq_number} saved as DRAFT.`
                : `🚀 Official Quotation for ${selectedRfq.rfq_number} successfully SUBMITTED & LOCKED!`
            )
            setTimeout(() => setToastMessage(null), 6000)
            setSelectedRfq(null)
            loadSupplierData()
          }}
        />
      )}

      {/* Force Password Change Modal */}
      {showPasswordChangeModal && (
        <div className="modal-backdrop">
          <div className="modal-content medium-modal">
            <div className="modal-header" style={{ background: '#d97706' }}>
              <div>
                <div className="badge-tag" style={{ color: '#fef3c7' }}>Security Mandate</div>
                <h2>Change Temporary Password</h2>
              </div>
            </div>

            <form onSubmit={handlePasswordChangeSubmit}>
              <div className="modal-body">
                <p className="sub-text">
                  You logged in with a temporary password. For security compliance, you must set a new secure password before proceeding.
                </p>

                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label>New Password</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Confirm New Password</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="submit" className="btn-primary" style={{ background: '#d97706' }}>
                  Update Password & Continue ➔
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
