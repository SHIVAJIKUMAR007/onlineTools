/**
 * Hand-written HTML beautifier and minifier. It tokenizes the markup itself (no DOMParser), so it never
 * normalises, repairs or validates what you give it.
 */
export const VOID = new Set(['area', 'base', 'br', 'col', 'command', 'embed', 'hr', 'img', 'input', 'keygen', 'link', 'meta', 'param', 'source', 'track', 'wbr'])
export const INLINE = new Set([
  'a', 'abbr', 'acronym', 'b', 'bdi', 'bdo', 'big', 'br', 'button', 'cite', 'code', 'data', 'del', 'dfn', 'em', 'font', 'i', 'img', 'input', 'ins', 'kbd',
  'label', 'mark', 'meter', 'output', 'progress', 'q', 's', 'samp', 'small', 'span', 'strike', 'strong', 'sub', 'sup', 'time', 'tt', 'u', 'var', 'wbr',
])
const RAW = new Set(['script', 'style', 'textarea', 'pre'])

interface OpenTok {
  t: 'open'
  name: string
  attrs: string[]
  selfClosing: boolean
}
type Tok =
  | OpenTok
  | { t: 'close'; name: string }
  | { t: 'text'; text: string }
  | { t: 'comment'; raw: string }
  | { t: 'doctype'; raw: string }
  | { t: 'raw'; open: OpenTok; body: string; close: string }

function parseOpenTag(src: string, start: number): { tok: OpenTok; end: number } | null {
  let i = start + 1
  const nm = /^[A-Za-z][^\s/>]*/.exec(src.slice(i, i + 80))
  if (!nm) return null
  const name = nm[0]
  i += name.length
  const attrs: string[] = []
  let selfClosing = false
  for (;;) {
    while (i < src.length && /\s/.test(src[i])) i++
    if (i >= src.length) return null
    if (src[i] === '>') {
      i++
      break
    }
    if (src[i] === '/' && src[i + 1] === '>') {
      selfClosing = true
      i += 2
      break
    }
    if (src[i] === '/') {
      i++
      continue
    }
    const an = /^[^\s=/>]+/.exec(src.slice(i))
    if (!an) return null
    let attr = an[0]
    i += attr.length
    let j = i
    while (j < src.length && /\s/.test(src[j])) j++
    if (src[j] === '=') {
      j++
      while (j < src.length && /\s/.test(src[j])) j++
      const q = src[j]
      if (q === '"' || q === "'") {
        const e = src.indexOf(q, j + 1)
        if (e < 0) return null
        attr += `=${src.slice(j, e + 1)}`
        i = e + 1
      } else {
        const m = /^[^\s>]+/.exec(src.slice(j))
        if (m) {
          attr += `=${m[0]}`
          i = j + m[0].length
        } else i = j
      }
    }
    attrs.push(attr)
  }
  return { tok: { t: 'open', name, attrs, selfClosing }, end: i }
}

function findClose(src: string, from: number, lname: string): { bodyEnd: number; end: number } {
  if (lname === 'pre') {
    let depth = 1
    const re = new RegExp(`<(/?)pre(?=[\\s/>])`, 'gi')
    re.lastIndex = from
    let m: RegExpExecArray | null
    while ((m = re.exec(src))) {
      depth += m[1] ? -1 : 1
      if (depth === 0) {
        const gt = src.indexOf('>', m.index)
        return { bodyEnd: m.index, end: gt < 0 ? src.length : gt + 1 }
      }
    }
    return { bodyEnd: src.length, end: src.length }
  }
  const re = new RegExp(`</${lname}(?=[\\s/>])`, 'i')
  const m = re.exec(src.slice(from))
  if (!m) return { bodyEnd: src.length, end: src.length }
  const at = from + m.index
  const gt = src.indexOf('>', at)
  return { bodyEnd: at, end: gt < 0 ? src.length : gt + 1 }
}

export function tokenize(src: string): Tok[] {
  const toks: Tok[] = []
  let i = 0
  let text = ''
  const flush = () => {
    if (text) toks.push({ t: 'text', text })
    text = ''
  }
  while (i < src.length) {
    const c = src[i]
    if (c !== '<') {
      const j = src.indexOf('<', i)
      const end = j < 0 ? src.length : j
      text += src.slice(i, end)
      i = end
      continue
    }
    if (src.startsWith('<!--', i)) {
      const e = src.indexOf('-->', i + 4)
      const end = e < 0 ? src.length : e + 3
      flush()
      toks.push({ t: 'comment', raw: src.slice(i, end) })
      i = end
    } else if (src.startsWith('<!', i) || src.startsWith('<?', i)) {
      const e = src.indexOf('>', i)
      const end = e < 0 ? src.length : e + 1
      flush()
      toks.push({ t: /^<!doctype/i.test(src.slice(i, i + 10)) ? 'doctype' : 'comment', raw: src.slice(i, end) })
      i = end
    } else if (src[i + 1] === '/') {
      const m = /^<\/([A-Za-z][^\s>/]*)[^>]*>/.exec(src.slice(i, i + 200))
      if (!m) {
        text += c
        i++
        continue
      }
      flush()
      toks.push({ t: 'close', name: m[1] })
      i += m[0].length
    } else {
      const p = parseOpenTag(src, i)
      if (!p) {
        text += c
        i++
        continue
      }
      flush()
      const lname = p.tok.name.toLowerCase()
      if (RAW.has(lname) && !p.tok.selfClosing) {
        const { bodyEnd, end } = findClose(src, p.end, lname)
        toks.push({ t: 'raw', open: p.tok, body: src.slice(p.end, bodyEnd), close: src.slice(bodyEnd, end) })
        i = end
      } else {
        toks.push(p.tok)
        i = p.end
      }
    }
  }
  flush()
  return toks
}

const renderOpen = (o: OpenTok): string => `<${o.name}${o.attrs.length ? ' ' + o.attrs.join(' ') : ''}${o.selfClosing ? ' />' : '>'}`

// ───────────── tree ─────────────
interface El {
  kind: 'el'
  open: OpenTok
  lname: string
  children: N[]
  closed: boolean
  isVoid: boolean
}
type N = El | { kind: 'text'; text: string } | { kind: 'leaf'; raw: string } | { kind: 'raw'; open: OpenTok; lname: string; body: string; close: string }

const BLOCKISH = new Set(['address', 'article', 'aside', 'blockquote', 'div', 'dl', 'fieldset', 'footer', 'form', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'hr', 'main', 'nav', 'ol', 'p', 'section', 'table', 'ul'])
const AUTO_CLOSE: Record<string, string[]> = {
  li: ['li'],
  dt: ['dt', 'dd'],
  dd: ['dt', 'dd'],
  option: ['option'],
  optgroup: ['option', 'optgroup'],
  tr: ['tr', 'td', 'th'],
  td: ['td', 'th'],
  th: ['td', 'th'],
}

function buildTree(toks: Tok[]): N[] {
  const root: N[] = []
  const stack: El[] = []
  const add = (n: N) => (stack.length ? stack[stack.length - 1].children : root).push(n)
  for (const t of toks) {
    if (t.t === 'text') add({ kind: 'text', text: t.text })
    else if (t.t === 'comment' || t.t === 'doctype') add({ kind: 'leaf', raw: t.raw })
    else if (t.t === 'raw') add({ kind: 'raw', open: t.open, lname: t.open.name.toLowerCase(), body: t.body, close: t.close })
    else if (t.t === 'open') {
      const lname = t.name.toLowerCase()
      const top = stack[stack.length - 1]
      if (top && !top.closed) {
        if (AUTO_CLOSE[lname]?.includes(top.lname) || (top.lname === 'p' && BLOCKISH.has(lname))) stack.pop()
      }
      const isVoid = VOID.has(lname)
      const el: El = { kind: 'el', open: t, lname, children: [], closed: isVoid || t.selfClosing, isVoid }
      add(el)
      if (!isVoid && !t.selfClosing) stack.push(el)
    } else {
      const lname = t.name.toLowerCase()
      let k = stack.length - 1
      while (k >= 0 && stack[k].lname !== lname) k--
      if (k < 0) add({ kind: 'leaf', raw: `</${t.name}>` })
      else {
        stack[k].closed = true
        stack.length = k
      }
    }
  }
  return root
}

// ───────────── beautify ─────────────
export interface BeautifyOptions {
  /** Spaces per level, or 'tab'. */
  indent: number | 'tab'
  /** Re-indent the body of script and style elements. Off keeps it exactly as written. */
  indentScripts: boolean
  /** Put each attribute on its own line when the start tag is longer than wrapWidth. */
  wrapAttributes: boolean
  wrapWidth?: number
}

export const DEFAULT_BEAUTIFY: BeautifyOptions = { indent: 2, indentScripts: false, wrapAttributes: false, wrapWidth: 100 }

const collapse = (s: string) => s.replace(/\s+/g, ' ')

function isInline(n: N): boolean {
  if (n.kind === 'text') return true
  if (n.kind === 'el') return INLINE.has(n.lname) && n.children.every(isInline)
  return false
}

function renderInline(n: N): string {
  if (n.kind === 'text') return collapse(n.text)
  if (n.kind !== 'el') return ''
  let s = renderOpen(n.open)
  if (n.isVoid || n.open.selfClosing) return s
  s += n.children.map(renderInline).join('')
  if (n.closed) s += `</${n.open.name}>`
  return s
}

export function beautifyHtml(src: string, options: Partial<BeautifyOptions> = {}): string {
  const o = { ...DEFAULT_BEAUTIFY, ...options }
  const unit = o.indent === 'tab' ? '\t' : ' '.repeat(Math.max(0, Math.min(16, o.indent)))
  const width = o.wrapWidth ?? 100
  const ind = (d: number) => unit.repeat(d)
  const lines: string[] = []

  const openLines = (el: OpenTok, depth: number, tail: string): string[] => {
    const one = renderOpen(el)
    if (!o.wrapAttributes || el.attrs.length < 2 || ind(depth).length + one.length + tail.length <= width) return [ind(depth) + one]
    const out = [`${ind(depth)}<${el.name}`]
    el.attrs.forEach((a, i) => out.push(ind(depth + 1) + a + (i === el.attrs.length - 1 ? (el.selfClosing ? ' />' : '>') : '')))
    return out
  }

  const dedent = (body: string, depth: number): string[] => {
    const ls = body.replace(/\r\n?/g, '\n').split('\n')
    while (ls.length && !ls[0].trim()) ls.shift()
    while (ls.length && !ls[ls.length - 1].trim()) ls.pop()
    const min = Math.min(...ls.filter((l) => l.trim()).map((l) => /^[ \t]*/.exec(l)![0].length), Infinity)
    return ls.map((l) => (l.trim() ? ind(depth) + l.slice(min).replace(/\s+$/, '') : ''))
  }

  const block = (n: N, depth: number) => {
    if (n.kind === 'leaf') {
      lines.push(ind(depth) + n.raw)
      return
    }
    if (n.kind === 'raw') {
      const ol = openLines(n.open, depth, '')
      const closeTag = n.close ? `</${n.open.name}>` : ''
      if ((n.lname === 'script' || n.lname === 'style') && o.indentScripts) {
        if (!n.body.trim()) {
          lines.push(...ol.slice(0, -1), ol[ol.length - 1] + closeTag)
        } else {
          lines.push(...ol, ...dedent(n.body, depth + 1), ind(depth) + closeTag)
        }
        return
      }
      const last = ol.length - 1
      const joined = [...ol.slice(0, last), ol[last] + n.body + closeTag]
      lines.push(...joined)
      return
    }
    if (n.kind === 'text') return
    const tail = n.closed && !n.isVoid ? `</${n.open.name}>` : ''
    if (n.isVoid || n.open.selfClosing) {
      lines.push(...openLines(n.open, depth, ''))
      return
    }
    const kids = n.children
    if (kids.every((k) => k.kind === 'text' && !k.text.trim())) {
      const ol = openLines(n.open, depth, tail)
      lines.push(...ol.slice(0, -1), ol[ol.length - 1] + tail)
      return
    }
    if (kids.every(isInline)) {
      const content = collapse(kids.map(renderInline).join('')).trim()
      const ol = openLines(n.open, depth, content + tail)
      if (ol.length === 1 && ol[0].length + content.length + tail.length <= width) {
        lines.push(ol[0] + content + tail)
        return
      }
      lines.push(...ol, ind(depth + 1) + content)
      if (tail) lines.push(ind(depth) + tail)
      return
    }
    lines.push(...openLines(n.open, depth, ''))
    children(kids, depth + 1)
    if (tail) lines.push(ind(depth) + tail)
  }

  const children = (nodes: N[], depth: number) => {
    let buf = ''
    const flush = () => {
      const s = buf.trim()
      if (s) lines.push(ind(depth) + s)
      buf = ''
    }
    for (const n of nodes) {
      if (isInline(n)) buf += renderInline(n)
      else {
        flush()
        block(n, depth)
      }
    }
    flush()
  }

  children(buildTree(tokenize(src)), 0)
  return lines.join('\n')
}

// ───────────── minify ─────────────
export interface MinifyOptions {
  removeComments: boolean
}

type Piece = { s: string; kind: 'text' | 'block' | 'inline' }

export function minifyHtml(src: string, options: Partial<MinifyOptions> = {}): string {
  const removeComments = options.removeComments ?? true
  const pieces: Piece[] = []
  for (const t of tokenize(src)) {
    if (t.t === 'text') {
      const last = pieces[pieces.length - 1]
      if (last && last.kind === 'text') last.s += t.text
      else pieces.push({ s: t.text, kind: 'text' })
    } else if (t.t === 'comment') {
      const keep = !removeComments || /^<!--\[if|^<!\[endif|^<!\[CDATA\[|^<\?/i.test(t.raw)
      if (keep) pieces.push({ s: t.raw, kind: 'block' })
    } else if (t.t === 'doctype') pieces.push({ s: t.raw, kind: 'block' })
    else if (t.t === 'open') pieces.push({ s: renderOpen(t), kind: INLINE.has(t.name.toLowerCase()) ? 'inline' : 'block' })
    else if (t.t === 'close') pieces.push({ s: `</${t.name}>`, kind: INLINE.has(t.name.toLowerCase()) ? 'inline' : 'block' })
    else pieces.push({ s: renderOpen(t.open) + t.body + t.close, kind: t.open.name.toLowerCase() === 'textarea' ? 'inline' : 'block' })
  }
  let out = ''
  pieces.forEach((p, i) => {
    if (p.kind !== 'text') {
      out += p.s
      return
    }
    let s = collapse(p.s)
    const prev = pieces[i - 1]
    const next = pieces[i + 1]
    if (!prev || prev.kind === 'block') s = s.replace(/^ /, '')
    if (!next || next.kind === 'block') s = s.replace(/ $/, '')
    out += s
  })
  return out
}
