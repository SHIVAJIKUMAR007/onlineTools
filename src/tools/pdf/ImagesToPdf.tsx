import { useEffect, useState } from 'react'
import { ArrowDown, ArrowUp, Trash2, X } from 'lucide-react'
import { FileDropzone } from '@/components/tools/FileDropzone'
import { DownloadButton, OptionRow, Panel } from '@/components/tools/controls'
import { Alert, ProgressBar, Stat } from '@/components/ui/misc'
import { Button } from '@/components/ui/button'
import { Field, Select } from '@/components/ui/fields'
import { useFileUpload } from '@/hooks/useFileUpload'
import { useObjectUrl } from '@/hooks/useObjectUrl'
import { imagesToPdf, type ImagePage, type Orientation, type PageSizeKey } from '@/lib/pdf/edit'
import { processImage } from '@/lib/image/client'
import { downloadBlob } from '@/lib/utils/download'
import { formatBytes, pluralize } from '@/lib/utils/format'

const ACCEPT = ['image/jpeg', 'image/png', 'image/webp', '.jpg', '.jpeg', '.png', '.webp']
const MM = 72 / 25.4

function Thumb({ file }: { file: Blob }) {
  const url = useObjectUrl(file)
  return url ? <img src={url} alt="" className="size-12 rounded-md border border-line object-cover" /> : <div className="size-12 rounded-md bg-surface-2" />
}

/** Turn any accepted image into bytes pdf-lib can embed directly. */
async function toEmbeddable(file: File, sniffed: string): Promise<ImagePage> {
  if (sniffed === 'image/png') {
    return { bytes: new Uint8Array(await file.arrayBuffer()), kind: 'png', width: 0, height: 0 }
  }
  if (sniffed === 'image/jpeg') {
    // pdf-lib ignores EXIF orientation, so photos taken sideways would come out rotated.
    // Re-encoding through the canvas applies the orientation. Only do it when needed.
    let orientation = 1
    try {
      const exifr = await import('exifr')
      orientation = (await exifr.default.orientation(file)) ?? 1
    } catch {
      orientation = 1
    }
    if (orientation === 1) return { bytes: new Uint8Array(await file.arrayBuffer()), kind: 'jpeg', width: 0, height: 0 }
    const r = await processImage(file, { format: 'jpeg', quality: 92 })
    return { bytes: new Uint8Array(await r.blob.arrayBuffer()), kind: 'jpeg', width: 0, height: 0 }
  }
  const r = await processImage(file, { format: 'png' })
  return { bytes: new Uint8Array(await r.blob.arrayBuffer()), kind: 'png', width: 0, height: 0 }
}

export default function ImagesToPdf() {
  const { files, rejected, loading, addFiles, remove, clear, move } = useFileUpload({ accept: ACCEPT, multiple: true })
  const [pageSize, setPageSize] = useState<PageSizeKey>('a4')
  const [orientation, setOrientation] = useState<Orientation>('auto')
  const [marginMm, setMarginMm] = useState(10)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<Blob | null>(null)
  const [progress, setProgress] = useState(0)

  useEffect(() => setResult(null), [files, pageSize, orientation, marginMm])

  const create = async () => {
    setBusy(true)
    setError(null)
    setProgress(0)
    try {
      const pages: ImagePage[] = []
      for (let i = 0; i < files.length; i++) {
        pages.push(await toEmbeddable(files[i].file, files[i].sniffed))
        setProgress((i + 1) / files.length)
      }
      const bytes = await imagesToPdf(pages, { pageSize, orientation, margin: marginMm * MM })
      setResult(new Blob([bytes as BlobPart], { type: 'application/pdf' }))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create the PDF.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-5">
      <FileDropzone accept={ACCEPT} multiple rejected={rejected} loading={loading} compact={files.length > 0} onFiles={(f) => void addFiles(f)} title={files.length ? 'Add more images' : undefined} />

      {files.length > 0 && (
        <>
          <Panel
            title={`${pluralize(files.length, 'image')}, one per page`}
            actions={
              <Button size="sm" variant="ghost" onClick={clear}>
                <Trash2 className="size-4" aria-hidden /> Clear all
              </Button>
            }
          >
            <ol className="divide-y divide-line">
              {files.map((f, i) => (
                <li key={f.id} className="flex items-center gap-3 py-2.5">
                  <span className="tabular flex size-7 shrink-0 items-center justify-center rounded-full bg-surface-2 text-xs font-medium">{i + 1}</span>
                  <Thumb file={f.file} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium" title={f.name}>{f.name}</p>
                    <p className="tabular text-xs text-muted">{formatBytes(f.size)}</p>
                  </div>
                  <Button size="icon-sm" variant="ghost" aria-label={`Move ${f.name} up`} disabled={i === 0} onClick={() => move(i, i - 1)}><ArrowUp className="size-4" aria-hidden /></Button>
                  <Button size="icon-sm" variant="ghost" aria-label={`Move ${f.name} down`} disabled={i === files.length - 1} onClick={() => move(i, i + 1)}><ArrowDown className="size-4" aria-hidden /></Button>
                  <Button size="icon-sm" variant="ghost" aria-label={`Remove ${f.name}`} onClick={() => remove(f.id)}><X className="size-4" aria-hidden /></Button>
                </li>
              ))}
            </ol>
          </Panel>

          <Panel title="Page setup">
            <OptionRow>
              <Field label="Page size">
                {(id) => (
                  <Select id={id} value={pageSize} onChange={(e) => setPageSize(e.target.value as PageSizeKey)}>
                    <option value="a4">A4 (210 × 297 mm)</option>
                    <option value="letter">US Letter (8.5 × 11 in)</option>
                    <option value="legal">US Legal (8.5 × 14 in)</option>
                    <option value="a5">A5 (148 × 210 mm)</option>
                    <option value="fit">Fit to each image</option>
                  </Select>
                )}
              </Field>
              <Field label="Orientation" hint={pageSize === 'fit' ? 'Not used when the page fits the image.' : undefined}>
                {(id) => (
                  <Select id={id} value={orientation} disabled={pageSize === 'fit'} onChange={(e) => setOrientation(e.target.value as Orientation)}>
                    <option value="auto">Auto (match each image)</option>
                    <option value="portrait">Portrait</option>
                    <option value="landscape">Landscape</option>
                  </Select>
                )}
              </Field>
              <Field label="Margin">
                {(id) => (
                  <Select id={id} value={marginMm} onChange={(e) => setMarginMm(Number(e.target.value))}>
                    <option value={0}>None</option>
                    <option value={5}>Small (5 mm)</option>
                    <option value={10}>Medium (10 mm)</option>
                    <option value={20}>Large (20 mm)</option>
                  </Select>
                )}
              </Field>
            </OptionRow>
          </Panel>

          <Panel
            title="Create PDF"
            actions={result ? <DownloadButton onClick={() => downloadBlob(result, 'images.pdf')}>Download images.pdf</DownloadButton> : <Button variant="primary" disabled={busy} onClick={() => void create()}>{busy ? 'Creating…' : 'Create PDF'}</Button>}
          >
            {busy && <ProgressBar value={progress} label="Preparing images" />}
            {error && <Alert tone="danger" title="Could not create the PDF">{error}</Alert>}
            {result && (
              <div className="grid gap-3 sm:grid-cols-2">
                <Stat label="Pages" value={files.length} />
                <Stat label="PDF size" value={formatBytes(result.size)} />
              </div>
            )}
          </Panel>
        </>
      )}
    </div>
  )
}
