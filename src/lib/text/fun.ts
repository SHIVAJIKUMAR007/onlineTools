// ───────────── Remove duplicate words ─────────────
export interface DedupeOptions {
  caseSensitive: boolean
  ignorePunctuation: boolean
  keepLineBreaks: boolean
  consecutiveOnly: boolean
}

export interface DedupeResult {
  text: string
  removed: { word: string; count: number }[]
  removedTotal: number
  keptTotal: number
}

const edgePunct = /^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu

export function removeDuplicateWords(input: string, o: DedupeOptions): DedupeResult {
  const seen = new Set<string>()
  let prev: string | null = null
  const counts = new Map<string, number>()
  let kept = 0
  const keyOf = (w: string) => {
    let k = o.ignorePunctuation ? w.replace(edgePunct, '') : w
    if (!o.caseSensitive) k = k.toLowerCase()
    return k
  }
  const lines = o.keepLineBreaks ? input.split(/\r?\n/) : [input]
  const outLines = lines.map((line) => {
    const out: string[] = []
    for (const w of line.split(/\s+/).filter(Boolean)) {
      const k = keyOf(w)
      if (k === '') {
        out.push(w)
        kept++
        continue
      }
      const dup = o.consecutiveOnly ? prev === k : seen.has(k)
      prev = k
      if (dup) {
        counts.set(k, (counts.get(k) ?? 0) + 1)
      } else {
        seen.add(k)
        out.push(w)
        kept++
      }
    }
    return out.join(' ')
  })
  const removed = [...counts].map(([word, count]) => ({ word, count })).sort((a, b) => b.count - a.count || a.word.localeCompare(b.word))
  return { text: outLines.join('\n'), removed, removedTotal: removed.reduce((a, r) => a + r.count, 0), keptTotal: kept }
}

// ───────────── Fancy text ─────────────
type CharMap = Map<string, string>

const A = 65
const a = 97
const cp = (n: number) => String.fromCodePoint(n)

function mathMap(upper: number, lower: number | null, digit: number | null, exceptions: Record<string, number> = {}): CharMap {
  const m: CharMap = new Map()
  for (let i = 0; i < 26; i++) {
    m.set(String.fromCharCode(A + i), cp(upper + i))
    if (lower !== null) m.set(String.fromCharCode(a + i), cp(lower + i))
  }
  if (digit !== null) for (let i = 0; i < 10; i++) m.set(String(i), cp(digit + i))
  for (const [k, v] of Object.entries(exceptions)) m.set(k, cp(v))
  return m
}

function circled(): CharMap {
  const m: CharMap = new Map()
  for (let i = 0; i < 26; i++) {
    m.set(String.fromCharCode(A + i), cp(0x24b6 + i))
    m.set(String.fromCharCode(a + i), cp(0x24d0 + i))
  }
  for (let i = 1; i <= 9; i++) m.set(String(i), cp(0x2460 + i - 1))
  m.set('0', cp(0x24ea))
  return m
}

function squared(): CharMap {
  const m: CharMap = new Map()
  for (let i = 0; i < 26; i++) {
    m.set(String.fromCharCode(A + i), cp(0x1f130 + i))
    m.set(String.fromCharCode(a + i), cp(0x1f130 + i))
  }
  return m
}

function parenthesized(): CharMap {
  const m: CharMap = new Map()
  for (let i = 0; i < 26; i++) {
    m.set(String.fromCharCode(A + i), cp(0x249c + i))
    m.set(String.fromCharCode(a + i), cp(0x249c + i))
  }
  for (let i = 1; i <= 9; i++) m.set(String(i), cp(0x2474 + i - 1))
  return m
}

function fullwidth(): CharMap {
  const m: CharMap = new Map()
  for (let c = 0x21; c <= 0x7e; c++) m.set(String.fromCharCode(c), cp(c + 0xfee0))
  m.set(' ', '　')
  return m
}

const FLIP_PAIRS =
  'a:ɐ b:q c:ɔ d:p e:ǝ f:ɟ g:ƃ h:ɥ i:ᴉ j:ɾ k:ʞ l:l m:ɯ n:u o:o p:d q:b r:ɹ s:s t:ʇ u:n v:ʌ w:ʍ x:x y:ʎ z:z ' +
  'A:∀ B:ᗺ C:Ɔ D:ᗡ E:Ǝ F:Ⅎ G:⅁ H:H I:I J:ſ K:⋊ L:⅂ M:W N:N O:O P:Ԁ Q:Ό R:ᴚ S:S T:⊥ U:∩ V:Λ W:M X:X Y:⅄ Z:Z ' +
  '0:0 1:Ɩ 2:ᄅ 3:Ɛ 4:ㄣ 5:ϛ 6:9 7:ㄥ 8:8 9:6 .:˙ ,:\' ?:¿ !:¡ (:) ):( [:] ]:[ {:} }:{ <:> >:< &:⅋ _:‾ ;:؛'

function flipMap(): CharMap {
  const m: CharMap = new Map()
  for (const pair of FLIP_PAIRS.split(' ')) m.set(pair[0], pair.slice(2))
  return m
}

const mapStyle = (m: CharMap) => (t: string) => Array.from(t, (c) => m.get(c) ?? c).join('')
const combine = (mark: string) => (t: string) => Array.from(t, (c) => (c === '\n' || c === '\r' ? c : c + mark)).join('')

export interface TextStyle {
  id: string
  name: string
  convert: (text: string) => string
}

const flip = flipMap()

export const FANCY_STYLES: TextStyle[] = [
  { id: 'bold', name: 'Bold serif', convert: mapStyle(mathMap(0x1d400, 0x1d41a, 0x1d7ce)) },
  { id: 'italic', name: 'Italic serif', convert: mapStyle(mathMap(0x1d434, 0x1d44e, null, { h: 0x210e })) },
  { id: 'bold-italic', name: 'Bold italic serif', convert: mapStyle(mathMap(0x1d468, 0x1d482, null)) },
  { id: 'sans-bold', name: 'Bold sans', convert: mapStyle(mathMap(0x1d5d4, 0x1d5ee, 0x1d7ec)) },
  { id: 'sans-italic', name: 'Italic sans', convert: mapStyle(mathMap(0x1d608, 0x1d622, null)) },
  { id: 'sans-bold-italic', name: 'Bold italic sans', convert: mapStyle(mathMap(0x1d63c, 0x1d656, null)) },
  {
    id: 'script',
    name: 'Script',
    convert: mapStyle(mathMap(0x1d49c, 0x1d4b6, null, { B: 0x212c, E: 0x2130, F: 0x2131, H: 0x210b, I: 0x2110, L: 0x2112, M: 0x2133, R: 0x211b, e: 0x212f, g: 0x210a, o: 0x2134 })),
  },
  { id: 'bold-script', name: 'Bold script', convert: mapStyle(mathMap(0x1d4d0, 0x1d4ea, null)) },
  { id: 'fraktur', name: 'Fraktur', convert: mapStyle(mathMap(0x1d504, 0x1d51e, null, { C: 0x212d, H: 0x210c, I: 0x2111, R: 0x211c, Z: 0x2128 })) },
  { id: 'bold-fraktur', name: 'Bold fraktur', convert: mapStyle(mathMap(0x1d56c, 0x1d586, null)) },
  { id: 'double-struck', name: 'Double-struck', convert: mapStyle(mathMap(0x1d538, 0x1d552, 0x1d7d8, { C: 0x2102, H: 0x210d, N: 0x2115, P: 0x2119, Q: 0x211a, R: 0x211d, Z: 0x2124 })) },
  { id: 'monospace', name: 'Monospace', convert: mapStyle(mathMap(0x1d670, 0x1d68a, 0x1d7f6)) },
  { id: 'circled', name: 'Circled', convert: mapStyle(circled()) },
  { id: 'squared', name: 'Squared', convert: mapStyle(squared()) },
  { id: 'parenthesized', name: 'Parenthesized', convert: mapStyle(parenthesized()) },
  { id: 'fullwidth', name: 'Fullwidth', convert: mapStyle(fullwidth()) },
  { id: 'upside-down', name: 'Upside down', convert: (t) => Array.from(t, (c) => flip.get(c) ?? c).reverse().join('') },
  { id: 'strike', name: 'Strikethrough', convert: combine('̶') },
  { id: 'underline', name: 'Underline', convert: combine('̲') },
]

export const convertFancy = (text: string, id: string): string => FANCY_STYLES.find((s) => s.id === id)?.convert(text) ?? text

// ───────────── Small text (superscript, subscript, small caps) ─────────────
const pairs = (s: string): CharMap => {
  const m: CharMap = new Map()
  for (const p of s.split(' ')) m.set(p[0], p.slice(1))
  return m
}

const SUPER = pairs(
  '0⁰ 1¹ 2² 3³ 4⁴ 5⁵ 6⁶ 7⁷ 8⁸ 9⁹ +⁺ -⁻ =⁼ (⁽ )⁾ aᵃ bᵇ cᶜ dᵈ eᵉ fᶠ gᵍ hʰ iⁱ jʲ kᵏ lˡ mᵐ nⁿ oᵒ pᵖ rʳ sˢ tᵗ uᵘ vᵛ wʷ xˣ yʸ zᶻ ' +
    'Aᴬ Bᴮ Dᴰ Eᴱ Gᴳ Hᴴ Iᴵ Jᴶ Kᴷ Lᴸ Mᴹ Nᴺ Oᴼ Pᴾ Rᴿ Tᵀ Uᵁ Vⱽ Wᵂ',
)
const SUB = pairs('0₀ 1₁ 2₂ 3₃ 4₄ 5₅ 6₆ 7₇ 8₈ 9₉ +₊ -₋ =₌ (₍ )₎ aₐ eₑ hₕ iᵢ jⱼ kₖ lₗ mₘ nₙ oₒ pₚ rᵣ sₛ tₜ uᵤ vᵥ xₓ')
const SMALLCAPS = pairs('aᴀ bʙ cᴄ dᴅ eᴇ fꜰ gɢ hʜ iɪ jᴊ kᴋ lʟ mᴍ nɴ oᴏ pᴘ qꞯ rʀ sꜱ tᴛ uᴜ vᴠ wᴡ yʏ zᴢ')

export interface SmallResult {
  text: string
  /** Letters or digits that have no Unicode equivalent in this style and were left as they are. */
  missing: string[]
}

export type SmallStyleId = 'superscript' | 'subscript' | 'smallcaps'

export const SMALL_STYLES: { id: SmallStyleId; name: string }[] = [
  { id: 'superscript', name: 'Superscript' },
  { id: 'subscript', name: 'Subscript' },
  { id: 'smallcaps', name: 'Small caps' },
]

export function convertSmall(text: string, id: SmallStyleId): SmallResult {
  const map = id === 'superscript' ? SUPER : id === 'subscript' ? SUB : SMALLCAPS
  const missing = new Set<string>()
  const out = Array.from(text, (c) => {
    const r = map.get(c)
    if (r) return r
    // Small caps leaves capitals, digits and symbols alone on purpose.
    if (id === 'smallcaps' ? /[a-z]/.test(c) : /[\p{L}\p{N}]/u.test(c)) missing.add(c)
    return c
  }).join('')
  return { text: out, missing: [...missing] }
}

// ───────────── Pig Latin ─────────────
export type VowelSuffix = 'way' | 'yay' | 'ay'

const WORD = /[A-Za-z]+(?:'[A-Za-z]+)*/g
const isVowelAt = (w: string, i: number) => 'aeiou'.includes(w[i]) || (w[i] === 'y' && i > 0)

function applyCase(src: string, out: string): string {
  if (src.length > 1 && src === src.toUpperCase()) return out.toUpperCase()
  if (src[0] === src[0].toUpperCase() && src[0] !== src[0].toLowerCase()) return out.charAt(0).toUpperCase() + out.slice(1).toLowerCase()
  return out
}

export function wordToPigLatin(word: string, vowelSuffix: VowelSuffix = 'way'): string {
  const w = word.toLowerCase()
  if (isVowelAt(w, 0) && w[0] !== 'y') return applyCase(word, w + vowelSuffix)
  let i = 0
  while (i < w.length && !isVowelAt(w, i)) {
    if (w[i] === 'q' && w[i + 1] === 'u') i++
    i++
  }
  if (i >= w.length) return applyCase(word, w + 'ay')
  return applyCase(word, w.slice(i) + w.slice(0, i) + 'ay')
}

export function toPigLatin(text: string, vowelSuffix: VowelSuffix = 'way'): string {
  return text.replace(WORD, (w) => wordToPigLatin(w, vowelSuffix))
}

const ONSETS = new Set(['bl', 'br', 'ch', 'cl', 'cr', 'dr', 'fl', 'fr', 'gl', 'gr', 'kn', 'ph', 'pl', 'pr', 'sc', 'sh', 'sk', 'sl', 'sm', 'sn', 'sp', 'st', 'sw', 'th', 'tr', 'tw', 'wh', 'wr', 'scr', 'shr', 'spl', 'spr', 'str', 'thr', 'sch'])

/** Best-effort. Several English words can produce the same Pig Latin, so some results are guesses. */
export function wordFromPigLatin(word: string, vowelSuffix: VowelSuffix = 'way'): string {
  const w = word.toLowerCase()
  if (vowelSuffix !== 'ay' && w.length > vowelSuffix.length + 1 && w.endsWith(vowelSuffix) && 'aeiou'.includes(w[0])) {
    return applyCase(word, w.slice(0, -vowelSuffix.length))
  }
  if (w.length < 3 || !w.endsWith('ay')) return word
  const s = w.slice(0, -2)
  let k = 0
  if (s.endsWith('qu')) {
    k = 2
    if (s.endsWith('squ')) k = 3
  } else {
    let run = 0
    while (run < s.length && !'aeiouy'.includes(s[s.length - 1 - run])) run++
    k = Math.min(run, 1)
    for (let n = Math.min(3, run); n >= 2; n--) if (ONSETS.has(s.slice(-n))) { k = n; break }
  }
  if (k === 0 || k >= s.length + 1) return applyCase(word, s)
  const decoded = s.slice(-k) + s.slice(0, -k)
  return applyCase(word, decoded)
}

export function fromPigLatin(text: string, vowelSuffix: VowelSuffix = 'way'): string {
  return text.replace(WORD, (w) => wordFromPigLatin(w, vowelSuffix))
}

// ───────────── Sentence chunks for speech ─────────────
/** Splits text into sentence-sized pieces no longer than `max` characters, so speech engines do not cut off. */
export function chunkSentences(text: string, max = 200): string[] {
  const parts = text.match(/[^.!?…\n]+(?:[.!?…]+["')\]]*|\n+|$)/g) ?? []
  const out: string[] = []
  for (const raw of parts) {
    let s = raw.replace(/\s+/g, ' ').trim()
    while (s.length > max) {
      let cut = Math.max(s.lastIndexOf(', ', max), s.lastIndexOf('; ', max), s.lastIndexOf(': ', max))
      if (cut < max / 3) cut = s.lastIndexOf(' ', max)
      if (cut <= 0) cut = max
      else cut += 1
      out.push(s.slice(0, cut).trim())
      s = s.slice(cut).trim()
    }
    if (s) out.push(s)
  }
  return out
}
