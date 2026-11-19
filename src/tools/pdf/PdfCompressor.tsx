import { useEffect, useRef, useState } from 'react'
import { Trash2, X } from 'lucide-react'
import { FileDropzone } from '@/components/tools/FileDropzone'
import { DownloadButton, OptionRow, Panel, QualitySlider } from '@/components/tools/controls'
import { Alert, ProgressBar, Stat } from '@/components/ui/misc'
import { Button } from '@/components/ui/button'
import { Field, Segmented } from '@/components/ui/fields'
import { PDF_ACCEPT, usePdf } from '@/hooks/usePdf'
import { losslessOptimize } from '@/lib/pdf/edit'
import { baseName } from '@/lib/utils/filename'
import { downloadBlob } from '@/lib/utils/download'
import { formatBytes, formatSaving, savedPercent } from '@/lib/utils/format'

type Mode = 'lossless' | 'rasterize'

interface Result {
  blob: Blob
  mode: Mode
}

async function rasterizeCompress(
  bytes: Uint8Array,
  doc: import('pdfjs-dist').PDFDocumentProxy,
  dpi: number,
  quality: number,
  onProgress: (done: number, total: number) => void,
  cancelled: () => boolean,
): Promise<Uint8Array | null> {
  const [{ PDFDocument }, { renderPageToCanvas, canvasToBlobAsync, checkRenderSize }] = await Promise.all([import('pdf-lib'), import('@/lib/pdf/render')])
  void bytes
  const out = await PDFDocument.create()
  for (let p = 1; p <= doc.numPages; p++) {
    if (cancelled()) return null
    const page = await doc.getPage(p)
    const vp = page.getViewport({ scale: 1 })
    const problem = checkRenderSize(vp.width, vp.height, dpi)
    if (problem) throw new Error(`Page ${p}: ${problem}`)
    const r = await renderPageToCanvas(doc, p, dpi / 72)
    const blob = await canvasToBlobAsync(r.canvas, 'image/jpeg', quality / 100)
    r.canvas.width = 0
    r.canvas.height = 0
    const img = await out.embedJpg(new Uint8Array(await blob.arrayBuffer()))
    const pdfPage = out.addPage([vp.width, vp.height])
    pdfPage.drawImage(img, { x: 0, y: 0, width: vp.width, height: vp.height })
    onProgress(p, doc.numPages)
  }
  return out.save({ useObjectStreams: true })
}

export default function PdfCompressor() {
  const { pdf, error, rejected, loading, load, reset } = usePdf()
  const [mode, setMode] = useState<Mode>('lossless')
  const [dpi, setDpi] = useState(150)
  const [quality, setQuality] = useState(70)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<number | undefined>(undefined)
  const [result, setResult] = useState<Result | null>(null)
  const [procError, setProcError] = useState<string | null>(null)
  const cancelRef = useRef(false)

  useEffect(() => {
    setResult(null)
    setProcError(null)
  }, [pdf, mode, dpi, quality])

  const run = async () => {
    if (!pdf) return
    cancelRef.current = false
    setBusy(true)
    setProcError(null)
    setResult(null)
    setProgress(mode === 'rasterize' ? 0 : undefined)
    try {
      let out: Uint8Array | null
      if (mode === 'lossless') out = await losslessOptimize(pdf.bytes)
      else out = await rasterizeCompress(pdf.bytes, pdf.doc, dpi, quality, (d, t) => setProgress(d / t), () => cancelRef.current)
      if (out) setResult({ blob: new Blob([out as BlobPart], { type: 'application/pdf' }), mode })
    } catch (e) {
      setProcError(e instanceof Error ? e.message : 'Compression failed.')
    } finally {
      setBusy(false)
    }
  }

  if (!pdf) {
    return (
      <div className="space-y-4">
        <FileDropzone accept={PDF_ACCEPT} rejected={rejected} loading={loading} onFiles={(f) => void load(f)} />
        {error && <Alert tone="danger" title="Could not open this PDF">{error}</Alert>}
      </div>
    )
  }

  const smaller = result ? result.blob.size < pdf.upload.size : false

  return (
    <div className="space-y-5">
      <Panel
        title={pdf.upload.name}
        actions={
          <Button size="sm" variant="ghost" onClick={() => { cancelRef.current = true; reset() }}>
            <Trash2 className="size-4" aria-hidden /> Choose another
          </Button>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Stat label="Pages" value={pdf.pageCount} />
          <Stat label="Current size" value={formatBytes(pdf.upload.size)} />
        </div>
      </Panel>

      <Panel title="Compression method">
        <div className="space-y-4">
          <Segmented
            label="Compression method"
            value={mode}
            onChange={setMode}
            options={[
              { value: 'lossless', label: 'Lossless cleanup' },
              { value: 'rasterize', label: 'Rasterize pages' },
            ]}
          />
          {mode === 'lossless' ? (
            <Alert tone="info" title="What this does">
              Repacks the file structure and removes document metadata. Text, images, links and fonts stay exactly as they are. Savings are usually small, and often none for files that were already optimized.
            </Alert>
          ) : (
            <>
              <Alert tone="warn" title="Text will no longer be selectable">
                Each page is drawn as an image and rebuilt into a new PDF. This can shrink scans and image-heavy files a lot, but links, form fields and searchable text are lost. Do not use it for documents you need to search or copy from.
              </Alert>
              <OptionRow>
                <Field label="Resolution">
                  {() => <Segmented label="Resolution" value={dpi} onChange={setDpi} options={[72, 100, 150, 200].map((d) => ({ value: d, label: `${d} DPI` }))} />}
                </Field>
                <QualitySlider label="JPEG quality" value={quality} onChange={setQuality} min={20} max={95} hint="Lower is smaller. 60 to 75 is a good range for scans." />
              </OptionRow>
            </>
          )}
          <div className="flex gap-2">
            <Button variant="primary" disabled={busy} onClick={() => void run()}>
              {busy ? 'Compressing…' : 'Compress PDF'}
            </Button>
            {busy && mode === 'rasterize' && (
              <Button onClick={() => (cancelRef.current = true)}>
                <X className="size-4" aria-hidden /> Stop
              </Button>
            )}
          </div>
          {busy && <ProgressBar value={progress} label="Compressing" />}
          {procError && <Alert tone="danger" title="Compression failed">{procError}</Alert>}
        </div>
      </Panel>

      {result && (
        <Panel title="Result" actions={smaller ? <DownloadButton onClick={() => downloadBlob(result.blob, `${baseName(pdf.upload.name)}-compressed.pdf`)}>Download compressed PDF</DownloadButton> : undefined}>
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat label="Before" value={formatBytes(pdf.upload.size)} />
            <Stat label="After" value={formatBytes(result.blob.size)} />
            <Stat label={smaller ? 'Saved' : 'Change'} value={`${Math.abs(savedPercent(pdf.upload.size, result.blob.size))}%`} sub={formatSaving(pdf.upload.size, result.blob.size)} />
          </div>
          {!smaller && (
            <Alert tone="warn" className="mt-4" title="No saving, so no download">
              {result.mode === 'lossless'
                ? 'This file is already well packed, or most of its size is images and fonts that cleanup does not touch. If it is a scan or full of photos, try Rasterize pages.'
                : 'The rebuilt file came out larger. Lower the resolution or quality and try again.'}
            </Alert>
          )}
        </Panel>
      )}
    </div>
  )
}
