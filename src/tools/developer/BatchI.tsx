import { createContext, memo, useContext, useDeferredValue, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { ChevronRight, FileUp } from 'lucide-react'
import { TextBox } from '@/components/tools/TextBox'
import { CopyButton, Panel } from '@/components/tools/controls'
import { Button } from '@/components/ui/button'
import { Alert, Badge, Stat } from '@/components/ui/misc'
import { Field, Input, Select } from '@/components/ui/fields'
import { cn } from '@/lib/utils/cn'
import {
  childCount,
  childEntries,
  expandedPaths,
  formatPath,
  isContainer,
  kindOf,
  parseJson,
  primitiveText,
  searchJson,
  splitMatches,
  summary,
  type ParseResult,
  type Seg,
} from '@/lib/dev/jsonViewer'
import { evaluateJsonPath } from '@/lib/dev/jsonPath'

const PAGE = 200

const SAMPLE = `{
  "store": {
    "name": "Corner Books",
    "open": true,
    "book": [
      { "category": "reference", "author": "Nigel Rees", "title": "Sayings of the Century", "price": 8.95 },
      { "category": "fiction", "author": "Evelyn Waugh", "title": "Sword of Honour", "price": 12.99 },
      { "category": "fiction", "author": "Herman Melville", "title": "Moby Dick", "isbn": "0-553-21311-3", "price": 8.99 },
      { "category": "fiction", "author": "J. R. R. Tolkien", "title": "The Lord of the Rings", "isbn": "0-395-19395-8", "price": 22.99 }
    ],
    "bicycle": { "color": "red", "price": 19.95 },
    "closedOn": null
  }
}`

function errorLine(text: string, line?: number): string {
  if (!line) return ''
  const l = text.split('\n')[line - 1] ?? ''
  return l.length > 140 ? l.slice(0, 140) + '...' : l
}

function ParseError({ text, result }: { text: string; result: Extract<ParseResult, { ok: false }> }) {
  const where = result.line ? ` (line ${result.line}, column ${result.column})` : ''
  return (
    <Alert tone="danger" title={`Invalid JSON${where}`}>
      <p>{result.message}</p>
      {result.line ? <pre className="mt-2 overflow-x-auto rounded-md bg-paper/70 px-2 py-1 font-mono text-xs">{errorLine(text, result.line)}</pre> : null}
    </Alert>
  )
}

// ───────────── JSON viewer ─────────────
interface Selected {
  path: string
  segs: Seg[]
  value: unknown
}
interface TreeCtx {
  expanded: Set<string>
  toggle: (path: string) => void
  select: (s: Selected) => void
  selected: string | null
  query: string
  matches: Set<string>
}
const TreeContext = createContext<TreeCtx | null>(null)

function Hl({ text, query, on }: { text: string; query: string; on: boolean }) {
  if (!on || !query.trim()) return <>{text}</>
  return (
    <>
      {splitMatches(text, query).map((p, i) =>
        p.hit ? (
          <mark key={i} className="rounded bg-warn-tint px-0.5 text-ink">
            {p.text}
          </mark>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </>
  )
}

const kindClass: Record<string, string> = {
  string: 'text-accent',
  number: 'text-warn',
  boolean: 'text-danger',
  null: 'italic text-muted',
}

function focusRow(el: Element | null | undefined) {
  if (el instanceof HTMLElement) el.focus()
}

const TreeNode = memo(function TreeNode({ segs, value }: { segs: Seg[]; value: unknown }) {
  const ctx = useContext(TreeContext)
  const [shown, setShown] = useState(PAGE)
  if (!ctx) return null
  const path = formatPath(segs)
  const container = isContainer(value)
  const open = container && ctx.expanded.has(path)
  const isRoot = segs.length === 0
  const selected = ctx.selected === path
  const label = isRoot ? 'root' : String(segs[segs.length - 1])
  const isIndex = typeof segs[segs.length - 1] === 'number'
  const kind = kindOf(value)
  const hit = ctx.matches.has(path)
  const total = container ? childCount(value) : 0

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const row = e.currentTarget
    const rows = Array.from(row.closest('[role="tree"]')?.querySelectorAll('[data-tree-row]') ?? [])
    const at = rows.indexOf(row)
    if (e.key === 'ArrowDown') focusRow(rows[at + 1])
    else if (e.key === 'ArrowUp') focusRow(rows[at - 1])
    else if (e.key === 'Home') focusRow(rows[0])
    else if (e.key === 'End') focusRow(rows[rows.length - 1])
    else if (e.key === 'ArrowRight') {
      if (container && !open) ctx.toggle(path)
      else if (open) focusRow(rows[at + 1])
    } else if (e.key === 'ArrowLeft') {
      if (open) ctx.toggle(path)
      else focusRow(row.closest('ul')?.previousElementSibling)
    } else if (e.key === 'Enter' || e.key === ' ') ctx.select({ path, segs, value })
    else return
    e.preventDefault()
  }

  return (
    <li role="none">
      <div
        role="treeitem"
        data-tree-row
        aria-level={segs.length + 1}
        aria-expanded={container ? open : undefined}
        aria-selected={selected}
        tabIndex={selected || isRoot ? 0 : -1}
        onClick={() => ctx.select({ path, segs, value })}
        onKeyDown={onKey}
        className={cn(
          'flex cursor-pointer items-start gap-1 rounded-md px-1 py-0.5 font-mono text-[13px] leading-6 hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-accent',
          selected && 'bg-accent-tint',
        )}
      >
        <span
          aria-hidden
          onClick={(e) => {
            if (!container) return
            e.stopPropagation()
            ctx.toggle(path)
          }}
          className={cn('mt-1 inline-flex size-5 shrink-0 items-center justify-center text-muted', container ? 'cursor-pointer hover:text-ink' : 'opacity-0')}
        >
          <ChevronRight className={cn('size-4 transition-transform', open && 'rotate-90')} />
        </span>
        <span className="min-w-0 break-all">
          <span className={cn(isIndex ? 'text-muted' : 'text-ink', 'font-medium')}>
            <Hl text={label} query={ctx.query} on={hit && !isRoot} />
          </span>
          <span className="text-muted">: </span>
          {container ? (
            <>
              <span className="text-muted">{kind === 'array' ? '[' : '{'}</span>
              {!open && <span className="text-muted">{total ? '...' : ''}</span>}
              <span className="text-muted">{open ? '' : kind === 'array' ? ']' : '}'}</span>{' '}
              <Badge className="align-middle">{summary(value)}</Badge>
            </>
          ) : (
            <span className={kindClass[kind]} title={kind}>
              <Hl text={shorten(primitiveText(value))} query={ctx.query} on={hit} />
            </span>
          )}
        </span>
      </div>
      {open && (
        <ul role="group" className="ml-[11px] border-l border-line pl-3">
          {childEntries(value)
            .slice(0, shown)
            .map(([k, v]) => (
              <TreeNode key={String(k)} segs={[...segs, k]} value={v} />
            ))}
          {total > shown && (
            <li role="none" className="py-1">
              <Button size="sm" variant="ghost" onClick={() => setShown((s) => s + PAGE)}>
                Show {Math.min(PAGE, total - shown)} more ({total - shown} not shown)
              </Button>
            </li>
          )}
          {total === 0 && <li role="none" className="px-1 py-0.5 font-mono text-[13px] text-muted">{kind === 'array' ? 'empty array' : 'empty object'}</li>}
        </ul>
      )}
    </li>
  )
})

const shorten = (s: string, max = 400) => (s.length > max ? `${s.slice(0, max)}... (${s.length} characters)` : s)

export function JsonViewer() {
  const [text, setText] = useState('')
  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [selected, setSelected] = useState<Selected | null>(null)
  const [note, setNote] = useState('')
  const [fileError, setFileError] = useState('')
  const deferredText = useDeferredValue(text)
  const deferredQuery = useDeferredValue(query)
  const fileRef = useRef<HTMLInputElement>(null)

  const parsed = useMemo(() => parseJson(deferredText), [deferredText])
  const value = parsed.ok ? parsed.value : undefined
  const search = useMemo(() => (parsed.ok ? searchJson(value, deferredQuery) : null), [parsed, value, deferredQuery])

  useEffect(() => {
    setExpanded(parsed.ok ? expandedPaths(value, 1).paths : new Set())
    setSelected(null)
    setNote('')
  }, [parsed, value])

  useEffect(() => {
    if (!search || !search.ancestors.size) return
    setExpanded((prev) => new Set([...prev, ...Array.from(search.ancestors).slice(0, 300)]))
  }, [search])

  const ctx: TreeCtx = {
    expanded,
    toggle: (p) =>
      setExpanded((prev) => {
        const n = new Set(prev)
        if (n.has(p)) n.delete(p)
        else n.add(p)
        return n
      }),
    select: setSelected,
    selected: selected?.path ?? null,
    query: deferredQuery,
    matches: search?.matches ?? new Set(),
  }

  const expandTo = (levels: number) => {
    if (!parsed.ok) return
    const { paths, truncated } = expandedPaths(value, levels - 1)
    setExpanded(paths)
    setNote(truncated ? 'Large document: the first 400 containers were opened. Open the rest by hand.' : '')
  }

  const loadFile = async (f: File | undefined) => {
    if (!f) return
    setFileError('')
    if (f.size > 50 * 1024 * 1024) {
      setFileError('That file is over 50 MB, which is too large for the tree view.')
      return
    }
    try {
      setText(await f.text())
    } catch {
      setFileError('Could not read that file.')
    }
  }

  const selectedJson = selected ? (JSON.stringify(selected.value, null, 2) ?? '') : ''

  return (
    <div className="space-y-5">
      <Panel
        title="JSON input"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="ghost" onClick={() => setText(SAMPLE)}>
              Load sample
            </Button>
            <Button size="sm" variant="secondary" onClick={() => fileRef.current?.click()}>
              <FileUp className="size-4" aria-hidden /> Open file
            </Button>
            <input ref={fileRef} type="file" accept=".json,.geojson,.txt,application/json,text/plain" className="sr-only" aria-label="Open a JSON file" onChange={(e) => { void loadFile(e.target.files?.[0]); e.target.value = '' }} />
          </div>
        }
      >
        <TextBox label="Paste JSON" value={text} onChange={setText} rows={8} paste clear placeholder='{"name": "Ada", "tags": ["a", "b"]}' error={!parsed.ok && !!text.trim()} />
        {fileError && <Alert tone="danger" className="mt-3">{fileError}</Alert>}
      </Panel>

      {text.trim() && !parsed.ok && <ParseError text={deferredText} result={parsed} />}

      {parsed.ok && (
        <Panel title="Tree" actions={<CopyButton label="Copy JSON" text={() => JSON.stringify(value, null, 2) ?? ''} />}>
          <div className="mb-4 flex flex-wrap items-end gap-x-4 gap-y-3">
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => expandTo(1000)}>Expand all</Button>
              <Button size="sm" onClick={() => setExpanded(new Set())}>Collapse all</Button>
            </div>
            <Field label="Expand to depth" className="w-32">
              {(id) => (
                <Select id={id} defaultValue="" onChange={(e) => e.target.value && expandTo(Number(e.target.value))} className="h-8">
                  <option value="">Choose</option>
                  {[1, 2, 3, 4, 5, 6, 8, 10].map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Search keys and values" className="min-w-48 flex-1">
              {(id) => <Input id={id} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search" type="search" className="h-8" />}
            </Field>
            {deferredQuery.trim() && search && (
              <p className="pb-1.5 text-sm text-ink-2" role="status">
                {search.count} {search.count === 1 ? 'match' : 'matches'}
                {search.truncated ? ' (stopped early, narrow the search)' : ''}
              </p>
            )}
          </div>
          {note && <p className="mb-3 text-xs text-muted">{note}</p>}
          <div className="max-h-[32rem] overflow-auto rounded-xl border border-line bg-surface p-2">
            <TreeContext.Provider value={ctx}>
              <ul role="tree" aria-label="JSON tree">
                <TreeNode segs={[]} value={value} />
              </ul>
            </TreeContext.Provider>
          </div>
          <p className="mt-2 text-xs text-muted">Click a row to select it. Arrow keys move, Right and Left open and close. Each list shows {PAGE} items at a time.</p>
        </Panel>
      )}

      {parsed.ok && (
        <Panel title="Selected node" actions={selected ? <CopyButton label="Copy value" text={selectedJson} /> : undefined}>
          {selected ? (
            <div className="space-y-3">
              <nav aria-label="Path to the selected node" className="flex flex-wrap items-center gap-1 font-mono text-[13px]">
                <span className="text-muted">$</span>
                {selected.segs.map((s, i) => (
                  <span key={i} className="flex items-center gap-1">
                    <ChevronRight className="size-3 text-muted" aria-hidden />
                    <span className={typeof s === 'number' ? 'text-muted' : 'text-ink'}>{String(s)}</span>
                  </span>
                ))}
              </nav>
              <div className="flex flex-wrap items-center gap-2">
                <code className="break-all rounded-md bg-surface-2 px-2 py-1 font-mono text-[13px]">{selected.path}</code>
                <CopyButton label="Copy path" text={selected.path} />
                <Badge>{kindOf(selected.value)}</Badge>
                {isContainer(selected.value) && <Badge>{summary(selected.value)}</Badge>}
              </div>
              <pre className="max-h-64 overflow-auto rounded-lg bg-surface-2 p-3 font-mono text-[13px]">{shorten(selectedJson, 20000)}</pre>
            </div>
          ) : (
            <p className="text-sm text-muted">Select a node in the tree to see its path and value. The copy buttons use the path and JSON of that node.</p>
          )}
        </Panel>
      )}
    </div>
  )
}

// ───────────── JSONPath tester ─────────────
const EXAMPLES: { label: string; expr: string }[] = [
  { label: 'All authors', expr: '$.store.book[*].author' },
  { label: 'Every price', expr: '$..price' },
  { label: 'Books under 10', expr: '$.store.book[?(@.price < 10)].title' },
  { label: 'Fiction under 10', expr: "$.store.book[?(@.category == 'fiction' && @.price < 10)]" },
  { label: 'Has an ISBN', expr: '$..book[?(@.isbn)].title' },
  { label: 'Last book', expr: '$.store.book[-1]' },
  { label: 'First two', expr: '$.store.book[0:2].title' },
  { label: 'Pick two', expr: "$.store.bicycle['color','price']" },
]

export function JsonPathTester() {
  const [json, setJson] = useState('')
  const [expr, setExpr] = useState('')
  const dJson = useDeferredValue(json)
  const dExpr = useDeferredValue(expr)
  const parsed = useMemo(() => parseJson(dJson), [dJson])
  const result = useMemo(() => (parsed.ok && dExpr.trim() ? evaluateJsonPath(parsed.value, dExpr) : null), [parsed, dExpr])

  const matchesJson = useMemo(() => (result && result.ok ? JSON.stringify(result.nodes.map((n) => n.value), null, 2) : ''), [result])

  return (
    <div className="space-y-5">
      <Panel
        title="JSON document"
        actions={
          <Button size="sm" variant="ghost" onClick={() => { setJson(SAMPLE); if (!expr) setExpr('$.store.book[?(@.price < 10)].title') }}>
            Load sample
          </Button>
        }
      >
        <TextBox label="Paste JSON" value={json} onChange={setJson} rows={9} paste clear placeholder='{"store": {"book": [{"title": "A", "price": 5}]}}' error={!parsed.ok && !!json.trim()} />
      </Panel>
      {json.trim() && !parsed.ok && <ParseError text={dJson} result={parsed} />}

      <Panel title="JSONPath expression">
        <div className="space-y-3">
          <Field label="Expression" hint="Starts with $. Supports .name, ['name'], [0], [-1], [1:3:1], [*], .., [?(@.price < 10)] and unions like [0,2].">
            {(id) => <Input id={id} value={expr} onChange={(e) => setExpr(e.target.value)} spellCheck={false} autoComplete="off" className="font-mono" placeholder="$.store.book[*].title" aria-invalid={result?.ok === false || undefined} />}
          </Field>
          <div className="flex flex-wrap gap-2" aria-label="Example expressions">
            {EXAMPLES.map((x) => (
              <Button key={x.expr} size="sm" variant="subtle" title={x.expr} onClick={() => { setExpr(x.expr); if (!json.trim()) setJson(SAMPLE) }}>
                {x.label}
              </Button>
            ))}
          </div>
          <p className="text-xs text-muted">Examples use the sample bookstore. Clicking one loads the sample if the box is empty.</p>
        </div>
      </Panel>

      {result && !result.ok && (
        <Alert tone="danger" title="Cannot evaluate this expression">
          <p>{result.error}</p>
          {result.position !== undefined && dExpr.length < 200 && (
            <pre className="mt-2 overflow-x-auto font-mono text-xs">{dExpr + '\n' + ' '.repeat(Math.min(result.position, dExpr.length)) + '^'}</pre>
          )}
        </Alert>
      )}

      {result && result.ok && (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <Stat label="Matches" value={result.nodes.length === 0 ? '0' : result.truncated ? `${result.nodes.length}+` : result.nodes.length} sub={result.truncated ? 'Showing the first 5,000' : undefined} />
            <Stat label="Result" value={result.nodes.length ? 'Found' : 'Nothing matched'} sub={result.nodes.length ? undefined : 'Check names, indexes and filter values'} />
          </div>
          <Panel title="Matched values" actions={<CopyButton text={matchesJson} disabled={!matchesJson} />}>
            <pre className="max-h-96 overflow-auto rounded-lg bg-surface-2 p-3 font-mono text-[13px]" aria-live="polite">{matchesJson.length > 100000 ? matchesJson.slice(0, 100000) + '\n... (shortened, copy for the full list)' : matchesJson || '[]'}</pre>
          </Panel>
          <Panel title="Path of each match" actions={<CopyButton label="Copy paths" text={result.paths.join('\n')} disabled={!result.paths.length} />}>
            {result.paths.length ? (
              <ol className="max-h-72 space-y-1 overflow-auto font-mono text-[13px]">
                {result.paths.slice(0, 500).map((p, i) => (
                  <li key={i} className="break-all">
                    <span className="mr-2 text-muted">{i + 1}.</span>
                    {p}
                  </li>
                ))}
                {result.paths.length > 500 && <li className="text-muted">...and {result.paths.length - 500} more. Copy paths for the full list.</li>}
              </ol>
            ) : (
              <p className="text-sm text-muted">No paths to list.</p>
            )}
          </Panel>
        </>
      )}
      {!result && parsed.ok && <p className="text-sm text-muted">Enter an expression, or click an example, to see matches.</p>}
    </div>
  )
}
