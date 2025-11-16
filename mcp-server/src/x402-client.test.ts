// ABOUTME: Tests for Coinbase x402 client handling estimation and payment flows
// ABOUTME: Validates query validation, payment handling, and settlement parsing

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { webcrypto } from 'crypto'
import { X402Client, PaymentRequirementsResponse } from './x402-client'

// Ensure crypto.getRandomValues is available during tests
;(globalThis as any).crypto = webcrypto

const TEST_WALLET = '0x1234567890abcdef1234567890abcdef12345678'

const createPaymentRequirements = (): PaymentRequirementsResponse => ({
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
        estimatedCost: '0.010000',
        paymentRequestId: 'req_123'
      }
    }
  ]
})

describe('X402Client', () => {
  let client: X402Client
  let mockFetch: ReturnType<typeof vi.fn>

  beforeEach(() => {
    client = new X402Client({
      gatewayUrl: 'https://test.x402.com',
      providerId: 'test-provider-id',
      apiKey: 'test-api-key'
    })
    mockFetch = vi.fn()
    global.fetch = mockFetch as any
  })

  describe('query validation', () => {
    it('allows SELECT queries', () => {
      expect(() => client.validateQuery('SELECT * FROM documents')).not.toThrow()
    })

    it('rejects destructive statements', () => {
      expect(() => client.validateQuery('DROP TABLE documents')).toThrow('Forbidden SQL operation')
      expect(() => client.validateQuery('delete from pages')).toThrow('Forbidden SQL operation')
    })
  })

  describe('query execution', () => {
    it('executes successful queries and forwards estimated rows', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          rows: [{ id: 1, source_file: 'doc.pdf' }],
          rowCount: 1,
          estimatedCost: '0.001000',
          actualCost: '0.001000',
          executionTime: 42,
          paymentSource: 'payment'
        })
      })

      const result = await client.executeQuery('SELECT * FROM documents LIMIT 1', TEST_WALLET)

      expect(mockFetch).toHaveBeenCalledTimes(1)
      const [, options] = mockFetch.mock.calls[0]
      expect(options.headers['x-api-key']).toBe('test-api-key')
      const parsedBody = JSON.parse(options.body)
      expect(parsedBody.estimatedRows).toBe(0)

      expect(result.success).toBe(true)
      expect(result.rows?.[0].id).toBe(1)
      expect(result.actualCost).toBe('0.001000')
    })

    it('uses EXPLAIN estimates when a database pool is available', async () => {
      const dbQuery = vi.fn().mockResolvedValue({
        rows: [
          {
            'QUERY PLAN': [
              {
                Plan: {
                  'Plan Rows': 512
                }
              }
            ]
          }
        ]
      })
      ;(client as any).dbPool = { query: dbQuery }

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ rows: [], rowCount: 0 })
      })

      await client.executeQuery('SELECT * FROM pages', TEST_WALLET)

      expect(dbQuery).toHaveBeenCalledWith('EXPLAIN (FORMAT JSON) SELECT * FROM pages')
      const parsedBody = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(parsedBody.estimatedRows).toBe(512)
    })

    it('returns payment requirements when wallet signing is unavailable', async () => {
      const paymentRequirements = createPaymentRequirements()
      mockFetch.mockResolvedValue({
        ok: false,
        status: 402,
        json: async () => paymentRequirements
      })

      const result = await client.executeQuery('SELECT * FROM documents', TEST_WALLET)

      expect(result.success).toBe(false)
      expect(result.paymentRequired).toBe(true)
      expect(result.paymentRequirements).toEqual(paymentRequirements)
      expect(result.message).toContain('Payment required')
    })

    it('signs and retries payment when agent wallet is configured', async () => {
      const autoClient = new X402Client({
        gatewayUrl: 'https://test.x402.com',
        providerId: 'test-provider-id',
        apiKey: 'test-api-key',
        agentPrivateKey: '0x59c6995e998f97a5a004497e5d0ce8d2d9992f5b3d9d43a118109d0f6bdc200'
      })
      const paymentRequirements = createPaymentRequirements()
      const settlement = {
        success: true,
        payer: TEST_WALLET,
        transaction: '0xabc',
        network: 'base',
        timestamp: 123
      }

      const paymentFetch = vi.fn()
      paymentFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 402,
          json: async () => paymentRequirements
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            rows: [{ id: 1 }],
            rowCount: 1,
            estimatedCost: '0.010000',
            actualCost: '0.010000',
            executionTime: 100,
            paymentSource: 'payment'
          }),
          headers: {
            get: () => Buffer.from(JSON.stringify(settlement)).toString('base64')
          }
        })

      global.fetch = paymentFetch as any

      const result = await autoClient.executeQuery('SELECT * FROM documents', TEST_WALLET)

      expect(paymentFetch).toHaveBeenCalledTimes(2)
      const secondHeaders = paymentFetch.mock.calls[1][1].headers
      expect(secondHeaders['X-PAYMENT']).toBeDefined()
      expect(result.success).toBe(true)
      expect(result.settlement?.transaction).toBe('0xabc')
    })

    it('bubbles up payment failures from the gateway', async () => {
      const autoClient = new X402Client({
        gatewayUrl: 'https://test.x402.com',
        providerId: 'test-provider-id',
        apiKey: 'test-api-key',
        agentPrivateKey: '0x59c6995e998f97a5a004497e5d0ce8d2d9992f5b3d9d43a118109d0f6bdc200'
      })
      const paymentRequirements = createPaymentRequirements()

      const paymentFetch = vi.fn()
      paymentFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 402,
          json: async () => paymentRequirements
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: async () => ({ error: 'Payment failed' })
        })

      global.fetch = paymentFetch as any

      const result = await autoClient.executeQuery('SELECT * FROM documents', TEST_WALLET)

      expect(result.success).toBe(false)
      expect(result.error).toContain('Payment failed')
    })

    it('handles gateway errors on the first request', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Internal' })
      })

      const result = await client.executeQuery('SELECT * FROM documents', TEST_WALLET)

      expect(result.success).toBe(false)
      expect(result.error).toContain('Gateway error (500)')
    })

    it('handles network failures gracefully', async () => {
      mockFetch.mockRejectedValue(new Error('Network timeout'))

      const result = await client.executeQuery('SELECT * FROM documents', TEST_WALLET)

      expect(result.success).toBe(false)
      expect(result.error).toContain('Network timeout')
    })

    it('rejects unsafe queries before contacting the gateway', async () => {
      const result = await client.executeQuery('DROP TABLE documents', TEST_WALLET)

      expect(result.success).toBe(false)
      expect(result.error).toContain('Forbidden SQL operation')
      expect(mockFetch).not.toHaveBeenCalled()
    })
  })
})
