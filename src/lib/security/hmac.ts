export type HmacAlgo = 'SHA-1' | 'SHA-256' | 'SHA-384' | 'SHA-512'
export type KeyEncoding = 'text' | 'hex' | 'base64'
export type OutputEncoding = 'hex' | 'base64'

export const HMAC_ALGOS: HmacAlgo[] = ['SHA-1', 'SHA-256', 'SHA-384', 'SHA-512']

export class HmacInputError extends Error {}

export const bytesToHex = (b: Uint8Array): string => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')

export const bytesToBase64 = (b: Uint8Array): string => {
  let s = ''
  for (const x of b) s += String.fromCharCode(x)
  return btoa(s)
}

export function hexToBytes(input: string): Uint8Array {
  const s = input.replace(/\s+/g, '').replace(/^0x/i, '')
  if (s.length % 2 !== 0 || !/^[0-9a-fA-F]*$/.test(s)) throw new HmacInputError('The key is not valid hex. Use pairs of 0-9 and a-f.')
  const out = new Uint8Array(s.length / 2)
  for (let i = 0; i < out.length; i++) out[i] = parseInt(s.slice(i * 2, i * 2 + 2), 16)
  return out
}

export function base64ToBytes(input: string): Uint8Array {
  let s = input.replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/')
  s = s.replace(/=+$/, '')
  if (!/^[A-Za-z0-9+/]*$/.test(s) || s.length % 4 === 1) throw new HmacInputError('The key is not valid Base64.')
  while (s.length % 4) s += '='
  const bin = atob(s)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

export function parseKey(key: string, enc: KeyEncoding): Uint8Array {
  if (enc === 'hex') return hexToBytes(key)
  if (enc === 'base64') return base64ToBytes(key)
  return new TextEncoder().encode(key)
}

/** Computes HMAC(key, message). The message is encoded as UTF-8. */
export async function computeHmac(algo: HmacAlgo, key: Uint8Array, message: string): Promise<Uint8Array> {
  const subtle = globalThis.crypto?.subtle
  if (!subtle) throw new HmacInputError('Web Crypto is not available in this browser (it needs a secure context).')
  // HMAC zero-pads keys to the block size, so an empty key equals a single zero byte.
  const k = key.length === 0 ? new Uint8Array([0]) : key
  const ck = await subtle.importKey('raw', k as BufferSource, { name: 'HMAC', hash: algo }, false, ['sign'])
  const sig = await subtle.sign('HMAC', ck, new TextEncoder().encode(message) as BufferSource)
  return new Uint8Array(sig)
}

export function formatDigest(bytes: Uint8Array, enc: OutputEncoding, upper = false): string {
  const s = enc === 'hex' ? bytesToHex(bytes) : bytesToBase64(bytes)
  return upper && enc === 'hex' ? s.toUpperCase() : s
}

/** Compares two strings without returning early on the first difference. */
export function constantTimeEqual(a: string, b: string): boolean {
  const n = Math.max(a.length, b.length)
  let diff = a.length ^ b.length
  for (let i = 0; i < n; i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0)
  return diff === 0
}

export interface VerifyResult {
  match: boolean
  format: 'hex' | 'base64' | 'unknown'
}

/** Checks a supplied HMAC (hex or Base64) against a computed digest. */
export function verifyHmac(expected: string, digest: Uint8Array): VerifyResult {
  const e = expected.replace(/\s+/g, '')
  if (!e) return { match: false, format: 'unknown' }
  if (/^[0-9a-fA-F]+$/.test(e) && e.length === digest.length * 2) {
    return { match: constantTimeEqual(e.toLowerCase(), bytesToHex(digest)), format: 'hex' }
  }
  if (/^[A-Za-z0-9+/_-]+=*$/.test(e)) {
    const norm = e.replace(/-/g, '+').replace(/_/g, '/').replace(/=+$/, '')
    return { match: constantTimeEqual(norm, bytesToBase64(digest).replace(/=+$/, '')), format: 'base64' }
  }
  return { match: false, format: 'unknown' }
}
