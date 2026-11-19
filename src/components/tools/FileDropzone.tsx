import { useId, useRef, useState, type DragEvent, type ReactNode } from 'react'
import { FileUp } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import type { RejectedFile } from '@/hooks/useFileUpload'
import { Alert, Spinner } from '@/components/ui/misc'

interface Props {
  accept: string[]
  multiple?: boolean
  onFiles: (files: File[]) => void
  rejected?: RejectedFile[]
  loading?: boolean
  title?: string
  hint?: ReactNode
  compact?: boolean
  className?: string
}

const prettyAccept = (accept: string[]) => {
  const exts = accept.filter((a) => a.startsWith('.')).map((a) => a.slice(1).toUpperCase())
  const uniq = exts.filter((v, i) => exts.indexOf(v) === i && v !== 'JPEG')
  return uniq.length ? uniq.join(', ') : 'Any file'
}

export function FileDropzone({ accept, multiple, onFiles, rejected = [], loading, title, hint, compact, className }: Props) {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)
  const depth = useRef(0)

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    depth.current = 0
    setOver(false)
    const files = Array.from(e.dataTransfer.files)
    if (files.length) onFiles(files)
  }

  return (
    <div className={className}>
      <label
        htmlFor={inputId}
        onDragEnter={(e) => {
          e.preventDefault()
          depth.current++
          setOver(true)
        }}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={() => {
          depth.current = Math.max(0, depth.current - 1)
          if (depth.current === 0) setOver(false)
        }}
        onDrop={onDrop}
        className={cn(
          'group flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed text-center transition-colors',
          compact ? 'px-4 py-6' : 'px-6 py-12 sm:py-16',
          over ? 'border-accent bg-accent-tint' : 'border-line-strong bg-surface/60 hover:border-accent/60 hover:bg-accent-tint/50',
          'focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent',
        )}
      >
        <span className={cn('flex size-12 items-center justify-center rounded-full bg-paper text-accent shadow-soft transition-transform', over && 'scale-110')}>
          {loading ? <Spinner className="size-5" /> : <FileUp className="size-5" aria-hidden />}
        </span>
        <span className="text-base font-medium text-ink">{title ?? (multiple ? 'Drop files here or click to browse' : 'Drop a file here or click to browse')}</span>
        <span className="max-w-md text-sm text-muted">
          {hint ?? (
            <>
              {prettyAccept(accept)}
              {multiple ? ' · several files at once' : ''} · stays on your device
            </>
          )}
        </span>
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          className="sr-only"
          multiple={multiple}
          accept={accept.includes('*/*') ? undefined : accept.join(',')}
          onChange={(e) => {
            if (e.target.files?.length) onFiles(Array.from(e.target.files))
            // Allow choosing the same file again.
            e.target.value = ''
          }}
        />
      </label>
      {rejected.length > 0 && (
        <Alert tone="danger" className="mt-3" title={rejected.length === 1 ? 'A file was skipped' : `${rejected.length} files were skipped`}>
          <ul className="list-disc pl-4">
            {rejected.slice(0, 5).map((r, i) => (
              <li key={i}>
                <span className="font-medium break-all">{r.name}</span>: {r.reason}
              </li>
            ))}
            {rejected.length > 5 && <li>and {rejected.length - 5} more</li>}
          </ul>
        </Alert>
      )}
    </div>
  )
}
