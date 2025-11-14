// ABOUTME: MCP tool for providing deposit instructions
// ABOUTME: Returns detailed steps for depositing USDC to fund queries

export interface DepositInstructionsInput {
  walletAddress: string
}

export interface DepositInstructionsResult {
  success: boolean
  instructions: string
  providerWallet: string
  usdcContractAddress: string
  network: string
  chainId: number
  estimatedCostPer1000Rows: number
}

export const depositInstructionsTool = {
  name: 'get_deposit_instructions',
  description: 'Get instructions for depositing USDC to fund query execution. Returns step-by-step guide for making deposits on Base network.',
  inputSchema: {
    type: 'object',
    properties: {
      walletAddress: {
        type: 'string',
        description: 'Your Ethereum wallet address that will be used for queries. Must be a valid 0x-prefixed address.'
      }
    },
    required: ['walletAddress']
  }
}

function validateWalletAddress(address: string): boolean {
  const ethAddressRegex = /^0x[a-fA-F0-9]{40}$/
  return ethAddressRegex.test(address)
}

export function createDepositInstructionsHandler(providerWallet: string) {
  return async (input: DepositInstructionsInput): Promise<DepositInstructionsResult> => {
    // Validate wallet address
    if (!input.walletAddress || input.walletAddress.trim() === '') {
      throw new Error('wallet address is required')
    }

    if (!validateWalletAddress(input.walletAddress)) {
      throw new Error('Invalid wallet address format. Must be a valid Ethereum address (0x + 40 hex characters)')
    }

    const instructions = `
# Deposit Instructions

To execute queries, you need to deposit USDC on the Base network.

## Step 1: Prepare Your Wallet
- Your agent wallet: ${input.walletAddress}
- Ensure you have USDC on Base network
- You'll also need a small amount of ETH on Base for gas fees

## Step 2: Send USDC Deposit
Send USDC to the provider wallet:
- **Provider Wallet**: ${providerWallet}
- **Network**: Base (Chain ID: 8453)
- **Token**: USDC (0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913)

## Step 3: Record Your Deposit
After sending USDC, you need to register the deposit with the x402 gateway:

\`\`\`bash
curl -X POST https://x402.serendb.com/api/deposit \\
  -H "Content-Type: application/json" \\
  -d '{
    "txHash": "YOUR_TRANSACTION_HASH",
    "agentWallet": "${input.walletAddress}",
    "providerId": "YOUR_PROVIDER_ID"
  }'
\`\`\`

Replace:
- \`YOUR_TRANSACTION_HASH\`: The transaction hash from your USDC transfer
- \`YOUR_PROVIDER_ID\`: The provider ID for this database

## Pricing Information
- Base cost: $0.01 per 1000 rows
- Markup: 1.5x
- **Final cost**: $0.015 per 1000 rows

Example: $1 deposit = ~66,000 rows of query results

## Check Your Balance
After depositing, check your balance using the \`check_balance\` tool.
`.trim()

    return {
      success: true,
      instructions,
      providerWallet,
      usdcContractAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      network: 'Base',
      chainId: 8453,
      estimatedCostPer1000Rows: 0.015
    }
  }
}
