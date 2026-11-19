import { ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

export function PrivacyNotice({ className, children }: { className?: string; children?: string }) {
  return (
    <p className={cn('flex items-start gap-2 text-sm text-ink-2', className)}>
      <ShieldCheck className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
      <span>{children ?? 'Your files never leave your device. All processing happens locally in your browser.'}</span>
    </p>
  )
}
