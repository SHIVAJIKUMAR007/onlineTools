/** About 100 very common passwords. Used only to flag obvious choices; this is not a breach database. */
export const COMMON_PASSWORDS: readonly string[] = Array.from(
  new Set(
    (
      'password 123456 123456789 12345678 12345 1234567 1234567890 1234 000000 111111 654321 666666 121212 112233 123123 987654321 qwerty qwertyuiop qwerty123 abc123 football baseball basketball soccer hockey ' +
      'monkey letmein dragon iloveyou trustno1 sunshine master welcome shadow ashley bailey superman qazwsx michael admin login princess starwars hello freedom whatever jordan charlie donald password1 passw0rd ' +
      'zaq12wsx mustang access flower cheese loveme batman pokemon jennifer hunter buster harley ranger thomas tigger robert daniel george andrew joshua matthew summer internet computer secret killer jessica ' +
      'pepper 1q2w3e asdfgh asdfghjkl zxcvbn zxcvbnm lovely monster matrix ginger cookie merlin austin orange banana yankees biteme maggie chocolate london welcome1 changeme test guest root default letmein1 ' +
      'qwe123 iloveu 1qaz2wsx google hannah nicole samantha liverpool arsenal chelsea cricket'
    ).split(' '),
  ),
)

const LEET: Record<string, string> = { '@': 'a', '4': 'a', '3': 'e', '1': 'i', '!': 'i', '0': 'o', $: 's', '5': 's', '7': 't', '+': 't' }
const ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm', '1234567890', 'qazwsxedcrfv']

export interface Segment {
  start: number
  end: number // exclusive
  kind: 'common' | 'leet' | 'sequence' | 'walk' | 'repeat' | 'year'
  bits: number
  note: string
}

export interface Analysis {
  length: number
  classes: { lower: boolean; upper: boolean; digits: boolean; symbols: boolean }
  poolSize: number
  naiveBits: number
  bits: number
  segments: Segment[]
  score: 0 | 1 | 2 | 3 | 4
  label: string
  suggestions: string[]
}

export const SCORE_LABELS = ['Very weak', 'Weak', 'Fair', 'Strong', 'Very strong'] as const

export function charPool(pw: string): { classes: Analysis['classes']; pool: number } {
  const classes = {
    lower: /[a-z]/.test(pw),
    upper: /[A-Z]/.test(pw),
    digits: /[0-9]/.test(pw),
    symbols: /[^A-Za-z0-9]/.test(pw),
  }
  const pool = (classes.lower ? 26 : 0) + (classes.upper ? 26 : 0) + (classes.digits ? 10 : 0) + (classes.symbols ? 33 : 0)
  return { classes, pool }
}

export function findSegments(pw: string, pool: number): Segment[] {
  const out: Segment[] = []
  const lower = pw.toLowerCase()
  const n = pw.length
  const log = Math.log2

  // Common passwords, including simple leetspeak.
  const deleet = Array.from(lower, (c) => LEET[c] ?? c).join('')
  const listBits = log(COMMON_PASSWORDS.length)
  for (const w of COMMON_PASSWORDS) {
    if (w.length < 4) continue
    for (const [hay, leet] of [[lower, false], [deleet, true]] as const) {
      let i = hay.indexOf(w)
      while (i !== -1) {
        const isLeet = leet && lower.slice(i, i + w.length) !== w
        if (!leet || isLeet) {
          const piece = pw.slice(i, i + w.length)
          out.push({
            start: i,
            end: i + w.length,
            kind: isLeet ? 'leet' : 'common',
            bits: listBits + (isLeet ? 2 : 0) + (piece !== lower.slice(i, i + w.length) ? 1 : 0),
            note: isLeet ? `"${piece}" is a common password with letters swapped for look-alike symbols` : `"${piece}" is a very common password`,
          })
        }
        i = hay.indexOf(w, i + 1)
      }
    }
  }

  // Sequences such as abc, 321, XYZ.
  let i = 0
  while (i < n - 2) {
    const step = lower.charCodeAt(i + 1) - lower.charCodeAt(i)
    if (Math.abs(step) === 1 && /[a-z0-9]/.test(lower[i]) && /[a-z0-9]/.test(lower[i + 1])) {
      let j = i + 1
      while (j + 1 < n && lower.charCodeAt(j + 1) - lower.charCodeAt(j) === step && /[a-z0-9]/.test(lower[j + 1])) j++
      const len = j - i + 1
      if (len >= 3) {
        out.push({ start: i, end: j + 1, kind: 'sequence', bits: log(/[0-9]/.test(lower[i]) ? 10 : 26) + log(len) + 1, note: `"${pw.slice(i, j + 1)}" is a straight sequence` })
        i = j
      }
    }
    i++
  }

  // Keyboard walks (4 or more keys in a row, either direction).
  for (const row of ROWS) {
    for (const r of [row, [...row].reverse().join('')]) {
      for (let a = 0; a + 4 <= r.length; a++) {
        let b = a + 4
        if (!lower.includes(r.slice(a, b))) continue
        while (b < r.length && lower.includes(r.slice(a, b + 1))) b++
        const piece = r.slice(a, b)
        let at = lower.indexOf(piece)
        while (at !== -1) {
          out.push({ start: at, end: at + piece.length, kind: 'walk', bits: log(ROWS.length * 2) + log(piece.length) + 2, note: `"${pw.slice(at, at + piece.length)}" follows a keyboard row` })
          at = lower.indexOf(piece, at + 1)
        }
      }
    }
  }

  // Repeats: aaa, abcabc.
  const rep = /(.+?)\1+/gu
  let m: RegExpExecArray | null
  while ((m = rep.exec(pw))) {
    if (m[0].length >= 3 && m[0].length > m[1].length) {
      out.push({
        start: m.index,
        end: m.index + m[0].length,
        kind: 'repeat',
        bits: m[1].length * log(Math.max(pool, 2)) + log(m[0].length / m[1].length) + 1,
        note: `"${m[1]}" repeats`,
      })
    }
  }

  // Years.
  const yr = /(?:19|20)\d{2}/g
  while ((m = yr.exec(pw))) out.push({ start: m.index, end: m.index + 4, kind: 'year', bits: log(120), note: `"${m[0]}" looks like a year` })

  return out
}

/** Picks non-overlapping segments, longest first, then cheapest. */
export function chooseSegments(segs: Segment[]): Segment[] {
  const sorted = [...segs].sort((a, b) => b.end - b.start - (a.end - a.start) || a.bits - b.bits)
  const taken: Segment[] = []
  for (const s of sorted) if (!taken.some((t) => s.start < t.end && t.start < s.end)) taken.push(s)
  return taken.sort((a, b) => a.start - b.start)
}

export function analyzePassword(pw: string): Analysis {
  const length = Array.from(pw).length
  const { classes, pool } = charPool(pw)
  const perChar = Math.log2(Math.max(pool, 2))
  const naiveBits = length === 0 ? 0 : length * perChar
  const segments = length === 0 ? [] : chooseSegments(findSegments(pw, pool))
  let bits = 0
  if (length > 0) {
    const covered = segments.reduce((a, s) => a + (s.end - s.start), 0)
    bits = segments.reduce((a, s) => a + s.bits, 0) + Math.max(0, pw.length - covered) * perChar
    bits = Math.min(bits, naiveBits)
  }
  const whole = segments.find((s) => s.start === 0 && s.end === pw.length && (s.kind === 'common' || s.kind === 'leet'))
  let score: Analysis['score'] = bits < 28 ? 0 : bits < 36 ? 1 : bits < 60 ? 2 : bits < 80 ? 3 : 4
  if (whole || length === 0) score = 0

  const suggestions: string[] = []
  if (length > 0) {
    if (length < 12) suggestions.push('Make it at least 12 characters. Length adds more strength than symbols do.')
    if (segments.some((s) => s.kind === 'common' || s.kind === 'leet')) suggestions.push('Avoid common passwords and simple look-alike swaps such as @ for a.')
    if (segments.some((s) => s.kind === 'sequence' || s.kind === 'walk')) suggestions.push('Avoid sequences (abc, 1234) and keyboard runs (qwerty).')
    if (segments.some((s) => s.kind === 'repeat')) suggestions.push('Avoid repeated characters or repeated chunks.')
    if (segments.some((s) => s.kind === 'year')) suggestions.push('Avoid years, such as a birth year.')
    if (length < 16 && score < 3) suggestions.push('Try a passphrase of 4 or more random words, or let a password manager generate a random string.')
    if (!classes.upper && !classes.symbols && !classes.digits) suggestions.push('Mixing in digits, capitals or symbols helps a little, but only if they are not predictable.')
    suggestions.push('Use a different password for every account.')
  }
  return { length, classes, poolSize: pool, naiveBits, bits, segments, score, label: SCORE_LABELS[score], suggestions }
}

export const ATTACK_RATES: { id: string; label: string; perSecond: number }[] = [
  { id: 'online', label: 'Online login, rate limited (100 guesses/s)', perSecond: 1e2 },
  { id: 'slow', label: 'Offline, slow hash such as bcrypt (10 thousand/s)', perSecond: 1e4 },
  { id: 'fast', label: 'Offline, fast hash on one GPU (10 billion/s)', perSecond: 1e10 },
  { id: 'cluster', label: 'Offline, fast hash on a GPU cluster (1 trillion/s)', perSecond: 1e12 },
]

/** Average seconds to find the password: half the search space. */
export function crackSeconds(bits: number, perSecond: number): number {
  return Math.pow(2, Math.max(0, bits - 1)) / perSecond
}

export function formatDuration(sec: number): string {
  if (!isFinite(sec)) return 'longer than the age of the universe'
  if (sec < 1) return 'instantly'
  const year = 31557600
  if (sec >= year * 1e9) return 'billions of years or more'
  if (sec >= year * 1e6) return `${Math.round(sec / (year * 1e6)).toLocaleString('en-US')} million years`
  const units: [string, number][] = [['second', 1], ['minute', 60], ['hour', 3600], ['day', 86400], ['month', 2629800], ['year', year]]
  let u = units[0]
  for (const x of units) if (sec >= x[1]) u = x
  const v = Math.round(sec / u[1])
  return `${v.toLocaleString('en-US')} ${u[0]}${v === 1 ? '' : 's'}`
}
