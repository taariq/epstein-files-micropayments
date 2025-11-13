# MCP Server Installation Guide

The Epstein Files MCP server allows Claude Desktop to query the Epstein Files database through x402 micropayments.

**Important:** This server runs **locally on your machine**, not on a remote server. It integrates with Claude Desktop through the Model Context Protocol (MCP).

## Prerequisites

- **Node.js** 18 or higher
- **pnpm** (or npm/yarn)
- **Claude Desktop** application installed
- **x402 Provider credentials** (Provider ID and API Key)
- **Ethereum wallet address** for micropayments

## Installation Steps

### 1. Clone the Repository

```bash
git clone https://github.com/taariq/epstein-files-micropayments.git
cd epstein-files-micropayments/mcp-server
```

### 2. Install Dependencies

```bash
pnpm install
```

Or with npm:
```bash
npm install
```

### 3. Build the Server

```bash
pnpm build
```

This compiles TypeScript to JavaScript and creates the `dist/` directory with:
- `dist/index.js` - Main server entry point (executable)
- `dist/x402-client.js` - x402 gateway client
- `dist/tools/` - MCP tool implementations

### 4. Set Up Environment Variables

Create a `.env` file in the `mcp-server` directory:

```bash
# x402 Gateway Configuration
X402_GATEWAY_URL=https://x402.serendb.com
X402_PROVIDER_ID=your-provider-id-here
X402_API_KEY=your-api-key-here
```

**Getting Credentials:**
- Provider ID and API Key are obtained by registering with the x402 gateway
- See the main README for instructions on provider registration

### 5. Configure Claude Desktop

Edit your Claude Desktop configuration file:

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`
**Linux:** `~/.config/Claude/claude_desktop_config.json`

Add the MCP server configuration:

```json
{
  "mcpServers": {
    "epstein-files": {
      "command": "node",
      "args": [
        "/absolute/path/to/epstein-files-micropayments/mcp-server/dist/index.js"
      ],
      "env": {
        "X402_GATEWAY_URL": "https://x402.serendb.com",
        "X402_PROVIDER_ID": "your-provider-id",
        "X402_API_KEY": "your-api-key"
      }
    }
  }
}
```

**Important:**
- Use the **absolute path** to `dist/index.js` on your system
- Replace `your-provider-id` and `your-api-key` with your actual credentials
- The server name `epstein-files` can be customized

### 6. Restart Claude Desktop

Close and reopen Claude Desktop for the configuration to take effect.

## Verifying Installation

### Check MCP Server is Loaded

In Claude Desktop, start a new conversation and ask:
```
What tools do you have available?
```

You should see the `execute_query` tool listed.

### Test the Tool

Try a simple query:
```
Use the execute_query tool to query the Epstein Files database:
- Wallet address: 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb
- Query: SELECT * FROM documents LIMIT 5
```

**Note:** This will trigger a micropayment request (HTTP 402) unless you have sufficient credits.

## Usage

Once installed, you can query the Epstein Files database from Claude Desktop:

**Example prompts:**

```
Query the Epstein Files database for all documents
```

```
Search the Epstein Files for mentions of "JP Morgan" using my wallet address 0x...
```

```
Get a count of how many pages are in the database
```

Claude will use the `execute_query` tool automatically with your configured wallet address.

## Tool Parameters

The `execute_query` tool accepts:

- **walletAddress** (required): Your Ethereum wallet address for payment processing
- **query** (required): SQL SELECT query (read-only, no destructive operations)

**Forbidden operations:**
- `DROP`, `DELETE`, `UPDATE`, `INSERT`, `ALTER`, `CREATE`, `TRUNCATE`, `GRANT`, `REVOKE`

## Troubleshooting

### Server Not Showing in Claude Desktop

1. **Check configuration path:** Ensure the path to `dist/index.js` is absolute and correct
2. **Verify build:** Run `pnpm build` again
3. **Check logs:** Look at Claude Desktop logs (Help → View Logs)
4. **Restart Claude Desktop** completely

### Tool Calls Failing

1. **Check environment variables:** Verify X402_PROVIDER_ID and X402_API_KEY are set
2. **Test gateway connectivity:**
   ```bash
   curl https://x402.serendb.com/health
   ```
3. **Check wallet address format:** Must be valid Ethereum address (0x + 40 hex characters)

### HTTP 402 Payment Required

This is expected behavior! The system requires micropayments for queries:
- **Base price:** $0.01 per 1000 rows
- **Markup:** 1.5x
- Follow the payment URL provided in the error message

### Query Validation Errors

If your query is rejected:
- Ensure you're using only `SELECT` statements
- Avoid destructive operations (DROP, DELETE, UPDATE, etc.)
- Check SQL syntax

## Development

### Running Tests

```bash
pnpm test
```

### Development Mode (with auto-reload)

```bash
pnpm dev
```

### Linting

```bash
pnpm lint
```

## Updating

To update to the latest version:

```bash
cd epstein-files-micropayments
git pull origin main
cd mcp-server
pnpm install
pnpm build
```

Restart Claude Desktop after updating.

## Uninstalling

1. Remove the `epstein-files` entry from your Claude Desktop configuration file
2. Restart Claude Desktop
3. Optionally, delete the cloned repository:
   ```bash
   rm -rf epstein-files-micropayments
   ```

## Security Notes

- **Never commit your `.env` file** with actual credentials
- **Keep your API keys secure** - they provide access to your provider account
- **Wallet addresses are public** - only use addresses you're comfortable sharing
- The MCP server runs locally and does not expose any ports publicly

## Support

For issues, questions, or contributions:
- **GitHub Issues:** https://github.com/taariq/epstein-files-micropayments/issues
- **Documentation:** See main README.md

## Architecture

The MCP server:
1. Runs locally as a subprocess of Claude Desktop
2. Communicates via stdio (standard input/output)
3. Exposes the `execute_query` tool to Claude
4. Makes HTTP requests to the x402 gateway at `https://x402.serendb.com`
5. Handles payment flows (HTTP 402) automatically
6. Returns query results to Claude for presentation to the user
