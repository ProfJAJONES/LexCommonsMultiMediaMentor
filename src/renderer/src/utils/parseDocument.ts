/**
 * parseDocument
 *
 * Browser-safe extraction of plain text from PDF / DOCX / TXT files for the
 * AI knowledge base. Hard-caps output to MAX_TEXT_BYTES (~50KB ≈ 12K tokens)
 * with an explicit truncation marker so the prompt stays bounded.
 *
 * - PDFs go through pdfjs-dist (configured with a Vite ?url worker import)
 * - DOCX goes through mammoth.extractRawText (browser bundle)
 * - .txt is read directly
 */

import * as pdfjsLib from 'pdfjs-dist'
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

// Configure pdf.js worker once on module load.
pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc

// mammoth ships no TS types. We use the standard 'mammoth' entry — Vite applies
// the package's `browser` field to swap out node-only sub-deps (unzip etc.) so
// this works in the renderer without pulling in node:fs.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mammothImport: Promise<any> = import('mammoth')

export const MAX_TEXT_BYTES = 50_000  // ~12K tokens at ~4 chars/token

export type DocumentKind = 'pdf' | 'docx' | 'txt'

export interface ParsedDocument {
  text: string
  kind: DocumentKind
  fileName: string
  fileSize: number
  truncated: boolean
  pageCount?: number  // PDFs only
}

function detectKind(file: File): DocumentKind | null {
  const name = file.name.toLowerCase()
  if (name.endsWith('.pdf')) return 'pdf'
  if (name.endsWith('.docx')) return 'docx'
  if (name.endsWith('.txt') || name.endsWith('.md')) return 'txt'
  // Fall back to MIME type sniffing for files without extensions
  if (file.type === 'application/pdf') return 'pdf'
  if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return 'docx'
  if (file.type.startsWith('text/')) return 'txt'
  return null
}

function truncate(text: string): { text: string; truncated: boolean } {
  // Byte-aware truncation (UTF-8 chars can be multi-byte; cap by encoded length)
  const encoder = new TextEncoder()
  const bytes = encoder.encode(text)
  if (bytes.byteLength <= MAX_TEXT_BYTES) return { text, truncated: false }
  const decoder = new TextDecoder('utf-8', { fatal: false })
  const truncatedBytes = bytes.slice(0, MAX_TEXT_BYTES)
  const truncatedText = decoder.decode(truncatedBytes)
  return {
    text: truncatedText.replace(/\s*\S*$/, '') + '\n\n[…document truncated for prompt budget…]',
    truncated: true
  }
}

async function parsePdf(file: File): Promise<{ text: string; pageCount: number }> {
  const arrayBuffer = await file.arrayBuffer()
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) })
  const doc = await loadingTask.promise
  const pageCount = doc.numPages
  const parts: string[] = []
  for (let i = 1; i <= pageCount; i++) {
    const page = await doc.getPage(i)
    const content = await page.getTextContent()
    const pageText = content.items
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((it: any) => (typeof it.str === 'string' ? it.str : ''))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()
    if (pageText) parts.push(pageText)
    // Early-out once we've got enough text — avoids parsing 200 pages we'll discard
    if (parts.join('\n\n').length > MAX_TEXT_BYTES * 1.5) break
  }
  await doc.destroy()
  return { text: parts.join('\n\n'), pageCount }
}

async function parseDocx(file: File): Promise<string> {
  const mammoth = await mammothImport
  const arrayBuffer = await file.arrayBuffer()
  const result = await mammoth.extractRawText({ arrayBuffer })
  return typeof result?.value === 'string' ? result.value : ''
}

async function parseTxt(file: File): Promise<string> {
  return await file.text()
}

export async function parseDocument(file: File): Promise<ParsedDocument> {
  const kind = detectKind(file)
  if (!kind) {
    throw new Error(`Unsupported file type: ${file.name}. Use PDF, DOCX, or TXT.`)
  }

  let rawText = ''
  let pageCount: number | undefined

  if (kind === 'pdf') {
    const r = await parsePdf(file)
    rawText = r.text
    pageCount = r.pageCount
  } else if (kind === 'docx') {
    rawText = await parseDocx(file)
  } else {
    rawText = await parseTxt(file)
  }

  rawText = rawText.trim()
  if (!rawText) {
    throw new Error(`No text could be extracted from ${file.name}. The file may be image-only or empty.`)
  }

  const { text, truncated } = truncate(rawText)
  return {
    text,
    kind,
    fileName: file.name,
    fileSize: file.size,
    truncated,
    pageCount
  }
}
