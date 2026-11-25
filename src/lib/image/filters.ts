// Pixel filters on RGBA data (Uint8ClampedArray, as in ImageData). Pure, in place.

export type FilterId = 'grayscale' | 'sepia' | 'invert' | 'blackwhite' | 'brightness' | 'contrast' | 'saturation'

export interface FilterDef {
  id: FilterId
  label: string
  /** Slider range for the strength. Percent for most filters, a 0 to 255 threshold for black and white. */
  min: number
  max: number
  def: number
}

export const FILTERS: FilterDef[] = [
  { id: 'grayscale', label: 'Grayscale', min: 0, max: 100, def: 100 },
  { id: 'blackwhite', label: 'Black and white', min: 0, max: 255, def: 128 },
  { id: 'sepia', label: 'Sepia', min: 0, max: 100, def: 100 },
  { id: 'invert', label: 'Invert', min: 0, max: 100, def: 100 },
  { id: 'brightness', label: 'Brightness', min: -100, max: 100, def: 20 },
  { id: 'contrast', label: 'Contrast', min: -100, max: 100, def: 30 },
  { id: 'saturation', label: 'Saturation', min: -100, max: 100, def: 40 },
]

/** Rec. 709 luma. */
export const luma = (r: number, g: number, b: number) => 0.2126 * r + 0.7152 * g + 0.0722 * b

const lerp = (a: number, b: number, t: number) => a + (b - a) * t

/** Apply a filter in place. Alpha is never changed. */
export function applyFilter(data: Uint8ClampedArray, id: FilterId, amount: number): void {
  const t = amount / 100
  for (let i = 0; i + 3 < data.length; i += 4) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    switch (id) {
      case 'grayscale': {
        const y = luma(r, g, b)
        data[i] = lerp(r, y, t)
        data[i + 1] = lerp(g, y, t)
        data[i + 2] = lerp(b, y, t)
        break
      }
      case 'blackwhite': {
        const v = luma(r, g, b) >= amount ? 255 : 0
        data[i] = data[i + 1] = data[i + 2] = v
        break
      }
      case 'sepia': {
        data[i] = lerp(r, 0.393 * r + 0.769 * g + 0.189 * b, t)
        data[i + 1] = lerp(g, 0.349 * r + 0.686 * g + 0.168 * b, t)
        data[i + 2] = lerp(b, 0.272 * r + 0.534 * g + 0.131 * b, t)
        break
      }
      case 'invert':
        data[i] = lerp(r, 255 - r, t)
        data[i + 1] = lerp(g, 255 - g, t)
        data[i + 2] = lerp(b, 255 - b, t)
        break
      case 'brightness': {
        const d = t * 255
        data[i] = r + d
        data[i + 1] = g + d
        data[i + 2] = b + d
        break
      }
      case 'contrast': {
        // Classic contrast factor; at +-100 the denominator stays positive.
        const c = Math.max(-255, Math.min(254, t * 255))
        const f = (259 * (c + 255)) / (255 * (259 - c))
        data[i] = f * (r - 128) + 128
        data[i + 1] = f * (g - 128) + 128
        data[i + 2] = f * (b - 128) + 128
        break
      }
      case 'saturation': {
        const y = luma(r, g, b)
        const k = 1 + t
        data[i] = y + (r - y) * k
        data[i + 1] = y + (g - y) * k
        data[i + 2] = y + (b - y) * k
        break
      }
    }
  }
}

export type FilterSettings = Partial<Record<FilterId, number>>

/** Tone adjustments run before colour effects so the result does not depend on slider order. */
const ORDER: FilterId[] = ['saturation', 'brightness', 'contrast', 'sepia', 'grayscale', 'blackwhite', 'invert']

/** Apply every filter present in `settings` in a fixed order. */
export function applyFilters(data: Uint8ClampedArray, settings: FilterSettings): void {
  for (const id of ORDER) {
    const amount = settings[id]
    if (amount !== undefined) applyFilter(data, id, amount)
  }
}
