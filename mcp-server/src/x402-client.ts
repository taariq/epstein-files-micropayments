// ABOUTME: HTTP client for x402 gateway API with micropayment support
// ABOUTME: Handles query validation, payment requests, and verified query execution

export interface X402Config {
  gatewayUrl: string
  providerId: string
  apiKey: string
}

export interface QueryResult {
  success: boolean
  rows?: any[]
  rowCount?: number
  estimatedCost?: string
  actualCost?: string
  executionTime?: number
  paymentId?: string
  paymentRequired?: boolean
  // Payment request details (when 402 response)
  minimumPayment?: string
  gatewayWallet?: string
  expiresAt?: string | null
  message?: string
  error?: string
}

export interface BalanceResult {
  success: boolean
  agentWallet?: string
  providerId?: string
  balance?: string
  updatedAt?: string | null
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

  /**
   * Execute query with x402 payment protocol
   * If payment is not provided, returns 402 with payment details
   * If payment is provided, verifies and executes query
   */
  async executeQuery(
    query: string,
    agentWallet: string,
    paymentId?: string,
    txHash?: string
  ): Promise<QueryResult> {
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
      const body: any = {
        sql: query,
        agentWallet: agentWallet,
        providerId: this.providerId
      }

      // Add payment details if provided
      if (paymentId && txHash) {
        body.paymentId = paymentId
        body.txHash = txHash
      }

      const response = await fetch(`${this.gatewayUrl}/api/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'X-Provider-ID': this.providerId
        },
        body: JSON.stringify(body)
      })

      if (response.ok) {
        const data = await response.json()
        return {
          success: true,
          rows: data.rows,
          rowCount: data.rowCount,
          estimatedCost: data.estimatedCost,
          actualCost: data.actualCost,
          executionTime: data.executionTime,
          paymentId: data.paymentId
        }
      }

      // Handle HTTP 402 Payment Required
      if (response.status === 402) {
        const data = await response.json()
        return {
          success: false,
          paymentRequired: true,
          paymentId: data.paymentId,
          estimatedCost: data.estimatedCost,
          minimumPayment: data.minimumPayment,
          gatewayWallet: data.gatewayWallet,
          expiresAt: data.expiresAt,
          message: data.message
        }
      }

      // Handle other HTTP errors
      const errorData = await response.json().catch(() => ({ error: response.statusText }))
      return {
        success: false,
        error: `Gateway error (${response.status}): ${errorData.error || response.statusText}`
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }
    }
  }

  async getBalance(agentWallet: string): Promise<BalanceResult> {
    try {
      const response = await fetch(
        `${this.gatewayUrl}/api/balance/${agentWallet}/${this.providerId}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'X-Provider-ID': this.providerId
          }
        }
      )

      if (response.ok) {
        const data = await response.json()
        return {
          success: true,
          agentWallet: data.agentWallet,
          providerId: data.providerId,
          balance: data.balance,
          updatedAt: data.updatedAt
        }
      }

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
