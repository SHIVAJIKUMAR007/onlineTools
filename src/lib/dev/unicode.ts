export type Scope = 'all' | 'nonAscii'

export const hex = (n: number, pad = 4) => n.toString(16).toUpperCase().padStart(pad, '0')

export function codePointsOf(text: string): number[] {
  return Array.from(text, (c) => c.codePointAt(0) as number)
}

const isAscii = (cp: number) => cp < 0x80

export const toCodePoints = (text: string): string => codePointsOf(text).map((c) => `U+${hex(c)}`).join(' ')

export const toUtf8Hex = (text: string): string =>
  Array.from(new TextEncoder().encode(text), (b) => hex(b, 2)).join(' ')

export function toUtf16Units(text: string): string {
  const out: string[] = []
  for (let i = 0; i < text.length; i++) out.push(hex(text.charCodeAt(i)))
  return out.join(' ')
}

export function toHtmlEntities(text: string, base: 'dec' | 'hex', scope: Scope = 'all'): string {
  return codePointsOf(text)
    .map((c) => (scope === 'nonAscii' && isAscii(c) ? String.fromCodePoint(c) : base === 'dec' ? `&#${c};` : `&#x${hex(c, 1)};`))
    .join('')
}

/** JavaScript and JSON escapes. 'js' writes surrogate pairs (😀), 'es6' writes \u{1F600}. */
export function toJsEscapes(text: string, style: 'js' | 'es6' = 'js', scope: Scope = 'all'): string {
  return codePointsOf(text)
    .map((c) => {
      if (scope === 'nonAscii' && isAscii(c)) return String.fromCodePoint(c)
      if (c > 0xffff) {
        if (style === 'es6') return `\\u{${hex(c, 1)}}`
        const v = c - 0x10000
        return `\\u${hex(0xd800 + (v >> 10))}\\u${hex(0xdc00 + (v & 0x3ff))}`
      }
      return `\\u${hex(c)}`
    })
    .join('')
}

export function toCssEscapes(text: string, scope: Scope = 'all'): string {
  const cps = codePointsOf(text)
  let out = ''
  cps.forEach((c, i) => {
    if (scope === 'nonAscii' && isAscii(c)) {
      out += String.fromCodePoint(c)
      return
    }
    out += `\\${hex(c, 1)}`
    // A space ends the escape, so a following hex digit or space is not read as part of it.
    const n = cps[i + 1]
    if (n === undefined) return
    const literal = scope === 'nonAscii' && isAscii(n)
    if (!literal || /[0-9a-fA-F\s]/.test(String.fromCodePoint(n))) out += ' '
  })
  return out
}

// ───────────── reverse ─────────────
export interface DecodeResult {
  text: string
  errors: string[]
}

const MAX_CP = 0x10ffff

export function parseCodePoints(input: string): DecodeResult {
  const errors: string[] = []
  let text = ''
  for (const tok of input.split(/[\s,;]+/).filter(Boolean)) {
    const m = /^(?:U\+|u\+|0x|\\u\{?|&#x|\\)?([0-9a-fA-F]{1,8})\}?;?$/.exec(tok)
    if (!m) {
      errors.push(`"${tok}" is not a code point. Use hex such as U+1F600 or 1F600.`)
      continue
    }
    const n = parseInt(m[1], 16)
    if (n > MAX_CP) {
      errors.push(`"${tok}" is above U+10FFFF, the last code point.`)
      continue
    }
    text += String.fromCodePoint(n)
  }
  return { text, errors }
}

/** Reads \uXXXX, \u{...}, \xXX and the common single-letter escapes. Surrogate pairs join automatically. */
export function unescapeJs(input: string): DecodeResult {
  const errors: string[] = []
  const simple: Record<string, string> = { n: '\n', t: '\t', r: '\r', b: '\b', f: '\f', v: '\v', '0': '\0', '\\': '\\', "'": "'", '"': '"', '/': '/' }
  const text = input.replace(/\\(?:u\{([0-9a-fA-F]+)\}|u([0-9a-fA-F]{4})|x([0-9a-fA-F]{2})|([\s\S]?))/g, (all, brace, four, two, other) => {
    if (brace !== undefined) {
      const n = parseInt(brace, 16)
      if (n > MAX_CP) {
        errors.push(`${all} is above U+10FFFF.`)
        return all
      }
      return String.fromCodePoint(n)
    }
    if (four !== undefined) return String.fromCharCode(parseInt(four, 16))
    if (two !== undefined) return String.fromCharCode(parseInt(two, 16))
    if (other in simple) return simple[other]
    if (other === 'u' || other === 'x') errors.push(`Incomplete \\${other} escape. \\u needs 4 hex digits and \\x needs 2.`)
    else if (other === '') errors.push('The text ends with a lone backslash.')
    return all
  })
  return { text, errors }
}

export function decodeNumericEntities(input: string): DecodeResult {
  const errors: string[] = []
  const text = input.replace(/&#(?:[xX]([0-9a-fA-F]+)|(\d+));/g, (all, h, d) => {
    const n = h !== undefined ? parseInt(h, 16) : parseInt(d, 10)
    if (n === 0 || n > MAX_CP || (n >= 0xd800 && n <= 0xdfff)) {
      errors.push(`${all} is not a valid character reference.`)
      return all
    }
    return String.fromCodePoint(n)
  })
  return { text, errors }
}

export function unescapeCss(input: string): DecodeResult {
  const errors: string[] = []
  const text = input.replace(/\\(?:([0-9a-fA-F]{1,6})(?:\r\n|[ \t\n\r\f])?|([\s\S]))/g, (_all, h, other) => {
    if (h !== undefined) {
      const n = parseInt(h, 16)
      if (n === 0 || n > MAX_CP || (n >= 0xd800 && n <= 0xdfff)) return '�'
      return String.fromCodePoint(n)
    }
    return other
  })
  return { text, errors }
}

export function hexToByteList(input: string): { bytes: Uint8Array; errors: string[] } {
  const errors: string[] = []
  const out: number[] = []
  const cleaned = input.replace(/0x|\\x|%/gi, ' ')
  for (const tok of cleaned.split(/[\s,;:-]+/).filter(Boolean)) {
    if (/^[0-9a-fA-F]+$/.test(tok) && tok.length % 2 === 0) {
      for (let i = 0; i < tok.length; i += 2) out.push(parseInt(tok.slice(i, i + 2), 16))
    } else errors.push(`"${tok}" is not hex bytes. Use pairs of digits such as F0 9F 98 80.`)
  }
  return { bytes: Uint8Array.from(out), errors }
}

/** Strict UTF-8 decoder that reports where invalid sequences are, instead of silently replacing them. */
export function decodeUtf8Strict(bytes: Uint8Array): DecodeResult {
  const errors: string[] = []
  let text = ''
  let i = 0
  const bad = (at: number, why: string) => {
    errors.push(`Byte ${at} (0x${hex(bytes[at], 2)}): ${why}`)
    text += '�'
  }
  while (i < bytes.length) {
    const b = bytes[i]
    if (b < 0x80) {
      text += String.fromCharCode(b)
      i++
      continue
    }
    if (b >= 0x80 && b <= 0xbf) {
      bad(i, 'unexpected continuation byte with no lead byte.')
      i++
      continue
    }
    const need = b >= 0xf0 && b <= 0xf4 ? 3 : b >= 0xe0 ? (b <= 0xef ? 2 : -1) : b >= 0xc2 ? 1 : -1
    if (need < 0) {
      bad(i, b < 0xc2 ? 'invalid lead byte (C0 and C1 would be overlong forms).' : 'invalid lead byte (F5 to FF never appear in UTF-8).')
      i++
      continue
    }
    let cp = b & (0x3f >> need)
    let j = 1
    let fail = ''
    for (; j <= need; j++) {
      const c = bytes[i + j]
      if (c === undefined) {
        fail = 'the sequence is cut off before it is complete.'
        break
      }
      if ((c & 0xc0) !== 0x80) {
        fail = `expected a continuation byte (80 to BF) at byte ${i + j} but found 0x${hex(c, 2)}.`
        break
      }
      cp = (cp << 6) | (c & 0x3f)
    }
    if (!fail) {
      if (need === 2 && cp < 0x800) fail = 'overlong encoding.'
      else if (need === 3 && cp < 0x10000) fail = 'overlong encoding.'
      else if (cp >= 0xd800 && cp <= 0xdfff) fail = 'encodes a surrogate, which UTF-8 does not allow.'
      else if (cp > MAX_CP) fail = 'is above U+10FFFF.'
    }
    if (fail) {
      bad(i, fail)
      i += fail.startsWith('overlong') || fail.startsWith('encodes') || fail.includes('above') ? need + 1 : Math.max(1, j)
    } else {
      text += String.fromCodePoint(cp)
      i += need + 1
    }
  }
  return { text, errors }
}

export function parseUtf8Hex(input: string): DecodeResult {
  const { bytes, errors } = hexToByteList(input)
  if (errors.length) return { text: '', errors }
  return decodeUtf8Strict(bytes)
}

// ───────────── analysis ─────────────
const CATEGORIES: [string, string][] = [
  ['Lu', 'Uppercase letter'], ['Ll', 'Lowercase letter'], ['Lt', 'Titlecase letter'], ['Lm', 'Modifier letter'], ['Lo', 'Other letter'],
  ['Mn', 'Nonspacing mark'], ['Mc', 'Spacing mark'], ['Me', 'Enclosing mark'],
  ['Nd', 'Decimal number'], ['Nl', 'Letter number'], ['No', 'Other number'],
  ['Pc', 'Connector punctuation'], ['Pd', 'Dash punctuation'], ['Ps', 'Open punctuation'], ['Pe', 'Close punctuation'],
  ['Pi', 'Initial quote'], ['Pf', 'Final quote'], ['Po', 'Other punctuation'],
  ['Sm', 'Math symbol'], ['Sc', 'Currency symbol'], ['Sk', 'Modifier symbol'], ['So', 'Other symbol'],
  ['Zs', 'Space separator'], ['Zl', 'Line separator'], ['Zp', 'Paragraph separator'],
  ['Cc', 'Control'], ['Cf', 'Format'], ['Cs', 'Surrogate'], ['Co', 'Private use'], ['Cn', 'Unassigned'],
]

let catRegexes: [string, string, RegExp][] | null = null

export function categoryOf(ch: string): { code: string; label: string } {
  try {
    catRegexes ??= CATEGORIES.map(([code, label]) => [code, label, new RegExp(`^\\p{${code}}$`, 'u')] as [string, string, RegExp])
    for (const [code, label, re] of catRegexes) if (re.test(ch)) return { code, label }
  } catch {
    /* Property escapes are unavailable in very old engines. */
  }
  return { code: '??', label: 'Unknown' }
}

export const utf8Length = (cp: number): number => (cp < 0x80 ? 1 : cp < 0x800 ? 2 : cp < 0x10000 ? 3 : 4)

export interface CharInfo {
  char: string
  cp: number
  category: string
  categoryLabel: string
  utf8: number
  utf16: number
}

export function analyzeChars(text: string, limit = 500): { rows: CharInfo[]; total: number } {
  const all = Array.from(text)
  const rows = all.slice(0, limit).map((char) => {
    const cp = char.codePointAt(0) as number
    const c = categoryOf(char)
    return { char, cp, category: c.code, categoryLabel: c.label, utf8: utf8Length(cp), utf16: char.length }
  })
  return { rows, total: all.length }
}

export function graphemeCount(text: string): number | null {
  const Seg = (Intl as unknown as { Segmenter?: new (l?: string, o?: { granularity: string }) => { segment(s: string): Iterable<unknown> } }).Segmenter
  if (!Seg) return null
  let n = 0
  for (const _ of new Seg(undefined, { granularity: 'grapheme' }).segment(text)) {
    void _
    n++
  }
  return n
}

export function utf8ByteLength(text: string): number {
  return new TextEncoder().encode(text).length
}
