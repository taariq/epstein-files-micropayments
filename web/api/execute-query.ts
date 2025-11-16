// ABOUTME: Vercel serverless function for executing database queries via x402 payment protocol
// ABOUTME: Handles query validation, cost estimation, and payment flow

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { X402Client } from '../../mcp-server/src/x402-client.js'

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

function validateQuery(query: string): void {
  const upperQuery = query.trim().toUpperCase()

  for (const operation of FORBIDDEN_OPERATIONS) {
    const regex = new RegExp(`\\b${operation}\\b`)
    if (regex.test(upperQuery)) {
      throw new Error(`Forbidden SQL operation: ${operation}`)
    }
  }
}

function validateWalletAddress(address: string): void {
  if (!address || typeof address !== 'string') {
    throw new Error('Wallet address is required')
  }

  // Ethereum address validation: 0x + 40 hex characters
  const ethereumAddressRegex = /^0x[a-fA-F0-9]{40}$/
  if (!ethereumAddressRegex.test(address)) {
    throw new Error('Invalid Ethereum wallet address format')
  }
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { walletAddress, query } = req.body

  // Validate inputs
  if (!query || typeof query !== 'string') {
    return res.status(400).json({ error: 'Query parameter is required' })
  }

  try {
    validateWalletAddress(walletAddress)
  } catch (error) {
    return res.status(400).json({
      error: error instanceof Error ? error.message : 'Invalid wallet address'
    })
  }

  try {
    validateQuery(query)
  } catch (error) {
    return res.status(400).json({
      error: error instanceof Error ? error.message : 'Query validation failed'
    })
  }

  // Check for required environment variables
  const requiredEnvVars = [
    'X402_GATEWAY_URL',
    'X402_PROVIDER_ID',
    'X402_API_KEY',
    'PROVIDER_WALLET_ADDRESS'
  ]

  for (const varName of requiredEnvVars) {
    if (!process.env[varName]) {
      console.error(`Missing required environment variable: ${varName}`)
      return res.status(500).json({
        error: 'Server configuration error: missing required credentials'
      })
    }
  }

  try {
    // Create X402 client
    const x402Client = new X402Client({
      gatewayUrl: process.env.X402_GATEWAY_URL!,
      providerId: process.env.X402_PROVIDER_ID!,
      apiKey: process.env.X402_API_KEY!,
      agentPrivateKey: process.env.AGENT_PRIVATE_KEY, // Optional: for automatic payments
      databaseUrl: process.env.SERENDB_CONNECTION_STRING // Optional: for cost estimation
    })

    // Execute query through x402 payment flow
    const result = await x402Client.executeQuery(query, walletAddress)

    // Check if payment is required
    if (result.paymentRequired && result.paymentUrl) {
      return res.status(402).json({
        paymentRequired: true,
        paymentUrl: result.paymentUrl,
        amount: result.amount || 'unknown',
        query: query
      })
    }

    // Return successful query results
    return res.status(200).json({
      success: true,
      rows: result.rows,
      rowCount: result.rowCount,
      payment: result.payment // Include payment metadata if available
    })
  } catch (error) {
    console.error('Failed to execute query:', error)

    // Return detailed error for debugging (in production, you might want to sanitize this)
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to execute query',
      details: error instanceof Error ? error.stack : undefined
    })
  }
}
