import { useEffect, useRef, useState } from 'react'
import { FlipHorizontal2, FlipVertical2, RotateCcw, RotateCw, Trash2 } from 'lucide-react'
import { FileDropzone } from '@/components/tools/FileDropzone'
import { DownloadButton, Panel, QualitySlider } from '@/components/tools/controls'
import { Alert, Stat } from '@/components/ui/misc'
import { Button } from '@/components/ui/button'
import { Field, Select } from '@/components/ui/fields'
import { useSingleImage } from '@/hooks/useSingleImage'
import { processImage } from '@/lib/image/client'
import { transformCanvas } from '@/lib/image/core'
import { FORMAT_EXT, type OutputFormat, type Rotation } from '@/lib/image/types'
import { baseName } from '@/lib/utils/filename'
import { downloadBlob } from '@/lib/utils/download'
import { formatBytes } from '@/lib/utils/format'

const ACCEPT = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif', 'image/bmp', '.jpg', '.jpeg', '.png', '.webp', '.avif', '.gif', '.bmp']

export default function ImageRotator() {
  const { image, error, rejected, loading, load, reset } = useSingleImage(ACCEPT)
  const [rotate, setRotate] = useState<Rotation>(0)
  const [flipH, setFlipH] = useState(false)
  const [flipV, setFlipV] = useState(false)
  const [format, setFormat] = useState<'original' | OutputFormat>('original')
  const [quality, setQuality] = useState(92)
  const [busy, setBusy] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    setRotate(0)
    setFlipH(false)
    setFlipV(false)
  }, [image])

  // Live preview: draw a downscaled copy with the same transform the export uses.
  useEffect(() => {
    if (!image || !canvasRef.current) return
    let cancelled = false
    ;(async () => {
      const bmp = await createImageBitmap(image.displayBlob)
      if (cancelled) return bmp.close()
      const maxSide = 900
      const s = Math.min(1, maxSide / Math.max(bmp.width, bmp.height))
      const small = document.createElement('canvas')
      small.width = Math.max(1, Math.round(bmp.width * s))
      small.height = Math.max(1, Math.round(bmp.height * s))
      small.getContext('2d')!.drawImage(bmp, 0, 0, small.width, small.height)
      bmp.close()
      const out = transformCanvas(small, small.width, small.height, rotate, flipH, flipV) as HTMLCanvasElement
      const target = canvasRef.current
      if (!target || cancelled) return
      target.width = out.width
      target.height = out.height
      target.getContext('2d')!.drawImage(out, 0, 0)
    })()
    return () => {
      cancelled = true
    }
  }, [image, rotate, flipH, flipV])

  // Rotating after a quarter-turn swaps what "horizontal" means in image space.
  const sideways = rotate === 90 || rotate === 270
  const turn = (delta: number) => setRotate((r) => ((((r + delta) % 360) + 360) % 360) as Rotation)

  const native: OutputFormat = image?.upload.sniffed === 'image/jpeg' ? 'jpeg' : image?.upload.sniffed === 'image/webp' ? 'webp' : image?.upload.sniffed === 'image/avif' ? 'avif' : 'png'
  const outFormat = format === 'original' ? native : format

  const exportImage = async () => {
    if (!image) return
    setBusy(true)
    setExportError(null)
    try {
      const r = await processImage(image.displayBlob, { format: outFormat, quality, rotate, flipH, flipV, background: outFormat === 'jpeg' ? '#ffffff' : undefined })
      downloadBlob(r.blob, `${baseName(image.upload.name)}-edited.${FORMAT_EXT[outFormat]}`)
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

  const changed = rotate !== 0 || flipH || flipV

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
        <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
          <div className="checker flex min-h-64 items-center justify-center overflow-hidden rounded-xl border border-line p-2">
            <canvas ref={canvasRef} className="max-h-[60vh] max-w-full object-contain" aria-label="Preview of the rotated image" role="img" />
          </div>
          <div className="space-y-5">
            <div>
              <p className="mb-2 text-sm font-medium text-ink-2">Rotate</p>
              <div className="grid grid-cols-3 gap-2">
                <Button onClick={() => turn(-90)} aria-label="Rotate 90 degrees counter-clockwise">
                  <RotateCcw className="size-4" aria-hidden /> 90°
                </Button>
                <Button onClick={() => turn(180)} aria-label="Rotate 180 degrees">
                  180°
                </Button>
                <Button onClick={() => turn(90)} aria-label="Rotate 90 degrees clockwise">
                  <RotateCw className="size-4" aria-hidden /> 90°
                </Button>
              </div>
            </div>
            <div>
              <p className="mb-2 text-sm font-medium text-ink-2">Flip</p>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant={(sideways ? flipV : flipH) ? 'subtle' : 'secondary'}
                  aria-pressed={sideways ? flipV : flipH}
                  onClick={() => (sideways ? setFlipV((v) => !v) : setFlipH((v) => !v))}
                >
                  <FlipHorizontal2 className="size-4" aria-hidden /> Horizontal
                </Button>
                <Button
                  variant={(sideways ? flipH : flipV) ? 'subtle' : 'secondary'}
                  aria-pressed={sideways ? flipH : flipV}
                  onClick={() => (sideways ? setFlipH((v) => !v) : setFlipV((v) => !v))}
                >
                  <FlipVertical2 className="size-4" aria-hidden /> Vertical
                </Button>
              </div>
            </div>
            <Button variant="ghost" size="sm" disabled={!changed} onClick={() => { setRotate(0); setFlipH(false); setFlipV(false) }}>
              Reset changes
            </Button>
            <div className="grid grid-cols-2 gap-3">
              <Stat label="Size" value={`${sideways ? image.height : image.width} × ${sideways ? image.width : image.height}`} />
              <Stat label="Original file" value={formatBytes(image.upload.size)} />
            </div>
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
          <DownloadButton onClick={exportImage} disabled={busy}>
            {busy ? 'Preparing…' : 'Download image'}
          </DownloadButton>
        </div>
        {exportError && <Alert tone="danger" className="mt-3" title="Export failed">{exportError}</Alert>}
        {!changed && <p className="mt-3 text-xs text-muted">No changes yet. The download will be an unmodified copy re-encoded as {outFormat.toUpperCase()}.</p>}
      </Panel>
    </div>
  )
}
