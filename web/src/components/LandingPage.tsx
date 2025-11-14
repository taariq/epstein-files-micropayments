import { Component } from 'solid-js'

const LandingPage: Component = () => {
  return (
    <div class="landing-page">
      <header class="hero">
        <h1>Query Document Databases with Micropayments</h1>
        <p class="tagline">
          Pay-per-query access to document databases powered by x402
        </p>
      </header>

      <section class="about">
        <h2>What is This?</h2>
        <p>
          Access searchable document databases using AI assistants like Claude.
          Pay only for the queries you run - starting at $0.01 per 1000 rows returned.
        </p>
        <p>
          This database contains extracted text from documents, making them searchable
          via SQL queries with built-in micropayment support.
        </p>
      </section>

      <section class="quick-start">
        <h2>Quick Start</h2>
        <div class="steps">
          <div class="step">
            <h3>1. Get a Wallet</h3>
            <p>
              You'll need a crypto wallet to pay for queries. We support:
            </p>
            <ul>
              <li>
                <strong>Coinbase Wallet:</strong> Easy setup, built-in Base network support
                <br />
                <a href="https://www.coinbase.com/wallet" target="_blank" rel="noopener">Download Coinbase Wallet →</a>
              </li>
              <li>
                <strong>Rabby Wallet:</strong> Advanced features, multi-chain support
                <br />
                <a href="https://rabby.io/" target="_blank" rel="noopener">Download Rabby Wallet →</a>
              </li>
            </ul>
            <p>
              Both wallets support the <strong>Base network</strong> (Ethereum L2) for low transaction fees.
            </p>
          </div>

          <div class="step">
            <h3>2. Fund Your Wallet</h3>
            <p>
              Add funds to your wallet to pay for queries:
            </p>
            <ul>
              <li>Purchase ETH or USDC through Coinbase, Binance, or your wallet provider</li>
              <li>Bridge to Base network for minimal fees (optional but recommended)</li>
              <li>Keep at least $1-5 for multiple queries</li>
            </ul>
            <p class="pricing-note">
              <strong>Pricing:</strong> $0.01 per 1000 rows. Most queries cost less than $0.01.
            </p>
          </div>

          <div class="step">
            <h3>3. Add MCP Server to Claude</h3>
            <p>
              Connect this database to Claude Desktop by adding the MCP server to your config:
            </p>
            <pre><code>{`{
  "mcpServers": {
    "scan-files": {
      "command": "npx",
      "args": [
        "-y",
        "@scan-files/mcp-server"
      ],
      "env": {
        "X402_GATEWAY_URL": "https://x402.serendb.com",
        "X402_PROVIDER_ID": "your-provider-id-here",
        "X402_API_KEY": "your-api-key-here"
      }
    }
  }
}`}</code></pre>
            <p class="config-location">
              Add this to: <code>~/Library/Application Support/Claude/claude_desktop_config.json</code> (macOS)
              or <code>%APPDATA%/Claude/claude_desktop_config.json</code> (Windows)
            </p>
            <p class="config-note">
              <strong>Note:</strong> Replace <code>your-provider-id-here</code> and <code>your-api-key-here</code> with your x402 provider credentials.
              If you're running your own instance, get these by registering at the x402 gateway. See the <a href="https://github.com/taariq/scan-files-to-serenai-micropayments#setup">setup guide</a> for details.
            </p>
          </div>
        </div>
      </section>

      <section class="payment-info">
        <h2>How Payment Works</h2>
        <ol>
          <li>You ask Claude to query the database</li>
          <li>The system estimates the cost based on expected rows</li>
          <li>If payment is needed, you'll receive a payment link</li>
          <li>Complete payment with your wallet (takes ~30 seconds)</li>
          <li>Query executes and results are returned to Claude</li>
        </ol>
        <p class="payment-note">
          Payments are processed on the Base network for minimal fees (~$0.001 per transaction).
        </p>
      </section>

      <footer class="footer">
        <p>
          Powered by <strong>SerenDB</strong> • <strong>x402</strong> • <strong>Base Network</strong>
        </p>
        <p class="open-source-note">
          Open-source project. Want to host your own database?
          Visit the <a href="https://github.com/taariq/scan-files-to-serenai-micropayments" target="_blank" rel="noopener">GitHub repo</a>.
        </p>
      </footer>
    </div>
  )
}

export default LandingPage
