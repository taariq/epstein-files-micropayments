// ABOUTME: Tests for x402 gateway client that handles micropayment queries
// ABOUTME: Validates query safety, payment flows, and gateway integration

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { X402Client, QueryResult } from './x402-client'

describe('X402Client', () => {
  let client: X402Client

  beforeEach(() => {
    client = new X402Client({
      gatewayUrl: 'https://test.x402.com',
      providerId: 'test-provider-id',
      apiKey: 'test-api-key'
    })
  })

  describe('Query Validation', () => {
    it('should allow SELECT queries', () => {
      expect(() => client.validateQuery('SELECT * FROM documents')).not.toThrow()
    })

    it('should allow SELECT with WHERE clause', () => {
      expect(() => client.validateQuery('SELECT id, content_text FROM pages WHERE page_number = 1')).not.toThrow()
    })

    it('should forbid DROP queries', () => {
      expect(() => client.validateQuery('DROP TABLE documents')).toThrow('Forbidden SQL operation')
    })

    it('should forbid DELETE queries', () => {
      expect(() => client.validateQuery('DELETE FROM documents')).toThrow('Forbidden SQL operation')
    })

    it('should forbid UPDATE queries', () => {
      expect(() => client.validateQuery('UPDATE documents SET name = "x"')).toThrow('Forbidden SQL operation')
    })

    it('should forbid INSERT queries', () => {
      expect(() => client.validateQuery('INSERT INTO documents VALUES (1)')).toThrow('Forbidden SQL operation')
    })

    it('should forbid ALTER queries', () => {
      expect(() => client.validateQuery('ALTER TABLE documents ADD COLUMN x')).toThrow('Forbidden SQL operation')
    })

    it('should be case-insensitive in validation', () => {
      expect(() => client.validateQuery('select * from documents')).not.toThrow()
      expect(() => client.validateQuery('drop table documents')).toThrow('Forbidden SQL operation')
    })
  })

  describe('Query Execution', () => {
    it('should execute successful query and return results', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          rows: [{ id: 1, name: 'Test Doc' }],
          rowCount: 1,
          cost: 0.001
        })
      })
      global.fetch = mockFetch

      const result = await client.executeQuery('SELECT * FROM documents LIMIT 1')

      expect(mockFetch).toHaveBeenCalledWith(
        'https://test.x402.com/api/query',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-api-key',
            'X-Provider-ID': 'test-provider-id'
          }
        })
      )

      expect(result.success).toBe(true)
      expect(result.rows).toHaveLength(1)
      expect(result.rows?.[0].id).toBe(1)
      expect(result.cost).toBe(0.001)
    })

    it('should handle HTTP 402 payment required', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 402,
        json: async () => ({
          error: 'Payment required',
          paymentUrl: 'https://pay.x402.com/abc123',
          estimatedCost: 0.05
        })
      })
      global.fetch = mockFetch

      const result = await client.executeQuery('SELECT * FROM documents')

      expect(result.success).toBe(false)
      expect(result.paymentRequired).toBe(true)
      expect(result.paymentUrl).toBe('https://pay.x402.com/abc123')
      expect(result.estimatedCost).toBe(0.05)
    })

    it('should handle gateway errors', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'Internal server error'
      })
      global.fetch = mockFetch

      const result = await client.executeQuery('SELECT * FROM documents')

      expect(result.success).toBe(false)
      expect(result.error).toContain('Gateway error')
    })

    it('should handle network errors', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('Network timeout'))
      global.fetch = mockFetch

      const result = await client.executeQuery('SELECT * FROM documents')

      expect(result.success).toBe(false)
      expect(result.error).toContain('Network timeout')
    })

    it('should reject unsafe queries before sending', async () => {
      const mockFetch = vi.fn()
      global.fetch = mockFetch

      const result = await client.executeQuery('DROP TABLE documents')

      expect(result.success).toBe(false)
      expect(result.error).toContain('Forbidden SQL operation')
      expect(mockFetch).not.toHaveBeenCalled()
    })
  })

  describe('Configuration', () => {
    it('should throw error when gateway URL is missing', () => {
      expect(() => new X402Client({
        gatewayUrl: '',
        providerId: 'test',
        apiKey: 'test'
      })).toThrow('gatewayUrl is required')
    })

    it('should throw error when provider ID is missing', () => {
      expect(() => new X402Client({
        gatewayUrl: 'https://test.com',
        providerId: '',
        apiKey: 'test'
      })).toThrow('providerId is required')
    })

    it('should throw error when API key is missing', () => {
      expect(() => new X402Client({
        gatewayUrl: 'https://test.com',
        providerId: 'test',
        apiKey: ''
      })).toThrow('apiKey is required')
    })
  })
})
