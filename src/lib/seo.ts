/**
 * SEO data for every public route. Pure functions with no browser APIs, so the
 * same code builds <head> tags on the client and static HTML at build time.
 */
import { categories, categoryBySlug, type Category } from '../data/categories'
import { tools, toolBySlug, toolsInCategory, relatedTools, toolPath, type ToolMeta } from '../data/tools'
import { docPages, homeFaqs, SITE_NAME } from '../data/pages'

export interface PageSeo {
  path: string
  title: string
  description: string
  canonical: string
  ogType: 'website' | 'article'
  jsonLd: Record<string, unknown>[]
  /** Static HTML placed inside #root for crawlers. Replaced when React mounts. */
  bodyHtml: string
}

export const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const joinUrl = (siteUrl: string, path: string) => `${siteUrl.replace(/\/$/, '')}${path === '/' ? '/' : path}`

function breadcrumb(siteUrl: string, items: { name: string; path: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: joinUrl(siteUrl, it.path),
    })),
  }
}

const appCategory = (c: Category['id']) => {
  switch (c) {
    case 'developer':
      return 'DeveloperApplication'
    case 'text':
      return 'UtilitiesApplication'
    default:
      return 'MultimediaApplication'
  }
}

function toolBody(tool: ToolMeta): string {
  const related = relatedTools(tool)
  return `<main>
<nav aria-label="Breadcrumb"><a href="/">Home</a> / <a href="/tools">Tools</a> / ${esc(tool.name)}</nav>
<h1>${esc(tool.h1)}</h1>
<p>${esc(tool.intro)}</p>
<p>Your files never leave your device. All processing happens locally in your browser.</p>
<h2>How to use ${esc(tool.name)}</h2>
<ol>${tool.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>
<h2>Features</h2>
<ul>${tool.features.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>
<h2>${esc(tool.article.title)}</h2>
${tool.article.paragraphs.map((paragraph) => `<p>${esc(paragraph)}</p>`).join('')}
<h2>Frequently asked questions</h2>
${tool.faqs.map((f) => `<h3>${esc(f.q)}</h3><p>${esc(f.a)}</p>`).join('')}
<h2>Related tools</h2>
<ul>${related.map((r) => `<li><a href="${toolPath(r)}">${esc(r.name)}</a>: ${esc(r.description)}</li>`).join('')}</ul>
</main>`
}

export function seoForPath(rawPath: string, siteUrl: string): PageSeo | null {
  const path = rawPath.length > 1 ? rawPath.replace(/\/$/, '') : rawPath
  const canonical = joinUrl(siteUrl, path)

  if (path === '/') {
    return {
      path,
      title: `${SITE_NAME}: Free Online Tools, Nothing Uploaded`,
      description:
        'Free online tools for images, PDFs, text and developers. Compress, convert, merge and format files entirely in your browser. Your files stay on your device.',
      canonical,
      ogType: 'website',
      jsonLd: [
        {
          '@context': 'https://schema.org',
          '@type': 'WebSite',
          name: SITE_NAME,
          url: joinUrl(siteUrl, '/'),
          description: 'Free browser-based tools. Files never leave your device.',
          potentialAction: {
            '@type': 'SearchAction',
            target: { '@type': 'EntryPoint', urlTemplate: `${joinUrl(siteUrl, '/tools')}?q={search_term_string}` },
            'query-input': 'required name=search_term_string',
          },
        },
        {
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: homeFaqs.map((f) => ({
            '@type': 'Question',
            name: f.q,
            acceptedAnswer: { '@type': 'Answer', text: f.a },
          })),
        },
      ],
      bodyHtml: `<main><h1>Every tool you need. Nothing uploaded.</h1>
<p>Free, powerful online tools that run entirely in your browser. Your files stay on your device.</p>
<ul>${tools.map((t) => `<li><a href="${toolPath(t)}">${esc(t.name)}</a>: ${esc(t.description)}</li>`).join('')}</ul>
<h2>Frequently asked questions</h2>${homeFaqs.map((f) => `<h3>${esc(f.q)}</h3><p>${esc(f.a)}</p>`).join('')}</main>`,
    }
  }

  if (path === '/tools') {
    return {
      path,
      title: `All Tools: ${tools.length} Free Browser-Based Utilities | ${SITE_NAME}`,
      description: `Browse all ${tools.length} tools: image compressor, PDF merger, background remover, JSON formatter and more. Every tool runs locally in your browser.`,
      canonical,
      ogType: 'website',
      jsonLd: [
        breadcrumb(siteUrl, [{ name: 'Home', path: '/' }, { name: 'All tools', path: '/tools' }]),
        {
          '@context': 'https://schema.org',
          '@type': 'ItemList',
          itemListElement: tools.map((t, i) => ({ '@type': 'ListItem', position: i + 1, url: joinUrl(siteUrl, toolPath(t)), name: t.name })),
        },
      ],
      bodyHtml: `<main><h1>All tools</h1>${categories
        .map(
          (c) =>
            `<h2><a href="/${c.slug}">${esc(c.name)}</a></h2><ul>${toolsInCategory(c.id)
              .map((t) => `<li><a href="${toolPath(t)}">${esc(t.name)}</a>: ${esc(t.description)}</li>`)
              .join('')}</ul>`,
        )
        .join('')}</main>`,
    }
  }

  const cat = categoryBySlug(path.slice(1))
  if (cat) {
    return {
      path,
      title: cat.seoTitle,
      description: cat.seoDescription,
      canonical,
      ogType: 'website',
      jsonLd: [breadcrumb(siteUrl, [{ name: 'Home', path: '/' }, { name: cat.name, path }])],
      bodyHtml: `<main><h1>${esc(cat.name)}</h1><p>${esc(cat.intro)}</p><ul>${toolsInCategory(cat.id)
        .map((t) => `<li><a href="${toolPath(t)}">${esc(t.name)}</a>: ${esc(t.description)}</li>`)
        .join('')}</ul></main>`,
    }
  }

  const doc = docPages.find((d) => d.path === path)
  if (doc) {
    return {
      path,
      title: doc.seoTitle,
      description: doc.seoDescription,
      canonical,
      ogType: 'website',
      jsonLd: [breadcrumb(siteUrl, [{ name: 'Home', path: '/' }, { name: doc.title, path }])],
      bodyHtml: `<main><h1>${esc(doc.title)}</h1><p>${esc(doc.lead)}</p>${doc.sections
        .map(
          (s) =>
            `<h2>${esc(s.heading)}</h2>${(s.paragraphs ?? []).map((p) => `<p>${esc(p)}</p>`).join('')}${
              s.list ? `<ul>${s.list.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>` : ''
            }`,
        )
        .join('')}</main>`,
    }
  }

  const tool = toolBySlug(path.slice(1))
  if (tool) {
    const primary = categories.find((c) => c.id === tool.category)!
    return {
      path,
      title: `${tool.seoTitle} | ${SITE_NAME}`,
      description: tool.seoDescription,
      canonical,
      ogType: 'website',
      jsonLd: [
        breadcrumb(siteUrl, [
          { name: 'Home', path: '/' },
          { name: primary.name, path: `/${primary.slug}` },
          { name: tool.name, path },
        ]),
        {
          '@context': 'https://schema.org',
          '@type': 'SoftwareApplication',
          name: tool.name,
          description: tool.seoDescription,
          url: canonical,
          applicationCategory: appCategory(tool.category),
          operatingSystem: 'Any (web browser)',
          browserRequirements: 'Requires JavaScript and a modern browser',
          isAccessibleForFree: true,
          offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        },
        // The FAQ below is visible on the page, so the markup matches the content. Google no longer
        // shows FAQ rich results for most sites; the markup is kept because it is valid and harmless.
        {
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: tool.faqs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
        },
      ],
      bodyHtml: toolBody(tool),
    }
  }
  return null
}

/** Every indexable path, used for the sitemap and prerendering. */
export function allPublicPaths(): string[] {
  return ['/', '/tools', ...categories.map((c) => `/${c.slug}`), ...tools.map((t) => toolPath(t)), ...docPages.map((d) => d.path)]
}
