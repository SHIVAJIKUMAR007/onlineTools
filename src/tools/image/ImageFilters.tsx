import { useEffect, useRef, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { FileDropzone } from '@/components/tools/FileDropzone'
import { DownloadButton, Panel, QualitySlider } from '@/components/tools/controls'
import { Alert } from '@/components/ui/misc'
import { Button } from '@/components/ui/button'
import { Field, Select, Switch } from '@/components/ui/fields'
import { useSingleImage } from '@/hooks/useSingleImage'
import { FILTERS, applyFilters, type FilterId, type FilterSettings } from '@/lib/image/filters'
import { baseName } from '@/lib/utils/filename'
import { downloadBlob } from '@/lib/utils/download'

const ACCEPT = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif', 'image/bmp', '.jpg', '.jpeg', '.png', '.webp', '.avif', '.gif', '.bmp']
const PREVIEW_SIDE = 900

export default function ImageFilters() {
  const { image, error, rejected, loading, load, reset } = useSingleImage(ACCEPT)
  const [on, setOn] = useState<Partial<Record<FilterId, boolean>>>({ grayscale: true })
  const [amounts, setAmounts] = useState<Record<FilterId, number>>(() => Object.fromEntries(FILTERS.map((f) => [f.id, f.def])) as Record<FilterId, number>)
  const [format, setFormat] = useState<'png' | 'jpeg'>('png')
  const [quality, setQuality] = useState(92)
  const [exportError, setExportError] = useState<string | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const baseRef = useRef<ImageData | null>(null)

  const settings: FilterSettings = {}
  for (const f of FILTERS) if (on[f.id]) settings[f.id] = amounts[f.id]
  const settingsKey = JSON.stringify(settings)

  // Draw a downscaled copy once per image and keep its original pixels.
  useEffect(() => {
    baseRef.current = null
    if (!image) return
    let cancelled = false
    ;(async () => {
      const bmp = await createImageBitmap(image.displayBlob)
      const s = Math.min(1, PREVIEW_SIDE / Math.max(bmp.width, bmp.height))
      const w = Math.max(1, Math.round(bmp.width * s))
      const h = Math.max(1, Math.round(bmp.height * s))
      const c = document.createElement('canvas')
      c.width = w
      c.height = h
      const ctx = c.getContext('2d', { willReadFrequently: true })!
      ctx.drawImage(bmp, 0, 0, w, h)
      bmp.close()
      if (cancelled) return
      baseRef.current = ctx.getImageData(0, 0, w, h)
      draw()
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [image])

  function draw() {
    const base = baseRef.current
    const target = canvasRef.current
    if (!base || !target) return
    const copy = new ImageData(new Uint8ClampedArray(base.data), base.width, base.height)
    applyFilters(copy.data, JSON.parse(settingsKey) as FilterSettings)
    target.width = copy.width
    target.height = copy.height
    target.getContext('2d')!.putImageData(copy, 0, 0)
  }
  useEffect(draw, [settingsKey])

  const exportImage = async () => {
    if (!image) return
    setExportError(null)
    try {
      const bmp = await createImageBitmap(image.displayBlob)
      const c = document.createElement('canvas')
      c.width = bmp.width
      c.height = bmp.height
      const ctx = c.getContext('2d', { willReadFrequently: true })!
      if (format === 'jpeg') {
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, c.width, c.height)
      }
      ctx.drawImage(bmp, 0, 0)
      bmp.close()
      const data = ctx.getImageData(0, 0, c.width, c.height)
      applyFilters(data.data, settings)
      ctx.putImageData(data, 0, 0)
      const blob = await new Promise<Blob | null>((res) => c.toBlob(res, format === 'jpeg' ? 'image/jpeg' : 'image/png', quality / 100))
      if (!blob) throw new Error('The browser could not encode the image. It may be too large.')
      downloadBlob(blob, `${baseName(image.upload.name)}-filtered.${format === 'jpeg' ? 'jpg' : 'png'}`)
    } catch (e) {
      setExportError(e instanceof Error ? e.message : 'Export failed.')
    }
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
          <Button size="sm" variant="ghost" onClick={reset}>
            <Trash2 className="size-4" aria-hidden /> Choose another
          </Button>
        }
      >
        <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
          <div className="checker flex min-h-64 items-center justify-center overflow-hidden rounded-xl border border-line p-2">
            <canvas ref={canvasRef} className="max-h-[60vh] max-w-full object-contain" role="img" aria-label="Preview of the filtered image" />
          </div>
          <div className="space-y-4">
            {FILTERS.map((f) => {
              const id = `flt-${f.id}`
              return (
                <div key={f.id} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <Switch checked={!!on[f.id]} onChange={(v) => setOn((p) => ({ ...p, [f.id]: v }))} label={f.label} />
                    <output htmlFor={id} className="tabular text-sm text-muted">{amounts[f.id]}</output>
                  </div>
                  <input
                    id={id}
                    type="range"
                    min={f.min}
                    max={f.max}
                    value={amounts[f.id]}
                    disabled={!on[f.id]}
                    aria-label={`${f.label} strength`}
                    onChange={(e) => setAmounts((p) => ({ ...p, [f.id]: Number(e.target.value) }))}
                    className="h-2 w-full cursor-pointer disabled:opacity-40"
                  />
                </div>
              )
            })}
          </div>
        </div>
      </Panel>
      <Panel title="Download">
        <div className="flex flex-wrap items-end gap-4">
          <Field label="Format" className="w-40">
            {(id) => (
              <Select id={id} value={format} onChange={(e) => setFormat(e.target.value as 'png' | 'jpeg')}>
                <option value="png">PNG</option>
                <option value="jpeg">JPG</option>
              </Select>
            )}
          </Field>
          {format === 'jpeg' && <div className="w-56"><QualitySlider value={quality} onChange={setQuality} /></div>}
          <DownloadButton onClick={exportImage}>Download image</DownloadButton>
        </div>
        {exportError && <Alert tone="danger" className="mt-3" title="Export failed">{exportError}</Alert>}
        <p className="mt-3 text-xs text-muted">The download is the full-size image. Transparent areas become white in JPG.</p>
      </Panel>
    </div>
  )
}
