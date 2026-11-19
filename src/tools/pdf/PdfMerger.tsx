import { useEffect, useState } from 'react'
import { ArrowDown, ArrowUp, FileText, Trash2, X } from 'lucide-react'
import { FileDropzone } from '@/components/tools/FileDropzone'
import { DownloadButton, Panel } from '@/components/tools/controls'
import { Alert, Badge, ProgressBar, Stat } from '@/components/ui/misc'
import { Button } from '@/components/ui/button'
import { useFileUpload } from '@/hooks/useFileUpload'
import { PDF_ACCEPT } from '@/hooks/usePdf'
import { mergePdfs, pageCountOf, PdfPasswordError } from '@/lib/pdf/edit'
import { downloadBlob } from '@/lib/utils/download'
import { formatBytes, pluralize } from '@/lib/utils/format'

type Info = { pages?: number; error?: string }

export default function PdfMerger() {
  const { files, rejected, loading, addFiles, remove, clear, move } = useFileUpload({ accept: PDF_ACCEPT, multiple: true })
  const [info, setInfo] = useState<Record<string, Info>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ blob: Blob; pages: number } | null>(null)

  useEffect(() => {
    let cancelled = false
    for (const f of files) {
      if (info[f.id]) continue
      void (async () => {
        try {
          const pages = await pageCountOf(await f.file.arrayBuffer())
          if (!cancelled) setInfo((p) => ({ ...p, [f.id]: { pages } }))
        } catch (e) {
          const msg = e instanceof PdfPasswordError ? 'Password-protected' : e instanceof Error ? e.message : 'Unreadable'
          if (!cancelled) setInfo((p) => ({ ...p, [f.id]: { error: msg } }))
        }
      })()
    }
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files])

  // Any change to the list invalidates the previous result.
  useEffect(() => setResult(null), [files])

  const good = files.filter((f) => info[f.id]?.pages)
  const bad = files.filter((f) => info[f.id]?.error)
  const totalPages = good.reduce((a, f) => a + (info[f.id].pages ?? 0), 0)

  const merge = async () => {
    setBusy(true)
    setError(null)
    try {
      const buffers = await Promise.all(good.map((f) => f.file.arrayBuffer()))
      const out = await mergePdfs(buffers)
      setResult({ blob: new Blob([out as BlobPart], { type: 'application/pdf' }), pages: totalPages })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Merging failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-5">
      <FileDropzone accept={PDF_ACCEPT} multiple rejected={rejected} loading={loading} compact={files.length > 0} onFiles={(f) => void addFiles(f)} title={files.length ? 'Add more PDFs' : undefined} />

      {files.length > 0 && (
        <Panel
          title={`${pluralize(files.length, 'PDF')} in merge order`}
          actions={
            <Button size="sm" variant="ghost" onClick={() => { clear(); setInfo({}) }}>
              <Trash2 className="size-4" aria-hidden /> Clear all
            </Button>
          }
        >
          <ol className="divide-y divide-line">
            {files.map((f, i) => {
              const inf = info[f.id]
              return (
                <li key={f.id} className="flex items-center gap-3 py-3">
                  <span className="tabular flex size-7 shrink-0 items-center justify-center rounded-full bg-surface-2 text-xs font-medium">{i + 1}</span>
                  <FileText className="size-5 shrink-0 text-muted" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium" title={f.name}>{f.name}</p>
                    <p className="tabular text-xs text-muted">
                      {formatBytes(f.size)}
                      {inf?.pages ? ` · ${pluralize(inf.pages, 'page')}` : ''}
                    </p>
                  </div>
                  {inf?.error && <Badge tone="danger">{inf.error}</Badge>}
                  <div className="flex items-center">
                    <Button size="icon-sm" variant="ghost" aria-label={`Move ${f.name} up`} disabled={i === 0} onClick={() => move(i, i - 1)}>
                      <ArrowUp className="size-4" aria-hidden />
                    </Button>
                    <Button size="icon-sm" variant="ghost" aria-label={`Move ${f.name} down`} disabled={i === files.length - 1} onClick={() => move(i, i + 1)}>
                      <ArrowDown className="size-4" aria-hidden />
                    </Button>
                    <Button size="icon-sm" variant="ghost" aria-label={`Remove ${f.name}`} onClick={() => remove(f.id)}>
                      <X className="size-4" aria-hidden />
                    </Button>
                  </div>
                </li>
              )
            })}
          </ol>
          {bad.length > 0 && <Alert tone="warn" className="mt-3" title="Some files will be skipped">Password-protected or damaged PDFs cannot be merged. Remove them or unlock them first.</Alert>}
        </Panel>
      )}

      {good.length > 0 && (
        <Panel
          title="Merge"
          actions={
            result ? (
              <DownloadButton onClick={() => downloadBlob(result.blob, 'merged.pdf')}>Download merged.pdf</DownloadButton>
            ) : (
              <Button variant="primary" disabled={busy || good.length < 2} onClick={() => void merge()}>
                {busy ? 'Merging…' : `Merge ${good.length} PDFs`}
              </Button>
            )
          }
        >
          {busy && <ProgressBar label="Merging" />}
          {good.length < 2 && !result && <p className="text-sm text-muted">Add at least one more PDF to merge.</p>}
          {error && <Alert tone="danger" title="Merging failed">{error}</Alert>}
          {result && (
            <div className="grid gap-3 sm:grid-cols-3">
              <Stat label="Pages" value={result.pages} />
              <Stat label="Merged size" value={formatBytes(result.blob.size)} />
              <Stat label="Inputs" value={formatBytes(good.reduce((a, f) => a + f.size, 0))} />
            </div>
          )}
        </Panel>
      )}
    </div>
  )
}
