import { describe, expect, it } from 'vitest'
import { checkAnagram } from '@/lib/text/anagram'
import { formatInBase, groupDigits, parseInBase } from '@/lib/dev/baseConvert'
import { futureValue, planRetirement, requiredCorpus, validateRetirement } from '@/lib/calc/retirement'
import { applyFilter, applyFilters, luma } from '@/lib/image/filters'
import { batchL } from '@/data/batches/l'

describe('anagram', () => {
  it('matches phrases ignoring case, spaces and accents', () => {
    expect(checkAnagram('Dormitory', 'dirty room').isAnagram).toBe(true)
    expect(checkAnagram('Éléphant', 'elephant').identical).toBe(true)
    expect(checkAnagram('Listen', 'Silent')).toMatchObject({ isAnagram: true, identical: false })
  })
  it('reports differences', () => {
    const r = checkAnagram('apple', 'appl')
    expect(r.isAnagram).toBe(false)
    expect(r.onlyInA).toEqual([['e', 1]])
    expect(r.onlyInB).toEqual([])
    expect(checkAnagram('', '').isAnagram).toBe(false)
  })
  it('respects options', () => {
    const strict = { ignoreCase: false, lettersOnly: false, stripAccents: false }
    expect(checkAnagram('ab', 'BA', strict).isAnagram).toBe(false)
    expect(checkAnagram('a b', 'ba', strict).isAnagram).toBe(false)
  })
})

describe('base converter', () => {
  it('parses and formats', () => {
    expect(parseInBase('0xFF', 16)).toEqual({ ok: true, value: 255n })
    expect(parseInBase('-1010', 2)).toEqual({ ok: true, value: -10n })
    expect(parseInBase('1111_0000', 2)).toEqual({ ok: true, value: 240n })
    expect(formatInBase(255n, 2)).toBe('11111111')
    expect(formatInBase(35n, 36)).toBe('z')
  })
  it('keeps big numbers exact', () => {
    const r = parseInBase('ffffffffffffffffffffffff', 16)
    expect(r.ok && r.value).toBe(2n ** 96n - 1n)
  })
  it('rejects bad input', () => {
    expect(parseInBase('12', 2)).toMatchObject({ ok: false })
    expect(parseInBase('', 10)).toMatchObject({ ok: false })
    expect(parseInBase('1', 37)).toMatchObject({ ok: false })
  })
  it('groups digits from the right', () => {
    expect(groupDigits('1234567', 3)).toBe('1 234 567')
    expect(groupDigits('-11111111', 4)).toBe('-1111 1111')
  })
})

describe('retirement', () => {
  it('future value and required corpus', () => {
    expect(futureValue(100, 0, 0.01, 2)).toBeCloseTo(102.01, 6)
    expect(futureValue(0, 10, 0, 12)).toBe(120)
    expect(requiredCorpus(100, 0, 0, 10)).toBe(1000)
    expect(requiredCorpus(100, 0.01, 0.01, 10)).toBeCloseTo(1000, 6)
  })
  const base = { currentAge: 30, retirementAge: 60, lifeExpectancy: 85, currentSavings: 0, monthlyContribution: 0, returnBefore: 10, returnAfter: 7, inflation: 6, monthlyExpense: 50000 }
  it('shows a gap and the extra saving that closes it', () => {
    const r = planRetirement(base)
    expect(r.onTrack).toBe(false)
    const fixed = planRetirement({ ...base, monthlyContribution: r.extraMonthly })
    expect(fixed.gap).toBeCloseTo(0, 0)
  })
  it('is on track with large savings', () => {
    expect(planRetirement({ ...base, currentSavings: 1e9 }).onTrack).toBe(true)
  })
  it('validates', () => {
    expect(validateRetirement({ ...base, retirementAge: 20 })).toMatch(/above your current age/)
    expect(validateRetirement({ ...base, monthlyExpense: NaN })).toMatch(/number/)
  })
})

describe('image filters', () => {
  const px = (r: number, g: number, b: number, a = 255) => new Uint8ClampedArray([r, g, b, a])
  it('grayscale makes channels equal and keeps alpha', () => {
    const d = px(200, 100, 50, 77)
    applyFilter(d, 'grayscale', 100)
    expect(d[0]).toBe(d[1])
    expect(d[1]).toBe(d[2])
    expect(d[0]).toBe(Math.round(luma(200, 100, 50)))
    expect(d[3]).toBe(77)
  })
  it('invert, threshold and zero-strength', () => {
    const d = px(10, 20, 30)
    applyFilter(d, 'invert', 100)
    expect(Array.from(d)).toEqual([245, 235, 225, 255])
    const w = px(200, 200, 200)
    applyFilter(w, 'blackwhite', 128)
    expect(Array.from(w)).toEqual([255, 255, 255, 255])
    const z = px(10, 20, 30)
    applyFilter(z, 'sepia', 0)
    expect(Array.from(z)).toEqual([10, 20, 30, 255])
  })
  it('contrast and brightness stay finite at the extremes', () => {
    for (const a of [-100, 100]) {
      const d = px(10, 128, 240)
      applyFilters(d, { contrast: a, brightness: a })
      expect(Array.from(d).every((n) => n >= 0 && n <= 255)).toBe(true)
    }
  })
})

describe('batch L metadata', () => {
  const words = (s: string) => s.split(/\s+/).filter(Boolean).length
  it('has 4 tools with 200+ word articles and no dashes', () => {
    expect(batchL).toHaveLength(4)
    for (const t of batchL) {
      expect(words(t.article!.paragraphs.join(' ')), t.id).toBeGreaterThanOrEqual(200)
      expect(JSON.stringify(t)).not.toMatch(/[–—]/)
    }
  })
})
