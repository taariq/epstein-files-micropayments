// ABOUTME: Tests for x402 provider registration and pricing configuration
// ABOUTME: Validates gateway integration and environment setup

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { registerProvider, configurePricing, validateEnvironment } from './register-provider'

describe('Provider Registration', () => {
  beforeEach(() => {
    // Mock environment variables
    process.env.X402_GATEWAY_URL = 'https://test.example.com'
    process.env.PROVIDER_WALLET_ADDRESS = '0x1234567890abcdef'
    process.env.SERENDB_CONNECTION_STRING = 'postgresql://test:test@localhost/test'
  })

  it('should validate required environment variables', () => {
    expect(() => validateEnvironment(['X402_GATEWAY_URL', 'PROVIDER_WALLET_ADDRESS'])).not.toThrow()
  })

  it('should throw error when environment variables are missing', () => {
    delete process.env.X402_GATEWAY_URL
    expect(() => validateEnvironment(['X402_GATEWAY_URL'])).toThrow('Missing required environment variables')
  })

  it('should format registration request correctly', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        provider: { id: 'test-provider-id' },
        apiKey: 'test-api-key'
      })
    })
    global.fetch = mockFetch

    const result = await registerProvider('test@example.com')

    expect(mockFetch).toHaveBeenCalledWith(
      'https://test.example.com/api/providers/register',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: expect.stringContaining('Epstein Files Database')
      })
    )
    expect(result.provider.id).toBe('test-provider-id')
    expect(result.apiKey).toBe('test-api-key')
  })

  it('should throw error when registration fails', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      text: async () => 'Registration error'
    })
    global.fetch = mockFetch

    await expect(registerProvider('test@example.com')).rejects.toThrow('Registration failed')
  })
})

describe('Pricing Configuration', () => {
  beforeEach(() => {
    process.env.X402_GATEWAY_URL = 'https://test.example.com'
    process.env.X402_PROVIDER_ID = 'test-provider-id'
    process.env.X402_API_KEY = 'test-api-key'
  })

  it('should configure pricing with correct values', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true })
    })
    global.fetch = mockFetch

    await configurePricing()

    expect(mockFetch).toHaveBeenCalledWith(
      'https://test.example.com/api/providers/test-provider-id/pricing',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-api-key'
        }
      })
    )

    // Verify the pricing values are correct
    const callArgs = mockFetch.mock.calls[0]
    const body = JSON.parse(callArgs[1].body)
    expect(body.basePricePer1000Rows).toBe(0.01)
    expect(body.markupMultiplier).toBe(1.5)
  })

  it('should skip pricing if provider not yet registered', async () => {
    delete process.env.X402_PROVIDER_ID
    const mockFetch = vi.fn()
    global.fetch = mockFetch

    await configurePricing()

    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('should throw error when pricing configuration fails', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      text: async () => 'Pricing error'
    })
    global.fetch = mockFetch

    await expect(configurePricing()).rejects.toThrow('Pricing configuration failed')
  })
})
