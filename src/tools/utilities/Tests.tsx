import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Panel, CopyButton } from '@/components/tools/controls'
import { Button } from '@/components/ui/button'
import { Badge, Stat } from '@/components/ui/misc'
import { Segmented, Switch } from '@/components/ui/fields'
import { cn } from '@/lib/utils/cn'
import { average, CPS_MODES, cps, cpsRating, displayKey, formatCps, keyInfo, keyInfoText, reactionDelay, reactionRating, type KeyInfo } from '@/lib/utilities/input'
import { randomUnit } from '@/lib/utilities/random'

const isActivateKey = (e: KeyboardEvent) => (e.key === ' ' || e.key === 'Enter') && !e.repeat

// ───────────── Reaction time ─────────────
type RState = 'idle' | 'waiting' | 'go' | 'early' | 'result'
const ATTEMPTS = 5

export function ReactionTimeTest() {
  const [state, setState] = useState<RState>('idle')
  const [times, setTimes] = useState<number[]>([])
  const [last, setLast] = useState(0)
  const timeout = useRef<number | null>(null)
  const goAt = useRef(0)

  useEffect(
    () => () => {
      if (timeout.current !== null) window.clearTimeout(timeout.current)
    },
    [],
  )

  const begin = () => {
    setState('waiting')
    timeout.current = window.setTimeout(() => {
      goAt.current = performance.now()
      setState('go')
    }, reactionDelay(randomUnit()))
  }

  const press = () => {
    const finished = times.length >= ATTEMPTS
    if (state === 'idle' || state === 'early') begin()
    else if (state === 'waiting') {
      if (timeout.current !== null) window.clearTimeout(timeout.current)
      timeout.current = null
      setState('early')
    } else if (state === 'go') {
      const ms = Math.round(performance.now() - goAt.current)
      setLast(ms)
      setTimes((t) => [...t, ms])
      setState('result')
    } else if (state === 'result') {
      if (finished) {
        setTimes([])
        setState('idle')
      } else begin()
    }
  }

  const finished = times.length >= ATTEMPTS
  const avg = Math.round(average(times))
  const best = times.length ? Math.min(...times) : 0
  const look: Record<RState, { cls: string; title: string; sub: string }> = {
    idle: { cls: 'bg-accent-tint text-accent', title: 'Click to start', sub: `${ATTEMPTS} attempts. Click as soon as the box turns green.` },
    waiting: { cls: 'bg-danger text-white', title: 'Wait for green...', sub: 'Do not click yet.' },
    go: { cls: 'bg-[#16a34a] text-white', title: 'Click now!', sub: '' },
    early: { cls: 'bg-warn-tint text-warn', title: 'Too soon', sub: 'Click to try again. This attempt did not count.' },
    result: { cls: 'bg-surface-2 text-ink', title: `${last} ms`, sub: finished ? 'Done. Click to start over.' : `Attempt ${times.length} of ${ATTEMPTS}. Click to continue.` },
  }
  const v = look[state]

  return (
    <div className="space-y-5">
      <button
        type="button"
        aria-label={`Reaction area. ${v.title}`}
        onPointerDown={(e) => {
          if (e.button === 0) press()
        }}
        onKeyDown={(e) => {
          if (isActivateKey(e)) {
            e.preventDefault()
            press()
          }
        }}
        className={cn('flex min-h-64 w-full cursor-pointer select-none touch-manipulation flex-col items-center justify-center gap-2 rounded-2xl p-6 text-center transition-colors', v.cls)}
      >
        <span className="tabular text-4xl font-semibold sm:text-5xl">{v.title}</span>
        {v.sub && <span className="text-sm">{v.sub}</span>}
      </button>
      <div aria-live="polite" className="sr-only">{state === 'result' ? `${last} milliseconds` : state === 'go' ? 'Click now' : state === 'early' ? 'Too soon' : ''}</div>
      <Panel title="Your attempts" actions={times.length > 0 && <Button size="sm" variant="ghost" onClick={() => { setTimes([]); setState('idle') }}>Clear</Button>}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Stat label="Average" value={times.length ? `${avg} ms` : '-'} />
          <Stat label="Best" value={times.length ? `${best} ms` : '-'} />
          <Stat label="Attempts" value={`${times.length} / ${ATTEMPTS}`} />
        </div>
        {times.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-2">
            {times.map((t, i) => <li key={i}><Badge>{t} ms</Badge></li>)}
          </ul>
        )}
        {finished && <p className="mt-3 text-sm text-ink-2">{reactionRating(avg)}</p>}
      </Panel>
    </div>
  )
}

// ───────────── Click speed ─────────────
type CState = 'idle' | 'running' | 'done'

export function ClickSpeedTest() {
  const [seconds, setSeconds] = useState<number>(10)
  const [state, setState] = useState<CState>('idle')
  const [clicks, setClicks] = useState(0)
  const [left, setLeft] = useState(10_000)
  const [best, setBest] = useState<Record<number, number>>({})
  const [result, setResult] = useState<number | null>(null)
  const count = useRef(0)
  const timer = useRef<number | null>(null)
  const startAt = useRef(0)

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearInterval(timer.current)
    },
    [],
  )

  const finish = (mode: number) => {
    if (timer.current !== null) window.clearInterval(timer.current)
    timer.current = null
    const total = count.current
    const rate = cps(total, mode)
    setClicks(total)
    setLeft(0)
    setResult(rate)
    setBest((b) => (rate > (b[mode] ?? 0) ? { ...b, [mode]: rate } : b))
    setState('done')
  }

  const click = () => {
    if (state === 'done') return
    if (state === 'idle') {
      count.current = 0
      startAt.current = performance.now()
      setState('running')
      setResult(null)
      const mode = seconds
      timer.current = window.setInterval(() => {
        const rem = mode * 1000 - (performance.now() - startAt.current)
        if (rem <= 0) finish(mode)
        else setLeft(rem)
      }, 50)
    }
    if (performance.now() - startAt.current > seconds * 1000) return
    count.current += 1
    setClicks(count.current)
  }

  const reset = (mode = seconds) => {
    if (timer.current !== null) window.clearInterval(timer.current)
    timer.current = null
    count.current = 0
    setClicks(0)
    setLeft(mode * 1000)
    setResult(null)
    setState('idle')
  }

  const rate = state === 'running' ? cps(clicks, Math.max(0.1, seconds - left / 1000)) : result ?? 0

  return (
    <div className="space-y-5">
      <Panel title="Test length" actions={<Segmented label="Test length" value={seconds} onChange={(s) => { setSeconds(s); reset(s) }} options={CPS_MODES.map((s) => ({ value: s, label: `${s} s` }))} />}>
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Clicks" value={clicks} />
          <Stat label="Time left" value={`${(state === 'idle' ? seconds : left / 1000).toFixed(1)} s`} />
          <Stat label="CPS" value={formatCps(rate)} />
        </div>
      </Panel>
      <button
        type="button"
        aria-label="Click area. Click or tap here as fast as you can."
        disabled={state === 'done'}
        onPointerDown={(e) => {
          if (e.button === 0) click()
        }}
        onKeyDown={(e) => {
          if (isActivateKey(e)) {
            e.preventDefault()
            click()
          }
        }}
        className={cn('flex min-h-64 w-full cursor-pointer select-none touch-manipulation flex-col items-center justify-center gap-2 rounded-2xl p-6 text-center transition-colors', state === 'running' ? 'bg-accent text-white' : 'bg-accent-tint text-accent')}
      >
        <span className="text-3xl font-semibold">{state === 'idle' ? 'Click here to start' : state === 'running' ? 'Keep clicking!' : "Time's up"}</span>
        <span className="text-sm">{state === 'idle' ? `The ${seconds} second timer starts on your first click.` : state === 'running' ? `${clicks} clicks` : ''}</span>
      </button>
      <div aria-live="polite">
        {state === 'done' && result !== null && (
          <Panel title="Result" actions={<Button variant="primary" size="sm" onClick={() => reset()}>Try again</Button>}>
            <p className="tabular text-3xl font-semibold">{formatCps(result)} CPS</p>
            <p className="mt-1 text-sm text-ink-2">{clicks} clicks in {seconds} seconds. {cpsRating(result)}.</p>
          </Panel>
        )}
      </div>
      {Object.keys(best).length > 0 && (
        <p className="text-sm text-muted">
          Best this session:{' '}
          {CPS_MODES.filter((m) => best[m] !== undefined).map((m) => `${m} s: ${formatCps(best[m])} CPS`).join(' · ')}
        </p>
      )}
    </div>
  )
}

// ───────────── Key code tester ─────────────
export function KeyCodeTester() {
  const [current, setCurrent] = useState<KeyInfo | null>(null)
  const [history, setHistory] = useState<KeyInfo[]>([])
  const [captureTab, setCaptureTab] = useState(false)

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Tab' && !captureTab) return
    e.preventDefault()
    const info = keyInfo({ key: e.key, code: e.code, keyCode: e.keyCode, location: e.location, ctrlKey: e.ctrlKey, shiftKey: e.shiftKey, altKey: e.altKey, metaKey: e.metaKey, repeat: e.repeat })
    setCurrent(info)
    if (!e.repeat) setHistory((h) => [info, ...h].slice(0, 20))
  }

  const rows: [string, string][] = current
    ? [
        ['event.key', displayKey(current.key)],
        ['event.code', current.code || '(empty)'],
        ['keyCode (legacy)', String(current.keyCode)],
        ['Location', current.location],
        ['Modifiers', current.modifiers.length ? current.modifiers.join(' + ') : 'none'],
        ['Repeat', current.repeat ? 'yes' : 'no'],
      ]
    : []

  return (
    <div className="space-y-5">
      <div
        role="group"
        tabIndex={0}
        aria-label="Key capture area. Focus here and press any key."
        onKeyDown={onKeyDown}
        className="flex min-h-56 cursor-text flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line-strong bg-surface p-6 text-center outline-none focus-visible:border-accent focus-visible:bg-accent-tint"
      >
        {current ? (
          <>
            <span className="tabular text-6xl font-semibold">{displayKey(current.key)}</span>
            <span className="text-sm text-muted">{current.code}</span>
          </>
        ) : (
          <span className="text-lg font-medium text-ink-2">Click here, then press any key</span>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Switch checked={captureTab} onChange={setCaptureTab} label="Capture the Tab key (it will not move focus while this box is focused)" />
      </div>
      <Panel title="Key details" actions={<CopyButton text={() => (current ? keyInfoText(current) : '')} disabled={!current} />}>
        <div aria-live="polite">
          {current ? (
            <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {rows.map(([k, v]) => (
                <div key={k} className="rounded-xl bg-surface px-4 py-3">
                  <dt className="text-xs text-muted">{k}</dt>
                  <dd className="tabular mt-0.5 break-all font-mono text-base font-semibold">{v}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="text-sm text-muted">Details for the last key you pressed show here. keyCode is deprecated, so use event.key or event.code in new code.</p>
          )}
        </div>
      </Panel>
      <Panel title="History" actions={<Button size="sm" variant="ghost" onClick={() => setHistory([])} disabled={!history.length}>Clear</Button>}>
        {history.length ? (
          <ul className="max-h-64 space-y-1 overflow-auto text-sm">
            {history.map((h, i) => (
              <li key={i} className="tabular flex flex-wrap gap-x-4 rounded-md bg-surface px-3 py-1.5 font-mono text-[13px]">
                <span className="font-semibold">{displayKey(h.key)}</span>
                <span>{h.code}</span>
                <span className="text-muted">keyCode {h.keyCode}</span>
                {h.modifiers.length > 0 && <span className="text-muted">{h.modifiers.join('+')}</span>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">Your last 20 key presses appear here.</p>
        )}
      </Panel>
    </div>
  )
}
