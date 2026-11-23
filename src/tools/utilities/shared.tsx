import { useCallback, useEffect, useRef, useState } from 'react'

type AudioCtor = typeof AudioContext

/** Beep helper. The AudioContext is created lazily inside a handler, never during render. */
export function useBeep() {
  const ctx = useRef<AudioContext | null>(null)
  const timers = useRef<number[]>([])

  const prime = useCallback(() => {
    try {
      if (!ctx.current) {
        const Ctor: AudioCtor | undefined = window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioCtor }).webkitAudioContext
        if (!Ctor) return
        ctx.current = new Ctor()
      }
      if (ctx.current.state === 'suspended') void ctx.current.resume()
    } catch {
      /* audio is optional */
    }
  }, [])

  const beep = useCallback(
    (times = 3) => {
      prime()
      const c = ctx.current
      if (!c) return
      try {
        for (let i = 0; i < times; i++) {
          const start = c.currentTime + i * 0.35
          const osc = c.createOscillator()
          const gain = c.createGain()
          osc.type = 'sine'
          osc.frequency.value = 880
          gain.gain.setValueAtTime(0.0001, start)
          gain.gain.exponentialRampToValueAtTime(0.25, start + 0.02)
          gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.25)
          osc.connect(gain)
          gain.connect(c.destination)
          osc.start(start)
          osc.stop(start + 0.3)
        }
      } catch {
        /* ignore */
      }
    },
    [prime],
  )

  useEffect(() => {
    const t = timers.current
    return () => {
      t.forEach((id) => window.clearTimeout(id))
      const c = ctx.current
      ctx.current = null
      if (c && c.state !== 'closed') void c.close().catch(() => undefined)
    }
  }, [])

  return { beep, prime }
}

/** Show text in the tab title while it is not null. Restores the old title on change or unmount. */
export function useDocTitle(text: string | null) {
  useEffect(() => {
    if (text === null) return
    const prev = document.title
    document.title = text
    return () => {
      document.title = prev
    }
  }, [text])
}

/**
 * Countdown that derives remaining time from a timestamp, so throttled background tabs stay correct.
 */
export function useCountdown(onDone: (api: { run: (ms: number) => void; stop: (ms?: number) => void }) => void) {
  const [remaining, setRemaining] = useState(0)
  const [running, setRunning] = useState(false)
  const endAt = useRef(0)
  const timer = useRef<number | null>(null)
  const doneRef = useRef(onDone)
  useEffect(() => {
    doneRef.current = onDone
  })

  const clear = useCallback(() => {
    if (timer.current !== null) {
      window.clearInterval(timer.current)
      timer.current = null
    }
  }, [])

  const apiRef = useRef<{ run: (ms: number) => void; stop: (ms?: number) => void }>({ run: () => undefined, stop: () => undefined })

  const tick = useCallback(() => {
    const left = Math.max(0, endAt.current - Date.now())
    setRemaining(left)
    if (left <= 0) {
      clear()
      setRunning(false)
      doneRef.current(apiRef.current)
    }
  }, [clear])

  const run = useCallback(
    (ms: number) => {
      clear()
      endAt.current = Date.now() + ms
      setRemaining(ms)
      setRunning(true)
      timer.current = window.setInterval(tick, 200)
    },
    [clear, tick],
  )

  const pause = useCallback(() => {
    clear()
    setRemaining(Math.max(0, endAt.current - Date.now()))
    setRunning(false)
  }, [clear])

  const stop = useCallback(
    (ms = 0) => {
      clear()
      setRunning(false)
      setRemaining(ms)
    },
    [clear],
  )

  useEffect(() => {
    apiRef.current = { run, stop }
  }, [run, stop])

  useEffect(() => {
    const onVis = () => {
      if (timer.current !== null) tick()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      clear()
    }
  }, [tick, clear])

  return { remaining, running, run, pause, stop }
}

/** Re-render about every `ms` while active, returning the current timestamp. */
export function useNow(active: boolean, ms = 50) {
  const [now, setNow] = useState(0)
  useEffect(() => {
    if (!active) return
    setNow(Date.now())
    const id = window.setInterval(() => setNow(Date.now()), ms)
    return () => window.clearInterval(id)
  }, [active, ms])
  return now
}

export function reducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}
