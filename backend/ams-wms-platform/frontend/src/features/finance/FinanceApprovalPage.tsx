import { useEffect, useState } from 'react'
import { procurementApi } from '../../shared/procurementApi'
import SendPOToSupplierModal from '../procurement/SendPOToSupplierModal'
import PurchaseOrderViewModal from '../procurement/PurchaseOrderViewModal'

export default function FinanceApprovalPage() {
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters & Search
  const [statusFilter, setStatusFilter] = useState<string>('PENDING_APPROVAL')
  const [searchQuery, setSearchQuery] = useState<string>('')

  // Selected PO for Detailed Finance Review
  const [selectedPo, setSelectedPo] = useState<any | null>(null)
  const [sendTargetPo, setSendTargetPo] = useState<any | null>(null)
  const [viewTargetPo, setViewTargetPo] = useState<any | null>(null)

  // Rejection Modal state
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [rejectionReason, setRejectionReason] = useState(
    'Budget exceeded for this purchase.'
  )
  const [rejectionError, setRejectionError] = useState<string | null>(null)
  const [submittingAction, setSubmittingAction] = useState(false)

  // Feedback Notification Toast
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  async function loadData() {
    setLoading(true)
    setError(null)
    try {
      const list = await procurementApi.listPurchaseOrders()
      setPurchaseOrders(list)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load Purchase Orders for Finance Approval')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  async function handleApprovePO(poId: string, poNum: string) {
    setSubmittingAction(true)
    try {
      await procurementApi.approvePurchaseOrder(poId, 'Approved by Finance Director. PO Released & Sent to Supplier.')
      
      // Update local history
      if (selectedPo && selectedPo.id === poId) {
        if (!selectedPo.approval_history) selectedPo.approval_history = []
        selectedPo.approval_history.push({
          id: `hist-${Date.now()}`,
          action: 'APPROVED',
          actor_name: 'Finance Director',
          actor_role: 'Finance',
          timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
          notes: 'Finance Approved → Purchase Order Created → PO Number Generated → PO Released → PO Sent to Supplier',
        })
      }

      const target = selectedPo
      setSelectedPo(null)
      loadData()
      if (target) {
        setSendTargetPo(target)
      } else {
        setToastMessage({
          type: 'success',
          text: `✅ Finance Approved! Purchase Order ${poNum} Released. (Format: PO-YYYY-XXXX)`,
        })
        setTimeout(() => setToastMessage(null), 6000)
      }
    } catch (err) {
      setToastMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to approve Purchase Order',
      })
    } finally {
      setSubmittingAction(false)
    }
  }

  async function handleRejectPOSubmit() {
    if (!rejectionReason || !rejectionReason.trim()) {
      setRejectionError('Rejection reason is mandatory. Do not allow rejection without a valid reason.')
      return
    }

    setSubmittingAction(true)
    setRejectionError(null)

    try {
      await procurementApi.rejectPurchaseOrder(selectedPo.id, rejectionReason.trim())

      if (selectedPo) {
        if (!selectedPo.approval_history) selectedPo.approval_history = []
        selectedPo.approval_history.push({
          id: `hist-${Date.now()}`,
          action: 'REJECTED',
          actor_name: 'Finance Director',
          actor_role: 'Finance',
          timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
          notes: rejectionReason.trim(),
        })
      }

      setToastMessage({
        type: 'success',
        text: `❌ Purchase Order ${selectedPo.po_number} PERMANENTLY REJECTED with reason: "${rejectionReason.trim()}". This order is now closed and cannot be resubmitted.`,
      })
      setTimeout(() => setToastMessage(null), 6000)
      setShowRejectModal(false)
      setSelectedPo(null)
      loadData()
    } catch (err) {
      setRejectionError(err instanceof Error ? err.message : 'Failed to reject Purchase Order')
    } finally {
      setSubmittingAction(false)
    }
  }

  const filteredOrders = purchaseOrders.filter((po) => {
    if (statusFilter !== 'ALL' && po.status !== statusFilter) return false
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase()
      const matchPo = po.po_number?.toLowerCase().includes(q)
      const matchSupp = po.supplier_info?.supplier_name?.toLowerCase().includes(q)
      const matchWh = po.warehouse_id?.toLowerCase().includes(q)
      const matchBuyer = po.buyer?.toLowerCase().includes(q)
      if (!matchPo && !matchSupp && !matchWh && !matchBuyer) return false
    }
    return true
  })

  // Summary Metrics
  const pendingCount = purchaseOrders.filter((p) => p.status === 'PENDING_APPROVAL').length
  const approvedCount = purchaseOrders.filter((p) => p.status === 'APPROVED').length
  const rejectedCount = purchaseOrders.filter((p) => p.status === 'REJECTED').length
  const totalPendingValue = purchaseOrders
    .filter((p) => p.status === 'PENDING_APPROVAL')
    .reduce((sum, p) => sum + Number(p.grand_total || p.financial_summary?.grand_total || p.order_summary?.total_amount || 0), 0)

  return (
    <div className="page finance-approval-page">
      {/* Header */}
      <div className="page-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
        <div>
          <div className="breadcrumb" style={{ color: '#059669', fontSize: '13px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Finance Governance &nbsp;/&nbsp; Approvals & Release
          </div>
          <h1 style={{ fontSize: '28px', fontWeight: 800, color: '#0f172a', margin: '4px 0 8px 0' }}>
            PAGE 2 — FINANCE APPROVAL
          </h1>
          <p className="page-subtitle" style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>
            Receive and review purchase order approval requests. Audit material details, financial breakdowns, and supporting quotation documents before authorizing expenditure.
          </p>
        </div>
        <button className="btn-secondary" onClick={loadData} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          <span>↻</span> Refresh Queue
        </button>
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div
          style={{
            padding: '12px 18px',
            borderRadius: '8px',
            marginBottom: '20px',
            fontWeight: 600,
            fontSize: '14px',
            background: toastMessage.type === 'success' ? '#dcfce7' : '#fee2e2',
            color: toastMessage.type === 'success' ? '#14532d' : '#7f1d1d',
            border: `1px solid ${toastMessage.type === 'success' ? '#86efac' : '#fca5a5'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span>{toastMessage.text}</span>
          <button
            onClick={() => setToastMessage(null)}
            style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: '16px' }}
          >
            &times;
          </button>
        </div>
      )}

      {/* Overview Stat Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px',
          marginBottom: '24px',
        }}
      >
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Pending Approvals</div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#d97706', marginTop: '4px' }}>{pendingCount} POs</div>
          <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>Awaiting Finance sign-off</div>
        </div>

        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Pending Commitment Value</div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#059669', marginTop: '4px' }}>
            ${totalPendingValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>Total pending commitment</div>
        </div>

        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Approved & Released</div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#16a34a', marginTop: '4px' }}>{approvedCount} POs</div>
          <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>Dispatched to Supplier</div>
        </div>

        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Rejected POs</div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#dc2626', marginTop: '4px' }}>{rejectedCount} POs</div>
          <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>Permanently Closed</div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="filter-card" style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="search-bar" style={{ flex: '1', minWidth: '280px', position: 'relative' }}>
            <input
              type="text"
              placeholder="Search by PO #, Supplier, Warehouse, or Officer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '14px',
              }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#64748b' }}>Filter Status:</span>
            <div style={{ display: 'flex', gap: '4px', background: '#f1f5f9', padding: '4px', borderRadius: '8px' }}>
              {[
                { id: 'PENDING_APPROVAL', label: 'Pending Approval' },
                { id: 'APPROVED', label: 'Approved' },
                { id: 'REJECTED', label: 'Rejected' },
                { id: 'ALL', label: 'All POs' },
              ].map((st) => (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => setStatusFilter(st.id)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 600,
                    border: 'none',
                    cursor: 'pointer',
                    background: statusFilter === st.id ? '#0f172a' : 'transparent',
                    color: statusFilter === st.id ? 'white' : '#475569',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {st.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Received Purchase Orders Requests Table */}
      <div className="card table-card" style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
        {error && <div className="card-error" style={{ padding: '16px', color: '#991b1b', background: '#fef2f2' }}>{error}</div>}

        {loading ? (
          <div style={{ padding: '48px', textAlign: 'center', color: '#64748b' }}>
            <div className="spinner" style={{ margin: '0 auto 12px auto' }}></div>
            <div>Loading received PO Approval requests...</div>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div style={{ padding: '48px 24px', textAlign: 'center', color: '#64748b' }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>💳</div>
            <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#1e293b', margin: '0 0 6px 0' }}>
              No Purchase Orders Found
            </h3>
            <p style={{ fontSize: '14px', margin: 0 }}>
              No PO requests match the selected filter status standard ({statusFilter}).
            </p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', textTransform: 'uppercase', fontSize: '11px', color: '#475569' }}>
                  <th style={{ textAlign: 'left', padding: '14px 16px' }}>PO Number</th>
                  <th style={{ textAlign: 'left', padding: '14px 16px' }}>PO Date</th>
                  <th style={{ textAlign: 'left', padding: '14px 16px' }}>Supplier</th>
                  <th style={{ textAlign: 'left', padding: '14px 16px' }}>Warehouse</th>
                  <th style={{ textAlign: 'left', padding: '14px 16px' }}>Procurement Officer</th>
                  <th style={{ textAlign: 'left', padding: '14px 16px' }}>Expected Delivery</th>
                  <th style={{ textAlign: 'right', padding: '14px 16px' }}>Grand Total</th>
                  <th style={{ textAlign: 'center', padding: '14px 16px' }}>Status</th>
                  <th style={{ textAlign: 'center', padding: '14px 16px' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((po) => {
                  const suppName = po.supplier_info?.supplier_name || 'Vertex Metals Corp'
                  const buyer = po.buyer || 'John Buyer (Procurement Lead)'
                  const total = po.grand_total || po.financial_summary?.grand_total || po.order_summary?.total_amount || 989.48

                  return (
                    <tr key={po.id} className="table-row-hover" style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '14px 16px' }}>
                        <span className="req-number-badge">{po.po_number}</span>
                      </td>
                      <td style={{ padding: '14px 16px', fontSize: '13px', color: '#334155' }}>
                        {po.po_date || '2026-08-12'}
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <strong style={{ fontSize: '13px', color: '#0f172a' }}>{suppName}</strong>
                          <span style={{ fontSize: '11px', color: '#64748b' }}>{po.supplier_info?.supplier_code || po.supplier_id}</span>
                        </div>
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <span className="wh-badge">{po.warehouse_id}</span>
                      </td>
                      <td style={{ padding: '14px 16px', fontSize: '13px', color: '#334155' }}>
                        {buyer}
                      </td>
                      <td style={{ padding: '14px 16px', fontSize: '13px', color: '#0f172a', fontWeight: 600 }}>
                        {po.expected_delivery_date || '2026-08-25'}
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 700, color: '#0f172a', fontSize: '14px' }}>
                        ${Number(total).toFixed(2)}
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '4px 10px',
                            borderRadius: '12px',
                            fontSize: '11px',
                            fontWeight: 800,
                            textTransform: 'uppercase',
                            background:
                              po.status === 'APPROVED'
                                ? '#dcfce7'
                                : (po.status === 'REJECTED' || po.status === 'FINANCE_REJECTED')
                                ? '#fee2e2'
                                : (po.status === 'SHIPPED' || po.status === 'IN_TRANSIT')
                                ? '#ccfbf1'
                                : '#fef3c7',
                            color:
                              po.status === 'APPROVED'
                                ? '#166534'
                                : (po.status === 'REJECTED' || po.status === 'FINANCE_REJECTED')
                                ? '#991b1b'
                                : (po.status === 'SHIPPED' || po.status === 'IN_TRANSIT')
                                ? '#0d9488'
                                : '#92400e',
                          }}
                        >
                          {po.status}
                        </span>
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                        <button
                          type="button"
                          className="btn-action"
                          onClick={() => setSelectedPo(po)}
                          style={{
                            background: '#059669',
                            color: 'white',
                            border: '1px solid #047857',
                            padding: '6px 14px',
                            borderRadius: '6px',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          🔍 Inspect & Review
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detailed PO Finance Approval Modal */}
      {selectedPo && (
        <div className="modal-backdrop" style={{ zIndex: 1000 }}>
          <div className="modal-content large-modal" style={{ maxWidth: '1020px', maxHeight: '92vh', overflowY: 'auto' }}>
            {/* Modal Header */}
            <div className="modal-header" style={{ background: '#0f172a', color: 'white', padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', color: '#34d399', marginBottom: '2px' }}>
                  Finance Approval Request — Governance Portal
                </div>
                <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 800 }}>
                  Purchase Order Approval — {selectedPo.po_number}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPo(null)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '24px', cursor: 'pointer' }}
              >
                &times;
              </button>
            </div>

            <div className="modal-body" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '28px' }}>
              
              {/* FINANCE APPROVAL WORKFLOW PROGRESS TRACKER */}
              <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '12px', padding: '16px 20px', marginBottom: '-8px' }}>
                <div style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: '#059669', letterSpacing: '0.5px', marginBottom: '10px' }}>
                  Finance Approval Pipeline Workflow
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: 700 }}>
                    <span style={{ background: '#dcfce7', color: '#166534', padding: '4px 10px', borderRadius: '6px', border: '1px solid #86efac' }}>1. Finance Approved</span>
                    <span style={{ color: '#94a3b8' }}>➔</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: 700 }}>
                    <span style={{ background: '#e0f2fe', color: '#0369a1', padding: '4px 10px', borderRadius: '6px', border: '1px solid #bae6fd' }}>2. Purchase Order Created</span>
                    <span style={{ color: '#94a3b8' }}>➔</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: 700 }}>
                    <span style={{ background: '#f0f9ff', color: '#0284c7', padding: '4px 10px', borderRadius: '6px', border: '1px solid #bae6fd', fontFamily: 'monospace' }}>3. PO Number Format ({selectedPo.po_number || 'PO-2026-0001'})</span>
                    <span style={{ color: '#94a3b8' }}>➔</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: 700 }}>
                    <span style={{ background: '#f1f5f9', color: '#334155', padding: '4px 10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>4. PO Released</span>
                    <span style={{ color: '#94a3b8' }}>➔</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: 700 }}>
                    <span style={{ background: '#dcfce7', color: '#15803d', padding: '4px 10px', borderRadius: '6px', border: '1px solid #86efac' }}>5. PO Sent to Supplier</span>
                  </div>
                </div>
              </div>

              {/* SECTION 1: PO INFORMATION */}
              <section>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '2px solid #059669', paddingBottom: '8px', marginBottom: '16px' }}>
                  <span style={{ background: '#059669', color: 'white', width: '24px', height: '24px', borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 800 }}>1</span>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>PO Information</h3>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                    gap: '16px',
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '10px',
                    padding: '16px',
                  }}
                >
                  <div>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', display: 'block' }}>PO Number (PO-YYYY-XXXX)</span>
                    <strong style={{ fontSize: '15px', color: '#0284c7', fontFamily: 'monospace' }}>{selectedPo.po_number}</strong>
                  </div>

                  <div>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', display: 'block' }}>PO Date</span>
                    <strong style={{ fontSize: '14px', color: '#0f172a' }}>{selectedPo.po_date || '2026-08-12'}</strong>
                  </div>

                  <div style={{ gridColumn: '1 / -1', background: 'white', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '12px 16px', marginTop: '6px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 800, color: '#0284c7', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.5px' }}>
                      Supplier Master Information (Auto-Fetched)
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', fontSize: '12px' }}>
                      <div><span style={{ color: '#64748b' }}>Supplier Code:</span> <strong style={{ color: '#0f172a' }}>{selectedPo.supplier_info?.supplier_code || 'SUPP-VERTEX'}</strong></div>
                      <div><span style={{ color: '#64748b' }}>Supplier Name:</span> <strong style={{ color: '#0f172a' }}>{selectedPo.supplier_info?.supplier_name || 'Vertex Metals Corp'}</strong></div>
                      <div><span style={{ color: '#64748b' }}>Contact Person:</span> <strong style={{ color: '#0f172a' }}>{selectedPo.supplier_info?.contact_person || 'David Wallace'}</strong></div>
                      <div><span style={{ color: '#64748b' }}>Phone:</span> <strong style={{ color: '#0f172a' }}>{selectedPo.supplier_info?.phone || '+1 555 0192'}</strong></div>
                      <div><span style={{ color: '#64748b' }}>Email:</span> <strong style={{ color: '#0284c7' }}>{selectedPo.supplier_info?.email || 'sales@vertexmetals.com'}</strong></div>
                      <div><span style={{ color: '#64748b' }}>GST Number:</span> <strong style={{ color: '#0f172a', fontFamily: 'monospace' }}>{selectedPo.supplier_info?.gst_number || 'GSTIN29ABCDE1234F'}</strong></div>
                      <div style={{ gridColumn: '1 / -1' }}><span style={{ color: '#64748b' }}>Supplier Address:</span> <strong style={{ color: '#334155' }}>📍 {selectedPo.supplier_info?.supplier_address || '100 Industrial Parkway, Midwest Logistics Hub, Chicago, IL 60601'}</strong></div>
                    </div>
                  </div>

                  <div>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', display: 'block' }}>Warehouse</span>
                    <strong style={{ fontSize: '14px', color: '#0f172a' }}>{selectedPo.warehouse_id}</strong>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>{selectedPo.department || 'Production Operations'}</div>
                  </div>

                  <div>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', display: 'block' }}>Procurement Officer</span>
                    <strong style={{ fontSize: '14px', color: '#0f172a' }}>
                      {selectedPo.buyer || 'John Buyer (Procurement Lead)'}
                    </strong>
                  </div>

                  <div>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', display: 'block' }}>Expected Delivery Date</span>
                    <strong style={{ fontSize: '14px', color: '#059669', background: '#dcfce7', padding: '2px 8px', borderRadius: '4px', display: 'inline-block' }}>
                      {selectedPo.expected_delivery_date || '2026-08-25'}
                    </strong>
                  </div>
                </div>
              </section>

              {/* SECTION 2: MATERIAL DETAILS */}
              <section>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '2px solid #059669', paddingBottom: '8px', marginBottom: '16px' }}>
                  <span style={{ background: '#059669', color: 'white', width: '24px', height: '24px', borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 800 }}>2</span>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>Material Details</h3>
                </div>

                <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #cbd5e1', color: '#475569', fontSize: '11px', textTransform: 'uppercase' }}>
                        <th style={{ textAlign: 'left', padding: '10px 14px' }}>Material</th>
                        <th style={{ textAlign: 'right', padding: '10px 14px' }}>Quantity</th>
                        <th style={{ textAlign: 'center', padding: '10px 14px' }}>UOM</th>
                        <th style={{ textAlign: 'right', padding: '10px 14px' }}>Unit Price</th>
                        <th style={{ textAlign: 'right', padding: '10px 14px' }}>Discount</th>
                        <th style={{ textAlign: 'right', padding: '10px 14px' }}>Tax</th>
                        <th style={{ textAlign: 'right', padding: '10px 14px' }}>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(
                        selectedPo.items || [
                          {
                            material_code: 'COPPER-ROD-01',
                            material_name: 'Copper Rod 10mm Heavy Duty',
                            quantity: 100,
                            unit_of_measure: 'KG',
                            unit_price: 8.20,
                            discount: 2.5,
                            tax: 5.0,
                            total_amount: 819.48,
                          },
                        ]
                      ).map((item: any, idx: number) => {
                        const qty = item.quantity || 100
                        const price = item.unit_price || 8.20
                        const disc = item.discount !== undefined ? item.discount : 2.5
                        const tax = item.tax !== undefined ? item.tax : 5.0
                        const sub = qty * price * (1 - disc / 100)
                        const lineTotal = item.total_amount || sub * (1 + tax / 100)

                        return (
                          <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '10px 14px' }}>
                              <strong style={{ color: '#0f172a', display: 'block' }}>{item.material_name}</strong>
                              <code style={{ fontSize: '11px', color: '#64748b', background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>
                                {item.material_code}
                              </code>
                            </td>
                            <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>
                              {qty.toLocaleString()}
                            </td>
                            <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                              <span style={{ background: '#e2e8f0', color: '#334155', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 700 }}>
                                {item.unit_of_measure || 'PCS'}
                              </span>
                            </td>
                            <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                              ${Number(price).toFixed(2)}
                            </td>
                            <td style={{ padding: '10px 14px', textAlign: 'right', color: '#059669', fontWeight: 600 }}>
                              {disc}%
                            </td>
                            <td style={{ padding: '10px 14px', textAlign: 'right', color: '#475569' }}>
                              {tax}%
                            </td>
                            <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>
                              ${Number(lineTotal).toFixed(2)}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* SECTION 3: FINANCIAL SUMMARY */}
              <section>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '2px solid #059669', paddingBottom: '8px', marginBottom: '16px' }}>
                  <span style={{ background: '#059669', color: 'white', width: '24px', height: '24px', borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 800 }}>3</span>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>Financial Summary</h3>
                </div>

                <div
                  style={{
                    background: '#ecfdf5',
                    border: '1px solid #a7f3d0',
                    borderRadius: '12px',
                    padding: '20px',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
                    gap: '16px',
                    alignItems: 'center',
                  }}
                >
                  <div style={{ borderRight: '1px solid #a7f3d0', paddingRight: '12px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#047857', textTransform: 'uppercase', display: 'block' }}>Subtotal</span>
                    <strong style={{ fontSize: '18px', color: '#064e3b' }}>
                      ${(selectedPo.financial_summary?.subtotal || selectedPo.order_summary?.subtotal || 820.00).toFixed(2)}
                    </strong>
                  </div>

                  <div style={{ borderRight: '1px solid #a7f3d0', paddingRight: '12px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#047857', textTransform: 'uppercase', display: 'block' }}>Discount</span>
                    <strong style={{ fontSize: '18px', color: '#16a34a' }}>
                      -${(selectedPo.financial_summary?.discount || 20.50).toFixed(2)}
                    </strong>
                  </div>

                  <div style={{ borderRight: '1px solid #a7f3d0', paddingRight: '12px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#047857', textTransform: 'uppercase', display: 'block' }}>Tax</span>
                    <strong style={{ fontSize: '18px', color: '#064e3b' }}>
                      +${(selectedPo.financial_summary?.tax || 39.98).toFixed(2)}
                    </strong>
                  </div>

                  <div style={{ borderRight: '1px solid #a7f3d0', paddingRight: '12px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#047857', textTransform: 'uppercase', display: 'block' }}>Freight</span>
                    <strong style={{ fontSize: '18px', color: '#064e3b' }}>
                      +${(selectedPo.financial_summary?.freight || 150.00).toFixed(2)}
                    </strong>
                  </div>

                  <div>
                    <span style={{ fontSize: '11px', fontWeight: 800, color: '#065f46', textTransform: 'uppercase', display: 'block' }}>Grand Total</span>
                    <strong style={{ fontSize: '22px', color: '#047857', fontWeight: 800 }}>
                      ${(selectedPo.grand_total || selectedPo.financial_summary?.grand_total || selectedPo.order_summary?.total_amount || 989.48).toFixed(2)}
                    </strong>
                  </div>
                </div>
              </section>

              {/* SECTION 4: SUPPORTING INFORMATION */}
              <section>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '2px solid #059669', paddingBottom: '8px', marginBottom: '16px' }}>
                  <span style={{ background: '#059669', color: 'white', width: '24px', height: '24px', borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 800 }}>4</span>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>Supporting Information</h3>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {/* Supplier Quotation */}
                  <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '14px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: '6px' }}>
                      Supplier Quotation
                    </div>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                      <span>📄 Ref #: <strong>{selectedPo.supporting_info?.supplier_quotation?.quotation_number || selectedPo.quotation_id || 'QUO-2026-001'}</strong></span>
                      <span>📅 Quote Date: <strong>{selectedPo.supporting_info?.supplier_quotation?.quotation_date || '2026-08-11'}</strong></span>
                      <span>💳 Payment Terms: <strong>{selectedPo.supporting_info?.supplier_quotation?.payment_terms || selectedPo.payment_terms || 'Net 30 Days upon delivery'}</strong></span>
                      <span>⏱️ Lead Time: <strong>{selectedPo.supporting_info?.supplier_quotation?.delivery_lead_time_days || 7} Days</strong></span>
                    </div>
                  </div>

                  {/* Uploaded Documents */}
                  <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '14px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: '8px' }}>
                      Uploaded Documents ({selectedPo.supporting_info?.uploaded_documents?.length || 3})
                    </div>
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                      {(
                        selectedPo.supporting_info?.uploaded_documents || [
                          { id: 'doc-1', name: 'Official_Quotation_QUO-2026-001.pdf', size: '1.2 MB', type: 'PDF' },
                          { id: 'doc-2', name: 'ISO_9001_Quality_Certificate.pdf', size: '850 KB', type: 'PDF' },
                          { id: 'doc-3', name: 'Commercial_Price_Breakdown_RFQ-2026-0001.xlsx', size: '420 KB', type: 'XLSX' },
                        ]
                      ).map((doc: any, i: number) => (
                        <div
                          key={i}
                          style={{
                            background: '#0f172a',
                            color: 'white',
                            borderRadius: '6px',
                            padding: '8px 12px',
                            fontSize: '12px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '8px',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                          }}
                        >
                          <span>{doc.type === 'PDF' ? '📕' : '📊'}</span>
                          <span>{doc.name}</span>
                          <span style={{ fontSize: '10px', color: '#94a3b8', background: 'rgba(255,255,255,0.1)', padding: '2px 4px', borderRadius: '4px' }}>
                            {doc.size}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Procurement Comments */}
                  <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '14px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: '6px' }}>
                      Procurement Comments
                    </div>
                    <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '12px', fontSize: '13px', color: '#334155', lineHeight: '1.5' }}>
                      {selectedPo.supporting_info?.procurement_comments ||
                        selectedPo.selection_reason ||
                        'Selected Vertex Metals Corp based on lowest total commercial bid, verified ISO 9001 compliance, and 7-day express delivery lead time.'}
                    </div>
                  </div>
                </div>
              </section>

              {/* SECTION 5: APPROVAL & GOVERNANCE AUDIT HISTORY */}
              <section>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '2px solid #059669', paddingBottom: '8px', marginBottom: '16px' }}>
                  <span style={{ background: '#059669', color: 'white', width: '24px', height: '24px', borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 800 }}>5</span>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>Approval Audit & History Log</h3>
                </div>

                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {(
                      selectedPo.approval_history || [
                        {
                          id: 'h1',
                          action: 'SUBMITTED',
                          actor_name: selectedPo.buyer || 'John Buyer',
                          actor_role: 'Procurement Officer',
                          timestamp: selectedPo.po_date || '2026-08-12 09:30',
                          notes: 'Initial PO proposal submitted to Finance for approval.',
                        },
                      ]
                    ).map((h: any, i: number) => (
                      <div
                        key={i}
                        style={{
                          display: 'flex',
                          gap: '12px',
                          alignItems: 'flex-start',
                          padding: '10px 14px',
                          borderRadius: '8px',
                          background:
                            h.action === 'APPROVED'
                              ? '#f0fdf4'
                              : h.action === 'REJECTED'
                              ? '#fff1f2'
                              : h.action === 'RESUBMITTED'
                              ? '#f0f9ff'
                              : 'white',
                          border: `1px solid ${
                            h.action === 'APPROVED'
                              ? '#bbf7d0'
                              : h.action === 'REJECTED'
                              ? '#fecdd3'
                              : h.action === 'RESUBMITTED'
                              ? '#bae6fd'
                              : '#e2e8f0'
                          }`,
                        }}
                      >
                        <div
                          style={{
                            fontSize: '16px',
                            lineHeight: '1',
                          }}
                        >
                          {h.action === 'APPROVED' ? '✅' : h.action === 'REJECTED' ? '❌' : h.action === 'RESUBMITTED' ? '🔄' : '📝'}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                            <strong style={{ fontSize: '13px', color: '#0f172a' }}>
                              {h.action} — {h.actor_name} ({h.actor_role})
                            </strong>
                            <span style={{ fontSize: '11px', color: '#64748b', fontFamily: 'monospace' }}>{h.timestamp}</span>
                          </div>
                          <div style={{ fontSize: '12px', color: '#334155' }}>{h.notes}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

            </div>

            {/* Modal Actions Footer: [Approve] [Reject] */}
            <div
              className="modal-footer"
              style={{
                background: '#f8fafc',
                borderTop: '1px solid #e2e8f0',
                padding: '16px 24px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setSelectedPo(null)}
                style={{ background: '#e2e8f0', color: '#334155', border: 'none', padding: '10px 18px', borderRadius: '8px', fontWeight: 600 }}
              >
                Close Inspection
              </button>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  type="button"
                  disabled={submittingAction}
                  onClick={() => {
                    setRejectionError(null)
                    setShowRejectModal(true)
                  }}
                  style={{
                    background: '#fee2e2',
                    color: '#991b1b',
                    border: '1px solid #fca5a5',
                    padding: '10px 20px',
                    borderRadius: '8px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontSize: '14px',
                  }}
                >
                  ❌ [Reject]
                </button>

                <button
                  type="button"
                  disabled={submittingAction}
                  onClick={() => handleApprovePO(selectedPo.id, selectedPo.po_number)}
                  style={{
                    background: '#059669',
                    color: 'white',
                    border: '1px solid #047857',
                    padding: '10px 24px',
                    borderRadius: '8px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontSize: '14px',
                    boxShadow: '0 2px 4px rgba(5, 150, 105, 0.2)',
                  }}
                >
                  {submittingAction ? 'Processing...' : '✅ [Approve & Release PO]'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mandatory Finance Rejection Modal */}
      {showRejectModal && selectedPo && (
        <div className="modal-backdrop" style={{ zIndex: 1100 }}>
          <div className="modal-content medium-modal" style={{ maxWidth: '600px' }}>
            <div className="modal-header" style={{ background: '#991b1b', color: 'white', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: '#fecaca' }}>
                  Finance PO Governance — Rejection
                </div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>
                  Reject PO {selectedPo.po_number}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowRejectModal(false)}
                style={{ background: 'transparent', border: 'none', color: '#fecaca', fontSize: '20px', cursor: 'pointer' }}
              >
                &times;
              </button>
            </div>

            <div className="modal-body" style={{ padding: '20px' }}>
              {rejectionError && (
                <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', color: '#991b1b', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', marginBottom: '14px', fontWeight: 600 }}>
                  {rejectionError}
                </div>
              )}

              <p style={{ fontSize: '13px', color: '#475569', marginTop: 0, marginBottom: '16px' }}>
                Please enter the rejection reason. A valid rejection reason is <strong>mandatory</strong> to permanently reject this PO. This action is final and the PO cannot be modified or resubmitted.
              </p>

              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155' }}>Rejection Reason *</label>
                <textarea
                  rows={4}
                  value={rejectionReason}
                  onChange={(e) => {
                    setRejectionReason(e.target.value)
                    if (e.target.value.trim()) setRejectionError(null)
                  }}
                  placeholder="Budget exceeded for this purchase. Please renegotiate pricing or split order."
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', fontFamily: 'inherit' }}
                  required
                />
                <span style={{ fontSize: '11px', color: '#64748b' }}>
                  Example: <em>"Budget exceeded for this purchase."</em>
                </span>
              </div>
            </div>

            <div className="modal-footer" style={{ background: '#f8fafc', padding: '14px 20px', display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid #e2e8f0' }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setShowRejectModal(false)}
                disabled={submittingAction}
                style={{ padding: '8px 16px', borderRadius: '6px', fontSize: '13px', fontWeight: 600 }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRejectPOSubmit}
                disabled={submittingAction || !rejectionReason.trim()}
                style={{
                  background: !rejectionReason.trim() ? '#94a3b8' : '#dc2626',
                  color: 'white',
                  border: 'none',
                  padding: '8px 20px',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: !rejectionReason.trim() ? 'not-allowed' : 'pointer',
                }}
              >
                {submittingAction ? 'Rejecting...' : 'Confirm PO Rejection ➔'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Send PO to Supplier Modal */}
      {sendTargetPo && (
        <SendPOToSupplierModal
          po={sendTargetPo}
          onClose={() => setSendTargetPo(null)}
          onSuccess={(poNum) => {
            setToastMessage({
              type: 'success',
              text: `✉️ Email dispatch for Purchase Order ${poNum} sent to supplier with PO PDF & [SUBMIT ASN] link!`,
            })
            setTimeout(() => setToastMessage(null), 6000)
            loadData()
          }}
        />
      )}

      {/* View Full PO Modal */}
      {viewTargetPo && (
        <PurchaseOrderViewModal
          po={viewTargetPo}
          onClose={() => setViewTargetPo(null)}
        />
      )}
    </div>
  )
}
