// RFC 4180 style delimited text parsing. Pure logic.

export type CsvDelimiter = ',' | ';' | '\t' | '|'
export const DELIMITERS: CsvDelimiter[] = [',', ';', '\t', '|']

export interface ParseResult {
  rows: string[][]
  error?: string
}

/** Parse delimited text. Handles quoted fields, "" escapes, embedded delimiters and newlines. */
export function parseDelimited(input: string, delimiter: string): ParseResult {
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  let quoted = false
  let i = 0
  const n = text.length
  const endField = () => {
    row.push(field)
    field = ''
    quoted = false
  }
  const endRow = () => {
    endField()
    rows.push(row)
    row = []
  }
  while (i < n) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i += 2
          continue
        }
        inQuotes = false
        i++
        continue
      }
      field += c
      i++
      continue
    }
    if (c === '"' && field === '' && !quoted) {
      inQuotes = true
      quoted = true
      i++
      continue
    }
    if (c === delimiter) {
      endField()
      i++
      continue
    }
    if (c === '\r') {
      endRow()
      i += text[i + 1] === '\n' ? 2 : 1
      continue
    }
    if (c === '\n') {
      endRow()
      i++
      continue
    }
    field += c
    i++
  }
  if (inQuotes) return { rows, error: 'A quoted field is never closed. Check for a missing closing double quote.' }
  if (field !== '' || quoted || row.length) endRow()
  return { rows: rows.filter((r) => !(r.length === 1 && r[0] === '')) }
}

/** Guess the delimiter: the one with the most consistent, non-zero count per line. */
export function detectDelimiter(text: string): CsvDelimiter {
  const sample = text.split(/\r\n|\n|\r/).slice(0, 12)
  let best: CsvDelimiter = ','
  let bestScore = 0
  for (const d of DELIMITERS) {
    const counts = sample
      .filter((l) => l.trim())
      .map((l) => {
        let q = false
        let c = 0
        for (const ch of l) {
          if (ch === '"') q = !q
          else if (ch === d && !q) c++
        }
        return c
      })
    if (!counts.length || counts[0] === 0) continue
    const consistent = counts.filter((c) => c === counts[0]).length / counts.length
    const score = counts[0] * consistent
    if (score > bestScore) {
      best = d
      bestScore = score
    }
  }
  return best
}

const NUM = /^-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?$/

export function inferValue(s: string): string | number | boolean | null {
  if (s === 'true') return true
  if (s === 'false') return false
  if (s === 'null') return null
  if (NUM.test(s)) {
    const n = Number(s)
    if (Number.isFinite(n) && (Number.isSafeInteger(n) || /[.eE]/.test(s))) return n
  }
  return s
}

export interface CsvToJsonOptions {
  delimiter: 'auto' | CsvDelimiter
  header: boolean
  shape: 'objects' | 'arrays'
  infer: boolean
}

export interface CsvToJsonResult {
  value: unknown[]
  delimiter: CsvDelimiter
  rowCount: number
  columns: string[]
  error?: string
}

export function csvToJson(text: string, o: CsvToJsonOptions): CsvToJsonResult {
  const delimiter = o.delimiter === 'auto' ? detectDelimiter(text) : o.delimiter
  const { rows, error } = parseDelimited(text, delimiter)
  if (error) return { value: [], delimiter, rowCount: 0, columns: [], error }
  const conv = (s: string) => (o.infer ? inferValue(s) : s)
  if (!rows.length) return { value: [], delimiter, rowCount: 0, columns: [] }
  if (o.shape === 'arrays') {
    return { value: rows.map((r) => r.map(conv)), delimiter, rowCount: rows.length, columns: [] }
  }
  const width = Math.max(...rows.map((r) => r.length))
  let names: string[]
  let data: string[][]
  if (o.header) {
    const seen = new Map<string, number>()
    names = Array.from({ length: width }, (_, i) => {
      const raw = (rows[0][i] ?? '').trim() || `column_${i + 1}`
      const c = (seen.get(raw) ?? 0) + 1
      seen.set(raw, c)
      return c === 1 ? raw : `${raw}_${c}`
    })
    data = rows.slice(1)
  } else {
    names = Array.from({ length: width }, (_, i) => `column_${i + 1}`)
    data = rows
  }
  const value = data.map((r) => {
    const obj: Record<string, unknown> = {}
    names.forEach((nm, i) => {
      obj[nm] = i < r.length ? conv(r[i]) : o.infer ? null : ''
    })
    return obj
  })
  return { value, delimiter, rowCount: data.length, columns: names }
}
