import { useEffect, useMemo, useRef, useState } from 'react'
import { Trash2, X } from 'lucide-react'
import { FileDropzone } from '@/components/tools/FileDropzone'
import { DownloadButton, OptionRow, Panel, QualitySlider } from '@/components/tools/controls'
import { Alert, ProgressBar, Stat } from '@/components/ui/misc'
import { Button } from '@/components/ui/button'
import { Field, Input, Segmented } from '@/components/ui/fields'
import { PDF_ACCEPT, usePdf } from '@/hooks/usePdf'
import { useObjectUrl } from '@/hooks/useObjectUrl'
import { checkRenderSize, canvasToBlobAsync, renderPageToCanvas } from '@/lib/pdf/render'
import { parsePageRanges } from '@/lib/pdf/pages'
import { baseName } from '@/lib/utils/filename'
import { downloadBlob, downloadZip } from '@/lib/utils/download'
import { formatBytes, pluralize } from '@/lib/utils/format'

interface Out {
  page: number
  name: string
  blob: Blob
  width: number
  height: number
}

function Preview({ blob, alt }: { blob: Blob; alt: string }) {
  const url = useObjectUrl(blob)
  return url ? <img src={url} alt={alt} className="h-full w-full object-contain" /> : null
}

export default function PdfToImages() {
  const { pdf, error, rejected, loading, load, reset } = usePdf()
  const [format, setFormat] = useState<'png' | 'jpeg'>('png')
  const [dpi, setDpi] = useState(150)
  const [quality, setQuality] = useState(90)
  const [pages, setPages] = useState('')
  const [running, setRunning] = useState(false)
  const [done, setDone] = useState(0)
  const [outputs, setOutputs] = useState<Out[]>([])
  const [procError, setProcError] = useState<string | null>(null)
  const cancelRef = useRef(false)

  useEffect(() => {
    setOutputs([])
    setPages('')
    setProcError(null)
  }, [pdf])

  const selection = useMemo(() => {
    if (!pdf) return null
    if (!pages.trim()) return { ok: true as const, list: Array.from({ length: pdf.pageCount }, (_, i) => i + 1) }
    const r = parsePageRanges(pages, pdf.pageCount)
    return r.ok ? { ok: true as const, list: [...new Set(r.groups.flat())].sort((a, b) => a - b) } : { ok: false as const, error: r.error }
  }, [pdf, pages])

  const run = async () => {
    if (!pdf || !selection?.ok) return
    cancelRef.current = false
    setRunning(true)
    setDone(0)
    setOutputs([])
    setProcError(null)
    const stem = baseName(pdf.upload.name)
    const pad = String(pdf.pageCount).length
    const out: Out[] = []
    try {
      const first = await pdf.doc.getPage(selection.list[0])
      const vp = first.getViewport({ scale: 1 })
      const sizeProblem = checkRenderSize(vp.width, vp.height, dpi)
      if (sizeProblem) throw new Error(sizeProblem)
      for (const p of selection.list) {
        if (cancelRef.current) break
        const r = await renderPageToCanvas(pdf.doc, p, dpi / 72)
        const blob = await canvasToBlobAsync(r.canvas, format === 'png' ? 'image/png' : 'image/jpeg', quality / 100)
        // Free the canvas memory right away.
        r.canvas.width = 0
        r.canvas.height = 0
        out.push({ page: p, name: `${stem}-page-${String(p).padStart(pad, '0')}.${format === 'png' ? 'png' : 'jpg'}`, blob, width: r.width, height: r.height })
        setOutputs([...out])
        setDone(out.length)
      }
    } catch (e) {
      setProcError(e instanceof Error ? e.message : 'Conversion failed.')
    } finally {
      setRunning(false)
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

  const total = selection?.ok ? selection.list.length : 0
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
          <Stat label="File size" value={formatBytes(pdf.upload.size)} />
        </div>
      </Panel>

      <Panel title="Settings">
        <OptionRow>
          <Field label="Format">
            {() => <Segmented label="Format" value={format} onChange={setFormat} options={[{ value: 'png', label: 'PNG' }, { value: 'jpeg', label: 'JPG' }]} />}
          </Field>
          <Field label="Resolution">
            {() => (
              <Segmented
                label="Resolution"
                value={dpi}
                onChange={setDpi}
                options={[72, 150, 200, 300].map((d) => ({ value: d, label: `${d} DPI` }))}
              />
            )}
          </Field>
          {format === 'jpeg' && <QualitySlider value={quality} onChange={setQuality} />}
          <Field label="Pages (optional)" hint="Leave empty for all pages. Example: 1-3, 7">
            {(id) => <Input id={id} value={pages} onChange={(e) => setPages(e.target.value)} placeholder={`1-${pdf.pageCount}`} aria-invalid={selection ? !selection.ok : undefined} />}
          </Field>
        </OptionRow>
        {selection && !selection.ok && <p className="mt-3 text-sm text-danger" role="alert">{selection.error}</p>}
        <div className="mt-4 flex gap-2">
          <Button variant="primary" disabled={running || !selection?.ok} onClick={() => void run()}>
            {running ? `Rendering ${done} of ${total}…` : `Convert ${pluralize(total, 'page')}`}
          </Button>
          {running && (
            <Button onClick={() => (cancelRef.current = true)}>
              <X className="size-4" aria-hidden /> Stop
            </Button>
          )}
        </div>
        {running && <div className="mt-3"><ProgressBar value={total ? done / total : 0} label="Rendering pages" /></div>}
        {procError && <Alert tone="danger" className="mt-3" title="Conversion stopped">{procError}</Alert>}
      </Panel>

      {outputs.length > 0 && (
        <Panel
          title={`${pluralize(outputs.length, 'image')}`}
          actions={outputs.length > 1 ? <DownloadButton onClick={() => downloadZip(outputs.map((o) => ({ name: o.name, blob: o.blob })), `${baseName(pdf.upload.name)}-images.zip`)} disabled={running}>Download ZIP</DownloadButton> : undefined}
        >
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {outputs.map((o) => (
              <li key={o.name} className="space-y-1.5">
                <div className="checker aspect-[3/4] overflow-hidden rounded-lg border border-line">
                  <Preview blob={o.blob} alt={`Page ${o.page}`} />
                </div>
                <p className="tabular text-xs text-muted">Page {o.page} · {o.width}×{o.height} · {formatBytes(o.blob.size)}</p>
                <Button size="sm" className="w-full" onClick={() => downloadBlob(o.blob, o.name)}>Download</Button>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  )
}
