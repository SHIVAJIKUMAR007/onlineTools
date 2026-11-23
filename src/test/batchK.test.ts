import { describe, expect, it } from 'vitest'
import {
  buildTypingText, charStates, checkDigits, drawPrompt, emptyDeck, generateDigits, memoryShowMs, parseNames, pickWinners, scoreTyping,
  splitTeams, teamCount, teamsToText, typingTextLength,
} from '@/lib/utilities/batchK'
import { DARES, TRUTHS, WOULD_YOU_RATHER } from '@/lib/utilities/batchKPrompts'
import { TYPING_PASSAGES } from '@/lib/utilities/batchKData'
import {
  describeNumbers, parseNumberList, parseWeightedList, scaleRatio, shareTotal, simplifyRatio, solveProportion, weightedAverage,
} from '@/lib/calc/batchK'
import type { Uint32Source } from '@/lib/utilities/random'
import { batchK } from '@/data/batches/k'

const seeded = (seed = 1): Uint32Source => {
  let s = seed >>> 0
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s
  }
}

describe('typing test', () => {
  it('scores WPM as correct chars / 5 per minute', () => {
    const s = scoreTyping('hello world', 'hello wurld', 60)
    expect(s.typedChars).toBe(11)
    expect(s.correctChars).toBe(10)
    expect(s.errors).toBe(1)
    expect(s.wpm).toBeCloseTo(2)
    expect(s.rawWpm).toBeCloseTo(2.2)
    expect(s.accuracy).toBeCloseTo(90.909, 2)
  })
  it('handles empty input and zero time', () => {
    expect(scoreTyping('abc', '', 0)).toMatchObject({ wpm: 0, accuracy: 100, errors: 0 })
    expect(scoreTyping('abc', 'abc', 30).wpm).toBeCloseTo(1.2)
  })
  it('marks characters', () => {
    expect(charStates('abc', 'ax')).toEqual(['correct', 'wrong', 'pending'])
  })
  it('builds enough text and has plain ASCII passages', () => {
    for (const d of [30, 60, 120]) expect(buildTypingText(TYPING_PASSAGES, 3, typingTextLength(d)).length).toBeGreaterThanOrEqual(typingTextLength(d))
    expect(TYPING_PASSAGES.every((p) => /^[\x20-\x7e]+$/.test(p))).toBe(true)
    expect(buildTypingText([], 0, 10)).toBe('')
  })
})

describe('team picker', () => {
  it('parses and dedupes names', () => {
    expect(parseNames(' Ann\n\nben \nANN\r\n')).toEqual(['Ann', 'ben', 'ANN'])
    expect(parseNames('Ann\nben\nANN', true)).toEqual(['Ann', 'ben'])
  })
  it('picks distinct winners', () => {
    const names = ['a', 'b', 'c', 'd', 'e']
    const w = pickWinners(names, 3, seeded(5))
    expect(new Set(w).size).toBe(3)
    expect(pickWinners(names, 99)).toHaveLength(5)
    expect(pickWinners(names, 0)).toEqual([])
  })
  it('splits into balanced teams', () => {
    const names = Array.from({ length: 10 }, (_, i) => `n${i}`)
    const byCount = splitTeams(names, 'teams', 3, seeded(2))
    expect(byCount.map((t) => t.length).sort()).toEqual([3, 3, 4])
    const bySize = splitTeams(names, 'size', 4, seeded(3))
    expect(bySize).toHaveLength(3)
    expect(Math.max(...bySize.map((t) => t.length))).toBeLessThanOrEqual(4)
    expect(bySize.flat().sort()).toEqual([...names].sort())
    expect(splitTeams(names, 'teams', 50)).toHaveLength(10)
    expect(splitTeams(names, 'teams', 0)).toEqual([])
    expect(teamCount(0, 'teams', 2)).toBe(0)
    expect(teamsToText([['a', 'b'], ['c']])).toBe('Team 1: a, b\nTeam 2: c')
  })
})

describe('prompt deck', () => {
  it('never repeats before exhausting the deck', () => {
    let deck = emptyDeck()
    const seen: number[] = []
    const src = seeded(9)
    for (let i = 0; i < 10; i++) {
      const r = drawPrompt(deck, 10, src)
      deck = r.deck
      seen.push(r.index)
      expect(r.reshuffled).toBe(false)
    }
    expect(new Set(seen).size).toBe(10)
    const next = drawPrompt(deck, 10, src)
    expect(next.reshuffled).toBe(true)
    expect(next.index).not.toBe(seen[9])
  })
  it('has enough unique prompts', () => {
    expect(WOULD_YOU_RATHER.length).toBeGreaterThanOrEqual(60)
    expect(TRUTHS.length).toBeGreaterThanOrEqual(40)
    expect(DARES.length).toBeGreaterThanOrEqual(40)
    for (const l of [WOULD_YOU_RATHER, TRUTHS, DARES]) expect(new Set(l).size).toBe(l.length)
  })
  it('handles a single prompt', () => {
    const a = drawPrompt(emptyDeck(), 1)
    expect(drawPrompt(a.deck, 1).index).toBe(0)
  })
})

describe('number memory', () => {
  it('generates digits with no leading zero', () => {
    for (let n = 1; n <= 12; n++) {
      const d = generateDigits(n, seeded(n))
      expect(d).toHaveLength(n)
      expect(d[0]).not.toBe('0')
      expect(/^\d+$/.test(d)).toBe(true)
    }
  })
  it('checks answers and timing', () => {
    expect(checkDigits('123', ' 123 ')).toBe(true)
    expect(checkDigits('123', '124')).toBe(false)
    expect(memoryShowMs(1)).toBe(1500)
    expect(memoryShowMs(10)).toBe(6000)
  })
})

describe('ratios', () => {
  it('simplifies', () => {
    expect(simplifyRatio([12, 18, 30])).toEqual([2, 3, 5])
    expect(simplifyRatio([1.5, 2.5])).toEqual([3, 5])
    expect(simplifyRatio([0, 5])).toEqual([0, 1])
    expect(simplifyRatio([0, 0])).toBeNull()
    expect(simplifyRatio([-1, 2])).toBeNull()
    expect(simplifyRatio([3])).toBeNull()
    expect(simplifyRatio([0.1, 0.3])).toEqual([1, 3])
  })
  it('scales and shares', () => {
    expect(scaleRatio([2, 3], 2.5)).toEqual([5, 7.5])
    expect(shareTotal(500, [2, 3])).toEqual([200, 300])
    expect(shareTotal(5, [0, 0])).toBeNull()
  })
  it('solves proportions', () => {
    const t = { a: 3, b: 4, c: 9, d: 12 }
    expect(solveProportion({ ...t, d: 0 }, 'd')).toBe(12)
    expect(solveProportion({ ...t, c: 0 }, 'c')).toBe(9)
    expect(solveProportion({ ...t, b: 0 }, 'b')).toBe(4)
    expect(solveProportion({ ...t, a: 0 }, 'a')).toBe(3)
    expect(solveProportion({ a: 0, b: 4, c: 9, d: 0 }, 'd')).toBeNull()
  })
})

describe('averages', () => {
  it('parses lists', () => {
    expect(parseNumberList('1, 2;3\n4.5 -2 x 1e2')).toEqual({ values: [1, 2, 3, 4.5, -2, 100], invalid: ['x'] })
    expect(parseNumberList('')).toEqual({ values: [], invalid: [] })
  })
  it('describes', () => {
    const s = describeNumbers([4, 8, 8, 15, 16, 23, 42])!
    expect(s).toMatchObject({ count: 7, sum: 116, median: 15, mode: [8], range: 38, min: 4, max: 42 })
    expect(s.mean).toBeCloseTo(16.571, 3)
    expect(describeNumbers([1, 2, 3, 4])!.median).toBe(2.5)
    expect(describeNumbers([1, 1, 2, 2, 3])!.mode).toEqual([1, 2])
    expect(describeNumbers([1, 2, 3])!.mode).toEqual([])
    expect(describeNumbers([])).toBeNull()
  })
  it('weights', () => {
    const { pairs, invalid } = parseWeightedList('90 40\n78, 30\n85:30\nbad')
    expect(invalid).toEqual(['bad'])
    expect(weightedAverage(pairs)).toBeCloseTo(84.9, 5)
    expect(weightedAverage([{ value: 1, weight: 0 }])).toBeNull()
  })
})

describe('batch K metadata', () => {
  const words = (s: string) => s.split(/\s+/).filter(Boolean).length
  it('has 5 tools with articles of 200+ words and no dashes', () => {
    expect(batchK).toHaveLength(5)
    for (const t of batchK) {
      expect(words(t.article!.paragraphs.join(' ')), t.id).toBeGreaterThanOrEqual(200)
      expect(JSON.stringify(t)).not.toMatch(/[–—]/)
      expect(t.seoTitle.length).toBeGreaterThanOrEqual(16)
      expect(t.seoTitle.length).toBeLessThanOrEqual(75)
      expect(t.seoDescription.length).toBeGreaterThan(50)
      expect(t.seoDescription.length).toBeLessThanOrEqual(200)
    }
  })
})
