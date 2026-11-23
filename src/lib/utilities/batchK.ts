import { cryptoSource, randomBelow, shuffle, type Uint32Source } from './random'
import { TYPING_PASSAGES } from './batchKData'

// ───────────── Typing test ─────────────
export const TYPING_DURATIONS = [30, 60, 120] as const

/** Join passages starting at `start` until the text is at least `minChars` long. */
export function buildTypingText(passages: readonly string[], start: number, minChars: number): string {
  if (passages.length === 0) return ''
  const parts: string[] = []
  let len = 0
  for (let i = 0; len < minChars && i < passages.length * 2; i++) {
    const p = passages[(((start + i) % passages.length) + passages.length) % passages.length]
    parts.push(p)
    len += p.length + 1
  }
  return parts.join(' ')
}

/** Characters needed so that even a very fast typist will not run out within the duration. */
export const typingTextLength = (seconds: number) => Math.ceil((seconds / 60) * 1000 * 1.5)

export const defaultTypingText = (seconds: number) => buildTypingText(TYPING_PASSAGES, 0, typingTextLength(seconds))

export function randomTypingText(seconds: number, src: Uint32Source = cryptoSource): string {
  return buildTypingText(TYPING_PASSAGES, randomBelow(TYPING_PASSAGES.length, src), typingTextLength(seconds))
}

export type CharState = 'correct' | 'wrong' | 'pending'

/** State of each target character against what has been typed so far. */
export function charStates(target: string, typed: string): CharState[] {
  return Array.from({ length: target.length }, (_, i) => (i >= typed.length ? 'pending' : typed[i] === target[i] ? 'correct' : 'wrong'))
}

export interface TypingScore {
  typedChars: number
  correctChars: number
  errors: number
  /** Net speed: correct characters / 5 per minute. */
  wpm: number
  /** Gross speed: all typed characters / 5 per minute. */
  rawWpm: number
  /** Percentage of typed characters that are correct, 0 to 100. */
  accuracy: number
}

export function scoreTyping(target: string, typed: string, elapsedSeconds: number): TypingScore {
  const typedChars = Math.min(typed.length, target.length)
  let correctChars = 0
  for (let i = 0; i < typedChars; i++) if (typed[i] === target[i]) correctChars++
  const minutes = elapsedSeconds > 0 ? elapsedSeconds / 60 : 0
  const wpm = minutes > 0 ? correctChars / 5 / minutes : 0
  const rawWpm = minutes > 0 ? typedChars / 5 / minutes : 0
  return {
    typedChars,
    correctChars,
    errors: typedChars - correctChars,
    wpm,
    rawWpm,
    accuracy: typedChars > 0 ? (correctChars / typedChars) * 100 : 100,
  }
}

export function typingRating(wpm: number): string {
  if (wpm < 20) return 'Just getting started'
  if (wpm < 40) return 'Average typist'
  if (wpm < 60) return 'Above average'
  if (wpm < 80) return 'Fast'
  return 'Very fast'
}

export function typingSummary(s: TypingScore, seconds: number): string {
  return `Typing test (${seconds}s): ${Math.round(s.wpm)} WPM, ${Math.round(s.rawWpm)} raw WPM, ${s.accuracy.toFixed(1)}% accuracy, ${s.errors} errors`
}

// ───────────── Team picker ─────────────
export const MAX_NAMES = 5000

export function parseNames(text: string, dedupe = false): string[] {
  const names = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, MAX_NAMES)
  if (!dedupe) return names
  const seen = new Set<string>()
  return names.filter((n) => {
    const k = n.toLowerCase()
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

/** Pick `count` distinct entries (by position) at random, in the order drawn. */
export function pickWinners(names: readonly string[], count: number, src: Uint32Source = cryptoSource): string[] {
  const n = Math.max(0, Math.min(names.length, Math.floor(count) || 0))
  return shuffle(names, src).slice(0, n)
}

export type SplitMode = 'teams' | 'size'

/** Number of teams a split produces, or 0 when the settings are not usable. */
export function teamCount(total: number, mode: SplitMode, value: number): number {
  const v = Math.floor(value)
  if (!Number.isFinite(v) || v < 1 || total < 1) return 0
  return mode === 'teams' ? Math.min(v, total) : Math.ceil(total / v)
}

/** Shuffle and deal into teams. Team sizes differ by at most one, and no team exceeds the size limit. */
export function splitTeams(names: readonly string[], mode: SplitMode, value: number, src: Uint32Source = cryptoSource): string[][] {
  const k = teamCount(names.length, mode, value)
  if (k === 0) return []
  const teams: string[][] = Array.from({ length: k }, () => [])
  shuffle(names, src).forEach((name, i) => teams[i % k].push(name))
  return teams
}

export function teamsToText(teams: readonly (readonly string[])[]): string {
  return teams.map((t, i) => `Team ${i + 1}: ${t.join(', ')}`).join('\n')
}

export function winnersToText(winners: readonly string[]): string {
  return winners.map((w, i) => `${i + 1}. ${w}`).join('\n')
}

// ───────────── Prompt deck ─────────────
export interface DeckState {
  order: number[]
  pos: number
}

export const emptyDeck = (): DeckState => ({ order: [], pos: 0 })

/**
 * Draw the next prompt index from a shuffled deck. Every prompt appears once before any repeats.
 * When the deck runs out it is reshuffled, and the first card is never the one just shown.
 */
export function drawPrompt(deck: DeckState, total: number, src: Uint32Source = cryptoSource): { index: number; deck: DeckState; reshuffled: boolean } {
  if (total < 1) throw new RangeError('No prompts')
  const valid = deck.order.length === total && deck.pos < total
  if (valid) return { index: deck.order[deck.pos], deck: { order: deck.order, pos: deck.pos + 1 }, reshuffled: false }
  const last = deck.order.length === total && deck.pos > 0 ? deck.order[deck.pos - 1] : -1
  let order = shuffle(Array.from({ length: total }, (_, i) => i), src)
  if (total > 1 && order[0] === last) {
    const j = 1 + randomBelow(total - 1, src)
    ;[order[0], order[j]] = [order[j], order[0]]
  }
  order = order.slice()
  return { index: order[0], deck: { order, pos: 1 }, reshuffled: deck.order.length > 0 }
}

// ───────────── Number memory ─────────────
export function generateDigits(count: number, src: Uint32Source = cryptoSource): string {
  const n = Math.max(1, Math.min(40, Math.floor(count) || 1))
  let s = String(1 + randomBelow(9, src))
  for (let i = 1; i < n; i++) s += String(randomBelow(10, src))
  return s
}

/** How long the number stays visible, in ms. */
export const memoryShowMs = (digits: number) => 1000 + 500 * Math.max(1, digits)

export function checkDigits(expected: string, answer: string): boolean {
  return answer.replace(/\s+/g, '') === expected
}
