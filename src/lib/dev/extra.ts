/** Password generation, regex testing, timestamps and number-base text conversion. */

// ───────────── Password generator ─────────────
export interface PasswordOptions {
  length: number
  lower: boolean
  upper: boolean
  digits: boolean
  symbols: boolean
  excludeAmbiguous: boolean
}

const SETS = {
  lower: 'abcdefghijklmnopqrstuvwxyz',
  upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  digits: '0123456789',
  symbols: '!@#$%^&*()-_=+[]{};:,.?/',
}
const AMBIGUOUS = /[O0oIl1|]/g

/** Uniform random integer in [0, max) using rejection sampling, so there is no modulo bias. */
export function randomInt(max: number, fill: (a: Uint32Array<ArrayBuffer>) => void = (a) => crypto.getRandomValues(a)): number {
  const limit = Math.floor(0x100000000 / max) * max
  const buf = new Uint32Array(1) as Uint32Array<ArrayBuffer>
  do fill(buf)
  while (buf[0] >= limit)
  return buf[0] % max
}

export function generatePassword(o: PasswordOptions, rnd: (max: number) => number = randomInt): string {
  const groups = (['lower', 'upper', 'digits', 'symbols'] as const)
    .filter((k) => o[k])
    .map((k) => (o.excludeAmbiguous ? SETS[k].replace(AMBIGUOUS, '') : SETS[k]))
  if (!groups.length) return ''
  const length = Math.max(groups.length, Math.min(256, Math.floor(o.length)))
  const all = groups.join('')
  // One character from every selected group first, so each choice is honoured.
  const chars = groups.map((g) => g[rnd(g.length)])
  while (chars.length < length) chars.push(all[rnd(all.length)])
  for (let i = chars.length - 1; i > 0; i--) {
    const j = rnd(i + 1)
    ;[chars[i], chars[j]] = [chars[j], chars[i]]
  }
  return chars.join('')
}

/** Entropy in bits for a password drawn from a pool of the given size. */
export function passwordEntropy(length: number, poolSize: number): number {
  return poolSize > 1 ? length * Math.log2(poolSize) : 0
}

export function passwordPoolSize(o: PasswordOptions): number {
  return (['lower', 'upper', 'digits', 'symbols'] as const)
    .filter((k) => o[k])
    .reduce((n, k) => n + (o.excludeAmbiguous ? SETS[k].replace(AMBIGUOUS, '') : SETS[k]).length, 0)
}

export function strengthLabel(bits: number): 'Weak' | 'Fair' | 'Strong' | 'Very strong' {
  return bits < 40 ? 'Weak' : bits < 60 ? 'Fair' : bits < 100 ? 'Strong' : 'Very strong'
}

// ───────────── Regex tester ─────────────
export interface RegexMatch {
  index: number
  text: string
  groups: (string | undefined)[]
  named: Record<string, string>
}

export interface RegexResult {
  matches: RegexMatch[]
  error?: string
  truncated: boolean
}

const MAX_MATCHES = 1000

export function testRegex(pattern: string, flags: string, text: string): RegexResult {
  if (!pattern) return { matches: [], truncated: false }
  let re: RegExp
  try {
    re = new RegExp(pattern, flags.includes('g') ? flags : flags + 'g')
  } catch (e) {
    return { matches: [], error: e instanceof Error ? e.message : 'Invalid pattern', truncated: false }
  }
  const matches: RegexMatch[] = []
  let truncated = false
  for (const m of text.matchAll(re)) {
    if (matches.length >= MAX_MATCHES) {
      truncated = true
      break
    }
    matches.push({ index: m.index ?? 0, text: m[0], groups: m.slice(1), named: { ...(m.groups ?? {}) } })
  }
  return { matches, truncated }
}

// ───────────── Unix timestamps ─────────────
export type TimestampUnit = 'seconds' | 'milliseconds'

/** Guess the unit: values with 12 or more digits are treated as milliseconds. */
export function guessUnit(n: number): TimestampUnit {
  return Math.abs(n) >= 1e11 ? 'milliseconds' : 'seconds'
}

export function timestampToDate(value: number, unit: TimestampUnit): Date | null {
  if (!Number.isFinite(value)) return null
  const d = new Date(unit === 'seconds' ? value * 1000 : value)
  return Number.isNaN(d.getTime()) ? null : d
}

export function dateToTimestamp(d: Date, unit: TimestampUnit): number {
  return unit === 'seconds' ? Math.floor(d.getTime() / 1000) : d.getTime()
}

export function relativeTime(d: Date, now: Date = new Date()): string {
  const diff = Math.round((d.getTime() - now.getTime()) / 1000)
  const abs = Math.abs(diff)
  const units: [number, string][] = [
    [31536000, 'year'],
    [2592000, 'month'],
    [86400, 'day'],
    [3600, 'hour'],
    [60, 'minute'],
  ]
  if (abs < 5) return 'just now'
  for (const [secs, name] of units) {
    if (abs >= secs) {
      const n = Math.floor(abs / secs)
      return diff < 0 ? `${n} ${name}${n > 1 ? 's' : ''} ago` : `in ${n} ${name}${n > 1 ? 's' : ''}`
    }
  }
  return diff < 0 ? `${abs} seconds ago` : `in ${abs} seconds`
}

// ───────────── Text ⇄ hex / binary / decimal / octal ─────────────
export type Radix = 'hex' | 'binary' | 'decimal' | 'octal'
const RADIX: Record<Radix, { base: number; width: number }> = {
  hex: { base: 16, width: 2 },
  binary: { base: 2, width: 8 },
  decimal: { base: 10, width: 1 },
  octal: { base: 8, width: 3 },
}

/** Encodes text as UTF-8 and prints every byte in the chosen base. */
export function textToRadix(text: string, radix: Radix, separator = ' '): string {
  const { base, width } = RADIX[radix]
  return [...new TextEncoder().encode(text)].map((b) => b.toString(base).padStart(width, '0')).join(separator)
}

export class RadixError extends Error {}

/** Parses bytes written in the chosen base and decodes them as UTF-8. */
export function radixToText(input: string, radix: Radix): string {
  const { base } = RADIX[radix]
  const trimmed = input.trim()
  if (!trimmed) return ''
  let tokens = trimmed.split(/[\s,;]+/)
  // Allow unbroken hex or binary strings, such as 48656c6c6f.
  if (tokens.length === 1 && (radix === 'hex' || radix === 'binary')) {
    const clean = tokens[0].replace(/^0x/i, '')
    const w = RADIX[radix].width
    if (clean.length > w) tokens = clean.match(new RegExp(`.{1,${w}}`, 'g')) ?? []
  }
  const valid = base === 16 ? /^(0x)?[0-9a-f]+$/i : base === 2 ? /^[01]+$/ : base === 8 ? /^[0-7]+$/ : /^[0-9]+$/
  const bytes = tokens.map((t) => {
    if (!valid.test(t)) throw new RadixError(`"${t}" is not a valid ${radix} value.`)
    const n = parseInt(t.replace(/^0x/i, ''), base)
    if (n > 255) throw new RadixError(`"${t}" is larger than one byte (255).`)
    return n
  })
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(new Uint8Array(bytes))
  } catch {
    throw new RadixError('Those bytes are not valid UTF-8 text.')
  }
}
