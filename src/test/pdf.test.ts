import { describe, expect, it } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import { normalizeRotation, parsePageRanges, rangeLabel, remainingIndexes } from '@/lib/pdf/pages'
import { clearMetadata, extractPages, getPdfInfo, imagesToPdf, layoutImage, losslessOptimize, mergePdfs, pageCountOf, PAGE_SIZES, rotatePages, pdfVersion } from '@/lib/pdf/edit'

async function makePdf(pages: number, meta?: { title?: string; author?: string }): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  for (let i = 0; i < pages; i++) doc.addPage([200 + i * 10, 300])
  if (meta?.title) doc.setTitle(meta.title)
  if (meta?.author) doc.setAuthor(meta.author)
  return doc.save()
}

describe('parsePageRanges', () => {
  it('parses pages and ranges into groups', () => {
    expect(parsePageRanges('1-3, 5, 8-10', 10)).toEqual({ ok: true, groups: [[1, 2, 3], [5], [8, 9, 10]] })
  })
  it('accepts an en dash and extra spaces', () => {
    expect(parsePageRanges(' 2 – 4 ,6', 6)).toEqual({ ok: true, groups: [[2, 3, 4], [6]] })
  })
  it('lets a range run backwards', () => {
    expect(parsePageRanges('4-2', 5)).toEqual({ ok: true, groups: [[4, 3, 2]] })
  })
  it('rejects pages outside the document', () => {
    const r = parsePageRanges('1, 9', 5)
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/outside this document/)
    expect(parsePageRanges('0', 5).ok).toBe(false)
  })
  it('rejects garbage and empty input with a message', () => {
    expect(parsePageRanges('abc', 5).error).toMatch(/not a page number/)
    expect(parsePageRanges('1-', 5).ok).toBe(false)
    expect(parsePageRanges('   ', 5).error).toMatch(/Enter at least one/)
    expect(parsePageRanges(',,', 5).ok).toBe(false)
  })
  it('labels ranges for file names', () => {
    expect(rangeLabel([3])).toBe('3')
    expect(rangeLabel([1, 2, 3])).toBe('1-3')
    expect(rangeLabel([5, 4, 3])).toBe('5-3')
    expect(rangeLabel([1, 3, 5])).toBe('1_3_5')
  })
  it('computes remaining pages and normalizes rotation', () => {
    expect(remainingIndexes(5, new Set([1, 3]))).toEqual([0, 2, 4])
    expect(normalizeRotation(450)).toBe(90)
    expect(normalizeRotation(-90)).toBe(270)
    expect(normalizeRotation(360)).toBe(0)
  })
})

describe('PDF editing (pdf-lib)', () => {
  it('merges documents in order', async () => {
    const out = await PDFDocument.load(await mergePdfs([await makePdf(2), await makePdf(3)]))
    expect(out.getPageCount()).toBe(5)
    // First doc page widths are 200, 210; second doc starts again at 200.
    expect(out.getPage(1).getWidth()).toBe(210)
    expect(out.getPage(2).getWidth()).toBe(200)
  })
  it('refuses to merge nothing', async () => {
    await expect(mergePdfs([])).rejects.toThrow(/at least one/)
  })
  it('extracts pages in the requested order', async () => {
    const out = await PDFDocument.load(await extractPages(await makePdf(5), [4, 0]))
    expect(out.getPageCount()).toBe(2)
    expect(out.getPage(0).getWidth()).toBe(240)
    expect(out.getPage(1).getWidth()).toBe(200)
  })
  it('rotates pages by adding to existing rotation', async () => {
    const once = await rotatePages(await makePdf(2), new Map([[0, 90]]))
    const twice = await PDFDocument.load(await rotatePages(once, new Map([[0, 90], [1, -90]])))
    expect(twice.getPage(0).getRotation().angle).toBe(180)
    expect(twice.getPage(1).getRotation().angle).toBe(270)
  })
  it('reports damaged files clearly', async () => {
    await expect(pageCountOf(new TextEncoder().encode('not a pdf'))).rejects.toThrow(/could not be read as a PDF/)
  })
  it('reads metadata and page sizes', async () => {
    const info = await getPdfInfo(await makePdf(2, { title: 'T', author: 'A' }))
    expect(info).toMatchObject({ pageCount: 2, title: 'T', author: 'A', encrypted: false })
    expect(info.pageSizes[1]).toEqual({ width: 210, height: 300, rotation: 0 })
    expect(pdfVersion(await makePdf(1))).toMatch(/^1\.\d$/)
  })
  it('clears metadata without losing pages', async () => {
    const out = await PDFDocument.load(await clearMetadata(await makePdf(3, { title: 'Secret', author: 'Me' })), { updateMetadata: false })
    expect(out.getPageCount()).toBe(3)
    expect(out.getTitle() ?? '').toBe('')
    expect(out.getAuthor() ?? '').toBe('')
  })
  it('lossless optimize keeps every page', async () => {
    const out = await PDFDocument.load(await losslessOptimize(await makePdf(4, { title: 'x' })))
    expect(out.getPageCount()).toBe(4)
  })
})

describe('images to PDF', () => {
  it('fits an image inside an A4 page with margins, centered', () => {
    const l = layoutImage({ width: 1000, height: 500 }, { pageSize: 'a4', orientation: 'auto', margin: 20 })
    // Auto orientation: wide image gets a landscape page.
    expect(l.page[0]).toBeCloseTo(PAGE_SIZES.a4[1], 1)
    expect(l.page[1]).toBeCloseTo(PAGE_SIZES.a4[0], 1)
    expect(l.w / l.h).toBeCloseTo(2, 5)
    expect(l.x).toBeCloseTo((l.page[0] - l.w) / 2, 5)
    expect(l.x).toBeGreaterThanOrEqual(20 - 1e-9)
    expect(l.y).toBeGreaterThanOrEqual(20 - 1e-9)
  })
  it('forces portrait or landscape', () => {
    expect(layoutImage({ width: 1000, height: 500 }, { pageSize: 'letter', orientation: 'portrait', margin: 0 }).page).toEqual([612, 792])
    expect(layoutImage({ width: 500, height: 1000 }, { pageSize: 'letter', orientation: 'landscape', margin: 0 }).page).toEqual([792, 612])
  })
  it('sizes the page to the image in "fit" mode', () => {
    const l = layoutImage({ width: 300, height: 200 }, { pageSize: 'fit', orientation: 'auto', margin: 10 })
    expect(l.page).toEqual([320, 220])
    expect(l).toMatchObject({ x: 10, y: 10, w: 300, h: 200 })
  })
  it('creates a PDF with one page per image, embedding PNG bytes as-is', async () => {
    // 1x1 transparent PNG.
    const png = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='), (c) => c.charCodeAt(0))
    const bytes = await imagesToPdf([{ bytes: png, kind: 'png', width: 0, height: 0 }, { bytes: png, kind: 'png', width: 0, height: 0 }], { pageSize: 'a4', orientation: 'portrait', margin: 0 })
    const doc = await PDFDocument.load(bytes)
    expect(doc.getPageCount()).toBe(2)
    expect(doc.getPage(0).getWidth()).toBeCloseTo(PAGE_SIZES.a4[0], 1)
  })
  it('refuses an empty list', async () => {
    await expect(imagesToPdf([], { pageSize: 'a4', orientation: 'auto', margin: 0 })).rejects.toThrow(/at least one/)
  })
})
