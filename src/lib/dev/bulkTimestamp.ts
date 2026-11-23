// Bulk Unix timestamp <-> date conversion. One input per line.

export type Zone = 'utc' | 'local'
export type UnitMode = 'auto' | 's' | 'ms'

export interface TsRow {
  input: string
  kind: 'unix' | 'date' | 'error'
  unit?: 's' | 'ms' | 'us' | 'ns'
  ms?: number
  seconds?: number
  iso?: string
  formatted?: string
  error?: string
}

const MAX_MS = 8.64e15
const pad = (n: number, w = 2) => String(Math.abs(n)).padStart(w, '0')

export function formatInZone(date: Date, zone: Zone): string {
  if (zone === 'utc') {
    return `${pad(date.getUTCFullYear(), 4)}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())} UTC`
  }
  const off = -date.getTimezoneOffset()
  const sign = off >= 0 ? '+' : '-'
  return `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())} UTC${sign}${pad(Math.floor(Math.abs(off) / 60))}:${pad(Math.abs(off) % 60)}`
}

function detectUnit(digits: number, mode: UnitMode): 's' | 'ms' | 'us' | 'ns' {
  if (mode === 's') return 's'
  if (mode === 'ms') return 'ms'
  if (digits <= 11) return 's'
  if (digits <= 13) return 'ms'
  if (digits <= 16) return 'us'
  return 'ns'
}

const DIVISOR = { s: 0.001, ms: 1, us: 1000, ns: 1_000_000 } as const

function parseDate(text: string, zone: Zone): number {
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s]+(\d{1,2}):(\d{2})(?::(\d{2})(?:[.,](\d{1,9}))?)?)?$/.exec(text)
  if (m) {
    const [y, mo, d, h, mi, s] = [m[1], m[2], m[3], m[4] ?? '0', m[5] ?? '0', m[6] ?? '0'].map(Number)
    const msPart = Math.floor(Number(('0.' + (m[7] ?? '0')).slice(0, 5)) * 1000)
    if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59 || s > 59) return NaN
    const t = zone === 'utc' ? Date.UTC(y, mo - 1, d, h, mi, s, msPart) : new Date(y, mo - 1, d, h, mi, s, msPart).getTime()
    // Reject overflow such as 2024-02-31.
    const back = new Date(t)
    const gotDay = zone === 'utc' ? back.getUTCDate() : back.getDate()
    return gotDay === d ? t : NaN
  }
  // Anything else (RFC 2822, ISO with a zone, "Jan 5, 2024 10:00 UTC") goes through Date.parse.
  if (!/[A-Za-z]/.test(text) && !/^\d{4}[-/]/.test(text) && !/^\d{1,2}\/\d{1,2}\/\d{4}/.test(text)) return NaN
  return Date.parse(text)
}

export function convertLine(raw: string, zone: Zone, mode: UnitMode): TsRow {
  const input = raw.trim()
  let ms: number
  let unit: TsRow['unit']
  let kind: TsRow['kind'] = 'date'
  if (/^-?\d+(\.\d+)?$/.test(input)) {
    kind = 'unix'
    const digits = input.replace(/^-/, '').split('.')[0].length
    unit = detectUnit(digits, mode)
    ms = Number(input) / DIVISOR[unit]
  } else {
    ms = parseDate(input, zone)
  }
  if (!Number.isFinite(ms) || Math.abs(ms) > MAX_MS) {
    return { input, kind: 'error', error: kind === 'unix' ? 'Number is outside the supported date range.' : 'Not a recognised timestamp or date.' }
  }
  ms = Math.round(ms)
  const date = new Date(ms)
  return { input, kind, unit, ms, seconds: Math.floor(ms / 1000), iso: date.toISOString(), formatted: formatInZone(date, zone) }
}

export function convertBulk(text: string, zone: Zone, mode: UnitMode, maxLines = 5000): { rows: TsRow[]; truncated: boolean } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '')
  const truncated = lines.length > maxLines
  return { rows: lines.slice(0, maxLines).map((l) => convertLine(l, zone, mode)), truncated }
}

const csvCell = (s: string) => (/[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s)

export function rowsToCsv(rows: TsRow[]): string {
  const head = ['input', 'type', 'unit', 'unix_seconds', 'unix_ms', 'iso_utc', 'formatted', 'error']
  const lines = rows.map((r) =>
    [r.input, r.kind === 'unix' ? 'timestamp' : r.kind === 'date' ? 'date' : 'error', r.unit ?? '', r.seconds ?? '', r.ms ?? '', r.iso ?? '', r.formatted ?? '', r.error ?? '']
      .map((c) => csvCell(String(c)))
      .join(','),
  )
  return [head.join(','), ...lines].join('\n')
}
