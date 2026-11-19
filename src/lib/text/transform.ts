/** Pure text helpers for sort lines, find and replace, slugs and whitespace cleanup. */

export type SortMode = 'az' | 'za' | 'numeric' | 'numeric-desc' | 'length' | 'reverse' | 'shuffle'

export interface SortOptions {
  mode: SortMode
  caseSensitive: boolean
  removeEmpty: boolean
  /** Injected for tests. */
  random?: () => number
}

export function sortLines(text: string, o: SortOptions): string {
  if (!text) return ''
  let lines = text.replace(/\r\n?/g, '\n').split('\n')
  if (o.removeEmpty) lines = lines.filter((l) => l.trim() !== '')
  const cmp = (a: string, b: string) =>
    o.caseSensitive ? (a < b ? -1 : a > b ? 1 : 0) : a.localeCompare(b, undefined, { sensitivity: 'base', numeric: false })
  const num = (s: string) => {
    const m = s.match(/-?\d+(\.\d+)?/)
    return m ? Number(m[0]) : Number.NaN
  }
  const numCmp = (a: string, b: string) => {
    const x = num(a)
    const y = num(b)
    if (Number.isNaN(x) && Number.isNaN(y)) return cmp(a, b)
    if (Number.isNaN(x)) return 1
    if (Number.isNaN(y)) return -1
    return x - y
  }
  switch (o.mode) {
    case 'az':
      lines.sort(cmp)
      break
    case 'za':
      lines.sort((a, b) => cmp(b, a))
      break
    case 'numeric':
      lines.sort(numCmp)
      break
    case 'numeric-desc':
      lines.sort((a, b) => numCmp(b, a))
      break
    case 'length':
      lines.sort((a, b) => a.length - b.length || cmp(a, b))
      break
    case 'reverse':
      lines.reverse()
      break
    case 'shuffle': {
      const r = o.random ?? Math.random
      for (let i = lines.length - 1; i > 0; i--) {
        const j = Math.floor(r() * (i + 1))
        ;[lines[i], lines[j]] = [lines[j], lines[i]]
      }
      break
    }
  }
  return lines.join('\n')
}

export interface ReplaceOptions {
  caseSensitive: boolean
  wholeWord: boolean
  regex: boolean
}

export interface ReplaceResult {
  output: string
  count: number
  error?: string
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export function findReplace(text: string, find: string, replacement: string, o: ReplaceOptions): ReplaceResult {
  if (!find) return { output: text, count: 0 }
  let source = o.regex ? find : escapeRe(find)
  if (o.wholeWord) source = `\\b(?:${source})\\b`
  let re: RegExp
  try {
    re = new RegExp(source, o.caseSensitive ? 'gu' : 'giu')
  } catch (e) {
    return { output: text, count: 0, error: e instanceof Error ? e.message : 'Invalid pattern' }
  }
  const count = [...text.matchAll(re)].length
  // In literal mode a $ in the replacement must stay a $.
  const output = o.regex ? text.replace(re, replacement) : text.replace(re, () => replacement)
  return { output, count }
}

/** Lowercase, ASCII-only, hyphen-separated. Accents are stripped, not dropped. */
export function slugify(text: string, opts: { separator?: '-' | '_'; maxLength?: number } = {}): string {
  const sep = opts.separator ?? '-'
  let s = text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ß/g, 'ss')
    .replace(/[æÆ]/g, 'ae')
    .replace(/[øØ]/g, 'o')
    .replace(/[đĐ]/g, 'd')
    .replace(/&/g, ' and ')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, sep)
    .replace(new RegExp(`^${escapeRe(sep)}+|${escapeRe(sep)}+$`, 'g'), '')
  if (opts.maxLength && s.length > opts.maxLength) {
    s = s.slice(0, opts.maxLength)
    const cut = s.lastIndexOf(sep)
    if (cut > opts.maxLength * 0.5) s = s.slice(0, cut)
    s = s.replace(new RegExp(`${escapeRe(sep)}+$`), '')
  }
  return s
}

export interface CleanOptions {
  collapseSpaces: boolean
  trimLines: boolean
  removeEmptyLines: boolean
  collapseEmptyLines: boolean
  /** Join all lines into one paragraph. */
  removeLineBreaks: boolean
}

export function cleanWhitespace(text: string, o: CleanOptions): string {
  let s = text.replace(/\r\n?/g, '\n').replace(/ /g, ' ')
  if (o.collapseSpaces) s = s.replace(/[ \t]{2,}/g, ' ')
  let lines = s.split('\n')
  if (o.trimLines) lines = lines.map((l) => l.trim())
  if (o.removeEmptyLines) lines = lines.filter((l) => l.trim() !== '')
  else if (o.collapseEmptyLines) {
    const out: string[] = []
    for (const l of lines) if (!(l.trim() === '' && out.length && out[out.length - 1].trim() === '')) out.push(l)
    lines = out
  }
  if (o.removeLineBreaks) return lines.filter((l) => l.trim() !== '').join(' ').replace(/ {2,}/g, ' ').trim()
  return lines.join('\n')
}
