import { Link } from 'react-router-dom'
import { ChevronRight, Plus } from 'lucide-react'
import type { Faq } from '@/data/tools'

export function Breadcrumbs({ items }: { items: { name: string; to?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-4 text-sm text-muted">
      <ol className="flex flex-wrap items-center gap-1">
        <li>
          <Link to="/" className="hover:text-accent">Home</Link>
        </li>
        {items.map((it, i) => (
          <li key={i} className="flex items-center gap-1">
            <ChevronRight className="size-3.5" aria-hidden />
            {it.to ? (
              <Link to={it.to} className="hover:text-accent">{it.name}</Link>
            ) : (
              <span aria-current="page" className="text-ink-2">{it.name}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}

export function FaqList({ faqs }: { faqs: Faq[] }) {
  return (
    <div className="divide-y divide-line rounded-2xl border border-line bg-paper">
      {faqs.map((f) => (
        <details key={f.q} className="group px-5 py-4">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[15px] font-medium [&::-webkit-details-marker]:hidden">
            {f.q}
            <Plus className="size-4 shrink-0 text-muted transition-transform group-open:rotate-45" aria-hidden />
          </summary>
          <p className="mt-2 max-w-prose text-sm leading-relaxed text-ink-2">{f.a}</p>
        </details>
      ))}
    </div>
  )
}
