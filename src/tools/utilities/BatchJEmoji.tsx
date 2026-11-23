import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/misc'
import { Input } from '@/components/ui/fields'
import { Panel, CopyButton } from '@/components/tools/controls'
import { cn } from '@/lib/utils/cn'
import { copyText } from '@/lib/utils/download'
import { EMOJIS, EMOJI_CATEGORIES, searchEmojis, type EmojiItem } from '@/lib/emoji/emojiData'

const RECENT_KEY = 'stayput-emoji-recent'
const RECENT_MAX = 24

function loadRecent(): string[] {
  try {
    const raw = window.localStorage.getItem(RECENT_KEY)
    const v: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(0, RECENT_MAX) : []
  } catch {
    return []
  }
}

function saveRecent(list: string[]): boolean {
  try {
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(list))
    return true
  } catch {
    return false
  }
}

const byChar = new Map(EMOJIS.map((e) => [e.char, e]))

export function EmojiPicker() {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<string>('All')
  const [recent, setRecent] = useState<string[]>([])
  const [picked, setPicked] = useState<EmojiItem | null>(null)
  const [basket, setBasket] = useState('')
  const [status, setStatus] = useState('')
  const [saveFailed, setSaveFailed] = useState(false)

  useEffect(() => {
    setRecent(loadRecent())
  }, [])

  const results = useMemo(() => {
    const pool = category === 'All' ? EMOJIS : EMOJIS.filter((e) => e.category === category)
    return searchEmojis(query, pool)
  }, [query, category])

  const choose = async (e: EmojiItem) => {
    setPicked(e)
    setBasket((b) => b + e.char)
    const ok = await copyText(e.char)
    setStatus(ok ? `Copied ${e.char} (${e.name})` : `Could not copy ${e.char}. Select it from the box below instead.`)
    setRecent((r) => {
      const next = [e.char, ...r.filter((c) => c !== e.char)].slice(0, RECENT_MAX)
      setSaveFailed(!saveRecent(next))
      return next
    })
  }

  const clearRecent = () => {
    setRecent([])
    try {
      window.localStorage.removeItem(RECENT_KEY)
    } catch {
      /* ignore */
    }
  }

  const cell = (e: EmojiItem) => (
    <button
      key={e.char}
      type="button"
      onClick={() => void choose(e)}
      title={e.name}
      aria-label={`Copy ${e.name}`}
      className="flex size-11 cursor-pointer items-center justify-center rounded-lg text-2xl hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-accent"
    >
      {e.char}
    </button>
  )

  const recentItems = recent.map((c) => byChar.get(c)).filter((e): e is EmojiItem => !!e)

  return (
    <div className="grid gap-4">
      <Panel title="Find an emoji">
        <div className="grid gap-3">
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search, for example heart, fire or birthday" aria-label="Search emoji" />
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Category">
            {['All', ...EMOJI_CATEGORIES].map((c) => (
              <button
                key={c}
                type="button"
                aria-pressed={category === c}
                onClick={() => setCategory(c)}
                className={cn(
                  'h-8 cursor-pointer rounded-full border px-3 text-sm',
                  category === c ? 'border-accent bg-accent-tint text-accent' : 'border-line bg-paper text-ink-2 hover:bg-surface',
                )}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
        <p className="mt-3 min-h-5 text-sm text-ink-2" role="status" aria-live="polite">
          {status || 'Click an emoji to copy it.'}
        </p>
        {recentItems.length > 0 && !query ? (
          <div className="mt-2">
            <div className="mb-1 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Recently used</h3>
              <Button size="sm" variant="ghost" onClick={clearRecent}>
                Clear recent
              </Button>
            </div>
            <div className="flex flex-wrap">{recentItems.map(cell)}</div>
          </div>
        ) : null}
        <div className="mt-3">
          <h3 className="mb-1 text-sm font-semibold">
            {query ? `${results.length} result${results.length === 1 ? '' : 's'}` : category === 'All' ? 'All emoji' : category}
          </h3>
          {results.length ? <div className="flex max-h-[28rem] flex-wrap overflow-y-auto">{results.map(cell)}</div> : <p className="text-sm text-muted">No emoji match that search. Try a simpler word.</p>}
        </div>
        {saveFailed ? <Alert tone="warn" className="mt-3">Your browser blocked saving, so the recent list will reset when you leave.</Alert> : null}
      </Panel>
      <Panel
        title="Emoji box"
        actions={
          <div className="flex gap-2">
            <CopyButton text={basket} label="Copy all" disabled={!basket} />
            <Button size="sm" variant="ghost" onClick={() => setBasket('')} disabled={!basket}>
              Clear
            </Button>
          </div>
        }
      >
        <Input value={basket} onChange={(e) => setBasket(e.target.value)} placeholder="Clicked emoji collect here so you can copy several at once" aria-label="Emoji box" />
        {picked ? <p className="mt-2 text-sm text-muted">Last picked: {picked.char} {picked.name}</p> : null}
      </Panel>
    </div>
  )
}
