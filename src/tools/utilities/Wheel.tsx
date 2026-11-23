import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/misc'
import { Switch, Textarea } from '@/components/ui/fields'
import { Panel } from '@/components/tools/controls'
import { parseOptions, randomBelow, randomUnit, targetRotation } from '@/lib/utilities/random'
import { reducedMotion } from './shared'

const COLORS = ['#0f9d78', '#f0a020', '#3b82c4', '#d9534f', '#8a5cc2', '#2fb5b0', '#e0719b', '#6b8e23']
const MAX_OPTIONS = 100
const SPIN_MS = 4500
const SIZE = 320
const R = 150
const C = SIZE / 2

const pt = (angleDeg: number, r: number) => {
  const a = (angleDeg * Math.PI) / 180
  return [C + r * Math.sin(a), C - r * Math.cos(a)] as const
}

function segmentPath(i: number, n: number) {
  if (n === 1) return `M ${C} ${C - R} A ${R} ${R} 0 1 1 ${C - 0.01} ${C - R} Z`
  const seg = 360 / n
  const [x1, y1] = pt(i * seg, R)
  const [x2, y2] = pt((i + 1) * seg, R)
  return `M ${C} ${C} L ${x1} ${y1} A ${R} ${R} 0 ${seg > 180 ? 1 : 0} 1 ${x2} ${y2} Z`
}

const easeOut = (t: number) => 1 - Math.pow(1 - t, 4)

export function PickerWheel() {
  const [text, setText] = useState('Alice\nBob\nCara\nDev\nEli')
  const [removeWinner, setRemoveWinner] = useState(false)
  const [spinning, setSpinning] = useState(false)
  const [winner, setWinner] = useState<string | null>(null)
  const [history, setHistory] = useState<string[]>([])
  const options = useMemo(() => parseOptions(text).slice(0, MAX_OPTIONS), [text])
  const tooMany = parseOptions(text).length > MAX_OPTIONS
  const rotation = useRef(0)
  const group = useRef<SVGGElement | null>(null)
  const raf = useRef<number | null>(null)

  const apply = (deg: number) => {
    rotation.current = deg
    if (group.current) group.current.style.transform = `rotate(${deg}deg)`
  }

  useEffect(
    () => () => {
      if (raf.current !== null) cancelAnimationFrame(raf.current)
    },
    [],
  )

  const finish = (index: number) => {
    const name = options[index]
    setWinner(name)
    setHistory((h) => [name, ...h].slice(0, 30))
    setSpinning(false)
    if (removeWinner) {
      const rest = options.filter((_, i) => i !== index)
      setText(rest.join('\n'))
      apply(0)
    }
  }

  const spin = () => {
    if (spinning || options.length < 2) return
    // The winner is chosen first, with crypto randomness. The animation only reveals it.
    const index = randomBelow(options.length)
    const from = rotation.current
    const to = targetRotation(from, index, options.length, 5, (randomUnit() - 0.5) * 0.7)
    setWinner(null)
    if (reducedMotion()) {
      apply(to)
      finish(index)
      return
    }
    setSpinning(true)
    const t0 = performance.now()
    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / SPIN_MS)
      apply(from + (to - from) * easeOut(p))
      if (p < 1) raf.current = requestAnimationFrame(step)
      else {
        raf.current = null
        finish(index)
      }
    }
    raf.current = requestAnimationFrame(step)
  }

  const n = options.length
  const fontSize = n > 40 ? 6 : n > 24 ? 8 : n > 12 ? 10 : 13

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
      <Panel>
        <div className="mx-auto w-full max-w-[22rem]">
          <div className="relative">
            <svg viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label={n ? `Wheel with ${n} options` : 'Empty wheel'} className="block w-full">
              <g ref={group} style={{ transformOrigin: `${C}px ${C}px`, transformBox: 'view-box' }}>
                {n === 0 ? (
                  <circle cx={C} cy={C} r={R} fill="#e5e7eb" />
                ) : (
                  options.map((o, i) => {
                    const mid = (i + 0.5) * (360 / n)
                    return (
                      <g key={i}>
                        <path d={segmentPath(i, n)} fill={COLORS[i % COLORS.length]} stroke="#fff" strokeWidth={n > 40 ? 0.5 : 1.5} />
                        {n > 1 && (
                          <text transform={`rotate(${mid - 90} ${C} ${C})`} x={C + R - 10} y={C} textAnchor="end" dominantBaseline="middle" fill="#fff" fontSize={fontSize} fontWeight={600}>
                            {o.length > 16 ? `${o.slice(0, 15)}…` : o}
                          </text>
                        )}
                      </g>
                    )
                  })
                )}
              </g>
              <circle cx={C} cy={C} r={14} fill="#fff" stroke="#d1d5db" />
              <polygon points={`${C - 10},4 ${C + 10},4 ${C},28`} fill="#111827" stroke="#fff" strokeWidth={2} />
            </svg>
          </div>
          <div className="mt-4 flex justify-center">
            <Button variant="primary" size="lg" onClick={spin} disabled={spinning || n < 2}>{spinning ? 'Spinning...' : 'Spin'}</Button>
          </div>
        </div>
        <div className="mt-4 text-center" aria-live="polite">
          {winner ? <p className="text-2xl font-semibold">Winner: {winner}</p> : <p className="text-sm text-muted">{n < 2 ? 'Add at least two options.' : 'Press Spin to pick one.'}</p>}
        </div>
      </Panel>
      <div className="space-y-5">
        <Panel title={`Options (${n})`}>
          <label htmlFor="wheel-options" className="sr-only">Options, one per line</label>
          <Textarea id="wheel-options" rows={8} value={text} disabled={spinning} onChange={(e) => setText(e.target.value)} placeholder="One option per line" />
          <div className="mt-3"><Switch checked={removeWinner} onChange={setRemoveWinner} label="Remove winner after each spin" /></div>
          {tooMany && <Alert tone="warn" className="mt-3">Only the first {MAX_OPTIONS} options are used.</Alert>}
        </Panel>
        <Panel title="History" actions={<Button size="sm" variant="ghost" onClick={() => setHistory([])} disabled={!history.length}>Clear</Button>}>
          {history.length ? (
            <ol className="max-h-48 list-decimal space-y-1 overflow-auto pl-5 text-sm">
              {history.map((h, i) => <li key={i}>{h}</li>)}
            </ol>
          ) : (
            <p className="text-sm text-muted">Winners appear here.</p>
          )}
        </Panel>
      </div>
    </div>
  )
}
