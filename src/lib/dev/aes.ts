/**
 * Password-based AES-256-GCM encryption using Web Crypto.
 *
 * Output layout (this tool's own format):
 *   byte 0        version, currently 1
 *   bytes 1-4     PBKDF2-SHA-256 iteration count, unsigned 32-bit big endian
 *   bytes 5-20    salt, 16 random bytes
 *   bytes 21-32   IV (nonce), 12 random bytes
 *   bytes 33-end  AES-GCM ciphertext followed by the 16-byte authentication tag
 * The first 21 bytes are also authenticated as additional data, so changing them makes decryption fail.
 */
export const FORMAT_VERSION = 1
export const SALT_LEN = 16
export const IV_LEN = 12
export const TAG_LEN = 16
export const HEADER_LEN = 1 + 4 + SALT_LEN + IV_LEN
export const DEFAULT_ITERATIONS = 600_000
export const MIN_ITERATIONS = 1_000
export const MAX_ITERATIONS = 10_000_000

export class AesError extends Error {}

const buf = (u: Uint8Array) => u as unknown as BufferSource

export function checkIterations(n: number): number {
  if (!Number.isInteger(n) || n < MIN_ITERATIONS || n > MAX_ITERATIONS) {
    throw new AesError(`Iterations must be a whole number from ${MIN_ITERATIONS.toLocaleString('en-US')} to ${MAX_ITERATIONS.toLocaleString('en-US')}.`)
  }
  return n
}

function subtle(): SubtleCrypto {
  const s = globalThis.crypto?.subtle
  if (!s) throw new AesError('This browser does not provide Web Crypto here. Use a current browser over HTTPS.')
  return s
}

async function deriveKey(password: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const s = subtle()
  const base = await s.importKey('raw', buf(new TextEncoder().encode(password.normalize('NFKC'))), 'PBKDF2', false, ['deriveKey'])
  return s.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: buf(salt), iterations }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
}

export async function encryptBytes(plain: Uint8Array, password: string, iterations = DEFAULT_ITERATIONS): Promise<Uint8Array> {
  if (!password) throw new AesError('Enter a password first.')
  checkIterations(iterations)
  const salt = globalThis.crypto.getRandomValues(new Uint8Array(SALT_LEN))
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(IV_LEN))
  const header = new Uint8Array(HEADER_LEN)
  header[0] = FORMAT_VERSION
  new DataView(header.buffer).setUint32(1, iterations, false)
  header.set(salt, 5)
  header.set(iv, 21)
  const key = await deriveKey(password, salt, iterations)
  const ct = new Uint8Array(await subtle().encrypt({ name: 'AES-GCM', iv: buf(iv), additionalData: buf(header.subarray(0, 21)) }, key, buf(plain)))
  const out = new Uint8Array(HEADER_LEN + ct.length)
  out.set(header)
  out.set(ct, HEADER_LEN)
  return out
}

export async function decryptBytes(data: Uint8Array, password: string): Promise<Uint8Array> {
  if (!password) throw new AesError('Enter a password first.')
  if (data.length < HEADER_LEN + TAG_LEN) throw new AesError('This data is too short to be output from this tool.')
  if (data[0] !== FORMAT_VERSION) throw new AesError(`Unknown format version ${data[0]}. This tool only reads version ${FORMAT_VERSION}.`)
  const iterations = new DataView(data.buffer, data.byteOffset, data.byteLength).getUint32(1, false)
  if (iterations < MIN_ITERATIONS || iterations > MAX_ITERATIONS) throw new AesError('The iteration count in the header is outside the supported range, so the data is not valid.')
  const salt = data.slice(5, 21)
  const iv = data.slice(21, HEADER_LEN)
  const key = await deriveKey(password, salt, iterations)
  try {
    const pt = await subtle().decrypt({ name: 'AES-GCM', iv: buf(iv), additionalData: buf(data.slice(0, 21)) }, key, buf(data.slice(HEADER_LEN)))
    return new Uint8Array(pt)
  } catch {
    throw new AesError('Wrong password or corrupted data. AES-GCM cannot tell which, because both fail the same check.')
  }
}

export function bytesToBase64(b: Uint8Array): string {
  let s = ''
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000))
  return btoa(s)
}

export function base64ToBytes(input: string): Uint8Array {
  const s = input.replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/').replace(/=+$/, '')
  if (!s || !/^[A-Za-z0-9+/]+$/.test(s) || s.length % 4 === 1) throw new AesError('That is not valid Base64 text.')
  const bin = atob(s + '='.repeat((4 - (s.length % 4)) % 4))
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

export async function encryptText(text: string, password: string, iterations = DEFAULT_ITERATIONS): Promise<string> {
  return bytesToBase64(await encryptBytes(new TextEncoder().encode(text), password, iterations))
}

export async function decryptText(b64: string, password: string): Promise<string> {
  const plain = await decryptBytes(base64ToBytes(b64), password)
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(plain)
  } catch {
    throw new AesError('The data decrypted, but it is not text. It was probably a file. Use the file mode to decrypt it.')
  }
}
