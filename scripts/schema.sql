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
-- NOTE: Replace 'GENERATE_SECURE_PASSWORD' with actual secure password
-- CREATE USER epstein_reader WITH PASSWORD 'GENERATE_SECURE_PASSWORD';
-- GRANT CONNECT ON DATABASE epstein_files TO epstein_reader;
-- GRANT SELECT ON documents, pages TO epstein_reader;
