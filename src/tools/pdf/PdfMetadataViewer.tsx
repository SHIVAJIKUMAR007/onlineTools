import { useEffect, useState, type ReactNode } from 'react'
import { Trash2 } from 'lucide-react'
import { FileDropzone } from '@/components/tools/FileDropzone'
import { DownloadButton, Panel } from '@/components/tools/controls'
import { Alert, Badge, ProgressBar } from '@/components/ui/misc'
import { Button } from '@/components/ui/button'
import { PDF_ACCEPT, useFileUploadSingle } from './shared'
import { clearMetadata, getPdfInfo, type PdfInfo } from '@/lib/pdf/edit'
import { baseName } from '@/lib/utils/filename'
import { downloadBlob } from '@/lib/utils/download'
import { formatBytes } from '@/lib/utils/format'

const ptToMm = (pt: number) => Math.round((pt / 72) * 25.4)

function Row({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(7rem,1fr)_2fr] gap-3 py-2 text-sm">
      <dt className="text-muted">{k}</dt>
      <dd className="tabular break-words font-medium">{v || <span className="font-normal text-muted">Not set</span>}</dd>
    </div>
  )
}

export default function PdfMetadataViewer() {
  const { upload, rejected, loading, load, reset } = useFileUploadSingle()
  const [info, setInfo] = useState<PdfInfo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setInfo(null)
    setError(null)
    if (!upload) return
    let cancelled = false
    setBusy(true)
    ;(async () => {
      try {
        const bytes = new Uint8Array(await upload.file.arrayBuffer())
        const i = await getPdfInfo(bytes)
        if (!cancelled) setInfo(i)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'This PDF could not be read.')
      } finally {
        if (!cancelled) setBusy(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [upload])

  const clean = async () => {
    if (!upload) return
    try {
      const out = await clearMetadata(await upload.file.arrayBuffer())
      downloadBlob(new Blob([out as BlobPart], { type: 'application/pdf' }), `${baseName(upload.name)}-clean.pdf`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create a clean copy.')
    }
  }

  if (!upload) return <FileDropzone accept={PDF_ACCEPT} rejected={rejected} loading={loading} onFiles={(f) => void load(f)} />

  const sizes = info ? [...new Set(info.pageSizes.map((p) => `${ptToMm(p.width)} × ${ptToMm(p.height)} mm`))] : []
  const date = (d?: Date) => (d ? d.toLocaleString() : undefined)

  return (
    <div className="space-y-5">
      <Panel
        title={upload.name}
        actions={
          <div className="flex gap-2">
            <DownloadButton size="sm" variant="secondary" disabled={!info || info.encrypted} onClick={clean}>Download without metadata</DownloadButton>
            <Button size="sm" variant="ghost" onClick={reset}>
              <Trash2 className="size-4" aria-hidden /> Choose another
            </Button>
          </div>
        }
      >
        {busy && <ProgressBar label="Reading PDF" />}
        {error && <Alert tone="danger" title="Could not read this PDF">{error}</Alert>}
        {info && (
          <dl className="divide-y divide-line">
            <Row k="File size" v={`${formatBytes(upload.size)} (${upload.size.toLocaleString()} bytes)`} />
            <Row k="Pages" v={info.pageCount} />
            <Row k="Page size" v={sizes.length > 3 ? `${sizes.length} different sizes` : sizes.join(', ')} />
            <Row k="PDF version" v={info.version ? `PDF ${info.version}` : undefined} />
            <Row k="Encrypted" v={info.encrypted ? <Badge tone="warn">Yes</Badge> : 'No'} />
            <Row k="Title" v={info.title} />
            <Row k="Author" v={info.author} />
            <Row k="Subject" v={info.subject} />
            <Row k="Keywords" v={info.keywords} />
            <Row k="Creator (app that made it)" v={info.creator} />
            <Row k="Producer (PDF software)" v={info.producer} />
            <Row k="Created" v={date(info.creationDate)} />
            <Row k="Modified" v={date(info.modificationDate)} />
          </dl>
        )}
        {info?.encrypted && <Alert tone="warn" className="mt-4">This PDF is encrypted. Details were read where possible, but pages cannot be edited here.</Alert>}
      </Panel>
    </div>
  )
}
