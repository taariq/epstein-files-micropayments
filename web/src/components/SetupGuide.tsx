import { Component } from 'solid-js'

const SetupGuide: Component = () => {
  return (
    <div class="setup-guide">
      <h1>Setup Guide</h1>
      <p class="intro">
        Follow these steps to connect Claude Desktop to query document databases via micropayments.
      </p>

      <section class="setup-section">
        <h2>1. Wallet Setup</h2>
        <p>You'll need a crypto wallet to pay for queries. We support:</p>
        <div class="steps-list">
          <div class="step-item">
            <h4>Coinbase Wallet</h4>
            <p>
              Download{' '}
              <a href="https://www.coinbase.com/wallet" target="_blank" rel="noopener noreferrer">
                Coinbase Wallet
              </a>{' '}
              - Easy setup with built-in Base network support.
            </p>
          </div>
          <div class="step-item">
            <h4>Rabby Wallet</h4>
            <p>
              Download{' '}
              <a href="https://rabby.io/" target="_blank" rel="noopener noreferrer">
                Rabby Wallet
              </a>{' '}
              - Advanced features with multi-chain support.
            </p>
          </div>
          <div class="step-item">
            <h4>Switch to Base Network</h4>
            <p>
              Both wallets support the Base network (Ethereum L2) for ultra-low transaction fees (~$0.002 per transaction).
            </p>
          </div>
          <div class="step-item">
            <h4>Copy Your Address</h4>
            <p>
              Click on your account name to copy your wallet address (starts with 0x).
              You'll use this when Claude queries require payment.
            </p>
          </div>
        </div>
      </section>

      <section class="setup-section">
        <h2>2. Fund Your Wallet</h2>
        <p>Add funds to your wallet to pay for queries:</p>
        <div class="steps-list">
          <div class="step-item">
            <h4>Get USDC on Coinbase</h4>
            <p>
              Purchase USDC on{' '}
              <a href="https://www.coinbase.com/" target="_blank" rel="noopener noreferrer">
                Coinbase
              </a>
              . Start with $5-10 to test the system.
            </p>
          </div>
          <div class="step-item">
            <h4>Transfer to Base Network</h4>
            <p>
              Use Coinbase to send USDC directly to your wallet address on the Base network.
              This avoids expensive Ethereum mainnet fees.
            </p>
          </div>
          <div class="step-item">
            <h4>Verify Balance</h4>
            <p>
              Open your wallet and ensure your USDC balance appears on Base network.
              Queries cost approximately $0.01 per 1000 rows returned - most queries cost less than a cent!
            </p>
          </div>
        </div>
      </section>

      <section class="setup-section">
        <h2>3. Configure Claude Desktop</h2>
        <p>Add the Scan Files MCP server to your Claude Desktop configuration:</p>

        <div class="step-item">
          <h4>Locate Configuration File</h4>
          <p>Find your Claude Desktop MCP configuration file:</p>
          <div class="code-block">
            <code>
              # macOS<br />
              ~/Library/Application Support/Claude/claude_desktop_config.json<br />
              <br />
              # Windows<br />
              %APPDATA%\Claude\claude_desktop_config.json
            </code>
          </div>
        </div>

        <div class="step-item">
          <h4>Add MCP Server</h4>
          <p>Edit the configuration file and add the Scan Files server:</p>
          <div class="code-block">
            <code>
              {JSON.stringify({
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
              }, null, 2)}
            </code>
          </div>
          <p class="credential-note">
            <strong>Important:</strong> Replace <code>your-provider-id-here</code> and <code>your-api-key-here</code> with your actual x402 provider credentials.
            To obtain these, you need to register as a provider with the x402 gateway. See the repository README for registration instructions.
          </p>
        </div>

        <div class="step-item">
          <h4>Restart Claude Desktop</h4>
          <p>
            Close and reopen Claude Desktop. The Scan Files database connector should now be
            available and ready to query documents.
          </p>
        </div>
      </section>

      <section class="setup-section">
        <h2>4. Example Queries</h2>
        <p>Here are some example SQL queries you can try:</p>

        <div class="example-query">
          <h4>Search for specific terms</h4>
          <div class="code-block">
            <code>
              SELECT d.source_file, p.page_number, p.content_text<br />
              FROM pages p<br />
              JOIN documents d ON p.document_id = d.id<br />
              WHERE p.content_text ILIKE '%flight%'<br />
              LIMIT 10;
            </code>
          </div>
        </div>

        <div class="example-query">
          <h4>List all documents</h4>
          <div class="code-block">
            <code>
              SELECT source_file, original_zip, total_pages, processed_at<br />
              FROM documents<br />
              ORDER BY processed_at DESC;
            </code>
          </div>
        </div>

        <div class="example-query">
          <h4>Count total pages</h4>
          <div class="code-block">
            <code>
              SELECT COUNT(*) as total_pages FROM pages;
            </code>
          </div>
        </div>
      </section>

      <section class="setup-section no-sql-section">
        <h2>5. Don't Know SQL?</h2>
        <p>No problem! Copy and paste this prompt into Claude Desktop:</p>

        <div class="code-block prompt-example">
          <code>
            I have access to a document database through the Scan Files connector.
            The database has two tables:
            <br /><br />
            - documents: Contains metadata (id, source_file, original_zip, total_pages, processed_at)
            <br />
            - pages: Contains extracted text (id, document_id, page_number, content_text, ocr_confidence, created_at)
            <br /><br />
            Please help me search this database using natural language. I can ask questions like:
            <br />
            - "How many documents are in the database?"
            <br />
            - "Search for documents containing the word 'contract'"
            <br />
            - "Show me the first 5 pages of text"
            <br />
            - "Find all references to 'flight' or 'aircraft'"
            <br /><br />
            Just translate my questions into SQL queries and execute them for me.
          </code>
        </div>

        <p class="note">
          After pasting this prompt, Claude will understand your database structure and can
          translate any question into the appropriate SQL query automatically!
        </p>
      </section>

      <section class="setup-section">
        <h2>6. Using with Claude Desktop</h2>
        <p>Once configured, you can query the database directly in Claude:</p>

        <div class="example-query">
          <h4>Example Prompt</h4>
          <div class="code-block prompt-example">
            <code>
              Search the document database for any mentions of "private jet"
              or "aircraft". Use my wallet address:
              0x1234567890abcdef1234567890abcdef12345678
            </code>
          </div>
        </div>

        <p>Claude will:</p>
        <ul>
          <li>Construct an appropriate SQL query based on your request</li>
          <li>Execute it through the MCP server</li>
          <li>Handle the payment flow if required</li>
          <li>Return the results directly to you</li>
        </ul>
      </section>

      <section class="setup-section troubleshooting">
        <h2>Troubleshooting</h2>

        <div class="faq-item">
          <h4>Payment required error?</h4>
          <p>
            This means you need to complete a payment before the query executes.
            Follow the payment URL provided and ensure your wallet has sufficient USDC on Base network.
          </p>
        </div>

        <div class="faq-item">
          <h4>MCP server not connecting?</h4>
          <p>
            Verify that you've added the configuration correctly to your Claude Desktop config file
            and restarted Claude Desktop. The MCP server will be installed automatically via npx.
          </p>
        </div>

        <div class="faq-item">
          <h4>Query validation errors?</h4>
          <p>
            Only SELECT queries are allowed for security reasons. Queries attempting
            DROP, DELETE, UPDATE, INSERT, or ALTER will be rejected.
          </p>
        </div>
      </section>
    </div>
  )
}

export default SetupGuide
