import { describe, expect, it } from 'vitest'
import { base64ToBytes, bytesToHex, computeHmac, constantTimeEqual, formatDigest, hexToBytes, parseKey, verifyHmac } from '@/lib/security/hmac'
import { analyzePassword, COMMON_PASSWORDS, crackSeconds, formatDuration } from '@/lib/security/strength'
import { clampWords, generatePassphrase, passphraseEntropy, WORDLIST } from '@/lib/security/passphrase'
import {
  chunkSentences,
  convertFancy,
  convertSmall,
  fromPigLatin,
  removeDuplicateWords,
  toPigLatin,
  type DedupeOptions,
} from '@/lib/text/fun'

describe('hmac', () => {
  const enc = new TextEncoder()
  it('matches RFC 4231 test case 1 (SHA-256)', async () => {
    const d = await computeHmac('SHA-256', new Uint8Array(20).fill(0x0b), 'Hi There')
    expect(bytesToHex(d)).toBe('b0344c61d8db38535ca8afceaf0bf12b881dc200c9833da726e9376c2e32cff7')
  })
  it('matches RFC 4231 test case 2 (SHA-256)', async () => {
    const d = await computeHmac('SHA-256', enc.encode('Jefe'), 'what do ya want for nothing?')
    expect(bytesToHex(d)).toBe('5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843')
  })
  it('matches RFC 2202 case 2 (SHA-1)', async () => {
    const d = await computeHmac('SHA-1', enc.encode('Jefe'), 'what do ya want for nothing?')
    expect(bytesToHex(d)).toBe('effcdf6ae5eb2fa2d27416d5f184df9c259a7c79')
  })
  it('accepts hex and base64 keys equal to text keys', async () => {
    const a = await computeHmac('SHA-256', parseKey('4a656665', 'hex'), 'x')
    const b = await computeHmac('SHA-256', parseKey('SmVmZQ==', 'base64'), 'x')
    const c = await computeHmac('SHA-256', parseKey('Jefe', 'text'), 'x')
    expect(bytesToHex(a)).toBe(bytesToHex(c))
    expect(bytesToHex(b)).toBe(bytesToHex(c))
  })
  it('handles an empty key and unicode messages', async () => {
    const d = await computeHmac('SHA-256', new Uint8Array(0), 'héllo ✓')
    expect(d.length).toBe(32)
  })
  it('rejects bad hex and base64', () => {
    expect(() => hexToBytes('abc')).toThrow()
    expect(() => hexToBytes('zz')).toThrow()
    expect(() => base64ToBytes('a*b')).toThrow()
  })
  it('formats digests', () => {
    const b = new Uint8Array([0xde, 0xad])
    expect(formatDigest(b, 'hex')).toBe('dead')
    expect(formatDigest(b, 'hex', true)).toBe('DEAD')
    expect(formatDigest(b, 'base64')).toBe('3q0=')
  })
  it('verifies hex and base64 values', () => {
    const d = new Uint8Array([1, 2, 3, 4])
    expect(verifyHmac('01020304', d)).toEqual({ match: true, format: 'hex' })
    expect(verifyHmac(' 01 02 03 04 ', d).match).toBe(true)
    expect(verifyHmac('01020305', d).match).toBe(false)
    expect(verifyHmac('AQIDBA==', d)).toEqual({ match: true, format: 'base64' })
    expect(verifyHmac('AQIDBA', d).match).toBe(true)
    expect(verifyHmac('', d).match).toBe(false)
    expect(verifyHmac('!!', d).format).toBe('unknown')
  })
  it('constantTimeEqual handles different lengths', () => {
    expect(constantTimeEqual('abc', 'abc')).toBe(true)
    expect(constantTimeEqual('abc', 'abcd')).toBe(false)
    expect(constantTimeEqual('', '')).toBe(true)
  })
})

describe('password strength', () => {
  it('has about 100 common passwords', () => {
    expect(COMMON_PASSWORDS.length).toBeGreaterThanOrEqual(100)
    expect(new Set(COMMON_PASSWORDS).size).toBe(COMMON_PASSWORDS.length)
  })
  it('handles empty input', () => {
    const a = analyzePassword('')
    expect(a.bits).toBe(0)
    expect(a.score).toBe(0)
  })
  it('flags common passwords and leetspeak', () => {
    expect(analyzePassword('password').score).toBe(0)
    const l = analyzePassword('P@ssw0rd')
    expect(l.segments.some((s) => s.kind === 'leet')).toBe(true)
    expect(l.score).toBe(0)
  })
  it('detects sequences, walks, repeats and years', () => {
    expect(analyzePassword('xxabcdxx').segments.some((s) => s.kind === 'sequence')).toBe(true)
    expect(analyzePassword('zzuiopzz').segments.some((s) => s.kind === 'walk')).toBe(true)
    expect(analyzePassword('kkkkkk').segments.some((s) => s.kind === 'repeat')).toBe(true)
    expect(analyzePassword('blue1987').segments.some((s) => s.kind === 'year')).toBe(true)
  })
  it('scores a long random-looking password higher than a short one', () => {
    const strong = analyzePassword('t7#Kq9!vLm2$Zx8@Rw4n')
    expect(strong.score).toBeGreaterThanOrEqual(3)
    expect(strong.bits).toBeGreaterThan(analyzePassword('Tr0ub4').bits)
    expect(strong.bits).toBeLessThanOrEqual(strong.naiveBits)
  })
  it('formats crack times', () => {
    expect(formatDuration(0.2)).toBe('instantly')
    expect(formatDuration(90)).toBe('2 minutes')
    expect(formatDuration(crackSeconds(200, 1e12))).toBe('billions of years or more')
    expect(formatDuration(Infinity)).toContain('universe')
  })
})

describe('passphrase', () => {
  it('has exactly 256 distinct short lowercase words', () => {
    expect(WORDLIST.length).toBe(256)
    expect(new Set(WORDLIST).size).toBe(256)
    for (const w of WORDLIST) expect(w).toMatch(/^[a-z]{3,8}$/)
  })
  it('maps bytes to words deterministically', () => {
    const r = (n: number) => new Uint8Array(n).fill(0)
    const p = generatePassphrase({ words: 3, separator: 'hyphen', capitalize: true, appendNumber: true }, r)
    const w = WORDLIST[0][0].toUpperCase() + WORDLIST[0].slice(1)
    expect(p).toBe(`${w}-${w}-${w}-0`)
  })
  it('clamps word count and computes entropy', () => {
    expect(clampWords(1)).toBe(3)
    expect(clampWords(50)).toBe(12)
    expect(passphraseEntropy(6)).toBe(48)
    const p = generatePassphrase({ words: 5, separator: 'space', capitalize: false, appendNumber: false })
    expect(p.split(' ')).toHaveLength(5)
  })
})

describe('remove duplicate words', () => {
  const base: DedupeOptions = { caseSensitive: false, ignorePunctuation: true, keepLineBreaks: true, consecutiveOnly: false }
  it('keeps first occurrence and counts removals', () => {
    const r = removeDuplicateWords('The cat saw the cat. The end', base)
    expect(r.text).toBe('The cat saw end')
    expect(r.removedTotal).toBe(3)
    expect(r.removed[0]).toEqual({ word: 'the', count: 2 })
  })
  it('is case sensitive when asked and respects punctuation', () => {
    expect(removeDuplicateWords('a A a', { ...base, caseSensitive: true }).text).toBe('a A')
    expect(removeDuplicateWords('go go, go!', { ...base, ignorePunctuation: false }).text).toBe('go go, go!')
  })
  it('supports consecutive-only mode and line breaks', () => {
    expect(removeDuplicateWords('a a b a', { ...base, consecutiveOnly: true }).text).toBe('a b a')
    expect(removeDuplicateWords('x y\ny z', base).text).toBe('x y\nz')
    expect(removeDuplicateWords('x y\ny z', { ...base, keepLineBreaks: false }).text).toBe('x y z')
    expect(removeDuplicateWords('', base).text).toBe('')
  })
})

describe('fancy text', () => {
  it('handles mapping gaps', () => {
    expect(convertFancy('h', 'italic')).toBe('ℎ')
    expect(convertFancy('e', 'script')).toBe('ℯ')
    expect(convertFancy('g', 'script')).toBe('ℊ')
    expect(convertFancy('o', 'script')).toBe('ℴ')
    expect(convertFancy('CHNPQRZ', 'double-struck')).toBe('ℂℍℕℙℚℝℤ')
    expect(convertFancy('CHIRZ', 'fraktur')).toBe('ℭℌℑℜℨ')
    expect(convertFancy('B', 'script')).toBe('ℬ')
  })
  it('converts regular ranges and passes unsupported characters through', () => {
    expect(convertFancy('Aa1', 'bold')).toBe(String.fromCodePoint(0x1d400, 0x1d41a, 0x1d7cf))
    expect(convertFancy('a b!é', 'bold')).toBe(String.fromCodePoint(0x1d41a) + ' ' + String.fromCodePoint(0x1d41b) + '!é')
    expect(convertFancy('ab', 'circled')).toBe('ⓐⓑ')
    expect(convertFancy('Ab', 'fullwidth')).toBe('Ａｂ')
    expect(convertFancy('hello', 'upside-down')).toBe('ollǝɥ')
    expect(convertFancy('ab', 'strike')).toBe('a̶b̶')
    expect(convertFancy('ab', 'underline')).toBe('a̲b̲')
    expect(convertFancy('', 'bold')).toBe('')
  })
})

describe('small text', () => {
  it('converts superscript, subscript and small caps', () => {
    expect(convertSmall('x2+1', 'superscript').text).toBe('ˣ²⁺¹')
    expect(convertSmall('H2O', 'subscript').text).toBe('H₂O')
    expect(convertSmall('co2', 'subscript').text).toBe('cₒ₂')
    expect(convertSmall('Hello', 'smallcaps').text).toBe('Hᴇʟʟᴏ')
  })
  it('flags letters without an equivalent', () => {
    const r = convertSmall('qc', 'superscript')
    expect(r.text).toBe('qᶜ')
    expect(r.missing).toEqual(['q'])
    expect(convertSmall('xyz', 'smallcaps').missing).toEqual(['x'])
    expect(convertSmall('a e', 'subscript').missing).toEqual([])
  })
})

describe('pig latin', () => {
  it('encodes consonant clusters, qu and vowels', () => {
    expect(toPigLatin('hello')).toBe('ellohay')
    expect(toPigLatin('string')).toBe('ingstray')
    expect(toPigLatin('queen')).toBe('eenquay')
    expect(toPigLatin('apple')).toBe('appleway')
    expect(toPigLatin('apple', 'yay')).toBe('appleyay')
    expect(toPigLatin('rhythm')).toBe('ythmrhay')
  })
  it('keeps capitalization, punctuation and hyphens', () => {
    expect(toPigLatin('Hello, World!')).toBe('Ellohay, Orldway!')
    expect(toPigLatin('HELLO')).toBe('ELLOHAY')
    expect(toPigLatin('well-known')).toBe('ellway-ownknay')
    expect(toPigLatin('')).toBe('')
  })
  it('decodes best-effort', () => {
    expect(fromPigLatin('ellohay')).toBe('hello')
    expect(fromPigLatin('Ellohay ingstray')).toBe('Hello string')
    expect(fromPigLatin('eenquay')).toBe('queen')
    expect(fromPigLatin('appleway')).toBe('apple')
    expect(fromPigLatin('hi')).toBe('hi')
  })
})

describe('sentence chunks', () => {
  it('splits by sentence', () => {
    expect(chunkSentences('One. Two! Three?')).toEqual(['One.', 'Two!', 'Three?'])
    expect(chunkSentences('')).toEqual([])
    expect(chunkSentences('no end')).toEqual(['no end'])
  })
  it('splits long sentences under the limit', () => {
    const long = Array.from({ length: 100 }, () => 'word').join(' ') + '.'
    const c = chunkSentences(long, 50)
    expect(c.length).toBeGreaterThan(5)
    for (const x of c) expect(x.length).toBeLessThanOrEqual(50)
    expect(c.join(' ')).toBe(long)
  })
})
