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
  const sourceDir = process.argv[2] || './uploads'
  const outputDir = process.argv[3] || './extracted'

  console.log('Starting document extraction...')
  const processed = extractDocuments(sourceDir, outputDir)
  console.log(`\nCompleted! Processed ${processed.length} archives.`)
}
