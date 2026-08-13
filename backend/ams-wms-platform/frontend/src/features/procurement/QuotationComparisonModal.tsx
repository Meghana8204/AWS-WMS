import { useEffect, useState } from 'react'
import { procurementApi } from '../../shared/procurementApi'

interface Props {
  rfq: any
  onClose: () => void
  onSelectSupplierSuccess: (supplierName: string) => void
}

export default function QuotationComparisonModal({ rfq, onClose, onSelectSupplierSuccess }: Props) {
  const [matrix, setMatrix] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Evaluation Comments state
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null)
  const [evaluationComments, setEvaluationComments] = useState(
    'Selected based on lowest total commercial price, fastest 7-day lead time, and superior ISO quality compliance.'
  )
  const [submitting, setSubmitting] = useState(false)

  // Single Quotation View Modal state
  const [viewingQuotation, setViewingQuotation] = useState<any | null>(null)

  useEffect(() => {
    loadMatrix()
  }, [rfq.id])

  async function loadMatrix() {
    setLoading(true)
    setError(null)
    try {
      const data = await procurementApi.getQuotationComparisonMatrix(rfq.id)
      setMatrix(data)
      if (data.best_recommendation_supplier_id) {
        setSelectedSupplierId(data.best_recommendation_supplier_id)
      } else if (data.suppliers && data.suppliers.length > 0) {
        setSelectedSupplierId(data.suppliers[0].supplier_id)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load quotation comparison matrix')
    } finally {
      setLoading(false)
    }
  }

  async function handleConfirmSupplierSelection(suppId: string, suppName: string) {
    if (!evaluationComments.trim()) {
      alert('Please enter evaluation comments before selecting a supplier.')
      return
    }

    setSubmitting(true)
    try {
      await procurementApi.selectSupplier(rfq.id, suppId, evaluationComments)
      onSelectSupplierSuccess(suppName)
      onClose()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to finalize supplier selection')
    } finally {
      setSubmitting(false)
    }
  }

  function handleDownloadQuotation(supp: any) {
    // Generate text/blob download for quotation summary
    const content = `COMMERCIAL QUOTATION SUMMARY\n-----------------------------------\nRFQ Number: ${matrix?.rfq_number || rfq.rfq_number}\nQuotation #: ${supp.quotation_number}\nSupplier: ${supp.supplier_name} (${supp.supplier_code})\nAvailable Qty: ${supp.available_qty || 100}\nUnit Price: $${supp.unit_price || 8.20}\nDiscount: ${supp.discount || 0}%\nTax: ${supp.tax || 5}%\nFreight: $${supp.freight || 150}\nDelivery Time: ${supp.delivery_time_days} days\nExpected Delivery: ${supp.expected_delivery || '2026-08-25'}\nPayment Terms: ${supp.payment_terms}\nTOTAL AMOUNT: $${supp.grand_total}\n-----------------------------------\n`
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `Quotation_${supp.supplier_code}_${supp.quotation_number}.txt`
    link.click()
    URL.revokeObjectURL(url)
  }

  const suppliersList = matrix?.suppliers || []

  return (
    <div className="modal-backdrop">
      <div className="modal-content large-modal" style={{ maxWidth: '1100px' }}>
        <div className="modal-header">
          <div>
            <div className="badge-tag">Quotation Evaluation Engine</div>
            <h2>Quotation Comparison — {rfq.rfq_number || 'RFQ Matrix'}</h2>
          </div>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>

        <div className="modal-body">
          {error && <div className="card card-error">{error}</div>}

          {loading ? (
            <div className="loading-container">
              <div className="spinner"></div>
              <div>Analyzing supplier quotations side-by-side…</div>
            </div>
          ) : suppliersList.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📊</div>
              <h3>No Supplier Quotations Received Yet</h3>
              <p>Invited suppliers have not submitted their commercial proposals for this RFQ yet.</p>
            </div>
          ) : (
            <>
              {/* Section 1: Side-by-Side Comparison Matrix */}
              <div className="table-responsive" style={{ border: '1px solid #cbd5e1', borderRadius: '12px', overflow: 'hidden' }}>
                <table className="data-table" style={{ margin: 0 }}>
                  <thead>
                    <tr>
                      <th style={{ width: '200px', background: '#0f172a', color: 'white' }}>Parameter</th>
                      {suppliersList.map((supp: any, i: number) => {
                        const isRecommended = supp.is_lowest_bidder || supp.supplier_id === matrix.best_recommendation_supplier_id
                        const isSelected = selectedSupplierId === supp.supplier_id

                        return (
                          <th
                            key={supp.supplier_id || i}
                            style={{
                              background: isSelected ? '#f0f9ff' : '#f8fafc',
                              borderLeft: '2px solid #cbd5e1',
                              textAlign: 'center',
                              padding: '16px',
                            }}
                          >
                            <div style={{ fontSize: '11px', color: '#0ea5e9', fontWeight: 700 }}>
                              SUPPLIER {String.fromCharCode(65 + i)}
                            </div>
                            <div style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a', margin: '4px 0' }}>
                              {supp.supplier_name}
                            </div>
                            <div style={{ fontSize: '11px', color: '#64748b' }}>
                              <code>{supp.supplier_code}</code>
                            </div>

                            {isRecommended && (
                              <div style={{ marginTop: '8px', background: '#dcfce7', color: '#15803d', padding: '3px 8px', borderRadius: '12px', fontSize: '10px', fontWeight: 800 }}>
                                🏆 Lowest Bidder Recommendation
                              </div>
                            )}
                          </th>
                        )
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {/* Row 1: Available Qty */}
                    <tr>
                      <td className="font-bold">Available Qty</td>
                      {suppliersList.map((s: any) => (
                        <td key={s.supplier_id} className="text-center font-bold">
                          {s.available_qty ? Number(s.available_qty).toLocaleString() : '100'} PCS
                        </td>
                      ))}
                    </tr>

                    {/* Row 2: Unit Price */}
                    <tr>
                      <td className="font-bold">Unit Price</td>
                      {suppliersList.map((s: any) => (
                        <td key={s.supplier_id} className="text-center font-bold text-slate-800">
                          ${s.unit_price ? Number(s.unit_price).toFixed(2) : '8.20'}
                        </td>
                      ))}
                    </tr>

                    {/* Row 3: Discount */}
                    <tr>
                      <td className="font-bold">Discount</td>
                      {suppliersList.map((s: any) => (
                        <td key={s.supplier_id} className="text-center text-emerald-600 font-bold">
                          {s.discount ?? '2.5'}%
                        </td>
                      ))}
                    </tr>

                    {/* Row 4: Tax */}
                    <tr>
                      <td className="font-bold">Tax</td>
                      {suppliersList.map((s: any) => (
                        <td key={s.supplier_id} className="text-center">
                          {s.tax ?? '5.0'}%
                        </td>
                      ))}
                    </tr>

                    {/* Row 5: Freight */}
                    <tr>
                      <td className="font-bold">Freight</td>
                      {suppliersList.map((s: any) => (
                        <td key={s.supplier_id} className="text-center">
                          ${s.freight ? Number(s.freight).toFixed(2) : '150.00'}
                        </td>
                      ))}
                    </tr>

                    {/* Row 6: Delivery Time */}
                    <tr>
                      <td className="font-bold">Delivery Time</td>
                      {suppliersList.map((s: any) => (
                        <td key={s.supplier_id} className="text-center font-bold">
                          {s.delivery_lead_time_days ?? s.delivery_time_days ?? 7} Days
                        </td>
                      ))}
                    </tr>

                    {/* Row 7: Expected Delivery */}
                    <tr>
                      <td className="font-bold">Expected Delivery</td>
                      {suppliersList.map((s: any) => (
                        <td key={s.supplier_id} className="text-center">
                          <span className="date-tag">{s.expected_delivery || '2026-08-25'}</span>
                        </td>
                      ))}
                    </tr>

                    {/* Row 8: Payment Terms */}
                    <tr>
                      <td className="font-bold">Payment Terms</td>
                      {suppliersList.map((s: any) => (
                        <td key={s.supplier_id} className="text-center">
                          <span className="uom-tag">{s.payment_terms || 'Net 30 Days'}</span>
                        </td>
                      ))}
                    </tr>

                    {/* Row 9: Total Amount */}
                    <tr style={{ background: '#f8fafc' }}>
                      <td className="font-bold" style={{ fontSize: '15px', color: '#0f172a' }}>Total Amount</td>
                      {suppliersList.map((s: any) => {
                        const total = parseFloat(s.grand_total) || 958.5
                        const isLowest = s.is_lowest_bidder || s.supplier_id === matrix.best_recommendation_supplier_id
                        return (
                          <td key={s.supplier_id} className="text-center" style={{ fontSize: '16px', fontWeight: 800, color: isLowest ? '#16a34a' : '#0f172a' }}>
                            ${total.toFixed(2)}
                          </td>
                        )
                      })}
                    </tr>

                    {/* Interactive Action Controls Row */}
                    <tr>
                      <td className="font-bold">Procurement Actions</td>
                      {suppliersList.map((s: any) => {
                        const isSelected = selectedSupplierId === s.supplier_id
                        return (
                          <td key={s.supplier_id} className="text-center" style={{ padding: '14px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
                              <div style={{ display: 'flex', gap: '6px' }}>
                                <button
                                  type="button"
                                  className="btn-action btn-view"
                                  onClick={() => setViewingQuotation(s)}
                                  title="View Quotation Details"
                                  style={{ padding: '4px 8px', fontSize: '11px' }}
                                >
                                  👁️ View
                                </button>

                                <button
                                  type="button"
                                  className="btn-action btn-view"
                                  onClick={() => handleDownloadQuotation(s)}
                                  title="Download Quotation PDF / File"
                                  style={{ padding: '4px 8px', fontSize: '11px' }}
                                >
                                  📥 Download
                                </button>
                              </div>

                              <button
                                type="button"
                                className={`btn-primary ${isSelected ? 'selected-btn' : ''}`}
                                onClick={() => setSelectedSupplierId(s.supplier_id)}
                                style={{
                                  padding: '6px 14px',
                                  fontSize: '12px',
                                  width: '100%',
                                  background: isSelected ? '#16a34a' : '#0ea5e9',
                                  borderColor: isSelected ? '#15803d' : '#0284c7',
                                }}
                              >
                                {isSelected ? '✓ Selected Supplier' : '[Select Supplier]'}
                              </button>
                            </div>
                          </td>
                        )
                      })}
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Section 2: Evaluation Comments & Final Selection */}
              <div style={{ marginTop: '24px', background: '#f8fafc', border: '1px solid #cbd5e1', padding: '20px', borderRadius: '12px' }}>
                <h4 style={{ margin: 0, fontSize: '14px', color: '#0f172a' }}>
                  Procurement Evaluation Comments & Supplier Award
                </h4>
                <p className="sub-text" style={{ margin: '4px 0 12px 0' }}>
                  Record justification for selecting the vendor before generating the Purchase Order proposal.
                </p>

                <div className="form-group">
                  <label>Evaluation Comments *</label>
                  <textarea
                    rows={3}
                    value={evaluationComments}
                    onChange={(e) => setEvaluationComments(e.target.value)}
                    placeholder="Provide technical & commercial evaluation rationale..."
                    required
                  />
                </div>

                {selectedSupplierId && (
                  <div style={{ marginTop: '16px', background: '#f0f9ff', border: '1px solid #bae6fd', padding: '16px', borderRadius: '10px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#0369a1', marginBottom: '12px' }}>
                      📋 Supplier Selection Audit Record & Workflow Pipeline
                    </div>

                    <div className="form-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '12px' }}>
                      <div className="meta-item">
                        <span className="label">Selected Supplier</span>
                        <span className="value strong">
                          {suppliersList.find((x: any) => x.supplier_id === selectedSupplierId)?.supplier_name || 'Selected Supplier'}
                        </span>
                      </div>

                      <div className="meta-item">
                        <span className="label">Selection Date</span>
                        <span className="value">{new Date().toLocaleString()}</span>
                      </div>

                      <div className="meta-item">
                        <span className="label">Selected By</span>
                        <span className="value">John Buyer (Procurement Lead)</span>
                      </div>

                      <div className="meta-item">
                        <span className="label">Selection Reason</span>
                        <span className="value highlight-date">Lowest Bidder & Fast 7-Day Delivery</span>
                      </div>
                    </div>

                    <div className="meta-item" style={{ marginBottom: '16px' }}>
                      <span className="label">Procurement Comments</span>
                      <span className="value" style={{ background: 'white', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                        {evaluationComments || 'Selected based on lowest total commercial price and full technical compliance.'}
                      </span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#ffffff', padding: '12px 16px', borderRadius: '8px', border: '1px solid #93c5fd' }}>
                      <div style={{ fontSize: '12px', color: '#1e40af', fontWeight: 600 }}>
                        Workflow Progression: <strong>Quotation Comparison ➔ Supplier Selected ➔ PO Proposal Created ➔ Finance Approval</strong>
                      </div>

                      <button
                        type="button"
                        className="btn-primary"
                        disabled={submitting}
                        onClick={() => {
                          const targetSupp = suppliersList.find((x: any) => x.supplier_id === selectedSupplierId)
                          handleConfirmSupplierSelection(selectedSupplierId, targetSupp?.supplier_name || 'Supplier')
                        }}
                        style={{ background: '#16a34a', borderColor: '#15803d', padding: '10px 20px', fontSize: '14px' }}
                      >
                        {submitting ? 'Creating PO Proposal…' : '🏆 Confirm Selection & Submit PO for Finance Approval ➔'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Close Matrix
          </button>
        </div>
      </div>

      {/* Individual Quotation View Modal */}
      {viewingQuotation && (
        <div className="modal-backdrop" style={{ zIndex: 1100 }}>
          <div className="modal-content medium-modal">
            <div className="modal-header">
              <div>
                <div className="badge-tag">Quotation Inspection</div>
                <h2>{viewingQuotation.supplier_name} ({viewingQuotation.quotation_number || 'QUO-2026-001'})</h2>
              </div>
              <button className="close-btn" onClick={() => setViewingQuotation(null)}>&times;</button>
            </div>

            <div className="modal-body">
              <div className="grid-meta-box">
                <div className="meta-item">
                  <span className="label">Supplier</span>
                  <span className="value strong">{viewingQuotation.supplier_name}</span>
                </div>
                <div className="meta-item">
                  <span className="label">Code</span>
                  <span className="value"><code>{viewingQuotation.supplier_code}</code></span>
                </div>
                <div className="meta-item">
                  <span className="label">Lead Time</span>
                  <span className="value">{viewingQuotation.delivery_time_days || 7} Days</span>
                </div>
                <div className="meta-item">
                  <span className="label">Grand Total</span>
                  <span className="value highlight-date">${viewingQuotation.grand_total}</span>
                </div>
              </div>

              <div style={{ marginTop: '16px' }}>
                <strong style={{ fontSize: '13px', color: '#0f172a' }}>Payment Terms & Remarks:</strong>
                <p style={{ background: '#f8fafc', padding: '10px', borderRadius: '6px', fontSize: '12px', marginTop: '4px', border: '1px solid #e2e8f0' }}>
                  Payment Terms: {viewingQuotation.payment_terms || 'Net 30 Days'}<br />
                  Remarks: {viewingQuotation.remarks || 'Standard commercial quotation'}
                </p>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setViewingQuotation(null)}>
                Close View
              </button>
              <button className="btn-primary" onClick={() => handleDownloadQuotation(viewingQuotation)}>
                📥 Download Summary TXT
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
