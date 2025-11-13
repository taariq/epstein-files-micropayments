// ABOUTME: Uploads extracted document content to SerenDB
// ABOUTME: Handles document metadata, page content, and duplicate detection

import { readdirSync, readFileSync, existsSync } from 'fs'
import { join } from 'path'
import pg from 'pg'
import { config } from 'dotenv'

const { Pool } = pg

// Load environment variables
config()

export interface UploadOptions {
  dryRun?: boolean
}

export interface UploadResult {
  uploaded: number
  skipped: number
  files: string[]
}

export interface ParsedDocument {
  originalZip: string
  sourceFile: string
  pages: string[]
}

export function parseExtractedFile(filename: string, content: string): ParsedDocument {
  // Filename format: {originalZip}_{sourceFile}.txt
  // Example: test_archive_test_document.pdf.txt -> originalZip="test_archive", sourceFile="test_document.pdf"

  // Remove .txt extension
  const withoutTxt = filename.replace(/\.txt$/, '')

  // Find the last underscore before a simple filename with extension
  // Look for pattern: _{filename}.{ext} where ext is pdf/jpg/png
  const match = withoutTxt.match(/^(.+)_([^_]+\.(pdf|jpg|png))$/i)

  let originalZip: string
  let sourceFile: string

  if (match) {
    originalZip = match[1]
    sourceFile = match[2]
  } else {
    // Fallback: split on first underscore
    const firstUnderscore = withoutTxt.indexOf('_')
    if (firstUnderscore > 0) {
      originalZip = withoutTxt.substring(0, firstUnderscore)
      sourceFile = withoutTxt.substring(firstUnderscore + 1)
    } else {
      originalZip = 'unknown'
      sourceFile = withoutTxt
    }
  }

  // Split content into pages (using double newline as separator)
  const pages = content
    .split('\n\n')
    .map(p => p.trim())
    .filter(p => p.length > 0)

  return {
    originalZip,
    sourceFile,
    pages
  }
}

export async function uploadDocuments(
  inputDir: string,
  options: UploadOptions = {}
): Promise<UploadResult> {
  // Find all extracted text files
  const txtFiles = readdirSync(inputDir)
    .filter(f => f.endsWith('.txt'))
    .map(f => join(inputDir, f))

  if (options.dryRun) {
    return {
      uploaded: 0,
      skipped: 0,
      files: txtFiles
    }
  }

  // Connect to database
  const pool = new Pool({
    connectionString: process.env.SERENDB_CONNECTION_STRING
  })

  let uploaded = 0
  let skipped = 0

  try {
    for (const filePath of txtFiles) {
      const filename = filePath.split('/').pop()!
      const content = readFileSync(filePath, 'utf-8')

      const parsed = parseExtractedFile(filename, content)

      // Check if document already exists
      const existingDoc = await pool.query(
        'SELECT id FROM documents WHERE source_file = $1',
        [parsed.sourceFile]
      )

      if (existingDoc.rows.length > 0) {
        console.log(`⊘ Skipped: ${parsed.sourceFile} (already exists)`)
        skipped++
        continue
      }

      // Insert document
      const docResult = await pool.query(
        `INSERT INTO documents (source_file, original_zip, total_pages)
         VALUES ($1, $2, $3)
         RETURNING id`,
        [parsed.sourceFile, parsed.originalZip, parsed.pages.length]
      )

      const documentId = docResult.rows[0].id

      // Insert pages
      for (let i = 0; i < parsed.pages.length; i++) {
        await pool.query(
          `INSERT INTO pages (document_id, page_number, content_text)
           VALUES ($1, $2, $3)`,
          [documentId, i + 1, parsed.pages[i]]
        )
      }

      console.log(`✓ Uploaded: ${parsed.sourceFile} (${parsed.pages.length} pages)`)
      uploaded++
    }
  } finally {
    await pool.end()
  }

  return {
    uploaded,
    skipped,
    files: txtFiles
  }
}

// CLI entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  const inputDir = process.argv[2] || '../extracted'

  console.log('Starting document upload to SerenDB...')
  const result = await uploadDocuments(inputDir)
  console.log(`\nCompleted! Uploaded ${result.uploaded}, Skipped ${result.skipped}`)
}
