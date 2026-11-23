// Cron expression parsing, explanation and next-run calculation. Pure logic, local time.

export interface FieldSpec {
  name: string
  min: number
  max: number
}

export const FIELD_SPECS = {
  second: { name: 'second', min: 0, max: 59 },
  minute: { name: 'minute', min: 0, max: 59 },
  hour: { name: 'hour', min: 0, max: 23 },
  dom: { name: 'day of month', min: 1, max: 31 },
  month: { name: 'month', min: 1, max: 12 },
  dow: { name: 'day of week', min: 0, max: 7 },
} satisfies Record<string, FieldSpec>

export const MONTH_NAMES = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
export const DOW_NAMES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
const MONTH_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const DOW_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export const MACROS: Record<string, string> = {
  '@yearly': '0 0 1 1 *',
  '@annually': '0 0 1 1 *',
  '@monthly': '0 0 1 * *',
  '@weekly': '0 0 * * 0',
  '@daily': '0 0 * * *',
  '@midnight': '0 0 * * *',
  '@hourly': '0 * * * *',
}

export interface ParsedField {
  source: string
  values: number[]
  /** Standard cron treats a field starting with * (or ?) as unrestricted for the day-of-month / day-of-week rule. */
  star: boolean
}

export interface ParsedCron {
  expression: string
  hasSeconds: boolean
  second: ParsedField
  minute: ParsedField
  hour: ParsedField
  dom: ParsedField
  month: ParsedField
  dow: ParsedField
}

export type CronParse = { ok: true; cron: ParsedCron } | { ok: false; error: string }

class CronError extends Error {}

function parseValue(tok: string, spec: FieldSpec, names?: string[]): number {
  const upper = tok.toUpperCase()
  if (names) {
    const idx = names.indexOf(upper)
    if (idx !== -1) return spec.name === 'month' ? idx + 1 : idx
  }
  if (!/^\d+$/.test(tok)) throw new CronError(`"${tok}" is not a valid ${spec.name} value.`)
  const n = Number(tok)
  if (n < spec.min || n > spec.max) throw new CronError(`${spec.name[0].toUpperCase()}${spec.name.slice(1)} value ${n} is out of range (${spec.min}-${spec.max === 7 ? '6, or 7 for Sunday' : spec.max}).`)
  return n
}

function parseField(src: string, spec: FieldSpec, names?: string[]): ParsedField {
  if (!src) throw new CronError(`The ${spec.name} field is empty.`)
  const set = new Set<number>()
  for (const part of src.split(',')) {
    if (!part) throw new CronError(`The ${spec.name} field has an empty list item.`)
    const [range, stepText, extra] = part.split('/')
    if (extra !== undefined) throw new CronError(`"${part}" has more than one step.`)
    let step = 1
    if (stepText !== undefined) {
      if (!/^\d+$/.test(stepText) || Number(stepText) < 1) throw new CronError(`The step in "${part}" must be a positive whole number.`)
      step = Number(stepText)
    }
    let lo: number
    let hi: number
    if (range === '*' || range === '?') {
      lo = spec.min
      hi = spec.name === 'day of week' ? 6 : spec.max
    } else if (range.includes('-')) {
      const [a, b, more] = range.split('-')
      if (more !== undefined || !a || !b) throw new CronError(`"${range}" is not a valid range.`)
      lo = parseValue(a, spec, names)
      hi = parseValue(b, spec, names)
      if (lo > hi) throw new CronError(`The range "${range}" runs backwards. Write it as two ranges, such as 22-23,0-5.`)
    } else {
      lo = parseValue(range, spec, names)
      hi = stepText !== undefined ? (spec.name === 'day of week' ? 6 : spec.max) : lo
    }
    for (let v = lo; v <= hi; v += step) set.add(spec.name === 'day of week' ? v % 7 : v)
  }
  return { source: src, values: [...set].sort((a, b) => a - b), star: src[0] === '*' || src[0] === '?' }
}

export function parseCron(input: string): CronParse {
  let expr = input.trim().replace(/\s+/g, ' ')
  if (!expr) return { ok: false, error: 'Enter a cron expression.' }
  if (expr.startsWith('@')) {
    const macro = MACROS[expr.toLowerCase()]
    if (!macro) return { ok: false, error: expr.toLowerCase() === '@reboot' ? '@reboot runs at system start, so there are no run times to list.' : `Unknown macro "${expr}". Use @yearly, @monthly, @weekly, @daily or @hourly.` }
    expr = macro
  }
  const f = expr.split(' ')
  if (f.length !== 5 && f.length !== 6) return { ok: false, error: `Expected 5 fields (minute hour day-of-month month day-of-week) or 6 with seconds first, but found ${f.length}.` }
  const hasSeconds = f.length === 6
  const [s, mi, h, d, mo, w] = hasSeconds ? f : ['0', ...f]
  try {
    return {
      ok: true,
      cron: {
        expression: expr,
        hasSeconds,
        second: parseField(s, FIELD_SPECS.second),
        minute: parseField(mi, FIELD_SPECS.minute),
        hour: parseField(h, FIELD_SPECS.hour),
        dom: parseField(d, FIELD_SPECS.dom),
        month: parseField(mo, FIELD_SPECS.month, MONTH_NAMES),
        dow: parseField(w, FIELD_SPECS.dow, DOW_NAMES),
      },
    }
  } catch (e) {
    return { ok: false, error: e instanceof CronError ? e.message : 'Could not read that expression.' }
  }
}

/** Day matching as in Vixie cron: if both day fields are restricted, either may match. */
export function dayMatches(c: ParsedCron, year: number, month: number, day: number): boolean {
  if (!c.month.values.includes(month)) return false
  const dow = new Date(year, month - 1, day).getDay()
  const domOk = c.dom.values.includes(day)
  const dowOk = c.dow.values.includes(dow)
  if (c.dom.star && c.dow.star) return true
  if (c.dom.star) return dowOk
  if (c.dow.star) return domOk
  return domOk || dowOk
}

/** Next run times strictly after `from`, in the local timezone. Searches up to ten years ahead. */
export function nextRuns(c: ParsedCron, from: Date, count = 10): Date[] {
  const out: Date[] = []
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate())
  for (let offset = 0; offset < 3660 && out.length < count; offset++) {
    const day = new Date(start.getFullYear(), start.getMonth(), start.getDate() + offset)
    const y = day.getFullYear()
    const mo = day.getMonth() + 1
    const d = day.getDate()
    if (!dayMatches(c, y, mo, d)) continue
    for (const h of c.hour.values) {
      for (const mi of c.minute.values) {
        for (const s of c.second.values) {
          const t = new Date(y, mo - 1, d, h, mi, s)
          // Skip times that do not exist (daylight saving gap).
          if (t.getHours() !== h || t.getMinutes() !== mi) continue
          if (t.getTime() > from.getTime()) {
            out.push(t)
            if (out.length >= count) return out
          }
        }
      }
    }
  }
  return out
}

const pad2 = (n: number) => String(n).padStart(2, '0')
const ordinal = (n: number) => {
  const v = n % 100
  if (v >= 11 && v <= 13) return `${n}th`
  return `${n}${({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th'}`
}
const listWords = (items: string[]) => (items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`)
const isContiguous = (v: number[]) => v.length > 2 && v.every((x, i) => i === 0 || x === v[i - 1] + 1)
const stepOf = (src: string): number | null => {
  const m = /^(\*|\?|\d+-\d+|\d+)\/(\d+)$/.exec(src)
  return m ? Number(m[2]) : null
}

function describeMinutes(f: ParsedField): string {
  if (f.source === '*') return 'every minute'
  const st = stepOf(f.source)
  if (st !== null && !f.source.includes(',')) {
    const a = f.values[0]
    const b = f.values[f.values.length - 1]
    const base = st === 1 ? 'every minute' : `every ${st} minutes`
    return f.source.startsWith('*') ? base : `${base} from minute ${a} through ${b}`
  }
  if (f.values.length === 1) return f.values[0] === 0 ? 'at the start of the hour' : `at minute ${f.values[0]}`
  return `at minutes ${listWords(f.values.map(String))}`
}

function describeSeconds(f: ParsedField): string {
  if (f.source === '*') return 'every second'
  const st = stepOf(f.source)
  if (st !== null && f.source.startsWith('*') && !f.source.includes(',')) return `every ${st} seconds`
  return f.values.length === 1 ? `at second ${f.values[0]}` : `at seconds ${listWords(f.values.map(String))}`
}

function describeTime(c: ParsedCron): string {
  const { minute, hour, second } = c
  const hourStar = hour.source === '*'
  const hourStep = stepOf(hour.source) !== null && !hour.source.includes(',')
  let main: string
  if (minute.values.length === 1 && !stepOf(minute.source) && !hourStar && !hourStep && hour.values.length <= 8) {
    main = `at ${listWords(hour.values.map((h) => `${pad2(h)}:${pad2(minute.values[0])}`))}`
  } else if (hourStar) {
    main = describeMinutes(minute)
    if (minute.values.length === 1 && !stepOf(minute.source)) main = minute.values[0] === 0 ? 'every hour, on the hour' : `at minute ${minute.values[0]} of every hour`
  } else {
    let h: string
    if (hourStep) {
      const st = stepOf(hour.source)!
      h = st === 1 ? 'of every hour' : `of every ${st} hours`
      if (!hour.source.startsWith('*')) h += ` from ${pad2(hour.values[0])}:00 through ${pad2(hour.values[hour.values.length - 1])}:59`
    } else if (isContiguous(hour.values) && !hour.source.includes(',')) {
      h = `between ${pad2(hour.values[0])}:00 and ${pad2(hour.values[hour.values.length - 1])}:59`
    } else {
      h = `past hour ${listWords(hour.values.map(String))}`
    }
    main = `${describeMinutes(minute)} ${h}`
  }
  if (c.hasSeconds && !(second.values.length === 1 && second.values[0] === 0)) {
    if (minute.source === '*' && hourStar) return describeSeconds(second)
    return `${describeSeconds(second)}, ${main}`
  }
  return main
}

function describeDays(c: ParsedCron): string {
  const { dom, month, dow } = c
  const parts: string[] = []
  const domPart = () => {
    const st = stepOf(dom.source)
    if (st !== null && dom.source.startsWith('*') && !dom.source.includes(',')) return `every ${st} days of the month`
    return `on the ${listWords(dom.values.map(ordinal))} of the month`
  }
  const dowPart = () => {
    const v = dow.values
    if (v.length === 7) return 'every day of the week'
    if (isContiguous(v) && !dow.source.includes(',')) return `${DOW_LONG[v[0]]} through ${DOW_LONG[v[v.length - 1]]}`
    return `on ${listWords(v.map((x) => DOW_LONG[x]))}`
  }
  const domStar = dom.star
  const dowStar = dow.star
  if (!domStar && !dowStar) parts.push(`${domPart()}, or ${dowPart()} (either day matches)`)
  else if (!domStar) parts.push(domPart())
  else if (!dowStar) parts.push(dowPart())
  if (month.source !== '*') {
    const st = stepOf(month.source)
    if (st !== null && month.source.startsWith('*')) parts.push(`every ${st} months`)
    else if (isContiguous(month.values) && !month.source.includes(',')) parts.push(`${MONTH_LONG[month.values[0] - 1]} through ${MONTH_LONG[month.values[month.values.length - 1] - 1]}`)
    else parts.push(`in ${listWords(month.values.map((m) => MONTH_LONG[m - 1]))}`)
  }
  return parts.length ? parts.join(', ') : 'every day'
}

export function explainCron(c: ParsedCron): string {
  const time = describeTime(c)
  const days = describeDays(c)
  const sentence = `${time[0].toUpperCase()}${time.slice(1)}, ${days}`
  return sentence + '.'
}

// ───────────── Builder ─────────────

export interface CronPreset {
  label: string
  expression: string
}

export const CRON_PRESETS: CronPreset[] = [
  { label: 'Every minute', expression: '* * * * *' },
  { label: 'Every 5 minutes', expression: '*/5 * * * *' },
  { label: 'Every 15 minutes', expression: '*/15 * * * *' },
  { label: 'Every hour', expression: '0 * * * *' },
  { label: 'Every day at midnight', expression: '0 0 * * *' },
  { label: 'Every day at 09:00', expression: '0 9 * * *' },
  { label: 'Weekdays at 09:00', expression: '0 9 * * 1-5' },
  { label: 'Every Sunday at 00:00', expression: '0 0 * * 0' },
  { label: 'First day of each month', expression: '0 0 1 * *' },
  { label: 'Every January 1st', expression: '0 0 1 1 *' },
]

export interface BuilderState {
  minute: string
  hour: string
  dom: string
  month: string
  dow: string
}

export const buildCron = (b: BuilderState): string => [b.minute, b.hour, b.dom, b.month, b.dow].map((x) => x.trim() || '*').join(' ')
