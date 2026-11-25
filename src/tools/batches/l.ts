import type { Loader } from '../loader'

export const loadersL: Record<string, Loader> = {
  'anagram-checker': () => import('../text/AnagramChecker'),
  'number-base-converter': () => import('../developer/NumberBaseConverter'),
  'retirement-calculator': () => import('../calculators/RetirementCalculator'),
  'image-filters': () => import('../image/ImageFilters'),
}
