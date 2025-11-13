// ABOUTME: Extracts documents from ZIP archives and runs OCR processing
// ABOUTME: Outputs extracted text to cached directory for upload

import { readdirSync, existsSync, mkdirSync, createReadStream, createWriteStream } from 'fs'
import { join } from 'path'
import { execSync } from 'child_process'
import { Parse } from 'unzipper'
import { pipeline } from 'stream/promises'

export interface ExtractOptions {
  dryRun?: boolean
}

export async function extractDocuments(
  sourceDir: string,
  outputDir: string,
  options: ExtractOptions = {}
): Promise<string[]> {
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
    await processZipFile(zipPath, outputDir)
  }

  return zipFiles
}

async function processZipFile(zipPath: string, outputDir: string): Promise<void> {
  const zipName = zipPath.split('/').pop()!.replace('.zip', '')

  return new Promise((resolve, reject) => {
    createReadStream(zipPath)
      .pipe(Parse())
      .on('entry', async (entry) => {
        const fileName = entry.path
        const type = entry.type // 'Directory' or 'File'

        if (type === 'Directory') {
          entry.autodrain()
          return
        }

        // Only process PDF and image files
        const isPdf = fileName.endsWith('.pdf')
        const isImage = fileName.endsWith('.jpg') || fileName.endsWith('.png')

        if (!isPdf && !isImage) {
          entry.autodrain()
          return
        }

        // Extract file to output directory
        const extractedPath = join(outputDir, fileName)
        const extractedDir = extractedPath.substring(0, extractedPath.lastIndexOf('/'))

        if (!existsSync(extractedDir)) {
          mkdirSync(extractedDir, { recursive: true })
        }

        try {
          await pipeline(entry, createWriteStream(extractedPath))

          // Run OCR on extracted file
          const outputTextFile = join(outputDir, `${zipName}_${fileName}.txt`)
          processFile(extractedPath, outputTextFile)
        } catch (err) {
          console.error(`Failed to extract ${fileName}:`, err)
          entry.autodrain()
        }
      })
      .on('finish', () => resolve())
      .on('error', (err) => reject(err))
  })
}

export function processFile(inputPath: string, outputPath: string): void {
  try {
    // Use OCRmyPDF with --force-ocr and --sidecar to extract text directly
    // This eliminates the need for pdftotext dependency
    const command = `ocrmypdf --force-ocr --sidecar "${outputPath}" "${inputPath}" /dev/null`
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
  const processed = await extractDocuments(sourceDir, outputDir)
  console.log(`\nCompleted! Processed ${processed.length} archives.`)
}
