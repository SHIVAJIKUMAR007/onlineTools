/**
 * PDF rendering with PDF.js. The library and its worker are loaded on demand.
 * The worker file is bundled with the site, so nothing is fetched from a CDN.
 */
import type { PDFDocumentProxy } from 'pdfjs-dist'

let pdfjsPromise: Promise<typeof import('pdfjs-dist')> | null = null

async function getPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      const pdfjs = await import('pdfjs-dist')
      const worker = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
      pdfjs.GlobalWorkerOptions.workerSrc = worker
      return pdfjs
    })()
  }
  return pdfjsPromise
}

export class PdfRenderError extends Error {
  constructor(
    message: string,
    public code: 'password' | 'invalid',
  ) {
    super(message)
    this.name = 'PdfRenderError'
  }
}

export async function openPdf(data: ArrayBuffer | Uint8Array): Promise<PDFDocumentProxy> {
  const pdfjs = await getPdfjs()
  // PDF.js transfers the buffer to its worker, so give it a copy.
  const copy = data instanceof Uint8Array ? data.slice() : new Uint8Array(data.slice(0))
  try {
    return await pdfjs.getDocument({ data: copy }).promise
  } catch (e) {
    const name = (e as { name?: string })?.name
    if (name === 'PasswordException') throw new PdfRenderError('This PDF is password-protected. Remove the password, then try again.', 'password')
    throw new PdfRenderError('This file could not be read as a PDF. It may be damaged.', 'invalid')
  }
}

export interface RenderedPage {
  canvas: HTMLCanvasElement
  width: number
  height: number
}

/** Render a 1-based page at `scale` (1 = 72 DPI). */
export async function renderPageToCanvas(doc: PDFDocumentProxy, pageNumber: number, scale: number, rotation?: number): Promise<RenderedPage> {
  const page = await doc.getPage(pageNumber)
  try {
    const viewport = page.getViewport({ scale, rotation: rotation === undefined ? undefined : (page.rotate + rotation) % 360 })
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.floor(viewport.width))
    canvas.height = Math.max(1, Math.floor(viewport.height))
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('The browser could not create a drawing surface.')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    await page.render({ canvas, canvasContext: ctx, viewport }).promise
    return { canvas, width: canvas.width, height: canvas.height }
  } finally {
    page.cleanup()
  }
}

export function canvasToBlobAsync(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('The browser could not encode the page image.'))), type, quality),
  )
}

/** Cap pixel count so a huge page at high DPI fails with advice instead of a blank canvas. */
export function checkRenderSize(widthPt: number, heightPt: number, dpi: number): string | null {
  const scale = dpi / 72
  const w = widthPt * scale
  const h = heightPt * scale
  if (w > 16000 || h > 16000 || w * h > 120_000_000) {
    return `A page would be ${Math.round(w)} × ${Math.round(h)} pixels at ${dpi} DPI, which is too large for the browser. Choose a lower resolution.`
  }
  return null
}
