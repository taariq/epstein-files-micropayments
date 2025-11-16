// ABOUTME: Interactive demo component for querying document databases
// ABOUTME: Demonstrates x402 micropayment flow with wallet address and SQL query inputs

import { Component, createSignal } from 'solid-js'

interface QueryResult {
  rows: any[]
  rowCount: number
}

interface PaymentRequired {
  paymentUrl: string
  amount: string
  query: string
}

interface CostEstimate {
  estimatedRows: number
  estimatedCost: number
}

const DemoQuery: Component = () => {
  const [walletAddress, setWalletAddress] = createSignal('')
  const [query, setQuery] = createSignal('')
  const [loading, setLoading] = createSignal(false)
  const [estimating, setEstimating] = createSignal(false)
  const [result, setResult] = createSignal<QueryResult | null>(null)
  const [paymentRequired, setPaymentRequired] = createSignal<PaymentRequired | null>(null)
  const [costEstimate, setCostEstimate] = createSignal<CostEstimate | null>(null)
  const [lastEstimatedQuery, setLastEstimatedQuery] = createSignal<string | null>(null)
  const [showConfirmation, setShowConfirmation] = createSignal(false)
  const [error, setError] = createSignal<string | null>(null)

  const exampleQueries = [
    "SELECT * FROM documents LIMIT 10",
    "SELECT * FROM pages WHERE content_text ILIKE '%keyword%' LIMIT 5",
    "SELECT d.source_file, COUNT(*) as page_count FROM pages p JOIN documents d ON p.document_id = d.id GROUP BY d.source_file",
    "SELECT * FROM documents WHERE source_file LIKE '%.pdf'"
  ]

  // Pricing: $0.01 per 1000 rows
  const PRICE_PER_1000_ROWS = 0.01

  const executeButtonLabel = () => {
    if (loading()) {
      return 'Executing...'
    }

    if (estimating()) {
      return 'Preparing Estimate...'
    }

    if (showConfirmation()) {
      return 'Awaiting Confirmation'
    }

    return 'Execute Query'
  }

  const resetEstimateState = () => {
    setCostEstimate(null)
    setLastEstimatedQuery(null)
    setShowConfirmation(false)
  }

  const estimateCost = async (): Promise<boolean> => {
    if (!query()) {
      setError('Enter a SQL query before estimating cost')
      return false
    }

    setEstimating(true)
    resetEstimateState()
    setError(null)

    try {
      const response = await fetch('/api/estimate-cost', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: query()
        })
      })

      if (response.ok) {
        const data = await response.json()
        const estimatedRows = data.estimatedRows || 0
        const estimatedCost = (estimatedRows / 1000) * PRICE_PER_1000_ROWS

        setCostEstimate({
          estimatedRows,
          estimatedCost
        })
        setLastEstimatedQuery(query())
        return true
      } else {
        const errorData = await response.json()
        setError(errorData.error || `Error estimating cost: ${response.status}`)
        return false
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to estimate cost')
      return false
    } finally {
      setEstimating(false)
    }
  }

  const executeQuery = async () => {
    setLoading(true)
    setResult(null)
    setPaymentRequired(null)
    setError(null)

    try {
      const response = await fetch('/api/execute-query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          walletAddress: walletAddress(),
          query: query()
        })
      })

      if (response.status === 402) {
        const paymentData = await response.json()
        setPaymentRequired(paymentData)
      } else if (response.ok) {
        const data = await response.json()
        setResult(data)
      } else {
        const errorData = await response.json()
        setError(errorData.error || `Error: ${response.status} ${response.statusText}`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred while executing the query')
    } finally {
      setLoading(false)
    }
  }

  const setExampleQuery = (exampleQuery: string) => {
    setQuery(exampleQuery)
    resetEstimateState()
  }

  const handleQueryInput = (value: string) => {
    setQuery(value)
    resetEstimateState()
  }

  const handleExecuteClick = async () => {
    if (!walletAddress() || !query()) {
      return
    }

    setError(null)

    const currentQuery = query()
    const hasFreshEstimate = costEstimate() && lastEstimatedQuery() === currentQuery

    if (!hasFreshEstimate) {
      const estimated = await estimateCost()
      if (!estimated) {
        return
      }
    }

    setShowConfirmation(true)
  }

  const confirmAndExecute = async () => {
    setShowConfirmation(false)
    await executeQuery()
  }

  return (
    <div class="demo-query">
      <header class="demo-header">
        <h2>Try a Query</h2>
        <p class="demo-intro">
          Experience the x402 micropayment flow by querying document databases.
          Enter your Ethereum wallet address and a SQL query to get started.
        </p>
      </header>

      <div class="query-form">
        <div class="form-group">
          <label for="wallet-address">Ethereum Wallet Address</label>
          <input
            id="wallet-address"
            type="text"
            class="input-field"
            placeholder="0x..."
            value={walletAddress()}
            onInput={(e) => setWalletAddress(e.currentTarget.value)}
          />
          <p class="input-hint">
            Your Ethereum address for payment processing
          </p>
        </div>

        <div class="form-group">
          <label for="sql-query">SQL Query</label>
          <textarea
            id="sql-query"
            class="input-field query-textarea"
            placeholder="SELECT * FROM documents LIMIT 10"
            value={query()}
            onInput={(e) => handleQueryInput(e.currentTarget.value)}
            rows={4}
          />
          <p class="input-hint">
            Read-only SQL queries (SELECT statements only)
          </p>
        </div>

        <div class="example-queries">
          <p class="example-label">Example queries:</p>
          <div class="example-buttons">
            {exampleQueries.map((exampleQuery) => (
              <button
                class="example-button"
                onClick={() => setExampleQuery(exampleQuery)}
              >
                {exampleQuery}
              </button>
            ))}
          </div>
        </div>

        <div class="button-group">
          <button
            class="estimate-button"
            onClick={estimateCost}
            disabled={estimating() || !query()}
          >
            {estimating() ? 'Estimating...' : 'Estimate Cost'}
          </button>

          <button
            class="execute-button"
            onClick={handleExecuteClick}
            disabled={loading() || estimating() || !walletAddress() || !query()}
          >
            {executeButtonLabel()}
          </button>
        </div>
      </div>

      {costEstimate() && (
        <div class="result-section estimate-section">
          <h3>Cost Estimate</h3>
          <p class="estimate-rows">
            Estimated rows: <strong>~{Math.round(costEstimate()!.estimatedRows)}</strong>
          </p>
          <p class="estimate-cost">
            Estimated cost: <strong>${costEstimate()!.estimatedCost.toFixed(6)}</strong>
          </p>
          <p class="estimate-info">
            This is an estimate based on query analysis. Actual cost may vary.
          </p>
        </div>
      )}

      {showConfirmation() && costEstimate() && (
        <div class="result-section confirm-section">
          <h3>Confirm Payment</h3>
          <p>
            Estimated rows: <strong>~{Math.round(costEstimate()!.estimatedRows)}</strong>
          </p>
          <p>
            Estimated cost: <strong>${costEstimate()!.estimatedCost.toFixed(6)}</strong>
          </p>
          <p class="confirm-note">
            Review the estimate before triggering the x402 payment flow.
          </p>

          <div class="confirm-actions">
            <button
              class="confirm-button"
              onClick={confirmAndExecute}
              disabled={loading()}
            >
              {loading() ? 'Executing...' : 'Confirm & Pay'}
            </button>

            <button
              class="cancel-button"
              onClick={() => setShowConfirmation(false)}
              disabled={loading()}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading() && (
        <div class="result-section loading-section">
          <p>Executing your query...</p>
        </div>
      )}

      {error() && (
        <div class="result-section error-section">
          <h3>Error</h3>
          <p>{error()}</p>
        </div>
      )}

      {paymentRequired() && (
        <div class="result-section payment-section">
          <h3>Payment Required</h3>
          <p>
            This query requires a micropayment of <strong>{paymentRequired()!.amount}</strong> to execute.
          </p>
          <p>
            Click the link below to complete the payment:
          </p>
          <a
            href={paymentRequired()!.paymentUrl}
            target="_blank"
            rel="noopener noreferrer"
            class="payment-link"
          >
            Complete Payment
          </a>
          <p class="payment-info">
            After payment, the query will be executed and results will be returned.
          </p>
        </div>
      )}

      {result() && (
        <div class="result-section success-section">
          <h3>Query Results</h3>
          <p class="result-count">
            Returned {result()!.rowCount} row{result()!.rowCount !== 1 ? 's' : ''}
          </p>
          <div class="result-table-container">
            <pre class="result-data">
              {JSON.stringify(result()!.rows, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  )
}

export default DemoQuery
