// Generate TypeScript declarations from a JSON sample. Pure logic.

type Prim = 'string' | 'number' | 'boolean' | 'null' | 'unknown'
type Props = Map<string, { t: T; opt: boolean }>
type T = { k: 'prim'; name: Prim } | { k: 'obj'; props: Props } | { k: 'arr'; el: T | null } | { k: 'union'; items: T[] }
type Obj = Extract<T, { k: 'obj' }>

export interface TsOptions {
  rootName?: string
  style?: 'interface' | 'type'
  exportTypes?: boolean
}

const prim = (name: Prim): T => ({ k: 'prim', name })

function infer(v: unknown): T {
  if (v === null) return prim('null')
  if (Array.isArray(v)) {
    let el: T | null = null
    for (const x of v) el = el ? merge(el, infer(x)) : infer(x)
    return { k: 'arr', el }
  }
  switch (typeof v) {
    case 'string':
      return prim('string')
    case 'number':
      return prim('number')
    case 'boolean':
      return prim('boolean')
    case 'object': {
      const props: Props = new Map()
      for (const [k, x] of Object.entries(v as Record<string, unknown>)) props.set(k, { t: infer(x), opt: false })
      return { k: 'obj', props }
    }
    default:
      return prim('unknown')
  }
}

const parts = (t: T): T[] => (t.k === 'union' ? t.items : [t])

function merge(a: T, b: T): T {
  const items: T[] = []
  for (const p of [...parts(a), ...parts(b)]) {
    const at = items.findIndex((q) => q.k === p.k && (p.k !== 'prim' || (q as typeof p).name === p.name))
    if (at === -1) {
      items.push(p)
      continue
    }
    const q = items[at]
    if (p.k === 'obj' && q.k === 'obj') {
      const props: Props = new Map()
      for (const [k, v] of q.props) {
        const o = p.props.get(k)
        props.set(k, o ? { t: merge(v.t, o.t), opt: v.opt || o.opt } : { t: v.t, opt: true })
      }
      for (const [k, v] of p.props) if (!q.props.has(k)) props.set(k, { t: v.t, opt: true })
      items[at] = { k: 'obj', props }
    } else if (p.k === 'arr' && q.k === 'arr') {
      items[at] = { k: 'arr', el: p.el && q.el ? merge(q.el, p.el) : (p.el ?? q.el) }
    }
  }
  return items.length === 1 ? items[0] : { k: 'union', items }
}

const IDENT = /^[A-Za-z_$][\w$]*$/
const BUILTIN = new Set(['string', 'number', 'boolean', 'object', 'any', 'unknown', 'null', 'never', 'class', 'enum', 'function', 'interface', 'type', 'default', 'new', 'delete', 'var', 'let', 'const', 'import', 'export', 'array', 'record'])

export const propKey = (k: string): string => (IDENT.test(k) ? k : JSON.stringify(k))

export function toPascal(s: string): string {
  const words = s.split(/[^A-Za-z0-9]+/).filter(Boolean)
  let r = words.map((w) => w[0].toUpperCase() + w.slice(1)).join('')
  if (!r) r = 'Item'
  if (/^\d/.test(r)) r = '_' + r
  return r
}

const singular = (s: string) => (/ies$/i.test(s) && s.length > 4 ? s.slice(0, -3) + 'y' : /[^s]s$/i.test(s) && s.length > 3 ? s.slice(0, -1) : s)

export function jsonToTypeScript(value: unknown, opts: TsOptions = {}): string {
  const style = opts.style ?? 'interface'
  const exp = opts.exportTypes === false ? '' : 'export '
  let rootName = toPascal(opts.rootName?.trim() || 'Root')
  if (BUILTIN.has(rootName.toLowerCase())) rootName += 'Type'
  const used = new Set<string>([rootName])
  const decls: string[] = []

  const unique = (base: string) => {
    let n = toPascal(base)
    if (BUILTIN.has(n.toLowerCase())) n += 'Type'
    if (!used.has(n)) {
      used.add(n)
      return n
    }
    let i = 2
    while (used.has(n + i)) i++
    n += i
    used.add(n)
    return n
  }

  const render = (t: T, hint: string): string => {
    if (t.k === 'prim') return t.name
    if (t.k === 'arr') {
      if (!t.el) return 'unknown[]'
      const inner = render(t.el, singular(hint))
      return t.el.k === 'union' ? `(${inner})[]` : `${inner}[]`
    }
    if (t.k === 'union') {
      const rank = (x: T) => (x.k === 'prim' && x.name === 'null' ? 1 : 0)
      return [...t.items].sort((a, b) => rank(a) - rank(b)).map((x) => render(x, hint)).join(' | ')
    }
    if (t.props.size === 0) return 'Record<string, unknown>'
    const name = unique(hint)
    declare(name, t)
    return name
  }

  const declare = (name: string, t: Obj) => {
    const idx = decls.length
    decls.push('')
    const lines: string[] = []
    for (const [k, p] of t.props) lines.push(`  ${propKey(k)}${p.opt ? '?' : ''}: ${render(p.t, k)}`)
    decls[idx] =
      style === 'interface'
        ? `${exp}interface ${name} {\n${lines.join('\n')}\n}`
        : `${exp}type ${name} = {\n${lines.map((l) => l + ';').join('\n')}\n}`
  }

  const root = infer(value)
  if (root.k === 'obj' && root.props.size > 0) {
    declare(rootName, root)
  } else {
    const slot = decls.length
    decls.push('')
    const expr = root.k === 'obj' ? 'Record<string, unknown>' : render(root, root.k === 'arr' ? `${rootName}Item` : rootName)
    decls[slot] = `${exp}type ${rootName} = ${expr}`
  }
  return decls.join('\n\n') + '\n'
}
