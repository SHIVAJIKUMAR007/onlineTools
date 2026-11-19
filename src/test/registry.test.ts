import { describe, expect, it } from 'vitest'
import { categories, categoryById } from '@/data/categories'
import { popularOrder, popularTools, relatedTools, toolById, toolBySlug, toolPath, tools, toolsInCategory } from '@/data/tools'
import { docPages } from '@/data/pages'
import { implementedToolIds, toolComponent } from '@/tools/registry'
import { searchTools } from '@/lib/search'
import { allPublicPaths, seoForPath } from '@/lib/seo'

describe('tool registry', () => {
  it('has at least 30 tools', () => {
    expect(tools.length).toBeGreaterThanOrEqual(30)
  })
  it('has unique ids and slugs, and routes that match the slug', () => {
    expect(new Set(tools.map((t) => t.id)).size).toBe(tools.length)
    expect(new Set(tools.map((t) => t.slug)).size).toBe(tools.length)
    for (const t of tools) expect(toolPath(t)).toBe(`/${t.slug}`)
  })
  it('does not collide with static routes', () => {
    const reserved = new Set(['tools', 'about', 'privacy', 'terms', ...categories.map((c) => c.slug)])
    for (const t of tools) expect(reserved.has(t.slug)).toBe(false)
  })
  it('implements a component for every tool and nothing extra', () => {
    expect(implementedToolIds.sort()).toEqual(tools.map((t) => t.id).sort())
    for (const t of tools) expect(toolComponent(t.id)).not.toBeNull()
  })
  it('has complete content for every tool', () => {
    for (const t of tools) {
      expect(t.name.length, t.id).toBeGreaterThan(2)
      expect(t.description.length, t.id).toBeGreaterThan(20)
      expect(t.intro.length, t.id).toBeGreaterThan(60)
      expect(t.steps.length, t.id).toBeGreaterThanOrEqual(3)
      expect(t.features.length, t.id).toBeGreaterThanOrEqual(3)
      expect(t.faqs.length, t.id).toBeGreaterThanOrEqual(2)
      expect(t.keywords.length, t.id).toBeGreaterThan(1)
      expect(categoryById(t.category), t.id).toBeDefined()
      if (t.kind === 'file') expect(t.accept!.length, t.id).toBeGreaterThan(0)
    }
  })
  it('only references related tools that exist, never itself', () => {
    for (const t of tools) {
      expect(t.related.length, t.id).toBeGreaterThanOrEqual(3)
      for (const r of t.related) {
        expect(toolById(r), `${t.id} -> ${r}`).toBeDefined()
        expect(r).not.toBe(t.id)
      }
      expect(relatedTools(t)).toHaveLength(t.related.length)
    }
  })
  it('lists every category with tools and covers each tool in some category', () => {
    for (const c of categories) expect(toolsInCategory(c.id).length, c.id).toBeGreaterThan(0)
    for (const t of tools) expect(categories.some((c) => toolsInCategory(c.id).includes(t)), t.id).toBe(true)
  })
  it('shows the requested popular tools on the homepage, in order', () => {
    expect(popularTools().map((t) => t.id)).toEqual(popularOrder)
    expect(popularOrder).toHaveLength(8)
  })
  it('requires the tools named in the brief', () => {
    for (const slug of ['image-compressor', 'image-resizer', 'png-to-jpg', 'png-to-webp', 'background-remover', 'pdf-merger', 'json-formatter', 'pdf-compressor', 'jwt-decoder', 'hash-generator']) {
      expect(toolBySlug(slug), slug).toBeDefined()
    }
  })
})

describe('search', () => {
  const top = (q: string) => searchTools(q).map((h) => h.tool.id)
  it('finds by name, keyword, description and category', () => {
    expect(top('compress')[0]).toBe('image-compressor')
    expect(top('merge pdf')[0]).toBe('pdf-merger')
    expect(top('exif')).toContain('image-metadata-viewer')
    expect(top('iphone')).toContain('heic-to-jpg')
    expect(top('developer').length).toBeGreaterThan(5)
  })
  it('requires every word to match', () => {
    expect(top('pdf zebra')).toEqual([])
  })
  it('returns nothing for empty queries and ignores case and accents', () => {
    expect(searchTools('')).toEqual([])
    expect(top('JSON')[0]).toBe('json-formatter')
    expect(top('cömpress')).toContain('image-compressor')
  })
  it('tolerates a missing letter', () => {
    expect(top('pdf mrger')).toContain('pdf-merger')
  })
})

describe('SEO', () => {
  const site = 'https://example.test'
  it('covers every public route and none is null', () => {
    const paths = allPublicPaths()
    expect(paths).toHaveLength(2 + categories.length + tools.length + docPages.length)
    for (const p of paths) expect(seoForPath(p, site), p).not.toBeNull()
    expect(seoForPath('/does-not-exist', site)).toBeNull()
  })
  it('has unique titles and descriptions of sensible length', () => {
    const titles = new Set<string>()
    const descriptions = new Set<string>()
    for (const p of allPublicPaths()) {
      const s = seoForPath(p, site)!
      expect(s.title.length, p).toBeGreaterThan(15)
      expect(s.title.length, `${p} title length`).toBeLessThanOrEqual(75)
      expect(s.description.length, p).toBeGreaterThan(50)
      expect(s.description.length, `${p} description`).toBeLessThanOrEqual(200)
      expect(titles.has(s.title), `duplicate title: ${s.title}`).toBe(false)
      expect(descriptions.has(s.description), `duplicate description at ${p}`).toBe(false)
      titles.add(s.title)
      descriptions.add(s.description)
    }
  })
  it('uses absolute canonical URLs without trailing slashes', () => {
    expect(seoForPath('/pdf-merger', site)!.canonical).toBe('https://example.test/pdf-merger')
    expect(seoForPath('/pdf-merger/', site)!.canonical).toBe('https://example.test/pdf-merger')
    expect(seoForPath('/', site)!.canonical).toBe('https://example.test/')
  })
  it('emits breadcrumbs, software and FAQ schema for tools', () => {
    const types = seoForPath('/image-resizer', site)!.jsonLd.map((j) => j['@type'])
    expect(types).toEqual(['BreadcrumbList', 'SoftwareApplication', 'FAQPage'])
  })
  it('emits WebSite schema with a search action on the home page', () => {
    const ld = seoForPath('/', site)!.jsonLd
    expect(ld[0]).toMatchObject({ '@type': 'WebSite' })
    expect(JSON.stringify(ld[0])).toContain('/tools?q={search_term_string}')
  })
  it('only marks up FAQ content that is visible in the page body', () => {
    for (const t of tools) {
      const s = seoForPath(`/${t.slug}`, site)!
      const faq = s.jsonLd.find((j) => j['@type'] === 'FAQPage') as { mainEntity: { name: string }[] }
      for (const q of faq.mainEntity) expect(s.bodyHtml, t.id).toContain(q.name.replace(/&/g, '&amp;'))
    }
  })
  it('escapes HTML in static content and has a single h1', () => {
    for (const p of allPublicPaths()) {
      const body = seoForPath(p, site)!.bodyHtml
      expect(body.match(/<h1[ >]/g), p).toHaveLength(1)
      expect(body).not.toMatch(/<script/i)
    }
  })
  it('links to related tools that exist', () => {
    const body = seoForPath('/pdf-merger', site)!.bodyHtml
    for (const m of body.matchAll(/href="(\/[a-z0-9-]+)"/g)) expect(allPublicPaths()).toContain(m[1])
  })
  it('privacy page names the model host', () => {
    expect(seoForPath('/privacy', site)!.bodyHtml).toContain('huggingface.co')
  })
})
