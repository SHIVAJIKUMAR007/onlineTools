/**
 * PDF editing with pdf-lib. All functions take and return bytes, never files,
 * so they are easy to test and to run from any tool.
 */
import { PDFDocument, PDFName, degrees, type PDFPage } from 'pdf-lib'
import { normalizeRotation } from './pages'

export class PdfPasswordError extends Error {
  constructor() {
    super('This PDF is password-protected. Remove the password in a PDF reader, then try again.')
    this.name = 'PdfPasswordError'
  }
}

export async function loadPdf(bytes: ArrayBuffer | Uint8Array): Promise<PDFDocument> {
  try {
    return await PDFDocument.load(bytes, { ignoreEncryption: false, updateMetadata: false })
  } catch (e) {
    const msg = e instanceof Error ? e.message : ''
    if (/encrypt/i.test(msg)) throw new PdfPasswordError()
    throw new Error('This file could not be read as a PDF. It may be damaged.')
  }
}

export async function pageCountOf(bytes: ArrayBuffer | Uint8Array): Promise<number> {
  return (await loadPdf(bytes)).getPageCount()
}

export async function mergePdfs(inputs: (ArrayBuffer | Uint8Array)[]): Promise<Uint8Array> {
  if (inputs.length === 0) throw new Error('Add at least one PDF to merge.')
  const out = await PDFDocument.create()
  for (const bytes of inputs) {
    const src = await loadPdf(bytes)
    const copied = await out.copyPages(src, src.getPageIndices())
    copied.forEach((p) => out.addPage(p))
  }
  return out.save()
}

/** Copy the given 0-based page indexes into a new PDF, in the order given. */
export async function extractPages(bytes: ArrayBuffer | Uint8Array, indexes: number[]): Promise<Uint8Array> {
  if (indexes.length === 0) throw new Error('No pages selected.')
  const src = await loadPdf(bytes)
  const out = await PDFDocument.create()
  const copied = await out.copyPages(src, indexes)
  copied.forEach((p) => out.addPage(p))
  return out.save()
}

/** Set absolute rotation on pages. `rotations` maps 0-based index to total clockwise degrees to ADD. */
export async function rotatePages(bytes: ArrayBuffer | Uint8Array, rotations: Map<number, number>): Promise<Uint8Array> {
  const doc = await loadPdf(bytes)
  const pages = doc.getPages()
  for (const [index, extra] of rotations) {
    const page = pages[index]
    if (!page) continue
    page.setRotation(degrees(normalizeRotation(page.getRotation().angle + extra)))
  }
  return doc.save()
}

export interface PdfInfo {
  pageCount: number
  title?: string
  author?: string
  subject?: string
  keywords?: string
  creator?: string
  producer?: string
  creationDate?: Date
  modificationDate?: Date
  encrypted: boolean
  version?: string
  pageSizes: { width: number; height: number; rotation: number }[]
}

export function pdfVersion(bytes: Uint8Array): string | undefined {
  const head = new TextDecoder('latin1').decode(bytes.slice(0, 16))
  return /%PDF-(\d\.\d)/.exec(head)?.[1]
}

export async function getPdfInfo(bytes: Uint8Array): Promise<PdfInfo> {
  let encrypted = false
  let doc: PDFDocument
  try {
    doc = await PDFDocument.load(bytes, { updateMetadata: false })
  } catch (e) {
    if (/encrypt/i.test(e instanceof Error ? e.message : '')) {
      // Try again ignoring encryption so we can still report basic facts.
      doc = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false })
      encrypted = true
    } else {
      throw new Error('This file could not be read as a PDF. It may be damaged.')
    }
  }
  const pages = doc.getPages()
  return {
    pageCount: pages.length,
    title: doc.getTitle(),
    author: doc.getAuthor(),
    subject: doc.getSubject(),
    keywords: doc.getKeywords(),
    creator: doc.getCreator(),
    producer: doc.getProducer(),
    creationDate: doc.getCreationDate(),
    modificationDate: doc.getModificationDate(),
    encrypted: encrypted || doc.isEncrypted,
    version: pdfVersion(bytes),
    pageSizes: pages.map((p: PDFPage) => ({ width: p.getWidth(), height: p.getHeight(), rotation: p.getRotation().angle })),
  }
}

/** Return a copy with the standard Info dictionary fields blanked. */
export async function clearMetadata(bytes: ArrayBuffer | Uint8Array): Promise<Uint8Array> {
  const doc = await loadPdf(bytes)
  doc.setTitle('')
  doc.setAuthor('')
  doc.setSubject('')
  doc.setKeywords([])
  doc.setCreator('')
  doc.setProducer('')
  // Remove the XMP metadata stream if present.
  doc.catalog.delete(PDFName.of('Metadata'))
  return doc.save({ useObjectStreams: true })
}

/** Lossless cleanup: drop metadata and repack with object streams. */
export async function losslessOptimize(bytes: ArrayBuffer | Uint8Array): Promise<Uint8Array> {
  const doc = await loadPdf(bytes)
  doc.setTitle('')
  doc.setAuthor('')
  doc.setSubject('')
  doc.setKeywords([])
  doc.setCreator('')
  doc.setProducer('')
  doc.catalog.delete(PDFName.of('Metadata'))
  return doc.save({ useObjectStreams: true, addDefaultPage: false })
}

// ───────────── Images → PDF ─────────────

export const PAGE_SIZES = {
  a4: [595.28, 841.89],
  letter: [612, 792],
  legal: [612, 1008],
  a5: [419.53, 595.28],
} as const

export type PageSizeKey = keyof typeof PAGE_SIZES | 'fit'
export type Orientation = 'auto' | 'portrait' | 'landscape'

export interface ImagePage {
  bytes: Uint8Array
  /** 'jpeg' or 'png' are embedded directly. */
  kind: 'jpeg' | 'png'
  width: number
  height: number
}

export interface ImagesToPdfOptions {
  pageSize: PageSizeKey
  orientation: Orientation
  /** Margin in points. */
  margin: number
}

/** Compute the page box and the image placement for one image. Pure, so it is unit tested. */
export function layoutImage(
  img: { width: number; height: number },
  opts: ImagesToPdfOptions,
): { page: [number, number]; x: number; y: number; w: number; h: number } {
  const margin = Math.max(0, opts.margin)
  if (opts.pageSize === 'fit') {
    const w = img.width
    const h = img.height
    return { page: [w + margin * 2, h + margin * 2], x: margin, y: margin, w, h }
  }
  let [pw, ph]: [number, number] = [PAGE_SIZES[opts.pageSize][0], PAGE_SIZES[opts.pageSize][1]]
  const landscape = opts.orientation === 'landscape' || (opts.orientation === 'auto' && img.width > img.height)
  if (landscape && pw < ph) [pw, ph] = [ph, pw]
  if (opts.orientation === 'portrait' && pw > ph) [pw, ph] = [ph, pw]
  const availW = Math.max(1, pw - margin * 2)
  const availH = Math.max(1, ph - margin * 2)
  const scale = Math.min(availW / img.width, availH / img.height)
  const w = img.width * scale
  const h = img.height * scale
  return { page: [pw, ph], x: (pw - w) / 2, y: (ph - h) / 2, w, h }
}

export async function imagesToPdf(images: ImagePage[], opts: ImagesToPdfOptions): Promise<Uint8Array> {
  if (images.length === 0) throw new Error('Add at least one image.')
  const doc = await PDFDocument.create()
  for (const img of images) {
    const embedded = img.kind === 'jpeg' ? await doc.embedJpg(img.bytes) : await doc.embedPng(img.bytes)
    const l = layoutImage({ width: embedded.width, height: embedded.height }, opts)
    const page = doc.addPage(l.page)
    page.drawImage(embedded, { x: l.x, y: l.y, width: l.w, height: l.h })
  }
  return doc.save()
}
