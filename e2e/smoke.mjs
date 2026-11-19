/**
 * Browser smoke test. Drives the production build (npm run build && npm run preview)
 * in a real Chromium-based browser and checks that tools produce correct output.
 *
 *   BASE_URL=http://localhost:4173 node e2e/smoke.mjs [filter]
 *
 * Needs Chrome or Edge installed. Set BROWSER_CHANNEL=chrome|msedge (default msedge).
 */
import { chromium } from 'playwright-core'
import { PDFDocument, StandardFonts } from 'pdf-lib'
import { readFileSync } from 'node:fs'

const BASE = process.env.BASE_URL ?? 'http://localhost:4173'
const filter = process.argv[2]
const results = []
const errors = []

const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL ?? 'msedge', headless: true })
const context = await browser.newContext({ acceptDownloads: true, viewport: { width: 1280, height: 900 } })

async function newPage() {
  const page = await context.newPage()
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`[console] ${page.url()} ${m.text()}`)
  })
  page.on('pageerror', (e) => errors.push(`[pageerror] ${page.url()} ${e.message}`))
  return page
}

async function test(name, fn) {
  if (filter && !name.includes(filter)) return
  const started = Date.now()
  const page = await newPage()
  try {
    await fn(page)
    results.push({ name, ok: true, ms: Date.now() - started })
    console.log(`  ok   ${name} (${Date.now() - started} ms)`)
  } catch (e) {
    results.push({ name, ok: false, error: e.message })
    console.log(`  FAIL ${name}\n       ${e.message.split('\n')[0]}`)
    await page.screenshot({ path: `e2e/fail-${name.replace(/\W+/g, '-')}.png` }).catch(() => {})
  } finally {
    await page.close()
  }
}

const assert = (cond, msg) => {
  if (!cond) throw new Error(msg)
}

/** Make a test image inside the browser so no fixture files are needed. */
async function makeImage(page, { w = 800, h = 600, type = 'image/jpeg', transparent = false }) {
  const b64 = await page.evaluate(
    async ({ w, h, type, transparent }) => {
      const c = document.createElement('canvas')
      c.width = w
      c.height = h
      const ctx = c.getContext('2d')
      if (!transparent) {
        const g = ctx.createLinearGradient(0, 0, w, h)
        g.addColorStop(0, '#ff6a00')
        g.addColorStop(1, '#0066ff')
        ctx.fillStyle = g
        ctx.fillRect(0, 0, w, h)
      }
      // Some detail so compression has something to do.
      for (let i = 0; i < 400; i++) {
        ctx.fillStyle = `hsl(${(i * 37) % 360} 80% 50% / ${transparent ? 1 : 0.7})`
        ctx.beginPath()
        ctx.arc(((i * 97) % w) + 1, ((i * 53) % h) + 1, 6 + (i % 18), 0, 7)
        ctx.fill()
      }
      const blob = await new Promise((r) => c.toBlob(r, type, 0.95))
      const buf = new Uint8Array(await blob.arrayBuffer())
      let s = ''
      for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000))
      return btoa(s)
    },
    { w, h, type, transparent },
  )
  return Buffer.from(b64, 'base64')
}

async function makePdf(pages, label) {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  for (let i = 1; i <= pages; i++) {
    const p = doc.addPage([400, 300])
    p.drawText(`${label} page ${i}`, { x: 40, y: 150, size: 24, font })
  }
  return Buffer.from(await doc.save())
}

const upload = (page, files) => page.locator('input[type=file]').first().setInputFiles(files)
const buf = (name, mimeType, buffer) => ({ name, mimeType, buffer })

async function download(page, clickFn) {
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), clickFn()])
  return { name: dl.suggestedFilename(), data: readFileSync(await dl.path()) }
}

const magic = (data) => {
  if (data[0] === 0xff && data[1] === 0xd8) return 'jpeg'
  if (data[0] === 0x89 && data[1] === 0x50) return 'png'
  if (data.subarray(0, 4).toString() === 'RIFF' && data.subarray(8, 12).toString() === 'WEBP') return 'webp'
  if (data.subarray(4, 8).toString() === 'ftyp' && data.subarray(8, 12).toString().startsWith('avif')) return 'avif'
  if (data.subarray(0, 5).toString() === '%PDF-') return 'pdf'
  if (data[0] === 0x50 && data[1] === 0x4b) return 'zip'
  return 'unknown'
}

console.log(`Smoke test against ${BASE}\n`)

// ───────────── Site shell ─────────────
await test('home: hero, search and popular tools', async (page) => {
  await page.goto(BASE)
  assert((await page.locator('h1').innerText()).includes('Nothing uploaded'), 'h1 text')
  await page.getByRole('combobox', { name: 'Search tools' }).first().fill('merge')
  await page.getByRole('option', { name: /PDF Merger/ }).first().waitFor()
  assert((await page.locator('a[href="/background-remover"]').count()) > 0, 'popular link to background remover')
})

await test('home: dropping a file suggests tools', async (page) => {
  await page.goto(BASE)
  const png = await makeImage(page, { type: 'image/png' })
  await page.locator('input[type=file]').first().setInputFiles(buf('photo.png', 'image/png', png))
  await page.getByRole('button', { name: 'Image Compressor' }).waitFor()
  await page.getByRole('button', { name: 'Image Compressor' }).click()
  await page.waitForURL('**/image-compressor')
  // The file is handed over and processed without being picked again.
  await page.getByText('photo.png').first().waitFor({ timeout: 15000 })
})

await test('search palette opens with Ctrl+K', async (page) => {
  await page.goto(BASE + '/about')
  await page.waitForSelector('h1')
  await page.keyboard.press('Control+k')
  await page.getByRole('dialog', { name: 'Search tools' }).waitFor()
  await page.keyboard.type('json')
  await page.keyboard.press('Enter')
  await page.waitForURL('**/json-formatter')
})

await test('404 page', async (page) => {
  await page.goto(BASE + '/definitely-not-a-page')
  await page.getByRole('heading', { name: /does not exist/ }).waitFor()
})

// ───────────── Image tools ─────────────
await test('image compressor: smaller JPEG, real sizes', async (page) => {
  await page.goto(BASE + '/image-compressor')
  const jpg = await makeImage(page, { w: 1600, h: 1200, type: 'image/jpeg' })
  await upload(page, buf('big.jpg', 'image/jpeg', jpg))
  await page.getByText(/smaller/).first().waitFor({ timeout: 30000 })
  const d = await download(page, () => page.getByRole('button', { name: /^Download big\.jpg/ }).click())
  assert(magic(d.data) === 'jpeg', 'output is JPEG')
  assert(d.data.length < jpg.length, `compressed ${d.data.length} < original ${jpg.length}`)
  assert(d.name === 'big-compressed.jpg', `file name ${d.name}`)
})

await test('png to jpg: transparency filled with background', async (page) => {
  await page.goto(BASE + '/png-to-jpg')
  const png = await makeImage(page, { w: 300, h: 300, type: 'image/png', transparent: true })
  await upload(page, buf('t.png', 'image/png', png))
  await page.getByText(/→/).first().waitFor({ timeout: 30000 })
  const d = await download(page, () => page.getByRole('button', { name: /^Download t\.png/ }).click())
  assert(magic(d.data) === 'jpeg', 'output is JPEG')
  // Find a fully transparent pixel in the source PNG, then check the same pixel in the JPEG is white, not black.
  const px = await page.evaluate(async ({ src, out }) => {
    const load = async (b64, type) => {
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
      const bmp = await createImageBitmap(new Blob([bytes], { type }))
      const c = document.createElement('canvas')
      c.width = bmp.width
      c.height = bmp.height
      const ctx = c.getContext('2d')
      ctx.drawImage(bmp, 0, 0)
      return ctx.getImageData(0, 0, bmp.width, bmp.height)
    }
    const a = await load(src, 'image/png')
    const b = await load(out, 'image/jpeg')
    for (let i = 0; i < a.data.length; i += 4) {
      if (a.data[i + 3] === 0) return { found: true, rgb: [b.data[i], b.data[i + 1], b.data[i + 2]] }
    }
    return { found: false }
  }, { src: png.toString('base64'), out: d.data.toString('base64') })
  assert(px.found, 'test image has a transparent pixel')
  assert(px.rgb.every((v) => v > 240), `transparent pixel became white, got ${px.rgb}`)
})

await test('image converter: webp and avif output', async (page) => {
  await page.goto(BASE + '/image-converter')
  const png = await makeImage(page, { w: 400, h: 300, type: 'image/png' })
  await upload(page, buf('c.png', 'image/png', png))
  // default is WebP
  await page.getByText(/→/).first().waitFor({ timeout: 30000 })
  let d = await download(page, () => page.getByRole('button', { name: /^Download c\.png/ }).click())
  assert(magic(d.data) === 'webp', `expected webp, got ${magic(d.data)}`)
  assert(d.name === 'c.webp', d.name)
  await page.getByRole('radio', { name: 'AVIF' }).click()
  await page.getByRole('button', { name: /^Convert/ }).click()
  await page.getByText(/→/).first().waitFor({ timeout: 90000 })
  await page.waitForFunction(() => !document.body.innerText.includes('Working'), null, { timeout: 90000 })
  d = await download(page, () => page.getByRole('button', { name: /^Download c\.png/ }).click())
  assert(magic(d.data) === 'avif', `expected avif, got ${magic(d.data)}`)
})

await test('image resizer: exact size', async (page) => {
  await page.goto(BASE + '/image-resizer')
  const jpg = await makeImage(page, { w: 1000, h: 500, type: 'image/jpeg' })
  await upload(page, buf('r.jpg', 'image/jpeg', jpg))
  await page.getByLabel('Width (px)').fill('250')
  await page.getByText('250 × 125').first().waitFor({ timeout: 20000 })
  await page.getByRole('button', { name: /^Download \(/ }).waitFor({ timeout: 20000 })
  const d = await download(page, () => page.getByRole('button', { name: /^Download/ }).last().click())
  const dims = await page.evaluate(async (b64) => {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
    const bmp = await createImageBitmap(new Blob([bytes]))
    return [bmp.width, bmp.height]
  }, d.data.toString('base64'))
  assert(dims[0] === 250 && dims[1] === 125, `dims ${dims}`)
})

await test('image rotator: 90 degrees swaps size', async (page) => {
  await page.goto(BASE + '/image-rotator')
  const jpg = await makeImage(page, { w: 600, h: 200, type: 'image/jpeg' })
  await upload(page, buf('rot.jpg', 'image/jpeg', jpg))
  await page.getByRole('button', { name: 'Rotate 90 degrees clockwise' }).click()
  const d = await download(page, () => page.getByRole('button', { name: /Download image/ }).click())
  const dims = await page.evaluate(async (b64) => {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
    const bmp = await createImageBitmap(new Blob([bytes]))
    return [bmp.width, bmp.height]
  }, d.data.toString('base64'))
  assert(dims[0] === 200 && dims[1] === 600, `dims ${dims}`)
})

await test('image cropper: crop to 1:1', async (page) => {
  await page.goto(BASE + '/image-cropper')
  const jpg = await makeImage(page, { w: 800, h: 400, type: 'image/jpeg' })
  await upload(page, buf('crop.jpg', 'image/jpeg', jpg))
  await page.getByRole('radio', { name: '1:1' }).click()
  const d = await download(page, () => page.getByRole('button', { name: /Crop and download/ }).click())
  const dims = await page.evaluate(async (b64) => {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
    const bmp = await createImageBitmap(new Blob([bytes]))
    return [bmp.width, bmp.height]
  }, d.data.toString('base64'))
  assert(dims[0] === 400 && dims[1] === 400, `dims ${dims}`)
})

await test('image to base64', async (page) => {
  await page.goto(BASE + '/image-to-base64')
  const png = await makeImage(page, { w: 32, h: 32, type: 'image/png' })
  await upload(page, buf('tiny.png', 'image/png', png))
  const ta = page.getByLabel('Encoded output')
  await page.waitForFunction(() => document.querySelector('textarea')?.value.startsWith('data:image/png;base64,'), null, { timeout: 10000 })
  const val = await ta.inputValue()
  assert(Buffer.from(val.split(',')[1], 'base64').equals(png), 'round-trips to the same bytes')
})

await test('svg optimizer: smaller output', async (page) => {
  await page.goto(BASE + '/svg-optimizer')
  const svg = `<?xml version="1.0"?><!-- a comment --><svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><metadata>junk junk junk junk</metadata><rect x="10.000000" y="10.000000" width="80.000000" height="80.000000" fill="#ff0000"/></svg>`
  await upload(page, buf('a.svg', 'image/svg+xml', Buffer.from(svg)))
  await page.getByText('Saved').first().waitFor()
  await page.getByRole('button', { name: 'Download' }).waitFor({ timeout: 20000 })
  const d = await download(page, () => page.getByRole('button', { name: 'Download' }).click())
  assert(d.data.length < svg.length, `${d.data.length} < ${svg.length}`)
  assert(/<(rect|path)/.test(d.data.toString()), 'shape kept (SVGO may rewrite rect as path)')
})

await test('image metadata viewer', async (page) => {
  await page.goto(BASE + '/image-metadata-viewer')
  const jpg = await makeImage(page, { w: 640, h: 480, type: 'image/jpeg' })
  await upload(page, buf('m.jpg', 'image/jpeg', jpg))
  await page.getByText('640 × 480 px').waitFor({ timeout: 15000 })
  await page.getByText('Dominant colors', { exact: true }).waitFor()
  await page.getByText('4:3').waitFor()
})

await test('upload validation rejects a renamed file', async (page) => {
  await page.goto(BASE + '/png-to-jpg')
  await upload(page, buf('fake.png', 'image/png', Buffer.from('this is not an image at all')))
  await page.getByText(/contents do not match|Not a supported file/).first().waitFor()
})

// ───────────── PDF tools ─────────────
await test('pdf merger: 2 + 3 pages = 5', async (page) => {
  await page.goto(BASE + '/pdf-merger')
  await upload(page, [buf('a.pdf', 'application/pdf', await makePdf(2, 'A')), buf('b.pdf', 'application/pdf', await makePdf(3, 'B'))])
  await page.getByText('3 pages').waitFor({ timeout: 15000 })
  await page.getByRole('button', { name: /Merge 2 PDFs/ }).click()
  const d = await download(page, () => page.getByRole('button', { name: /Download merged.pdf/ }).click())
  assert(magic(d.data) === 'pdf', 'is pdf')
  const doc = await PDFDocument.load(d.data)
  assert(doc.getPageCount() === 5, `pages ${doc.getPageCount()}`)
})

await test('pdf splitter: ranges to zip', async (page) => {
  await page.goto(BASE + '/pdf-splitter')
  await upload(page, buf('s.pdf', 'application/pdf', await makePdf(6, 'S')))
  await page.getByLabel('Pages to extract').fill('1-2, 5')
  await page.getByRole('button', { name: 'Split PDF' }).click()
  await page.getByText('2 files ready').waitFor({ timeout: 20000 })
  const d = await download(page, () => page.getByRole('button', { name: 'Download ZIP' }).click())
  assert(magic(d.data) === 'zip', 'zip')
  const JSZip = (await import('jszip')).default
  const zip = await JSZip.loadAsync(d.data)
  const names = Object.keys(zip.files).sort()
  assert(names.length === 2, names.join())
  const first = await PDFDocument.load(await zip.files[names[0]].async('uint8array'))
  const second = await PDFDocument.load(await zip.files[names[1]].async('uint8array'))
  assert([first.getPageCount(), second.getPageCount()].sort().join() === '1,2', 'page counts 2 and 1')
})

await test('pdf splitter: invalid range message', async (page) => {
  await page.goto(BASE + '/pdf-splitter')
  await upload(page, buf('s.pdf', 'application/pdf', await makePdf(3, 'S')))
  await page.getByLabel('Pages to extract').fill('9')
  await page.getByText(/outside this document/).waitFor()
})

await test('pdf page remover', async (page) => {
  await page.goto(BASE + '/pdf-page-remover')
  await upload(page, buf('p.pdf', 'application/pdf', await makePdf(4, 'P')))
  await page.getByRole('button', { name: /^Page 2$/ }).click()
  await page.getByRole('button', { name: /^Page 3$/ }).click()
  const d = await download(page, () => page.getByRole('button', { name: /Download edited PDF/ }).click())
  assert((await PDFDocument.load(d.data)).getPageCount() === 2, 'two pages remain')
})

await test('pdf page rotator', async (page) => {
  await page.goto(BASE + '/pdf-page-rotator')
  await upload(page, buf('r.pdf', 'application/pdf', await makePdf(2, 'R')))
  await page.getByRole('button', { name: 'Rotate page 1 right' }).click()
  const d = await download(page, () => page.getByRole('button', { name: /Download rotated PDF/ }).click())
  const doc = await PDFDocument.load(d.data)
  assert(doc.getPage(0).getRotation().angle === 90, 'page 1 rotated 90')
  assert(doc.getPage(1).getRotation().angle === 0, 'page 2 unchanged')
})

await test('pdf to images: png zip', async (page) => {
  await page.goto(BASE + '/pdf-to-images')
  await upload(page, buf('i.pdf', 'application/pdf', await makePdf(3, 'I')))
  await page.getByRole('button', { name: /Convert 3 pages/ }).click()
  await page.getByText('3 images').waitFor({ timeout: 30000 })
  const d = await download(page, () => page.getByRole('button', { name: 'Download ZIP' }).click())
  const JSZip = (await import('jszip')).default
  const zip = await JSZip.loadAsync(d.data)
  const names = Object.keys(zip.files)
  assert(names.length === 3, `${names.length} images`)
  const first = await zip.files[names[0]].async('uint8array')
  assert(magic(Buffer.from(first)) === 'png', 'png')
})

await test('images to pdf', async (page) => {
  await page.goto(BASE + '/images-to-pdf')
  const a = await makeImage(page, { w: 300, h: 200, type: 'image/jpeg' })
  const b = await makeImage(page, { w: 200, h: 300, type: 'image/png' })
  const c = await makeImage(page, { w: 200, h: 200, type: 'image/webp' })
  await upload(page, [buf('a.jpg', 'image/jpeg', a), buf('b.png', 'image/png', b), buf('c.webp', 'image/webp', c)])
  await page.getByRole('button', { name: 'Create PDF' }).click()
  const d = await download(page, () => page.getByRole('button', { name: /Download images.pdf/ }).click())
  const doc = await PDFDocument.load(d.data)
  assert(doc.getPageCount() === 3, 'three pages')
  const [w0, h0] = [doc.getPage(0).getWidth(), doc.getPage(0).getHeight()]
  assert(w0 > h0, 'landscape page for landscape image (auto orientation)')
})

await test('pdf metadata viewer', async (page) => {
  await page.goto(BASE + '/pdf-metadata-viewer')
  const doc = await PDFDocument.create()
  doc.setTitle('Quarterly Report')
  doc.setAuthor('Ada Lovelace')
  doc.addPage([595, 842])
  doc.addPage([595, 842])
  await upload(page, buf('meta.pdf', 'application/pdf', Buffer.from(await doc.save())))
  await page.getByText('Quarterly Report').waitFor({ timeout: 15000 })
  await page.getByText('Ada Lovelace').waitFor()
  await page.getByText('210 × 297 mm').waitFor()
})

await test('pdf compressor: rasterize shrinks a heavy page', async (page) => {
  await page.goto(BASE + '/pdf-compressor')
  // A PDF with a big uncompressed-ish image embedded: noise PNG.
  const noise = await page.evaluate(async () => {
    const c = document.createElement('canvas')
    c.width = 1200
    c.height = 900
    const ctx = c.getContext('2d')
    const g = ctx.createLinearGradient(0, 0, 1200, 900)
    g.addColorStop(0, '#222')
    g.addColorStop(1, '#eee')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 1200, 900)
    const img = ctx.getImageData(0, 0, 1200, 900)
    for (let i = 0; i < img.data.length; i += 4) {
      const n = (Math.random() * 40) | 0
      img.data[i] = Math.min(255, img.data[i] + n)
      img.data[i + 1] = Math.min(255, img.data[i + 1] + n)
      img.data[i + 2] = Math.min(255, img.data[i + 2] + n)
    }
    ctx.putImageData(img, 0, 0)
    const blob = await new Promise((r) => c.toBlob(r, 'image/png'))
    const buf = new Uint8Array(await blob.arrayBuffer())
    let s = ''
    for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000))
    return btoa(s)
  })
  const doc = await PDFDocument.create()
  const img = await doc.embedPng(Buffer.from(noise, 'base64'))
  const p = doc.addPage([600, 450])
  p.drawImage(img, { x: 0, y: 0, width: 600, height: 450 })
  const src = Buffer.from(await doc.save())
  await upload(page, buf('heavy.pdf', 'application/pdf', src))
  await page.getByRole('radio', { name: 'Rasterize pages' }).click()
  await page.getByRole('button', { name: 'Compress PDF' }).click()
  await page.getByRole('button', { name: /Download compressed PDF/ }).waitFor({ timeout: 60000 })
  const d = await download(page, () => page.getByRole('button', { name: /Download compressed PDF/ }).click())
  assert(d.data.length < src.length, `${d.data.length} < ${src.length}`)
  assert((await PDFDocument.load(d.data)).getPageCount() === 1, 'one page')
})

await test('pdf compressor: lossless reports honestly', async (page) => {
  await page.goto(BASE + '/pdf-compressor')
  await upload(page, buf('x.pdf', 'application/pdf', await makePdf(1, 'X')))
  await page.getByRole('button', { name: 'Compress PDF' }).click()
  await page.getByText('Before', { exact: true }).waitFor({ timeout: 20000 })
})

// ───────────── Text & developer ─────────────
await test('word counter', async (page) => {
  await page.goto(BASE + '/word-counter')
  await page.getByLabel('Your text').fill('Hello world. This is a test!\n\nSecond paragraph here.')
  const stat = (label) => page.locator('p', { hasText: new RegExp(`^${label}$`) }).locator('xpath=following-sibling::p[1]').first()
  assert((await stat('Words').innerText()) === '9', 'words')
  assert((await stat('Sentences').innerText()) === '3', 'sentences')
  assert((await stat('Paragraphs').innerText()) === '2', 'paragraphs')
})

await test('case converter', async (page) => {
  await page.goto(BASE + '/case-converter')
  await page.getByLabel('Your text').fill('hello big world')
  await page.getByRole('radio', { name: 'camelCase' }).click()
  assert((await page.getByLabel('Result').inputValue()) === 'helloBigWorld', 'camel')
  await page.getByRole('radio', { name: 'snake_case' }).click()
  assert((await page.getByLabel('Result').inputValue()) === 'hello_big_world', 'snake')
})

await test('remove duplicate lines', async (page) => {
  await page.goto(BASE + '/remove-duplicate-lines')
  await page.getByLabel('Input, one item per line').fill('a\nb\na\nc\nb')
  assert((await page.getByLabel('Unique lines').inputValue()) === 'a\nb\nc', 'unique in order')
})

await test('text diff', async (page) => {
  await page.goto(BASE + '/text-diff-checker')
  await page.getByLabel('Original').fill('one\ntwo\nthree')
  await page.getByLabel('Changed').fill('one\n2\nthree\nfour')
  await page.getByText(/1 added/).waitFor()
  await page.getByText(/1 changed/).waitFor()
})

await test('lorem ipsum and text reverser', async (page) => {
  await page.goto(BASE + '/lorem-ipsum-generator')
  await page.getByRole('radio', { name: 'Words' }).click()
  await page.getByLabel('Amount').fill('7')
  const text = await page.getByLabel('Generated text').innerText()
  assert(text.trim().split(/\s+/).length === 7, `7 words, got "${text}"`)
  await page.goto(BASE + '/text-reverser')
  await page.getByLabel('Your text').fill('abc 👨‍👩‍👧')
  assert((await page.getByLabel('Reversed').inputValue()) === '👨‍👩‍👧 cba', 'grapheme-safe reverse')
})

await test('json formatter: format, minify and error position', async (page) => {
  await page.goto(BASE + '/json-formatter')
  await page.getByLabel('JSON', { exact: true }).fill('{"b":1,"a":[1,2]}')
  await page.getByText('Valid JSON').waitFor()
  assert((await page.getByLabel('Output').inputValue()).includes('\n  "b": 1'), 'formatted')
  await page.getByRole('radio', { name: 'Minify' }).click()
  assert((await page.getByLabel('Output').inputValue()) === '{"b":1,"a":[1,2]}', 'minified')
  await page.getByLabel('JSON', { exact: true }).fill('{\n  "a": 1,\n  "b": ,\n}')
  await page.getByText(/Invalid JSON at line 3/).waitFor()
})

await test('json to csv', async (page) => {
  await page.goto(BASE + '/json-to-csv')
  await page.getByLabel('JSON array of objects').fill('[{"id":1,"name":"Ada, L","meta":{"x":2}},{"id":2,"name":"Bob"}]')
  const csv = await page.getByLabel('CSV', { exact: true }).inputValue()
  assert(csv.split(/\r?\n/)[0] === 'id,name,meta.x', `header ${csv}`)
  assert(csv.includes('"Ada, L"'), 'quoted comma')
})

await test('base64, url, html entity', async (page) => {
  await page.goto(BASE + '/base64-encoder-decoder')
  await page.getByLabel('Text', { exact: true }).fill('Héllo ✓')
  assert((await page.getByLabel('Base64', { exact: true }).inputValue()) === 'SMOpbGxvIOKckw==', 'b64 encode')
  await page.goto(BASE + '/url-encoder-decoder')
  await page.getByLabel('Input').fill('a b&c=d/é')
  assert((await page.getByLabel('Result').inputValue()) === 'a%20b%26c%3Dd%2F%C3%A9', 'url encode')
  await page.goto(BASE + '/html-entity-encoder-decoder')
  await page.getByLabel('Input').fill('<a href="x">T&C</a>')
  assert((await page.getByLabel('Result').inputValue()) === '&lt;a href=&quot;x&quot;&gt;T&amp;C&lt;/a&gt;', 'html encode')
})

await test('uuid generator', async (page) => {
  await page.goto(BASE + '/uuid-generator')
  await page.getByText('5 UUIDs (version 4)').waitFor()
  const first = await page.locator('code').first().innerText()
  assert(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(first), `v4 format ${first}`)
})

await test('hash generator: known SHA-256', async (page) => {
  await page.goto(BASE + '/hash-generator')
  await page.getByLabel('Text to hash').fill('abc')
  await page.getByText('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad').waitFor()
  await page.getByText('a9993e364706816aba3e25717850c26c9cd0d89d').waitFor()
})

await test('css minifier', async (page) => {
  await page.goto(BASE + '/css-minifier')
  await page.getByLabel('CSS', { exact: true }).fill('/* c */\n.a { color: red ; margin: 0 auto; }\n.b > .c { content: "a  b"; }')
  assert((await page.getByLabel('Minified').inputValue()) === '.a{color:red;margin:0 auto}.b>.c{content:"a  b"}', 'minified')
})

await test('jwt decoder', async (page) => {
  await page.goto(BASE + '/jwt-decoder')
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
  const token = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: '42', exp: 1700000000 })}.sig`
  await page.getByRole('textbox', { name: 'JWT' }).fill(token)
  await page.getByText('Expired', { exact: true }).waitFor()
  await page.getByText('"sub": "42"').waitFor()
  await page.getByText('Decoding is not verifying').waitFor()
})

await test('color converter', async (page) => {
  await page.goto(BASE + '/color-converter')
  await page.getByLabel('HEX value').fill('#ff8800')
  assert((await page.getByLabel('R', { exact: true }).inputValue()) === '255', 'r')
  assert((await page.getByLabel('G', { exact: true }).inputValue()) === '136', 'g')
  assert((await page.getByLabel('H (0–360)').inputValue()) === '32', 'h')
})

// ───────────── SEO pages ─────────────
await test('seo: head tags and json-ld on a tool page', async (page) => {
  await page.goto(BASE + '/pdf-merger')
  await page.waitForSelector('h1')
  assert((await page.title()).includes('PDF Merger'), 'title')
  assert((await page.locator('link[rel=canonical]').count()) === 1, 'exactly one canonical')
  assert((await page.locator('meta[name=description]').count()) === 1, 'exactly one description')
  const ld = await page.locator('script[type="application/ld+json"]').allTextContents()
  const types = ld.map((t) => JSON.parse(t)['@type'])
  assert(types.includes('BreadcrumbList') && types.includes('SoftwareApplication') && types.includes('FAQPage'), `json-ld ${types}`)
})

// ───────────── Background remover (downloads a model) ─────────────
if (process.env.RUN_MODEL !== '0') {
  await test('background remover: real model inference', async (page) => {
    const requests = []
    page.on('request', (r) => requests.push(r.url()))
    await page.goto(BASE + '/background-remover')
    // A simple subject: red disc on a green field.
    const png = await page.evaluate(async () => {
      const c = document.createElement('canvas')
      c.width = 512
      c.height = 512
      const ctx = c.getContext('2d')
      ctx.fillStyle = '#2e8b57'
      ctx.fillRect(0, 0, 512, 512)
      // A person-like silhouette: head and shoulders.
      ctx.fillStyle = '#e0ac84'
      ctx.beginPath()
      ctx.arc(256, 190, 80, 0, 7)
      ctx.fill()
      ctx.fillStyle = '#243b8f'
      ctx.beginPath()
      ctx.ellipse(256, 470, 170, 150, 0, 0, 7)
      ctx.fill()
      const blob = await new Promise((r) => c.toBlob(r, 'image/png'))
      const buf = new Uint8Array(await blob.arrayBuffer())
      let s = ''
      for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000))
      return btoa(s)
    })
    await upload(page, buf('subject.png', 'image/png', Buffer.from(png, 'base64')))
    await page.getByText(/Downloading model|Preparing the model/).first().waitFor({ timeout: 30000 })
    await page.getByRole('button', { name: /Download PNG/ }).waitFor({ timeout: 240000 })
    const d = await download(page, () => page.getByRole('button', { name: /Download PNG/ }).click())
    assert(magic(d.data) === 'png', 'png output')
    const alpha = await page.evaluate(async (b64) => {
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
      const bmp = await createImageBitmap(new Blob([bytes], { type: 'image/png' }))
      const c = document.createElement('canvas')
      c.width = bmp.width
      c.height = bmp.height
      const ctx = c.getContext('2d')
      ctx.drawImage(bmp, 0, 0)
      const data = ctx.getImageData(0, 0, bmp.width, bmp.height).data
      let transparent = 0
      let opaque = 0
      for (let i = 3; i < data.length; i += 4) {
        if (data[i] < 20) transparent++
        else if (data[i] > 235) opaque++
      }
      return { transparent: transparent / (data.length / 4), opaque: opaque / (data.length / 4) }
    }, d.data.toString('base64'))
    assert(alpha.transparent > 0.05 && alpha.opaque > 0.05, `mask has both foreground and background: ${JSON.stringify(alpha)}`)
    const external = requests.filter((u) => !u.startsWith(BASE) && !u.startsWith('data:') && !u.startsWith('blob:'))
    const hosts = [...new Set(external.map((u) => new URL(u).host))]
    console.log(`       external hosts contacted: ${hosts.join(', ') || 'none'}`)
    assert(hosts.every((h) => h.endsWith('huggingface.co') || h.endsWith('hf.co')), `only the model host is contacted, got ${hosts}`)
    assert(!external.some((u) => /jsdelivr|unpkg|cdnjs/.test(u)), 'no CDN for runtime files')
  })
}

await browser.close()

const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
const realErrors = errors.filter((e) => !/favicon|Failed to load resource.*(404)/.test(e))
if (realErrors.length) {
  console.log(`\nBrowser errors (${realErrors.length}):`)
  for (const e of [...new Set(realErrors)].slice(0, 15)) console.log('  ' + e)
}
process.exit(failed.length ? 1 : 0)
