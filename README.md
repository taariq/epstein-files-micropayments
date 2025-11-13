# Epstein Files Micropayments

Query document databases using AI agents with micropayments powered by [SerenAI](https://serendb.com) and x402.

This application demonstrates how to:
- Extract and index document content using OCR
- Store searchable content in SerenDB (PostgreSQL-compatible)
- Expose database queries through x402 payment-gated endpoints
- Enable AI agents to query data via MCP with automatic micropayments

## Quick Start

### 1. Fork and Clone

```bash
git clone https://github.com/YOUR_USERNAME/epstein-files-micropayments.git
cd epstein-files-micropayments
pnpm install
```

### 2. Set Up SerenDB Account

1. Sign up at [console.serendb.com/signup](https://console.serendb.com/signup)
2. Create a new database
3. Copy your connection string from the console

### 3. Get a Wallet for Receiving Payments

1. Install [Coinbase Wallet](https://www.coinbase.com/wallet) or another Base-compatible wallet
2. Switch to **Base network** (Ethereum L2)
3. Copy your wallet address (starts with `0x`)

**Why Base?** Lower transaction fees (~$0.01) compared to Ethereum mainnet (~$5-50).

### 4. Configure Environment

Copy `.env.example` to `.env` and fill in your credentials:

```bash
cp .env.example .env
```

Edit `.env`:
```bash
# Your SerenDB connection string
SERENDB_CONNECTION_STRING=postgresql://user:password@host:5432/dbname

# x402 gateway (leave as-is)
X402_GATEWAY_URL=https://x402.serendb.com

# You'll get these after registration in step 6
X402_PROVIDER_ID=
X402_API_KEY=

# Your wallet address from step 3
PROVIDER_WALLET_ADDRESS=0x...
```

### 5. Upload and Process Documents

1. Place your PDF/image files in [docs/Epstein_Files/](docs/Epstein_Files/)
2. Extract text and upload to database:

```bash
pnpm extract  # Extract text from documents using OCR
pnpm upload   # Upload extracted content to SerenDB
```

**Tip:** Run `pnpm backup` to create database snapshots for later restoration.

### 6. Register with x402 Gateway

Register your database as a payment-gated data provider:

```bash
pnpm register
```

This will:
- Register your provider with x402 gateway
- Return `X402_PROVIDER_ID` and `X402_API_KEY`
- Update your `.env` file automatically

### 7. Install MCP Server for AI Queries

The MCP server lets Claude Desktop query your database with automatic micropayments.

See detailed instructions: [mcp-server/INSTALLATION.md](mcp-server/INSTALLATION.md)

**Quick install:**

```bash
cd mcp-server
pnpm install
pnpm build
```

Add to Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "epstein-files": {
      "command": "node",
      "args": ["/full/path/to/mcp-server/dist/index.js"],
      "env": {
        "X402_GATEWAY_URL": "https://x402.serendb.com",
        "X402_PROVIDER_ID": "your-provider-id",
        "X402_API_KEY": "your-api-key"
      }
    }
  }
}
```

Restart Claude Desktop and test:
```
Query the database for all documents
```

## Architecture

```
┌─────────────────┐
│  Claude Desktop │
└────────┬────────┘
         │ MCP Protocol
┌────────▼────────┐
│   MCP Server    │
└────────┬────────┘
         │ HTTP + x402
┌────────▼────────┐      ┌──────────────┐
│ x402 Gateway    │◄────►│  SerenDB     │
└────────┬────────┘      └──────────────┘
         │ Payment Flow
┌────────▼────────┐
│  Base Network   │
└─────────────────┘
```

## How Micropayments Work

1. **Query Request**: Claude Desktop sends query via MCP server
2. **Payment Check**: x402 gateway checks if user has credits
3. **HTTP 402**: If insufficient credits, returns payment URL
4. **Payment**: User pays via Base network (~$0.01 per 1000 rows)
5. **Execute**: Gateway executes query and returns results
6. **Settlement**: Provider receives payment to their wallet

## Development Commands

```bash
# Document processing
pnpm extract        # Extract text from documents
pnpm upload         # Upload to database
pnpm backup         # Create database backup

# Provider setup
pnpm register       # Register with x402 gateway

# Web interface (optional)
cd web
pnpm dev           # Start SolidJS development server

# MCP server
cd mcp-server
pnpm build         # Build MCP server
pnpm test          # Run tests
```

## Project Structure

```
epstein-files-micropayments/
├── docs/
│   └── Epstein_Files/       # Upload your documents here
├── scripts/
│   ├── extract.ts           # OCR and text extraction
│   ├── upload.ts            # Upload to SerenDB
│   ├── register-provider.ts # Register with x402
│   └── backup.ts            # Database backup/restore
├── mcp-server/              # MCP server for Claude Desktop
│   ├── src/
│   │   ├── index.ts         # Server entry point
│   │   ├── x402-client.ts   # x402 gateway client
│   │   └── tools/           # MCP tool implementations
│   └── INSTALLATION.md      # Detailed MCP setup guide
└── web/                     # SolidJS web interface (optional)
```

## Customization

This codebase is designed to be forked and customized:

1. **Different Documents**: Replace Epstein Files with any PDFs/images
2. **Custom Schema**: Modify [scripts/schema.sql](scripts/schema.sql) for your data model
3. **Query Tools**: Add custom MCP tools in [mcp-server/src/tools/](mcp-server/src/tools/)
4. **Web UI**: Build custom interfaces in [web/](web/) using SolidJS

## Pricing

- **Query Cost**: $0.01 per 1000 rows (base price)
- **Provider Markup**: 1.5x (configurable)
- **Network Fees**: ~$0.01 per transaction on Base

**Example**: Querying 5000 rows costs ~$0.075 + ~$0.01 network fee = ~$0.085 total

## Security

- Never commit `.env` files with real credentials
- Use environment variables for all secrets
- Wallet addresses are public - only use addresses you control
- MCP server runs locally (not exposed publicly)
- x402 gateway validates all queries (read-only)

## Tech Stack

- **Frontend**: SolidJS (optional web interface)
- **Database**: SerenDB (PostgreSQL-compatible)
- **Payments**: x402 protocol on Base (Ethereum L2)
- **AI Integration**: Model Context Protocol (MCP)
- **OCR**: open-source text extraction tools

## Resources

- **SerenDB Console**: [console.serendb.com](https://console.serendb.com)
- **x402 Spec**: [github.com/serenorg/serenai-x402](https://github.com/serenorg/serenai-x402)
- **MCP Docs**: [modelcontextprotocol.io](https://modelcontextprotocol.io)
- **Base Network**: [base.org](https://base.org)

## Support

- **Issues**: [github.com/YOUR_USERNAME/epstein-files-micropayments/issues](https://github.com/YOUR_USERNAME/epstein-files-micropayments/issues)
- **SerenDB Support**: [console.serendb.com/support](https://console.serendb.com/support)

## License

MIT License - see [LICENSE](LICENSE) for details.
