import { FormEvent, useEffect, useState } from 'react'
import { MaterialRequest, procurementApi, SupplierItem } from '../../shared/procurementApi'

interface Props {
  request: MaterialRequest
  onClose: () => void
  onSuccess: (rfqNumber: string) => void
}

interface EditableRFQMaterialItem {
  material_code: string
  material_name: string
  category: string
  description: string
  quantity: number
  unit_of_measure: string
  required_delivery_date: string
  warehouse_id: string
  special_requirements: string
}

export default function CreateRFQModal({ request, onClose, onSuccess }: Props) {
  const [rfqNumber] = useState(() => {
    const year = new Date().getFullYear()
    const seq = Math.floor(1000 + Math.random() * 9000)
    return `RFQ-${year}-${seq}`
  })

  const [rfqDate] = useState(() => new Date().toISOString().split('T')[0])
  const [procurementOfficer, setProcurementOfficer] = useState('John Buyer (Procurement Officer)')
  const [requiredDeliveryDate, setRequiredDeliveryDate] = useState(request.target_delivery_date || '')
  const [validUntil, setValidUntil] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() + 7)
    return d.toISOString().split('T')[0]
  })
  const [remarks, setRemarks] = useState('Standard net 30 payment terms upon delivery & quality inspection.')

  // Editable RFQ Material Requirements for Procurement Review:
  const [rfqItems, setRfqItems] = useState<EditableRFQMaterialItem[]>(() => {
    return request.items.map((it) => ({
      material_code: it.material_code,
      material_name: it.material_name,
      category: it.category || 'Raw Materials',
      description: it.notes || `${it.material_name} specified for warehouse operations`,
      quantity: it.requested_qty,
      unit_of_measure: it.unit_of_measure || 'PCS',
      required_delivery_date: request.target_delivery_date,
      warehouse_id: request.warehouse_id,
      special_requirements: 'ASTM certification required; undamaged moisture-proof packaging.',
    }))
  })

  // Supplier Master State & Filters
  const [suppliers, setSuppliers] = useState<SupplierItem[]>([])
  const [selectedSupplierIds, setSelectedSupplierIds] = useState<string[]>([])
  
  // Specification Filters:
  const [searchNameCode, setSearchNameCode] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('ALL')
  const [materialFilter, setMaterialFilter] = useState('')
  const [locationFilter, setLocationFilter] = useState('ALL')

  const [loadingSuppliers, setLoadingSuppliers] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    procurementApi.listSuppliers().then((list) => {
      setSuppliers(list)
      if (list.length > 0) {
        setSelectedSupplierIds(list.slice(0, 2).map((s) => s.id))
      }
      setLoadingSuppliers(false)
    }).catch(() => setLoadingSuppliers(false))
  }, [])

  function updateItemField(index: number, field: keyof EditableRFQMaterialItem, value: any) {
    setRfqItems((prev) => {
      const copy = [...prev]
      copy[index] = { ...copy[index], [field]: value }
      return copy
    })
  }

  function toggleSupplier(id: string) {
    setSelectedSupplierIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    )
  }

  function toggleSelectAll() {
    if (selectedSupplierIds.length === filteredSuppliers.length) {
      setSelectedSupplierIds([])
    } else {
      setSelectedSupplierIds(filteredSuppliers.map((s) => s.id))
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (selectedSupplierIds.length === 0) {
      setError('Please select at least one supplier from the Supplier Master.')
      return
    }

    setError(null)
    setSubmitting(true)

    try {
      const invitedSuppliers = suppliers
        .filter((s) => selectedSupplierIds.includes(s.id))
        .map((s) => ({
          supplier_id: s.id,
          supplier_code: s.supplier_code,
          supplier_name: s.supplier_name,
          email: s.email,
        }))

      const rfq = await procurementApi.createRFQ({
        title: `RFQ ${rfqNumber} for PR #${request.request_number}`,
        warehouse_id: request.warehouse_id,
        due_date: validUntil,
        material_request_ids: [request.id],
        terms_and_conditions: remarks,
        items: rfqItems.map((it) => ({
          material_code: it.material_code,
          material_name: `${it.material_name} (${it.special_requirements})`,
          quantity: it.quantity,
          unit_of_measure: it.unit_of_measure,
        })),
        invited_suppliers: invitedSuppliers,
      })

      onSuccess(rfq.rfq_number || rfqNumber)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create RFQ')
    } finally {
      setSubmitting(false)
    }
  }

  // Filter Supplier Master records based on specification rules:
  const filteredSuppliers = suppliers.filter((s) => {
    if (searchNameCode.trim()) {
      const q = searchNameCode.toLowerCase()
      const matchName = s.supplier_name.toLowerCase().includes(q)
      const matchCode = s.supplier_code.toLowerCase().includes(q)
      if (!matchName && !matchCode) return false
    }

    if (categoryFilter !== 'ALL' && s.category !== categoryFilter) {
      return false
    }

    if (materialFilter.trim()) {
      const mat = materialFilter.toLowerCase()
      const matchMatList = s.materials_supplied?.some((m) => m.toLowerCase().includes(mat))
      const matchCat = s.category?.toLowerCase().includes(mat)
      if (!matchMatList && !matchCat) return false
    }

    if (locationFilter !== 'ALL') {
      if (!s.location || !s.location.toLowerCase().includes(locationFilter.toLowerCase())) {
        return false
      }
    }

    return true
  })

  const availableCategories = Array.from(new Set(suppliers.map((s) => s.category).filter(Boolean)))
  const availableLocations = Array.from(new Set(suppliers.map((s) => s.location ? s.location.split(',')[0].trim() : '').filter(Boolean)))

  return (
    <div className="modal-backdrop">
      <div className="modal-content large-modal">
        <div className="modal-header">
          <div>
            <div className="badge-tag">Procurement RFQ Creation & Review</div>
            <h2>Create RFQ ({rfqNumber})</h2>
          </div>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="card card-error">{error}</div>}

            <h3 className="section-heading" style={{ marginTop: 0 }}>1. RFQ Specifications</h3>
            <div className="form-grid">
              <div className="form-group">
                <label>RFQ Number (Auto Generated)</label>
                <input value={rfqNumber} disabled className="disabled-input font-bold" />
              </div>

              <div className="form-group">
                <label>RFQ Date</label>
                <input value={rfqDate} disabled className="disabled-input" />
              </div>

              <div className="form-group">
                <label>Raw Material Request Number</label>
                <input value={request.request_number} disabled className="disabled-input font-bold" />
              </div>

              <div className="form-group">
                <label>Warehouse</label>
                <input value={request.warehouse_id} disabled className="disabled-input" />
              </div>

              <div className="form-group">
                <label>Required Delivery Date</label>
                <input
                  type="date"
                  min={new Date().toISOString().split("T")[0]}
                  value={requiredDeliveryDate}
                  onChange={(e) => setRequiredDeliveryDate(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label>Procurement Officer</label>
                <input
                  value={procurementOfficer}
                  onChange={(e) => setProcurementOfficer(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label>RFQ Valid Until</label>
                <input
                  type="date"
                  min={new Date().toISOString().split("T")[0]}
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-group" style={{ marginTop: '12px' }}>
              <label>Remarks / General Terms & Instructions</label>
              <textarea
                rows={2}
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Specific delivery window, quality certificates, or payment terms"
              />
            </div>

            {/* Section 2: RFQ Material Requirements Review Table */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '24px' }}>
              <h3 className="section-heading" style={{ margin: 0 }}>2. RFQ Material Requirements (Procurement Review)</h3>
              <span className="text-xs" style={{ color: '#0ea5e9', fontWeight: 600 }}>
                ✏️ Review and customize requirements per material before sending
              </span>
            </div>

            <div className="table-wrapper mini-table" style={{ marginTop: '12px' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Material Code</th>
                    <th>Material Name & Description</th>
                    <th>Category</th>
                    <th className="num" style={{ width: '100px' }}>Req. Qty</th>
                    <th style={{ width: '90px' }}>UOM</th>
                    <th>Required Delivery Date</th>
                    <th>Warehouse</th>
                    <th>Special Requirements</th>
                  </tr>
                </thead>
                <tbody>
                  {rfqItems.map((item, idx) => (
                    <tr key={item.material_code + idx}>
                      <td><code>{item.material_code}</code></td>
                      <td>
                        <input
                          className="input-sm"
                          value={item.material_name}
                          onChange={(e) => updateItemField(idx, 'material_name', e.target.value)}
                        />
                        <div className="text-xs" style={{ marginTop: '2px', color: '#64748b' }}>{item.description}</div>
                      </td>
                      <td>
                        <span className="uom-tag">{item.category}</span>
                      </td>
                      <td className="num">
                        <input
                          type="number"
                          step="any"
                          className="input-sm num font-bold"
                          value={item.quantity}
                          onChange={(e) => updateItemField(idx, 'quantity', parseFloat(e.target.value) || 0)}
                        />
                      </td>
                      <td>
                        <select
                          className="select-sm"
                          value={item.unit_of_measure}
                          onChange={(e) => updateItemField(idx, 'unit_of_measure', e.target.value)}
                        >
                          <option value="KG">KG</option>
                          <option value="PCS">PCS</option>
                          <option value="METERS">METERS</option>
                          <option value="ROLL">ROLL</option>
                          <option value="BOX">BOX</option>
                        </select>
                      </td>
                      <td>
                        <input
                          type="date"
                          className="input-sm"
                          value={item.required_delivery_date}
                          onChange={(e) => updateItemField(idx, 'required_delivery_date', e.target.value)}
                        />
                      </td>
                      <td>
                        <span className="wh-badge">{item.warehouse_id}</span>
                      </td>
                      <td>
                        <input
                          className="input-sm"
                          value={item.special_requirements}
                          onChange={(e) => updateItemField(idx, 'special_requirements', e.target.value)}
                          placeholder="e.g. Test certificates, ASTM standard..."
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Section 3: Supplier Master Selection */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '24px' }}>
              <h3 className="section-heading" style={{ margin: 0 }}>3. Select Suppliers from Supplier Master</h3>
              <button
                type="button"
                className="btn-secondary"
                onClick={toggleSelectAll}
                style={{ padding: '4px 10px', fontSize: '12px' }}
              >
                {selectedSupplierIds.length === filteredSuppliers.length && filteredSuppliers.length > 0
                  ? 'Deselect All'
                  : 'Select All Filtered'}
              </button>
            </div>
            <p className="sub-text">Search and filter active vendors from central Supplier Master without creating duplicate entries.</p>

            <div className="supplier-selection-box">
              <div className="supplier-filter-grid">
                <div className="form-group">
                  <label className="text-xs">Search Name / Code</label>
                  <input
                    className="input-sm"
                    placeholder="Search name or code..."
                    value={searchNameCode}
                    onChange={(e) => setSearchNameCode(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="text-xs">Filter by Category</label>
                  <select
                    className="select-sm"
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                  >
                    <option value="ALL">All Categories</option>
                    {availableCategories.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="text-xs">Filter by Material</label>
                  <input
                    className="input-sm"
                    placeholder="e.g. Copper, Valves..."
                    value={materialFilter}
                    onChange={(e) => setMaterialFilter(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="text-xs">Filter by Location</label>
                  <select
                    className="select-sm"
                    value={locationFilter}
                    onChange={(e) => setLocationFilter(e.target.value)}
                  >
                    <option value="ALL">All Locations</option>
                    {availableLocations.map((loc) => (
                      <option key={loc} value={loc}>{loc}</option>
                    ))}
                  </select>
                </div>
              </div>

              {loadingSuppliers ? (
                <div className="loading-state">Loading active Supplier Master records…</div>
              ) : filteredSuppliers.length === 0 ? (
                <div className="empty-state-sm">No suppliers matched your search criteria.</div>
              ) : (
                <div className="supplier-list">
                  {filteredSuppliers.map((s) => {
                    const isSelected = selectedSupplierIds.includes(s.id)
                    return (
                      <div
                        key={s.id}
                        className={`supplier-card-item ${isSelected ? 'selected' : ''}`}
                        onClick={() => toggleSupplier(s.id)}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                        />
                        <div className="supplier-info">
                          <div className="supp-header-line">
                            <span className="supp-name">{s.supplier_name}</span>
                            <span className="supp-code-badge"><code>{s.supplier_code}</code></span>
                            {s.performance_tier && (
                              <span className={`tier-badge tier-${s.performance_tier.toLowerCase()}`}>
                                {s.performance_tier}
                              </span>
                            )}
                          </div>

                          <div className="supp-meta-line">
                            <span><strong>Category:</strong> {s.category || 'General'}</span>
                            <span>•</span>
                            <span><strong>Location:</strong> {s.location || 'N/A'}</span>
                          </div>

                          {s.materials_supplied && s.materials_supplied.length > 0 && (
                            <div className="supp-materials-line">
                              <strong>Supplies:</strong> {s.materials_supplied.join(', ')}
                            </div>
                          )}

                          <div className="supp-performance-row">
                            <span className="perf-metric">
                              On-Time Delivery: <strong>{s.on_time_delivery_rate ?? 98.0}%</strong>
                            </span>
                            <span className="perf-metric">
                              Quality Score: <strong>{s.quality_score ?? 4.8} / 5.0</strong>
                            </span>
                          </div>
                        </div>

                        <div className="supp-rating-box">
                          <div className="stars">⭐ {s.rating?.toFixed(1) || '5.0'}</div>
                          <div className="rating-sub">Master Score</div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              <div className="selected-summary">
                <strong>Selected for RFQ ({selectedSupplierIds.length} Suppliers):</strong>
                {selectedSupplierIds.map((id) => {
                  const s = suppliers.find((x) => x.id === id)
                  return s ? (
                    <span key={id} className="selected-chip" onClick={() => toggleSupplier(id)}>
                      ☑ {s.supplier_name} &times;
                    </span>
                  ) : null
                })}
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? 'Publishing & Sending Emails…' : `🚀 Publish & Send RFQ (${rfqNumber})`}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
