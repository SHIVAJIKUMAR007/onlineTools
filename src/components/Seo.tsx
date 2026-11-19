import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { seoForPath } from '@/lib/seo'

export const siteUrl = (import.meta.env.VITE_SITE_URL as string | undefined)?.replace(/\/$/, '') || window.location.origin

function setMeta(selector: string, create: () => HTMLElement, attr: string, value: string) {
  let el = document.head.querySelector<HTMLElement>(selector)
  if (!el) {
    el = create()
    document.head.appendChild(el)
  }
  el.setAttribute(attr, value)
}

const meta = (key: 'name' | 'property', name: string, content: string) =>
  setMeta(
    `meta[${key}="${name}"]`,
    () => {
      const m = document.createElement('meta')
      m.setAttribute(key, name)
      return m
    },
    'content',
    content,
  )

/**
 * Keeps <head> in sync with the current route. Tags already present from the
 * prerendered HTML are updated in place instead of duplicated.
 */
export function Seo() {
  const { pathname } = useLocation()
  useEffect(() => {
    const seo = seoForPath(pathname, siteUrl)
    // Routes without SEO data are the 404 page: keep them out of search results.
    const notFound = !seo
    const title = seo?.title ?? 'Page not found | Stayput'
    const description = seo?.description ?? 'This page does not exist. Browse all tools on Stayput.'
    const canonical = seo?.canonical ?? `${siteUrl}${pathname}`
    document.title = title
    meta('name', 'description', description)
    meta('name', 'robots', notFound ? 'noindex' : 'index, follow')
    meta('property', 'og:title', title)
    meta('property', 'og:description', description)
    meta('property', 'og:type', seo?.ogType ?? 'website')
    meta('property', 'og:url', canonical)
    meta('property', 'og:site_name', 'Stayput')
    meta('property', 'og:image', `${siteUrl}/og.png`)
    meta('property', 'og:image:width', '1200')
    meta('property', 'og:image:height', '630')
    meta('property', 'og:image:alt', 'Stayput: every tool you need, nothing uploaded')
    meta('name', 'twitter:card', 'summary_large_image')
    meta('name', 'twitter:image', `${siteUrl}/og.png`)
    meta('name', 'twitter:title', title)
    meta('name', 'twitter:description', description)
    setMeta(
      'link[rel="canonical"]',
      () => {
        const l = document.createElement('link')
        l.setAttribute('rel', 'canonical')
        return l
      },
      'href',
      canonical,
    )
    // Replace all JSON-LD blocks with the ones for this route.
    document.head.querySelectorAll('script[data-seo="ld"]').forEach((n) => n.remove())
    for (const block of seo?.jsonLd ?? []) {
      const s = document.createElement('script')
      s.type = 'application/ld+json'
      s.dataset.seo = 'ld'
      s.textContent = JSON.stringify(block)
      document.head.appendChild(s)
    }
  }, [pathname])
  return null
}
