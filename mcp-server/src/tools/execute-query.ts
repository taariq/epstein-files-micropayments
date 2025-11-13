// ABOUTME: MCP tool for executing SQL queries on Epstein Files database
// ABOUTME: Handles micropayment flows and returns formatted results to LLMs

import { X402Client, QueryResult } from '../x402-client'

export interface ExecuteQueryInput {
  query: string
  walletAddress: string
}

export interface ExecuteQueryResult {
  success: boolean
  data?: {
    rows: any[]
    rowCount: number
    cost: number
    summary: string
  }
  paymentRequired?: boolean
  paymentUrl?: string
  estimatedCost?: number
  message?: string
  error?: string
}

export const executeQueryTool = {
  name: 'execute_query',
  description: 'Execute SQL queries on the Epstein Files database via x402 micropayments. Query the documents and pages tables to search through extracted text from oversight committee files.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'SQL SELECT query to execute. Only SELECT queries are allowed. Example: SELECT * FROM documents WHERE source_file LIKE \'%epstein%\' LIMIT 10'
      },
      walletAddress: {
        type: 'string',
        description: 'Ethereum wallet address for payment. Must be a valid 0x-prefixed address. Example: 0x1234567890abcdef1234567890abcdef12345678'
      }
    },
    required: ['query', 'walletAddress']
  }
}

function validateWalletAddress(address: string): boolean {
  // Ethereum address: 0x followed by 40 hex characters
  const ethAddressRegex = /^0x[a-fA-F0-9]{40}$/
  return ethAddressRegex.test(address)
}

export function createExecuteQueryHandler(client: X402Client) {
  return async (input: ExecuteQueryInput): Promise<ExecuteQueryResult> => {
    try {
      // Validate inputs
      if (!input.query || input.query.trim() === '') {
        return {
          success: false,
          error: 'query is required'
        }
      }

      if (!input.walletAddress || input.walletAddress.trim() === '') {
        return {
          success: false,
          error: 'wallet address is required'
        }
      }

      if (!validateWalletAddress(input.walletAddress)) {
        return {
          success: false,
          error: 'Invalid wallet address format. Must be a valid Ethereum address (0x + 40 hex characters)'
        }
      }

      // Execute query through x402 client
      const result: QueryResult = await client.executeQuery(input.query)

      // Handle successful execution
      if (result.success) {
        const summary = `Query returned ${result.rowCount} rows. Cost: $${result.cost?.toFixed(6) || '0.000000'}`
        return {
          success: true,
          data: {
            rows: result.rows || [],
            rowCount: result.rowCount || 0,
            cost: result.cost || 0,
            summary
          }
        }
      }

      // Handle payment required
      if (result.paymentRequired) {
        const message = `Payment required to execute this query. Estimated cost: $${result.estimatedCost?.toFixed(6)}. Please complete payment at: ${result.paymentUrl}`
        return {
          success: false,
          paymentRequired: true,
          paymentUrl: result.paymentUrl,
          estimatedCost: result.estimatedCost,
          message
        }
      }

      // Handle other errors
      return {
        success: false,
        error: result.error || 'Unknown error occurred'
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unexpected error occurred'
      }
    }
  }
}
