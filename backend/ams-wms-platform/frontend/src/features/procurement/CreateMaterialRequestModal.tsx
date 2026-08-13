import { FormEvent, useState } from 'react'
import { procurementApi } from '../../shared/procurementApi'

interface Props {
  onClose: () => void
  onSuccess: () => void
}

interface MaterialRow {
  material_code: string
  material_name: string
  quantity: string
  unit_of_measure: string
  estimated_unit_cost: string
  category: string
  notes: string
}

export default function CreateMaterialRequestModal({ onClose, onSuccess }: Props) {
  const [warehouseId, setWarehouseId] = useState('WH-CENTRAL')
  const [department, setDepartment] = useState('Production Operations')
  const [requestedBy, setRequestedBy] = useState('Operator Sam')
  const [priority, setPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>('HIGH')
  const [targetDeliveryDate, setTargetDeliveryDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() + 14)
    return d.toISOString().split('T')[0]
  })

  // Support multiple materials in one request
  const [items, setItems] = useState<MaterialRow[]>([
    {
      material_code: 'COPPER-ROD-01',
      material_name: 'Copper Rod 10mm Heavy Duty',
      quantity: '100',
      unit_of_measure: 'KG',
      estimated_unit_cost: '8.50',
      category: 'Raw Materials',
      notes: 'Urgent requisition for Q3 assembly run',
    },
  ])

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function addMaterialRow() {
    setItems((prev) => [
      ...prev,
      {
        material_code: `MAT-${Math.floor(100 + Math.random() * 900)}`,
        material_name: '',
        quantity: '10',
        unit_of_measure: 'PCS',
        estimated_unit_cost: '0.00',
        category: 'Raw Materials',
        notes: '',
      },
    ])
  }

  function removeMaterialRow(index: number) {
    if (items.length <= 1) return
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  function updateItemField(index: number, field: keyof MaterialRow, val: string) {
    setItems((prev) => {
      const copy = [...prev]
      copy[index] = { ...copy[index], [field]: val }
      return copy
    })
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (items.some((i) => !i.material_code || !i.material_name || !i.quantity)) {
      setError('Please fill in material code, name, and quantity for all items.')
      return
    }

    setError(null)
    setSubmitting(true)

    try {
      await procurementApi.createMaterialRequest({
        warehouse_id: warehouseId,
        department,
        requested_by: requestedBy,
        target_delivery_date: targetDeliveryDate,
        priority,
        items: items.map((it) => ({
          material_code: it.material_code,
          material_name: it.material_name,
          requested_qty: parseFloat(it.quantity) || 1,
          unit_of_measure: it.unit_of_measure || 'PCS',
          estimated_unit_cost: parseFloat(it.estimated_unit_cost) || 0,
          category: it.category || 'Raw Materials',
          notes: it.notes,
        })),
      })
      onSuccess()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create Raw Material Request')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-content large-modal">
        <div className="modal-header">
          <div>
            <div className="badge-tag">Warehouse Requisition</div>
            <h2>New Raw Material Request (Multiple Materials Supported)</h2>
          </div>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="card card-error">{error}</div>}

            <h3 className="section-heading" style={{ marginTop: 0 }}>Request Information</h3>
            <div className="form-grid">
              <div className="form-group">
                <label>Warehouse</label>
                <select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
                  <option value="WH-CENTRAL">WH-CENTRAL (Central Hub)</option>
                  <option value="WH-NORTH">WH-NORTH (North Facility)</option>
                  <option value="WH-SOUTH">WH-SOUTH (South Plant)</option>
                </select>
              </div>

              <div className="form-group">
                <label>Department</label>
                <input value={department} onChange={(e) => setDepartment(e.target.value)} required />
              </div>

              <div className="form-group">
                <label>Requested By</label>
                <input value={requestedBy} onChange={(e) => setRequestedBy(e.target.value)} required />
              </div>

              <div className="form-group">
                <label>Priority</label>
                <select value={priority} onChange={(e) => setPriority(e.target.value as any)}>
                  <option value="LOW">LOW</option>
                  <option value="MEDIUM">MEDIUM</option>
                  <option value="HIGH">HIGH</option>
                  <option value="CRITICAL">CRITICAL</option>
                </select>
              </div>

              <div className="form-group">
                <label>Required By Date</label>
                <input
                  type="date"
                  value={targetDeliveryDate}
                  onChange={(e) => setTargetDeliveryDate(e.target.value)}
                  required
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '24px' }}>
              <h3 className="section-heading" style={{ margin: 0 }}>Material Requirements ({items.length} Materials)</h3>
              <button type="button" className="btn-secondary" onClick={addMaterialRow} style={{ padding: '4px 10px', fontSize: '12px' }}>
                + Add Another Material
              </button>
            </div>

            {items.map((item, idx) => (
              <div key={idx} className="material-row-box" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px', marginTop: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <strong style={{ fontSize: '13px', color: '#0f172a' }}>Material Line #{idx + 1}</strong>
                  {items.length > 1 && (
                    <button type="button" onClick={() => removeMaterialRow(idx)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>
                      &times; Remove Item
                    </button>
                  )}
                </div>

                <div className="form-grid">
                  <div className="form-group">
                    <label>Material Code</label>
                    <input value={item.material_code} onChange={(e) => updateItemField(idx, 'material_code', e.target.value)} required />
                  </div>

                  <div className="form-group span-2">
                    <label>Material Description</label>
                    <input value={item.material_name} onChange={(e) => updateItemField(idx, 'material_name', e.target.value)} required placeholder="e.g. Copper Rod 10mm" />
                  </div>

                  <div className="form-group">
                    <label>Category</label>
                    <input value={item.category} onChange={(e) => updateItemField(idx, 'category', e.target.value)} placeholder="e.g. Raw Materials, Plumbing" />
                  </div>

                  <div className="form-group">
                    <label>Quantity</label>
                    <input type="number" step="any" value={item.quantity} onChange={(e) => updateItemField(idx, 'quantity', e.target.value)} required />
                  </div>

                  <div className="form-group">
                    <label>UOM</label>
                    <select value={item.unit_of_measure} onChange={(e) => updateItemField(idx, 'unit_of_measure', e.target.value)}>
                      <option value="KG">KG (Kilograms)</option>
                      <option value="PCS">PCS (Pieces)</option>
                      <option value="METERS">METERS</option>
                      <option value="ROLL">ROLL</option>
                      <option value="BOX">BOX</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Est. Unit Cost ($)</label>
                    <input type="number" step="any" value={item.estimated_unit_cost} onChange={(e) => updateItemField(idx, 'estimated_unit_cost', e.target.value)} />
                  </div>

                  <div className="form-group span-2">
                    <label>Remarks / Notes</label>
                    <input value={item.notes} onChange={(e) => updateItemField(idx, 'notes', e.target.value)} placeholder="Specific grade or technical specs" />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? 'Creating Request…' : `Submit Request (${items.length} Materials)`}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
