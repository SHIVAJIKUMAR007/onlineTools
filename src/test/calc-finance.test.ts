import { describe, expect, it } from 'vitest'
import {
  calcCompound,
  calcDiscount,
  calcEmi,
  calcGst,
  calcMargin,
  calcSip,
  calcTip,
  emiByYear,
  priceFromMargin,
  priceFromMarkup,
  salaryFromAnnual,
  salaryFromHourly,
} from '@/lib/calc/finance'

describe('calcEmi', () => {
  it('matches the standard formula', () => {
    const r = calcEmi(1_000_000, 10, 120)!
    expect(r.emi).toBeCloseTo(13215.07, 1)
    expect(r.schedule).toHaveLength(120)
    expect(r.schedule[119]!.balance).toBe(0)
    expect(r.totalPayment).toBeCloseTo(r.emi * 120, 0)
  })
  it('handles 0% rate', () => {
    const r = calcEmi(1200, 0, 12)!
    expect(r.emi).toBe(100)
    expect(r.totalInterest).toBe(0)
  })
  it('rejects invalid input', () => {
    expect(calcEmi(0, 5, 12)).toBeNull()
    expect(calcEmi(1000, 5, 0)).toBeNull()
    expect(calcEmi(1000, -1, 12)).toBeNull()
    expect(calcEmi(NaN, 5, 12)).toBeNull()
  })
  it('groups by year', () => {
    const r = calcEmi(100000, 8, 30)!
    const y = emiByYear(r.schedule)
    expect(y).toHaveLength(3)
    expect(y[2]!.balance).toBe(0)
    expect(y.reduce((s, x) => s + x.principal, 0)).toBeCloseTo(100000, 4)
  })
})

describe('calcSip', () => {
  it('computes future value', () => {
    const r = calcSip(5000, 12, 10)!
    expect(r.invested).toBe(600000)
    expect(r.futureValue).toBeCloseTo(1161695, -2)
    expect(r.rows).toHaveLength(10)
  })
  it('0% return equals invested', () => {
    const r = calcSip(1000, 0, 2)!
    expect(r.futureValue).toBe(24000)
  })
  it('step-up increases investment', () => {
    const a = calcSip(1000, 10, 5)!
    const b = calcSip(1000, 10, 5, 10)!
    expect(b.invested).toBeGreaterThan(a.invested)
  })
  it('rejects invalid', () => {
    expect(calcSip(0, 10, 5)).toBeNull()
    expect(calcSip(1000, 10, 0)).toBeNull()
  })
})

describe('calcCompound', () => {
  it('annual compounding', () => {
    const r = calcCompound(1000, 10, 2, 1)!
    expect(r.finalBalance).toBeCloseTo(1210, 6)
  })
  it('monthly compounding exceeds annual', () => {
    expect(calcCompound(1000, 10, 5, 12)!.finalBalance).toBeGreaterThan(calcCompound(1000, 10, 5, 1)!.finalBalance)
  })
  it('contributions are counted', () => {
    const r = calcCompound(0, 0, 1, 12, 100)!
    expect(r.finalBalance).toBe(1200)
    expect(r.contributed).toBe(1200)
  })
  it('rejects nothing-to-grow and bad input', () => {
    expect(calcCompound(0, 5, 5, 1, 0)).toBeNull()
    expect(calcCompound(100, 5, 0, 1)).toBeNull()
    expect(calcCompound(100, 5, 5, 0)).toBeNull()
  })
})

describe('calcGst', () => {
  it('adds GST', () => {
    const r = calcGst(1000, 18, 'add')!
    expect(r.tax).toBeCloseTo(180)
    expect(r.gross).toBeCloseTo(1180)
    expect(r.half).toBeCloseTo(90)
  })
  it('removes GST', () => {
    const r = calcGst(1180, 18, 'remove')!
    expect(r.net).toBeCloseTo(1000)
    expect(r.tax).toBeCloseTo(180)
  })
  it('handles 0 rate and invalid', () => {
    expect(calcGst(100, 0, 'remove')!.tax).toBe(0)
    expect(calcGst(-1, 5, 'add')).toBeNull()
    expect(calcGst(NaN, 5, 'add')).toBeNull()
  })
})

describe('calcDiscount', () => {
  it('stacks two discounts and tax', () => {
    const r = calcDiscount(200, 20, 10, 10)!
    expect(r.afterSecond).toBeCloseTo(144)
    expect(r.finalPrice).toBeCloseTo(158.4)
    expect(r.saved).toBeCloseTo(56)
    expect(r.effectivePct).toBeCloseTo(28)
  })
  it('rejects >100%', () => {
    expect(calcDiscount(100, 120)).toBeNull()
  })
  it('zero price', () => {
    expect(calcDiscount(0, 10)!.effectivePct).toBe(0)
  })
})

describe('calcTip', () => {
  it('splits a bill', () => {
    const r = calcTip(100, 20, 4)!
    expect(r.tip).toBeCloseTo(20)
    expect(r.perPerson).toBeCloseTo(30)
  })
  it('rounds up per person', () => {
    const r = calcTip(87.5, 15, 3, true)!
    expect(r.perPerson).toBe(34)
    expect(r.total).toBe(102)
    expect(r.tip).toBeCloseTo(14.5)
  })
  it('rejects zero people', () => {
    expect(calcTip(50, 10, 0)).toBeNull()
  })
})

describe('margin', () => {
  it('computes margin and markup', () => {
    const r = calcMargin(60, 100)!
    expect(r.profit).toBe(40)
    expect(r.marginPct).toBeCloseTo(40)
    expect(r.markupPct).toBeCloseTo(66.667, 2)
  })
  it('solves price', () => {
    expect(priceFromMargin(60, 40)).toBeCloseTo(100)
    expect(priceFromMarkup(60, 50)).toBeCloseTo(90)
  })
  it('edge cases', () => {
    expect(priceFromMargin(60, 100)).toBeNull()
    expect(calcMargin(10, 0)).toBeNull()
    expect(calcMargin(0, 10)!.markupPct).toBe(Infinity)
  })
})

describe('salary', () => {
  it('hourly to annual', () => {
    const r = salaryFromHourly(25, 40, 52)!
    expect(r.weekly).toBe(1000)
    expect(r.annual).toBe(52000)
    expect(r.monthly).toBeCloseTo(4333.33, 2)
    expect(r.daily).toBe(200)
  })
  it('annual to hourly', () => {
    expect(salaryFromAnnual(52000, 40, 52)!.hourly).toBeCloseTo(25)
  })
  it('rejects invalid hours', () => {
    expect(salaryFromHourly(25, 0, 52)).toBeNull()
    expect(salaryFromHourly(25, 40, 60)).toBeNull()
  })
})
