import { describe, expect, it } from 'vitest'
import {
  addLap,
  countdownParts,
  durationMs,
  elapsedMs,
  fastestSlowest,
  formatClock,
  formatStopwatch,
  lapsToText,
  nextPhase,
  parseLocalDateTime,
  remainingMs,
  sanitizePomodoro,
  splitMs,
} from '@/lib/utilities/time'
import { flipCoin, formatDice, generateNumbers, parseDice, parseOptions, randomBelow, randomInt, randomUnit, rollDice, segmentAtTop, shuffle, targetRotation } from '@/lib/utilities/random'
import { average, cps, cpsRating, keyInfo, keyInfoText, reactionDelay, reactionRating } from '@/lib/utilities/input'

/** Deterministic source cycling through the given values. */
const seq = (...v: number[]) => {
  let i = 0
  return () => v[i++ % v.length]
}
/** Small deterministic PRNG (mulberry32) as a 32-bit source. */
const prng = (seed: number) => () => {
  seed |= 0
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0)
}

describe('time formatting', () => {
  it('splits milliseconds', () => {
    expect(splitMs(90_061_500)).toEqual({ days: 1, hours: 1, minutes: 1, seconds: 1, millis: 500 })
    expect(splitMs(-5).seconds).toBe(0)
  })
  it('formats clocks and rounds up', () => {
    expect(formatClock(0)).toBe('00:00')
    expect(formatClock(1)).toBe('00:01')
    expect(formatClock(61_000)).toBe('01:01')
    expect(formatClock(3_600_000)).toBe('1:00:00')
    expect(formatClock(90_500, false)).toBe('01:30')
  })
  it('formats stopwatch with centiseconds', () => {
    expect(formatStopwatch(0)).toBe('00:00.00')
    expect(formatStopwatch(1234)).toBe('00:01.23')
    expect(formatStopwatch(3_661_990)).toBe('1:01:01.99')
  })
  it('builds durations safely', () => {
    expect(durationMs(1, 2, 3)).toBe(3_723_000)
    expect(durationMs(-1, NaN, 5.9)).toBe(5000)
  })
})

describe('timestamp math', () => {
  it('computes remaining and elapsed from timestamps', () => {
    expect(remainingMs(10_000, 4_000)).toBe(6000)
    expect(remainingMs(10_000, 20_000)).toBe(0)
    expect(elapsedMs(500, null, 99_999)).toBe(500)
    expect(elapsedMs(500, 1000, 1750)).toBe(1250)
    expect(elapsedMs(0, 2000, 1000)).toBe(0)
  })
  it('records laps with split and total', () => {
    let laps = addLap([], 1500)
    laps = addLap(laps, 4000)
    laps = addLap(laps, 4200)
    expect(laps.map((l) => l.split)).toEqual([1500, 2500, 200])
    expect(fastestSlowest(laps)).toEqual({ fastest: 3, slowest: 2 })
    expect(fastestSlowest(laps.slice(0, 1))).toEqual({ fastest: null, slowest: null })
    expect(lapsToText(laps).split('\n')[0]).toBe('Lap 1\t00:01.50\t00:01.50')
  })
  it('splits a countdown to a date', () => {
    const now = Date.UTC(2030, 0, 1)
    const t = now + (2 * 86400 + 3 * 3600 + 4 * 60 + 5) * 1000
    expect(countdownParts(t, now)).toEqual({ done: false, days: 2, hours: 3, minutes: 4, seconds: 5 })
    expect(countdownParts(now, now).done).toBe(true)
    expect(countdownParts(NaN, now).done).toBe(true)
  })
  it('parses datetime-local values', () => {
    expect(parseLocalDateTime('2030-05-06T07:08')).toBe(new Date(2030, 4, 6, 7, 8).getTime())
    expect(Number.isNaN(parseLocalDateTime(''))).toBe(true)
  })
})

describe('pomodoro', () => {
  it('sanitizes settings', () => {
    expect(sanitizePomodoro(null)).toEqual({ focus: 25, short: 5, long: 15, cycles: 4, autoAdvance: false })
    expect(sanitizePomodoro({ focus: 9999, short: 0, long: 'x', cycles: 1, autoAdvance: true })).toEqual({ focus: 180, short: 1, long: 15, cycles: 2, autoAdvance: true })
  })
  it('picks the next phase', () => {
    expect(nextPhase('focus', 1, 4)).toBe('short')
    expect(nextPhase('focus', 4, 4)).toBe('long')
    expect(nextPhase('focus', 8, 4)).toBe('long')
    expect(nextPhase('short', 1, 4)).toBe('focus')
    expect(nextPhase('long', 4, 4)).toBe('focus')
  })
})

describe('unbiased random', () => {
  it('rejects values in the biased tail', () => {
    // n = 3: limit = 2^32 - 1 = 4294967295, so 4294967295 must be rejected.
    expect(randomBelow(3, seq(4_294_967_295, 7))).toBe(1)
    // n = 2^31+1 leaves a huge biased tail: x >= limit is rejected.
    expect(randomBelow(2_147_483_649, seq(4_294_967_295, 5))).toBe(5)
  })
  it('handles n=1 and invalid input', () => {
    expect(randomBelow(1, seq(123))).toBe(0)
    expect(() => randomBelow(0)).toThrow()
    expect(() => randomInt(5, 1)).toThrow()
  })
  it('is roughly uniform for a small range', () => {
    const src = prng(42)
    const counts = [0, 0, 0, 0, 0, 0]
    for (let i = 0; i < 12_000; i++) counts[randomInt(1, 6, src) - 1]++
    for (const c of counts) expect(Math.abs(c - 2000)).toBeLessThan(200)
  })
  it('randomUnit stays below 1', () => {
    expect(randomUnit(seq(4_294_967_295))).toBeLessThan(1)
    expect(randomUnit(seq(0))).toBe(0)
  })
  it('shuffles without losing items', () => {
    const out = shuffle([1, 2, 3, 4, 5, 6], prng(1))
    expect([...out].sort()).toEqual([1, 2, 3, 4, 5, 6])
    expect(shuffle([], prng(1))).toEqual([])
  })
  it('works with real crypto', () => {
    const v = randomInt(10, 20)
    expect(v).toBeGreaterThanOrEqual(10)
    expect(v).toBeLessThanOrEqual(20)
    expect(['heads', 'tails']).toContain(flipCoin())
  })
})

describe('generateNumbers', () => {
  const base = { min: 1, max: 10, count: 5, unique: false, decimals: null, sorted: false }
  it('generates in range', () => {
    const r = generateNumbers({ ...base, count: 200 }, prng(3))
    expect(r.ok && r.values.every((n) => n >= 1 && n <= 10 && Number.isInteger(n))).toBe(true)
  })
  it('produces unique values and can use the whole range', () => {
    const r = generateNumbers({ ...base, count: 10, unique: true }, prng(9))
    expect(r.ok && [...r.values].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
  })
  it('errors when unique count exceeds range', () => {
    const r = generateNumbers({ ...base, count: 11, unique: true })
    expect(r.ok).toBe(false)
  })
  it('supports negatives, sorting and a single-value range', () => {
    const r = generateNumbers({ ...base, min: -5, max: 5, count: 50, sorted: true }, prng(5))
    expect(r.ok && r.values.every((v, i, a) => i === 0 || a[i - 1] <= v)).toBe(true)
    const one = generateNumbers({ ...base, min: 7, max: 7, count: 3 })
    expect(one.ok && one.values).toEqual([7, 7, 7])
  })
  it('supports decimals', () => {
    const r = generateNumbers({ ...base, min: 0, max: 1, count: 100, decimals: 2 }, prng(11))
    expect(r.ok && r.values.every((v) => v >= 0 && v <= 1 && Math.round(v * 100) / 100 === v)).toBe(true)
    const u = generateNumbers({ ...base, min: 0, max: 0.02, count: 4, decimals: 2, unique: true })
    expect(u.ok).toBe(false)
  })
  it('validates input', () => {
    expect(generateNumbers({ ...base, min: 5, max: 1 }).ok).toBe(false)
    expect(generateNumbers({ ...base, count: 0 }).ok).toBe(false)
    expect(generateNumbers({ ...base, min: NaN }).ok).toBe(false)
    expect(generateNumbers({ ...base, max: 2e9 }).ok).toBe(false)
    expect(generateNumbers({ ...base, min: 1.2, max: 1.8 }).ok).toBe(false)
  })
})

describe('dice', () => {
  it('parses notation', () => {
    expect(parseDice('2d6+3')).toEqual({ count: 2, sides: 6, modifier: 3 })
    expect(parseDice('d20')).toEqual({ count: 1, sides: 20, modifier: 0 })
    expect(parseDice(' 4D8 - 1 ')).toEqual({ count: 4, sides: 8, modifier: -1 })
    expect(parseDice('0d6')).toBeNull()
    expect(parseDice('2d1')).toBeNull()
    expect(parseDice('hello')).toBeNull()
  })
  it('rolls and totals with modifier', () => {
    const r = rollDice(3, 6, -2, prng(2))
    expect(r.rolls).toHaveLength(3)
    expect(r.total).toBe(r.rolls.reduce((a, b) => a + b, 0) - 2)
    expect(r.rolls.every((n) => n >= 1 && n <= 6)).toBe(true)
  })
  it('formats notation', () => {
    expect(formatDice(2, 6, 3)).toBe('2d6+3')
    expect(formatDice(1, 20, -1)).toBe('1d20-1')
    expect(formatDice(1, 100, 0)).toBe('1d100')
  })
})

describe('wheel math', () => {
  it('lands the pointer on the chosen segment', () => {
    for (const n of [1, 2, 3, 7, 12]) {
      for (let i = 0; i < n; i++) {
        for (const cur of [0, 123.4, 1000, -50]) {
          const r = targetRotation(cur, i, n, 4, 0.3)
          expect(r).toBeGreaterThanOrEqual(cur + 4 * 360)
          expect(segmentAtTop(r, n)).toBe(i)
        }
      }
    }
  })
  it('parses options ignoring blanks', () => {
    expect(parseOptions(' a \r\n\n b\n  \n')).toEqual(['a', 'b'])
  })
})

describe('click, reaction and keys', () => {
  it('computes cps', () => {
    expect(cps(50, 10)).toBe(5)
    expect(cps(5, 0)).toBe(0)
    expect(cpsRating(2)).toBe('Casual clicking')
    expect(cpsRating(20)).toBe('Extremely fast')
  })
  it('averages and rates reactions', () => {
    expect(average([200, 300])).toBe(250)
    expect(average([])).toBe(0)
    expect(reactionRating(210)).toBe('Quick')
    expect(reactionDelay(0)).toBe(1500)
    expect(reactionDelay(1)).toBeLessThanOrEqual(5000)
    expect(reactionDelay(0.5)).toBe(3250)
  })
  it('maps key events', () => {
    const i = keyInfo({ key: 'A', code: 'KeyA', keyCode: 65, location: 0, shiftKey: true, ctrlKey: true })
    expect(i).toMatchObject({ key: 'A', code: 'KeyA', keyCode: 65, location: 'Standard', modifiers: ['Ctrl', 'Shift'] })
    expect(keyInfo({ key: 'Shift', code: 'ShiftRight', location: 2 }).location).toBe('Right')
    expect(keyInfo({ key: '1', code: 'Numpad1', location: 3 }).location).toBe('Numpad')
    expect(keyInfoText(i)).toContain('keyCode: 65 (legacy)')
  })
})
