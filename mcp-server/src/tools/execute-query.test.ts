// ABOUTME: Tests for execute_query MCP tool exposed to LLMs
// ABOUTME: Validates tool definition, input validation, and result formatting

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { executeQueryTool, createExecuteQueryHandler } from './execute-query'
import { X402Client } from '../x402-client'

describe('Execute Query MCP Tool', () => {
  describe('Tool Definition', () => {
    it('should have correct tool name', () => {
      expect(executeQueryTool.name).toBe('execute_query')
    })

    it('should have description', () => {
      expect(executeQueryTool.description).toBeDefined()
      expect(executeQueryTool.description.length).toBeGreaterThan(0)
    })

    it('should have inputSchema with required fields', () => {
      expect(executeQueryTool.inputSchema).toBeDefined()
      expect(executeQueryTool.inputSchema.type).toBe('object')
      expect(executeQueryTool.inputSchema.properties).toHaveProperty('query')
      expect(executeQueryTool.inputSchema.properties).toHaveProperty('walletAddress')
      expect(executeQueryTool.inputSchema.required).toContain('query')
      expect(executeQueryTool.inputSchema.required).toContain('walletAddress')
    })

    it('should specify query field as string', () => {
      expect(executeQueryTool.inputSchema.properties.query.type).toBe('string')
    })

    it('should specify walletAddress field as string', () => {
      expect(executeQueryTool.inputSchema.properties.walletAddress.type).toBe('string')
    })
  })

  describe('Input Validation', () => {
    let handler: ReturnType<typeof createExecuteQueryHandler>

    beforeEach(() => {
      const mockClient = {
        executeQuery: vi.fn()
      } as unknown as X402Client
      handler = createExecuteQueryHandler(mockClient)
    })

    it('should reject missing query', async () => {
      const result = await handler({
        query: '',
        walletAddress: '0x1234567890abcdef1234567890abcdef12345678'
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('query')
    })

    it('should reject missing wallet address', async () => {
      const result = await handler({
        query: 'SELECT * FROM documents',
        walletAddress: ''
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('wallet')
    })

    it('should reject invalid wallet address format', async () => {
      const result = await handler({
        query: 'SELECT * FROM documents',
        walletAddress: 'invalid-address'
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('wallet')
    })

    it('should accept valid Ethereum address', async () => {
      const mockClient = {
        executeQuery: vi.fn().mockResolvedValue({
          success: true,
          rows: [],
          rowCount: 0,
          cost: 0
        })
      } as unknown as X402Client
      const handler = createExecuteQueryHandler(mockClient)

      const result = await handler({
        query: 'SELECT * FROM documents',
        walletAddress: '0x1234567890abcdef1234567890abcdef12345678'
      })

      expect(result.success).toBe(true)
    })
  })

  describe('Query Execution', () => {
    it('should execute query and return formatted results', async () => {
      const mockClient = {
        executeQuery: vi.fn().mockResolvedValue({
          success: true,
          rows: [
            { id: 1, source_file: 'doc1.pdf', total_pages: 5 },
            { id: 2, source_file: 'doc2.pdf', total_pages: 10 }
          ],
          rowCount: 2,
          cost: 0.02
        })
      } as unknown as X402Client

      const handler = createExecuteQueryHandler(mockClient)

      const result = await handler({
        query: 'SELECT * FROM documents LIMIT 2',
        walletAddress: '0x1234567890abcdef1234567890abcdef12345678'
      })

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      expect(result.data.rows).toHaveLength(2)
      expect(result.data.rowCount).toBe(2)
      expect(result.data.cost).toBe(0.02)
      expect(mockClient.executeQuery).toHaveBeenCalledWith('SELECT * FROM documents LIMIT 2')
    })

    it('should handle payment required response', async () => {
      const mockClient = {
        executeQuery: vi.fn().mockResolvedValue({
          success: false,
          paymentRequired: true,
          paymentUrl: 'https://pay.x402.com/abc123',
          estimatedCost: 0.05
        })
      } as unknown as X402Client

      const handler = createExecuteQueryHandler(mockClient)

      const result = await handler({
        query: 'SELECT * FROM documents',
        walletAddress: '0x1234567890abcdef1234567890abcdef12345678'
      })

      expect(result.success).toBe(false)
      expect(result.paymentRequired).toBe(true)
      expect(result.paymentUrl).toBe('https://pay.x402.com/abc123')
      expect(result.estimatedCost).toBe(0.05)
    })

    it('should handle query execution errors', async () => {
      const mockClient = {
        executeQuery: vi.fn().mockResolvedValue({
          success: false,
          error: 'Gateway timeout'
        })
      } as unknown as X402Client

      const handler = createExecuteQueryHandler(mockClient)

      const result = await handler({
        query: 'SELECT * FROM documents',
        walletAddress: '0x1234567890abcdef1234567890abcdef12345678'
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe('Gateway timeout')
    })

    it('should handle exceptions during execution', async () => {
      const mockClient = {
        executeQuery: vi.fn().mockRejectedValue(new Error('Network error'))
      } as unknown as X402Client

      const handler = createExecuteQueryHandler(mockClient)

      const result = await handler({
        query: 'SELECT * FROM documents',
        walletAddress: '0x1234567890abcdef1234567890abcdef12345678'
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('Network error')
    })
  })

  describe('Result Formatting', () => {
    it('should format successful results with summary', async () => {
      const mockClient = {
        executeQuery: vi.fn().mockResolvedValue({
          success: true,
          rows: [{ id: 1 }, { id: 2 }, { id: 3 }],
          rowCount: 3,
          cost: 0.003
        })
      } as unknown as X402Client

      const handler = createExecuteQueryHandler(mockClient)

      const result = await handler({
        query: 'SELECT id FROM documents LIMIT 3',
        walletAddress: '0x1234567890abcdef1234567890abcdef12345678'
      })

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      expect(result.data.rows).toHaveLength(3)
      expect(result.data.summary).toContain('3 rows')
      expect(result.data.summary).toContain('$0.003')
    })

    it('should format payment required message with instructions', async () => {
      const mockClient = {
        executeQuery: vi.fn().mockResolvedValue({
          success: false,
          paymentRequired: true,
          paymentUrl: 'https://pay.x402.com/xyz',
          estimatedCost: 0.15
        })
      } as unknown as X402Client

      const handler = createExecuteQueryHandler(mockClient)

      const result = await handler({
        query: 'SELECT * FROM pages',
        walletAddress: '0x1234567890abcdef1234567890abcdef12345678'
      })

      expect(result.success).toBe(false)
      expect(result.paymentRequired).toBe(true)
      expect(result.message).toContain('$0.15')
      expect(result.message).toContain('payment')
    })
  })
})
