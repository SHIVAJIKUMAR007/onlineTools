import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CornerDownLeft, Search, SearchX } from 'lucide-react'
import { Icon } from '@/components/Icon'
import { categoryById } from '@/data/categories'
import { popularTools, toolPath, type ToolMeta } from '@/data/tools'
import { searchTools } from '@/lib/search'
import { useApp } from '@/lib/store'
import { cn } from '@/lib/utils/cn'

/** Command-palette style search. Opens with Ctrl+K / Cmd+K from anywhere. */
export function SearchPalette() {
  const open = useApp((s) => s.searchOpen)
  const setOpen = useApp((s) => s.setSearchOpen)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen(!useApp.getState().searchOpen)
      } else if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setOpen])

  if (!open) return null
  return <PaletteDialog onClose={() => setOpen(false)} />
}

function PaletteDialog({ onClose }: { onClose: () => void }) {
  const [q, setQ] = useState('')
  const [active, setActive] = useState(0)
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const results: ToolMeta[] = useMemo(() => (q.trim() ? searchTools(q).slice(0, 8).map((h) => h.tool) : popularTools()), [q])

  useEffect(() => {
    inputRef.current?.focus()
    const prev = document.activeElement as HTMLElement | null
    const scroll = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = scroll
      prev?.focus?.()
    }
  }, [])

  useEffect(() => setActive(0), [q])
  useEffect(() => {
    listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView?.({ block: 'nearest' })
  }, [active])

  const go = (t: ToolMeta) => {
    onClose()
    navigate(toolPath(t))
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => Math.min(results.length - 1, a + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(0, a - 1))
    } else if (e.key === 'Enter' && results[active]) {
      e.preventDefault()
      go(results[active])
    } else if (e.key === 'Tab') {
      // Keep focus inside the dialog.
      e.preventDefault()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-ink/40 px-4 pt-[12vh] backdrop-blur-[2px]" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label="Search tools" className="w-full max-w-xl overflow-hidden rounded-2xl border border-line bg-paper shadow-lift" onKeyDown={onKeyDown}>
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Search className="size-4 text-muted" aria-hidden />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            role="combobox"
            aria-expanded="true"
            aria-controls="search-results"
            aria-activedescendant={results[active] ? `sr-${results[active].id}` : undefined}
            aria-label="Search tools"
            placeholder="Search tools, for example “compress” or “pdf”"
            className="h-14 flex-1 bg-transparent text-base outline-none placeholder:text-muted/70"
            autoComplete="off"
            spellCheck={false}
          />
          <kbd className="rounded border border-line px-1.5 py-0.5 text-xs text-muted">Esc</kbd>
        </div>
        <ul id="search-results" ref={listRef} role="listbox" aria-label={q.trim() ? 'Search results' : 'Popular tools'} className="max-h-[50vh] overflow-auto p-2">
          {!q.trim() && <li role="presentation" className="px-3 pb-1 pt-2 text-xs font-medium text-muted">Popular tools</li>}
          {results.map((t, i) => (
            <li key={t.id} id={`sr-${t.id}`} role="option" aria-selected={i === active} onMouseEnter={() => setActive(i)} onClick={() => go(t)}
              className={cn('flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5', i === active && 'bg-accent-tint')}>
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface text-accent"><Icon name={t.icon} className="size-4" /></span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{t.name}</span>
                <span className="block truncate text-xs text-muted">{t.description}</span>
              </span>
              <span className="hidden text-xs text-muted sm:block">{categoryById(t.category).navName}</span>
              {i === active && <CornerDownLeft className="size-3.5 text-muted" aria-hidden />}
            </li>
          ))}
          {q.trim() && results.length === 0 && (
            <li role="presentation" className="flex flex-col items-center gap-2 px-4 py-10 text-center">
              <SearchX className="size-6 text-muted" aria-hidden />
              <p className="text-sm font-medium">No tools match “{q}”</p>
              <p className="text-xs text-muted">Try a file type like “png”, or an action like “merge” or “format”.</p>
            </li>
          )}
        </ul>
      </div>
    </div>
  )
}
