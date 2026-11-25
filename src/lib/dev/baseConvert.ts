// Number base conversion with BigInt, so large values stay exact.

const DIGITS = '0123456789abcdefghijklmnopqrstuvwxyz'

export const MIN_BASE = 2
export const MAX_BASE = 36
export const MAX_INPUT_DIGITS = 2000

export type ParseResult = { ok: true; value: bigint } | { ok: false; error: string }

const PREFIXES: Record<string, number> = { '0x': 16, '0b': 2, '0o': 8 }

/** Parse text in `base`. Accepts a leading sign, underscores and spaces as separators, and a matching 0x/0b/0o prefix. */
export function parseInBase(input: string, base: number): ParseResult {
  if (!Number.isInteger(base) || base < MIN_BASE || base > MAX_BASE) {
    return { ok: false, error: `Base must be a whole number from ${MIN_BASE} to ${MAX_BASE}.` }
  }
  let s = input.trim().replace(/[\s_]/g, '').toLowerCase()
  if (!s) return { ok: false, error: 'Enter a number.' }
  let negative = false
  if (s[0] === '-' || s[0] === '+') {
    negative = s[0] === '-'
    s = s.slice(1)
  }
  const prefixBase = PREFIXES[s.slice(0, 2)]
  if (prefixBase !== undefined && prefixBase === base) s = s.slice(2)
  if (!s) return { ok: false, error: 'Enter a number.' }
  if (s.length > MAX_INPUT_DIGITS) return { ok: false, error: `Input is limited to ${MAX_INPUT_DIGITS} digits.` }
  let value = 0n
  const b = BigInt(base)
  for (const ch of s) {
    const d = DIGITS.indexOf(ch)
    if (d < 0 || d >= base) return { ok: false, error: `"${ch}" is not a valid digit in base ${base}.` }
    value = value * b + BigInt(d)
  }
  return { ok: true, value: negative ? -value : value }
}

export function formatInBase(value: bigint, base: number): string {
  if (base < MIN_BASE || base > MAX_BASE) throw new Error('Base out of range.')
  return value.toString(base)
}

/** Insert a space every `size` characters, counting from the right. */
export function groupDigits(s: string, size: number): string {
  const neg = s.startsWith('-')
  const body = neg ? s.slice(1) : s
  const parts: string[] = []
  for (let i = body.length; i > 0; i -= size) parts.unshift(body.slice(Math.max(0, i - size), i))
  return (neg ? '-' : '') + parts.join(' ')
}
