// ABOUTME: Tests for database backup functionality
// ABOUTME: Validates pg_dump execution, file creation, and SQL validity

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { existsSync, rmSync, readFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { config } from 'dotenv'
import { createBackup } from './backup'

// Load environment variables from parent directory
config({ path: '../.env' })

describe('Database Backup', () => {
  const testBackupDir = './test-backups'

  beforeEach(() => {
    // Create test backup directory
    if (existsSync(testBackupDir)) {
      rmSync(testBackupDir, { recursive: true })
    }
    mkdirSync(testBackupDir, { recursive: true })
  })

  afterEach(() => {
    // Cleanup test backup directory
    if (existsSync(testBackupDir)) {
      rmSync(testBackupDir, { recursive: true })
    }
  })

  it('should create a backup file with timestamp', async () => {
    const result = await createBackup({ outputDir: testBackupDir })

    expect(result.success).toBe(true)
    expect(result.filename).toMatch(/^documents-db-\d{8}-\d{6}\.sql$/)
    expect(existsSync(join(testBackupDir, result.filename))).toBe(true)
  })

  it('should create non-empty backup file', async () => {
    const result = await createBackup({ outputDir: testBackupDir })
    const filePath = join(testBackupDir, result.filename)
    const content = readFileSync(filePath, 'utf-8')

    expect(content.length).toBeGreaterThan(0)
  })

  it('should create valid SQL backup', async () => {
    const result = await createBackup({ outputDir: testBackupDir })
    const filePath = join(testBackupDir, result.filename)
    const content = readFileSync(filePath, 'utf-8')

    // Check for PostgreSQL dump header
    expect(content).toContain('PostgreSQL database dump')

    // Check for our schema objects
    expect(content).toMatch(/CREATE TABLE|CREATE SCHEMA|SET/)
  })

  it('should throw error if SERENDB_CONNECTION_STRING is missing', async () => {
    const originalEnv = process.env.SERENDB_CONNECTION_STRING
    delete process.env.SERENDB_CONNECTION_STRING

    await expect(createBackup({ outputDir: testBackupDir }))
      .rejects.toThrow('SERENDB_CONNECTION_STRING is required')

    process.env.SERENDB_CONNECTION_STRING = originalEnv
  })

  it('should use default backup directory if not specified', async () => {
    const defaultBackupDir = '../backups'

    // Create default directory if it doesn't exist
    if (!existsSync(defaultBackupDir)) {
      mkdirSync(defaultBackupDir, { recursive: true })
    }

    const result = await createBackup()
    const filePath = join(defaultBackupDir, result.filename)

    expect(result.success).toBe(true)
    expect(existsSync(filePath)).toBe(true)

    // Cleanup
    rmSync(filePath)
  })
})
