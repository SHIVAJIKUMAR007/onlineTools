/** Pure finance helpers. All functions return null on invalid input instead of throwing. */

const ok = (...n: number[]) => n.every((x) => Number.isFinite(x))
export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

// ───────────── EMI ─────────────
export interface EmiRow {
  month: number
  payment: number
  principal: number
  interest: number
  balance: number
}
export interface EmiResult {
  emi: number
  totalInterest: number
  totalPayment: number
  schedule: EmiRow[]
}

export function calcEmi(principal: number, annualRatePct: number, months: number): EmiResult | null {
  if (!ok(principal, annualRatePct, months) || principal <= 0 || annualRatePct < 0 || months < 1 || months > 1200) return null
  const n = Math.round(months)
  const r = annualRatePct / 12 / 100
  const emi = r === 0 ? principal / n : (principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1)
  const schedule: EmiRow[] = []
  let balance = principal
  let totalInterest = 0
  for (let m = 1; m <= n; m++) {
    const interest = balance * r
    const princ = m === n ? balance : emi - interest
    balance = m === n ? 0 : Math.max(0, balance - princ)
    totalInterest += interest
    schedule.push({ month: m, payment: princ + interest, principal: princ, interest, balance })
  }
  return { emi, totalInterest, totalPayment: principal + totalInterest, schedule }
}

export interface EmiYearRow {
  year: number
  principal: number
  interest: number
  balance: number
}
export function emiByYear(schedule: EmiRow[]): EmiYearRow[] {
  const out: EmiYearRow[] = []
  for (const row of schedule) {
    const y = Math.ceil(row.month / 12)
    let cur = out[y - 1]
    if (!cur) {
      cur = { year: y, principal: 0, interest: 0, balance: 0 }
      out[y - 1] = cur
    }
    cur.principal += row.principal
    cur.interest += row.interest
    cur.balance = row.balance
  }
  return out
}

// ───────────── SIP ─────────────
export interface SipRow {
  year: number
  invested: number
  value: number
}
export interface SipResult {
  invested: number
  futureValue: number
  gain: number
  rows: SipRow[]
}

/** Monthly SIP, contributions at the start of each month, monthly compounding of annualRate/12. Step-up raises the monthly amount once a year. */
export function calcSip(monthly: number, annualRatePct: number, years: number, stepUpPct = 0): SipResult | null {
  if (!ok(monthly, annualRatePct, years, stepUpPct) || monthly <= 0 || annualRatePct < 0 || stepUpPct < 0 || years < 1 || years > 60) return null
  const r = annualRatePct / 12 / 100
  let value = 0
  let invested = 0
  let amount = monthly
  const rows: SipRow[] = []
  for (let y = 1; y <= Math.floor(years); y++) {
    for (let m = 0; m < 12; m++) {
      value = (value + amount) * (1 + r)
      invested += amount
    }
    rows.push({ year: y, invested, value })
    amount *= 1 + stepUpPct / 100
  }
  return { invested, futureValue: value, gain: value - invested, rows }
}

// ───────────── Compound interest ─────────────
export interface CompoundRow {
  year: number
  contributed: number
  interest: number
  balance: number
}
export interface CompoundResult {
  finalBalance: number
  contributed: number
  interest: number
  rows: CompoundRow[]
}

/** Contributions are made at the end of each month (annual contribution = 12 x monthly). Interest compounds `perYear` times a year. */
export function calcCompound(principal: number, annualRatePct: number, years: number, perYear: number, monthlyContribution = 0): CompoundResult | null {
  if (!ok(principal, annualRatePct, years, perYear, monthlyContribution)) return null
  if (principal < 0 || monthlyContribution < 0 || annualRatePct < 0 || years < 1 || years > 100 || perYear < 1 || perYear > 365) return null
  if (principal === 0 && monthlyContribution === 0) return null
  const r = annualRatePct / 100
  const rows: CompoundRow[] = []
  let balance = principal
  let contributed = principal
  // Simulate per month; interest accrues in sub-steps matching the compounding frequency via an effective monthly factor.
  const monthlyFactor = Math.pow(1 + r / perYear, perYear / 12)
  for (let y = 1; y <= Math.floor(years); y++) {
    for (let m = 0; m < 12; m++) {
      balance = balance * monthlyFactor + monthlyContribution
      contributed += monthlyContribution
    }
    rows.push({ year: y, contributed, interest: balance - contributed, balance })
  }
  return { finalBalance: balance, contributed, interest: balance - contributed, rows }
}

// ───────────── GST / VAT ─────────────
export interface GstResult {
  net: number
  tax: number
  gross: number
  half: number
}
export function calcGst(amount: number, ratePct: number, mode: 'add' | 'remove'): GstResult | null {
  if (!ok(amount, ratePct) || amount < 0 || ratePct < 0 || ratePct > 1000) return null
  const net = mode === 'add' ? amount : amount / (1 + ratePct / 100)
  const gross = mode === 'add' ? amount * (1 + ratePct / 100) : amount
  const tax = gross - net
  return { net, tax, gross, half: tax / 2 }
}

// ───────────── Discount ─────────────
export interface DiscountResult {
  afterFirst: number
  afterSecond: number
  taxAmount: number
  finalPrice: number
  saved: number
  effectivePct: number
}
export function calcDiscount(price: number, discount1: number, discount2 = 0, taxPct = 0): DiscountResult | null {
  if (!ok(price, discount1, discount2, taxPct) || price < 0) return null
  if (discount1 < 0 || discount1 > 100 || discount2 < 0 || discount2 > 100 || taxPct < 0) return null
  const afterFirst = price * (1 - discount1 / 100)
  const afterSecond = afterFirst * (1 - discount2 / 100)
  const taxAmount = afterSecond * (taxPct / 100)
  const saved = price - afterSecond
  return { afterFirst, afterSecond, taxAmount, finalPrice: afterSecond + taxAmount, saved, effectivePct: price === 0 ? 0 : (saved / price) * 100 }
}

// ───────────── Tip ─────────────
export interface TipResult {
  tip: number
  total: number
  perPerson: number
  tipPerPerson: number
}
export function calcTip(bill: number, tipPct: number, people: number, roundUp = false): TipResult | null {
  if (!ok(bill, tipPct, people) || bill < 0 || tipPct < 0 || people < 1 || people > 1000) return null
  const n = Math.floor(people)
  let tip = bill * (tipPct / 100)
  let total = bill + tip
  let perPerson = total / n
  if (roundUp) {
    perPerson = Math.ceil(round2(perPerson))
    total = perPerson * n
    tip = total - bill
  }
  return { tip, total, perPerson, tipPerPerson: tip / n }
}

// ───────────── Profit margin ─────────────
export interface MarginResult {
  profit: number
  marginPct: number
  markupPct: number
}
export function calcMargin(cost: number, price: number): MarginResult | null {
  if (!ok(cost, price) || cost < 0 || price <= 0) return null
  const profit = price - cost
  return { profit, marginPct: (profit / price) * 100, markupPct: cost === 0 ? Infinity : (profit / cost) * 100 }
}
export function priceFromMargin(cost: number, marginPct: number): number | null {
  if (!ok(cost, marginPct) || cost < 0 || marginPct >= 100 || marginPct < 0) return null
  return cost / (1 - marginPct / 100)
}
export function priceFromMarkup(cost: number, markupPct: number): number | null {
  if (!ok(cost, markupPct) || cost < 0 || markupPct < 0) return null
  return cost * (1 + markupPct / 100)
}

// ───────────── Salary ─────────────
export interface SalaryResult {
  hourly: number
  daily: number
  weekly: number
  biweekly: number
  monthly: number
  annual: number
}
export function salaryFromHourly(hourly: number, hoursPerWeek: number, weeksPerYear: number, paidDays = 5): SalaryResult | null {
  if (!ok(hourly, hoursPerWeek, weeksPerYear, paidDays) || hourly < 0 || hoursPerWeek <= 0 || hoursPerWeek > 168 || weeksPerYear <= 0 || weeksPerYear > 53 || paidDays <= 0 || paidDays > 7) return null
  return build(hourly, hoursPerWeek, weeksPerYear, paidDays)
}
export function salaryFromAnnual(annual: number, hoursPerWeek: number, weeksPerYear: number, paidDays = 5): SalaryResult | null {
  if (!ok(annual, hoursPerWeek, weeksPerYear, paidDays) || annual < 0 || hoursPerWeek <= 0 || hoursPerWeek > 168 || weeksPerYear <= 0 || weeksPerYear > 53 || paidDays <= 0 || paidDays > 7) return null
  return build(annual / (hoursPerWeek * weeksPerYear), hoursPerWeek, weeksPerYear, paidDays)
}
function build(hourly: number, hpw: number, wpy: number, days: number): SalaryResult {
  const weekly = hourly * hpw
  const annual = weekly * wpy
  return { hourly, daily: weekly / days, weekly, biweekly: weekly * 2, monthly: annual / 12, annual }
}
