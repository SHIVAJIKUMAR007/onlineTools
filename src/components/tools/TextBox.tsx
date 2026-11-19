import { useId, type ReactNode } from 'react'
import { ClipboardPaste, Eraser } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/fields'
import { CopyButton } from './controls'
import { cn } from '@/lib/utils/cn'

export function TextBox({
  label,
  value,
  onChange,
  readOnly,
  placeholder,
  rows = 10,
  copy,
  paste,
  clear,
  extra,
  className,
  error,
  hint,
}: {
  label: string
  value: string
  onChange?: (v: string) => void
  readOnly?: boolean
  placeholder?: string
  rows?: number
  copy?: boolean
  paste?: boolean
  clear?: boolean
  extra?: ReactNode
  className?: string
  error?: boolean
  hint?: ReactNode
}) {
  const id = useId()
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="flex min-h-8 flex-wrap items-center justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium text-ink-2">
          {label}
        </label>
        <div className="flex items-center gap-1.5">
          {extra}
          {paste && !readOnly && (
            <Button
              size="sm"
              variant="ghost"
              onClick={async () => {
                try {
                  onChange?.(await navigator.clipboard.readText())
                } catch {
                  /* Clipboard read can be blocked. The user can paste with Ctrl+V. */
                }
              }}
            >
              <ClipboardPaste className="size-4" aria-hidden /> Paste
            </Button>
          )}
          {clear && !readOnly && (
            <Button size="sm" variant="ghost" disabled={!value} onClick={() => onChange?.('')}>
              <Eraser className="size-4" aria-hidden /> Clear
            </Button>
          )}
          {copy && <CopyButton text={value} disabled={!value} />}
        </div>
      </div>
      <Textarea
        id={id}
        value={value}
        rows={rows}
        readOnly={readOnly}
        placeholder={placeholder}
        aria-invalid={error || undefined}
        onChange={(e) => onChange?.(e.target.value)}
        className={cn(error && 'border-danger focus-visible:border-danger', readOnly && 'bg-surface')}
      />
      {hint ? <p className="text-xs text-muted">{hint}</p> : null}
    </div>
  )
}
