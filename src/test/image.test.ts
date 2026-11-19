import { describe, expect, it } from 'vitest'
import { applyDrag, centerCropForRatio, clampRect, fitInside, fitRatio, type Rect } from '@/lib/image/crop'
import { analyzePixels, aspectRatioLabel } from '@/lib/image/analyze'
import { sniffBytes, typeMatchesAccept, extMatchesAccept } from '@/lib/utils/sniff'
import { baseName, extensionFor, sanitizeFilename, uniqueName } from '@/lib/utils/filename'
import { formatBytes, formatSaving, savedPercent, pluralize } from '@/lib/utils/format'
import { validateFile, type RejectedFile, type UploadedFile } from '@/hooks/useFileUpload'

const bounds = { w: 1000, h: 500 }

describe('crop geometry', () => {
  it('fits the largest centered rect for a ratio', () => {
    expect(fitRatio(bounds, 1)).toEqual({ x: 250, y: 0, w: 500, h: 500 })
    expect(fitRatio(bounds, 4)).toEqual({ x: 0, y: 125, w: 1000, h: 250 })
    expect(centerCropForRatio({ w: 100, h: 100 }, 2)).toEqual({ x: 0, y: 25, w: 100, h: 50 })
  })
  it('moves without leaving the image', () => {
    const r: Rect = { x: 100, y: 100, w: 200, h: 200 }
    expect(applyDrag(r, 'move', 50, -500, bounds, null)).toEqual({ x: 150, y: 0, w: 200, h: 200 })
    expect(applyDrag(r, 'move', 5000, 5000, bounds, null)).toEqual({ x: 800, y: 300, w: 200, h: 200 })
  })
  it('resizes freely from each edge and clamps to bounds', () => {
    const r: Rect = { x: 100, y: 100, w: 200, h: 200 }
    expect(applyDrag(r, 'e', 100, 0, bounds, null)).toEqual({ x: 100, y: 100, w: 300, h: 200 })
    expect(applyDrag(r, 'w', -500, 0, bounds, null)).toEqual({ x: 0, y: 100, w: 300, h: 200 })
    expect(applyDrag(r, 'n', 0, 50, bounds, null)).toEqual({ x: 100, y: 150, w: 200, h: 150 })
    expect(applyDrag(r, 'se', 5000, 5000, bounds, null)).toEqual({ x: 100, y: 100, w: 900, h: 400 })
  })
  it('never shrinks below the minimum size', () => {
    const r: Rect = { x: 100, y: 100, w: 200, h: 200 }
    const out = applyDrag(r, 'e', -1000, 0, bounds, null, 16)
    expect(out.w).toBe(16)
  })
  it('keeps the aspect ratio when locked, anchoring the opposite corner', () => {
    const r: Rect = { x: 100, y: 100, w: 200, h: 100 }
    const out = applyDrag(r, 'se', 100, 0, bounds, 2)
    expect(out.x).toBe(100)
    expect(out.y).toBe(100)
    expect(out.w / out.h).toBeCloseTo(2, 5)
    expect(out.w).toBeCloseTo(300, 5)
  })
  it('locked ratio on an edge resizes around the center line and stays inside', () => {
    const r: Rect = { x: 400, y: 150, w: 200, h: 200 }
    const out = applyDrag(r, 'e', 5000, 0, bounds, 1)
    expect(out.w / out.h).toBeCloseTo(1, 5)
    expect(out.x).toBe(400)
    expect(out.y).toBeGreaterThanOrEqual(0)
    expect(out.y + out.h).toBeLessThanOrEqual(500 + 1e-9)
    expect(out.x + out.w).toBeLessThanOrEqual(1000 + 1e-9)
  })
  it('clamps rects into bounds', () => {
    expect(clampRect({ x: -10, y: 480, w: 2000, h: 100 }, bounds)).toEqual({ x: 0, y: 400, w: 1000, h: 100 })
  })
  it('fits inside a box preserving ratio', () => {
    expect(fitInside({ w: 4000, h: 3000 }, { w: 800, h: 800 })).toEqual({ w: 800, h: 600 })
    expect(fitInside({ w: 10, h: 1000 }, { w: 100, h: 100 })).toEqual({ w: 1, h: 100 })
  })
})

describe('analyzePixels', () => {
  const px = (...rgba: number[]) => new Uint8ClampedArray(rgba)
  it('averages opaque pixels', () => {
    expect(analyzePixels(px(255, 0, 0, 255, 0, 0, 255, 255)).average).toBe('#800080')
  })
  it('finds the dominant color and its share', () => {
    const data = px(...Array.from({ length: 9 }, () => [255, 0, 0, 255]).flat(), 0, 0, 255, 255)
    const a = analyzePixels(data)
    expect(a.palette[0].hex).toBe('#ff0000')
    expect(a.palette[0].share).toBeCloseTo(0.9, 5)
  })
  it('detects transparency and ignores transparent pixels in the average', () => {
    const a = analyzePixels(px(10, 20, 30, 255, 200, 200, 200, 0))
    expect(a.hasTransparency).toBe(true)
    expect(a.transparentShare).toBe(0.5)
    expect(a.average).toBe('#0a141e')
  })
  it('reports no transparency for opaque images', () => {
    expect(analyzePixels(px(1, 2, 3, 255)).hasTransparency).toBe(false)
  })
  it('labels aspect ratios', () => {
    expect(aspectRatioLabel(1920, 1080)).toBe('16:9')
    expect(aspectRatioLabel(640, 480)).toBe('4:3')
    expect(aspectRatioLabel(1366, 768)).toBe('1.779:1')
  })
})

describe('file type sniffing', () => {
  const bytes = (...b: number[]) => new Uint8Array([...b, ...new Array(16).fill(0)])
  const ascii = (s: string) => Uint8Array.from([...s].map((c) => c.charCodeAt(0)))
  it('recognizes common formats from their bytes', () => {
    expect(sniffBytes(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe('image/jpeg')
    expect(sniffBytes(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe('image/png')
    expect(sniffBytes(ascii('RIFF....WEBPVP8 '))).toBe('image/webp')
    expect(sniffBytes(ascii('GIF89a......'))).toBe('image/gif')
    expect(sniffBytes(ascii('%PDF-1.7\n'))).toBe('application/pdf')
    expect(sniffBytes(bytes(0x50, 0x4b, 0x03, 0x04))).toBe('application/zip')
  })
  it('recognizes AVIF and HEIC by brand', () => {
    expect(sniffBytes(ascii('\0\0\0\x1cftypavif....'))).toBe('image/avif')
    expect(sniffBytes(ascii('\0\0\0\x18ftypheic....'))).toBe('image/heic')
    expect(sniffBytes(ascii('\0\0\0\x18ftypheif....'))).toBe('image/heic')
  })
  it('recognizes SVG text and rejects plain text', () => {
    expect(sniffBytes(ascii('<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"/>'))).toBe('image/svg+xml')
    expect(sniffBytes(ascii('just some text'))).toBe('unknown')
  })
  it('matches against accept lists', () => {
    expect(typeMatchesAccept('image/png', ['image/png', '.png'])).toBe(true)
    expect(typeMatchesAccept('image/jpeg', ['image/png', '.png'])).toBe(false)
    expect(typeMatchesAccept('image/heic', ['image/heif', '.heif'])).toBe(true)
    expect(typeMatchesAccept('application/pdf', ['*/*'])).toBe(true)
    expect(extMatchesAccept('A.SVG', ['image/svg+xml', '.svg'])).toBe(true)
  })
})

describe('validateFile', () => {
  const file = (name: string, content: BlobPart[], type = '') => new File(content, name, { type })
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])
  const isRejected = (r: UploadedFile | RejectedFile): r is RejectedFile => 'reason' in r

  it('accepts a real PNG', async () => {
    const r = await validateFile(file('a.png', [png], 'image/png'), ['image/png', '.png'], 10)
    expect(isRejected(r)).toBe(false)
    if (!isRejected(r)) expect(r.sniffed).toBe('image/png')
  })
  it('rejects a text file renamed to .png', async () => {
    const r = await validateFile(file('fake.png', ['hello there, i am text'], 'image/png'), ['image/png', '.png'], 10)
    expect(isRejected(r)).toBe(true)
  })
  it('rejects a PNG renamed to .pdf', async () => {
    const r = await validateFile(file('wrong.pdf', [png], 'application/pdf'), ['application/pdf', '.pdf'], 10)
    expect(isRejected(r) && r.reason).toMatch(/Expected PDF|not a supported/i)
  })
  it('rejects empty and oversized files', async () => {
    expect(await validateFile(file('e.png', []), ['image/png'], 10)).toMatchObject({ reason: 'The file is empty.' })
    const big = file('big.png', [png])
    Object.defineProperty(big, 'size', { value: 11 * 1024 * 1024 })
    expect(await validateFile(big, ['image/png'], 10)).toMatchObject({ reason: expect.stringMatching(/larger than 10 MB/) })
  })
  it('lets text formats such as SVG fall back to the extension', async () => {
    const r = await validateFile(file('a.svg', ['<?xml version="1.0"?><g/>']), ['image/svg+xml', '.svg'], 10)
    expect(isRejected(r)).toBe(false)
  })
  it('sanitizes names', async () => {
    const r = await validateFile(file('../..\\evil<script>.png', [png]), ['image/png', '.png'], 10)
    expect(isRejected(r)).toBe(false)
    if (!isRejected(r)) expect(r.name).not.toMatch(/[<>\\/]/)
  })
})

describe('filenames and formatting', () => {
  it('sanitizes dangerous names', () => {
    expect(sanitizeFilename('../../etc/passwd')).toBe('.._.._etc_passwd'.replace(/^\.+/, ''))
    expect(sanitizeFilename('a<b>:"c"|?*.png')).toBe('a_b___c____.png')
    expect(sanitizeFilename('‮gnp.exe')).toBe('_gnp.exe')
    expect(sanitizeFilename('   ')).toBe('file')
    expect(sanitizeFilename('x'.repeat(300)).length).toBe(120)
  })
  it('derives base names and extensions', () => {
    expect(baseName('photo.final.jpg')).toBe('photo.final')
    expect(baseName('.hidden')).toBe('hidden')
    expect(extensionFor('image/jpeg')).toBe('jpg')
    expect(extensionFor('application/x-weird')).toBe('bin')
  })
  it('makes names unique inside a zip', () => {
    const used = new Set<string>()
    expect(uniqueName('a.png', used)).toBe('a.png')
    expect(uniqueName('a.png', used)).toBe('a (2).png')
    expect(uniqueName('a.png', used)).toBe('a (3).png')
  })
  it('formats sizes and savings', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(1536)).toBe('1.5 KB')
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB')
    expect(savedPercent(1000, 250)).toBe(75)
    expect(formatSaving(1000, 250)).toBe('75% smaller')
    expect(formatSaving(100, 150)).toBe('50% larger')
    expect(formatSaving(100, 100)).toBe('Same size')
    expect(pluralize(1, 'page')).toBe('1 page')
    expect(pluralize(2, 'page')).toBe('2 pages')
  })
})
