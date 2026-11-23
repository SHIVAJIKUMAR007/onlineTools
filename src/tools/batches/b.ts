import { named, type Loader } from '../loader'

const G = () => import('../calculators/General')

export const loadersB: Record<string, Loader> = {
  'age-calculator': named(G, 'AgeCalculator'),
  'percentage-calculator': named(G, 'PercentageCalculator'),
  'bmi-calculator': named(G, 'BmiCalculator'),
  'gpa-calculator': named(G, 'GpaCalculator'),
  'date-add-subtract-calculator': named(G, 'DateAddSubtractCalculator'),
  'working-days-calculator': named(G, 'WorkingDaysCalculator'),
  'week-number-calculator': named(G, 'WeekNumberCalculator'),
  'leap-year-checker': named(G, 'LeapYearChecker'),
}
