import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { FileDropzone } from '@/components/tools/FileDropzone'
import { DownloadButton, Panel } from '@/components/tools/controls'
import { PdfThumb } from '@/components/tools/PdfThumbs'
import { Alert, Stat } from '@/components/ui/misc'
import { Button } from '@/components/ui/button'
import { PDF_ACCEPT, usePdf } from '@/hooks/usePdf'
import { extractPages } from '@/lib/pdf/edit'
import { remainingIndexes } from '@/lib/pdf/pages'
import { baseName } from '@/lib/utils/filename'
import { downloadBlob } from '@/lib/utils/download'
import { pluralize } from '@/lib/utils/format'

export default function PdfPageRemover() {
  const { pdf, error, rejected, loading, load, reset } = usePdf()
  const [removed, setRemoved] = useState<Set<number>>(new Set())
  const [busy, setBusy] = useState(false)
  const [procError, setProcError] = useState<string | null>(null)

  useEffect(() => setRemoved(new Set()), [pdf])

  const toggle = (i: number) =>
    setRemoved((prev) => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })

  const exportPdf = async () => {
    if (!pdf) return
    setBusy(true)
    setProcError(null)
    try {
      const keep = remainingIndexes(pdf.pageCount, removed)
      const bytes = await extractPages(pdf.bytes, keep)
      downloadBlob(new Blob([bytes as BlobPart], { type: 'application/pdf' }), `${baseName(pdf.upload.name)}-edited.pdf`)
    } catch (e) {
      setProcError(e instanceof Error ? e.message : 'Export failed.')
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

  const remaining = pdf.pageCount - removed.size
  return (
    <div className="space-y-5">
      <Panel
        title={pdf.upload.name}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => setRemoved(new Set(Array.from({ length: pdf.pageCount }, (_, i) => i)))}>Select all</Button>
            <Button size="sm" onClick={() => setRemoved(new Set())} disabled={removed.size === 0}>Clear selection</Button>
            <Button size="sm" variant="ghost" onClick={reset}>
              <Trash2 className="size-4" aria-hidden /> Choose another
            </Button>
          </div>
        }
      >
        <p className="mb-4 text-sm text-ink-2">Click a page to mark it for removal. Marked pages are crossed out and will not be in the exported file.</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {Array.from({ length: pdf.pageCount }, (_, i) => (
            <PdfThumb
              key={i}
              doc={pdf.doc}
              page={i + 1}
              marked={removed.has(i)}
              onClick={() => toggle(i)}
              label={`Page ${i + 1}${removed.has(i) ? ', marked for removal' : ''}`}
              overlay={removed.has(i) ? <span className="absolute inset-0 flex items-center justify-center text-4xl font-light text-danger" aria-hidden>×</span> : undefined}
              footer={<span className="tabular text-xs text-muted">Page {i + 1}</span>}
            />
          ))}
        </div>
      </Panel>

      <Panel title="Export" actions={<DownloadButton disabled={busy || removed.size === 0 || remaining === 0} onClick={exportPdf}>{busy ? 'Exporting…' : 'Download edited PDF'}</DownloadButton>}>
        <div className="grid gap-3 sm:grid-cols-3">
          <Stat label="Original" value={pluralize(pdf.pageCount, 'page')} />
          <Stat label="Removing" value={pluralize(removed.size, 'page')} />
          <Stat label="Remaining" value={pluralize(remaining, 'page')} />
        </div>
        {remaining === 0 && <Alert tone="warn" className="mt-3">A PDF needs at least one page. Unmark a page to keep it.</Alert>}
        {procError && <Alert tone="danger" className="mt-3" title="Export failed">{procError}</Alert>}
      </Panel>
    </div>
  )
}
