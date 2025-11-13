// ABOUTME: Interactive demo component for querying the Epstein Files database
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

const DemoQuery: Component = () => {
  const [walletAddress, setWalletAddress] = createSignal('')
  const [query, setQuery] = createSignal('')
  const [loading, setLoading] = createSignal(false)
  const [result, setResult] = createSignal<QueryResult | null>(null)
  const [paymentRequired, setPaymentRequired] = createSignal<PaymentRequired | null>(null)
  const [error, setError] = createSignal<string | null>(null)

  const exampleQueries = [
    "SELECT * FROM documents LIMIT 10",
    "SELECT * FROM pages WHERE content ILIKE '%Epstein%' LIMIT 5",
    "SELECT document_filename, COUNT(*) as page_count FROM pages GROUP BY document_filename",
    "SELECT * FROM documents WHERE source_url LIKE '%oversight.house.gov%'"
  ]

  const executeQuery = async () => {
    setLoading(true)
    setResult(null)
    setPaymentRequired(null)
    setError(null)

    try {
      const response = await fetch('https://x402.serendb.com/query', {
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
  }

  return (
    <div class="demo-query">
      <header class="demo-header">
        <h2>Try a Query</h2>
        <p class="demo-intro">
          Experience the x402 micropayment flow by querying the Epstein Files database.
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
            onInput={(e) => setQuery(e.currentTarget.value)}
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

        <button
          class="execute-button"
          onClick={executeQuery}
          disabled={loading() || !walletAddress() || !query()}
        >
          {loading() ? 'Executing...' : 'Execute Query'}
        </button>
      </div>

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
