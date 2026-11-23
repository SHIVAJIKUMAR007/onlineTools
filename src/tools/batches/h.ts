import { named, type Loader } from '../loader'

export const loadersH: Record<string, Loader> = {
  'online-notepad': named(() => import('../utilities/BatchH'), 'OnlineNotepad'),
  'todo-list': named(() => import('../utilities/BatchH'), 'TodoList'),
  'drawing-board': named(() => import('../utilities/BatchH2'), 'DrawingBoard'),
  'dead-pixel-test': named(() => import('../utilities/BatchH2'), 'DeadPixelTest'),
  'screen-resolution-checker': named(() => import('../utilities/BatchH2'), 'ScreenResolutionChecker'),
}
