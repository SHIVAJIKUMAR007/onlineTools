import { describe, expect, it } from 'vitest'
import {
  addMonths,
  addPercent,
  addWorkingDays,
  ageInfo,
  bmiCategory,
  calcBmi,
  calcCgpa,
  calcGpa,
  countWorkingDays,
  dayOfYear,
  diffDays,
  formatNumber,
  isLeapYear,
  isoWeek,
  isoWeekRange,
  isoWeeksInYear,
  leapReason,
  leapYearsInRange,
  nextLeapYear,
  parseDate,
  parseHolidays,
  percentChange,
  percentOf,
  percentToGpa,
  previousLeapYear,
  shiftDate,
  subtractPercent,
  toIso,
  weekday,
  whatPercent,
  ymdDiff,
  type DateParts,
} from '@/lib/calc/general'

const D = (s: string): DateParts => {
  const p = parseDate(s)
  if (!p) throw new Error('bad date ' + s)
  return p
}
const iso = (p: DateParts | null) => (p ? toIso(p) : null)

describe('dates', () => {
  it('parses and rejects invalid dates', () => {
    expect(parseDate('2024-02-29')).toEqual({ y: 2024, m: 2, d: 29 })
    expect(parseDate('2023-02-29')).toBeNull()
    expect(parseDate('2023-13-01')).toBeNull()
    expect(parseDate('')).toBeNull()
    expect(parseDate('hello')).toBeNull()
  })
  it('leap years incl. 1900 and 2000', () => {
    expect(isLeapYear(1900)).toBe(false)
    expect(isLeapYear(2000)).toBe(true)
    expect(isLeapYear(2024)).toBe(true)
    expect(isLeapYear(2023)).toBe(false)
    expect(isLeapYear(2100)).toBe(false)
  })
  it('counts days across a leap day and DST', () => {
    expect(diffDays(D('2024-01-01'), D('2024-12-31'))).toBe(365)
    expect(diffDays(D('2023-01-01'), D('2023-12-31'))).toBe(364)
    expect(diffDays(D('2024-03-09'), D('2024-03-11'))).toBe(2)
    expect(diffDays(D('2024-10-26'), D('2024-10-28'))).toBe(2)
  })
  it('weekday and day of year', () => {
    expect(weekday(D('2000-01-01'))).toBe(6)
    expect(weekday(D('1970-01-01'))).toBe(4)
    expect(dayOfYear(D('2024-12-31'))).toBe(366)
    expect(dayOfYear(D('2023-03-01'))).toBe(60)
  })
  it('clamps month ends when adding months', () => {
    expect(iso(addMonths(D('2023-01-31'), 1))).toBe('2023-02-28')
    expect(iso(addMonths(D('2024-01-31'), 1))).toBe('2024-02-29')
    expect(iso(addMonths(D('2024-03-31'), -1))).toBe('2024-02-29')
    expect(iso(addMonths(D('2024-11-15'), 3))).toBe('2025-02-15')
    expect(iso(addMonths(D('2024-02-29'), 12))).toBe('2025-02-28')
  })
  it('shifts by years, months, weeks and days', () => {
    expect(iso(shiftDate(D('2024-01-31'), { years: 0, months: 1, weeks: 1, days: 2 }, 1))).toBe('2024-03-09')
    expect(iso(shiftDate(D('2024-03-01'), { years: 1, months: 0, weeks: 0, days: 0 }, -1))).toBe('2023-03-01')
    expect(shiftDate(D('0001-01-01'), { years: 5, months: 0, weeks: 0, days: 0 }, -1)).toBeNull()
  })
  it('computes y/m/d differences', () => {
    expect(ymdDiff(D('2023-01-31'), D('2023-03-01'))).toEqual({ years: 0, months: 1, days: 1 })
    expect(ymdDiff(D('2000-05-15'), D('2024-05-15'))).toEqual({ years: 24, months: 0, days: 0 })
    expect(ymdDiff(D('2000-05-15'), D('2024-05-14'))).toEqual({ years: 23, months: 11, days: 29 })
  })
})

describe('age', () => {
  it('handles a Feb 29 birthday', () => {
    const a = ageInfo(D('2000-02-29'), D('2023-03-01'))!
    expect(a.ymd).toEqual({ years: 23, months: 0, days: 1 })
    expect(iso(a.nextBirthday)).toBe('2024-02-29')
    expect(a.turning).toBe(24)
    expect(a.daysUntilBirthday).toBe(365)
  })
  it('is zero days until birthday on the birthday', () => {
    const a = ageInfo(D('1990-06-15'), D('2024-06-15'))!
    expect(a.daysUntilBirthday).toBe(0)
    expect(a.ymd.years).toBe(34)
    expect(a.totalHours).toBe(a.totalDays * 24)
  })
  it('rejects a birth date after the chosen date', () => {
    expect(ageInfo(D('2030-01-01'), D('2024-01-01'))).toBeNull()
  })
})

describe('ISO weeks', () => {
  it('week 53 and week 1 of the neighbouring year', () => {
    expect(isoWeek(D('2021-01-01'))).toEqual({ week: 53, year: 2020 })
    expect(isoWeek(D('2024-12-30'))).toEqual({ week: 1, year: 2025 })
    expect(isoWeek(D('2026-01-01'))).toEqual({ week: 1, year: 2026 })
    expect(isoWeek(D('2024-01-01'))).toEqual({ week: 1, year: 2024 })
    expect(isoWeek(D('2023-01-01'))).toEqual({ week: 52, year: 2022 })
  })
  it('weeks in a year', () => {
    expect(isoWeeksInYear(2020)).toBe(53)
    expect(isoWeeksInYear(2015)).toBe(53)
    expect(isoWeeksInYear(2021)).toBe(52)
    expect(isoWeeksInYear(2026)).toBe(53)
  })
  it('Monday to Sunday range', () => {
    const r = isoWeekRange(D('2021-01-01'))
    expect(toIso(r.monday)).toBe('2020-12-28')
    expect(toIso(r.sunday)).toBe('2021-01-03')
    const s = isoWeekRange(D('2024-06-09'))
    expect(toIso(s.monday)).toBe('2024-06-03')
  })
})

describe('leap years', () => {
  it('explains the rule', () => {
    expect(leapReason(1900)).toMatch(/not a leap year/)
    expect(leapReason(2000)).toMatch(/400/)
    expect(leapReason(2023)).toMatch(/not divisible by 4/)
  })
  it('finds neighbours and ranges', () => {
    expect(nextLeapYear(2024)).toBe(2028)
    expect(nextLeapYear(2096)).toBe(2104)
    expect(previousLeapYear(2000)).toBe(1996)
    expect(previousLeapYear(1)).toBeNull()
    expect(leapYearsInRange(2000, 2020)).toEqual({ years: [2000, 2004, 2008, 2012, 2016, 2020], total: 6 })
    expect(leapYearsInRange(2020, 2000).total).toBe(6)
    expect(leapYearsInRange(1, 9999, 10).years).toHaveLength(10)
  })
})

describe('percentages', () => {
  it('basic operations', () => {
    expect(percentOf(15, 200)).toBe(30)
    expect(whatPercent(50, 200)).toBe(25)
    expect(whatPercent(1, 0)).toBeNull()
    expect(percentChange(50, 75)).toBe(50)
    expect(percentChange(80, 60)).toBe(-25)
    expect(percentChange(0, 5)).toBeNull()
    expect(addPercent(100, 20)).toBe(120)
    expect(subtractPercent(100, 20)).toBe(80)
  })
  it('formats numbers', () => {
    expect(formatNumber(1234.56789)).toBe('1,234.5679')
    expect(formatNumber(-0.00001)).toBe('0')
    expect(formatNumber(NaN)).toBe('-')
  })
})

describe('bmi', () => {
  it('classifies WHO ranges', () => {
    const r = calcBmi(70, 175)!
    expect(r.bmi).toBeCloseTo(22.86, 2)
    expect(r.category).toBe('Normal weight')
    expect(r.healthyMinKg).toBeCloseTo(56.7, 1)
    expect(bmiCategory(18.4).category).toBe('Mild thinness')
    expect(bmiCategory(18.5).category).toBe('Normal weight')
    expect(bmiCategory(25).category).toBe('Overweight')
    expect(bmiCategory(30).category).toBe('Obesity class I')
    expect(bmiCategory(40).category).toBe('Obesity class III')
  })
  it('rejects bad input', () => {
    expect(calcBmi(0, 170)).toBeNull()
    expect(calcBmi(70, 0)).toBeNull()
    expect(calcBmi(NaN, 170)).toBeNull()
  })
})

describe('gpa', () => {
  it('weights by credits', () => {
    expect(calcGpa([{ credits: 3, grade: 'A' }, { credits: 3, grade: 'B' }])!.gpa).toBe(3.5)
    expect(calcGpa([{ credits: 4, grade: 'A-' }, { credits: 2, grade: 'C+' }])!.gpa).toBeCloseTo((4 * 3.7 + 2 * 2.3) / 6, 6)
  })
  it('skips empty rows and returns null with nothing to count', () => {
    expect(calcGpa([{ credits: 0, grade: 'A' }, { credits: 3, grade: '' }])).toBeNull()
    expect(calcGpa([{ credits: 3, grade: 'F' }])!.gpa).toBe(0)
  })
  it('combines with previous credits', () => {
    expect(calcCgpa(60, 3.0, 15, 4.0)).toBeCloseTo(3.2, 6)
    expect(calcCgpa(0, 0, 15, 3.5)).toBe(3.5)
    expect(calcCgpa(10, 5, 15, 3.5)).toBeNull()
  })
  it('percent hint', () => {
    expect(percentToGpa(95)).toEqual({ letter: 'A', gpa: 4 })
    expect(percentToGpa(59)).toEqual({ letter: 'F', gpa: 0 })
    expect(percentToGpa(120)).toBeNull()
  })
})

describe('working days', () => {
  const sat_sun = { weekend: [0, 6], holidays: new Set<string>() }
  it('counts inclusive and exclusive', () => {
    expect(countWorkingDays(D('2024-01-01'), D('2024-01-05'), true, sat_sun)).toBe(5)
    expect(countWorkingDays(D('2024-01-01'), D('2024-01-05'), false, sat_sun)).toBe(4)
    expect(countWorkingDays(D('2024-01-01'), D('2024-01-14'), true, sat_sun)).toBe(10)
    expect(countWorkingDays(D('2024-01-05'), D('2024-01-01'), true, sat_sun)).toBe(5)
  })
  it('skips holidays and respects other weekends', () => {
    const h = parseHolidays('2024-01-03, 2024-01-04\nnope')
    expect(h.invalid).toEqual(['nope'])
    expect(countWorkingDays(D('2024-01-01'), D('2024-01-05'), true, { weekend: [0, 6], holidays: h.dates })).toBe(3)
    expect(countWorkingDays(D('2024-01-01'), D('2024-01-07'), true, { weekend: [5, 6], holidays: new Set() })).toBe(5)
  })
  it('adds and subtracts working days', () => {
    expect(iso(addWorkingDays(D('2024-01-01'), 5, sat_sun))).toBe('2024-01-08')
    expect(iso(addWorkingDays(D('2024-01-08'), -1, sat_sun))).toBe('2024-01-05')
    expect(iso(addWorkingDays(D('2024-01-05'), 1, { weekend: [0, 6], holidays: new Set(['2024-01-08']) }))).toBe('2024-01-09')
    expect(iso(addWorkingDays(D('2024-01-05'), 0, sat_sun))).toBe('2024-01-05')
    expect(addWorkingDays(D('2024-01-05'), 3, { weekend: [0, 1, 2, 3, 4, 5, 6], holidays: new Set() })).toBeNull()
  })
})
