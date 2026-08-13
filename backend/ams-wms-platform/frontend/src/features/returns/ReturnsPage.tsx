import { FormEvent, useState } from 'react'
import { returnsApi, ReturnDetailResponse } from '../../shared/apiClient'

/**
 * Working end-to-end example for the returns module: creates a return
 * request against business-service, then fetches it back. Mirrors
 * ReceivingPage's shape.
 */
export default function ReturnsPage() {
  const [itemCode, setItemCode] = useState('ITEM-A')
  const [quantity, setQuantity] = useState('2')
  const [reason, setReason] = useState('DAMAGED')
  const [result, setResult] = useState<ReturnDetailResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setResult(null)
    setLoading(true)
    try {
      const { returnId } = await returnsApi.createReturn({
        lines: [{ itemCode, quantity: Number(quantity), reason }],
      })
      const detail = await returnsApi.getReturn(returnId)
      setResult(detail)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="page">
      <h1>Create a return</h1>
      <p className="page-subtitle">
        Calls <code>POST /api/returns</code> on business-service, then reads it back with{' '}
        <code>GET /api/returns/{'{id}'}</code>.
      </p>

      <form className="card" onSubmit={handleSubmit}>
        <label>
          Item code
          <input value={itemCode} onChange={(e) => setItemCode(e.target.value)} />
        </label>
        <label>
          Quantity
          <input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
        </label>
        <label>
          Reason
          <select value={reason} onChange={(e) => setReason(e.target.value)}>
            <option value="DAMAGED">Damaged</option>
            <option value="WRONG_ITEM">Wrong item</option>
            <option value="QUALITY_ISSUE">Quality issue</option>
            <option value="NO_LONGER_NEEDED">No longer needed</option>
          </select>
        </label>
        <button type="submit" disabled={loading}>
          {loading ? 'Submitting…' : 'Create return'}
        </button>
      </form>

      {error && <div className="card card-error">{error}</div>}

      {result && (
        <div className="card">
          <h2>Return {result.returnId}</h2>
          <p>Status: {result.status}</p>
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th>Quantity</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {result.lines.map((line) => (
                <tr key={line.itemCode}>
                  <td>{line.itemCode}</td>
                  <td>{line.quantity}</td>
                  <td>{line.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
