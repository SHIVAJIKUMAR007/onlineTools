import { named, type Loader } from '../loader'

const india = () => import('../calculators/India')
const fin = () => import('../calculators/Finance')

export const loadersA: Record<string, Loader> = {
  'emi-calculator': named(fin, 'EmiCalculator'),
  'ctc-to-in-hand-salary-calculator': named(india, 'CtcToTakeHome'),
  'sip-calculator': named(fin, 'SipCalculator'),
  'compound-interest-calculator': named(fin, 'CompoundInterestCalculator'),
  'gst-calculator': named(fin, 'GstCalculator'),
  'discount-calculator': named(fin, 'DiscountCalculator'),
  'tip-calculator': named(fin, 'TipCalculator'),
  'profit-margin-calculator': named(fin, 'ProfitMarginCalculator'),
  'hourly-to-annual-salary-calculator': named(fin, 'HourlyToAnnualSalaryCalculator'),
}
