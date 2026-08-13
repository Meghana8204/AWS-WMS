import { useEffect, useState } from 'react'
import { procurementApi, SupplierItem } from '../../shared/procurementApi'

interface ResubmitPOModalProps {
  po: any
  onClose: () => void
  onSuccess: (poNumber: string) => void
}

export default function ResubmitPOModal({ po, onClose, onSuccess }: ResubmitPOModalProps) {
  const [suppliers, setSuppliers] = useState<SupplierItem[]>([])
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>(po.supplier_id || 'supp-101')
  
  // Editable line items
  const [items, setItems] = useState<any[]>(
    po.items && po.items.length > 0
      ? po.items.map((it: any) => ({
          material_code: it.material_code,
          material_name: it.material_name,
          quantity: it.quantity || 100,
          unit_of_measure: it.unit_of_measure || 'PCS',
          unit_price: it.unit_price || 10.0,
          discount: it.discount || 0,
          tax: it.tax || 5.0,
        }))
      : [
          {
            material_code: 'COPPER-ROD-01',
            material_name: 'Copper Rod 10mm Heavy Duty',
            quantity: 100,
            unit_of_measure: 'KG',
            unit_price: 8.20,
            discount: 2.5,
            tax: 5.0,
          },
        ]
  )

  const [resubmissionNotes, setResubmissionNotes] = useState(
    'Negotiated 5% pricing discount with supplier and adjusted requested quantity per Finance budget feedback.'
  )
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchSuppliers() {
      try {
        const list = await procurementApi.listSuppliers()
        setSuppliers(list)
      } catch (err) {
        console.warn('Failed to load supplier list:', err)
      }
    }
    fetchSuppliers()
  }, [])

  function handleItemChange(index: number, field: string, value: any) {
    const next = [...items]
    next[index] = { ...next[index], [field]: value }
    setItems(next)
  }

  // Calculate dynamic totals
  const subtotal = items.reduce((sum, item) => {
    const q = Number(item.quantity) || 0
    const p = Number(item.unit_price) || 0
    const d = Number(item.discount) || 0
    return sum + q * p * (1 - d / 100)
  }, 0)

  const taxTotal = subtotal * 0.05
  const freight = po.financial_summary?.freight || 150.00
  const grandTotal = subtotal + taxTotal + freight

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!resubmissionNotes.trim()) {
      setError('Please provide resubmission notes explaining the modifications.')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const selectedSupp = suppliers.find((s) => s.id === selectedSupplierId)
      const payload = {
        resubmitted_by: 'John Buyer (Procurement Lead)',
        supplier_id: selectedSupplierId,
        supplier_info: selectedSupp
          ? {
              supplier_code: selectedSupp.supplier_code,
              supplier_name: selectedSupp.supplier_name,
              contact_person: selectedSupp.contact_person,
              email: selectedSupp.email,
              phone: selectedSupp.phone,
            }
          : po.supplier_info,
        items: items.map((it) => ({
          ...it,
          quantity: Number(it.quantity),
          unit_price: Number(it.unit_price),
          discount: Number(it.discount),
          tax: Number(it.tax),
        })),
        notes: resubmissionNotes,
      }

      await procurementApi.resubmitPurchaseOrder(po.id, payload)
      onSuccess(po.po_number)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resubmit PO to Finance')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-backdrop" style={{ zIndex: 1100 }}>
      <div className="modal-content large-modal" style={{ maxWidth: '960px', maxHeight: '90vh', overflowY: 'auto' }}>
        {/* Header */}
        <div className="modal-header" style={{ background: '#0f172a', color: 'white', padding: '18px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: '#f59e0b', letterSpacing: '1px' }}>
              Procurement Workflow — Finance Rejection Resolution
            </div>
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800 }}>
              Modify & Resubmit PO {po.po_number}
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

        <form onSubmit={handleSubmit} className="modal-body" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {error && (
            <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', color: '#991b1b', padding: '12px 16px', borderRadius: '8px', fontSize: '13px' }}>
              {error}
            </div>
          )}

          {/* Finance Rejection Reason Card */}
          <div style={{ background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: '10px', padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#be123c', fontWeight: 800, fontSize: '13px', textTransform: 'uppercase', marginBottom: '6px' }}>
              <span>⚠️</span> Mandatory Finance Rejection Feedback
            </div>
            <div style={{ fontSize: '14px', color: '#881337', background: 'white', border: '1px solid #ffe4e6', padding: '12px', borderRadius: '6px', fontWeight: 600 }}>
              "{po.rejection_reason || po.approval_history?.find((h: any) => h.action === 'REJECTED')?.notes || 'Budget threshold exceeded for this purchase.'}"
            </div>
          </div>

          {/* Section 1: Modify Supplier Selection */}
          <div>
            <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a', marginBottom: '12px', borderBottom: '2px solid #0284c7', paddingBottom: '6px' }}>
              1. Modify Supplier Selection
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>Select Supplier *</label>
                <select
                  value={selectedSupplierId}
                  onChange={(e) => setSelectedSupplierId(e.target.value)}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                >
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.supplier_name} ({s.supplier_code}) — {s.performance_tier || 'QUALIFIED'}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>Warehouse Destination</label>
                <input
                  type="text"
                  value={po.warehouse_id}
                  disabled
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#f8fafc', fontSize: '13px' }}
                />
              </div>
            </div>
          </div>

          {/* Section 2: Modify Price & Quantity Line Items */}
          <div>
            <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a', marginBottom: '12px', borderBottom: '2px solid #0284c7', paddingBottom: '6px' }}>
              2. Modify Line Items (Quantity & Unit Price)
            </h3>
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontSize: '11px', color: '#475569', textTransform: 'uppercase' }}>
                    <th style={{ textAlign: 'left', padding: '10px' }}>Material</th>
                    <th style={{ textAlign: 'center', padding: '10px', width: '120px' }}>Quantity</th>
                    <th style={{ textAlign: 'center', padding: '10px', width: '80px' }}>UOM</th>
                    <th style={{ textAlign: 'center', padding: '10px', width: '130px' }}>Unit Price ($)</th>
                    <th style={{ textAlign: 'center', padding: '10px', width: '100px' }}>Discount (%)</th>
                    <th style={{ textAlign: 'right', padding: '10px', width: '120px' }}>Line Total ($)</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => {
                    const q = Number(item.quantity) || 0
                    const p = Number(item.unit_price) || 0
                    const d = Number(item.discount) || 0
                    const lineTotal = q * p * (1 - d / 100) * 1.05

                    return (
                      <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '10px' }}>
                          <strong style={{ color: '#0f172a' }}>{item.material_name}</strong>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>{item.material_code}</div>
                        </td>
                        <td style={{ padding: '10px' }}>
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                            style={{ width: '100%', padding: '6px', borderRadius: '6px', border: '1px solid #cbd5e1', textAlign: 'right' }}
                          />
                        </td>
                        <td style={{ padding: '10px', textAlign: 'center' }}>
                          <span style={{ background: '#e2e8f0', padding: '3px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 700 }}>
                            {item.unit_of_measure}
                          </span>
                        </td>
                        <td style={{ padding: '10px' }}>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={item.unit_price}
                            onChange={(e) => handleItemChange(idx, 'unit_price', e.target.value)}
                            style={{ width: '100%', padding: '6px', borderRadius: '6px', border: '1px solid #cbd5e1', textAlign: 'right' }}
                          />
                        </td>
                        <td style={{ padding: '10px' }}>
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            max="100"
                            value={item.discount}
                            onChange={(e) => handleItemChange(idx, 'discount', e.target.value)}
                            style={{ width: '100%', padding: '6px', borderRadius: '6px', border: '1px solid #cbd5e1', textAlign: 'right' }}
                          />
                        </td>
                        <td style={{ padding: '10px', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>
                          ${lineTotal.toFixed(2)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Recalculated Summary Box */}
            <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '8px', padding: '12px 16px', marginTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', color: '#0369a1', fontWeight: 600 }}>Recalculated Commercial Commitment:</span>
              <strong style={{ fontSize: '18px', color: '#0284c7' }}>
                New Grand Total: ${grandTotal.toFixed(2)}
              </strong>
            </div>
          </div>

          {/* Section 3: Resubmission Rationale / Notes */}
          <div>
            <label style={{ fontSize: '12px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '6px' }}>
              Resubmission Rationale & Comments for Finance *
            </label>
            <textarea
              rows={3}
              value={resubmissionNotes}
              onChange={(e) => setResubmissionNotes(e.target.value)}
              placeholder="Explain price negotiations, quantity changes, or commercial justifications..."
              style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', fontFamily: 'inherit' }}
              required
            />
          </div>

          {/* Footer Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
            <button type="button" className="btn-secondary" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              style={{
                background: '#0284c7',
                color: 'white',
                border: '1px solid #0369a1',
                padding: '10px 24px',
                borderRadius: '8px',
                fontWeight: 700,
                cursor: 'pointer',
                fontSize: '14px',
              }}
            >
              {submitting ? 'Resubmitting...' : '🚀 [Resubmit to Finance]'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
