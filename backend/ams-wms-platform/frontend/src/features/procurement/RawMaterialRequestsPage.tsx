import { useEffect, useState } from 'react'
import { MaterialRequest, procurementApi } from '../../shared/procurementApi'
import ViewRequestModal from './ViewRequestModal'
import CreateRFQModal from './CreateRFQModal'
import CreateMaterialRequestModal from './CreateMaterialRequestModal'
import QuotationComparisonModal from './QuotationComparisonModal'
import ResubmitPOModal from './ResubmitPOModal'

export default function RawMaterialRequestsPage() {
  const [requests, setRequests] = useState<MaterialRequest[]>([])
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters & Search
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL')
  const [searchQuery, setSearchQuery] = useState<string>('')

  // Modals
  const [viewingRequest, setViewingRequest] = useState<MaterialRequest | null>(null)
  const [rfqTargetRequest, setRfqTargetRequest] = useState<MaterialRequest | null>(null)
  const [comparisonTargetRfq, setComparisonTargetRfq] = useState<any | null>(null)
  const [showCreateRequestModal, setShowCreateRequestModal] = useState(false)
  const [resubmitTargetPo, setResubmitTargetPo] = useState<any | null>(null)

  // Toast / Alert banner
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  async function loadData() {
    setLoading(true)
    setError(null)
    try {
      const data = await procurementApi.listMaterialRequests(statusFilter)
      setRequests(data)
      const poList = await procurementApi.listPurchaseOrders()
      setPurchaseOrders(poList)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load raw material requests')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [statusFilter])

  function handleRfqSuccess(rfqNumber: string) {
    setToastMessage(`🎉 RFQ ${rfqNumber} successfully created & email invitations dispatched!`)
    setTimeout(() => setToastMessage(null), 6000)
    loadData()
  }

  function handleResubmitSuccess(poNumber: string) {
    setToastMessage(`🚀 PO ${poNumber} modified & successfully resubmitted to Finance for re-approval!`)
    setTimeout(() => setToastMessage(null), 6000)
    loadData()
  }

  const filteredRequests = requests.filter((req) => {
    if (priorityFilter !== 'ALL' && req.priority !== priorityFilter) return false
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase()
      const reqNumMatch = req.request_number.toLowerCase().includes(q)
      const reqByMatch = req.requested_by.toLowerCase().includes(q)
      const whMatch = req.warehouse_id.toLowerCase().includes(q)
      const matMatch = req.items.some(
        (i) => i.material_code.toLowerCase().includes(q) || i.material_name.toLowerCase().includes(q)
      )
      if (!reqNumMatch && !reqByMatch && !whMatch && !matMatch) return false
    }
    return true
  })

  // Rejected PO list requiring procurement review
  const rejectedPOs = purchaseOrders.filter((p) => p.status === 'REJECTED')

  return (
    <div className="page procurement-page">
      {/* Page Header */}
      <div className="page-header-row">
        <div>
          <div className="breadcrumb">Procurement &nbsp;/&nbsp; Requisitions</div>
          <h1>Raw Material Requests</h1>
          <p className="page-subtitle">
            Manage warehouse raw material requisitions, inspect items, and issue RFQs to suppliers.
          </p>
        </div>
        <div className="header-actions">
          <button className="btn-secondary" onClick={loadData} title="Refresh catalog">
            ↻ Refresh
          </button>
          <button className="btn-primary" onClick={() => setShowCreateRequestModal(true)}>
            + New Material Request
          </button>
        </div>
      </div>

      {toastMessage && (
        <div className="toast-banner">
          {toastMessage}
        </div>
      )}

      {/* Finance Rejection Alert Banner for Procurement Officers */}
      {rejectedPOs.length > 0 && (
        <div
          style={{
            background: '#fff1f2',
            border: '1px solid #fecdd3',
            borderRadius: '12px',
            padding: '16px 20px',
            marginBottom: '24px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#be123c', fontWeight: 800, fontSize: '14px' }}>
              <span>⚠️</span> REJECTED PURCHASE ORDERS REQUIRE PROCUREMENT ACTION ({rejectedPOs.length})
            </div>
            <span style={{ fontSize: '12px', color: '#9f1239' }}>Workflow: Review Feedback ➔ Modify Supplier / Price / Qty ➔ Resubmit to Finance</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {rejectedPOs.map((po) => (
              <div
                key={po.id}
                style={{
                  background: 'white',
                  border: '1px solid #ffe4e6',
                  borderRadius: '8px',
                  padding: '12px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '12px',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span className="req-number-badge">{po.po_number}</span>
                    <strong style={{ fontSize: '13px', color: '#0f172a' }}>{po.supplier_info?.supplier_name || 'Supplier'}</strong>
                    <span className="wh-badge">{po.warehouse_id}</span>
                  </div>
                  <div style={{ fontSize: '12px', color: '#9f1239', marginTop: '4px', fontWeight: 600 }}>
                    Rejection Feedback: "{po.rejection_reason || 'Budget threshold exceeded.'}"
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setResubmitTargetPo(po)}
                  style={{
                    background: '#0284c7',
                    color: 'white',
                    border: '1px solid #0369a1',
                    padding: '8px 16px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  🔄 Review Rejection & Resubmit ➔
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="filter-card">
        <div className="search-bar">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            placeholder="Search by Request #, Material Code, Name, or Requested By..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button className="clear-search" onClick={() => setSearchQuery('')}>&times;</button>
          )}
        </div>

        <div className="filter-controls">
          <div className="filter-group">
            <span className="filter-label">Status:</span>
            <div className="filter-tabs">
              {['ALL', 'SUBMITTED', 'APPROVED', 'IN_RFQ', 'FULFILLED'].map((st) => (
                <button
                  key={st}
                  className={`tab-chip ${statusFilter === st ? 'active' : ''}`}
                  onClick={() => setStatusFilter(st)}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          <div className="filter-group">
            <span className="filter-label">Priority:</span>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="select-sm"
            >
              <option value="ALL">All Priorities</option>
              <option value="CRITICAL">CRITICAL</option>
              <option value="HIGH">HIGH</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="LOW">LOW</option>
            </select>
          </div>
        </div>
      </div>

      {/* Requests Data Table */}
      <div className="card table-card">
        {error && <div className="card-error">{error}</div>}

        {loading ? (
          <div className="loading-container">
            <div className="spinner"></div>
            <div>Loading Raw Material Requests…</div>
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📦</div>
            <h3>No Requisitions Found</h3>
            <p>No material requests match your filters. Try clearing filters or create a new request.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Request #</th>
                  <th>Warehouse</th>
                  <th>Department</th>
                  <th>Requested By</th>
                  <th>Target Date</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th className="text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredRequests.map((req) => (
                  <tr key={req.id} className="table-row-hover">
                    <td>
                      <span className="req-number-badge">{req.request_number}</span>
                    </td>
                    <td><span className="wh-badge">{req.warehouse_id}</span></td>
                    <td>{req.department}</td>
                    <td>
                      <div className="user-info">
                        <span className="user-name">{req.requested_by}</span>
                      </div>
                    </td>
                    <td>
                      <span className="date-tag">{req.target_delivery_date}</span>
                    </td>
                    <td>
                      <span className={`priority-pill priority-${req.priority.toLowerCase()}`}>
                        {req.priority}
                      </span>
                    </td>
                    <td>
                      <span className={`status-pill status-${req.status.toLowerCase()}`}>
                        {req.status}
                      </span>
                    </td>
                    <td className="text-center">
                      <div className="action-buttons">
                        <button
                          className="btn-action btn-view"
                          onClick={() => setViewingRequest(req)}
                        >
                          👁️ View
                        </button>
                        <button
                          className={`btn-action btn-rfq ${
                            req.status === 'APPROVED' ? '' : 'disabled'
                          }`}
                          disabled={req.status !== 'APPROVED'}
                          onClick={() => {
                            if (req.status === 'APPROVED') {
                              setRfqTargetRequest(req)
                            }
                          }}
                          title={
                            req.status === 'APPROVED'
                              ? 'Issue RFQ to Suppliers'
                              : 'Request must be APPROVED before issuing RFQ'
                          }
                        >
                          ⚡ Create RFQ
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modals */}
      {viewingRequest && (
        <ViewRequestModal
          request={viewingRequest}
          onClose={() => setViewingRequest(null)}
          onCreateRFQ={(req) => {
            setViewingRequest(null)
            setRfqTargetRequest(req)
          }}
        />
      )}

      {rfqTargetRequest && (
        <CreateRFQModal
          request={rfqTargetRequest}
          onClose={() => setRfqTargetRequest(null)}
          onSuccess={handleRfqSuccess}
        />
      )}

      {showCreateRequestModal && (
        <CreateMaterialRequestModal
          onClose={() => setShowCreateRequestModal(false)}
          onSuccess={() => {
            setToastMessage('✅ New Raw Material Request successfully created!')
            setTimeout(() => setToastMessage(null), 6000)
            loadData()
          }}
        />
      )}

      {comparisonTargetRfq && (
        <QuotationComparisonModal
          rfq={comparisonTargetRfq}
          onClose={() => setComparisonTargetRfq(null)}
          onSelectSupplierSuccess={(suppName) => {
            setToastMessage(`🎉 Supplier ${suppName} selected & PO proposal submitted for Finance Approval!`)
            setTimeout(() => setToastMessage(null), 6000)
            loadData()
          }}
        />
      )}

      {resubmitTargetPo && (
        <ResubmitPOModal
          po={resubmitTargetPo}
          onClose={() => setResubmitTargetPo(null)}
          onSuccess={handleResubmitSuccess}
        />
      )}
    </div>
  )
}
