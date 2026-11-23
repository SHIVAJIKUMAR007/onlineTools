/** 256 short, common, distinct English words. 256 = 2^8, so one random byte picks a word without bias. */
export const WORDLIST: readonly string[] = (
  'acid acorn actor agent alarm album alley angle ankle apple arrow atlas attic audio bacon badge baker banjo basil beach bench berry bike birch blade bloom boat bonus brain brick brush cabin ' +
  'cable camel candy canoe cargo carpet castle cedar chair chalk cherry chess chime cider cliff clock cloud clover coach coast cobra comet coral couch crane creek crown daisy dance delta denim diary ' +
  'dingo disk dolly dough dragon dream drum eagle earth easel ember engine fable fairy falcon feast fence ferry field finch flame flute forest fossil frog garden gecko ghost giant glove goat grape ' +
  'grass guitar hammer harbor hazel heart hedge helmet honey horse hotel house igloo inch ivory jacket jelly jewel jungle kayak kettle kitten knife ladder lake lamp lemon lilac llama lunar magnet maple ' +
  'marble meadow melon mirror mocha monkey moose motor mount muffin nest noble north novel nurse oasis ocean olive onion opera orbit otter owl oxygen paint panda paper parrot peach pearl pepper piano ' +
  'pilot pizza planet plum polar pond pony poppy quail quartz queen quiet quilt rabbit radio rain ranch raven reef ribbon river robin robot rocket rose saddle sailor salad sand scarf shark sheep ' +
  'shell silver sketch snow spoon spring squid stone storm sugar sunny swan table tiger toast tulip tunnel turtle umbrella valley velvet violin walnut whale wheat willow window winter wolf yacht yarn zebra ' +
  'anchor bamboo basket beetle bottle bridge bucket button candle carrot cattle circus cotton desert dinner doctor donkey dollar double eleven elbow family farmer finger flower friend garlic ginger hockey island jersey kernel'
).split(' ')

export type Separator = 'space' | 'hyphen' | 'dot' | 'underscore' | 'none'
export const SEPARATORS: Record<Separator, string> = { space: ' ', hyphen: '-', dot: '.', underscore: '_', none: '' }

export interface PassphraseOptions {
  words: number
  separator: Separator
  capitalize: boolean
  appendNumber: boolean
}

export type RandomBytes = (n: number) => Uint8Array

export const cryptoBytes: RandomBytes = (n) => globalThis.crypto.getRandomValues(new Uint8Array(n))

export const clampWords = (n: number): number => Math.min(12, Math.max(3, Math.round(n) || 3))

export function generatePassphrase(o: PassphraseOptions, rand: RandomBytes = cryptoBytes): string {
  const count = clampWords(o.words)
  const bytes = rand(count + (o.appendNumber ? 1 : 0))
  // WORDLIST.length is 256, so a byte maps to an index with no modulo bias.
  let parts = Array.from({ length: count }, (_, i) => WORDLIST[bytes[i]])
  if (o.capitalize) parts = parts.map((w) => w[0].toUpperCase() + w.slice(1))
  let out = parts.join(SEPARATORS[o.separator])
  if (o.appendNumber) {
    // Reject 250-255 so the digit is unbiased.
    let b = bytes[count]
    while (b >= 250) b = rand(1)[0]
    out += SEPARATORS[o.separator] + String(b % 10)
  }
  return out
}

/** Bits of entropy for the words alone (plus ~3.32 bits for an appended digit). */
export function passphraseEntropy(words: number, appendNumber = false): number {
  return clampWords(words) * Math.log2(WORDLIST.length) + (appendNumber ? Math.log2(10) : 0)
}
