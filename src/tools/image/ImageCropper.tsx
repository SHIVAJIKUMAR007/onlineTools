import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from 'react'
import { RotateCcw, RotateCw, Trash2 } from 'lucide-react'
import { FileDropzone } from '@/components/tools/FileDropzone'
import { DownloadButton, Panel, QualitySlider } from '@/components/tools/controls'
import { Alert } from '@/components/ui/misc'
import { Button } from '@/components/ui/button'
import { Field, Input, Segmented, Select } from '@/components/ui/fields'
import { useSingleImage } from '@/hooks/useSingleImage'
import { processImage } from '@/lib/image/client'
import { applyDrag, clampRect, fitRatio, RATIO_PRESETS, type Handle, type Rect } from '@/lib/image/crop'
import { FORMAT_EXT, type OutputFormat, type Rotation } from '@/lib/image/types'
import { baseName } from '@/lib/utils/filename'
import { downloadBlob } from '@/lib/utils/download'
import { formatBytes } from '@/lib/utils/format'
import { cn } from '@/lib/utils/cn'
import { transformCanvas } from '@/lib/image/core'
import { useObjectUrl } from '@/hooks/useObjectUrl'

const ACCEPT = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif', 'image/bmp', '.jpg', '.jpeg', '.png', '.webp', '.avif', '.gif', '.bmp']

const HANDLES: { h: Handle; cls: string; cursor: string }[] = [
  { h: 'nw', cls: 'left-0 top-0 -translate-x-1/2 -translate-y-1/2', cursor: 'nwse-resize' },
  { h: 'n', cls: 'left-1/2 top-0 -translate-x-1/2 -translate-y-1/2', cursor: 'ns-resize' },
  { h: 'ne', cls: 'right-0 top-0 translate-x-1/2 -translate-y-1/2', cursor: 'nesw-resize' },
  { h: 'e', cls: 'right-0 top-1/2 translate-x-1/2 -translate-y-1/2', cursor: 'ew-resize' },
  { h: 'se', cls: 'right-0 bottom-0 translate-x-1/2 translate-y-1/2', cursor: 'nwse-resize' },
  { h: 's', cls: 'left-1/2 bottom-0 -translate-x-1/2 translate-y-1/2', cursor: 'ns-resize' },
  { h: 'sw', cls: 'left-0 bottom-0 -translate-x-1/2 translate-y-1/2', cursor: 'nesw-resize' },
  { h: 'w', cls: 'left-0 top-1/2 -translate-x-1/2 -translate-y-1/2', cursor: 'ew-resize' },
]

export default function ImageCropper() {
  const { image, error, rejected, loading, load, reset } = useSingleImage(ACCEPT)
  const [rotate, setRotate] = useState<Rotation>(0)
  const [rotatedBlob, setRotatedBlob] = useState<Blob | null>(null)
  const rotatedUrl = useObjectUrl(rotatedBlob)
  const [ratioId, setRatioId] = useState<string>('free')
  const [rect, setRect] = useState<Rect>({ x: 0, y: 0, w: 1, h: 1 })
  const [format, setFormat] = useState<'original' | OutputFormat>('original')
  const [quality, setQuality] = useState(92)
  const [busy, setBusy] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ handle: Handle; startX: number; startY: number; rect: Rect } | null>(null)

  const swap = rotate === 90 || rotate === 270
  const W = image ? (swap ? image.height : image.width) : 1
  const H = image ? (swap ? image.width : image.height) : 1
  const bounds = useMemo(() => ({ w: W, h: H }), [W, H])

  const ratioValue = useMemo<number | null>(() => {
    const p = RATIO_PRESETS.find((r) => r.id === ratioId)
    if (!p || p.ratio === null) return null
    return p.ratio === 'original' ? W / H : p.ratio
  }, [ratioId, W, H])

  // Build the rotated source the crop frame works on.
  useEffect(() => {
    if (!image) return
    setRatioId('free')
    setRotate(0)
  }, [image])

  useEffect(() => {
    if (!image) return
    let cancelled = false
    if (rotate === 0) {
      setRotatedBlob(image.displayBlob)
      return
    }
    ;(async () => {
      const bmp = await createImageBitmap(image.displayBlob)
      const c = transformCanvas(bmp, bmp.width, bmp.height, rotate, false, false) as HTMLCanvasElement
      bmp.close()
      const blob = await new Promise<Blob | null>((res) => c.toBlob(res, 'image/png'))
      if (!cancelled && blob) setRotatedBlob(blob)
    })()
    return () => {
      cancelled = true
    }
  }, [image, rotate])

  // Reset the frame whenever the source dimensions or ratio change.
  useEffect(() => {
    if (!image) return
    if (ratioValue) setRect(fitRatio(bounds, ratioValue))
    else setRect({ x: 0, y: 0, w: bounds.w, h: bounds.h })
  }, [image, bounds, ratioValue])

  const toImageDelta = useCallback(
    (clientX: number, clientY: number, startX: number, startY: number) => {
      const el = boxRef.current
      if (!el) return { dx: 0, dy: 0 }
      const scale = bounds.w / el.clientWidth
      return { dx: (clientX - startX) * scale, dy: (clientY - startY) * scale }
    },
    [bounds.w],
  )

  const onPointerDown = (handle: Handle) => (e: RPointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    drag.current = { handle, startX: e.clientX, startY: e.clientY, rect }
  }
  const onPointerMove = (e: RPointerEvent) => {
    const d = drag.current
    if (!d) return
    const { dx, dy } = toImageDelta(e.clientX, e.clientY, d.startX, d.startY)
    setRect(applyDrag(d.rect, d.handle, dx, dy, bounds, ratioValue))
  }
  const onPointerUp = () => {
    drag.current = null
  }
  const onKeyDown = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 10 : 1
    const map: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }
    const m = map[e.key]
    if (!m) return
    e.preventDefault()
    setRect((r) => applyDrag(r, 'move', m[0], m[1], bounds, null))
  }

  const setField = (key: keyof Rect, value: number) => {
    if (!Number.isFinite(value)) return
    setRect((r) => {
      const next = { ...r, [key]: value }
      if (ratioValue && key === 'w') next.h = value / ratioValue
      if (ratioValue && key === 'h') next.w = value * ratioValue
      return clampRect(next, bounds, 1)
    })
  }

  const native: OutputFormat = image?.upload.sniffed === 'image/jpeg' ? 'jpeg' : image?.upload.sniffed === 'image/webp' ? 'webp' : image?.upload.sniffed === 'image/avif' ? 'avif' : 'png'
  const outFormat = format === 'original' ? native : format

  const exportCrop = async () => {
    if (!image) return
    setBusy(true)
    setExportError(null)
    try {
      const r = await processImage(image.displayBlob, {
        format: outFormat,
        quality,
        rotate,
        crop: { x: rect.x, y: rect.y, width: rect.w, height: rect.h },
        background: outFormat === 'jpeg' ? '#ffffff' : undefined,
      })
      downloadBlob(r.blob, `${baseName(image.upload.name)}-cropped.${FORMAT_EXT[outFormat]}`)
    } catch (e) {
      setExportError(e instanceof Error ? e.message : 'Export failed.')
    } finally {
      setBusy(false)
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

  const pct = (v: number, total: number) => `${(v / total) * 100}%`

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
        <div className="grid gap-5 lg:grid-cols-[1fr_280px]">
          <div className="checker flex items-center justify-center overflow-hidden rounded-xl border border-line p-4">
            <div
              ref={boxRef}
              className="relative max-w-full touch-none select-none"
              style={{ aspectRatio: `${W} / ${H}`, width: `min(100%, calc(60vh * ${W} / ${H}))` }}
            >
              {rotatedUrl && <img src={rotatedUrl} alt="Image being cropped" className="absolute inset-0 h-full w-full" draggable={false} />}
              {/* Dim everything outside the frame with a big box-shadow. */}
              <div
                role="group"
                tabIndex={0}
                aria-label="Crop frame. Use arrow keys to move it."
                onKeyDown={onKeyDown}
                onPointerDown={onPointerDown('move')}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                className="absolute cursor-move border border-white shadow-[0_0_0_9999px_rgb(0_0_0/0.5)] outline-1 outline-dashed outline-black/30"
                style={{ left: pct(rect.x, W), top: pct(rect.y, H), width: pct(rect.w, W), height: pct(rect.h, H) }}
              >
                <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3">
                  {Array.from({ length: 9 }).map((_, i) => (
                    <div key={i} className="border border-white/25" />
                  ))}
                </div>
                {HANDLES.map(({ h, cls, cursor }) => (
                  <span
                    key={h}
                    onPointerDown={onPointerDown(h)}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerUp}
                    onPointerCancel={onPointerUp}
                    className={cn('absolute size-4 rounded-sm border border-ink/40 bg-white shadow sm:size-3.5', cls)}
                    style={{ cursor, touchAction: 'none' }}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-5">
            <div>
              <p className="mb-2 text-sm font-medium text-ink-2">Aspect ratio</p>
              <Segmented label="Aspect ratio" value={ratioId} onChange={setRatioId} options={RATIO_PRESETS.map((r) => ({ value: r.id, label: r.label }))} />
            </div>
            <div>
              <p className="mb-2 text-sm font-medium text-ink-2">Rotate image</p>
              <div className="grid grid-cols-2 gap-2">
                <Button onClick={() => setRotate((r) => ((r + 270) % 360) as Rotation)} aria-label="Rotate 90 degrees counter-clockwise">
                  <RotateCcw className="size-4" aria-hidden /> Left
                </Button>
                <Button onClick={() => setRotate((r) => ((r + 90) % 360) as Rotation)} aria-label="Rotate 90 degrees clockwise">
                  <RotateCw className="size-4" aria-hidden /> Right
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {(['x', 'y', 'w', 'h'] as const).map((k) => (
                <Field key={k} label={{ x: 'Left (px)', y: 'Top (px)', w: 'Width (px)', h: 'Height (px)' }[k]}>
                  {(id) => <Input id={id} type="number" inputMode="numeric" value={Math.round(rect[k])} onChange={(e) => setField(k, Number(e.target.value))} />}
                </Field>
              ))}
            </div>
            <p className="tabular text-xs text-muted">
              Source {W} × {H}px. Output {Math.round(rect.w)} × {Math.round(rect.h)}px.
            </p>
          </div>
        </div>
      </Panel>

      <Panel title="Download">
        <div className="flex flex-wrap items-end gap-4">
          <Field label="Format" className="w-44">
            {(id) => (
              <Select id={id} value={format} onChange={(e) => setFormat(e.target.value as typeof format)}>
                <option value="original">Same as original</option>
                <option value="png">PNG</option>
                <option value="jpeg">JPG</option>
                <option value="webp">WebP</option>
              </Select>
            )}
          </Field>
          {outFormat !== 'png' && <div className="w-56"><QualitySlider value={quality} onChange={setQuality} /></div>}
          <DownloadButton onClick={exportCrop} disabled={busy}>
            {busy ? 'Cropping…' : 'Crop and download'}
          </DownloadButton>
        </div>
        {exportError && <Alert tone="danger" className="mt-3" title="Export failed">{exportError}</Alert>}
        <p className="mt-3 text-xs text-muted">Original file: {formatBytes(image.upload.size)}</p>
      </Panel>
    </div>
  )
}
