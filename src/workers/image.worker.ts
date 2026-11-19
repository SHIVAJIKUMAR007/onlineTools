/// <reference lib="webworker" />
import { processImage } from '@/lib/image/core'
import type { ProcessOptions } from '@/lib/image/types'

export interface WorkerRequest {
  id: number
  file: Blob
  opts: ProcessOptions
}

export type WorkerResponse =
  | { id: number; ok: true; blob: Blob; width: number; height: number; encoder: string }
  | { id: number; ok: false; error: string }

self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const { id, file, opts } = e.data
  try {
    const r = await processImage(file, opts)
    self.postMessage({ id, ok: true, blob: r.blob, width: r.width, height: r.height, encoder: r.encoder } satisfies WorkerResponse)
  } catch (err) {
    self.postMessage({ id, ok: false, error: err instanceof Error ? err.message : String(err) } satisfies WorkerResponse)
  }
}
