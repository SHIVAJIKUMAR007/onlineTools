/**
 * Detect a file's real type from its leading bytes. The browser reports
 * `file.type` based on the extension, so a renamed file can lie.
 */
export type SniffedType =
  | 'image/jpeg'
  | 'image/png'
  | 'image/webp'
  | 'image/gif'
  | 'image/bmp'
  | 'image/avif'
  | 'image/heic'
  | 'image/svg+xml'
  | 'application/pdf'
  | 'application/zip'
  | 'unknown'

export function sniffBytes(b: Uint8Array): SniffedType {
  const ascii = (start: number, len: number) => String.fromCharCode(...b.slice(start, start + len))
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg'
  if (b.length >= 8 && b[0] === 0x89 && ascii(1, 3) === 'PNG') return 'image/png'
  if (b.length >= 12 && ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WEBP') return 'image/webp'
  if (b.length >= 6 && (ascii(0, 6) === 'GIF87a' || ascii(0, 6) === 'GIF89a')) return 'image/gif'
  if (b.length >= 2 && b[0] === 0x42 && b[1] === 0x4d) return 'image/bmp'
  if (b.length >= 12 && ascii(4, 4) === 'ftyp') {
    const brand = ascii(8, 4)
    if (brand === 'avif' || brand === 'avis') return 'image/avif'
    if (['heic', 'heix', 'hevc', 'hevx', 'heif', 'mif1', 'msf1', 'heim', 'heis'].includes(brand)) return 'image/heic'
  }
  if (b.length >= 5 && ascii(0, 5) === '%PDF-') return 'application/pdf'
  if (b.length >= 4 && b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04) return 'application/zip'
  // SVG is text: look for an <svg tag near the start.
  const head = new TextDecoder().decode(b.slice(0, 1024)).toLowerCase()
  if (head.includes('<svg')) return 'image/svg+xml'
  return 'unknown'
}

export async function sniffFile(file: Blob): Promise<SniffedType> {
  const buf = await file.slice(0, 1024).arrayBuffer()
  return sniffBytes(new Uint8Array(buf))
}

/** Does a sniffed type satisfy an `accept` list made of mime types and extensions? */
export function typeMatchesAccept(type: string, accept: string[]): boolean {
  if (accept.includes('*/*')) return true
  const mimes = accept.filter((a) => a.includes('/'))
  if (mimes.includes(type)) return true
  // HEIF family is reported as image/heic when sniffed.
  if (type === 'image/heic' && (mimes.includes('image/heif') || mimes.includes('image/heic'))) return true
  return false
}

/** Check by extension, used when sniffing is inconclusive. */
export function extMatchesAccept(name: string, accept: string[]): boolean {
  const lower = name.toLowerCase()
  return accept.filter((a) => a.startsWith('.')).some((ext) => lower.endsWith(ext))
}
