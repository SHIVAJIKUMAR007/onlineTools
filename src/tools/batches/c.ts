import { named, type Loader } from '../loader'

export const loadersC: Record<string, Loader> = {
  'countdown-timer': named(() => import('../utilities/Timers'), 'CountdownTimer'),
  stopwatch: named(() => import('../utilities/Timers'), 'Stopwatch'),
  'pomodoro-timer': named(() => import('../utilities/Timers'), 'PomodoroTimer'),
  'random-number-generator': named(() => import('../utilities/Random'), 'RandomNumberGenerator'),
  'picker-wheel': named(() => import('../utilities/Wheel'), 'PickerWheel'),
  'reaction-time-test': named(() => import('../utilities/Tests'), 'ReactionTimeTest'),
  'click-speed-test': named(() => import('../utilities/Tests'), 'ClickSpeedTest'),
  'keyboard-key-code-tester': named(() => import('../utilities/Tests'), 'KeyCodeTester'),
}
