/**
 * Pure helpers for page numbers and ranges. Pages are 1-based for people and
 * 0-based for pdf-lib; these helpers always say which one they return.
 */

export interface RangeParseResult {
  ok: boolean
  /** Each entry is one comma-separated item, as 1-based page numbers. */
  groups: number[][]
  error?: string
}

/** Parse "1-3, 5, 8-10" into groups of page numbers. A range may run backwards ("5-3"). */
export function parsePageRanges(input: string, pageCount: number): RangeParseResult {
  const text = input.trim()
  if (!text) return { ok: false, groups: [], error: 'Enter at least one page or range, for example 1-3, 5.' }
  const groups: number[][] = []
  for (const rawPart of text.split(',')) {
    const part = rawPart.trim()
    if (!part) continue
    const m = /^(\d+)\s*(?:[-–]\s*(\d+))?$/.exec(part)
    if (!m) return { ok: false, groups: [], error: `"${part}" is not a page number or range.` }
    const a = Number(m[1])
    const b = m[2] !== undefined ? Number(m[2]) : a
    if (a < 1 || b < 1 || a > pageCount || b > pageCount) {
      return { ok: false, groups: [], error: `"${part}" is outside this document, which has ${pageCount} page${pageCount === 1 ? '' : 's'}.` }
    }
    const lo = Math.min(a, b)
    const hi = Math.max(a, b)
    const pages: number[] = []
    if (a <= b) for (let p = lo; p <= hi; p++) pages.push(p)
    else for (let p = hi; p >= lo; p--) pages.push(p)
    groups.push(pages)
  }
  if (groups.length === 0) return { ok: false, groups: [], error: 'Enter at least one page or range, for example 1-3, 5.' }
  return { ok: true, groups }
}

export function rangeLabel(pages: number[]): string {
  if (pages.length === 1) return String(pages[0])
  const asc = pages.every((p, i) => i === 0 || p === pages[i - 1] + 1)
  const desc = pages.every((p, i) => i === 0 || p === pages[i - 1] - 1)
  if (asc || desc) return `${pages[0]}-${pages[pages.length - 1]}`
  return pages.join('_')
}

/** Select 1-based pages from 1..count, excluding the given set. Returns 0-based indexes. */
export function remainingIndexes(count: number, removed: Set<number>): number[] {
  const out: number[] = []
  for (let i = 0; i < count; i++) if (!removed.has(i)) out.push(i)
  return out
}

export function normalizeRotation(angle: number): 0 | 90 | 180 | 270 {
  return ((((Math.round(angle / 90) * 90) % 360) + 360) % 360) as 0 | 90 | 180 | 270
}
