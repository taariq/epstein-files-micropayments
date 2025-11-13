// ABOUTME: Database backup utility using pg_dump
// ABOUTME: Creates timestamped SQL backups of the document database

import { execSync } from 'child_process'
import { existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { config } from 'dotenv'

// Load environment variables
config({ path: '../.env' })

interface BackupOptions {
  outputDir?: string
}

interface BackupResult {
  success: boolean
  filename: string
  path?: string
  error?: string
}

export async function createBackup(options: BackupOptions = {}): Promise<BackupResult> {
  const connectionString = process.env.SERENDB_CONNECTION_STRING

  if (!connectionString) {
    throw new Error('SERENDB_CONNECTION_STRING is required')
  }

  // Use provided directory or default to ../backups
  const outputDir = options.outputDir || '../backups'

  // Create backup directory if it doesn't exist
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true })
  }

  // Generate timestamp for filename (YYYYMMDD-HHMMSS)
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const hour = String(now.getHours()).padStart(2, '0')
  const minute = String(now.getMinutes()).padStart(2, '0')
  const second = String(now.getSeconds()).padStart(2, '0')
  const timestamp = `${year}${month}${day}-${hour}${minute}${second}`

  const filename = `documents-db-${timestamp}.sql`
  const filepath = join(outputDir, filename)

  try {
    // Execute pg_dump
    execSync(`pg_dump "${connectionString}" -f "${filepath}"`, {
      stdio: 'pipe',
      encoding: 'utf-8'
    })

    return {
      success: true,
      filename,
      path: filepath
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    throw new Error(`Backup failed: ${errorMessage}`)
  }
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  (async () => {
    try {
      console.log('Creating database backup...')
      const result = await createBackup()
      console.log(`✓ Backup created: ${result.filename}`)
      console.log(`  Location: ${result.path}`)
    } catch (error) {
      console.error('✗ Backup failed:', error instanceof Error ? error.message : error)
      process.exit(1)
    }
  })()
}
