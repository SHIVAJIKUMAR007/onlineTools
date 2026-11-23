/**
 * Indian CTC to take-home salary. Estimates only: slabs are the ones announced for
 * FY 2025-26 (assessment year 2026-27). Surcharge marginal relief, special-rate
 * income and employer NPS are not modelled.
 */

export type Slab = readonly [upTo: number, rate: number]

export const NEW_REGIME_SLABS: readonly Slab[] = [
  [400_000, 0],
  [800_000, 0.05],
  [1_200_000, 0.1],
  [1_600_000, 0.15],
  [2_000_000, 0.2],
  [2_400_000, 0.25],
  [Infinity, 0.3],
]

export const OLD_REGIME_SLABS: readonly Slab[] = [
  [250_000, 0],
  [500_000, 0.05],
  [1_000_000, 0.2],
  [Infinity, 0.3],
]

export const STD_DEDUCTION_NEW = 75_000
export const STD_DEDUCTION_OLD = 50_000
export const NEW_REBATE_LIMIT = 1_200_000
export const OLD_REBATE_LIMIT = 500_000
export const PF_WAGE_CEILING_MONTHLY = 15_000
export const CESS = 0.04

export function slabTax(taxable: number, slabs: readonly Slab[]): number {
  if (!(taxable > 0)) return 0
  let tax = 0
  let lower = 0
  for (const [upTo, rate] of slabs) {
    if (taxable > lower) tax += (Math.min(taxable, upTo) - lower) * rate
    lower = upTo
    if (taxable <= upTo) break
  }
  return tax
}

function surchargeRate(taxable: number, regime: 'new' | 'old'): number {
  if (taxable > 50_000_000 && regime === 'old') return 0.37
  if (taxable > 20_000_000) return 0.25
  if (taxable > 10_000_000) return 0.15
  if (taxable > 5_000_000) return 0.1
  return 0
}

/** Tax payable in rupees including surcharge and 4% cess, rounded to the nearest rupee. */
export function incomeTax(taxable: number, regime: 'new' | 'old'): number {
  if (!(taxable > 0)) return 0
  let base: number
  if (regime === 'new') {
    base = slabTax(taxable, NEW_REGIME_SLABS)
    if (taxable <= NEW_REBATE_LIMIT) base = 0
    else base = Math.min(base, taxable - NEW_REBATE_LIMIT) // marginal relief just above 12 lakh
  } else {
    base = slabTax(taxable, OLD_REGIME_SLABS)
    if (taxable <= OLD_REBATE_LIMIT) base = 0
  }
  const withSurcharge = base * (1 + surchargeRate(taxable, regime))
  return Math.round(withSurcharge * (1 + CESS))
}

export interface SalaryInput {
  ctc: number
  /** Basic salary as a percentage of CTC. */
  basicPct: number
  /** HRA as a percentage of basic (50 for metro, 40 otherwise is common). */
  hraPctOfBasic: number
  /** Limit PF to 12% of 15,000 a month. */
  pfCap: boolean
  includeGratuity: boolean
  /** Employer-paid insurance or other benefits counted inside CTC, per year. */
  employerBenefits: number
  /** Professional tax per month (old regime only for tax purposes). */
  professionalTaxMonthly: number
  // Old regime only
  rentAnnual: number
  metro: boolean
  /** 80C investments other than the employee PF, per year. */
  ded80C: number
  ded80D: number
  /** NPS under 80CCD(1B). */
  nps: number
  homeLoanInterest: number
  otherDeductions: number
}

export interface RegimeResult {
  taxable: number
  tax: number
  annualInHand: number
  monthlyInHand: number
  monthlyTax: number
}

export interface SalaryResult {
  basic: number
  hra: number
  special: number
  gross: number
  employerPf: number
  employeePf: number
  gratuity: number
  employerBenefits: number
  professionalTax: number
  hraExemption: number
  deductions80C: number
  /** True when CTC components exceed CTC so special allowance would be negative. */
  negativeSpecial: boolean
  newRegime: RegimeResult
  oldRegime: RegimeResult
  better: 'new' | 'old' | 'same'
}

export const DEFAULT_INPUT: SalaryInput = {
  ctc: 1_200_000,
  basicPct: 40,
  hraPctOfBasic: 50,
  pfCap: false,
  includeGratuity: true,
  employerBenefits: 0,
  professionalTaxMonthly: 200,
  rentAnnual: 0,
  metro: true,
  ded80C: 0,
  ded80D: 0,
  nps: 0,
  homeLoanInterest: 0,
  otherDeductions: 0,
}

const pos = (n: number) => (Number.isFinite(n) && n > 0 ? n : 0)

export function hraExemption(hra: number, basic: number, rent: number, metro: boolean): number {
  if (!(rent > 0) || !(hra > 0)) return 0
  return Math.max(0, Math.min(hra, rent - 0.1 * basic, (metro ? 0.5 : 0.4) * basic))
}

export function calcSalary(input: SalaryInput): SalaryResult | null {
  const ctc = input.ctc
  if (!Number.isFinite(ctc) || ctc <= 0) return null
  const basicPct = Math.min(100, pos(input.basicPct))
  const hraPct = Math.min(100, pos(input.hraPctOfBasic))

  const basic = (ctc * basicPct) / 100
  const hra = (basic * hraPct) / 100
  const pfWage = input.pfCap ? Math.min(basic, PF_WAGE_CEILING_MONTHLY * 12) : basic
  const employerPf = pfWage * 0.12
  const employeePf = pfWage * 0.12
  const gratuity = input.includeGratuity ? basic * (15 / 26 / 12) : 0
  const benefits = pos(input.employerBenefits)
  const gross = ctc - employerPf - gratuity - benefits
  const special = gross - basic - hra
  const professionalTax = pos(input.professionalTaxMonthly) * 12

  // New regime: standard deduction only.
  const newTaxable = Math.max(0, gross - STD_DEDUCTION_NEW)
  const newTax = incomeTax(newTaxable, 'new')

  // Old regime: standard deduction, HRA, professional tax, Chapter VI-A deductions.
  const exemption = hraExemption(hra, basic, pos(input.rentAnnual), input.metro)
  const d80c = Math.min(150_000, employeePf + pos(input.ded80C))
  const oldDeductions =
    STD_DEDUCTION_OLD +
    exemption +
    professionalTax +
    d80c +
    Math.min(100_000, pos(input.ded80D)) +
    Math.min(50_000, pos(input.nps)) +
    Math.min(200_000, pos(input.homeLoanInterest)) +
    pos(input.otherDeductions)
  const oldTaxable = Math.max(0, gross - oldDeductions)
  const oldTax = incomeTax(oldTaxable, 'old')

  const result = (taxable: number, tax: number, ptDeducted: number): RegimeResult => {
    const annualInHand = gross - employeePf - ptDeducted - tax
    return { taxable, tax, annualInHand, monthlyInHand: annualInHand / 12, monthlyTax: tax / 12 }
  }
  const newRegime = result(newTaxable, newTax, professionalTax)
  const oldRegime = result(oldTaxable, oldTax, professionalTax)

  return {
    basic,
    hra,
    special,
    gross,
    employerPf,
    employeePf,
    gratuity,
    employerBenefits: benefits,
    professionalTax,
    hraExemption: exemption,
    deductions80C: d80c,
    negativeSpecial: special < 0,
    newRegime,
    oldRegime,
    better: Math.abs(newRegime.annualInHand - oldRegime.annualInHand) < 1 ? 'same' : newRegime.annualInHand > oldRegime.annualInHand ? 'new' : 'old',
  }
}
