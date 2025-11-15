# MCP Server Migration to Coinbase x402 Protocol

Migration tickets for updating the scan-files MCP server to use the new Coinbase x402 protocol with EIP-3009 authorization signatures.

---

## Issue #1: Add ethers.js dependency and EIP-3009 signing support

**Priority:** High
**Estimate:** 1 hour
**Labels:** `dependencies`, `crypto`

### Description
Add ethers.js library to enable EIP-712/EIP-3009 typed data signing for payment authorizations.

### Acceptance Criteria
- [ ] `ethers` v6+ added to `mcp-server/package.json` dependencies
- [ ] Package installs successfully with `pnpm install`
- [ ] TypeScript types resolve correctly for Wallet, TypedDataDomain, TypedDataField

### Technical Details
```json
{
  "dependencies": {
    "ethers": "^6.13.0"
  }
}
```

### Files Changed
- `mcp-server/package.json`

---

## Issue #2: Rewrite x402-client.ts for Coinbase protocol

**Priority:** Critical
**Estimate:** 3 hours
**Labels:** `breaking-change`, `payment`, `protocol`

### Description
Complete rewrite of x402-client.ts to implement Coinbase x402 protocol with:
- PaymentRequirements parsing (402 responses)
- EIP-3009 authorization signing
- X-PAYMENT header generation
- X-PAYMENT-RESPONSE parsing
- Credit system support

### Acceptance Criteria
- [ ] X402Client accepts optional `agentPrivateKey` in config
- [ ] `executeQuery()` handles 402 → sign → retry flow automatically when wallet configured
- [ ] Returns `PaymentRequirementsResponse` when no wallet configured (manual signing)
- [ ] Uses `x-api-key` header instead of `Authorization: Bearer`
- [ ] Parses X-PAYMENT-RESPONSE header for settlement metadata
- [ ] Removes old deposit/balance methods (`getBalance()`)
- [ ] All TypeScript interfaces match gateway API contracts

### Technical Details

**New Interfaces:**
```typescript
interface PaymentRequirement {
  scheme: string
  network: string
  maxAmountRequired: string  // USDC smallest units
  asset: string  // USDC contract address
  payTo: string  // Provider wallet
  resource: string
  description: string
  mimeType: string
  maxTimeoutSeconds: number
  extra?: {
    paymentRequestId?: string
    estimatedCost?: string  // USD decimal
    availableCredit?: string  // USD decimal (failed-query credits)
    amountDue?: string  // USD decimal (after credits)
  }
}

interface EIP3009Authorization {
  from: string
  to: string
  value: string  // USDC smallest units
  validAfter: string
  validBefore: string
  nonce: string  // bytes32 hex
}
```

**EIP-712 Domain:**
```typescript
const EIP3009_DOMAIN = {
  name: 'USD Coin',
  version: '2',
  chainId: 8453,  // Base mainnet
  verifyingContract: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
}
```

**Request Flow:**
1. POST `/api/query` without X-PAYMENT → 402 + PaymentRequirements
2. Sign authorization with wallet.signTypedData()
3. Base64-encode signed payload as X-PAYMENT header
4. Retry POST `/api/query` with X-PAYMENT → 200 + results + X-PAYMENT-RESPONSE

### Files Changed
- `mcp-server/src/x402-client.ts` (complete rewrite)

### Testing Checklist
- [ ] Client initializes with/without private key
- [ ] 402 response parsed correctly
- [ ] EIP-3009 signature generation works
- [ ] X-PAYMENT header format correct (base64 JSON)
- [ ] X-PAYMENT-RESPONSE parsing extracts settlement
- [ ] Error handling for payment failures
- [ ] Query validation still blocks DDL/DML operations

---

## Issue #3: Update execute-query tool for new payment flow

**Priority:** High
**Estimate:** 2 hours
**Labels:** `mcp`, `tools`

### Description
Update the `execute_query` MCP tool to work with new x402 client API and provide better user feedback for payment requirements.

### Acceptance Criteria
- [ ] Tool signature updated to remove paymentId/txHash parameters (no longer used)
- [ ] Returns structured payment requirements when wallet not configured
- [ ] Shows settlement transaction hash on successful paid queries
- [ ] Displays credit usage when `paymentSource: "credit"`
- [ ] Error messages clarify payment vs. query failures

### Technical Details

**Updated Handler:**
```typescript
export function createExecuteQueryHandler(client: X402Client) {
  return async (input: ExecuteQueryInput): Promise<ExecuteQueryResult> => {
    const result = await client.executeQuery(input.query, input.walletAddress)

    if (result.success) {
      return {
        success: true,
        data: {
          rows: result.rows || [],
          rowCount: result.rowCount || 0,
          cost: parseFloat(result.actualCost || '0'),
          summary: `Query returned ${result.rowCount} rows. Cost: $${result.actualCost}`,
          settlement: result.settlement  // { transaction, payer, network, timestamp }
        }
      }
    }

    // Payment required - return requirements for manual signing
    if (result.paymentRequired && result.paymentRequirements) {
      const req = result.paymentRequirements.accepts[0]
      return {
        success: false,
        paymentRequired: true,
        message: result.message,
        paymentRequirements: result.paymentRequirements
      }
    }

    return {
      success: false,
      error: result.error
    }
  }
}
```

**New Response Fields:**
- `settlement` - transaction details from X-PAYMENT-RESPONSE
- `paymentRequirements` - full 402 response for manual signing
- Remove `paymentUrl` (not applicable in new protocol)

### Files Changed
- `mcp-server/src/tools/execute-query.ts`

---

## Issue #4: Remove or update deposit-instructions tool

**Priority:** Medium
**Estimate:** 1 hour
**Labels:** `mcp`, `tools`, `cleanup`

### Description
The deposit flow is deprecated in Coinbase x402 protocol (payments happen per-query via EIP-3009 authorization). Either remove the tool or update it to explain the new payment model.

### Options

**Option A - Remove (Recommended):**
- Delete `mcp-server/src/tools/deposit-instructions.ts`
- Remove from tool registry in `index.ts`
- Payment instructions now embedded in 402 responses

**Option B - Update for EIP-3009:**
- Rename to `payment-instructions`
- Explain EIP-3009 signing flow
- Show example of manual signing with ethers.js

### Acceptance Criteria
- [ ] Decision made on remove vs. update
- [ ] If removed: tool deleted, registry updated, no broken imports
- [ ] If updated: explains new payment model clearly

### Files Changed
- `mcp-server/src/tools/deposit-instructions.ts` (delete or rewrite)
- `mcp-server/src/index.ts` (update tool registry)

---

## Issue #5: Add AGENT_PRIVATE_KEY environment variable support

**Priority:** High
**Estimate:** 1 hour
**Labels:** `config`, `security`

### Description
Add support for optional AGENT_PRIVATE_KEY environment variable to enable automatic payment signing.

### Acceptance Criteria
- [ ] `AGENT_PRIVATE_KEY` added to `.env.example` with documentation
- [ ] MCP server reads variable and passes to X402Client constructor
- [ ] Clear warning in logs when private key not configured
- [ ] Documentation explains security implications
- [ ] Claude Desktop config example updated

### Technical Details

**Environment Variables:**
```bash
# Required
X402_GATEWAY_URL=https://x402.serendb.com
X402_PROVIDER_ID=240e659a-0eb5-495d-8ba9-0b6ec9e07a1d
X402_API_KEY=seren_live_...
PROVIDER_WALLET_ADDRESS=0x...

# Optional - enables automatic payment signing
# WARNING: Store securely, never commit to git
AGENT_PRIVATE_KEY=0x...  # 64-character hex private key
```

**MCP Server Init:**
```typescript
const client = new X402Client({
  gatewayUrl: process.env.X402_GATEWAY_URL!,
  providerId: process.env.X402_PROVIDER_ID!,
  apiKey: process.env.X402_API_KEY!,
  agentPrivateKey: process.env.AGENT_PRIVATE_KEY  // optional
})

if (!process.env.AGENT_PRIVATE_KEY) {
  console.warn('AGENT_PRIVATE_KEY not set - queries will require manual payment signing')
}
```

**Claude Desktop Config:**
```json
{
  "scan-files": {
    "env": {
      "X402_GATEWAY_URL": "https://x402.serendb.com",
      "X402_PROVIDER_ID": "240e659a-0eb5-495d-8ba9-0b6ec9e07a1d",
      "X402_API_KEY": "seren_live_...",
      "PROVIDER_WALLET_ADDRESS": "0x...",
      "AGENT_PRIVATE_KEY": "0x..."
    }
  }
}
```

### Security Notes
- Private key gives full control over agent wallet
- User responsible for funding wallet with USDC on Base
- Consider using hardware wallet or secure key management
- Never log or expose private key in responses

### Files Changed
- `mcp-server/.env.example`
- `mcp-server/src/index.ts`
- `README.md` - environment variable documentation
- `~/Library/Application Support/Claude/claude_desktop_config.json` (user)

---

## Issue #6: Update README and documentation

**Priority:** Medium
**Estimate:** 2 hours
**Labels:** `documentation`

### Description
Update all documentation to reflect new Coinbase x402 protocol, EIP-3009 payments, and removal of deposit-based flow.

### Acceptance Criteria
- [ ] README.md explains new payment flow
- [ ] Architecture diagram updated (optional)
- [ ] Environment variables documented
- [ ] Setup instructions updated
- [ ] MCP tool descriptions reflect new API
- [ ] Migration guide from old protocol (if applicable)
- [ ] Security best practices for AGENT_PRIVATE_KEY

### Documentation Sections to Update

**README.md:**
- Quick Start - new payment flow
- Environment Variables - add AGENT_PRIVATE_KEY
- MCP Tools - updated execute_query description
- Architecture - EIP-3009 signing, X-PAYMENT headers
- Security - private key management

**New Files:**
- `MIGRATION.md` - guide for users updating from old protocol
- `docs/payment-flow.md` - detailed EIP-3009 flow diagrams

### Files Changed
- `README.md`
- `mcp-server/README.md` (if exists)
- `docs/2025112_Epstein_Micropayments.md` (update technical details)
- `MIGRATION.md` (new)

---

## Issue #7: Integration testing with live gateway

**Priority:** Critical
**Estimate:** 2 hours
**Labels:** `testing`, `integration`

### Description
End-to-end testing of updated MCP server against live x402 gateway (https://x402.serendb.com).

### Test Scenarios

**Scenario 1: Automatic Payment (with AGENT_PRIVATE_KEY)**
1. Configure AGENT_PRIVATE_KEY for test wallet with USDC
2. Execute query via MCP tool
3. Verify 402 → sign → retry flow happens automatically
4. Confirm query results returned with settlement metadata
5. Check X-PAYMENT-RESPONSE transaction on BaseScan

**Scenario 2: Manual Payment (without AGENT_PRIVATE_KEY)**
1. Remove AGENT_PRIVATE_KEY from config
2. Execute query via MCP tool
3. Receive PaymentRequirements response
4. Manually sign with ethers.js script
5. Retry query with X-PAYMENT header
6. Confirm query executes successfully

**Scenario 3: Credit System**
1. Execute paid query that fails (invalid SQL after payment)
2. Verify credit issued for failed query
3. Retry same query (should use credit, no new payment)
4. Confirm paymentSource: "credit" in response

**Scenario 4: Error Handling**
1. Test forbidden operations (DROP, INSERT, etc.)
2. Test invalid wallet addresses
3. Test insufficient USDC balance
4. Test expired authorization signatures
5. Test malformed X-PAYMENT headers

### Acceptance Criteria
- [ ] All test scenarios pass
- [ ] Settlement transactions visible on BaseScan
- [ ] Credit system works as expected
- [ ] Error messages clear and actionable
- [ ] No regressions in query execution
- [ ] MCP server logs structured and useful

### Test Data
- Test wallet: funded with USDC on Base testnet/mainnet
- Test queries: various SELECT statements against documents/pages tables
- Invalid queries: DDL/DML operations for security testing

### Files Changed
- `mcp-server/tests/integration.test.ts` (new)
- `mcp-server/tests/manual-test.md` (new - manual test steps)

---

## Implementation Order

Recommended order for minimal risk:

1. **Issue #1** - Add ethers.js dependency (prerequisite)
2. **Issue #5** - Add environment variable support (prerequisite)
3. **Issue #2** - Rewrite x402-client.ts (core change)
4. **Issue #3** - Update execute-query tool
5. **Issue #4** - Remove deposit-instructions tool
6. **Issue #7** - Integration testing (validate all changes)
7. **Issue #6** - Update documentation (after testing confirms it works)

## Rollback Plan

If migration fails:
1. Restore `mcp-server/src/x402-client.ts.backup`
2. Remove ethers.js dependency
3. Revert environment variable changes
4. Old protocol remains functional until gateway fully deprecates it

## Dependencies & Tools Needed

- **ethers.js v6+** - EIP-712 signing
- **Base RPC access** - verify transactions
- **Test wallet** - funded with USDC on Base
- **BaseScan API** - confirm settlement transactions
- **Claude Desktop** - test MCP server integration
- **curl/Postman** - manual API testing

## Migration Timeline

- **Setup** (Issue #1, #5): 2 hours
- **Core Migration** (Issue #2, #3, #4): 6 hours
- **Testing** (Issue #7): 2 hours
- **Documentation** (Issue #6): 2 hours
- **Total**: ~12 hours (1.5 days)

## Breaking Changes

⚠️ **Users must update:**
1. Add `AGENT_PRIVATE_KEY` to enable automatic payments
2. Fund agent wallet with USDC on Base network
3. Update Claude Desktop config with new env vars
4. Remove old deposit-related workflows

## Success Criteria

✅ MCP server executes queries with automatic EIP-3009 payments
✅ Credit system works for failed queries
✅ Settlement transactions visible on-chain
✅ Error handling clear and actionable
✅ Documentation reflects new protocol
✅ No security vulnerabilities introduced
