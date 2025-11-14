// ABOUTME: HTTP client for x402 gateway API with micropayment support
// ABOUTME: Handles query validation, execution, and payment flow integration

export interface X402Config {
  gatewayUrl: string
  providerId: string
  apiKey: string
}

export interface QueryResult {
  success: boolean
  rows?: any[]
  rowCount?: number
  cost?: number
  paymentRequired?: boolean
  paymentUrl?: string
  estimatedCost?: number
  error?: string
}

const FORBIDDEN_OPERATIONS = [
  'DROP',
  'DELETE',
  'UPDATE',
  'INSERT',
  'ALTER',
  'CREATE',
  'TRUNCATE',
  'GRANT',
  'REVOKE'
]

export class X402Client {
  private gatewayUrl: string
  private providerId: string
  private apiKey: string

  constructor(config: X402Config) {
    if (!config.gatewayUrl) {
      throw new Error('gatewayUrl is required')
    }
    if (!config.providerId) {
      throw new Error('providerId is required')
    }
    if (!config.apiKey) {
      throw new Error('apiKey is required')
    }

    this.gatewayUrl = config.gatewayUrl
    this.providerId = config.providerId
    this.apiKey = config.apiKey
  }

  validateQuery(query: string): void {
    const upperQuery = query.trim().toUpperCase()

    for (const operation of FORBIDDEN_OPERATIONS) {
      // Check if the operation appears as a word boundary (not part of another word)
      const regex = new RegExp(`\\b${operation}\\b`)
      if (regex.test(upperQuery)) {
        throw new Error(`Forbidden SQL operation: ${operation}`)
      }
    }
  }

  async executeQuery(query: string, agentWallet: string): Promise<QueryResult> {
    try {
      // Validate query before sending
      this.validateQuery(query)
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Query validation failed'
      }
    }

    try {
      const response = await fetch(`${this.gatewayUrl}/api/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'X-Provider-ID': this.providerId
        },
        body: JSON.stringify({
          sql: query,
          agentWallet: agentWallet,
          providerId: this.providerId
        })
      })

      if (response.ok) {
        const data = await response.json()
        return {
          success: true,
          rows: data.rows,
          rowCount: data.rowCount,
          cost: data.cost
        }
      }

      // Handle HTTP 402 Payment Required
      if (response.status === 402) {
        const data = await response.json()
        return {
          success: false,
          paymentRequired: true,
          paymentUrl: data.paymentUrl,
          estimatedCost: data.estimatedCost
        }
      }

      // Handle other HTTP errors
      const errorText = await response.text()
      return {
        success: false,
        error: `Gateway error (${response.status}): ${errorText}`
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }
    }
  }
}
