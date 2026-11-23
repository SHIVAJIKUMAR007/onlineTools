/** A source of uniformly random unsigned 32-bit integers. */
export type Uint32Source = () => number

export const cryptoSource: Uint32Source = () => {
  const a = new Uint32Array(1)
  globalThis.crypto.getRandomValues(a)
  return a[0]
}

const TWO32 = 4_294_967_296

/** Uniform integer in [0, n) using rejection sampling, so there is no modulo bias. n must be 1..2^32. */
export function randomBelow(n: number, src: Uint32Source = cryptoSource): number {
  if (!Number.isInteger(n) || n < 1 || n > TWO32) throw new RangeError('n must be an integer from 1 to 2^32')
  if (n === 1) return 0
  const limit = TWO32 - (TWO32 % n)
  let x = src()
  while (x >= limit) x = src()
  return x % n
}

/** Uniform integer in [min, max], inclusive. */
export function randomInt(min: number, max: number, src: Uint32Source = cryptoSource): number {
  if (!Number.isInteger(min) || !Number.isInteger(max) || max < min) throw new RangeError('Invalid range')
  return min + randomBelow(max - min + 1, src)
}

/** Uniform float in [0, 1) with 53 bits of randomness. */
export function randomUnit(src: Uint32Source = cryptoSource): number {
  const hi = src() >>> 5
  const lo = src() >>> 6
  return (hi * 67_108_864 + lo) / 9_007_199_254_740_992
}

export function shuffle<T>(items: readonly T[], src: Uint32Source = cryptoSource): T[] {
  const a = items.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomBelow(i + 1, src)
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export const RNG_LIMIT = 1_000_000_000
export const RNG_MAX_COUNT = 10_000

export interface RngOptions {
  min: number
  max: number
  count: number
  unique: boolean
  decimals: number | null // null = integers
  sorted: boolean
}

export type RngResult = { ok: true; values: number[] } | { ok: false; error: string }

export function generateNumbers(o: RngOptions, src: Uint32Source = cryptoSource): RngResult {
  const { min, max, unique, sorted } = o
  const decimals = o.decimals
  if (![min, max, o.count].every(Number.isFinite)) return { ok: false, error: 'Enter numbers for the minimum, maximum and count.' }
  if (max < min) return { ok: false, error: 'The maximum must be at least the minimum.' }
  if (Math.abs(min) > RNG_LIMIT || Math.abs(max) > RNG_LIMIT) return { ok: false, error: `Use values between -${RNG_LIMIT.toLocaleString('en-US')} and ${RNG_LIMIT.toLocaleString('en-US')}.` }
  const count = Math.floor(o.count)
  if (count < 1 || count > RNG_MAX_COUNT) return { ok: false, error: `Count must be from 1 to ${RNG_MAX_COUNT.toLocaleString('en-US')}.` }
  let values: number[] = []
  if (decimals === null) {
    const lo = Math.ceil(min)
    const hi = Math.floor(max)
    if (hi < lo) return { ok: false, error: 'There is no whole number in that range.' }
    const size = hi - lo + 1
    if (unique) {
      if (count > size) return { ok: false, error: `Only ${size.toLocaleString('en-US')} different whole numbers fit in that range, so ${count.toLocaleString('en-US')} unique values are not possible.` }
      // Partial Fisher-Yates over a sparse index map, so large ranges do not need a big array.
      const swapped = new Map<number, number>()
      for (let i = 0; i < count; i++) {
        const j = i + randomBelow(size - i, src)
        const vj = swapped.get(j) ?? j
        const vi = swapped.get(i) ?? i
        swapped.set(j, vi)
        values.push(lo + vj)
      }
    } else {
      for (let i = 0; i < count; i++) values.push(lo + randomBelow(size, src))
    }
  } else {
    const d = Math.min(10, Math.max(0, Math.floor(decimals)))
    const f = 10 ** d
    const lo = Math.ceil(min * f - 1e-9)
    const hi = Math.floor(max * f + 1e-9)
    if (hi < lo) return { ok: false, error: 'There is no value with that precision in that range.' }
    const size = hi - lo + 1
    if (unique && count > size) return { ok: false, error: `Only ${size.toLocaleString('en-US')} different values fit in that range at ${d} decimal places.` }
    const seen = new Set<number>()
    while (values.length < count) {
      const v = lo + Math.floor(randomUnit(src) * size)
      if (unique) {
        if (seen.has(v)) continue
        seen.add(v)
      }
      values.push(v / f)
    }
  }
  if (sorted) values.sort((a, b) => a - b)
  return { ok: true, values }
}

// ───────────── Dice ─────────────
export const DICE_SIDES = [4, 6, 8, 10, 12, 20, 100] as const

export interface DiceRoll {
  rolls: number[]
  modifier: number
  total: number
}

export function rollDice(count: number, sides: number, modifier: number, src: Uint32Source = cryptoSource): DiceRoll {
  const c = Math.min(100, Math.max(1, Math.floor(count) || 1))
  const s = Math.min(1000, Math.max(2, Math.floor(sides) || 6))
  const m = Number.isFinite(modifier) ? Math.trunc(modifier) : 0
  const rolls = Array.from({ length: c }, () => randomInt(1, s, src))
  return { rolls, modifier: m, total: rolls.reduce((a, b) => a + b, 0) + m }
}

/** Parse dice notation such as "2d6+3", "d20" or "4d8-1". */
export function parseDice(input: string): { count: number; sides: number; modifier: number } | null {
  const m = /^\s*(\d*)\s*d\s*(\d+)\s*(?:([+-])\s*(\d+))?\s*$/i.exec(input)
  if (!m) return null
  const count = m[1] === '' ? 1 : Number(m[1])
  const sides = Number(m[2])
  if (count < 1 || count > 100 || sides < 2 || sides > 1000) return null
  const modifier = m[3] ? (m[3] === '-' ? -1 : 1) * Number(m[4]) : 0
  return { count, sides, modifier }
}

export function formatDice(count: number, sides: number, modifier: number): string {
  return `${count}d${sides}${modifier > 0 ? `+${modifier}` : modifier < 0 ? String(modifier) : ''}`
}

export function flipCoin(src: Uint32Source = cryptoSource): 'heads' | 'tails' {
  return randomBelow(2, src) === 0 ? 'heads' : 'tails'
}

// ───────────── Picker wheel ─────────────
export function parseOptions(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
}

/**
 * Final rotation (degrees, clockwise) that puts segment `index` under a pointer at the top.
 * Segment 0 starts at the top and runs clockwise. The result is at least `minSpins` full turns past `current`.
 * `offset` in [-0.4, 0.4] shifts the landing point inside the segment so it is not always the centre.
 */
export function targetRotation(current: number, index: number, n: number, minSpins: number, offset = 0): number {
  const seg = 360 / n
  const center = index * seg + seg / 2 + offset * seg
  const base = (((-center) % 360) + 360) % 360
  const cur = ((current % 360) + 360) % 360
  let delta = base - cur
  if (delta < 0) delta += 360
  return current + delta + 360 * Math.max(0, Math.floor(minSpins))
}

/** Which segment sits under the top pointer for a given rotation. */
export function segmentAtTop(rotation: number, n: number): number {
  const a = ((-rotation % 360) + 360) % 360
  return Math.min(n - 1, Math.floor(a / (360 / n)))
}
