#!/usr/bin/env node
// ABOUTME: MCP server entry point for document database queries
// ABOUTME: Exposes execute_query tool via stdio transport for LLM integration

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'
import dotenv from 'dotenv'
import { X402Client } from './x402-client.js'
import { executeQueryTool, createExecuteQueryHandler } from './tools/execute-query.js'
import { checkBalanceTool, createCheckBalanceHandler } from './tools/check-balance.js'
import { depositInstructionsTool, createDepositInstructionsHandler } from './tools/deposit-instructions.js'

// Load environment variables
dotenv.config()

// Validate required environment variables
const requiredEnvVars = ['X402_GATEWAY_URL', 'X402_PROVIDER_ID', 'X402_API_KEY', 'PROVIDER_WALLET_ADDRESS']
for (const varName of requiredEnvVars) {
  if (!process.env[varName]) {
    console.error(`Error: ${varName} environment variable is required`)
    process.exit(1)
  }
}

// Create x402 client
const x402Client = new X402Client({
  gatewayUrl: process.env.X402_GATEWAY_URL!,
  providerId: process.env.X402_PROVIDER_ID!,
  apiKey: process.env.X402_API_KEY!
})

// Create tool handlers
const executeQueryHandler = createExecuteQueryHandler(x402Client)
const checkBalanceHandler = createCheckBalanceHandler(x402Client)
const depositInstructionsHandler = createDepositInstructionsHandler(process.env.PROVIDER_WALLET_ADDRESS!)

// Create MCP server
const server = new Server(
  {
    name: 'scan-files-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
)

// Register tool handlers
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [executeQueryTool, checkBalanceTool, depositInstructionsTool],
  }
})

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const toolName = request.params.name
  let result: any

  switch (toolName) {
    case 'execute_query':
      result = await executeQueryHandler(request.params.arguments as any)
      break
    case 'check_balance':
      result = await checkBalanceHandler(request.params.arguments as any)
      break
    case 'get_deposit_instructions':
      result = await depositInstructionsHandler(request.params.arguments as any)
      break
    default:
      throw new Error(`Unknown tool: ${toolName}`)
  }

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(result, null, 2),
      },
    ],
  }
})

// Start server with stdio transport
async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)

  console.error('Scan Files MCP server running on stdio')
}

main().catch((error) => {
  console.error('Server error:', error)
  process.exit(1)
})
