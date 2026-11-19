import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { SearchX } from 'lucide-react'
import { Breadcrumbs } from '@/components/Content'
import { Icon } from '@/components/Icon'
import { ToolCard } from '@/components/tools/ToolCard'
import { Input } from '@/components/ui/fields'
import { categories, categoryBySlug } from '@/data/categories'
import { tools, toolsInCategory, type ToolMeta } from '@/data/tools'
import { searchTools } from '@/lib/search'
import { cn } from '@/lib/utils/cn'
import NotFound from './NotFound'

export function AllTools() {
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const cat = params.get('category') ?? 'all'
  const list: ToolMeta[] = useMemo(() => {
    const base = q.trim() ? searchTools(q).map((h) => h.tool) : tools
    return cat === 'all' ? base : base.filter((t) => t.category === cat || t.alsoIn?.includes(cat as never))
  }, [q, cat])

  const update = (next: Record<string, string>) => {
    const p = new URLSearchParams(params)
    for (const [k, v] of Object.entries(next)) {
      if (v && v !== 'all') p.set(k, v)
      else p.delete(k)
    }
    setParams(p, { replace: true })
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <Breadcrumbs items={[{ name: 'All tools' }]} />
      <h1 className="text-3xl font-semibold sm:text-4xl">All tools</h1>
      <p className="mt-2 max-w-2xl text-ink-2">{tools.length} tools for images, PDFs, text and code. Every one runs in your browser.</p>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Input
          type="search"
          aria-label="Filter tools"
          value={q}
          onChange={(e) => update({ q: e.target.value })}
          placeholder="Filter by name, keyword or file type"
          className="max-w-sm"
        />
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Category filter">
          {[{ id: 'all', name: 'All' }, ...categories.map((c) => ({ id: c.id, name: c.navName }))].map((c) => (
            <button
              key={c.id}
              type="button"
              aria-pressed={cat === c.id}
              onClick={() => update({ category: c.id })}
              className={cn('cursor-pointer rounded-full border px-3 py-1.5 text-sm transition-colors', cat === c.id ? 'border-accent bg-accent text-white' : 'border-line-strong text-ink-2 hover:border-accent hover:text-accent')}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>
      {list.length === 0 ? (
        <div className="mt-16 flex flex-col items-center gap-2 text-center">
          <SearchX className="size-8 text-muted" aria-hidden />
          <p className="font-medium">No tools match “{q}”</p>
          <p className="text-sm text-muted">Try a file type like “png” or an action like “merge”.</p>
          <button type="button" className="mt-2 cursor-pointer text-sm font-medium text-accent hover:underline" onClick={() => setParams({}, { replace: true })}>Clear filters</button>
        </div>
      ) : (
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" aria-live="polite">
          {list.map((t) => (
            <li key={t.id}><ToolCard tool={t} /></li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function CategoryPage({ slug }: { slug: string }) {
  const cat = categoryBySlug(slug)
  if (!cat) return <NotFound />
  const list = toolsInCategory(cat.id)
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <Breadcrumbs items={[{ name: cat.name }]} />
      <div className="flex items-center gap-4">
        <span className="flex size-12 items-center justify-center rounded-xl bg-accent text-white"><Icon name={cat.icon} className="size-6" /></span>
        <h1 className="text-3xl font-semibold sm:text-4xl">{cat.name}</h1>
      </div>
      <p className="mt-4 max-w-2xl text-ink-2">{cat.intro}</p>
      <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((t) => (
          <li key={t.id}><ToolCard tool={t} /></li>
        ))}
      </ul>
      <nav aria-label="Other categories" className="mt-14 border-t border-line pt-6">
        <p className="mb-3 text-sm font-medium">More categories</p>
        <ul className="flex flex-wrap gap-2">
          {categories.filter((c) => c.id !== cat.id).map((c) => (
            <li key={c.id}><Link to={`/${c.slug}`} className="rounded-full border border-line-strong px-3 py-1.5 text-sm text-ink-2 hover:border-accent hover:text-accent">{c.name}</Link></li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
