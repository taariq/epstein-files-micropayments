// ABOUTME: Tests for uploading extracted content to SerenDB
// ABOUTME: Validates database insertion, duplicate handling, and data integrity

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'fs'
import { join } from 'path'
import pg from 'pg'
import { config } from 'dotenv'
import { uploadDocuments, parseExtractedFile } from './upload'

const { Pool } = pg

// Load environment variables from parent directory
config({ path: '../.env' })

describe('Upload to SerenDB', () => {
  const testInputDir = './test-upload-input'
  const testPool = new Pool({
    connectionString: process.env.SERENDB_CONNECTION_STRING
  })

  beforeEach(async () => {
    // Create test input directory
    if (existsSync(testInputDir)) {
      rmSync(testInputDir, { recursive: true })
    }
    mkdirSync(testInputDir, { recursive: true })

    // Clear test data from database (match document.pdf, document2.pdf, document3.pdf, etc.)
    await testPool.query('DELETE FROM pages WHERE document_id IN (SELECT id FROM documents WHERE source_file LIKE $1)', ['document%.pdf'])
    await testPool.query('DELETE FROM documents WHERE source_file LIKE $1', ['document%.pdf'])
  })

  afterEach(async () => {
    // Cleanup test input directory
    if (existsSync(testInputDir)) {
      rmSync(testInputDir, { recursive: true })
    }

    // Clear test data from database
    await testPool.query('DELETE FROM pages WHERE document_id IN (SELECT id FROM documents WHERE source_file LIKE $1)', ['document%.pdf'])
    await testPool.query('DELETE FROM documents WHERE source_file LIKE $1', ['document%.pdf'])
  })

  it('should parse extracted text file with filename metadata', () => {
    const filename = 'archive1_document.pdf.txt'
    const content = 'This is page 1 content.\n\nThis is page 2 content.'

    const result = parseExtractedFile(filename, content)

    expect(result.originalZip).toBe('archive1')
    expect(result.sourceFile).toBe('document.pdf')
    expect(result.pages.length).toBeGreaterThan(0)
  })

  it('should upload document and pages to database', async () => {
    // Create test extracted file (realistic format: zipname_filename.ext.txt)
    const testFile = join(testInputDir, 'test_archive_document.pdf.txt')
    writeFileSync(testFile, 'Page 1 content\n\nPage 2 content')

    // Upload to database
    const result = await uploadDocuments(testInputDir, { dryRun: false })

    expect(result.uploaded).toBe(1)
    expect(result.skipped).toBe(0)

    // Verify in database
    const docResult = await testPool.query('SELECT * FROM documents WHERE source_file = $1', ['document.pdf'])
    expect(docResult.rows.length).toBe(1)
    expect(docResult.rows[0].original_zip).toBe('test_archive')

    const pagesResult = await testPool.query('SELECT * FROM pages WHERE document_id = $1 ORDER BY page_number', [docResult.rows[0].id])
    expect(pagesResult.rows.length).toBeGreaterThan(0)
  })

  it('should skip duplicate documents', async () => {
    // Create test extracted file
    const testFile = join(testInputDir, 'test_archive2_document2.pdf.txt')
    writeFileSync(testFile, 'Test content')

    // Upload first time
    await uploadDocuments(testInputDir, { dryRun: false })

    // Upload again (should skip)
    const result = await uploadDocuments(testInputDir, { dryRun: false })

    expect(result.uploaded).toBe(0)
    expect(result.skipped).toBe(1)
  })

  it('should support dry run mode', async () => {
    // Create test extracted file
    const testFile = join(testInputDir, 'test_archive3_document3.pdf.txt')
    writeFileSync(testFile, 'Test content')

    // Dry run
    const result = await uploadDocuments(testInputDir, { dryRun: true })

    expect(result.uploaded).toBe(0)
    expect(result.files.length).toBe(1)

    // Verify nothing in database
    const docResult = await testPool.query('SELECT * FROM documents WHERE source_file = $1', ['document3.pdf'])
    expect(docResult.rows.length).toBe(0)
  })
})
