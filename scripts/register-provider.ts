// ABOUTME: Registers Epstein Files database as x402 payment provider
// ABOUTME: Configures pricing model for micropayment queries

import dotenv from 'dotenv'

dotenv.config()

export interface ProviderRegistration {
  name: string
  email: string
  walletAddress: string
  connectionString: string
}

export interface RegistrationResult {
  provider: {
    id: string
  }
  apiKey: string
}

export interface PricingConfig {
  basePricePer1000Rows: number
  markupMultiplier: number
}

export function validateEnvironment(requiredVars: string[]): void {
  const missing = requiredVars.filter(varName => !process.env[varName])

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`)
  }
}

export async function registerProvider(email: string): Promise<RegistrationResult> {
  validateEnvironment(['X402_GATEWAY_URL', 'PROVIDER_WALLET_ADDRESS', 'SERENDB_CONNECTION_STRING'])

  const gatewayUrl = process.env.X402_GATEWAY_URL!
  const walletAddress = process.env.PROVIDER_WALLET_ADDRESS!
  const connectionString = process.env.SERENDB_CONNECTION_STRING!

  const registration: ProviderRegistration = {
    name: 'Epstein Files Database',
    email,
    walletAddress,
    connectionString
  }

  console.log('Registering provider with x402 gateway...')

  const response = await fetch(`${gatewayUrl}/api/providers/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(registration)
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Registration failed: ${error}`)
  }

  const result = await response.json()

  console.log('\n✓ Provider registered successfully!')
  console.log('\nAdd these to your .env file:')
  console.log(`X402_PROVIDER_ID=${result.provider.id}`)
  console.log(`X402_API_KEY=${result.apiKey}`)

  return result
}

export async function configurePricing(): Promise<void> {
  const gatewayUrl = process.env.X402_GATEWAY_URL
  const providerId = process.env.X402_PROVIDER_ID
  const apiKey = process.env.X402_API_KEY

  if (!gatewayUrl || !providerId || !apiKey) {
    console.log('Skipping pricing configuration - provider not yet registered')
    return
  }

  // Micropayment pricing: $0.01 per 1000 rows ($0.00001 per row)
  const pricing: PricingConfig = {
    basePricePer1000Rows: 0.01,
    markupMultiplier: 1.5
  }

  console.log('\nConfiguring pricing model...')

  const response = await fetch(`${gatewayUrl}/api/providers/${providerId}/pricing`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify(pricing)
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Pricing configuration failed: ${error}`)
  }

  console.log('✓ Pricing configured successfully!')
  console.log(`  Base price: $${pricing.basePricePer1000Rows} per 1000 rows`)
  console.log(`  Markup: ${pricing.markupMultiplier}x`)
}

// CLI entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  const email = process.argv[2] || 'admin@example.com'

  // If provider credentials already exist, skip registration
  const hasProviderCredentials = process.env.X402_PROVIDER_ID && process.env.X402_API_KEY

  const runFlow = async () => {
    if (!hasProviderCredentials) {
      await registerProvider(email)
    } else {
      console.log('Provider credentials already exist, skipping registration...')
    }
    await configurePricing()
  }

  runFlow()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('Operation failed:', err)
      process.exit(1)
    })
}
