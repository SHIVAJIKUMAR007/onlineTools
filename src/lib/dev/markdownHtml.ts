// Small hand-written Markdown parser and HTML renderer. Pure functions, no DOM.
// Raw HTML in the source is never passed through: every "<" and "&" is escaped, and unsafe URLs are dropped.

export type Inline =
  | { t: 'text'; v: string }
  | { t: 'code'; v: string }
  | { t: 'em'; c: Inline[] }
  | { t: 'strong'; c: Inline[] }
  | { t: 'del'; c: Inline[] }
  | { t: 'link'; href: string; title: string; c: Inline[] }
  | { t: 'image'; src: string; alt: string; title: string }
  | { t: 'br' }

export type Align = 'left' | 'center' | 'right' | null

export type Block =
  | { t: 'heading'; level: number; c: Inline[] }
  | { t: 'p'; c: Inline[] }
  | { t: 'code'; lang: string; v: string }
  | { t: 'quote'; c: Block[] }
  | { t: 'list'; ordered: boolean; start: number; tight: boolean; items: Block[][] }
  | { t: 'hr' }
  | { t: 'table'; align: Align[]; head: Inline[][]; rows: Inline[][][] }

export const escapeHtml = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// ───────────── URLs ─────────────
function cleanUrl(raw: string): string {
  // eslint-disable-next-line no-control-regex
  return raw.trim().replace(/[\u0000-\u001f\u007f\s]+/g, '')
}

/** Returns a safe link target or '' when the URL is not allowed (javascript:, vbscript:, data: and so on). */
export function safeLinkUrl(raw: string): string {
  const u = cleanUrl(raw)
  if (!u) return ''
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(u)
  if (!scheme) return u
  return /^(https?|mailto|tel)$/i.test(scheme[1]) ? u : ''
}

export function safeImageUrl(raw: string): string {
  const u = cleanUrl(raw)
  if (!u) return ''
  if (/^data:image\/(png|jpe?g|gif|webp);base64,[a-z0-9+/=]+$/i.test(u)) return u
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(u)
  if (!scheme) return u
  return /^https?$/i.test(scheme[1]) ? u : ''
}

// ───────────── inline ─────────────
const PUNCT = /[!-/:-@[-`{-~]/

function findCloser(s: string, from: number, ch: string, len: number): number {
  let i = from
  while (i < s.length) {
    const c = s[i]
    if (c === '\\') {
      i += 2
      continue
    }
    if (c === '`') {
      let n = 1
      while (s[i + n] === '`') n++
      const close = s.indexOf('`'.repeat(n), i + n)
      i = close === -1 ? i + n : close + n
      continue
    }
    if (c === ch) {
      let n = 1
      while (s[i + n] === ch) n++
      if (len === 1 && n === 1) {
        if (!/\s/.test(s[i - 1] ?? ' ') && (ch !== '_' || !/[A-Za-z0-9]/.test(s[i + 1] ?? ' '))) return i
      } else if (len === 2 && n >= 2) {
        const pos = i + n - 2
        if (pos > from && !/\s/.test(s[pos - 1] ?? ' ')) return pos
      }
      i += n
      continue
    }
    i++
  }
  return -1
}

function parseLinkTail(s: string, at: number): { href: string; title: string; end: number } | null {
  // at points just after "]" and expects "(".
  if (s[at] !== '(') return null
  let i = at + 1
  while (s[i] === ' ') i++
  let href = ''
  if (s[i] === '<') {
    const close = s.indexOf('>', i)
    if (close === -1) return null
    href = s.slice(i + 1, close)
    i = close + 1
  } else {
    let depth = 0
    const start = i
    while (i < s.length) {
      const c = s[i]
      if (c === '\\') {
        i += 2
        continue
      }
      if (c === ' ' || c === '\n') break
      if (c === '(') depth++
      if (c === ')') {
        if (depth === 0) break
        depth--
      }
      i++
    }
    href = s.slice(start, i).replace(/\\([!-/:-@[-`{-~])/g, '$1')
  }
  while (s[i] === ' ' || s[i] === '\n') i++
  let title = ''
  if (s[i] === '"' || s[i] === "'" || s[i] === '(') {
    const q = s[i] === '(' ? ')' : s[i]
    const close = s.indexOf(q, i + 1)
    if (close === -1) return null
    title = s.slice(i + 1, close)
    i = close + 1
    while (s[i] === ' ') i++
  }
  if (s[i] !== ')') return null
  return { href, title, end: i + 1 }
}

function findBracketEnd(s: string, from: number): number {
  let depth = 0
  for (let i = from; i < s.length; i++) {
    const c = s[i]
    if (c === '\\') {
      i++
      continue
    }
    if (c === '`') {
      const close = s.indexOf('`', i + 1)
      if (close !== -1) i = close
      continue
    }
    if (c === '[') depth++
    else if (c === ']') {
      if (depth === 0) return i
      depth--
    }
  }
  return -1
}

export function parseInline(s: string): Inline[] {
  const out: Inline[] = []
  let buf = ''
  const flush = () => {
    if (buf) {
      out.push({ t: 'text', v: buf })
      buf = ''
    }
  }
  let i = 0
  while (i < s.length) {
    const c = s[i]
    if (c === '\\' && i + 1 < s.length && PUNCT.test(s[i + 1])) {
      buf += s[i + 1]
      i += 2
      continue
    }
    if (c === '\n') {
      const hard = / {2,}$/.test(buf) || buf.endsWith('\\')
      if (buf.endsWith('\\')) buf = buf.slice(0, -1)
      buf = buf.replace(/ +$/, '')
      if (hard) {
        flush()
        out.push({ t: 'br' })
      } else buf += '\n'
      i++
      while (s[i] === ' ') i++
      continue
    }
    if (c === '`') {
      let n = 1
      while (s[i + n] === '`') n++
      const close = s.indexOf('`'.repeat(n), i + n)
      if (close !== -1 && s[close + n] !== '`') {
        let code = s.slice(i + n, close).replace(/\n/g, ' ')
        if (code.length > 2 && code.startsWith(' ') && code.endsWith(' ') && code.trim()) code = code.slice(1, -1)
        flush()
        out.push({ t: 'code', v: code })
        i = close + n
        continue
      }
      buf += '`'.repeat(n)
      i += n
      continue
    }
    if (c === '!' && s[i + 1] === '[') {
      const end = findBracketEnd(s, i + 2)
      const tail = end === -1 ? null : parseLinkTail(s, end + 1)
      if (end !== -1 && tail) {
        flush()
        out.push({ t: 'image', src: tail.href, alt: s.slice(i + 2, end).replace(/[*_`\\]/g, ''), title: tail.title })
        i = tail.end
        continue
      }
    }
    if (c === '[') {
      const end = findBracketEnd(s, i + 1)
      const tail = end === -1 ? null : parseLinkTail(s, end + 1)
      if (end !== -1 && tail) {
        flush()
        out.push({ t: 'link', href: tail.href, title: tail.title, c: parseInline(s.slice(i + 1, end)) })
        i = tail.end
        continue
      }
    }
    if (c === '<') {
      const m = /^<((?:https?:\/\/|mailto:)[^\s<>]+)>/i.exec(s.slice(i))
      if (m) {
        flush()
        out.push({ t: 'link', href: m[1], title: '', c: [{ t: 'text', v: m[1] }] })
        i += m[0].length
        continue
      }
    }
    if (c === '*' || c === '_' || c === '~') {
      let run = 1
      while (s[i + run] === c) run++
      const next = s[i + run] ?? ' '
      const prev = s[i - 1] ?? ' '
      const canOpen = !/\s/.test(next) && (c !== '_' || !/[A-Za-z0-9]/.test(prev))
      if (c === '~' ? run === 2 && canOpen : canOpen) {
        const len = c === '~' ? 2 : run >= 2 ? 2 : 1
        const close = findCloser(s, i + len, c, len)
        if (close !== -1) {
          flush()
          const inner = parseInline(s.slice(i + len, close))
          out.push(c === '~' ? { t: 'del', c: inner } : len === 2 ? { t: 'strong', c: inner } : { t: 'em', c: inner })
          i = close + len
          continue
        }
      }
      buf += c.repeat(run)
      i += run
      continue
    }
    buf += c
    i++
  }
  flush()
  return out
}

// ───────────── blocks ─────────────
const FENCE = /^ {0,3}(`{3,}|~{3,})\s*([^`\s]*)[^`]*$/
const ATX = /^ {0,3}(#{1,6})(?:[ \t]+(.*?))?(?:[ \t]+#+)?[ \t]*$/
const HR = /^ {0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/
const QUOTE = /^ {0,3}>/
const ITEM = /^( *)([-*+]|\d{1,9}[.)])(?:[ \t]+(.*)|[ \t]*)$/
const SETEXT = /^ {0,3}(=+|-+)[ \t]*$/
const TABLE_SEP = /^\s*\|?\s*:?-+:?\s*(?:\|\s*:?-+:?\s*)*\|?\s*$/

function splitRow(line: string): string[] {
  let t = line.trim()
  if (t.startsWith('|')) t = t.slice(1)
  if (t.endsWith('|') && !t.endsWith('\\|')) t = t.slice(0, -1)
  const cells: string[] = []
  let cur = ''
  for (let i = 0; i < t.length; i++) {
    if (t[i] === '\\' && t[i + 1] === '|') {
      cur += '|'
      i++
    } else if (t[i] === '`') {
      const close = t.indexOf('`', i + 1)
      if (close === -1) cur += t[i]
      else {
        cur += t.slice(i, close + 1)
        i = close
      }
    } else if (t[i] === '|') {
      cells.push(cur.trim())
      cur = ''
    } else cur += t[i]
  }
  cells.push(cur.trim())
  return cells
}

function startsBlock(line: string, inPara: boolean): boolean {
  if (FENCE.test(line) || ATX.test(line) || HR.test(line) || QUOTE.test(line)) return true
  const m = ITEM.exec(line)
  if (m) {
    const ordered = /\d/.test(m[2])
    // Only interrupt a paragraph with non-empty items, and numbered ones only when they start at 1.
    if (!inPara) return true
    return !!m[3] && (!ordered || parseInt(m[2], 10) === 1)
  }
  return false
}

function indentOf(line: string): number {
  let n = 0
  for (const ch of line) {
    if (ch === ' ') n++
    else if (ch === '\t') n += 4 - (n % 4)
    else break
  }
  return n
}

function stripIndent(line: string, n: number): string {
  let i = 0
  let col = 0
  while (i < line.length && col < n && (line[i] === ' ' || line[i] === '\t')) {
    col += line[i] === '\t' ? 4 - (col % 4) : 1
    i++
  }
  return line.slice(i)
}

export function parseBlocks(lines: string[]): Block[] {
  const blocks: Block[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (!line.trim()) {
      i++
      continue
    }
    const fence = FENCE.exec(line)
    if (fence) {
      const marker = fence[1]
      const open = indentOf(line)
      const body: string[] = []
      i++
      while (i < lines.length && !new RegExp(`^ {0,3}${marker[0]}{${marker.length},}\\s*$`).test(lines[i])) {
        body.push(stripIndent(lines[i], Math.min(open, 3)))
        i++
      }
      i++
      blocks.push({ t: 'code', lang: fence[2], v: body.join('\n') })
      continue
    }
    const atx = ATX.exec(line)
    if (atx) {
      blocks.push({ t: 'heading', level: atx[1].length, c: parseInline((atx[2] ?? '').trim()) })
      i++
      continue
    }
    if (HR.test(line)) {
      blocks.push({ t: 'hr' })
      i++
      continue
    }
    if (QUOTE.test(line)) {
      const inner: string[] = []
      while (i < lines.length && lines[i].trim()) {
        if (QUOTE.test(lines[i])) inner.push(lines[i].replace(/^ {0,3}> ?/, ''))
        else if (!startsBlock(lines[i], true)) inner.push(lines[i])
        else break
        i++
      }
      blocks.push({ t: 'quote', c: parseBlocks(inner) })
      continue
    }
    const item = ITEM.exec(line)
    if (item) {
      const ordered = /\d/.test(item[2])
      const marker = item[2].slice(-1)
      const start = ordered ? parseInt(item[2], 10) : 1
      const items: Block[][] = []
      let loose = false
      while (i < lines.length) {
        const m = ITEM.exec(lines[i])
        if (!m || /\d/.test(m[2]) !== ordered || (ordered ? m[2].slice(-1) : m[2]) !== (ordered ? marker : item[2])) break
        const markerWidth = m[1].length + m[2].length
        const gap = (m[3] ?? '') === '' ? 1 : Math.min(Math.max(/^[ \t]*/.exec(lines[i].slice(markerWidth))![0].length, 1), 4)
        const contentIndent = markerWidth + gap
        const body: string[] = [m[3] ?? '']
        i++
        while (i < lines.length) {
          const l = lines[i]
          if (!l.trim()) {
            let j = i
            while (j < lines.length && !lines[j].trim()) j++
            if (j < lines.length && indentOf(lines[j]) >= contentIndent) {
              loose = true
              for (; i < j; i++) body.push('')
              continue
            }
            break
          }
          if (indentOf(l) >= contentIndent) {
            body.push(stripIndent(l, contentIndent))
            i++
            continue
          }
          const prevBlank = !lines[i - 1].trim()
          if (!prevBlank && !startsBlock(l, true) && !ITEM.test(l)) {
            body.push(l.trim())
            i++
            continue
          }
          break
        }
        items.push(parseBlocks(body))
        // A blank line between two items makes the list loose.
        if (i < lines.length && !lines[i].trim()) {
          let j = i
          while (j < lines.length && !lines[j].trim()) j++
          const n = j < lines.length ? ITEM.exec(lines[j]) : null
          if (n && /\d/.test(n[2]) === ordered && (ordered ? n[2].slice(-1) === marker : n[2] === item[2]) && indentOf(lines[j]) < contentIndent) {
            loose = true
            i = j
          }
        }
      }
      blocks.push({ t: 'list', ordered, start, tight: !loose, items })
      continue
    }
    if (line.includes('|') && i + 1 < lines.length && TABLE_SEP.test(lines[i + 1]) && lines[i + 1].includes('-')) {
      const head = splitRow(line)
      const seps = splitRow(lines[i + 1])
      if (head.length === seps.length && (line.includes('|') || seps.length > 1)) {
        const align: Align[] = seps.map((s) => (s.startsWith(':') && s.endsWith(':') ? 'center' : s.endsWith(':') ? 'right' : s.startsWith(':') ? 'left' : null))
        i += 2
        const rows: Inline[][][] = []
        while (i < lines.length && lines[i].trim() && !startsBlock(lines[i], true)) {
          const cells = splitRow(lines[i])
          rows.push(head.map((_, k) => parseInline(cells[k] ?? '')))
          i++
        }
        blocks.push({ t: 'table', align, head: head.map((h) => parseInline(h)), rows })
        continue
      }
    }
    if (indentOf(line) >= 4) {
      const body: string[] = []
      while (i < lines.length && (indentOf(lines[i]) >= 4 || !lines[i].trim())) {
        body.push(stripIndent(lines[i], 4))
        i++
      }
      while (body.length && !body[body.length - 1].trim()) body.pop()
      blocks.push({ t: 'code', lang: '', v: body.join('\n') })
      continue
    }
    // paragraph (with setext heading support)
    const para: string[] = [line.replace(/^\s+/, '')]
    i++
    let setext = 0
    while (i < lines.length && lines[i].trim()) {
      const s = SETEXT.exec(lines[i])
      if (s) {
        setext = s[1][0] === '=' ? 1 : 2
        i++
        break
      }
      if (startsBlock(lines[i], true)) break
      para.push(lines[i].replace(/^\s+/, ''))
      i++
    }
    if (setext) blocks.push({ t: 'heading', level: setext, c: parseInline(para.join('\n')) })
    else blocks.push({ t: 'p', c: parseInline(para.join('\n')) })
  }
  return blocks
}

export function parseMarkdown(src: string): Block[] {
  return parseBlocks(src.replace(/\r\n?/g, '\n').replace(/\u0000/g, '�').split('\n'))
}

// ───────────── HTML output ─────────────
export function inlineToHtml(nodes: Inline[]): string {
  return nodes
    .map((n): string => {
      switch (n.t) {
        case 'text':
          return escapeHtml(n.v)
        case 'code':
          return `<code>${escapeHtml(n.v)}</code>`
        case 'em':
          return `<em>${inlineToHtml(n.c)}</em>`
        case 'strong':
          return `<strong>${inlineToHtml(n.c)}</strong>`
        case 'del':
          return `<del>${inlineToHtml(n.c)}</del>`
        case 'br':
          return '<br>\n'
        case 'link': {
          const href = safeLinkUrl(n.href)
          if (!href) return inlineToHtml(n.c)
          return `<a href="${escapeHtml(href)}"${n.title ? ` title="${escapeHtml(n.title)}"` : ''}>${inlineToHtml(n.c)}</a>`
        }
        case 'image': {
          const src = safeImageUrl(n.src)
          if (!src) return escapeHtml(n.alt)
          return `<img src="${escapeHtml(src)}" alt="${escapeHtml(n.alt)}"${n.title ? ` title="${escapeHtml(n.title)}"` : ''}>`
        }
      }
    })
    .join('')
}

export function safeLang(lang: string): string {
  return /^[A-Za-z0-9_+#.-]{1,30}$/.test(lang) ? lang : ''
}

function blockToHtml(b: Block, tight: boolean): string {
  switch (b.t) {
    case 'heading':
      return `<h${b.level}>${inlineToHtml(b.c)}</h${b.level}>`
    case 'p':
      return tight ? inlineToHtml(b.c) : `<p>${inlineToHtml(b.c)}</p>`
    case 'hr':
      return '<hr>'
    case 'code': {
      const lang = safeLang(b.lang)
      return `<pre><code${lang ? ` class="language-${escapeHtml(lang)}"` : ''}>${escapeHtml(b.v)}\n</code></pre>`
    }
    case 'quote':
      return `<blockquote>\n${blocksToHtml(b.c)}\n</blockquote>`
    case 'list': {
      const tag = b.ordered ? 'ol' : 'ul'
      const open = `<${tag}${b.ordered && b.start !== 1 ? ` start="${b.start}"` : ''}>`
      const lis = b.items.map((it) => {
        const inner = it.map((x) => blockToHtml(x, b.tight)).join('\n')
        const block = it.some((x) => x.t !== 'p')
        return `<li>${b.tight && block && it[0]?.t !== 'p' ? '\n' : ''}${inner}${b.tight && block && it[it.length - 1]?.t !== 'p' ? '\n' : ''}</li>`
      })
      return `${open}\n${lis.join('\n')}\n</${tag}>`
    }
    case 'table': {
      const style = (a: Align) => (a ? ` style="text-align:${a}"` : '')
      const th = b.head.map((c, k) => `<th${style(b.align[k])}>${inlineToHtml(c)}</th>`).join('')
      const body = b.rows.map((r) => `<tr>${r.map((c, k) => `<td${style(b.align[k])}>${inlineToHtml(c)}</td>`).join('')}</tr>`).join('\n')
      return `<table>\n<thead>\n<tr>${th}</tr>\n</thead>${b.rows.length ? `\n<tbody>\n${body}\n</tbody>` : ''}\n</table>`
    }
  }
}

export function blocksToHtml(blocks: Block[]): string {
  return blocks.map((b) => blockToHtml(b, false)).join('\n')
}

export function markdownToHtml(src: string): string {
  return blocksToHtml(parseMarkdown(src))
}
