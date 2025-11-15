# Manual Integration Testing Guide

This guide provides step-by-step instructions for manually testing the MCP server with the live x402 gateway.

## Prerequisites

1. **Environment Variables**: Ensure `.env` file contains:
   ```bash
   X402_GATEWAY_URL=https://x402.serendb.com
   X402_PROVIDER_ID=<your-provider-id>
   X402_API_KEY=<your-api-key>
   AGENT_PRIVATE_KEY=<your-agent-wallet-private-key>
   PROVIDER_WALLET_ADDRESS=<your-provider-wallet-address>
   ```

2. **Agent Wallet Funded**: Verify agent wallet has USDC on Base network
   - Check balance: https://basescan.org/address/<AGENT_WALLET_ADDRESS>
   - USDC contract on Base: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
   - Minimum balance: $1 USDC for testing

3. **MCP Server Built**: Run `pnpm build` in `mcp-server/` directory

## Test Scenario 1: Automatic Payment Flow

### Step 1: Start MCP Server

```bash
cd mcp-server
node dist/index.js
```

Expected output:
```
✓ Agent wallet configured for automatic EIP-3009 payment signing
Scan Files MCP server running on stdio
```

### Step 2: Test via Claude Desktop

1. Open Claude Desktop
2. Verify MCP server is loaded (check status bar or logs)
3. Send query:
   ```
   Use the execute_query tool to query the document database:
   - Wallet address: <AGENT_WALLET_ADDRESS>
   - Query: SELECT * FROM documents LIMIT 5
   ```

Expected behavior:
1. MCP server receives query
2. Gateway returns HTTP 402 with PaymentRequirements
3. Server automatically signs EIP-3009 authorization
4. Server retries with X-PAYMENT header
5. Gateway settles payment on Base
6. Query executes successfully
7. Results returned with settlement metadata

### Step 3: Verify Settlement

Check transaction on BaseScan:
- URL format: `https://basescan.org/tx/<TRANSACTION_HASH>`
- Look for X-PAYMENT-RESPONSE header in logs
- Verify USDC transfer from agent wallet to provider wallet

## Test Scenario 2: Manual Testing with curl

### Step 1: Initial Request (Triggers 402)

```bash
curl -X POST https://x402.serendb.com/query \
  -H "Content-Type: application/json" \
  -H "x-api-key: $X402_API_KEY" \
  -d '{
    "providerId": "'$X402_PROVIDER_ID'",
    "query": "SELECT * FROM documents LIMIT 5",
    "walletAddress": "<AGENT_WALLET_ADDRESS>"
  }'
```

Expected response (HTTP 402):
```json
{
  "paymentRequired": true,
  "paymentRequirements": {
    "x402Version": 1,
    "accepts": [{
      "scheme": "eip3009",
      "network": "base-mainnet",
      "maxAmountRequired": "10000",
      "asset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      "payTo": "<PROVIDER_WALLET_ADDRESS>",
      "resource": "query",
      "maxTimeoutSeconds": 3600
    }]
  }
}
```

### Step 2: Sign EIP-3009 Authorization

Create `sign-payment.ts`:

```typescript
import { Wallet } from 'ethers'
import crypto from 'crypto'

const wallet = new Wallet(process.env.AGENT_PRIVATE_KEY!)

const domain = {
  name: 'USD Coin',
  version: '2',
  chainId: 8453,
  verifyingContract: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
}

const types = {
  TransferWithAuthorization: [
    { name: 'from', type: 'address' },
    { name: 'to', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'validAfter', type: 'uint256' },
    { name: 'validBefore', type: 'uint256' },
    { name: 'nonce', type: 'bytes32' }
  ]
}

const authorization = {
  from: wallet.address,
  to: process.env.PROVIDER_WALLET_ADDRESS!,
  value: '10000', // From paymentRequirements.maxAmountRequired
  validAfter: '0',
  validBefore: (Math.floor(Date.now() / 1000) + 3600).toString(),
  nonce: '0x' + crypto.randomBytes(32).toString('hex')
}

const signature = await wallet.signTypedData(domain, types, authorization)

const xPayment = {
  x402Version: 1,
  scheme: 'eip3009',
  network: 'base-mainnet',
  payload: { authorization, signature }
}

console.log('X-PAYMENT:', Buffer.from(JSON.stringify(xPayment)).toString('base64'))
```

Run: `npx tsx sign-payment.ts`

### Step 3: Retry with X-PAYMENT Header

```bash
curl -X POST https://x402.serendb.com/query \
  -H "Content-Type: application/json" \
  -H "x-api-key: $X402_API_KEY" \
  -H "X-PAYMENT: <BASE64_FROM_STEP_2>" \
  -d '{
    "providerId": "'$X402_PROVIDER_ID'",
    "query": "SELECT * FROM documents LIMIT 5",
    "walletAddress": "<AGENT_WALLET_ADDRESS>"
  }'
```

Expected response (HTTP 200):
```json
{
  "success": true,
  "rows": [...],
  "rowCount": 5,
  "actualCost": "0.000050",
  "settlement": {
    "transaction": "0x...",
    "block": 12345678
  }
}
```

Check X-PAYMENT-RESPONSE header for settlement details.

## Test Scenario 3: Error Handling

### Test Forbidden Operations

```bash
# Should return error, no payment
curl -X POST https://x402.serendb.com/query \
  -H "Content-Type: application/json" \
  -H "x-api-key: $X402_API_KEY" \
  -d '{
    "providerId": "'$X402_PROVIDER_ID'",
    "query": "DROP TABLE documents",
    "walletAddress": "<AGENT_WALLET_ADDRESS>"
  }'
```

Expected: Error response, no HTTP 402

### Test Invalid Wallet

```bash
curl -X POST https://x402.serendb.com/query \
  -H "Content-Type: application/json" \
  -H "x-api-key: $X402_API_KEY" \
  -d '{
    "providerId": "'$X402_PROVIDER_ID'",
    "query": "SELECT * FROM documents LIMIT 1",
    "walletAddress": "0xinvalid"
  }'
```

Expected: Error about invalid wallet address

## Test Scenario 4: Credit System

1. Execute query that will fail after payment (e.g., query with syntax error in WHERE clause)
2. Payment should succeed, query should fail
3. Gateway issues credit
4. Retry same query (should use credit, no new payment)
5. Verify paymentSource: 'credit' in response

## Troubleshooting

### Gateway Returns 500 Error

**Possible causes:**
1. Provider ID or API key incorrect
2. Database connection issue on gateway side
3. Payment settlement failure
4. Gateway internal error

**Solutions:**
- Verify X402_PROVIDER_ID and X402_API_KEY in .env
- Check gateway status: `curl https://x402.serendb.com/health`
- Review gateway logs (contact SerenDB support)

### Payment Fails with "Insufficient Balance"

**Cause:** Agent wallet has no USDC or insufficient amount

**Solution:**
1. Check wallet balance on BaseScan
2. Transfer USDC to agent wallet (minimum $1 for testing)
3. USDC contract on Base: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`

### "Invalid Signature" Error

**Possible causes:**
1. Private key doesn't match agent wallet address
2. Wrong network (must be Base, chainId 8453)
3. USDC contract address incorrect
4. EIP-712 domain mismatch

**Solutions:**
- Verify AGENT_PRIVATE_KEY matches wallet address
- Confirm chainId: 8453 (Base mainnet)
- Use correct USDC contract: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
- Check EIP-712 domain parameters match gateway expectations

### Payment Succeeds But Query Fails

**Expected behavior:** Gateway issues credit automatically

**Verify:**
1. Check next query uses credit (paymentSource: 'credit')
2. No new payment for second query
3. Credit balance shown in PaymentRequirements.extra.availableCredit

## Success Criteria

- [  ] Automatic payment flow works end-to-end
- [ ] Settlement transactions visible on BaseScan
- [ ] Error handling returns clear messages
- [ ] Forbidden operations rejected before payment
- [ ] Credit system works for failed queries
- [ ] MCP server logs are structured and useful
