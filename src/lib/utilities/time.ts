const pad = (n: number, w = 2) => String(n).padStart(w, '0')

/** Split milliseconds into whole days, hours, minutes, seconds and the remaining milliseconds. */
export function splitMs(ms: number) {
  const t = Math.max(0, Math.floor(ms))
  const days = Math.floor(t / 86_400_000)
  const hours = Math.floor((t % 86_400_000) / 3_600_000)
  const minutes = Math.floor((t % 3_600_000) / 60_000)
  const seconds = Math.floor((t % 60_000) / 1000)
  return { days, hours, minutes, seconds, millis: t % 1000 }
}

/** "MM:SS" or "H:MM:SS" for timers. Rounds up so a timer shows 00:01 until it really hits zero. */
export function formatClock(ms: number, roundUp = true): string {
  const whole = Math.max(0, roundUp ? Math.ceil(ms / 1000) * 1000 : ms)
  const { days, hours, minutes, seconds } = splitMs(whole)
  const h = days * 24 + hours
  return h > 0 ? `${h}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`
}

/** Stopwatch format with centiseconds: "MM:SS.cc" or "H:MM:SS.cc". */
export function formatStopwatch(ms: number): string {
  const { days, hours, minutes, seconds, millis } = splitMs(ms)
  const cc = pad(Math.floor(millis / 10))
  const h = days * 24 + hours
  return h > 0 ? `${h}:${pad(minutes)}:${pad(seconds)}.${cc}` : `${pad(minutes)}:${pad(seconds)}.${cc}`
}

/** Convert hour, minute and second fields to milliseconds. Negative or non-finite parts count as 0. */
export function durationMs(h: number, m: number, s: number): number {
  const c = (n: number) => (Number.isFinite(n) && n > 0 ? Math.floor(n) : 0)
  return (c(h) * 3600 + c(m) * 60 + c(s)) * 1000
}

/** Remaining time for a timer that ends at `endAt` (timestamp). Never negative. */
export function remainingMs(endAt: number, now: number): number {
  return Math.max(0, endAt - now)
}

/** Elapsed time of a stopwatch: banked time plus the running segment. */
export function elapsedMs(banked: number, startedAt: number | null, now: number): number {
  return banked + (startedAt === null ? 0 : Math.max(0, now - startedAt))
}

export interface Lap {
  n: number
  split: number
  total: number
}

/** Add a lap. `total` is the elapsed time when the lap was taken. */
export function addLap(laps: Lap[], total: number): Lap[] {
  const prev = laps.length ? laps[laps.length - 1].total : 0
  return [...laps, { n: laps.length + 1, split: Math.max(0, total - prev), total }]
}

export function lapsToText(laps: Lap[]): string {
  return laps.map((l) => `Lap ${l.n}\t${formatStopwatch(l.split)}\t${formatStopwatch(l.total)}`).join('\n')
}

export function fastestSlowest(laps: Lap[]): { fastest: number | null; slowest: number | null } {
  if (laps.length < 2) return { fastest: null, slowest: null }
  let f = laps[0]
  let s = laps[0]
  for (const l of laps) {
    if (l.split < f.split) f = l
    if (l.split > s.split) s = l
  }
  return { fastest: f.n, slowest: s.n }
}

export interface CountdownParts {
  done: boolean
  days: number
  hours: number
  minutes: number
  seconds: number
}

/** Time left until a target timestamp, split for display. */
export function countdownParts(targetMs: number, now: number): CountdownParts {
  const left = targetMs - now
  if (!Number.isFinite(left) || left <= 0) return { done: true, days: 0, hours: 0, minutes: 0, seconds: 0 }
  const { days, hours, minutes, seconds } = splitMs(Math.ceil(left / 1000) * 1000)
  return { done: false, days, hours, minutes, seconds }
}

/** Parse the value of a datetime-local input as local time. Returns NaN when empty or invalid. */
export function parseLocalDateTime(v: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(v)
  if (!m) return NaN
  const [, y, mo, d, h, mi, s] = m
  return new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s ?? 0)).getTime()
}

// ───────────── Pomodoro ─────────────
export type PomodoroPhase = 'focus' | 'short' | 'long'

export interface PomodoroSettings {
  focus: number
  short: number
  long: number
  cycles: number
  autoAdvance: boolean
}

export const DEFAULT_POMODORO: PomodoroSettings = { focus: 25, short: 5, long: 15, cycles: 4, autoAdvance: false }

const clampInt = (v: unknown, min: number, max: number, fallback: number) => {
  const n = typeof v === 'number' ? v : Number(v)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, Math.round(n)))
}

/** Clean up settings loaded from storage or typed by the user. */
export function sanitizePomodoro(raw: unknown): PomodoroSettings {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const d = DEFAULT_POMODORO
  return {
    focus: clampInt(o.focus, 1, 180, d.focus),
    short: clampInt(o.short, 1, 60, d.short),
    long: clampInt(o.long, 1, 120, d.long),
    cycles: clampInt(o.cycles, 2, 12, d.cycles),
    autoAdvance: typeof o.autoAdvance === 'boolean' ? o.autoAdvance : d.autoAdvance,
  }
}

/** Which phase follows after finishing `phase`, given how many focus sessions are done (including this one). */
export function nextPhase(phase: PomodoroPhase, focusDone: number, cycles: number): PomodoroPhase {
  if (phase !== 'focus') return 'focus'
  return focusDone > 0 && focusDone % cycles === 0 ? 'long' : 'short'
}

export function phaseMs(phase: PomodoroPhase, s: PomodoroSettings): number {
  return s[phase] * 60_000
}
