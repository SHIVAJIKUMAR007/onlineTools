import { memo, useEffect, useRef, useState, type ReactNode } from 'react'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { cn } from '@/lib/utils/cn'

/** Serialize renders so a 200-page PDF does not start 200 canvases at once. */
let chain: Promise<unknown> = Promise.resolve()
const enqueue = <T,>(fn: () => Promise<T>): Promise<T> => {
  const next = chain.then(fn, fn)
  chain = next.catch(() => undefined)
  return next
}

interface ThumbProps {
  doc: PDFDocumentProxy
  page: number
  /** Extra clockwise rotation in degrees, applied with CSS. */
  rotation?: number
  selected?: boolean
  marked?: boolean
  onClick?: () => void
  label: string
  overlay?: ReactNode
  footer?: ReactNode
}

export const PdfThumb = memo(function PdfThumb({ doc, page, rotation = 0, selected, marked, onClick, label, overlay, footer }: ThumbProps) {
  const ref = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [visible, setVisible] = useState(false)
  const [state, setState] = useState<'idle' | 'ready' | 'error'>('idle')
  const [aspect, setAspect] = useState(0.707)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true)
          io.disconnect()
        }
      },
      { rootMargin: '300px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    if (!visible) return
    let cancelled = false
    void enqueue(async () => {
      if (cancelled) return
      try {
        const { renderPageToCanvas } = await import('@/lib/pdf/render')
        const r = await renderPageToCanvas(doc, page, 0.45)
        if (cancelled || !canvasRef.current) return
        const target = canvasRef.current
        target.width = r.width
        target.height = r.height
        target.getContext('2d')!.drawImage(r.canvas, 0, 0)
        setAspect(r.width / r.height)
        setState('ready')
      } catch {
        if (!cancelled) setState('error')
      }
    })
    return () => {
      cancelled = true
    }
  }, [visible, doc, page])

  const turned = rotation % 180 !== 0
  return (
    <div ref={ref} className="flex flex-col items-center gap-1.5">
      <button
        type="button"
        onClick={onClick}
        disabled={!onClick}
        aria-pressed={onClick ? !!selected : undefined}
        aria-label={label}
        className={cn(
          'relative flex w-full items-center justify-center overflow-hidden rounded-lg border-2 bg-surface p-1.5 transition-colors disabled:cursor-default',
          onClick && 'cursor-pointer hover:border-accent/60',
          selected ? 'border-accent bg-accent-tint' : 'border-line',
          marked && 'border-danger bg-danger-tint',
        )}
        style={{ aspectRatio: turned ? String(1 / aspect) : String(aspect) }}
      >
        <canvas
          ref={canvasRef}
          className={cn('max-h-full max-w-full bg-white shadow-sm transition-transform duration-200', state !== 'ready' && 'opacity-0', marked && 'opacity-40')}
          style={{ transform: `rotate(${rotation}deg)` }}
        />
        {state === 'idle' && <span className="absolute text-xs text-muted">Loading…</span>}
        {state === 'error' && <span className="absolute text-xs text-danger">Preview failed</span>}
        {overlay}
      </button>
      {footer}
    </div>
  )
})
