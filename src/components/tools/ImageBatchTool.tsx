import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, Download, Plus, Trash2, X } from 'lucide-react'
import { FileDropzone } from './FileDropzone'
import { BeforeAfter } from './BeforeAfter'
import { DownloadButton, OptionRow, Panel, QualitySlider } from './controls'
import { Alert, Badge, ProgressBar, Spinner, Stat } from '@/components/ui/misc'
import { Button } from '@/components/ui/button'
import { Field, Segmented, Switch } from '@/components/ui/fields'
import { useFileUpload } from '@/hooks/useFileUpload'
import { useImageBatch, type BatchItem } from '@/hooks/useImageProcessing'
import { useObjectUrl } from '@/hooks/useObjectUrl'
import { FORMAT_EXT, FORMAT_MIME, type OutputFormat, type ProcessOptions } from '@/lib/image/types'
import { baseName } from '@/lib/utils/filename'
import { downloadBlob, downloadZip } from '@/lib/utils/download'
import { formatBytes, formatDuration, formatSaving, pluralize, savedPercent } from '@/lib/utils/format'
import { cn } from '@/lib/utils/cn'

export interface ImageBatchConfig {
  accept: string[]
  /** 'compress' keeps each file's own format. 'convert' writes the chosen format. */
  mode: 'compress' | 'convert'
  /** Output formats the user may pick. One entry means the format is fixed. */
  formats?: OutputFormat[]
  defaultFormat?: OutputFormat
  defaultQuality?: number
  /** Hide the quality slider (lossless output such as PNG). */
  hideQualityFor?: OutputFormat[]
  fileSuffix?: string
  /** Text under the dropzone title. */
  dropHint?: string
}

const sniffToFormat = (t: string): OutputFormat =>
  t === 'image/png' ? 'png' : t === 'image/webp' ? 'webp' : t === 'image/avif' ? 'avif' : 'jpeg'

function Thumb({ blob, alt, className }: { blob: Blob; alt: string; className?: string }) {
  const url = useObjectUrl(blob)
  const [failed, setFailed] = useState(false)
  if (!url || failed) return <div className={cn('flex items-center justify-center rounded-lg bg-surface-2 text-xs text-muted', className)}>No preview</div>
  return <img src={url} alt={alt} onError={() => setFailed(true)} className={cn('rounded-lg object-cover', className)} />
}

function outName(item: BatchItem, cfg: ImageBatchConfig, format: OutputFormat) {
  const ext = FORMAT_EXT[format]
  const suffix = cfg.fileSuffix ?? (cfg.mode === 'compress' ? '-compressed' : '')
  return `${baseName(item.upload.name)}${suffix}.${ext}`
}

export function ImageBatchTool(cfg: ImageBatchConfig) {
  const { files, rejected, loading, addFiles, remove, clear } = useFileUpload({ accept: cfg.accept, multiple: true })
  const batch = useImageBatch()
  const formats = cfg.formats ?? ['jpeg']
  const [format, setFormat] = useState<OutputFormat>(cfg.defaultFormat ?? formats[0])
  const [quality, setQuality] = useState(cfg.defaultQuality ?? 80)
  const [background, setBackground] = useState('#ffffff')
  const [lossless, setLossless] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)

  const compress = cfg.mode === 'compress'
  const effectiveFormat = (item?: BatchItem): OutputFormat => (compress && item ? sniffToFormat(item.upload.sniffed) : format)
  const manual = !compress && format === 'avif'

  useEffect(() => batch.setUploads(files), [files]) // eslint-disable-line react-hooks/exhaustive-deps

  const optionsFor = (item: BatchItem): ProcessOptions => {
    const f = effectiveFormat(item)
    return {
      format: f,
      quality,
      background: f === 'jpeg' ? background : undefined,
      lossless: f === 'webp' && !compress ? lossless : false,
      optimizePng: compress,
    }
  }

  // Re-run when files or options change. Manual mode (AVIF) waits for the button.
  const key = useMemo(() => JSON.stringify([files.map((f) => f.id), format, quality, background, lossless]), [files, format, quality, background, lossless])
  useEffect(() => {
    if (files.length === 0 || manual) return
    const t = setTimeout(() => void batch.run(optionsFor), 350)
    return () => clearTimeout(t)
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps

  const items = batch.items
  const done = items.filter((i) => i.status === 'done' && i.result)
  const totalOrig = done.reduce((a, i) => a + i.upload.size, 0)
  const totalNew = done.reduce((a, i) => a + (compress ? Math.min(i.result!.blob.size, i.upload.size) : i.result!.blob.size), 0)
  const progress = items.length ? items.filter((i) => i.status === 'done' || i.status === 'error').length / items.length : 0
  const picked = items.find((i) => i.id === selected) ?? done[0]
  const pickedOrigUrl = useObjectUrl(picked?.upload.file)

  const downloadOne = (item: BatchItem) => {
    if (!item.result) return
    const f = effectiveFormat(item)
    if (compress && item.result.blob.size >= item.upload.size) {
      downloadBlob(item.upload.file, `${baseName(item.upload.name)}${cfg.fileSuffix ?? '-compressed'}.${FORMAT_EXT[f]}`)
      return
    }
    downloadBlob(item.result.blob, outName(item, cfg, f))
  }

  const downloadAll = async () => {
    await downloadZip(
      done.map((i) => {
        const f = effectiveFormat(i)
        const keepOriginal = compress && i.result!.blob.size >= i.upload.size
        return { name: outName(i, cfg, f), blob: keepOriginal ? i.upload.file : i.result!.blob }
      }),
      compress ? 'compressed-images.zip' : 'converted-images.zip',
    )
  }

  const reset = () => {
    batch.reset()
    clear()
    setSelected(null)
  }

  const showQuality = compress || !(cfg.hideQualityFor ?? []).includes(format)
  const qualityHint = compress ? 'JPG and WebP are lossy. PNG files are optimized without changing pixels.' : format === 'png' ? undefined : 'Higher is sharper and larger.'

  return (
    <div className="space-y-5">
      <FileDropzone
        accept={cfg.accept}
        multiple
        rejected={rejected}
        loading={loading}
        compact={files.length > 0}
        onFiles={(f) => void addFiles(f)}
        hint={cfg.dropHint}
        title={files.length ? 'Add more images' : undefined}
      />

      {files.length > 0 && (
        <Panel title="Options">
          <OptionRow>
            {formats.length > 1 && !compress && (
              <Field label="Output format">
                {() => (
                  <Segmented
                    label="Output format"
                    value={format}
                    onChange={setFormat}
                    options={formats.map((f) => ({ value: f, label: f === 'jpeg' ? 'JPG' : f.toUpperCase() }))}
                  />
                )}
              </Field>
            )}
            {showQuality && !(format === 'webp' && lossless && !compress) && (
              <QualitySlider value={quality} onChange={setQuality} hint={qualityHint} />
            )}
            {!compress && format === 'webp' && <div className="flex items-end pb-1"><Switch checked={lossless} onChange={setLossless} label="Lossless WebP" /></div>}
            {(format === 'jpeg' && !compress) && (
              <Field label="Background for transparent areas" hint="JPG cannot store transparency.">
                {(id) => (
                  <div className="flex items-center gap-2">
                    <input id={id} type="color" value={background} onChange={(e) => setBackground(e.target.value)} className="h-10 w-14 cursor-pointer rounded-lg border border-line-strong bg-paper p-1" />
                    <span className="tabular text-sm text-muted">{background.toUpperCase()}</span>
                  </div>
                )}
              </Field>
            )}
          </OptionRow>
          {format === 'avif' && !compress && (
            <p className="mt-3 text-xs text-muted">AVIF takes a few seconds per image. Click Convert when your settings are ready.</p>
          )}
        </Panel>
      )}

      {items.length > 0 && (
        <Panel
          title={pluralize(items.length, 'image')}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              {manual && (
                <Button variant="primary" size="sm" onClick={() => void batch.run(optionsFor)} disabled={batch.running}>
                  {batch.running ? <Spinner /> : null}
                  Convert {items.length === 1 ? 'image' : `${items.length} images`}
                </Button>
              )}
              {batch.running && (
                <Button size="sm" onClick={batch.cancel}>
                  <X className="size-4" aria-hidden /> Cancel
                </Button>
              )}
              {done.length > 1 && (
                <DownloadButton size="sm" onClick={downloadAll}>
                  Download all (ZIP)
                </DownloadButton>
              )}
              <Button size="sm" variant="ghost" onClick={reset}>
                <Trash2 className="size-4" aria-hidden /> Clear
              </Button>
            </div>
          }
        >
          {batch.running && <div className="mb-4"><ProgressBar value={progress} label="Processing images" /></div>}

          {done.length > 0 && (
            <div className="mb-4 grid gap-3 sm:grid-cols-3">
              <Stat label="Original" value={formatBytes(totalOrig)} />
              <Stat label={compress ? 'After compression' : 'Converted'} value={formatBytes(totalNew)} />
              <Stat
                label={totalNew <= totalOrig ? 'Saved' : 'Larger by'}
                value={`${Math.abs(savedPercent(totalOrig, totalNew))}%`}
                sub={`${formatBytes(Math.abs(totalOrig - totalNew))} ${totalNew <= totalOrig ? 'smaller' : 'bigger'}`}
              />
            </div>
          )}

          <ul className="divide-y divide-line">
            {items.map((item) => {
              const r = item.result
              const f = effectiveFormat(item)
              const noGain = compress && r && r.blob.size >= item.upload.size
              return (
                <li key={item.id} className={cn('flex flex-wrap items-center gap-3 py-3 sm:flex-nowrap', picked?.id === item.id && done.length > 0 && 'bg-accent-tint/30 -mx-2 px-2 rounded-lg')}>
                  <button
                    type="button"
                    className="shrink-0 cursor-pointer"
                    onClick={() => setSelected(item.id)}
                    aria-label={`Preview ${item.upload.name}`}
                  >
                    <Thumb blob={r ? r.blob : item.upload.file} alt="" className="size-14 border border-line" />
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium" title={item.upload.name}>
                      {item.upload.name}
                    </p>
                    <p className="tabular text-xs text-muted">
                      {formatBytes(item.upload.size)}
                      {r && (
                        <>
                          {' → '}
                          <span className="font-medium text-ink">{formatBytes(noGain ? item.upload.size : r.blob.size)}</span>
                          {` · ${r.width}×${r.height}`}
                          {item.ms !== undefined && ` · ${formatDuration(item.ms)}`}
                        </>
                      )}
                    </p>
                    {item.status === 'error' && <p className="mt-0.5 flex items-start gap-1 text-xs text-danger"><AlertTriangle className="mt-0.5 size-3 shrink-0" aria-hidden />{item.error}</p>}
                    {noGain && <p className="mt-0.5 text-xs text-warn">Already well optimized. Compressing made it {formatSaving(item.upload.size, r!.blob.size)}, so the original is kept.</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    {item.status === 'processing' && <Badge><Spinner className="size-3" /> Working</Badge>}
                    {item.status === 'queued' && <Badge>Waiting</Badge>}
                    {item.status === 'done' && r && !noGain && (
                      <Badge tone={r.blob.size <= item.upload.size ? 'accent' : 'warn'}>
                        <CheckCircle2 className="size-3" aria-hidden /> {formatSaving(item.upload.size, r.blob.size)}
                      </Badge>
                    )}
                    <Button size="icon-sm" variant="ghost" aria-label={`Download ${item.upload.name} as ${FORMAT_MIME[f]}`} disabled={!r} onClick={() => downloadOne(item)}>
                      <Download className="size-4" aria-hidden />
                    </Button>
                    <Button size="icon-sm" variant="ghost" aria-label={`Remove ${item.upload.name}`} onClick={() => remove(item.id)}>
                      <X className="size-4" aria-hidden />
                    </Button>
                  </div>
                </li>
              )
            })}
          </ul>
          {items.length > 0 && (
            <p className="mt-3 flex items-center gap-1 text-xs text-muted">
              <Plus className="size-3" aria-hidden /> Drop more images above to add them to this batch.
            </p>
          )}
        </Panel>
      )}

      {picked?.result && pickedOrigUrl && (
        <Panel title={`Compare: ${picked.upload.name}`}>
          <BeforeAfter before={pickedOrigUrl} after={picked.result.url} beforeLabel={`Original ${formatBytes(picked.upload.size)}`} afterLabel={`${compress ? 'Compressed' : 'Converted'} ${formatBytes(picked.result.blob.size)}`} checker />
        </Panel>
      )}

      {items.some((i) => i.status === 'error') && !batch.running && (
        <Alert tone="warn" title="Some files could not be processed">
          Remove the failed files or try them in another format. Details are shown next to each file.
        </Alert>
      )}
    </div>
  )
}
