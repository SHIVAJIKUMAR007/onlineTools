export interface ColorSwatch {
  hex: string
  /** Share of opaque sampled pixels, 0..1. */
  share: number
}

export interface ColorAnalysis {
  average: string
  palette: ColorSwatch[]
  hasTransparency: boolean
  transparentShare: number
  sampled: number
}

const hex2 = (n: number) => Math.round(n).toString(16).padStart(2, '0')
const toHex = (r: number, g: number, b: number) => `#${hex2(r)}${hex2(g)}${hex2(b)}`

/** Summarize RGBA pixel data: average color, dominant colors (4-bit buckets) and transparency. */
export function analyzePixels(data: Uint8ClampedArray, paletteSize = 6): ColorAnalysis {
  let r = 0
  let g = 0
  let b = 0
  let opaque = 0
  let transparent = 0
  const buckets = new Map<number, { n: number; r: number; g: number; b: number }>()
  const total = data.length / 4
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3]
    if (a < 255) transparent++
    if (a < 16) continue
    opaque++
    const pr = data[i]
    const pg = data[i + 1]
    const pb = data[i + 2]
    r += pr
    g += pg
    b += pb
    const key = ((pr >> 4) << 8) | ((pg >> 4) << 4) | (pb >> 4)
    const e = buckets.get(key)
    if (e) {
      e.n++
      e.r += pr
      e.g += pg
      e.b += pb
    } else buckets.set(key, { n: 1, r: pr, g: pg, b: pb })
  }
  const sorted = [...buckets.values()].sort((x, y) => y.n - x.n)
  // Skip near-duplicate colors so the palette is varied.
  const palette: ColorSwatch[] = []
  for (const e of sorted) {
    const c = { r: e.r / e.n, g: e.g / e.n, b: e.b / e.n }
    const close = palette.some((p) => {
      const pr = parseInt(p.hex.slice(1, 3), 16)
      const pg = parseInt(p.hex.slice(3, 5), 16)
      const pb = parseInt(p.hex.slice(5, 7), 16)
      return Math.hypot(pr - c.r, pg - c.g, pb - c.b) < 40
    })
    if (close) continue
    palette.push({ hex: toHex(c.r, c.g, c.b), share: e.n / Math.max(1, opaque) })
    if (palette.length >= paletteSize) break
  }
  return {
    average: opaque ? toHex(r / opaque, g / opaque, b / opaque) : '#000000',
    palette,
    hasTransparency: transparent > 0,
    transparentShare: total ? transparent / total : 0,
    sampled: total,
  }
}

export function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b)
}

export function aspectRatioLabel(w: number, h: number): string {
  const d = gcd(w, h) || 1
  const rw = w / d
  const rh = h / d
  // Odd ratios such as 683:384 are not helpful; show a decimal instead.
  return rw > 30 || rh > 30 ? `${(w / h).toFixed(3)}:1` : `${rw}:${rh}`
}
