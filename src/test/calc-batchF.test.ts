import { describe, expect, it } from 'vitest'
import { evaluate, factorial, formatNumber } from '@/lib/calc/expression'
import {
  calcBreakEven,
  calcFd,
  calcPpf,
  calcRd,
  decimalToFraction,
  fmtFrac,
  fractionOp,
  mixedForm,
  parseFraction,
  simplifyFraction,
  toDecimal,
  type Frac,
} from '@/lib/calc/batchF'

const val = (s: string, opts?: Parameters<typeof evaluate>[1]) => {
  const r = evaluate(s, opts)
  if (!r.ok) throw new Error(r.error)
  return r.value
}
const err = (s: string, opts?: Parameters<typeof evaluate>[1]) => {
  const r = evaluate(s, opts)
  return r.ok ? null : r.error
}

describe('expression evaluator', () => {
  it('respects precedence and parentheses', () => {
    expect(val('2+3*4')).toBe(14)
    expect(val('(2+3)*4')).toBe(20)
    expect(val('10-4-3')).toBe(3)
    expect(val('100/10/5')).toBe(2)
  })
  it('handles unary minus and power precedence', () => {
    expect(val('-2^2')).toBe(-4)
    expect(val('(-2)^2')).toBe(4)
    expect(val('2^-1')).toBe(0.5)
    expect(val('3*-2')).toBe(-6)
    expect(val('--4')).toBe(4)
  })
  it('makes ^ right associative', () => {
    expect(val('2^3^2')).toBe(512)
  })
  it('handles percent and modulo', () => {
    expect(val('50%')).toBe(0.5)
    expect(val('200*10%')).toBe(20)
    expect(val('10%3')).toBe(1)
    expect(val('17 % 5')).toBe(2)
  })
  it('does trig in degrees and radians', () => {
    expect(val('sin(90)', { angle: 'deg' })).toBe(1)
    expect(val('cos(180)', { angle: 'deg' })).toBe(-1)
    expect(val('sin(180)', { angle: 'deg' })).toBe(0)
    expect(val('cos(90)', { angle: 'deg' })).toBe(0)
    expect(val('sin(pi/2)', { angle: 'rad' })).toBe(1)
    expect(val('asin(1)', { angle: 'deg' })).toBeCloseTo(90, 9)
    expect(val('atan(1)', { angle: 'deg' })).toBeCloseTo(45, 9)
    expect(val('acos(0)', { angle: 'rad' })).toBeCloseTo(Math.PI / 2, 12)
  })
  it('evaluates roots, logs and constants', () => {
    expect(val('sqrt(144)')).toBe(12)
    expect(val('cbrt(-27)')).toBe(-3)
    expect(val('ln(e)')).toBe(1)
    expect(val('log(1000)')).toBeCloseTo(3, 12)
    expect(val('log10(100)')).toBeCloseTo(2, 12)
    expect(val('exp(0)')).toBe(1)
    expect(val('abs(-5.5)')).toBe(5.5)
    expect(val('pi')).toBeCloseTo(3.14159265, 7)
    expect(val('π')).toBeCloseTo(3.14159265, 7)
    expect(val('√(16)')).toBe(4)
  })
  it('supports factorial within limits', () => {
    expect(val('5!')).toBe(120)
    expect(val('0!')).toBe(1)
    expect(val('3!+1')).toBe(7)
    expect(factorial(170)).toBeGreaterThan(1e306)
    expect(err('171!')).toMatch(/Factorial/)
    expect(err('(-1)!')).toMatch(/Factorial/)
    expect(err('2.5!')).toMatch(/Factorial/)
  })
  it('supports implicit multiplication', () => {
    expect(val('2(3)')).toBe(6)
    expect(val('2pi')).toBeCloseTo(6.28318530, 7)
    expect(val('(1+2)(3+4)')).toBe(21)
    expect(val('2sin(90)', { angle: 'deg' })).toBe(2)
    expect(val('3e')).toBeCloseTo(8.15484548, 7)
    expect(val('2e3')).toBe(2000)
  })
  it('uses ans', () => {
    expect(val('ans*2', { ans: 21 })).toBe(42)
    expect(val('ans')).toBe(0)
  })
  it('reports division by zero and domain errors', () => {
    expect(err('1/0')).toBe('Cannot divide by zero')
    expect(err('5/(2-2)')).toBe('Cannot divide by zero')
    expect(err('5%0')).toBe('Cannot divide by zero')
    expect(err('0^-1')).toBe('Cannot divide by zero')
    expect(err('sqrt(-4)')).toMatch(/negative/)
    expect(err('ln(0)')).toMatch(/above zero/)
    expect(err('log(-1)')).toMatch(/above zero/)
    expect(err('asin(2)')).toMatch(/between -1 and 1/)
    expect(err('tan(90)', { angle: 'deg' })).toMatch(/undefined/)
    expect(err('(-8)^0.5')).toMatch(/not real/)
    expect(err('10^400')).toBe('Result is too large')
  })
  it('reports malformed input', () => {
    expect(err('')).toBe('Enter an expression')
    expect(err('   ')).toBe('Enter an expression')
    expect(err('(2+3')).toBe('Missing closing parenthesis')
    expect(err('2+3)')).toBe('Unexpected closing parenthesis')
    expect(err('2+')).toMatch(/ends unexpectedly/)
    expect(err('*3')).toMatch(/Unexpected/)
    expect(err('2 3')).toMatch(/Unexpected/)
    expect(err('foo+1')).toMatch(/Unknown name/)
    expect(err('sin 30')).toMatch(/parentheses/)
    expect(err('2 $ 3')).toMatch(/Unexpected character/)
    expect(err('()')).toMatch(/Unexpected/)
    expect(err('1..2')).toMatch(/Unexpected|Invalid/)
  })
  it('never evaluates code', () => {
    expect(err('alert(1)')).toMatch(/Unknown name/)
    expect(err('constructor')).toMatch(/Unknown name/)
    expect(err('process.exit()')).not.toBeNull()
  })
  it('formats numbers without float noise', () => {
    expect(formatNumber(0.1 + 0.2)).toBe('0.3')
    expect(formatNumber(1 / 3)).toBe('0.333333333333')
    expect(formatNumber(100)).toBe('100')
    expect(formatNumber(-0)).toBe('0')
    expect(formatNumber(2 ** 70)).toBe('1.1805916207e21')
    expect(formatNumber(1e-12)).toBe('1e-12')
    expect(formatNumber(Math.sin(Math.PI / 6))).toBe('0.5')
    expect(formatNumber(123456789.123456789)).toBe('123456789.123')
  })
  it('shows 0.1+0.2 as 0.3 end to end', () => {
    expect(formatNumber(val('0.1+0.2'))).toBe('0.3')
  })
})

const F = (s: string): Frac => {
  const r = parseFraction(s)
  if (!r.ok) throw new Error(r.error)
  return r.value
}
const op = (a: string, b: string, o: 'add' | 'sub' | 'mul' | 'div') => {
  const r = fractionOp(F(a), F(b), o)
  if (!r.ok) throw new Error(r.error)
  return r.value
}

describe('parseFraction', () => {
  it('reads fractions, mixed numbers, whole numbers and decimals', () => {
    expect(fmtFrac(F('3/4'))).toBe('3/4')
    expect(fmtFrac(F('-3/4'))).toBe('-3/4')
    expect(fmtFrac(F('1 1/2'))).toBe('3/2')
    expect(fmtFrac(F('-2 3/8'))).toBe('-19/8')
    expect(fmtFrac(F('7'))).toBe('7')
    expect(fmtFrac(F('2.5'))).toBe('25/10')
    expect(fmtFrac(F('3 / -4'.replace('-', '')))).toBe('3/4')
  })
  it('rejects zero denominators, junk and huge numbers', () => {
    const z = parseFraction('3/0')
    expect(z.ok).toBe(false)
    expect(parseFraction('1 2/0').ok).toBe(false)
    expect(parseFraction('').ok).toBe(false)
    expect(parseFraction('abc').ok).toBe(false)
    expect(parseFraction('1/2/3').ok).toBe(false)
    const big = parseFraction('1234567890123456/3')
    expect(big.ok).toBe(false)
    if (!big.ok) expect(big.error).toMatch(/15 digits/)
  })
})

describe('fractionOp', () => {
  it('adds with a common denominator and shows steps', () => {
    const r = op('1/2', '1/3', 'add')
    expect(fmtFrac(r.result)).toBe('5/6')
    expect(r.steps.join(' ')).toMatch(/common denominator/i)
    expect(op('1/6', '1/3', 'add').steps.join(' ')).toMatch(/Common denominator.*6/)
  })
  it('simplifies results', () => {
    expect(fmtFrac(op('1/4', '1/4', 'add').result)).toBe('1/2')
    expect(fmtFrac(op('2/3', '3/4', 'mul').result)).toBe('1/2')
  })
  it('subtracts into negatives', () => {
    expect(fmtFrac(op('1/3', '1/2', 'sub').result)).toBe('-1/6')
    expect(mixedForm(op('1/2', '2 1/2', 'sub').result)).toBe('-2')
  })
  it('works with mixed numbers', () => {
    const r = op('1 1/2', '2 2/3', 'add')
    expect(fmtFrac(r.result)).toBe('25/6')
    expect(mixedForm(r.result)).toBe('4 1/6')
  })
  it('divides by flipping the second fraction', () => {
    const r = op('3/4', '2/5', 'div')
    expect(fmtFrac(r.result)).toBe('15/8')
    expect(r.steps.join(' ')).toMatch(/reciprocal/)
    expect(fmtFrac(op('-1/2', '-1/4', 'div').result)).toBe('2')
  })
  it('keeps the sign on the numerator', () => {
    expect(fmtFrac(op('1/2', '-3/4', 'mul').result)).toBe('-3/8')
  })
  it('refuses to divide by zero', () => {
    const r = fractionOp(F('1/2'), F('0'), 'div')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/divide by zero/)
  })
  it('stays exact for big numbers', () => {
    const r = op('999999999999999/1', '999999999999999/1', 'mul')
    expect(fmtFrac(r.result)).toBe('999999999999998000000000000001')
  })
  it('handles zero results', () => {
    expect(fmtFrac(op('1/2', '1/2', 'sub').result)).toBe('0')
  })
})

describe('mixedForm, simplify and decimals', () => {
  it('writes mixed numbers', () => {
    expect(mixedForm({ n: 7n, d: 3n })).toBe('2 1/3')
    expect(mixedForm({ n: -7n, d: 3n })).toBe('-2 1/3')
    expect(mixedForm({ n: 3n, d: 4n })).toBe('3/4')
    expect(mixedForm({ n: 6n, d: 3n })).toBe('2')
  })
  it('simplifies', () => {
    expect(fmtFrac(simplifyFraction(F('18/24')).result)).toBe('3/4')
    expect(simplifyFraction(F('18/24')).steps.join(' ')).toMatch(/6/)
    expect(fmtFrac(simplifyFraction(F('-10/4')).result)).toBe('-5/2')
    expect(fmtFrac(simplifyFraction(F('0/5')).result)).toBe('0')
  })
  it('converts to decimals and detects repeating blocks', () => {
    expect(toDecimal(F('1/4')).text).toBe('0.25')
    expect(toDecimal(F('1/4')).repeating).toBeNull()
    const third = toDecimal(F('1/3'))
    expect(third.repeating).toBe('0.(3)')
    expect(third.text).toBe('0.333333333333')
    expect(toDecimal(F('1/7')).repeating).toBe('0.(142857)')
    expect(toDecimal(F('-1/6')).repeating).toBe('-0.1(6)')
    expect(toDecimal(F('5/2')).text).toBe('2.5')
    expect(toDecimal(F('4')).text).toBe('4')
  })
})

describe('decimalToFraction', () => {
  const d = (s: string, max?: bigint) => {
    const r = decimalToFraction(s, max)
    if (!r.ok) throw new Error(r.error)
    return r.value
  }
  it('is exact for short terminating decimals', () => {
    expect(fmtFrac(d('0.75').fraction)).toBe('3/4')
    expect(fmtFrac(d('0.125').fraction)).toBe('1/8')
    expect(fmtFrac(d('-2.5').fraction)).toBe('-5/2')
    expect(d('0.75').exact).toBe(true)
  })
  it('reads repeating notation exactly', () => {
    expect(fmtFrac(d('0.(3)').fraction)).toBe('1/3')
    expect(fmtFrac(d('0.1(6)').fraction)).toBe('1/6')
    expect(fmtFrac(d('0.(142857)').fraction)).toBe('1/7')
    expect(fmtFrac(d('0.333...').fraction)).toBe('1/3')
    expect(fmtFrac(d('0.1666...').fraction)).toBe('1/6')
    expect(fmtFrac(d('1.(9)').fraction)).toBe('2')
  })
  it('uses the max denominator for long decimals', () => {
    const r = d('0.3333333')
    expect(fmtFrac(r.fraction)).toBe('1/3')
    expect(r.exact).toBe(false)
    expect(r.note).toMatch(/Exact value/)
    expect(fmtFrac(d('3.14159265', 1000n).fraction)).toBe('355/113')
    expect(fmtFrac(d('3.14159265', 100n).fraction)).toBe('311/99')
    expect(fmtFrac(d('-0.6666667').fraction)).toBe('-2/3')
  })
  it('rejects bad input', () => {
    expect(decimalToFraction('').ok).toBe(false)
    expect(decimalToFraction('abc').ok).toBe(false)
    expect(decimalToFraction('...').ok).toBe(false)
    expect(decimalToFraction('.').ok).toBe(false)
  })
})

describe('calcBreakEven', () => {
  it('computes units, revenue and contribution', () => {
    const r = calcBreakEven({ fixed: 50000, variable: 30, price: 80 })!
    expect(r.viable).toBe(true)
    expect(r.contribution).toBe(50)
    expect(r.ratio).toBeCloseTo(0.625, 10)
    expect(r.units).toBe(1000)
    expect(r.unitsCeil).toBe(1000)
    expect(r.revenue).toBe(80000)
  })
  it('rounds units up', () => {
    const r = calcBreakEven({ fixed: 1000, variable: 3, price: 10 })!
    expect(r.units).toBeCloseTo(142.857, 3)
    expect(r.unitsCeil).toBe(143)
  })
  it('handles target profit and margin of safety', () => {
    const r = calcBreakEven({ fixed: 50000, variable: 30, price: 80, target: 25000, expected: 1500 })!
    expect(r.targetUnits).toBe(1500)
    expect(r.targetRevenue).toBe(120000)
    expect(r.safetyUnits).toBe(500)
    expect(r.safetyPct).toBeCloseTo(33.333, 2)
    expect(r.safetyRevenue).toBe(40000)
  })
  it('shows a negative margin of safety when sales fall short', () => {
    const r = calcBreakEven({ fixed: 50000, variable: 30, price: 80, expected: 800 })!
    expect(r.safetyUnits).toBe(-200)
    expect(r.safetyPct).toBe(-25)
  })
  it('returns not viable instead of NaN when price is at or below variable cost', () => {
    const r = calcBreakEven({ fixed: 1000, variable: 50, price: 50 })!
    expect(r.viable).toBe(false)
    expect(r.contribution).toBe(0)
    expect(calcBreakEven({ fixed: 1000, variable: 60, price: 50 })!.viable).toBe(false)
  })
  it('allows zero fixed costs and rejects invalid input', () => {
    expect(calcBreakEven({ fixed: 0, variable: 1, price: 2 })!.units).toBe(0)
    expect(calcBreakEven({ fixed: NaN, variable: 1, price: 2 })).toBeNull()
    expect(calcBreakEven({ fixed: 10, variable: 1, price: 0 })).toBeNull()
    expect(calcBreakEven({ fixed: -1, variable: 1, price: 2 })).toBeNull()
  })
})

describe('calcFd', () => {
  it('matches yearly compounding', () => {
    const r = calcFd(100000, 8, 12, 'yearly')!
    expect(r.maturity).toBeCloseTo(108000, 6)
    expect(r.interest).toBeCloseTo(8000, 6)
    expect(r.effectiveYield).toBeCloseTo(8, 6)
  })
  it('matches quarterly compounding (1.0175^4)', () => {
    const r = calcFd(100000, 7, 12, 'quarterly')!
    expect(r.maturity).toBeCloseTo(107185.90, 1)
    expect(r.effectiveYield).toBeCloseTo(7.1859, 3)
  })
  it('matches monthly compounding yield for 12%', () => {
    const r = calcFd(100000, 12, 12, 'monthly')!
    expect(r.effectiveYield).toBeCloseTo(12.6825, 3)
  })
  it('does simple interest at maturity', () => {
    const r = calcFd(100000, 10, 24, 'simple')!
    expect(r.maturity).toBeCloseTo(120000, 6)
    expect(r.interest).toBeCloseTo(20000, 6)
    expect(r.effectiveYield).toBeCloseTo(9.5445, 3)
  })
  it('builds a table with a partial last year', () => {
    const r = calcFd(100000, 8, 18, 'yearly')!
    expect(r.rows).toHaveLength(2)
    expect(r.rows[0]!.months).toBe(12)
    expect(r.rows[1]!.months).toBe(6)
    expect(r.rows[1]!.balance).toBeCloseTo(r.maturity, 6)
    expect(r.rows[0]!.interest + r.rows[1]!.interest).toBeCloseTo(r.interest, 6)
  })
  it('handles 0% and short tenures', () => {
    const r = calcFd(50000, 0, 1, 'quarterly')!
    expect(r.maturity).toBe(50000)
    expect(r.effectiveYield).toBe(0)
    expect(calcFd(50000, 6, 1, 'simple')!.interest).toBeCloseTo(250, 6)
  })
  it('rejects invalid input', () => {
    expect(calcFd(0, 7, 12, 'yearly')).toBeNull()
    expect(calcFd(1000, -1, 12, 'yearly')).toBeNull()
    expect(calcFd(1000, 7, 0, 'yearly')).toBeNull()
    expect(calcFd(1000, 7, 1.5, 'yearly')).toBeNull()
    expect(calcFd(NaN, 7, 12, 'yearly')).toBeNull()
  })
})

describe('calcRd', () => {
  it('matches the quarterly compounding formula by hand (3 months at 8%)', () => {
    // 1000 * (1.02^(3/3) + 1.02^(2/3) + 1.02^(1/3)) = 3039.91
    const r = calcRd(1000, 8, 3)!
    expect(r.maturity).toBeCloseTo(3039.91, 1)
    expect(r.deposited).toBe(3000)
    expect(r.interest).toBeCloseTo(39.91, 1)
  })
  it('gives plain deposits at 0%', () => {
    const r = calcRd(500, 0, 12)!
    expect(r.maturity).toBe(6000)
    expect(r.interest).toBe(0)
  })
  it('gives a one-month RD of one quarter-fraction of interest', () => {
    const r = calcRd(1000, 6, 1)!
    expect(r.maturity).toBeCloseTo(1000 * Math.pow(1.015, 1 / 3), 8)
  })
  it('lands in a sensible range for 12 months at 7%', () => {
    const r = calcRd(10000, 7, 12)!
    expect(r.maturity).toBeGreaterThan(120000 + 4500)
    expect(r.maturity).toBeLessThan(120000 + 4700)
  })
  it('builds yearly rows that end at maturity', () => {
    const r = calcRd(2000, 6.5, 30)!
    expect(r.rows).toHaveLength(3)
    expect(r.rows[2]!.months).toBe(6)
    expect(r.rows[2]!.balance).toBeCloseTo(r.maturity, 8)
    expect(r.rows[1]!.deposited).toBe(48000)
  })
  it('rejects invalid input', () => {
    expect(calcRd(0, 7, 12)).toBeNull()
    expect(calcRd(100, 7, 0)).toBeNull()
    expect(calcRd(100, 7, 12.5)).toBeNull()
    expect(calcRd(100, -2, 12)).toBeNull()
  })
})

describe('calcPpf', () => {
  const ok = (...a: Parameters<typeof calcPpf>) => {
    const r = calcPpf(...a)
    if (!r.ok) throw new Error(r.error)
    return r.value
  }
  it('year one with a yearly deposit before the 5th earns the full year', () => {
    const r = ok(150000, 'yearly', 7.1, 1)
    expect(r.rows[0]!.interest).toBeCloseTo(10650, 6)
    expect(r.maturity).toBeCloseTo(160650, 6)
  })
  it('compounds yearly', () => {
    const r = ok(150000, 'yearly', 7.1, 2)
    expect(r.rows[1]!.interest).toBeCloseTo((160650 + 150000) * 0.071, 6)
  })
  it('gives about 40.7 lakh after 15 years of 1.5 lakh at 7.1%', () => {
    const r = ok(150000, 'yearly', 7.1, 15)
    expect(r.rows).toHaveLength(15)
    expect(r.invested).toBe(2250000)
    expect(r.maturity).toBeGreaterThan(4050000)
    expect(r.maturity).toBeLessThan(4090000)
    expect(r.interest).toBeCloseTo(r.maturity - r.invested, 6)
  })
  it('uses the lowest balance for monthly deposits', () => {
    // sum over m=1..12 of 12500*m * 0.071/12 = 12500 * 78 * 0.071 / 12
    const r = ok(12500, 'monthly', 7.1, 1)
    expect(r.rows[0]!.interest).toBeCloseTo((12500 * 78 * 0.071) / 12, 6)
    expect(r.rows[0]!.deposit).toBe(150000)
  })
  it('earns more with a yearly lump sum than with monthly deposits of the same total', () => {
    expect(ok(150000, 'yearly', 7.1, 15).maturity).toBeGreaterThan(ok(12500, 'monthly', 7.1, 15).maturity)
  })
  it('works at 0% and with extension blocks', () => {
    const r = ok(1000, 'yearly', 0, 20)
    expect(r.maturity).toBe(20000)
    expect(r.interest).toBe(0)
    expect(ok(50000, 'yearly', 7.1, 25).rows).toHaveLength(25)
  })
  it('enforces the yearly cap and minimum', () => {
    const over = calcPpf(150001, 'yearly', 7.1, 15)
    expect(over.ok).toBe(false)
    expect(calcPpf(12501, 'monthly', 7.1, 15).ok).toBe(false)
    expect(calcPpf(499, 'yearly', 7.1, 15).ok).toBe(false)
    expect(calcPpf(500, 'yearly', 7.1, 15).ok).toBe(true)
    expect(calcPpf(150000, 'yearly', 7.1, 15).ok).toBe(true)
  })
  it('rejects invalid input', () => {
    expect(calcPpf(NaN, 'yearly', 7.1, 15).ok).toBe(false)
    expect(calcPpf(1000, 'yearly', -1, 15).ok).toBe(false)
    expect(calcPpf(1000, 'yearly', 7.1, 0).ok).toBe(false)
    expect(calcPpf(1000, 'yearly', 7.1, 2.5).ok).toBe(false)
    expect(calcPpf(0, 'yearly', 7.1, 15).ok).toBe(false)
  })
})
