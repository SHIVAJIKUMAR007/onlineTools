/**
 * Image pipeline shared by the Web Worker and the main-thread fallback.
 * Must not touch `window` or React. Uses OffscreenCanvas when it exists and
 * falls back to a DOM canvas otherwise.
 */
import { FORMAT_MIME, MAX_PIXELS, type OutputFormat, type ProcessOptions, type ProcessResult } from './types'

type AnyCanvas = OffscreenCanvas | HTMLCanvasElement
type AnyCtx = OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D

export function createCanvas(width: number, height: number): AnyCanvas {
  const w = Math.max(1, Math.round(width))
  const h = Math.max(1, Math.round(height))
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h)
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return c
}

function ctx2d(canvas: AnyCanvas, opts?: CanvasRenderingContext2DSettings): AnyCtx {
  const ctx = canvas.getContext('2d', opts) as AnyCtx | null
  if (!ctx) throw new Error('This browser could not create a drawing surface. Try a smaller image.')
  return ctx
}

export async function canvasToBlob(canvas: AnyCanvas, type: string, quality?: number): Promise<Blob> {
  if ('convertToBlob' in canvas) return canvas.convertToBlob({ type, quality })
  return new Promise((resolve, reject) =>
    (canvas as HTMLCanvasElement).toBlob((b) => (b ? resolve(b) : reject(new Error('The browser could not encode the image.'))), type, quality),
  )
}

export function assertSize(width: number, height: number) {
  if (width * height > MAX_PIXELS) {
    throw new Error(
      `This image is ${width} × ${height} pixels (${Math.round((width * height) / 1e6)} megapixels). It is too large for the browser to process safely. Resize it first or use a smaller image.`,
    )
  }
}

/** Draw `source` rotated and flipped onto a new canvas. */
export function transformCanvas(
  source: ImageBitmap | AnyCanvas,
  sw: number,
  sh: number,
  rotate: number,
  flipH: boolean,
  flipV: boolean,
): AnyCanvas {
  const swap = rotate === 90 || rotate === 270
  const canvas = createCanvas(swap ? sh : sw, swap ? sw : sh)
  const ctx = ctx2d(canvas)
  ctx.translate(canvas.width / 2, canvas.height / 2)
  ctx.rotate((rotate * Math.PI) / 180)
  ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1)
  ctx.drawImage(source as CanvasImageSource, -sw / 2, -sh / 2)
  return canvas
}

function cropCanvas(source: AnyCanvas, x: number, y: number, w: number, h: number): AnyCanvas {
  const canvas = createCanvas(w, h)
  ctx2d(canvas).drawImage(source as CanvasImageSource, x, y, w, h, 0, 0, canvas.width, canvas.height)
  return canvas
}

/** Halve repeatedly, then draw once with high-quality smoothing. Keeps edges clean on big reductions. */
export function resizeCanvas(source: AnyCanvas, targetW: number, targetH: number): AnyCanvas {
  let current: AnyCanvas = source
  let w = source.width
  let h = source.height
  const tw = Math.max(1, Math.round(targetW))
  const th = Math.max(1, Math.round(targetH))
  while (w / 2 >= tw && h / 2 >= th) {
    const nw = Math.max(tw, Math.floor(w / 2))
    const nh = Math.max(th, Math.floor(h / 2))
    const next = createCanvas(nw, nh)
    const c = ctx2d(next)
    c.imageSmoothingEnabled = true
    c.imageSmoothingQuality = 'high'
    c.drawImage(current as CanvasImageSource, 0, 0, nw, nh)
    current = next
    w = nw
    h = nh
  }
  if (w !== tw || h !== th) {
    const next = createCanvas(tw, th)
    const c = ctx2d(next)
    c.imageSmoothingEnabled = true
    c.imageSmoothingQuality = 'high'
    c.drawImage(current as CanvasImageSource, 0, 0, tw, th)
    current = next
  }
  return current
}

function flatten(canvas: AnyCanvas, background: string): AnyCanvas {
  const out = createCanvas(canvas.width, canvas.height)
  const ctx = ctx2d(out)
  ctx.fillStyle = background
  ctx.fillRect(0, 0, out.width, out.height)
  ctx.drawImage(canvas as CanvasImageSource, 0, 0)
  return out
}

function imageDataOf(canvas: AnyCanvas): ImageData {
  return ctx2d(canvas, { willReadFrequently: true }).getImageData(0, 0, canvas.width, canvas.height)
}

const clampQuality = (q: number | undefined, fallback: number) => Math.min(100, Math.max(1, Math.round(q ?? fallback)))

async function encodeCanvas(
  canvas: AnyCanvas,
  format: OutputFormat,
  opts: ProcessOptions,
): Promise<{ blob: Blob; encoder: ProcessResult['encoder'] }> {
  const quality = clampQuality(opts.quality, 82)
  const mime = FORMAT_MIME[format]

  if (format === 'jpeg') {
    try {
      const { default: encode } = await import('@jsquash/jpeg/encode.js')
      const buf = await encode(imageDataOf(canvas), { quality })
      return { blob: new Blob([buf], { type: mime }), encoder: 'mozjpeg' }
    } catch {
      return { blob: await canvasToBlob(canvas, mime, quality / 100), encoder: 'canvas' }
    }
  }

  if (format === 'png') {
    const raw = await canvasToBlob(canvas, mime)
    if (!opts.optimizePng) return { blob: raw, encoder: 'canvas' }
    try {
      const { default: optimise } = await import('@jsquash/oxipng/optimise.js')
      const out = await optimise(await raw.arrayBuffer(), { level: 2, interlace: false })
      const blob = new Blob([out], { type: mime })
      return blob.size < raw.size ? { blob, encoder: 'oxipng' } : { blob: raw, encoder: 'canvas' }
    } catch {
      return { blob: raw, encoder: 'canvas' }
    }
  }

  if (format === 'webp') {
    try {
      const { default: encode } = await import('@jsquash/webp/encode.js')
      const buf = await encode(imageDataOf(canvas), opts.lossless ? { lossless: 1 } : { quality })
      return { blob: new Blob([buf], { type: mime }), encoder: 'webp-wasm' }
    } catch {
      const blob = await canvasToBlob(canvas, mime, quality / 100)
      if (blob.type !== mime) throw new Error('This browser cannot encode WebP.')
      return { blob, encoder: 'canvas' }
    }
  }

  // AVIF: browsers rarely encode it natively, so we always use the WebAssembly codec.
  const { default: encode } = await import('@jsquash/avif/encode.js')
  const buf = await encode(imageDataOf(canvas), { quality, speed: 8 } as never)
  return { blob: new Blob([buf], { type: mime }), encoder: 'avif-wasm' }
}

export async function processImage(input: Blob, opts: ProcessOptions): Promise<ProcessResult> {
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(input)
  } catch {
    throw new Error('This file could not be read as an image. It may be damaged or in an unsupported format.')
  }
  try {
    assertSize(bitmap.width, bitmap.height)
    const rotate = opts.rotate ?? 0
    const needsTransform = rotate !== 0 || opts.flipH || opts.flipV
    let canvas: AnyCanvas = needsTransform
      ? transformCanvas(bitmap, bitmap.width, bitmap.height, rotate, !!opts.flipH, !!opts.flipV)
      : (() => {
          const c = createCanvas(bitmap.width, bitmap.height)
          ctx2d(c).drawImage(bitmap, 0, 0)
          return c
        })()

    if (opts.crop) {
      const x = Math.max(0, Math.round(opts.crop.x))
      const y = Math.max(0, Math.round(opts.crop.y))
      const w = Math.min(canvas.width - x, Math.round(opts.crop.width))
      const h = Math.min(canvas.height - y, Math.round(opts.crop.height))
      if (w < 1 || h < 1) throw new Error('The crop area is empty.')
      canvas = cropCanvas(canvas, x, y, w, h)
    }

    if (opts.resize && (opts.resize.width !== canvas.width || opts.resize.height !== canvas.height)) {
      assertSize(opts.resize.width, opts.resize.height)
      canvas = resizeCanvas(canvas, opts.resize.width, opts.resize.height)
    }

    // JPEG cannot hold alpha, so flatten onto a background. Other formats only flatten on request.
    if (opts.format === 'jpeg') canvas = flatten(canvas, opts.background ?? '#ffffff')
    else if (opts.background) canvas = flatten(canvas, opts.background)

    const { blob, encoder } = await encodeCanvas(canvas, opts.format, opts)
    return { blob, width: canvas.width, height: canvas.height, encoder }
  } finally {
    bitmap.close()
  }
}
