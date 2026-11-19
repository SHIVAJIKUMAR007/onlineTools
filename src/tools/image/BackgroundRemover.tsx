import { useCallback, useEffect, useRef, useState } from 'react'
import { Cpu, DownloadCloud, Trash2, X, Zap } from 'lucide-react'
import { FileDropzone } from '@/components/tools/FileDropzone'
import { BeforeAfter } from '@/components/tools/BeforeAfter'
import { DownloadButton, Panel } from '@/components/tools/controls'
import { Alert, Badge, ProgressBar } from '@/components/ui/misc'
import { Button } from '@/components/ui/button'
import { Segmented } from '@/components/ui/fields'
import { useFileUpload } from '@/hooks/useFileUpload'
import { useObjectUrl } from '@/hooks/useObjectUrl'
import { BackgroundRemover as Remover, detectWebGpu, type Device, type RemoveResult } from '@/lib/ml/background'
import { BG_MODELS, modelById } from '@/lib/ml/models'
import { prepareInput } from '@/lib/image/client'
import { baseName } from '@/lib/utils/filename'
import { downloadBlob } from '@/lib/utils/download'
import { formatBytes, formatDuration } from '@/lib/utils/format'
import { cn } from '@/lib/utils/cn'

const ACCEPT = ['image/jpeg', 'image/png', 'image/webp', '.jpg', '.jpeg', '.png', '.webp']
const MAX_SIDE = 2048

type Phase = 'idle' | 'downloading' | 'removing' | 'done' | 'error'

const SWATCHES = ['#ffffff', '#000000', '#f3f4f6', '#e11d48', '#2563eb', '#16a34a', '#f59e0b']

/** Downscale very large photos so inference memory stays reasonable. */
async function toWorkingBlob(file: Blob): Promise<{ blob: Blob; scaled: boolean; w: number; h: number }> {
  const input = await prepareInput(file)
  const bmp = await createImageBitmap(input)
  const s = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height))
  if (s === 1) {
    const out = { blob: input, scaled: false, w: bmp.width, h: bmp.height }
    bmp.close()
    return out
  }
  const c = document.createElement('canvas')
  c.width = Math.round(bmp.width * s)
  c.height = Math.round(bmp.height * s)
  const ctx = c.getContext('2d')!
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bmp, 0, 0, c.width, c.height)
  bmp.close()
  const blob = await new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('Could not prepare the image.'))), 'image/png'))
  return { blob, scaled: true, w: c.width, h: c.height }
}

function compose(result: RemoveResult, bg: string | null): Promise<Blob> {
  const src = document.createElement('canvas')
  src.width = result.width
  src.height = result.height
  src.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(result.rgba), result.width, result.height), 0, 0)
  const out = document.createElement('canvas')
  out.width = result.width
  out.height = result.height
  const ctx = out.getContext('2d')!
  if (bg) {
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, out.width, out.height)
  }
  ctx.drawImage(src, 0, 0)
  return new Promise((res, rej) => out.toBlob((b) => (b ? res(b) : rej(new Error('Could not create the PNG.'))), 'image/png'))
}

export default function BackgroundRemover() {
  const { files, rejected, loading, addFiles, clear } = useFileUpload({ accept: ACCEPT, multiple: false })
  const upload = files[0]
  const [modelId, setModelId] = useState(BG_MODELS[0].id)
  const model = modelById(modelId)
  const [webgpu, setWebgpu] = useState<boolean | null>(null)
  const [phase, setPhase] = useState<Phase>('idle')
  const [progress, setProgress] = useState<{ loaded: number; total: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [device, setDevice] = useState<Device | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [note, setNote] = useState<string | null>(null)
  const [result, setResult] = useState<RemoveResult | null>(null)
  const [bg, setBg] = useState<string | null>(null)
  const [cutout, setCutout] = useState<Blob | null>(null)
  const originalUrl = useObjectUrl(upload?.file)
  const cutoutUrl = useObjectUrl(cutout)
  const remover = useRef<Remover | null>(null)
  const loadedKey = useRef<string | null>(null)
  const runToken = useRef(0)

  useEffect(() => {
    void detectWebGpu().then(setWebgpu)
    return () => remover.current?.dispose()
  }, [])

  // Re-compose when the background choice changes. Cheap, no inference.
  useEffect(() => {
    if (!result) return
    let cancelled = false
    void compose(result, bg).then((b) => !cancelled && setCutout(b))
    return () => {
      cancelled = true
    }
  }, [result, bg])

  const run = useCallback(async () => {
    if (!upload) return
    const token = ++runToken.current
    setError(null)
    setResult(null)
    setCutout(null)
    setNote(null)
    setProgress(null)
    const useDevice: Device = webgpu ? 'webgpu' : 'wasm'
    try {
      const key = `${model.id}:${useDevice}`
      remover.current ??= new Remover()
      const r = remover.current
      if (loadedKey.current !== key) {
        setPhase('downloading')
        r.onProgress = (loaded, total) => runToken.current === token && setProgress({ loaded, total })
        const used = await r.load(model, useDevice)
        setDevice(used)
        loadedKey.current = key
      } else setDevice(useDevice)
      if (runToken.current !== token) return
      setPhase('removing')
      const started = performance.now()
      const timer = setInterval(() => setElapsed(performance.now() - started), 250)
      try {
        const prep = await toWorkingBlob(upload.file)
        if (prep.scaled) setNote(`Large photo scaled to ${prep.w} × ${prep.h} pixels for processing. The cutout will have that size.`)
        const out = await r.remove(prep.blob)
        if (runToken.current !== token) return
        setResult(out)
        setElapsed(performance.now() - started)
        setPhase('done')
      } finally {
        clearInterval(timer)
      }
    } catch (e) {
      if (runToken.current !== token) return
      if (e instanceof Error && e.name === 'AbortError') {
        setPhase('idle')
        return
      }
      loadedKey.current = null
      remover.current?.dispose()
      remover.current = null
      setPhase('error')
      const msg = e instanceof Error ? e.message : String(e)
      setError(
        /fetch|network|Failed to load|load model/i.test(msg)
          ? `The model could not be downloaded. Check your connection and try again. (${msg})`
          : /memory|alloc|out of/i.test(msg)
            ? `The device ran out of memory. Try a smaller photo or the Portraits model. (${msg})`
            : msg,
      )
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [upload, model, webgpu])

  // Start automatically once WebGPU detection has finished and a file is chosen.
  useEffect(() => {
    if (upload && webgpu !== null) void run()
    // Only restart when the file or model changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [upload, modelId, webgpu])

  const cancel = () => {
    runToken.current++
    remover.current?.dispose()
    remover.current = null
    loadedKey.current = null
    setPhase('idle')
  }

  const reset = () => {
    cancel()
    clear()
    setResult(null)
    setCutout(null)
    setError(null)
  }

  const busy = phase === 'downloading' || phase === 'removing'

  return (
    <div className="space-y-5">
      <Panel title="Model">
        <div className="space-y-3">
          <Segmented label="Model" value={modelId} onChange={setModelId} options={BG_MODELS.map((m) => ({ value: m.id, label: `${m.label} · ${m.sizeMB} MB` }))} />
          <p className="text-sm text-ink-2">{model.description}</p>
          {model.licenseNote && <Alert tone="warn">{model.licenseNote}</Alert>}
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
            <Badge tone={model.licenseNote ? 'warn' : 'neutral'}>{model.license} licence</Badge>
            <Badge tone={webgpu ? 'accent' : 'neutral'}>
              {webgpu === null ? 'Checking device…' : webgpu ? <><Zap className="size-3" aria-hidden /> WebGPU available</> : <><Cpu className="size-3" aria-hidden /> CPU (WebAssembly)</>}
            </Badge>
          </div>
          <Alert tone="info" title="First use downloads the model">
            The first time you remove a background, your browser downloads about {model.sizeMB} MB of model data from huggingface.co, plus the ONNX Runtime files from this site. It is stored in your browser cache and reused next time. Your photo is never part of that download and is never uploaded.
          </Alert>
        </div>
      </Panel>

      {!upload ? (
        <FileDropzone accept={ACCEPT} rejected={rejected} loading={loading} onFiles={(f) => void addFiles(f)} hint="JPG, PNG, WebP · the model downloads on first use" />
      ) : (
        <Panel
          title={upload.name}
          actions={
            <div className="flex gap-2">
              {busy && (
                <Button size="sm" onClick={cancel}>
                  <X className="size-4" aria-hidden /> Cancel
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={reset}>
                <Trash2 className="size-4" aria-hidden /> Choose another
              </Button>
            </div>
          }
        >
          {phase === 'downloading' && (
            <div className="space-y-2" aria-live="polite">
              <p className="flex items-center gap-2 text-sm font-medium">
                <DownloadCloud className="size-4 text-accent" aria-hidden />
                {progress ? `Downloading model: ${formatBytes(progress.loaded)} of ${formatBytes(progress.total)}` : 'Preparing the model…'}
              </p>
              <ProgressBar value={progress ? progress.loaded / progress.total : undefined} label="Model download" />
              <p className="text-xs text-muted">This only happens once. Next time the model loads from your browser cache.</p>
            </div>
          )}
          {phase === 'removing' && (
            <div className="space-y-2" aria-live="polite">
              <p className="text-sm font-medium">Removing background… {formatDuration(elapsed)}</p>
              <ProgressBar label="Removing background" />
              <p className="text-xs text-muted">The model does not report partial progress, so this bar only shows that work is underway.</p>
            </div>
          )}
          {phase === 'error' && (
            <div className="space-y-3">
              <Alert tone="danger" title="Background removal failed">{error}</Alert>
              <Button onClick={() => void run()}>Try again</Button>
            </div>
          )}
          {note && <Alert tone="info" className="mt-3">{note}</Alert>}

          {phase === 'done' && cutoutUrl && originalUrl && (
            <div className="mt-1 space-y-5">
              <BeforeAfter before={originalUrl} after={cutoutUrl} beforeLabel="Original" afterLabel="Cutout" checker={bg === null} />
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-ink-2">Background</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      aria-pressed={bg === null}
                      aria-label="Transparent background"
                      onClick={() => setBg(null)}
                      className={cn('checker size-9 cursor-pointer rounded-lg border-2', bg === null ? 'border-accent' : 'border-line-strong')}
                    />
                    {SWATCHES.map((c) => (
                      <button
                        key={c}
                        type="button"
                        aria-pressed={bg === c}
                        aria-label={`Background ${c}`}
                        onClick={() => setBg(c)}
                        style={{ background: c }}
                        className={cn('size-9 cursor-pointer rounded-lg border-2', bg === c ? 'border-accent' : 'border-line-strong')}
                      />
                    ))}
                    <input
                      type="color"
                      aria-label="Custom background color"
                      value={bg ?? '#ffffff'}
                      onChange={(e) => setBg(e.target.value)}
                      className="size-9 cursor-pointer rounded-lg border border-line-strong bg-paper p-0.5"
                    />
                  </div>
                </div>
                <DownloadButton onClick={() => { if (cutout) downloadBlob(cutout, `${baseName(upload.name)}-${bg ? 'background' : 'cutout'}.png`) }}>
                  Download PNG {cutout ? `(${formatBytes(cutout.size)})` : ''}
                </DownloadButton>
              </div>
              <p className="text-xs text-muted">
                Processed on {device === 'webgpu' ? 'your GPU (WebGPU)' : 'your CPU (WebAssembly)'} in {formatDuration(elapsed)}. Check hair, glass and fine edges before using the result.
              </p>
            </div>
          )}
        </Panel>
      )}
    </div>
  )
}
