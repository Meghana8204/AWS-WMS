import { useEffect, useState } from 'react'
import { procurementApi } from '../../shared/procurementApi'
import CreateASNModal from './CreateASNModal'
import ViewASNModal from './ViewASNModal'

export default function SupplierPortalASNPage() {
  const [asns, setAsns] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters & Search
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [searchQuery, setSearchQuery] = useState<string>('')

  // Modal
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [viewingAsn, setViewingAsn] = useState<any | null>(null)

  // Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  async function loadData() {
    setLoading(true)
    setError(null)
    try {
      const list = await procurementApi.listASNs()
      setAsns(list)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load Advance Shipment Notices')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  function handleAsnCreated(asnNum: string) {
    setToastMessage(`🎉 Advance Shipment Notice ${asnNum} successfully submitted & dispatched to Receiving Gate!`)
    setTimeout(() => setToastMessage(null), 6000)
    loadData()
  }

  const filteredASNs = asns.filter((asn) => {
    if (statusFilter !== 'ALL' && asn.status !== statusFilter) return false
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase()
      const matchAsn = asn.asn_number?.toLowerCase().includes(q)
      const matchPo = asn.po_number?.toLowerCase().includes(q)
      const matchSupp = asn.supplier_name?.toLowerCase().includes(q)
      if (!matchAsn && !matchPo && !matchSupp) return false
    }
    return true
  })

  // Metrics
  const totalCount = asns.length
  const inTransitCount = asns.filter((a) => a.status === 'IN_TRANSIT' || a.status === 'SHIPPED').length
  const receivedCount = asns.filter((a) => a.status === 'RECEIVED').length

  return (
    <div className="page supplier-asn-page">
      {/* Header */}
      <div className="page-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
        <div>
          <div className="breadcrumb" style={{ color: '#10b981', fontSize: '13px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            PAGE 3 — SUPPLIER PORTAL &nbsp;/&nbsp; ADVANCE SHIPMENT NOTICE
          </div>
          <h1 style={{ fontSize: '28px', fontWeight: 800, color: '#0f172a', margin: '4px 0 8px 0' }}>
            PAGE 3 — ASN (Advance Shipment Notice)
          </h1>
          <p className="page-subtitle" style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>
            Logged in as <strong>Vertex Metals Corp (SUPP-VERTEX)</strong>. Create and submit Inbound Shipment Notices for approved Purchase Orders.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn-secondary" onClick={loadData} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            ↻ Refresh
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => setShowCreateModal(true)}
            style={{
              background: '#059669',
              color: 'white',
              border: '1px solid #047857',
              padding: '10px 20px',
              borderRadius: '8px',
              fontWeight: 800,
              cursor: 'pointer',
              fontSize: '14px',
              boxShadow: '0 2px 4px rgba(5, 150, 105, 0.2)',
            }}
          >
            + Create ASN
          </button>
        </div>
      </div>

      {toastMessage && (
        <div
          style={{
            padding: '12px 18px',
            borderRadius: '8px',
            marginBottom: '20px',
            fontWeight: 600,
            fontSize: '14px',
            background: '#dcfce7',
            color: '#14532d',
            border: '1px solid #86efac',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span>{toastMessage}</span>
          <button onClick={() => setToastMessage(null)} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: '16px' }}>
            &times;
          </button>
        </div>
      )}

      {/* Overview Metric Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px',
          marginBottom: '24px',
        }}
      >
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Total ASNs Submitted</div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a', marginTop: '4px' }}>{totalCount} ASNs</div>
          <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>Total shipment notices</div>
        </div>

        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>In-Transit Shipments</div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#0284c7', marginTop: '4px' }}>{inTransitCount} Shipments</div>
          <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>Dispatched & en route</div>
        </div>

        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Received at Gate</div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#16a34a', marginTop: '4px' }}>{receivedCount} Shipments</div>
          <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>Delivered to warehouse</div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="filter-card" style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="search-bar" style={{ flex: '1', minWidth: '280px', position: 'relative' }}>
            <input
              type="text"
              placeholder="Search by ASN Number (ASN-2026-XXXX), PO Number, or Supplier..."
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
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#64748b' }}>Status Filter:</span>
            <div style={{ display: 'flex', gap: '4px', background: '#f1f5f9', padding: '4px', borderRadius: '8px' }}>
              {[
                { id: 'ALL', label: 'All ASNs' },
                { id: 'IN_TRANSIT', label: 'In-Transit' },
                { id: 'RECEIVED', label: 'Received' },
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

      {/* ASN Table */}
      <div className="card table-card" style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
        {error && <div style={{ padding: '16px', color: '#991b1b', background: '#fef2f2' }}>{error}</div>}

        {loading ? (
          <div style={{ padding: '48px', textAlign: 'center', color: '#64748b' }}>
            <div className="spinner" style={{ margin: '0 auto 12px auto' }}></div>
            <div>Loading Advance Shipment Notices...</div>
          </div>
        ) : filteredASNs.length === 0 ? (
          <div style={{ padding: '48px 24px', textAlign: 'center', color: '#64748b' }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>🚚</div>
            <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#1e293b', margin: '0 0 6px 0' }}>
              No Advance Shipment Notices Found
            </h3>
            <p style={{ fontSize: '14px', margin: 0 }}>
              Click <strong>+ Create ASN</strong> above to submit a new shipment notice.
            </p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', textTransform: 'uppercase', fontSize: '11px', color: '#475569' }}>
                  <th style={{ textAlign: 'left', padding: '14px 16px' }}>ASN Number</th>
                  <th style={{ textAlign: 'left', padding: '14px 16px' }}>PO Number</th>
                  <th style={{ textAlign: 'left', padding: '14px 16px' }}>Supplier</th>
                  <th style={{ textAlign: 'left', padding: '14px 16px' }}>Shipment Date</th>
                  <th style={{ textAlign: 'left', padding: '14px 16px' }}>Expected Arrival Date</th>
                  <th style={{ textAlign: 'left', padding: '14px 16px' }}>Transporter & Vehicle</th>
                  <th style={{ textAlign: 'center', padding: '14px 16px' }}>Status</th>
                  <th style={{ textAlign: 'center', padding: '14px 16px' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredASNs.map((asn) => (
                  <tr key={asn.id} className="table-row-hover" style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '14px 16px' }}>
                      <span className="req-number-badge" style={{ background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0' }}>
                        {asn.asn_number}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0284c7' }}>
                        {asn.po_number}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>
                      {asn.supplier_name}
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: '13px', color: '#334155' }}>
                      {asn.shipment_date}
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: '13px', color: '#059669', fontWeight: 700 }}>
                      {asn.expected_arrival_date}
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: '12px', color: '#475569' }}>
                      <strong>{asn.transporter}</strong>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>
                        Track: {asn.tracking_number} | Truck: {asn.vehicle_number}
                      </div>
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
                          background: asn.status === 'RECEIVED' ? '#dcfce7' : '#e0f2fe',
                          color: asn.status === 'RECEIVED' ? '#15803d' : '#0369a1',
                        }}
                      >
                        {asn.status}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                      <button
                        type="button"
                        onClick={() => setViewingAsn(asn)}
                        style={{
                          background: '#0f172a',
                          color: 'white',
                          border: 'none',
                          padding: '6px 12px',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        👁️ View ASN
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create ASN Modal */}
      {showCreateModal && (
        <CreateASNModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={handleAsnCreated}
        />
      )}
      {/* View ASN Modal */}
      {viewingAsn && (
        <ViewASNModal
          asn={viewingAsn}
          onClose={() => setViewingAsn(null)}
        />
      )}
    </div>
  )
}
