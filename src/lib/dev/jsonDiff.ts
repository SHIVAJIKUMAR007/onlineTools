// Structural JSON comparison. Pure logic, no DOM.

export type DiffKind = 'added' | 'removed' | 'changed' | 'reordered'

export interface DiffEntry {
  path: string
  kind: DiffKind
  before?: unknown
  after?: unknown
}

export interface DiffSummary {
  added: number
  removed: number
  changed: number
  reordered: number
  total: number
}

const IDENT = /^[A-Za-z_$][\w$]*$/

export function childPath(parent: string, key: string | number): string {
  if (typeof key === 'number') return `${parent}[${key}]`
  return IDENT.test(key) ? `${parent}.${key}` : `${parent}[${JSON.stringify(key)}]`
}

type Kind = 'null' | 'array' | 'object' | 'string' | 'number' | 'boolean' | 'other'
const typeOf = (v: unknown): Kind => {
  if (v === null) return 'null'
  if (Array.isArray(v)) return 'array'
  switch (typeof v) {
    case 'object':
      return 'object'
    case 'string':
      return 'string'
    case 'number':
      return 'number'
    case 'boolean':
      return 'boolean'
    default:
      return 'other'
  }
}

const hasOwn = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k)

/**
 * Compare two parsed JSON values. Arrays are compared by index.
 * With ignoreKeyOrder off, objects that hold the same data in a different key
 * order are reported as "reordered".
 */
export function diffJson(a: unknown, b: unknown, opts: { ignoreKeyOrder?: boolean } = {}): DiffEntry[] {
  const ignoreOrder = opts.ignoreKeyOrder ?? true
  const out: DiffEntry[] = []
  const walk = (x: unknown, y: unknown, path: string) => {
    const tx = typeOf(x)
    const ty = typeOf(y)
    if (tx !== ty) {
      out.push({ path, kind: 'changed', before: x, after: y })
      return
    }
    if (tx === 'array') {
      const xa = x as unknown[]
      const ya = y as unknown[]
      const n = Math.max(xa.length, ya.length)
      for (let i = 0; i < n; i++) {
        if (i >= xa.length) out.push({ path: childPath(path, i), kind: 'added', after: ya[i] })
        else if (i >= ya.length) out.push({ path: childPath(path, i), kind: 'removed', before: xa[i] })
        else walk(xa[i], ya[i], childPath(path, i))
      }
      return
    }
    if (tx === 'object') {
      const xo = x as Record<string, unknown>
      const yo = y as Record<string, unknown>
      const xk = Object.keys(xo)
      const yk = Object.keys(yo)
      const before = out.length
      for (const k of xk) {
        if (!hasOwn(yo, k)) out.push({ path: childPath(path, k), kind: 'removed', before: xo[k] })
        else walk(xo[k], yo[k], childPath(path, k))
      }
      for (const k of yk) if (!hasOwn(xo, k)) out.push({ path: childPath(path, k), kind: 'added', after: yo[k] })
      if (!ignoreOrder && out.length === before && xk.length === yk.length && xk.some((k, i) => k !== yk[i])) {
        out.push({ path, kind: 'reordered', before: xk, after: yk })
      }
      return
    }
    if (x !== y) out.push({ path, kind: 'changed', before: x, after: y })
  }
  walk(a, b, '$')
  return out
}

export function summarizeDiff(entries: DiffEntry[]): DiffSummary {
  const s: DiffSummary = { added: 0, removed: 0, changed: 0, reordered: 0, total: entries.length }
  for (const e of entries) s[e.kind]++
  return s
}

const show = (v: unknown): string => {
  const s = JSON.stringify(v)
  if (s === undefined) return 'undefined'
  return s.length > 160 ? s.slice(0, 157) + '...' : s
}

export function formatDiffReport(entries: DiffEntry[]): string {
  if (!entries.length) return 'No differences found.'
  const s = summarizeDiff(entries)
  const lines = [
    `${s.total} difference${s.total === 1 ? '' : 's'}: ${s.added} added, ${s.removed} removed, ${s.changed} changed${s.reordered ? `, ${s.reordered} reordered` : ''}`,
    '',
  ]
  for (const e of entries) {
    if (e.kind === 'added') lines.push(`+ ${e.path}: ${show(e.after)}`)
    else if (e.kind === 'removed') lines.push(`- ${e.path}: ${show(e.before)}`)
    else if (e.kind === 'changed') lines.push(`~ ${e.path}: ${show(e.before)} -> ${show(e.after)}`)
    else lines.push(`^ ${e.path}: key order differs`)
  }
  return lines.join('\n')
}
