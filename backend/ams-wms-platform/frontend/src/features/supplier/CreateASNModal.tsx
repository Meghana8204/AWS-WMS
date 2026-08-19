import { useEffect, useState } from 'react'
import { procurementApi } from '../../shared/procurementApi'

interface CreateASNModalProps {
  initialPoNumber?: string
  onClose: () => void
  onSuccess: (asnNumber: string) => void
}

export default function CreateASNModal({ initialPoNumber, onClose, onSuccess }: CreateASNModalProps) {
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([])
  const [selectedPoNumber, setSelectedPoNumber] = useState<string>(initialPoNumber || 'PO-2026-0001')
  
  // Auto-generated ASN Number with format ASN-YYYY-XXXX (e.g. ASN-2026-0001)
  const currentYear = new Date().getFullYear()
  const [asnNumber] = useState<string>(`ASN-${currentYear}-0001`)

  const [supplierName, setSupplierName] = useState<string>('Vertex Metals Corp')

  // ALL 9 MANDATORY ASN SHIPMENT DETAILS FIELDS
  const [shipmentDate, setShipmentDate] = useState<string>('2026-08-18')
  const [expectedArrivalDate, setExpectedArrivalDate] = useState<string>('2026-08-25')
  const [transporter, setTransporter] = useState<string>('Apex Logistics Corp')
  const [vehicleNumber, setVehicleNumber] = useState<string>('IL-02-B-9988')
  const [driverName, setDriverName] = useState<string>('Robert Vance')
  const [driverContact, setDriverContact] = useState<string>('+1 555 0199')
  const [numberOfPackages, setNumberOfPackages] = useState<string>('12 Pallets')
  const [packageType, setPackageType] = useState<string>('Palletized Heavy Duty')
  const [shippingMethod, setShippingMethod] = useState<string>('FTL - Full Truck Load')

  // Tracking # (LR #)
  const [trackingNumber, setTrackingNumber] = useState<string>('LR-2026-9921')

  // Attachments
  const [attachments, setAttachments] = useState<any[]>([])
  const [uploading, setUploading] = useState(false)

  // Line items
  const [items, setItems] = useState<any[]>([
    {
      material_code: 'COPPER-ROD-01',
      material_name: 'Copper Rod 10mm Heavy Duty',
      ordered_quantity: 100,
      shipped_quantity: 100,
      unit_of_measure: 'KG',
    },
  ])

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchPOs() {
      try {
        const list = await procurementApi.listPurchaseOrders()
        setPurchaseOrders(list)
        
        if (initialPoNumber) {
          const matched = list.find((p) => p.po_number === initialPoNumber || p.id === initialPoNumber)
          if (matched && matched.supplier_info?.supplier_name) {
            setSupplierName(matched.supplier_info.supplier_name)
          }
        }
      } catch (err) {
        console.warn('Failed to load purchase orders for ASN:', err)
      }
    }
    fetchPOs()
  }, [initialPoNumber])

  function handlePoChange(poNum: string) {
    setSelectedPoNumber(poNum)
    const po = purchaseOrders.find((p) => p.po_number === poNum)
    if (po) {
      if (po.supplier_info?.supplier_name) setSupplierName(po.supplier_info.supplier_name)
      if (po.expected_delivery_date) setExpectedArrivalDate(po.expected_delivery_date)
      if (po.items && po.items.length > 0) {
        setItems(
          po.items.map((it: any) => ({
            material_code: it.material_code,
            material_name: it.material_name,
            ordered_quantity: it.quantity || 100,
            shipped_quantity: it.quantity || 100,
            unit_of_measure: it.unit_of_measure || 'PCS',
          }))
        )
      }
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setError(null)
    try {
      // @ts-ignore - Assuming procurementApi has uploadASNAttachment from my update to api-client.ts
      const uploaded = await procurementApi.uploadASNAttachment(file)
      setAttachments((prev) => [...prev, uploaded])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload attachment')
    } finally {
      setUploading(false)
    }
  }

  function removeAttachment(id: string) {
    setAttachments((prev) => prev.filter((a) => a.id !== id))
  }


  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedPoNumber) {
      setError('Please select a Purchase Order.')
      return
    }
    if (!shipmentDate || !expectedArrivalDate) {
      setError('Shipment Date and Expected Arrival Date are mandatory.')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const payload = {
        asn_number: asnNumber,
        po_number: selectedPoNumber,
        supplier_id: 'supp-101',
        supplier_name: supplierName,
        shipment_date: shipmentDate,
        expected_arrival_date: expectedArrivalDate,
        transporter,
        vehicle_number: vehicleNumber,
        driver_name: driverName,
        driver_contact: driverContact,
        number_of_packages: numberOfPackages,
        package_type: packageType,
        shipping_method: shippingMethod,
        tracking_number: trackingNumber,
        attachments,
        items,
      }

      await procurementApi.createASN(payload)
      onSuccess(asnNumber)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit Advance Shipment Notice')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-backdrop" style={{ zIndex: 1100 }}>
      <div className="modal-content large-modal" style={{ maxWidth: '960px', maxHeight: '92vh', overflowY: 'auto' }}>
        {/* Header */}
        <div
          className="modal-header"
          style={{
            background: '#0f172a',
            color: 'white',
            padding: '20px 24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <div style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: '#10b981', letterSpacing: '1px' }}>
              PAGE 3 — SUPPLIER PORTAL
            </div>
            <h2 style={{ margin: '2px 0 0 0', fontSize: '22px', fontWeight: 800 }}>
              Create Advance Shipment Notice (ASN)
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

          {/* SECTION 1: ASN INFORMATION */}
          <div>
            <div style={{ borderBottom: '2px solid #10b981', paddingBottom: '6px', marginBottom: '14px' }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                1. ASN Header Information
              </h3>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>
                  ASN Number (Auto Generated) *
                </label>
                <input
                  type="text"
                  value={asnNumber}
                  disabled
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    background: '#f8fafc',
                    color: '#059669',
                    fontWeight: 800,
                    fontFamily: 'monospace',
                    fontSize: '14px',
                  }}
                />
                <span style={{ fontSize: '11px', color: '#64748b' }}>Format: ASN-YYYY-XXXX (Example: ASN-2026-0001)</span>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>
                  PO Number *
                </label>
                <select
                  value={selectedPoNumber}
                  onChange={(e) => handlePoChange(e.target.value)}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', fontWeight: 600 }}
                  required
                >
                  {purchaseOrders.map((p) => (
                    <option key={p.id} value={p.po_number}>
                      {p.po_number} — {p.supplier_info?.supplier_name || 'Supplier'} ({p.warehouse_id})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>
                  Supplier Name *
                </label>
                <input
                  type="text"
                  value={supplierName}
                  disabled
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#f8fafc', fontSize: '13px', fontWeight: 700 }}
                />
              </div>
            </div>
          </div>

          {/* SECTION 2: ASN SHIPMENT DETAILS (ALL 9 REQUIRED FIELDS) */}
          <div>
            <div style={{ borderBottom: '2px solid #10b981', paddingBottom: '6px', marginBottom: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                2. ASN Shipment Details (Mandatory Logistics Attributes)
              </h3>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#047857', background: '#dcfce7', padding: '3px 8px', borderRadius: '4px' }}>
                9 / 9 Logistics Fields
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '10px', padding: '18px' }}>
              {/* Field 1: Shipment Date */}
              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a', display: 'block', marginBottom: '4px' }}>1. Shipment Date *</label>
                <input
                  type="date"
                  min={new Date().toISOString().split("T")[0]}
                  value={shipmentDate}
                  onChange={(e) => setShipmentDate(e.target.value)}
                  style={{ width: '100%', padding: '9px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                  required
                />
              </div>

              {/* Field 2: Expected Arrival Date */}
              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a', display: 'block', marginBottom: '4px' }}>2. Expected Arrival Date *</label>
                <input
                  type="date"
                  min={new Date().toISOString().split("T")[0]}
                  value={expectedArrivalDate}
                  onChange={(e) => setExpectedArrivalDate(e.target.value)}
                  style={{ width: '100%', padding: '9px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                  required
                />
              </div>

              {/* Field 3: Transporter */}
              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a', display: 'block', marginBottom: '4px' }}>3. Transporter *</label>
                <input
                  type="text"
                  value={transporter}
                  onChange={(e) => setTransporter(e.target.value)}
                  placeholder="Apex Logistics Corp"
                  style={{ width: '100%', padding: '9px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                  required
                />
              </div>

              {/* Field 4: Vehicle Number */}
              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a', display: 'block', marginBottom: '4px' }}>4. Vehicle Number *</label>
                <input
                  type="text"
                  value={vehicleNumber}
                  onChange={(e) => setVehicleNumber(e.target.value)}
                  placeholder="IL-02-B-9988"
                  style={{ width: '100%', padding: '9px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', fontFamily: 'monospace' }}
                  required
                />
              </div>

              {/* Field 5: Driver Name */}
              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a', display: 'block', marginBottom: '4px' }}>5. Driver Name *</label>
                <input
                  type="text"
                  value={driverName}
                  onChange={(e) => setDriverName(e.target.value)}
                  placeholder="Robert Vance"
                  style={{ width: '100%', padding: '9px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                  required
                />
              </div>

              {/* Field 6: Driver Contact */}
              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a', display: 'block', marginBottom: '4px' }}>6. Driver Contact *</label>
                <input
                  type="text"
                  value={driverContact}
                  onChange={(e) => setDriverContact(e.target.value)}
                  placeholder="+1 555 0199"
                  style={{ width: '100%', padding: '9px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                  required
                />
              </div>

              {/* Field 7: Number of Packages */}
              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a', display: 'block', marginBottom: '4px' }}>7. Number of Packages *</label>
                <input
                  type="text"
                  value={numberOfPackages}
                  onChange={(e) => setNumberOfPackages(e.target.value)}
                  placeholder="12 Pallets"
                  style={{ width: '100%', padding: '9px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                  required
                />
              </div>

              {/* Field 8: Package Type */}
              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a', display: 'block', marginBottom: '4px' }}>8. Package Type *</label>
                <select
                  value={packageType}
                  onChange={(e) => setPackageType(e.target.value)}
                  style={{ width: '100%', padding: '9px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                  required
                >
                  <option value="Palletized Heavy Duty">Palletized Heavy Duty</option>
                  <option value="Wooden Crate">Wooden Crate</option>
                  <option value="Corrugated Cardboard Box">Corrugated Cardboard Box</option>
                  <option value="Steel Drum">Steel Drum</option>
                  <option value="Container Loose Pack">Container Loose Pack</option>
                </select>
              </div>

              {/* Field 9: Shipping Method */}
              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a', display: 'block', marginBottom: '4px' }}>9. Shipping Method *</label>
                <select
                  value={shippingMethod}
                  onChange={(e) => setShippingMethod(e.target.value)}
                  style={{ width: '100%', padding: '9px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                  required
                >
                  <option value="FTL - Full Truck Load">FTL - Full Truck Load</option>
                  <option value="LTL - Less Than Truckload">LTL - Less Than Truckload</option>
                  <option value="Air Express Cargo">Air Express Cargo</option>
                  <option value="Dedicated Express Courier">Dedicated Express Courier</option>
                </select>
              </div>
            </div>
          </div>

          {/* SECTION: ATTACHMENTS (Real-time Upload) */}
          <div>
            <div style={{ borderBottom: '2px solid #10b981', paddingBottom: '6px', marginBottom: '14px' }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                3. Shipping Documents & Attachments
              </h3>
            </div>

            <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '10px', padding: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <label
                  style={{
                    background: '#0ea5e9',
                    color: 'white',
                    padding: '8px 16px',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: uploading ? 'not-allowed' : 'pointer',
                    display: 'inline-block',
                    opacity: uploading ? 0.6 : 1,
                  }}
                >
                  {uploading ? '⌛ Uploading...' : '📎 Upload Document (Real-time)'}
                  <input
                    type="file"
                    onChange={handleFileUpload}
                    disabled={uploading}
                    style={{ display: 'none' }}
                  />
                </label>
                <span style={{ fontSize: '12px', color: '#64748b' }}>
                  Upload Lorry Receipt (LR), Packing List, or Quality Reports. Files are saved to backend immediately.
                </span>
              </div>

              {attachments.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {attachments.map((att) => (
                    <div
                      key={att.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        background: 'white',
                        border: '1px solid #e2e8f0',
                        padding: '8px 12px',
                        borderRadius: '8px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '16px' }}>📄</span>
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b' }}>{att.filename}</div>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>
                            {(att.file_size_bytes / 1024).toFixed(1)} KB • {att.category}
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeAttachment(att.id)}
                        style={{ background: 'transparent', border: 'none', color: '#ef4444', fontSize: '18px', cursor: 'pointer' }}
                      >
                        &times;
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* SECTION 3: SHIPPED LINE ITEMS */}
          <div>
            <div style={{ borderBottom: '2px solid #10b981', paddingBottom: '6px', marginBottom: '14px' }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                4. Shipped Line Items
              </h3>
            </div>

            <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontSize: '11px', color: '#475569', textTransform: 'uppercase' }}>
                    <th style={{ textAlign: 'left', padding: '10px 14px' }}>Material Code & Name</th>
                    <th style={{ textAlign: 'center', padding: '10px 14px' }}>UOM</th>
                    <th style={{ textAlign: 'right', padding: '10px 14px' }}>PO Ordered Qty</th>
                    <th style={{ textAlign: 'right', padding: '10px 14px', width: '160px' }}>Shipped Qty *</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px 14px' }}>
                        <strong style={{ color: '#0f172a', display: 'block' }}>{item.material_name}</strong>
                        <code style={{ fontSize: '11px', color: '#64748b' }}>{item.material_code}</code>
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                        <span style={{ background: '#e2e8f0', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 700 }}>
                          {item.unit_of_measure}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600, color: '#475569' }}>
                        {Math.floor(item.ordered_quantity)}
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                        <div style={{
                          padding: '6px 10px',
                          borderRadius: '6px',
                          background: '#f1f5f9',
                          border: '1px solid #cbd5e1',
                          fontWeight: 800,
                          color: '#059669',
                          fontSize: '13px'
                        }}>
                          {item.shipped_quantity}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
              {submitting ? 'Submitting ASN...' : '🚀 [Submit Advance Shipment Notice ➔]'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
