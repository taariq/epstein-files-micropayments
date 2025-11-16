#!/bin/bash
# Verbose test script for x402 gateway debugging

# Load environment variables from project root
cd ../..
source .env
cd -

# Get agent wallet address from private key
AGENT_WALLET=$(npx tsx get-wallet-address.ts | grep "0x" | awk '{print $NF}')

echo "=== Testing Gateway ==="
echo "Gateway URL: $X402_GATEWAY_URL"
echo "Provider ID: $X402_PROVIDER_ID"
echo "Agent Wallet: $AGENT_WALLET"
echo ""

# Make request with verbose output
curl -v -X POST "${X402_GATEWAY_URL}/api/query" \
  -H "Content-Type: application/json" \
  -H "x-api-key: ${X402_API_KEY}" \
  -d "{\"providerId\":\"${X402_PROVIDER_ID}\",\"sql\":\"SELECT * FROM documents LIMIT 5\",\"agentWallet\":\"${AGENT_WALLET}\"}"

echo ""
