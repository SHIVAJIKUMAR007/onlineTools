// Pure date and number helpers for the calculator tools. All date math is done on
// whole UTC days, so daylight saving changes never shift a day count.

export interface DateParts {
  y: number
  m: number // 1-12
  d: number // 1-31
}

const DAY_MS = 86_400_000
export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

export const isLeapYear = (y: number): boolean => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0

export const daysInMonth = (y: number, m: number): number => [31, isLeapYear(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1]

/** Parse "YYYY-MM-DD". Returns null for empty or impossible dates. */
export function parseDate(s: string): DateParts | null {
  const match = /^(\d{4,6})-(\d{2})-(\d{2})$/.exec(s.trim())
  if (!match) return null
  const y = Number(match[1])
  const m = Number(match[2])
  const d = Number(match[3])
  if (y < 1 || y > 9999 || m < 1 || m > 12 || d < 1 || d > daysInMonth(y, m)) return null
  return { y, m, d }
}

export const toIso = (p: DateParts): string => `${String(p.y).padStart(4, '0')}-${String(p.m).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`

/** Days since 1970-01-01 (UTC). */
export function dayNumber(p: DateParts): number {
  const dt = new Date(0)
  dt.setUTCFullYear(p.y, p.m - 1, p.d)
  return Math.round(dt.getTime() / DAY_MS)
}

export function fromDayNumber(n: number): DateParts {
  const dt = new Date(n * DAY_MS)
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() }
}

export const diffDays = (a: DateParts, b: DateParts): number => dayNumber(b) - dayNumber(a)
export const compareDates = (a: DateParts, b: DateParts): number => diffDays(b, a)

/** 0 = Sunday ... 6 = Saturday. */
export const weekdayOfNumber = (n: number): number => (((n + 4) % 7) + 7) % 7
export const weekday = (p: DateParts): number => weekdayOfNumber(dayNumber(p))
export const dayOfYear = (p: DateParts): number => diffDays({ y: p.y, m: 1, d: 1 }, p) + 1
export const quarter = (p: DateParts): number => Math.ceil(p.m / 3)

export function formatDate(p: DateParts): string {
  return `${WEEKDAYS[weekday(p)]}, ${p.d} ${MONTHS[p.m - 1]} ${p.y}`
}

/** Add months, clamping the day to the end of the target month (Jan 31 + 1 month = Feb 28/29). */
export function addMonths(p: DateParts, months: number): DateParts {
  const total = p.y * 12 + (p.m - 1) + months
  const y = Math.floor(total / 12)
  const m = (total % 12 + 12) % 12 + 1
  return { y, m, d: Math.min(p.d, daysInMonth(y, m)) }
}

export const addDays = (p: DateParts, days: number): DateParts => fromDayNumber(dayNumber(p) + days)

export interface Offset {
  years: number
  months: number
  weeks: number
  days: number
}

/** Years and months are applied first (with clamping), then weeks and days. */
export function shiftDate(p: DateParts, o: Offset, sign: 1 | -1): DateParts | null {
  const r = addDays(addMonths(p, sign * (o.years * 12 + o.months)), sign * (o.weeks * 7 + o.days))
  return r.y >= 1 && r.y <= 9999 ? r : null
}

export interface Ymd {
  years: number
  months: number
  days: number
}

/** Calendar difference between two dates (from <= to), using month-end clamping. */
export function ymdDiff(from: DateParts, to: DateParts): Ymd {
  let months = (to.y - from.y) * 12 + (to.m - from.m)
  if (compareDates(addMonths(from, months), to) > 0) months -= 1
  const days = diffDays(addMonths(from, months), to)
  return { years: Math.floor(months / 12), months: months % 12, days }
}

export interface AgeInfo {
  ymd: Ymd
  totalMonths: number
  totalDays: number
  totalWeeks: number
  totalHours: number
  nextBirthday: DateParts
  nextBirthdayWeekday: string
  daysUntilBirthday: number
  turning: number
}

export function ageInfo(birth: DateParts, asOf: DateParts): AgeInfo | null {
  if (compareDates(birth, asOf) > 0) return null
  const ymd = ymdDiff(birth, asOf)
  const totalDays = diffDays(birth, asOf)
  const at = (y: number): DateParts => ({ y, m: birth.m, d: Math.min(birth.d, daysInMonth(y, birth.m)) })
  let next = at(asOf.y)
  if (compareDates(next, asOf) < 0) next = at(asOf.y + 1)
  return {
    ymd,
    totalMonths: ymd.years * 12 + ymd.months,
    totalDays,
    totalWeeks: Math.floor(totalDays / 7),
    totalHours: totalDays * 24,
    nextBirthday: next,
    nextBirthdayWeekday: WEEKDAYS[weekday(next)],
    daysUntilBirthday: diffDays(asOf, next),
    turning: next.y - birth.y,
  }
}

// ───────────── ISO 8601 weeks ─────────────
export function isoWeek(p: DateParts): { week: number; year: number } {
  const n = dayNumber(p)
  const isoWd = (weekdayOfNumber(n) + 6) % 7 // Monday = 0
  const thursday = fromDayNumber(n + 3 - isoWd)
  return { week: Math.floor((dayOfYear(thursday) - 1) / 7) + 1, year: thursday.y }
}

/** A year has 53 ISO weeks when 1 January or 31 December falls on a Thursday. */
export function isoWeeksInYear(y: number): number {
  return isoWeek({ y, m: 12, d: 28 }).week
}

export function isoWeekRange(p: DateParts): { monday: DateParts; sunday: DateParts } {
  const n = dayNumber(p)
  const isoWd = (weekdayOfNumber(n) + 6) % 7
  return { monday: fromDayNumber(n - isoWd), sunday: fromDayNumber(n - isoWd + 6) }
}

// ───────────── Leap years ─────────────
export function leapReason(y: number): string {
  if (y % 400 === 0) return `${y} is divisible by 400, so it is a leap year.`
  if (y % 100 === 0) return `${y} is divisible by 100 but not by 400, so it is not a leap year.`
  if (y % 4 === 0) return `${y} is divisible by 4 and not by 100, so it is a leap year.`
  return `${y} is not divisible by 4, so it is not a leap year.`
}

export function nextLeapYear(y: number): number {
  let n = y + 1
  while (!isLeapYear(n)) n++
  return n
}

export function previousLeapYear(y: number): number | null {
  let n = y - 1
  while (n >= 1 && !isLeapYear(n)) n--
  return n >= 1 ? n : null
}

export function leapYearsInRange(from: number, to: number, limit = 500): { years: number[]; total: number } {
  const lo = Math.min(from, to)
  const hi = Math.max(from, to)
  const years: number[] = []
  let total = 0
  for (let y = lo; y <= hi; y++) {
    if (isLeapYear(y)) {
      total++
      if (years.length < limit) years.push(y)
    }
  }
  return { years, total }
}

// ───────────── Percentages ─────────────
export function formatNumber(n: number, maxDecimals = 4): string {
  if (!Number.isFinite(n)) return '-'
  const r = Number(n.toFixed(maxDecimals))
  return (Object.is(r, -0) ? 0 : r).toLocaleString('en-US', { maximumFractionDigits: maxDecimals })
}

export const percentOf = (pct: number, value: number): number => (pct / 100) * value
export const whatPercent = (part: number, whole: number): number | null => (whole === 0 ? null : (part / whole) * 100)
export const percentChange = (from: number, to: number): number | null => (from === 0 ? null : ((to - from) / Math.abs(from)) * 100)
export const addPercent = (value: number, pct: number): number => value * (1 + pct / 100)
export const subtractPercent = (value: number, pct: number): number => value * (1 - pct / 100)

// ───────────── BMI ─────────────
export interface BmiResult {
  bmi: number
  category: string
  tone: 'accent' | 'warn' | 'danger'
  healthyMinKg: number
  healthyMaxKg: number
}

export function bmiCategory(bmi: number): { category: string; tone: 'accent' | 'warn' | 'danger' } {
  const b = Math.round(bmi * 10) / 10
  if (b < 16) return { category: 'Severe thinness', tone: 'danger' }
  if (b < 17) return { category: 'Moderate thinness', tone: 'warn' }
  if (b < 18.5) return { category: 'Mild thinness', tone: 'warn' }
  if (b < 25) return { category: 'Normal weight', tone: 'accent' }
  if (b < 30) return { category: 'Overweight', tone: 'warn' }
  if (b < 35) return { category: 'Obesity class I', tone: 'danger' }
  if (b < 40) return { category: 'Obesity class II', tone: 'danger' }
  return { category: 'Obesity class III', tone: 'danger' }
}

export const LB_PER_KG = 2.20462262185
export const CM_PER_INCH = 2.54

export function calcBmi(weightKg: number, heightCm: number): BmiResult | null {
  if (!(weightKg > 0) || !(heightCm > 0) || heightCm < 50 || heightCm > 280 || weightKg > 700) return null
  const m = heightCm / 100
  const bmi = weightKg / (m * m)
  return { bmi, ...bmiCategory(bmi), healthyMinKg: 18.5 * m * m, healthyMaxKg: 24.9 * m * m }
}

// ───────────── GPA ─────────────
export const GRADE_POINTS: Record<string, number> = {
  'A+': 4.0, A: 4.0, 'A-': 3.7, 'B+': 3.3, B: 3.0, 'B-': 2.7, 'C+': 2.3, C: 2.0, 'C-': 1.7, 'D+': 1.3, D: 1.0, 'D-': 0.7, F: 0,
}
export const GRADES = Object.keys(GRADE_POINTS)

export interface Course {
  credits: number
  grade: string
}

export function calcGpa(courses: Course[]): { gpa: number; credits: number; points: number; counted: number } | null {
  let credits = 0
  let points = 0
  let counted = 0
  for (const c of courses) {
    const gp = GRADE_POINTS[c.grade]
    if (gp === undefined || !(c.credits > 0)) continue
    credits += c.credits
    points += c.credits * gp
    counted++
  }
  return credits > 0 ? { gpa: points / credits, credits, points, counted } : null
}

export function calcCgpa(prevCredits: number, prevGpa: number, semCredits: number, semGpa: number): number | null {
  if (!(prevCredits >= 0) || !(prevGpa >= 0) || prevGpa > 4 || !(semCredits > 0)) return null
  return (prevCredits * prevGpa + semCredits * semGpa) / (prevCredits + semCredits)
}

/** A common US-style conversion table. Schools differ, so treat it as a rough hint. */
export function percentToGpa(pct: number): { letter: string; gpa: number } | null {
  if (!(pct >= 0) || pct > 100) return null
  const rows: [number, string][] = [[97, 'A+'], [93, 'A'], [90, 'A-'], [87, 'B+'], [83, 'B'], [80, 'B-'], [77, 'C+'], [73, 'C'], [70, 'C-'], [67, 'D+'], [63, 'D'], [60, 'D-']]
  const hit = rows.find(([min]) => pct >= min)
  const letter = hit ? hit[1] : 'F'
  return { letter, gpa: GRADE_POINTS[letter] }
}

// ───────────── Working days ─────────────
export interface WorkOptions {
  /** Weekday numbers that are not working days (0 = Sunday ... 6 = Saturday). */
  weekend: number[]
  /** Holidays as ISO date strings. */
  holidays: Set<string>
}

const isWorkingNumber = (n: number, o: WorkOptions): boolean => !o.weekend.includes(weekdayOfNumber(n)) && !o.holidays.has(toIso(fromDayNumber(n)))

/** Working days from `from` to `to`. Inclusive counts both end dates; otherwise the end date is left out. */
export function countWorkingDays(from: DateParts, to: DateParts, inclusive: boolean, o: WorkOptions): number {
  let a = dayNumber(from)
  let b = dayNumber(to)
  if (a > b) [a, b] = [b, a]
  if (!inclusive) b -= 1
  let count = 0
  for (let n = a; n <= b; n++) if (isWorkingNumber(n, o)) count++
  return count
}

/** Move `count` working days forward (or back when negative). The start date itself is not counted. */
export function addWorkingDays(start: DateParts, count: number, o: WorkOptions): DateParts | null {
  if (o.weekend.length >= 7 || !Number.isInteger(count)) return null
  const step = count < 0 ? -1 : 1
  let remaining = Math.abs(count)
  let n = dayNumber(start)
  let guard = 0
  while (remaining > 0) {
    n += step
    if (++guard > 3_000_000) return null
    if (isWorkingNumber(n, o)) remaining--
  }
  const r = fromDayNumber(n)
  return r.y >= 1 && r.y <= 9999 ? r : null
}

/** Parse one date per line or separated by commas or spaces. Invalid tokens are returned separately. */
export function parseHolidays(text: string): { dates: Set<string>; invalid: string[] } {
  const dates = new Set<string>()
  const invalid: string[] = []
  for (const tok of text.split(/[\s,;]+/).filter(Boolean)) {
    const p = parseDate(tok)
    if (p) dates.add(toIso(p))
    else invalid.push(tok)
  }
  return { dates, invalid }
}
