// ───────────── Ratios ─────────────
export const gcd = (a: number, b: number): number => {
  a = Math.abs(a)
  b = Math.abs(b)
  while (b) [a, b] = [b, a % b]
  return a
}

/** Number of decimal places in a finite number (up to 9). */
export function decimalPlaces(n: number): number {
  for (let d = 0; d <= 9; d++) if (Math.abs(Math.round(n * 10 ** d) - n * 10 ** d) < 1e-9) return d
  return 9
}

/** Simplify a ratio of non-negative numbers (decimals allowed) to the smallest whole numbers. */
export function simplifyRatio(values: readonly number[]): number[] | null {
  if (values.length < 2 || values.some((v) => !Number.isFinite(v) || v < 0) || values.every((v) => v === 0)) return null
  const d = Math.max(...values.map(decimalPlaces))
  const ints = values.map((v) => Math.round(v * 10 ** d))
  if (ints.some((v) => v > Number.MAX_SAFE_INTEGER)) return null
  const g = ints.reduce((a, b) => gcd(a, b))
  return ints.map((v) => v / g)
}

/** Multiply every term by a factor. */
export const scaleRatio = (values: readonly number[], factor: number): number[] => values.map((v) => roundTo(v * factor, 10))

export function roundTo(n: number, places: number): number {
  const f = 10 ** places
  return Math.round(n * f) / f
}

export type Unknown = 'a' | 'b' | 'c' | 'd'

/** Solve a:b = c:d for the missing term. Entries for known terms must be finite numbers. */
export function solveProportion(t: { a: number; b: number; c: number; d: number }, unknown: Unknown): number | null {
  let r: number
  switch (unknown) {
    case 'd':
      if (t.a === 0) return null
      r = (t.b * t.c) / t.a
      break
    case 'c':
      if (t.b === 0) return null
      r = (t.a * t.d) / t.b
      break
    case 'b':
      if (t.c === 0) return null
      r = (t.a * t.d) / t.c
      break
    default:
      if (t.d === 0) return null
      r = (t.b * t.c) / t.d
  }
  return Number.isFinite(r) ? roundTo(r, 10) : null
}

/** Split a total in the given ratio. */
export function shareTotal(total: number, ratio: readonly number[]): number[] | null {
  const sum = ratio.reduce((a, b) => a + b, 0)
  if (!(sum > 0) || !Number.isFinite(total)) return null
  return ratio.map((r) => roundTo((total * r) / sum, 10))
}

// ───────────── Averages ─────────────
export interface ParsedNumbers {
  values: number[]
  invalid: string[]
}

/** Split on commas, semicolons, whitespace and new lines. */
export function parseNumberList(text: string): ParsedNumbers {
  const values: number[] = []
  const invalid: string[] = []
  for (const tok of text.split(/[\s,;]+/).filter(Boolean)) {
    const n = /^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(tok) ? Number(tok) : NaN
    if (Number.isFinite(n)) values.push(n)
    else invalid.push(tok)
  }
  return { values, invalid }
}

export interface WeightedPair {
  value: number
  weight: number
}

/** One pair per line, "value weight" separated by space, comma, colon or tab. */
export function parseWeightedList(text: string): { pairs: WeightedPair[]; invalid: string[] } {
  const pairs: WeightedPair[] = []
  const invalid: string[] = []
  for (const line of text.split(/\r?\n/)) {
    const l = line.trim()
    if (!l) continue
    const parts = l.split(/[\s,;:]+/).filter(Boolean)
    const [v, w] = parts.map((p) => (/^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(p) ? Number(p) : NaN))
    if (parts.length === 2 && Number.isFinite(v) && Number.isFinite(w) && w >= 0) pairs.push({ value: v, weight: w })
    else invalid.push(l)
  }
  return { pairs, invalid }
}

export interface Stats {
  count: number
  sum: number
  mean: number
  median: number
  /** All values tied for most frequent, ascending. Empty when every value appears once. */
  mode: number[]
  min: number
  max: number
  range: number
}

export function describeNumbers(values: readonly number[]): Stats | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const n = sorted.length
  const sum = sorted.reduce((a, b) => a + b, 0)
  const median = n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2
  const freq = new Map<number, number>()
  for (const v of sorted) freq.set(v, (freq.get(v) ?? 0) + 1)
  const top = Math.max(...freq.values())
  const mode = top > 1 ? [...freq.entries()].filter(([, c]) => c === top).map(([v]) => v) : []
  return { count: n, sum, mean: sum / n, median, mode, min: sorted[0], max: sorted[n - 1], range: sorted[n - 1] - sorted[0] }
}

export function weightedAverage(pairs: readonly WeightedPair[]): number | null {
  const w = pairs.reduce((a, p) => a + p.weight, 0)
  if (!(w > 0)) return null
  return pairs.reduce((a, p) => a + p.value * p.weight, 0) / w
}

/** Compact number for display, trimming float noise. */
export function fmtNum(n: number, maxDecimals = 6): string {
  if (!Number.isFinite(n)) return String(n)
  const s = roundTo(n, maxDecimals)
  return Number.isInteger(s) ? s.toLocaleString('en-US') : s.toLocaleString('en-US', { maximumFractionDigits: maxDecimals })
}
