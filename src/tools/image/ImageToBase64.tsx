import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { FileDropzone } from '@/components/tools/FileDropzone'
import { CopyButton, DownloadButton, Panel } from '@/components/tools/controls'
import { Alert, ProgressBar, Stat } from '@/components/ui/misc'
import { Button } from '@/components/ui/button'
import { Segmented, Textarea } from '@/components/ui/fields'
import { useFileUpload } from '@/hooks/useFileUpload'
import { useObjectUrl } from '@/hooks/useObjectUrl'
import { baseName } from '@/lib/utils/filename'
import { downloadText } from '@/lib/utils/download'
import { formatBytes } from '@/lib/utils/format'

const ACCEPT = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif', 'image/bmp', 'image/svg+xml', '.jpg', '.jpeg', '.png', '.webp', '.avif', '.gif', '.bmp', '.svg']

type Kind = 'uri' | 'raw' | 'css' | 'html'
const PREVIEW_LIMIT = 60_000

function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(new Error('The file could not be read.'))
    r.readAsDataURL(file)
  })
}

export default function ImageToBase64() {
  const { files, rejected, loading, addFiles, clear } = useFileUpload({ accept: ACCEPT, multiple: false })
  const upload = files[0]
  const [dataUri, setDataUri] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [kind, setKind] = useState<Kind>('uri')
  const [reading, setReading] = useState(false)
  const preview = useObjectUrl(upload?.file)

  useEffect(() => {
    setDataUri('')
    setErr(null)
    if (!upload) return
    let cancelled = false
    setReading(true)
    readAsDataUrl(upload.file)
      .then((d) => {
        if (cancelled) return
        // SVG and some files report a blank type; correct it from the detected type.
        const mime = upload.sniffed !== 'unknown' ? upload.sniffed : upload.file.type || 'application/octet-stream'
        setDataUri(d.replace(/^data:[^;,]*/, `data:${mime}`))
      })
      .catch((e: Error) => !cancelled && setErr(e.message))
      .finally(() => !cancelled && setReading(false))
    return () => {
      cancelled = true
    }
  }, [upload])

  const raw = dataUri.split(',')[1] ?? ''
  const output =
    kind === 'uri' ? dataUri : kind === 'raw' ? raw : kind === 'css' ? `background-image: url("${dataUri}");` : `<img src="${dataUri}" alt="" />`

  if (!upload) {
    return (
      <div className="space-y-4">
        <FileDropzone accept={ACCEPT} rejected={rejected} loading={loading} onFiles={(f) => void addFiles(f)} />
      </div>
    )
  }

  const overhead = upload.size ? Math.round(((raw.length - upload.size) / upload.size) * 100) : 0
  const clipped = output.length > PREVIEW_LIMIT

  return (
    <div className="space-y-5">
      <Panel
        title={upload.name}
        actions={
          <Button size="sm" variant="ghost" onClick={clear}>
            <Trash2 className="size-4" aria-hidden /> Choose another
          </Button>
        }
      >
        <div className="grid gap-5 sm:grid-cols-[160px_1fr]">
          <div className="checker flex h-40 items-center justify-center overflow-hidden rounded-xl border border-line">
            {preview && <img src={preview} alt="Selected image" className="max-h-full max-w-full object-contain" />}
          </div>
          <div className="grid content-start gap-3 sm:grid-cols-3">
            <Stat label="File size" value={formatBytes(upload.size)} />
            <Stat label="Base64 length" value={reading ? '…' : `${raw.length.toLocaleString()} chars`} />
            <Stat label="Overhead" value={reading ? '…' : `+${overhead}%`} sub="vs. binary file" />
          </div>
        </div>
      </Panel>

      <Panel
        title="Encoded output"
        actions={
          <div className="flex gap-2">
            <CopyButton text={() => output} label="Copy" disabled={!output} />
            <DownloadButton size="sm" variant="secondary" disabled={!output} onClick={() => downloadText(output, `${baseName(upload.name)}-base64.txt`)}>
              Download .txt
            </DownloadButton>
          </div>
        }
      >
        <div className="space-y-3">
          <Segmented
            label="Output format"
            value={kind}
            onChange={setKind}
            options={[
              { value: 'uri', label: 'Data URI' },
              { value: 'raw', label: 'Base64 only' },
              { value: 'css', label: 'CSS' },
              { value: 'html', label: 'HTML img' },
            ]}
          />
          {reading && <ProgressBar label="Reading file" />}
          {err && <Alert tone="danger" title="Could not read the file">{err}</Alert>}
          <Textarea readOnly value={clipped ? output.slice(0, PREVIEW_LIMIT) + '…' : output} className="min-h-48" aria-label="Encoded output" onFocus={(e) => e.currentTarget.select()} />
          {clipped && <p className="text-xs text-muted">Showing the first {PREVIEW_LIMIT.toLocaleString()} characters. Copy and download use the full {output.length.toLocaleString()} characters.</p>}
        </div>
      </Panel>
    </div>
  )
}
