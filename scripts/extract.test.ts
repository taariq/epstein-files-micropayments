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

  it('should create output directory if it does not exist', async () => {
    const nonExistentDir = './test-new-dir'
    if (existsSync(nonExistentDir)) {
      rmSync(nonExistentDir, { recursive: true })
    }

    await extractDocuments('./uploads', nonExistentDir, { dryRun: true })
    expect(existsSync(nonExistentDir)).toBe(true)

    // Cleanup
    rmSync(nonExistentDir, { recursive: true })
  })

  it('should find zip files in source directory', async () => {
    const zipFiles = await extractDocuments('./uploads', testOutputDir, { dryRun: true })
    expect(zipFiles.length).toBeGreaterThan(0)
    expect(zipFiles.every(f => f.endsWith('.zip'))).toBe(true)
  })
})
