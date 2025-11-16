// ABOUTME: Tests for execute_query MCP tool contract
// ABOUTME: Ensures input validation, payment handling, and formatting logic work

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { executeQueryTool, createExecuteQueryHandler } from './execute-query'
import { X402Client } from '../x402-client'

const TEST_WALLET = '0x1234567890abcdef1234567890abcdef12345678'

const buildPaymentRequirements = (estimatedCost = '0.050000') => ({
  x402Version: 1,
  error: '',
  accepts: [
    {
      scheme: 'eip3009',
      network: 'base',
      maxAmountRequired: '1000000',
      asset: 'USDC',
      payTo: '0xaabbccddeeff00112233445566778899aabbccdd',
      resource: 'sql',
      description: 'Execute SQL query',
      mimeType: 'application/json',
      maxTimeoutSeconds: 300,
      extra: {
        estimatedCost,
        availableCredit: '0.010000',
        amountDue: '0.040000'
      }
    }
  ]
})

describe('Execute Query MCP Tool', () => {
  describe('Tool Definition', () => {
    it('exposes the execute_query tool name and schema', () => {
      expect(executeQueryTool.name).toBe('execute_query')
      expect(executeQueryTool.description).toBeTruthy()
      expect(executeQueryTool.inputSchema.type).toBe('object')
      expect(executeQueryTool.inputSchema.required).toEqual(['query', 'walletAddress'])
      expect(executeQueryTool.inputSchema.properties.query.type).toBe('string')
      expect(executeQueryTool.inputSchema.properties.walletAddress.type).toBe('string')
    })
  })

  describe('Input Validation', () => {
    let handler: ReturnType<typeof createExecuteQueryHandler>

    beforeEach(() => {
      const mockClient = { executeQuery: vi.fn() } as unknown as X402Client
      handler = createExecuteQueryHandler(mockClient)
    })

    it('rejects blank queries', async () => {
      const result = await handler({ query: '', walletAddress: TEST_WALLET })
      expect(result.success).toBe(false)
      expect(result.error).toContain('query')
    })

    it('rejects blank wallet addresses', async () => {
      const result = await handler({ query: 'SELECT 1', walletAddress: '' })
      expect(result.success).toBe(false)
      expect(result.error).toContain('wallet')
    })

    it('rejects malformed wallet addresses', async () => {
      const result = await handler({ query: 'SELECT 1', walletAddress: 'abcd' })
      expect(result.success).toBe(false)
      expect(result.error).toContain('wallet')
    })

    it('accepts valid Ethereum addresses', async () => {
      const mockClient = {
        executeQuery: vi.fn().mockResolvedValue({
          success: true,
          rows: [],
          rowCount: 0,
          actualCost: '0'
        })
      } as unknown as X402Client
      const handler = createExecuteQueryHandler(mockClient)

      const result = await handler({ query: 'SELECT 1', walletAddress: TEST_WALLET })

      expect(result.success).toBe(true)
      expect(mockClient.executeQuery).toHaveBeenCalledWith('SELECT 1', TEST_WALLET)
    })
  })

  describe('Query Execution', () => {
    it('formats successful results from the client', async () => {
      const mockClient = {
        executeQuery: vi.fn().mockResolvedValue({
          success: true,
          rows: [
            { id: 1, source_file: 'doc1.pdf' },
            { id: 2, source_file: 'doc2.pdf' }
          ],
          rowCount: 2,
          actualCost: '0.020000',
          paymentSource: 'payment'
        })
      } as unknown as X402Client
      const handler = createExecuteQueryHandler(mockClient)

      const result = await handler({
        query: 'SELECT * FROM documents LIMIT 2',
        walletAddress: TEST_WALLET
      })

      expect(result.success).toBe(true)
      expect(result.data?.rows).toHaveLength(2)
      expect(result.data?.rowCount).toBe(2)
      expect(result.data?.cost).toBe(0.02)
      expect(result.data?.summary).toContain('2 rows')
      expect(mockClient.executeQuery).toHaveBeenCalledWith('SELECT * FROM documents LIMIT 2', TEST_WALLET)
    })

    it('surface payment requirements back to the caller', async () => {
      const paymentRequirements = buildPaymentRequirements('0.050000')
      const mockClient = {
        executeQuery: vi.fn().mockResolvedValue({
          success: false,
          paymentRequired: true,
          paymentRequirements,
          estimatedCost: 0.05
        })
      } as unknown as X402Client
      const handler = createExecuteQueryHandler(mockClient)

      const result = await handler({ query: 'SELECT * FROM documents', walletAddress: TEST_WALLET })

      expect(result.success).toBe(false)
      expect(result.paymentRequired).toBe(true)
      expect(result.paymentRequirements).toEqual(paymentRequirements)
      expect(result.estimatedCost).toBe(0.05)
      expect(result.message).toContain('Payment required')
    })

    it('propagates client errors verbatim', async () => {
      const mockClient = {
        executeQuery: vi.fn().mockResolvedValue({ success: false, error: 'Gateway timeout' })
      } as unknown as X402Client
      const handler = createExecuteQueryHandler(mockClient)

      const result = await handler({ query: 'SELECT * FROM documents', walletAddress: TEST_WALLET })

      expect(result.success).toBe(false)
      expect(result.error).toBe('Gateway timeout')
    })

    it('catches exceptions thrown by the client', async () => {
      const mockClient = {
        executeQuery: vi.fn().mockRejectedValue(new Error('Network error'))
      } as unknown as X402Client
      const handler = createExecuteQueryHandler(mockClient)

      const result = await handler({ query: 'SELECT * FROM documents', walletAddress: TEST_WALLET })

      expect(result.success).toBe(false)
      expect(result.error).toContain('Network error')
    })
  })

  describe('Result Formatting', () => {
    it('includes settlement and payment information in summaries', async () => {
      const mockClient = {
        executeQuery: vi.fn().mockResolvedValue({
          success: true,
          rows: [{ id: 1 }, { id: 2 }, { id: 3 }],
          rowCount: 3,
          actualCost: '0.003000',
          paymentSource: 'credit'
        })
      } as unknown as X402Client
      const handler = createExecuteQueryHandler(mockClient)

      const result = await handler({ query: 'SELECT id FROM documents LIMIT 3', walletAddress: TEST_WALLET })

      expect(result.success).toBe(true)
      expect(result.data?.summary).toContain('3 rows')
      expect(result.data?.summary).toContain('$0.003000')
      expect(result.data?.paymentSource).toBe('credit')
    })

    it('creates instructional messages for payment requirements', async () => {
      const mockClient = {
        executeQuery: vi.fn().mockResolvedValue({
          success: false,
          paymentRequired: true,
          paymentRequirements: buildPaymentRequirements('0.150000')
        })
      } as unknown as X402Client
      const handler = createExecuteQueryHandler(mockClient)

      const result = await handler({ query: 'SELECT * FROM pages', walletAddress: TEST_WALLET })

      expect(result.success).toBe(false)
      expect(result.paymentRequired).toBe(true)
      expect(result.message).toContain('Estimated cost')
      expect(result.message).toContain('payment')
    })
  })
})
