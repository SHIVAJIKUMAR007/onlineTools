/** Pure helpers for the time zone converter and the zodiac sign finder. */

// ───────────── Time zones ─────────────
export const FALLBACK_ZONES = [
  'UTC', 'Pacific/Honolulu', 'America/Anchorage', 'America/Los_Angeles', 'America/Denver', 'America/Chicago', 'America/New_York',
  'America/Toronto', 'America/Mexico_City', 'America/Bogota', 'America/Sao_Paulo', 'America/Argentina/Buenos_Aires', 'Atlantic/Reykjavik',
  'Europe/London', 'Europe/Dublin', 'Europe/Lisbon', 'Europe/Paris', 'Europe/Berlin', 'Europe/Madrid', 'Europe/Rome', 'Europe/Amsterdam',
  'Europe/Athens', 'Europe/Istanbul', 'Europe/Moscow', 'Africa/Cairo', 'Africa/Lagos', 'Africa/Nairobi', 'Africa/Johannesburg',
  'Asia/Dubai', 'Asia/Tehran', 'Asia/Karachi', 'Asia/Kolkata', 'Asia/Kathmandu', 'Asia/Dhaka', 'Asia/Bangkok', 'Asia/Jakarta',
  'Asia/Singapore', 'Asia/Hong_Kong', 'Asia/Shanghai', 'Asia/Manila', 'Asia/Seoul', 'Asia/Tokyo', 'Australia/Perth', 'Australia/Adelaide',
  'Australia/Sydney', 'Pacific/Auckland',
]

/** All IANA zones the browser knows, or a built-in list when Intl cannot list them. */
export function listZones(): string[] {
  try {
    const fn = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf
    const list = fn ? fn('timeZone') : []
    if (list && list.length > 10) return list.includes('UTC') ? list : ['UTC', ...list]
  } catch {
    /* fall through */
  }
  return FALLBACK_ZONES
}

export function localZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

export function isValidZone(zone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone })
    return true
  } catch {
    return false
  }
}

export function zoneLabel(zone: string): string {
  const parts = zone.split('/')
  return parts[parts.length - 1].replace(/_/g, ' ')
}

export function filterZones(zones: string[], query: string, limit = 8): string[] {
  const q = query.trim().toLowerCase().replace(/\s+/g, '_')
  if (!q) return zones.slice(0, limit)
  return zones.filter((z) => z.toLowerCase().includes(q)).slice(0, limit)
}

const dtfCache = new Map<string, Intl.DateTimeFormat>()
function formatter(zone: string): Intl.DateTimeFormat {
  let f = dtfCache.get(zone)
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', { timeZone: zone, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' })
    dtfCache.set(zone, f)
  }
  return f
}

export interface ZonedParts {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
  /** Minutes east of UTC. */
  offsetMin: number
  /** 0 = Sunday. */
  weekday: number
}

/** Wall-clock parts of an instant (ms since epoch) in an IANA zone. Null for bad zones or dates. */
export function zonedParts(zone: string, utcMs: number): ZonedParts | null {
  if (!Number.isFinite(utcMs)) return null
  try {
    const p: Record<string, number> = {}
    for (const x of formatter(zone).formatToParts(new Date(utcMs))) if (x.type !== 'literal') p[x.type] = Number(x.value)
    const hour = p.hour % 24
    const asUtc = Date.UTC(p.year, p.month - 1, p.day, hour, p.minute, p.second)
    const base = Math.floor(utcMs / 1000) * 1000
    return {
      year: p.year,
      month: p.month,
      day: p.day,
      hour,
      minute: p.minute,
      second: p.second,
      offsetMin: Math.round((asUtc - base) / 60000),
      weekday: new Date(asUtc).getUTCDay(),
    }
  } catch {
    return null
  }
}

export const offsetMinutes = (zone: string, utcMs: number): number | null => zonedParts(zone, utcMs)?.offsetMin ?? null

export type ResolveStatus = 'ok' | 'gap' | 'overlap'
export interface Resolved {
  utcMs: number
  status: ResolveStatus
}

/**
 * Finds the UTC instant for a wall-clock time in a zone. The offset is solved from the offsets one day before
 * and after, and each candidate is checked against the real offset at that instant.
 * In a spring-forward gap the time moves ahead by the gap length (02:30 becomes 03:30).
 * In a fall-back overlap the first (earlier) occurrence is used.
 */
export function zonedToUtc(zone: string, year: number, month: number, day: number, hour: number, minute: number): Resolved | null {
  const naive = Date.UTC(year, month - 1, day, hour, minute)
  if (![year, month, day, hour, minute].every(Number.isFinite) || !Number.isFinite(naive)) return null
  const DAY = 86400000
  const before = offsetMinutes(zone, naive - DAY)
  const after = offsetMinutes(zone, naive + DAY)
  if (before === null || after === null) return null
  const candidates = [...new Set([before, after])].map((o) => naive - o * 60000).filter((u) => offsetMinutes(zone, u) === (naive - u) / 60000)
  if (candidates.length === 0) return { utcMs: naive - before * 60000, status: 'gap' }
  if (candidates.length === 1) return { utcMs: candidates[0], status: 'ok' }
  return { utcMs: Math.min(...candidates), status: 'overlap' }
}

/** Parses "YYYY-MM-DDTHH:mm" (datetime-local) into parts. */
export function parseLocalInput(s: string): { year: number; month: number; day: number; hour: number; minute: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(s)
  if (!m) return null
  const [year, month, day, hour, minute] = m.slice(1).map(Number)
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) return null
  return { year, month, day, hour, minute }
}

const pad = (n: number) => String(n).padStart(2, '0')
export const toLocalInput = (p: Pick<ZonedParts, 'year' | 'month' | 'day' | 'hour' | 'minute'>) => `${String(p.year).padStart(4, '0')}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`

export function formatOffset(offsetMin: number): string {
  const sign = offsetMin < 0 ? '-' : '+'
  const a = Math.abs(offsetMin)
  const h = Math.floor(a / 60)
  const m = a % 60
  return m ? `UTC${sign}${h}:${pad(m)}` : `UTC${sign}${h}`
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
export const formatDate = (p: ZonedParts) => `${WEEKDAYS[p.weekday]}, ${p.day} ${MONTHS[p.month - 1]} ${p.year}`
export const formatTime = (p: ZonedParts, seconds = false) => `${pad(p.hour)}:${pad(p.minute)}${seconds ? ':' + pad(p.second) : ''}`

/** Whole calendar days the target date is ahead of (+) or behind (-) the source date. */
export function dayDifference(source: ZonedParts, target: ZonedParts): number {
  return Math.round((Date.UTC(target.year, target.month - 1, target.day) - Date.UTC(source.year, source.month - 1, source.day)) / 86400000)
}

export function dayDiffLabel(diff: number): string {
  if (diff === 0) return 'Same day'
  const n = Math.abs(diff)
  return `${diff > 0 ? '+' : '-'}${n} day${n === 1 ? '' : 's'}`
}

export interface MeetingCell {
  hour: number
  minute: number
  friendly: boolean
  dayOffset: number
}
export interface MeetingRow {
  zone: string
  cells: MeetingCell[]
}

/**
 * Builds 24 hourly cells starting at midnight (source zone) of the source date, one row per zone.
 * A cell is meeting-friendly when its local time is between 09:00 and 18:00.
 */
export function meetingGrid(sourceZone: string, zones: string[], year: number, month: number, day: number): { rows: MeetingRow[]; sharedHours: number } | null {
  const start = zonedToUtc(sourceZone, year, month, day, 0, 0)
  const srcStart = start && zonedParts(sourceZone, start.utcMs)
  if (!start || !srcStart) return null
  const rows: MeetingRow[] = []
  for (const zone of zones) {
    const cells: MeetingCell[] = []
    for (let i = 0; i < 24; i++) {
      const p = zonedParts(zone, start.utcMs + i * 3600000)
      if (!p) return null
      const mins = p.hour * 60 + p.minute
      cells.push({ hour: p.hour, minute: p.minute, friendly: mins >= 540 && mins < 1080, dayOffset: dayDifference(srcStart, p) })
    }
    rows.push({ zone, cells })
  }
  let sharedHours = 0
  if (rows.length > 0) for (let i = 0; i < 24; i++) if (rows.every((r) => r.cells[i].friendly)) sharedHours++
  return { rows, sharedHours }
}

// ───────────── Zodiac ─────────────
export interface Sign {
  name: string
  symbol: string
  start: [number, number]
  end: [number, number]
  element: 'Fire' | 'Earth' | 'Air' | 'Water'
  modality: 'Cardinal' | 'Fixed' | 'Mutable'
  ruler: string
  traditionalRuler?: string
}

export const SIGNS: Sign[] = [
  { name: 'Aries', symbol: '♈', start: [3, 21], end: [4, 19], element: 'Fire', modality: 'Cardinal', ruler: 'Mars' },
  { name: 'Taurus', symbol: '♉', start: [4, 20], end: [5, 20], element: 'Earth', modality: 'Fixed', ruler: 'Venus' },
  { name: 'Gemini', symbol: '♊', start: [5, 21], end: [6, 20], element: 'Air', modality: 'Mutable', ruler: 'Mercury' },
  { name: 'Cancer', symbol: '♋', start: [6, 21], end: [7, 22], element: 'Water', modality: 'Cardinal', ruler: 'Moon' },
  { name: 'Leo', symbol: '♌', start: [7, 23], end: [8, 22], element: 'Fire', modality: 'Fixed', ruler: 'Sun' },
  { name: 'Virgo', symbol: '♍', start: [8, 23], end: [9, 22], element: 'Earth', modality: 'Mutable', ruler: 'Mercury' },
  { name: 'Libra', symbol: '♎', start: [9, 23], end: [10, 22], element: 'Air', modality: 'Cardinal', ruler: 'Venus' },
  { name: 'Scorpio', symbol: '♏', start: [10, 23], end: [11, 21], element: 'Water', modality: 'Fixed', ruler: 'Pluto', traditionalRuler: 'Mars' },
  { name: 'Sagittarius', symbol: '♐', start: [11, 22], end: [12, 21], element: 'Fire', modality: 'Mutable', ruler: 'Jupiter' },
  { name: 'Capricorn', symbol: '♑', start: [12, 22], end: [1, 19], element: 'Earth', modality: 'Cardinal', ruler: 'Saturn' },
  { name: 'Aquarius', symbol: '♒', start: [1, 20], end: [2, 18], element: 'Air', modality: 'Fixed', ruler: 'Uranus', traditionalRuler: 'Saturn' },
  { name: 'Pisces', symbol: '♓', start: [2, 19], end: [3, 20], element: 'Water', modality: 'Mutable', ruler: 'Neptune', traditionalRuler: 'Jupiter' },
]

export const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

/** True when the month/day exists (Feb 29 is accepted for leap years only). */
export function isValidDate(year: number, month: number, day: number): boolean {
  return Number.isInteger(year) && Number.isInteger(month) && Number.isInteger(day) && year >= 1 && year <= 9999 && month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month)
}

export function westernSign(month: number, day: number): Sign | null {
  if (!Number.isInteger(month) || !Number.isInteger(day) || month < 1 || month > 12 || day < 1 || day > 31) return null
  const md = month * 100 + day
  for (const s of SIGNS) {
    const a = s.start[0] * 100 + s.start[1]
    const b = s.end[0] * 100 + s.end[1]
    if (a <= b ? md >= a && md <= b : md >= a || md <= b) return s
  }
  return null
}

/** True on the first or last listed day of a sign, where the real boundary can differ by a day. */
export function isCuspDate(month: number, day: number): boolean {
  const s = westernSign(month, day)
  if (!s) return false
  return (month === s.start[0] && day === s.start[1]) || (month === s.end[0] && day === s.end[1])
}

export interface Birthstone {
  modern: string
  alternates: string
  traditional: string
}
/** Common US lists. Several bodies publish different lists, so treat these as one popular version. */
export const BIRTHSTONES: Birthstone[] = [
  { modern: 'Garnet', alternates: '', traditional: 'Garnet' },
  { modern: 'Amethyst', alternates: '', traditional: 'Amethyst' },
  { modern: 'Aquamarine', alternates: 'Bloodstone', traditional: 'Bloodstone' },
  { modern: 'Diamond', alternates: '', traditional: 'Diamond' },
  { modern: 'Emerald', alternates: '', traditional: 'Emerald' },
  { modern: 'Pearl', alternates: 'Moonstone, Alexandrite', traditional: 'Pearl' },
  { modern: 'Ruby', alternates: '', traditional: 'Ruby' },
  { modern: 'Peridot', alternates: 'Spinel, Sardonyx', traditional: 'Sardonyx' },
  { modern: 'Sapphire', alternates: '', traditional: 'Sapphire' },
  { modern: 'Opal', alternates: 'Tourmaline', traditional: 'Opal' },
  { modern: 'Topaz', alternates: 'Citrine', traditional: 'Topaz' },
  { modern: 'Turquoise', alternates: 'Tanzanite, Zircon', traditional: 'Turquoise' },
]
export const birthstone = (month: number): Birthstone | null => (Number.isInteger(month) && month >= 1 && month <= 12 ? BIRTHSTONES[month - 1] : null)

// ───────────── Chinese zodiac ─────────────
/**
 * Chinese New Year dates (month, day) in China Standard Time. Each date was checked against the
 * astronomical Chinese calendar and a published list. The table stops at 2026 on purpose.
 */
export const CNY_DATES: Record<number, [number, number]> = {
  1990: [1, 27], 1991: [2, 15], 1992: [2, 4], 1993: [1, 23], 1994: [2, 10], 1995: [1, 31], 1996: [2, 19], 1997: [2, 7], 1998: [1, 28],
  1999: [2, 16], 2000: [2, 5], 2001: [1, 24], 2002: [2, 12], 2003: [2, 1], 2004: [1, 22], 2005: [2, 9], 2006: [1, 29], 2007: [2, 18],
  2008: [2, 7], 2009: [1, 26], 2010: [2, 14], 2011: [2, 3], 2012: [1, 23], 2013: [2, 10], 2014: [1, 31], 2015: [2, 19], 2016: [2, 8],
  2017: [1, 28], 2018: [2, 16], 2019: [2, 5], 2020: [1, 25], 2021: [2, 12], 2022: [2, 1], 2023: [1, 22], 2024: [2, 10], 2025: [1, 29],
  2026: [2, 17],
}
export const CNY_FIRST_YEAR = 1990
export const CNY_LAST_YEAR = 2026

export const CHINESE_ANIMALS = ['Rat', 'Ox', 'Tiger', 'Rabbit', 'Dragon', 'Snake', 'Horse', 'Goat', 'Monkey', 'Rooster', 'Dog', 'Pig']
const CHINESE_ELEMENTS = ['Metal', 'Metal', 'Water', 'Water', 'Wood', 'Wood', 'Fire', 'Fire', 'Earth', 'Earth']

export const animalOfYear = (year: number): string => CHINESE_ANIMALS[(((year - 4) % 12) + 12) % 12]
export const elementOfYear = (year: number): string => CHINESE_ELEMENTS[((year % 10) + 10) % 10]

export interface ChineseResult {
  animal: string
  element: string
  /** Chinese year the birth falls in. */
  chineseYear: number
  /** True when the date could be before Chinese New Year and the table has no date for that year. */
  uncertain: boolean
  /** Other possible animal when uncertain. */
  alternative?: { animal: string; element: string; chineseYear: number }
  newYear?: [number, number]
}

export function chineseZodiac(year: number, month: number, day: number): ChineseResult | null {
  if (!isValidDate(year, month, day)) return null
  const known = CNY_DATES[year]
  const mk = (y: number) => ({ animal: animalOfYear(y), element: elementOfYear(y), chineseYear: y })
  if (known) {
    const before = month < known[0] || (month === known[0] && day < known[1])
    return { ...mk(before ? year - 1 : year), uncertain: false, newYear: known }
  }
  // Chinese New Year always falls between 21 January and 21 February.
  if (month > 2 || (month === 2 && day > 21)) return { ...mk(year), uncertain: false }
  if (month === 1 && day < 21) return { ...mk(year - 1), uncertain: false }
  return { ...mk(year), uncertain: true, alternative: mk(year - 1) }
}
