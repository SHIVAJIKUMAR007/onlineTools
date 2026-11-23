import { describe, expect, it } from 'vitest'
import { DEFAULT_INPUT, calcSalary, hraExemption, incomeTax, slabTax, NEW_REGIME_SLABS } from '@/lib/calc/india'

describe('income tax', () => {
  it('has no new-regime tax up to 12 lakh because of the rebate', () => {
    expect(incomeTax(1_200_000, 'new')).toBe(0)
    expect(incomeTax(400_000, 'new')).toBe(0)
  })
  it('applies marginal relief just above 12 lakh', () => {
    expect(incomeTax(1_210_000, 'new')).toBe(10_400) // 10,000 plus 4% cess
  })
  it('taxes a mid income on the new slabs with cess', () => {
    expect(incomeTax(1_300_000, 'new')).toBe(78_000)
    expect(incomeTax(2_500_000, 'new')).toBe(343_200)
  })
  it('adds surcharge above 50 lakh', () => {
    const base = slabTax(6_000_000, NEW_REGIME_SLABS)
    expect(incomeTax(6_000_000, 'new')).toBe(Math.round(base * 1.1 * 1.04))
  })
  it('uses old regime slabs and rebate up to 5 lakh', () => {
    expect(incomeTax(500_000, 'old')).toBe(0)
    expect(incomeTax(600_000, 'old')).toBe(33_800)
    expect(incomeTax(1_000_000, 'old')).toBe(117_000)
  })
  it('handles zero, negative and NaN', () => {
    expect(incomeTax(0, 'new')).toBe(0)
    expect(incomeTax(-5, 'old')).toBe(0)
    expect(incomeTax(NaN, 'new')).toBe(0)
  })
})

describe('HRA exemption', () => {
  it('takes the lowest of the three limits', () => {
    expect(hraExemption(240_000, 480_000, 300_000, true)).toBe(240_000)
    expect(hraExemption(240_000, 480_000, 100_000, true)).toBe(52_000)
    expect(hraExemption(240_000, 480_000, 300_000, false)).toBe(192_000)
  })
  it('is zero without rent', () => {
    expect(hraExemption(240_000, 480_000, 0, true)).toBe(0)
  })
})

describe('calcSalary', () => {
  it('rejects missing or invalid CTC', () => {
    expect(calcSalary({ ...DEFAULT_INPUT, ctc: NaN })).toBeNull()
    expect(calcSalary({ ...DEFAULT_INPUT, ctc: 0 })).toBeNull()
  })
  it('splits a 12 lakh CTC into components that add back up', () => {
    const r = calcSalary(DEFAULT_INPUT)!
    expect(r.basic).toBe(480_000)
    expect(r.hra).toBe(240_000)
    expect(r.employerPf).toBe(57_600)
    expect(r.gratuity).toBeCloseTo(23_076.9, 0)
    expect(r.basic + r.hra + r.special + r.employerPf + r.gratuity).toBeCloseTo(1_200_000, 4)
    expect(r.negativeSpecial).toBe(false)
  })
  it('gives no tax on 12 lakh CTC in the new regime', () => {
    const r = calcSalary(DEFAULT_INPUT)!
    expect(r.newRegime.tax).toBe(0)
    expect(r.newRegime.annualInHand).toBeCloseTo(r.gross - r.employeePf - r.professionalTax, 4)
    expect(r.newRegime.monthlyInHand).toBeCloseTo(r.newRegime.annualInHand / 12, 6)
  })
  it('caps PF at the wage ceiling when asked', () => {
    const r = calcSalary({ ...DEFAULT_INPUT, pfCap: true })!
    expect(r.employeePf).toBe(21_600)
  })
  it('lets old-regime deductions lower tax and picks the better regime', () => {
    const none = calcSalary({ ...DEFAULT_INPUT, ctc: 3_000_000 })!
    const withDed = calcSalary({ ...DEFAULT_INPUT, ctc: 3_000_000, rentAnnual: 600_000, ded80C: 150_000, ded80D: 25_000, nps: 50_000, homeLoanInterest: 200_000 })!
    expect(withDed.oldRegime.tax).toBeLessThan(none.oldRegime.tax)
    expect(withDed.deductions80C).toBe(150_000)
    expect(['new', 'old']).toContain(withDed.better)
  })
  it('flags a negative special allowance', () => {
    expect(calcSalary({ ...DEFAULT_INPUT, basicPct: 90 })!.negativeSpecial).toBe(true)
  })
})
