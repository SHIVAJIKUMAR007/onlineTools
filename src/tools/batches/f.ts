import { named, type Loader } from '../loader'

const batch = () => import('../calculators/BatchF')

export const loadersF: Record<string, Loader> = {
  'scientific-calculator': named(batch, 'ScientificCalculator'),
  'fraction-calculator': named(batch, 'FractionCalculator'),
  'break-even-calculator': named(batch, 'BreakEvenCalculator'),
  'fd-rd-calculator': named(batch, 'FdRdCalculator'),
  'ppf-calculator': named(batch, 'PpfCalculator'),
}
