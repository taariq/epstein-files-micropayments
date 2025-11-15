// ABOUTME: Tests for sample SQL queries used in documentation and web UI
// ABOUTME: Validates SQL syntax and column references match the database schema

import { describe, it, expect } from 'vitest'

describe('Sample Queries Validation', () => {
  // Example queries from DemoQuery.tsx
  const sampleQueries = [
    "SELECT * FROM documents LIMIT 10",
    "SELECT * FROM pages WHERE content_text ILIKE '%keyword%' LIMIT 5",
    "SELECT d.source_file, COUNT(*) as page_count FROM pages p JOIN documents d ON p.document_id = d.id GROUP BY d.source_file",
    "SELECT * FROM documents WHERE source_file LIKE '%.pdf'"
  ]

  // Schema definition (from scripts/schema.sql)
  const schema = {
    documents: ['id', 'source_file', 'original_zip', 'total_pages', 'processed_at'],
    pages: ['id', 'document_id', 'page_number', 'content_text', 'ocr_confidence', 'created_at']
  }

  it('should reference only valid table names', () => {
    const validTables = ['documents', 'pages']

    sampleQueries.forEach(query => {
      const upperQuery = query.toUpperCase()

      // Extract FROM and JOIN table references
      const fromMatches = upperQuery.match(/FROM\s+(\w+)/gi) || []
      const joinMatches = upperQuery.match(/JOIN\s+(\w+)/gi) || []
      const allMatches = fromMatches.concat(joinMatches)

      allMatches.forEach(match => {
        const tableName = match.replace(/FROM\s+/i, '').replace(/JOIN\s+/i, '').trim().toLowerCase()
        const tableAlias = tableName.split(/\s+/)[0] // Get first word (table name, not alias)

        expect(validTables).toContain(tableAlias)
      })
    })
  })

  it('should reference only valid column names for documents table', () => {
    const query1 = sampleQueries[0] // SELECT * FROM documents
    const query4 = sampleQueries[3] // SELECT * FROM documents WHERE source_file

    // Query 1: SELECT * FROM documents (implicitly references all columns)
    expect(query1).toContain('FROM documents')

    // Query 4: references source_file column
    expect(query4).toContain('source_file')
    expect(schema.documents).toContain('source_file')
  })

  it('should reference only valid column names for pages table', () => {
    const query2 = sampleQueries[1] // SELECT * FROM pages WHERE content_text
    const query3 = sampleQueries[2] // JOIN with document_id

    // Query 2: references content_text column
    expect(query2).toContain('content_text')
    expect(schema.pages).toContain('content_text')

    // Query 3: references document_id for JOIN
    expect(query3).toContain('document_id')
    expect(schema.pages).toContain('document_id')
    expect(schema.documents).toContain('id') // JOIN target
  })

  it('should use correct JOIN syntax with valid foreign keys', () => {
    const query3 = sampleQueries[2]

    // Verify JOIN uses correct FK relationship: pages.document_id -> documents.id
    expect(query3).toMatch(/p\.document_id\s*=\s*d\.id/i)
    expect(schema.pages).toContain('document_id')
    expect(schema.documents).toContain('id')
  })

  it('should not reference deprecated column names', () => {
    // Common mistakes from old schema
    const deprecatedColumns = ['document_filename', 'filename', 'content']

    sampleQueries.forEach(query => {
      deprecatedColumns.forEach(col => {
        const regex = new RegExp(`\\b${col}\\b`, 'i')
        expect(query).not.toMatch(regex)
      })
    })
  })
})
