export function cps(clicks: number, seconds: number): number {
  if (!(seconds > 0)) return 0
  return clicks / seconds
}

export function formatCps(v: number): string {
  return v.toFixed(2)
}

export function cpsRating(v: number): string {
  if (v < 3) return 'Casual clicking'
  if (v < 5) return 'Average'
  if (v < 7) return 'Quick'
  if (v < 9) return 'Fast'
  if (v < 12) return 'Very fast'
  return 'Extremely fast'
}

export const CPS_MODES = [5, 10, 30, 60] as const

export function average(values: number[]): number {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0
}

export function reactionRating(ms: number): string {
  if (ms < 150) return 'Extremely quick. Some of this may be anticipation.'
  if (ms < 200) return 'Very quick'
  if (ms < 250) return 'Quick'
  if (ms < 300) return 'Average'
  if (ms < 400) return 'A little slow'
  return 'Slow. Try again when you are rested and focused.'
}

/** Random wait before the signal, in ms. `unit` is a number in [0, 1). */
export function reactionDelay(unit: number, minMs = 1500, maxMs = 5000): number {
  return Math.round(minMs + Math.min(0.999999, Math.max(0, unit)) * (maxMs - minMs))
}

export interface KeyInfo {
  key: string
  code: string
  keyCode: number
  location: string
  modifiers: string[]
  repeat: boolean
}

export interface KeyEventLike {
  key: string
  code: string
  keyCode?: number
  location?: number
  ctrlKey?: boolean
  shiftKey?: boolean
  altKey?: boolean
  metaKey?: boolean
  repeat?: boolean
}

const LOCATIONS = ['Standard', 'Left', 'Right', 'Numpad']

export function keyInfo(e: KeyEventLike): KeyInfo {
  const modifiers: string[] = []
  if (e.ctrlKey) modifiers.push('Ctrl')
  if (e.shiftKey) modifiers.push('Shift')
  if (e.altKey) modifiers.push('Alt')
  if (e.metaKey) modifiers.push('Meta')
  return {
    key: e.key,
    code: e.code,
    keyCode: e.keyCode ?? 0,
    location: LOCATIONS[e.location ?? 0] ?? 'Standard',
    modifiers,
    repeat: !!e.repeat,
  }
}

/** Show whitespace keys in a readable way. */
export function displayKey(key: string): string {
  if (key === ' ') return 'Space'
  if (key === '') return '(empty)'
  return key
}

export function keyInfoText(i: KeyInfo): string {
  return [
    `key: ${i.key === ' ' ? '" "' : i.key}`,
    `code: ${i.code}`,
    `keyCode: ${i.keyCode} (legacy)`,
    `location: ${i.location}`,
    `modifiers: ${i.modifiers.length ? i.modifiers.join('+') : 'none'}`,
    `repeat: ${i.repeat}`,
  ].join('\n')
}
