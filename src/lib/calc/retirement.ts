// Retirement corpus planning. Monthly compounding; returns are annual percentages.

export interface RetirementInput {
  currentAge: number
  retirementAge: number
  lifeExpectancy: number
  currentSavings: number
  monthlyContribution: number
  /** Annual return while saving, percent. */
  returnBefore: number
  /** Annual return while drawing down, percent. */
  returnAfter: number
  /** Annual inflation, percent. */
  inflation: number
  /** Monthly spending wanted in retirement, in today's money. */
  monthlyExpense: number
}

export interface RetirementResult {
  yearsToRetire: number
  yearsInRetirement: number
  /** First month's spending at retirement, after inflation. */
  expenseAtRetirement: number
  projectedCorpus: number
  requiredCorpus: number
  /** requiredCorpus minus projectedCorpus. Negative means a surplus. */
  gap: number
  /** Extra monthly saving needed to close the gap, 0 when there is none. */
  extraMonthly: number
  onTrack: boolean
}

const monthly = (annualPct: number) => Math.pow(1 + annualPct / 100, 1 / 12) - 1

/** Future value of a lump sum plus level monthly deposits made at month end. */
export function futureValue(lump: number, deposit: number, r: number, months: number): number {
  if (r === 0) return lump + deposit * months
  const g = Math.pow(1 + r, months)
  return lump * g + (deposit * (g - 1)) / r
}

/** Value at retirement needed to fund `months` of spending that starts at `first`, grows at `g` a month, and is paid at month start. */
export function requiredCorpus(first: number, g: number, r: number, months: number): number {
  if (months <= 0) return 0
  const q = (1 + g) / (1 + r)
  if (Math.abs(q - 1) < 1e-12) return first * months
  return (first * (1 - Math.pow(q, months))) / (1 - q)
}

export function validateRetirement(i: RetirementInput): string | null {
  if (Object.values(i).some((n) => !Number.isFinite(n))) return 'Fill in every field with a number.'
  if (i.currentAge < 0 || i.currentAge >= i.retirementAge) return 'Retirement age must be above your current age.'
  if (i.lifeExpectancy <= i.retirementAge) return 'Life expectancy must be above the retirement age.'
  if (i.lifeExpectancy > 130) return 'Life expectancy above 130 is not supported.'
  if (i.currentSavings < 0 || i.monthlyContribution < 0 || i.monthlyExpense < 0) return 'Amounts cannot be negative.'
  if ([i.returnBefore, i.returnAfter, i.inflation].some((r) => r <= -100 || r > 100)) return 'Rates must be between -100 and 100 percent.'
  return null
}

export function planRetirement(i: RetirementInput): RetirementResult {
  const err = validateRetirement(i)
  if (err) throw new Error(err)
  const yearsToRetire = i.retirementAge - i.currentAge
  const yearsInRetirement = i.lifeExpectancy - i.retirementAge
  const n = Math.round(yearsToRetire * 12)
  const m = Math.round(yearsInRetirement * 12)
  const rb = monthly(i.returnBefore)
  const ra = monthly(i.returnAfter)
  const g = monthly(i.inflation)
  const expenseAtRetirement = i.monthlyExpense * Math.pow(1 + g, n)
  const projectedCorpus = futureValue(i.currentSavings, i.monthlyContribution, rb, n)
  const required = requiredCorpus(expenseAtRetirement, g, ra, m)
  const gap = required - projectedCorpus
  const factor = rb === 0 ? n : (Math.pow(1 + rb, n) - 1) / rb
  const extraMonthly = gap > 0 && factor > 0 ? gap / factor : 0
  return { yearsToRetire, yearsInRetirement, expenseAtRetirement, projectedCorpus, requiredCorpus: required, gap, extraMonthly, onTrack: gap <= 0 }
}
