import { useMemo, useState } from 'react'
import { FileText, Trash2 } from 'lucide-react'
import { FileDropzone } from '@/components/tools/FileDropzone'
import { DownloadButton, Panel } from '@/components/tools/controls'
import { Alert, ProgressBar, Stat } from '@/components/ui/misc'
import { Button } from '@/components/ui/button'
import { Field, Input, Segmented } from '@/components/ui/fields'
import { usePdf } from '@/hooks/usePdf'
import { extractPages } from '@/lib/pdf/edit'
import { parsePageRanges, rangeLabel } from '@/lib/pdf/pages'
import { baseName } from '@/lib/utils/filename'
import { downloadBlob, downloadZip } from '@/lib/utils/download'
import { formatBytes, pluralize } from '@/lib/utils/format'
import { PDF_ACCEPT } from '@/hooks/usePdf'

type Mode = 'separate' | 'combined' | 'every'
interface Output {
  name: string
  blob: Blob
  pages: number
}

export default function PdfSplitter() {
  const { pdf, error, rejected, loading, load, reset } = usePdf()
  const [ranges, setRanges] = useState('1')
  const [mode, setMode] = useState<Mode>('separate')
  const [busy, setBusy] = useState(false)
  const [procError, setProcError] = useState<string | null>(null)
  const [outputs, setOutputs] = useState<Output[]>([])

  const parsed = useMemo(() => (pdf && mode !== 'every' ? parsePageRanges(ranges, pdf.pageCount) : null), [pdf, ranges, mode])

  const run = async () => {
    if (!pdf) return
    setBusy(true)
    setProcError(null)
    setOutputs([])
    try {
      const stem = baseName(pdf.upload.name)
      const make = async (indexes: number[], label: string): Promise<Output> => {
        const bytes = await extractPages(pdf.bytes, indexes)
        return { name: `${stem}-${label}.pdf`, blob: new Blob([bytes as BlobPart], { type: 'application/pdf' }), pages: indexes.length }
      }
      const out: Output[] = []
      if (mode === 'every') {
        const pad = String(pdf.pageCount).length
        for (let i = 0; i < pdf.pageCount; i++) out.push(await make([i], `page-${String(i + 1).padStart(pad, '0')}`))
      } else if (parsed?.ok) {
        if (mode === 'combined') out.push(await make(parsed.groups.flat().map((p) => p - 1), 'extract'))
        else for (const g of parsed.groups) out.push(await make(g.map((p) => p - 1), `pages-${rangeLabel(g)}`))
      }
      setOutputs(out)
    } catch (e) {
      setProcError(e instanceof Error ? e.message : 'Splitting failed.')
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

  const canRun = mode === 'every' || parsed?.ok

  return (
    <div className="space-y-5">
      <Panel
        title={pdf.upload.name}
        actions={
          <Button size="sm" variant="ghost" onClick={() => { reset(); setOutputs([]) }}>
            <Trash2 className="size-4" aria-hidden /> Choose another
          </Button>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Stat label="Pages" value={pdf.pageCount} />
          <Stat label="File size" value={formatBytes(pdf.upload.size)} />
        </div>
      </Panel>

      <Panel title="How to split">
        <div className="space-y-4">
          <Segmented
            label="Split mode"
            value={mode}
            onChange={(m) => { setMode(m); setOutputs([]) }}
            options={[
              { value: 'separate', label: 'One PDF per range' },
              { value: 'combined', label: 'Combine ranges in one PDF' },
              { value: 'every', label: 'Every page separately' },
            ]}
          />
          {mode !== 'every' && (
            <Field label="Pages to extract" hint={`Use commas and dashes, for example 1-3, 5, 8-${Math.max(8, pdf.pageCount)}. This document has ${pluralize(pdf.pageCount, 'page')}.`}>
              {(id) => <Input id={id} value={ranges} onChange={(e) => { setRanges(e.target.value); setOutputs([]) }} aria-invalid={parsed ? !parsed.ok : undefined} aria-describedby={parsed && !parsed.ok ? `${id}-err` : undefined} className="max-w-md" />}
            </Field>
          )}
          {parsed && !parsed.ok && <p className="text-sm text-danger" role="alert">{parsed.error}</p>}
          {mode === 'every' && pdf.pageCount > 100 && <Alert tone="warn">This will create {pdf.pageCount} files. Download them as a ZIP.</Alert>}
          <Button variant="primary" disabled={!canRun || busy} onClick={() => void run()}>
            {busy ? 'Splitting…' : 'Split PDF'}
          </Button>
          {busy && <ProgressBar label="Splitting" />}
          {procError && <Alert tone="danger" title="Splitting failed">{procError}</Alert>}
        </div>
      </Panel>

      {outputs.length > 0 && (
        <Panel
          title={`${pluralize(outputs.length, 'file')} ready`}
          actions={outputs.length > 1 ? <DownloadButton onClick={() => downloadZip(outputs.map((o) => ({ name: o.name, blob: o.blob })), `${baseName(pdf.upload.name)}-split.zip`)}>Download ZIP</DownloadButton> : undefined}
        >
          <ul className="divide-y divide-line">
            {outputs.map((o) => (
              <li key={o.name} className="flex items-center gap-3 py-2.5">
                <FileText className="size-5 shrink-0 text-muted" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{o.name}</p>
                  <p className="tabular text-xs text-muted">{pluralize(o.pages, 'page')} · {formatBytes(o.blob.size)}</p>
                </div>
                <DownloadButton size="sm" variant="secondary" onClick={() => downloadBlob(o.blob, o.name)}>Download</DownloadButton>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  )
}
