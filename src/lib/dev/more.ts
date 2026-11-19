/** JSON string escaping and random string generation. */
import { randomInt } from './extra'

export function jsonEscape(text: string, opts: { quotes: boolean; asciiOnly: boolean }): string {
  let s = JSON.stringify(text)
  if (opts.asciiOnly) s = s.replace(/[\u007f-￿]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`)
  return opts.quotes ? s : s.slice(1, -1)
}

export class UnescapeError extends Error {}

/** Accepts a JSON string with or without its surrounding quotes. */
export function jsonUnescape(text: string): string {
  const t = text.trim()
  if (!t) return ''
  const parse = (src: string): string | null => {
    try {
      const v: unknown = JSON.parse(src)
      return typeof v === 'string' ? v : null
    } catch {
      return null
    }
  }
  if (t.length >= 2 && t.startsWith('"') && t.endsWith('"')) {
    const whole = parse(t)
    if (whole !== null) return whole
  }
  // No surrounding quotes: escape bare quotes and raw line breaks, then parse as a string body.
  // A quote preceded by an even number of backslashes (including none) is not yet escaped.
  const body = t
    .replace(/(\\*)"/g, (m, slashes: string) => (slashes.length % 2 === 0 ? `${slashes}\\"` : m))
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t')
  const r = parse(`"${body}"`)
  if (r === null) throw new UnescapeError('That is not a valid escaped string. Check for a lone backslash or a bad \\u sequence.')
  return r
}

// ───────────── Random strings ─────────────
export type Charset = 'alnum' | 'letters' | 'lower' | 'upper' | 'digits' | 'hex' | 'base64url' | 'custom'

export const CHARSETS: Record<Exclude<Charset, 'custom'>, string> = {
  alnum: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
  letters: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ',
  lower: 'abcdefghijklmnopqrstuvwxyz',
  upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  digits: '0123456789',
  hex: '0123456789abcdef',
  base64url: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_',
}

export function randomString(length: number, charset: string, rnd: (max: number) => number = randomInt): string {
  const chars = [...new Set([...charset])]
  if (!chars.length) return ''
  const n = Math.max(0, Math.min(4096, Math.floor(length)))
  let out = ''
  for (let i = 0; i < n; i++) out += chars[rnd(chars.length)]
  return out
}
