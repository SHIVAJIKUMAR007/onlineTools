import { named, type Loader } from '../loader'

export const loadersK: Record<string, Loader> = {
  'typing-speed-test': named(() => import('../utilities/BatchK'), 'TypingSpeedTest'),
  'random-team-picker': named(() => import('../utilities/BatchK'), 'RandomTeamPicker'),
  'would-you-rather-generator': named(() => import('../utilities/BatchK'), 'WouldYouRatherGenerator'),
  'number-memory-game': named(() => import('../utilities/BatchK'), 'NumberMemoryGame'),
  'ratio-average-calculator': named(() => import('../calculators/BatchK'), 'RatioAverageCalculator'),
}
