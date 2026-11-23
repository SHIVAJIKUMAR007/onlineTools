// Random token generator using crypto.getRandomValues with rejection sampling (no modulo bias).

export type TokenFormat = 'hex' | 'base64url' | 'base62' | 'alphanumeric'

export const TOKEN_ALPHABETS: Record<TokenFormat, string> = {
  hex: '0123456789abcdef',
  base64url: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_',
  base62: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
  alphanumeric: 'abcdefghijklmnopqrstuvwxyz0123456789',
}

export const TOKEN_LIMITS = { minLength: 4, maxLength: 256, maxCount: 100, maxPrefix: 32 }

export type FillBytes = (bytes: Uint8Array) => void

const defaultFill: FillBytes = (bytes) => {
  if (typeof crypto === 'undefined' || !crypto.getRandomValues) throw new Error('Secure random numbers are not available in this browser.')
  crypto.getRandomValues(bytes as Uint8Array<ArrayBuffer>)
}

/** Picks `length` symbols uniformly from `alphabet` by discarding bytes that would cause bias. */
export function randomFromAlphabet(alphabet: string, length: number, fill: FillBytes = defaultFill): string {
  const n = alphabet.length
  if (n < 2 || n > 256) throw new Error('Alphabet size must be between 2 and 256.')
  const limit = Math.floor(256 / n) * n
  let out = ''
  const buf = new Uint8Array(Math.min(4096, Math.max(32, Math.ceil(length * 1.5))))
  while (out.length < length) {
    fill(buf)
    for (let i = 0; i < buf.length && out.length < length; i++) {
      if (buf[i] < limit) out += alphabet[buf[i] % n]
    }
  }
  return out
}

export function entropyBits(format: TokenFormat, length: number): number {
  return length * Math.log2(TOKEN_ALPHABETS[format].length)
}

export interface TokenOptions {
  format: TokenFormat
  length: number
  count: number
  prefix: string
}

export function clampInt(v: number, min: number, max: number): number {
  if (!Number.isFinite(v)) return min
  return Math.min(max, Math.max(min, Math.floor(v)))
}

export function cleanPrefix(p: string): string {
  return p.replace(/\s+/g, '').slice(0, TOKEN_LIMITS.maxPrefix)
}

export function generateTokens(opts: TokenOptions, fill: FillBytes = defaultFill): string[] {
  const length = clampInt(opts.length, TOKEN_LIMITS.minLength, TOKEN_LIMITS.maxLength)
  const count = clampInt(opts.count, 1, TOKEN_LIMITS.maxCount)
  const prefix = cleanPrefix(opts.prefix)
  const alphabet = TOKEN_ALPHABETS[opts.format]
  return Array.from({ length: count }, () => prefix + randomFromAlphabet(alphabet, length, fill))
}

export function formatEntropy(bits: number): string {
  return bits >= 100 ? Math.round(bits).toString() : bits.toFixed(1)
}
