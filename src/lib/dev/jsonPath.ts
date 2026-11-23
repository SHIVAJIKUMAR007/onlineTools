/**
 * A small JSONPath evaluator, loosely following RFC 9535. It never uses eval or Function.
 * Supported: $, .name, ['name'], [index] (negative too), [start:end:step], [*], .., filters, unions.
 */
export type PathSeg = string | number

export class JsonPathError extends Error {
  position: number
  constructor(message: string, position: number) {
    super(message)
    this.position = position
  }
}

type Selector =
  | { t: 'name'; name: string }
  | { t: 'index'; index: number }
  | { t: 'slice'; start?: number; end?: number; step?: number }
  | { t: 'wild' }
  | { t: 'filter'; expr: Expr }

interface Segment {
  descendant: boolean
  selectors: Selector[]
}

type Expr =
  | { t: 'or' | 'and'; l: Expr; r: Expr }
  | { t: 'not'; e: Expr }
  | { t: 'cmp'; op: string; l: Expr; r: Expr }
  | { t: 'lit'; v: unknown }
  | { t: 'path'; root: '@' | '$'; segs: Segment[] }

const NAME_STOP = new Set([' ', '\t', '\n', '\r', '.', '[', ']', '(', ')', '<', '>', '=', '!', '&', '|', ',', "'", '"', '?', ':', '*'])
const MAX_DEPTH = 64

class Parser {
  i = 0
  constructor(readonly s: string) {}

  err(msg: string, pos = this.i): never {
    throw new JsonPathError(msg, pos)
  }
  ws() {
    while (this.i < this.s.length && /\s/.test(this.s[this.i])) this.i++
  }
  peek(n = 0) {
    return this.s[this.i + n]
  }
  eat(str: string): boolean {
    if (this.s.startsWith(str, this.i)) {
      this.i += str.length
      return true
    }
    return false
  }
  expect(str: string, what = `'${str}'`) {
    this.ws()
    if (!this.eat(str)) this.err(`Expected ${what} at position ${this.i}${this.i >= this.s.length ? ' (end of expression)' : ` but found '${this.peek()}'`}.`)
  }

  parseQuery(): Segment[] {
    this.ws()
    if (!this.s.trim()) this.err('Enter a JSONPath expression, for example $.store.book[*].title', 0)
    if (this.peek() !== '$') this.err("A JSONPath expression must start with $ (the root). Try $." + this.s.trim().replace(/^\./, ''), this.i)
    this.i++
    const segs = this.parseSegments(false, 0)
    this.ws()
    if (this.i < this.s.length) this.err(`Unexpected '${this.peek()}' at position ${this.i}.`)
    return segs
  }

  parseSegments(inFilter: boolean, depth: number): Segment[] {
    const segs: Segment[] = []
    for (;;) {
      if (!inFilter) this.ws()
      const c = this.peek()
      if (c === '.') {
        if (this.peek(1) === '.') {
          this.i += 2
          const c2 = this.peek()
          if (c2 === '[') segs.push({ descendant: true, selectors: this.parseBracket(depth) })
          else if (c2 === '*') {
            this.i++
            segs.push({ descendant: true, selectors: [{ t: 'wild' }] })
          } else segs.push({ descendant: true, selectors: [{ t: 'name', name: this.parseName() }] })
        } else {
          this.i++
          if (this.peek() === '*') {
            this.i++
            segs.push({ descendant: false, selectors: [{ t: 'wild' }] })
          } else segs.push({ descendant: false, selectors: [{ t: 'name', name: this.parseName() }] })
        }
      } else if (c === '[') {
        segs.push({ descendant: false, selectors: this.parseBracket(depth) })
      } else return segs
    }
  }

  parseName(): string {
    const start = this.i
    while (this.i < this.s.length && !NAME_STOP.has(this.s[this.i])) this.i++
    if (this.i === start) this.err(`Expected a property name at position ${start}.`, start)
    return this.s.slice(start, this.i)
  }

  parseString(): string {
    const q = this.s[this.i++]
    let out = ''
    for (;;) {
      if (this.i >= this.s.length) this.err('Unterminated string. Add the closing quote.', this.i)
      const c = this.s[this.i++]
      if (c === q) return out
      if (c === '\\') {
        const n = this.s[this.i++]
        if (n === 'n') out += '\n'
        else if (n === 't') out += '\t'
        else if (n === 'r') out += '\r'
        else if (n === 'b') out += '\b'
        else if (n === 'f') out += '\f'
        else if (n === 'u') {
          const hex = this.s.slice(this.i, this.i + 4)
          if (!/^[0-9a-fA-F]{4}$/.test(hex)) this.err('Invalid \\u escape in string.', this.i)
          out += String.fromCharCode(parseInt(hex, 16))
          this.i += 4
        } else if (n === undefined) this.err('Unterminated string.', this.i)
        else out += n
      } else out += c
    }
  }

  parseInt(): number | undefined {
    const m = /^-?\d+/.exec(this.s.slice(this.i))
    if (!m) return undefined
    this.i += m[0].length
    return Number(m[0])
  }

  parseBracket(depth: number): Selector[] {
    this.i++ // [
    const sels: Selector[] = []
    for (;;) {
      this.ws()
      const c = this.peek()
      if (c === "'" || c === '"') sels.push({ t: 'name', name: this.parseString() })
      else if (c === '*') {
        this.i++
        sels.push({ t: 'wild' })
      } else if (c === '?') {
        this.i++
        if (depth >= MAX_DEPTH) this.err('Filter nesting is too deep.')
        sels.push({ t: 'filter', expr: this.parseOr(depth + 1) })
      } else {
        const start = this.i
        const a = this.parseInt()
        this.ws()
        if (this.peek() === ':') {
          this.i++
          this.ws()
          const b = this.parseInt()
          this.ws()
          let step: number | undefined
          if (this.peek() === ':') {
            this.i++
            this.ws()
            step = this.parseInt()
          }
          sels.push({ t: 'slice', start: a, end: b, step })
        } else if (a !== undefined) {
          sels.push({ t: 'index', index: a })
        } else if (this.i >= this.s.length) this.err("Missing closing ']'.", this.i)
        else this.err(`Unexpected '${this.s[start]}' at position ${start}. Use a quoted name, a number, a slice, * or a filter.`, start)
      }
      this.ws()
      if (this.eat(',')) continue
      if (this.eat(']')) return sels
      this.err(this.i >= this.s.length ? "Missing closing ']'." : `Expected ',' or ']' at position ${this.i} but found '${this.peek()}'.`)
    }
  }

  parseOr(depth: number): Expr {
    let l = this.parseAnd(depth)
    for (;;) {
      this.ws()
      if (this.eat('||')) l = { t: 'or', l, r: this.parseAnd(depth) }
      else return l
    }
  }
  parseAnd(depth: number): Expr {
    let l = this.parseNot(depth)
    for (;;) {
      this.ws()
      if (this.eat('&&')) l = { t: 'and', l, r: this.parseNot(depth) }
      else return l
    }
  }
  parseNot(depth: number): Expr {
    this.ws()
    if (this.peek() === '!' && this.peek(1) !== '=') {
      this.i++
      return { t: 'not', e: this.parseNot(depth) }
    }
    const l = this.parsePrimary(depth)
    this.ws()
    for (const op of ['==', '!=', '<=', '>=', '<', '>']) {
      if (this.eat(op)) return { t: 'cmp', op, l, r: this.parsePrimary(depth) }
    }
    if (this.peek() === '=') this.err("Use '==' to compare values. A single '=' is not valid.")
    return l
  }
  parsePrimary(depth: number): Expr {
    this.ws()
    const c = this.peek()
    if (c === undefined) this.err('The filter ends too early. Add the rest of the condition.')
    if (c === '(') {
      this.i++
      const e = this.parseOr(depth)
      this.expect(')', "')' to close the group")
      return e
    }
    if (c === "'" || c === '"') return { t: 'lit', v: this.parseString() }
    if (c === '@' || c === '$') {
      this.i++
      return { t: 'path', root: c, segs: this.parseSegments(true, depth) }
    }
    const rest = this.s.slice(this.i)
    const num = /^-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?/.exec(rest)
    if (num) {
      this.i += num[0].length
      return { t: 'lit', v: Number(num[0]) }
    }
    for (const [word, v] of [['true', true], ['false', false], ['null', null]] as const) {
      if (rest.startsWith(word) && !/[A-Za-z0-9_]/.test(rest[word.length] ?? '')) {
        this.i += word.length
        return { t: 'lit', v }
      }
    }
    return this.err(`Unexpected '${c}' at position ${this.i} in the filter. Use @.field, a number, a quoted string, true, false or null.`)
  }
}

export interface MatchNode {
  value: unknown
  path: PathSeg[]
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const has = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k)

function sliceIndices(len: number, sel: { start?: number; end?: number; step?: number }): number[] {
  const step = sel.step ?? 1
  if (step === 0) return []
  const norm = (i: number) => (i >= 0 ? i : len + i)
  const out: number[] = []
  if (step > 0) {
    const lower = Math.min(Math.max(norm(sel.start ?? 0), 0), len)
    const upper = Math.min(Math.max(norm(sel.end ?? len), 0), len)
    for (let i = lower; i < upper; i += step) out.push(i)
  } else {
    const upper = Math.min(Math.max(norm(sel.start ?? len - 1), -1), len - 1)
    const lower = Math.min(Math.max(norm(sel.end ?? -len - 1), -1), len - 1)
    for (let i = upper; i > lower; i += step) out.push(i)
  }
  return out
}

function children(n: MatchNode): MatchNode[] {
  if (Array.isArray(n.value)) return n.value.map((v, i) => ({ value: v, path: [...n.path, i] }))
  if (isObj(n.value)) return Object.keys(n.value).map((k) => ({ value: (n.value as Record<string, unknown>)[k], path: [...n.path, k] }))
  return []
}

function applySelector(n: MatchNode, sel: Selector, ctx: Ctx, out: MatchNode[]) {
  const v = n.value
  switch (sel.t) {
    case 'name':
      if (isObj(v) && has(v, sel.name)) out.push({ value: v[sel.name], path: [...n.path, sel.name] })
      else if (ctx.inFilter && sel.name === 'length' && (Array.isArray(v) || typeof v === 'string')) out.push({ value: v.length, path: [...n.path, 'length'] })
      break
    case 'index':
      if (Array.isArray(v)) {
        const i = sel.index < 0 ? v.length + sel.index : sel.index
        if (i >= 0 && i < v.length) out.push({ value: v[i], path: [...n.path, i] })
      }
      break
    case 'slice':
      if (Array.isArray(v)) for (const i of sliceIndices(v.length, sel)) out.push({ value: v[i], path: [...n.path, i] })
      break
    case 'wild':
      out.push(...children(n))
      break
    case 'filter':
      for (const c of children(n)) if (truthy(sel.expr, c, ctx)) out.push(c)
      break
  }
}

interface Ctx {
  root: MatchNode
  inFilter: boolean
  limit: number
  work: { n: number }
}

function guard(ctx: Ctx) {
  if (++ctx.work.n > ctx.limit) throw new JsonPathError('The expression touches too many nodes. Narrow it down.', 0)
}

function runSegments(start: MatchNode[], segs: Segment[], ctx: Ctx): MatchNode[] {
  let cur = start
  for (const seg of segs) {
    const next: MatchNode[] = []
    for (const n of cur) {
      if (!seg.descendant) {
        for (const sel of seg.selectors) applySelector(n, sel, ctx, next)
      } else {
        const visit = (node: MatchNode) => {
          guard(ctx)
          for (const sel of seg.selectors) applySelector(node, sel, ctx, next)
          for (const c of children(node)) visit(c)
        }
        visit(n)
      }
    }
    cur = next
  }
  return cur
}

function operand(e: Expr, cur: MatchNode, ctx: Ctx): unknown {
  if (e.t === 'lit') return e.v
  if (e.t === 'path') {
    const r = runSegments([e.root === '@' ? cur : ctx.root], e.segs, { ...ctx, inFilter: true })
    return r.length ? r[0].value : undefined
  }
  return truthy(e, cur, ctx)
}

function deepEq(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false
  if (Array.isArray(a) !== Array.isArray(b)) return false
  const ka = Object.keys(a)
  const kb = Object.keys(b)
  if (ka.length !== kb.length) return false
  return ka.every((k) => has(b, k) && deepEq((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]))
}

function truthy(e: Expr, cur: MatchNode, ctx: Ctx): boolean {
  guard(ctx)
  switch (e.t) {
    case 'or':
      return truthy(e.l, cur, ctx) || truthy(e.r, cur, ctx)
    case 'and':
      return truthy(e.l, cur, ctx) && truthy(e.r, cur, ctx)
    case 'not':
      return !truthy(e.e, cur, ctx)
    case 'lit':
      return Boolean(e.v)
    case 'path':
      return runSegments([e.root === '@' ? cur : ctx.root], e.segs, { ...ctx, inFilter: true }).length > 0
    case 'cmp': {
      const l = operand(e.l, cur, ctx)
      const r = operand(e.r, cur, ctx)
      if (e.op === '==') return deepEq(l, r)
      if (e.op === '!=') return !deepEq(l, r)
      const comparable = (typeof l === 'number' && typeof r === 'number') || (typeof l === 'string' && typeof r === 'string')
      if (!comparable) return false
      const a = l as number | string
      const b = r as number | string
      return e.op === '<' ? a < b : e.op === '<=' ? a <= b : e.op === '>' ? a > b : a >= b
    }
  }
}

/** Normalised path such as $['store']['book'][0]. */
export function normalizedPath(path: PathSeg[]): string {
  return '$' + path.map((s) => (typeof s === 'number' ? `[${s}]` : `['${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}']`)).join('')
}

export type EvalResult =
  | { ok: true; nodes: MatchNode[]; paths: string[]; truncated: boolean }
  | { ok: false; error: string; position?: number }

export function parseJsonPath(expr: string): Segment[] {
  return new Parser(expr).parseQuery()
}

export function evaluateJsonPath(data: unknown, expr: string, maxResults = 5000): EvalResult {
  try {
    const segs = parseJsonPath(expr)
    const root: MatchNode = { value: data, path: [] }
    const ctx: Ctx = { root, inFilter: false, limit: 2_000_000, work: { n: 0 } }
    const all = runSegments([root], segs, ctx)
    const nodes = all.slice(0, maxResults)
    return { ok: true, nodes, paths: nodes.map((n) => normalizedPath(n.path)), truncated: all.length > maxResults }
  } catch (e) {
    if (e instanceof JsonPathError) return { ok: false, error: e.message, position: e.position }
    if (e instanceof RangeError) return { ok: false, error: 'The document is nested too deeply for this expression.' }
    return { ok: false, error: e instanceof Error ? e.message : 'Could not evaluate the expression.' }
  }
}
