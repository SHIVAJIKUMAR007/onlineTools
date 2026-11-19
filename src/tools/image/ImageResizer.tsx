import { useEffect, useMemo, useRef, useState } from 'react'
import { Link2, Link2Off, Trash2 } from 'lucide-react'
import { FileDropzone } from '@/components/tools/FileDropzone'
import { DownloadButton, OptionRow, Panel, QualitySlider } from '@/components/tools/controls'
import { BeforeAfter } from '@/components/tools/BeforeAfter'
import { Alert, ProgressBar, Stat } from '@/components/ui/misc'
import { Button } from '@/components/ui/button'
import { Field, Input, Segmented, Select } from '@/components/ui/fields'
import { useSingleImage } from '@/hooks/useSingleImage'
import { processImage } from '@/lib/image/client'
import { centerCropForRatio } from '@/lib/image/crop'
import { FORMAT_EXT, type OutputFormat, type ProcessResult } from '@/lib/image/types'
import { baseName } from '@/lib/utils/filename'
import { downloadBlob } from '@/lib/utils/download'
import { formatBytes } from '@/lib/utils/format'
import { useObjectUrl } from '@/hooks/useObjectUrl'

const ACCEPT = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif', 'image/bmp', '.jpg', '.jpeg', '.png', '.webp', '.avif', '.gif', '.bmp']

const PRESETS = [
  { id: 'ig-post', label: 'Instagram post (1080 × 1080)', w: 1080, h: 1080 },
  { id: 'ig-story', label: 'Instagram story (1080 × 1920)', w: 1080, h: 1920 },
  { id: 'yt-thumb', label: 'YouTube thumbnail (1280 × 720)', w: 1280, h: 720 },
  { id: 'og', label: 'Open Graph / link preview (1200 × 630)', w: 1200, h: 630 },
  { id: 'x-header', label: 'X header (1500 × 500)', w: 1500, h: 500 },
  { id: 'fb-cover', label: 'Facebook cover (820 × 312)', w: 820, h: 312 },
  { id: 'hd', label: 'Full HD (1920 × 1080)', w: 1920, h: 1080 },
  { id: 'icon', label: 'App icon (512 × 512)', w: 512, h: 512 },
  { id: 'avatar', label: 'Avatar (256 × 256)', w: 256, h: 256 },
]

const MAX_SIDE = 16000

export default function ImageResizer() {
  const { image, previewUrl, error, rejected, loading, load, reset } = useSingleImage(ACCEPT)
  const [mode, setMode] = useState<'pixels' | 'percent'>('pixels')
  const [width, setWidth] = useState(0)
  const [height, setHeight] = useState(0)
  const [lock, setLock] = useState(true)
  const [percent, setPercent] = useState(50)
  const [fit, setFit] = useState<'stretch' | 'fill'>('stretch')
  const [format, setFormat] = useState<'original' | OutputFormat>('original')
  const [quality, setQuality] = useState(90)
  const [background, setBackground] = useState('#ffffff')
  const [result, setResult] = useState<(ProcessResult & { name: string }) | null>(null)
  const [busy, setBusy] = useState(false)
  const [procError, setProcError] = useState<string | null>(null)
  const resultUrl = useObjectUrl(result?.blob)
  const runRef = useRef(0)

  useEffect(() => {
    if (image) {
      setWidth(image.width)
      setHeight(image.height)
      setPercent(50)
      setResult(null)
    }
  }, [image])

  const ratio = image ? image.width / image.height : 1
  const target = useMemo(() => {
    if (!image) return { w: 0, h: 0 }
    if (mode === 'percent') return { w: Math.max(1, Math.round((image.width * percent) / 100)), h: Math.max(1, Math.round((image.height * percent) / 100)) }
    return { w: Math.max(1, Math.round(width)), h: Math.max(1, Math.round(height)) }
  }, [image, mode, percent, width, height])

  const outFormat: OutputFormat = format === 'original' ? (image?.upload.sniffed === 'image/png' ? 'png' : image?.upload.sniffed === 'image/webp' ? 'webp' : image?.upload.sniffed === 'image/avif' ? 'avif' : image?.upload.sniffed === 'image/jpeg' ? 'jpeg' : 'png') : format

  const tooBig = target.w > MAX_SIDE || target.h > MAX_SIDE || target.w * target.h > 100_000_000
  const upscaling = image ? target.w > image.width || target.h > image.height : false

  // Resize automatically as settings change, so the preview and sizes are always real.
  useEffect(() => {
    if (!image || tooBig || target.w < 1 || target.h < 1) return
    const run = ++runRef.current
    const t = setTimeout(async () => {
      setBusy(true)
      setProcError(null)
      try {
        const needsFill = mode === 'pixels' && !lock && fit === 'fill'
        const crop = needsFill ? centerCropForRatio({ w: image.width, h: image.height }, target.w / target.h) : undefined
        const r = await processImage(image.displayBlob, {
          format: outFormat,
          quality,
          background: outFormat === 'jpeg' ? background : undefined,
          crop: crop ? { x: crop.x, y: crop.y, width: crop.w, height: crop.h } : undefined,
          resize: { width: target.w, height: target.h },
          optimizePng: false,
        })
        if (run === runRef.current) setResult({ ...r, name: `${baseName(image.upload.name)}-${r.width}x${r.height}.${FORMAT_EXT[outFormat]}` })
      } catch (e) {
        if (run === runRef.current) setProcError(e instanceof Error ? e.message : 'Resizing failed.')
      } finally {
        if (run === runRef.current) setBusy(false)
      }
    }, 300)
    return () => clearTimeout(t)
  }, [image, target.w, target.h, outFormat, quality, background, tooBig, mode, lock, fit])

  const setW = (v: number) => {
    setWidth(v)
    if (lock && v > 0) setHeight(Math.max(1, Math.round(v / ratio)))
  }
  const setH = (v: number) => {
    setHeight(v)
    if (lock && v > 0) setWidth(Math.max(1, Math.round(v * ratio)))
  }

  if (!image) {
    return (
      <div className="space-y-4">
        <FileDropzone accept={ACCEPT} rejected={rejected} loading={loading} onFiles={(f) => void load(f)} />
        {error && <Alert tone="danger" title="Could not open this image">{error}</Alert>}
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <Panel
        title={image.upload.name}
        actions={
          <Button size="sm" variant="ghost" onClick={() => { reset(); setResult(null) }}>
            <Trash2 className="size-4" aria-hidden /> Choose another
          </Button>
        }
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <Stat label="Original size" value={`${image.width} × ${image.height}`} sub="pixels" />
          <Stat label="File size" value={formatBytes(image.upload.size)} />
          <Stat label="New size" value={`${target.w} × ${target.h}`} sub={result ? formatBytes(result.blob.size) : busy ? 'Working…' : ''} />
        </div>
      </Panel>

      <Panel title="Resize">
        <div className="space-y-5">
          <Segmented
            label="Resize mode"
            value={mode}
            onChange={setMode}
            options={[
              { value: 'pixels', label: 'By pixels' },
              { value: 'percent', label: 'By percentage' },
            ]}
          />

          {mode === 'pixels' ? (
            <>
              <div className="flex flex-wrap items-end gap-3">
                <Field label="Width (px)" className="w-32">
                  {(id) => <Input id={id} type="number" inputMode="numeric" min={1} max={MAX_SIDE} value={width || ''} onChange={(e) => setW(Number(e.target.value))} />}
                </Field>
                <Button
                  variant={lock ? 'subtle' : 'secondary'}
                  size="icon"
                  aria-pressed={lock}
                  aria-label={lock ? 'Aspect ratio locked. Click to unlock.' : 'Aspect ratio unlocked. Click to lock.'}
                  onClick={() => {
                    setLock((l) => !l)
                    if (!lock) setH(Math.round(width / ratio))
                  }}
                >
                  {lock ? <Link2 className="size-4" aria-hidden /> : <Link2Off className="size-4" aria-hidden />}
                </Button>
                <Field label="Height (px)" className="w-32">
                  {(id) => <Input id={id} type="number" inputMode="numeric" min={1} max={MAX_SIDE} value={height || ''} onChange={(e) => setH(Number(e.target.value))} />}
                </Field>
                <Field label="Preset" className="min-w-56 flex-1">
                  {(id) => (
                    <Select
                      id={id}
                      value=""
                      onChange={(e) => {
                        const p = PRESETS.find((x) => x.id === e.target.value)
                        if (p) {
                          setLock(false)
                          setWidth(p.w)
                          setHeight(p.h)
                        }
                      }}
                    >
                      <option value="">Choose a preset…</option>
                      {PRESETS.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.label}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
              </div>
              {!lock && Math.abs(width / height - ratio) > 0.01 && (
                <Field label="When the shape differs from the original">
                  {() => (
                    <Segmented
                      label="Fit"
                      value={fit}
                      onChange={setFit}
                      options={[
                        { value: 'stretch', label: 'Stretch to fit', title: 'Distorts the image to match the new shape' },
                        { value: 'fill', label: 'Fill and crop', title: 'Keeps proportions and trims the edges' },
                      ]}
                    />
                  )}
                </Field>
              )}
            </>
          ) : (
            <QualitySlider label="Scale" value={percent} onChange={setPercent} min={1} max={400} hint="100% keeps the original size." />
          )}

          <OptionRow>
            <Field label="Output format">
              {(id) => (
                <Select id={id} value={format} onChange={(e) => setFormat(e.target.value as typeof format)}>
                  <option value="original">Same as original</option>
                  <option value="jpeg">JPG</option>
                  <option value="png">PNG</option>
                  <option value="webp">WebP</option>
                </Select>
              )}
            </Field>
            {outFormat !== 'png' && <QualitySlider value={quality} onChange={setQuality} />}
            {outFormat === 'jpeg' && (
              <Field label="Background for transparency">
                {(id) => <input id={id} type="color" value={background} onChange={(e) => setBackground(e.target.value)} className="h-10 w-14 cursor-pointer rounded-lg border border-line-strong bg-paper p-1" />}
              </Field>
            )}
          </OptionRow>

          {tooBig && <Alert tone="danger" title="Too large for the browser">Browsers cannot reliably create images beyond about {MAX_SIDE.toLocaleString()} pixels per side or 100 megapixels. Choose smaller dimensions.</Alert>}
          {upscaling && !tooBig && <Alert tone="warn">You are enlarging the image. This adds pixels but not detail, so it will look softer.</Alert>}
          {procError && <Alert tone="danger" title="Resizing failed">{procError}</Alert>}
        </div>
      </Panel>

      <Panel
        title="Result"
        actions={
          <DownloadButton disabled={!result || busy} onClick={() => { if (result) downloadBlob(result.blob, result.name) }}>
            Download {result ? `(${formatBytes(result.blob.size)})` : ''}
          </DownloadButton>
        }
      >
        {busy && <ProgressBar label="Resizing" />}
        {previewUrl && resultUrl && !busy && result ? (
          <BeforeAfter before={previewUrl} after={resultUrl} beforeLabel={`Original ${image.width}×${image.height}`} afterLabel={`Resized ${result.width}×${result.height}`} checker />
        ) : (
          !busy && <p className="text-sm text-muted">Adjust the size above to see the result.</p>
        )}
      </Panel>
    </div>
  )
}
