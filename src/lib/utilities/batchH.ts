// Pure logic for the notepad, to-do list, drawing board, dead pixel test and device info tools.

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

// ───────────── Notepad ─────────────
export const NOTES_KEY = 'stayput:notepad:v1'
export const MAX_NOTES = 200
export const MAX_NOTE_CHARS = 500_000

export interface Note {
  id: string
  title: string
  text: string
  updated: number
}

export function parseNotes(raw: string | null | undefined): Note[] {
  if (!raw) return []
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return []
  }
  const list = isObj(data) ? data.notes : data
  if (!Array.isArray(list)) return []
  const seen = new Set<string>()
  const out: Note[] = []
  for (const n of list) {
    if (!isObj(n) || typeof n.id !== 'string' || !n.id || seen.has(n.id)) continue
    if (typeof n.text !== 'string') continue
    seen.add(n.id)
    out.push({
      id: n.id,
      title: typeof n.title === 'string' && n.title.trim() ? n.title.slice(0, 100) : 'Untitled',
      text: n.text.slice(0, MAX_NOTE_CHARS),
      updated: typeof n.updated === 'number' && Number.isFinite(n.updated) ? n.updated : 0,
    })
    if (out.length >= MAX_NOTES) break
  }
  return out
}

export const serializeNotes = (notes: Note[]): string => JSON.stringify({ v: 1, notes })

export function nextNoteTitle(notes: Note[]): string {
  const titles = new Set(notes.map((n) => n.title))
  if (!titles.has('Untitled note')) return 'Untitled note'
  for (let i = 2; ; i++) if (!titles.has(`Untitled note ${i}`)) return `Untitled note ${i}`
}

export function addNote(notes: Note[], id: string, now: number): Note[] {
  return [{ id, title: nextNoteTitle(notes), text: '', updated: now }, ...notes]
}

export function renameNote(notes: Note[], id: string, title: string): Note[] {
  const t = title.trim().slice(0, 100)
  if (!t) return notes
  return notes.map((n) => (n.id === id ? { ...n, title: t } : n))
}

export function setNoteText(notes: Note[], id: string, text: string, now: number): Note[] {
  return notes.map((n) => (n.id === id ? { ...n, text: text.slice(0, MAX_NOTE_CHARS), updated: now } : n))
}

/** Returns the new list and the id that should be selected afterwards. */
export function removeNote(notes: Note[], id: string): { notes: Note[]; selected: string | null } {
  const i = notes.findIndex((n) => n.id === id)
  if (i < 0) return { notes, selected: notes[0]?.id ?? null }
  const next = notes.filter((n) => n.id !== id)
  return { notes: next, selected: next.length ? next[Math.min(i, next.length - 1)].id : null }
}

export function filterNotes(notes: Note[], query: string): Note[] {
  const q = query.trim().toLowerCase()
  if (!q) return notes
  return notes.filter((n) => n.title.toLowerCase().includes(q) || n.text.toLowerCase().includes(q))
}

export const countWords = (text: string): number => (text.trim() ? text.trim().split(/\s+/).length : 0)
export const countChars = (text: string): number => Array.from(text).length

export function noteFilename(title: string): string {
  const base = title.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '').trim().replace(/\s+/g, '-').slice(0, 60)
  return `${base || 'note'}.txt`
}

// ───────────── To-do list ─────────────
export const TODO_KEY = 'stayput:todo:v1'
export const MAX_TASKS = 2000

export interface Task {
  id: string
  text: string
  done: boolean
  due: string | null // YYYY-MM-DD
  created: number
}
export type TaskFilter = 'all' | 'active' | 'done'

export const isDateString = (s: unknown): s is string => {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const d = new Date(`${s}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s
}

function cleanTasks(list: unknown): Task[] {
  if (!Array.isArray(list)) return []
  const seen = new Set<string>()
  const out: Task[] = []
  for (const t of list) {
    if (!isObj(t) || typeof t.text !== 'string' || !t.text.trim()) continue
    let id = typeof t.id === 'string' && t.id ? t.id : ''
    if (!id || seen.has(id)) id = `t${out.length}-${seen.size}-${Math.abs(hash(t.text))}`
    if (seen.has(id)) continue
    seen.add(id)
    out.push({
      id,
      text: t.text.trim().slice(0, 500),
      done: t.done === true,
      due: isDateString(t.due) ? t.due : null,
      created: typeof t.created === 'number' && Number.isFinite(t.created) ? t.created : 0,
    })
    if (out.length >= MAX_TASKS) break
  }
  return out
}

function hash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return h
}

export function parseTodos(raw: string | null | undefined): Task[] {
  if (!raw) return []
  try {
    const data: unknown = JSON.parse(raw)
    return cleanTasks(isObj(data) ? data.tasks : data)
  } catch {
    return []
  }
}

export const serializeTodos = (tasks: Task[]): string => JSON.stringify({ v: 1, tasks })

export type ImportResult = { ok: true; tasks: Task[] } | { ok: false; error: string }

export function parseTodoImport(raw: string): ImportResult {
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return { ok: false, error: 'That file is not valid JSON.' }
  }
  const list = isObj(data) ? data.tasks : data
  if (!Array.isArray(list)) return { ok: false, error: 'No task list found in that file.' }
  const tasks = cleanTasks(list)
  if (list.length > 0 && tasks.length === 0) return { ok: false, error: 'No valid tasks found in that file.' }
  return { ok: true, tasks }
}

export const exportTodos = (tasks: Task[]): string => JSON.stringify({ app: 'stayput-todo', v: 1, tasks }, null, 2)

/** Add imported tasks after existing ones, giving clashing ids new ones. */
export function mergeTasks(current: Task[], incoming: Task[]): Task[] {
  const ids = new Set(current.map((t) => t.id))
  const added = incoming.map((t) => {
    let id = t.id
    while (ids.has(id)) id = `${id}-i`
    ids.add(id)
    return { ...t, id }
  })
  return [...current, ...added].slice(0, MAX_TASKS)
}

export function addTask(tasks: Task[], id: string, text: string, due: string | null, now: number): Task[] {
  const t = text.trim().slice(0, 500)
  if (!t) return tasks
  return [...tasks, { id, text: t, done: false, due: isDateString(due) ? due : null, created: now }]
}

export function editTask(tasks: Task[], id: string, patch: { text?: string; due?: string | null }): Task[] {
  return tasks.map((t) => {
    if (t.id !== id) return t
    const text = patch.text === undefined ? t.text : patch.text.trim().slice(0, 500) || t.text
    const due = patch.due === undefined ? t.due : isDateString(patch.due) ? patch.due : null
    return { ...t, text, due }
  })
}

export const toggleTask = (tasks: Task[], id: string): Task[] => tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t))
export const removeTask = (tasks: Task[], id: string): Task[] => tasks.filter((t) => t.id !== id)
export const clearCompleted = (tasks: Task[]): Task[] => tasks.filter((t) => !t.done)

/** Move a task one place up (-1) or down (1) in the full list. */
export function moveTask(tasks: Task[], id: string, dir: -1 | 1): Task[] {
  const i = tasks.findIndex((t) => t.id === id)
  const j = i + dir
  if (i < 0 || j < 0 || j >= tasks.length) return tasks
  const next = tasks.slice()
  ;[next[i], next[j]] = [next[j], next[i]]
  return next
}

/**
 * Move within the visible (filtered) subset: swap with the neighbouring visible task so the
 * button does something even when hidden tasks sit in between.
 */
export function moveVisible(tasks: Task[], filter: TaskFilter, id: string, dir: -1 | 1): Task[] {
  const visible = filterTasks(tasks, filter)
  const vi = visible.findIndex((t) => t.id === id)
  const other = visible[vi + dir]
  if (vi < 0 || !other) return tasks
  const next = tasks.slice()
  const a = next.findIndex((t) => t.id === id)
  const b = next.findIndex((t) => t.id === other.id)
  ;[next[a], next[b]] = [next[b], next[a]]
  return next
}

export function filterTasks(tasks: Task[], filter: TaskFilter): Task[] {
  if (filter === 'active') return tasks.filter((t) => !t.done)
  if (filter === 'done') return tasks.filter((t) => t.done)
  return tasks
}

export function taskCounts(tasks: Task[]) {
  const done = tasks.filter((t) => t.done).length
  return { total: tasks.length, done, active: tasks.length - done }
}

/** `today` is a YYYY-MM-DD string in the user's local time. */
export const isOverdue = (t: Task, today: string): boolean => !t.done && t.due !== null && t.due < today

export function localDateString(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

// ───────────── Drawing board ─────────────
export interface Pt {
  x: number
  y: number
  p: number // pressure 0..1
}
export interface Stroke {
  tool: 'brush' | 'eraser'
  color: string
  size: number
  points: Pt[]
}
export interface StrokeHistory {
  strokes: Stroke[]
  redo: Stroke[]
}
export const MAX_STROKES = 1500
export const MAX_REDO = 100

export const emptyHistory = (): StrokeHistory => ({ strokes: [], redo: [] })

export function addStroke(h: StrokeHistory, s: Stroke): StrokeHistory {
  if (s.points.length === 0) return h
  const strokes = [...h.strokes, s]
  return { strokes: strokes.length > MAX_STROKES ? strokes.slice(strokes.length - MAX_STROKES) : strokes, redo: [] }
}

export function undoStroke(h: StrokeHistory): StrokeHistory {
  if (!h.strokes.length) return h
  const last = h.strokes[h.strokes.length - 1]
  return { strokes: h.strokes.slice(0, -1), redo: [...h.redo, last].slice(-MAX_REDO) }
}

export function redoStroke(h: StrokeHistory): StrokeHistory {
  if (!h.redo.length) return h
  return { strokes: [...h.strokes, h.redo[h.redo.length - 1]], redo: h.redo.slice(0, -1) }
}

/** Pen pressure to a width multiplier. Mouse reports 0 or 0.5, which should give a normal width. */
export function pressureWidth(size: number, pressure: number, pointerType: string): number {
  if (pointerType !== 'pen' || !(pressure > 0)) return size
  return Math.max(0.5, size * (0.3 + 1.4 * Math.min(1, pressure)))
}

export const isHexColor = (s: string): boolean => /^#[0-9a-fA-F]{6}$/.test(s)

export type Background = 'white' | 'dark' | 'transparent'
export const BACKGROUND_FILL: Record<Background, string | null> = { white: '#ffffff', dark: '#1f2330', transparent: null }

// ───────────── Dead pixel test ─────────────
export interface TestColor {
  id: string
  name: string
  css: string
}
export const TEST_COLORS: TestColor[] = [
  { id: 'black', name: 'Black', css: '#000000' },
  { id: 'white', name: 'White', css: '#ffffff' },
  { id: 'red', name: 'Red', css: '#ff0000' },
  { id: 'green', name: 'Green', css: '#00ff00' },
  { id: 'blue', name: 'Blue', css: '#0000ff' },
  { id: 'yellow', name: 'Yellow', css: '#ffff00' },
  { id: 'cyan', name: 'Cyan', css: '#00ffff' },
  { id: 'magenta', name: 'Magenta', css: '#ff00ff' },
  { id: 'gradient', name: 'Gradient', css: 'linear-gradient(90deg, #000000, #ffffff)' },
]

export function stepIndex(i: number, dir: -1 | 1, len: number): number {
  if (len <= 0) return 0
  return (((i + dir) % len) + len) % len
}

// ───────────── Device info ─────────────
export interface DeviceInfo {
  screenWidth: number
  screenHeight: number
  availWidth: number
  availHeight: number
  viewportWidth: number
  viewportHeight: number
  pixelRatio: number
  colorDepth: number
  orientation: string
  touchPoints: number
  cores: number | null
  memoryGb: number | null
  languages: string[]
  timeZone: string
  userAgent: string
  online: boolean
  colorScheme: string
  reducedMotion: boolean
  contrast: string
  platform: string
}

export interface InfoRow {
  label: string
  value: string
}

export function deviceRows(i: DeviceInfo): InfoRow[] {
  const dpr = i.pixelRatio
  const physW = Math.round(i.screenWidth * dpr)
  const physH = Math.round(i.screenHeight * dpr)
  return [
    { label: 'Screen size (CSS pixels)', value: `${i.screenWidth} x ${i.screenHeight}` },
    { label: 'Approx. physical pixels', value: `${physW} x ${physH}` },
    { label: 'Available screen size', value: `${i.availWidth} x ${i.availHeight}` },
    { label: 'Viewport size', value: `${i.viewportWidth} x ${i.viewportHeight}` },
    { label: 'Device pixel ratio', value: String(dpr) },
    { label: 'Colour depth', value: `${i.colorDepth}-bit` },
    { label: 'Orientation', value: i.orientation },
    { label: 'Touch points', value: String(i.touchPoints) },
    { label: 'CPU threads', value: i.cores === null ? 'Not available' : String(i.cores) },
    { label: 'Device memory', value: i.memoryGb === null ? 'Not available' : `${i.memoryGb} GB (rounded)` },
    { label: 'Languages', value: i.languages.length ? i.languages.join(', ') : 'Not available' },
    { label: 'Time zone', value: i.timeZone || 'Not available' },
    { label: 'Platform', value: i.platform || 'Not available' },
    { label: 'Online', value: i.online ? 'Yes' : 'No' },
    { label: 'Colour scheme', value: i.colorScheme },
    { label: 'Reduced motion', value: i.reducedMotion ? 'Requested' : 'Not requested' },
    { label: 'Contrast', value: i.contrast },
    { label: 'User agent', value: i.userAgent || 'Not available' },
  ]
}

export const deviceText = (i: DeviceInfo): string => deviceRows(i).map((r) => `${r.label}: ${r.value}`).join('\n')

type Win = {
  screen?: { width?: number; height?: number; availWidth?: number; availHeight?: number; colorDepth?: number; orientation?: { type?: string } }
  innerWidth?: number
  innerHeight?: number
  devicePixelRatio?: number
  navigator?: Navigator & { deviceMemory?: number }
  matchMedia?: (q: string) => { matches: boolean }
}

/** Read everything defensively. Call from an effect or handler only. */
export function readDevice(w: Win): DeviceInfo {
  const nav = w.navigator
  const mm = (q: string) => {
    try {
      return !!w.matchMedia?.(q).matches
    } catch {
      return false
    }
  }
  const s = w.screen
  let tz = ''
  try {
    tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''
  } catch {
    /* ignore */
  }
  const w0 = s?.width ?? 0
  const h0 = s?.height ?? 0
  const orientation = s?.orientation?.type ?? (w.innerWidth && w.innerHeight ? (w.innerWidth >= w.innerHeight ? 'landscape' : 'portrait') : 'Unknown')
  return {
    screenWidth: w0,
    screenHeight: h0,
    availWidth: s?.availWidth ?? w0,
    availHeight: s?.availHeight ?? h0,
    viewportWidth: w.innerWidth ?? 0,
    viewportHeight: w.innerHeight ?? 0,
    pixelRatio: Math.round((w.devicePixelRatio ?? 1) * 100) / 100,
    colorDepth: s?.colorDepth ?? 0,
    orientation,
    touchPoints: nav?.maxTouchPoints ?? 0,
    cores: typeof nav?.hardwareConcurrency === 'number' && nav.hardwareConcurrency > 0 ? nav.hardwareConcurrency : null,
    memoryGb: typeof nav?.deviceMemory === 'number' ? nav.deviceMemory : null,
    languages: nav?.languages?.length ? [...nav.languages] : nav?.language ? [nav.language] : [],
    timeZone: tz,
    userAgent: nav?.userAgent ?? '',
    online: nav?.onLine ?? true,
    colorScheme: mm('(prefers-color-scheme: dark)') ? 'Dark' : mm('(prefers-color-scheme: light)') ? 'Light' : 'No preference',
    reducedMotion: mm('(prefers-reduced-motion: reduce)'),
    contrast: mm('(prefers-contrast: more)') ? 'More' : mm('(prefers-contrast: less)') ? 'Less' : 'No preference',
    platform: nav?.platform ?? '',
  }
}
