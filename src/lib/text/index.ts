// ───────────── Word counter ─────────────

export interface TextStats {
  words: number
  characters: number
  charactersNoSpaces: number
  sentences: number
  paragraphs: number
  lines: number
  readingMinutes: number
  speakingMinutes: number
}

export const READING_WPM = 238
export const SPEAKING_WPM = 150

export function textStats(text: string): TextStats {
  const trimmed = text.trim()
  const words = trimmed ? trimmed.split(/\s+/).length : 0
  const characters = Array.from(text).length
  const charactersNoSpaces = Array.from(text.replace(/\s/g, '')).length
  // A sentence ends with . ! ? (or … ) followed by space/end. Runs like "?!" or "..." count once.
  const sentences = trimmed ? (trimmed.match(/[^.!?…]+[.!?…]+(?=\s|$)|[^.!?…]+$/g) ?? []).filter((s) => /\S/.test(s)).length : 0
  const paragraphs = trimmed ? trimmed.split(/\n\s*\n/).filter((p) => p.trim()).length : 0
  const lines = text ? text.split(/\r?\n/).length : 0
  return {
    words,
    characters,
    charactersNoSpaces,
    sentences,
    paragraphs,
    lines,
    readingMinutes: words / READING_WPM,
    speakingMinutes: words / SPEAKING_WPM,
  }
}

export function formatMinutes(minutes: number): string {
  if (minutes <= 0) return '0 sec'
  const totalSeconds = Math.round(minutes * 60)
  if (totalSeconds < 60) return `${Math.max(totalSeconds, 1)} sec`
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return s ? `${m} min ${s} sec` : `${m} min`
}

// ───────────── Case converter ─────────────

const SMALL_WORDS = new Set([
  'a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'if', 'in', 'nor', 'of', 'on', 'or', 'per', 'the', 'to', 'vs', 'via',
])

/** Split into words on spaces, punctuation separators and camelCase boundaries. */
export function splitWords(text: string): string[] {
  return text
    .replace(/([\p{Ll}\d])(\p{Lu})/gu, '$1 $2')
    .replace(/(\p{Lu}+)(\p{Lu}\p{Ll})/gu, '$1 $2')
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
}

export type CaseKind = 'upper' | 'lower' | 'title' | 'sentence' | 'camel' | 'pascal' | 'snake' | 'kebab' | 'constant'

export function convertCase(text: string, kind: CaseKind): string {
  switch (kind) {
    case 'upper':
      return text.toUpperCase()
    case 'lower':
      return text.toLowerCase()
    case 'title': {
      let first = true
      return text.toLowerCase().replace(/[\p{L}\p{N}][\p{L}\p{N}']*/gu, (w, offset: number) => {
        const isFirst = first
        first = false
        // Keep small words lowercase unless they open the text or follow a sentence break.
        const before = text.slice(0, offset).trimEnd()
        const afterBreak = /[.!?:]$/.test(before) || before.endsWith('\n')
        if (!isFirst && !afterBreak && SMALL_WORDS.has(w)) return w
        return w.charAt(0).toUpperCase() + w.slice(1)
      })
    }
    case 'sentence': {
      const lower = text.toLowerCase()
      return lower.replace(/(^\s*|[.!?]\s+|\n\s*)(\p{L})/gu, (_m, pre: string, ch: string) => pre + ch.toUpperCase())
    }
    case 'camel': {
      const w = splitWords(text).map((x) => x.toLowerCase())
      return w.map((x, i) => (i === 0 ? x : x.charAt(0).toUpperCase() + x.slice(1))).join('')
    }
    case 'pascal':
      return splitWords(text)
        .map((x) => x.toLowerCase())
        .map((x) => x.charAt(0).toUpperCase() + x.slice(1))
        .join('')
    case 'snake':
      return splitWords(text).map((x) => x.toLowerCase()).join('_')
    case 'kebab':
      return splitWords(text).map((x) => x.toLowerCase()).join('-')
    case 'constant':
      return splitWords(text).map((x) => x.toUpperCase()).join('_')
  }
}

// ───────────── Duplicate lines ─────────────

export interface DedupeOptions {
  caseSensitive: boolean
  trim: boolean
  removeEmpty: boolean
}

export function removeDuplicateLines(text: string, opts: DedupeOptions): { output: string; removed: number; kept: number } {
  const lines = text.split(/\r?\n/)
  const seen = new Set<string>()
  const out: string[] = []
  let removed = 0
  for (const line of lines) {
    const candidate = opts.trim ? line.trim() : line
    if (opts.removeEmpty && candidate.trim() === '') {
      removed++
      continue
    }
    const key = opts.caseSensitive ? candidate : candidate.toLowerCase()
    if (seen.has(key)) {
      removed++
      continue
    }
    seen.add(key)
    out.push(candidate)
  }
  return { output: out.join('\n'), removed, kept: out.length }
}

// ───────────── Reverse ─────────────

const segmenter = typeof Intl !== 'undefined' && 'Segmenter' in Intl ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null

export function graphemes(text: string): string[] {
  if (segmenter) return Array.from(segmenter.segment(text), (s) => s.segment)
  return Array.from(text)
}

export type ReverseMode = 'characters' | 'words' | 'lines'

export function reverseText(text: string, mode: ReverseMode): string {
  switch (mode) {
    case 'characters':
      return graphemes(text).reverse().join('')
    case 'words':
      // Reverse word order within each line, preserving line breaks.
      return text
        .split(/\r?\n/)
        .map((line) => line.split(/\s+/).filter(Boolean).reverse().join(' '))
        .join('\n')
    case 'lines':
      return text.split(/\r?\n/).reverse().join('\n')
  }
}

// ───────────── Lorem ipsum ─────────────

const LOREM_WORDS = (
  'lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua ' +
  'ut enim ad minim veniam quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat duis aute irure ' +
  'dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur excepteur sint occaecat cupidatat non ' +
  'proident sunt in culpa qui officia deserunt mollit anim id est laborum sed ut perspiciatis unde omnis iste natus error sit ' +
  'voluptatem accusantium doloremque laudantium totam rem aperiam eaque ipsa quae ab illo inventore veritatis et quasi architecto ' +
  'beatae vitae dicta sunt explicabo nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit sed quia ' +
  'consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt neque porro quisquam est qui dolorem ipsum quia dolor ' +
  'sit amet consectetur adipisci velit sed quia non numquam eius modi tempora incidunt ut labore et dolore magnam aliquam quaerat'
).split(' ')

export type LoremUnit = 'paragraphs' | 'sentences' | 'words'

export type Rng = () => number

export function loremWords(count: number, rng: Rng = Math.random, classic = false): string[] {
  const out: string[] = []
  if (classic) out.push(...LOREM_WORDS.slice(0, 5))
  while (out.length < count) out.push(LOREM_WORDS[Math.floor(rng() * LOREM_WORDS.length)])
  return out.slice(0, count)
}

function sentence(rng: Rng, startWords?: string[]): string {
  const length = 8 + Math.floor(rng() * 10)
  const words = startWords ? [...startWords, ...loremWords(length - startWords.length, rng)] : loremWords(length, rng)
  const body = words.join(' ')
  // Add one comma in longer sentences.
  const parts = body.split(' ')
  if (parts.length > 10) parts[4 + Math.floor(rng() * 3)] += ','
  const joined = parts.join(' ')
  return joined.charAt(0).toUpperCase() + joined.slice(1) + '.'
}

export function generateLorem(unit: LoremUnit, count: number, opts: { classic: boolean; rng?: Rng } = { classic: true }): string {
  const rng = opts.rng ?? Math.random
  const n = Math.max(1, Math.floor(count))
  const opening = opts.classic ? LOREM_WORDS.slice(0, 5) : undefined
  if (unit === 'words') {
    const w = loremWords(n, rng, opts.classic)
    return w.join(' ')
  }
  if (unit === 'sentences') {
    return Array.from({ length: n }, (_, i) => sentence(rng, i === 0 ? opening : undefined)).join(' ')
  }
  return Array.from({ length: n }, (_, p) => {
    const sentenceCount = 4 + Math.floor(rng() * 4)
    return Array.from({ length: sentenceCount }, (_, i) => sentence(rng, p === 0 && i === 0 ? opening : undefined)).join(' ')
  }).join('\n\n')
}
