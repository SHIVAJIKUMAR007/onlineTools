import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search } from 'lucide-react'
import { Icon } from '@/components/Icon'
import { toolPath, type ToolMeta } from '@/data/tools'
import { searchTools } from '@/lib/search'
import { cn } from '@/lib/utils/cn'

export function HeroSearch() {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const navigate = useNavigate()
  const ref = useRef<HTMLDivElement>(null)
  const results: ToolMeta[] = useMemo(() => (q.trim() ? searchTools(q).slice(0, 6).map((h) => h.tool) : []), [q])
  const show = open && q.trim().length > 0

  const submit = () => {
    if (results[active]) navigate(toolPath(results[active]))
    else if (q.trim()) navigate(`/tools?q=${encodeURIComponent(q.trim())}`)
  }

  return (
    <div
      ref={ref}
      className="relative"
      onBlur={(e) => {
        if (!ref.current?.contains(e.relatedTarget as Node)) setOpen(false)
      }}
    >
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
        className="flex h-14 items-center gap-3 rounded-2xl border border-line-strong bg-paper px-4 shadow-soft transition-colors focus-within:border-accent focus-within:shadow-lift"
      >
        <Search className="size-5 text-muted" aria-hidden />
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            setActive(0)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setActive((a) => Math.min(results.length - 1, a + 1))
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setActive((a) => Math.max(0, a - 1))
            } else if (e.key === 'Escape') setOpen(false)
          }}
          role="combobox"
          aria-expanded={show}
          aria-controls="hero-results"
          aria-label="Search tools"
          aria-activedescendant={show && results[active] ? `hr-${results[active].id}` : undefined}
          placeholder="Search tools: compress image, merge pdf, format json…"
          className="h-full min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted/70"
          autoComplete="off"
          spellCheck={false}
        />
      </form>
      {show && (
        <ul id="hero-results" role="listbox" className="absolute left-0 right-0 top-full z-20 mt-2 overflow-hidden rounded-2xl border border-line bg-paper p-1.5 shadow-lift">
          {results.map((t, i) => (
            <li key={t.id} id={`hr-${t.id}`} role="option" aria-selected={i === active}>
              <button
                type="button"
                tabIndex={-1}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => navigate(toolPath(t))}
                className={cn('flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-left', i === active && 'bg-accent-tint')}
              >
                <Icon name={t.icon} className="size-4 shrink-0 text-accent" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{t.name}</span>
                  <span className="block truncate text-xs text-muted">{t.description}</span>
                </span>
              </button>
            </li>
          ))}
          {results.length === 0 && <li className="px-3 py-4 text-sm text-muted" role="presentation">No tools match “{q}”. Try “png”, “pdf” or “json”.</li>}
        </ul>
      )}
    </div>
  )
}
