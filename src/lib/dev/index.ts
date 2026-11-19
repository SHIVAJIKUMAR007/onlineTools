import { locateJsonError } from './jsonScan'

// ───────────── JSON ─────────────

export interface JsonError {
  message: string
  line: number
  column: number
  position: number
}

/** Convert a character offset to a 1-based line and column. */
export function positionToLineCol(text: string, position: number): { line: number; column: number } {
  const before = text.slice(0, Math.max(0, position))
  const lines = before.split('\n')
  return { line: lines.length, column: lines[lines.length - 1].length + 1 }
}

export function parseJson(text: string): { ok: true; value: unknown } | { ok: false; error: JsonError } {
  try {
    return { ok: true, value: JSON.parse(text) }
  } catch (e) {
    const located = locateJsonError(text)
    const position = located?.position ?? 0
    const message = located?.message ?? (e instanceof Error ? e.message : String(e))
    const { line, column } = positionToLineCol(text, position)
    return { ok: false, error: { message, line, column, position } }
  }
}

export function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeysDeep)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value as Record<string, unknown>)
        .sort()
        .map((k) => [k, sortKeysDeep((value as Record<string, unknown>)[k])]),
    )
  }
  return value
}

export type Indent = 2 | 4 | 'tab'

export function formatJson(value: unknown, indent: Indent = 2, sortKeys = false): string {
  const v = sortKeys ? sortKeysDeep(value) : value
  return JSON.stringify(v, null, indent === 'tab' ? '\t' : indent)
}

export function minifyJson(value: unknown): string {
  return JSON.stringify(value)
}

// ───────────── JSON → CSV ─────────────

export type Delimiter = ',' | ';' | '\t' | '|'

export function flattenObject(obj: unknown, prefix = '', out: Record<string, unknown> = {}): Record<string, unknown> {
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) {
    out[prefix || 'value'] = obj
    return out
  }
  const entries = Object.entries(obj as Record<string, unknown>)
  if (entries.length === 0 && prefix) out[prefix] = ''
  for (const [k, v] of entries) {
    const key = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === 'object' && !Array.isArray(v)) flattenObject(v, key, out)
    else out[key] = v
  }
  return out
}

export function csvEscape(value: unknown, delimiter: Delimiter): string {
  let s: string
  if (value === null || value === undefined) s = ''
  else if (typeof value === 'object') s = JSON.stringify(value)
  else s = String(value)
  // Guard against spreadsheet formula injection when opened in Excel.
  if (/^[=+\-@\t\r]/.test(s) && typeof value === 'string' && !/^-?\d+(\.\d+)?$/.test(s)) s = `'${s}`
  if (s.includes('"') || s.includes(delimiter) || /[\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export function jsonToCsv(data: unknown, delimiter: Delimiter = ','): string {
  const rows = Array.isArray(data) ? data : [data]
  if (rows.length === 0) return ''
  const flat = rows.map((r) => flattenObject(r))
  const headers: string[] = []
  const seen = new Set<string>()
  for (const r of flat) {
    for (const k of Object.keys(r)) {
      if (!seen.has(k)) {
        seen.add(k)
        headers.push(k)
      }
    }
  }
  const lines = [headers.map((h) => csvEscape(h, delimiter)).join(delimiter)]
  for (const r of flat) lines.push(headers.map((h) => csvEscape(r[h], delimiter)).join(delimiter))
  return lines.join('\r\n')
}

// ───────────── Base64 ─────────────

export function base64EncodeText(text: string, urlSafe = false): string {
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  const b64 = btoa(binary)
  return urlSafe ? b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') : b64
}

export function base64DecodeText(input: string): string {
  let s = input.replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/')
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(s)) throw new Error('Input contains characters that are not valid Base64.')
  if (s.length % 4 === 1) throw new Error('Input length is not valid Base64.')
  while (s.length % 4) s += '='
  const binary = atob(s)
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0))
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    throw new Error('The decoded bytes are not valid UTF-8 text. The input may be binary data.')
  }
}

// ───────────── URL ─────────────

export type UrlMode = 'component' | 'full'

export function urlEncode(text: string, mode: UrlMode): string {
  return mode === 'component' ? encodeURIComponent(text) : encodeURI(text)
}

export function urlDecode(text: string, mode: UrlMode): string {
  try {
    return mode === 'component' ? decodeURIComponent(text) : decodeURI(text)
  } catch {
    throw new Error('Malformed input: a % sign is not followed by two hex digits, or the bytes are not valid UTF-8.')
  }
}

// ───────────── UUID ─────────────

export function uuidV4(): string {
  const c = globalThis.crypto
  if (typeof c.randomUUID === 'function') return c.randomUUID()
  const b = c.getRandomValues(new Uint8Array(16))
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const h = Array.from(b, (x: number) => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

// ───────────── Hash ─────────────

export type HashAlgorithm = 'SHA-1' | 'SHA-256' | 'SHA-384' | 'SHA-512'
export const HASH_ALGORITHMS: HashAlgorithm[] = ['SHA-1', 'SHA-256', 'SHA-384', 'SHA-512']

export function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer), (b) => b.toString(16).padStart(2, '0')).join('')
}

export async function hashBytes(data: BufferSource, algorithm: HashAlgorithm): Promise<string> {
  return toHex(await crypto.subtle.digest(algorithm, data))
}

export async function hashText(text: string, algorithm: HashAlgorithm): Promise<string> {
  return hashBytes(new TextEncoder().encode(text), algorithm)
}

// ───────────── CSS minify ─────────────

export function minifyCss(css: string): string {
  // Protect strings and url(...) contents so whitespace inside them survives.
  const saved: string[] = []
  const protect = (m: string) => {
    saved.push(m)
    return `\u0000${saved.length - 1}\u0000`
  }
  // One pass so comments, strings and unquoted url() are recognized in the order they appear.
  // A comment marker inside a string, or a quote inside a comment, is then handled correctly.
  let out = css.replace(/\/\*[\s\S]*?\*\/|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|url\(\s*([^'")\s][^)]*?)\s*\)/gi, (m: string, url?: string) => {
    if (m.startsWith('/*')) return ''
    if (url !== undefined) return protect(`url(${url})`)
    return protect(m)
  })
  out = out
    .replace(/\s+/g, ' ')
    .replace(/\(\s+/g, '(')
    .replace(/\s+\)/g, ')')
    .replace(/\s*([{};,>~])\s*/g, '$1')
    // Only strip space AFTER a colon: `a :hover` (descendant) must keep its space.
    .replace(/:\s+/g, ':')
    .replace(/;}/g, '}')
    .replace(/\s*!\s*important/gi, '!important')
    .trim()
  // eslint-disable-next-line no-control-regex
  return out.replace(/\u0000(\d+)\u0000/g, (_m, i: string) => saved[Number(i)])
}

// ───────────── HTML entities ─────────────

const BASIC_ENTITIES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }

export function encodeHtmlEntities(text: string, encodeNonAscii = false): string {
  let out = text.replace(/[&<>"']/g, (c) => BASIC_ENTITIES[c])
  if (encodeNonAscii) {
    out = Array.from(out)
      .map((ch) => {
        const cp = ch.codePointAt(0)!
        return cp > 126 ? `&#${cp};` : ch
      })
      .join('')
  }
  return out
}

export function decodeHtmlEntities(text: string): string {
  // DOMParser builds an inert document: nothing executes and nothing touches the live page.
  const doc = new DOMParser().parseFromString(`<!doctype html><body>${text.replace(/</g, '&lt;')}`, 'text/html')
  return doc.body.textContent ?? ''
}

// ───────────── JWT ─────────────

export interface JwtDecoded {
  header: Record<string, unknown>
  payload: Record<string, unknown>
  signature: string
  times: { claim: 'exp' | 'iat' | 'nbf'; date: Date; label: string }[]
  expired: boolean | null
}

function b64urlToText(part: string): string {
  const s = part.replace(/-/g, '+').replace(/_/g, '/')
  const padded = s + '='.repeat((4 - (s.length % 4)) % 4)
  const bytes = Uint8Array.from(atob(padded), (c) => c.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

export function decodeJwt(token: string, now: Date = new Date()): JwtDecoded {
  const parts = token.trim().replace(/^Bearer\s+/i, '').split('.')
  if (parts.length !== 3) throw new Error('A JWT has three parts separated by dots. This input has ' + parts.length + '.')
  let header: unknown
  let payload: unknown
  try {
    header = JSON.parse(b64urlToText(parts[0]))
  } catch {
    throw new Error('The header is not valid Base64URL-encoded JSON.')
  }
  try {
    payload = JSON.parse(b64urlToText(parts[1]))
  } catch {
    throw new Error('The payload is not valid Base64URL-encoded JSON.')
  }
  if (!header || typeof header !== 'object' || !payload || typeof payload !== 'object') {
    throw new Error('The header and payload must be JSON objects.')
  }
  const p = payload as Record<string, unknown>
  const times: JwtDecoded['times'] = []
  const labels = { exp: 'Expires', iat: 'Issued', nbf: 'Not valid before' } as const
  for (const claim of ['iat', 'nbf', 'exp'] as const) {
    const v = p[claim]
    if (typeof v === 'number' && Number.isFinite(v)) times.push({ claim, date: new Date(v * 1000), label: labels[claim] })
  }
  const exp = times.find((t) => t.claim === 'exp')
  return {
    header: header as Record<string, unknown>,
    payload: p,
    signature: parts[2],
    times,
    expired: exp ? exp.date.getTime() <= now.getTime() : null,
  }
}

// ───────────── Color ─────────────

export interface Rgb {
  r: number
  g: number
  b: number
}
export interface Hsl {
  h: number
  s: number
  l: number
}

export function parseHex(input: string): Rgb | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(input.trim())
  if (!m) return null
  let h = m[1]
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) }
}

export function rgbToHex({ r, g, b }: Rgb): string {
  const c = (n: number) => Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, '0')
  return `#${c(r)}${c(g)}${c(b)}`
}

export function rgbToHsl({ r, g, b }: Rgb): Hsl {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const l = (max + min) / 2
  const d = max - min
  let h = 0
  let s = 0
  if (d !== 0) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0)
    else if (max === gn) h = (bn - rn) / d + 2
    else h = (rn - gn) / d + 4
    h *= 60
  }
  return { h: Math.round(h) % 360, s: Math.round(s * 100), l: Math.round(l * 100) }
}

export function hslToRgb({ h, s, l }: Hsl): Rgb {
  const sn = s / 100
  const ln = l / 100
  const k = (n: number) => (n + h / 30) % 12
  const a = sn * Math.min(ln, 1 - ln)
  const f = (n: number) => ln - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  return { r: Math.round(f(0) * 255), g: Math.round(f(8) * 255), b: Math.round(f(4) * 255) }
}

/** WCAG relative luminance contrast ratio against white and black. */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const lum = ({ r, g, b }: Rgb) => {
    const f = (v: number) => {
      const c = v / 255
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
    }
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
  }
  const l1 = lum(a)
  const l2 = lum(b)
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
}
