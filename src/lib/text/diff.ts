import { diffLines, diffWords, diffChars } from 'diff'

export interface Seg {
  text: string
  /** true when this fragment is the part that changed inside a changed line */
  changed?: boolean
}

export interface DiffRow {
  type: 'same' | 'added' | 'removed' | 'changed'
  left?: { no: number; segs: Seg[] }
  right?: { no: number; segs: Seg[] }
}

export interface DiffResult {
  rows: DiffRow[]
  added: number
  removed: number
  changed: number
  identical: boolean
}

export type DiffGranularity = 'lines' | 'words' | 'chars'

const splitLines = (value: string): string[] => {
  const lines = value.split('\n')
  if (lines[lines.length - 1] === '') lines.pop()
  return lines.map((l) => l.replace(/\r$/, ''))
}

function inlineDiff(a: string, b: string, granularity: DiffGranularity): { left: Seg[]; right: Seg[] } {
  const parts = granularity === 'chars' ? diffChars(a, b) : diffWords(a, b)
  const left: Seg[] = []
  const right: Seg[] = []
  for (const p of parts) {
    if (p.added) right.push({ text: p.value, changed: true })
    else if (p.removed) left.push({ text: p.value, changed: true })
    else {
      left.push({ text: p.value })
      right.push({ text: p.value })
    }
  }
  return { left, right }
}

/**
 * Line-based diff laid out for a side-by-side view. A removed block followed by an
 * added block is paired up line by line and marked as "changed", with the exact
 * changed words highlighted inside each line.
 */
export function buildSideBySide(a: string, b: string, opts: { granularity?: DiffGranularity; ignoreWhitespace?: boolean } = {}): DiffResult {
  const granularity = opts.granularity ?? 'words'
  const ignoreWhitespace = !!opts.ignoreWhitespace
  // Without a trailing newline the last line would count as changed whenever lines are added after it.
  const NL = String.fromCharCode(10)
  const withNewline = (v: string) => (v && !v.endsWith(NL) ? v + NL : v)
  const parts = diffLines(withNewline(a), withNewline(b), { ignoreWhitespace } as Parameters<typeof diffLines>[2])
  const rows: DiffRow[] = []
  let ln = 1
  let rn = 1
  let added = 0
  let removed = 0
  let changed = 0

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]
    const lines = splitLines(part.value)
    if (!part.added && !part.removed) {
      for (const l of lines) rows.push({ type: 'same', left: { no: ln++, segs: [{ text: l }] }, right: { no: rn++, segs: [{ text: l }] } })
      continue
    }
    if (part.removed) {
      const next = parts[i + 1]
      const nextLines = next?.added ? splitLines(next.value) : []
      const pairCount = Math.min(lines.length, nextLines.length)
      for (let k = 0; k < pairCount; k++) {
        const d = granularity === 'lines' ? { left: [{ text: lines[k], changed: true }], right: [{ text: nextLines[k], changed: true }] } : inlineDiff(lines[k], nextLines[k], granularity)
        rows.push({ type: 'changed', left: { no: ln++, segs: d.left }, right: { no: rn++, segs: d.right } })
        changed++
      }
      for (let k = pairCount; k < lines.length; k++) {
        rows.push({ type: 'removed', left: { no: ln++, segs: [{ text: lines[k], changed: true }] } })
        removed++
      }
      for (let k = pairCount; k < nextLines.length; k++) {
        rows.push({ type: 'added', right: { no: rn++, segs: [{ text: nextLines[k], changed: true }] } })
        added++
      }
      if (next?.added) i++
    } else if (part.added) {
      for (const l of lines) {
        rows.push({ type: 'added', right: { no: rn++, segs: [{ text: l, changed: true }] } })
        added++
      }
    }
  }
  return { rows, added, removed, changed, identical: added === 0 && removed === 0 && changed === 0 }
}
