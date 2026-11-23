import { useEffect, useRef, useState } from 'react'
import { Pause, Play, RotateCcw, SkipForward, Flag } from 'lucide-react'
import { Panel, CopyButton } from '@/components/tools/controls'
import { Button } from '@/components/ui/button'
import { Field, Input, Segmented, Switch } from '@/components/ui/fields'
import { Badge } from '@/components/ui/misc'
import {
  addLap,
  countdownParts,
  DEFAULT_POMODORO,
  durationMs,
  elapsedMs,
  fastestSlowest,
  formatClock,
  formatStopwatch,
  lapsToText,
  nextPhase,
  parseLocalDateTime,
  phaseMs,
  sanitizePomodoro,
  type Lap,
  type PomodoroPhase,
  type PomodoroSettings,
} from '@/lib/utilities/time'
import { useBeep, useCountdown, useDocTitle, useNow } from './shared'

const clampField = (v: string, max: number) => Math.min(max, Math.max(0, Math.floor(Number(v)) || 0))

function BigTime({ children, label }: { children: string; label: string }) {
  return (
    <p role="timer" aria-label={label} className="tabular text-center text-6xl font-semibold tracking-tight sm:text-7xl">
      {children}
    </p>
  )
}

// ───────────── Countdown timer ─────────────
function DurationTimer() {
  const [h, setH] = useState('0')
  const [m, setM] = useState('5')
  const [s, setS] = useState('0')
  const [phase, setPhase] = useState<'idle' | 'active' | 'done'>('idle')
  const { beep, prime } = useBeep()
  const cd = useCountdown(() => {
    setPhase('done')
    beep(4)
  })
  const total = durationMs(clampField(h, 999), clampField(m, 999), clampField(s, 999))
  const paused = phase === 'active' && !cd.running

  useDocTitle(cd.running ? `${formatClock(cd.remaining)} - Countdown timer` : phase === 'done' ? "Time's up! - Countdown timer" : null)

  const start = () => {
    prime()
    if (paused) return cd.run(cd.remaining)
    if (total <= 0) return
    setPhase('active')
    cd.run(total)
  }
  const reset = () => {
    cd.stop(0)
    setPhase('idle')
  }
  const shown = phase === 'idle' ? total : cd.remaining

  return (
    <div className="space-y-5">
      <BigTime label="Time remaining">{formatClock(shown)}</BigTime>
      <p className="text-center text-sm text-muted" role="status" aria-live="polite">
        {phase === 'done' ? "Time's up." : cd.running ? 'Running' : paused ? 'Paused' : 'Set a time and press Start.'}
      </p>
      {phase === 'idle' && (
        <div className="flex flex-wrap items-end justify-center gap-3">
          <Field label="Hours" className="w-24">{(id) => <Input id={id} type="number" inputMode="numeric" min={0} max={999} value={h} onChange={(e) => setH(e.target.value)} />}</Field>
          <Field label="Minutes" className="w-24">{(id) => <Input id={id} type="number" inputMode="numeric" min={0} max={999} value={m} onChange={(e) => setM(e.target.value)} />}</Field>
          <Field label="Seconds" className="w-24">{(id) => <Input id={id} type="number" inputMode="numeric" min={0} max={999} value={s} onChange={(e) => setS(e.target.value)} />}</Field>
        </div>
      )}
      <div className="flex flex-wrap justify-center gap-2">
        {phase === 'idle' &&
          [1, 5, 10, 30].map((min) => (
            <Button key={min} size="sm" variant="ghost" onClick={() => { setH('0'); setM(String(min)); setS('0') }}>
              {min} min
            </Button>
          ))}
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {cd.running ? (
          <Button size="lg" onClick={cd.pause}><Pause className="size-4" aria-hidden />Pause</Button>
        ) : (
          <Button size="lg" variant="primary" onClick={start} disabled={phase !== 'active' && total <= 0}>
            <Play className="size-4" aria-hidden />{paused ? 'Resume' : phase === 'done' ? 'Restart' : 'Start'}
          </Button>
        )}
        <Button size="lg" onClick={reset} disabled={phase === 'idle'}><RotateCcw className="size-4" aria-hidden />Reset</Button>
      </div>
    </div>
  )
}

function DateCountdown() {
  const [value, setValue] = useState('')
  const target = parseLocalDateTime(value)
  const valid = !Number.isNaN(target)
  const now = useNow(valid, 250)
  const parts = countdownParts(target, now)
  const ready = valid && now > 0
  const armed = useRef(false)
  const { beep, prime } = useBeep()

  useEffect(() => {
    if (!ready) {
      armed.current = false
      return
    }
    if (!parts.done) armed.current = true
    else if (armed.current) {
      armed.current = false
      beep(4)
    }
  }, [ready, parts.done, beep])

  useDocTitle(ready && !parts.done ? `${parts.days}d ${parts.hours}h ${parts.minutes}m ${parts.seconds}s - Countdown` : ready && parts.done ? 'Countdown finished' : null)

  const cells: [string, number][] = [['Days', parts.days], ['Hours', parts.hours], ['Minutes', parts.minutes], ['Seconds', parts.seconds]]
  return (
    <div className="space-y-5">
      <div className="mx-auto max-w-xs">
        <Field label="Count down to" hint="Uses your device time zone.">
          {(id) => <Input id={id} type="datetime-local" value={value} onChange={(e) => { prime(); setValue(e.target.value) }} />}
        </Field>
      </div>
      <div role="timer" aria-label="Time until the chosen date" className="grid grid-cols-4 gap-2 sm:gap-4">
        {cells.map(([label, n]) => (
          <div key={label} className="rounded-xl bg-surface px-2 py-4 text-center">
            <p className="tabular text-3xl font-semibold sm:text-5xl">{ready ? String(n).padStart(2, '0') : '--'}</p>
            <p className="mt-1 text-xs text-muted">{label}</p>
          </div>
        ))}
      </div>
      <p className="text-center text-sm text-muted" role="status" aria-live="polite">
        {!valid ? 'Pick a date and time to start.' : ready && parts.done ? 'The date has passed or the countdown has finished.' : 'Counting down.'}
      </p>
    </div>
  )
}

export function CountdownTimer() {
  const [mode, setMode] = useState<'timer' | 'date'>('timer')
  return (
    <Panel title="Countdown" actions={<Segmented label="Mode" value={mode} onChange={setMode} options={[{ value: 'timer', label: 'Timer' }, { value: 'date', label: 'To a date' }]} />}>
      {mode === 'timer' ? <DurationTimer /> : <DateCountdown />}
    </Panel>
  )
}

// ───────────── Stopwatch ─────────────
export function Stopwatch() {
  const [banked, setBanked] = useState(0)
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [laps, setLaps] = useState<Lap[]>([])
  const running = startedAt !== null
  const now = useNow(running, 31)
  const elapsed = elapsedMs(banked, startedAt, now)
  const { fastest, slowest } = fastestSlowest(laps)

  const toggle = () => {
    if (running) {
      setBanked(elapsedMs(banked, startedAt, Date.now()))
      setStartedAt(null)
    } else {
      setStartedAt(Date.now())
    }
  }
  const lap = () => {
    if (!running) return
    setLaps((l) => addLap(l, elapsedMs(banked, startedAt, Date.now())))
  }
  const reset = () => {
    setBanked(0)
    setStartedAt(null)
    setLaps([])
  }

  return (
    <div className="space-y-5">
      <Panel>
        <div className="space-y-5">
          <BigTime label="Elapsed time">{formatStopwatch(elapsed)}</BigTime>
          <div className="flex flex-wrap justify-center gap-2">
            <Button size="lg" variant="primary" onClick={toggle}>
              {running ? <Pause className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />}
              {running ? 'Stop' : banked > 0 ? 'Resume' : 'Start'}
            </Button>
            <Button size="lg" onClick={lap} disabled={!running}><Flag className="size-4" aria-hidden />Lap</Button>
            <Button size="lg" onClick={reset} disabled={!running && banked === 0 && laps.length === 0}><RotateCcw className="size-4" aria-hidden />Reset</Button>
          </div>
        </div>
      </Panel>
      <Panel title={`Laps${laps.length ? ` (${laps.length})` : ''}`} actions={<CopyButton text={() => lapsToText(laps)} label="Copy laps" disabled={laps.length === 0} />}>
        {laps.length === 0 ? (
          <p className="text-sm text-muted">Press Lap while the stopwatch runs to record a split.</p>
        ) : (
          <div className="max-h-96 overflow-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted">
                <tr><th className="py-1 pr-3 font-medium">Lap</th><th className="py-1 pr-3 font-medium">Split</th><th className="py-1 font-medium">Total</th></tr>
              </thead>
              <tbody>
                {[...laps].reverse().map((l) => (
                  <tr key={l.n} className="border-t border-line">
                    <td className="py-1.5 pr-3">{l.n} {l.n === fastest && <Badge tone="accent">Fastest</Badge>} {l.n === slowest && <Badge tone="warn">Slowest</Badge>}</td>
                    <td className="tabular py-1.5 pr-3 font-mono">{formatStopwatch(l.split)}</td>
                    <td className="tabular py-1.5 font-mono">{formatStopwatch(l.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  )
}

// ───────────── Pomodoro ─────────────
const STORAGE_KEY = 'stayput-pomodoro'
const PHASE_LABEL: Record<PomodoroPhase, string> = { focus: 'Focus', short: 'Short break', long: 'Long break' }

function NumField({ label, value, min, max, onCommit }: { label: string; value: number; min: number; max: number; onCommit: (n: number) => void }) {
  const [text, setText] = useState(String(value))
  useEffect(() => setText(String(value)), [value])
  return (
    <Field label={label}>
      {(id) => (
        <Input
          id={id}
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            const n = Number(e.target.value)
            if (e.target.value !== '' && Number.isFinite(n) && n >= min && n <= max) onCommit(Math.round(n))
          }}
          onBlur={() => setText(String(value))}
        />
      )}
    </Field>
  )
}

export function PomodoroTimer() {
  const [settings, setSettings] = useState<PomodoroSettings>(DEFAULT_POMODORO)
  const [loaded, setLoaded] = useState(false)
  const [phase, setPhase] = useState<PomodoroPhase>('focus')
  const [focusDone, setFocusDone] = useState(0)
  const [inProgress, setInProgress] = useState(false)
  const { beep, prime } = useBeep()

  const cd = useCountdown((api) => {
    beep(3)
    const done = phase === 'focus' ? focusDone + 1 : focusDone
    const next = nextPhase(phase, done, settings.cycles)
    setFocusDone(done)
    setPhase(next)
    if (settings.autoAdvance) {
      api.run(phaseMs(next, settings))
    } else {
      api.stop(phaseMs(next, settings))
      setInProgress(false)
    }
  })

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (raw) setSettings(sanitizePomodoro(JSON.parse(raw)))
    } catch {
      /* storage unavailable or corrupt */
    }
    setLoaded(true)
  }, [])
  useEffect(() => {
    if (!loaded) return
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
    } catch {
      /* ignore */
    }
  }, [settings, loaded])

  const paused = inProgress && !cd.running
  const shown = inProgress ? cd.remaining : phaseMs(phase, settings)
  useDocTitle(cd.running ? `${formatClock(cd.remaining)} - ${PHASE_LABEL[phase]}` : null)

  const start = () => {
    prime()
    if (paused) return cd.run(cd.remaining)
    setInProgress(true)
    cd.run(phaseMs(phase, settings))
  }
  const goTo = (p: PomodoroPhase) => {
    cd.stop(phaseMs(p, settings))
    setPhase(p)
    setInProgress(false)
  }
  const skip = () => goTo(nextPhase(phase, phase === 'focus' ? focusDone + 1 : focusDone, settings.cycles))
  const resetAll = () => {
    goTo('focus')
    setFocusDone(0)
  }
  const set = (patch: Partial<PomodoroSettings>) => setSettings((s) => sanitizePomodoro({ ...s, ...patch }))
  const position = (focusDone % settings.cycles) + (phase === 'focus' ? 1 : 0)

  return (
    <div className="space-y-5">
      <Panel>
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Segmented label="Phase" value={phase} onChange={goTo} options={[{ value: 'focus', label: 'Focus' }, { value: 'short', label: 'Short break' }, { value: 'long', label: 'Long break' }]} />
          </div>
          <BigTime label={`${PHASE_LABEL[phase]} time remaining`}>{formatClock(shown)}</BigTime>
          <p className="text-center text-sm text-muted" role="status" aria-live="polite">
            {PHASE_LABEL[phase]}
            {phase === 'focus' ? ` ${position} of ${settings.cycles}` : ''} · {cd.running ? 'running' : paused ? 'paused' : 'ready'}
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {cd.running ? (
              <Button size="lg" onClick={cd.pause}><Pause className="size-4" aria-hidden />Pause</Button>
            ) : (
              <Button size="lg" variant="primary" onClick={start}><Play className="size-4" aria-hidden />{paused ? 'Resume' : 'Start'}</Button>
            )}
            <Button size="lg" onClick={skip}><SkipForward className="size-4" aria-hidden />Skip</Button>
            <Button size="lg" onClick={resetAll}><RotateCcw className="size-4" aria-hidden />Reset</Button>
          </div>
          <p className="text-center text-sm text-ink-2">Focus sessions completed: <strong className="tabular">{focusDone}</strong></p>
        </div>
      </Panel>
      <Panel title="Settings (minutes)">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <NumField label="Focus" value={settings.focus} min={1} max={180} onCommit={(n) => set({ focus: n })} />
          <NumField label="Short break" value={settings.short} min={1} max={60} onCommit={(n) => set({ short: n })} />
          <NumField label="Long break" value={settings.long} min={1} max={120} onCommit={(n) => set({ long: n })} />
          <NumField label="Sessions before long break" value={settings.cycles} min={2} max={12} onCommit={(n) => set({ cycles: n })} />
        </div>
        <div className="mt-4">
          <Switch checked={settings.autoAdvance} onChange={(v) => set({ autoAdvance: v })} label="Start the next phase automatically" />
        </div>
        <p className="mt-3 text-xs text-muted">Settings are saved in this browser only. Changing a length applies to the next phase you start.</p>
      </Panel>
    </div>
  )
}
