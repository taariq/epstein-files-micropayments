#!/bin/bash
# Test script for x402 gateway

# Load environment variables from project root
cd ../..
source .env
cd -

# Get agent wallet address from private key
AGENT_WALLET=$(npx tsx get-wallet-address.ts | grep "0x" | awk '{print $NF}')

echo "Testing with agent wallet: $AGENT_WALLET"
echo ""

# Test endpoint with correct parameter names (sql, agentWallet)
curl -X POST https://x402.serendb.com/api/query \
  -H "Content-Type: application/json" \
  -H "x-api-key: $X402_API_KEY" \
  -d "{
    \"providerId\": \"$X402_PROVIDER_ID\",
    \"sql\": \"SELECT * FROM documents LIMIT 5\",
    \"agentWallet\": \"$AGENT_WALLET\"
  }"

echo ""
