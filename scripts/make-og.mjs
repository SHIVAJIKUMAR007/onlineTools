// Renders public/og.png (1200x630) from a small HTML card. Run once: node scripts/make-og.mjs
import { chromium } from 'playwright-core'
const html = `<html><body style="margin:0;width:1200px;height:630px;background:#f6f6f3;font-family:'Segoe UI',Arial,sans-serif;position:relative;overflow:hidden">
<div style="position:absolute;left:80px;top:70px;display:flex;align-items:center;gap:16px">
<svg width="56" height="56" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#0b7a5e"/><path d="M9 17.2 14 22l9-12" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
<span style="font-size:40px;font-weight:600;color:#17181b;letter-spacing:-1px">Stayput</span></div>
<div style="position:absolute;left:80px;top:230px;width:900px;font-size:88px;line-height:1.02;font-weight:650;letter-spacing:-3px;color:#17181b">Every tool you need. Nothing uploaded.</div>
<div style="position:absolute;left:80px;top:500px;font-size:30px;color:#3c3e43">Free online tools that run entirely in your browser.</div>
<div style="position:absolute;right:0;bottom:0;width:260px;height:14px;background:#0b7a5e"></div>
</body></html>`
const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL ?? 'msedge' })
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } })
await page.setContent(html)
await page.screenshot({ path: 'public/og.png' })
await browser.close()
