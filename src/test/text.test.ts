import { describe, expect, it } from 'vitest'
import { convertCase, formatMinutes, generateLorem, graphemes, removeDuplicateLines, reverseText, splitWords, textStats } from '@/lib/text'
import { buildSideBySide } from '@/lib/text/diff'

describe('textStats', () => {
  it('counts an empty string as zeros', () => {
    expect(textStats('')).toMatchObject({ words: 0, characters: 0, sentences: 0, paragraphs: 0 })
  })
  it('counts words, sentences and paragraphs', () => {
    const s = textStats('Hello world. This is a test!\n\nSecond paragraph here.')
    expect(s.words).toBe(9)
    expect(s.sentences).toBe(3)
    expect(s.paragraphs).toBe(2)
  })
  it('counts characters with and without spaces, by code point', () => {
    const s = textStats('a b 😀')
    expect(s.characters).toBe(5)
    expect(s.charactersNoSpaces).toBe(3)
  })
  it('treats runs like "?!" and "..." as one sentence end', () => {
    expect(textStats('Really?! Yes... ok.').sentences).toBe(3)
  })
  it('estimates reading time from 238 wpm', () => {
    expect(textStats('word '.repeat(238)).readingMinutes).toBeCloseTo(1, 5)
    expect(formatMinutes(1.5)).toBe('1 min 30 sec')
    expect(formatMinutes(0)).toBe('0 sec')
  })
})

describe('convertCase', () => {
  it('handles basic cases', () => {
    expect(convertCase('Hello World', 'upper')).toBe('HELLO WORLD')
    expect(convertCase('Hello World', 'lower')).toBe('hello world')
  })
  it('title-cases but keeps small words lowercase', () => {
    expect(convertCase('the lord of the rings', 'title')).toBe('The Lord of the Rings')
    expect(convertCase("it's a test", 'title')).toBe("It's a Test")
  })
  it('sentence-cases after full stops', () => {
    expect(convertCase('HELLO there. HOW are you? fine', 'sentence')).toBe('Hello there. How are you? Fine')
  })
  it('converts programmer cases from any input style', () => {
    expect(convertCase('hello big world', 'camel')).toBe('helloBigWorld')
    expect(convertCase('hello big world', 'pascal')).toBe('HelloBigWorld')
    expect(convertCase('helloBigWorld', 'snake')).toBe('hello_big_world')
    expect(convertCase('Hello  Big-World_again', 'kebab')).toBe('hello-big-world-again')
    expect(convertCase('userID value', 'constant')).toBe('USER_ID_VALUE')
  })
  it('splits camelCase and acronyms', () => {
    expect(splitWords('parseHTTPResponse')).toEqual(['parse', 'HTTP', 'Response'])
  })
})

describe('removeDuplicateLines', () => {
  const base = { caseSensitive: true, trim: false, removeEmpty: false }
  it('keeps the first occurrence and original order', () => {
    expect(removeDuplicateLines('a\nb\na\nc\nb', base).output).toBe('a\nb\nc')
  })
  it('reports how many were removed', () => {
    expect(removeDuplicateLines('a\na\na', base)).toMatchObject({ removed: 2, kept: 1 })
  })
  it('can ignore case, trim spaces and drop empty lines', () => {
    expect(removeDuplicateLines('Apple\n apple \n\nbanana\n', { caseSensitive: false, trim: true, removeEmpty: true }).output).toBe('Apple\nbanana')
  })
  it('handles Windows line endings', () => {
    expect(removeDuplicateLines('a\r\na\r\nb', base).output).toBe('a\nb')
  })
})

describe('reverseText', () => {
  it('reverses characters without breaking emoji sequences', () => {
    expect(reverseText('abc 👨‍👩‍👧', 'characters')).toBe('👨‍👩‍👧 cba')
  })
  it('reverses word order per line', () => {
    expect(reverseText('one two three\nfour five', 'words')).toBe('three two one\nfive four')
  })
  it('reverses line order', () => {
    expect(reverseText('a\nb\nc', 'lines')).toBe('c\nb\na')
  })
  it('graphemes splits combined characters', () => {
    expect(graphemes('éa')).toHaveLength(2)
  })
})

describe('generateLorem', () => {
  const seeded = () => {
    let x = 7
    return () => ((x = (x * 16807) % 2147483647) / 2147483647)
  }
  it('returns the exact number of words', () => {
    expect(generateLorem('words', 12, { classic: false, rng: seeded() }).split(' ')).toHaveLength(12)
  })
  it('starts with the classic opening', () => {
    expect(generateLorem('sentences', 2, { classic: true, rng: seeded() }).startsWith('Lorem ipsum dolor sit amet')).toBe(true)
  })
  it('creates the requested number of paragraphs', () => {
    expect(generateLorem('paragraphs', 4, { classic: false, rng: seeded() }).split('\n\n')).toHaveLength(4)
  })
  it('creates the requested number of sentences', () => {
    const s = generateLorem('sentences', 5, { classic: false, rng: seeded() })
    expect(s.match(/\./g)).toHaveLength(5)
  })
})

describe('buildSideBySide', () => {
  it('detects identical text', () => {
    expect(buildSideBySide('a\nb', 'a\nb').identical).toBe(true)
  })
  it('does not flag the last line when lines are added after it', () => {
    const d = buildSideBySide('one\ntwo\nthree', 'one\ntwo\nthree\nfour')
    expect(d).toMatchObject({ added: 1, removed: 0, changed: 0 })
  })
  it('pairs a replaced line as "changed" and highlights the changed word', () => {
    const d = buildSideBySide('the quick fox', 'the slow fox')
    expect(d.changed).toBe(1)
    const row = d.rows[0]
    expect(row.left?.segs.some((s) => s.changed && s.text.includes('quick'))).toBe(true)
    expect(row.right?.segs.some((s) => s.changed && s.text.includes('slow'))).toBe(true)
  })
  it('counts pure additions and deletions', () => {
    const d = buildSideBySide('a\nb\nc', 'a\nc')
    expect(d).toMatchObject({ removed: 1, added: 0 })
  })
  it('numbers lines independently on each side', () => {
    const d = buildSideBySide('a\nb', 'a\nx\ny\nb')
    const rights = d.rows.map((r) => r.right?.no).filter(Boolean)
    expect(rights).toEqual([1, 2, 3, 4])
  })
})
