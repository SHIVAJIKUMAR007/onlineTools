import { useId, useState } from 'react'
import { cn } from '@/lib/utils/cn'

/** Drag-to-compare view. The range input makes it keyboard and screen-reader friendly. */
export function BeforeAfter({
  before,
  after,
  beforeLabel = 'Original',
  afterLabel = 'Result',
  checker,
  aspect,
}: {
  before: string
  after: string
  beforeLabel?: string
  afterLabel?: string
  checker?: boolean
  aspect?: number
}) {
  const [pos, setPos] = useState(50)
  const id = useId()
  return (
    <div className="space-y-2">
      <div
        className={cn('relative w-full select-none overflow-hidden rounded-xl border border-line', checker && 'checker')}
        style={aspect ? { aspectRatio: String(aspect) } : undefined}
      >
        {/* The "after" image sets the box size; the "before" image is clipped over it. */}
        <img src={after} alt={afterLabel} className="block max-h-[70vh] w-full object-contain" draggable={false} />
        <img
          src={before}
          alt={beforeLabel}
          className="absolute inset-0 h-full w-full object-contain"
          style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
          draggable={false}
        />
        <div className="pointer-events-none absolute inset-y-0 w-0.5 bg-white shadow-[0_0_0_1px_rgb(0_0_0/0.15)]" style={{ left: `${pos}%` }}>
          <span className="absolute left-1/2 top-1/2 flex size-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-xs text-ink shadow-lift">⇆</span>
        </div>
        <span className="pointer-events-none absolute left-2 top-2 rounded bg-ink/70 px-1.5 py-0.5 text-xs text-white">{beforeLabel}</span>
        <span className="pointer-events-none absolute right-2 top-2 rounded bg-ink/70 px-1.5 py-0.5 text-xs text-white">{afterLabel}</span>
      </div>
      <label htmlFor={id} className="sr-only">
        Comparison position
      </label>
      <input id={id} type="range" min={0} max={100} value={pos} onChange={(e) => setPos(Number(e.target.value))} className="h-2 w-full cursor-ew-resize" />
    </div>
  )
}
