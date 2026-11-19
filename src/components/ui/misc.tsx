import type { HTMLAttributes, ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, Info, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

export function Card({ className, ...p }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-[14px] border border-line bg-paper shadow-soft', className)} {...p} />
}

export function Badge({ className, tone = 'neutral', ...p }: HTMLAttributes<HTMLSpanElement> & { tone?: 'neutral' | 'accent' | 'warn' | 'danger' }) {
  const tones = {
    neutral: 'bg-surface-2 text-ink-2',
    accent: 'bg-accent-tint text-accent',
    warn: 'bg-warn-tint text-warn',
    danger: 'bg-danger-tint text-danger',
  }
  return <span className={cn('inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium', tones[tone], className)} {...p} />
}

export function Alert({
  tone = 'info',
  title,
  children,
  className,
  role,
}: {
  tone?: 'info' | 'warn' | 'danger' | 'success'
  title?: string
  children?: ReactNode
  className?: string
  role?: 'alert' | 'status'
}) {
  const map = {
    info: { cls: 'border-line bg-surface text-ink-2', Icon: Info, icon: 'text-muted' },
    warn: { cls: 'border-[#ecd48f] bg-warn-tint text-[#5c3d00]', Icon: AlertTriangle, icon: 'text-warn' },
    danger: { cls: 'border-[#f0b8b2] bg-danger-tint text-[#7a1a12]', Icon: AlertTriangle, icon: 'text-danger' },
    success: { cls: 'border-accent-line bg-accent-tint text-[#064c3a]', Icon: CheckCircle2, icon: 'text-accent' },
  }[tone]
  return (
    <div role={role ?? (tone === 'danger' ? 'alert' : 'status')} className={cn('flex gap-3 rounded-xl border px-4 py-3 text-sm', map.cls, className)}>
      <map.Icon className={cn('mt-0.5 size-4 shrink-0', map.icon)} aria-hidden />
      <div className="min-w-0">
        {title ? <p className="font-medium">{title}</p> : null}
        {children ? <div className={cn('leading-relaxed', title && 'mt-0.5')}>{children}</div> : null}
      </div>
    </div>
  )
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 aria-hidden className={cn('size-4 animate-spin', className)} />
}

/** A real progress bar. Pass `value` (0..1) for determinate; omit it for an honest "working" state. */
export function ProgressBar({ value, label }: { value?: number; label: string }) {
  const determinate = typeof value === 'number'
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={determinate ? Math.round(value * 100) : undefined}
      className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2"
    >
      <div
        className={cn('h-full rounded-full bg-accent transition-[width] duration-200', !determinate && 'progress-indeterminate w-full')}
        style={determinate ? { width: `${Math.max(2, Math.round(value * 100))}%` } : undefined}
      />
    </div>
  )
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="rounded-xl bg-surface px-4 py-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="tabular mt-0.5 text-lg font-semibold tracking-tight">{value}</p>
      {sub ? <p className="tabular text-xs text-muted">{sub}</p> : null}
    </div>
  )
}
