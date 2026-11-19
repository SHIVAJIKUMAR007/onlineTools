import { useId, useState, type ReactNode } from 'react'
import { Check, Copy, Download } from 'lucide-react'
import { Button, type ButtonProps } from '@/components/ui/button'
import { cn } from '@/lib/utils/cn'
import { copyText } from '@/lib/utils/download'

export function QualitySlider({
  value,
  onChange,
  label = 'Quality',
  min = 1,
  max = 100,
  disabled,
  hint,
}: {
  value: number
  onChange: (v: number) => void
  label?: string
  min?: number
  max?: number
  disabled?: boolean
  hint?: ReactNode
}) {
  const id = useId()
  return (
    <div className={cn('flex flex-col gap-1.5', disabled && 'opacity-50')}>
      <div className="flex items-baseline justify-between">
        <label htmlFor={id} className="text-sm font-medium text-ink-2">
          {label}
        </label>
        <output htmlFor={id} className="tabular text-sm font-semibold">
          {value}%
        </output>
      </div>
      <input id={id} type="range" min={min} max={max} value={value} disabled={disabled} onChange={(e) => onChange(Number(e.target.value))} className="h-2 w-full cursor-pointer" />
      {hint ? <p className="text-xs text-muted">{hint}</p> : null}
    </div>
  )
}

export function DownloadButton({
  onClick,
  children = 'Download',
  disabled,
  variant = 'primary',
  size,
  className,
}: { onClick: () => void | Promise<void>; children?: ReactNode } & Pick<ButtonProps, 'disabled' | 'variant' | 'size' | 'className'>) {
  const [busy, setBusy] = useState(false)
  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      disabled={disabled || busy}
      onClick={async () => {
        setBusy(true)
        try {
          await onClick()
        } finally {
          setBusy(false)
        }
      }}
    >
      <Download className="size-4" aria-hidden />
      {children}
    </Button>
  )
}

export function CopyButton({ text, label = 'Copy', size = 'sm', variant = 'secondary', disabled }: { text: string | (() => string); label?: string } & Pick<ButtonProps, 'size' | 'variant' | 'disabled'>) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle')
  return (
    <Button
      size={size}
      variant={variant}
      disabled={disabled}
      onClick={async () => {
        const ok = await copyText(typeof text === 'function' ? text() : text)
        setState(ok ? 'copied' : 'failed')
        setTimeout(() => setState('idle'), 1600)
      }}
    >
      {state === 'copied' ? <Check className="size-4 text-accent" aria-hidden /> : <Copy className="size-4" aria-hidden />}
      <span aria-live="polite">{state === 'copied' ? 'Copied' : state === 'failed' ? 'Copy failed' : label}</span>
    </Button>
  )
}

export function Panel({ title, actions, children, className }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn('rounded-2xl border border-line bg-paper p-4 shadow-soft sm:p-5', className)}>
      {(title || actions) && (
        <header className="mb-4 flex flex-wrap items-center justify-between gap-2">
          {title ? <h2 className="text-base font-semibold">{title}</h2> : <span />}
          {actions}
        </header>
      )}
      {children}
    </section>
  )
}

export function OptionRow({ children }: { children: ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
}
