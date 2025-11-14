// ABOUTME: MCP tool for checking agent wallet balance
// ABOUTME: Returns current balance for micropayment queries

import { X402Client, BalanceResult } from '../x402-client'

export interface CheckBalanceInput {
  walletAddress: string
}

export interface CheckBalanceResult {
  success: boolean
  balance?: string
  balanceUSD?: number
  walletAddress?: string
  lastUpdated?: string | null
  message?: string
  error?: string
}

export const checkBalanceTool = {
  name: 'check_balance',
  description: 'Check the current balance for an agent wallet. Returns the available balance in USDC for executing queries.',
  inputSchema: {
    type: 'object',
    properties: {
      walletAddress: {
        type: 'string',
        description: 'Ethereum wallet address to check balance for. Must be a valid 0x-prefixed address. Example: 0x1234567890abcdef1234567890abcdef12345678'
      }
    },
    required: ['walletAddress']
  }
}

function validateWalletAddress(address: string): boolean {
  const ethAddressRegex = /^0x[a-fA-F0-9]{40}$/
  return ethAddressRegex.test(address)
}

export function createCheckBalanceHandler(client: X402Client) {
  return async (input: CheckBalanceInput): Promise<CheckBalanceResult> => {
    try {
      // Validate wallet address
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

      // Get balance from x402 gateway
      const result: BalanceResult = await client.getBalance(input.walletAddress)

      if (result.success) {
        const balanceUSD = parseFloat(result.balance || '0')
        const message = balanceUSD > 0
          ? `Balance: $${balanceUSD.toFixed(6)} USDC`
          : 'No balance found. You need to deposit funds before executing queries.'

        return {
          success: true,
          balance: result.balance,
          balanceUSD,
          walletAddress: result.agentWallet,
          lastUpdated: result.updatedAt,
          message
        }
      }

      return {
        success: false,
        error: result.error || 'Failed to check balance'
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unexpected error occurred'
      }
    }
  }
}
