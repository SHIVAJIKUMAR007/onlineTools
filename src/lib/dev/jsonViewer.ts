export type Seg = string | number
export type JsonKind = 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null'

export type ParseResult = { ok: true; value: unknown } | { ok: false; message: string; line?: number; column?: number }

export const kindOf = (v: unknown): JsonKind => (v === null ? 'null' : Array.isArray(v) ? 'array' : (typeof v as JsonKind))

export const isContainer = (v: unknown): v is Record<string, unknown> | unknown[] => typeof v === 'object' && v !== null

export function lineColumn(text: string, pos: number): { line: number; column: number } {
  const p = Math.max(0, Math.min(pos, text.length))
  let line = 1
  let last = -1
  for (let i = 0; i < p; i++) {
    if (text.charCodeAt(i) === 10) {
      line++
      last = i
    }
  }
  return { line, column: p - last }
}

/** Offset of the first syntax error, found with a small scanner so the result is the same in every browser. */
export function findJsonErrorPos(text: string): number | null {
  let i = 0
  const n = text.length
  const ws = () => {
    while (i < n && (text[i] === ' ' || text[i] === '\t' || text[i] === '\n' || text[i] === '\r')) i++
  }
  const fail = (): never => {
    throw i
  }
  const str = () => {
    i++
    while (i < n && text[i] !== '"') {
      const c = text.charCodeAt(i)
      if (c < 0x20) fail()
      if (text[i] === '\\') {
        i++
        if (text[i] === 'u') {
          if (!/^[0-9a-fA-F]{4}$/.test(text.slice(i + 1, i + 5))) {
            i++
            fail()
          }
          i += 4
        } else if (!/["\\/bfnrt]/.test(text[i] ?? '')) fail()
      }
      i++
    }
    if (i >= n) fail()
    i++
  }
  const value = (depth: number): void => {
    ws()
    const c = text[i]
    if (c === '{') {
      i++
      ws()
      if (text[i] === '}') return void i++
      for (;;) {
        ws()
        if (text[i] !== '"') fail()
        str()
        ws()
        if (text[i] !== ':') fail()
        i++
        if (depth > 2000) fail()
        value(depth + 1)
        ws()
        if (text[i] === ',') {
          i++
          continue
        }
        if (text[i] === '}') return void i++
        fail()
      }
    } else if (c === '[') {
      i++
      ws()
      if (text[i] === ']') return void i++
      for (;;) {
        if (depth > 2000) fail()
        value(depth + 1)
        ws()
        if (text[i] === ',') {
          i++
          continue
        }
        if (text[i] === ']') return void i++
        fail()
      }
    } else if (c === '"') str()
    else {
      const m = /^(?:-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null)/.exec(text.slice(i, i + 400))
      if (!m) fail()
      else i += m[0].length
    }
  }
  try {
    value(0)
    ws()
    if (i < n) fail()
    return null
  } catch (e) {
    return typeof e === 'number' ? e : null
  }
}

/** Parse JSON and report a line and column for syntax errors, across engines. */
export function parseJson(text: string): ParseResult {
  if (!text.trim()) return { ok: false, message: 'Paste some JSON to get started.' }
  try {
    return { ok: true, value: JSON.parse(text) }
  } catch (e) {
    let msg = e instanceof Error ? e.message : String(e)
    msg = msg.replace(/\s*\(line \d+ column \d+\)/i, '').replace(/\s*(in JSON )?at position \d+/i, '')
    const pos = findJsonErrorPos(text)
    if (pos === null) return { ok: false, message: msg }
    const { line, column } = lineColumn(text, pos)
    if (pos >= text.length) msg = 'Unexpected end of JSON. Something is missing, such as a closing bracket or quote.'
    return { ok: false, message: msg, line, column }
  }
}

const IDENT = /^[A-Za-z_$][A-Za-z0-9_$]*$/

/** Display path such as $.users[0]['first name']. */
export function formatPath(segs: Seg[]): string {
  let out = '$'
  for (const s of segs) {
    if (typeof s === 'number') out += `[${s}]`
    else if (IDENT.test(s)) out += `.${s}`
    else out += `['${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}']`
  }
  return out
}

export function childEntries(v: unknown): [Seg, unknown][] {
  if (Array.isArray(v)) return v.map((x, i) => [i, x])
  if (isContainer(v)) return Object.entries(v)
  return []
}

export function childCount(v: unknown): number {
  if (Array.isArray(v)) return v.length
  if (isContainer(v)) return Object.keys(v).length
  return 0
}

export const summary = (v: unknown): string => {
  if (Array.isArray(v)) return `${v.length} ${v.length === 1 ? 'item' : 'items'}`
  if (isContainer(v)) {
    const n = Object.keys(v).length
    return `${n} ${n === 1 ? 'key' : 'keys'}`
  }
  return ''
}

/** Primitive text as shown in the tree. */
export const primitiveText = (v: unknown): string => (typeof v === 'string' ? JSON.stringify(v) : String(v))

/**
 * Paths of containers that should be open for a given depth, breadth first, stopping at a budget so that
 * "expand all" on a huge document stays responsive. Depth 0 opens only the root.
 */
export function expandedPaths(root: unknown, depth: number, budget = 400): { paths: Set<string>; truncated: boolean } {
  const paths = new Set<string>()
  let truncated = false
  let level: { v: unknown; segs: Seg[] }[] = isContainer(root) ? [{ v: root, segs: [] }] : []
  for (let d = 0; level.length && d <= depth; d++) {
    const next: { v: unknown; segs: Seg[] }[] = []
    for (const n of level) {
      if (paths.size >= budget) {
        truncated = true
        break
      }
      paths.add(formatPath(n.segs))
      if (d === depth) continue
      let shown = 0
      for (const [k, c] of childEntries(n.v)) {
        if (shown++ >= 200) break
        if (isContainer(c)) next.push({ v: c, segs: [...n.segs, k] })
      }
    }
    if (truncated) break
    level = next
  }
  return { paths, truncated }
}

export interface SearchResult {
  matches: Set<string>
  ancestors: Set<string>
  count: number
  truncated: boolean
}

/** Case-insensitive search through keys and primitive values. Returns paths of matching nodes and their ancestors. */
export function searchJson(root: unknown, query: string, maxMatches = 2000, maxNodes = 200000): SearchResult {
  const q = query.trim().toLowerCase()
  const res: SearchResult = { matches: new Set(), ancestors: new Set(), count: 0, truncated: false }
  if (!q) return res
  let visited = 0
  const walk = (v: unknown, segs: Seg[]): boolean => {
    if (++visited > maxNodes) {
      res.truncated = true
      return false
    }
    let found = false
    if (segs.length) {
      const key = String(segs[segs.length - 1])
      const keyHit = key.toLowerCase().includes(q)
      const valHit = !isContainer(v) && primitiveText(v).toLowerCase().includes(q)
      if (keyHit || valHit) {
        if (res.count >= maxMatches) {
          res.truncated = true
          return false
        }
        res.matches.add(formatPath(segs))
        res.count++
        found = true
      }
    } else if (!isContainer(v) && primitiveText(v).toLowerCase().includes(q)) {
      res.matches.add('$')
      res.count++
      found = true
    }
    if (isContainer(v)) {
      let below = false
      for (const [k, c] of childEntries(v)) {
        if (res.truncated) break
        if (walk(c, [...segs, k])) below = true
      }
      if (below) res.ancestors.add(formatPath(segs))
      return found || below
    }
    return found
  }
  walk(root, [])
  return res
}

/** Split text into pieces so that matches of the query can be highlighted. */
export function splitMatches(text: string, query: string): { text: string; hit: boolean }[] {
  const q = query.trim().toLowerCase()
  if (!q) return [{ text, hit: false }]
  const lower = text.toLowerCase()
  const out: { text: string; hit: boolean }[] = []
  let i = 0
  while (i < text.length) {
    const j = lower.indexOf(q, i)
    if (j < 0 || lower.length !== text.length) {
      out.push({ text: text.slice(i), hit: false })
      break
    }
    if (j > i) out.push({ text: text.slice(i, j), hit: false })
    out.push({ text: text.slice(j, j + q.length), hit: true })
    i = j + q.length
  }
  return out.length ? out : [{ text, hit: false }]
}

/** Resolve a path built by formatPath-style segments. */
export function getAt(root: unknown, segs: Seg[]): unknown {
  let cur = root
  for (const s of segs) {
    if (!isContainer(cur)) return undefined
    cur = (cur as Record<string | number, unknown>)[s]
  }
  return cur
}
