/** Morse code and Roman numeral conversion. */

const MORSE: Record<string, string> = {
  A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.', H: '....', I: '..', J: '.---', K: '-.-', L: '.-..', M: '--',
  N: '-.', O: '---', P: '.--.', Q: '--.-', R: '.-.', S: '...', T: '-', U: '..-', V: '...-', W: '.--', X: '-..-', Y: '-.--', Z: '--..',
  '0': '-----', '1': '.----', '2': '..---', '3': '...--', '4': '....-', '5': '.....', '6': '-....', '7': '--...', '8': '---..', '9': '----.',
  '.': '.-.-.-', ',': '--..--', '?': '..--..', "'": '.----.', '!': '-.-.--', '/': '-..-.', '(': '-.--.', ')': '-.--.-', '&': '.-...',
  ':': '---...', ';': '-.-.-.', '=': '-...-', '+': '.-.-.', '-': '-....-', _: '..--.-', '"': '.-..-.', $: '...-..-', '@': '.--.-.',
}
const REVERSE = Object.fromEntries(Object.entries(MORSE).map(([k, v]) => [v, k]))

export interface MorseResult {
  output: string
  /** Characters that have no Morse code and were left out. */
  skipped: string[]
}

/** Letters are separated by one space and words by " / ". */
export function textToMorse(text: string): MorseResult {
  const skipped: string[] = []
  const words = text
    .toUpperCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) =>
      [...w]
        .map((c) => {
          if (MORSE[c]) return MORSE[c]
          if (!skipped.includes(c)) skipped.push(c)
          return ''
        })
        .filter(Boolean)
        .join(' '),
    )
    .filter(Boolean)
  return { output: words.join(' / '), skipped }
}

export function morseToText(code: string): MorseResult {
  const skipped: string[] = []
  // Accept the Unicode dot and dash look-alikes people paste.
  const norm = code.replace(/[•·∙]/g, '.').replace(/[–—−_]/g, '-')
  const words = norm
    .trim()
    .split(/\s*(?:\/|\|)\s*|\s{3,}|\n+/)
    .map((w) =>
      w
        .split(/\s+/)
        .filter(Boolean)
        .map((sym) => {
          if (REVERSE[sym]) return REVERSE[sym]
          if (!skipped.includes(sym)) skipped.push(sym)
          return '?'
        })
        .join(''),
    )
    .filter(Boolean)
  return { output: words.join(' '), skipped }
}

// ───────────── Roman numerals ─────────────
const ROMAN: [number, string][] = [
  [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
]

export const ROMAN_MAX = 3999

export function numberToRoman(n: number): string {
  if (!Number.isInteger(n) || n < 1 || n > ROMAN_MAX) throw new RangeError(`Enter a whole number from 1 to ${ROMAN_MAX}.`)
  let out = ''
  for (const [v, s] of ROMAN) while (n >= v) ((out += s), (n -= v))
  return out
}

export function romanToNumber(input: string): number {
  const s = input.trim().toUpperCase()
  if (!/^[MDCLXVI]+$/.test(s)) throw new SyntaxError('Use only the letters I, V, X, L, C, D and M.')
  const val: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 }
  let total = 0
  for (let i = 0; i < s.length; i++) {
    const cur = val[s[i]]
    const next = val[s[i + 1]] ?? 0
    total += cur < next ? -cur : cur
  }
  // Round-trip check rejects non-standard forms such as IIII, VX or IC.
  if (total < 1 || total > ROMAN_MAX || numberToRoman(total) !== s) throw new SyntaxError(`"${s}" is not a valid Roman numeral.`)
  return total
}
