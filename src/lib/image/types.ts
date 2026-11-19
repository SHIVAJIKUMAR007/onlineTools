export type OutputFormat = 'jpeg' | 'png' | 'webp' | 'avif'

export const FORMAT_MIME: Record<OutputFormat, string> = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  avif: 'image/avif',
}

export const FORMAT_EXT: Record<OutputFormat, string> = {
  jpeg: 'jpg',
  png: 'png',
  webp: 'webp',
  avif: 'avif',
}

export type Rotation = 0 | 90 | 180 | 270

export interface CropRect {
  x: number
  y: number
  width: number
  height: number
}

export interface ProcessOptions {
  format: OutputFormat
  /** 1 to 100. Ignored for PNG. */
  quality?: number
  /** Fill color for transparent pixels. Always applied for JPEG (defaults to white). */
  background?: string
  /** Applied after rotation/flip and crop. */
  resize?: { width: number; height: number }
  /** In pixels of the image after rotation and flip. */
  crop?: CropRect
  rotate?: Rotation
  flipH?: boolean
  flipV?: boolean
  /** WebP only. */
  lossless?: boolean
  /** PNG only. Runs OxiPNG after encoding. */
  optimizePng?: boolean
}

export interface ProcessResult {
  blob: Blob
  width: number
  height: number
  /** Codec actually used, useful when a fallback kicked in. */
  encoder: 'mozjpeg' | 'webp-wasm' | 'avif-wasm' | 'oxipng' | 'canvas'
}

export const MAX_PIXELS = 120_000_000
