import { Component } from 'solid-js'

const SetupGuide: Component = () => {
  return (
    <div class="setup-guide">
      <h1>Setup Guide</h1>
      <p class="intro">
        Follow these steps to connect your LLM (like Claude Desktop) to query the Epstein Files database via micropayments.
      </p>

      <section class="setup-section">
        <h2>1. Wallet Setup</h2>
        <p>You'll need an Ethereum-compatible wallet to pay for queries:</p>
        <div class="steps-list">
          <div class="step-item">
            <h4>Install MetaMask</h4>
            <p>
              Download and install{' '}
              <a href="https://metamask.io/" target="_blank" rel="noopener noreferrer">
                MetaMask
              </a>{' '}
              browser extension or mobile app.
            </p>
          </div>
          <div class="step-item">
            <h4>Create or Import Wallet</h4>
            <p>
              Follow MetaMask's instructions to create a new wallet or import an existing one.
              Keep your seed phrase secure!
            </p>
          </div>
          <div class="step-item">
            <h4>Copy Your Address</h4>
            <p>
              Click on your account name to copy your Ethereum address (starts with 0x).
              You'll use this address when querying the database.
            </p>
          </div>
        </div>
      </section>

      <section class="setup-section">
        <h2>2. Fund Your Wallet</h2>
        <p>Add USDC to your wallet to pay for queries:</p>
        <div class="steps-list">
          <div class="step-item">
            <h4>Get USDC</h4>
            <p>
              Purchase USDC on a cryptocurrency exchange like{' '}
              <a href="https://www.coinbase.com/" target="_blank" rel="noopener noreferrer">
                Coinbase
              </a>
              ,{' '}
              <a href="https://www.kraken.com/" target="_blank" rel="noopener noreferrer">
                Kraken
              </a>
              , or use a fiat on-ramp service.
            </p>
          </div>
          <div class="step-item">
            <h4>Transfer to Your Wallet</h4>
            <p>
              Send USDC to your MetaMask wallet address. Start with a small amount ($5-10)
              to test the system.
            </p>
          </div>
          <div class="step-item">
            <h4>Verify Balance</h4>
            <p>
              Open MetaMask and ensure your USDC balance appears. Queries cost approximately
              $0.01 per 1000 rows returned.
            </p>
          </div>
        </div>
      </section>

      <section class="setup-section">
        <h2>3. Configure Claude Desktop</h2>
        <p>Add the Epstein Files MCP server to your Claude Desktop configuration:</p>

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
          <p>Edit the configuration file and add the Epstein Files server:</p>
          <div class="code-block">
            <code>
              {JSON.stringify({
                "mcpServers": {
                  "epstein-files": {
                    "command": "node",
                    "args": ["/path/to/epstein-files-micropayments/mcp-server/dist/index.js"],
                    "env": {
                      "X402_GATEWAY_URL": "https://x402.serendb.com",
                      "X402_PROVIDER_ID": "your-provider-id",
                      "X402_API_KEY": "your-api-key"
                    }
                  }
                }
              }, null, 2)}
            </code>
          </div>
        </div>

        <div class="step-item">
          <h4>Restart Claude Desktop</h4>
          <p>
            Close and reopen Claude Desktop. The Epstein Files MCP server should now be
            available with the <code>execute_query</code> tool.
          </p>
        </div>
      </section>

      <section class="setup-section">
        <h2>4. Database Schema</h2>
        <p>The database contains two main tables:</p>

        <div class="schema-table">
          <h4>documents</h4>
          <div class="code-block">
            <code>
              id              UUID PRIMARY KEY<br />
              source_file     TEXT<br />
              original_zip    TEXT<br />
              total_pages     INTEGER<br />
              processed_at    TIMESTAMP
            </code>
          </div>
        </div>

        <div class="schema-table">
          <h4>pages</h4>
          <div class="code-block">
            <code>
              id              UUID PRIMARY KEY<br />
              document_id     UUID (references documents)<br />
              page_number     INTEGER<br />
              content_text    TEXT<br />
              ocr_confidence  DECIMAL<br />
              created_at      TIMESTAMP
            </code>
          </div>
        </div>

        <p class="note">
          <strong>Note:</strong> Full-text search is enabled on the <code>content_text</code>{' '}
          column for efficient searching.
        </p>
      </section>

      <section class="setup-section">
        <h2>5. Example Queries</h2>
        <p>Here are some example SQL queries you can run:</p>

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
          <h4>Get pages from a specific document</h4>
          <div class="code-block">
            <code>
              SELECT page_number, content_text, ocr_confidence<br />
              FROM pages<br />
              WHERE document_id = 'your-document-id'<br />
              ORDER BY page_number;
            </code>
          </div>
        </div>

        <div class="example-query">
          <h4>Full-text search with PostgreSQL</h4>
          <div class="code-block">
            <code>
              SELECT d.source_file, p.page_number,<br />
              &nbsp;&nbsp;ts_headline('english', p.content_text,<br />
              &nbsp;&nbsp;&nbsp;&nbsp;to_tsquery('english', 'search & term'))<br />
              FROM pages p<br />
              JOIN documents d ON p.document_id = d.id<br />
              WHERE to_tsvector('english', p.content_text)<br />
              &nbsp;&nbsp;@@ to_tsquery('english', 'search & term')<br />
              LIMIT 20;
            </code>
          </div>
        </div>
      </section>

      <section class="setup-section">
        <h2>6. Using with Claude Desktop</h2>
        <p>Once configured, you can query the database directly in Claude:</p>

        <div class="example-query">
          <h4>Example Prompt</h4>
          <div class="code-block prompt-example">
            <code>
              Use the execute_query tool to search the Epstein Files database<br />
              for any mentions of "private jet" or "aircraft". Use my wallet<br />
              address: 0x1234567890abcdef1234567890abcdef12345678
            </code>
          </div>
        </div>

        <p>Claude will:</p>
        <ul>
          <li>Construct an appropriate SQL query</li>
          <li>Execute it through the MCP server</li>
          <li>Handle the payment flow if required</li>
          <li>Return the results to you</li>
        </ul>
      </section>

      <section class="setup-section troubleshooting">
        <h2>Troubleshooting</h2>

        <div class="faq-item">
          <h4>Payment required error?</h4>
          <p>
            This means you need to complete a payment before the query executes.
            Follow the payment URL provided and ensure your wallet has sufficient USDC.
          </p>
        </div>

        <div class="faq-item">
          <h4>MCP server not connecting?</h4>
          <p>
            Verify the path to <code>index.js</code> is correct and that you've set
            the environment variables (<code>X402_GATEWAY_URL</code>, <code>X402_PROVIDER_ID</code>,
            <code>X402_API_KEY</code>) in your configuration.
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
