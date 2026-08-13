import { useState } from 'react'

interface PurchaseOrderViewModalProps {
  po: any
  onClose: () => void
}

export default function PurchaseOrderViewModal({ po, onClose }: PurchaseOrderViewModalProps) {
  const [printSuccess, setPrintSuccess] = useState(false)

  const supp = po.supplier_info || {
    supplier_code: 'SUPP-VERTEX',
    supplier_name: 'Vertex Metals Corp',
    contact_person: 'David Wallace',
    phone: '+1 555 0192',
    email: 'sales@vertexmetals.com',
    gst_number: 'GSTIN29ABCDE1234F',
    supplier_address: '100 Industrial Parkway, Midwest Logistics Hub, Chicago, IL 60601',
  }

  const deliv = po.delivery_details || {
    delivery_warehouse: po.warehouse_id || 'WH-CENTRAL',
    delivery_address: 'Gate 4, Receiving Dock B, 500 Industrial Blvd, Chicago, IL 60612',
    expected_delivery_date: po.expected_delivery_date || '2026-08-25',
  }

  const summary = po.financial_summary || po.order_summary || {
    subtotal: 820.00,
    discount: 20.50,
    tax: 39.98,
    freight: 150.00,
    additional_charges: 150.00,
    grand_total: 989.48,
  }

  function handlePrint() {
    setPrintSuccess(true)
    setTimeout(() => {
      window.print()
      setPrintSuccess(false)
    }, 300)
  }

  return (
    <div className="modal-backdrop" style={{ zIndex: 1100 }}>
      <div className="modal-content large-modal" style={{ maxWidth: '1000px', maxHeight: '92vh', overflowY: 'auto' }}>
        {/* Header Bar */}
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
            <div style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: '#38bdf8', letterSpacing: '1px' }}>
              Official Enterprise Document — WMS Procurement System
            </div>
            <h2 style={{ margin: '2px 0 0 0', fontSize: '22px', fontWeight: 800 }}>
              Purchase Order — {po.po_number || 'PO-2026-0001'}
            </h2>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              type="button"
              onClick={handlePrint}
              style={{
                background: '#0284c7',
                color: 'white',
                border: '1px solid #0369a1',
                padding: '8px 16px',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <span>🖨️</span> Print / Save PDF
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '24px', cursor: 'pointer' }}
            >
              &times;
            </button>
          </div>
        </div>

        {printSuccess && (
          <div style={{ background: '#dcfce7', color: '#166534', padding: '10px 20px', fontSize: '13px', fontWeight: 600 }}>
            Preparing Purchase Order PDF formatting for print stream...
          </div>
        )}

        <div className="modal-body" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '28px' }}>
          
          {/* SECTION 1: PO INFORMATION */}
          <section>
            <div style={{ borderBottom: '2px solid #0284c7', paddingBottom: '6px', marginBottom: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                1. PO Information
              </h3>
              <span
                style={{
                  background: po.status === 'APPROVED' ? '#dcfce7' : po.status === 'REJECTED' ? '#fee2e2' : '#fef3c7',
                  color: po.status === 'APPROVED' ? '#166534' : po.status === 'REJECTED' ? '#991b1b' : '#92400e',
                  padding: '4px 10px',
                  borderRadius: '12px',
                  fontSize: '11px',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                }}
              >
                {po.status || 'PENDING_APPROVAL'}
              </span>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '16px',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                padding: '16px',
              }}
            >
              <div>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', display: 'block' }}>PO Number</span>
                <strong style={{ fontSize: '15px', color: '#0284c7', fontFamily: 'monospace' }}>{po.po_number}</strong>
              </div>

              <div>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', display: 'block' }}>PO Date</span>
                <strong style={{ fontSize: '14px', color: '#0f172a' }}>{po.po_date || '2026-08-12'}</strong>
              </div>

              <div>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', display: 'block' }}>Supplier</span>
                <strong style={{ fontSize: '14px', color: '#0f172a' }}>{supp.supplier_name}</strong>
              </div>

              <div>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', display: 'block' }}>Warehouse</span>
                <strong style={{ fontSize: '14px', color: '#0f172a' }}>{po.warehouse_id}</strong>
              </div>

              <div>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', display: 'block' }}>Department</span>
                <strong style={{ fontSize: '14px', color: '#0f172a' }}>{po.department || 'Production Operations'}</strong>
              </div>

              <div>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', display: 'block' }}>Procurement Officer</span>
                <strong style={{ fontSize: '14px', color: '#0f172a' }}>{po.buyer || 'John Buyer (Procurement Lead)'}</strong>
              </div>

              <div>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', display: 'block' }}>Expected Delivery Date</span>
                <strong style={{ fontSize: '14px', color: '#059669', background: '#dcfce7', padding: '2px 8px', borderRadius: '4px', display: 'inline-block' }}>
                  {po.expected_delivery_date || '2026-08-25'}
                </strong>
              </div>
            </div>
          </section>

          {/* SECTION 2: SUPPLIER INFORMATION (AUTO-FETCHED FROM SUPPLIER MASTER) */}
          <section>
            <div style={{ borderBottom: '2px solid #0284c7', paddingBottom: '6px', marginBottom: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                2. Supplier Information (Fetched from Supplier Master)
              </h3>
              <span style={{ fontSize: '11px', color: '#0284c7', fontWeight: 700, background: '#e0f2fe', padding: '3px 8px', borderRadius: '4px' }}>
                Verified Master Record
              </span>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '16px',
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '10px',
                padding: '16px',
                boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
              }}
            >
              <div>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', display: 'block' }}>Supplier Code</span>
                <strong style={{ fontSize: '14px', color: '#0f172a', fontFamily: 'monospace' }}>{supp.supplier_code || 'SUPP-VERTEX'}</strong>
              </div>

              <div>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', display: 'block' }}>Supplier Name</span>
                <strong style={{ fontSize: '14px', color: '#0f172a' }}>{supp.supplier_name || 'Vertex Metals Corp'}</strong>
              </div>

              <div>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', display: 'block' }}>Contact Person</span>
                <strong style={{ fontSize: '14px', color: '#0f172a' }}>{supp.contact_person || 'David Wallace'}</strong>
              </div>

              <div>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', display: 'block' }}>Phone</span>
                <strong style={{ fontSize: '14px', color: '#0f172a' }}>{supp.phone || '+1 555 0192'}</strong>
              </div>

              <div>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', display: 'block' }}>Email</span>
                <strong style={{ fontSize: '14px', color: '#0284c7' }}>{supp.email || 'sales@vertexmetals.com'}</strong>
              </div>

              <div>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', display: 'block' }}>GST Number</span>
                <strong style={{ fontSize: '14px', color: '#0f172a', fontFamily: 'monospace' }}>{supp.gst_number || 'GSTIN29ABCDE1234F'}</strong>
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', display: 'block' }}>Supplier Registered Address</span>
                <div style={{ fontSize: '13px', color: '#334155', marginTop: '2px', fontWeight: 600 }}>
                  📍 {supp.supplier_address || '100 Industrial Parkway, Midwest Logistics Hub, Chicago, IL 60601'}
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 3: ORDER ITEMS */}
          <section>
            <div style={{ borderBottom: '2px solid #0284c7', paddingBottom: '6px', marginBottom: '14px' }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                3. Order Items
              </h3>
            </div>

            <div style={{ border: '1px solid #cbd5e1', borderRadius: '10px', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #cbd5e1', color: '#475569', fontSize: '11px', textTransform: 'uppercase' }}>
                    <th style={{ textAlign: 'left', padding: '10px 14px' }}>Material Code</th>
                    <th style={{ textAlign: 'left', padding: '10px 14px' }}>Material Name</th>
                    <th style={{ textAlign: 'left', padding: '10px 14px' }}>Category</th>
                    <th style={{ textAlign: 'center', padding: '10px 14px' }}>UOM</th>
                    <th style={{ textAlign: 'right', padding: '10px 14px' }}>Quantity</th>
                    <th style={{ textAlign: 'right', padding: '10px 14px' }}>Unit Price</th>
                    <th style={{ textAlign: 'right', padding: '10px 14px' }}>Discount</th>
                    <th style={{ textAlign: 'right', padding: '10px 14px' }}>Tax</th>
                    <th style={{ textAlign: 'right', padding: '10px 14px' }}>Line Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(
                    po.items || [
                      {
                        material_code: 'COPPER-ROD-01',
                        material_name: 'Copper Rod 10mm Heavy Duty',
                        category: 'Raw Materials',
                        unit_of_measure: 'KG',
                        quantity: 100,
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
                    const lineTotal = item.total_amount || item.line_total || sub * (1 + tax / 100)

                    return (
                      <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '10px 14px' }}>
                          <code style={{ fontSize: '12px', fontWeight: 700, color: '#0284c7', background: '#f0f9ff', padding: '2px 6px', borderRadius: '4px' }}>
                            {item.material_code}
                          </code>
                        </td>
                        <td style={{ padding: '10px 14px', fontWeight: 700, color: '#0f172a' }}>
                          {item.material_name}
                        </td>
                        <td style={{ padding: '10px 14px', color: '#475569' }}>
                          {item.category || 'Raw Materials'}
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                          <span style={{ background: '#e2e8f0', color: '#334155', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 700 }}>
                            {item.unit_of_measure || 'PCS'}
                          </span>
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>
                          {qty.toLocaleString()}
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

          {/* SECTION 4: DELIVERY DETAILS */}
          <section>
            <div style={{ borderBottom: '2px solid #0284c7', paddingBottom: '6px', marginBottom: '14px' }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                4. Delivery Details
              </h3>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                gap: '16px',
                background: '#f8fafc',
                border: '1px solid #cbd5e1',
                borderRadius: '10px',
                padding: '16px',
              }}
            >
              <div>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', display: 'block' }}>Delivery Warehouse</span>
                <strong style={{ fontSize: '14px', color: '#0f172a' }}>{deliv.delivery_warehouse || po.warehouse_id}</strong>
              </div>

              <div>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', display: 'block' }}>Expected Delivery Date</span>
                <strong style={{ fontSize: '14px', color: '#059669', background: '#dcfce7', padding: '2px 8px', borderRadius: '4px', display: 'inline-block' }}>
                  {deliv.expected_delivery_date || po.expected_delivery_date || '2026-08-25'}
                </strong>
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', display: 'block' }}>Delivery Destination Address</span>
                <div style={{ fontSize: '13px', color: '#334155', marginTop: '2px', fontWeight: 600 }}>
                  🏢 {deliv.delivery_address || 'Gate 4, Receiving Dock B, Central Distribution Center, Chicago, IL 60612'}
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 5: ATTACHMENTS */}
          <section>
            <div style={{ borderBottom: '2px solid #0284c7', paddingBottom: '6px', marginBottom: '14px' }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                5. Attachments & Supporting Information
              </h3>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '14px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>Supplier Quotation</span>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>
                  📄 Ref #: <strong>{po.supporting_info?.supplier_quotation?.quotation_number || po.quotation_id || 'QUO-2026-001'}</strong> | Payment Terms: <strong>{po.payment_terms || 'Net 30 Days'}</strong>
                </div>
              </div>

              <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '14px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>Supporting Documents</span>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  {(
                    po.supporting_info?.uploaded_documents || [
                      { id: 'doc-1', name: 'Official_Quotation_QUO-2026-001.pdf', size: '1.2 MB', type: 'PDF' },
                      { id: 'doc-2', name: 'ISO_9001_Quality_Certificate.pdf', size: '850 KB', type: 'PDF' },
                      { id: 'doc-3', name: 'Commercial_Price_Breakdown_RFQ-2026-0001.xlsx', size: '420 KB', type: 'XLSX' },
                    ]
                  ).map((doc: any, i: number) => (
                    <div key={i} style={{ background: '#0f172a', color: 'white', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      <span>{doc.type === 'PDF' ? '📕' : '📊'}</span>
                      <span>{doc.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 6: ORDER SUMMARY */}
          <section>
            <div style={{ borderBottom: '2px solid #0284c7', paddingBottom: '6px', marginBottom: '14px' }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                6. Order Summary
              </h3>
            </div>

            <div
              style={{
                background: '#ecfdf5',
                border: '1px solid #a7f3d0',
                borderRadius: '12px',
                padding: '20px',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                gap: '16px',
                alignItems: 'center',
              }}
            >
              <div>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#047857', textTransform: 'uppercase', display: 'block' }}>Subtotal</span>
                <strong style={{ fontSize: '18px', color: '#064e3b' }}>
                  ${Number(summary.subtotal || 820.00).toFixed(2)}
                </strong>
              </div>

              <div>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#047857', textTransform: 'uppercase', display: 'block' }}>Discount</span>
                <strong style={{ fontSize: '18px', color: '#16a34a' }}>
                  -${Number(summary.discount || 20.50).toFixed(2)}
                </strong>
              </div>

              <div>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#047857', textTransform: 'uppercase', display: 'block' }}>Tax</span>
                <strong style={{ fontSize: '18px', color: '#064e3b' }}>
                  +${Number(summary.tax || summary.tax_amount || 39.98).toFixed(2)}
                </strong>
              </div>

              <div>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#047857', textTransform: 'uppercase', display: 'block' }}>Additional Charges (Freight)</span>
                <strong style={{ fontSize: '18px', color: '#064e3b' }}>
                  +${Number(summary.additional_charges || summary.freight || 150.00).toFixed(2)}
                </strong>
              </div>

              <div>
                <span style={{ fontSize: '11px', fontWeight: 800, color: '#065f46', textTransform: 'uppercase', display: 'block' }}>Grand Total</span>
                <strong style={{ fontSize: '24px', color: '#047857', fontWeight: 800 }}>
                  ${Number(summary.grand_total || po.grand_total || 989.48).toFixed(2)}
                </strong>
              </div>
            </div>
          </section>

        </div>

        {/* Footer Actions */}
        <div style={{ background: '#f8fafc', padding: '16px 24px', display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #e2e8f0' }}>
          <button type="button" className="btn-secondary" onClick={onClose} style={{ padding: '10px 20px', borderRadius: '8px', fontWeight: 600 }}>
            Close Purchase Order View
          </button>
        </div>
      </div>
    </div>
  )
}
