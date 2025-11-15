// ABOUTME: Integration tests for MCP server with live x402 gateway
// ABOUTME: Tests automatic payment signing, error handling, and settlement flow

import { describe, it, expect, beforeAll } from 'vitest'
import { config } from 'dotenv'
import { X402Client } from '../src/x402-client'
import { Wallet } from 'ethers'

// Load environment variables
config({ path: '../.env' })

describe('MCP Server Integration Tests', () => {
  let client: X402Client
  let agentWallet: Wallet

  beforeAll(() => {
    // Validate required environment variables
    const required = ['X402_GATEWAY_URL', 'X402_PROVIDER_ID', 'X402_API_KEY', 'AGENT_PRIVATE_KEY']
    for (const varName of required) {
      if (!process.env[varName]) {
        throw new Error(`${varName} environment variable is required for integration tests`)
      }
    }

    // Initialize client
    client = new X402Client({
      gatewayUrl: process.env.X402_GATEWAY_URL!,
      providerId: process.env.X402_PROVIDER_ID!,
      apiKey: process.env.X402_API_KEY!,
      agentPrivateKey: process.env.AGENT_PRIVATE_KEY
    })

    agentWallet = new Wallet(process.env.AGENT_PRIVATE_KEY!)
  })

  describe('Scenario 1: Automatic Payment with AGENT_PRIVATE_KEY', () => {
    it('should execute query with automatic EIP-3009 payment signing', async () => {
      const query = 'SELECT * FROM documents LIMIT 5'
      const result = await client.executeQuery(query, agentWallet.address)

      // Log full result for debugging
      console.log('Query result:', JSON.stringify(result, null, 2))

      if (!result.success) {
        console.error('Query failed:', result.error || result.message)
        if (result.paymentRequired) {
          console.error('Payment required:', result.paymentRequirements)
        }
      }

      expect(result.success).toBe(true)
      expect(result.rows).toBeDefined()
      expect(Array.isArray(result.rows)).toBe(true)
      expect(result.actualCost).toBeDefined()

      // Verify settlement metadata is present
      if (result.settlement) {
        expect(result.settlement.transaction).toBeDefined()
        expect(result.settlement.transaction).toMatch(/^0x[a-fA-F0-9]{64}$/)
        console.log(`✓ Settlement transaction: ${result.settlement.transaction}`)
        console.log(`  View on BaseScan: https://basescan.org/tx/${result.settlement.transaction}`)
      }
    }, 60000)

    it('should return cost and row count for successful query', async () => {
      const query = 'SELECT * FROM pages LIMIT 10'
      const result = await client.executeQuery(query, agentWallet.address)

      expect(result.success).toBe(true)
      expect(result.rowCount).toBeGreaterThanOrEqual(0)
      expect(result.actualCost).toBeDefined()

      const cost = parseFloat(result.actualCost || '0')
      expect(cost).toBeGreaterThan(0)

      console.log(`✓ Query returned ${result.rowCount} rows`)
      console.log(`  Cost: $${cost.toFixed(6)}`)
    }, 60000)
  })

  describe('Scenario 2: Error Handling', () => {
    it('should reject forbidden operations (DROP)', async () => {
      const query = 'DROP TABLE documents'

      try {
        await client.executeQuery(query, agentWallet.address)
        throw new Error('Expected query to be rejected')
      } catch (error) {
        expect(error).toBeDefined()
        expect(error instanceof Error).toBe(true)
        expect(error.message).toMatch(/forbidden|not allowed|invalid/i)
      }
    }, 30000)

    it('should reject forbidden operations (INSERT)', async () => {
      const query = "INSERT INTO documents (source_file, original_zip, total_pages) VALUES ('test.pdf', 'test', 1)"

      try {
        await client.executeQuery(query, agentWallet.address)
        throw new Error('Expected query to be rejected')
      } catch (error) {
        expect(error).toBeDefined()
        expect(error instanceof Error).toBe(true)
        expect(error.message).toMatch(/forbidden|not allowed|invalid/i)
      }
    }, 30000)

    it('should reject forbidden operations (DELETE)', async () => {
      const query = 'DELETE FROM documents WHERE id = 1'

      try {
        await client.executeQuery(query, agentWallet.address)
        throw new Error('Expected query to be rejected')
      } catch (error) {
        expect(error).toBeDefined()
        expect(error instanceof Error).toBe(true)
        expect(error.message).toMatch(/forbidden|not allowed|invalid/i)
      }
    }, 30000)

    it('should reject invalid wallet addresses', async () => {
      const query = 'SELECT * FROM documents LIMIT 1'
      const invalidAddress = '0xinvalid'

      try {
        await client.executeQuery(query, invalidAddress)
        throw new Error('Expected query to be rejected')
      } catch (error) {
        expect(error).toBeDefined()
        expect(error instanceof Error).toBe(true)
        expect(error.message).toMatch(/invalid|address/i)
      }
    }, 30000)

    it('should handle SQL syntax errors gracefully', async () => {
      const query = 'SELECT * FORM documents' // Typo: FORM instead of FROM

      try {
        await client.executeQuery(query, agentWallet.address)
        throw new Error('Expected query to fail')
      } catch (error) {
        expect(error).toBeDefined()
        expect(error instanceof Error).toBe(true)
      }
    }, 30000)
  })

  describe('Scenario 3: Complex Queries', () => {
    it('should execute JOIN queries successfully', async () => {
      const query = `
        SELECT d.source_file, COUNT(*) as page_count
        FROM pages p
        JOIN documents d ON p.document_id = d.id
        GROUP BY d.source_file
        LIMIT 5
      `

      const result = await client.executeQuery(query, agentWallet.address)

      expect(result.success).toBe(true)
      expect(result.rows).toBeDefined()

      if (result.rows && result.rows.length > 0) {
        const row = result.rows[0]
        expect(row).toHaveProperty('source_file')
        expect(row).toHaveProperty('page_count')
      }
    }, 60000)

    it('should execute text search queries', async () => {
      const query = "SELECT * FROM pages WHERE content_text ILIKE '%the%' LIMIT 3"

      const result = await client.executeQuery(query, agentWallet.address)

      expect(result.success).toBe(true)
      expect(result.rows).toBeDefined()
    }, 60000)
  })

  describe('Scenario 4: Payment Validation', () => {
    it('should include payment metadata in response', async () => {
      const query = 'SELECT COUNT(*) as total FROM pages'

      const result = await client.executeQuery(query, agentWallet.address)

      expect(result.success).toBe(true)
      expect(result.actualCost).toBeDefined()

      // Verify payment source is indicated
      if (result.paymentSource) {
        expect(['payment', 'credit']).toContain(result.paymentSource)
      }
    }, 60000)
  })
})
