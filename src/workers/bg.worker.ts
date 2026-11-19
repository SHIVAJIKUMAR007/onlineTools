/// <reference lib="webworker" />
/**
 * Runs the background-removal model off the main thread. The model and the
 * ONNX Runtime WebAssembly files are the only things downloaded; the image
 * itself never leaves this worker except as a result sent back to the page.
 */
import { AutoModel, AutoProcessor, env, pipeline, RawImage } from '@huggingface/transformers'

export type BgRequest =
  | { type: 'load'; repo: string; runtime: 'pipeline' | 'rmbg'; dtype: 'fp32' | 'fp16' | 'q8'; device: 'webgpu' | 'wasm'; wasm: { mjs: string; wasm: string } }
  | { type: 'run'; id: number; blob: Blob }

export type BgResponse =
  | { type: 'progress'; loaded: number; total: number; file?: string }
  | { type: 'ready'; device: 'webgpu' | 'wasm' }
  | { type: 'result'; id: number; width: number; height: number; rgba: Uint8ClampedArray }
  | { type: 'error'; id?: number; message: string }

const post = (m: BgResponse, transfer: Transferable[] = []) => self.postMessage(m, transfer)

// Never look for models on this site's server, and never use the CDN for the runtime.
env.allowLocalModels = false
env.useBrowserCache = true

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let pipe: any = null
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let rmbg: { model: any; processor: any } | null = null

const files = new Map<string, { loaded: number; total: number }>()

self.onmessage = async (e: MessageEvent<BgRequest>) => {
  const msg = e.data
  if (msg.type === 'load') {
    try {
      // Point the ONNX runtime at the copies bundled with this site.
      env.backends.onnx.wasm!.wasmPaths = { mjs: msg.wasm.mjs, wasm: msg.wasm.wasm }
      pipe = null
      rmbg = null
      files.clear()
      const progress_callback = (p: { status: string; file?: string; loaded?: number; total?: number }) => {
          if (p.status === 'progress' && p.file && p.total) {
            files.set(p.file, { loaded: p.loaded ?? 0, total: p.total })
          } else if (p.status === 'done' && p.file) {
            const f = files.get(p.file)
            if (f) files.set(p.file, { loaded: f.total, total: f.total })
          }
          let loaded = 0
          let total = 0
          for (const f of files.values()) {
            loaded += f.loaded
            total += f.total
          }
          if (total) post({ type: 'progress', loaded, total, file: p.file })
      }
      if (msg.runtime === 'rmbg') {
        const model = await AutoModel.from_pretrained(msg.repo, { config: { model_type: 'custom' } as never, device: msg.device, dtype: msg.dtype, progress_callback })
        const processor = await AutoProcessor.from_pretrained(msg.repo, {
          config: {
            do_normalize: true,
            do_pad: false,
            do_rescale: true,
            do_resize: true,
            image_mean: [0.5, 0.5, 0.5],
            feature_extractor_type: 'ImageFeatureExtractor',
            image_std: [1, 1, 1],
            resample: 2,
            rescale_factor: 0.00392156862745098,
            size: { width: 1024, height: 1024 },
          } as never,
        })
        rmbg = { model, processor }
      } else {
        pipe = await pipeline('background-removal', msg.repo, { device: msg.device, dtype: msg.dtype, progress_callback })
      }
      post({ type: 'ready', device: msg.device })
    } catch (err) {
      post({ type: 'error', message: err instanceof Error ? err.message : String(err) })
    }
    return
  }

  if (msg.type === 'run') {
    try {
      if (!pipe && !rmbg) throw new Error('The model is not loaded yet.')
      const image = await RawImage.fromBlob(msg.blob)
      let out
      if (rmbg) {
        const { pixel_values } = await rmbg.processor(image)
        const { output } = await rmbg.model({ input: pixel_values })
        const mask = await RawImage.fromTensor(output[0].mul(255).to('uint8')).resize(image.width, image.height)
        out = image.clone().putAlpha(mask)
      } else out = await pipe(image)
      // `out` is an RGBA RawImage the size of the input, with the mask as its alpha channel.
      const rgba = out.channels === 4 ? new Uint8ClampedArray(out.data) : (out.rgba() as { data: Uint8ClampedArray }).data
      post({ type: 'result', id: msg.id, width: out.width, height: out.height, rgba }, [rgba.buffer])
    } catch (err) {
      post({ type: 'error', id: msg.id, message: err instanceof Error ? err.message : String(err) })
    }
  }
}
