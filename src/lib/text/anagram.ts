// Anagram checking: compare the letters of two phrases.

export interface AnagramOptions {
  ignoreCase: boolean
  /** When true, only letters and digits count. When false, spaces and punctuation count too. */
  lettersOnly: boolean
  /** Treat accented letters as their plain form, so "é" matches "e". */
  stripAccents: boolean
}

export const defaultAnagramOptions: AnagramOptions = { ignoreCase: true, lettersOnly: true, stripAccents: true }

/** Break a phrase into the characters that take part in the comparison. */
export function anagramChars(text: string, o: AnagramOptions): string[] {
  let s = text.normalize('NFC')
  if (o.stripAccents) s = s.normalize('NFD').replace(/\p{M}+/gu, '')
  if (o.ignoreCase) s = s.toLowerCase()
  const chars = Array.from(s)
  return o.lettersOnly ? chars.filter((c) => /[\p{L}\p{N}]/u.test(c)) : chars
}

export function countChars(chars: readonly string[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const c of chars) m.set(c, (m.get(c) ?? 0) + 1)
  return m
}

export interface AnagramResult {
  isAnagram: boolean
  /** True when both sides are the same text after normalising, which is not a real anagram. */
  identical: boolean
  lengthA: number
  lengthB: number
  /** Characters A has more of than B, as [char, how many more]. */
  onlyInA: Array<[string, number]>
  onlyInB: Array<[string, number]>
}

export function checkAnagram(a: string, b: string, o: AnagramOptions = defaultAnagramOptions): AnagramResult {
  const ca = anagramChars(a, o)
  const cb = anagramChars(b, o)
  const ma = countChars(ca)
  const mb = countChars(cb)
  const diff = (x: Map<string, number>, y: Map<string, number>) =>
    [...x]
      .map(([c, n]): [string, number] => [c, n - (y.get(c) ?? 0)])
      .filter(([, n]) => n > 0)
      .sort((p, q) => p[0].localeCompare(q[0]))
  const onlyInA = diff(ma, mb)
  const onlyInB = diff(mb, ma)
  const isAnagram = ca.length > 0 && onlyInA.length === 0 && onlyInB.length === 0
  return { isAnagram, identical: isAnagram && ca.join('') === cb.join(''), lengthA: ca.length, lengthB: cb.length, onlyInA, onlyInB }
}
