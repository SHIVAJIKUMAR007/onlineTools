import { useEffect, useState } from 'react'
import { RotateCcw, RotateCw, Trash2 } from 'lucide-react'
import { FileDropzone } from '@/components/tools/FileDropzone'
import { DownloadButton, Panel } from '@/components/tools/controls'
import { PdfThumb } from '@/components/tools/PdfThumbs'
import { Alert } from '@/components/ui/misc'
import { Button } from '@/components/ui/button'
import { PDF_ACCEPT, usePdf } from '@/hooks/usePdf'
import { rotatePages } from '@/lib/pdf/edit'
import { baseName } from '@/lib/utils/filename'
import { downloadBlob } from '@/lib/utils/download'

export default function PdfPageRotator() {
  const { pdf, error, rejected, loading, load, reset } = usePdf()
  const [rotation, setRotation] = useState<Map<number, number>>(new Map())
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [busy, setBusy] = useState(false)
  const [procError, setProcError] = useState<string | null>(null)

  useEffect(() => {
    setRotation(new Map())
    setSelected(new Set())
  }, [pdf])

  const rotate = (indexes: number[], delta: number) =>
    setRotation((prev) => {
      const next = new Map(prev)
      for (const i of indexes) next.set(i, (((next.get(i) ?? 0) + delta) % 360 + 360) % 360)
      return next
    })

  const toggle = (i: number) =>
    setSelected((prev) => {
      const n = new Set(prev)
      if (n.has(i)) n.delete(i)
      else n.add(i)
      return n
    })

  const all = pdf ? Array.from({ length: pdf.pageCount }, (_, i) => i) : []
  const targets = selected.size ? [...selected] : all
  const changed = [...rotation.values()].filter((v) => v % 360 !== 0).length

  const exportPdf = async () => {
    if (!pdf) return
    setBusy(true)
    setProcError(null)
    try {
      const bytes = await rotatePages(pdf.bytes, new Map([...rotation].filter(([, v]) => v !== 0)))
      downloadBlob(new Blob([bytes as BlobPart], { type: 'application/pdf' }), `${baseName(pdf.upload.name)}-rotated.pdf`)
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

  return (
    <div className="space-y-5">
      <Panel
        title={pdf.upload.name}
        actions={
          <Button size="sm" variant="ghost" onClick={reset}>
            <Trash2 className="size-4" aria-hidden /> Choose another
          </Button>
        }
      >
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="text-sm text-ink-2">{selected.size ? `${selected.size} selected:` : 'All pages:'}</span>
          <Button size="sm" onClick={() => rotate(targets, -90)} aria-label="Rotate left 90 degrees">
            <RotateCcw className="size-4" aria-hidden /> Left
          </Button>
          <Button size="sm" onClick={() => rotate(targets, 90)} aria-label="Rotate right 90 degrees">
            <RotateCw className="size-4" aria-hidden /> Right
          </Button>
          <Button size="sm" onClick={() => rotate(targets, 180)}>180°</Button>
          <span className="mx-1 hidden h-5 w-px bg-line sm:block" />
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set(all))}>Select all</Button>
          <Button size="sm" variant="ghost" disabled={selected.size === 0} onClick={() => setSelected(new Set())}>Clear selection</Button>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {all.map((i) => (
            <PdfThumb
              key={i}
              doc={pdf.doc}
              page={i + 1}
              rotation={rotation.get(i) ?? 0}
              selected={selected.has(i)}
              onClick={() => toggle(i)}
              label={`Page ${i + 1}, rotated ${rotation.get(i) ?? 0} degrees${selected.has(i) ? ', selected' : ''}`}
              footer={
                <span className="flex items-center gap-1">
                  <Button size="icon-sm" variant="ghost" aria-label={`Rotate page ${i + 1} left`} onClick={() => rotate([i], -90)}><RotateCcw className="size-3.5" aria-hidden /></Button>
                  <span className="tabular text-xs text-muted">Page {i + 1}</span>
                  <Button size="icon-sm" variant="ghost" aria-label={`Rotate page ${i + 1} right`} onClick={() => rotate([i], 90)}><RotateCw className="size-3.5" aria-hidden /></Button>
                </span>
              }
            />
          ))}
        </div>
      </Panel>

      <Panel title="Export" actions={<DownloadButton disabled={busy || changed === 0} onClick={exportPdf}>{busy ? 'Exporting…' : 'Download rotated PDF'}</DownloadButton>}>
        <p className="text-sm text-ink-2">{changed ? `${changed} page${changed === 1 ? '' : 's'} rotated.` : 'Rotate at least one page to enable the download.'}</p>
        {procError && <Alert tone="danger" className="mt-3" title="Export failed">{procError}</Alert>}
      </Panel>
    </div>
  )
}
