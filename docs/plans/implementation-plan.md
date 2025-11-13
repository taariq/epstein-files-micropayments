# Epstein Files Micropayments - Implementation Plan

## Overview

This plan implements a system that:
1. Extracts text from Epstein Files documents using OCR
2. Uploads content to SerenDB (PostgreSQL)
3. Sets up x402 payment gateway for micropayments
4. Provides MCP server for AI agents to query with payments
5. Deploys SolidJS web app demonstrating the system

**Timeline**: Launch tonight (aggressive but achievable with focus)

**Principles**: TDD, YAGNI, DRY, frequent commits

---

## Prerequisites

Before starting, ensure you have:
- [ ] Node.js 18+ and pnpm installed
- [ ] PostgreSQL client (psql) installed
- [ ] Python 3.8+ and pip installed (for OCRmyPDF)
- [ ] SerenDB production connection string
- [ ] Crypto wallet address for receiving payments
- [ ] GitHub CLI (gh) installed
- [ ] Vercel CLI installed (`pnpm add -g vercel`)
- [ ] Access to x402 gateway at https://x402.serendb.com/

---

## Phase 0: Project Setup

### Task 0.1: Initialize Project Structure

**Objective**: Set up the monorepo structure with TypeScript

**Files to create**:
- `package.json` (root)
- `tsconfig.json` (root)
- `scripts/`, `mcp-server/`, `web/`, `extracted/`, `backups/` directories

**Steps**:
1. Initialize root package.json with workspaces:
```bash
pnpm init
```

2. Edit `package.json`:
```json
{
  "name": "epstein-files-micropayments",
  "version": "1.0.0",
  "private": true,
  "workspaces": [
    "scripts",
    "mcp-server",
    "web"
  ],
  "scripts": {
    "extract": "tsx scripts/extract.ts",
    "upload": "tsx scripts/upload.ts",
    "backup": "tsx scripts/backup.ts",
    "register": "tsx scripts/register-provider.ts"
  },
  "devDependencies": {
    "tsx": "^4.7.0",
    "typescript": "^5.3.3"
  }
}
```

3. Create root `tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  }
}
```

4. Install dependencies:
```bash
pnpm install
```

5. Create directory structure:
```bash
mkdir -p scripts mcp-server/src/tools web/src/components extracted backups
```

**Testing**:
- Run `pnpm -v` - should work
- Run `ls -la` - verify directories exist

**Commit**: "chore: initialize project structure with TypeScript"

---

### Task 0.2: Environment Variables Setup

**Objective**: Create `.env.example` template for configuration

**Files to create**:
- `.env.example`
- Update `.gitignore`

**Steps**:
1. Create `.env.example`:
```bash
# SerenDB (Epstein Files Database)
SERENDB_CONNECTION_STRING=postgresql://user:password@host:5432/epstein_files

# x402 Gateway (live at https://x402.serendb.com/)
X402_GATEWAY_URL=https://x402.serendb.com
X402_PROVIDER_ID=uuid-from-registration
X402_API_KEY=key-from-registration

# Provider wallet (your wallet for receiving payments)
PROVIDER_WALLET_ADDRESS=0x...
```

2. Verify `.gitignore` includes:
```
.env
.env.local
.env.production
```

**Testing**:
- Verify `.env` is gitignored: `git status` should not show `.env` files

**Commit**: "chore: add environment variable template"

---

## Phase 1: Database Setup

### Task 1.1: Create SerenDB Schema

**Objective**: Set up database tables for documents and pages

**Files to create**:
- `scripts/schema.sql`

**Steps**:
1. Create `scripts/schema.sql`:
```sql
-- ABOUTME: Database schema for Epstein Files content storage
-- ABOUTME: Two-table design: documents (metadata) and pages (OCR content)

-- Drop existing tables if recreating
DROP TABLE IF EXISTS pages CASCADE;
DROP TABLE IF EXISTS documents CASCADE;

-- Documents table: metadata about source files
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_file TEXT NOT NULL,
  original_zip TEXT NOT NULL,
  total_pages INTEGER NOT NULL,
  processed_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(source_file)
);

-- Pages table: OCR-extracted content
CREATE TABLE pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  page_number INTEGER NOT NULL,
  content_text TEXT NOT NULL,
  ocr_confidence DECIMAL(5,2),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(document_id, page_number)
);

-- Full-text search index for content
CREATE INDEX idx_pages_content_fts ON pages
  USING GIN (to_tsvector('english', content_text));

-- Performance indexes
CREATE INDEX idx_pages_document_id ON pages(document_id);
CREATE INDEX idx_documents_source_file ON documents(source_file);

-- Create read-only user for query access
CREATE USER epstein_reader WITH PASSWORD 'generate-secure-password';
GRANT CONNECT ON DATABASE epstein_files TO epstein_reader;
GRANT SELECT ON documents, pages TO epstein_reader;
```

2. Copy `.env.example` to `.env` and fill in real values (DO NOT COMMIT `.env`)

3. Run schema migration:
```bash
psql $SERENDB_CONNECTION_STRING -f scripts/schema.sql
```

4. Verify tables created:
```bash
psql $SERENDB_CONNECTION_STRING -c "\dt"
```

**Testing**:
- Should see `documents` and `pages` tables
- Verify indexes: `psql $SERENDB_CONNECTION_STRING -c "\di"`
- Test read-only user: `psql postgresql://epstein_reader:password@host:5432/epstein_files -c "SELECT 1"`

**Commit**: "feat: create database schema for documents and pages"

---

## Phase 2: Document Processing Scripts

### Task 2.1: Install OCRmyPDF

**Objective**: Install and verify OCRmyPDF works

**Steps**:
1. Install OCRmyPDF (macOS):
```bash
brew install ocrmypdf
```

Or (Ubuntu/Debian):
```bash
sudo apt-get install ocrmypdf
```

2. Verify installation:
```bash
ocrmypdf --version
```

3. Test on a sample file:
```bash
# Extract one file from a zip to test
cd docs/Epstein_Files
unzip -j TEXT.zip -d /tmp/test_ocr
ocrmypdf /tmp/test_ocr/sample.pdf /tmp/output.pdf
```

**Testing**:
- OCRmyPDF should process without errors
- Output PDF should exist and be readable

**Commit**: "chore: document OCRmyPDF installation steps"

---

### Task 2.2: Create Extract Script (TDD)

**Objective**: Build script to unzip archives and run OCR

**Files to create**:
- `scripts/package.json`
- `scripts/tsconfig.json`
- `scripts/extract.test.ts`
- `scripts/extract.ts`

**Steps**:

1. Initialize scripts workspace:
```bash
cd scripts
pnpm init
```

2. Create `scripts/package.json`:
```json
{
  "name": "@epstein-files/scripts",
  "version": "1.0.0",
  "type": "module",
  "dependencies": {
    "adm-zip": "^0.5.10",
    "dotenv": "^16.3.1"
  },
  "devDependencies": {
    "@types/node": "^20.10.0",
    "@types/adm-zip": "^0.5.5",
    "vitest": "^1.0.4",
    "tsx": "^4.7.0"
  },
  "scripts": {
    "test": "vitest"
  }
}
```

3. Install dependencies:
```bash
pnpm install
```

4. Create `scripts/tsconfig.json`:
```json
{
  "extends": "../tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist"
  },
  "include": ["**/*.ts"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

5. **WRITE TEST FIRST** - Create `scripts/extract.test.ts`:
```typescript
// ABOUTME: Tests for document extraction and OCR processing
// ABOUTME: Validates unzipping, file discovery, and OCR execution

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { existsSync, mkdirSync, rmSync } from 'fs'
import { extractDocuments, processFile } from './extract'

describe('Document Extraction', () => {
  const testOutputDir = './test-extracted'

  beforeEach(() => {
    if (existsSync(testOutputDir)) {
      rmSync(testOutputDir, { recursive: true })
    }
    mkdirSync(testOutputDir, { recursive: true })
  })

  afterEach(() => {
    if (existsSync(testOutputDir)) {
      rmSync(testOutputDir, { recursive: true })
    }
  })

  it('should create output directory if it does not exist', () => {
    extractDocuments('../docs/Epstein_Files', testOutputDir)
    expect(existsSync(testOutputDir)).toBe(true)
  })

  it('should find zip files in source directory', () => {
    const zipFiles = extractDocuments('../docs/Epstein_Files', testOutputDir, { dryRun: true })
    expect(zipFiles.length).toBeGreaterThan(0)
    expect(zipFiles.every(f => f.endsWith('.zip'))).toBe(true)
  })
})
```

6. Run test (should fail):
```bash
pnpm test
```

7. **NOW IMPLEMENT** - Create `scripts/extract.ts`:
```typescript
// ABOUTME: Extracts documents from ZIP archives and runs OCR processing
// ABOUTME: Outputs extracted text to cached directory for upload

import { readdirSync, existsSync, mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { execSync } from 'child_process'
import AdmZip from 'adm-zip'

export interface ExtractOptions {
  dryRun?: boolean
}

export function extractDocuments(
  sourceDir: string,
  outputDir: string,
  options: ExtractOptions = {}
): string[] {
  // Create output directory if it doesn't exist
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true })
  }

  // Find all zip files
  const zipFiles = readdirSync(sourceDir)
    .filter(f => f.endsWith('.zip'))
    .map(f => join(sourceDir, f))

  if (options.dryRun) {
    return zipFiles
  }

  // Process each zip file
  for (const zipPath of zipFiles) {
    console.log(`Processing ${zipPath}...`)
    processZipFile(zipPath, outputDir)
  }

  return zipFiles
}

function processZipFile(zipPath: string, outputDir: string): void {
  const zipName = zipPath.split('/').pop()!.replace('.zip', '')
  const zip = new AdmZip(zipPath)
  const zipEntries = zip.getEntries()

  for (const entry of zipEntries) {
    if (entry.isDirectory) continue

    // Extract to temp location
    const tempFile = join(outputDir, `temp_${entry.entryName}`)
    zip.extractEntryTo(entry, outputDir, false, true)

    // Run OCR based on file type
    if (entry.entryName.endsWith('.pdf') || entry.entryName.endsWith('.jpg') || entry.entryName.endsWith('.png')) {
      const outputTextFile = join(outputDir, `${zipName}_${entry.entryName}.txt`)
      processFile(join(outputDir, entry.entryName), outputTextFile)
    }
  }
}

export function processFile(inputPath: string, outputPath: string): void {
  try {
    // Use OCRmyPDF to extract text
    const command = `ocrmypdf --force-ocr --skip-text "${inputPath}" - | pdftotext - "${outputPath}"`
    execSync(command, { stdio: 'pipe' })
    console.log(`✓ Extracted: ${outputPath}`)
  } catch (error) {
    console.error(`✗ Failed to process ${inputPath}:`, error)
  }
}

// CLI entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  const sourceDir = process.argv[2] || '../docs/Epstein_Files'
  const outputDir = process.argv[3] || '../extracted'

  console.log('Starting document extraction...')
  const processed = extractDocuments(sourceDir, outputDir)
  console.log(`\nCompleted! Processed ${processed.length} archives.`)
}
```

8. Run tests (should pass):
```bash
pnpm test
```

9. Test manual execution:
```bash
tsx extract.ts ../docs/Epstein_Files ../extracted
```

**Testing**:
- Unit tests pass
- Manual run creates `extracted/` directory with text files
- Check a few text files to verify OCR worked

**Commit**: "feat: implement document extraction with OCR"

---

### Task 2.3: Create Upload Script (TDD)

**Objective**: Upload extracted text to SerenDB

**Files to create**:
- `scripts/upload.test.ts`
- `scripts/upload.ts`

**Steps**:

1. Add PostgreSQL dependency:
```bash
cd scripts
pnpm add pg
pnpm add -D @types/pg
```

2. **WRITE TEST FIRST** - Create `scripts/upload.test.ts`:
```typescript
// ABOUTME: Tests for uploading extracted content to SerenDB
// ABOUTME: Validates database insertion and duplicate handling

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Pool } from 'pg'
import { uploadDocument, connectDB } from './upload'

describe('Upload to SerenDB', () => {
  let pool: Pool

  beforeAll(async () => {
    pool = connectDB()
  })

  afterAll(async () => {
    await pool.end()
  })

  it('should connect to database', async () => {
    const result = await pool.query('SELECT 1 as test')
    expect(result.rows[0].test).toBe(1)
  })

  it('should insert document and pages', async () => {
    const testDoc = {
      sourceFile: 'test.pdf',
      originalZip: 'TEST.zip',
      pages: [
        { pageNumber: 1, contentText: 'Test page 1 content', ocrConfidence: 95.5 },
        { pageNumber: 2, contentText: 'Test page 2 content', ocrConfidence: 98.2 }
      ]
    }

    await uploadDocument(pool, testDoc)

    // Verify document inserted
    const docResult = await pool.query(
      'SELECT * FROM documents WHERE source_file = $1',
      [testDoc.sourceFile]
    )
    expect(docResult.rows.length).toBe(1)
    expect(docResult.rows[0].total_pages).toBe(2)

    // Verify pages inserted
    const pagesResult = await pool.query(
      'SELECT * FROM pages WHERE document_id = $1 ORDER BY page_number',
      [docResult.rows[0].id]
    )
    expect(pagesResult.rows.length).toBe(2)
    expect(pagesResult.rows[0].content_text).toBe('Test page 1 content')

    // Cleanup
    await pool.query('DELETE FROM documents WHERE source_file = $1', [testDoc.sourceFile])
  })

  it('should handle duplicate documents gracefully', async () => {
    const testDoc = {
      sourceFile: 'duplicate.pdf',
      originalZip: 'TEST.zip',
      pages: [{ pageNumber: 1, contentText: 'Content', ocrConfidence: 95.0 }]
    }

    await uploadDocument(pool, testDoc)

    // Try to upload again
    await expect(uploadDocument(pool, testDoc)).rejects.toThrow()

    // Cleanup
    await pool.query('DELETE FROM documents WHERE source_file = $1', [testDoc.sourceFile])
  })
})
```

3. Run test (should fail):
```bash
pnpm test
```

4. **NOW IMPLEMENT** - Create `scripts/upload.ts`:
```typescript
// ABOUTME: Uploads extracted document content to SerenDB via PostgreSQL
// ABOUTME: Handles document metadata and page content with transactions

import { Pool } from 'pg'
import { readdirSync, readFileSync } from 'fs'
import { join } from 'path'
import dotenv from 'dotenv'

dotenv.config()

export interface PageData {
  pageNumber: number
  contentText: string
  ocrConfidence?: number
}

export interface DocumentData {
  sourceFile: string
  originalZip: string
  pages: PageData[]
}

export function connectDB(): Pool {
  const connectionString = process.env.SERENDB_CONNECTION_STRING
  if (!connectionString) {
    throw new Error('SERENDB_CONNECTION_STRING not set in environment')
  }

  return new Pool({ connectionString })
}

export async function uploadDocument(pool: Pool, doc: DocumentData): Promise<void> {
  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    // Insert document
    const docResult = await client.query(
      `INSERT INTO documents (source_file, original_zip, total_pages)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [doc.sourceFile, doc.originalZip, doc.pages.length]
    )

    const documentId = docResult.rows[0].id

    // Insert pages
    for (const page of doc.pages) {
      await client.query(
        `INSERT INTO pages (document_id, page_number, content_text, ocr_confidence)
         VALUES ($1, $2, $3, $4)`,
        [documentId, page.pageNumber, page.contentText, page.ocrConfidence || null]
      )
    }

    await client.query('COMMIT')
    console.log(`✓ Uploaded: ${doc.sourceFile} (${doc.pages.length} pages)`)
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export async function uploadFromDirectory(extractedDir: string): Promise<void> {
  const pool = connectDB()

  try {
    const files = readdirSync(extractedDir).filter(f => f.endsWith('.txt'))

    // Group files by original zip
    const docGroups = new Map<string, string[]>()
    for (const file of files) {
      const zipName = file.split('_')[0]
      if (!docGroups.has(zipName)) {
        docGroups.set(zipName, [])
      }
      docGroups.get(zipName)!.push(file)
    }

    // Upload each document
    for (const [zipName, docFiles] of docGroups) {
      const pages: PageData[] = docFiles.map((file, index) => {
        const content = readFileSync(join(extractedDir, file), 'utf-8')
        return {
          pageNumber: index + 1,
          contentText: content,
          ocrConfidence: 95.0 // Default, could parse from OCR output
        }
      })

      await uploadDocument(pool, {
        sourceFile: docFiles[0],
        originalZip: `${zipName}.zip`,
        pages
      })
    }

    console.log('\nUpload complete!')
  } finally {
    await pool.end()
  }
}

// CLI entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  const extractedDir = process.argv[2] || '../extracted'

  uploadFromDirectory(extractedDir)
    .then(() => process.exit(0))
    .catch(err => {
      console.error('Upload failed:', err)
      process.exit(1)
    })
}
```

5. Run tests:
```bash
pnpm test
```

6. Test manual execution:
```bash
tsx upload.ts ../extracted
```

**Testing**:
- Unit tests pass
- Manual upload succeeds
- Verify data in database: `psql $SERENDB_CONNECTION_STRING -c "SELECT COUNT(*) FROM documents"`

**Commit**: "feat: implement database upload script"

---

### Task 2.4: Create Backup Script

**Objective**: Create pg_dump utility for database backups

**Files to create**:
- `scripts/backup.ts`

**Steps**:

1. Create `scripts/backup.ts`:
```typescript
// ABOUTME: Creates PostgreSQL database dumps for backup and restore
// ABOUTME: Saves to local backups/ directory with timestamp

import { execSync } from 'child_process'
import { existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import dotenv from 'dotenv'

dotenv.config()

function backupDatabase(): void {
  const connectionString = process.env.SERENDB_CONNECTION_STRING
  if (!connectionString) {
    throw new Error('SERENDB_CONNECTION_STRING not set')
  }

  // Create backups directory
  const backupsDir = join(process.cwd(), '..', 'backups')
  if (!existsSync(backupsDir)) {
    mkdirSync(backupsDir, { recursive: true })
  }

  // Generate filename with timestamp
  const timestamp = new Date().toISOString().split('T')[0].replace(/-/g, '')
  const filename = `epstein-db-${timestamp}.sql`
  const filepath = join(backupsDir, filename)

  console.log(`Creating backup: ${filename}`)

  try {
    execSync(`pg_dump "${connectionString}" > "${filepath}"`, {
      stdio: 'inherit'
    })
    console.log(`✓ Backup created: ${filepath}`)
  } catch (error) {
    console.error('Backup failed:', error)
    process.exit(1)
  }
}

// CLI entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  backupDatabase()
}
```

2. Test execution:
```bash
tsx backup.ts
```

3. Verify backup file created:
```bash
ls -lh ../backups/
```

**Testing**:
- Backup file should exist in `backups/`
- File should be non-empty
- Verify contents: `head -n 20 ../backups/epstein-db-*.sql`

**Commit**: "feat: add database backup script"

---

## Phase 3: x402 Gateway Setup

**Note**: The x402 gateway is already deployed and live at **https://x402.serendb.com/**. We only need to register our database as a provider.

---

### Task 3.1: Register Epstein DB as Provider

**Objective**: Register our database with x402 gateway

**Files to create**:
- `scripts/register-provider.ts`

**Steps**:

1. Create `scripts/register-provider.ts`:
```typescript
// ABOUTME: Registers Epstein Files database as x402 payment provider
// ABOUTME: Configures pricing model for micropayment queries

import dotenv from 'dotenv'

dotenv.config()

interface ProviderRegistration {
  name: string
  email: string
  walletAddress: string
  connectionString: string
}

async function registerProvider(): Promise<void> {
  const gatewayUrl = process.env.X402_GATEWAY_URL
  const walletAddress = process.env.PROVIDER_WALLET_ADDRESS
  const connectionString = process.env.SERENDB_CONNECTION_STRING

  if (!gatewayUrl || !walletAddress || !connectionString) {
    throw new Error('Missing required environment variables')
  }

  const registration: ProviderRegistration = {
    name: 'Epstein Files Database',
    email: 'admin@example.com', // Update with real email
    walletAddress,
    connectionString
  }

  console.log('Registering provider with x402 gateway...')

  const response = await fetch(`${gatewayUrl}/api/providers/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(registration)
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Registration failed: ${error}`)
  }

  const result = await response.json()

  console.log('\n✓ Provider registered successfully!')
  console.log('\nAdd these to your .env file:')
  console.log(`X402_PROVIDER_ID=${result.provider.id}`)
  console.log(`X402_API_KEY=${result.apiKey}`)
  console.log('\nNext step: Configure pricing')
}

async function configurePricing(): Promise<void> {
  const gatewayUrl = process.env.X402_GATEWAY_URL
  const providerId = process.env.X402_PROVIDER_ID
  const apiKey = process.env.X402_API_KEY

  if (!gatewayUrl || !providerId || !apiKey) {
    console.log('Skipping pricing configuration - provider not yet registered')
    return
  }

  // Price equivalent to ad revenue from newspaper publishers covering story
  // Estimate: $0.10 per 1000 rows (10 cents per complex query)
  const pricing = {
    basePricePer1000Rows: 0.10,
    markupMultiplier: 1.5
  }

  console.log('\nConfiguring pricing model...')

  const response = await fetch(`${gatewayUrl}/api/providers/${providerId}/pricing`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify(pricing)
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Pricing configuration failed: ${error}`)
  }

  console.log('✓ Pricing configured successfully!')
  console.log(`  Base price: $${pricing.basePricePer1000Rows} per 1000 rows`)
  console.log(`  Markup: ${pricing.markupMultiplier}x`)
}

// CLI entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  registerProvider()
    .then(() => configurePricing())
    .then(() => process.exit(0))
    .catch(err => {
      console.error('Registration failed:', err)
      process.exit(1)
    })
}
```

2. Run registration:
```bash
tsx register-provider.ts
```

3. Copy output values to `.env`:
```bash
X402_PROVIDER_ID=<uuid-from-output>
X402_API_KEY=<key-from-output>
```

4. Run again to configure pricing:
```bash
tsx register-provider.ts
```

**Testing**:
- Registration returns provider ID and API key
- Verify health check: `curl https://x402.serendb.com/api/health`
- Provider ID and API key are valid UUIDs/strings

**Commit**: "feat: add provider registration script"

---

## Phase 4-7: Remaining Phases

Due to length constraints, the remaining phases (MCP Server, Web Application, Deployment, and Documentation) follow the same pattern:

1. **Test-driven development** - Write tests first
2. **Incremental implementation** - Small, focused tasks
3. **Frequent testing** - Verify each step works
4. **Regular commits** - Commit after each completed task

### Quick Overview of Remaining Phases:

**Phase 4: MCP Server** (3 hours)
- Initialize MCP server with TypeScript
- Implement x402 client with tests
- Create execute_query tool with tests
- Wire up MCP server entry point

**Phase 5: Web Application** (3 hours)
- Initialize SolidJS app with Vite
- Create landing page component
- Create setup guide component
- Create demo query component
- Compose main app

**Phase 6: Deployment** (1 hour)
- Deploy web app to Vercel
- Deploy MCP server
- Configure environment variables

**Phase 7: Documentation & Launch** (1 hour)
- Create comprehensive README
- Run end-to-end test
- Draft launch announcement

---

## GitHub Issues Creation

Each task above should become a GitHub issue with:
- Title: Phase and task number (e.g., "Phase 2.2: Create Extract Script")
- Labels: `enhancement`, phase label
- Description: Copy relevant section from this plan
- Acceptance criteria: Testing section
- **NO SECRETS**: Ensure no connection strings, API keys, or wallet addresses in issues

Create issues with:
```bash
gh issue create --title "Phase 0.1: Initialize Project Structure" --body "$(cat task-description.md)"
```

---

## Success Criteria

✅ All tests pass
✅ Documents extracted and uploaded to SerenDB
✅ Provider registered with x402 gateway at https://x402.serendb.com/
✅ MCP server exposes execute_query tool
✅ Web app deployed and accessible
✅ End-to-end payment flow works
✅ Documentation complete

**Estimated Total: ~12 hours** (reduced from 14 - no gateway deployment needed)
