import { FormEvent, useState } from 'react'
import { receivingApi, GrnDetailResponse } from '../../shared/apiClient'

const SEEDED_PO_ID = '11111111-1111-1111-1111-111111111111'

/**
 * Working end-to-end example: confirms a GRN against warehouse-core, then
 * fetches it back. Uses the PO seeded by V1__init_receiving.sql so this
 * works immediately after `mvn spring-boot:run` with no extra setup.
 */
export default function ReceivingPage() {
  const [poId, setPoId] = useState(SEEDED_PO_ID)
  const [itemCode, setItemCode] = useState('ITEM-A')
  const [quantity, setQuantity] = useState('10')
  const [result, setResult] = useState<GrnDetailResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setResult(null)
    setLoading(true)
    try {
      const { grnId } = await receivingApi.confirmGrn({
        poId,
        lines: [{ itemCode, quantity: Number(quantity) }],
      })
      const detail = await receivingApi.getGrn(grnId)
      setResult(detail)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="page">
      <h1>Confirm goods receipt</h1>
      <p className="page-subtitle">
        Calls <code>POST /api/receiving/grn</code> on warehouse-core, then reads it back with{' '}
        <code>GET /api/receiving/grn/{'{id}'}</code>.
      </p>

      <form className="card" onSubmit={handleSubmit}>
        <label>
          Purchase order ID
          <input value={poId} onChange={(e) => setPoId(e.target.value)} />
        </label>
        <label>
          Item code
          <input value={itemCode} onChange={(e) => setItemCode(e.target.value)} />
        </label>
        <label>
          Quantity
          <input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
        </label>
        <button type="submit" disabled={loading}>
          {loading ? 'Confirming…' : 'Confirm receipt'}
        </button>
      </form>

      {error && <div className="card card-error">{error}</div>}

      {result && (
        <div className="card">
          <h2>GRN {result.grnId}</h2>
          <p>Status: {result.status}</p>
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th>Received</th>
                <th>Ordered</th>
              </tr>
            </thead>
            <tbody>
              {result.lines.map((line) => (
                <tr key={line.itemCode}>
                  <td>{line.itemCode}</td>
                  <td>{line.receivedQuantity}</td>
                  <td>{line.orderedQuantity ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
