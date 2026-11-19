/**
 * Main-thread entry point for image work. Jobs go to a Web Worker when the
 * browser supports OffscreenCanvas in workers; otherwise they run on the main
 * thread through the same code path.
 */
import { processImage as processOnMainThread } from './core'
import { sniffFile } from '@/lib/utils/sniff'
import type { ProcessOptions, ProcessResult } from './types'
import type { WorkerRequest, WorkerResponse } from '@/workers/image.worker'

interface Pending {
  resolve: (r: ProcessResult) => void
  reject: (e: Error) => void
}

let worker: Worker | null = null
let workerBroken = false
let nextId = 1
const pending = new Map<number, Pending>()

export class AbortedError extends Error {
  constructor() {
    super('Cancelled')
    this.name = 'AbortError'
  }
}

function workerSupported() {
  return typeof Worker !== 'undefined' && typeof OffscreenCanvas !== 'undefined' && !workerBroken
}

function getWorker(): Worker {
  if (worker) return worker
  const w = new Worker(new URL('../../workers/image.worker.ts', import.meta.url), { type: 'module' })
  w.onmessage = (e: MessageEvent<WorkerResponse>) => {
    const msg = e.data
    const p = pending.get(msg.id)
    if (!p) return
    pending.delete(msg.id)
    if (msg.ok) p.resolve({ blob: msg.blob, width: msg.width, height: msg.height, encoder: msg.encoder as ProcessResult['encoder'] })
    else p.reject(new Error(msg.error))
  }
  w.onerror = () => {
    // The worker itself failed to start (blocked, unsupported). Fall back for all future jobs.
    workerBroken = true
    const err = new Error('worker-failed')
    for (const p of pending.values()) p.reject(err)
    pending.clear()
    w.terminate()
    worker = null
  }
  worker = w
  return w
}

export function disposeImageWorker() {
  worker?.terminate()
  worker = null
  for (const p of pending.values()) p.reject(new AbortedError())
  pending.clear()
}

export async function processImage(file: Blob, opts: ProcessOptions, signal?: AbortSignal): Promise<ProcessResult> {
  if (signal?.aborted) throw new AbortedError()
  const input = await prepareInput(file)
  if (signal?.aborted) throw new AbortedError()

  if (workerSupported()) {
    try {
      return await new Promise<ProcessResult>((resolve, reject) => {
        const id = nextId++
        pending.set(id, { resolve, reject })
        const onAbort = () => {
          // Terminating is the only way to stop a running codec.
          pending.delete(id)
          disposeImageWorker()
          reject(new AbortedError())
        }
        signal?.addEventListener('abort', onAbort, { once: true })
        const req: WorkerRequest = { id, file: input, opts }
        getWorker().postMessage(req)
      })
    } catch (e) {
      if (!(e instanceof Error && e.message === 'worker-failed')) throw e
    }
  }
  return processOnMainThread(input, opts)
}

/**
 * Convert inputs that `createImageBitmap` cannot decode in a worker:
 * SVG (needs an <img>) and HEIC (needs a decoder library).
 */
export async function prepareInput(file: Blob): Promise<Blob> {
  const type = await sniffFile(file)
  if (type === 'image/svg+xml') return rasterizeSvg(file)
  if (type === 'image/heic') return decodeHeic(file)
  return file
}

export async function decodeHeic(file: Blob): Promise<Blob> {
  const { default: heic2any } = await import('heic2any')
  const out = await heic2any({ blob: file, toType: 'image/png' })
  return Array.isArray(out) ? out[0] : out
}

export async function rasterizeSvg(file: Blob, maxSide = 2048): Promise<Blob> {
  const text = await file.text()
  const url = URL.createObjectURL(new Blob([text], { type: 'image/svg+xml' }))
  try {
    const img = new Image()
    img.decoding = 'async'
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('This SVG could not be rendered.'))
      img.src = url
    })
    let w = img.naturalWidth || 512
    let h = img.naturalHeight || 512
    const scale = Math.min(1, maxSide / Math.max(w, h))
    // Small SVGs are upscaled so they stay crisp as bitmaps.
    const up = Math.max(w, h) < 512 ? 512 / Math.max(w, h) : 1
    w = Math.round(w * scale * up)
    h = Math.round(h * scale * up)
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    canvas.getContext('2d')!.drawImage(img, 0, 0, w, h)
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not rasterize the SVG.'))), 'image/png'),
    )
  } finally {
    URL.revokeObjectURL(url)
  }
}

export interface ImageInfo {
  width: number
  height: number
}

export async function readImageInfo(file: Blob): Promise<ImageInfo> {
  const input = await prepareInput(file)
  const bmp = await createImageBitmap(input)
  const info = { width: bmp.width, height: bmp.height }
  bmp.close()
  return info
}
