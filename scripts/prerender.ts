/**
 * Post-build step. Takes dist/index.html and writes one HTML file per public route
 * with that route's <title>, meta tags, canonical URL, Open Graph tags, JSON-LD and
 * a plain HTML copy of the page content for crawlers. It also writes sitemap.xml,
 * robots.txt and a 404.html.
 *
 * No server-side rendering of the React app happens here, so the browser-only
 * tools are untouched. React replaces the static HTML as soon as it loads.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { allPublicPaths, esc, seoForPath } from '../src/lib/seo.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dist = join(root, 'dist')
const siteUrl = (process.env.VITE_SITE_URL || 'https://stayput.example').replace(/\/$/, '')

const template = readFileSync(join(dist, 'index.html'), 'utf8')
if (!template.includes('<!--seo-head-->') || !template.includes('<!--seo-body-->')) {
  throw new Error('dist/index.html is missing the seo placeholders. Did the build change index.html?')
}

const jsonScript = (obj: unknown) => `<script type="application/ld+json" data-seo="ld">${JSON.stringify(obj).replace(/</g, '\\u003c')}</script>`

let count = 0
for (const path of allPublicPaths()) {
  const seo = seoForPath(path, siteUrl)
  if (!seo) throw new Error(`No SEO data for ${path}`)
  const head = [
    `<meta name="description" content="${esc(seo.description)}" />`,
    `<meta name="robots" content="index, follow" />`,
    `<link rel="canonical" href="${esc(seo.canonical)}" />`,
    `<meta property="og:title" content="${esc(seo.title)}" />`,
    `<meta property="og:description" content="${esc(seo.description)}" />`,
    `<meta property="og:type" content="${seo.ogType}" />`,
    `<meta property="og:url" content="${esc(seo.canonical)}" />`,
    `<meta property="og:site_name" content="Stayput" />`,
    `<meta property="og:image" content="${esc(seo.ogImage ?? `${siteUrl}/og.png`)}" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta property="og:image:alt" content="${esc(seo.ogImageAlt ?? 'Stayput: every tool you need, nothing uploaded')}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:image" content="${esc(seo.ogImage ?? `${siteUrl}/og.png`)}" />`,
    `<meta name="twitter:title" content="${esc(seo.title)}" />`,
    `<meta name="twitter:description" content="${esc(seo.description)}" />`,
    ...seo.jsonLd.map(jsonScript),
  ].join('\n    ')

  const html = template
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(seo.title)}</title>`)
    .replace('<!--seo-head-->', head)
    .replace('<!--seo-body-->', seo.bodyHtml)

  const out = path === '/' ? join(dist, 'index.html') : join(dist, path.slice(1), 'index.html')
  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(out, html)
  count++
}

// 404 page: the SPA shell with noindex. Static hosts serve it for unknown URLs.
writeFileSync(
  join(dist, '404.html'),
  template
    .replace(/<title>[\s\S]*?<\/title>/, '<title>Page not found | Stayput</title>')
    .replace('<!--seo-head-->', '<meta name="robots" content="noindex" />')
    .replace('<!--seo-body-->', '<main><h1>Page not found</h1><p><a href="/tools">Browse all tools</a></p></main>'),
)

const today = new Date().toISOString().slice(0, 10)
const priority = (p: string) => (p === '/' ? '1.0' : p === '/tools' ? '0.9' : p.endsWith('-tools') || p === '/converters' ? '0.8' : ['/about', '/privacy', '/terms', '/disclaimer', '/contact'].includes(p) ? '0.3' : '0.7')
writeFileSync(
  join(dist, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${allPublicPaths()
    .map((p) => `  <url><loc>${siteUrl}${p === '/' ? '/' : p}</loc><lastmod>${today}</lastmod><priority>${priority(p)}</priority></url>`)
    .join('\n')}\n</urlset>\n`,
)
writeFileSync(join(dist, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${siteUrl}/sitemap.xml\n`)

console.log(`Prerendered ${count} pages for ${siteUrl}, plus sitemap.xml, robots.txt and 404.html`)
