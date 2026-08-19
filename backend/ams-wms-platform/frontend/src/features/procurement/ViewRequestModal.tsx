import { MaterialRequest } from '../../shared/procurementApi'

interface Props {
  request: MaterialRequest
  onClose: () => void
  onCreateRFQ: (request: MaterialRequest) => void
}

export default function ViewRequestModal({ request, onClose, onCreateRFQ }: Props) {
  const canCreateRFQ = request.status === 'APPROVED' || request.status === 'SUBMITTED'

  // Extract overall remarks from items or request
  const remarks = request.items.map(i => i.notes).filter(Boolean).join('; ') || 'Standard material requisition for warehouse operations.'

  return (
    <div className="modal-backdrop">
      <div className="modal-content large-modal">
        <div className="modal-header">
          <div>
            <div className="badge-wrapper">
              <span className={`status-pill status-${request.status.toLowerCase()}`}>
                {request.status}
              </span>
              <span className={`priority-pill priority-${request.priority.toLowerCase()}`}>
                {request.priority} Priority
              </span>
            </div>
            <h2>Raw Material Request Details</h2>
          </div>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>

        <div className="modal-body">
          {/* Section 1: Request Information */}
          <h3 className="section-heading">Request Information</h3>
          <div className="grid-meta-box">
            <div className="meta-item">
              <span className="label">Request Number</span>
              <span className="value req-number-badge">{request.request_number}</span>
            </div>
            <div className="meta-item">
              <span className="label">Request Date</span>
              <span className="value">{new Date(request.created_at).toLocaleDateString()}</span>
            </div>
            <div className="meta-item">
              <span className="label">Warehouse</span>
              <span className="value strong">{request.warehouse_id}</span>
            </div>
            <div className="meta-item">
              <span className="label">Department</span>
              <span className="value">{request.department}</span>
            </div>

            <div className="meta-item">
              <span className="label">Requested By</span>
              <span className="value">{request.requested_by}</span>
            </div>
            <div className="meta-item">
              <span className="label">Required By Date</span>
              <span className="value highlight-date">{request.target_delivery_date}</span>
            </div>
            <div className="meta-item">
              <span className="label">Priority</span>
              <span className="value">
                <span className={`priority-pill priority-${request.priority.toLowerCase()}`}>
                  {request.priority}
                </span>
              </span>
            </div>
            <div className="meta-item">
              <span className="label">Request Status</span>
              <span className="value">
                <span className={`status-pill status-${request.status.toLowerCase()}`}>
                  {request.status}
                </span>
              </span>
            </div>
          </div>

          <div className="remarks-box">
            <span className="label">Remarks / Requisition Notes:</span>
            <div className="value">{remarks}</div>
          </div>

          {/* Section 2: Material Requirements */}
          <h3 className="section-heading" style={{ marginTop: '24px' }}>
            Material Requirements ({request.items.length} {request.items.length === 1 ? 'Item' : 'Materials'})
          </h3>
          <div className="table-wrapper">
            <table className="items-table data-table">
              <thead>
                <tr>
                  <th>Material Code</th>
                  <th>Material Name</th>
                  <th>Category</th>
                  <th className="num">Quantity</th>
                  <th>UOM</th>
                  <th>Required Date</th>
                </tr>
              </thead>
              <tbody>
                {request.items.map((item, idx) => (
                  <tr key={item.material_code + idx}>
                    <td><code>{item.material_code}</code></td>
                    <td>
                      <strong>{item.material_name}</strong>
                      {item.notes && <div className="item-note">Note: {item.notes}</div>}
                    </td>
                    <td>{item.category || 'Raw Material'}</td>
                    <td className="num font-bold text-slate-800">{Math.floor(item.requested_qty).toLocaleString()}</td>
                    <td><span className="uom-tag">{item.unit_of_measure || 'PCS'}</span></td>
                    <td><span className="date-tag">{request.target_delivery_date}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {request.rejection_reason && (
            <div className="rejection-box" style={{ marginTop: '16px' }}>
              <strong>Rejection Reason:</strong> {request.rejection_reason}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Close</button>
          {canCreateRFQ && (
            <button className="btn-primary" onClick={() => { onClose(); onCreateRFQ(request); }}>
              📄 Create RFQ from Request
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
