import { useState } from 'react'
import { procurementApi } from '../../shared/procurementApi'
import PurchaseOrderViewModal from './PurchaseOrderViewModal'
import CreateASNModal from '../supplier/CreateASNModal'

interface SendPOToSupplierModalProps {
  po: any
  onClose: () => void
  onSuccess: (poNumber: string) => void
}

export default function SendPOToSupplierModal({ po, onClose, onSuccess }: SendPOToSupplierModalProps) {
  const [showPOView, setShowPOView] = useState(false)
  const [showAsnAlert, setShowAsnAlert] = useState(false)
  const [showCreateAsnModal, setShowCreateAsnModal] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const supp = po.supplier_info || {
    supplier_code: 'SUPP-VERTEX',
    supplier_name: 'Vertex Metals Corp',
    email: 'sales@vertexmetals.com',
  }

  const items = po.items || [
    {
      material_code: 'COPPER-ROD-01',
      material_name: 'Copper Rod 10mm Heavy Duty',
      quantity: 100,
      unit_of_measure: 'KG',
    },
  ]

  const materialSummaryText = items
    .map((i: any) => `${i.material_name} (${i.quantity} ${i.unit_of_measure || 'PCS'})`)
    .join(', ')

  const totalAmount = po.grand_total || po.financial_summary?.grand_total || po.order_summary?.total_amount || 989.48
  const formattedAmount = `₹${(totalAmount * 550).toLocaleString('en-IN')} ($${Number(totalAmount).toFixed(2)})`
  const deliveryDate = po.expected_delivery_date || '25-Aug-2026'

  async function handleSendEmail() {
    setSending(true)
    setError(null)
    try {
      await procurementApi.sendPOToSupplier(po.id, {
        sender: 'John Buyer (Procurement Lead)',
        recipient_email: supp.email,
        po_number: po.po_number,
        supplier_name: supp.supplier_name,
        total_amount: totalAmount,
        expected_delivery_date: deliveryDate,
        material_summary: materialSummaryText,
      })
      onSuccess(po.po_number)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send PO email to supplier')
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      <div className="modal-backdrop" style={{ zIndex: 1100 }}>
        <div className="modal-content large-modal" style={{ maxWidth: '840px', maxHeight: '92vh', overflowY: 'auto' }}>
          {/* Modal Header */}
          <div
            className="modal-header"
            style={{
              background: '#0f172a',
              color: 'white',
              padding: '18px 24px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <div style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: '#38bdf8', letterSpacing: '1px' }}>
                Procurement Workflow — Supplier PO Email Dispatch
              </div>
              <h2 style={{ margin: '2px 0 0 0', fontSize: '20px', fontWeight: 800 }}>
                Send Purchase Order {po.po_number} to Supplier
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '24px', cursor: 'pointer' }}
            >
              &times;
            </button>
          </div>

          <div className="modal-body" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {error && (
              <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', color: '#991b1b', padding: '12px', borderRadius: '8px', fontSize: '13px' }}>
                {error}
              </div>
            )}

            {showAsnAlert && (
              <div style={{ background: '#f0fdf4', border: '1px solid #86efac', color: '#166534', padding: '12px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 600 }}>
                🚀 ASN Submission Portal link generated! Suppliers will click [SUBMIT ASN] to input Inbound Shipment tracking, carrier Details, and dispatch dates.
              </div>
            )}

            {/* Simulated Email Envelope Container */}
            <div style={{ border: '1px solid #cbd5e1', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
              
              {/* Email Headers */}
              <div style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <span style={{ color: '#64748b', fontWeight: 700, width: '80px' }}>To:</span>
                  <strong style={{ color: '#0f172a' }}>{supp.supplier_name} &lt;{supp.email || 'sales@vertexmetals.com'}&gt;</strong>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <span style={{ color: '#64748b', fontWeight: 700, width: '80px' }}>From:</span>
                  <span style={{ color: '#334155' }}>AMS Procurement Operations &lt;procurement@enterprise.com&gt;</span>
                </div>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <span style={{ color: '#64748b', fontWeight: 700, width: '80px' }}>Subject:</span>
                  <strong style={{ color: '#0284c7', fontSize: '14px' }}>Purchase Order {po.po_number}</strong>
                </div>
              </div>

              {/* Email Content Body */}
              <div style={{ padding: '24px', background: '#ffffff', fontSize: '14px', lineHeight: '1.6', color: '#1e293b' }}>
                
                <div style={{ background: '#dcfce7', border: '1px solid #86efac', borderRadius: '8px', padding: '12px 16px', marginBottom: '20px', color: '#14532d', fontWeight: 700, fontSize: '15px' }}>
                  ✓ Your Purchase Order has been approved.
                </div>

                <p style={{ margin: '0 0 16px 0', fontSize: '14px', color: '#334155' }}>
                  Dear <strong>{supp.contact_person || supp.supplier_name}</strong>,
                </p>

                <p style={{ margin: '0 0 20px 0', fontSize: '14px', color: '#334155' }}>
                  We are pleased to inform you that Purchase Order <strong>{po.po_number}</strong> has received formal Finance Approval and is released for immediate dispatch.
                </p>

                {/* Key Summary Box */}
                <div
                  style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '10px',
                    padding: '18px',
                    marginBottom: '24px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}>
                    <span style={{ color: '#64748b', fontWeight: 600 }}>PO Number:</span>
                    <strong style={{ color: '#0284c7', fontFamily: 'monospace', fontSize: '15px' }}>{po.po_number}</strong>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}>
                    <span style={{ color: '#64748b', fontWeight: 600 }}>Supplier Name:</span>
                    <strong style={{ color: '#0f172a' }}>{supp.supplier_name}</strong>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}>
                    <span style={{ color: '#64748b', fontWeight: 600 }}>Total Amount:</span>
                    <strong style={{ color: '#059669', fontSize: '16px' }}>{formattedAmount}</strong>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}>
                    <span style={{ color: '#64748b', fontWeight: 600 }}>Material Summary:</span>
                    <strong style={{ color: '#0f172a', textAlign: 'right', maxWidth: '400px' }}>{materialSummaryText}</strong>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b', fontWeight: 600 }}>Expected Delivery:</span>
                    <strong style={{ color: '#d97706', background: '#fef3c7', padding: '2px 8px', borderRadius: '4px' }}>{deliveryDate}</strong>
                  </div>
                </div>

                {/* Attached PDF Card */}
                <div style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '12px 16px', marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '22px' }}>📕</span>
                    <div>
                      <strong style={{ fontSize: '13px', color: '#0f172a', display: 'block' }}>{po.po_number}_Official_Purchase_Order.pdf</strong>
                      <span style={{ fontSize: '11px', color: '#64748b' }}>Digitally Signed Enterprise Purchase Document (1.4 MB)</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowPOView(true)}
                    style={{ background: 'white', border: '1px solid #cbd5e1', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', color: '#0284c7' }}
                  >
                    👁️ Preview PDF
                  </button>
                </div>

                {/* Action CTA Buttons */}
                <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', marginTop: '12px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => setShowPOView(true)}
                    style={{
                      background: '#0f172a',
                      color: 'white',
                      border: 'none',
                      padding: '12px 24px',
                      borderRadius: '8px',
                      fontWeight: 800,
                      fontSize: '14px',
                      cursor: 'pointer',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    📄 [VIEW PURCHASE ORDER]
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowCreateAsnModal(true)}
                    style={{
                      background: '#059669',
                      color: 'white',
                      border: 'none',
                      padding: '12px 24px',
                      borderRadius: '8px',
                      fontWeight: 800,
                      fontSize: '14px',
                      cursor: 'pointer',
                      boxShadow: '0 2px 4px rgba(5, 150, 105, 0.2)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    🚚 [SUBMIT ASN]
                  </button>
                </div>

              </div>
            </div>
          </div>

          {/* Footer Dispatch Action */}
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
            <button type="button" className="btn-secondary" onClick={onClose} disabled={sending}>
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSendEmail}
              disabled={sending}
              style={{
                background: '#059669',
                color: 'white',
                border: '1px solid #047857',
                padding: '10px 24px',
                borderRadius: '8px',
                fontWeight: 800,
                cursor: 'pointer',
                fontSize: '14px',
                boxShadow: '0 2px 4px rgba(5, 150, 105, 0.2)',
              }}
            >
              {sending ? 'Dispatching Email...' : '📧 [Send Email to Supplier]'}
            </button>
          </div>
        </div>
      </div>

      {/* Sub-modal: View Full PO PDF */}
      {showPOView && (
        <PurchaseOrderViewModal po={po} onClose={() => setShowPOView(false)} />
      )}
      {/* Sub-modal: Create ASN */}
      {showCreateAsnModal && (
        <CreateASNModal
          initialPoNumber={po.po_number}
          onClose={() => setShowCreateAsnModal(false)}
          onSuccess={(asnNum) => {
            setShowAsnAlert(true)
            setShowCreateAsnModal(false)
          }}
        />
      )}
    </>
  )
}
