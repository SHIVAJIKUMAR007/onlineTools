// Pure logic for: fraction calculator, break-even, FD/RD and PPF calculators.

// ───────────── fractions (BigInt) ─────────────
export interface Frac {
  n: bigint
  d: bigint
}
export type Res<T> = { ok: true; value: T } | { ok: false; error: string }
const fail = <T>(error: string): Res<T> => ({ ok: false, error })

const MAX_DIGITS = 15

export const gcd = (a: bigint, b: bigint): bigint => {
  a = a < 0n ? -a : a
  b = b < 0n ? -b : b
  while (b) [a, b] = [b, a % b]
  return a
}
const abs = (a: bigint) => (a < 0n ? -a : a)

export function reduce(f: Frac): Frac {
  if (f.n === 0n) return { n: 0n, d: 1n }
  const g = gcd(f.n, f.d)
  return { n: f.n / g, d: f.d / g }
}

const norm = (n: bigint, d: bigint): Frac => (d < 0n ? { n: -n, d: -d } : { n, d })

const tooLong = (s: string) => s.replace(/^0+/, '').length > MAX_DIGITS

/** Parses "3/4", "-3/4", "1 1/2", "-2 3/8", "5" or a plain decimal such as "2.5". The result is not reduced. */
export function parseFraction(text: string): Res<Frac> {
  const s = text.trim()
  if (s === '') return fail('Enter a fraction')
  let m = /^([+-]?)(\d+)\s+(\d+)\s*\/\s*(\d+)$/.exec(s)
  if (m) {
    if (tooLong(m[2]!) || tooLong(m[3]!) || tooLong(m[4]!)) return fail(`Use numbers with at most ${MAX_DIGITS} digits`)
    const d = BigInt(m[4]!)
    if (d === 0n) return fail('The denominator cannot be zero')
    const n = BigInt(m[2]!) * d + BigInt(m[3]!)
    return { ok: true, value: norm(m[1] === '-' ? -n : n, d) }
  }
  m = /^([+-]?)(\d+)\s*\/\s*(\d+)$/.exec(s)
  if (m) {
    if (tooLong(m[2]!) || tooLong(m[3]!)) return fail(`Use numbers with at most ${MAX_DIGITS} digits`)
    const d = BigInt(m[3]!)
    if (d === 0n) return fail('The denominator cannot be zero')
    const n = BigInt(m[2]!)
    return { ok: true, value: norm(m[1] === '-' ? -n : n, d) }
  }
  m = /^([+-]?)(\d*)\.?(\d*)$/.exec(s)
  if (m && (m[2]! + m[3]!).length > 0) {
    if (tooLong(m[2]! + m[3]!)) return fail(`Use numbers with at most ${MAX_DIGITS} digits`)
    const n = BigInt(m[2]! + m[3]!)
    return { ok: true, value: norm(m[1] === '-' ? -n : n, 10n ** BigInt(m[3]!.length)) }
  }
  return fail('Write a fraction like 3/4, a mixed number like 1 1/2, or a whole number')
}

export const fmtFrac = (f: Frac): string => (f.d === 1n ? `${f.n}` : `${f.n}/${f.d}`)

/** Mixed-number text, e.g. 7/3 becomes "2 1/3". Proper fractions and whole numbers are returned as they are. */
export function mixedForm(f: Frac): string {
  const r = reduce(f)
  if (r.d === 1n || abs(r.n) < r.d) return fmtFrac(r)
  const neg = r.n < 0n
  const an = abs(r.n)
  const whole = an / r.d
  const rem = an % r.d
  return `${neg ? '-' : ''}${whole} ${rem}/${r.d}`
}

export interface DecimalOut {
  text: string
  /** True when the decimal is cut short because it does not terminate. */
  rounded: boolean
  /** Repeating notation such as 0.(3), or null when the decimal terminates. */
  repeating: string | null
}

/** Long division with remainder tracking to find the repeating block. */
export function toDecimal(f: Frac, maxDigits = 12): DecimalOut {
  const neg = f.n < 0n
  const n = abs(f.n)
  const d = f.d
  const int = n / d
  let rem = n % d
  const digits: string[] = []
  const seen = new Map<string, number>()
  let repeatAt = -1
  let guard = 0
  while (rem !== 0n && guard < 2000) {
    const key = rem.toString()
    if (seen.has(key)) {
      repeatAt = seen.get(key)!
      break
    }
    seen.set(key, digits.length)
    rem *= 10n
    digits.push((rem / d).toString())
    rem %= d
    guard++
  }
  const sign = neg && (int !== 0n || digits.length > 0) ? '-' : ''
  if (digits.length === 0) return { text: `${sign}${int}`, rounded: false, repeating: null }
  let repeating: string | null = null
  if (repeatAt >= 0) {
    repeating = `${sign}${int}.${digits.slice(0, repeatAt).join('')}(${digits.slice(repeatAt).join('')})`
  }
  const cycle = repeatAt >= 0 ? digits.slice(repeatAt) : []
  const all = digits.slice()
  while (cycle.length > 0 && all.length < maxDigits) all.push(cycle[(all.length - repeatAt) % cycle.length]!)
  const shown = all.slice(0, maxDigits).join('')
  const cut = all.length > maxDigits || repeatAt >= 0
  return { text: `${sign}${int}.${shown}`, rounded: cut, repeating }
}

export type FracOp = 'add' | 'sub' | 'mul' | 'div'
export interface FracCalc {
  result: Frac
  steps: string[]
}

const OP_SIGN: Record<FracOp, string> = { add: '+', sub: '-', mul: 'x', div: '÷' }
const lcm = (a: bigint, b: bigint) => (a / gcd(a, b)) * b

export function fractionOp(a: Frac, b: Frac, op: FracOp): Res<FracCalc> {
  const steps: string[] = []
  if (a.d === 0n || b.d === 0n) return fail('The denominator cannot be zero')
  steps.push(`Write both as fractions: ${fmtFrac(a)} ${OP_SIGN[op]} ${fmtFrac(b)}`)
  let n: bigint
  let d: bigint
  if (op === 'add' || op === 'sub') {
    const l = lcm(a.d, b.d)
    const an = a.n * (l / a.d)
    const bn = b.n * (l / b.d)
    steps.push(`Common denominator: the lowest common multiple of ${a.d} and ${b.d} is ${l}`)
    steps.push(`Rewrite: ${an}/${l} ${OP_SIGN[op]} ${bn}/${l}`)
    n = op === 'add' ? an + bn : an - bn
    d = l
    steps.push(`${op === 'add' ? 'Add' : 'Subtract'} the numerators: ${an} ${OP_SIGN[op]} ${bn} = ${n}, so the result is ${n}/${d}`)
  } else if (op === 'mul') {
    n = a.n * b.n
    d = a.d * b.d
    steps.push(`Multiply the numerators and the denominators: ${a.n} x ${b.n} = ${n} over ${a.d} x ${b.d} = ${d}`)
  } else {
    if (b.n === 0n) return fail('Cannot divide by zero')
    steps.push(`Flip the second fraction (its reciprocal): ${fmtFrac(b)} becomes ${b.d}/${b.n}`)
    n = a.n * b.d
    d = a.d * b.n
    steps.push(`Multiply: ${a.n} x ${b.d} = ${n} over ${a.d} x ${b.n} = ${d}`)
  }
  const raw = norm(n, d)
  const r = reduce(raw)
  const g = gcd(raw.n, raw.d)
  if (raw.n === 0n) steps.push('The numerator is 0, so the result is 0')
  else if (g > 1n) steps.push(`Simplify: divide the top and bottom by their greatest common divisor, ${g}: ${fmtFrac(raw)} = ${fmtFrac(r)}`)
  else steps.push(`${fmtFrac(raw)} is already in lowest terms`)
  return { ok: true, value: { result: r, steps } }
}

export function simplifyFraction(f: Frac): { result: Frac; steps: string[] } {
  const g = gcd(f.n, f.d)
  const r = reduce(f)
  const steps = [`Fraction: ${fmtFrac(f)}`]
  if (f.n === 0n) steps.push('The numerator is 0, so the value is 0')
  else if (g > 1n) steps.push(`The greatest common divisor of ${abs(f.n)} and ${f.d} is ${g}`, `Divide both by ${g}: ${fmtFrac(r)}`)
  else steps.push(`The greatest common divisor of ${abs(f.n)} and ${f.d} is 1, so it is already in lowest terms`)
  return { result: r, steps }
}

/** Best fraction with a denominator up to maxDen, by continued fractions (with semiconvergents). */
export function bestRational(f: Frac, maxDen: bigint): Frac {
  const neg = f.n < 0n
  let n = abs(f.n)
  let d = f.d
  const exact = reduce({ n, d })
  if (exact.d <= maxDen) return { n: neg ? -exact.n : exact.n, d: exact.d }
  const n0 = n
  const d0 = d
  let h0 = 0n,
    h1 = 1n,
    k0 = 1n,
    k1 = 0n
  let best: Frac = { n: 0n, d: 1n }
  while (d !== 0n) {
    const a = n / d
    const h2 = a * h1 + h0
    const k2 = a * k1 + k0
    if (k2 > maxDen) {
      const t = k1 === 0n ? 0n : (maxDen - k0) / k1
      const sn = t * h1 + h0
      const sd = t * k1 + k0
      if (sd >= 1n && sd <= maxDen && k1 !== 0n) {
        const e1 = abs(n0 * k1 - h1 * d0) * sd
        const e2 = abs(n0 * sd - sn * d0) * k1
        best = e2 < e1 ? { n: sn, d: sd } : { n: h1, d: k1 }
      } else best = { n: h1, d: k1 }
      break
    }
    h0 = h1
    h1 = h2
    k0 = k1
    k1 = k2
    best = { n: h2, d: k2 }
    ;[n, d] = [d, n - a * d]
  }
  const r = reduce(best)
  return { n: neg ? -r.n : r.n, d: r.d }
}

export interface DecimalToFraction {
  fraction: Frac
  exact: boolean
  /** The exact fraction before limiting the denominator, when it was too big. */
  note: string
}

/** Accepts 0.125, 3.14159, 0.(3), 0.1(6) and 0.333... (the last digit repeats). */
export function decimalToFraction(text: string, maxDen = 1000n): Res<DecimalToFraction> {
  const s = text.trim().replace(/\s+/g, '')
  if (s === '') return fail('Enter a decimal number')
  const m = /^([+-]?)(\d*)\.?(\d*)(?:\((\d+)\)|(\.\.\.|…))?$/.exec(s)
  if (!m || (m[2]! + m[3]! + (m[4] ?? '')).length === 0) return fail('Write a decimal like 0.75, 3.14159, 0.(3) or 0.333...')
  const sign = m[1] === '-' ? -1n : 1n
  const intPart = m[2] || '0'
  let nonRep = m[3]!
  let rep = m[4] ?? ''
  if (m[5] !== undefined) {
    if (nonRep.length === 0) return fail('Put digits before the dots, like 0.333...')
    rep = nonRep.slice(-1)
    nonRep = nonRep.slice(0, -1)
  }
  if (tooLong(intPart + nonRep + rep)) return fail(`Use at most ${MAX_DIGITS} digits`)
  let f: Frac
  if (rep) {
    const a = BigInt(nonRep.length)
    const r = BigInt(rep.length)
    const all = BigInt(intPart + nonRep + rep)
    const base = BigInt(intPart + nonRep)
    f = { n: all - base, d: 10n ** a * (10n ** r - 1n) }
  } else {
    f = { n: BigInt(intPart + nonRep), d: 10n ** BigInt(nonRep.length) }
  }
  f = { n: f.n * sign, d: f.d }
  const reducedExact = reduce(f)
  if (reducedExact.d <= maxDen) {
    return { ok: true, value: { fraction: reducedExact, exact: true, note: '' } }
  }
  const approx = bestRational(f, maxDen)
  return { ok: true, value: { fraction: approx, exact: false, note: `Exact value: ${fmtFrac(reducedExact)}` } }
}

// ───────────── break-even ─────────────
export interface BreakEvenInput {
  fixed: number
  variable: number
  price: number
  target?: number
  expected?: number
}
export interface BreakEven {
  viable: boolean
  contribution: number
  ratio: number
  units: number
  unitsCeil: number
  revenue: number
  targetUnits: number | null
  targetRevenue: number | null
  safetyUnits: number | null
  safetyPct: number | null
  safetyRevenue: number | null
}

export function calcBreakEven(i: BreakEvenInput): BreakEven | null {
  const { fixed, variable, price } = i
  if (![fixed, variable, price].every(Number.isFinite) || fixed < 0 || variable < 0 || price <= 0) return null
  const contribution = price - variable
  const ratio = contribution / price
  const empty: BreakEven = { viable: false, contribution, ratio, units: NaN, unitsCeil: NaN, revenue: NaN, targetUnits: null, targetRevenue: null, safetyUnits: null, safetyPct: null, safetyRevenue: null }
  if (contribution <= 0) return empty
  const units = fixed / contribution
  const unitsCeil = Math.ceil(units - 1e-9)
  const hasTarget = i.target !== undefined && Number.isFinite(i.target) && i.target > 0
  const targetUnits = hasTarget ? Math.ceil((fixed + i.target!) / contribution - 1e-9) : null
  const hasExp = i.expected !== undefined && Number.isFinite(i.expected) && i.expected > 0
  const safetyUnits = hasExp ? i.expected! - units : null
  return {
    viable: true,
    contribution,
    ratio,
    units,
    unitsCeil,
    revenue: units * price,
    targetUnits,
    targetRevenue: targetUnits === null ? null : targetUnits * price,
    safetyUnits,
    safetyPct: hasExp ? (safetyUnits! / i.expected!) * 100 : null,
    safetyRevenue: hasExp ? safetyUnits! * price : null,
  }
}

// ───────────── FD ─────────────
export type FdFreq = 'monthly' | 'quarterly' | 'halfyearly' | 'yearly' | 'simple'
const FD_PER_YEAR: Record<Exclude<FdFreq, 'simple'>, number> = { monthly: 12, quarterly: 4, halfyearly: 2, yearly: 1 }

export interface FdYear {
  year: number
  /** Months covered in this row (12, or fewer in the last row). */
  months: number
  interest: number
  balance: number
}
export interface FdResult {
  maturity: number
  interest: number
  effectiveYield: number
  rows: FdYear[]
}

export function fdValueAt(principal: number, ratePct: number, months: number, freq: FdFreq): number {
  const r = ratePct / 100
  const t = months / 12
  if (freq === 'simple') return principal * (1 + r * t)
  const n = FD_PER_YEAR[freq]
  return principal * Math.pow(1 + r / n, n * t)
}

export function calcFd(principal: number, ratePct: number, months: number, freq: FdFreq): FdResult | null {
  if (![principal, ratePct, months].every(Number.isFinite)) return null
  if (principal <= 0 || ratePct < 0 || ratePct > 100 || !Number.isInteger(months) || months < 1 || months > 1200) return null
  const maturity = fdValueAt(principal, ratePct, months, freq)
  const rows: FdYear[] = []
  let prev = principal
  for (let y = 1; (y - 1) * 12 < months; y++) {
    const end = Math.min(y * 12, months)
    const bal = fdValueAt(principal, ratePct, end, freq)
    rows.push({ year: y, months: end - (y - 1) * 12, interest: bal - prev, balance: bal })
    prev = bal
  }
  const effectiveYield = (Math.pow(maturity / principal, 12 / months) - 1) * 100
  return { maturity, interest: maturity - principal, effectiveYield, rows }
}

// ───────────── RD ─────────────
export interface RdYear {
  year: number
  months: number
  deposited: number
  balance: number
}
export interface RdResult {
  maturity: number
  deposited: number
  interest: number
  rows: RdYear[]
}

/** Value after k months when an instalment is paid at the start of each month and interest compounds quarterly. */
export function rdValueAt(monthly: number, ratePct: number, k: number): number {
  const q = 1 + ratePct / 400
  let sum = 0
  for (let i = 1; i <= k; i++) sum += Math.pow(q, (k - i + 1) / 3)
  return monthly * sum
}

export function calcRd(monthly: number, ratePct: number, months: number): RdResult | null {
  if (![monthly, ratePct, months].every(Number.isFinite)) return null
  if (monthly <= 0 || ratePct < 0 || ratePct > 100 || !Number.isInteger(months) || months < 1 || months > 600) return null
  const rows: RdYear[] = []
  for (let y = 1; (y - 1) * 12 < months; y++) {
    const end = Math.min(y * 12, months)
    rows.push({ year: y, months: end - (y - 1) * 12, deposited: monthly * end, balance: rdValueAt(monthly, ratePct, end) })
  }
  const maturity = rdValueAt(monthly, ratePct, months)
  return { maturity, deposited: monthly * months, interest: maturity - monthly * months, rows }
}

// ───────────── PPF ─────────────
export const PPF_MAX_PER_YEAR = 150000
export const PPF_MIN_PER_YEAR = 500

export interface PpfYear {
  year: number
  deposit: number
  interest: number
  balance: number
}
export interface PpfResult {
  rows: PpfYear[]
  invested: number
  interest: number
  maturity: number
  yearlyDeposit: number
}

/**
 * Deposits are assumed to be made before the 5th of each month. Interest for a month is the monthly rate on the
 * lowest balance between the 5th and month end, and it is credited once at the end of the financial year.
 */
export function calcPpf(deposit: number, mode: 'yearly' | 'monthly', ratePct: number, years: number): Res<PpfResult> {
  if (![deposit, ratePct, years].every(Number.isFinite)) return fail('Enter valid numbers')
  if (deposit <= 0) return fail('Enter a deposit above zero')
  if (ratePct < 0 || ratePct > 20) return fail('Enter an interest rate between 0 and 20 percent')
  if (!Number.isInteger(years) || years < 1 || years > 50) return fail('Tenure must be a whole number of years from 1 to 50')
  const yearly = mode === 'yearly' ? deposit : deposit * 12
  if (yearly > PPF_MAX_PER_YEAR) return fail(`A PPF account accepts at most ${PPF_MAX_PER_YEAR.toLocaleString('en-IN')} a year${mode === 'monthly' ? ' (12,500 a month)' : ''}`)
  if (yearly < PPF_MIN_PER_YEAR) return fail(`A PPF account needs at least ${PPF_MIN_PER_YEAR} a year`)
  const mr = ratePct / 100 / 12
  const rows: PpfYear[] = []
  let balance = 0
  for (let y = 1; y <= years; y++) {
    let interest = 0
    for (let m = 1; m <= 12; m++) {
      const lowest = balance + (mode === 'yearly' ? deposit : deposit * m)
      interest += lowest * mr
    }
    balance += yearly + interest
    rows.push({ year: y, deposit: yearly, interest, balance })
  }
  const invested = yearly * years
  return { ok: true, value: { rows, invested, interest: balance - invested, maturity: balance, yearlyDeposit: yearly } }
}
