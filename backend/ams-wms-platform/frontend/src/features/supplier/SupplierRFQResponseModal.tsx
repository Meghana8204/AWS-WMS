import { FormEvent, useState } from 'react'
import { procurementApi } from '../../shared/procurementApi'

interface Props {
  rfq: any
  supplier: {
    supplierId: string
    supplierCode: string
    supplierName: string
    username: string
  }
  onClose: () => void
  onSuccess: (isDraft: boolean) => void
}

interface DocumentAttachment {
  type: 'QUOTATION_PDF' | 'COMMERCIAL' | 'TECHNICAL' | 'SUPPORTING'
  name: string
  size: string
  uploadedAt: string
}

export default function SupplierRFQResponseModal({ rfq, supplier, onClose, onSuccess }: Props) {
  // Read-only RFQ metadata
  const rfqNumber = rfq.rfq_number || 'RFQ-2026-0001'
  const requestDate = rfq.issue_date || (rfq.created_at ? new Date(rfq.created_at).toLocaleDateString() : '2026-08-12')
  const requiredDeliveryDate = rfq.due_date || '2026-08-25'
  const warehouse = rfq.warehouse_id || 'WH-CENTRAL'
  const procurementOfficer = rfq.procurement_officer || 'John Buyer (Procurement Officer)'

  // Check if quotation is already submitted & locked
  const [isLocked, setIsLocked] = useState<boolean>(rfq.supplier_quote_status === 'SUBMITTED')
  const [statusState, setStatusState] = useState<'DRAFT' | 'SUBMITTED' | 'OPEN'>(
    rfq.supplier_quote_status || 'OPEN'
  )

  // Supplier Required Inputs
  const [availableQty, setAvailableQty] = useState(
    rfq.items?.[0]?.quantity ? String(rfq.items[0].quantity) : '100'
  )
  const [unitPrice, setUnitPrice] = useState('8.20')
  const [discountPercent, setDiscountPercent] = useState('2.5')
  const [taxPercent, setTaxPercent] = useState('5.0')
  const [freightCharges, setFreightCharges] = useState('150.00')
  const [deliveryTimeDays, setDeliveryTimeDays] = useState('7')
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() + 10)
    return d.toISOString().split('T')[0]
  })
  const [paymentTerms, setPaymentTerms] = useState('Net 30 Days upon delivery')
  const [quotationValidity, setQuotationValidity] = useState('30 Days')
  const [remarks, setRemarks] = useState('Includes ISO 9001 test certificates & palletized packing.')

  // Document Uploads State
  const [documents, setDocuments] = useState<DocumentAttachment[]>([
    {
      type: 'QUOTATION_PDF',
      name: `Official_Quotation_${rfqNumber}.pdf`,
      size: '1.2 MB',
      uploadedAt: new Date().toLocaleDateString(),
    },
  ])

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleFileUpload(type: DocumentAttachment['type'], e: React.ChangeEvent<HTMLInputElement>) {
    if (isLocked) return
    const files = e.target.files
    if (!files || files.length === 0) return

    const file = files[0]
    setDocuments((prev) => [
      ...prev,
      {
        type,
        name: file.name,
        size: `${(file.size / 1024).toFixed(1)} KB`,
        uploadedAt: new Date().toLocaleDateString(),
      },
    ])
  }

  function removeDocument(idx: number) {
    if (isLocked) return
    setDocuments((prev) => prev.filter((_, i) => i !== idx))
  }

  async function handleSave(isDraftSubmit: boolean) {
    setError(null)
    setSubmitting(true)

    try {
      // Calculate net total for quotation item
      const qty = parseFloat(availableQty) || 1
      const price = parseFloat(unitPrice) || 0
      const discount = parseFloat(discountPercent) || 0
      const netUnitPrice = price * (1 - discount / 100)

      await procurementApi.submitQuotation({
        rfq_id: rfq.id,
        supplier_id: supplier.supplierId,
        supplier_code: supplier.supplierCode,
        supplier_name: supplier.supplierName,
        payment_terms: paymentTerms,
        is_draft: isDraftSubmit,
        remarks: `${remarks} | Validity: ${quotationValidity} | Discount: ${discountPercent}% | Tax: ${taxPercent}% | Freight: $${freightCharges} | Attachments: ${documents.length} files`,
        items: (rfq.items || []).map((it: any) => ({
          material_code: it.material_code,
          material_name: it.material_name,
          offered_qty: qty,
          unit_price: netUnitPrice,
          lead_time_days: parseInt(deliveryTimeDays) || 7,
          unit_of_measure: it.unit_of_measure || 'PCS',
        })),
      })

      if (!isDraftSubmit) {
        setIsLocked(true)
        setStatusState('SUBMITTED')
      } else {
        setStatusState('DRAFT')
      }

      onSuccess(isDraftSubmit)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process quotation')
    } finally {
      setSubmitting(false)
    }
  }

  // Calculated Totals
  const rawSubtotal = (parseFloat(availableQty) || 0) * (parseFloat(unitPrice) || 0)
  const discountAmt = rawSubtotal * ((parseFloat(discountPercent) || 0) / 100)
  const netSubtotal = rawSubtotal - discountAmt
  const taxAmt = netSubtotal * ((parseFloat(taxPercent) || 0) / 100)
  const freightAmt = parseFloat(freightCharges) || 0
  const grandTotal = netSubtotal + taxAmt + freightAmt

  return (
    <div className="modal-backdrop">
      <div className="modal-content large-modal">
        <div className="modal-header" style={{ background: isLocked ? '#334155' : '#0284c7' }}>
          <div>
            <div className="badge-tag" style={{ color: '#e0f2fe' }}>
              RFQ Response / Submit Quotation
            </div>
            <h2>
              Quotation Submission — {rfqNumber}
              {isLocked && <span style={{ fontSize: '14px', marginLeft: '12px', background: '#e2e8f0', color: '#0f172a', padding: '2px 8px', borderRadius: '12px' }}>🔒 Locked (Submitted)</span>}
            </h2>
          </div>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>

        <div className="modal-body">
          {error && <div className="card card-error">{error}</div>}

          {isLocked && (
            <div className="toast-banner" style={{ background: '#f8fafc', border: '1px solid #cbd5e1', color: '#334155' }}>
              🔒 <strong>Quotation Submitted & Locked:</strong> This quotation has been submitted to Procurement and is locked from normal editing.
            </div>
          )}

          {/* Section 1: RFQ Information (Read-Only) */}
          <h3 className="section-heading" style={{ marginTop: 0 }}>1. RFQ Information (Read-Only)</h3>
          <div className="grid-meta-box">
            <div className="meta-item">
              <span className="label">RFQ Number</span>
              <span className="value req-number-badge">{rfqNumber}</span>
            </div>
            <div className="meta-item">
              <span className="label">Request Date</span>
              <span className="value">{requestDate}</span>
            </div>
            <div className="meta-item">
              <span className="label">Required Delivery Date</span>
              <span className="value highlight-date">{requiredDeliveryDate}</span>
            </div>
            <div className="meta-item">
              <span className="label">Warehouse</span>
              <span className="value strong">{warehouse}</span>
            </div>
            <div className="meta-item">
              <span className="label">Procurement Officer</span>
              <span className="value">{procurementOfficer}</span>
            </div>
            <div className="meta-item">
              <span className="label">Quotation Status</span>
              <span className="value">
                <span className={`status-pill status-${statusState.toLowerCase()}`}>
                  {statusState}
                </span>
              </span>
            </div>
          </div>

          {/* Section 2: Material Response (Read-Only Table) */}
          <h3 className="section-heading">2. Material Response</h3>
          <div className="table-wrapper mini-table">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Material Code</th>
                  <th>Material Name & Description</th>
                  <th className="num">Requested Quantity</th>
                  <th>UOM</th>
                </tr>
              </thead>
              <tbody>
                {(rfq.items || []).map((it: any, idx: number) => (
                  <tr key={idx}>
                    <td><code>{it.material_code}</code></td>
                    <td><strong>{it.material_name}</strong></td>
                    <td className="num font-bold">{it.quantity?.toLocaleString() || 100}</td>
                    <td><span className="uom-tag">{it.unit_of_measure || 'PCS'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Section 3: Supplier Inputs */}
          <h3 className="section-heading" style={{ marginTop: '24px' }}>3. Supplier Quotation Proposal</h3>
          <fieldset disabled={isLocked} style={{ border: 'none', padding: 0, margin: 0 }}>
            <div className="form-grid">
              <div className="form-group">
                <label>Available Quantity *</label>
                <input
                  type="number"
                  step="any"
                  value={availableQty}
                  onChange={(e) => setAvailableQty(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label>Unit Price ($) *</label>
                <input
                  type="number"
                  step="any"
                  value={unitPrice}
                  onChange={(e) => setUnitPrice(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label>Discount (%)</label>
                <input
                  type="number"
                  step="any"
                  value={discountPercent}
                  onChange={(e) => setDiscountPercent(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Tax (%)</label>
                <input
                  type="number"
                  step="any"
                  value={taxPercent}
                  onChange={(e) => setTaxPercent(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Freight Charges ($)</label>
                <input
                  type="number"
                  step="any"
                  value={freightCharges}
                  onChange={(e) => setFreightCharges(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Delivery Lead Time (Days) *</label>
                <input
                  type="number"
                  value={deliveryTimeDays}
                  onChange={(e) => setDeliveryTimeDays(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label>Expected Delivery Date *</label>
                <input
                  type="date"
                  value={expectedDeliveryDate}
                  onChange={(e) => setExpectedDeliveryDate(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label>Payment Terms *</label>
                <input
                  value={paymentTerms}
                  onChange={(e) => setPaymentTerms(e.target.value)}
                  placeholder="e.g. Net 30 Days"
                  required
                />
              </div>

              <div className="form-group">
                <label>Quotation Validity *</label>
                <input
                  value={quotationValidity}
                  onChange={(e) => setQuotationValidity(e.target.value)}
                  placeholder="e.g. 30 Days"
                  required
                />
              </div>
            </div>

            <div className="form-group" style={{ marginTop: '12px' }}>
              <label>Remarks & Additional Conditions</label>
              <textarea
                rows={2}
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Include warranties, packaging terms, or delivery conditions"
              />
            </div>
          </fieldset>

          {/* Quotation Summary Calculation Box */}
          <div className="grid-meta-box" style={{ background: '#f0f9ff', borderColor: '#bae6fd', marginTop: '16px' }}>
            <div className="meta-item">
              <span className="label">Raw Subtotal</span>
              <span className="value">${rawSubtotal.toFixed(2)}</span>
            </div>
            <div className="meta-item">
              <span className="label">Discount ({discountPercent}%)</span>
              <span className="value" style={{ color: '#16a34a' }}>-${discountAmt.toFixed(2)}</span>
            </div>
            <div className="meta-item">
              <span className="label">Tax ({taxPercent}%) + Freight</span>
              <span className="value">+${(taxAmt + freightAmt).toFixed(2)}</span>
            </div>
            <div className="meta-item">
              <span className="label">Grand Total Quotation</span>
              <span className="value highlight-date" style={{ fontSize: '18px' }}>${grandTotal.toFixed(2)}</span>
            </div>
          </div>

          {/* Section 4: Document Uploads */}
          <h3 className="section-heading" style={{ marginTop: '24px' }}>4. Document Attachments</h3>
          <p className="sub-text">Upload required commercial, technical, and quotation documents.</p>

          <fieldset disabled={isLocked} style={{ border: 'none', padding: 0, margin: 0 }}>
            <div className="form-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '16px' }}>
              <div className="form-group">
                <label className="text-xs">📄 Quotation PDF</label>
                <input type="file" accept=".pdf" onChange={(e) => handleFileUpload('QUOTATION_PDF', e)} className="input-sm" />
              </div>

              <div className="form-group">
                <label className="text-xs">💼 Commercial Docs</label>
                <input type="file" accept=".pdf,.docx,.xlsx" onChange={(e) => handleFileUpload('COMMERCIAL', e)} className="input-sm" />
              </div>

              <div className="form-group">
                <label className="text-xs">🛠️ Technical Docs</label>
                <input type="file" accept=".pdf,.docx" onChange={(e) => handleFileUpload('TECHNICAL', e)} className="input-sm" />
              </div>

              <div className="form-group">
                <label className="text-xs">📎 Other Supporting</label>
                <input type="file" onChange={(e) => handleFileUpload('SUPPORTING', e)} className="input-sm" />
              </div>
            </div>
          </fieldset>

          {documents.length > 0 && (
            <div className="supplier-selection-box" style={{ padding: '12px' }}>
              <strong style={{ fontSize: '12px', color: '#475569' }}>Attached Files ({documents.length}):</strong>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
                {documents.map((doc, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'white', border: '1px solid #cbd5e1', padding: '6px 12px', borderRadius: '6px', fontSize: '12px' }}>
                    <div>
                      <span className="uom-tag" style={{ marginRight: '8px' }}>{doc.type}</span>
                      <strong>{doc.name}</strong> <span style={{ color: '#64748b' }}>({doc.size})</span>
                    </div>
                    {!isLocked && (
                      <button type="button" onClick={() => removeDocument(i)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontWeight: 600 }}>
                        &times; Remove
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Section 5: Footer Actions */}
        <div className="modal-footer">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={submitting}>
            {isLocked ? 'Close View' : 'Cancel'}
          </button>

          {!isLocked && (
            <>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => handleSave(true)}
                disabled={submitting}
                style={{ borderColor: '#64748b', color: '#334155' }}
              >
                {submitting ? 'Saving...' : '💾 [Save Draft]'}
              </button>

              <button
                type="button"
                className="btn-primary"
                onClick={() => handleSave(false)}
                disabled={submitting}
                style={{ background: '#0284c7' }}
              >
                {submitting ? 'Submitting...' : '🚀 [Submit Quotation]'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
