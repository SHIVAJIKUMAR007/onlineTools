import { useEffect, useMemo, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { FileDropzone } from '@/components/tools/FileDropzone'
import { CopyButton, DownloadButton, OptionRow, Panel } from '@/components/tools/controls'
import { Alert, ProgressBar, Stat } from '@/components/ui/misc'
import { Button } from '@/components/ui/button'
import { Field, Switch } from '@/components/ui/fields'
import { useFileUpload } from '@/hooks/useFileUpload'
import { useObjectUrl } from '@/hooks/useObjectUrl'
import { baseName } from '@/lib/utils/filename'
import { downloadBlob } from '@/lib/utils/download'
import { formatBytes, formatSaving, savedPercent } from '@/lib/utils/format'

const ACCEPT = ['image/svg+xml', '.svg']

export default function SvgOptimizer() {
  const { files, rejected, loading, addFiles, clear } = useFileUpload({ accept: ACCEPT, multiple: false })
  const upload = files[0]
  const [source, setSource] = useState('')
  const [optimized, setOptimized] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [working, setWorking] = useState(false)
  const [precision, setPrecision] = useState(3)
  const [multipass, setMultipass] = useState(true)
  const [keepViewBox, setKeepViewBox] = useState(true)
  const [removeDimensions, setRemoveDimensions] = useState(false)
  const [prettyPrint, setPrettyPrint] = useState(false)

  useEffect(() => {
    setSource('')
    setOptimized('')
    setError(null)
    if (upload) void upload.file.text().then(setSource, () => setError('The file could not be read.'))
  }, [upload])

  useEffect(() => {
    if (!source) return
    let cancelled = false
    setWorking(true)
    setError(null)
    ;(async () => {
      try {
        const { optimize } = await import('svgo/browser')
        type PluginConfig = NonNullable<NonNullable<Parameters<typeof optimize>[1]>['plugins']>[number]
        const plugins: PluginConfig[] = [
          (keepViewBox ? { name: 'preset-default', params: { overrides: { removeViewBox: false } } } : 'preset-default') as PluginConfig,
        ]
        if (removeDimensions) plugins.push('removeDimensions')
        const out = optimize(source, { multipass, floatPrecision: precision, plugins, js2svg: { pretty: prettyPrint } })
        if (!cancelled) setOptimized(out.data)
      } catch (e) {
        if (!cancelled) {
          setOptimized('')
          setError(e instanceof Error ? e.message : 'SVGO could not parse this file. Check that it is valid SVG.')
        }
      } finally {
        if (!cancelled) setWorking(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [source, precision, multipass, keepViewBox, removeDimensions, prettyPrint])

  const srcBlob = useMemo(() => (source ? new Blob([source], { type: 'image/svg+xml' }) : null), [source])
  const optBlob = useMemo(() => (optimized ? new Blob([optimized], { type: 'image/svg+xml' }) : null), [optimized])
  const srcUrl = useObjectUrl(srcBlob)
  const optUrl = useObjectUrl(optBlob)
  const origBytes = srcBlob?.size ?? 0
  const optBytes = optBlob?.size ?? 0

  if (!upload) {
    return <FileDropzone accept={ACCEPT} rejected={rejected} loading={loading} onFiles={(f) => void addFiles(f)} />
  }

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
        <div className="grid gap-3 sm:grid-cols-3">
          <Stat label="Original" value={formatBytes(origBytes)} />
          <Stat label="Optimized" value={optimized ? formatBytes(optBytes) : '…'} />
          <Stat label={optBytes <= origBytes ? 'Saved' : 'Larger by'} value={optimized ? `${Math.abs(savedPercent(origBytes, optBytes))}%` : '…'} sub={optimized ? formatSaving(origBytes, optBytes) : undefined} />
        </div>
      </Panel>

      <Panel title="Options">
        <OptionRow>
          <Field label={`Decimal precision: ${precision}`} hint="Fewer decimals make smaller files. Raise it if curves look off.">
            {(id) => <input id={id} type="range" min={0} max={8} value={precision} onChange={(e) => setPrecision(Number(e.target.value))} className="h-2 w-full cursor-pointer" />}
          </Field>
          <div className="flex flex-col gap-3">
            <Switch checked={multipass} onChange={setMultipass} label="Multiple passes" />
            <Switch checked={keepViewBox} onChange={setKeepViewBox} label="Keep viewBox (recommended)" />
          </div>
          <div className="flex flex-col gap-3">
            <Switch checked={removeDimensions} onChange={setRemoveDimensions} label="Remove width and height" />
            <Switch checked={prettyPrint} onChange={setPrettyPrint} label="Pretty print output" />
          </div>
        </OptionRow>
      </Panel>

      {error && <Alert tone="danger" title="Could not optimize">{error}</Alert>}
      {working && <ProgressBar label="Optimizing" />}

      {optimized && (
        <Panel
          title="Preview"
          actions={
            <div className="flex gap-2">
              <CopyButton text={optimized} label="Copy SVG" />
              <DownloadButton size="sm" onClick={() => downloadBlob(new Blob([optimized], { type: 'image/svg+xml' }), `${baseName(upload.name)}.min.svg`)}>
                Download
              </DownloadButton>
            </div>
          }
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <figure>
              <figcaption className="mb-2 text-sm font-medium text-ink-2">Original · {formatBytes(origBytes)}</figcaption>
              <div className="checker flex h-56 items-center justify-center overflow-hidden rounded-xl border border-line p-3">
                {srcUrl && <img src={srcUrl} alt="Original SVG" className="max-h-full max-w-full" />}
              </div>
            </figure>
            <figure>
              <figcaption className="mb-2 text-sm font-medium text-ink-2">Optimized · {formatBytes(optBytes)}</figcaption>
              <div className="checker flex h-56 items-center justify-center overflow-hidden rounded-xl border border-line p-3">
                {optUrl && <img src={optUrl} alt="Optimized SVG" className="max-h-full max-w-full" />}
              </div>
            </figure>
          </div>
          <p className="mt-3 text-xs text-muted">Both previews are rendered as images, so scripts inside the SVG do not run.</p>
        </Panel>
      )}
    </div>
  )
}
