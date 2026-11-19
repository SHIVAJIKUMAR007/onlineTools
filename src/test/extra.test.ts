import { describe, expect, it } from 'vitest'
import { cleanWhitespace, findReplace, slugify, sortLines } from '@/lib/text/transform'
import {
  dateToTimestamp,
  generatePassword,
  guessUnit,
  passwordEntropy,
  radixToText,
  relativeTime,
  testRegex,
  textToRadix,
  timestampToDate,
} from '@/lib/dev/extra'
import { morseToText, numberToRoman, romanToNumber, textToMorse } from '@/lib/conversion/codes'

describe('sortLines', () => {
  const base = { caseSensitive: false, removeEmpty: false }
  it('sorts alphabetically in both directions', () => {
    expect(sortLines('pear\nApple\nbanana', { ...base, mode: 'az' })).toBe('Apple\nbanana\npear')
    expect(sortLines('pear\nApple\nbanana', { ...base, mode: 'za' })).toBe('pear\nbanana\nApple')
  })
  it('sorts numerically and puts lines without numbers last', () => {
    expect(sortLines('10\n9\nx\n100', { ...base, mode: 'numeric' })).toBe('9\n10\n100\nx')
    expect(sortLines('10\n9\n100', { ...base, mode: 'numeric-desc' })).toBe('100\n10\n9')
  })
  it('sorts by length, reverses, and removes empty lines', () => {
    expect(sortLines('ccc\na\nbb', { ...base, mode: 'length' })).toBe('a\nbb\nccc')
    expect(sortLines('a\n\nb', { ...base, mode: 'reverse', removeEmpty: true })).toBe('b\na')
  })
  it('shuffles without losing lines', () => {
    const out = sortLines('a\nb\nc\nd', { ...base, mode: 'shuffle', random: () => 0 }).split('\n')
    expect(out.sort()).toEqual(['a', 'b', 'c', 'd'])
  })
})

describe('findReplace', () => {
  const o = { caseSensitive: false, wholeWord: false, regex: false }
  it('replaces literally and counts matches', () => {
    expect(findReplace('a.b a.b', '.', '-', o)).toEqual({ output: 'a-b a-b', count: 2 })
  })
  it('keeps $ literal outside regex mode', () => {
    expect(findReplace('price', 'price', '$1', o).output).toBe('$1')
  })
  it('supports whole words, case and regex groups', () => {
    expect(findReplace('cat concat Cat', 'cat', 'dog', { ...o, wholeWord: true }).output).toBe('dog concat dog')
    expect(findReplace('Cat cat', 'cat', 'x', { ...o, caseSensitive: true }).output).toBe('Cat x')
    expect(findReplace('2024-05', '(\\d+)-(\\d+)', '$2/$1', { ...o, regex: true }).output).toBe('05/2024')
  })
  it('reports an invalid pattern', () => {
    expect(findReplace('x', '(', 'y', { ...o, regex: true }).error).toBeTruthy()
  })
})

describe('slugify', () => {
  it('lowercases, strips accents and symbols', () => {
    expect(slugify('10 Best Résumé Tips & Tricks!')).toBe('10-best-resume-tips-and-tricks')
    expect(slugify('  Hello   World  ', { separator: '_' })).toBe('hello_world')
  })
  it('limits length at a word boundary', () => {
    expect(slugify('the quick brown fox jumps', { maxLength: 12 })).toBe('the-quick')
  })
})

describe('cleanWhitespace', () => {
  const o = { collapseSpaces: true, trimLines: true, removeEmptyLines: false, collapseEmptyLines: true, removeLineBreaks: false }
  it('collapses spaces and repeated blank lines', () => {
    expect(cleanWhitespace('a   b  \n\n\n\n c', o)).toBe('a b\n\nc')
  })
  it('removes all blank lines or joins into one paragraph', () => {
    expect(cleanWhitespace('a\n\nb', { ...o, removeEmptyLines: true })).toBe('a\nb')
    expect(cleanWhitespace('a\nb\n\nc', { ...o, removeLineBreaks: true })).toBe('a b c')
  })
})

describe('password generator', () => {
  const all = { length: 20, lower: true, upper: true, digits: true, symbols: true, excludeAmbiguous: false }
  it('returns the requested length and uses every selected group', () => {
    for (let i = 0; i < 20; i++) {
      const p = generatePassword({ ...all, length: 8 })
      expect(p).toHaveLength(8)
      expect(p).toMatch(/[a-z]/)
      expect(p).toMatch(/[A-Z]/)
      expect(p).toMatch(/\d/)
      expect(p).toMatch(/[^A-Za-z0-9]/)
    }
  })
  it('honours single groups and ambiguity exclusion', () => {
    expect(generatePassword({ ...all, symbols: false, upper: false, lower: false, length: 30 })).toMatch(/^\d{30}$/)
    expect(generatePassword({ ...all, excludeAmbiguous: true, length: 200 })).not.toMatch(/[O0oIl1|]/)
    expect(generatePassword({ ...all, lower: false, upper: false, digits: false, symbols: false })).toBe('')
  })
  it('estimates entropy', () => {
    expect(passwordEntropy(10, 2)).toBe(10)
    expect(passwordEntropy(10, 1)).toBe(0)
  })
})

describe('testRegex', () => {
  it('returns matches with groups and positions', () => {
    const r = testRegex('(\\d+)-(?<w>\\w+)', 'g', 'a 12-ab, 3-c')
    expect(r.matches).toHaveLength(2)
    expect(r.matches[0]).toMatchObject({ index: 2, text: '12-ab', groups: ['12', 'ab'], named: { w: 'ab' } })
  })
  it('reports errors and handles empty input', () => {
    expect(testRegex('(', 'g', 'x').error).toBeTruthy()
    expect(testRegex('', 'g', 'x').matches).toEqual([])
  })
  it('does not loop forever on empty matches', () => {
    expect(testRegex('x*', 'g', 'abc').matches.length).toBe(4)
  })
})

describe('timestamps', () => {
  it('guesses the unit', () => {
    expect(guessUnit(1700000000)).toBe('seconds')
    expect(guessUnit(1700000000000)).toBe('milliseconds')
  })
  it('converts both ways', () => {
    expect(timestampToDate(0, 'seconds')!.toISOString()).toBe('1970-01-01T00:00:00.000Z')
    expect(timestampToDate(1700000000000, 'milliseconds')!.toISOString()).toBe('2023-11-14T22:13:20.000Z')
    expect(dateToTimestamp(new Date('2023-11-14T22:13:20.999Z'), 'seconds')).toBe(1700000000)
    expect(timestampToDate(Number.NaN, 'seconds')).toBeNull()
    expect(timestampToDate(9e20, 'seconds')).toBeNull()
  })
  it('describes relative time', () => {
    const now = new Date('2026-01-10T00:00:00Z')
    expect(relativeTime(new Date('2026-01-07T00:00:00Z'), now)).toBe('3 days ago')
    expect(relativeTime(new Date('2026-01-10T02:00:00Z'), now)).toBe('in 2 hours')
    expect(relativeTime(now, now)).toBe('just now')
  })
})

describe('text and number bases', () => {
  it('round-trips through every base, including UTF-8', () => {
    for (const r of ['hex', 'binary', 'decimal', 'octal'] as const) {
      expect(radixToText(textToRadix('Héllo 😀', r), r)).toBe('Héllo 😀')
    }
    expect(textToRadix('Hi', 'hex')).toBe('48 69')
    expect(textToRadix('A', 'binary')).toBe('01000001')
  })
  it('accepts unbroken hex and 0x prefixes', () => {
    expect(radixToText('48656c6c6f', 'hex')).toBe('Hello')
    expect(radixToText('0x48 0x69', 'hex')).toBe('Hi')
  })
  it('rejects bad input', () => {
    expect(() => radixToText('zz', 'hex')).toThrow(/not a valid/)
    expect(() => radixToText('256', 'decimal')).toThrow(/larger than one byte/)
    expect(() => radixToText('ff', 'hex')).toThrow(/UTF-8/)
  })
})

describe('morse', () => {
  it('encodes and decodes', () => {
    expect(textToMorse('SOS').output).toBe('... --- ...')
    expect(textToMorse('Hi there').output).toBe('.... .. / - .... . .-. .')
    expect(morseToText('.... .. / - .... . .-. .').output).toBe('HI THERE')
  })
  it('reports unsupported characters', () => {
    expect(textToMorse('a😀').skipped).toEqual(['😀'])
    expect(morseToText('...... .-').output).toBe('?A')
  })
})

describe('roman numerals', () => {
  it('converts numbers', () => {
    expect(numberToRoman(4)).toBe('IV')
    expect(numberToRoman(1994)).toBe('MCMXCIV')
    expect(numberToRoman(3999)).toBe('MMMCMXCIX')
    expect(() => numberToRoman(0)).toThrow()
    expect(() => numberToRoman(4000)).toThrow()
    expect(() => numberToRoman(1.5)).toThrow()
  })
  it('parses numerals and round-trips 1 to 3999', () => {
    expect(romanToNumber('mmxxvi')).toBe(2026)
    for (let n = 1; n <= 3999; n++) expect(romanToNumber(numberToRoman(n))).toBe(n)
  })
  it('rejects non-standard forms', () => {
    for (const bad of ['IIII', 'VX', 'IC', 'ABC', '']) expect(() => romanToNumber(bad)).toThrow()
  })
})
