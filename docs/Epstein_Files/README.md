# Document Upload Folder

Place your PDF and image files here for processing.

Supported formats:
- PDF documents
- Images (PNG, JPG, JPEG)
- ZIP archives containing PDFs/images

**Note:** This folder is gitignored - your documents won't be committed to the repository.

## Processing

After adding your documents here, run:

```bash
pnpm extract
```

This will:
1. Extract text from images using OCR
2. Extract text from PDFs
3. Save processed content to the database
