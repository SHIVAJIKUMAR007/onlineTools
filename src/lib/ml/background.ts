/**
 * Main-thread client for the background-removal worker. The heavy ML bundle
 * lives in the worker chunk and is only fetched when this class is first used.
 */
import type { BgRequest, BgResponse } from '@/workers/bg.worker'
import type { BgModel } from './models'

// The ONNX Runtime files are bundled with the site, so no CDN is contacted.
// Only the plain CPU build is bundled. The WebGPU ("asyncify") build is 25.6 MiB,
// which exceeds Cloudflare's 25 MiB per-asset limit, so WebGPU is disabled.
import wasmPlain from 'onnxruntime-web/ort-wasm-simd-threaded.wasm?url'
import mjsPlain from 'onnxruntime-web/ort-wasm-simd-threaded.mjs?url'

export type Device = 'webgpu' | 'wasm'

export async function detectWebGpu(): Promise<boolean> {
  return false
}

export interface RemoveResult {
  width: number
  height: number
  rgba: Uint8ClampedArray
}

export class BackgroundRemover {
  private worker: Worker | null = null
  private nextId = 1
  private pending = new Map<number, { resolve: (r: RemoveResult) => void; reject: (e: Error) => void }>()
  private loadWaiter: { resolve: (d: Device) => void; reject: (e: Error) => void } | null = null
  onProgress?: (loaded: number, total: number) => void

  async load(model: BgModel, device: Device): Promise<Device> {
    this.dispose()
    const worker = new Worker(new URL('../../workers/bg.worker.ts', import.meta.url), { type: 'module' })
    this.worker = worker
    worker.onmessage = (e: MessageEvent<BgResponse>) => this.handle(e.data)
    worker.onerror = (e) => this.fail(new Error(e.message || 'The background remover could not start in this browser.'))
    const abs = (u: string) => new URL(u, location.href).href
    return new Promise<Device>((resolve, reject) => {
      this.loadWaiter = { resolve, reject }
      const req: BgRequest = {
        type: 'load',
        repo: model.repo,
        runtime: model.runtime,
        dtype: model.dtype,
        device,
        wasm: { mjs: abs(mjsPlain), wasm: abs(wasmPlain) },
      }
      worker.postMessage(req)
    })
  }

  remove(blob: Blob): Promise<RemoveResult> {
    if (!this.worker) return Promise.reject(new Error('The model is not loaded.'))
    const id = this.nextId++
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      this.worker!.postMessage({ type: 'run', id, blob } satisfies BgRequest)
    })
  }

  private handle(msg: BgResponse) {
    switch (msg.type) {
      case 'progress':
        this.onProgress?.(msg.loaded, msg.total)
        break
      case 'ready':
        this.loadWaiter?.resolve(msg.device)
        this.loadWaiter = null
        break
      case 'result': {
        const p = this.pending.get(msg.id)
        this.pending.delete(msg.id)
        p?.resolve({ width: msg.width, height: msg.height, rgba: msg.rgba })
        break
      }
      case 'error': {
        const err = new Error(msg.message)
        if (msg.id !== undefined) {
          const p = this.pending.get(msg.id)
          this.pending.delete(msg.id)
          p?.reject(err)
        } else this.fail(err)
      }
    }
  }

  private fail(err: Error) {
    this.loadWaiter?.reject(err)
    this.loadWaiter = null
    for (const p of this.pending.values()) p.reject(err)
    this.pending.clear()
  }

  dispose() {
    this.worker?.terminate()
    this.worker = null
    const err = new Error('Cancelled')
    err.name = 'AbortError'
    this.fail(err)
  }
}
