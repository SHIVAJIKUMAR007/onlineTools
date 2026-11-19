import { useEffect, useState, type ReactNode } from 'react'
import { Trash2 } from 'lucide-react'
import { FileDropzone } from '@/components/tools/FileDropzone'
import { DownloadButton, Panel } from '@/components/tools/controls'
import { Alert, Badge, ProgressBar } from '@/components/ui/misc'
import { Button } from '@/components/ui/button'
import { useFileUpload } from '@/hooks/useFileUpload'
import { useObjectUrl } from '@/hooks/useObjectUrl'
import { analyzePixels, aspectRatioLabel, type ColorAnalysis } from '@/lib/image/analyze'
import { prepareInput, processImage } from '@/lib/image/client'
import { FORMAT_EXT, type OutputFormat } from '@/lib/image/types'
import { baseName } from '@/lib/utils/filename'
import { downloadBlob } from '@/lib/utils/download'
import { formatBytes } from '@/lib/utils/format'

const ACCEPT = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif', 'image/bmp', 'image/svg+xml', 'image/heic', '.jpg', '.jpeg', '.png', '.webp', '.avif', '.gif', '.bmp', '.svg', '.heic', '.heif']

type Exif = Record<string, unknown>

const EXIF_FIELDS: [string, string][] = [
  ['Make', 'Camera make'],
  ['Model', 'Camera model'],
  ['LensModel', 'Lens'],
  ['Software', 'Software'],
  ['DateTimeOriginal', 'Taken'],
  ['CreateDate', 'Created'],
  ['ModifyDate', 'Modified'],
  ['ExposureTime', 'Exposure time'],
  ['FNumber', 'Aperture (f/)'],
  ['ISO', 'ISO'],
  ['FocalLength', 'Focal length (mm)'],
  ['FocalLengthIn35mmFormat', 'Focal length, 35mm equiv.'],
  ['Flash', 'Flash'],
  ['WhiteBalance', 'White balance'],
  ['Orientation', 'Orientation'],
  ['XResolution', 'X resolution'],
  ['YResolution', 'Y resolution'],
  ['ColorSpace', 'Color space'],
  ['Artist', 'Artist'],
  ['Copyright', 'Copyright'],
]

function fmt(v: unknown): string {
  if (v instanceof Date) return v.toLocaleString()
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : String(Math.round(v * 1000) / 1000)
  if (Array.isArray(v)) return v.join(', ')
  if (v && typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

function Table({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="divide-y divide-line text-sm">
      {rows.map(([k, v]) => (
        <div key={k} className="grid grid-cols-[minmax(7rem,1fr)_2fr] gap-3 py-2">
          <dt className="text-muted">{k}</dt>
          <dd className="tabular break-words font-medium">{v}</dd>
        </div>
      ))}
    </dl>
  )
}

export default function ImageMetadataViewer() {
  const { files, rejected, loading, addFiles, clear } = useFileUpload({ accept: ACCEPT, multiple: false })
  const upload = files[0]
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null)
  const [exif, setExif] = useState<Exif | null>(null)
  const [colors, setColors] = useState<ColorAnalysis | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [display, setDisplay] = useState<Blob | null>(null)
  const url = useObjectUrl(display)
  const [stripping, setStripping] = useState(false)

  useEffect(() => {
    setDims(null)
    setExif(null)
    setColors(null)
    setError(null)
    setDisplay(null)
    if (!upload) return
    let cancelled = false
    setBusy(true)
    ;(async () => {
      try {
        const [exifr, displayBlob] = await Promise.all([import('exifr'), prepareInput(upload.file)])
        if (cancelled) return
        setDisplay(displayBlob)
        const bmp = await createImageBitmap(displayBlob)
        setDims({ w: bmp.width, h: bmp.height })
        // Sample at most ~256px on the long side. Enough for colors, cheap for any image size.
        const s = Math.min(1, 256 / Math.max(bmp.width, bmp.height))
        const c = document.createElement('canvas')
        c.width = Math.max(1, Math.round(bmp.width * s))
        c.height = Math.max(1, Math.round(bmp.height * s))
        const ctx = c.getContext('2d', { willReadFrequently: true })!
        ctx.drawImage(bmp, 0, 0, c.width, c.height)
        bmp.close()
        if (!cancelled) setColors(analyzePixels(ctx.getImageData(0, 0, c.width, c.height).data))
        try {
          const data = (await exifr.default.parse(upload.file, { tiff: true, exif: true, gps: true, xmp: false, icc: false, mergeOutput: true })) as Exif | undefined
          if (!cancelled) setExif(data ?? {})
        } catch {
          if (!cancelled) setExif({})
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error && e.message ? e.message : 'This image could not be read.')
      } finally {
        if (!cancelled) setBusy(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [upload])

  const strip = async () => {
    if (!upload || !display) return
    setStripping(true)
    try {
      const f: OutputFormat = upload.sniffed === 'image/png' ? 'png' : upload.sniffed === 'image/webp' ? 'webp' : upload.sniffed === 'image/avif' ? 'avif' : upload.sniffed === 'image/jpeg' ? 'jpeg' : 'png'
      const r = await processImage(display, { format: f, quality: 95, background: f === 'jpeg' ? '#ffffff' : undefined })
      downloadBlob(r.blob, `${baseName(upload.name)}-clean.${FORMAT_EXT[f]}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create a clean copy.')
    } finally {
      setStripping(false)
    }
  }

  if (!upload) return <FileDropzone accept={ACCEPT} rejected={rejected} loading={loading} onFiles={(f) => void addFiles(f)} />

  const gps = exif && typeof exif.latitude === 'number' && typeof exif.longitude === 'number' ? { lat: exif.latitude as number, lon: exif.longitude as number } : null
  const exifRows = exif ? EXIF_FIELDS.filter(([k]) => exif[k] !== undefined && exif[k] !== null && exif[k] !== '').map(([k, label]) => [label, fmt(exif[k])] as [string, ReactNode]) : []
  const declared = upload.file.type || 'not reported'
  const mismatch = upload.sniffed !== 'unknown' && upload.file.type && upload.file.type !== upload.sniffed && !(upload.sniffed === 'image/heic' && upload.file.type.includes('hei'))

  return (
    <div className="space-y-5">
      <Panel
        title={upload.name}
        actions={
          <div className="flex gap-2">
            <DownloadButton size="sm" variant="secondary" disabled={!display || stripping} onClick={strip}>
              {stripping ? 'Working…' : 'Download without metadata'}
            </DownloadButton>
            <Button size="sm" variant="ghost" onClick={clear}>
              <Trash2 className="size-4" aria-hidden /> Choose another
            </Button>
          </div>
        }
      >
        {busy && <ProgressBar label="Reading image" />}
        {error && <Alert tone="danger" title="Could not read this image">{error}</Alert>}
        <div className="grid gap-5 md:grid-cols-[240px_1fr]">
          <div className="checker flex h-60 items-center justify-center overflow-hidden rounded-xl border border-line">
            {url && <img src={url} alt="Preview" className="max-h-full max-w-full object-contain" />}
          </div>
          <Table
            rows={[
              ['Dimensions', dims ? `${dims.w} × ${dims.h} px` : '…'],
              ['Aspect ratio', dims ? aspectRatioLabel(dims.w, dims.h) : '…'],
              ['Megapixels', dims ? `${((dims.w * dims.h) / 1e6).toFixed(2)} MP` : '…'],
              ['File size', `${formatBytes(upload.size)} (${upload.size.toLocaleString()} bytes)`],
              ['Detected type', upload.sniffed === 'unknown' ? 'Could not detect' : upload.sniffed],
              ['Type reported by browser', declared],
              ['Last modified', new Date(upload.file.lastModified).toLocaleString()],
            ]}
          />
        </div>
        {mismatch && <Alert tone="warn" className="mt-4" title="File type and contents differ">The browser reports {declared}, but the file contents look like {upload.sniffed}. The extension may be wrong.</Alert>}
      </Panel>

      {colors && (
        <Panel title="Color information">
          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-3">
              <Table
                rows={[
                  [
                    'Average color',
                    <span key="a" className="inline-flex items-center gap-2">
                      <span className="inline-block size-4 rounded border border-line-strong" style={{ background: colors.average }} /> {colors.average.toUpperCase()}
                    </span>,
                  ],
                  ['Transparency', colors.hasTransparency ? `Yes, ${(colors.transparentShare * 100).toFixed(1)}% of pixels are not fully opaque` : 'None. All pixels are opaque'],
                  ['Sampled pixels', colors.sampled.toLocaleString()],
                ]}
              />
              <p className="text-xs text-muted">Bit depth and embedded color profiles are not exposed by browsers for most formats, so they are not shown.</p>
            </div>
            <div>
              <p className="mb-2 text-sm font-medium text-ink-2">Dominant colors</p>
              <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {colors.palette.map((c) => (
                  <li key={c.hex} className="rounded-lg border border-line p-2">
                    <div className="h-9 rounded" style={{ background: c.hex }} />
                    <p className="tabular mt-1 text-xs font-medium">{c.hex.toUpperCase()}</p>
                    <p className="tabular text-xs text-muted">{(c.share * 100).toFixed(1)}%</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Panel>
      )}

      {exif && (
        <Panel title="EXIF and camera data" actions={gps ? <Badge tone="warn">Contains location</Badge> : undefined}>
          {exifRows.length === 0 && !gps ? (
            <p className="text-sm text-muted">No EXIF metadata found. Screenshots, PNG files and images processed by many websites have none.</p>
          ) : (
            <>
              <Table rows={[...exifRows, ...(gps ? ([['GPS coordinates', `${gps.lat.toFixed(6)}, ${gps.lon.toFixed(6)}`]] as [string, ReactNode][]) : [])]} />
              {gps && <Alert tone="warn" className="mt-4" title="This photo includes where it was taken">Anyone you send the original file to can read these coordinates. Use “Download without metadata” before sharing.</Alert>}
            </>
          )}
        </Panel>
      )}
    </div>
  )
}
