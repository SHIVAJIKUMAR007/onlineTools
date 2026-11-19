// Extra model checks: CPU/WASM fallback and the large "Any subject" model.
import { chromium } from 'playwright-core'
const BASE = process.env.BASE_URL ?? 'http://localhost:4173'
const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL ?? 'msedge', headless: true })

async function subjectPng(page) {
  return page.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = 512; c.height = 512
    const ctx = c.getContext('2d'); ctx.fillStyle = '#2e8b57'; ctx.fillRect(0, 0, 512, 512)
    ctx.fillStyle = '#e0ac84'; ctx.beginPath(); ctx.arc(256, 190, 80, 0, 7); ctx.fill()
    ctx.fillStyle = '#243b8f'; ctx.beginPath(); ctx.ellipse(256, 470, 170, 150, 0, 0, 7); ctx.fill()
    const blob = await new Promise((r) => c.toBlob(r, 'image/png')); const buf = new Uint8Array(await blob.arrayBuffer())
    let s = ''; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000)); return btoa(s)
  })
}
async function run(label, { noGpu, model }) {
  const ctx = await browser.newContext({ acceptDownloads: true })
  if (noGpu) await ctx.addInitScript(() => Object.defineProperty(navigator, 'gpu', { value: undefined, configurable: true }))
  const page = await ctx.newPage()
  page.on('pageerror', (e) => console.log('  [pageerror]', e.message))
  await page.goto(BASE + '/background-remover'); await page.waitForSelector('h1')
  if (model) await page.getByRole('radio', { name: new RegExp(model) }).click()
  const png = await subjectPng(page)
  const t0 = Date.now()
  await page.locator('input[type=file]').first().setInputFiles({ name: 's.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') })
  try {
    await page.getByRole('button', { name: /Download PNG/ }).waitFor({ timeout: 280000 })
    const note = await page.getByText(/Processed on/).innerText()
    console.log(`  ok   ${label} (${Math.round((Date.now() - t0) / 1000)} s): ${note}`)
  } catch {
    const msg = await page.locator('[role=alert]').allInnerTexts()
    console.log(`  FAIL ${label}: ${msg.join(' | ').slice(0, 300)}`)
  }
  await ctx.close()
}
await run('MODNet on CPU (WebAssembly)', { noGpu: true })
await run('BiRefNet without WebGPU shows a clear message', { noGpu: true, model: 'Any subject' })
await run('BiRefNet Lite on WebGPU', { noGpu: false, model: 'Any subject' })
await browser.close()
