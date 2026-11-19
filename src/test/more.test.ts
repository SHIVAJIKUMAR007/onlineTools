import { describe, expect, it } from 'vitest'
import { caesar, checkPalindrome, countSyllables, easeLabel, keywordDensity, linesToList, listToLines, readability, repeatText, REPEAT_MAX_CHARS } from '@/lib/text/more'
import { amountToWords, bigIntToWords, convertUnit, formatUnitValue, numberToWords } from '@/lib/conversion/units'
import { jsonEscape, jsonUnescape, randomString, UnescapeError } from '@/lib/dev/more'

describe('caesar', () => {
  it('shifts letters and keeps everything else', () => {
    expect(caesar('Hello, World! 123', 3)).toBe('Khoor, Zruog! 123')
    expect(caesar('Khoor', -3)).toBe('Hello')
  })
  it('ROT13 is its own inverse and shifts wrap', () => {
    expect(caesar(caesar('Attack at Dawn', 13), 13)).toBe('Attack at Dawn')
    expect(caesar('xyz', 3)).toBe('abc')
    expect(caesar('abc', 26)).toBe('abc')
    expect(caesar('é', 5)).toBe('é')
  })
})

describe('repeatText', () => {
  it('repeats with a separator', () => {
    expect(repeatText('ab', 3, '-')).toEqual({ output: 'ab-ab-ab', truncated: false })
    expect(repeatText('', 3, '-').output).toBe('')
    expect(repeatText('x', 0, '').output).toBe('')
  })
  it('caps the output size', () => {
    const r = repeatText('x'.repeat(1000), 100000, '')
    expect(r.truncated).toBe(true)
    expect(r.output.length).toBeLessThanOrEqual(REPEAT_MAX_CHARS)
  })
})

describe('list conversion', () => {
  const o = { separator: ', ', quote: '' as const, trim: true, removeEmpty: true, unique: false }
  it('joins lines, with quotes, trimming and dedupe', () => {
    expect(linesToList(' a \n\nb\na', o)).toBe('a, b, a')
    expect(linesToList('a\nb\na', { ...o, quote: "'", unique: true })).toBe("'a', 'b'")
  })
  it('splits and unquotes', () => {
    const s = { trim: true, removeEmpty: true, unique: false, unquote: true }
    expect(listToLines("'a', \"b\", c,, ", ',', s)).toBe('a\nb\nc')
    expect(listToLines('', ',', s)).toBe('')
  })
})

describe('palindromes', () => {
  const lax = { ignoreCase: true, ignoreSpacesPunctuation: true }
  it('detects phrases when ignoring punctuation', () => {
    expect(checkPalindrome('A man, a plan, a canal: Panama', lax).isPalindrome).toBe(true)
    expect(checkPalindrome('hello', lax).isPalindrome).toBe(false)
    expect(checkPalindrome('12321', lax).isPalindrome).toBe(true)
  })
  it('respects strict options', () => {
    expect(checkPalindrome('Racecar', { ignoreCase: false, ignoreSpacesPunctuation: true }).isPalindrome).toBe(false)
    expect(checkPalindrome('a b a', { ignoreCase: true, ignoreSpacesPunctuation: false }).isPalindrome).toBe(true)
    expect(checkPalindrome('ab ab', { ignoreCase: true, ignoreSpacesPunctuation: false }).isPalindrome).toBe(false)
  })
  it('gives no verdict for empty input and handles emoji', () => {
    expect(checkPalindrome('  ', lax).isPalindrome).toBe(false)
    expect(checkPalindrome('😀a😀', { ignoreCase: true, ignoreSpacesPunctuation: false }).isPalindrome).toBe(true)
  })
})

describe('readability', () => {
  it('counts syllables on common words', () => {
    expect(countSyllables('cat')).toBe(1)
    expect(countSyllables('table')).toBe(2)
    expect(countSyllables('banana')).toBe(3)
    expect(countSyllables('the')).toBe(1)
  })
  it('scores simple text as easier than complex text', () => {
    const easy = readability('The cat sat on the mat. The dog ran to the park. We like to play.')!
    const hard = readability('Notwithstanding considerable methodological limitations, the investigators demonstrated statistically significant improvements.')!
    expect(easy.fleschEase).toBeGreaterThan(hard.fleschEase)
    expect(easy.fleschKincaid).toBeLessThan(hard.fleschKincaid)
    expect(easy.sentences).toBe(3)
    expect(easy.words).toBe(16)
  })
  it('returns null for empty text and labels scores', () => {
    expect(readability('   ')).toBeNull()
    expect(easeLabel(95)).toMatch(/Very easy/)
    expect(easeLabel(10)).toMatch(/Very difficult/)
  })
})

describe('keywordDensity', () => {
  const text = 'Apples and oranges. Apples are red. The apples fall; oranges stay.'
  it('counts words and skips stop words', () => {
    const r = keywordDensity(text, { size: 1, skipStopWords: true, minCount: 2 })
    expect(r.rows.map((x) => x.phrase)).toEqual(['apples', 'oranges'])
    expect(r.rows[0].count).toBe(3)
    expect(r.totalWords).toBe(11)
  })
  it('keeps stop words when asked and supports phrases', () => {
    expect(keywordDensity(text, { size: 1, skipStopWords: false, minCount: 2 }).rows.some((x) => x.phrase === 'and')).toBe(false)
    expect(keywordDensity('red apple red apple red', { size: 2, skipStopWords: false, minCount: 2 }).rows[0]).toMatchObject({ phrase: 'apple red', count: 2 })
  })
})

describe('units', () => {
  it('converts linear units', () => {
    expect(convertUnit(1, 'length', 'in', 'cm')).toBeCloseTo(2.54, 10)
    expect(convertUnit(1, 'mass', 'kg', 'lb')).toBeCloseTo(2.20462, 4)
    expect(convertUnit(1, 'data', 'GiB', 'MiB')).toBe(1024)
    expect(convertUnit(1, 'data', 'GB', 'MB')).toBe(1000)
    expect(convertUnit(1, 'speed', 'kmh', 'ms')).toBeCloseTo(0.27778, 4)
  })
  it('converts temperatures', () => {
    expect(convertUnit(100, 'temperature', 'c', 'f')).toBe(212)
    expect(convertUnit(-40, 'temperature', 'f', 'c')).toBeCloseTo(-40, 10)
    expect(convertUnit(0, 'temperature', 'c', 'k')).toBe(273.15)
  })
  it('formats values compactly', () => {
    expect(formatUnitValue(2.54)).toBe('2.54')
    expect(formatUnitValue(1 / 3)).toBe('0.33333333')
    expect(formatUnitValue(0)).toBe('0')
    expect(formatUnitValue(1e20)).toMatch(/e\+?20/)
    expect(formatUnitValue(Number.NaN)).toBe('')
  })
})

describe('number to words', () => {
  it('spells integers', () => {
    expect(numberToWords('0')).toBe('zero')
    expect(numberToWords('21')).toBe('twenty-one')
    expect(numberToWords('101')).toBe('one hundred one')
    expect(numberToWords('1,204')).toBe('one thousand two hundred four')
    expect(numberToWords('1000000')).toBe('one million')
    expect(bigIntToWords(1_000_000_000_001n)).toBe('one trillion one')
  })
  it('handles negatives and decimals', () => {
    expect(numberToWords('-5')).toBe('minus five')
    expect(numberToWords('3.14')).toBe('three point one four')
    expect(numberToWords('-0')).toBe('zero')
    expect(numberToWords('.5')).toBe('zero point five')
  })
  it('rejects bad input', () => {
    expect(() => numberToWords('abc')).toThrow()
    expect(() => numberToWords('1'.repeat(40))).toThrow(/too large/)
  })
  it('writes money amounts', () => {
    expect(amountToWords('1204.50')).toBe('one thousand two hundred four dollars and fifty cents')
    expect(amountToWords('1.01')).toBe('one dollar and one cent')
    expect(amountToWords('0.05')).toBe('zero dollars and five cents')
    expect(amountToWords('10')).toBe('ten dollars')
    expect(() => amountToWords('1.234')).toThrow()
  })
})

describe('json escape', () => {
  it('escapes and round-trips', () => {
    const src = 'Line one\n"quoted" \\ tab\t é 😀'
    const esc = jsonEscape(src, { quotes: false, asciiOnly: false })
    expect(esc).toBe('Line one\\n\\"quoted\\" \\\\ tab\\t é 😀')
    expect(jsonUnescape(esc)).toBe(src)
    expect(jsonUnescape(jsonEscape(src, { quotes: true, asciiOnly: true }))).toBe(src)
  })
  it('can escape non-ASCII as \\u sequences and include quotes', () => {
    expect(jsonEscape('é', { quotes: true, asciiOnly: true })).toBe('"\\u00e9"')
  })
  it('unescapes bare text with raw quotes and rejects invalid escapes', () => {
    expect(jsonUnescape('say "hi"\\n')).toBe('say "hi"\n')
    expect(() => jsonUnescape('bad \\x escape')).toThrow(UnescapeError)
    expect(jsonUnescape('')).toBe('')
  })
})

describe('randomString', () => {
  it('uses only the allowed characters and the right length', () => {
    expect(randomString(50, 'ab')).toMatch(/^[ab]{50}$/)
    expect(randomString(10, '')).toBe('')
    expect(randomString(9999, 'a')).toHaveLength(4096)
  })
  it('is not constant', () => {
    expect(new Set(Array.from({ length: 20 }, () => randomString(16, 'abcdef0123456789'))).size).toBeGreaterThan(15)
  })
})
