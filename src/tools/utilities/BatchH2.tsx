import { useCallback, useEffect, useRef, useState } from 'react'
import { Redo2, Undo2, Eraser, Brush, Maximize } from 'lucide-react'
import { Panel, CopyButton, DownloadButton } from '@/components/tools/controls'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/misc'
import { Segmented } from '@/components/ui/fields'
import { downloadBlob } from '@/lib/utils/download'
import { cn } from '@/lib/utils/cn'
import {
  BACKGROUND_FILL, TEST_COLORS, addStroke, deviceRows, deviceText, emptyHistory, pressureWidth, readDevice, redoStroke, stepIndex,
  undoStroke, type Background, type DeviceInfo, type Stroke, type StrokeHistory,
} from '@/lib/utilities/batchH'

// ───────────── Drawing board ─────────────
const SWATCHES = ['#111111', '#e5484d', '#f5a524', '#30a46c', '#0091ff', '#8e4ec6', '#ffffff']
const CANVAS_BG: Record<Background, string> = {
  white: '#ffffff',
  dark: '#1f2330',
  transparent: 'repeating-conic-gradient(#d9d9d9 0% 25%, #f5f5f5 0% 50%) 50% / 16px 16px',
}

function paintSegment(ctx: CanvasRenderingContext2D, s: Stroke, a: { x: number; y: number }, b: { x: number; y: number }, width: number) {
  ctx.globalCompositeOperation = s.tool === 'eraser' ? 'destination-out' : 'source-over'
  ctx.strokeStyle = s.color
  ctx.fillStyle = s.color
  ctx.lineWidth = width
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.moveTo(a.x, a.y)
  ctx.lineTo(b.x, b.y)
  ctx.stroke()
}

function paintStroke(ctx: CanvasRenderingContext2D, s: Stroke) {
  const pts = s.points
  if (pts.length === 0) return
  if (pts.length === 1) {
    ctx.globalCompositeOperation = s.tool === 'eraser' ? 'destination-out' : 'source-over'
    ctx.fillStyle = s.color
    ctx.beginPath()
    ctx.arc(pts[0].x, pts[0].y, Math.max(0.5, pressureWidth(s.size, pts[0].p, 'pen') / 2), 0, Math.PI * 2)
    ctx.fill()
    return
  }
  for (let i = 1; i < pts.length; i++) paintSegment(ctx, s, pts[i - 1], pts[i], pressureWidth(s.size, pts[i].p, 'pen'))
}

export function DrawingBoard() {
  const wrap = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const hist = useRef<StrokeHistory>(emptyHistory())
  const live = useRef<Stroke | null>(null)
  const dpr = useRef(1)
  const [, bump] = useState(0)
  const [tool, setTool] = useState<'brush' | 'eraser'>('brush')
  const [color, setColor] = useState('#111111')
  const [size, setSize] = useState(6)
  const [bg, setBg] = useState<Background>('white')
  const [confirmClear, setConfirmClear] = useState(false)

  const redraw = useCallback(() => {
    const c = canvas.current
    const ctx = c?.getContext('2d')
    if (!c || !ctx) return
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, c.width, c.height)
    ctx.setTransform(dpr.current, 0, 0, dpr.current, 0, 0)
    for (const s of hist.current.strokes) paintStroke(ctx, s)
  }, [])

  // Size the canvas to its container and keep the drawing (strokes are stored in CSS pixels).
  useEffect(() => {
    const el = wrap.current
    const c = canvas.current
    if (!el || !c) return
    const fit = () => {
      const w = Math.max(200, Math.floor(el.clientWidth))
      const h = Math.max(280, Math.min(600, Math.round(w * 0.62)))
      dpr.current = Math.max(1, window.devicePixelRatio || 1)
      c.width = Math.round(w * dpr.current)
      c.height = Math.round(h * dpr.current)
      c.style.height = `${h}px`
      redraw()
    }
    fit()
    let ro: ResizeObserver | null = null
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(fit)
      ro.observe(el)
    } else window.addEventListener('resize', fit)
    return () => {
      ro?.disconnect()
      window.removeEventListener('resize', fit)
    }
  }, [redraw])

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const p = e.pointerType === 'pen' ? e.pressure : 0.5
    return { x: e.clientX - r.left, y: e.clientY - r.top, p }
  }

  const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    const c = e.currentTarget
    try {
      c.setPointerCapture(e.pointerId)
    } catch {
      /* not supported */
    }
    const pt = point(e)
    live.current = { tool, color, size: tool === 'eraser' ? size * 2 : size, points: [pt] }
    const ctx = c.getContext('2d')
    if (ctx) {
      ctx.setTransform(dpr.current, 0, 0, dpr.current, 0, 0)
      paintStroke(ctx, live.current)
    }
    setConfirmClear(false)
  }

  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const s = live.current
    const ctx = e.currentTarget.getContext('2d')
    if (!s || !ctx) return
    const events = typeof e.nativeEvent.getCoalescedEvents === 'function' ? e.nativeEvent.getCoalescedEvents() : []
    const r = e.currentTarget.getBoundingClientRect()
    const list = events.length ? events : [e.nativeEvent]
    ctx.setTransform(dpr.current, 0, 0, dpr.current, 0, 0)
    for (const ev of list) {
      const prev = s.points[s.points.length - 1]
      const pt = { x: ev.clientX - r.left, y: ev.clientY - r.top, p: ev.pointerType === 'pen' ? ev.pressure : 0.5 }
      s.points.push(pt)
      paintSegment(ctx, s, prev, pt, pressureWidth(s.size, pt.p, 'pen'))
    }
  }

  const onUp = () => {
    const s = live.current
    live.current = null
    if (!s) return
    hist.current = addStroke(hist.current, s)
    bump((n) => n + 1)
  }

  const undo = () => {
    hist.current = undoStroke(hist.current)
    redraw()
    bump((n) => n + 1)
  }
  const redo = () => {
    hist.current = redoStroke(hist.current)
    redraw()
    bump((n) => n + 1)
  }
  const clear = () => {
    hist.current = emptyHistory()
    redraw()
    setConfirmClear(false)
    bump((n) => n + 1)
  }

  const download = () => {
    const c = canvas.current
    if (!c) return
    const out = document.createElement('canvas')
    out.width = c.width
    out.height = c.height
    const ctx = out.getContext('2d')
    if (!ctx) return
    const fill = BACKGROUND_FILL[bg]
    if (fill) {
      ctx.fillStyle = fill
      ctx.fillRect(0, 0, out.width, out.height)
    }
    ctx.drawImage(c, 0, 0)
    return new Promise<void>((resolve) =>
      out.toBlob((b) => {
        if (b) downloadBlob(b, 'drawing.png')
        resolve()
      }, 'image/png'),
    )
  }

  const h = hist.current
  return (
    <div
      className="space-y-4"
      onKeyDown={(e) => {
        if (!(e.ctrlKey || e.metaKey) || (e.target as HTMLElement).tagName === 'INPUT') return
        const k = e.key.toLowerCase()
        if (k === 'z') {
          e.preventDefault()
          if (e.shiftKey) redo()
          else undo()
        } else if (k === 'y') {
          e.preventDefault()
          redo()
        }
      }}
    >
      <Panel>
        <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
          <Segmented
            label="Tool"
            value={tool}
            onChange={setTool}
            options={[
              { value: 'brush', label: (<span className="inline-flex items-center gap-1.5"><Brush className="size-4" aria-hidden />Brush</span>) },
              { value: 'eraser', label: (<span className="inline-flex items-center gap-1.5"><Eraser className="size-4" aria-hidden />Eraser</span>) },
            ]}
          />
          <div className="flex flex-col gap-1.5">
            <label htmlFor="draw-size" className="text-sm font-medium text-ink-2">Size: {size}px</label>
            <input id="draw-size" type="range" min={1} max={60} value={size} onChange={(e) => setSize(Number(e.target.value))} className="h-2 w-40 cursor-pointer" />
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="draw-color" className="text-sm font-medium text-ink-2">Colour</label>
            <input id="draw-color" type="color" value={color} onChange={(e) => { setColor(e.target.value); setTool('brush') }} className="h-8 w-10 cursor-pointer rounded border border-line-strong bg-paper p-0.5" />
            <div className="flex gap-1" role="group" aria-label="Colour swatches">
              {SWATCHES.map((s) => (
                <button
                  key={s}
                  type="button"
                  aria-label={`Colour ${s}`}
                  aria-pressed={color === s}
                  onClick={() => { setColor(s); setTool('brush') }}
                  className={cn('size-6 cursor-pointer rounded-full border border-line-strong', color === s && 'outline-2 outline-offset-2 outline-accent')}
                  style={{ background: s }}
                />
              ))}
            </div>
          </div>
          <Segmented
            label="Background"
            value={bg}
            onChange={setBg}
            options={[
              { value: 'white', label: 'White' },
              { value: 'dark', label: 'Dark' },
              { value: 'transparent', label: 'Transparent' },
            ]}
          />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="sm" onClick={undo} disabled={h.strokes.length === 0}><Undo2 className="size-4" aria-hidden />Undo</Button>
          <Button size="sm" onClick={redo} disabled={h.redo.length === 0}><Redo2 className="size-4" aria-hidden />Redo</Button>
          {confirmClear ? (
            <span className="inline-flex items-center gap-2 rounded-lg bg-danger-tint px-2 text-sm">
              Clear everything?
              <Button size="sm" variant="danger" onClick={clear}>Clear</Button>
              <Button size="sm" onClick={() => setConfirmClear(false)}>Keep</Button>
            </span>
          ) : (
            <Button size="sm" onClick={() => setConfirmClear(true)} disabled={h.strokes.length === 0}>Clear</Button>
          )}
          <DownloadButton size="sm" className="ml-auto" onClick={download}>Download PNG</DownloadButton>
        </div>
      </Panel>
      <div ref={wrap} className="w-full overflow-hidden rounded-2xl border border-line shadow-soft">
        <canvas
          ref={canvas}
          role="img"
          aria-label="Drawing area. Draw with a mouse, finger or pen."
          className="block w-full cursor-crosshair"
          style={{ touchAction: 'none', background: CANVAS_BG[bg] }}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
        />
      </div>
      <p className="text-xs text-muted">Your drawing is kept in memory only. It is lost if you reload or close the tab, so download it first. Undo covers your last 1500 strokes.</p>
    </div>
  )
}

// ───────────── Dead pixel test ─────────────
export function DeadPixelTest() {
  const overlay = useRef<HTMLDivElement>(null)
  const starter = useRef<HTMLButtonElement>(null)
  const [active, setActive] = useState(false)
  const [index, setIndex] = useState(0)
  const [hint, setHint] = useState(true)
  const [fsFailed, setFsFailed] = useState(false)
  const hintTimer = useRef<number | null>(null)

  const showHint = useCallback(() => {
    setHint(true)
    if (hintTimer.current !== null) window.clearTimeout(hintTimer.current)
    hintTimer.current = window.setTimeout(() => setHint(false), 2800)
  }, [])

  const next = useCallback((dir: -1 | 1) => {
    setIndex((i) => stepIndex(i, dir, TEST_COLORS.length))
    showHint()
  }, [showHint])

  const exit = useCallback(() => {
    setActive(false)
    try {
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined)
    } catch {
      /* ignore */
    }
  }, [])

  const start = () => {
    setIndex(0)
    setFsFailed(false)
    setActive(true)
    showHint()
  }

  // Once the overlay is mounted: focus it and ask for fullscreen (falls back to the in-page overlay).
  useEffect(() => {
    if (!active) return
    const el = overlay.current
    el?.focus()
    try {
      if (el && typeof el.requestFullscreen === 'function') el.requestFullscreen().catch(() => setFsFailed(true))
      else setFsFailed(true)
    } catch {
      setFsFailed(true)
    }
  }, [active])

  useEffect(() => {
    if (!active) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        exit()
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ' || e.key === 'Enter') {
        // Let the focused exit button handle its own Enter and Space.
        if ((e.key === ' ' || e.key === 'Enter') && (e.target as HTMLElement).tagName === 'BUTTON') return
        e.preventDefault()
        next(1)
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault()
        next(-1)
      }
    }
    const onFs = () => {
      // The browser left fullscreen (for example with Esc). Leave the test too.
      if (!document.fullscreenElement && overlay.current && fsStarted.current) exit()
    }
    const fsStarted = { current: false }
    const onFsEnter = () => {
      if (document.fullscreenElement) fsStarted.current = true
      onFs()
    }
    window.addEventListener('keydown', onKey)
    document.addEventListener('fullscreenchange', onFsEnter)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.removeEventListener('fullscreenchange', onFsEnter)
    }
  }, [active, exit, next])

  // Restore focus to the start button after leaving.
  const wasActive = useRef(false)
  useEffect(() => {
    if (wasActive.current && !active) starter.current?.focus()
    wasActive.current = active
  }, [active])

  useEffect(
    () => () => {
      if (hintTimer.current !== null) window.clearTimeout(hintTimer.current)
      try {
        if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined)
      } catch {
        /* ignore */
      }
    },
    [],
  )

  const c = TEST_COLORS[index]
  return (
    <div className="space-y-4">
      <Panel title="Start the test">
        <p className="mb-4 text-sm text-ink-2">
          The screen will fill with solid colours, one at a time. Look closely at each one for dots that stay dark, bright or a different colour. Use a click, Space or the arrow keys to move on, and Esc to leave.
        </p>
        <Button ref={starter} variant="primary" size="lg" onClick={start}>
          <Maximize className="size-5" aria-hidden /> Start full screen test
        </Button>
      </Panel>
      <Alert tone="info" title="What this can and cannot show">
        Solid colours make stuck or dead pixels easy to spot: a pixel that stays black on white or stays lit on black. Backlight bleed and uneven brightness show best on the black screen in a dark room. What you see depends on the browser, the zoom level and any display scaling, so check at 100% zoom if you can.
      </Alert>
      {active && (
        <div
          ref={overlay}
          role="dialog"
          aria-modal="true"
          aria-label={`Dead pixel test, ${c.name}`}
          tabIndex={-1}
          onClick={() => next(1)}
          onMouseMove={showHint}
          className="fixed inset-0 z-[100] cursor-pointer outline-none"
          style={{ background: c.css }}
        >
          <div className={cn('pointer-events-none absolute inset-x-0 top-6 flex justify-center transition-opacity duration-500', hint ? 'opacity-100' : 'opacity-0')} aria-live="polite">
            <div className="rounded-xl bg-black/75 px-4 py-2 text-center text-sm text-white">
              {c.name} ({index + 1} of {TEST_COLORS.length}). Click, Space or arrow keys to change. Esc to exit.
              {fsFailed ? ' Full screen is not available here, so this fills the page instead.' : ''}
            </div>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              exit()
            }}
            className={cn('absolute right-4 top-4 cursor-pointer rounded-lg bg-black/75 px-4 py-2 text-sm font-medium text-white transition-opacity focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-white', hint ? 'opacity-100' : 'opacity-0 hover:opacity-100')}
          >
            Exit
          </button>
        </div>
      )}
    </div>
  )
}

// ───────────── Screen resolution checker ─────────────
export function ScreenResolutionChecker() {
  const [info, setInfo] = useState<DeviceInfo | null>(null)

  useEffect(() => {
    const read = () => setInfo(readDevice(window as unknown as Parameters<typeof readDevice>[0]))
    read()
    window.addEventListener('resize', read)
    window.addEventListener('orientationchange', read)
    window.addEventListener('online', read)
    window.addEventListener('offline', read)
    const mqs: MediaQueryList[] = []
    try {
      for (const q of ['(prefers-color-scheme: dark)', '(prefers-reduced-motion: reduce)', '(prefers-contrast: more)']) {
        const m = window.matchMedia(q)
        m.addEventListener?.('change', read)
        mqs.push(m)
      }
    } catch {
      /* ignore */
    }
    return () => {
      window.removeEventListener('resize', read)
      window.removeEventListener('orientationchange', read)
      window.removeEventListener('online', read)
      window.removeEventListener('offline', read)
      mqs.forEach((m) => m.removeEventListener?.('change', read))
    }
  }, [])

  const rows = info ? deviceRows(info) : []
  return (
    <div className="space-y-4">
      {info && (
        <div className="rounded-2xl bg-accent-tint px-5 py-4 text-center" aria-live="polite">
          <p className="text-xs text-accent">Your screen</p>
          <p className="tabular text-3xl font-semibold text-accent sm:text-4xl">{info.screenWidth} x {info.screenHeight}</p>
          <p className="text-sm text-ink-2">Viewport {info.viewportWidth} x {info.viewportHeight}, pixel ratio {info.pixelRatio}</p>
        </div>
      )}
      <Panel title="Device and browser details" actions={<CopyButton text={() => (info ? deviceText(info) : '')} label="Copy all" disabled={!info} />}>
        {info ? (
          <dl className="divide-y divide-line">
            {rows.map((r) => (
              <div key={r.label} className="grid gap-1 py-2 text-sm sm:grid-cols-[14rem_1fr] sm:gap-4">
                <dt className="text-muted">{r.label}</dt>
                <dd className="tabular break-words font-medium">{r.value}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="text-sm text-muted">Reading your device details...</p>
        )}
      </Panel>
      <Alert tone="info" title="Where these values come from">
        Everything here is read from your browser and shown on this page only. Nothing is sent anywhere. Browsers can round values, such as device memory, or report different ones when privacy settings, extensions or zoom are in use, so treat them as what the browser tells websites.
      </Alert>
    </div>
  )
}
