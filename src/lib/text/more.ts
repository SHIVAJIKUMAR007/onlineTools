/** Caesar cipher, repeater, list joining, palindromes, readability and keyword density. */
import { graphemes, splitWords } from './index'

// ───────────── Caesar / ROT13 ─────────────
export function caesar(text: string, shift: number): string {
  const s = ((Math.trunc(shift) % 26) + 26) % 26
  return text.replace(/[a-z]/gi, (c) => {
    const base = c <= 'Z' ? 65 : 97
    return String.fromCharCode(((c.charCodeAt(0) - base + s) % 26) + base)
  })
}

// ───────────── Text repeater ─────────────
export const REPEAT_MAX_CHARS = 2_000_000

export function repeatText(text: string, count: number, separator: string): { output: string; truncated: boolean } {
  const n = Math.max(0, Math.floor(count))
  if (!text || !n) return { output: '', truncated: false }
  const unit = text.length + separator.length
  const allowed = Math.max(1, Math.floor(REPEAT_MAX_CHARS / unit))
  const times = Math.min(n, allowed)
  return { output: Array(times).fill(text).join(separator), truncated: times < n }
}

// ───────────── List ⇄ delimited ─────────────
export interface JoinOptions {
  separator: string
  quote: '' | "'" | '"'
  trim: boolean
  removeEmpty: boolean
  unique: boolean
}

export function linesToList(text: string, o: JoinOptions): string {
  let items = text.replace(/\r\n?/g, '\n').split('\n')
  if (o.trim) items = items.map((i) => i.trim())
  if (o.removeEmpty) items = items.filter((i) => i !== '')
  if (o.unique) items = [...new Set(items)]
  return items.map((i) => `${o.quote}${i}${o.quote}`).join(o.separator)
}

export function listToLines(text: string, separator: string, o: { trim: boolean; removeEmpty: boolean; unique: boolean; unquote: boolean }): string {
  if (!text) return ''
  let items = separator ? text.split(separator) : [text]
  if (o.trim) items = items.map((i) => i.trim())
  if (o.unquote) items = items.map((i) => i.replace(/^(['"])(.*)\1$/s, '$2'))
  if (o.removeEmpty) items = items.filter((i) => i !== '')
  if (o.unique) items = [...new Set(items)]
  return items.join('\n')
}

// ───────────── Palindrome ─────────────
export interface PalindromeResult {
  isPalindrome: boolean
  normalized: string
}

export function checkPalindrome(text: string, o: { ignoreCase: boolean; ignoreSpacesPunctuation: boolean }): PalindromeResult {
  let s = text.normalize('NFC')
  if (o.ignoreCase) s = s.toLowerCase()
  if (o.ignoreSpacesPunctuation) s = s.replace(/[^\p{L}\p{N}]+/gu, '')
  const g = graphemes(s)
  const isPalindrome = g.length > 0 && g.every((c, i) => c === g[g.length - 1 - i])
  return { isPalindrome, normalized: s }
}

// ───────────── Readability ─────────────
/** Heuristic English syllable count. Good to within a syllable on most words. */
export function countSyllables(word: string): number {
  let w = word.toLowerCase().replace(/[^a-z]/g, '')
  if (!w) return 0
  if (w.length <= 3) return 1
  w = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, '')
  const m = w.match(/[aeiouy]{1,2}/g)
  return Math.max(1, m ? m.length : 1)
}

export interface Readability {
  words: number
  sentences: number
  syllables: number
  characters: number
  fleschEase: number
  fleschKincaid: number
  gunningFog: number
  colemanLiau: number
  ari: number
  /** Average of the four grade-level scores. */
  averageGrade: number
}

export function readability(text: string): Readability | null {
  const words = text.match(/[\p{L}\p{N}'’-]+/gu) ?? []
  if (!words.length) return null
  const sentences = Math.max(1, (text.match(/[^.!?…]+[.!?…]+(?=\s|$)|[^.!?…]+$/g) ?? []).filter((s) => /[\p{L}\p{N}]/u.test(s)).length)
  const syl = words.map(countSyllables)
  const syllables = syl.reduce((a, b) => a + b, 0)
  const characters = words.join('').replace(/[^\p{L}\p{N}]/gu, '').length
  const complex = syl.filter((n) => n >= 3).length
  const W = words.length
  const fleschEase = 206.835 - 1.015 * (W / sentences) - 84.6 * (syllables / W)
  const fleschKincaid = 0.39 * (W / sentences) + 11.8 * (syllables / W) - 15.59
  const gunningFog = 0.4 * (W / sentences + 100 * (complex / W))
  const colemanLiau = 0.0588 * ((characters / W) * 100) - 0.296 * ((sentences / W) * 100) - 15.8
  const ari = 4.71 * (characters / W) + 0.5 * (W / sentences) - 21.43
  const averageGrade = (fleschKincaid + gunningFog + colemanLiau + ari) / 4
  return { words: W, sentences, syllables, characters, fleschEase, fleschKincaid, gunningFog, colemanLiau, ari, averageGrade }
}

export function easeLabel(score: number): string {
  if (score >= 90) return 'Very easy (5th grade)'
  if (score >= 80) return 'Easy (6th grade)'
  if (score >= 70) return 'Fairly easy (7th grade)'
  if (score >= 60) return 'Plain English (8th to 9th grade)'
  if (score >= 50) return 'Fairly difficult (10th to 12th grade)'
  if (score >= 30) return 'Difficult (college)'
  return 'Very difficult (graduate)'
}

// ───────────── Keyword density ─────────────
export const STOP_WORDS = new Set(
  'a an and are as at be but by for from has have he her his i if in into is it its me my no not of on or our she so than that the their them then there these they this to too us was we were what when which who will with you your'.split(' '),
)

export interface KeywordRow {
  phrase: string
  count: number
  percent: number
}

export function keywordDensity(text: string, o: { size: 1 | 2 | 3; skipStopWords: boolean; minCount: number }): { rows: KeywordRow[]; totalWords: number } {
  const words = (text.toLowerCase().match(/[\p{L}\p{N}]+(?:['’][\p{L}]+)?/gu) ?? []).map((w) => w.replace(/’/g, "'"))
  const total = words.length
  const counts = new Map<string, number>()
  for (let i = 0; i + o.size <= words.length; i++) {
    const gram = words.slice(i, i + o.size)
    if (o.skipStopWords) {
      // Single words must not be stop words. Phrases must not start or end with one.
      if (STOP_WORDS.has(gram[0]) || STOP_WORDS.has(gram[gram.length - 1])) continue
    }
    const key = gram.join(' ')
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  const rows = [...counts.entries()]
    .filter(([, c]) => c >= o.minCount)
    .map(([phrase, count]) => ({ phrase, count, percent: total ? (count / total) * 100 : 0 }))
    .sort((a, b) => b.count - a.count || a.phrase.localeCompare(b.phrase))
  return { rows, totalWords: total }
}

export { splitWords }
