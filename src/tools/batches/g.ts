import { named, type Loader } from '../loader'

const calc = () => import('../calculators/BatchG')
const util = () => import('../utilities/BatchG')

export const loadersG: Record<string, Loader> = {
  'calorie-calculator': named(calc, 'CalorieCalculator'),
  'fuel-cost-calculator': named(calc, 'FuelCostCalculator'),
  'electricity-bill-calculator': named(calc, 'ElectricityBillCalculator'),
  'time-zone-converter': named(util, 'TimeZoneConverter'),
  'zodiac-sign-finder': named(util, 'ZodiacSignFinder'),
}
