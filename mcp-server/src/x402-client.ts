// ABOUTME: HTTP client for Coinbase x402 gateway API with EIP-3009 authorization
// ABOUTME: Handles PaymentRequirements, signature generation, and X-PAYMENT headers

import { Wallet, TypedDataDomain, TypedDataField } from 'ethers'

export interface X402Config {
  gatewayUrl: string
  providerId: string
  apiKey: string
  agentPrivateKey?: string  // Optional: for automatic payment signing
}

export interface PaymentRequirement {
  scheme: string
  network: string
  maxAmountRequired: string
  asset: string
  payTo: string
  resource: string
  description: string
  mimeType: string
  maxTimeoutSeconds: number
  extra?: {
    paymentRequestId?: string
    estimatedCost?: string
    availableCredit?: string
    amountDue?: string
  }
}

export interface PaymentRequirementsResponse {
  x402Version: number
  error: string
  accepts: PaymentRequirement[]
}

export interface EIP3009Authorization {
  from: string
  to: string
  value: string
  validAfter: string
  validBefore: string
  nonce: string
}

export interface PaymentPayload {
  authorization: EIP3009Authorization
  signature: string
}

export interface XPaymentHeader {
  x402Version: number
  scheme: string
  network: string
  payload: PaymentPayload
}

export interface SettlementResponse {
  success: boolean
  payer: string
  transaction: string
  network: string
  timestamp: number
}

export interface QueryResult {
  success: boolean
  rows?: any[]
  rowCount?: number
  estimatedCost?: string
  actualCost?: string
  executionTime?: number
  settlement?: SettlementResponse
  paymentSource?: 'payment' | 'credit'
  // Payment required fields
  paymentRequired?: boolean
  paymentRequirements?: PaymentRequirementsResponse
  message?: string
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

const EIP3009_DOMAIN: TypedDataDomain = {
  name: 'USD Coin',
  version: '2',
  chainId: 8453,  // Base mainnet
  verifyingContract: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'  // USDC on Base
}

const EIP3009_TYPES: Record<string, TypedDataField[]> = {
  TransferWithAuthorization: [
    { name: 'from', type: 'address' },
    { name: 'to', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'validAfter', type: 'uint256' },
    { name: 'validBefore', type: 'uint256' },
    { name: 'nonce', type: 'bytes32' }
  ]
}

export class X402Client {
  private gatewayUrl: string
  private providerId: string
  private apiKey: string
  private wallet?: Wallet

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

    // Initialize wallet if private key provided
    if (config.agentPrivateKey) {
      this.wallet = new Wallet(config.agentPrivateKey)
    }
  }

  validateQuery(query: string): void {
    const upperQuery = query.trim().toUpperCase()

    for (const operation of FORBIDDEN_OPERATIONS) {
      const regex = new RegExp(`\\b${operation}\\b`)
      if (regex.test(upperQuery)) {
        throw new Error(`Forbidden SQL operation: ${operation}`)
      }
    }
  }

  /**
   * Generate random nonce for EIP-3009
   */
  private generateNonce(): string {
    const randomBytes = crypto.getRandomValues(new Uint8Array(32))
    return '0x' + Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('')
  }

  /**
   * Sign EIP-3009 authorization using EIP-712 typed data
   */
  private async signAuthorization(
    requirement: PaymentRequirement,
    agentWallet: string
  ): Promise<XPaymentHeader> {
    if (!this.wallet) {
      throw new Error('Agent wallet not configured. Set AGENT_PRIVATE_KEY in environment.')
    }

    // Generate authorization
    const now = Math.floor(Date.now() / 1000)
    const authorization: EIP3009Authorization = {
      from: agentWallet,
      to: requirement.payTo,
      value: requirement.maxAmountRequired,
      validAfter: '0',
      validBefore: (now + requirement.maxTimeoutSeconds).toString(),
      nonce: this.generateNonce()
    }

    // Sign using EIP-712
    const signature = await this.wallet.signTypedData(
      EIP3009_DOMAIN,
      EIP3009_TYPES,
      authorization
    )

    return {
      x402Version: 1,
      scheme: requirement.scheme,
      network: requirement.network,
      payload: {
        authorization,
        signature
      }
    }
  }

  /**
   * Execute query with Coinbase x402 payment protocol
   * 1. First request without payment -> returns 402 with PaymentRequirements
   * 2. Sign authorization and retry with X-PAYMENT header
   * 3. Gateway settles payment and executes query
   */
  async executeQuery(
    query: string,
    agentWallet: string
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
      // Step 1: Initial request without payment
      const initialResponse = await fetch(`${this.gatewayUrl}/api/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey
        },
        body: JSON.stringify({
          sql: query,
          agentWallet: agentWallet,
          providerId: this.providerId
        })
      })

      // Handle HTTP 402 Payment Required
      if (initialResponse.status === 402) {
        const paymentReq: PaymentRequirementsResponse = await initialResponse.json()

        // If no wallet configured, return payment requirements to user
        if (!this.wallet) {
          return {
            success: false,
            paymentRequired: true,
            paymentRequirements: paymentReq,
            message: `Payment required. Configure AGENT_PRIVATE_KEY to enable automatic payments, or sign manually.`
          }
        }

        // Step 2: Sign authorization automatically
        const requirement = paymentReq.accepts[0]
        if (!requirement) {
          return {
            success: false,
            error: 'No payment requirement returned from gateway'
          }
        }

        const xPayment = await this.signAuthorization(requirement, agentWallet)
        const xPaymentEncoded = Buffer.from(JSON.stringify(xPayment)).toString('base64')

        // Step 3: Retry with X-PAYMENT header
        const paymentResponse = await fetch(`${this.gatewayUrl}/api/query`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': this.apiKey,
            'X-PAYMENT': xPaymentEncoded
          },
          body: JSON.stringify({
            sql: query,
            agentWallet: agentWallet,
            providerId: this.providerId
          })
        })

        if (paymentResponse.ok) {
          const data = await paymentResponse.json()

          // Parse X-PAYMENT-RESPONSE header if present
          const xPaymentResponse = paymentResponse.headers.get('X-PAYMENT-RESPONSE')
          let settlement: SettlementResponse | undefined
          if (xPaymentResponse) {
            try {
              settlement = JSON.parse(Buffer.from(xPaymentResponse, 'base64').toString('utf-8'))
            } catch (e) {
              console.error('Failed to parse X-PAYMENT-RESPONSE:', e)
            }
          }

          return {
            success: true,
            rows: data.rows,
            rowCount: data.rowCount,
            estimatedCost: data.estimatedCost,
            actualCost: data.actualCost,
            executionTime: data.executionTime,
            paymentSource: data.paymentSource,
            settlement
          }
        }

        // Handle payment errors
        const errorData = await paymentResponse.json().catch(() => ({ error: paymentResponse.statusText }))
        return {
          success: false,
          error: `Payment failed (${paymentResponse.status}): ${errorData.error || paymentResponse.statusText}`
        }
      }

      // Handle successful query (shouldn't happen on first request, but handle it)
      if (initialResponse.ok) {
        const data = await initialResponse.json()
        return {
          success: true,
          rows: data.rows,
          rowCount: data.rowCount,
          estimatedCost: data.estimatedCost,
          actualCost: data.actualCost,
          executionTime: data.executionTime,
          paymentSource: data.paymentSource
        }
      }

      // Handle other HTTP errors
      const errorData = await initialResponse.json().catch(() => ({ error: initialResponse.statusText }))
      return {
        success: false,
        error: `Gateway error (${initialResponse.status}): ${errorData.error || initialResponse.statusText}`
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }
    }
  }
}
